import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import {
  constants as fileConstants,
} from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  unlink,
} from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import { platform } from "node:os";

export const LOCAL_CLIENT_CONFIG_PLAN_VERSION = "local-client-config-plan-v1" as const;
export const LOCAL_CLIENT_CONFIG_RECEIPT_VERSION = "local-client-config-receipt-v1" as const;
export const LOCAL_CLIENT_CONFIG_ROLLBACK_RECEIPT_VERSION = "local-client-config-rollback-receipt-v1" as const;
export const LOCAL_CLIENT_CONFIG_RECOVERY_RECEIPT_VERSION = "local-client-config-recovery-receipt-v1" as const;
export const LOCAL_CLIENT_CONFIG_JOURNAL_VERSION = "local-client-config-journal-v2" as const;
export const LOCAL_CLIENT_CONFIG_BACKUP_ENVELOPE_VERSION = "local-client-config-backup-aes-256-gcm-v1" as const;

const LOCK_VERSION = "local-client-config-lock-v1" as const;
const DEFAULT_MAX_BYTES = 1_048_576;
const HARD_MAX_BYTES = 16 * 1_048_576;
const DEFAULT_MAX_TRANSACTIONS = 128;
const HARD_MAX_TRANSACTIONS = 4_096;
const DEFAULT_COMMITTED_RETENTION_MS = 30 * 24 * 60 * 60_000;
const MIN_COMMITTED_RETENTION_MS = 10;
const MAX_COMMITTED_RETENTION_MS = 365 * 24 * 60 * 60_000;
const MAX_OPERATIONS = 128;
const MAX_PATH_DEPTH = 32;
const MAX_KEY_LENGTH = 128;
const MAX_JSON_DEPTH = 64;
const MAX_JSON_NODES = 100_000;
const PLAN_TTL_MS = 10 * 60_000;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const TRANSACTION_ID_PATTERN = /^tx_[a-f0-9]{64}$/u;
const BACKUP_FILE_PATTERN = /^tx_[a-f0-9]{64}\.backup\.json$/u;
const CANONICAL_BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const SAFE_STATUS = new Set<JournalEntryStatus>([
  "pending",
  "committed",
  "aborted",
  "rollback-pending",
  "rolled-back",
  "expired",
]);

type JsonPrimitive = null | boolean | number | string;
export type LocalClientConfigJsonValue = JsonPrimitive | LocalClientConfigJsonValue[] | {
  readonly [key: string]: LocalClientConfigJsonValue;
};

export type LocalClientConfigOperation =
  | Readonly<{
    op: "set";
    path: readonly string[];
    value: LocalClientConfigJsonValue;
  }>
  | Readonly<{
    op: "delete";
    path: readonly string[];
  }>;

export interface LocalClientConfigTransactionOptions {
  readonly targetPath: string;
  readonly allowedRoot: string;
  readonly backupDir: string;
  readonly journalPath: string;
  readonly maxBytes?: number;
  readonly maxTransactions?: number;
  readonly committedRetentionMs?: number;
  readonly backupEncryptionKey?: Uint8Array;
  readonly clock?: () => number;
}

export interface LocalClientConfigPlan {
  readonly planVersion: typeof LOCAL_CLIENT_CONFIG_PLAN_VERSION;
  readonly planId: string;
  readonly targetFingerprint: string;
  readonly beforeSha256: string;
  readonly afterSha256: string;
  readonly beforeIdentityFingerprint: string;
  readonly operationCount: number;
  readonly operations: readonly Readonly<{
    op: "set" | "delete";
    pathFingerprint: string;
    valueFingerprint: string | null;
    valueKind: "null" | "boolean" | "number" | "string" | "array" | "object" | null;
  }>[];
  readonly createdAtMs: number;
  readonly expiresAtMs: number;
  readonly writesPerformed: false;
}

export interface LocalClientConfigReceipt {
  readonly receiptVersion: typeof LOCAL_CLIENT_CONFIG_RECEIPT_VERSION;
  readonly transactionId: string;
  readonly planId: string;
  readonly targetFingerprint: string;
  readonly beforeSha256: string;
  readonly afterSha256: string;
  readonly backupSha256: string;
  readonly afterIdentityFingerprint: string;
  readonly committedAtMs: number;
  readonly receiptDigest: string;
}

export interface LocalClientConfigRollbackReceipt {
  readonly rollbackReceiptVersion: typeof LOCAL_CLIENT_CONFIG_ROLLBACK_RECEIPT_VERSION;
  readonly transactionId: string;
  readonly planId: string;
  readonly restoredSha256: string;
  readonly replacedSha256: string;
  readonly backupSha256: string;
  readonly rolledBackAtMs: number;
  readonly receiptDigest: string;
}

export interface LocalClientConfigRecoveryReceipt {
  readonly recoveryReceiptVersion: typeof LOCAL_CLIENT_CONFIG_RECOVERY_RECEIPT_VERSION;
  readonly transactionId: string;
  readonly resolution: "apply-aborted" | "apply-committed" | "rollback-aborted" | "rollback-completed";
  readonly currentSha256: string;
  readonly recoveredAtMs: number;
  readonly applyReceipt: LocalClientConfigReceipt | null;
  readonly rollbackReceipt: LocalClientConfigRollbackReceipt | null;
}

export interface LocalClientConfigTransactionStatus {
  readonly available: boolean;
  readonly format: "json-only";
  readonly targetFingerprint: string;
  readonly recoveryRequired: boolean;
  readonly journalCorrupt: boolean;
  readonly pendingTransactionIds: readonly string[];
  readonly storedPlans: number;
  readonly maxTransactions: number;
  readonly committedRetentionMs: number;
  readonly backupProtection: "aes-256-gcm" | "0600-plaintext";
  readonly boundaries: Readonly<{
    jsoncSupported: false;
    yamlSupported: false;
    rawPathsExposed: false;
    rawValuesExposed: false;
    crossProcessExclusiveLock: true;
    atomicReplace: true;
    exactRollback: true;
  }>;
}

export type LocalClientConfigTransactionErrorCode =
  | "LOCAL_CLIENT_CONFIG_CONFIGURATION_INVALID"
  | "LOCAL_CLIENT_CONFIG_PATH_UNSAFE"
  | "LOCAL_CLIENT_CONFIG_TARGET_INVALID"
  | "LOCAL_CLIENT_CONFIG_TOO_LARGE"
  | "LOCAL_CLIENT_CONFIG_JSON_INVALID"
  | "LOCAL_CLIENT_CONFIG_OPERATION_INVALID"
  | "LOCAL_CLIENT_CONFIG_PLAN_CAPACITY"
  | "LOCAL_CLIENT_CONFIG_PLAN_UNKNOWN"
  | "LOCAL_CLIENT_CONFIG_PLAN_EXPIRED"
  | "LOCAL_CLIENT_CONFIG_TARGET_CHANGED"
  | "LOCAL_CLIENT_CONFIG_LOCKED"
  | "LOCAL_CLIENT_CONFIG_JOURNAL_CORRUPT"
  | "LOCAL_CLIENT_CONFIG_JOURNAL_CAPACITY"
  | "LOCAL_CLIENT_CONFIG_RECOVERY_REQUIRED"
  | "LOCAL_CLIENT_CONFIG_TRANSACTION_UNKNOWN"
  | "LOCAL_CLIENT_CONFIG_RECEIPT_INVALID"
  | "LOCAL_CLIENT_CONFIG_BACKUP_INVALID"
  | "LOCAL_CLIENT_CONFIG_ROLLBACK_CONFLICT"
  | "LOCAL_CLIENT_CONFIG_RECOVERY_AMBIGUOUS"
  | "LOCAL_CLIENT_CONFIG_CLOCK_INVALID"
  | "LOCAL_CLIENT_CONFIG_CLEANUP_FAILED"
  | "LOCAL_CLIENT_CONFIG_PERSIST_FAILED";

