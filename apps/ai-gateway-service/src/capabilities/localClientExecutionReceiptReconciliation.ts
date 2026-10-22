import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { LocalClientProtectedSqliteCheckpoint } from "./localClientProtectedSqliteCheckpoint.ts";
import type { LocalClientWindowsProtectedAuthorityAnchor } from "./localClientWindowsProtectedAuthorityAnchor.ts";

import {
  LOCAL_CLIENT_DISPATCH_INTENT_VERSION,
  LOCAL_CLIENT_DURABLE_RECEIPT_VERSION,
  LOCAL_CLIENT_RECONCILIATION_QUERY_VERSION,
  LOCAL_CLIENT_RECONCILIATION_RESPONSE_VERSION,
  LOCAL_CLIENT_RECEIPT_RECONCILIATION_HMAC_DOMAIN,
  LOCAL_CLIENT_RECEIPT_RECONCILIATION_KEY_DERIVATION_DOMAIN,
  type LocalClientDispatchIntent,
  type LocalClientDurableExecutionReceipt,
  type LocalClientReceiptReconciliationQuery,
  type LocalClientReceiptReconciliationResponse,
  type LocalClientReceiptReconciliationState,
} from "@unified-ai-system/shared-contracts";

export {
  LOCAL_CLIENT_DISPATCH_INTENT_VERSION,
  LOCAL_CLIENT_DURABLE_RECEIPT_VERSION,
  LOCAL_CLIENT_RECONCILIATION_QUERY_VERSION,
  LOCAL_CLIENT_RECONCILIATION_RESPONSE_VERSION,
  LOCAL_CLIENT_RECEIPT_RECONCILIATION_HMAC_DOMAIN,
  LOCAL_CLIENT_RECEIPT_RECONCILIATION_KEY_DERIVATION_DOMAIN,
} from "@unified-ai-system/shared-contracts";
import type {
  LocalClientReceiptJournalRole,
  LocalClientReceiptReconciliationIdentity,
  LocalClientReceiptJournalState,
  LocalClientSqliteExecutionReceiptJournalOptions,
  LocalClientReceiptJournalRecord,
  LocalClientReceiptRecoveryCandidate,
  LocalClientReceiptRecoveryWorkItem,
  LocalClientExecutionReceiptReconciliationErrorCode,
} from "./localClientReceiptJournalPrimitives.ts";

export type {
  LocalClientDispatchIntent,
  LocalClientDurableExecutionReceipt,
  LocalClientReceiptReconciliationQuery,
  LocalClientReceiptReconciliationResponse,
  LocalClientReceiptReconciliationState,
} from "@unified-ai-system/shared-contracts";
import {
  LocalClientExecutionReceiptReconciliationError,
  METADATA_SINGLETON,
  DEFAULT_NAMESPACE,
  DEFAULT_MAX_ENTRIES,
  DEFAULT_RETENTION_MS,
  DEFAULT_INTENT_TTL_MS,
  DEFAULT_QUERY_TTL_MS,
  DEFAULT_CLOCK_SKEW_MS,
  DEFAULT_BUSY_TIMEOUT_MS,
  MAX_ENTRIES,
  MAX_RETENTION_MS,
  MAX_INTENT_TTL_MS,
  MAX_QUERY_TTL_MS,
  MAX_CLOCK_SKEW_MS,
  MAX_BUSY_TIMEOUT_MS,
  MAX_FENCING_TOKEN,
  RECOVERY_NONCE_BYTES,
  RECOVERY_TAG_BYTES,
  EMPTY_ROW_SET_XOR,
  ROW_SCAN_BATCH_SIZE,
  TARGET_TABLES,
  GATEWAY_STATES,
  CLIENT_STATES,
  normalizeIdentity,
  intentBaseFromBindings,
  deriveIntentId,
  validateDispatchIntent,
  validateDurableReceipt,
  validateReconciliationQuery,
  validateReconciliationResponse,
  createPreparedRow,
  createAcceptedRow,
  signJournalRow,
  digestJournalRow,
  validateJournalRow,
  assertRowBindings,
  assertRowMatchesIntent,
  assertRowMatchesQuery,
  assertRowMatchesReceipt,
  deriveReceiptId,
  bindingsFromRow,
  recoveryAad,
  toPublicRecord,
  recoveryAction,
  nextRecoverySchedulingTimestamp,
  journalRowValues,
  selectJournalFields,
  signProtocol,
  keyedDigest,
  rowSetMemberDigest,
  xorDigests,
  decodeBase64Url,
  assertOptions,
  assertExactKeys,
  assertPlainRecord,
  resolveSqlitePath,
  assertRole,
  assertHostId,
  assertNamespace,
  cloneKey,
  cloneRecoveryKey,
  safeKeyEqual,
  normalizeExecutionId,
  boundedOpaqueIdentityForIntegrity,
  assertIdentifierForIntegrity,
  assertReceiptId,
  boundedInteger,
  readClock,
  safeAdd,
  readPragmaInteger,
  readPragmaIntegerValue,
  parseFencingToken,
  isFencingToken,
  isSafeNonNegativeInteger,
  isSafePositiveInteger,
  isDigest,
  safeDigestEqual,
  canonicalJson,
  isKnownError,
  isDurabilityOrIntegrityFailure,
  configurationError,
  inputError,
  roleError,
  stateError,
  identityMismatchError,
  signatureError,
  staleFenceError,
  capacityError,
  notFoundError,
  schemaError,
  hostMismatchError,
  keyMismatchError,
  closedError,
  unavailableError,
  clockError,
  integrityError,
} from "./localClientReceiptJournalPrimitives.ts";
import type {
  MetadataRow,
  JournalRow,
  ProtocolBindings,
  RecoveryCiphertext,
} from "./localClientReceiptJournalPrimitives.ts";
// Re-exports: the error class and the helper cluster moved to
// localClientReceiptJournalPrimitives.ts; existing importers of this module
// keep working unchanged.
export {
  EXECUTION_ID_PATTERN,
  IDENTIFIER_PATTERN,
  RECEIPT_ID_PATTERN,
  assertIdentifier,
  fingerprint,
  inputError,
  normalizeIdentity,
  assertExactKeys,
  boundedInteger,
  configurationError,
  unavailableError,
  LocalClientExecutionReceiptReconciliationError,
  authenticateLocalClientDispatchIntent,
  recoveryAction,
  assertOptions,
  deriveReceiptId,
  canonicalJson,
  closedError,
} from "./localClientReceiptJournalPrimitives.ts";
export type {

} from "./localClientReceiptJournalPrimitives.ts";

export const LOCAL_CLIENT_EXECUTION_RECEIPT_RECONCILIATION_SCHEMA_VERSION = 2 as const;

export const LOCAL_CLIENT_EXECUTION_RECEIPT_RECONCILIATION_BOUNDARIES = Object.freeze({
  storageMode: "single-host-sqlite" as const,
  durable: true as const,
  distributed: false as const,
  crossHostSupported: false as const,
  protocolIntegrity: "hmac-sha256" as const,
  rowIntegrity: "hmac-sha256" as const,
  metadataIntegrity: "hmac-sha256" as const,
  activeRowSetAuthentication: "count-plus-keyed-xor-hmac" as const,
  unknownTargetTriggersAllowed: false as const,
  monotonicDispatchFencing: true as const,
  rawInputPersisted: false as const,
  rawResponsePersisted: false as const,
  rawSecretPersisted: false as const,
  rawTenantPersisted: false as const,
  rawSubjectPersisted: false as const,
  rawClientPersisted: false as const,
  opaqueExecutionIdPersisted: true as const,
  recoveryContextEncryption: "aes-256-gcm" as const,
  reconciliationAuthorizesRedispatch: false as const,
  absenceProvesNotExecuted: false as const,
  effectStartedCanBecomeFailedBeforeEffect: false as const,
  fullClosureRequiresClientAtomicEffectReceipt: true as const,
  clientAtomicEffectReceiptVerified: false as const,
  databaseSnapshotRollbackProtected: false as const,
  clientTerminalEvidenceAutoExpires: false as const,
  clientTerminalEvidenceAckImplemented: false as const,
  clientCapacityFailsClosedUntilAuthenticatedAck: true as const,
  clockRollbackPolicy: "fail-closed" as const,
});

export type {
  LocalClientReceiptJournalRole,
  LocalClientReceiptReconciliationIdentity,
  LocalClientReceiptJournalState,
  LocalClientSqliteExecutionReceiptJournalOptions,
  LocalClientReceiptJournalRecord,
  LocalClientReceiptRecoveryCandidate,
  LocalClientReceiptRecoveryWorkItem,
  LocalClientExecutionReceiptReconciliationErrorCode,
} from "./localClientReceiptJournalPrimitives.ts";



/**
 * Durable two-role journal for the gateway dispatch boundary and a local
 * client's receipt boundary. Instantiate separate gateway and client databases.
 * A reconciliation query is read-only and can never claim an effect execution.
 */
export class LocalClientSqliteExecutionReceiptJournal {
  readonly #db!: DatabaseSync;
  readonly #sqlitePath!: string;
  readonly #role!: LocalClientReceiptJournalRole;
  readonly #integrityKey!: Buffer;
  readonly #protocolKey!: Buffer;
  readonly #recoveryEncryptionKey!: Buffer | null;
  readonly #hostBindingHmac!: string;
  readonly #namespaceBindingHmac!: string;
  readonly #integrityKeyBindingHmac!: string;
  readonly #protocolKeyBindingHmac!: string;
  readonly #recoveryKeyBindingHmac!: string;
  readonly #maxEntries!: number;
  readonly #retentionMs!: number;
  readonly #intentTtlMs!: number;
  readonly #queryTtlMs!: number;
  readonly #allowedClockSkewMs!: number;
  readonly #busyTimeoutMs!: number;
  readonly #now!: () => number;
  #lifecycle: "open" | "closing" | "close-failed" | "closed" = "open";
  #closePromise: Promise<void> | null = null;
  #closeFailed = false;
  #available = false;
  #lastFailureCode: LocalClientExecutionReceiptReconciliationErrorCode | null = null;
  #failureCount = 0;
  #secureDeleteEnabled = false;
  #trustedSchemaDisabled = false;
  #defensiveSupported = false;
  #defensiveEnabled = false;
  #protectedCheckpoint: LocalClientProtectedSqliteCheckpoint | null = null;

