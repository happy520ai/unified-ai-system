/** Bounded, tamper-evident segmented Agent Governance audit chain. */

import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { AGENT_GOVERNANCE_REDACTED_FIELDS } from "@unified-ai-system/shared-contracts";
import type {
  AgentGovernanceAuditCheckpoint,
  AgentGovernanceAuditEvent,
} from "@unified-ai-system/shared-contracts";
import { stableStringify } from "@unified-ai-system/policy-engine";
import { createGovernanceStateFileBinding } from "./governanceStateAnchor.ts";

export interface GovernanceAuditLog {
  record(event: AgentGovernanceAuditEvent): Promise<void>;
  read(limit?: number): Promise<AgentGovernanceAuditEvent[]>;
  readForAgent(agentId: string, limit?: number): Promise<AgentGovernanceAuditEvent[]>;
}

interface ChainedAuditRecord extends AgentGovernanceAuditEvent {
  _id: string;
  /** Monotonic logical sequence; it does not reset when an archived prefix expires. */
  sequence: number;
  previousHash: string;
  entryHash: string;
  segmentId?: string;
  segmentSequence?: number;
  /** Legacy pre-rotation checkpoint, accepted only for migration. */
  _checkpoint?: {
    compactedRecordCount: number;
    previousLogDigest: string;
    previousHeadHash: string;
  };
}

interface AuditSegment {
  id: string;
  legacy: boolean;
  records: ChainedAuditRecord[];
  bytes: number;
  endedAtMs: number;
}

interface ParsedAudit {
  records: ChainedAuditRecord[];
  segments: AuditSegment[];
}

type RotationReason = "max_records" | "archive_retention" | "archive_capacity" | "legacy_migration";

const GENESIS_HASH = "GENESIS";
const LEGACY_DOMAIN = "unified-ai/agent-governance-audit/v1";
const SEGMENT_DOMAIN = "unified-ai/agent-governance-audit/v2";

export function createGovernanceAuditLog(options: {
  logPath?: string;
  secret: string;
  /** Hard record bound for the current active segment, including its checkpoint. */
  maxRecords?: number;
  /** Deprecated v1 option retained as a no-op compatibility input. */
  retainRecords?: number;
  /** Maximum number of completed signed segments retained beside the active segment. */
  maxArchiveSegments?: number;
  /** Maximum serialized bytes across retained completed segments. */
  maxArchiveBytes?: number;
  /** Completed segments older than this are removed as whole signed units. */
  archiveRetentionMs?: number;
  now?: () => string;
}): GovernanceAuditLog {
  const logPath = options.logPath ?? ".data/agent-governance/audit-events.jsonl";
  if (typeof options.secret !== "string" || options.secret.length < 32) {
    throw auditError("Governance audit HMAC secret must contain at least 32 characters.");
  }
  const maxRecords = boundedInteger(options.maxRecords, 2_000, 10, 100_000);
  const maxArchiveSegments = boundedInteger(options.maxArchiveSegments, 8, 1, 1_000);
  const maxArchiveBytes = boundedInteger(
    options.maxArchiveBytes,
    16 * 1024 * 1024,
    1_024,
    1024 * 1024 * 1024,
  );
  const archiveRetentionMs = boundedInteger(
    options.archiveRetentionMs,
    30 * 24 * 60 * 60 * 1_000,
    60_000,
    365 * 24 * 60 * 60 * 1_000,
  );
  const now = options.now ?? (() => new Date().toISOString());
  const state = createGovernanceStateFileBinding({
    filePath: logPath,
    secret: options.secret,
    kind: "audit",
    validateLegacy: (content) => { parseAndVerifyAudit(content.toString("utf8"), options.secret); },
  });
  let writeTail: Promise<void> = Promise.resolve();

  async function verifyExisting(): Promise<ParsedAudit> {
    await state.verify();
    let raw: string;
    try {
      raw = await readFile(logPath, "utf8");
    } catch (error) {
      if (isMissingFile(error)) return { records: [], segments: [] };
      throw auditError("Governance audit chain could not be read.", error);
    }
    return parseAndVerifyAudit(raw, options.secret);
  }

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = writeTail.then(operation, operation);
    writeTail = result.then(() => undefined, () => undefined);
    return result;
  }

  async function maintainArchives(): Promise<ParsedAudit> {
    return enqueue(async () => {
      let parsed = await verifyExisting();
      const reason = maintenanceRotationReason(
        parsed,
        now(),
        maxArchiveSegments,
        maxArchiveBytes,
        archiveRetentionMs,
      );
      if (reason) {
        parsed = rotateAuditSegments(parsed, options.secret, {
          reason,
          timestamp: now(),
          maxArchiveSegments,
          maxArchiveBytes,
          archiveRetentionMs,
        });
        await state.commit(serializeAudit(parsed.records));
      }
      return parsed;
    });
  }

  return {
    async record(event) {
      await enqueue(async () => {
        let parsed = await verifyExisting();
        const rotationReason = appendRotationReason(
          parsed,
          now(),
          maxRecords,
          maxArchiveSegments,
          maxArchiveBytes,
          archiveRetentionMs,
        );
        if (rotationReason) {
          parsed = rotateAuditSegments(parsed, options.secret, {
            reason: rotationReason,
            timestamp: now(),
            maxArchiveSegments,
            maxArchiveBytes,
            archiveRetentionMs,
          });
        }
        const records = appendEvent(parsed.records, event, options.secret);
        await state.commit(serializeAudit(records));
      });
    },
    async read(limit = 200) {
      const parsed = await maintainArchives();
      return selectPublicEvents(parsed.records, undefined, limit);
    },
    async readForAgent(agentId, limit = 200) {
      const parsed = await maintainArchives();
      return selectPublicEvents(parsed.records, agentId, limit);
    },
  };
}