export class LocalClientConfigTransactionError extends Error {
  readonly code: LocalClientConfigTransactionErrorCode;
  readonly category: "configuration" | "validation" | "conflict" | "integrity" | "capacity" | "persistence";
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(
    code: LocalClientConfigTransactionErrorCode,
    message: string,
    category: LocalClientConfigTransactionError["category"],
    statusCode: number,
    retryable = false,
  ) {
    super(message);
    this.name = "LocalClientConfigTransactionError";
    this.code = code;
    this.category = category;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

type FileIdentity = Readonly<{
  dev: string;
  ino: string;
  size: number;
  mtimeMs: number;
  mode: number;
}>;

type InternalPlan = Readonly<{
  publicPlan: LocalClientConfigPlan;
  beforeBytes: Buffer;
  afterBytes: Buffer;
  beforeIdentity: FileIdentity;
}>;

type JournalEntryStatus = "pending" | "committed" | "aborted" | "rollback-pending" | "rolled-back" | "expired";
type BackupProtection = "aes-256-gcm" | "0600-plaintext";

type JournalEntry = {
  transactionId: string;
  planId: string;
  targetFingerprint: string;
  beforeSha256: string;
  afterSha256: string;
  backupSha256: string;
  backupFileName: string;
  backupProtection: BackupProtection;
  beforeIdentityFingerprint: string;
  afterIdentityFingerprint: string | null;
  targetMode: number;
  status: JournalEntryStatus;
  createdAtMs: number;
  updatedAtMs: number;
  committedAtMs: number | null;
  rolledBackAtMs: number | null;
  receiptDigest: string | null;
  rollbackReceiptDigest: string | null;
};

type Journal = {
  journalVersion: typeof LOCAL_CLIENT_CONFIG_JOURNAL_VERSION;
  sequence: number;
  lastObservedAtMs: number;
  entries: JournalEntry[];
};

type LockRecord = Readonly<{
  lockVersion: typeof LOCK_VERSION;
  transactionId: string;
  token: string;
  pid: number;
  createdAtMs: number;
}>;

const BOUNDARIES = Object.freeze({
  jsoncSupported: false as const,
  yamlSupported: false as const,
  rawPathsExposed: false as const,
  rawValuesExposed: false as const,
  crossProcessExclusiveLock: true as const,
  atomicReplace: true as const,
  exactRollback: true as const,
});

/**
 * Transaction engine for one code-bound, plain JSON object file. JSONC and
 * YAML are intentionally unsupported; adapters for those formats need their
 * own structured parser and lossless writer before they may use this boundary.
 */
export class LocalClientConfigTransactionEngine {
  readonly #targetPath: string;
  readonly #allowedRoot: string;
  readonly #backupDir: string;
  readonly #journalPath: string;
  readonly #lockPath: string;
  readonly #targetFingerprint: string;
  readonly #maxBytes: number;
  readonly #maxTransactions: number;
  readonly #committedRetentionMs: number;
  readonly #backupEncryptionKey: Buffer | null;
  readonly #clock: () => number;
  readonly #plans = new Map<string, InternalPlan>();
  #journal: Journal = createEmptyJournal();
  #journalCorrupt = false;
  #recoveryRequired = false;
  #closed = false;

  private constructor(options: LocalClientConfigTransactionOptions) {
    assertExactObject(options, [
      "targetPath",
      "allowedRoot",
      "backupDir",
      "journalPath",
      "maxBytes",
      "maxTransactions",
      "committedRetentionMs",
      "backupEncryptionKey",
      "clock",
    ], new Set([
      "maxBytes",
      "maxTransactions",
      "committedRetentionMs",
      "backupEncryptionKey",
      "clock",
    ]), configurationError);
    this.#targetPath = assertAbsolutePath(options.targetPath);
    this.#allowedRoot = assertAbsolutePath(options.allowedRoot);
    this.#backupDir = assertAbsolutePath(options.backupDir);
    this.#journalPath = assertAbsolutePath(options.journalPath);
    this.#lockPath = `${this.#journalPath}.lock`;
    this.#maxBytes = boundedInteger(options.maxBytes, DEFAULT_MAX_BYTES, 256, HARD_MAX_BYTES);
    this.#maxTransactions = boundedInteger(
      options.maxTransactions,
      DEFAULT_MAX_TRANSACTIONS,
      1,
      HARD_MAX_TRANSACTIONS,
    );
    this.#committedRetentionMs = boundedInteger(
      options.committedRetentionMs,
      DEFAULT_COMMITTED_RETENTION_MS,
      MIN_COMMITTED_RETENTION_MS,
      MAX_COMMITTED_RETENTION_MS,
    );
    if (options.clock !== undefined && typeof options.clock !== "function") throw configurationError();
    this.#clock = options.clock ?? Date.now;
    this.#targetFingerprint = sha256Text(normalizePathForFingerprint(this.#targetPath));
    assertBoundPaths({
      allowedRoot: this.#allowedRoot,
      targetPath: this.#targetPath,
      backupDir: this.#backupDir,
      journalPath: this.#journalPath,
      lockPath: this.#lockPath,
    });
    this.#backupEncryptionKey = cloneBackupEncryptionKey(options.backupEncryptionKey);
  }

  static async open(options: LocalClientConfigTransactionOptions): Promise<LocalClientConfigTransactionEngine> {
    const engine = new LocalClientConfigTransactionEngine(options);
    try {
      await engine.#initialize();
      return engine;
    } catch (error) {
      await engine.close();
      throw error;
    }
  }

  getStatus(): LocalClientConfigTransactionStatus {
    const pending = this.#journal.entries
      .filter((entry) => entry.status === "pending" || entry.status === "rollback-pending")
      .map((entry) => entry.transactionId);
    return Object.freeze({
      available: !this.#closed,
      format: "json-only",
      targetFingerprint: this.#targetFingerprint,
      recoveryRequired: this.#recoveryRequired,
      journalCorrupt: this.#journalCorrupt,
      pendingTransactionIds: Object.freeze(pending),
      storedPlans: this.#plans.size,
      maxTransactions: this.#maxTransactions,
      committedRetentionMs: this.#committedRetentionMs,
      backupProtection: this.#backupEncryptionKey === null ? "0600-plaintext" : "aes-256-gcm",
      boundaries: BOUNDARIES,
    });
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    this.#backupEncryptionKey?.fill(0);
    for (const plan of this.#plans.values()) {
      plan.beforeBytes.fill(0);
      plan.afterBytes.fill(0);
    }
    this.#plans.clear();
  }

