import { createHash } from "node:crypto";
import type {
  RequestLogger,
  RequestLogRecord,
} from "../logging/requestLogger.ts";

const MAX_STATEMENT_LINES = 5_000;
const MAX_LEDGER_RECORDS = 10_000;
const MAX_PERIOD_MS = 93 * 24 * 60 * 60 * 1_000;
const MAX_LINE_COST_MICRO_USD = 1_000_000 * 1_000_000;
const DEFAULT_ABSOLUTE_TOLERANCE_MICRO_USD = 10_000;
const DEFAULT_RELATIVE_TOLERANCE_BPS = 100;

const ROOT_FIELDS = new Set([
  "statementId",
  "provider",
  "currency",
  "periodStart",
  "periodEnd",
  "absoluteToleranceUsd",
  "relativeToleranceBps",
  "lines",
]);
const LINE_FIELDS = new Set([
  "statementLineId",
  "usageAttemptId",
  "model",
  "occurredAt",
  "totalTokens",
  "billedCostUsd",
]);

type NormalizedStatementLine = {
  statementLineId: string;
  usageAttemptId: string;
  model: string;
  occurredAt: number;
  totalTokens: number | null;
  billedCostMicroUsd: number;
};

type NormalizedStatement = {
  statementId: string;
  provider: string;
  currency: "USD";
  periodStart: number;
  periodEnd: number;
  absoluteToleranceMicroUsd: number;
  relativeToleranceBps: number;
  lines: NormalizedStatementLine[];
};

type TerminalAttempt = {
  attemptId: string;
  record: RequestLogRecord;
};

