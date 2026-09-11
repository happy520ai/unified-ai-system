import { constants } from "node:fs";
import type { BigIntStats } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { posix, win32 } from "node:path";
import type { WorkforceExternalRunnerProfile } from "@unified-ai-system/shared-contracts";
import type { CodexRpcObject } from "./codexAppServerProtocol.ts";
import { readWorkforceExternalRunnerProfile, externalRunnerHash, externalRunnerError } from "./workforceExternalRunnerProfile.ts";
import { containsSensitivePublicationText } from "../security/secretSafety.js";

export const EXTERNAL_RUNNER_PERMISSION_BOUNDARY = Object.freeze({ experimentalApiRequired: true, runtimeReadConfinementProofRequired: true,
  mcpExclusions: "profile-listed-servers-only" as const });
const FEATURES = ["shell_tool", "apps", "plugins", "hooks", "multi_agent", "view_image", "image_generation", "goals", "sleep_tool", "tool_suggest", "shell_snapshot", "shell_snapshot_v2"];
export type ExternalRunnerFileEdit = Readonly<{ path: string; absolutePath: string; change: "added" | "modified" | "deleted";
  diff: string; diffSha256: string; diffBytes: number }>;
export type ExternalRunnerFileProposal = Readonly<{ itemId: string; proposalHash: string; edits: readonly ExternalRunnerFileEdit[] }>;
type Identity = Readonly<{ dev: string; ino: string }>;
export type InspectedExternalRunnerFileProposal = Omit<ExternalRunnerFileProposal, "edits"> & Readonly<{ root: string; rootIdentity: Identity;
  edits: readonly (ExternalRunnerFileEdit & Readonly<{ beforeSha256: string | null; beforeBytes: number; identity: Identity | null }>)[] }>;