  async plan(input: Readonly<{ operations: readonly LocalClientConfigOperation[] }>): Promise<LocalClientConfigPlan> {
    this.#assertOpen();
    assertExactObject(input, ["operations"], new Set(), operationError);
    if (this.#plans.size >= this.#maxTransactions) {
      throw transactionError(
        "LOCAL_CLIENT_CONFIG_PLAN_CAPACITY",
        "The bounded local-client configuration plan store is full.",
        "capacity",
        429,
      );
    }
    const operations = normalizeOperations(input.operations, this.#maxBytes);
    await this.#assertSafeTopology({ requireTarget: true });
    const snapshot = await readBoundTarget(this.#targetPath, this.#allowedRoot, this.#maxBytes);
    const root = parsePlainJsonObject(snapshot.bytes, this.#maxBytes);
    const updated = applyOperations(root, operations);
    const afterBytes = serializeLikeOriginal(updated, snapshot.bytes);
    if (afterBytes.byteLength > this.#maxBytes) throw tooLargeError();
    const beforeSha256 = sha256Bytes(snapshot.bytes);
    const afterSha256 = sha256Bytes(afterBytes);
    if (beforeSha256 === afterSha256) throw operationError();
    const beforeIdentityFingerprint = fingerprintIdentity(snapshot.identity);
    const operationDtos = Object.freeze(operations.map((operation) => Object.freeze({
      op: operation.op,
      pathFingerprint: sha256Text(JSON.stringify(operation.path)),
      valueFingerprint: operation.op === "set"
        ? sha256Text(canonicalJson(operation.value))
        : null,
      valueKind: operation.op === "set" ? jsonValueKind(operation.value) : null,
    })));
    const planId = sha256Text(JSON.stringify([
      LOCAL_CLIENT_CONFIG_PLAN_VERSION,
      this.#targetFingerprint,
      beforeSha256,
      afterSha256,
      beforeIdentityFingerprint,
      operationDtos,
    ]));
    const createdAtMs = this.#observeClock();
    const expiresAtMs = createdAtMs + PLAN_TTL_MS;
    if (!Number.isSafeInteger(expiresAtMs)) throw configurationError();
    const publicPlan: LocalClientConfigPlan = Object.freeze({
      planVersion: LOCAL_CLIENT_CONFIG_PLAN_VERSION,
      planId,
      targetFingerprint: this.#targetFingerprint,
      beforeSha256,
      afterSha256,
      beforeIdentityFingerprint,
      operationCount: operations.length,
      operations: operationDtos,
      createdAtMs,
      expiresAtMs,
      writesPerformed: false,
    });
    this.#plans.set(planId, Object.freeze({
      publicPlan,
      beforeBytes: Buffer.from(snapshot.bytes),
      afterBytes: Buffer.from(afterBytes),
      beforeIdentity: snapshot.identity,
    }));
    return publicPlan;
  }

  async apply(input: Readonly<{ planId: string }>): Promise<LocalClientConfigReceipt> {
    this.#assertOpen();
    assertExactObject(input, ["planId"], new Set(), planError);
    const planId = assertSha256(input.planId, planError);
    const stored = this.#plans.get(planId);
    if (!stored) throw planUnknownError();
    if (this.#observeClock() >= stored.publicPlan.expiresAtMs) throw planExpiredError();
    this.#throwIfRecoveryRequired();

    return this.#withLock(`tx_${sha256Text(`${planId}:${randomBytes(32).toString("hex")}`)}`, async (transactionId) => {
      await this.#reloadJournal();
      this.#throwIfRecoveryRequired();
      await this.#pruneExpiredCommitted(this.#observeClock());
      if (this.#journal.entries.length >= this.#maxTransactions) {
        throw transactionError(
          "LOCAL_CLIENT_CONFIG_JOURNAL_CAPACITY",
          "The bounded local-client configuration journal is full.",
          "capacity",
          429,
        );
      }
      await this.#assertSafeTopology({ requireTarget: true });
      const current = await readBoundTarget(this.#targetPath, this.#allowedRoot, this.#maxBytes);
      if (
        !identityEqual(current.identity, stored.beforeIdentity)
        || !safeSha256Equal(sha256Bytes(current.bytes), stored.publicPlan.beforeSha256)
      ) {
        throw targetChangedError();
      }

      await ensureSafeDirectory(this.#backupDir, this.#allowedRoot);
      const backupFileName = `${transactionId}.backup.json`;
      const backupPath = resolve(this.#backupDir, backupFileName);
      assertInside(this.#backupDir, backupPath);
      const backupSha256 = sha256Bytes(stored.beforeBytes);
      if (!safeSha256Equal(backupSha256, stored.publicPlan.beforeSha256)) throw backupError();
      const backupProtection: BackupProtection = this.#backupEncryptionKey === null
        ? "0600-plaintext"
        : "aes-256-gcm";
      const backupBytes = createBackupFileBytes({
        key: this.#backupEncryptionKey,
        protection: backupProtection,
        plaintext: stored.beforeBytes,
        transactionId,
        targetFingerprint: this.#targetFingerprint,
        beforeSha256: stored.publicPlan.beforeSha256,
        beforeIdentityFingerprint: stored.publicPlan.beforeIdentityFingerprint,
        planId,
      });
      await writeExclusiveFsyncedFile(backupPath, backupBytes, 0o600);
      await syncDirectory(this.#backupDir);

      const entry: JournalEntry = {
        transactionId,
        planId,
        targetFingerprint: this.#targetFingerprint,
        beforeSha256: stored.publicPlan.beforeSha256,
        afterSha256: stored.publicPlan.afterSha256,
        backupSha256,
        backupFileName,
        backupProtection,
        beforeIdentityFingerprint: stored.publicPlan.beforeIdentityFingerprint,
        afterIdentityFingerprint: null,
        targetMode: stored.beforeIdentity.mode,
        status: "pending",
        createdAtMs: 0,
        updatedAtMs: 0,
        committedAtMs: null,
        rolledBackAtMs: null,
        receiptDigest: null,
        rollbackReceiptDigest: null,
      };
      const journalBeforePending = cloneJournal(this.#journal);
      try {
        const nowMs = this.#observeClock();
        entry.createdAtMs = nowMs;
        entry.updatedAtMs = nowMs;
        this.#journal.entries.push(entry);
        this.#journal.sequence += 1;
        await this.#persistJournal();
      } catch (error) {
        let durablyTracked: boolean;
        try {
          durablyTracked = await this.#isPendingEntryDurablyTracked(entry);
        } catch {
          this.#recoveryRequired = true;
          throw cleanupError();
        }
        if (durablyTracked) {
          await this.#reloadJournal();
          this.#recoveryRequired = true;
          if (error instanceof LocalClientConfigTransactionError) throw error;
          throw persistError();
        }
        try {
          await this.#deleteExactBackup(entry, false);
        } catch {
          this.#recoveryRequired = true;
          throw cleanupError();
        }
        this.#journal = journalBeforePending;
        this.#journalCorrupt = false;
        this.#recoveryRequired = false;
        if (error instanceof LocalClientConfigTransactionError) throw error;
        throw persistError();
      }
      this.#recoveryRequired = true;

      try {
        await atomicReplaceFile(
          this.#targetPath,
          stored.afterBytes,
          stored.beforeIdentity.mode,
          this.#allowedRoot,
          transactionId,
        );
        const after = await readBoundTarget(this.#targetPath, this.#allowedRoot, this.#maxBytes);
        if (!safeSha256Equal(sha256Bytes(after.bytes), entry.afterSha256)) throw persistError();
        entry.afterIdentityFingerprint = fingerprintIdentity(after.identity);
        entry.status = "committed";
        entry.committedAtMs = this.#observeClock();
        entry.updatedAtMs = entry.committedAtMs;
        const receipt = buildApplyReceipt(entry);
        entry.receiptDigest = receipt.receiptDigest;
        this.#journal.sequence += 1;
        await this.#persistJournal();
        this.#recoveryRequired = false;
        this.#plans.delete(planId);
        return receipt;
      } catch (error) {
        this.#recoveryRequired = true;
        if (error instanceof LocalClientConfigTransactionError) throw error;
        throw persistError();
      }
    });
  }

  async rollback(input: Readonly<{ receipt: LocalClientConfigReceipt }>): Promise<LocalClientConfigRollbackReceipt> {
    this.#assertOpen();
    assertExactObject(input, ["receipt"], new Set(), receiptError);
    const receipt = cloneAndValidateApplyReceipt(input.receipt);
    this.#throwIfRecoveryRequired();

    return this.#withLock(receipt.transactionId, async () => {
      await this.#reloadJournal();
      this.#throwIfRecoveryRequired();
      const entry = this.#journal.entries.find((candidate) => candidate.transactionId === receipt.transactionId);
      if (!entry || entry.status !== "committed" || !receiptMatchesEntry(receipt, entry)) {
        throw receiptError();
      }
      await this.#assertSafeTopology({ requireTarget: true });
      const current = await readBoundTarget(this.#targetPath, this.#allowedRoot, this.#maxBytes);
      if (
        !safeSha256Equal(sha256Bytes(current.bytes), receipt.afterSha256)
        || fingerprintIdentity(current.identity) !== receipt.afterIdentityFingerprint
      ) {
        throw rollbackConflictError();
      }
      const backup = await this.#readBackup(entry);
      entry.status = "rollback-pending";
      entry.updatedAtMs = this.#observeClock();
      this.#journal.sequence += 1;
      await this.#persistJournal();
      this.#recoveryRequired = true;

      try {
        await atomicReplaceFile(
          this.#targetPath,
          backup,
          entry.targetMode,
          this.#allowedRoot,
          `${entry.transactionId}.rollback`,
        );
        const restored = await readBoundTarget(this.#targetPath, this.#allowedRoot, this.#maxBytes);
        if (!safeSha256Equal(sha256Bytes(restored.bytes), entry.beforeSha256)) throw persistError();
        entry.status = "rolled-back";
        entry.rolledBackAtMs = this.#observeClock();
        entry.updatedAtMs = entry.rolledBackAtMs;
        const rollbackReceipt = buildRollbackReceipt(entry);
        entry.rollbackReceiptDigest = rollbackReceipt.receiptDigest;
        this.#journal.sequence += 1;
        await this.#persistJournal();
        await this.#compactTerminalEntry(entry);
        this.#recoveryRequired = false;
        return rollbackReceipt;
      } catch (error) {
        this.#recoveryRequired = true;
        if (error instanceof LocalClientConfigTransactionError) throw error;
        throw persistError();
      }
    });
  }

  async recover(input: Readonly<{ transactionId: string }>): Promise<LocalClientConfigRecoveryReceipt> {
    this.#assertOpen();
    assertExactObject(input, ["transactionId"], new Set(), recoveryError);
    const transactionId = assertTransactionId(input.transactionId, recoveryError);
    if (this.#journalCorrupt) throw journalCorruptError();

    return this.#withLock(transactionId, async () => {
      await this.#reloadJournal();
      if (this.#journalCorrupt) throw journalCorruptError();
      const entry = this.#journal.entries.find((candidate) => candidate.transactionId === transactionId);
      if (!entry || (entry.status !== "pending" && entry.status !== "rollback-pending")) {
        throw transactionUnknownError();
      }
      await this.#assertSafeTopology({ requireTarget: true });
      await this.#readBackup(entry);
      const current = await readBoundTarget(this.#targetPath, this.#allowedRoot, this.#maxBytes);
      const currentSha256 = sha256Bytes(current.bytes);
      let resolution: LocalClientConfigRecoveryReceipt["resolution"];
      let applyReceipt: LocalClientConfigReceipt | null = null;
      let rollbackReceipt: LocalClientConfigRollbackReceipt | null = null;
      const recoveredAtMs = this.#observeClock();

      if (entry.status === "pending" && safeSha256Equal(currentSha256, entry.beforeSha256)) {
        entry.status = "aborted";
        resolution = "apply-aborted";
      } else if (entry.status === "pending" && safeSha256Equal(currentSha256, entry.afterSha256)) {
        entry.status = "committed";
        entry.afterIdentityFingerprint = fingerprintIdentity(current.identity);
        entry.committedAtMs = recoveredAtMs;
        applyReceipt = buildApplyReceipt(entry);
        entry.receiptDigest = applyReceipt.receiptDigest;
        resolution = "apply-committed";
      } else if (
        entry.status === "rollback-pending"
        && safeSha256Equal(currentSha256, entry.afterSha256)
      ) {
        entry.status = "committed";
        resolution = "rollback-aborted";
        applyReceipt = buildApplyReceipt(entry);
      } else if (
        entry.status === "rollback-pending"
        && safeSha256Equal(currentSha256, entry.beforeSha256)
      ) {
        entry.status = "rolled-back";
        entry.rolledBackAtMs = recoveredAtMs;
        rollbackReceipt = buildRollbackReceipt(entry);
        entry.rollbackReceiptDigest = rollbackReceipt.receiptDigest;
        resolution = "rollback-completed";
      } else {
        throw recoveryAmbiguousError();
      }
      entry.updatedAtMs = recoveredAtMs;
      this.#journal.sequence += 1;
      await this.#persistJournal();
      if (entry.status === "aborted" || entry.status === "rolled-back") {
        await this.#compactTerminalEntry(entry);
      }
      this.#recoveryRequired = this.#journal.entries.some((candidate) => (
        candidate.status === "pending" || candidate.status === "rollback-pending"
      ));
      return Object.freeze({
        recoveryReceiptVersion: LOCAL_CLIENT_CONFIG_RECOVERY_RECEIPT_VERSION,
        transactionId,
        resolution,
        currentSha256,
        recoveredAtMs,
        applyReceipt,
        rollbackReceipt,
      });
    }, true);
  }

  async #initialize(): Promise<void> {
    await assertSafeExistingDirectory(this.#allowedRoot);
    await this.#assertSafeTopology({ requireTarget: true });
    await this.#reloadJournal();
    this.#observeClock();
  }

  #observeClock(): number {
    const nowMs = readClock(this.#clock);
    if (nowMs < this.#journal.lastObservedAtMs) throw clockRollbackError();
    this.#journal.lastObservedAtMs = nowMs;
    return nowMs;
  }

  async #reloadJournal(): Promise<void> {
    this.#journalCorrupt = false;
    try {
      const journalStat = await lstat(this.#journalPath).catch((error: unknown) => {
        if (hasErrorCode(error, "ENOENT")) return null;
        throw error;
      });
      if (!journalStat) {
        this.#journal = createEmptyJournal();
        this.#recoveryRequired = false;
        return;
      }
      if (!journalStat.isFile() || journalStat.isSymbolicLink() || journalStat.size > this.#maxJournalBytes()) {
        throw journalCorruptError();
      }
      const raw = await readFile(this.#journalPath, "utf8");
      this.#journal = parseJournal(raw, this.#maxTransactions);
      if (this.#journal.entries.some((entry) => (
        !safeSha256Equal(entry.targetFingerprint, this.#targetFingerprint)
      ))) {
        throw journalCorruptError();
      }
      this.#recoveryRequired = this.#journal.entries.some((entry) => (
        entry.status === "pending" || entry.status === "rollback-pending"
      ));
    } catch (error) {
      this.#journal = createEmptyJournal();
      this.#journalCorrupt = true;
      this.#recoveryRequired = true;
      if (error instanceof LocalClientConfigTransactionError) return;
      return;
    }
  }

  async #persistJournal(): Promise<void> {
    await ensureSafeDirectory(dirname(this.#journalPath), this.#allowedRoot);
    await assertNoSymlinkAt(this.#journalPath, false);
    const bytes = Buffer.from(`${JSON.stringify(this.#journal, null, 2)}\n`, "utf8");
    if (bytes.byteLength > this.#maxJournalBytes()) throw journalCapacityError();
    await atomicReplaceFile(
      this.#journalPath,
      bytes,
      0o600,
      this.#allowedRoot,
      `journal.${this.#journal.sequence}`,
      false,
    );
    await chmod(this.#journalPath, 0o600).catch(() => undefined);
  }

  async #isPendingEntryDurablyTracked(entry: JournalEntry): Promise<boolean> {
    const stat = await lstat(this.#journalPath).catch((error: unknown) => {
      if (hasErrorCode(error, "ENOENT")) return null;
      throw cleanupError();
    });
    if (!stat) return false;
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > this.#maxJournalBytes()) {
      throw cleanupError();
    }
    let persisted: Journal;
    try {
      persisted = parseJournal(await readFile(this.#journalPath, "utf8"), this.#maxTransactions);
    } catch {
      throw cleanupError();
    }
    const candidate = persisted.entries.find((item) => item.transactionId === entry.transactionId);
    if (!candidate) return false;
    if (
      candidate.status !== "pending"
      || candidate.backupFileName !== entry.backupFileName
      || !safeSha256Equal(candidate.backupSha256, entry.backupSha256)
      || !safeSha256Equal(candidate.beforeIdentityFingerprint, entry.beforeIdentityFingerprint)
    ) throw cleanupError();
    return true;
  }

  async #readBackup(entry: JournalEntry): Promise<Buffer> {
    return (await this.#readBackupSnapshot(entry, true)).plaintext;
  }

  async #readBackupSnapshot(
    entry: JournalEntry,
    requireFullTopology: boolean,
  ): Promise<Readonly<{ plaintext: Buffer; identity: FileIdentity; path: string }>> {
    if (!BACKUP_FILE_PATTERN.test(entry.backupFileName)) throw backupError();
    const backupPath = resolve(this.#backupDir, entry.backupFileName);
    assertInside(this.#backupDir, backupPath);
    if (requireFullTopology) {
      await this.#assertSafeTopology({ requireTarget: true });
    } else {
      await assertSafeExistingDirectory(this.#allowedRoot);
      await assertNoSymlinkComponents(this.#allowedRoot, this.#backupDir, true);
      await assertNoSymlinkComponents(this.#backupDir, backupPath, true);
    }
    let backup: Readonly<{ bytes: Buffer; identity: FileIdentity }>;
    try {
      backup = await readBoundFile(backupPath, this.#backupDir, maxBackupFileBytes(this.#maxBytes));
    } catch {
      throw backupError();
    }
    const plaintext = decodeBackupFileBytes({
      key: this.#backupEncryptionKey,
      protection: entry.backupProtection,
      fileBytes: backup.bytes,
      maxPlaintextBytes: this.#maxBytes,
      transactionId: entry.transactionId,
      targetFingerprint: entry.targetFingerprint,
      beforeSha256: entry.beforeSha256,
      beforeIdentityFingerprint: entry.beforeIdentityFingerprint,
      planId: entry.planId,
    });
    if (
      !safeSha256Equal(sha256Bytes(plaintext), entry.backupSha256)
      || !safeSha256Equal(entry.backupSha256, entry.beforeSha256)
    ) {
      throw backupError();
    }
    return Object.freeze({ plaintext, identity: backup.identity, path: backupPath });
  }

  async #deleteExactBackup(entry: JournalEntry, allowMissing: boolean): Promise<void> {
    let snapshot: Readonly<{ plaintext: Buffer; identity: FileIdentity; path: string }>;
    try {
      snapshot = await this.#readBackupSnapshot(entry, false);
    } catch (error) {
      if (allowMissing && await pathMissing(resolve(this.#backupDir, entry.backupFileName))) return;
      if (error instanceof LocalClientConfigTransactionError) throw cleanupError();
      throw cleanupError();
    }
    const current = await lstat(snapshot.path).catch(() => {
      throw cleanupError();
    });
    if (
      !current.isFile()
      || current.isSymbolicLink()
      || !identityEqual(snapshot.identity, identityFromStat(current))
    ) throw cleanupError();
    await unlink(snapshot.path).catch(() => {
      throw cleanupError();
    });
    await syncDirectory(this.#backupDir).catch(() => {
      throw cleanupError();
    });
  }

  async #compactTerminalEntry(entry: JournalEntry): Promise<void> {
    if (entry.status !== "aborted" && entry.status !== "rolled-back" && entry.status !== "expired") {
      throw cleanupError();
    }
    await this.#deleteExactBackup(entry, false);
    const index = this.#journal.entries.findIndex((candidate) => (
      candidate.transactionId === entry.transactionId && candidate.status === entry.status
    ));
    if (index < 0) throw cleanupError();
    this.#journal.entries.splice(index, 1);
    this.#journal.sequence += 1;
    this.#observeClock();
    try {
      await this.#persistJournal();
    } catch {
      throw cleanupError();
    }
  }

  async #pruneExpiredCommitted(nowMs: number): Promise<void> {
    const terminal = this.#journal.entries.filter((entry) => (
      entry.status === "aborted" || entry.status === "rolled-back" || entry.status === "expired"
    ));
    for (const entry of terminal) {
      await this.#deleteExactBackup(entry, true);
      this.#journal.entries = this.#journal.entries.filter((candidate) => (
        candidate.transactionId !== entry.transactionId
      ));
    }
    if (terminal.length > 0) {
      this.#journal.sequence += 1;
      this.#observeClock();
      await this.#persistJournal().catch(() => {
        throw cleanupError();
      });
    }

    const expired = this.#journal.entries.filter((entry) => (
      entry.status === "committed"
      && entry.committedAtMs !== null
      && entry.committedAtMs + this.#committedRetentionMs <= nowMs
    ));
    if (expired.length === 0) return;
    for (const entry of expired) {
      entry.status = "expired";
      entry.updatedAtMs = nowMs;
    }
    this.#journal.sequence += 1;
    await this.#persistJournal().catch(() => {
      throw cleanupError();
    });
    for (const entry of expired) await this.#deleteExactBackup(entry, false);
    const expiredIds = new Set(expired.map((entry) => entry.transactionId));
    this.#journal.entries = this.#journal.entries.filter((entry) => !expiredIds.has(entry.transactionId));
    this.#journal.sequence += 1;
    await this.#persistJournal().catch(() => {
      throw cleanupError();
    });
  }

  async #assertSafeTopology(options: Readonly<{ requireTarget: boolean }>): Promise<void> {
    await assertSafeExistingDirectory(this.#allowedRoot);
    await assertNoSymlinkComponents(this.#allowedRoot, this.#targetPath, options.requireTarget);
    await assertNoSymlinkComponents(this.#allowedRoot, this.#backupDir, false);
    await assertNoSymlinkComponents(this.#allowedRoot, this.#journalPath, false);
    await assertNoSymlinkComponents(this.#allowedRoot, this.#lockPath, false);
  }

  #throwIfRecoveryRequired(): void {
    if (this.#journalCorrupt) throw journalCorruptError();
    if (this.#recoveryRequired) throw recoveryRequiredError();
  }

  #maxJournalBytes(): number {
    return Math.min(HARD_MAX_BYTES, Math.max(16_384, this.#maxTransactions * 2_048));
  }

  async #withLock<T>(
    transactionId: string,
    action: (transactionId: string) => Promise<T>,
    recovery = false,
  ): Promise<T> {
    const lock = await this.#acquireLock(transactionId, recovery);
    try {
      return await action(transactionId);
    } finally {
      await lock.close().catch(() => undefined);
      await unlink(this.#lockPath).catch(() => undefined);
      await syncDirectory(dirname(this.#lockPath));
    }
  }

  async #acquireLock(transactionId: string, recovery: boolean) {
    await ensureSafeDirectory(dirname(this.#lockPath), this.#allowedRoot);
    await this.#assertSafeTopology({ requireTarget: true });
    const attempt = async () => {
      const handle = await open(this.#lockPath, "wx", 0o600);
      try {
        const record: LockRecord = Object.freeze({
          lockVersion: LOCK_VERSION,
          transactionId,
          token: randomBytes(32).toString("hex"),
          pid: process.pid,
          createdAtMs: this.#observeClock(),
        });
        await handle.writeFile(`${JSON.stringify(record)}\n`, "utf8");
        await handle.sync();
        await chmod(this.#lockPath, 0o600).catch(() => undefined);
        await syncDirectory(dirname(this.#lockPath));
        return handle;
      } catch {
        await handle.close().catch(() => undefined);
        await unlink(this.#lockPath).catch(() => undefined);
        throw persistError();
      }
    };
    try {
      return await attempt();
    } catch (error) {
      if (error instanceof LocalClientConfigTransactionError) throw error;
      if (!hasErrorCode(error, "EEXIST")) throw persistError();
      await this.#removeProvablyAbandonedLock(transactionId, recovery);
      try {
        return await attempt();
      } catch (retryError) {
        if (retryError instanceof LocalClientConfigTransactionError) throw retryError;
        throw lockedError();
      }
    }
  }

  async #removeProvablyAbandonedLock(transactionId: string, recovery: boolean): Promise<void> {
    let record: unknown;
    try {
      const stat = await lstat(this.#lockPath);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4_096) throw lockedError();
      record = JSON.parse(await readFile(this.#lockPath, "utf8"));
    } catch {
      throw lockedError();
    }
    if (
      !hasExactKeys(record, ["lockVersion", "transactionId", "token", "pid", "createdAtMs"])
      || record.lockVersion !== LOCK_VERSION
      || typeof record.transactionId !== "string"
      || !TRANSACTION_ID_PATTERN.test(record.transactionId)
      || typeof record.token !== "string"
      || !SHA256_PATTERN.test(record.token)
      || !Number.isSafeInteger(record.pid)
      || Number(record.pid) < 1
      || !Number.isSafeInteger(record.createdAtMs)
      || processAppearsAlive(Number(record.pid))
    ) {
      throw lockedError();
    }
    await this.#reloadJournal();
    if (this.#journalCorrupt) throw journalCorruptError();
    const lockedEntry = this.#journal.entries.find((entry) => entry.transactionId === record.transactionId);
    const lockedEntryPending = lockedEntry?.status === "pending" || lockedEntry?.status === "rollback-pending";
    if (lockedEntryPending && (!recovery || record.transactionId !== transactionId)) {
      throw recoveryRequiredError();
    }
    await unlink(this.#lockPath);
    await syncDirectory(dirname(this.#lockPath));
  }

  #assertOpen(): void {
    if (this.#closed) throw configurationError();
  }
}

export async function createLocalClientConfigTransactionEngine(
  options: LocalClientConfigTransactionOptions,
): Promise<LocalClientConfigTransactionEngine> {
  return LocalClientConfigTransactionEngine.open(options);
}

function createEmptyJournal(): Journal {
  return {
    journalVersion: LOCAL_CLIENT_CONFIG_JOURNAL_VERSION,
    sequence: 0,
    lastObservedAtMs: 0,
    entries: [],
  };
}

function cloneJournal(journal: Journal): Journal {
  return {
    journalVersion: LOCAL_CLIENT_CONFIG_JOURNAL_VERSION,
    sequence: journal.sequence,
    lastObservedAtMs: journal.lastObservedAtMs,
    entries: journal.entries.map((entry) => ({ ...entry })),
  };
}

type BackupCipherContext = Readonly<{
  transactionId: string;
  targetFingerprint: string;
  beforeSha256: string;
  beforeIdentityFingerprint: string;
  planId: string;
}>;

type BackupEnvelope = Readonly<{
  backupVersion: typeof LOCAL_CLIENT_CONFIG_BACKUP_ENVELOPE_VERSION;
  algorithm: "aes-256-gcm";
  nonce: string;
  tag: string;
  ciphertext: string;
}>;

function createBackupFileBytes(input: BackupCipherContext & Readonly<{
  key: Buffer | null;
  protection: BackupProtection;
  plaintext: Buffer;
}>): Buffer {
  if (input.protection === "0600-plaintext") {
    if (input.key !== null) throw backupError();
    return Buffer.from(input.plaintext);
  }
  if (input.key === null || input.key.byteLength !== 32) throw backupError();
  const nonce = randomBytes(12);
  try {
    const cipher = createCipheriv("aes-256-gcm", input.key, nonce);
    cipher.setAAD(createBackupAad(input));
    const ciphertext = Buffer.concat([cipher.update(input.plaintext), cipher.final()]);
    const envelope: BackupEnvelope = Object.freeze({
      backupVersion: LOCAL_CLIENT_CONFIG_BACKUP_ENVELOPE_VERSION,
      algorithm: "aes-256-gcm",
      nonce: nonce.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    });
    return Buffer.from(`${JSON.stringify(envelope)}\n`, "utf8");
  } catch (error) {
    if (error instanceof LocalClientConfigTransactionError) throw error;
    throw backupError();
  }
}

function decodeBackupFileBytes(input: BackupCipherContext & Readonly<{
  key: Buffer | null;
  protection: BackupProtection;
  fileBytes: Buffer;
  maxPlaintextBytes: number;
}>): Buffer {
  if (input.protection === "0600-plaintext") {
    if (input.fileBytes.byteLength < 1 || input.fileBytes.byteLength > input.maxPlaintextBytes) {
      throw backupError();
    }
    return Buffer.from(input.fileBytes);
  }
  if (input.key === null || input.key.byteLength !== 32) throw backupError();
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.fileBytes.toString("utf8"));
  } catch {
    throw backupError();
  }
  if (!hasExactKeys(parsed, ["backupVersion", "algorithm", "nonce", "tag", "ciphertext"])) {
    throw backupError();
  }
  if (
    parsed.backupVersion !== LOCAL_CLIENT_CONFIG_BACKUP_ENVELOPE_VERSION
    || parsed.algorithm !== "aes-256-gcm"
    || !isCanonicalBase64(parsed.nonce)
    || !isCanonicalBase64(parsed.tag)
    || !isCanonicalBase64(parsed.ciphertext)
  ) throw backupError();
  const envelope: BackupEnvelope = {
    backupVersion: LOCAL_CLIENT_CONFIG_BACKUP_ENVELOPE_VERSION,
    algorithm: "aes-256-gcm",
    nonce: parsed.nonce,
    tag: parsed.tag,
    ciphertext: parsed.ciphertext,
  };
  if (input.fileBytes.toString("utf8") !== `${JSON.stringify(envelope)}\n`) throw backupError();
  const nonce = Buffer.from(envelope.nonce, "base64");
  const tag = Buffer.from(envelope.tag, "base64");
  const ciphertext = Buffer.from(envelope.ciphertext, "base64");
  if (
    nonce.byteLength !== 12
    || tag.byteLength !== 16
    || ciphertext.byteLength < 1
    || ciphertext.byteLength > input.maxPlaintextBytes
  ) throw backupError();
  try {
    const decipher = createDecipheriv("aes-256-gcm", input.key, nonce);
    decipher.setAAD(createBackupAad(input));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    if (plaintext.byteLength < 1 || plaintext.byteLength > input.maxPlaintextBytes) throw backupError();
    if (!safeSha256Equal(sha256Bytes(plaintext), input.beforeSha256)) throw backupError();
    return plaintext;
  } catch (error) {
    if (error instanceof LocalClientConfigTransactionError) throw error;
    throw backupError();
  }
}

function createBackupAad(input: BackupCipherContext): Buffer {
  return Buffer.from(canonicalJson({
    backupVersion: LOCAL_CLIENT_CONFIG_BACKUP_ENVELOPE_VERSION,
    transactionId: input.transactionId,
    targetFingerprint: input.targetFingerprint,
    beforeSha256: input.beforeSha256,
    beforeIdentityFingerprint: input.beforeIdentityFingerprint,
    planId: input.planId,
  }), "utf8");
}

function isCanonicalBase64(value: unknown): value is string {
  if (
    typeof value !== "string"
    || value.length < 4
    || value.length > maxBackupFileBytes(HARD_MAX_BYTES) * 2
    || !CANONICAL_BASE64_PATTERN.test(value)
  ) return false;
  try {
    return Buffer.from(value, "base64").toString("base64") === value;
  } catch {
    return false;
  }
}

function maxBackupFileBytes(maxPlaintextBytes: number): number {
  return Math.ceil(maxPlaintextBytes * 4 / 3) + 4_096;
}

function normalizeOperations(
  raw: readonly LocalClientConfigOperation[],
  maxBytes: number,
): readonly LocalClientConfigOperation[] {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_OPERATIONS) throw operationError();
  const operations = raw.map((candidate) => {
    if (!isPlainRecord(candidate) || (candidate.op !== "set" && candidate.op !== "delete")) {
      throw operationError();
    }
    const path = normalizeKeyPath(candidate.path);
    if (candidate.op === "delete") {
      assertExactObject(candidate, ["op", "path"], new Set(), operationError);
      return Object.freeze({ op: "delete" as const, path });
    }
    assertExactObject(candidate, ["op", "path", "value"], new Set(), operationError);
    const counter = { nodes: 0, bytes: 0 };
    const value = cloneAndValidateJson(candidate.value, 0, counter, maxBytes);
    return Object.freeze({ op: "set" as const, path, value });
  });
  for (let leftIndex = 0; leftIndex < operations.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < operations.length; rightIndex += 1) {
      if (pathsOverlap(operations[leftIndex]!.path, operations[rightIndex]!.path)) throw operationError();
    }
  }
  return Object.freeze(operations);
}

function normalizeKeyPath(raw: unknown): readonly string[] {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_PATH_DEPTH) throw operationError();
  const keys = raw.map((value) => {
    if (
      typeof value !== "string"
      || value.length < 1
      || value.length > MAX_KEY_LENGTH
      || value !== value.trim()
      || /[\u0000-\u001f\u007f]/u.test(value)
      || value === "."
      || value === ".."
      || /[\\/]/u.test(value)
      || FORBIDDEN_KEYS.has(value)
    ) {
      throw operationError();
    }
    return value;
  });
  return Object.freeze(keys);
}

function pathsOverlap(left: readonly string[], right: readonly string[]): boolean {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function parsePlainJsonObject(bytes: Buffer, maxBytes: number): Record<string, LocalClientConfigJsonValue> {
  if (bytes.byteLength < 2 || bytes.byteLength > maxBytes) throw tooLargeError();
  let parsed: unknown;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    parsed = JSON.parse(text);
  } catch {
    throw jsonError();
  }
  if (!isPlainRecord(parsed)) throw jsonError();
  const counter = { nodes: 0, bytes: 0 };
  const cloned = cloneAndValidateJson(parsed, 0, counter, maxBytes);
  if (!isPlainRecord(cloned)) throw jsonError();
  return cloned as Record<string, LocalClientConfigJsonValue>;
}

function cloneAndValidateJson(
  value: unknown,
  depth: number,
  counter: { nodes: number; bytes: number },
  maxBytes: number,
): LocalClientConfigJsonValue {
  counter.nodes += 1;
  if (counter.nodes > MAX_JSON_NODES || depth > MAX_JSON_DEPTH) throw jsonError();
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw jsonError();
    return value;
  }
  if (typeof value === "string") {
    counter.bytes += Buffer.byteLength(value, "utf8");
    if (counter.bytes > maxBytes) throw tooLargeError();
    return value;
  }
  if (Array.isArray(value)) {
    const enumerableKeys = Object.keys(value);
    if (
      enumerableKeys.length !== value.length
      || enumerableKeys.some((key, index) => key !== String(index))
    ) {
      throw jsonError();
    }
    return value.map((item) => cloneAndValidateJson(item, depth + 1, counter, maxBytes));
  }
  if (!isPlainRecord(value)) throw jsonError();
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== "string")) throw jsonError();
  const output: Record<string, LocalClientConfigJsonValue> = Object.create(null);
  for (const key of ownKeys as string[]) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || descriptor.get || descriptor.set || descriptor.enumerable !== true) throw jsonError();
    if (
      key.length < 1
      || key.length > MAX_KEY_LENGTH
      || /[\u0000-\u001f\u007f]/u.test(key)
      || FORBIDDEN_KEYS.has(key)
    ) {
      throw jsonError();
    }
    counter.bytes += Buffer.byteLength(key, "utf8");
    if (counter.bytes > maxBytes) throw tooLargeError();
    output[key] = cloneAndValidateJson(value[key], depth + 1, counter, maxBytes);
  }
  return output;
}

function applyOperations(
  root: Record<string, LocalClientConfigJsonValue>,
  operations: readonly LocalClientConfigOperation[],
): Record<string, LocalClientConfigJsonValue> {
  const output = cloneAndValidateJson(root, 0, { nodes: 0, bytes: 0 }, HARD_MAX_BYTES);
  if (!isPlainRecord(output)) throw jsonError();
  for (const operation of operations) {
    let parent = output as Record<string, LocalClientConfigJsonValue>;
    for (let index = 0; index < operation.path.length - 1; index += 1) {
      const key = operation.path[index]!;
      const current = parent[key];
      if (current === undefined) {
        if (operation.op === "delete") throw operationError();
        const created: Record<string, LocalClientConfigJsonValue> = Object.create(null);
        parent[key] = created;
        parent = created;
        continue;
      }
      if (!isPlainRecord(current)) throw operationError();
      parent = current as Record<string, LocalClientConfigJsonValue>;
    }
    const leaf = operation.path.at(-1)!;
    if (operation.op === "delete") {
      if (!Object.hasOwn(parent, leaf)) throw operationError();
      delete parent[leaf];
    } else {
      parent[leaf] = cloneAndValidateJson(operation.value, 0, { nodes: 0, bytes: 0 }, HARD_MAX_BYTES);
    }
  }
  return output as Record<string, LocalClientConfigJsonValue>;
}

function serializeLikeOriginal(
  value: Record<string, LocalClientConfigJsonValue>,
  original: Buffer,
): Buffer {
  const raw = original.toString("utf8");
  const newline = raw.includes("\r\n") ? "\r\n" : "\n";
  const indentationMatch = /(?:\r?\n)([ \t]+)"/u.exec(raw);
  const indentation = indentationMatch?.[1]?.slice(0, 10) ?? "";
  const trailingNewline = /\r?\n$/u.test(raw);
  let serialized = JSON.stringify(value, null, indentation || undefined);
  if (newline === "\r\n") serialized = serialized.replace(/\n/gu, "\r\n");
  if (trailingNewline) serialized += newline;
  return Buffer.from(serialized, "utf8");
}

function jsonValueKind(value: LocalClientConfigJsonValue): Exclude<LocalClientConfigPlan["operations"][number]["valueKind"], null> {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  return "boolean";
}

function canonicalJson(value: LocalClientConfigJsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(value[key]!)}`
  )).join(",")}}`;
}

async function readBoundTarget(
  targetPath: string,
  allowedRoot: string,
  maxBytes: number,
): Promise<Readonly<{ bytes: Buffer; identity: FileIdentity }>> {
  return readBoundFile(targetPath, allowedRoot, maxBytes);
}

async function readBoundFile(
  filePath: string,
  allowedRoot: string,
  maxBytes: number,
): Promise<Readonly<{ bytes: Buffer; identity: FileIdentity }>> {
  assertInside(allowedRoot, filePath);
  await assertNoSymlinkComponents(allowedRoot, filePath, true);
  const resolvedPath = await realpath(filePath).catch(() => {
    throw targetError();
  });
  const resolvedRoot = await realpath(allowedRoot).catch(() => {
    throw pathError();
  });
  assertInside(resolvedRoot, resolvedPath);
  const readFlags = platform() === "win32" || typeof fileConstants.O_NOFOLLOW !== "number"
    ? fileConstants.O_RDONLY
    : fileConstants.O_RDONLY | fileConstants.O_NOFOLLOW;
  const handle = await open(filePath, readFlags).catch(() => {
    throw targetError();
  });
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.isSymbolicLink() || before.size < 1 || before.size > maxBytes) {
      throw before.size > maxBytes ? tooLargeError() : targetError();
    }
    const beforeIdentity = identityFromStat(before);
    const bytes = await handle.readFile();
    const after = await handle.stat();
    const afterIdentity = identityFromStat(after);
    if (!identityEqual(beforeIdentity, afterIdentity) || bytes.byteLength !== beforeIdentity.size) {
      throw targetChangedError();
    }
    return Object.freeze({ bytes: Buffer.from(bytes), identity: beforeIdentity });
  } finally {
    await handle.close();
  }
}

async function writeExclusiveFsyncedFile(filePath: string, bytes: Buffer, mode: number): Promise<string> {
  const handle = await open(filePath, "wx", mode).catch(() => {
    throw backupError();
  });
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } catch {
    throw backupError();
  } finally {
    await handle.close();
  }
  await chmod(filePath, mode).catch(() => undefined);
  return sha256Bytes(bytes);
}

async function atomicReplaceFile(
  targetPath: string,
  bytes: Buffer,
  mode: number,
  allowedRoot: string,
  token: string,
  requireExisting = true,
): Promise<void> {
  assertInside(allowedRoot, targetPath);
  const parent = dirname(targetPath);
  await ensureSafeDirectory(parent, allowedRoot);
  await assertNoSymlinkAt(targetPath, requireExisting);
  const safeToken = token.replace(/[^a-zA-Z0-9._-]/gu, "_").slice(0, 160);
  const temporaryPath = resolve(parent, `.${basename(targetPath)}.${safeToken}.${randomBytes(8).toString("hex")}.tmp`);
  assertInside(parent, temporaryPath);
  let temporaryCreated = false;
  try {
    const handle = await open(temporaryPath, "wx", 0o600);
    temporaryCreated = true;
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await chmod(temporaryPath, mode & 0o777).catch(() => undefined);
    await assertNoSymlinkComponents(allowedRoot, parent, true);
    await assertNoSymlinkAt(targetPath, requireExisting);
    await rename(temporaryPath, targetPath);
    temporaryCreated = false;
    await chmod(targetPath, mode & 0o777).catch(() => undefined);
    await syncDirectory(parent);
  } catch (error) {
    if (temporaryCreated) await unlink(temporaryPath).catch(() => undefined);
    if (error instanceof LocalClientConfigTransactionError) throw error;
    throw persistError();
  }
}

async function ensureSafeDirectory(directoryPath: string, allowedRoot: string): Promise<void> {
  assertInside(allowedRoot, directoryPath);
  try {
    await assertNoSymlinkComponents(allowedRoot, directoryPath, false);
    await mkdir(directoryPath, { recursive: true, mode: 0o700 });
    await chmod(directoryPath, 0o700).catch(() => undefined);
    await assertSafeExistingDirectory(directoryPath);
    const realRoot = await realpath(allowedRoot);
    const realDirectory = await realpath(directoryPath);
    assertInside(realRoot, realDirectory);
  } catch (error) {
    if (error instanceof LocalClientConfigTransactionError) throw error;
    throw persistError();
  }
}

async function assertSafeExistingDirectory(directoryPath: string): Promise<void> {
  const stat = await lstat(directoryPath).catch(() => {
    throw pathError();
  });
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw pathError();
}

async function assertNoSymlinkComponents(
  allowedRoot: string,
  candidatePath: string,
  requireLeaf: boolean,
): Promise<void> {
  assertInside(allowedRoot, candidatePath);
  await assertSafeExistingDirectory(allowedRoot);
  const relativePath = relative(allowedRoot, candidatePath);
  if (!relativePath) return;
  const segments = relativePath.split(/[\\/]+/u).filter(Boolean);
  let current = allowedRoot;
  for (let index = 0; index < segments.length; index += 1) {
    current = resolve(current, segments[index]!);
    const isLeaf = index === segments.length - 1;
    let stat;
    try {
      stat = await lstat(current);
    } catch (error) {
      if (hasErrorCode(error, "ENOENT") && (!requireLeaf || !isLeaf)) return;
      if (hasErrorCode(error, "ENOENT") && isLeaf && !requireLeaf) return;
      throw pathError();
    }
    if (stat.isSymbolicLink()) throw pathError();
    if (!isLeaf && !stat.isDirectory()) throw pathError();
  }
}

async function assertNoSymlinkAt(filePath: string, required: boolean): Promise<void> {
  try {
    const stat = await lstat(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw pathError();
  } catch (error) {
    if (!required && hasErrorCode(error, "ENOENT")) return;
    if (error instanceof LocalClientConfigTransactionError) throw error;
    throw pathError();
  }
}

async function syncDirectory(directoryPath: string): Promise<void> {
  let handle;
  try {
    handle = await open(directoryPath, "r");
    await handle.sync();
  } catch (error) {
    if (
      platform() === "win32"
      && (hasErrorCode(error, "EPERM") || hasErrorCode(error, "EACCES") || hasErrorCode(error, "EISDIR"))
    ) {
      return;
    }
    throw persistError();
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

function identityFromStat(stat: Readonly<{
  dev: number | bigint;
  ino: number | bigint;
  size: number | bigint;
  mtimeMs: number;
  mode: number;
}>): FileIdentity {
  const size = Number(stat.size);
  if (!Number.isSafeInteger(size) || size < 0 || !Number.isFinite(stat.mtimeMs)) throw targetError();
  return Object.freeze({
    dev: String(stat.dev),
    ino: String(stat.ino),
    size,
    mtimeMs: stat.mtimeMs,
    mode: stat.mode & 0o777,
  });
}

function identityEqual(left: FileIdentity, right: FileIdentity): boolean {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.size === right.size
    && left.mtimeMs === right.mtimeMs;
}

function fingerprintIdentity(identity: FileIdentity): string {
  return sha256Text(JSON.stringify([
    identity.dev,
    identity.ino,
    identity.size,
    identity.mtimeMs,
  ]));
}

function parseJournal(raw: string, maxTransactions: number): Journal {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw journalCorruptError();
  }
  if (
    !hasExactKeys(parsed, ["journalVersion", "sequence", "lastObservedAtMs", "entries"])
    || parsed.journalVersion !== LOCAL_CLIENT_CONFIG_JOURNAL_VERSION
    || !Number.isSafeInteger(parsed.sequence)
    || Number(parsed.sequence) < 0
    || !Number.isSafeInteger(parsed.lastObservedAtMs)
    || Number(parsed.lastObservedAtMs) < 0
    || !Array.isArray(parsed.entries)
    || parsed.entries.length > maxTransactions
  ) {
    throw journalCorruptError();
  }
  const seen = new Set<string>();
  const entries = parsed.entries.map((value) => normalizeJournalEntry(value));
  for (const entry of entries) {
    if (seen.has(entry.transactionId)) throw journalCorruptError();
    seen.add(entry.transactionId);
  }
  return {
    journalVersion: LOCAL_CLIENT_CONFIG_JOURNAL_VERSION,
    sequence: Number(parsed.sequence),
    lastObservedAtMs: Number(parsed.lastObservedAtMs),
    entries,
  };
}

function normalizeJournalEntry(value: unknown): JournalEntry {
  const keys = [
    "transactionId",
    "planId",
    "targetFingerprint",
    "beforeSha256",
    "afterSha256",
    "backupSha256",
    "backupFileName",
    "backupProtection",
    "beforeIdentityFingerprint",
    "afterIdentityFingerprint",
    "targetMode",
    "status",
    "createdAtMs",
    "updatedAtMs",
    "committedAtMs",
    "rolledBackAtMs",
    "receiptDigest",
    "rollbackReceiptDigest",
  ];
  if (!hasExactKeys(value, keys)) throw journalCorruptError();
  const transactionId = assertTransactionId(value.transactionId, journalCorruptError);
  const status = value.status as JournalEntryStatus;
  if (
    !SAFE_STATUS.has(status)
    || !BACKUP_FILE_PATTERN.test(String(value.backupFileName ?? ""))
    || value.backupFileName !== `${transactionId}.backup.json`
    || (value.backupProtection !== "aes-256-gcm" && value.backupProtection !== "0600-plaintext")
    || !Number.isSafeInteger(value.targetMode)
    || Number(value.targetMode) < 0
    || Number(value.targetMode) > 0o7777
  ) {
    throw journalCorruptError();
  }
  const timestamps = [value.createdAtMs, value.updatedAtMs]
    .map((candidate) => assertNonNegativeInteger(candidate, journalCorruptError));
  const nullableInteger = (candidate: unknown) => (
    candidate === null ? null : assertNonNegativeInteger(candidate, journalCorruptError)
  );
  const nullableSha = (candidate: unknown) => (
    candidate === null ? null : assertSha256(candidate, journalCorruptError)
  );
  const entry: JournalEntry = {
    transactionId,
    planId: assertSha256(value.planId, journalCorruptError),
    targetFingerprint: assertSha256(value.targetFingerprint, journalCorruptError),
    beforeSha256: assertSha256(value.beforeSha256, journalCorruptError),
    afterSha256: assertSha256(value.afterSha256, journalCorruptError),
    backupSha256: assertSha256(value.backupSha256, journalCorruptError),
    backupFileName: String(value.backupFileName),
    backupProtection: value.backupProtection as BackupProtection,
    beforeIdentityFingerprint: assertSha256(value.beforeIdentityFingerprint, journalCorruptError),
    afterIdentityFingerprint: nullableSha(value.afterIdentityFingerprint),
    targetMode: Number(value.targetMode),
    status,
    createdAtMs: timestamps[0]!,
    updatedAtMs: timestamps[1]!,
    committedAtMs: nullableInteger(value.committedAtMs),
    rolledBackAtMs: nullableInteger(value.rolledBackAtMs),
    receiptDigest: nullableSha(value.receiptDigest),
    rollbackReceiptDigest: nullableSha(value.rollbackReceiptDigest),
  };
  if (
    (status === "pending" && (
      entry.afterIdentityFingerprint !== null
      || entry.committedAtMs !== null
      || entry.receiptDigest !== null
      || entry.rolledBackAtMs !== null
      || entry.rollbackReceiptDigest !== null
    ))
    || (status === "aborted" && entry.committedAtMs !== null)
    || ((status === "committed" || status === "rollback-pending" || status === "rolled-back" || status === "expired") && (
      entry.afterIdentityFingerprint === null
      || entry.committedAtMs === null
      || entry.receiptDigest === null
    ))
    || (status === "rolled-back" && (
      entry.rolledBackAtMs === null || entry.rollbackReceiptDigest === null
    ))
    || (status !== "rolled-back" && (
      entry.rolledBackAtMs !== null || entry.rollbackReceiptDigest !== null
    ))
  ) {
    throw journalCorruptError();
  }
  if (
    (status === "committed" || status === "rollback-pending" || status === "rolled-back" || status === "expired")
    && !safeSha256Equal(entry.receiptDigest, buildApplyReceipt(entry).receiptDigest)
  ) {
    throw journalCorruptError();
  }
  if (
    status === "rolled-back"
    && !safeSha256Equal(entry.rollbackReceiptDigest, buildRollbackReceipt(entry).receiptDigest)
  ) {
    throw journalCorruptError();
  }
  return entry;
}

function buildApplyReceipt(entry: JournalEntry): LocalClientConfigReceipt {
  if (
    entry.afterIdentityFingerprint === null
    || entry.committedAtMs === null
  ) {
    throw journalCorruptError();
  }
  const unsigned = {
    receiptVersion: LOCAL_CLIENT_CONFIG_RECEIPT_VERSION,
    transactionId: entry.transactionId,
    planId: entry.planId,
    targetFingerprint: entry.targetFingerprint,
    beforeSha256: entry.beforeSha256,
    afterSha256: entry.afterSha256,
    backupSha256: entry.backupSha256,
    afterIdentityFingerprint: entry.afterIdentityFingerprint,
    committedAtMs: entry.committedAtMs,
  } as const;
  return Object.freeze({
    ...unsigned,
    receiptDigest: sha256Text(canonicalReceipt(unsigned)),
  });
}

function cloneAndValidateApplyReceipt(value: LocalClientConfigReceipt): LocalClientConfigReceipt {
  assertExactObject(value, [
    "receiptVersion",
    "transactionId",
    "planId",
    "targetFingerprint",
    "beforeSha256",
    "afterSha256",
    "backupSha256",
    "afterIdentityFingerprint",
    "committedAtMs",
    "receiptDigest",
  ], new Set(), receiptError);
  if (value.receiptVersion !== LOCAL_CLIENT_CONFIG_RECEIPT_VERSION) throw receiptError();
  const receipt = Object.freeze({
    receiptVersion: LOCAL_CLIENT_CONFIG_RECEIPT_VERSION,
    transactionId: assertTransactionId(value.transactionId, receiptError),
    planId: assertSha256(value.planId, receiptError),
    targetFingerprint: assertSha256(value.targetFingerprint, receiptError),
    beforeSha256: assertSha256(value.beforeSha256, receiptError),
    afterSha256: assertSha256(value.afterSha256, receiptError),
    backupSha256: assertSha256(value.backupSha256, receiptError),
    afterIdentityFingerprint: assertSha256(value.afterIdentityFingerprint, receiptError),
    committedAtMs: assertNonNegativeInteger(value.committedAtMs, receiptError),
    receiptDigest: assertSha256(value.receiptDigest, receiptError),
  });
  const expected = sha256Text(canonicalReceipt({
    receiptVersion: receipt.receiptVersion,
    transactionId: receipt.transactionId,
    planId: receipt.planId,
    targetFingerprint: receipt.targetFingerprint,
    beforeSha256: receipt.beforeSha256,
    afterSha256: receipt.afterSha256,
    backupSha256: receipt.backupSha256,
    afterIdentityFingerprint: receipt.afterIdentityFingerprint,
    committedAtMs: receipt.committedAtMs,
  }));
  if (!safeSha256Equal(receipt.receiptDigest, expected)) throw receiptError();
  return receipt;
}

function receiptMatchesEntry(receipt: LocalClientConfigReceipt, entry: JournalEntry): boolean {
  return entry.planId === receipt.planId
    && entry.targetFingerprint === receipt.targetFingerprint
    && entry.beforeSha256 === receipt.beforeSha256
    && entry.afterSha256 === receipt.afterSha256
    && entry.backupSha256 === receipt.backupSha256
    && entry.afterIdentityFingerprint === receipt.afterIdentityFingerprint
    && entry.committedAtMs === receipt.committedAtMs
    && safeSha256Equal(entry.receiptDigest, receipt.receiptDigest);
}

function buildRollbackReceipt(entry: JournalEntry): LocalClientConfigRollbackReceipt {
  if (entry.rolledBackAtMs === null) throw journalCorruptError();
  const unsigned = {
    rollbackReceiptVersion: LOCAL_CLIENT_CONFIG_ROLLBACK_RECEIPT_VERSION,
    transactionId: entry.transactionId,
    planId: entry.planId,
    restoredSha256: entry.beforeSha256,
    replacedSha256: entry.afterSha256,
    backupSha256: entry.backupSha256,
    rolledBackAtMs: entry.rolledBackAtMs,
  } as const;
  return Object.freeze({
    ...unsigned,
    receiptDigest: sha256Text(canonicalReceipt(unsigned)),
  });
}

function canonicalReceipt(value: Readonly<Record<string, unknown>>): string {
  return JSON.stringify(Object.keys(value).sort().map((key) => [key, value[key]]));
}

function assertBoundPaths(input: Readonly<{
  allowedRoot: string;
  targetPath: string;
  backupDir: string;
  journalPath: string;
  lockPath: string;
}>): void {
  assertInside(input.allowedRoot, input.targetPath);
  assertInside(input.allowedRoot, input.backupDir);
  assertInside(input.allowedRoot, input.journalPath);
  assertInside(input.allowedRoot, input.lockPath);
  if (
    normalizePathForComparison(input.targetPath) === normalizePathForComparison(input.allowedRoot)
    || normalizePathForComparison(input.targetPath) === normalizePathForComparison(input.journalPath)
    || normalizePathForComparison(input.targetPath) === normalizePathForComparison(input.lockPath)
    || isPathInside(input.backupDir, input.targetPath)
    || isPathInside(input.backupDir, input.journalPath)
    || isPathInside(input.backupDir, input.lockPath)
  ) {
    throw pathError();
  }
}

function assertInside(rootPath: string, candidatePath: string): void {
  const root = resolve(rootPath);
  const candidate = resolve(candidatePath);
  const rel = relative(root, candidate);
  if (rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel))) return;
  throw pathError();
}

function isPathInside(rootPath: string, candidatePath: string): boolean {
  const rel = relative(resolve(rootPath), resolve(candidatePath));
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

function assertAbsolutePath(value: unknown): string {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > 4_096
    || value !== value.trim()
    || !isAbsolute(value)
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw configurationError();
  }
  if (
    (/^(?:\\\\|\/\/)/u.test(value))
    || (platform() === "win32" && value.slice(2).includes(":"))
    || (platform() === "win32" && value.split(/[\\/]+/u).some((segment) => /[ .]$/u.test(segment)))
  ) {
    throw configurationError();
  }
  return resolve(value);
}

function normalizePathForComparison(value: string): string {
  const normalized = resolve(value).replace(/[\\/]+$/u, "");
  return platform() === "win32" ? normalized.toLowerCase() : normalized;
}

function normalizePathForFingerprint(value: string): string {
  return normalizePathForComparison(value).replace(/\\/gu, "/");
}

function boundedInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < min || resolved > max) throw configurationError();
  return resolved;
}

function cloneBackupEncryptionKey(value: Uint8Array | undefined): Buffer | null {
  if (value === undefined) return null;
  if (!(value instanceof Uint8Array) || value.byteLength !== 32) throw configurationError();
  return Buffer.from(value);
}

async function pathMissing(path: string): Promise<boolean> {
  return lstat(path).then(() => false, (error: unknown) => {
    if (hasErrorCode(error, "ENOENT")) return true;
    throw cleanupError();
  });
}

function readClock(clock: () => number): number {
  let value: unknown;
  try {
    value = clock();
  } catch {
    throw clockRollbackError();
  }
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw clockRollbackError();
  return Number(value);
}

function assertExactObject(
  value: unknown,
  allowed: readonly string[],
  optional: ReadonlySet<string>,
  errorFactory: () => LocalClientConfigTransactionError,
): asserts value is Record<string, unknown> {
  if (!isPlainRecord(value)) throw errorFactory();
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string" || !allowed.includes(key))) throw errorFactory();
  for (const key of keys as string[]) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || descriptor.get || descriptor.set || descriptor.enumerable !== true) throw errorFactory();
  }
  for (const key of allowed) {
    if (!optional.has(key) && !Object.hasOwn(value, key)) throw errorFactory();
  }
}

function hasExactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!isPlainRecord(value)) return false;
  const actual = Reflect.ownKeys(value);
  return actual.length === keys.length
    && actual.every((key) => typeof key === "string" && keys.includes(key))
    && keys.every((key) => Object.hasOwn(value, key));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertSha256(
  value: unknown,
  errorFactory: () => LocalClientConfigTransactionError,
): string {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) throw errorFactory();
  return value;
}

