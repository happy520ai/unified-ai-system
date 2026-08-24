import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  rename,
  rm,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";

const CHECKPOINT_TYPE = "unified-ai-system-audit-checkpoint";
const CHECKPOINT_VERSION = 1;
const MAX_CHECKPOINT_BYTES = 64 * 1024;
const KEY_BYTES = 32;

type AuditCheckpoint = {
  type: typeof CHECKPOINT_TYPE;
  version: typeof CHECKPOINT_VERSION;
  sequence: number;
  hash: string;
  updatedAt: string;
  keyId: string;
  algorithm: "hmac-sha256";
  signature: string;
};

type VerifiedChainState = {
  entryCount: number;
  lastHash: string;
  hashes: string[];
};

export type AuditCheckpointStore = {
  configured: boolean;
  verify(state: VerifiedChainState): Promise<AuditCheckpoint | null>;
  commit(state: { sequence: number; hash: string }): Promise<AuditCheckpoint | null>;
  getHealth(): Record<string, unknown>;
};

export function createAuditCheckpointStore({
  chainPath,
  checkpointPath,
  keyMaterial,
  keyFilePath,
  allowBootstrap = false,
  allowAdvance = false,
  trustedMinimumSequence = 0,
  trustedHash,
}: {
  chainPath: string;
  checkpointPath?: string;
  keyMaterial?: string;
  keyFilePath?: string;
  allowBootstrap?: boolean;
  allowAdvance?: boolean;
  trustedMinimumSequence?: number | string;
  trustedHash?: string;
}): AuditCheckpointStore {
  const normalizedPath = String(checkpointPath ?? "").trim();
  const inlineKey = String(keyMaterial ?? "").trim();
  const normalizedKeyFilePath = String(keyFilePath ?? "").trim();
  if (!normalizedPath && !inlineKey && !normalizedKeyFilePath) return createDisabledStore();
  if (inlineKey && normalizedKeyFilePath) {
    throw checkpointError(
      "AUDIT_CHECKPOINT_KEY_AMBIGUOUS",
      "Configure either the inline audit checkpoint key or its key file, not both.",
    );
  }
  if (!normalizedPath || (!inlineKey && !normalizedKeyFilePath)) {
    throw checkpointError(
      "AUDIT_CHECKPOINT_CONFIG_INCOMPLETE",
      "Configure both the audit checkpoint path and its dedicated HMAC key.",
    );
  }

  const key = parseKeyMaterial(inlineKey || readKeyFile(normalizedKeyFilePath));
  const keyId = createHash("sha256").update("audit-checkpoint-key:v1:").update(key).digest("hex").slice(0, 16);
  const resolvedCheckpointPath = resolve(normalizedPath);
  const resolvedChainPath = resolve(chainPath);
  if (resolvedCheckpointPath === resolvedChainPath || resolvedCheckpointPath === `${resolvedChainPath}.lock`) {
    throw checkpointError(
      "AUDIT_CHECKPOINT_PATH_COLLISION",
      "The audit checkpoint must not overwrite the chain or its writer lock.",
    );
  }
  const minimumSequence = parseNonNegativeInteger(trustedMinimumSequence, "AUDIT_CHECKPOINT_MINIMUM_SEQUENCE_INVALID");
  const minimumHash = String(trustedHash ?? "").trim();
  if (minimumHash && !/^[a-f0-9]{64}$/.test(minimumHash)) {
    throw checkpointError(
      "AUDIT_CHECKPOINT_TRUSTED_HASH_INVALID",
      "The trusted audit checkpoint hash must be a lowercase SHA-256 digest.",
    );
  }
  if (minimumHash && minimumSequence === 0 && minimumHash !== "GENESIS") {
    throw checkpointError(
      "AUDIT_CHECKPOINT_TRUSTED_HASH_INVALID",
      "Sequence zero can only use the GENESIS trusted hash.",
    );
  }

  let lastVerifiedAt: string | null = null;
  let lastCommittedAt: string | null = null;
  let lastSequence: number | null = null;
  let lastErrorCode: string | null = null;
  let bootstrapCount = 0;
  let advanceCount = 0;

  function unsignedCheckpoint(input: { sequence: number; hash: string; updatedAt: string }) {
    return {
      type: CHECKPOINT_TYPE,
      version: CHECKPOINT_VERSION,
      sequence: input.sequence,
      hash: input.hash,
      updatedAt: input.updatedAt,
      keyId,
      algorithm: "hmac-sha256",
    } as const;
  }

  function seal(input: { sequence: number; hash: string; updatedAt: string }): AuditCheckpoint {
    assertCheckpointPosition(input.sequence, input.hash);
    const unsigned = unsignedCheckpoint(input);
    return {
      ...unsigned,
      signature: createHmac("sha256", key).update(canonicalBytes(unsigned)).digest("base64"),
    };
  }

  function openCheckpoint(value: unknown): AuditCheckpoint {
    assertCheckpointShape(value);
    const checkpoint = value;
    if (checkpoint.keyId !== keyId) {
      throw checkpointError(
        "AUDIT_CHECKPOINT_KEY_MISMATCH",
        "The configured key cannot verify the audit checkpoint.",
      );
    }
    const expected = createHmac("sha256", key)
      .update(canonicalBytes(unsignedCheckpoint(checkpoint)))
      .digest();
    const actual = decodeSignature(checkpoint.signature);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw checkpointError(
        "AUDIT_CHECKPOINT_SIGNATURE_INVALID",
        "The audit checkpoint signature is invalid.",
      );
    }
    return checkpoint;
  }

  async function commit({ sequence, hash }: { sequence: number; hash: string }) {
    try {
      const updatedAt = new Date().toISOString();
      const checkpoint = seal({ sequence, hash, updatedAt });
      await writePrivateFileAtomic(resolvedCheckpointPath, `${JSON.stringify(checkpoint)}\n`);
      lastSequence = sequence;
      lastCommittedAt = updatedAt;
      lastVerifiedAt = updatedAt;
      lastErrorCode = null;
      return checkpoint;
    } catch (error) {
      lastErrorCode = readErrorCode(error);
      throw error;
    }
  }

  async function verify(state: VerifiedChainState) {
    try {
      let checkpoint: AuditCheckpoint;
      try {
        checkpoint = openCheckpoint(await readCheckpointFile(resolvedCheckpointPath));
      } catch (error) {
        if (readErrorCode(error) !== "AUDIT_CHECKPOINT_MISSING") throw error;
        if (state.entryCount !== 0 && !allowBootstrap) throw error;
        checkpoint = await commit({ sequence: state.entryCount, hash: state.lastHash }) as AuditCheckpoint;
        bootstrapCount += 1;
      }

      assertTrustedFloor(checkpoint, minimumSequence, minimumHash);
      if (checkpoint.sequence > state.entryCount) {
        throw checkpointError(
          "AUDIT_CHECKPOINT_ROLLBACK_DETECTED",
          "The audit chain is behind its signed checkpoint.",
        );
      }
      const expectedHash = checkpoint.sequence === 0
        ? "GENESIS"
        : state.hashes[checkpoint.sequence - 1];
      if (expectedHash !== checkpoint.hash) {
        throw checkpointError(
          "AUDIT_CHECKPOINT_CHAIN_MISMATCH",
          "The audit chain does not contain the signed checkpoint state.",
        );
      }
      const trustedChainHash = minimumSequence === 0
        ? "GENESIS"
        : state.hashes[minimumSequence - 1];
      if (minimumHash && trustedChainHash !== minimumHash) {
        throw checkpointError(
          "AUDIT_CHECKPOINT_TRUSTED_HASH_MISMATCH",
          "The audit chain does not match the externally trusted hash at its configured sequence floor.",
        );
      }
      if (checkpoint.sequence !== state.entryCount || checkpoint.hash !== state.lastHash) {
        if (allowAdvance && checkpoint.sequence < state.entryCount) {
          checkpoint = await commit({ sequence: state.entryCount, hash: state.lastHash }) as AuditCheckpoint;
          advanceCount += 1;
          return checkpoint;
        }
        throw checkpointError(
          "AUDIT_CHECKPOINT_LAG",
          "The audit chain has an uncheckpointed tail that requires explicit reconciliation.",
        );
      }

      lastSequence = checkpoint.sequence;
      lastVerifiedAt = new Date().toISOString();
      lastErrorCode = null;
      return checkpoint;
    } catch (error) {
      lastErrorCode = readErrorCode(error);
      throw error;
    }
  }

  return {
    configured: true,
    verify,
    commit,
    getHealth() {
      return {
        configured: true,
        status: lastErrorCode ? "degraded" : lastVerifiedAt ? "ready" : "unverified",
        mode: "signed-file-checkpoint",
        signed: true,
        algorithm: "hmac-sha256",
        keyId,
        keyExposed: false,
        pathExposed: false,
        separatePathConfigured: dirname(resolvedCheckpointPath) !== dirname(resolvedChainPath),
        externalRetentionVerified: false,
        trustedMinimumSequence: minimumSequence,
        trustedHashConfigured: Boolean(minimumHash),
        bootstrapAllowed: allowBootstrap,
        advanceAllowed: allowAdvance,
        bootstrapCount,
        advanceCount,
        lastSequence,
        lastVerifiedAt,
        lastCommittedAt,
        lastErrorCode,
      };
    },
  };
}

