import { constants } from "node:fs";
import { lstat, mkdir, mkdtemp, open, realpath, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { WorkforceCodeDeliveryProfile } from "@unified-ai-system/shared-contracts";
import { stableStringify } from "@unified-ai-system/policy-engine";
import { containsSensitivePublicationText } from "../security/secretSafety.js";
import { codeDeliveryError, readFrozenWorkforceCodeDeliveryProfile } from "./workforceCodeDeliveryProfile.ts";

export interface ApprovedCodeFile {
  readonly path: string;
  readonly sha256: string | null;
  readonly content: string | null;
}
export interface ApprovedCodeFiles {
  readonly root: string;
  readonly profileHash: string;
  readonly filesHash: string;
  readonly files: readonly ApprovedCodeFile[];
}
export interface CodeFileDelta {
  readonly path: string;
  readonly change: "added" | "modified" | "deleted";
  readonly beforeSha256: string | null;
  readonly afterSha256: string | null;
  readonly patch: string;
}
export interface CodeDeliveryArtifact {
  readonly version: 1;
  readonly profileHash: string;
  readonly sourceFilesHash: string;
  readonly diffSha256: string;
  readonly diffBytes: number;
  readonly filesChanged: readonly CodeFileDelta[];
}

/** Reads only the exact reviewed files, with bounded bytes and no link following. */
export async function captureApprovedCodeFiles(root: string, input: WorkforceCodeDeliveryProfile,
  signal?: AbortSignal): Promise<ApprovedCodeFiles> {
  const profile = readFrozenWorkforceCodeDeliveryProfile(input);
  const canonicalRoot = await checkedRoot(root);
  const writable = new Set(profile.writePaths);
  const files: ApprovedCodeFile[] = [];
  for (const path of profile.readPaths) {
    aborted(signal);
    const target = await checkedFilePath(canonicalRoot, path);
    let handle;
    try {
      handle = await open(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    } catch (error) {
      if ((error as { code?: unknown })?.code === "ENOENT" && writable.has(path)) {
        files.push(Object.freeze({ path, sha256: null, content: null })); continue;
      }
      throw failure("WORKFORCE_CODE_FILE_UNAVAILABLE", "An approved input file is unavailable.");
    }
    try {
      const initial = await handle.stat();
      if (!initial.isFile() || initial.nlink !== 1 || initial.size > profile.artifactLimits.maxFileBytes) {
        throw failure("WORKFORCE_CODE_FILE_UNSAFE", "Approved inputs must be bounded regular files without hard links.");
      }
      const buffer = Buffer.alloc(profile.artifactLimits.maxFileBytes + 1);
      let size = 0;
      while (size < buffer.length) {
        const read = await handle.read(buffer, size, buffer.length - size, size);
        if (!read.bytesRead) break;
        size += read.bytesRead; aborted(signal);
      }
      const current = await handle.stat();
      const pathState = await lstat(await checkedFilePath(canonicalRoot, path));
      if (size > profile.artifactLimits.maxFileBytes || current.size !== size
        || initial.size !== current.size || initial.mtimeMs !== current.mtimeMs
        || pathState.isSymbolicLink() || pathState.dev !== current.dev || pathState.ino !== current.ino) {
        throw failure("WORKFORCE_CODE_FILE_CHANGED", "An approved input changed during bounded capture.");
      }
      const bytes = buffer.subarray(0, size);
      const content = bytes.toString("utf8");
      if (!Buffer.from(content, "utf8").equals(bytes) || content.includes("\0")
        || containsSensitivePublicationText(content)) {
        throw failure("WORKFORCE_CODE_FILE_UNSAFE", "An approved input cannot be safely included in a code artifact.");
      }
      files.push(Object.freeze({ path, sha256: sha256(bytes), content }));
    } finally { await handle.close(); }
  }
  for (const test of profile.verification.immutableTests) {
    if (files.find(file => file.path === test.path)?.sha256 !== test.sha256) {
      throw failure("WORKFORCE_CODE_TEST_CHANGED", "An immutable verification file does not match the approved hash.");
    }
  }
  aborted(signal);
  return Object.freeze({ root: canonicalRoot, profileHash: profile.profileHash,
    filesHash: sha256(stableStringify({ profileHash: profile.profileHash, files: files.map(file => [file.path, file.sha256]) })),
    files: Object.freeze(files) });
}

/** Complete, bounded whole-file diffs; never silently truncate a review artifact. */
export function createCodeDeliveryArtifact(before: ApprovedCodeFiles, after: ApprovedCodeFiles,
  input: WorkforceCodeDeliveryProfile): CodeDeliveryArtifact {
  const profile = readFrozenWorkforceCodeDeliveryProfile(input);
  if (before.profileHash !== profile.profileHash || after.profileHash !== profile.profileHash
    || compare(before.root) !== compare(after.root) || before.files.length !== profile.readPaths.length
    || after.files.length !== profile.readPaths.length) throw failure("WORKFORCE_CODE_ARTIFACT_BINDING_INVALID", "File snapshots do not share the reviewed binding.");
  const writable = new Set(profile.writePaths), changes: CodeFileDelta[] = [];
  for (const path of profile.readPaths) {
    const oldFile = before.files.find(file => file.path === path), newFile = after.files.find(file => file.path === path);
    if (!oldFile || !newFile) throw failure("WORKFORCE_CODE_ARTIFACT_BINDING_INVALID", "An approved snapshot file is missing.");
    if (oldFile.sha256 === newFile.sha256) continue;
    if (!writable.has(path)) throw failure("WORKFORCE_CODE_READ_ONLY_CHANGED", "A read-only approved input changed.");
    changes.push(Object.freeze({ path, change: oldFile.content === null ? "added" : newFile.content === null ? "deleted" : "modified",
      beforeSha256: oldFile.sha256, afterSha256: newFile.sha256, patch: unified(path, oldFile.content, newFile.content) }));
  }
  if (!changes.length) throw failure("WORKFORCE_CODE_NO_CHANGES", "The implementation did not produce an approved file change.");
  const patch = changes.map(change => change.patch).join("");
  const diffBytes = Buffer.byteLength(patch);
  if (changes.length > profile.artifactLimits.maxChangedFiles || diffBytes > profile.artifactLimits.maxDiffBytes) {
    throw failure("WORKFORCE_CODE_ARTIFACT_LIMIT", "The complete code diff exceeds its approved artifact limit.");
  }
  return Object.freeze({ version: 1, profileHash: profile.profileHash, sourceFilesHash: after.filesHash,
    diffSha256: sha256(patch), diffBytes, filesChanged: Object.freeze(changes) });
}

/** This is filesystem preparation only; the returned object grants no execution authority. */
export async function createApprovedCodeSnapshot(files: ApprovedCodeFiles, scratchRoot: string, signal?: AbortSignal) {
  const canonicalScratch = await checkedRoot(scratchRoot);
  aborted(signal);
  const directory = await mkdtemp(join(canonicalScratch, "workforce-verify-"));
  const workspace = join(directory, "workspace");
  const cleanup = async () => {
    if (compare(await checkedRoot(directory)) !== compare(directory) || compare(dirname(directory)) !== compare(canonicalScratch)) {
      throw failure("WORKFORCE_CODE_SNAPSHOT_CLEANUP_UNCERTAIN", "The owned verification snapshot root changed.");
    }
    await rm(directory, { recursive: true, force: true });
  };
  try {
    await mkdir(workspace, { mode: 0o755 });
    for (const file of files.files) {
      aborted(signal);
      if (file.content === null) continue;
      const target = resolve(workspace, file.path);
      if (!inside(workspace, target)) throw failure("WORKFORCE_CODE_ARTIFACT_BINDING_INVALID", "Snapshot path escaped its owned root.");
      await mkdir(dirname(target), { recursive: true, mode: 0o755 });
      await writeFile(target, file.content, { flag: "wx", mode: 0o444 });
    }
    aborted(signal);
    return Object.freeze({ workspace, filesHash: files.filesHash, cleanup });
  } catch (error) {
    try { await cleanup(); }
    catch { throw failure("WORKFORCE_CODE_SNAPSHOT_CLEANUP_UNCERTAIN", "Verification snapshot preparation failed and cleanup is unconfirmed."); }
    throw error;
  }
}

async function checkedRoot(root: string): Promise<string> {
  if (typeof root !== "string" || !isAbsolute(root)) throw failure("WORKFORCE_CODE_ROOT_INVALID", "An absolute owned directory is required.");
  const state = await lstat(root);
  const canonical = await realpath(root);
  if (!state.isDirectory() || state.isSymbolicLink() || compare(canonical) !== compare(root)) {
    throw failure("WORKFORCE_CODE_ROOT_INVALID", "The owned directory is missing, linked or replaced.");
  }
  return canonical;
}
async function checkedFilePath(root: string, path: string): Promise<string> {
  const target = resolve(root, path);
  if (!inside(root, target)) throw failure("WORKFORCE_CODE_FILE_UNSAFE", "Approved file escaped its owned root.");
  let current = root;
  for (const component of relative(root, target).split(/[\\/]/u)) {
    current = join(current, component);
    try {
      const state = await lstat(current);
      if (state.isSymbolicLink() || !insideOrEqual(root, await realpath(current))) {
        throw failure("WORKFORCE_CODE_FILE_UNSAFE", "Approved file contains a link or redirected path.");
      }
    } catch (error) { if ((error as { code?: unknown })?.code === "ENOENT") break; throw error; }
  }
  return target;
}
function unified(path: string, before: string | null, after: string | null): string {
  const lines = (text: string | null) => text ? text.replace(/\n$/u, "").split("\n") : [];
  const oldLines = lines(before), newLines = lines(after);
  let patch = "diff --git " + JSON.stringify("a/" + path) + " " + JSON.stringify("b/" + path) + "\n"
    + (before === null ? "new file mode 100644\n" : after === null ? "deleted file mode 100644\n" : "");
  if (!oldLines.length && !newLines.length) return patch;
  patch += "--- " + (before === null ? "/dev/null" : JSON.stringify("a/" + path)) + "\n"
    + "+++ " + (after === null ? "/dev/null" : JSON.stringify("b/" + path)) + "\n"
    + "@@ -" + (oldLines.length ? 1 : 0) + "," + oldLines.length + " +" + (newLines.length ? 1 : 0) + "," + newLines.length + " @@\n";
  for (const [text, entries, prefix] of [[before, oldLines, "-"], [after, newLines, "+"]] as const) {
    for (const line of entries) patch += prefix + line + "\n";
    if (text && !text.endsWith("\n")) patch += "\\ No newline at end of file\n";
  }
  return patch;
}
function inside(root: string, target: string) { const path = relative(root, target); return path !== "" && path !== ".." && !path.startsWith("../") && !path.startsWith("..\\") && !isAbsolute(path); }
function insideOrEqual(root: string, target: string) { return compare(root) === compare(target) || inside(root, target); }
function compare(path: string) { const normalized = resolve(path); return process.platform === "win32" ? normalized.toLowerCase() : normalized; }
function sha256(value: string | Buffer) { return createHash("sha256").update(value).digest("hex"); }
function aborted(signal?: AbortSignal) { if (signal?.aborted) throw failure("WORKFORCE_CODE_DELIVERY_CANCELLED", "Code delivery was cancelled."); }
function failure(code: string, message: string) { return codeDeliveryError(code, code.endsWith("CANCELLED") ? 499 : 409, message); }
