import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createWeComConnector } from "./index.js";

describe("im-connector-wecom", () => {
  const mockEnvelope = {
    title: "Test Title",
    body: "Test body content",
    riskLevel: "low",
    requiresResponse: false,
  };

  it("creates connector with default dry-run", () => {
    const conn = createWeComConnector();
    const h = conn.getHealth();
    assert.equal(h.status, "ready");
    assert.equal(h.dryRun, true);
    assert.equal(h.connectorId, "wecom");
    assert.ok(h.supportedFormats.includes("text"));
    assert.ok(h.supportedFormats.includes("markdown"));
  });

  it("returns dry-run result when dryRun=true", async () => {
    const conn = createWeComConnector({ dryRun: true });
    const result = await conn.sendMessage(mockEnvelope, {
      targetId: "user123",
      format: "text",
    });
    assert.equal(result.delivered, false);
    assert.equal(result.dryRun, true);
    assert.equal(result.metadata.connectorId, "wecom");
  });

  it("returns error when webhook not configured and dryRun=false", async () => {
    const conn = createWeComConnector({ dryRun: false });
    const result = await conn.sendMessage(mockEnvelope, {
      targetId: "user123",
    });
    assert.equal(result.delivered, false);
    assert.equal(result.error, "wecom_webhook_not_configured");
  });
});