function createDisabledStore(): AuditCheckpointStore {
  return {
    configured: false,
    async verify() { return null; },
    async commit() { return null; },
    getHealth() {
      return {
        configured: false,
        status: "disabled",
        mode: "none",
        signed: false,
        keyExposed: false,
        pathExposed: false,
        externalRetentionVerified: false,
      };
    },
  };
}

async function readCheckpointFile(path: string): Promise<unknown> {
  let fileStat;
  try {
    fileStat = await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      throw checkpointError("AUDIT_CHECKPOINT_MISSING", "The signed audit checkpoint is missing.");
    }
    throw checkpointError("AUDIT_CHECKPOINT_UNREADABLE", "The signed audit checkpoint cannot be inspected.", error);
  }
  if (!fileStat.isFile() || fileStat.isSymbolicLink() || fileStat.size <= 0 || fileStat.size > MAX_CHECKPOINT_BYTES) {
    throw checkpointError("AUDIT_CHECKPOINT_FILE_INVALID", "The signed audit checkpoint file type or size is invalid.");
  }
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw checkpointError("AUDIT_CHECKPOINT_PARSE_FAILED", "The signed audit checkpoint is not valid JSON.", error);
  }
}

async function writePrivateFileAtomic(path: string, content: string) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  let descriptor;
  try {
    descriptor = await open(temporaryPath, "wx", 0o600);
    await descriptor.writeFile(content, "utf8");
    await descriptor.sync();
    await descriptor.close();
    descriptor = undefined;
    await rename(temporaryPath, path);
    if (process.platform !== "win32") await chmod(path, 0o600);
  } catch (error) {
    if (descriptor) await descriptor.close().catch(() => undefined);
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw checkpointError("AUDIT_CHECKPOINT_WRITE_FAILED", "The signed audit checkpoint could not be committed.", error);
  }
}

