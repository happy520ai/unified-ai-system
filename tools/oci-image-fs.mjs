// The OCI layer-tar reader the image content review needs, with no Docker engine and no execution.
//
// Why a separate module: docs/security/mcp-image-review-0.4.9.md's steps 3-6 got the shipped filesystem out
// of `docker create` + `docker export`. Everything those steps look at - path safety, setuid bits, native
// modules, package lifecycle hooks, the /app inventory - is a property of the layer tarballs themselves, and
// GHCR serves those tarballs over an anonymous pull token. Reading them directly is a weaker dependency, not
// a stronger claim: nothing here runs anything from the image, and nothing here proves what the image does at
// runtime.
//
// Deliberately not shared with tools/verify-image-roster.mjs: that tool stops at the first member matching one
// suffix, this one has to enumerate every entry across every layer and merge whiteouts. Same format, different
// job, and touching a gate-covered security tool to serve both would have put its test pins at risk for nothing.
const { gzipSync, gunzipSync } = await import("node:zlib");
export { gzipSync, gunzipSync };

export const BLOCK = 512;
const TYPE_FILE = new Set(["0", "\0", "", "7"]);
export const TYPE_NAMES = { "0": "file", "\0": "file", "": "file", "5": "dir", "2": "symlink", "1": "hardlink", "3": "char", "4": "block", "6": "fifo", "L": "longname", "x": "pax", "g": "pax-global" };