function appendRotationReason(
  parsed: ParsedAudit,
  timestamp: string,
  maxRecords: number,
  maxArchiveSegments: number,
  maxArchiveBytes: number,
  archiveRetentionMs: number,
): RotationReason | null {
  const active = parsed.segments.at(-1);
  if (!active) return null;
  if (active.legacy) return "legacy_migration";
  if (active.records.length >= maxRecords) return "max_records";
  return maintenanceRotationReason(
    parsed,
    timestamp,
    maxArchiveSegments,
    maxArchiveBytes,
    archiveRetentionMs,
  );
}

function maintenanceRotationReason(
  parsed: ParsedAudit,
  timestamp: string,
  maxArchiveSegments: number,
  maxArchiveBytes: number,
  archiveRetentionMs: number,
): RotationReason | null {
  if (parsed.segments.length <= 1) return null;
  const archives = parsed.segments.slice(0, -1);
  const cutoff = Date.parse(timestamp) - archiveRetentionMs;
  if (Number.isFinite(cutoff) && archives.some((segment) => segment.endedAtMs < cutoff)) {
    return "archive_retention";
  }
  if (archives.length > maxArchiveSegments || archiveBytes(archives) > maxArchiveBytes) {
    return "archive_capacity";
  }
  return null;
}

function rotateAuditSegments(
  parsed: ParsedAudit,
  secret: string,
  limits: {
    reason: RotationReason;
    timestamp: string;
    maxArchiveSegments: number;
    maxArchiveBytes: number;
    archiveRetentionMs: number;
  },
): ParsedAudit {
  if (parsed.segments.length === 0) return parsed;
  const previousRaw = serializeAudit(parsed.records).trimEnd();
  const previousHead = parsed.records.at(-1)?.entryHash ?? GENESIS_HASH;
  const previousLastSequence = parsed.records.at(-1)?.sequence ?? 0;
  const priorCompacted = latestCheckpoint(parsed.records)?.compactedRecordCount ?? 0;
  const cutoff = Date.parse(limits.timestamp) - limits.archiveRetentionMs;
  let kept = [...parsed.segments];
  const removed: AuditSegment[] = [];

  if (Number.isFinite(cutoff)) {
    while (kept.length > 0 && kept[0]!.endedAtMs < cutoff) removed.push(kept.shift()!);
  }
  while (kept.length > limits.maxArchiveSegments) removed.push(kept.shift()!);
  while (kept.length > 0 && archiveBytes(kept) > limits.maxArchiveBytes) removed.push(kept.shift()!);

  const compactedRecordCount = priorCompacted + removed.reduce(
    (count, segment) => count + segment.records.filter((record) => !isCheckpoint(record)).length,
    0,
  );
  const archivedRecordCount = kept.reduce(
    (count, segment) => count + segment.records.filter((record) => !isCheckpoint(record)).length,
    0,
  );
  const archivedBytes = archiveBytes(kept);
  const checkpoint: AgentGovernanceAuditCheckpoint = {
    schemaVersion: 1,
    segmentId: `audit-segment-${randomUUID()}`,
    rotationReason: limits.reason,
    previousLogDigest: `sha256:${createHash("sha256").update(previousRaw, "utf8").digest("hex")}`,
    previousHeadHash: previousHead,
    archiveSegmentCount: kept.length,
    archivedRecordCount,
    archivedBytes,
    compactedRecordCount,
    truncated: compactedRecordCount > 0,
  };
  const checkpointEvent: AgentGovernanceAuditEvent = {
    eventType: "AUDIT_CHECKPOINT",
    timestamp: limits.timestamp,
    reason: `signed audit segment rotation: ${limits.reason}`,
    checkpoint,
  };
  const content: Omit<ChainedAuditRecord, "entryHash"> = {
    ...checkpointEvent,
    _id: randomUUID(),
    sequence: previousLastSequence + 1,
    segmentId: checkpoint.segmentId,
    segmentSequence: 1,
    previousHash: GENESIS_HASH,
  };
  const checkpointRecord: ChainedAuditRecord = {
    ...content,
    entryHash: signSegment(content, secret),
  };
  const records = [...kept.flatMap((segment) => segment.records), checkpointRecord];
  return parseAndVerifyAudit(serializeAudit(records), secret);
}