function reject(code = "PROPOSAL_INVALID"): never {
  throw externalRunnerError(`WORKFORCE_EXTERNAL_RUNNER_${code}`, "The native runner permissions or file proposal cannot be safely accepted.");
}
function record(value: unknown, keys: readonly string[], optional: readonly string[] = []): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) reject();
  const own = Reflect.ownKeys(value);
  if (own.some(key => typeof key !== "string" || !keys.includes(key) && !optional.includes(key)) || keys.some(key => !Object.hasOwn(value, key))) reject();
  return Object.fromEntries(own.map(key => {
    const field = Object.getOwnPropertyDescriptor(value, key);
    if (!field?.enumerable || !("value" in field)) reject();
    return [key, field.value];
  }));
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") { for (const item of Object.values(value)) freeze(item); Object.freeze(value); }
  return value;
}
function pathTools(profile: WorkforceExternalRunnerProfile) {
  const windows = profile.binary.platform === "win32", api = windows ? win32 : posix;
  const key = (path: string) => windows ? api.normalize(path).toLowerCase() : api.normalize(path);
  return { windows, api, key };
}
function ownedRoot(profile: WorkforceExternalRunnerProfile, value: unknown): string {
  const { windows, api } = pathTools(profile);
  if (typeof value !== "string" || !value || value.length > 4096 || /[\u0000-\u001f\u007f]/u.test(value) || !api.isAbsolute(value)
    || windows && !/^[A-Za-z]:[\\/]/u.test(value) || !windows && value.startsWith("//")
    || value.slice(windows ? 3 : 1).split(windows ? /[\\/]/u : /\//u).some(part => !part || part === "." || part === "..")) reject("OWNED_ROOT_INVALID");
  return api.normalize(value);
}

/** Constructs the 0.153.4 experimental named policy; this is not runtime confinement evidence.
 * Only explicitly listed MCP entries are disabled. No empty-map clearing or legacy fallback is attempted. */
export function createExternalRunnerParameters(input: WorkforceExternalRunnerProfile, ownedAbsolutePath: string): {
  readonly args: readonly string[]; readonly threadParams: CodexRpcObject; readonly turnParams: CodexRpcObject;
} {
  const profile = readWorkforceExternalRunnerProfile(input), root = ownedRoot(profile, ownedAbsolutePath);
  const name = "uai_external_" + randomUUID().replaceAll("-", "");
  // A literal dotted MCP id is not interchangeable with a dotted override path.
  if (profile.disabledMcpServers.some(id => !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u.test(id))) reject("MCP_OVERRIDE_ID_UNSUPPORTED");
  const overrides = [...FEATURES.map(feature => `features.${feature}=false`), 'web_search="disabled"', "notify=[]",
    ...profile.disabledMcpServers.map(id => `mcp_servers.${id}.enabled=false`)];
  const args = ["app-server", "--listen", "stdio://", ...overrides.flatMap(value => ["-c", value])];
  const workspace = Object.fromEntries([[".", "deny"], ...profile.artifact.readPaths.map(path => [path, "read"])]);
  const permissions = { filesystem: { ":root": "deny", ":minimal": "read", ":workspace_roots": workspace }, network: { enabled: false } };
  const common = { permissions: name, runtimeWorkspaceRoots: [root], cwd: root, approvalPolicy: "untrusted", approvalsReviewer: "user" };
  return freeze({ args, threadParams: { ...common, ephemeral: false, serviceName: "unified-ai-system", config: { permissions: { [name]: permissions } } }, turnParams: { ...common } });
}

/** Validates the entire native fileChange item, without parsing or applying its patch text. */
export function validateExternalRunnerFileChange(input: WorkforceExternalRunnerProfile, ownedAbsolutePath: string, value: unknown): ExternalRunnerFileProposal {
  const profile = readWorkforceExternalRunnerProfile(input), root = ownedRoot(profile, ownedAbsolutePath), { windows, api, key } = pathTools(profile);
  externalRunnerHash(value);
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > profile.limits.maxMessageBytes) reject("PROPOSAL_LIMIT");
  const item = record(value, ["id", "type", "status", "changes"]);
  if (typeof item.id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u.test(item.id) || item.type !== "fileChange" || item.status !== "inProgress"
    || !Array.isArray(item.changes) || item.changes.length < 1 || item.changes.length > profile.artifact.artifactLimits.maxChangedFiles) reject();
  const seen = new Set<string>(); let totalBytes = 0;
  const edits = item.changes.map(value => {
    const change = record(value, ["path", "kind", "diff"]), kind = record(change.kind, ["type"], ["move_path"]);
    if (typeof kind.type !== "string" || !["add", "update", "delete"].includes(kind.type)
      || kind.move_path !== undefined && kind.move_path !== null || kind.type !== "update" && Object.hasOwn(kind, "move_path")
      || typeof change.path !== "string" || !change.path || change.path.length > 4096 || /[\u0000-\u001f\u007f]/u.test(change.path)
      || change.path.replaceAll("\\", "/").split("/").some(part => part === "." || part === "..")
      || typeof change.diff !== "string" || change.diff.includes("\0") || containsSensitivePublicationText(change.diff)
      || Buffer.from(change.diff, "utf8").toString("utf8") !== change.diff) reject();
    if (windows && (win32.parse(change.path).root && !/^[A-Za-z]:[\\/]/u.test(change.path))
      || !windows && (change.path.includes("\\") || win32.isAbsolute(change.path))) reject();
    const absolutePath = api.resolve(root, change.path), relative = api.relative(root, absolutePath).replaceAll("\\", "/");
    if (!relative || relative === ".." || relative.startsWith("../") || api.isAbsolute(relative)) reject();
    const approved = profile.artifact.writePaths.find(path => key(api.resolve(root, path)) === key(absolutePath));
    if (!approved || seen.has(key(absolutePath))) reject();
    seen.add(key(absolutePath));
    const diffBytes = Buffer.byteLength(change.diff, "utf8"); totalBytes += diffBytes;
    if (totalBytes > profile.artifact.artifactLimits.maxDiffBytes) reject("PROPOSAL_LIMIT");
    return Object.freeze({ path: approved, absolutePath: api.resolve(root, approved), change: kind.type === "add" ? "added" as const : kind.type === "delete" ? "deleted" as const : "modified" as const,
      diff: change.diff, diffSha256: createHash("sha256").update(change.diff, "utf8").digest("hex"), diffBytes });
  });
  return freeze({ itemId: item.id, proposalHash: externalRunnerHash({ itemId: item.id, edits }), edits });
}

/** Point-in-time, read-only filesystem checks immediately before the owner decides one approval.
 * The owner still supplies current authority and independent native confinement/artifact evidence. */
export async function inspectExternalRunnerFileChange(input: WorkforceExternalRunnerProfile, ownedAbsolutePath: string, item: unknown,
  signal?: AbortSignal): Promise<InspectedExternalRunnerFileProposal> {
  const profile = readWorkforceExternalRunnerProfile(input), proposal = validateExternalRunnerFileChange(profile, ownedAbsolutePath, item);
  const root = ownedRoot(profile, ownedAbsolutePath), { api, key } = pathTools(profile);
  if (profile.binary.platform !== process.platform) reject("HOST_PLATFORM_MISMATCH");
  const checkSignal = () => { if (signal?.aborted) reject("CANCELLED"); };
  try {
    checkSignal();
    const rootBefore = await lstat(root, { bigint: true });
    if (!rootBefore.isDirectory() || rootBefore.isSymbolicLink() || key(await realpath(root)) !== key(root)) reject("FILE_IDENTITY_INVALID");
    const sameIdentity = (left: { dev: bigint; ino: bigint }, right: { dev: bigint; ino: bigint }) => left.dev === right.dev && left.ino === right.ino;
    const checkParents = async (relative: string) => {
      let current = root;
      const nowRoot = await lstat(root, { bigint: true });
      if (!sameIdentity(rootBefore, nowRoot) || !nowRoot.isDirectory() || nowRoot.isSymbolicLink() || key(await realpath(root)) !== key(root)) reject("FILE_IDENTITY_INVALID");
      for (const part of relative.split("/").slice(0, -1)) {
        checkSignal(); current = api.join(current, part);
        const directory = await lstat(current, { bigint: true });
        if (!directory.isDirectory() || directory.isSymbolicLink() || key(await realpath(current)) !== key(current)) reject("FILE_IDENTITY_INVALID");
      }
    };
    const edits: (ExternalRunnerFileEdit & { beforeSha256: string | null; beforeBytes: number; identity: Identity | null })[] = [];
    for (const edit of proposal.edits) {
      checkSignal(); await checkParents(edit.path);
      let before: BigIntStats | undefined;
      try { before = await lstat(edit.absolutePath, { bigint: true }); }
      catch (error) { if ((error as { code?: string }).code !== "ENOENT" || edit.change !== "added") throw error; }
      if (!before) {
        await checkParents(edit.path);
        try { await lstat(edit.absolutePath); reject("FILE_IDENTITY_INVALID"); }
        catch (error) { if ((error as { code?: string }).code !== "ENOENT") throw error; }
        edits.push({ ...edit, beforeSha256: null, beforeBytes: 0, identity: null }); continue;
      }
      if (edit.change === "added" || !before.isFile() || before.isSymbolicLink() || before.nlink !== 1n || before.size > BigInt(profile.artifact.artifactLimits.maxFileBytes)
        || key(await realpath(edit.absolutePath)) !== key(edit.absolutePath)) reject("FILE_IDENTITY_INVALID");
      const handle = await open(edit.absolutePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      try {
        const opened = await handle.stat({ bigint: true });
        if (!sameIdentity(before, opened) || !opened.isFile() || opened.nlink !== 1n || opened.size !== before.size) reject("FILE_IDENTITY_INVALID");
        await checkParents(edit.path);
        const pathBeforeRead = await lstat(edit.absolutePath, { bigint: true });
        if (!sameIdentity(opened, pathBeforeRead) || pathBeforeRead.isSymbolicLink() || key(await realpath(edit.absolutePath)) !== key(edit.absolutePath)) reject("FILE_IDENTITY_INVALID");
        const bytes = Buffer.alloc(profile.artifact.artifactLimits.maxFileBytes + 1); let length = 0;
        while (length < bytes.length) { checkSignal(); const read = await handle.read(bytes, length, bytes.length - length, length); if (!read.bytesRead) break; length += read.bytesRead; }
        const after = await handle.stat({ bigint: true }); await checkParents(edit.path);
        const current = await lstat(edit.absolutePath, { bigint: true });
        if (length > profile.artifact.artifactLimits.maxFileBytes || BigInt(length) !== after.size || !sameIdentity(opened, after) || !sameIdentity(after, current)
          || after.nlink !== 1n || current.nlink !== 1n || current.isSymbolicLink() || after.size !== before.size || after.mtimeNs !== before.mtimeNs || after.ctimeNs !== before.ctimeNs
          || key(await realpath(edit.absolutePath)) !== key(edit.absolutePath)) reject("FILE_IDENTITY_INVALID");
        edits.push({ ...edit, beforeSha256: createHash("sha256").update(bytes.subarray(0, length)).digest("hex"), beforeBytes: length,
          identity: { dev: after.dev.toString(), ino: after.ino.toString() } });
      } finally { await handle.close(); }
    }
    checkSignal();
    return freeze({ ...proposal, root, rootIdentity: { dev: rootBefore.dev.toString(), ino: rootBefore.ino.toString() }, edits });
  } catch (error) {
    if (signal?.aborted) reject("CANCELLED");
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code.startsWith("WORKFORCE_EXTERNAL_RUNNER_")) throw error;
    return reject("FILE_IDENTITY_INVALID");
  }
}
