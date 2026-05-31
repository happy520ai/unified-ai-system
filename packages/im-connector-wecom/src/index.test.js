import { describe, it, expect } from "vitest";
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
    expect(h.status).toBe("ready");
    expect(h.dryRun).toBe(true);
    expect(h.connectorId).toBe("wecom");
    expect(h.supportedFormats).toContain("text");
    expect(h.supportedFormats).toContain("markdown");
  });

  it("returns dry-run result when dryRun=true", async () => {
    const conn = createWeComConnector({ dryRun: true });
    const result = await conn.sendMessage(mockEnvelope, {
      targetId: "user123",
      format: "text",
    });
    expect(result.delivered).toBe(false);
    expect(result.dryRun).toBe(true);
    expect(result.metadata.connectorId).toBe("wecom");
  });

  it("returns error when webhook not configured and dryRun=false", async () => {
    const conn = createWeComConnector({ dryRun: false });
    const result = await conn.sendMessage(mockEnvelope, {
      targetId: "user123",
    });
    expect(result.delivered).toBe(false);
    expect(result.error).toBe("wecom_webhook_not_configured");
  });
});
