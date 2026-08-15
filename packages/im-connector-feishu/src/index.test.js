import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createFeishuConnector } from "./index.js";

describe("im-connector-feishu", () => {
  const mockEnvelope = {
    title: "Test Title",
    body: "Test body content",
    riskLevel: "low",
    requiresResponse: false,
  };

  it("creates connector with default dry-run", () => {
    const conn = createFeishuConnector();
    const h = conn.getHealth();
    assert.equal(h.status, "ready");
    assert.equal(h.dryRun, true);
    assert.equal(h.connectorId, "feishu");
    assert.ok(h.supportedFormats.includes("text"));
    assert.ok(h.supportedFormats.includes("card"));
  });

  it("returns dry-run result when dryRun=true", async () => {
    const conn = createFeishuConnector({ dryRun: true });
    const result = await conn.sendMessage(mockEnvelope, {
      targetId: "ou_xxx",
      format: "text",
    });
    assert.equal(result.delivered, false);
    assert.equal(result.dryRun, true);
    assert.equal(result.metadata.connectorId, "feishu");
  });

  it("returns error when webhook not configured and dryRun=false", async () => {
    const conn = createFeishuConnector({ dryRun: false });
    const result = await conn.sendMessage(mockEnvelope, {
      targetId: "ou_xxx",
    });
    assert.equal(result.delivered, false);
    assert.equal(result.error, "feishu_webhook_not_configured");
  });

  it("builds card format payload correctly", async () => {
    const conn = createFeishuConnector({ dryRun: true });
    const result = await conn.sendMessage(
      { ...mockEnvelope, riskLevel: "high", requiresResponse: true },
      { targetId: "ou_xxx", format: "card" },
    );
    assert.equal(result.metadata.format, "card");
  });
});