export function isGzip(bytes) {
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

export function cstr(bytes, offset, length) {
  let end = offset;
  while (end < offset + length && bytes[end] !== 0) end += 1;
  return new TextDecoder().decode(bytes.subarray(offset, end));
}

// Octal fields are ASCII digits, sometimes space- or NUL-terminated, and GNU writers emit leading zeros or
// base-256 for huge values. Base-256 (high bit set) is how a tar stores a size over 8 GiB; a review that
// silently read it as garbage would invent a size, so it is decoded properly here.
export function octalField(bytes, offset, length) {
  const first = bytes[offset];
  if ((first & 0x80) !== 0) {
    let value = 0;
    for (let i = offset + 1; i < offset + length; i += 1) value = value * 256 + bytes[i];
    return value;
  }
  const text = cstr(bytes, offset, length).trim();
  if (!/^[0-7]*$/u.test(text)) throw new Error(`REFUSED: octal field at byte ${offset} holds "${text}", which is not octal`);
  return text.length ? Number.parseInt(text, 8) : 0;
}

export function headerChecksumValid(bytes) {
  const stored = octalField(bytes, 148, 8);
  let sum = 0;
  for (let i = 0; i < BLOCK; i += 1) sum += i >= 148 && i < 156 ? 0x20 : bytes[i];
  return sum === stored;
}

function paxValue(payload, key) {
  for (const record of payload.split("\n")) {
    const m = new RegExp("^\\s*\\d+ " + key + "=(.*)$", "u").exec(record);
    if (m) return m[1];
  }
  return null;
}

function normalizeName(raw) {
  const name = raw.replace(/^\.\/+/, "").replace(/^\/+/, "");
  // A `..` component would let one layer write outside the merged root, which is the exact class of finding
  // this review exists to catch, so it is a refusal rather than a row in a table.
  if (name.split("/").includes("..")) throw new Error(`REFUSED: tar entry name "${raw}" contains a ".." component`);
  return name;
}

// Yields one record per tar entry, in archive order, with GNU long names and pax `path` overrides applied.
// Truncation is a refusal: a review that quietly stopped at byte N would report fewer files and look clean.
export function* tarEntries(bytes, { label = "layer", contentFor = null } = {}) {
  let offset = 0;
  let pendingLongName = null;
  let pendingPaxPath = null;
  while (offset + BLOCK <= bytes.length) {
    const header = bytes.subarray(offset, offset + BLOCK);
    if (header.every((b) => b === 0)) {
      offset += BLOCK;
      continue;
    }
    if (!headerChecksumValid(header)) throw new Error(`REFUSED: ${label} has a bad header checksum at byte ${offset}`);
    const typeflag = String.fromCharCode(header[156]);
    const size = octalField(header, 124, 12);
    if (offset + BLOCK + size > bytes.length) throw new Error(`REFUSED: ${label} truncated - header at byte ${offset} claims ${size} bytes and only ${bytes.length - offset - BLOCK} remain`);
    const payload = bytes.subarray(offset + BLOCK, offset + BLOCK + size);
    let name = pendingLongName ?? (pendingPaxPath ?? cstr(header, 0, 100));
    if (!pendingLongName && !pendingPaxPath) {
      const prefix = cstr(header, 345, 155);
      if (prefix) name = `${prefix}/${name}`;
    }
    pendingLongName = null;
    pendingPaxPath = null;
    if (typeflag === "L") {
      pendingLongName = new TextDecoder().decode(payload).replace(/\0+$/u, "");
      offset += BLOCK + Math.ceil(size / BLOCK) * BLOCK;
      continue;
    }
    if (typeflag === "x" || typeflag === "g") {
      const text = new TextDecoder().decode(payload);
      const override = paxValue(text, "path");
      if (override !== null) pendingPaxPath = override;
      offset += BLOCK + Math.ceil(size / BLOCK) * BLOCK;
      continue;
    }
    const mode = octalField(header, 100, 8);
    const linkName = cstr(header, 157, 100);
    const record = {
      name: normalizeName(name),
      kind: TYPE_NAMES[typeflag] ?? `type${typeflag}`,
      isFile: TYPE_FILE.has(typeflag),
      mode,
      uid: octalField(header, 108, 8),
      gid: octalField(header, 116, 8),
      size,
      // A link target is not an entry name: `../etc/passwd` is precisely the finding this review reports, so it
      // is kept verbatim for inspectEntries to flag rather than refused out of existence.
      linkName: linkName.replace(/^\.\//u, ""),
    };
    // Payloads are attached only where the caller asks, because holding every file body across every layer of a
    // Node image is hundreds of megabytes for a review that reads a handful of package manifests. The predicate
    // may return a number to ask for only that many leading bytes - enough to read a binary's header.
    const want = contentFor ? contentFor(record) : false;
    if (want) record.content = want === true ? payload : payload.subarray(0, Math.min(want, payload.length));
    yield record;
    offset += BLOCK + Math.ceil(size / BLOCK) * BLOCK;
  }
  if (offset !== bytes.length && bytes.length - offset >= BLOCK) {
    throw new Error(`REFUSED: ${label} ends with ${bytes.length - offset} trailing bytes, which is not a block multiple`);
  }
}

// The effective filesystem after every layer, applying OCI whiteouts. Without this a review of a multi-layer
// image reports files the container never sees, which is how an old deleted setuid binary keeps being counted.
export function applyWhiteouts(allEntries) {
  const merged = new Map();
  for (const entry of allEntries) {
    const base = entry.name.includes("/") ? entry.name.slice(entry.name.lastIndexOf("/") + 1) : entry.name;
    if (base === ".wh..wh..opq") {
      // An opaque marker empties a directory's previous contents; the directory itself still exists in the
      // merged root, so it must survive or the review would report a missing directory that a container has.
      const dir = entry.name.slice(0, entry.name.length - base.length);
      for (const key of [...merged.keys()]) if (key.startsWith(dir) && key !== dir) merged.delete(key);
      continue;
    }
    if (base.startsWith(".wh.")) {
      const victim = entry.name.slice(0, entry.name.length - base.length) + base.slice(4);
      merged.delete(victim);
      if (victim.endsWith("/")) for (const key of [...merged.keys()]) if (key.startsWith(victim)) merged.delete(key);
      continue;
    }
    if (entry.kind === "dir") merged.set(entry.name.endsWith("/") ? entry.name : `${entry.name}/`, entry);
    else merged.set(entry.name, entry);
  }
  return [...merged.values()];
}

// Whether a link target resolves above the merged root. An absolute target is NOT an escape - `/lib/x.so` is
// inside the container - and neither is a `..` that stays below the top: from `app/link`, `../etc/passwd`
// resolves to `etc/passwd`. Asking the wrong question here reported 820 findings on a Debian-based image whose
// real count is zero, which is how a review page ends up being believed about nothing.
export function resolvesOutsideRoot(name, linkName) {
  if (!linkName) return false;
  const dir = name.includes("/") ? name.slice(0, name.lastIndexOf("/")) : "";
  const stack = (linkName.startsWith("/") ? linkName.slice(1) : (dir ? `${dir}/` : "") + linkName).split("/");
  const resolved = [];
  for (const part of stack) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (!resolved.length) return true;
      resolved.pop();
      continue;
    }
    resolved.push(part);
  }
  return false;
}