function appendEvent(
  records: ChainedAuditRecord[],
  event: AgentGovernanceAuditEvent,
  secret: string,
): ChainedAuditRecord[] {
  const previous = records.at(-1);
  const segmentId = previous?.segmentId ?? `audit-segment-${randomUUID()}`;
  const sameSegment = previous?.segmentId === segmentId;
  const content: Omit<ChainedAuditRecord, "entryHash"> = {
    ...event,
    _id: randomUUID(),
    sequence: (previous?.sequence ?? 0) + 1,
    segmentId,
    segmentSequence: sameSegment ? (previous?.segmentSequence ?? 0) + 1 : 1,
    previousHash: sameSegment ? previous?.entryHash ?? GENESIS_HASH : GENESIS_HASH,
  };
  return [...records, { ...content, entryHash: signSegment(content, secret) }];
}

function parseAndVerifyAudit(raw: string, secret: string): ParsedAudit {
  const records: ChainedAuditRecord[] = [];
  const segments: AuditSegment[] = [];
  let current: ChainedAuditRecord[] = [];
  let currentId: string | null = null;
  let currentLegacy = false;
  for (const [lineIndex, line] of raw.split("\n").entries()) {
    if (line.trim() === "") continue;
    let record: ChainedAuditRecord;
    try {
      record = JSON.parse(line) as ChainedAuditRecord;
    } catch (error) {
      throw auditError(`Governance audit record ${lineIndex + 1} is malformed.`, error);
    }
    const isSegmented = typeof record.segmentId === "string";
    const recordSegmentId = isSegmented ? record.segmentId! : "legacy-v1";
    if (!Number.isSafeInteger(record.sequence) || record.sequence < 1
      || (records.length > 0 && record.sequence !== records.at(-1)!.sequence + 1)) {
      throw auditError(`Governance audit logical sequence failed at line ${lineIndex + 1}.`);
    }
    if (isSegmented) {
      if (!/^audit-segment-[A-Za-z0-9-]{16,80}$/u.test(recordSegmentId)
        || !Number.isSafeInteger(record.segmentSequence) || Number(record.segmentSequence) < 1) {
        throw auditError(`Governance audit segment identity failed at line ${lineIndex + 1}.`);
      }
      const continues = currentId === recordSegmentId;
      const expectedSegmentSequence = continues ? Number(current.at(-1)?.segmentSequence ?? 0) + 1 : 1;
      const expectedPreviousHash = continues ? current.at(-1)?.entryHash ?? GENESIS_HASH : GENESIS_HASH;
      const { entryHash, ...content } = record;
      if (record.segmentSequence !== expectedSegmentSequence || record.previousHash !== expectedPreviousHash
        || !safeHashEqual(entryHash, signSegment(content, secret))) {
        throw auditError(`Governance audit segment verification failed at line ${lineIndex + 1}.`);
      }
      if (!continues) {
        if (current.length > 0) segments.push(createSegment(currentId!, currentLegacy, current));
        if (segments.length > 0 && !isCheckpoint(record)) {
          throw auditError("Every rotated audit segment must begin with a visible signed checkpoint.");
        }
        current = [];
        currentId = recordSegmentId;
        currentLegacy = false;
      }
    } else {
      if (currentId && currentId !== "legacy-v1") {
        throw auditError("Legacy audit records cannot appear after segmented audit records.");
      }
      const { entryHash, ...content } = record;
      const expectedPreviousHash = current.at(-1)?.entryHash ?? GENESIS_HASH;
      if (record.sequence !== current.length + 1 || record.previousHash !== expectedPreviousHash
        || !safeHashEqual(entryHash, signLegacy(content, secret))) {
        throw auditError(`Legacy governance audit chain verification failed at line ${lineIndex + 1}.`);
      }
      currentId = "legacy-v1";
      currentLegacy = true;
    }
    current.push(record);
    records.push(record);
  }
  if (current.length > 0) segments.push(createSegment(currentId!, currentLegacy, current));
  return { records, segments };
}

