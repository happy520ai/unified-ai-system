import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  constants as fsConstants,
  closeSync,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  realpathSync,
  type Stats,
} from "node:fs";
import {
  chmod,
  link,
  lstat,
  mkdir,
  open,
  realpath,
  unlink,
} from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { stableStringify } from "@unified-ai-system/policy-engine";

export const REGISTRY_AUTHORITY_SWITCH_FILE = "registry-authority-switch.json";
export const REGISTRY_AUTHORITY_SWITCH_VERSION =
  "agent-governance-registry-authority-switch-v1" as const;
export const SQLITE_REGISTRY_AUTHORITY_PROTOCOL = "sqlite-checkpoint-v1" as const;

const MARKER_DOMAIN = "unified-ai/agent-governance-registry-authority-switch/v1";
const MARKER_STAGING_SUFFIX = ".staged";
const MAX_MARKER_BYTES = 16 * 1024;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const SQLITE_AUTHORITY_PATTERN = /^sqlite-v2:[a-f0-9]{64}$/u;
const HMAC_PATTERN = /^[a-f0-9]{64}$/u;

export interface RegistryAuthoritySwitchMarkerContent {
  version: typeof REGISTRY_AUTHORITY_SWITCH_VERSION;
  source: {
    kind: "signed-json-v1";
    agentsSha256: string;
  };
  target: {
    kind: typeof SQLITE_REGISTRY_AUTHORITY_PROTOCOL;
    authorityBinding: string;
    recordCount: number;
    sqliteSchemaVersion: number;
  };
  completedAt: string;
}

export interface RegistryAuthoritySwitchMarker extends RegistryAuthoritySwitchMarkerContent {
  hmacSha256: string;
}

export class RegistryAuthoritySwitchError extends Error {
  readonly code: string;

  constructor(code: string, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "RegistryAuthoritySwitchError";
    this.code = code;
  }
}

type FileReadProbe = (stage: "after-lstat-before-open", path: string) => void | Promise<void>;

export async function computeSignedJsonRegistryDigest(
  dataDir: string,
  fileReadProbe?: FileReadProbe,
): Promise<string | null> {
  const path = join(resolveDataDir(dataDir), "agents.json");
  const bytes = await readOptionalRegularFile(path, 64 * 1024 * 1024, fileReadProbe);
  return bytes ? `sha256:${createHash("sha256").update(bytes).digest("hex")}` : null;
}

export function computeSignedJsonRegistryDigestSync(dataDir: string): string | null {
  const path = join(resolveDataDir(dataDir), "agents.json");
  const bytes = readOptionalRegularFileSync(path, 64 * 1024 * 1024);
  return bytes ? `sha256:${createHash("sha256").update(bytes).digest("hex")}` : null;
}

export async function readRegistryAuthoritySwitchMarker(options: {
  dataDir: string;
  secret: string;
  /** Fault-injection seam for path-swap tests. */
  fileReadProbe?: FileReadProbe;
}): Promise<RegistryAuthoritySwitchMarker | null> {
  assertSecret(options.secret);
  const path = markerPath(options.dataDir);
  const bytes = await readOptionalRegularFile(path, MAX_MARKER_BYTES, options.fileReadProbe);
  if (!bytes) return null;
  return parseAndVerifyMarker(bytes, options.secret);
}

export function readRegistryAuthoritySwitchMarkerSync(options: {
  dataDir: string;
  secret: string;
}): RegistryAuthoritySwitchMarker | null {
  assertSecret(options.secret);
  const path = markerPath(options.dataDir);
  const bytes = readOptionalRegularFileSync(path, MAX_MARKER_BYTES);
  return bytes ? parseAndVerifyMarker(bytes, options.secret) : null;
}

/**
 * Publishes the one-way Registry authority switch without overwriting an
 * existing decision. Repeating the same switch returns the first marker and
 * preserves its original completedAt timestamp.
 */
