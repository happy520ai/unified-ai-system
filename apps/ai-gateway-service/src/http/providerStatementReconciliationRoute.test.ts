import { describe, expect, it, vi } from "vitest";
import { dispatchHttpRoutes01 } from "./httpServerRoutes01.js";

describe("provider statement reconciliation route", () => {
  it("binds reconciliation to the authenticated tenant and records a body-free audit summary", async () => {
    const reconcile = vi.fn(async () => ({
      status: "needs_review",
      tenantId: "tenant-a",
      provider: "provider-a",
      statementId: "statement-1",
      statementDigestSha256: "a".repeat(64),
      summary: {
        statementLineCount: 1,
        exactMatchLineCount: 0,
      },
      risks: ["statement_lines_missing_from_gateway_ledger"],
    }));
    const recordAudit = vi.fn(async (_event: unknown) => undefined);
    const writeJson = vi.fn();
    const body = {
      statementId: "statement-1",
      provider: "provider-a",
      currency: "USD",
      periodStart: "2026-08-01T00:00:00.000Z",
      periodEnd: "2026-08-01T01:00:00.000Z",
      lines: [],
    };

    await dispatchHttpRoutes01({
      application: {
        providerStatementReconciliationService: { reconcile },
      },
      request: {
        method: "POST",
        enterpriseIdentity: {
          tenantId: "tenant-a",
          userId: "operator-a",
          role: "admin",
        },
      },
      response: {},
      url: { pathname: "/enterprise/provider-statement-reconciliation" },
      startedAt: 100,
      readJson: vi.fn(async () => body),
      enterpriseGovernanceService: { recordAudit },
      createOkEnvelope: (data: unknown) => ({ ok: true, data }),
      writeJson,
      writeEnterpriseError: vi.fn(),
    });

    expect(reconcile).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      statement: body,
    });
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({
      outcome: "review-required",
      permission: "user:admin",
      code: "provider_statement_reconciliation_completed",
      details: {
        tenantId: "tenant-a",
        provider: "provider-a",
        statementId: "statement-1",
        statementDigestSha256: "a".repeat(64),
        status: "needs_review",
        statementLineCount: 1,
        exactMatchLineCount: 0,
        riskCount: 1,
        sourceAuthenticated: false,
        legalInvoice: false,
      },
    }));
    const serializedAudit = JSON.stringify(recordAudit.mock.calls[0]?.[0]);
    expect(serializedAudit).not.toContain("periodStart");
    expect(serializedAudit).not.toContain("lines");
    expect(writeJson).toHaveBeenCalledWith(
      {},
      200,
      expect.objectContaining({ ok: true }),
    );
  });

  it("uses the enterprise error boundary without returning partial reconciliation", async () => {
    const error = Object.assign(new Error("safe error"), {
      code: "PROVIDER_STATEMENT_INVALID",
      statusCode: 400,
    });
    const writeEnterpriseError = vi.fn();
    const writeJson = vi.fn();

    await dispatchHttpRoutes01({
      application: {
        providerStatementReconciliationService: {
          reconcile: vi.fn(async () => {
            throw error;
          }),
        },
      },
      request: {
        method: "POST",
        enterpriseIdentity: { tenantId: "tenant-a", userId: "operator-a" },
      },
      response: {},
      url: { pathname: "/enterprise/provider-statement-reconciliation" },
      startedAt: 100,
      readJson: vi.fn(async () => ({})),
      enterpriseGovernanceService: { recordAudit: vi.fn() },
      createOkEnvelope: vi.fn(),
      writeJson,
      writeEnterpriseError,
    });

    expect(writeJson).not.toHaveBeenCalled();
    expect(writeEnterpriseError).toHaveBeenCalledWith({
      response: {},
      error,
      startedAt: 100,
      fallbackCode: "provider_statement_reconciliation_failed",
    });
  });
});