function createSegment(id: string, legacy: boolean, records: ChainedAuditRecord[]): AuditSegment {
  const endedAtMs = records.reduce((latest, record) => {
    const parsed = Date.parse(record.timestamp);
    return Number.isFinite(parsed) ? Math.max(latest, parsed) : latest;
  }, 0);
  return {
    id,
    legacy,
    records: [...records],
    bytes: Buffer.byteLength(serializeAudit(records), "utf8"),
    endedAtMs,
  };
}

function selectPublicEvents(
  records: ChainedAuditRecord[],
  agentId: string | undefined,
  limitInput: number,
): AgentGovernanceAuditEvent[] {
  const limit = boundedInteger(limitInput, 200, 0, 100_000);
  const eligible = records.filter((record) => isCheckpoint(record) || agentId === undefined || record.agentId === agentId);
  const selected = limit > 0 ? eligible.slice(-limit) : [];
  const latest = [...records].reverse().find(isCheckpoint);
  if (latest && !selected.includes(latest)) selected.unshift(latest);
  return selected.map(publicAuditEvent);
}

function publicAuditEvent(record: ChainedAuditRecord): AgentGovernanceAuditEvent {
  const {
    _id: _id,
    sequence: _sequence,
    previousHash: _previousHash,
    entryHash: _entryHash,
    segmentId: _segmentId,
    segmentSequence: _segmentSequence,
    _checkpoint,
    ...event
  } = record;
  if (!_checkpoint) return event;
  return {
    ...event,
    eventType: "AUDIT_CHECKPOINT",
    checkpoint: {
      schemaVersion: 1,
      segmentId: _segmentId ?? "legacy-v1",
      rotationReason: "legacy_migration",
      previousLogDigest: _checkpoint.previousLogDigest,
      previousHeadHash: _checkpoint.previousHeadHash,
      archiveSegmentCount: 0,
      archivedRecordCount: 0,
      archivedBytes: 0,
      compactedRecordCount: _checkpoint.compactedRecordCount,
      truncated: _checkpoint.compactedRecordCount > 0,
    },
  };
}

function latestCheckpoint(records: ChainedAuditRecord[]): AgentGovernanceAuditCheckpoint | null {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const event = publicAuditEvent(records[index]!);
    if (event.checkpoint) return event.checkpoint;
  }
  return null;
}

function isCheckpoint(record: ChainedAuditRecord): boolean {
  return record.eventType === "AUDIT_CHECKPOINT" || Boolean(record._checkpoint) || Boolean(record.checkpoint);
}

function archiveBytes(segments: AuditSegment[]): number {
  return segments.reduce((total, segment) => total + segment.bytes, 0);
}

function serializeAudit(records: ChainedAuditRecord[]): string {
  return records.length === 0 ? "" : `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
}

function signLegacy(content: Omit<ChainedAuditRecord, "entryHash">, secret: string): string {
  return `hmac-sha256:${createHmac("sha256", secret)
    .update(`${LEGACY_DOMAIN}\n${stableStringify(content)}`, "utf8")
    .digest("hex")}`;
}

function signSegment(content: Omit<ChainedAuditRecord, "entryHash">, secret: string): string {
  return `hmac-sha256:${createHmac("sha256", secret)
    .update(`${SEGMENT_DOMAIN}\n${stableStringify(content)}`, "utf8")
    .digest("hex")}`;
}

function safeHashEqual(left: unknown, right: string): boolean {
  if (typeof left !== "string" || left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
}

function auditError(message: string, cause?: unknown): Error {
  const error = new Error(message, cause === undefined ? undefined : { cause });
  error.name = "GovernanceAuditIntegrityError";
  return error;
}

function isMissingFile(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "ENOENT");
}

/** Redact credential-bearing fields before optional argument logging. */
export function redactArguments(args: unknown): Record<string, unknown> {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return { value: typeof args };
  }
  const record = args as Record<string, unknown>;
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    const sensitive = AGENT_GOVERNANCE_REDACTED_FIELDS.some(
      (field) => key.toLowerCase().includes(field.toLowerCase()),
    );
    redacted[key] = sensitive ? "***REDACTED***" : truncate(value);
  }
  return redacted;
}

function truncate(value: unknown): unknown {
  if (typeof value === "string" && value.length > 500) {
    return `${value.slice(0, 500)}...(truncated)`;
  }
  return value;
}