function assertTransactionId(
  value: unknown,
  errorFactory: () => LocalClientConfigTransactionError,
): string {
  if (typeof value !== "string" || !TRANSACTION_ID_PATTERN.test(value)) throw errorFactory();
  return value;
}

function assertNonNegativeInteger(
  value: unknown,
  errorFactory: () => LocalClientConfigTransactionError,
): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw errorFactory();
  return Number(value);
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function sha256Bytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeSha256Equal(left: unknown, right: unknown): boolean {
  if (
    typeof left !== "string"
    || typeof right !== "string"
    || !SHA256_PATTERN.test(left)
    || !SHA256_PATTERN.test(right)
  ) {
    return false;
  }
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function processAppearsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !hasErrorCode(error, "ESRCH");
  }
}

function hasErrorCode(error: unknown, code: string): boolean {
  try {
    return error !== null
      && typeof error === "object"
      && (error as { code?: unknown }).code === code;
  } catch {
    return false;
  }
}

function transactionError(
  code: LocalClientConfigTransactionErrorCode,
  message: string,
  category: LocalClientConfigTransactionError["category"],
  statusCode: number,
  retryable = false,
): LocalClientConfigTransactionError {
  return new LocalClientConfigTransactionError(code, message, category, statusCode, retryable);
}

function configurationError(): LocalClientConfigTransactionError {
  return transactionError(
    "LOCAL_CLIENT_CONFIG_CONFIGURATION_INVALID",
    "The code-bound local-client JSON configuration transaction is invalid.",
    "configuration",
    500,
  );
}