export async function writeRegistryAuthoritySwitchMarker(options: {
  dataDir: string;
  secret: string;
  sourceAgentsSha256: string;
  targetAuthorityBinding: string;
  recordCount: number;
  sqliteSchemaVersion: number;
  completedAt?: string;
}): Promise<RegistryAuthoritySwitchMarker> {
  assertSecret(options.secret);
  const dataDir = resolveDataDir(options.dataDir);
  await ensurePrivateDirectory(dataDir);
  const content = validateContent({
    version: REGISTRY_AUTHORITY_SWITCH_VERSION,
    source: { kind: "signed-json-v1", agentsSha256: options.sourceAgentsSha256 },
    target: {
      kind: SQLITE_REGISTRY_AUTHORITY_PROTOCOL,
      authorityBinding: options.targetAuthorityBinding,
      recordCount: options.recordCount,
      sqliteSchemaVersion: options.sqliteSchemaVersion,
    },
    completedAt: options.completedAt ?? new Date().toISOString(),
  });
  const candidate = signMarker(content, options.secret);
  const path = markerPath(dataDir);
  const stagingPath = `${path}${MARKER_STAGING_SUFFIX}`;

  const recovered = await recoverExclusivePublication({
    path,
    stagingPath,
    candidate,
    secret: options.secret,
  });
  if (recovered) return recovered;

  const handle = await open(stagingPath, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(candidate, null, 2)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try { await chmod(stagingPath, 0o600); } catch { /* Windows ACLs are enforced at the data-root boundary. */ }

  try {
    await link(stagingPath, path);
    await unlink(stagingPath);
    await syncDirectory(dataDir);
    return candidate;
  } catch (error) {
    if (isAlreadyExists(error)) {
      const existing = await readRegistryAuthoritySwitchMarker({ dataDir, secret: options.secret });
      if (existing && sameAuthority(existing, candidate)) {
        await removeMatchingStagingFile(stagingPath, candidate, options.secret);
        return existing;
      }
      throw authorityError(
        "AGENT_REGISTRY_AUTHORITY_SWITCH_CONFLICT",
        "A different Registry authority switch already exists.",
        error,
      );
    }
    try { await unlink(stagingPath); } catch { /* Preserve the publication error. */ }
    throw authorityError(
      "AGENT_REGISTRY_AUTHORITY_SWITCH_WRITE_FAILED",
      "The Registry authority switch could not be published atomically.",
      error,
    );
  }
}

/**
 * Runtime mode gate used by application wiring.
 *
 * - JSON mode is permanently retired once a valid switch exists.
 * - SQLite mode must prove the exact v2 binding/checkpoint whenever the legacy
 *   agents.json remains anchored in the governance data root.
 */
export async function assertRegistryAuthorityMode(options: {
  dataDir: string;
  secret: string;
  mode: "json" | "sqlite";
  target?: {
    authorityProtocol: string;
    authorityBinding: string;
    recordCount: number;
    sqliteSchemaVersion: number;
  };
}): Promise<RegistryAuthoritySwitchMarker | null> {
  const sourceDigest = await computeSignedJsonRegistryDigest(options.dataDir);
  const marker = await readRegistryAuthoritySwitchMarker(options);
  return assertModeDecision({ ...options, sourceDigest, marker });
}

function assertModeDecision(options: {
  mode: "json" | "sqlite";
  sourceDigest: string | null;
  marker: RegistryAuthoritySwitchMarker | null;
  target?: {
    authorityProtocol: string;
    authorityBinding: string;
    recordCount: number;
    sqliteSchemaVersion: number;
  };
}): RegistryAuthoritySwitchMarker | null {
  const { sourceDigest, marker } = options;
  if (options.mode === "json") {
    if (marker) {
      throw authorityError(
        "AGENT_REGISTRY_JSON_AUTHORITY_RETIRED",
        "The signed JSON Agent Registry has been retired by an authority switch.",
      );
    }
    return null;
  }
  if (options.mode !== "sqlite") {
    throw authorityError(
      "AGENT_REGISTRY_AUTHORITY_MODE_INVALID",
      "The Agent Registry authority mode is invalid.",
    );
  }
  if (!sourceDigest && !marker) return null;
  if (!marker || !sourceDigest || !options.target) {
    throw authorityError(
      "AGENT_REGISTRY_AUTHORITY_SWITCH_REQUIRED",
      "SQLite Registry authority requires a verified switch while agents.json exists.",
    );
  }
  if (marker.source.agentsSha256 !== sourceDigest
    || marker.target.kind !== options.target.authorityProtocol
    || marker.target.authorityBinding !== options.target.authorityBinding
    || marker.target.recordCount !== options.target.recordCount
    || marker.target.sqliteSchemaVersion !== options.target.sqliteSchemaVersion) {
    throw authorityError(
      "AGENT_REGISTRY_AUTHORITY_SWITCH_MISMATCH",
      "The SQLite Registry does not match the authenticated authority switch.",
    );
  }
  return marker;
}

/** Synchronous equivalent used by createGatewayApplication's sync constructor. */
export function assertRegistryAuthorityModeSync(options: {
  dataDir: string;
  secret: string;
  mode: "json" | "sqlite";
  target?: {
    authorityProtocol: string;
    authorityBinding: string;
    recordCount: number;
    sqliteSchemaVersion: number;
  };
}): RegistryAuthoritySwitchMarker | null {
  const sourceDigest = computeSignedJsonRegistryDigestSync(options.dataDir);
  const marker = readRegistryAuthoritySwitchMarkerSync(options);
  return assertModeDecision({ ...options, sourceDigest, marker });
}

function parseAndVerifyMarker(bytes: Buffer, secret: string): RegistryAuthoritySwitchMarker {
  let parsed: unknown;
  try { parsed = JSON.parse(bytes.toString("utf8")); }
  catch (error) {
    throw authorityError(
      "AGENT_REGISTRY_AUTHORITY_SWITCH_INVALID",
      "The Registry authority switch is malformed or unauthenticated.",
      error,
    );
  }
  if (!isPlainRecord(parsed) || !hasExactKeys(parsed, [
    "version", "source", "target", "completedAt", "hmacSha256",
  ])) {
    throw authorityError(
      "AGENT_REGISTRY_AUTHORITY_SWITCH_INVALID",
      "The Registry authority switch is malformed or unauthenticated.",
    );
  }
  const { hmacSha256, ...rawContent } = parsed;
  const content = validateContent(rawContent);
  const expected = markerHmac(content, secret);
  if (typeof hmacSha256 !== "string" || !HMAC_PATTERN.test(hmacSha256)
    || !safeEqual(hmacSha256, expected)) {
    throw authorityError(
      "AGENT_REGISTRY_AUTHORITY_SWITCH_INVALID",
      "The Registry authority switch is malformed or unauthenticated.",
    );
  }
  return Object.freeze({
    ...content,
    source: Object.freeze({ ...content.source }),
    target: Object.freeze({ ...content.target }),
    hmacSha256,
  });
}

function validateContent(value: unknown): RegistryAuthoritySwitchMarkerContent {
  if (!isPlainRecord(value) || !hasExactKeys(value, ["version", "source", "target", "completedAt"])
    || value.version !== REGISTRY_AUTHORITY_SWITCH_VERSION
    || !isPlainRecord(value.source) || !hasExactKeys(value.source, ["kind", "agentsSha256"])
    || value.source.kind !== "signed-json-v1"
    || typeof value.source.agentsSha256 !== "string" || !SHA256_PATTERN.test(value.source.agentsSha256)
    || !isPlainRecord(value.target)
    || !hasExactKeys(value.target, ["kind", "authorityBinding", "recordCount", "sqliteSchemaVersion"])
    || value.target.kind !== SQLITE_REGISTRY_AUTHORITY_PROTOCOL
    || typeof value.target.authorityBinding !== "string"
    || !SQLITE_AUTHORITY_PATTERN.test(value.target.authorityBinding)
    || !Number.isSafeInteger(value.target.recordCount) || Number(value.target.recordCount) < 0
    || !Number.isSafeInteger(value.target.sqliteSchemaVersion) || Number(value.target.sqliteSchemaVersion) < 1
    || typeof value.completedAt !== "string" || value.completedAt.length > 64
    || !Number.isFinite(Date.parse(value.completedAt))) {
    throw authorityError(
      "AGENT_REGISTRY_AUTHORITY_SWITCH_INVALID",
      "The Registry authority switch is malformed or unauthenticated.",
    );
  }
  return {
    version: REGISTRY_AUTHORITY_SWITCH_VERSION,
    source: {
      kind: "signed-json-v1",
      agentsSha256: value.source.agentsSha256,
    },
    target: {
      kind: SQLITE_REGISTRY_AUTHORITY_PROTOCOL,
      authorityBinding: value.target.authorityBinding,
      recordCount: Number(value.target.recordCount),
      sqliteSchemaVersion: Number(value.target.sqliteSchemaVersion),
    },
    completedAt: value.completedAt,
  };
}

function signMarker(
  content: RegistryAuthoritySwitchMarkerContent,
  secret: string,
): RegistryAuthoritySwitchMarker {
  return { ...content, hmacSha256: markerHmac(content, secret) };
}

function markerHmac(content: RegistryAuthoritySwitchMarkerContent, secret: string): string {
  return createHmac("sha256", secret)
    .update(`${MARKER_DOMAIN}\n${stableStringify(content)}`, "utf8")
    .digest("hex");
}

async function recoverExclusivePublication(options: {
  path: string;
  stagingPath: string;
  candidate: RegistryAuthoritySwitchMarker;
  secret: string;
}): Promise<RegistryAuthoritySwitchMarker | null> {
  const [publishedStats, stagingStats] = await Promise.all([
    optionalLstat(options.path),
    optionalLstat(options.stagingPath),
  ]);
  if (!publishedStats && !stagingStats) return null;

  if (publishedStats && stagingStats
    && publishedStats.isFile() && stagingStats.isFile()
    && !publishedStats.isSymbolicLink() && !stagingStats.isSymbolicLink()
    && publishedStats.dev === stagingStats.dev && publishedStats.ino === stagingStats.ino) {
    const staged = parseAndVerifyMarker(
      await readBoundedFile(options.stagingPath, MAX_MARKER_BYTES, true),
      options.secret,
    );
    if (!sameAuthority(staged, options.candidate)) {
      throw authorityError(
        "AGENT_REGISTRY_AUTHORITY_SWITCH_CONFLICT",
        "A different Registry authority switch already exists.",
      );
    }
    await unlink(options.stagingPath);
    await syncDirectory(dirname(options.path));
    return readRegistryAuthoritySwitchMarker({
      dataDir: dirname(options.path),
      secret: options.secret,
    });
  }

  if (publishedStats) {
    const existing = await readRegistryAuthoritySwitchMarker({
      dataDir: dirname(options.path),
      secret: options.secret,
    });
    if (!existing || !sameAuthority(existing, options.candidate)) {
      throw authorityError(
        "AGENT_REGISTRY_AUTHORITY_SWITCH_CONFLICT",
        "A different Registry authority switch already exists.",
      );
    }
    if (stagingStats) await removeMatchingStagingFile(options.stagingPath, options.candidate, options.secret);
    return existing;
  }

  if (!stagingStats?.isFile() || stagingStats.isSymbolicLink() || stagingStats.nlink !== 1) {
    throw authorityError(
      "AGENT_REGISTRY_AUTHORITY_SWITCH_CONFLICT",
      "The Registry authority switch staging path is linked or unsafe.",
    );
  }
  const staged = parseAndVerifyMarker(
    await readBoundedFile(options.stagingPath, MAX_MARKER_BYTES, false, stagingStats),
    options.secret,
  );
  if (!sameAuthority(staged, options.candidate)) {
    throw authorityError(
      "AGENT_REGISTRY_AUTHORITY_SWITCH_CONFLICT",
      "A different Registry authority switch staging file already exists.",
    );
  }
  try {
    await link(options.stagingPath, options.path);
    await unlink(options.stagingPath);
    await syncDirectory(dirname(options.path));
  } catch (error) {
    throw authorityError(
      "AGENT_REGISTRY_AUTHORITY_SWITCH_WRITE_FAILED",
      "The Registry authority switch could not be recovered atomically.",
      error,
    );
  }
  return readRegistryAuthoritySwitchMarker({
    dataDir: dirname(options.path),
    secret: options.secret,
  });
}

async function removeMatchingStagingFile(
  path: string,
  candidate: RegistryAuthoritySwitchMarker,
  secret: string,
): Promise<void> {
  const stats = await lstat(path);
  if (!stats.isFile() || stats.isSymbolicLink() || stats.nlink !== 1) {
    throw authorityError(
      "AGENT_REGISTRY_AUTHORITY_SWITCH_CONFLICT",
      "The Registry authority switch staging path is linked or unsafe.",
    );
  }
  const staged = parseAndVerifyMarker(
    await readBoundedFile(path, MAX_MARKER_BYTES, false, stats),
    secret,
  );
  if (!sameAuthority(staged, candidate)) {
    throw authorityError(
      "AGENT_REGISTRY_AUTHORITY_SWITCH_CONFLICT",
      "A different Registry authority switch staging file already exists.",
    );
  }
  await unlink(path);
  await syncDirectory(dirname(path));
}

function sameAuthority(
  left: RegistryAuthoritySwitchMarker,
  right: RegistryAuthoritySwitchMarker,
): boolean {
  return left.version === right.version
    && left.source.kind === right.source.kind
    && left.source.agentsSha256 === right.source.agentsSha256
    && left.target.kind === right.target.kind
    && left.target.authorityBinding === right.target.authorityBinding
    && left.target.recordCount === right.target.recordCount
    && left.target.sqliteSchemaVersion === right.target.sqliteSchemaVersion;
}

async function readOptionalRegularFile(
  path: string,
  maxBytes: number,
  fileReadProbe?: FileReadProbe,
): Promise<Buffer | null> {
  const stats = await optionalLstat(path);
  if (!stats) return null;
  if (!stats.isFile() || stats.isSymbolicLink() || stats.nlink !== 1 || stats.size > maxBytes) {
    throw authorityError(
      "AGENT_REGISTRY_AUTHORITY_FILE_UNSAFE",
      "A Registry authority file is linked, oversized, or not a regular file.",
    );
  }
  await fileReadProbe?.("after-lstat-before-open", path);
  return readBoundedFile(path, maxBytes, false, stats);
}

async function readBoundedFile(
  path: string,
  maxBytes: number,
  allowHardLink: boolean,
  expectedStats: Stats | undefined = undefined,
): Promise<Buffer> {
  const before = expectedStats ?? await lstat(path);
  if (!before.isFile() || before.isSymbolicLink()
    || (!allowHardLink && before.nlink !== 1) || before.size > maxBytes) {
    throw authorityError(
      "AGENT_REGISTRY_AUTHORITY_FILE_UNSAFE",
      "A Registry authority file is linked, oversized, or not a regular file.",
    );
  }
  let handle;
  try {
    handle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  } catch (error) {
    throw authorityError(
      "AGENT_REGISTRY_AUTHORITY_FILE_UNSAFE",
      "A Registry authority file could not be opened without following links.",
      error,
    );
  }
  try {
    const stats = await handle.stat();
    if (!stats.isFile() || stats.isSymbolicLink()
      || (!allowHardLink && stats.nlink !== 1) || stats.size > maxBytes
      || !sameFileIdentity(before, stats)) {
      throw authorityError(
        "AGENT_REGISTRY_AUTHORITY_FILE_UNSAFE",
        "A Registry authority file is linked, oversized, or not a regular file.",
      );
    }
    await assertResolvedDirectChild(path);
    const bytes = Buffer.alloc(Number(stats.size));
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
    const [after, afterPath] = await Promise.all([handle.stat(), lstat(path)]);
    if (bytesRead !== bytes.length || after.size !== stats.size
      || !sameFileIdentity(stats, after) || !sameFileIdentity(stats, afterPath)
      || (!allowHardLink && afterPath.nlink !== 1)) {
      throw authorityError(
        "AGENT_REGISTRY_AUTHORITY_FILE_CHANGED",
        "A Registry authority file changed while it was being verified.",
      );
    }
    return bytes;
  } finally {
    await handle.close();
  }
}

function readOptionalRegularFileSync(path: string, maxBytes: number): Buffer | null {
  let before;
  try { before = lstatSync(path); }
  catch (error) { if (isMissing(error)) return null; throw error; }
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > maxBytes) {
    throw authorityError(
      "AGENT_REGISTRY_AUTHORITY_FILE_UNSAFE",
      "A Registry authority file is linked, oversized, or not a regular file.",
    );
  }
  let descriptor: number | null = null;
  try {
    descriptor = openSync(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const stats = fstatSync(descriptor);
    if (!stats.isFile() || stats.isSymbolicLink() || stats.nlink !== 1
      || stats.size > maxBytes || !sameFileIdentity(before, stats)) {
      throw authorityError(
        "AGENT_REGISTRY_AUTHORITY_FILE_UNSAFE",
        "A Registry authority file is linked, oversized, or not a regular file.",
      );
    }
    assertResolvedDirectChildSync(path);
    const bytes = Buffer.alloc(Number(stats.size));
    const bytesRead = readSync(descriptor, bytes, 0, bytes.length, 0);
    const after = fstatSync(descriptor);
    const afterPath = lstatSync(path);
    if (bytesRead !== bytes.length || after.size !== stats.size
      || !sameFileIdentity(stats, after) || !sameFileIdentity(stats, afterPath)
      || afterPath.nlink !== 1) {
      throw authorityError(
        "AGENT_REGISTRY_AUTHORITY_FILE_CHANGED",
        "A Registry authority file changed while it was being verified.",
      );
    }
    return bytes;
  } catch (error) {
    if (error instanceof RegistryAuthoritySwitchError) throw error;
    throw authorityError(
      "AGENT_REGISTRY_AUTHORITY_FILE_UNSAFE",
      "A Registry authority file could not be opened without following links.",
      error,
    );
  } finally {
    if (descriptor !== null) closeSync(descriptor);
  }
}

async function assertResolvedDirectChild(path: string): Promise<void> {
  const [resolvedFile, resolvedParent] = await Promise.all([
    realpath(path),
    realpath(dirname(path)),
  ]);
  if (!samePath(dirname(resolvedFile), resolvedParent)
    || !samePath(basename(resolvedFile), basename(path))) {
    throw authorityError(
      "AGENT_REGISTRY_AUTHORITY_FILE_UNSAFE",
      "A Registry authority file escaped its expected directory.",
    );
  }
}

function assertResolvedDirectChildSync(path: string): void {
  const resolvedFile = realpathSync(path);
  const resolvedParent = realpathSync(dirname(path));
  if (!samePath(dirname(resolvedFile), resolvedParent)
    || !samePath(basename(resolvedFile), basename(path))) {
    throw authorityError(
      "AGENT_REGISTRY_AUTHORITY_FILE_UNSAFE",
      "A Registry authority file escaped its expected directory.",
    );
  }
}

function sameFileIdentity(left: { dev: number | bigint; ino: number | bigint }, right: { dev: number | bigint; ino: number | bigint }): boolean {
  return String(left.dev) === String(right.dev) && String(left.ino) === String(right.ino);
}

function samePath(left: string, right: string): boolean {
  return process.platform === "win32"
    ? left.toLocaleLowerCase("en-US") === right.toLocaleLowerCase("en-US")
    : left === right;
}

async function ensurePrivateDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true, mode: 0o700 });
  const stats = await lstat(path);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw authorityError(
      "AGENT_REGISTRY_AUTHORITY_DIRECTORY_UNSAFE",
      "The Registry authority directory is not a real directory.",
    );
  }
  try { await chmod(path, 0o700); } catch { /* Windows ACLs are enforced by governanceSecret. */ }
}