function assertTrustedFloor(checkpoint: AuditCheckpoint, minimumSequence: number, trustedHash: string) {
  if (checkpoint.sequence < minimumSequence) {
    throw checkpointError(
      "AUDIT_CHECKPOINT_ROLLBACK_DETECTED",
      "The signed audit checkpoint is below the externally configured sequence floor.",
    );
  }
  if (trustedHash && checkpoint.sequence === minimumSequence && checkpoint.hash !== trustedHash) {
    throw checkpointError(
      "AUDIT_CHECKPOINT_TRUSTED_HASH_MISMATCH",
      "The signed audit checkpoint does not match the externally trusted hash.",
    );
  }
}

function assertCheckpointShape(value: unknown): asserts value is AuditCheckpoint {
  if (!value || typeof value !== "object") throw invalidCheckpoint();
  const candidate = value as Partial<AuditCheckpoint>;
  if (candidate.type !== CHECKPOINT_TYPE || candidate.version !== CHECKPOINT_VERSION
    || candidate.algorithm !== "hmac-sha256" || typeof candidate.updatedAt !== "string"
    || typeof candidate.keyId !== "string" || typeof candidate.signature !== "string") {
    throw invalidCheckpoint();
  }
  assertCheckpointPosition(candidate.sequence as number, candidate.hash as string);
  if (!Number.isFinite(Date.parse(candidate.updatedAt))) throw invalidCheckpoint();
}