// A file's own header, read from its leading bytes. The reason this exists: the arm64 tag of our image ships
// native modules named `*-linux-x64-gnu.node`, and a review that reported "wrong architecture" from a FILE NAME
// would be an inference. The ELF `e_machine` field is a reading.
export const ELF_MACHINES = { 0x03: "Intel 80386", 0x28: "ARM", 0x3e: "x86-64", 0xb7: "AArch64", 0xf3: "RISC-V" };
const MACH_O_MAGICS = { 0xfeedface: "mach-o 32", 0xfeedfacf: "mach-o 64", 0xcafebabe: "mach-o fat" };

export function fileHeader(bytes) {
  if (!bytes || bytes.length < 20) return { flavor: "unknown", detail: "fewer than 20 bytes" };
  if (bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) {
    const cls = bytes[4] === 1 ? "32-bit" : bytes[4] === 2 ? "64-bit" : `class ${bytes[4]}`;
    const little = bytes[5] === 1;
    if (bytes[5] !== 1 && bytes[5] !== 2) return { flavor: "elf", detail: `${cls}, unreadable endian byte ${bytes[5]}` };
    const machine = little ? bytes[18] | (bytes[19] << 8) : (bytes[18] << 8) | bytes[19];
    return { flavor: "elf", detail: `${cls} ${little ? "LSB" : "MSB"} ${ELF_MACHINES[machine] ?? `machine 0x${machine.toString(16)}`}`, machine, bits: cls };
  }
  const word = bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24);
  if (MACH_O_MAGICS[word >>> 0] || MACH_O_MAGICS[((word << 16) | (word >>> 16)) >>> 0]) {
    return { flavor: "mach-o", detail: MACH_O_MAGICS[word >>> 0] ?? "mach-o (byte-swapped magic)" };
  }
  if (bytes[0] === 0x4d && bytes[1] === 0x5a) return { flavor: "pe", detail: "MZ header (Windows)" };
  if (bytes[0] === 0x23 && bytes[1] === 0x21) return { flavor: "script", detail: `#! ${new TextDecoder().decode(bytes.subarray(2, Math.min(bytes.length, 40))).split("\n")[0]}`.trim() };
  return { flavor: "data", detail: `first bytes ${bytes[0].toString(16).padStart(2, "0")}${bytes[1].toString(16).padStart(2, "0")}` };
}

