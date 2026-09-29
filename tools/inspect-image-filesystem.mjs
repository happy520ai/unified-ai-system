// Read the shipped contents of a published image straight out of the registry, with no Docker engine.
//
// This exists because docs/security/mcp-image-review-0.4.9.md's steps 3-6 got their filesystem out of
// `docker create` + `docker export`, and that made the newest completed content review lag the newest release
// by three versions: no daemon, no review, and three external catalogs still pinning 0.4.9. Every question
// those steps ask - is anything setuid, what lives under /app, do shipped package manifests carry install
// hooks, are there native modules, does the config run as root - is a property of the layer tarballs, and the
// registry serves those tarballs to an anonymous pull token. Nothing here executes anything from the image.
//
//   node tools/inspect-image-filesystem.mjs 0.8.0 [--arch amd64] [--json artifact.json]
//
// What this does NOT prove, and the review page must keep saying so: not what the code does at runtime, not
// that the image is safe to run, not that the digest is trustworthy beyond the sha256 recomputed here, and not
// anything about a platform other than the one read.
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { DEFAULT_REPOSITORY, MANIFEST_ACCEPT } from "./verify-image-roster.mjs";
import { isGzip, gunzipSync, tarEntries, applyWhiteouts, inspectEntries, lifecycleHooksOf, fileHeader } from "./oci-image-fs.mjs";

const TIMEOUT_MS = 120000;
const UA = "unified-ai-system-image-review";
const decoder = new TextDecoder();
// Enough to read an ELF header, and nothing more: a native module is megabytes, and its machine field lives in
// the first 20.
const HEADER_PREFIX_BYTES = 64;
const ELF_MACHINE_BY_ARCH = { amd64: 0x3e, arm64: 0xb7, arm: 0x28, riscv64: 0xf3 };

async function fetchBytes(url, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, ...headers }, signal: controller.signal });
    if (!res.ok) return { status: res.status, bytes: null, contentDigest: res.headers.get("docker-content-digest") };
    return { status: res.status, bytes: new Uint8Array(await res.arrayBuffer()), contentDigest: res.headers.get("docker-content-digest") };
  } catch {
    return { status: 0, bytes: null, contentDigest: null };
  } finally {
    clearTimeout(timer);
  }
}

export function pickChild(index, arch) {
  for (const member of Array.isArray(index?.manifests) ? index.manifests : []) {
    if (member?.platform?.architecture === arch && member?.platform?.os === "linux") return member.digest;
  }
  return null;
}

// Env VALUES are never read out of the image config: a config can carry a token, and this tool's output is a
// public review page. Only the names are reported, which is what the "does it bake in credentials" question needs.
export function configFacts(config) {
  const c = (config && config.config) || {};
  return {
    architecture: config?.architecture ?? null,
    os: config?.os ?? null,
    created: config?.created ?? null,
    user: c.User ?? null,
    entrypoint: Array.isArray(c.Entrypoint) ? c.Entrypoint : null,
    cmd: Array.isArray(c.Cmd) ? c.Cmd : null,
    working_dir: c.WorkingDir ?? null,
    env_names: (Array.isArray(c.Env) ? c.Env : []).map((pair) => String(pair).split("=")[0]).sort(),
    exposed_ports: Object.keys(c.ExposedPorts || {}).sort(),
    volumes: Object.keys(c.Volumes || {}).sort(),
    history_entries: Array.isArray(config?.history) ? config.history.length : null,
  };
}