async function optionalLstat(path: string) {
  try { return await lstat(path); }
  catch (error) { if (isMissing(error)) return null; throw error; }
}

async function syncDirectory(path: string): Promise<void> {
  try {
    const handle = await open(path, "r");
    try { await handle.sync(); } finally { await handle.close(); }
  } catch (error) {
    if (process.platform !== "win32") throw error;
  }
}

function markerPath(dataDir: string): string {
  return join(resolveDataDir(dataDir), REGISTRY_AUTHORITY_SWITCH_FILE);
}

function resolveDataDir(value: unknown): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.includes("\0")) {
    throw authorityError(
      "AGENT_REGISTRY_AUTHORITY_DIRECTORY_INVALID",
      "The Registry authority directory is invalid.",
    );
  }
  const resolved = resolve(normalized);
  if (basename(resolved) === "." || resolved === dirname(resolved)) {
    throw authorityError(
      "AGENT_REGISTRY_AUTHORITY_DIRECTORY_INVALID",
      "The Registry authority directory is invalid.",
    );
  }
  return resolved;
}

function assertSecret(secret: unknown): asserts secret is string {
  if (typeof secret !== "string" || secret.length < 32) {
    throw authorityError(
      "AGENT_REGISTRY_AUTHORITY_SECRET_INVALID",
      "The Registry authority HMAC secret is invalid.",
    );
  }
}

function hasExactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length
    && expected.slice().sort().every((key, index) => keys[index] === key);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Object.values(Object.getOwnPropertyDescriptors(value)).every((descriptor) => (
    descriptor.enumerable === true && descriptor.get === undefined && descriptor.set === undefined
  ));
}

function safeEqual(left: string, right: string): boolean {
  return left.length === right.length
    && timingSafeEqual(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function authorityError(code: string, message: string, cause?: unknown): RegistryAuthoritySwitchError {
  return new RegistryAuthoritySwitchError(code, message, cause);
}

function isMissing(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "ENOENT");
}

function isAlreadyExists(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "EEXIST");
}
