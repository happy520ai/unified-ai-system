import { createHash } from "node:crypto";
import { closeSync, fstatSync, lstatSync, openSync, readSync, readdirSync, realpathSync } from "node:fs";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const RUNTIME_IDENTITY_PATH = "build/runtime-identity.json";
export const RUNTIME_SOURCE_SCOPE = "gateway-runtime-source-v1";
const MANIFEST_LIMIT = 16 * 1024;
const FILE_LIMIT = 8 * 1024 * 1024;
const SOURCE_LIMIT = 128 * 1024 * 1024;
const FILE_COUNT_LIMIT = 4096;
const SOURCE_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".ts", ".mts", ".cts", ".tsx", ".jsx",
  ".py", ".go", ".rs", ".c", ".h", ".cpp", ".hpp", ".cs", ".csproj", ".proto", ".sh", ".ps1"]);
const PRUNED_DIRECTORIES = new Set(["node_modules", ".git", ".data", "evidence", "logs",
  "build", "dist", "coverage", ".cache", ".tmp", "tmp", "temp", "tests", "__tests__", "fixtures", "__fixtures__", "examples"]);
const STATIC_SOURCES = ["package.json", "pnpm-workspace.yaml",
  "apps/ai-gateway-service/package.json", "apps/agent-console/package.json",
  "tools/terminal-demo.mjs", "tools/mcp-smoke.mjs", "tools/build-runtime-identity.mjs"];
const SOURCE_ROOTS = ["apps/ai-gateway-service/src", "apps/agent-console/src", "packages"];
const MANIFEST_KEYS = ["schemaVersion", "sourceScope", "packageVersion", "declaredRevision",
  "sourceDigest", "lockfileDigest", "sourceFileCount"];
const REVISION = /^[a-f0-9]{40}$/u;
const DIGEST = /^[a-f0-9]{64}$/u;
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const DEFAULT_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

export interface RuntimeIdentityManifest {
  schemaVersion: 1;
  sourceScope: typeof RUNTIME_SOURCE_SCOPE;
  packageVersion: string;
  declaredRevision: string | null;
  sourceDigest: string;
  lockfileDigest: string;
  sourceFileCount: number;
}
export type RuntimeBuildIdentity = Readonly<RuntimeIdentityManifest & {
  status: "verified";
  verification: "source-and-lockfile-at-module-load";
  attested: false;
}> | Readonly<{
  status: "unknown";
  reason: "manifest-missing" | "manifest-invalid" | "manifest-unsafe" | "source-unavailable" | "source-mismatch";
  sourceScope: typeof RUNTIME_SOURCE_SCOPE;
  attested: false;
}>;

/** Fixed input scope; neither the manifest nor an HTTP request supplies paths. */
export function createRuntimeIdentityManifest(
  rootPath: string,
  declaredRevision: string | null = null,
  options: { allowHardlinkedInputs?: boolean } = {},
): RuntimeIdentityManifest {
  if (declaredRevision !== null && !REVISION.test(declaredRevision)) throw inputError();
  const root = realpathSync(rootPath);
  const files = [...STATIC_SOURCES];
  for (const sourceRoot of SOURCE_ROOTS) collectSources(root, sourceRoot, files);
  const paths = [...new Set(files)].sort();
  if (paths.length > FILE_COUNT_LIMIT) throw inputError();
  let totalBytes = 0;
  let packageVersion: unknown;
  const entries = paths.map((path) => {
    const bytes = readRegularFile(root, path, FILE_LIMIT, options.allowHardlinkedInputs === true);
    totalBytes += bytes.length;
    if (totalBytes > SOURCE_LIMIT) throw inputError();
    if (path === "package.json") {
      const value = JSON.parse(bytes.toString("utf8"));
      if (value?.name !== "unified-ai-system") throw inputError();
      packageVersion = value.version;
    }
    return [path, digest(bytes), bytes.length];
  });
  if (typeof packageVersion !== "string" || !VERSION.test(packageVersion)) throw inputError();
  return {
    schemaVersion: 1, sourceScope: RUNTIME_SOURCE_SCOPE, packageVersion, declaredRevision,
    sourceDigest: digest(JSON.stringify(entries)),
    lockfileDigest: digest(readRegularFile(root, "pnpm-lock.yaml", FILE_LIMIT, options.allowHardlinkedInputs === true)),
    sourceFileCount: paths.length,
  };
}

export function inspectRuntimeBuildIdentity(
  rootPath: string,
  options: { allowHardlinkedInputs?: boolean } = {},
): RuntimeBuildIdentity {
  const unknown = (reason: Extract<RuntimeBuildIdentity, { status: "unknown" }>["reason"]): RuntimeBuildIdentity =>
    Object.freeze({ status: "unknown", reason, sourceScope: RUNTIME_SOURCE_SCOPE, attested: false });
  let manifest: RuntimeIdentityManifest;
  let root: string;
  try {
    root = realpathSync(rootPath);
    assertDirectory(root, "build");
    const raw = readRegularFile(root, RUNTIME_IDENTITY_PATH, MANIFEST_LIMIT, options.allowHardlinkedInputs === true).toString("utf8");
    const value: unknown = JSON.parse(raw);
    if (!validManifest(value) || raw.trim() !== JSON.stringify(value, null, 2)) return unknown("manifest-invalid");
    manifest = value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return unknown("manifest-missing");
    return unknown((error as NodeJS.ErrnoException)?.code === "RUNTIME_IDENTITY_INPUT_UNSAFE" ? "manifest-unsafe" : "manifest-invalid");
  }
  try {
    const measured = createRuntimeIdentityManifest(root, manifest.declaredRevision, options);
    if (measured.packageVersion !== manifest.packageVersion || measured.sourceDigest !== manifest.sourceDigest
      || measured.lockfileDigest !== manifest.lockfileDigest || measured.sourceFileCount !== manifest.sourceFileCount) return unknown("source-mismatch");
    return Object.freeze({ ...manifest, status: "verified", verification: "source-and-lockfile-at-module-load", attested: false });
  } catch { return unknown("source-unavailable"); }
}