// Findings a reviewer can be asked about, computed from bytes only.
export function inspectEntries(entries) {
  const files = entries.filter((e) => e.kind === "file");
  const setuid = files.filter((e) => (e.mode & 0o4000) !== 0).map((e) => e.name).sort();
  const setgid = files.filter((e) => (e.mode & 0o2000) !== 0).map((e) => e.name).sort();
  // The other-write BIT, not the whole other nibble: 0o666 and 0o777 are world-writable, and a predicate that
  // asked for the nibble to equal 0o002 would report neither.
  const worldWritable = files.filter((e) => (e.mode & 0o002) !== 0).map((e) => e.name).sort();
  const executables = files.filter((e) => (e.mode & 0o111) !== 0).map((e) => e.name).sort();
  const nativeModules = files.filter((e) => e.name.endsWith(".node")).map((e) => e.name).sort();
  const deviceFiles = entries.filter((e) => e.kind === "char" || e.kind === "block").map((e) => e.name).sort();
  const links = entries.filter((e) => e.kind === "symlink");
  const escapingLinks = links.filter((e) => resolvesOutsideRoot(e.name, e.linkName)).map((e) => `${e.name}->${e.linkName}`).sort();
  const appFiles = files.filter((e) => e.name.startsWith("app/"));
  const scripts = appFiles.filter((e) => /\.(?:sh|bash|py|pl)$/u.test(e.name)).map((e) => e.name).sort();
  return {
    entries: entries.length,
    files: files.length,
    directories: entries.filter((e) => e.kind === "dir").length,
    total_bytes: files.reduce((sum, e) => sum + e.size, 0),
    setuid,
    setgid,
    world_writable: worldWritable,
    executables: executables.length,
    executable_sample: executables.slice(0, 12),
    native_modules: nativeModules,
    device_files: deviceFiles,
    symlinks: links.length,
    symlinks_escaping_root: escapingLinks,
    hardlinks: entries.filter((e) => e.kind === "hardlink").length,
    app_files: appFiles.length,
    app_bytes: appFiles.reduce((sum, e) => sum + e.size, 0),
    app_scripts: scripts,
    root_owned_only: files.every((e) => e.uid === 0) ? null : files.filter((e) => e.uid !== 0).length,
  };
}

// A package.json's install-time hooks are the reason this review reads file contents at all: they run during
// `npm install` inside a build, and a shipped node_modules tree can still carry them.
export function lifecycleHooksOf(jsonText, label) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`REFUSED: ${label} is not JSON`);
  }
  const scripts = parsed && typeof parsed.scripts === "object" && parsed.scripts ? parsed.scripts : {};
  return ["preinstall", "install", "postinstall"].filter((hook) => typeof scripts[hook] === "string" && scripts[hook].length).map((hook) => ({ name: parsed.name ?? label, hook, command: scripts[hook] }));
}

// Used by the tests to build fixture layers with the same writer the reader trusts.
export function buildTar(entries) {
  const blocks = [];
  const encoder = new TextEncoder();
  for (const entry of entries) {
    const header = new Uint8Array(BLOCK);
    const nameBytes = encoder.encode(entry.name);
    header.set(nameBytes.subarray(0, 100), 0);
    const write = (value, offset, length) => header.set(encoder.encode(value.padStart(length - 1, "0") + "\0"), offset);
    write((entry.mode ?? 0o644).toString(8), 100, 8);
    write((entry.uid ?? 0).toString(8), 108, 8);
    write((entry.gid ?? 0).toString(8), 116, 8);
    const payload = entry.payload ? encoder.encode(entry.payload) : new Uint8Array(0);
    write(payload.length.toString(8), 124, 12);
    write("0", 136, 12);
    header.set(encoder.encode("        "), 148);
    header[156] = (entry.typeflag ?? "0").codePointAt(0);
    if (entry.linkName) header.set(encoder.encode(entry.linkName).subarray(0, 100), 157);
    header.set(encoder.encode("ustar\0"), 257);
    header.set(encoder.encode("00"), 263);
    let sum = 0;
    for (const byte of header) sum += byte;
    header.set(encoder.encode(sum.toString(8).padStart(6, "0") + "\0 "), 148);
    blocks.push(header);
    if (payload.length) {
      const padded = new Uint8Array(Math.ceil(payload.length / BLOCK) * BLOCK);
      padded.set(payload);
      blocks.push(padded);
    }
  }
  blocks.push(new Uint8Array(BLOCK * 2));
  const total = blocks.reduce((sum, b) => sum + b.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const block of blocks) {
    out.set(block, at);
    at += block.length;
  }
  return out;
}
