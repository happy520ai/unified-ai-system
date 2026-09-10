import { createHash, randomUUID } from "node:crypto";
import { chmodSync, closeSync, existsSync, fstatSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join, parse, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { WorkflowRunInspection, WorkflowRunResponse, WorkflowRunStatus } from "@unified-ai-system/shared-contracts";

const APPLICATION_ID = 0x55415746;
const MAX_RECORD_BYTES = 2 * 1024 * 1024;
const MAX_RUNS = 10_000;
const STATES = new Set(["running", "prepared", "publishing", "completed", "failed", "cancelled", "interrupted", "unknown"]);
type Json = Record<string, unknown>;
export type WorkflowScope = { tenantId?: unknown; userId?: unknown; tenantScopeIdentity?: { userId?: unknown } | null; workflowGovernancePending?: boolean };
export type WorkflowDraft = {
  stagingName: string; device: string; inode: string; birthtime: string; bytes: number; sha256: string;
  requestedName: string; result: Omit<WorkflowRunResponse, "artifact">;
  target?: WorkflowPublicationTarget;
};
export type WorkflowPublicationTarget = { fileName: string; rootFingerprint: string; tenantFingerprint: string; fingerprint: string };
export type WorkflowPublicationAuthorization = {
  version: 1; agentId: string; policyHash: string; subjectFingerprint: string; workflowId: string; inputHash: string;
  argumentsHash: string; contentHash: string; contentBytes: number; targetFingerprint: string;
  decision: "allow" | "require_approval"; approvalId: string | null;
};
export type WorkflowPublicationMaterial = {
  workflowId: string; inputHash: string; subjectFingerprint: string; tenantPartition: string; requestedName: string;
  target: WorkflowPublicationTarget; contentHash: string; contentBytes: number; content: string | null;
};
export type WorkflowExecutionCallbacks = {
  beforePublish(material: WorkflowPublicationMaterial): Promise<{ authorization: WorkflowPublicationAuthorization; assertActive(): Promise<unknown> }>;
  beforeReplay(material: Omit<WorkflowPublicationMaterial, "content"> & {
    authorization?: WorkflowPublicationAuthorization; governancePending: boolean;
  }): Promise<void>;
};
type StoredRun = {
  version: 1 | 2; workflowId: string; scopeKey: string; inputSha256: string; request: Json;
  status: WorkflowRunStatus; stage: "knowledge.retrieve" | "report.compose" | "artifact.write";
  attempt: number; claimId: string; leaseUntil: number; createdAt: number; updatedAt: number;
  draft: WorkflowDraft | null; publication: { fileName: string; authorization?: WorkflowPublicationAuthorization } | null; result: WorkflowRunResponse | null;
  governancePending: boolean; recoveryVerified: boolean; reconciliation: { status: "verified" | "unresolved"; at: string } | null;
  error: { code: string; attempt: number; at: string; approvalId?: string } | null;
  history: Array<{ code: string; attempt: number; at: string; approvalId?: string }>;
};
export type WorkflowClaim = { key: string; claimId: string; record: StoredRun; replayed: boolean };
type Identity = { path: string; dev: bigint; ino: bigint };

/** A workflow-specific, single-host journal. No background dispatcher and no
 * generic job framework. Connections are operation-scoped, including recovery.
 * The publication intent commits BEFORE the filesystem effect; the subsequent
 * IMMEDIATE transaction fences that effect against every competing owner. */
export class DurableWorkflowRunStore {
  readonly root: string;
  readonly #clock: () => number;
  readonly #leaseMs: number;
  readonly #onInitialization?: () => void;
  #rootIdentity: Identity | null = null;
  #healthState: "unverified" | "ready" | "degraded" = "unverified";
  #healthError: string | null = null;
  #writeFailureObserved = false;

  constructor(root: string, options: { clock?: () => number; leaseMs?: number; onInitialization?: () => void } = {}) {
    this.root = resolve(root);
    if (this.root.startsWith("\\\\") || this.root.startsWith("//") || this.root === parse(this.root).root) throw unsafeStatePath();
    this.#clock = options.clock ?? Date.now;
    this.#leaseMs = options.leaseMs ?? 120_000;
    this.#onInitialization = options.onInitialization;
    if (!Number.isSafeInteger(this.#leaseMs) || this.#leaseMs < 1_000 || this.#leaseMs > 600_000) {
      throw workflowStateError("CONFIG_INVALID", "Workflow lease must be between 1 and 600 seconds.", 400);
    }
  }

  getHealth() {
    return { storageMode: "single-host-sqlite", initialization: "lazy-on-run", state: this.#healthState,
      lastErrorCode: this.#healthError, automaticRedispatch: false };
  }

  observeFailure(error: unknown, write = true): unknown {
    const safe = normalizeStoreError(error);
    const code = (safe as { code?: string }).code ?? "WORKFLOW_STATE_UNAVAILABLE";
    if (/^WORKFLOW_(?:STATE_|OUTPUT_PATH_UNSAFE|STORAGE_FULL|STAGING_CAPACITY|INITIALIZATION_CAPACITY)/.test(code)) {
      this.#healthState = "degraded"; this.#healthError = code; this.#writeFailureObserved ||= write;
    }
    return safe;
  }
  #observedSuccess(write: boolean): void {
    if (this.#healthState === "degraded" && this.#writeFailureObserved && !write) return;
    this.#healthState = "ready"; this.#healthError = null; this.#writeFailureObserved = false;
  }

  claim(workflowId: unknown, request: Json, scope: WorkflowScope): WorkflowClaim {
    const id = validateWorkflowId(workflowId);
    const scopeKey = ownerScope(scope);
    const key = hash(JSON.stringify([scopeKey, id]));
    const inputSha256 = hash(JSON.stringify(request));
    return this.#write(db => {
      const previous = this.#read(db, key);
      const now = this.#now();
      if (previous) {
        if (previous.inputSha256 !== inputSha256) throw workflowStateError("INPUT_CONFLICT", "This workflow ID already belongs to different input.");
        if (previous.status === "completed") return { key, claimId: previous.claimId, record: previous, replayed: true };
        if (canRecheckGovernance(previous) && previous.result && scope.workflowGovernancePending === true) {
          // Only the existing governed wrapper may replay the stored response
          // after explicit reconciliation. No claim is renewed and no action runs.
          return { key, claimId: previous.claimId, record: previous, replayed: true };
        }
        if (previous.publication || previous.status === "unknown") throw unknownOutcome(id);
        if ((previous.status === "running" || previous.status === "prepared") && previous.leaseUntil > now) {
          throw workflowStateError("BUSY", "This workflow still has an active execution claim.");
        }
        if (previous.attempt >= 32) throw workflowStateError("ATTEMPT_LIMIT", "Workflow attempt capacity is exhausted.");
      } else if (Number((db.prepare("SELECT count(*) AS count FROM workflow_runs").get() as { count: number }).count) >= MAX_RUNS) {
        throw workflowStateError("CAPACITY", "Workflow history is full; existing evidence was preserved.", 503);
      }
      const record: StoredRun = previous ?? {
        version: 1, workflowId: id, scopeKey, inputSha256, request, status: "running", stage: "knowledge.retrieve",
        attempt: 0, claimId: "", leaseUntil: 0, createdAt: now, updatedAt: now,
        draft: null, publication: null, result: null, governancePending: scope.workflowGovernancePending === true, recoveryVerified: false, reconciliation: null, error: null, history: [],
      };
      if (previous && (previous.status === "running" || previous.status === "prepared")) {
        this.#recordError(record, "WORKFLOW_RUN_INTERRUPTED");
      }
      record.status = record.draft ? "prepared" : "running";
      record.governancePending ||= scope.workflowGovernancePending === true;
      record.claimId = randomUUID(); record.attempt += 1; record.leaseUntil = now + this.#leaseMs; record.updatedAt = now;
      record.error = null;
      this.#save(db, key, record);
      return { key, claimId: record.claimId, record, replayed: false };
    });
  }

  prepare(claim: WorkflowClaim, draft: WorkflowDraft): void {
    validateDraft(draft);
    this.#write(db => {
      const record = this.#owned(db, claim);
      if (record.publication) throw unknownOutcome(record.workflowId);
      record.draft = draft; record.status = "prepared"; record.stage = "artifact.write";
      this.#save(db, claim.key, record);
    });
  }

  composing(claim: WorkflowClaim): void {
    this.#write(db => { const record = this.#owned(db, claim); record.stage = "report.compose"; this.#save(db, claim.key, record); });
  }

  async discardUnregistered(claim: WorkflowClaim, draft: WorkflowDraft, discard: () => Promise<void>): Promise<void> {
    await this.#writeAsync(async db => {
      const record = this.#read(db, claim.key);
      // A failed prepare COMMIT may actually have succeeded. Keep any inode
      // already named by durable state; cleanup never guesses from an error.
      if (record?.draft?.stagingName === draft.stagingName && record.draft.inode === draft.inode && record.draft.device === draft.device) return;
      await discard();
    });
  }

  bindPublicationTarget(claim: WorkflowClaim, target: WorkflowPublicationTarget): WorkflowPublicationTarget {
    validateTarget(target);
    return this.#write(db => {
      const record = this.#owned(db, claim);
      if (!record.draft || record.publication || record.status !== "prepared") throw unknownOutcome(record.workflowId);
      if (record.draft.target && JSON.stringify(record.draft.target) !== JSON.stringify(target)) {
        throw workflowStateError("TARGET_CHANGED", "The prepared workflow target cannot change after review binding.");
      }
      // Older readers reject v2 instead of ignoring its frozen-target contract.
      record.version = 2; record.draft.target = { ...target }; this.#save(db, claim.key, record);
      return { ...target };
    });
  }

  intendPublication(claim: WorkflowClaim, fileName: string, authorization?: WorkflowPublicationAuthorization): void {
    assertFileName(fileName);
    this.#write(db => {
      const record = this.#owned(db, claim);
      if (!record.draft || record.status !== "prepared" || record.publication) throw unknownOutcome(record.workflowId);
      if (record.governancePending && !authorization) throw workflowStateError("ORIGINAL_AUTHORIZATION_UNVERIFIED", "Publication requires the original governed authorization receipt.");
      if (authorization) validateAuthorization(authorization, record);
      if (record.draft.target && record.draft.target.fileName !== fileName) throw invalidState();
      record.publication = { fileName, ...(authorization ? { authorization: { ...authorization } } : {}) }; record.status = "publishing";
      this.#save(db, claim.key, record);
    });
  }

  async publish(claim: WorkflowClaim, effect: (draft: WorkflowDraft, fileName: string) => Promise<WorkflowRunResponse>): Promise<WorkflowRunResponse> {
    return this.#writeAsync(async db => {
      const record = this.#owned(db, claim);
      if (record.status !== "publishing" || !record.draft || !record.publication) throw unknownOutcome(record.workflowId);
      // This write transaction remains held over link()/readback. A stale worker
      // cannot pass a separate preflight and publish after recovery took over.
      const result = await effect(record.draft, record.publication.fileName);
      record.result = result; record.status = record.governancePending ? "unknown" : "completed"; record.leaseUntil = 0; record.error = null;
      if (record.governancePending) this.#recordError(record, "WORKFLOW_POST_WRITE_GOVERNANCE_PENDING");
      record.reconciliation = { status: "verified", at: new Date(this.#now()).toISOString() };
      this.#save(db, claim.key, record);
      return result;
    });
  }

  rejectCollision(claim: WorkflowClaim): void {
    this.#write(db => {
      const record = this.#owned(db, claim);
      if (record.status !== "publishing") throw unknownOutcome(record.workflowId);
      // link(EEXIST) proves that this attempt made no new directory entry.
      record.publication = null; record.status = "prepared";
      this.#save(db, claim.key, record);
    });
  }

  fail(claim: WorkflowClaim, error: unknown, cancelled: boolean): void {
    this.#write(db => {
      const record = this.#read(db, claim.key);
      if (!record || record.claimId !== claim.claimId || record.status === "completed") return;
      record.status = record.publication ? "unknown" : cancelled ? "cancelled" : "failed";
      record.leaseUntil = 0;
      const code = (error as { code?: unknown })?.code;
      this.#recordError(record, cancelled ? "WORKFLOW_RUN_CANCELLED" : typeof code === "string"
        && (/^WORKFLOW_[A-Z_]+$/.test(code) || ["TOOL_APPROVAL_REQUIRED", "APPROVAL_REVIEW_UNAVAILABLE"].includes(code)) ? code : "WORKFLOW_EXECUTION_FAILED",
        !cancelled && code === "TOOL_APPROVAL_REQUIRED" ? (error as { details?: { approvalId?: unknown } })?.details?.approvalId : undefined);
      if ((error as { cleanupError?: unknown })?.cleanupError) this.#recordError(record, "WORKFLOW_STAGING_CLEANUP_REQUIRED");
      this.#save(db, claim.key, record);
    });
  }

  markGovernanceUncertain(workflowId: unknown, scope: WorkflowScope): void {
    const key = hash(JSON.stringify([ownerScope(scope), validateWorkflowId(workflowId)]));
    this.#write(db => {
      const record = this.#read(db, key);
      if (!record || !record.publication || !record.result) throw notFound();
      record.governancePending = true; record.status = "unknown";
      record.recoveryVerified = false;
      this.#recordError(record, "WORKFLOW_POST_WRITE_GOVERNANCE_UNCERTAIN"); this.#save(db, key, record);
    });
  }

  confirmGovernanceComplete(workflowId: unknown, scope: WorkflowScope, deliveredResult: object): void {
    const key = hash(JSON.stringify([ownerScope(scope), validateWorkflowId(workflowId)]));
    this.#write(db => {
      const record = this.#read(db, key);
      if (!record || !record.result || record.reconciliation?.status !== "verified") throw unknownOutcome(String(workflowId));
      if (record.governancePending && !record.publication?.authorization) {
        throw workflowStateError("ORIGINAL_AUTHORIZATION_UNVERIFIED", "The original publication authorization remains unverified.");
      }
      const safeResult = deliveredResult as WorkflowRunResponse;
      if (safeResult.workflowId !== record.workflowId || safeResult.status !== "completed" || safeResult.artifact?.sha256 !== record.result.artifact.sha256) throw invalidState();
      // History must expose the metered/delivered response, never the fuller
      // intermediate result retained privately for crash reconciliation.
      record.result = safeResult;
      record.governancePending = false; record.status = "completed"; record.error = null;
      this.#save(db, key, record);
    });
  }

  inspect(workflowId: unknown, scope: WorkflowScope): WorkflowRunInspection {
    const key = hash(JSON.stringify([ownerScope(scope), validateWorkflowId(workflowId)]));
    const db = this.#open(false);
    if (!db) throw notFound();
    try { const record = this.#read(db, key); this.#observedSuccess(false); if (!record) throw notFound(); return this.#project(record); }
    catch (error) { throw this.observeFailure(error, false); }
    finally { db.close(); }
  }

  async verifyCompletedArtifact(workflowId: unknown, scope: WorkflowScope,
    reconcile: (draft: WorkflowDraft, fileName: string) => Promise<WorkflowRunResponse | null>): Promise<WorkflowRunResponse> {
    const key = hash(JSON.stringify([ownerScope(scope), validateWorkflowId(workflowId)]));
    const db = this.#open(false);
    if (!db) throw notFound();
    let record: StoredRun | null;
    try { record = this.#read(db, key); } finally { db.close(); }
    if (!record) throw notFound();
    if (record.status !== "completed" || record.governancePending || !record.draft || !record.publication || !record.result) {
      throw workflowStateError("ARTIFACT_NOT_VERIFIED", "A completed governed workflow receipt is required.");
    }
    const verified = await reconcile(record.draft, record.publication.fileName);
    if (!verified || JSON.stringify(verified.artifact) !== JSON.stringify(record.result.artifact)) {
      throw workflowStateError("ARTIFACT_NOT_VERIFIED", "The current artifact does not match its recorded publication.");
    }
    return record.result;
  }

  list(scope: WorkflowScope, limit = 50): { runs: WorkflowRunInspection[] } {
    const scopeKey = ownerScope(scope);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw workflowStateError("LIMIT_INVALID", "Workflow list limit must be 1–100.", 400);
    const db = this.#open(false);
    if (!db) return { runs: [] };
    try {
      const rows = db.prepare("SELECT run_key FROM workflow_runs WHERE scope_key = ? ORDER BY updated_at DESC, run_key LIMIT ?").all(scopeKey, limit);
      const runs = rows.map(row => this.#project(this.#read(db, String(row.run_key))!, false));
      this.#observedSuccess(false); return { runs };
    } catch (error) { throw this.observeFailure(error, false);
    } finally { db.close(); }
  }

  async recover(workflowId: unknown, scope: WorkflowScope,
    reconcile: (draft: WorkflowDraft, fileName: string) => Promise<WorkflowRunResponse | null>): Promise<WorkflowRunInspection> {
    const key = hash(JSON.stringify([ownerScope(scope), validateWorkflowId(workflowId)]));
    // Do not initialize persistent state on an unknown recovery request.
    this.inspect(workflowId, scope);
    return this.#writeAsync(async db => {
      const record = this.#read(db, key);
      if (!record) throw notFound();
      if (record.status === "completed") return this.#project(record);
      if (!record.publication) {
        if ((record.status === "running" || record.status === "prepared") && record.leaseUntil <= this.#now()) {
          record.status = "interrupted"; record.leaseUntil = 0;
          this.#recordError(record, "WORKFLOW_RUN_INTERRUPTED"); this.#save(db, key, record);
        }
        return this.#project(record);
      }
      const result = record.draft ? await reconcile(record.draft, record.publication.fileName) : null;
      record.leaseUntil = 0;
      record.recoveryVerified = Boolean(result) && (!record.governancePending || Boolean(record.publication.authorization));
      record.reconciliation = { status: result ? "verified" : "unresolved", at: new Date(this.#now()).toISOString() };
      if (result && !record.governancePending) { record.status = "completed"; record.result = result; record.error = null; }
      else if (result) {
        record.status = "unknown"; record.result = result;
        if (!record.publication.authorization) this.#recordError(record, "WORKFLOW_ORIGINAL_AUTHORIZATION_UNVERIFIED");
      }
      else { record.status = "unknown"; this.#recordError(record, "WORKFLOW_ARTIFACT_RECONCILIATION_REQUIRED"); }
      this.#save(db, key, record);
      return this.#project(record);
    });
  }

  #owned(db: DatabaseSync, claim: WorkflowClaim): StoredRun {
    const record = this.#read(db, claim.key);
    if (!record || record.claimId !== claim.claimId || record.leaseUntil <= this.#now()) {
      throw workflowStateError("CLAIM_EXPIRED", "The workflow execution claim is no longer active.");
    }
    return record;
  }
  #recordError(record: StoredRun, code: string, approvalId?: unknown): void {
    record.error = { code, attempt: record.attempt, at: new Date(this.#now()).toISOString(),
      ...(typeof approvalId === "string" && /^appr_[A-Za-z0-9_-]{1,128}$/u.test(approvalId) ? { approvalId } : {}) };
    if (record.history.length < 64) record.history.push(record.error);
  }
  #project(record: StoredRun, includeResult = true): WorkflowRunInspection {
    return {
      workflowId: record.workflowId, status: record.status, stage: record.stage, attempt: record.attempt,
      request: record.request, createdAt: new Date(record.createdAt).toISOString(), updatedAt: new Date(record.updatedAt).toISOString(),
      leaseExpiresAt: record.leaseUntil ? new Date(record.leaseUntil).toISOString() : null,
      canResume: canRecheckGovernance(record) || !record.publication && record.status !== "completed" && record.leaseUntil <= this.#now(),
      resumeAction: canRecheckGovernance(record) ? "recheck-governance-only" : !record.publication && record.status !== "completed" && record.leaseUntil <= this.#now() ? "run-safe-remaining-stages" : null,
      outcomeUnknown: Boolean(record.publication && record.status !== "completed"),
      error: record.error, history: record.history, reconciliation: record.reconciliation,
      ...(includeResult && record.result && !record.governancePending ? { result: record.result } : {}),
      persistence: { storageMode: "single-host-sqlite", automaticRedispatch: false, artifactInspection: "recorded-outcome" },
    };
  }
  #read(db: DatabaseSync, key: string): StoredRun | null {
    const row = db.prepare("SELECT data, digest, scope_key FROM workflow_runs WHERE run_key = ?").get(key);
    if (!row) return null;
    if (typeof row.data !== "string" || Buffer.byteLength(row.data) > MAX_RECORD_BYTES || hash(row.data) !== row.digest) throw invalidState();
    let value: StoredRun;
    try { value = JSON.parse(row.data); } catch { throw invalidState(); }
    if (![1, 2].includes(value.version) || value.scopeKey !== row.scope_key || !STATES.has(value.status)
      || !value.request || typeof value.request !== "object" || Array.isArray(value.request)
      || hash(JSON.stringify(value.request)) !== value.inputSha256 || typeof value.governancePending !== "boolean" || typeof value.recoveryVerified !== "boolean"
      || hash(JSON.stringify([value.scopeKey, validateWorkflowId(value.workflowId)])) !== key
      || !Number.isInteger(value.attempt) || value.attempt < 1 || !Number.isFinite(value.leaseUntil)
      || !Number.isFinite(value.createdAt) || !Number.isFinite(value.updatedAt) || !Array.isArray(value.history)
      || value.history.length > 64 || (value.status === "completed" && !value.result)) throw invalidState();
    if (value.draft) validateDraft(value.draft);
    if (value.version === 2 && !value.draft?.target
      || value.version === 1 && (value.draft?.target || value.publication?.authorization)) throw invalidState();
    if (value.publication) assertFileName(value.publication.fileName);
    if (value.publication && value.draft?.target && value.publication.fileName !== value.draft.target.fileName) throw invalidState();
    if (value.publication?.authorization) validateAuthorization(value.publication.authorization, value);
    if (value.result && (!value.draft || !value.publication || value.result.artifact?.sha256 !== value.draft.sha256
      || value.result.artifact?.fileName !== value.publication.fileName)) throw invalidState();
    return value;
  }
  #save(db: DatabaseSync, key: string, record: StoredRun): void {
    record.updatedAt = this.#now();
    const data = JSON.stringify(record);
    if (Buffer.byteLength(data) > MAX_RECORD_BYTES) throw workflowStateError("RECORD_TOO_LARGE", "Workflow evidence exceeds its bounded record size.", 413);
    db.prepare("INSERT INTO workflow_runs VALUES (?, ?, ?, ?, ?) ON CONFLICT(run_key) DO UPDATE SET updated_at=excluded.updated_at, data=excluded.data, digest=excluded.digest")
      .run(key, record.scopeKey, record.updatedAt, data, hash(data));
  }
  #now(): number { const now = this.#clock(); if (!Number.isSafeInteger(now) || now < 0) throw invalidState(); return now; }
  #write<T>(operation: (db: DatabaseSync) => T): T {
    const db = this.#open(true)!;
    try { db.exec("BEGIN IMMEDIATE"); const result = operation(db); db.exec("COMMIT"); this.#observedSuccess(true); return result; }
    catch (error) { try { db.exec("ROLLBACK"); } catch { /* Preserve first failure. */ } throw this.observeFailure(error); }
    finally { db.close(); }
  }
  async #writeAsync<T>(operation: (db: DatabaseSync) => Promise<T>): Promise<T> {
    const db = this.#open(true)!;
    try { db.exec("BEGIN IMMEDIATE"); const result = await operation(db); db.exec("COMMIT"); this.#observedSuccess(true); return result; }
    catch (error) { try { db.exec("ROLLBACK"); } catch { /* Preserve first failure. */ } throw this.observeFailure(error); }
    finally { db.close(); }
  }
  #open(write: boolean): DatabaseSync | null {
    try { return this.#openDatabase(write); }
    catch (error) { throw this.observeFailure(error, write); }
  }
  #openDatabase(write: boolean): DatabaseSync | null {
    if (!existsSync(this.root)) {
      if (this.#healthState !== "unverified") throw workflowStateError("STATE_MISSING", "Previously observed workflow storage is missing.", 503);
      if (!write) return null;
      mkdirSync(this.root, { recursive: true, mode: 0o700 });
    }
    const root = lstatSync(this.root, { bigint: true });
    if (!root.isDirectory() || root.isSymbolicLink()) throw unsafeStatePath();
    const identity = { path: realpathSync(this.root), dev: root.dev, ino: root.ino };
    if (this.#rootIdentity && Object.keys(identity).some(key => identity[key as keyof Identity] !== this.#rootIdentity![key as keyof Identity])) throw unsafeStatePath();
    this.#rootIdentity ??= identity;
    const path = join(this.root, "workflow-runs.sqlite");
    const owner = readInitializationOwner(this.root, identity.path);
    let created = false;
    if (!stateEntry(path)) {
      if (owner?.initialized || this.#healthState !== "unverified") throw workflowStateError("STATE_MISSING", "Previously initialized workflow storage is missing; automatic replacement is refused.", 503);
      if (!write) return null;
      ensureInitializationOwner(this.root, identity.path);
      try { closeSync(openSync(path, "wx", 0o600)); created = true; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
      if (created) this.#onInitialization?.();
    }
    for (const candidate of [path, `${path}-wal`, `${path}-shm`]) {
      const stat = stateEntry(candidate);
      if (!stat) continue;
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || resolve(realpathSync(candidate)) !== resolve(identity.path, candidate.slice(this.root.length + 1))) throw unsafeStatePath();
    }
    if (write) restrictPermissions(this.root, 0o700);
    const db = new DatabaseSync(path, { readOnly: !write, allowExtension: false });
    try {
      db.exec("PRAGMA busy_timeout = 0; PRAGMA trusted_schema = OFF");
      const applicationId = Number(db.prepare("PRAGMA application_id").get()?.application_id);
      const version = Number(db.prepare("PRAGMA user_version").get()?.user_version);
      const initialization = readInitializationOwner(this.root, identity.path);
      if (applicationId === 0 && version === 0 && initialization && !initialization.initialized) {
        if (!write) throw workflowStateError("STATE_INITIALIZING", "Workflow initialization was interrupted; an authorized run can resume it.", 503);
        if (db.prepare("SELECT name FROM sqlite_schema LIMIT 1").get()) throw invalidState();
        db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; BEGIN IMMEDIATE");
        // Another initializer may finish between observation and this lock.
        const currentId = Number(db.prepare("PRAGMA application_id").get()?.application_id);
        if (currentId === 0) {
          if (Number(db.prepare("PRAGMA user_version").get()?.user_version) !== 0 || db.prepare("SELECT name FROM sqlite_schema LIMIT 1").get()) throw invalidState();
          db.exec(`PRAGMA application_id = ${APPLICATION_ID}; PRAGMA user_version = 1;
            CREATE TABLE workflow_runs (run_key TEXT PRIMARY KEY, scope_key TEXT NOT NULL, updated_at INTEGER NOT NULL, data TEXT NOT NULL, digest TEXT NOT NULL) STRICT;
            CREATE INDEX workflow_runs_scope ON workflow_runs(scope_key, updated_at);`);
        } else if (currentId !== APPLICATION_ID) throw invalidState();
        db.exec("COMMIT");
      }
      if (Number(db.prepare("PRAGMA application_id").get()?.application_id) !== APPLICATION_ID
        || Number(db.prepare("PRAGMA user_version").get()?.user_version) !== 1) throw invalidState();
      if (write && initialization && !initialization.initialized) writeInitializationOwner(this.root, identity.path, true);
      if (write) for (const candidate of [path, `${path}-wal`, `${path}-shm`]) {
        if (stateEntry(candidate)) restrictPermissions(candidate, 0o600);
      }
      if (write) db.exec("PRAGMA synchronous = FULL");
      (db as DatabaseSync & { enableDefensive?: (enabled: boolean) => void }).enableDefensive?.(true);
      return db;
    } catch (error) { db.close(); throw normalizeStoreError(error); }
  }
}

function ownerScope(scope: WorkflowScope): string {
  const tenantId = typeof scope?.tenantId === "string" ? scope.tenantId.trim() : "";
  const owner = scope?.userId ?? scope?.tenantScopeIdentity?.userId;
  if (!tenantId) throw workflowStateError("TENANT_CONTEXT_REQUIRED", "Workflow execution requires an authenticated server-owned tenant context.", 403);
  if (owner !== undefined && owner !== null && (typeof owner !== "string" || !owner.trim())) throw workflowStateError("OWNER_CONTEXT_REQUIRED", "Workflow owner must come from authenticated server context.", 403);
  return hash(JSON.stringify(["workflow-owner-v1", tenantId, typeof owner === "string" ? owner.trim() : null]));
}
export function validateWorkflowId(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/.test(value)) throw workflowStateError("ID_INVALID", "Workflow ID must be a bounded portable identifier.", 400);
  return value;
}
function validateDraft(draft: WorkflowDraft): void {
  if (!draft || !/^\.[a-f0-9-]{36}\.workflow\.tmp$/.test(draft.stagingName)
    || !/^\d+$/.test(draft.device) || !/^\d+$/.test(draft.inode) || !/^\d+$/.test(draft.birthtime) || !/^[a-f0-9]{64}$/.test(draft.sha256)
    || !Number.isSafeInteger(draft.bytes) || draft.bytes < 0 || draft.bytes > MAX_RECORD_BYTES || !draft.result) throw invalidState();
  assertFileName(draft.requestedName);
  if (draft.target) validateTarget(draft.target);
}
export function workflowTargetFingerprint(target: Omit<WorkflowPublicationTarget, "fingerprint">): string {
  return hash(JSON.stringify(["workflow-target-v1", target.rootFingerprint, target.tenantFingerprint, target.fileName]));
}
function validateTarget(target: WorkflowPublicationTarget): void {
  assertFileName(target.fileName);
  if (!/^[a-f0-9]{64}$/.test(target.rootFingerprint) || !/^[a-f0-9]{64}$/.test(target.tenantFingerprint)
    || target.fingerprint !== workflowTargetFingerprint(target)
    || Object.keys(target).sort().join("\0") !== ["fileName", "fingerprint", "rootFingerprint", "tenantFingerprint"].join("\0")) throw invalidState();
}
function validateAuthorization(receipt: WorkflowPublicationAuthorization, record: StoredRun): void {
  const draft = record.draft;
  if (!receipt || receipt.version !== 1 || !draft?.target
    || !/^agt_[A-Za-z0-9_-]{1,128}$/u.test(receipt.agentId) || !/^sha256:[a-f0-9]{64}$/u.test(receipt.policyHash)
    || !/^sha256:[a-f0-9]{64}$/u.test(receipt.argumentsHash)
    || receipt.workflowId !== record.workflowId || receipt.inputHash !== record.inputSha256 || receipt.subjectFingerprint !== record.scopeKey
    || receipt.contentHash !== draft.sha256 || receipt.contentBytes !== draft.bytes || receipt.targetFingerprint !== draft.target.fingerprint
    || !["allow", "require_approval"].includes(receipt.decision)
    || (receipt.decision === "allow" ? receipt.approvalId !== null : typeof receipt.approvalId !== "string" || !/^appr_[A-Za-z0-9_-]{1,128}$/u.test(receipt.approvalId))
    || Object.keys(receipt).sort().join("\0") !== ["version", "agentId", "policyHash", "subjectFingerprint", "workflowId", "inputHash", "argumentsHash", "contentHash", "contentBytes", "targetFingerprint", "decision", "approvalId"].sort().join("\0")) throw invalidState();
}
function canRecheckGovernance(record: StoredRun): boolean {
  return record.governancePending && record.recoveryVerified && Boolean(record.publication?.authorization);
}
function assertFileName(name: unknown): asserts name is string {
  if (typeof name !== "string" || !/^[A-Za-z0-9._-]{1,100}\.md$/i.test(name)) throw invalidState();
}
function restrictPermissions(path: string, mode: number): void {
  try { chmodSync(path, mode); } catch (error) { if (process.platform !== "win32") throw error; }
}
function stateEntry(path: string) {
  try { return lstatSync(path); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}
function readInitializationOwner(root: string, canonicalRoot: string): { initialized: boolean } | null {
  const marker = join(root, ".workflow-runs.initialization.json");
  const stat = stateEntry(marker);
  if (!stat) return null;
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink > 2 || stat.size > 1024) throw unsafeStatePath();
  let value: { version?: unknown; rootSha256?: unknown; initialized?: unknown };
  try { value = JSON.parse(readFileSync(marker, "utf8")); } catch { throw invalidState(); }
  if (value.version !== "workflow-initialization-v1" || value.rootSha256 !== hash(canonicalRoot) || typeof value.initialized !== "boolean") throw invalidState();
  return { initialized: value.initialized };
}
function ensureInitializationOwner(root: string, canonicalRoot: string): void {
  if (readInitializationOwner(root, canonicalRoot)) return;
  writeInitializationOwner(root, canonicalRoot, false);
}
function writeInitializationOwner(root: string, canonicalRoot: string, initialized: boolean): void {
  const marker = join(root, ".workflow-runs.initialization.json");
  if (!initialized && stateEntry(marker)) throw invalidState();
  if (initialized && !readInitializationOwner(root, canonicalRoot)) throw invalidState();
  if (readdirSync(root).filter(name => /^\.[a-f0-9-]{36}\.workflow-init\.tmp$/.test(name)).length >= 32) {
    throw workflowStateError("INITIALIZATION_CAPACITY", "Retained initialization evidence requires explicit maintenance.", 503);
  }
  const temporary = join(root, `.${randomUUID()}.workflow-init.tmp`);
  const fd = openSync(temporary, "wx", 0o600); const identity = fstatSync(fd, { bigint: true });
  try {
    writeFileSync(fd, JSON.stringify({ version: "workflow-initialization-v1", rootSha256: hash(canonicalRoot), initialized })); fsyncSync(fd);
    if (initialized) renameSync(temporary, marker);
    else {
      try { linkSync(temporary, marker); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !readInitializationOwner(root, canonicalRoot)) throw error; }
    }
  } finally {
    closeSync(fd);
    if (stateEntry(temporary)) {
      const current = lstatSync(temporary, { bigint: true });
      if (!current.isFile() || current.isSymbolicLink() || current.dev !== identity.dev || current.ino !== identity.ino) throw unsafeStatePath();
      unlinkSync(temporary);
    }
  }
  // Marker publication precedes creating the empty database. POSIX directory
  // durability is requested; Windows only promises the process-crash boundary.
  let directory: number | undefined;
  try { directory = openSync(root, "r"); fsyncSync(directory); }
  catch (error) { if (process.platform !== "win32" || !["EACCES", "EPERM", "EISDIR", "ENOTSUP"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error; }
  finally { if (directory !== undefined) closeSync(directory); }
}
function hash(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function notFound() { return workflowStateError("NOT_FOUND", "No workflow exists in the authenticated owner scope.", 404); }
function invalidState() { return workflowStateError("STATE_INVALID", "Workflow state is invalid; existing evidence was preserved.", 503); }
function unsafeStatePath() { return workflowStateError("OUTPUT_PATH_UNSAFE", "Workflow state must use real, unchanged, non-link paths."); }
function unknownOutcome(workflowId: string) { return Object.assign(workflowStateError("OUTCOME_UNKNOWN", "Reconcile the recorded artifact before any retry."), { outcomeUnknown: true, details: { workflowId, reconciliationRequired: true } }); }
function normalizeStoreError(error: unknown): unknown {
  if ((error as { errcode?: number })?.errcode === 5 || (error as { code?: string })?.code === "SQLITE_BUSY") return Object.assign(workflowStateError("BUSY", "A workflow publication or state operation is still active."), { cause: error });
  const code = (error as { code?: string })?.code;
  if (code === "EEXIST") return Object.assign(workflowStateError("ARTIFACT_COLLISION", "The requested workflow artifact name already exists."), { cause: error });
  if (typeof code === "string" && /^WORKFLOW_[A-Z_]+$/.test(code)) return error;
  const safe = code === "EACCES" || code === "EPERM"
    ? workflowStateError("STATE_PERMISSION_DENIED", "Workflow storage access was denied.", 503)
    : code === "ENOSPC" || code === "EDQUOT"
      ? workflowStateError("STORAGE_FULL", "Workflow storage capacity is exhausted.", 503)
      : workflowStateError("STATE_UNAVAILABLE", "Workflow state could not be accessed safely; existing evidence was preserved.", 503);
  return Object.assign(safe, { cause: error });
}
export function workflowStateError(code: string, message: string, statusCode = 409) {
  return Object.assign(new Error(message), { code: `WORKFLOW_${code}`, statusCode, category: "workflow", retryable: false });
}

export async function executeDurableWorkflow(input: {
  store: DurableWorkflowRunStore; workflowId: string; request: Json; scope: WorkflowScope; signal?: AbortSignal;
  prepare: (claim: WorkflowClaim) => Promise<WorkflowDraft>;
  publish: (claim: WorkflowClaim, draft: WorkflowDraft) => Promise<WorkflowRunResponse>;
  discard: (draft: WorkflowDraft) => Promise<void>;
  replay?: (claim: WorkflowClaim) => Promise<void>;
}): Promise<WorkflowRunResponse> {
  const claim = input.store.claim(input.workflowId, input.request, input.scope);
  if (claim.replayed) { await input.replay?.(claim); return claim.record.result!; }
  try {
    let draft = claim.record.draft;
    if (!draft) {
      draft = await input.prepare(claim);
      try { input.store.prepare(claim, draft); }
      catch (error) {
        try { await input.store.discardUnregistered(claim, draft, () => input.discard(draft!)); }
        catch (cleanupError) { if (error instanceof Error) Object.assign(error, { cleanupError }); }
        throw error;
      }
    }
    return await input.publish(claim, draft);
  } catch (error) {
    let stateError: unknown;
    try { input.store.fail(claim, error, input.signal?.aborted === true); } catch (failure) { stateError = failure; }
    if (error instanceof Error) {
      const failure = error as Error & { details?: Json };
      failure.details = { ...failure.details, workflowId: input.workflowId,
        ...((error as { cleanupError?: unknown }).cleanupError ? { stagingCleanupRequired: true } : {}),
        ...(stateError ? { stateUpdateUncertain: true } : {}) };
    }
    let unknown = false;
    try { unknown = input.store.inspect(input.workflowId, input.scope).outcomeUnknown; } catch { /* Preserve the primary failure. */ }
    if (unknown && (error as { code?: string })?.code !== "WORKFLOW_CLAIM_EXPIRED") {
      throw Object.assign(unknownOutcome(input.workflowId), { cause: error, details: { workflowId: input.workflowId, reconciliationRequired: true, ...(stateError ? { stateUpdateUncertain: true } : {}) } });
    }
    throw error;
  }
}