export function createProviderStatementReconciliationService({
  requestLogger,
}: {
  requestLogger: Pick<RequestLogger, "query" | "assertDurable" | "getHealth">;
}) {
  if (!requestLogger || typeof requestLogger.query !== "function") {
    throw reconciliationError(
      "PROVIDER_STATEMENT_LEDGER_REQUIRED",
      "Provider statement reconciliation requires a usage ledger.",
      503,
    );
  }

  return {
    async reconcile({
      tenantId,
      statement: rawStatement,
    }: {
      tenantId: unknown;
      statement: unknown;
    }) {
      const authoritativeTenantId = boundedText(tenantId, "tenantId", 256);
      const statement = normalizeStatement(rawStatement);
      const health = requestLogger.getHealth();
      if (health.storeMode !== "postgres" || health.distributed !== true) {
        throw reconciliationError(
          "PROVIDER_STATEMENT_CENTRAL_LEDGER_REQUIRED",
          "Provider statement reconciliation requires the central PostgreSQL usage ledger.",
          409,
        );
      }

      try {
        await requestLogger.assertDurable();
      } catch {
        throw reconciliationError(
          "PROVIDER_STATEMENT_LEDGER_UNAVAILABLE",
          "The central usage ledger is unavailable for reconciliation.",
          503,
          true,
        );
      }

      let queried: RequestLogRecord[];
      try {
        queried = await requestLogger.query({
          tenantId: authoritativeTenantId,
          provider: statement.provider,
          since: statement.periodStart,
          until: statement.periodEnd,
          limit: MAX_LEDGER_RECORDS,
          offset: 0,
        });
      } catch {
        throw reconciliationError(
          "PROVIDER_STATEMENT_LEDGER_UNAVAILABLE",
          "The central usage ledger could not be queried for reconciliation.",
          503,
          true,
        );
      }
      if (!Array.isArray(queried)) {
        throw reconciliationError(
          "PROVIDER_STATEMENT_LEDGER_INVALID",
          "The central usage ledger returned an invalid reconciliation dataset.",
          503,
          true,
        );
      }
      if (queried.length >= MAX_LEDGER_RECORDS) {
        throw reconciliationError(
          "PROVIDER_STATEMENT_LEDGER_TRUNCATED",
          "The bounded reconciliation dataset reached its limit; narrow the statement period.",
          409,
        );
      }

      const records = queried.filter((record) => (
        record.tenantId === authoritativeTenantId
        && record.provider === statement.provider
        && Number.isFinite(record.timestamp)
        && record.timestamp >= statement.periodStart
        && record.timestamp <= statement.periodEnd
      ));
      const terminalByAttempt = new Map<string, TerminalAttempt>();
      const duplicateLedgerAttemptIds = new Set<string>();
      const terminalAttemptIds = new Set<string>();
      const unresolvedStartedAttemptIds = new Set<string>();
      let unmatchableLedgerRecordCount = 0;

      for (const record of records) {
        const attemptId = optionalPortableIdentifier(record.usageAttemptId, 256);
        if (record.usageEventType === "attempt-started") {
          if (attemptId) unresolvedStartedAttemptIds.add(attemptId);
          continue;
        }
        if (
          record.usageEventType !== "attempt-completed"
          && record.usageEventType !== "attempt-failed"
        ) {
          if (record.billable) unmatchableLedgerRecordCount += 1;
          continue;
        }
        if (!record.billable) continue;
        if (!attemptId) {
          unmatchableLedgerRecordCount += 1;
          continue;
        }
        terminalAttemptIds.add(attemptId);
        unresolvedStartedAttemptIds.delete(attemptId);
        if (terminalByAttempt.has(attemptId)) {
          duplicateLedgerAttemptIds.add(attemptId);
          terminalByAttempt.delete(attemptId);
          continue;
        }
        if (!duplicateLedgerAttemptIds.has(attemptId)) {
          terminalByAttempt.set(attemptId, { attemptId, record });
        }
      }

      const statementAttemptIds = new Set(statement.lines.map((line) => line.usageAttemptId));
      const lineResults = statement.lines.map((line) => {
        const terminal = terminalByAttempt.get(line.usageAttemptId);
        if (!terminal) {
          return {
            statementLineId: line.statementLineId,
            usageAttemptId: line.usageAttemptId,
            status: duplicateLedgerAttemptIds.has(line.usageAttemptId)
              ? "ambiguous_gateway_attempt"
              : "statement_only",
            billedCostUsd: microUsdToNumber(line.billedCostMicroUsd),
            gateway: null,
            differences: null,
          };
        }

        const gateway = terminal.record;
        const gatewayCostMicroUsd = normalizeGatewayCostMicroUsd(gateway);
        const costToleranceMicroUsd = Math.max(
          statement.absoluteToleranceMicroUsd,
          Math.ceil((line.billedCostMicroUsd / 10_000) * statement.relativeToleranceBps),
        );
        const costVarianceMicroUsd = gatewayCostMicroUsd === null
          ? null
          : line.billedCostMicroUsd - gatewayCostMicroUsd;
        const costWithinTolerance = costVarianceMicroUsd === null
          ? null
          : Math.abs(costVarianceMicroUsd) <= costToleranceMicroUsd;
        const tokenVariance = line.totalTokens === null
          ? null
          : line.totalTokens - normalizeLedgerTokens(gateway.totalTokens);
        const modelMatches = gateway.model === line.model;
        const timestampDeltaMs = Math.abs(line.occurredAt - gateway.timestamp);
        const status = gatewayCostMicroUsd === null
          ? "unknown_gateway_estimate"
          : !modelMatches || (tokenVariance !== null && tokenVariance !== 0)
            ? "metadata_mismatch"
            : costWithinTolerance
              ? "matched"
              : "cost_variance";
        return {
          statementLineId: line.statementLineId,
          usageAttemptId: line.usageAttemptId,
          status,
          billedCostUsd: microUsdToNumber(line.billedCostMicroUsd),
          gateway: {
            model: gateway.model ?? null,
            occurredAt: new Date(gateway.timestamp).toISOString(),
            totalTokens: normalizeLedgerTokens(gateway.totalTokens),
            estimatedCostUsd: gatewayCostMicroUsd === null
              ? null
              : microUsdToNumber(gatewayCostMicroUsd),
            costEstimateAvailable: gatewayCostMicroUsd !== null,
            outcome: gateway.usageEventType,
          },
          differences: {
            modelMatches,
            timestampDeltaMs,
            tokenVariance,
            costVarianceUsd: costVarianceMicroUsd === null
              ? null
              : microUsdToSignedNumber(costVarianceMicroUsd),
            costToleranceUsd: microUsdToNumber(costToleranceMicroUsd),
            costWithinTolerance,
          },
        };
      });

      const gatewayOnly = [...terminalByAttempt.values()]
        .filter(({ attemptId }) => !statementAttemptIds.has(attemptId))
        .sort((left, right) => left.attemptId.localeCompare(right.attemptId))
        .map(({ attemptId, record }) => {
          const costMicroUsd = normalizeGatewayCostMicroUsd(record);
          return {
            usageAttemptId: attemptId,
            model: record.model ?? null,
            occurredAt: new Date(record.timestamp).toISOString(),
            totalTokens: normalizeLedgerTokens(record.totalTokens),
            estimatedCostUsd: costMicroUsd === null ? null : microUsdToNumber(costMicroUsd),
            costEstimateAvailable: costMicroUsd !== null,
            outcome: record.usageEventType,
          };
        });
      const unresolvedGatewayAttemptIds = [...unresolvedStartedAttemptIds]
        .filter((attemptId) => !terminalAttemptIds.has(attemptId))
        .sort();
      const matchedLineCount = lineResults.filter((line) => line.gateway !== null).length;
      const exactMatchLineCount = lineResults.filter((line) => line.status === "matched").length;
      const statementOnlyLineCount = lineResults.filter((line) => line.status === "statement_only").length;
      const ambiguousLineCount = lineResults.filter((line) => line.status === "ambiguous_gateway_attempt").length;
      const costVarianceLineCount = lineResults.filter(
        (line) => line.differences?.costWithinTolerance === false,
      ).length;
      const metadataMismatchLineCount = lineResults.filter((line) => (
        line.differences !== null
        && (
          line.differences.modelMatches === false
          || (
            line.differences.tokenVariance !== null
            && line.differences.tokenVariance !== 0
          )
        )
      )).length;
      const unknownEstimateLineCount = lineResults.filter((line) => line.status === "unknown_gateway_estimate").length;
      const statementTotalMicroUsd = statement.lines.reduce(
        (sum, line) => sum + line.billedCostMicroUsd,
        0,
      );
      const matchedGatewayTotalMicroUsd = lineResults.reduce((sum, line) => {
        const cost = line.gateway?.estimatedCostUsd;
        return cost === null || cost === undefined ? sum : sum + usdNumberToMicroUsd(cost);
      }, 0);
      const balanced = (
        exactMatchLineCount === statement.lines.length
        && gatewayOnly.length === 0
        && unresolvedGatewayAttemptIds.length === 0
        && duplicateLedgerAttemptIds.size === 0
        && unmatchableLedgerRecordCount === 0
      );
      const risks = [];
      if (statementOnlyLineCount > 0) risks.push("statement_lines_missing_from_gateway_ledger");
      if (gatewayOnly.length > 0) risks.push("gateway_attempts_missing_from_statement");
      if (costVarianceLineCount > 0) risks.push("cost_variance_exceeds_tolerance");
      if (metadataMismatchLineCount > 0) risks.push("model_or_token_metadata_mismatch");
      if (unknownEstimateLineCount > 0) risks.push("gateway_cost_estimate_unavailable");
      if (ambiguousLineCount > 0 || duplicateLedgerAttemptIds.size > 0) risks.push("duplicate_gateway_attempts");
      if (unresolvedGatewayAttemptIds.length > 0) risks.push("unresolved_billable_gateway_attempts");
      if (unmatchableLedgerRecordCount > 0) risks.push("unmatchable_gateway_records");

      const statementDigestSha256 = createStatementDigest({
        tenantId: authoritativeTenantId,
        statement,
      });
      return {
        schemaVersion: "provider-statement-reconciliation-v1",
        status: balanced ? "balanced" : "needs_review",
        assurance: "operator-supplied-structured-statement",
        tenantId: authoritativeTenantId,
        statementId: statement.statementId,
        statementDigestSha256,
        provider: statement.provider,
        currency: statement.currency,
        period: {
          start: new Date(statement.periodStart).toISOString(),
          end: new Date(statement.periodEnd).toISOString(),
        },
        tolerance: {
          absoluteUsd: microUsdToNumber(statement.absoluteToleranceMicroUsd),
          relativeBps: statement.relativeToleranceBps,
        },
        summary: {
          statementLineCount: statement.lines.length,
          gatewayTerminalAttemptCount: terminalByAttempt.size + duplicateLedgerAttemptIds.size,
          matchedLineCount,
          exactMatchLineCount,
          statementOnlyLineCount,
          gatewayOnlyAttemptCount: gatewayOnly.length,
          ambiguousLineCount,
          costVarianceLineCount,
          metadataMismatchLineCount,
          unknownEstimateLineCount,
          unresolvedGatewayAttemptCount: unresolvedGatewayAttemptIds.length,
          duplicateGatewayAttemptCount: duplicateLedgerAttemptIds.size,
          unmatchableGatewayRecordCount: unmatchableLedgerRecordCount,
          statementBilledCostUsd: microUsdToNumber(statementTotalMicroUsd),
          matchedGatewayEstimatedCostUsd: microUsdToNumber(matchedGatewayTotalMicroUsd),
        },
        risks,
        lines: lineResults,
        gatewayOnly,
        unresolvedGatewayAttemptIds,
        duplicateGatewayAttemptIds: [...duplicateLedgerAttemptIds].sort(),
        boundaries: {
          sourceAuthenticated: false,
          providerApiCalled: false,
          paymentStatusVerified: false,
          taxesCalculated: false,
          legalInvoice: false,
          authoritativeAccountingRecord: false,
          statementPersisted: false,
          note: "This compares operator-supplied normalized USD lines with the tenant's central usage ledger. It does not authenticate a provider statement or create a legal invoice.",
        },
      };
    },
  };
}