export function evaluate({ tag, repository, arch, indexDigest, manifestDigest, configDigest, layers, merged }) {
  const problems = [];
  const facts = {
    tag,
    repository,
    arch,
    index_digest: indexDigest,
    manifest_digest: manifestDigest,
    config_digest: configDigest,
    layers_scanned: layers.length,
    // The per-layer digest list belongs in the published artifact: it is what lets a stranger re-fetch the same
    // bytes, and it is what makes a two-architecture comparison a comparison instead of two empty arrays that
    // happen to be equal.
    layers,
    layer_digests_all_verified: layers.every((l) => l.digest_verified === true),
  };
  if (!layers.length) problems.push("the manifest lists no layers, so there is nothing here to review");
  if (!layers.every((l) => l.digest_verified === true)) problems.push("a layer blob did not match the digest the manifest claimed");
  if (!merged.length) problems.push("the merged filesystem holds no entries, which is a blind read rather than an empty image");
  const found = inspectEntries(merged);
  const manifests = merged.filter((e) => e.isFile && e.name.startsWith("app/") && e.name.endsWith("package.json"));
  const hooks = manifests.filter((e) => e.content).flatMap((e) => lifecycleHooksOf(decoder.decode(e.content), e.name));
  facts.package_manifests_read = manifests.filter((e) => e.content).length;
  facts.lifecycle_hooks = hooks;
  if (!manifests.length) problems.push("no package.json under app/ was found, so the install-hook question is unanswered");
  if (!found.app_files) problems.push("the merged filesystem has no files under app/, so this is not the image our docs describe");
  facts.findings = found;
  // A wrong-architecture native module is a FINDING, not an instrument failure: the read is trustworthy and the
  // image has a defect. Refusing would fold "the review worked and said something bad" into "the review did not
  // work", which is how real problems get edited out of a report.
  const expectedMachine = ELF_MACHINE_BY_ARCH[arch] ?? null;
  const natives = merged.filter((e) => e.isFile && e.name.endsWith(".node"));
  facts.native_modules = natives.map((e) => ({ name: e.name, size: e.size, header: fileHeader(e.content) }));
  facts.expected_elf_machine = expectedMachine === null ? null : `0x${expectedMachine.toString(16)}`;
  facts.elf_arch_mismatch = expectedMachine === null ? [] : facts.native_modules.filter((n) => n.header.flavor === "elf" && n.header.machine !== expectedMachine).map((n) => `${n.name} (${n.header.detail})`);
  facts.foreign_platform_modules = facts.native_modules.filter((n) => n.header.flavor === "mach-o" || n.header.flavor === "pe").map((n) => `${n.name} (${n.header.flavor})`);
  return { problems, facts };
}

function valueOf(argv, name, dflt) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : dflt;
}

