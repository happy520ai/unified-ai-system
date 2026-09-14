import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import type { BigIntStats } from "node:fs";
import path from "node:path";

export type ForgeAudioOutputTarget = Readonly<{ path: string }>;
type PreparedTarget = { parent: string; requestedParent: string; identity: BigIntStats; used: boolean };
const targets = new WeakMap<ForgeAudioOutputTarget, PreparedTarget>();
const MAX_BYTES = 4 * 1024 * 1024;

export class ForgeAudioOutputError extends Error {
  readonly code = "FORGE_AUDIO_OUTPUT_FAILED";
  readonly saved = false;
  readonly retrySafe = false;
  readonly retryable = false;
  readonly fileCreated: boolean;
  /** Describes local file state only; never asserts whether a Provider was called. */
  readonly outcomeUnknown: boolean;
  constructor(fileCreated = false, outcomeUnknown = false) {
    super("Audio was not saved and verified; inspect the local output before any new save attempt");
    this.name = "ForgeAudioOutputError";
    this.fileCreated = fileCreated;
    this.outcomeUnknown = outcomeUnknown;
  }
}

function validLocalPath(value: string) {
  if (typeof value !== "string" || !value || value.length > 32760 || /^[\\/]{2}/u.test(value)
    || /[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff<>"|?*]/u.test(value)) throw new ForgeAudioOutputError();
  const withoutDrive = /^[A-Za-z]:[\\/]/u.test(value) ? value.slice(2) : value;
  if (withoutDrive.includes(":")) throw new ForgeAudioOutputError();
  for (const part of withoutDrive.split(/[\\/]/u)) {
    if (!part || part === "." || part === "..") continue;
    if (/[. ]$/u.test(part) || /^(?:con|prn|aux|nul|clock\$|conin\$|conout\$|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/iu.test(part)) {
      throw new ForgeAudioOutputError();
    }
  }
}

function sameIdentity(left: BigIntStats, right: BigIntStats) {
  return left.dev === right.dev && left.ino === right.ino && left.birthtimeNs === right.birthtimeNs;
}

async function checkParent(prepared: PreparedTarget) {
  const resolved = await fs.realpath(prepared.requestedParent);
  if (resolved !== prepared.parent) throw new ForgeAudioOutputError();
  const stat = await fs.lstat(prepared.parent, { bigint: true });
  if (!stat.isDirectory() || stat.isSymbolicLink() || !sameIdentity(stat, prepared.identity)) throw new ForgeAudioOutputError();
}

/** Checks the user-owned local destination before dispatch; creates no directories or files. */
export async function prepareForgeAudioOutput(userPath: string): Promise<ForgeAudioOutputTarget> {
  try {
    validLocalPath(userPath);
    const requested = path.resolve(userPath);
    if (!/\.wav$/iu.test(path.basename(requested))) throw new ForgeAudioOutputError();
    const requestedParent = path.dirname(requested), parent = await fs.realpath(requestedParent);
    validLocalPath(parent);
    const identity = await fs.lstat(parent, { bigint: true });
    if (!identity.isDirectory() || identity.isSymbolicLink()) throw new ForgeAudioOutputError();
    const output = path.join(parent, path.basename(requested));
    try { await fs.lstat(output, { bigint: true }); throw new ForgeAudioOutputError(); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    const target = Object.freeze({ path: output });
    const prepared = { parent, requestedParent, identity, used: false };
    await checkParent(prepared);
    targets.set(target, prepared);
    return target;
  } catch { throw new ForgeAudioOutputError(); }
}

function sha256(bytes: Uint8Array) { return createHash("sha256").update(bytes).digest("hex"); }

/** Exclusively creates one new file, fsyncs and verifies through its original handle. */
export async function saveForgeAudioOutput(target: ForgeAudioOutputTarget, decoded: Uint8Array, expectedSha: string): Promise<{
  status: "saved"; path: string; bytes: number; sha256: string;
}> {
  let file: Awaited<ReturnType<typeof fs.open>> | undefined;
  let fileCreated = false, openAttempted = false, creationUncertain = false;
  let privateBytes: Uint8Array | undefined;
  try {
    const prepared = targets.get(target);
    if (!prepared || prepared.used || !(decoded instanceof Uint8Array) || decoded.byteLength < 46
      || decoded.byteLength > MAX_BYTES || typeof expectedSha !== "string" || !/^[a-f0-9]{64}$/u.test(expectedSha)) throw new ForgeAudioOutputError();
    prepared.used = true;
    privateBytes = new Uint8Array(decoded);
    if (sha256(privateBytes) !== expectedSha) throw new ForgeAudioOutputError();
    await checkParent(prepared);
    openAttempted = true;
    try { file = await fs.open(target.path, "wx+", 0o600); }
    catch (error) {
      creationUncertain = (error as NodeJS.ErrnoException).code !== "EEXIST";
      throw error;
    }
    fileCreated = true;
    const created = await file.stat({ bigint: true });
    if (!created.isFile() || created.nlink !== 1n || created.size !== 0n) throw new ForgeAudioOutputError();
    await checkParent(prepared);
    await file.writeFile(privateBytes);
    await file.sync();
    const readback = new Uint8Array(privateBytes.byteLength);
    let offset = 0;
    while (offset < readback.byteLength) {
      const { bytesRead } = await file.read(readback, offset, readback.byteLength - offset, offset);
      if (!bytesRead) throw new ForgeAudioOutputError();
      offset += bytesRead;
    }
    const verified = await file.stat({ bigint: true });
    const named = await fs.lstat(target.path, { bigint: true });
    if (sha256(readback) !== expectedSha || !sameIdentity(created, verified) || !sameIdentity(created, named)
      || !verified.isFile() || !named.isFile() || named.isSymbolicLink()
      || verified.nlink !== 1n || named.nlink !== 1n || verified.size !== BigInt(privateBytes.byteLength)
      || named.size !== BigInt(privateBytes.byteLength)) throw new ForgeAudioOutputError();
    await checkParent(prepared);
    await file.close();
    file = undefined;
    return { status: "saved", path: target.path, bytes: privateBytes.byteLength, sha256: expectedSha };
  } catch {
    throw new ForgeAudioOutputError(fileCreated, fileCreated || (openAttempted && creationUncertain));
  } finally {
    if (file) { try { await file.close(); } catch { /* Failure retains the newly created file for inspection. */ } }
    privateBytes?.fill(0);
  }
}