function pathError(): LocalClientConfigTransactionError {
  return transactionError(
    "LOCAL_CLIENT_CONFIG_PATH_UNSAFE",
    "The code-bound local-client configuration path is outside the safe file boundary.",
    "configuration",
    500,
  );
}

function targetError(): LocalClientConfigTransactionError {
  return transactionError(
    "LOCAL_CLIENT_CONFIG_TARGET_INVALID",
    "The code-bound local-client configuration target is not a safe regular file.",
    "validation",
    409,
  );
}

function tooLargeError(): LocalClientConfigTransactionError {
  return transactionError(
    "LOCAL_CLIENT_CONFIG_TOO_LARGE",
    "The local-client JSON configuration exceeds the configured byte limit.",
    "capacity",
    413,
  );
}

function jsonError(): LocalClientConfigTransactionError {
  return transactionError(
    "LOCAL_CLIENT_CONFIG_JSON_INVALID",
    "The local-client configuration must be one plain JSON object.",
    "validation",
    422,
  );
}

function operationError(): LocalClientConfigTransactionError {
  return transactionError(
    "LOCAL_CLIENT_CONFIG_OPERATION_INVALID",
    "The bounded local-client configuration operation is invalid.",
    "validation",
    422,
  );
}

function planError(): LocalClientConfigTransactionError {
  return transactionError(
    "LOCAL_CLIENT_CONFIG_PLAN_UNKNOWN",
    "The local-client configuration plan reference is invalid.",
    "validation",
    400,
  );
}