function normalizeStatement(raw: unknown): NormalizedStatement {
  const statement = objectRecord(raw, "statement");
  assertOnlyFields(statement, ROOT_FIELDS, "statement");
  const statementId = portableIdentifier(statement.statementId, "statementId", 256);
  const provider = portableIdentifier(statement.provider, "provider", 256);
  const currency = String(statement.currency ?? "USD").trim().toUpperCase();
  if (currency !== "USD") {
    throw validationError("currency must be USD; currency conversion is not inferred.");
  }
  const periodStart = isoTimestamp(statement.periodStart, "periodStart");
  const periodEnd = isoTimestamp(statement.periodEnd, "periodEnd");
  if (periodEnd <= periodStart) {
    throw validationError("periodEnd must be later than periodStart.");
  }
  if (periodEnd - periodStart > MAX_PERIOD_MS) {
    throw validationError("The reconciliation period cannot exceed 93 days.");
  }
  const absoluteToleranceMicroUsd = statement.absoluteToleranceUsd === undefined
    ? DEFAULT_ABSOLUTE_TOLERANCE_MICRO_USD
    : usdToMicroUsd(statement.absoluteToleranceUsd, "absoluteToleranceUsd", 1_000);
  const relativeToleranceBps = statement.relativeToleranceBps === undefined
    ? DEFAULT_RELATIVE_TOLERANCE_BPS
    : boundedInteger(statement.relativeToleranceBps, "relativeToleranceBps", 0, 10_000);
  if (!Array.isArray(statement.lines) || statement.lines.length < 1) {
    throw validationError("lines must contain at least one normalized statement line.");
  }
  if (statement.lines.length > MAX_STATEMENT_LINES) {
    throw validationError(`lines cannot exceed ${MAX_STATEMENT_LINES} entries.`);
  }

  const statementLineIds = new Set<string>();
  const attemptIds = new Set<string>();
  const lines = statement.lines.map((rawLine, index) => {
    const line = objectRecord(rawLine, `lines[${index}]`);
    assertOnlyFields(line, LINE_FIELDS, `lines[${index}]`);
    const statementLineId = portableIdentifier(
      line.statementLineId,
      `lines[${index}].statementLineId`,
      256,
    );
    const usageAttemptId = portableIdentifier(
      line.usageAttemptId,
      `lines[${index}].usageAttemptId`,
      256,
    );
    if (statementLineIds.has(statementLineId)) {
      throw validationError(`Duplicate statementLineId at lines[${index}].`);
    }
    if (attemptIds.has(usageAttemptId)) {
      throw validationError(`Duplicate usageAttemptId at lines[${index}].`);
    }
    statementLineIds.add(statementLineId);
    attemptIds.add(usageAttemptId);
    const occurredAt = isoTimestamp(line.occurredAt, `lines[${index}].occurredAt`);
    if (occurredAt < periodStart || occurredAt > periodEnd) {
      throw validationError(`lines[${index}].occurredAt must be inside the statement period.`);
    }
    return {
      statementLineId,
      usageAttemptId,
      model: boundedText(line.model, `lines[${index}].model`, 256),
      occurredAt,
      totalTokens: line.totalTokens === undefined
        ? null
        : boundedInteger(line.totalTokens, `lines[${index}].totalTokens`, 0, Number.MAX_SAFE_INTEGER),
      billedCostMicroUsd: usdToMicroUsd(
        line.billedCostUsd,
        `lines[${index}].billedCostUsd`,
        1_000_000,
      ),
    };
  });
  return {
    statementId,
    provider,
    currency: "USD",
    periodStart,
    periodEnd,
    absoluteToleranceMicroUsd,
    relativeToleranceBps,
    lines,
  };
}

