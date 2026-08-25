import { describe, it, expect } from "vitest";
import { formatInvoiceLineItem } from "./invoiceEstimateFormatter.js";
import { buildBillingEvent } from "./billingEventRecorder.js";
import { BILLING_ERROR_CODES } from "./billingErrors.js";

describe("invoice-estimate-formatter", () => {
  it("returns defaults for empty input", () => {
    const result = formatInvoiceLineItem();
    expect(result.mode).toBe("normal");
    expect(result.providerId).toBe("nvidia");
    expect(result.modelId).toBe("unknown");
    expect(result.requestCount).toBe(0);
    expect(result.estimatedInputTokens).toBe(0);
    expect(result.estimatedOutputTokens).toBe(0);
    expect(result.estimatedCost).toBe(0);
    expect(result.costSource).toBe("mock_estimate_formula");
    expect(result.estimateConfidence).toBe("low_to_medium");
  });

  it("normalizes string numbers to actual numbers", () => {
    const result = formatInvoiceLineItem({
      requestCount: "5",
      estimatedInputTokens: "100",
      estimatedOutputTokens: "50",
      estimatedCost: "0.003",
    });
    expect(result.requestCount).toBe(5);
    expect(result.estimatedInputTokens).toBe(100);
    expect(result.estimatedOutputTokens).toBe(50);
    expect(result.estimatedCost).toBe(0.003);
  });

  it("preserves provided values", () => {
    const result = formatInvoiceLineItem({
      mode: "tianshu",
      providerId: "openai",
      modelId: "gpt-4o",
      costSource: "real_api",
      estimateConfidence: "high",
    });
    expect(result.mode).toBe("tianshu");
    expect(result.providerId).toBe("openai");
    expect(result.modelId).toBe("gpt-4o");
    expect(result.costSource).toBe("real_api");
    expect(result.estimateConfidence).toBe("high");
  });
});

describe("billing-event-recorder", () => {
  it("builds event from estimate", () => {
    const estimate = {
      requestId: "req-1",
      userIdRef: "user-1",
      mode: "normal",
      providerId: "nvidia",
      modelId: "llama-3",
      estimatedCost: 0.003,
    };
    const event = buildBillingEvent({ eventId: "evt-1", estimate });
    expect(event.eventId).toBe("evt-1");
    expect(event.requestId).toBe("req-1");
    expect(event.userIdRef).toBe("user-1");
    expect(event.providerId).toBe("nvidia");
    expect(event.estimatedCost).toBe(0.003);
    expect(event.actualCost).toBe(null);
    expect(event.actualCostAvailable).toBe(false);
    expect(event.billingProviderConnected).toBe(false);
    expect(event.eventType).toBe("estimate_created");
  });

  it("accepts custom eventType", () => {
    const event = buildBillingEvent({
      eventId: "evt-2",
      estimate: { requestId: "r" },
      eventType: "billing_confirmed",
    });
    expect(event.eventType).toBe("billing_confirmed");
  });

  it("includes auditTrace", () => {
    const trace = { step: "approval", actor: "admin" };
    const event = buildBillingEvent({
      eventId: "evt-3",
      estimate: { requestId: "r" },
      auditTrace: trace,
    });
    expect(event.auditTrace).toEqual(trace);
  });

  it("generates ISO timestamp", () => {
    const event = buildBillingEvent({ eventId: "evt-4", estimate: { requestId: "r" } });
    expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe("billing-errors", () => {
  it("exports frozen error codes", () => {
    expect(Object.isFrozen(BILLING_ERROR_CODES)).toBe(true);
  });

  it("contains expected error codes", () => {
    expect(BILLING_ERROR_CODES.DAILY_BUDGET_LIMIT_EXCEEDED).toBe("DAILY_BUDGET_LIMIT_EXCEEDED");
    expect(BILLING_ERROR_CODES.MONTHLY_BUDGET_LIMIT_EXCEEDED).toBe("MONTHLY_BUDGET_LIMIT_EXCEEDED");
    expect(BILLING_ERROR_CODES.REQUEST_COST_ABOVE_CONFIRMATION_THRESHOLD).toBe("REQUEST_COST_ABOVE_CONFIRMATION_THRESHOLD");
  });
});