function planUnknownError(): LocalClientConfigTransactionError {
  return transactionError(
    "LOCAL_CLIENT_CONFIG_PLAN_UNKNOWN",
    "The local-client configuration plan is not stored by this engine.",
    "conflict",
    409,
  );
}

function planExpiredError(): LocalClientConfigTransactionError {
  return transactionError(
    "LOCAL_CLIENT_CONFIG_PLAN_EXPIRED",
    "The local-client configuration plan expired before apply.",
    "conflict",
    409,
  );
}

function targetChangedError(): LocalClientConfigTransactionError {
  return transactionError(
    "LOCAL_CLIENT_CONFIG_TARGET_CHANGED",
    "The local-client configuration changed after the plan was created.",
    "conflict",
    409,
  );
}

function lockedError(): LocalClientConfigTransactionError {
  return transactionError(
    "LOCAL_CLIENT_CONFIG_LOCKED",
    "Another process owns the local-client configuration transaction lock.",
    "conflict",
    423,
    true,
  );
}

function journalCorruptError(): LocalClientConfigTransactionError {
  return transactionError(
    "LOCAL_CLIENT_CONFIG_JOURNAL_CORRUPT",
    "The local-client configuration transaction journal failed integrity validation.",
    "integrity",
    503,
  );
}

function journalCapacityError(): LocalClientConfigTransactionError {
  return transactionError(
    "LOCAL_CLIENT_CONFIG_JOURNAL_CAPACITY",
    "The bounded local-client configuration journal is full.",
    "capacity",
    429,
  );
}

