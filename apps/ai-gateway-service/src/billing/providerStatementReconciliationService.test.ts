import { describe, expect, it, vi } from "vitest";
import type {
  RequestLogger,
  RequestLogRecord,
} from "../logging/requestLogger.ts";
import { createProviderStatementReconciliationService } from "./providerStatementReconciliationService.ts";

const PERIOD_START = "2026-08-01T00:00:00.000Z";
const PERIOD_END = "2026-08-01T01:00:00.000Z";
const EVENT_TIME = Date.parse("2026-08-01T00:15:00.000Z");

function record(overrides: Partial<RequestLogRecord> = {}): RequestLogRecord {
  return {
    id: "record-1",
    timestamp: EVENT_TIME,
    usageAttemptId: "attempt-1",
    usageEventType: "attempt-completed",
    tenantId: "tenant-a",
    provider: "provider-a",
    model: "model-a",
    inputTokens: 7,
    outputTokens: 3,
    totalTokens: 10,
    estimatedCostUsd: 0.5,
    costEstimateAvailable: true,
    cacheHit: false,
    fallbackUsed: false,
    shadow: false,
    providerCallAttempted: true,
    billable: true,
    ...overrides,
  };
}

function statement(overrides: Record<string, unknown> = {}) {
  return {
    statementId: "statement-2026-08-a",
    provider: "provider-a",
    currency: "USD",
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
    lines: [
      {
        statementLineId: "line-1",
        usageAttemptId: "attempt-1",
        model: "model-a",
        occurredAt: "2026-08-01T00:15:03.000Z",
        totalTokens: 10,
        billedCostUsd: "0.500001",
      },
    ],
    ...overrides,
  };
}

function createLedger(
  records: RequestLogRecord[],
  options: {
    storeMode?: string;
    distributed?: boolean;
    assertError?: Error;
    queryError?: Error;
  } = {},
): RequestLogger {
  return {
    log: vi.fn(),
    flush: vi.fn(async () => true),
    assertDurable: vi.fn(async () => {
      if (options.assertError) throw options.assertError;
      return true;
    }),
    query: vi.fn(async () => {
      if (options.queryError) throw options.queryError;
      return records;
    }),
    getStats: vi.fn(async () => ({
      totalRequests: 0,
      avgLatencyMs: 0,
      totalTokens: 0,
      totalCostUsd: 0,
      unknownCostRecords: 0,
      unresolvedBillableAttempts: 0,
      errorRate: 0,
      cacheHitRate: 0,
      fallbackRate: 0,
      byProvider: {},
      byModel: {},
    })),
    getHealth: vi.fn(() => ({
      storeMode: options.storeMode ?? "postgres",
      distributed: options.distributed ?? true,
      available: true,
    })),
    close: vi.fn(async () => undefined),
  };
}

