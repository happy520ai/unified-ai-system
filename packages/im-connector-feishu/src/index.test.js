import { describe, it, expect } from "vitest";
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
    expect(h.status).toBe("ready");
    expect(h.dryRun).toBe(true);
    expect(h.connectorId).toBe("feishu");
    expect(h.supportedFormats).toContain("text");
    expect(h.supportedFormats).toContain("card");
  });

  it("returns dry-run result when dryRun=true", async () => {
    const conn = createFeishuConnector({ dryRun: true });
    const result = await conn.sendMessage(mockEnvelope, {
      targetId: "ou_xxx",
      format: "text",
    });
    expect(result.delivered).toBe(false);
    expect(result.dryRun).toBe(true);
    expect(result.metadata.connectorId).toBe("feishu");
  });

  it("returns error when webhook not configured and dryRun=false", async () => {
    const conn = createFeishuConnector({ dryRun: false });
    const result = await conn.sendMessage(mockEnvelope, {
      targetId: "ou_xxx",
    });
    expect(result.delivered).toBe(false);
    expect(result.error).toBe("feishu_webhook_not_configured");
  });

  it("builds card format payload correctly", async () => {
    const conn = createFeishuConnector({ dryRun: true });
    const result = await conn.sendMessage(
      { ...mockEnvelope, riskLevel: "high", requiresResponse: true },
      { targetId: "ou_xxx", format: "card" }
    );
    expect(result.metadata.format).toBe("card");
  });
});