async function run(argv) {
  if (argv.includes("--help")) {
    console.log("usage: node tools/inspect-image-filesystem.mjs <tag> [--repository ghcr-path] [--arch amd64|arm64] [--json out.json]");
    console.log("reads every layer blob of a published OCI image over an anonymous registry token and reports the");
    console.log("shipped filesystem. Nothing from the image is executed, and no env value is printed.");
    return 0;
  }
  const tag = argv.find((a) => !a.startsWith("--")) || "latest";
  const repository = valueOf(argv, "--repository", DEFAULT_REPOSITORY);
  const arch = valueOf(argv, "--arch", "amd64");
  const base = `https://ghcr.io/v2/${repository}`;

  const tokenResponse = await fetchBytes(`https://ghcr.io/token?scope=repository:${repository}:pull`, { Accept: "application/json" });
  if (!tokenResponse.bytes) throw new Error(`REFUSED: the anonymous pull token request returned HTTP ${tokenResponse.status}`);
  const token = JSON.parse(decoder.decode(tokenResponse.bytes)).token;
  if (!token) throw new Error("REFUSED: the token response carried no token");
  const auth = { Authorization: `Bearer ${token}` };
  const getJson = async (url) => {
    const r = await fetchBytes(url, { ...auth, Accept: MANIFEST_ACCEPT });
    if (!r.bytes) throw new Error(`REFUSED: ${url} -> HTTP ${r.status}`);
    return { json: JSON.parse(decoder.decode(r.bytes)), digest: r.contentDigest };
  };
  // A blob is only trusted after its sha256 is recomputed from the bytes we hold, so a truncated download or a
  // substituted layer fails here instead of becoming a finding in a public review page.
  const getBlob = async (digest, mediaAccept) => {
    const r = await fetchBytes(`${base}/blobs/${digest}`, { ...auth, Accept: mediaAccept || "*/*" });
    if (!r.bytes) throw new Error(`REFUSED: blob ${digest} -> HTTP ${r.status}`);
    const computed = `sha256:${createHash("sha256").update(r.bytes).digest("hex")}`;
    if (computed !== digest) throw new Error(`REFUSED: blob ${digest} recomputed as ${computed}`);
    return r.bytes;
  };

  const indexResponse = await getJson(`${base}/manifests/${tag}`);
  const index = indexResponse.json;
  const child = Array.isArray(index?.manifests) ? pickChild(index, arch) : null;
  if (Array.isArray(index?.manifests) && !child) throw new Error(`REFUSED: ${repository}:${tag} carries no linux/${arch} child`);
  // The registry's own Docker-Content-Digest is what a stranger can ask for again and compare. A hash computed
  // over the JSON we re-serialised would be a different number for the same manifest, and a review page that
  // published one would be pinning something nobody else can reproduce.
  const indexDigest = indexResponse.digest || "(the registry reported no digest header)";
  const manifestResponse = child ? await getJson(`${base}/manifests/${child}`) : indexResponse;
  const manifest = manifestResponse.json;
  const manifestDigest = child || manifestResponse.digest || "(the registry reported no digest header)";
  if (!manifest.config?.digest) throw new Error("REFUSED: the manifest carries no config descriptor");
  const config = JSON.parse(decoder.decode(await getBlob(manifest.config.digest, "application/vnd.oci.image.config.v1+json")));

  const all = [];
  const layers = [];
  for (const layer of Array.isArray(manifest.layers) ? manifest.layers : []) {
    const raw = await getBlob(layer.digest);
    const bytes = isGzip(raw) ? new Uint8Array(gunzipSync(raw)) : raw;
    const entries = [...tarEntries(bytes, {
      label: layer.digest.slice(0, 19),
      contentFor: (e) => {
        if (!e.isFile) return false;
        if (e.name.startsWith("app/") && e.name.endsWith("package.json") && e.size < 200000) return true;
        if (e.name.endsWith(".node")) return HEADER_PREFIX_BYTES;
        return false;
      },
    })];
    layers.push({ digest: layer.digest, digest_verified: true, compressed_bytes: raw.length, uncompressed_bytes: bytes.length, entries: entries.length });
    all.push(...entries);
  }
  const merged = applyWhiteouts(all);
  const { problems, facts } = evaluate({ tag, repository, arch, indexDigest, manifestDigest, configDigest: manifest.config.digest, layers, merged });
  facts.config = configFacts(config);

  const f = facts.findings;
  console.log(`${repository}:${tag}  linux/${arch}  manifest ${String(facts.manifest_digest).slice(0, 23)}...`);
  console.log(`  config      user=${facts.config.user ?? "(unset)"} working_dir=${facts.config.working_dir ?? "(unset)"} entrypoint=${JSON.stringify(facts.config.entrypoint)} env_names=${facts.config.env_names.length} history=${facts.config.history_entries}`);
  console.log(`  layers      ${facts.layers_scanned} read, digests verified=${facts.layer_digests_all_verified}, compressed ${layers.reduce((s, l) => s + l.compressed_bytes, 0)} bytes`);
  console.log(`  filesystem  ${f.files} files / ${f.directories} dirs / ${f.entries} entries after ${merged.length} merged (whiteouts applied)`);
  console.log(`  app/        ${f.app_files} files, ${f.app_bytes} bytes, ${facts.package_manifests_read} package manifests read, ${facts.lifecycle_hooks.length} install-time hooks`);
  console.log(`  risk bits   setuid=${f.setuid.length} setgid=${f.setgid.length} world_writable=${f.world_writable.length} devices=${f.device_files.length} symlinks_escaping_root=${f.symlinks_escaping_root.length} native_modules=${f.native_modules.length}`);
  if (f.setuid.length || f.world_writable.length || f.symlinks_escaping_root.length || facts.lifecycle_hooks.length) {
    console.log(`  listed      setuid=${JSON.stringify(f.setuid.slice(0, 5))} world_writable=${JSON.stringify(f.world_writable.slice(0, 5))} hooks=${JSON.stringify(facts.lifecycle_hooks.slice(0, 3))}`);
  }
  console.log(`  native      ${facts.native_modules.length} modules, expected ELF machine ${facts.expected_elf_machine ?? "(arch unknown)"}, arch_mismatch=${facts.elf_arch_mismatch.length}, foreign_platform=${facts.foreign_platform_modules.length}`);
  for (const mismatch of facts.elf_arch_mismatch) console.log(`    mismatch    ${mismatch}`);
  console.log(`IMAGE_REVIEW version=${tag.replace(/^v/, "")} arch=${arch} layers=${facts.layers_scanned} files=${f.files} app_files=${f.app_files} setuid=${f.setuid.length} setgid=${f.setgid.length} world_writable=${f.world_writable.length} native_modules=${f.native_modules.length} elf_arch_mismatch=${facts.elf_arch_mismatch.length} foreign_platform_modules=${facts.foreign_platform_modules.length} lifecycle_hooks=${facts.lifecycle_hooks.length} devices=${f.device_files.length} escaping_links=${f.symlinks_escaping_root.length} config_user=${facts.config.user ?? "unset"} problem_count=${problems.length}`);
  if (argv.includes("--json")) {
    const out = valueOf(argv, "--json", null);
    writeFileSync(out, JSON.stringify({ read_at_utc: new Date().toISOString(), facts, problems }, null, 2) + "\n");
    console.log(`WROTE ${out}`);
  }
  if (problems.length) {
    console.error("REFUSED: " + problems.join("; "));
    return 3;
  }
  return 0;
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  // process.exit() here aborts on Windows: node v25 hits a libuv assertion (`UV_HANDLE_CLOSING`) while the
  // fetch handles are still draining and the shell sees 127 instead of the verdict. Setting exitCode lets the
  // loop close cleanly and keeps 0/2/3 meaningful.
  try {
    process.exitCode = await run(process.argv.slice(2));
  } catch (err) {
    console.error(String(err && err.message ? err.message : err));
    process.exitCode = 2;
  }
}