describe("provider statement reconciliation", () => {
  it("balances exact attempt IDs without claiming provider or legal assurance", async () => {
    const ledger = createLedger([
      record({ usageEventType: "attempt-started", estimatedCostUsd: 0 }),
      record(),
    ]);
    const service = createProviderStatementReconciliationService({ requestLogger: ledger });

    const result = await service.reconcile({
      tenantId: "tenant-a",
      statement: statement(),
    });

    expect(result.schemaVersion).toBe("provider-statement-reconciliation-v1");
    expect(result.status).toBe("balanced");
    expect(result.summary).toMatchObject({
      statementLineCount: 1,
      gatewayTerminalAttemptCount: 1,
      matchedLineCount: 1,
      exactMatchLineCount: 1,
      statementOnlyLineCount: 0,
      gatewayOnlyAttemptCount: 0,
      unresolvedGatewayAttemptCount: 0,
      statementBilledCostUsd: 0.500001,
      matchedGatewayEstimatedCostUsd: 0.5,
    });
    expect(result.lines[0]).toMatchObject({
      status: "matched",
      differences: {
        modelMatches: true,
        tokenVariance: 0,
        costVarianceUsd: 0.000001,
        costWithinTolerance: true,
      },
    });
    expect(result.boundaries).toMatchObject({
      sourceAuthenticated: false,
      providerApiCalled: false,
      legalInvoice: false,
      authoritativeAccountingRecord: false,
      statementPersisted: false,
    });
    expect(result.statementDigestSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(ledger.query).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      provider: "provider-a",
      since: Date.parse(PERIOD_START),
      until: Date.parse(PERIOD_END),
      limit: 10_000,
      offset: 0,
    });
  });

  it("produces a stable digest independent of statement line order", async () => {
    const records = [
      record(),
      record({
        id: "record-2",
        usageAttemptId: "attempt-2",
        model: "model-b",
        totalTokens: 20,
        estimatedCostUsd: 0.2,
        timestamp: Date.parse("2026-08-01T00:20:00.000Z"),
      }),
    ];
    const first = {
      statementLineId: "line-1",
      usageAttemptId: "attempt-1",
      model: "model-a",
      occurredAt: "2026-08-01T00:15:00.000Z",
      totalTokens: 10,
      billedCostUsd: "0.5",
    };
    const second = {
      statementLineId: "line-2",
      usageAttemptId: "attempt-2",
      model: "model-b",
      occurredAt: "2026-08-01T00:20:00.000Z",
      totalTokens: 20,
      billedCostUsd: "0.2",
    };
    const service = createProviderStatementReconciliationService({
      requestLogger: createLedger(records),
    });

    const forward = await service.reconcile({
      tenantId: "tenant-a",
      statement: statement({ lines: [first, second] }),
    });
    const reverse = await service.reconcile({
      tenantId: "tenant-a",
      statement: statement({ lines: [second, first] }),
    });

    expect(forward.statementDigestSha256).toBe(reverse.statementDigestSha256);
    expect(forward.status).toBe("balanced");
    expect(reverse.status).toBe("balanced");
  });

  it("surfaces statement-only, gateway-only, unresolved, metadata, and variance risks", async () => {
    const ledger = createLedger([
      record({ model: "gateway-model", estimatedCostUsd: 0.1 }),
      record({
        id: "record-2",
        usageAttemptId: "attempt-2",
        model: "model-b",
        estimatedCostUsd: 0.2,
      }),
      record({
        id: "record-started",
        usageAttemptId: "attempt-unresolved",
        usageEventType: "attempt-started",
        estimatedCostUsd: 0,
      }),
    ]);
    const service = createProviderStatementReconciliationService({ requestLogger: ledger });

    const result = await service.reconcile({
      tenantId: "tenant-a",
      statement: statement({
        absoluteToleranceUsd: "0.000001",
        relativeToleranceBps: 0,
        lines: [
          {
            statementLineId: "line-1",
            usageAttemptId: "attempt-1",
            model: "statement-model",
            occurredAt: "2026-08-01T00:15:00.000Z",
            totalTokens: 99,
            billedCostUsd: "1.0",
          },
          {
            statementLineId: "line-missing",
            usageAttemptId: "attempt-missing",
            model: "model-a",
            occurredAt: "2026-08-01T00:16:00.000Z",
            billedCostUsd: "0.01",
          },
        ],
      }),
    });

    expect(result.status).toBe("needs_review");
    expect(result.lines.map((line) => line.status)).toEqual([
      "metadata_mismatch",
      "statement_only",
    ]);
    expect(result.gatewayOnly.map((item) => item.usageAttemptId)).toEqual(["attempt-2"]);
    expect(result.unresolvedGatewayAttemptIds).toEqual(["attempt-unresolved"]);
    expect(result.risks).toEqual(expect.arrayContaining([
      "statement_lines_missing_from_gateway_ledger",
      "gateway_attempts_missing_from_statement",
      "cost_variance_exceeds_tolerance",
      "model_or_token_metadata_mismatch",
      "unresolved_billable_gateway_attempts",
    ]));
    expect(result.summary.costVarianceLineCount).toBe(1);
  });

  it("does not leak or match records returned for another tenant", async () => {
    const service = createProviderStatementReconciliationService({
      requestLogger: createLedger([record({ tenantId: "tenant-b" })]),
    });

    const result = await service.reconcile({
      tenantId: "tenant-a",
      statement: statement(),
    });

    expect(result.status).toBe("needs_review");
    expect(result.lines[0].status).toBe("statement_only");
    expect(result.gatewayOnly).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("tenant-b");
  });

  it("rejects ambiguous or secret-shaped extra input fields", async () => {
    const service = createProviderStatementReconciliationService({
      requestLogger: createLedger([]),
    });

    await expect(service.reconcile({
      tenantId: "tenant-a",
      statement: statement({ apiKey: "must-not-be-accepted" }),
    })).rejects.toMatchObject({ code: "PROVIDER_STATEMENT_INVALID", statusCode: 400 });
    await expect(service.reconcile({
      tenantId: "tenant-a",
      statement: statement({
        lines: [
          {
            statementLineId: "line-1",
            usageAttemptId: "attempt-1",
            model: "model-a",
            occurredAt: "2026-08-01T00:15:00.000Z",
            billedCostUsd: "0.1",
          },
          {
            statementLineId: "line-2",
            usageAttemptId: "attempt-1",
            model: "model-a",
            occurredAt: "2026-08-01T00:16:00.000Z",
            billedCostUsd: "0.2",
          },
        ],
      }),
    })).rejects.toMatchObject({ code: "PROVIDER_STATEMENT_INVALID", statusCode: 400 });
  });

  it("requires canonical USD periods and bounded decimal values", async () => {
    const service = createProviderStatementReconciliationService({
      requestLogger: createLedger([]),
    });

    await expect(service.reconcile({
      tenantId: "tenant-a",
      statement: statement({ currency: "EUR" }),
    })).rejects.toMatchObject({ code: "PROVIDER_STATEMENT_INVALID" });
    await expect(service.reconcile({
      tenantId: "tenant-a",
      statement: statement({ periodStart: "2026-08-01" }),
    })).rejects.toMatchObject({ code: "PROVIDER_STATEMENT_INVALID" });
    await expect(service.reconcile({
      tenantId: "tenant-a",
      statement: statement({
        lines: [{
          statementLineId: "line-1",
          usageAttemptId: "attempt-1",
          model: "model-a",
          occurredAt: "2026-08-01T00:15:00.000Z",
          billedCostUsd: "0.0000001",
        }],
      }),
    })).rejects.toMatchObject({ code: "PROVIDER_STATEMENT_INVALID" });
  });

  it("fails closed without a healthy central ledger or with a truncated dataset", async () => {
    const localService = createProviderStatementReconciliationService({
      requestLogger: createLedger([], { storeMode: "file", distributed: false }),
    });
    await expect(localService.reconcile({
      tenantId: "tenant-a",
      statement: statement(),
    })).rejects.toMatchObject({
      code: "PROVIDER_STATEMENT_CENTRAL_LEDGER_REQUIRED",
      statusCode: 409,
    });

    const unavailableService = createProviderStatementReconciliationService({
      requestLogger: createLedger([], { assertError: new Error("connection contains sensitive detail") }),
    });
    await expect(unavailableService.reconcile({
      tenantId: "tenant-a",
      statement: statement(),
    })).rejects.toMatchObject({
      code: "PROVIDER_STATEMENT_LEDGER_UNAVAILABLE",
      statusCode: 503,
      message: "The central usage ledger is unavailable for reconciliation.",
    });

    const truncatedService = createProviderStatementReconciliationService({
      requestLogger: createLedger(new Array(10_000).fill(record())),
    });
    await expect(truncatedService.reconcile({
      tenantId: "tenant-a",
      statement: statement(),
    })).rejects.toMatchObject({
      code: "PROVIDER_STATEMENT_LEDGER_TRUNCATED",
      statusCode: 409,
    });
  });

  it("marks duplicate gateway terminals and unknown estimates for review", async () => {
    const service = createProviderStatementReconciliationService({
      requestLogger: createLedger([
        record(),
        record({ id: "duplicate" }),
        record({
          id: "unknown-cost",
          usageAttemptId: "attempt-unknown-cost",
          costEstimateAvailable: false,
          estimatedCostUsd: 0,
        }),
      ]),
    });

    const result = await service.reconcile({
      tenantId: "tenant-a",
      statement: statement({
        lines: [
          {
            statementLineId: "line-1",
            usageAttemptId: "attempt-1",
            model: "model-a",
            occurredAt: "2026-08-01T00:15:00.000Z",
            billedCostUsd: "0.5",
          },
          {
            statementLineId: "line-2",
            usageAttemptId: "attempt-unknown-cost",
            model: "model-a",
            occurredAt: "2026-08-01T00:15:00.000Z",
            billedCostUsd: "0.1",
          },
        ],
      }),
    });

    expect(result.status).toBe("needs_review");
    expect(result.lines.map((line) => line.status)).toEqual([
      "ambiguous_gateway_attempt",
      "unknown_gateway_estimate",
    ]);
    expect(result.duplicateGatewayAttemptIds).toEqual(["attempt-1"]);
    expect(result.risks).toEqual(expect.arrayContaining([
      "duplicate_gateway_attempts",
      "gateway_cost_estimate_unavailable",
    ]));
  });
});