function assertCheckpointPosition(sequence: number, hash: string) {
  if (!Number.isSafeInteger(sequence) || sequence < 0) throw invalidCheckpoint();
  if (sequence === 0 && hash !== "GENESIS") throw invalidCheckpoint();
  if (sequence > 0 && !/^[a-f0-9]{64}$/.test(hash)) throw invalidCheckpoint();
}

function invalidCheckpoint() {
  return checkpointError("AUDIT_CHECKPOINT_FORMAT_INVALID", "The signed audit checkpoint format is invalid.");
}

function parseKeyMaterial(value: string) {
  const normalized = value.replace(/^hex:/, "");
  if (/^[a-fA-F0-9]{64}$/.test(normalized)) return Buffer.from(normalized, "hex");
  const base64 = value.replace(/^base64:/, "");
  if (/^[A-Za-z0-9+/]{43}=$/.test(base64)) {
    const decoded = Buffer.from(base64, "base64");
    if (decoded.length === KEY_BYTES && decoded.toString("base64") === base64) return decoded;
  }
  throw checkpointError(
    "AUDIT_CHECKPOINT_KEY_INVALID",
    "The audit checkpoint key must be exactly 32 bytes in canonical hex or base64 form.",
  );
}

function readKeyFile(path: string) {
  try {
    const keyStat = statSync(path);
    if (!keyStat.isFile() || keyStat.size <= 0 || keyStat.size > 4096) throw new Error("invalid key file");
    if (process.platform !== "win32" && (keyStat.mode & 0o077) !== 0) {
      throw checkpointError(
        "AUDIT_CHECKPOINT_KEY_FILE_PERMISSIONS",
        "The audit checkpoint key file must not be accessible by group or other users.",
      );
    }
    return readFileSync(path, "utf8").trim();
  } catch (error) {
    if (String((error as { code?: unknown })?.code ?? "").startsWith("AUDIT_CHECKPOINT_")) throw error;
    throw checkpointError(
      "AUDIT_CHECKPOINT_KEY_FILE_INVALID",
      "The audit checkpoint key file could not be read securely.",
      error,
    );
  }
}

function decodeSignature(value: string) {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value)) return Buffer.alloc(0);
  const decoded = Buffer.from(value, "base64");
  return decoded.toString("base64") === value ? decoded : Buffer.alloc(0);
}

function canonicalBytes(value: object) {
  return Buffer.from(JSON.stringify(value), "utf8");
}

function parseNonNegativeInteger(value: number | string, code: string) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw checkpointError(code, "The trusted audit checkpoint sequence must be a non-negative integer.");
  }
  return parsed;
}

function readErrorCode(error: unknown) {
  return typeof (error as { code?: unknown })?.code === "string"
    ? String((error as { code: string }).code)
    : "AUDIT_CHECKPOINT_FAILED";
}

function checkpointError(code: string, message: string, cause?: unknown) {
  const error = new Error(message) as Error & {
    code: string;
    category: string;
    retryable: boolean;
    cause?: unknown;
  };
  error.code = code;
  error.category = "audit";
  error.retryable = code === "AUDIT_CHECKPOINT_WRITE_FAILED";
  if (cause) error.cause = cause;
  return error;
}