/** Capture once while the module is initialized, never from env or live Git. */
export function createRuntimeBuildIdentityReader(
  rootPath: string,
  options: { allowHardlinkedInputs?: boolean } = {},
): () => RuntimeBuildIdentity {
  const snapshot = inspectRuntimeBuildIdentity(rootPath, options);
  return () => snapshot;
}
export const getRuntimeBuildIdentity = createRuntimeBuildIdentityReader(DEFAULT_ROOT);

function validManifest(value: unknown): value is RuntimeIdentityManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === MANIFEST_KEYS.length && MANIFEST_KEYS.every((key) => Object.hasOwn(record, key))
    && record.schemaVersion === 1 && record.sourceScope === RUNTIME_SOURCE_SCOPE
    && typeof record.packageVersion === "string" && VERSION.test(record.packageVersion)
    && (record.declaredRevision === null || typeof record.declaredRevision === "string" && REVISION.test(record.declaredRevision))
    && typeof record.sourceDigest === "string" && DIGEST.test(record.sourceDigest)
    && typeof record.lockfileDigest === "string" && DIGEST.test(record.lockfileDigest)
    && Number.isSafeInteger(record.sourceFileCount) && Number(record.sourceFileCount) > 0 && Number(record.sourceFileCount) <= FILE_COUNT_LIMIT;
}

function collectSources(root: string, directory: string, files: string[]): void {
  assertDirectory(root, directory);
  const entries = readdirSync(resolve(root, directory), { withFileTypes: true });
  if (entries.length > FILE_COUNT_LIMIT * 2) throw inputError();
  for (const entry of entries) {
    const name = entry.name;
    if (name === ".mcp.json" || name === ".env" || name.startsWith(".env.") || PRUNED_DIRECTORIES.has(name)) continue;
    const path = directory + "/" + name;
    if (entry.isSymbolicLink()) throw inputError();
    if (entry.isDirectory()) collectSources(root, path, files);
    else if (entry.isFile() && !/\.(?:test|spec)\.[^.]+$/u.test(name)
      && (SOURCE_EXTENSIONS.has(extname(name)) || /^packages\/[^/]+\/package\.json$/u.test(path))) files.push(path);
    if (files.length > FILE_COUNT_LIMIT) throw inputError();
  }
}

function assertDirectory(root: string, path: string): void {
  const target = inside(root, path);
  const stat = lstatSync(target);
  if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(target) !== target) throw inputError();
}
function inside(root: string, path: string): string {
  const target = resolve(root, path);
  const local = relative(root, target);
  if (!local || isAbsolute(path) || isAbsolute(local) || local === ".." || local.startsWith("../") || local.startsWith("..\\")) throw inputError();
  return target;
}
function readRegularFile(root: string, path: string, limit: number, allowHardlink = false): Buffer {
  const target = inside(root, path);
  const before = lstatSync(target, { bigint: true });
  // nlink === 1 is the default trust posture: a hard link means another
  // writable path shares this inode. Container image exporters legitimately
  // materialize shipped layers as hard links on a read-only root filesystem,
  // where no second writable path exists; that caller passes allowHardlink
  // explicitly. dev/ino/size/mtimeNs/ctimeNs still pin the inode across the
  // read in both postures.
  if (!before.isFile() || before.isSymbolicLink() || before.size < 0n
    || before.size > BigInt(limit) || realpathSync(target) !== target
    || (!allowHardlink && before.nlink !== 1n)) throw inputError();
  const file = openSync(target, "r");
  try {
    const opened = fstatSync(file, { bigint: true });
    if (opened.dev !== before.dev || opened.ino !== before.ino || opened.size !== before.size || realpathSync(target) !== target) throw inputError();
    const bytes = Buffer.alloc(Number(before.size) + 1);
    let count = 0;
    while (count < bytes.length) {
      const read = readSync(file, bytes, count, bytes.length - count, count);
      if (read === 0) break;
      count += read;
    }
    const after = lstatSync(target, { bigint: true });
    if (count !== Number(before.size) || after.dev !== before.dev || after.ino !== before.ino
      || after.size !== before.size || after.mtimeNs !== before.mtimeNs || after.ctimeNs !== before.ctimeNs) throw inputError();
    return bytes.subarray(0, count);
  } finally { closeSync(file); }
}
function digest(value: string | Buffer): string { return createHash("sha256").update(value).digest("hex"); }
function inputError(): Error & { code: string } {
  return Object.assign(new Error("Runtime identity input is outside the supported source boundary."), { code: "RUNTIME_IDENTITY_INPUT_UNSAFE" });
}