function recoveryRequiredError(): LocalClientConfigTransactionError {
  return transactionError(
    "LOCAL_CLIENT_CONFIG_RECOVERY_REQUIRED",
    "A pending local-client configuration transaction requires explicit recovery.",
    "integrity",
    409,
  );
}

function recoveryError(): LocalClientConfigTransactionError {
  return transactionError(
    "LOCAL_CLIENT_CONFIG_TRANSACTION_UNKNOWN",
    "The local-client configuration recovery request is invalid.",
    "validation",
    400,
  );
}

function transactionUnknownError(): LocalClientConfigTransactionError {
  return transactionError(
    "LOCAL_CLIENT_CONFIG_TRANSACTION_UNKNOWN",
    "No pending local-client configuration transaction matches the recovery request.",
    "conflict",
    409,
  );
}

function receiptError(): LocalClientConfigTransactionError {
  return transactionError(
    "LOCAL_CLIENT_CONFIG_RECEIPT_INVALID",
    "The local-client configuration receipt failed integrity validation.",
    "integrity",
    409,
  );
}

function backupError(): LocalClientConfigTransactionError {
  return transactionError(
    "LOCAL_CLIENT_CONFIG_BACKUP_INVALID",
    "The local-client configuration backup is missing or failed integrity validation.",
    "integrity",
    503,
  );
}