  constructor(options: LocalClientSqliteExecutionReceiptJournalOptions) {
    assertOptions(options);
    this.#sqlitePath = resolveSqlitePath(options.sqlitePath);
    this.#role = assertRole(options.role);
    let integrityKey: Buffer | null = null;
    let protocolKey: Buffer | null = null;
    let recoveryEncryptionKey: Buffer | null = null;
    try {
      integrityKey = cloneKey(options.integrityKey);
      try {
        protocolKey = cloneKey(options.protocolKey);
      } catch (error) {
        integrityKey.fill(0);
        throw error;
      }
      if (safeKeyEqual(integrityKey, protocolKey)) throw configurationError();
      if (this.#role === "gateway") {
        recoveryEncryptionKey = cloneRecoveryKey(options.recoveryEncryptionKey);
        if (
          safeKeyEqual(integrityKey, recoveryEncryptionKey)
          || safeKeyEqual(protocolKey, recoveryEncryptionKey)
        ) throw configurationError();
      } else if (options.recoveryEncryptionKey !== undefined) {
        throw configurationError();
      }
      this.#integrityKey = integrityKey;
      this.#protocolKey = protocolKey;
      this.#recoveryEncryptionKey = recoveryEncryptionKey;
      const hostId = assertHostId(options.hostId);
      const namespace = assertNamespace(options.namespace ?? DEFAULT_NAMESPACE);
      this.#hostBindingHmac = keyedDigest(this.#integrityKey, "host-binding", hostId);
      this.#namespaceBindingHmac = keyedDigest(this.#integrityKey, "namespace-binding", namespace);
      this.#integrityKeyBindingHmac = keyedDigest(
        this.#integrityKey,
        "integrity-key-binding",
        LOCAL_CLIENT_EXECUTION_RECEIPT_RECONCILIATION_SCHEMA_VERSION.toString(),
      );
      this.#protocolKeyBindingHmac = keyedDigest(
        this.#integrityKey,
        "protocol-key-binding",
        keyedDigest(this.#protocolKey, "protocol-key-proof", namespace),
      );
      this.#recoveryKeyBindingHmac = this.#recoveryEncryptionKey
        ? keyedDigest(
            this.#integrityKey,
            "recovery-key-binding",
            keyedDigest(this.#recoveryEncryptionKey, "recovery-key-proof", namespace),
          )
        : keyedDigest(this.#integrityKey, "recovery-key-absent", this.#role);
      this.#maxEntries = boundedInteger(options.maxEntries, DEFAULT_MAX_ENTRIES, 1, MAX_ENTRIES);
      this.#retentionMs = boundedInteger(
        options.retentionMs,
        DEFAULT_RETENTION_MS,
        1_000,
        MAX_RETENTION_MS,
      );
      this.#intentTtlMs = boundedInteger(
        options.intentTtlMs,
        DEFAULT_INTENT_TTL_MS,
        1_000,
        MAX_INTENT_TTL_MS,
      );
      this.#queryTtlMs = boundedInteger(
        options.queryTtlMs,
        DEFAULT_QUERY_TTL_MS,
        1_000,
        MAX_QUERY_TTL_MS,
      );
      this.#allowedClockSkewMs = boundedInteger(
        options.allowedClockSkewMs,
        DEFAULT_CLOCK_SKEW_MS,
        0,
        MAX_CLOCK_SKEW_MS,
      );
      this.#busyTimeoutMs = boundedInteger(
        options.busyTimeoutMs,
        DEFAULT_BUSY_TIMEOUT_MS,
        100,
        MAX_BUSY_TIMEOUT_MS,
      );
      if (options.now !== undefined && typeof options.now !== "function") throw configurationError();
      this.#now = options.now ?? Date.now;

      // The mode is applied only to directories created by this call. Existing
      // parent directory ACLs/modes remain user-owned and are never rewritten.
      mkdirSync(dirname(this.#sqlitePath), { recursive: true, mode: 0o700 });
      this.#db = new DatabaseSync(this.#sqlitePath);
      if (!options.protectedAuthority && this.#db.prepare(
        "SELECT name FROM sqlite_schema WHERE name = 'local_client_protected_checkpoint'",
      ).get()) throw configurationError();
      this.#db.exec(`PRAGMA busy_timeout = ${this.#busyTimeoutMs}`);
      const journal = this.#db.prepare("PRAGMA journal_mode = WAL").get() as { journal_mode?: unknown } | undefined;
      if (String(journal?.journal_mode ?? "").toLowerCase() !== "wal") throw schemaError();
      this.#db.exec("PRAGMA synchronous = FULL");
      const synchronous = this.#db.prepare("PRAGMA synchronous").get() as { synchronous?: unknown } | undefined;
      if (Number(synchronous?.synchronous) !== 2) throw schemaError();
      this.#db.exec("PRAGMA secure_delete = ON");
      this.#db.exec("PRAGMA trusted_schema = OFF");
      this.#db.exec("PRAGMA foreign_keys = ON");
      this.#assertRuntimeHardening();
      this.#initializeSchema();
      const defensive = (this.#db as DatabaseSync & { enableDefensive?: (enabled: boolean) => void })
        .enableDefensive;
      this.#defensiveSupported = typeof defensive === "function";
      if (this.#defensiveSupported) {
        defensive!.call(this.#db, true);
        this.#defensiveEnabled = true;
      }
      this.#assertRuntimeHardening();
      this.#assertNoUnknownTargetTriggers();
      this.#assertDatabaseHealthy();
      this.#assertAuthenticatedRowSet();
      if (options.protectedAuthority) {
        this.#protectedCheckpoint = new LocalClientProtectedSqliteCheckpoint({
          db: this.#db, integrityKey: this.#integrityKey,
          bindingId: `${this.#role}:${this.#hostBindingHmac}:${this.#namespaceBindingHmac}`,
          authority: options.protectedAuthority,
          readDataDigest: () => {
            this.#assertRuntimeHardening();
            this.#assertNoUnknownTargetTriggers();
            this.#assertAuthenticatedRowSet();
            const metadata = this.#readMetadata();
            if (!metadata) throw integrityError();
            return metadata.metadata_hmac;
          },
        });
      }
      try { chmodSync(this.#sqlitePath, 0o600); } catch { /* Best effort on Windows. */ }
      this.#available = true;
    } catch (error) {
      try { this.#db?.close(); } catch { /* Preserve initialization error. */ }
      integrityKey?.fill(0);
      protocolKey?.fill(0);
      recoveryEncryptionKey?.fill(0);
      if (isKnownError(error)) throw error;
      throw unavailableError();
    }
  }

  get status() {
    return Object.freeze({
      ...LOCAL_CLIENT_EXECUTION_RECEIPT_RECONCILIATION_BOUNDARIES,
      role: this.#role,
      lifecycle: this.#lifecycle,
      available: this.#lifecycle === "open" && this.#available,
      closeFailed: this.#closeFailed,
      activeFailureCode: this.#available ? null : this.#lastFailureCode,
      lastFailureCode: this.#lastFailureCode,
      failureCount: this.#failureCount,
      schemaVersion: LOCAL_CLIENT_EXECUTION_RECEIPT_RECONCILIATION_SCHEMA_VERSION,
      maxEntries: this.#maxEntries,
      retentionMs: this.#retentionMs,
      intentTtlMs: this.#intentTtlMs,
      queryTtlMs: this.#queryTtlMs,
      allowedClockSkewMs: this.#allowedClockSkewMs,
      busyTimeoutMs: this.#busyTimeoutMs,
      journalMode: "wal" as const,
      synchronous: "full" as const,
      secureDeleteEnabled: this.#lifecycle === "open" && this.#secureDeleteEnabled,
      trustedSchemaDisabled: this.#lifecycle === "open" && this.#trustedSchemaDisabled,
      defensiveSupported: this.#defensiveSupported,
      defensiveEnabled: this.#lifecycle === "open" && this.#defensiveEnabled,
      recoveryContextEncrypted: this.#role === "gateway"
        && this.#recoveryEncryptionKey !== null,
      ...(this.#protectedCheckpoint ? { protectedCheckpointState: this.#protectedCheckpoint.status.state } : {}),
    });
  }

  /** Provisioning workflow only. Ordinary dispatch/startup never enrolls an anchor. */
  async enrollProtectedBaseline() {
    this.#assertOpen();
    if (!this.#protectedCheckpoint) throw configurationError();
    const checkpoint = await this.#protectedCheckpoint.enrollBaseline();
    this.#available = true;
    return checkpoint;
  }

  /** No dispatch callback is accepted or replayed during protected recovery. */
  async recoverProtectedCheckpoint() {
    this.#assertOpen();
    if (!this.#protectedCheckpoint) throw configurationError();
    const checkpoint = await this.#protectedCheckpoint.recover();
    this.#available = true;
    return checkpoint;
  }

  /** Gateway phase 1: persist bindings before the external-effect reservation is armed. */
  async prepareDispatch(input: LocalClientReceiptReconciliationIdentity) {
    this.#assertRole("gateway");
    const identity = normalizeIdentity(this.#protocolKey, input);
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      this.#purgeRetired(nowMs);
      const existing = this.#select(identity.executionId);
      if (existing) {
        const row = this.#decodeRow(existing);
        assertRowBindings(row, identity);
        return Object.freeze({ prepared: false, replayed: true, record: toPublicRecord(row) });
      }
      this.#assertCapacity();
      const row = signJournalRow(this.#integrityKey, createPreparedRow(
        identity,
        nowMs,
        this.#encryptRecoveryContext(input, identity, "0"),
      ));
      this.#insert(row);
      return Object.freeze({ prepared: true, replayed: false, record: toPublicRecord(row) });
    });
  }

  /**
   * Gateway phase 2: creates the single dispatch authorization. Only a result
   * with dispatchAllowed=true may be sent to the adapter; replay never grants it.
   */
  async armDispatch(input: LocalClientReceiptReconciliationIdentity) {
    this.#assertRole("gateway");
    const identity = normalizeIdentity(this.#protocolKey, input);
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      const row = this.#requiredRow(identity.executionId);
      assertRowBindings(row, identity);
      if (row.state !== "prepared") {
        if (!GATEWAY_STATES.has(row.state) || row.intent_id === "") throw stateError();
        return Object.freeze({
          dispatchAllowed: false as const,
          replayed: true,
          intent: this.#intentFromRow(row),
          record: toPublicRecord(row),
        });
      }
      const dispatchFencingToken = this.#allocateFencingToken();
      const expiresAtMs = safeAdd(nowMs, this.#intentTtlMs);
      const unsignedBase = intentBaseFromBindings(identity, dispatchFencingToken, nowMs, expiresAtMs);
      const intentId = deriveIntentId(this.#protocolKey, unsignedBase);
      const recovery = this.#encryptRecoveryContext(input, identity, dispatchFencingToken);
      const updated = signJournalRow(this.#integrityKey, {
        ...row,
        state: "armed",
        dispatch_fencing_token: dispatchFencingToken,
        intent_id: intentId,
        intent_issued_at_ms: nowMs,
        intent_expires_at_ms: expiresAtMs,
        ...recovery,
        updated_at_ms: nowMs,
      });
      this.#replace(row, updated);
      return Object.freeze({
        dispatchAllowed: true as const,
        replayed: false,
        intent: this.#intentFromRow(updated),
        record: toPublicRecord(updated),
      });
    });
  }

  /** Gateway recovery for a durable prepare that was never armed for dispatch. */
  async resolvePreparedAsNotDispatched(executionIdInput: string) {
    this.#assertRole("gateway");
    const executionId = normalizeExecutionId(executionIdInput);
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      const row = this.#requiredRow(executionId);
      if (
        row.state === "not-dispatched-confirmed"
        || (
          row.state === "lifecycle-finalized"
          && row.terminal_outcome === "failed-before-effect"
          && row.intent_id === ""
        )
      ) {
        return Object.freeze({ resolved: false, replayed: true, record: toPublicRecord(row) });
      }
      if (row.state !== "prepared") throw stateError();
      const updated = signJournalRow(this.#integrityKey, {
        ...row,
        state: "not-dispatched-confirmed",
        terminal_at_ms: nowMs,
        terminal_outcome: "failed-before-effect",
        updated_at_ms: nowMs,
      });
      this.#replace(row, updated);
      return Object.freeze({ resolved: true, replayed: false, record: toPublicRecord(updated) });
    });
  }

  /**
   * Gateway-only proof that an armed intent never entered the adapter. This is
   * deliberately separate from client-signed failed-before-effect evidence and
   * may only be called by the orchestrator in its pre-adapter commit failure
   * window.
   */
  async resolveArmedAsNotDispatched(executionIdInput: string) {
    this.#assertRole("gateway");
    const executionId = normalizeExecutionId(executionIdInput);
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      const row = this.#requiredRow(executionId);
      if (
        row.state === "armed-not-dispatched-confirmed"
        || (
          row.state === "lifecycle-finalized"
          && row.terminal_outcome === "failed-before-effect"
          && row.intent_id !== ""
        )
      ) {
        return Object.freeze({ resolved: false, replayed: true, record: toPublicRecord(row) });
      }
      if (row.state !== "armed") throw stateError();
      const updated = signJournalRow(this.#integrityKey, {
        ...row,
        state: "armed-not-dispatched-confirmed",
        terminal_at_ms: nowMs,
        terminal_outcome: "failed-before-effect",
        updated_at_ms: nowMs,
      });
      this.#replace(row, updated);
      return Object.freeze({ resolved: true, replayed: false, record: toPublicRecord(updated) });
    });
  }

  /** Client phase 1: verify and durably accept a fresh, monotonically fenced intent. */
  async acceptDispatchIntent(rawIntent: LocalClientDispatchIntent) {
    this.#assertRole("client");
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      this.#purgeRetired(nowMs);
      const intent = validateDispatchIntent(
        this.#protocolKey,
        rawIntent,
        nowMs,
        this.#allowedClockSkewMs,
        this.#intentTtlMs,
        true,
      );
      const existing = this.#select(intent.executionId);
      if (existing) {
        const row = this.#decodeRow(existing);
        assertRowMatchesIntent(row, intent);
        return Object.freeze({ accepted: false, replayed: true, record: toPublicRecord(row) });
      }
      this.#assertCapacity();
      this.#acceptFencingToken(intent.dispatchFencingToken);
      const row = signJournalRow(this.#integrityKey, createAcceptedRow(intent, nowMs));
      this.#insert(row);
      return Object.freeze({ accepted: true, replayed: false, record: toPublicRecord(row) });
    });
  }

  /**
   * Client phase 2: the only method that claims permission to execute the
   * effect. Replays return execute=false and therefore cannot re-authorize it.
   */
  async claimEffect(rawIntent: LocalClientDispatchIntent) {
    this.#assertRole("client");
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      const intent = validateDispatchIntent(
        this.#protocolKey,
        rawIntent,
        nowMs,
        this.#allowedClockSkewMs,
        this.#intentTtlMs,
        true,
      );
      const row = this.#requiredRow(intent.executionId);
      assertRowMatchesIntent(row, intent);
      if (row.state !== "accepted") {
        if (!CLIENT_STATES.has(row.state)) throw stateError();
        return Object.freeze({
          execute: false as const,
          replayed: true,
          state: row.state,
          record: toPublicRecord(row),
        });
      }
      const updated = signJournalRow(this.#integrityKey, {
        ...row,
        state: "effect-started",
        effect_started_at_ms: nowMs,
        updated_at_ms: nowMs,
      });
      this.#replace(row, updated);
      return Object.freeze({
        execute: true as const,
        replayed: false,
        state: updated.state,
        record: toPublicRecord(updated),
      });
    });
  }

  /** Client terminal phase for a failure proven to have happened before effect claim. */
  async recordFailedBeforeEffect(rawIntent: LocalClientDispatchIntent) {
    this.#assertRole("client");
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      const intent = validateDispatchIntent(
        this.#protocolKey,
        rawIntent,
        nowMs,
        this.#allowedClockSkewMs,
        this.#intentTtlMs,
        false,
      );
      const row = this.#requiredRow(intent.executionId);
      assertRowMatchesIntent(row, intent);
      if (row.state === "failed-before-effect") {
        return Object.freeze({ recorded: false, replayed: true, record: toPublicRecord(row) });
      }
      if (row.state !== "accepted") throw stateError();
      const updated = signJournalRow(this.#integrityKey, {
        ...row,
        state: "failed-before-effect",
        terminal_at_ms: nowMs,
        terminal_outcome: "failed-before-effect",
        // Client terminal evidence is the only authenticated restart proof.
        // Until an authenticated gateway ACK protocol exists it is retained
        // indefinitely and capacity fails closed instead of erasing evidence.
        retire_at_ms: 0,
        updated_at_ms: nowMs,
      });
      this.#replace(row, updated);
      return Object.freeze({ recorded: true, replayed: false, record: toPublicRecord(updated) });
    });
  }

  /**
   * Client terminal phase after an effect claim. This only durably records the
   * receipt; complete crash-window closure requires the client's real effect to
   * share this transaction or expose idempotent status keyed by executionId.
   */
  async recordCompleted(rawIntent: LocalClientDispatchIntent) {
    this.#assertRole("client");
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      const intent = validateDispatchIntent(
        this.#protocolKey,
        rawIntent,
        nowMs,
        this.#allowedClockSkewMs,
        this.#intentTtlMs,
        false,
      );
      const row = this.#requiredRow(intent.executionId);
      assertRowMatchesIntent(row, intent);
      if (row.state === "completed") {
        return Object.freeze({
          recorded: false,
          replayed: true,
          receipt: this.#receiptFromRow(row),
          record: toPublicRecord(row),
        });
      }
      if (row.state !== "effect-started") throw stateError();
      const receiptId = deriveReceiptId(this.#protocolKey, row, nowMs);
      const updated = signJournalRow(this.#integrityKey, {
        ...row,
        state: "completed",
        terminal_at_ms: nowMs,
        terminal_outcome: "completed",
        receipt_id: receiptId,
        retire_at_ms: 0,
        updated_at_ms: nowMs,
      });
      this.#replace(row, updated);
      return Object.freeze({
        recorded: true,
        replayed: false,
        receipt: this.#receiptFromRow(updated),
        record: toPublicRecord(updated),
      });
    });
  }

  /** Import a native resource's already committed receipt. This projects an
   * atomic resource result into the client journal; it never claims an effect
   * or authorizes redispatch. The receiving adapter must obtain the receipt
   * from its actual native resource store, not manufacture it from a flag. */
  async recordNativeCompleted(rawReceipt: LocalClientDurableExecutionReceipt) {
    this.#assertRole("client");
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      const receipt = validateDurableReceipt(this.#protocolKey, rawReceipt, nowMs, this.#allowedClockSkewMs);
      const row = this.#requiredRow(receipt.executionId);
      assertRowMatchesReceipt(row, receipt);
      if (row.state === "completed") {
        if (row.receipt_id !== receipt.receiptId || row.terminal_at_ms !== receipt.completedAtMs) {
          throw identityMismatchError();
        }
        return Object.freeze({ recorded: false, replayed: true, receipt: this.#receiptFromRow(row), record: toPublicRecord(row) });
      }
      if (row.state !== "effect-started" || receipt.completedAtMs < row.effect_started_at_ms) throw stateError();
      const updated = signJournalRow(this.#integrityKey, {
        ...row, state: "completed", terminal_at_ms: receipt.completedAtMs,
        terminal_outcome: "completed", receipt_id: receipt.receiptId,
        retire_at_ms: 0, updated_at_ms: nowMs,
      });
      this.#replace(row, updated);
      return Object.freeze({ recorded: true, replayed: false, receipt: this.#receiptFromRow(updated), record: toPublicRecord(updated) });
    });
  }

  /** Gateway creates a signed, read-only reconciliation query from durable bindings. */
  async createReconciliationQuery(executionIdInput: string) {
    this.#assertRole("gateway");
    const executionId = normalizeExecutionId(executionIdInput);
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      const row = this.#requiredRow(executionId);
      if (row.state === "prepared" || !GATEWAY_STATES.has(row.state) || row.intent_id === "") {
        throw stateError();
      }
      const unsigned: Omit<LocalClientReceiptReconciliationQuery, "signature"> = Object.freeze({
        protocolVersion: LOCAL_CLIENT_RECONCILIATION_QUERY_VERSION,
        queryId: `lcq_${randomBytes(24).toString("hex")}`,
        intentId: row.intent_id,
        executionId: row.execution_id,
        executionBindingHmac: row.execution_binding_hmac,
        tenantBindingHmac: row.tenant_binding_hmac,
        subjectBindingHmac: row.subject_binding_hmac,
        clientBindingHmac: row.client_binding_hmac,
        routeBindingHmac: row.route_binding_hmac,
        identityBindingHmac: row.identity_binding_hmac,
        planFingerprint: row.plan_sha256,
        inputSha256: row.input_sha256,
        dispatchFencingToken: row.dispatch_fencing_token,
        issuedAtMs: nowMs,
        expiresAtMs: safeAdd(nowMs, this.#queryTtlMs),
        purpose: "receipt-reconciliation-only",
        authorizeExecution: false,
      });
      return Object.freeze({
        ...unsigned,
        signature: signProtocol(this.#protocolKey, "reconciliation-query", unsigned),
      });
    });
  }

  /** Client read path. It returns evidence only and never changes effect authorization state. */
  async reconcile(rawQuery: LocalClientReceiptReconciliationQuery) {
    this.#assertRole("client");
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      const query = validateReconciliationQuery(
        this.#protocolKey,
        rawQuery,
        nowMs,
        this.#allowedClockSkewMs,
        this.#queryTtlMs,
      );
      const persisted = this.#select(query.executionId);
      let state: LocalClientReceiptReconciliationState = "not-found";
      let receipt: LocalClientDurableExecutionReceipt | null = null;
      if (persisted) {
        const row = this.#decodeRow(persisted);
        assertRowMatchesQuery(row, query);
        if (row.state === "completed") {
          state = "completed";
          receipt = this.#receiptFromRow(row);
        } else if (row.state === "failed-before-effect") {
          state = "failed-before-effect";
        } else if (row.state === "accepted" || row.state === "effect-started") {
          state = "pending";
        } else {
          throw stateError();
        }
      }
      const unsigned: Omit<LocalClientReceiptReconciliationResponse, "signature"> = Object.freeze({
        protocolVersion: LOCAL_CLIENT_RECONCILIATION_RESPONSE_VERSION,
        queryId: query.queryId,
        intentId: query.intentId,
        executionId: query.executionId,
        dispatchFencingToken: query.dispatchFencingToken,
        state,
        receipt,
        observedAtMs: nowMs,
        retryAllowed: false,
      });
      return Object.freeze({
        ...unsigned,
        signature: signProtocol(this.#protocolKey, "reconciliation-response", unsigned),
      });
    });
  }

  /** Gateway direct-response path for the same durable, client-signed receipt. */
  async confirmReceipt(rawReceipt: LocalClientDurableExecutionReceipt) {
    this.#assertRole("gateway");
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      const receipt = validateDurableReceipt(
        this.#protocolKey,
        rawReceipt,
        nowMs,
        this.#allowedClockSkewMs,
      );
      return this.#confirmReceipt(receipt, nowMs);
    });
  }

  /** Gateway recovery path. Pending and absence remain unknown and never permit retry. */
  async applyReconciliation(
    rawQuery: LocalClientReceiptReconciliationQuery,
    rawResponse: LocalClientReceiptReconciliationResponse,
  ) {
    this.#assertRole("gateway");
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      const query = validateReconciliationQuery(
        this.#protocolKey,
        rawQuery,
        nowMs,
        this.#allowedClockSkewMs,
        this.#queryTtlMs,
      );
      const response = validateReconciliationResponse(
        this.#protocolKey,
        rawResponse,
        nowMs,
        this.#allowedClockSkewMs,
      );
      if (
        response.queryId !== query.queryId
        || response.intentId !== query.intentId
        || response.executionId !== query.executionId
        || response.dispatchFencingToken !== query.dispatchFencingToken
      ) throw identityMismatchError();
      const row = this.#requiredRow(query.executionId);
      assertRowMatchesQuery(row, query);
      if (response.state === "completed") {
        if (!response.receipt) throw signatureError();
        const confirmed = this.#confirmReceipt(response.receipt, nowMs);
        return Object.freeze({
          state: response.state,
          resolved: true as const,
          retryAllowed: false as const,
          receipt: confirmed.receipt,
          replayed: confirmed.replayed,
        });
      }
      if (response.receipt !== null) throw signatureError();
      if (response.state === "failed-before-effect") {
        if (row.state === "failed-before-effect-confirmed") {
          return Object.freeze({
            state: response.state,
            resolved: true as const,
            retryAllowed: false as const,
            receipt: null,
            replayed: true,
          });
        }
        if (row.state !== "armed") throw stateError();
        const updated = signJournalRow(this.#integrityKey, {
          ...row,
          state: "failed-before-effect-confirmed",
          terminal_at_ms: response.observedAtMs,
          terminal_outcome: "failed-before-effect",
          updated_at_ms: nowMs,
        });
        this.#replace(row, updated);
        return Object.freeze({
          state: response.state,
          resolved: true as const,
          retryAllowed: false as const,
          receipt: null,
          replayed: false,
        });
      }
      if (row.state !== "armed") throw stateError();
      const deferred = signJournalRow(this.#integrityKey, {
        ...row,
        // A strict per-row advance prevents one pending/not-found execution
        // from monopolizing the oldest recovery slot even within one journal.
        updated_at_ms: nextRecoverySchedulingTimestamp(row.updated_at_ms, nowMs),
      });
      this.#replace(row, deferred);
      return Object.freeze({
        state: response.state,
        resolved: false as const,
        retryAllowed: false as const,
        receipt: null,
        replayed: false,
      });
    });
  }

  async markFeedbackStaged(input: Readonly<{ executionId: string; receiptId: string }>) {
    this.#assertRole("gateway");
    assertPlainRecord(input, inputError);
    assertExactKeys(input, ["executionId", "receiptId"], false, inputError);
    const executionId = normalizeExecutionId(input.executionId);
    const receiptId = assertReceiptId(input.receiptId);
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      const row = this.#requiredRow(executionId);
      if (row.receipt_id !== receiptId) throw identityMismatchError();
      if (row.state === "feedback-staged" || (
        row.state === "lifecycle-finalized" && row.terminal_outcome === "completed"
      )) {
        return Object.freeze({ staged: false, replayed: true, record: toPublicRecord(row) });
      }
      if (row.state !== "receipt-confirmed") throw stateError();
      const updated = signJournalRow(this.#integrityKey, {
        ...row,
        state: "feedback-staged",
        feedback_staged_at_ms: nowMs,
        updated_at_ms: nowMs,
      });
      this.#replace(row, updated);
      return Object.freeze({ staged: true, replayed: false, record: toPublicRecord(updated) });
    });
  }

  async markLifecycleFinalized(input: Readonly<{
    executionId: string;
    outcome: "completed" | "failed-before-effect";
  }>) {
    this.#assertRole("gateway");
    assertPlainRecord(input, inputError);
    assertExactKeys(input, ["executionId", "outcome"], false, inputError);
    const executionId = normalizeExecutionId(input.executionId);
    if (input.outcome !== "completed" && input.outcome !== "failed-before-effect") throw inputError();
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      const row = this.#requiredRow(executionId);
      if (row.terminal_outcome !== input.outcome) throw identityMismatchError();
      if (row.state === "lifecycle-finalized") {
        return Object.freeze({ finalized: false, replayed: true, record: toPublicRecord(row) });
      }
      if (
        (input.outcome === "completed" && row.state !== "feedback-staged")
        || (
          input.outcome === "failed-before-effect"
          && row.state !== "failed-before-effect-confirmed"
          && row.state !== "not-dispatched-confirmed"
          && row.state !== "armed-not-dispatched-confirmed"
        )
      ) throw stateError();
      const updated = signJournalRow(this.#integrityKey, {
        ...row,
        state: "lifecycle-finalized",
        lifecycle_finalized_at_ms: nowMs,
        retire_at_ms: safeAdd(nowMs, this.#retentionMs),
        updated_at_ms: nowMs,
      });
      this.#replace(row, updated);
      return Object.freeze({ finalized: true, replayed: false, record: toPublicRecord(updated) });
    });
  }

  /** Bounded restart scan. It returns no tenant, subject, client, payload, or response data. */
  async listRecoveryCandidates(limitInput = 100): Promise<readonly LocalClientReceiptRecoveryCandidate[]> {
    this.#assertRole("gateway");
    const limit = boundedInteger(limitInput, 100, 1, Math.min(this.#maxEntries, 1_000));
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      this.#purgeRetired(nowMs);
      return Object.freeze(this.#listRecoveryRows(limit).map((row) => {
        return Object.freeze({
          ...toPublicRecord(row),
          recoveryAction: recoveryAction(row),
          redispatchAllowed: false as const,
        });
      }));
    });
  }

  /** Internal restart work item. Decryption is gateway-only and never exposed by public status APIs. */
  async getRecoveryWorkItem(executionIdInput: string): Promise<LocalClientReceiptRecoveryWorkItem> {
    this.#assertRole("gateway");
    const executionId = normalizeExecutionId(executionIdInput);
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      this.#purgeRetired(nowMs);
      return this.#toRecoveryWorkItem(this.#requiredRow(executionId));
    });
  }

  /** Bounded internal recovery scan containing decrypted minimum routing/feedback context. */
  async listRecoveryWorkItems(limitInput = 100): Promise<readonly LocalClientReceiptRecoveryWorkItem[]> {
    this.#assertRole("gateway");
    const limit = boundedInteger(limitInput, 100, 1, Math.min(this.#maxEntries, 1_000));
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      this.#purgeRetired(nowMs);
      return Object.freeze(this.#listRecoveryRows(limit).map((row) => this.#toRecoveryWorkItem(row)));
    });
  }

  async checkHealth() {
    const counts = await this.#transaction(() => {
      const nowMs = this.#observeNow();
      this.#purgeRetired(nowMs);
      this.#assertDatabaseHealthy();
      this.#scanRows();
      return this.#countStates();
    }, true);
    return Object.freeze({ ...this.status, ...counts });
  }

  close(): Promise<void> {
    if (this.#lifecycle === "closed" && this.#closePromise) return this.#closePromise;
    if (this.#lifecycle === "closing" && this.#closePromise) return this.#closePromise;
    this.#lifecycle = "closing";
    this.#available = false;
    this.#secureDeleteEnabled = false;
    this.#trustedSchemaDisabled = false;
    this.#defensiveEnabled = false;
    const attempt = Promise.resolve().then(async () => {
      try {
        await this.#protectedCheckpoint?.close();
        this.#db.close();
        this.#lifecycle = "closed";
        this.#closeFailed = false;
      } catch {
        const error = unavailableError();
        this.#lifecycle = "close-failed";
        this.#closeFailed = true;
        this.#markUnavailable(error);
        throw error;
      } finally {
        this.#integrityKey.fill(0);
        this.#protocolKey.fill(0);
        this.#recoveryEncryptionKey?.fill(0);
      }
    });
    this.#closePromise = attempt;
    void attempt.then(
      () => undefined,
      () => {
        if (this.#closePromise === attempt) this.#closePromise = null;
      },
    );
    return attempt;
  }

  #confirmReceipt(receipt: LocalClientDurableExecutionReceipt, nowMs: number) {
    const row = this.#requiredRow(receipt.executionId);
    assertRowMatchesReceipt(row, receipt);
    if (["receipt-confirmed", "feedback-staged", "lifecycle-finalized"].includes(row.state)) {
      if (row.receipt_id !== receipt.receiptId || row.terminal_outcome !== "completed") {
        throw identityMismatchError();
      }
      return Object.freeze({
        confirmed: false,
        replayed: true,
        receipt,
        record: toPublicRecord(row),
      });
    }
    if (row.state !== "armed") throw stateError();
    const updated = signJournalRow(this.#integrityKey, {
      ...row,
      state: "receipt-confirmed",
      terminal_at_ms: receipt.completedAtMs,
      terminal_outcome: "completed",
      receipt_id: receipt.receiptId,
      updated_at_ms: nowMs,
    });
    this.#replace(row, updated);
    return Object.freeze({
      confirmed: true,
      replayed: false,
      receipt,
      record: toPublicRecord(updated),
    });
  }

  #intentFromRow(row: JournalRow): LocalClientDispatchIntent {
    if (row.intent_id === "" || row.dispatch_fencing_token === "0") throw stateError();
    const unsigned: Omit<LocalClientDispatchIntent, "signature"> = Object.freeze({
      protocolVersion: LOCAL_CLIENT_DISPATCH_INTENT_VERSION,
      intentId: row.intent_id,
      executionId: row.execution_id,
      executionBindingHmac: row.execution_binding_hmac,
      tenantBindingHmac: row.tenant_binding_hmac,
      subjectBindingHmac: row.subject_binding_hmac,
      clientBindingHmac: row.client_binding_hmac,
      routeBindingHmac: row.route_binding_hmac,
      identityBindingHmac: row.identity_binding_hmac,
      planFingerprint: row.plan_sha256,
      inputSha256: row.input_sha256,
      dispatchFencingToken: row.dispatch_fencing_token,
      issuedAtMs: row.intent_issued_at_ms,
      expiresAtMs: row.intent_expires_at_ms,
    });
    return Object.freeze({
      ...unsigned,
      signature: signProtocol(this.#protocolKey, "dispatch-intent", unsigned),
    });
  }

  #receiptFromRow(row: JournalRow): LocalClientDurableExecutionReceipt {
    if (row.state !== "completed" || row.terminal_outcome !== "completed") throw stateError();
    const unsigned: Omit<LocalClientDurableExecutionReceipt, "signature"> = Object.freeze({
      protocolVersion: LOCAL_CLIENT_DURABLE_RECEIPT_VERSION,
      receiptId: row.receipt_id,
      intentId: row.intent_id,
      executionId: row.execution_id,
      executionBindingHmac: row.execution_binding_hmac,
      tenantBindingHmac: row.tenant_binding_hmac,
      subjectBindingHmac: row.subject_binding_hmac,
      clientBindingHmac: row.client_binding_hmac,
      routeBindingHmac: row.route_binding_hmac,
      identityBindingHmac: row.identity_binding_hmac,
      planFingerprint: row.plan_sha256,
      inputSha256: row.input_sha256,
      dispatchFencingToken: row.dispatch_fencing_token,
      completedAtMs: row.terminal_at_ms,
      executionMode: "governed",
      externalEffectPerformed: true,
      status: "completed",
    });
    return Object.freeze({
      ...unsigned,
      signature: signProtocol(this.#protocolKey, "durable-receipt", unsigned),
    });
  }

  #encryptRecoveryContext(
    input: LocalClientReceiptReconciliationIdentity,
    bindings: ProtocolBindings,
    dispatchFencingToken: string,
  ): RecoveryCiphertext {
    const key = this.#recoveryEncryptionKey;
    if (!key || this.#role !== "gateway") throw roleError();
    const aad = recoveryAad(bindings, dispatchFencingToken);
    const nonce = randomBytes(RECOVERY_NONCE_BYTES);
    const plaintext = Buffer.from(canonicalJson({
      schema: "local-client-recovery-context-v1",
      tenantId: input.tenantId,
      subjectId: input.subjectId,
      clientId: input.clientId,
      capabilityId: input.capabilityId,
      actionId: input.actionId,
    }), "utf8");
    try {
      const cipher = createCipheriv("aes-256-gcm", key, nonce, {
        authTagLength: RECOVERY_TAG_BYTES,
      });
      cipher.setAAD(Buffer.from(aad, "utf8"));
      const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      const authTag = cipher.getAuthTag();
      return Object.freeze({
        recovery_nonce: nonce.toString("base64url"),
        recovery_ciphertext: ciphertext.toString("base64url"),
        recovery_auth_tag: authTag.toString("base64url"),
        recovery_aad_hmac: keyedDigest(key, "recovery-aad", aad),
      });
    } finally {
      plaintext.fill(0);
      nonce.fill(0);
    }
  }

  #decryptRecoveryContext(row: JournalRow): LocalClientReceiptReconciliationIdentity {
    const key = this.#recoveryEncryptionKey;
    if (!key || this.#role !== "gateway") throw roleError();
    const bindings = bindingsFromRow(row);
    const aad = recoveryAad(bindings, row.dispatch_fencing_token);
    if (!safeDigestEqual(row.recovery_aad_hmac, keyedDigest(key, "recovery-aad", aad))) {
      throw integrityError();
    }
    const nonce = decodeBase64Url(row.recovery_nonce, RECOVERY_NONCE_BYTES);
    const ciphertext = decodeBase64Url(row.recovery_ciphertext, null);
    const authTag = decodeBase64Url(row.recovery_auth_tag, RECOVERY_TAG_BYTES);
    let plaintext: Buffer | null = null;
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, nonce, {
        authTagLength: RECOVERY_TAG_BYTES,
      });
      decipher.setAAD(Buffer.from(aad, "utf8"));
      decipher.setAuthTag(authTag);
      plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      let parsed: unknown;
      try { parsed = JSON.parse(plaintext.toString("utf8")); } catch { throw integrityError(); }
      assertPlainRecord(parsed, integrityError);
      assertExactKeys(parsed, [
        "schema", "tenantId", "subjectId", "clientId", "capabilityId", "actionId",
      ], false, integrityError);
      if (parsed.schema !== "local-client-recovery-context-v1") throw integrityError();
      const identity = Object.freeze({
        executionId: row.execution_id,
        tenantId: boundedOpaqueIdentityForIntegrity(parsed.tenantId),
        subjectId: boundedOpaqueIdentityForIntegrity(parsed.subjectId),
        clientId: boundedOpaqueIdentityForIntegrity(parsed.clientId),
        capabilityId: assertIdentifierForIntegrity(parsed.capabilityId),
        actionId: assertIdentifierForIntegrity(parsed.actionId),
        planFingerprint: row.plan_sha256,
        inputSha256: row.input_sha256,
      });
      assertRowBindings(row, normalizeIdentity(this.#protocolKey, identity));
      return identity;
    } catch {
      throw integrityError();
    } finally {
      nonce.fill(0);
      ciphertext.fill(0);
      authTag.fill(0);
      plaintext?.fill(0);
    }
  }

  #toRecoveryWorkItem(row: JournalRow): LocalClientReceiptRecoveryWorkItem {
    if (row.state === "lifecycle-finalized") throw stateError();
    return Object.freeze({
      ...toPublicRecord(row),
      recoveryAction: recoveryAction(row),
      redispatchAllowed: false as const,
      identity: this.#decryptRecoveryContext(row),
      receiptId: row.receipt_id === "" ? null : row.receipt_id,
      completedAtMs: row.terminal_outcome === "completed" ? row.terminal_at_ms : null,
      intentIssuedAtMs: row.intent_id === "" ? null : row.intent_issued_at_ms,
    });
  }

  #initializeSchema(): void {
    this.#rawTransaction(() => {
      const userVersion = readPragmaInteger(this.#db, "user_version");
      if (
        userVersion !== 0
        && userVersion !== LOCAL_CLIENT_EXECUTION_RECEIPT_RECONCILIATION_SCHEMA_VERSION
      ) throw schemaError();
      this.#db.exec(`
        CREATE TABLE IF NOT EXISTS local_client_execution_receipt_metadata (
          singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
          schema_version INTEGER NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('gateway', 'client')),
          host_binding_hmac TEXT NOT NULL,
          namespace_binding_hmac TEXT NOT NULL,
          integrity_key_binding_hmac TEXT NOT NULL,
          protocol_key_binding_hmac TEXT NOT NULL,
          recovery_key_binding_hmac TEXT NOT NULL,
          max_entries INTEGER NOT NULL CHECK (max_entries > 0),
          retention_ms INTEGER NOT NULL CHECK (retention_ms > 0),
          intent_ttl_ms INTEGER NOT NULL CHECK (intent_ttl_ms > 0),
          query_ttl_ms INTEGER NOT NULL CHECK (query_ttl_ms > 0),
          allowed_clock_skew_ms INTEGER NOT NULL CHECK (allowed_clock_skew_ms >= 0),
          busy_timeout_ms INTEGER NOT NULL CHECK (busy_timeout_ms > 0),
          last_clock_ms INTEGER NOT NULL CHECK (last_clock_ms >= 0),
          last_fencing_token TEXT NOT NULL,
          active_row_count INTEGER NOT NULL CHECK (active_row_count >= 0),
          active_row_xor_hmac TEXT NOT NULL,
          metadata_hmac TEXT NOT NULL
        ) STRICT;
        CREATE TABLE IF NOT EXISTS local_client_execution_receipt_journal (
          record_version INTEGER NOT NULL,
          execution_id TEXT PRIMARY KEY,
          execution_binding_hmac TEXT NOT NULL UNIQUE,
          tenant_binding_hmac TEXT NOT NULL,
          subject_binding_hmac TEXT NOT NULL,
          client_binding_hmac TEXT NOT NULL,
          route_binding_hmac TEXT NOT NULL,
          identity_binding_hmac TEXT NOT NULL UNIQUE,
          plan_sha256 TEXT NOT NULL,
          input_sha256 TEXT NOT NULL,
          state TEXT NOT NULL,
          dispatch_fencing_token TEXT NOT NULL,
          intent_id TEXT NOT NULL,
          intent_issued_at_ms INTEGER NOT NULL CHECK (intent_issued_at_ms >= 0),
          intent_expires_at_ms INTEGER NOT NULL CHECK (intent_expires_at_ms >= 0),
          effect_started_at_ms INTEGER NOT NULL CHECK (effect_started_at_ms >= 0),
          terminal_at_ms INTEGER NOT NULL CHECK (terminal_at_ms >= 0),
          terminal_outcome TEXT NOT NULL CHECK (terminal_outcome IN ('', 'completed', 'failed-before-effect')),
          receipt_id TEXT NOT NULL,
          feedback_staged_at_ms INTEGER NOT NULL CHECK (feedback_staged_at_ms >= 0),
          lifecycle_finalized_at_ms INTEGER NOT NULL CHECK (lifecycle_finalized_at_ms >= 0),
          retire_at_ms INTEGER NOT NULL CHECK (retire_at_ms >= 0),
          created_at_ms INTEGER NOT NULL CHECK (created_at_ms >= 0),
          updated_at_ms INTEGER NOT NULL CHECK (updated_at_ms >= created_at_ms),
          recovery_nonce TEXT NOT NULL,
          recovery_ciphertext TEXT NOT NULL,
          recovery_auth_tag TEXT NOT NULL,
          recovery_aad_hmac TEXT NOT NULL,
          row_hmac TEXT NOT NULL
        ) STRICT;
        CREATE INDEX IF NOT EXISTS local_client_execution_receipt_state_idx
          ON local_client_execution_receipt_journal (state, updated_at_ms);
        CREATE INDEX IF NOT EXISTS local_client_execution_receipt_retire_idx
          ON local_client_execution_receipt_journal (retire_at_ms);
      `);
      this.#assertNoUnknownTargetTriggers();
      const metadata = this.#readMetadata();
      if (userVersion === 0) {
        if (metadata || this.#countRows() !== 0) throw schemaError();
        const initial = this.#createMetadataRow(0, "0", 0, EMPTY_ROW_SET_XOR);
        this.#db.prepare(`
          INSERT INTO local_client_execution_receipt_metadata (
            singleton, schema_version, role, host_binding_hmac,
            namespace_binding_hmac, integrity_key_binding_hmac,
            protocol_key_binding_hmac, recovery_key_binding_hmac,
            max_entries, retention_ms,
            intent_ttl_ms, query_ttl_ms, allowed_clock_skew_ms,
            busy_timeout_ms, last_clock_ms, last_fencing_token,
            active_row_count, active_row_xor_hmac, metadata_hmac
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          METADATA_SINGLETON,
          initial.schema_version,
          initial.role,
          initial.host_binding_hmac,
          initial.namespace_binding_hmac,
          initial.integrity_key_binding_hmac,
          initial.protocol_key_binding_hmac,
          initial.recovery_key_binding_hmac,
          initial.max_entries,
          initial.retention_ms,
          initial.intent_ttl_ms,
          initial.query_ttl_ms,
          initial.allowed_clock_skew_ms,
          initial.busy_timeout_ms,
          initial.last_clock_ms,
          initial.last_fencing_token,
          initial.active_row_count,
          initial.active_row_xor_hmac,
          initial.metadata_hmac,
        );
        this.#db.exec(
          `PRAGMA user_version = ${LOCAL_CLIENT_EXECUTION_RECEIPT_RECONCILIATION_SCHEMA_VERSION}`,
        );
      } else {
        if (!metadata) throw schemaError();
        this.#assertMetadata(metadata);
      }
    });
  }

  #createMetadataRow(
    lastClockMs: number,
    lastFencingToken: string,
    activeRowCount: number,
    activeRowXorHmac: string,
  ): MetadataRow {
    const unsigned = {
      schemaVersion: LOCAL_CLIENT_EXECUTION_RECEIPT_RECONCILIATION_SCHEMA_VERSION,
      role: this.#role,
      hostBindingHmac: this.#hostBindingHmac,
      namespaceBindingHmac: this.#namespaceBindingHmac,
      integrityKeyBindingHmac: this.#integrityKeyBindingHmac,
      protocolKeyBindingHmac: this.#protocolKeyBindingHmac,
      recoveryKeyBindingHmac: this.#recoveryKeyBindingHmac,
      maxEntries: this.#maxEntries,
      retentionMs: this.#retentionMs,
      intentTtlMs: this.#intentTtlMs,
      queryTtlMs: this.#queryTtlMs,
      allowedClockSkewMs: this.#allowedClockSkewMs,
      busyTimeoutMs: this.#busyTimeoutMs,
      lastClockMs,
      lastFencingToken,
      activeRowCount,
      activeRowXorHmac,
    };
    return {
      schema_version: LOCAL_CLIENT_EXECUTION_RECEIPT_RECONCILIATION_SCHEMA_VERSION,
      role: this.#role,
      host_binding_hmac: this.#hostBindingHmac,
      namespace_binding_hmac: this.#namespaceBindingHmac,
      integrity_key_binding_hmac: this.#integrityKeyBindingHmac,
      protocol_key_binding_hmac: this.#protocolKeyBindingHmac,
      recovery_key_binding_hmac: this.#recoveryKeyBindingHmac,
      max_entries: this.#maxEntries,
      retention_ms: this.#retentionMs,
      intent_ttl_ms: this.#intentTtlMs,
      query_ttl_ms: this.#queryTtlMs,
      allowed_clock_skew_ms: this.#allowedClockSkewMs,
      busy_timeout_ms: this.#busyTimeoutMs,
      last_clock_ms: lastClockMs,
      last_fencing_token: lastFencingToken,
      active_row_count: activeRowCount,
      active_row_xor_hmac: activeRowXorHmac,
      metadata_hmac: keyedDigest(this.#integrityKey, "metadata-row", canonicalJson(unsigned)),
    };
  }

  #readMetadata(): MetadataRow | undefined {
    return this.#db.prepare(`
      SELECT schema_version, role, host_binding_hmac, namespace_binding_hmac,
             integrity_key_binding_hmac, protocol_key_binding_hmac,
             recovery_key_binding_hmac, max_entries,
             retention_ms, intent_ttl_ms, query_ttl_ms, allowed_clock_skew_ms,
             busy_timeout_ms, last_clock_ms, last_fencing_token,
             active_row_count, active_row_xor_hmac, metadata_hmac
      FROM local_client_execution_receipt_metadata WHERE singleton = 1
    `).get() as MetadataRow | undefined;
  }

  #assertMetadata(row: MetadataRow): void {
    if (
      row.schema_version !== LOCAL_CLIENT_EXECUTION_RECEIPT_RECONCILIATION_SCHEMA_VERSION
      || (row.role !== "gateway" && row.role !== "client")
      || !isDigest(row.host_binding_hmac)
      || !isDigest(row.namespace_binding_hmac)
      || !isDigest(row.integrity_key_binding_hmac)
      || !isDigest(row.protocol_key_binding_hmac)
      || !isDigest(row.recovery_key_binding_hmac)
      || !isSafePositiveInteger(row.max_entries)
      || !isSafePositiveInteger(row.retention_ms)
      || !isSafePositiveInteger(row.intent_ttl_ms)
      || !isSafePositiveInteger(row.query_ttl_ms)
      || !isSafeNonNegativeInteger(row.allowed_clock_skew_ms)
      || !isSafePositiveInteger(row.busy_timeout_ms)
      || !isSafeNonNegativeInteger(row.last_clock_ms)
      || !isFencingToken(row.last_fencing_token, true)
      || !isSafeNonNegativeInteger(row.active_row_count)
      || row.active_row_count > this.#maxEntries
      || !isDigest(row.active_row_xor_hmac)
      || !isDigest(row.metadata_hmac)
    ) throw integrityError();
    if (
      !safeDigestEqual(row.integrity_key_binding_hmac, this.#integrityKeyBindingHmac)
      || !safeDigestEqual(row.protocol_key_binding_hmac, this.#protocolKeyBindingHmac)
      || !safeDigestEqual(row.recovery_key_binding_hmac, this.#recoveryKeyBindingHmac)
    ) throw keyMismatchError();
    if (!safeDigestEqual(row.host_binding_hmac, this.#hostBindingHmac)) throw hostMismatchError();
    if (
      row.role !== this.#role
      || !safeDigestEqual(row.namespace_binding_hmac, this.#namespaceBindingHmac)
      || row.max_entries !== this.#maxEntries
      || row.retention_ms !== this.#retentionMs
      || row.intent_ttl_ms !== this.#intentTtlMs
      || row.query_ttl_ms !== this.#queryTtlMs
      || row.allowed_clock_skew_ms !== this.#allowedClockSkewMs
      || row.busy_timeout_ms !== this.#busyTimeoutMs
    ) throw configurationError();
    const expected = this.#createMetadataRow(
      row.last_clock_ms,
      row.last_fencing_token,
      row.active_row_count,
      row.active_row_xor_hmac,
    ).metadata_hmac;
    if (!safeDigestEqual(row.metadata_hmac, expected)) throw integrityError();
  }

  #observeNow(): number {
    const nowMs = readClock(this.#now);
    const metadata = this.#readMetadata();
    if (!metadata) throw integrityError();
    this.#assertMetadata(metadata);
    if (nowMs < metadata.last_clock_ms) throw clockError();
    this.#replaceMetadata(metadata, this.#createMetadataRow(
      nowMs,
      metadata.last_fencing_token,
      metadata.active_row_count,
      metadata.active_row_xor_hmac,
    ));
    return nowMs;
  }

  #allocateFencingToken(): string {
    const metadata = this.#readMetadata();
    if (!metadata) throw integrityError();
    this.#assertMetadata(metadata);
    const current = parseFencingToken(metadata.last_fencing_token, true);
    if (current >= MAX_FENCING_TOKEN) throw integrityError();
    const next = String(current + 1n);
    this.#replaceMetadata(metadata, this.#createMetadataRow(
      metadata.last_clock_ms,
      next,
      metadata.active_row_count,
      metadata.active_row_xor_hmac,
    ));
    return next;
  }

  #acceptFencingToken(token: string): void {
    const metadata = this.#readMetadata();
    if (!metadata) throw integrityError();
    this.#assertMetadata(metadata);
    const incoming = parseFencingToken(token, false);
    const current = parseFencingToken(metadata.last_fencing_token, true);
    if (incoming <= current) throw staleFenceError();
    this.#replaceMetadata(metadata, this.#createMetadataRow(
      metadata.last_clock_ms,
      token,
      metadata.active_row_count,
      metadata.active_row_xor_hmac,
    ));
  }

  #replaceMetadata(previous: MetadataRow, updated: MetadataRow): void {
    const result = this.#db.prepare(`
      UPDATE local_client_execution_receipt_metadata
      SET last_clock_ms = ?, last_fencing_token = ?, active_row_count = ?,
          active_row_xor_hmac = ?, metadata_hmac = ?
      WHERE singleton = ? AND metadata_hmac = ?
    `).run(
      updated.last_clock_ms,
      updated.last_fencing_token,
      updated.active_row_count,
      updated.active_row_xor_hmac,
      updated.metadata_hmac,
      METADATA_SINGLETON,
      previous.metadata_hmac,
    );
    if (Number(result.changes) !== 1) throw integrityError();
  }

  #select(executionId: string): JournalRow | undefined {
    return this.#db.prepare(`${selectJournalFields()} WHERE execution_id = ?`)
      .get(executionId) as JournalRow | undefined;
  }

  #requiredRow(executionId: string): JournalRow {
    const row = this.#select(executionId);
    if (!row) throw notFoundError();
    return this.#decodeRow(row);
  }

  #decodeRow(row: JournalRow): JournalRow {
    validateJournalRow(row);
    const expected = digestJournalRow(this.#integrityKey, { ...row, row_hmac: "" });
    if (!safeDigestEqual(row.row_hmac, expected)) throw integrityError();
    const allowed = this.#role === "gateway" ? GATEWAY_STATES : CLIENT_STATES;
    if (!allowed.has(row.state)) throw integrityError();
    if (this.#role === "gateway") this.#decryptRecoveryContext(row);
    return row;
  }

  #insert(row: JournalRow): void {
    const result = this.#db.prepare(`
      INSERT INTO local_client_execution_receipt_journal (
        record_version, execution_id, execution_binding_hmac,
        tenant_binding_hmac, subject_binding_hmac, client_binding_hmac,
        route_binding_hmac, identity_binding_hmac, plan_sha256, input_sha256,
        state, dispatch_fencing_token, intent_id, intent_issued_at_ms,
        intent_expires_at_ms, effect_started_at_ms, terminal_at_ms,
        terminal_outcome, receipt_id, feedback_staged_at_ms,
        lifecycle_finalized_at_ms, retire_at_ms, created_at_ms, updated_at_ms,
        recovery_nonce, recovery_ciphertext, recovery_auth_tag,
        recovery_aad_hmac, row_hmac
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(...journalRowValues(row));
    if (Number(result.changes) !== 1) throw integrityError();
    this.#applyAuthenticatedRowSetDelta([], [row]);
  }

  #replace(previous: JournalRow, updated: JournalRow): void {
    const result = this.#db.prepare(`
      UPDATE local_client_execution_receipt_journal SET
        execution_binding_hmac = ?, tenant_binding_hmac = ?,
        subject_binding_hmac = ?, client_binding_hmac = ?, route_binding_hmac = ?,
        identity_binding_hmac = ?, plan_sha256 = ?, input_sha256 = ?, state = ?,
        dispatch_fencing_token = ?, intent_id = ?, intent_issued_at_ms = ?,
        intent_expires_at_ms = ?, effect_started_at_ms = ?, terminal_at_ms = ?,
        terminal_outcome = ?, receipt_id = ?, feedback_staged_at_ms = ?,
        lifecycle_finalized_at_ms = ?, retire_at_ms = ?, created_at_ms = ?,
        updated_at_ms = ?, recovery_nonce = ?, recovery_ciphertext = ?,
        recovery_auth_tag = ?, recovery_aad_hmac = ?, row_hmac = ?
      WHERE execution_id = ? AND state = ? AND row_hmac = ?
    `).run(
      updated.execution_binding_hmac,
      updated.tenant_binding_hmac,
      updated.subject_binding_hmac,
      updated.client_binding_hmac,
      updated.route_binding_hmac,
      updated.identity_binding_hmac,
      updated.plan_sha256,
      updated.input_sha256,
      updated.state,
      updated.dispatch_fencing_token,
      updated.intent_id,
      updated.intent_issued_at_ms,
      updated.intent_expires_at_ms,
      updated.effect_started_at_ms,
      updated.terminal_at_ms,
      updated.terminal_outcome,
      updated.receipt_id,
      updated.feedback_staged_at_ms,
      updated.lifecycle_finalized_at_ms,
      updated.retire_at_ms,
      updated.created_at_ms,
      updated.updated_at_ms,
      updated.recovery_nonce,
      updated.recovery_ciphertext,
      updated.recovery_auth_tag,
      updated.recovery_aad_hmac,
      updated.row_hmac,
      previous.execution_id,
      previous.state,
      previous.row_hmac,
    );
    if (Number(result.changes) !== 1) throw integrityError();
    this.#applyAuthenticatedRowSetDelta([previous], [updated]);
  }

  #purgeRetired(nowMs: number): void {
    // Client terminal evidence has no authenticated gateway ACK yet. Never
    // auto-delete it merely because wall-clock retention elapsed.
    if (this.#role === "client") return;
    let cursor = "";
    let visited = 0;
    const select = this.#db.prepare(`
      ${selectJournalFields()}
      WHERE retire_at_ms > 0 AND retire_at_ms <= ? AND execution_id > ?
      ORDER BY execution_id COLLATE BINARY ASC LIMIT ?
    `);
    const remove = this.#db.prepare(`
      DELETE FROM local_client_execution_receipt_journal
      WHERE execution_id = ? AND row_hmac = ?
    `);
    while (true) {
      const batch: JournalRow[] = [];
      for (const raw of select.iterate(nowMs, cursor, ROW_SCAN_BATCH_SIZE) as Iterable<JournalRow>) {
        batch.push(this.#decodeRow(raw));
      }
      if (batch.length === 0) break;
      visited += batch.length;
      if (visited > this.#maxEntries) throw integrityError();
      for (const row of batch) {
        const purgeable = row.state === "lifecycle-finalized";
        if (!purgeable) throw integrityError();
        const result = remove.run(row.execution_id, row.row_hmac);
        if (Number(result.changes) !== 1) throw integrityError();
      }
      this.#applyAuthenticatedRowSetDelta(batch, []);
      cursor = batch.at(-1)!.execution_id;
      if (batch.length < ROW_SCAN_BATCH_SIZE) break;
    }
  }

  #assertCapacity(): void {
    const metadata = this.#readMetadata();
    if (!metadata) throw integrityError();
    this.#assertMetadata(metadata);
    if (metadata.active_row_count >= this.#maxEntries) throw capacityError();
  }

  #countRows(): number {
    const row = this.#db.prepare(
      "SELECT COUNT(*) AS count FROM local_client_execution_receipt_journal",
    ).get() as { count?: unknown } | undefined;
    const count = Number(row?.count);
    if (!Number.isSafeInteger(count) || count < 0 || count > MAX_ENTRIES) throw integrityError();
    return count;
  }

  #applyAuthenticatedRowSetDelta(
    removed: readonly JournalRow[],
    added: readonly JournalRow[],
  ): void {
    const metadata = this.#readMetadata();
    if (!metadata) throw integrityError();
    this.#assertMetadata(metadata);
    let count = metadata.active_row_count;
    let accumulator = metadata.active_row_xor_hmac;
    for (const row of removed) {
      if (count <= 0) throw integrityError();
      count -= 1;
      accumulator = xorDigests(accumulator, rowSetMemberDigest(this.#integrityKey, row));
    }
    for (const row of added) {
      if (count >= this.#maxEntries) throw capacityError();
      count += 1;
      accumulator = xorDigests(accumulator, rowSetMemberDigest(this.#integrityKey, row));
    }
    this.#replaceMetadata(metadata, this.#createMetadataRow(
      metadata.last_clock_ms,
      metadata.last_fencing_token,
      count,
      accumulator,
    ));
  }

  #assertAuthenticatedRowSet(): void {
    const metadata = this.#readMetadata();
    if (!metadata) throw integrityError();
    this.#assertMetadata(metadata);
    const statement = this.#db.prepare(`
      ${selectJournalFields()}
      WHERE execution_id > ?
      ORDER BY execution_id COLLATE BINARY ASC LIMIT ?
    `);
    let cursor = "";
    let count = 0;
    let accumulator = EMPTY_ROW_SET_XOR;
    while (true) {
      let batchCount = 0;
      let nextCursor = cursor;
      for (const raw of statement.iterate(cursor, ROW_SCAN_BATCH_SIZE) as Iterable<JournalRow>) {
        const row = this.#decodeRow(raw);
        batchCount += 1;
        count += 1;
        if (count > this.#maxEntries) throw integrityError();
        accumulator = xorDigests(accumulator, rowSetMemberDigest(this.#integrityKey, row));
        nextCursor = row.execution_id;
      }
      if (batchCount === 0) break;
      if (nextCursor <= cursor) throw integrityError();
      cursor = nextCursor;
      if (batchCount < ROW_SCAN_BATCH_SIZE) break;
    }
    if (
      count !== metadata.active_row_count
      || !safeDigestEqual(accumulator, metadata.active_row_xor_hmac)
    ) throw integrityError();
  }

  #listRecoveryRows(limit: number): JournalRow[] {
    const rows: JournalRow[] = [];
    const statement = this.#db.prepare(`
      ${selectJournalFields()}
      WHERE state <> 'lifecycle-finalized'
      ORDER BY updated_at_ms ASC, execution_id COLLATE BINARY ASC
      LIMIT ?
    `);
    for (const raw of statement.iterate(limit) as Iterable<JournalRow>) {
      rows.push(this.#decodeRow(raw));
      if (rows.length > limit) throw integrityError();
    }
    return rows;
  }

  #assertNoUnknownTargetTriggers(): void {
    const statement = this.#db.prepare(`
      SELECT name FROM sqlite_schema
      WHERE type = 'trigger' AND tbl_name IN (?, ?)
      ORDER BY name COLLATE BINARY ASC LIMIT 1
    `);
    for (const _row of statement.iterate(TARGET_TABLES[0], TARGET_TABLES[1])) {
      throw integrityError();
    }
  }

  #assertRuntimeHardening(): void {
    const secureDelete = readPragmaIntegerValue(this.#db, "secure_delete");
    const trustedSchema = readPragmaIntegerValue(this.#db, "trusted_schema");
    const foreignKeys = readPragmaIntegerValue(this.#db, "foreign_keys");
    this.#secureDeleteEnabled = secureDelete === 1;
    this.#trustedSchemaDisabled = trustedSchema === 0;
    if (!this.#secureDeleteEnabled || !this.#trustedSchemaDisabled || foreignKeys !== 1) {
      throw integrityError();
    }
  }

  #markUnavailable(error: LocalClientExecutionReceiptReconciliationError): void {
    this.#available = false;
    this.#lastFailureCode = error.code;
    if (this.#failureCount < Number.MAX_SAFE_INTEGER) this.#failureCount += 1;
  }

  #countStates(): Readonly<{ entries: number; unresolvedEntries: number; terminalEntries: number }> {
    const statement = this.#db.prepare(`
      SELECT state, COUNT(*) AS count
      FROM local_client_execution_receipt_journal GROUP BY state
    `);
    let entries = 0;
    let unresolvedEntries = 0;
    let terminalEntries = 0;
    for (const row of statement.iterate() as Iterable<{ state?: unknown; count?: unknown }>) {
      const state = String(row.state ?? "") as LocalClientReceiptJournalState;
      const count = Number(row.count);
      if (!Number.isSafeInteger(count) || count < 0) throw integrityError();
      const allowed = this.#role === "gateway" ? GATEWAY_STATES : CLIENT_STATES;
      if (!allowed.has(state)) throw integrityError();
      entries += count;
      const terminal = this.#role === "gateway"
        ? state === "lifecycle-finalized"
        : state === "completed" || state === "failed-before-effect";
      if (terminal) terminalEntries += count;
      else unresolvedEntries += count;
    }
    if (entries > this.#maxEntries) throw integrityError();
    return Object.freeze({ entries, unresolvedEntries, terminalEntries });
  }

  #scanRows(): void {
    this.#assertAuthenticatedRowSet();
  }

  #assertDatabaseHealthy(): void {
    let count = 0;
    for (const row of this.#db.prepare("PRAGMA quick_check").iterate() as Iterable<Record<string, unknown>>) {
      count += 1;
      if (count > 1 || String(row.quick_check ?? "").toLowerCase() !== "ok") throw integrityError();
    }
    if (count !== 1) throw integrityError();
    const metadata = this.#readMetadata();
    if (!metadata) throw schemaError();
    this.#assertMetadata(metadata);
  }

  async #transaction<T>(operation: () => T, allowRecovery = false): Promise<T> {
    this.#assertOpen();
    if (!this.#available && !allowRecovery) throw unavailableError();
    try {
      const checked = () => {
        this.#assertRuntimeHardening();
        this.#assertNoUnknownTargetTriggers();
        this.#assertAuthenticatedRowSet();
        const value = operation();
        this.#assertNoUnknownTargetTriggers();
        this.#assertAuthenticatedRowSet();
        this.#assertRuntimeHardening();
        return value;
      };
      const result = this.#protectedCheckpoint
        ? await this.#protectedCheckpoint.run(checked)
        : this.#rawTransaction(checked);
      this.#available = true;
      return result;
    } catch (error) {
      const mapped = isKnownError(error) ? error : unavailableError();
      if (isDurabilityOrIntegrityFailure(mapped)) this.#markUnavailable(mapped);
      throw mapped;
    }
  }

  #rawTransaction<T>(operation: () => T): T {
    let began = false;
    try {
      this.#db.exec("BEGIN IMMEDIATE");
      began = true;
      const result = operation();
      this.#db.exec("COMMIT");
      return result;
    } catch (error) {
      if (began) {
        try {
          this.#db.exec("ROLLBACK");
        } catch {
          throw unavailableError();
        }
      }
      throw error;
    }
  }

  #assertRole(expected: LocalClientReceiptJournalRole): void {
    if (this.#role !== expected) throw roleError();
  }

  #assertOpen(): void {
    if (this.#lifecycle !== "open") throw closedError();
  }
}

export function createLocalClientSqliteExecutionReceiptJournal(
  options: LocalClientSqliteExecutionReceiptJournalOptions,
): LocalClientSqliteExecutionReceiptJournal {
  return new LocalClientSqliteExecutionReceiptJournal(options);
}