function createStatementDigest({
  tenantId,
  statement,
}: {
  tenantId: string;
  statement: NormalizedStatement;
}) {
  const canonical = {
    schemaVersion: "provider-statement-reconciliation-v1",
    tenantId,
    statementId: statement.statementId,
    provider: statement.provider,
    currency: statement.currency,
    periodStart: statement.periodStart,
    periodEnd: statement.periodEnd,
    absoluteToleranceMicroUsd: statement.absoluteToleranceMicroUsd,
    relativeToleranceBps: statement.relativeToleranceBps,
    lines: [...statement.lines]
      .sort((left, right) => left.statementLineId.localeCompare(right.statementLineId))
      .map((line) => ({
        statementLineId: line.statementLineId,
        usageAttemptId: line.usageAttemptId,
        model: line.model,
        occurredAt: line.occurredAt,
        totalTokens: line.totalTokens,
        billedCostMicroUsd: line.billedCostMicroUsd,
      })),
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function normalizeGatewayCostMicroUsd(record: RequestLogRecord): number | null {
  if (record.costEstimateAvailable === false) return null;
  const cost = Number(record.estimatedCostUsd);
  if (!Number.isFinite(cost) || cost < 0 || cost > 1_000_000) return null;
  return usdNumberToMicroUsd(cost);
}

function normalizeLedgerTokens(value: unknown) {
  const tokens = Number(value);
  return Number.isSafeInteger(tokens) && tokens >= 0 ? tokens : 0;
}

function usdToMicroUsd(value: unknown, field: string, maximumUsd: number) {
  const normalized = typeof value === "number" ? String(value) : String(value ?? "").trim();
  if (!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/u.test(normalized)) {
    throw validationError(`${field} must be a non-negative USD decimal with at most 6 fractional digits.`);
  }
  const [wholeText, fractionText = ""] = normalized.split(".");
  const microUsd = Number(wholeText) * 1_000_000 + Number(fractionText.padEnd(6, "0"));
  if (!Number.isSafeInteger(microUsd) || microUsd > maximumUsd * 1_000_000) {
    throw validationError(`${field} exceeds the bounded reconciliation limit.`);
  }
  return microUsd;
}

function usdNumberToMicroUsd(value: number) {
  const microUsd = Math.round(value * 1_000_000);
  return Number.isSafeInteger(microUsd) && microUsd >= 0
    ? Math.min(microUsd, MAX_LINE_COST_MICRO_USD)
    : 0;
}

function microUsdToNumber(value: number) {
  return Math.round(value) / 1_000_000;
}

function microUsdToSignedNumber(value: number) {
  return Math.trunc(value) / 1_000_000;
}

function objectRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw validationError(`${field} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

function assertOnlyFields(
  value: Record<string, unknown>,
  allowed: Set<string>,
  field: string,
) {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw validationError(`${field} contains unsupported fields: ${unknown.sort().join(", ")}.`);
  }
}

function portableIdentifier(value: unknown, field: string, maxLength: number) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > maxLength || !/^[A-Za-z0-9._:-]+$/u.test(normalized)) {
    throw validationError(`${field} must be a portable identifier of at most ${maxLength} characters.`);
  }
  return normalized;
}

function optionalPortableIdentifier(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = String(value).trim();
  return normalized && normalized.length <= maxLength && /^[A-Za-z0-9._:-]+$/u.test(normalized)
    ? normalized
    : null;
}

function boundedText(value: unknown, field: string, maxLength: number) {
  const normalized = String(value ?? "").trim();
  if (
    !normalized
    || normalized.length > maxLength
    || /[\u0000-\u001F\u007F]/u.test(normalized)
  ) {
    throw validationError(`${field} must be non-empty text of at most ${maxLength} characters.`);
  }
  return normalized;
}

function boundedInteger(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw validationError(`${field} must be an integer from ${minimum} to ${maximum}.`);
  }
  return parsed;
}

function isoTimestamp(value: unknown, field: string) {
  if (typeof value !== "string" || value.length < 20 || value.length > 40) {
    throw validationError(`${field} must be an ISO-8601 timestamp.`);
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw validationError(`${field} must be a canonical UTC ISO-8601 timestamp.`);
  }
  return timestamp;
}

function validationError(message: string) {
  return reconciliationError("PROVIDER_STATEMENT_INVALID", message, 400);
}

function reconciliationError(
  code: string,
  message: string,
  statusCode: number,
  retryable = false,
) {
  return Object.assign(new Error(message), {
    code,
    statusCode,
    category: "billing" as const,
    retryable,
  });
}