function rollbackConflictError(): LocalClientConfigTransactionError {
  return transactionError(
    "LOCAL_CLIENT_CONFIG_ROLLBACK_CONFLICT",
    "Rollback refused because the local-client configuration changed after apply.",
    "conflict",
    409,
  );
}

function recoveryAmbiguousError(): LocalClientConfigTransactionError {
  return transactionError(
    "LOCAL_CLIENT_CONFIG_RECOVERY_AMBIGUOUS",
    "Recovery refused because the current file matches neither provable transaction state.",
    "integrity",
    409,
  );
}

function clockRollbackError(): LocalClientConfigTransactionError {
  return transactionError(
    "LOCAL_CLIENT_CONFIG_CLOCK_INVALID",
    "The local-client configuration transaction clock moved backwards or is invalid.",
    "integrity",
    503,
  );
}

function cleanupError(): LocalClientConfigTransactionError {
  return transactionError(
    "LOCAL_CLIENT_CONFIG_CLEANUP_FAILED",
    "The local-client configuration transaction could not prove safe backup cleanup.",
    "integrity",
    503,
  );
}

function persistError(): LocalClientConfigTransactionError {
  return transactionError(
    "LOCAL_CLIENT_CONFIG_PERSIST_FAILED",
    "The local-client configuration transaction could not be persisted safely.",
    "persistence",
    503,
  );
}
