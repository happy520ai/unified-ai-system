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

  it("requires a stable guarded effect before a real webhook send", async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = async () => {
      fetchCalls += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({ errcode: 0, msgid: "message-2" }),
      };
    };
    try {
      const inputs = [];
      const connector = createWeComConnector({
        dryRun: false,
        webhookUrl: "https://qyapi.weixin.example/webhook/secret",
        externalEffectGuard: {
          async reserveAndCommit(input) { inputs.push(input); },
        },
      });
      const missing = await connector.sendMessage(mockEnvelope, {});
      assert.equal(missing.error, "wecom_external_effect_key_required");
      assert.equal(fetchCalls, 0);

      const delivered = await connector.sendMessage(mockEnvelope, {
        externalEffectKey: "wecom-operation-1",
      });
      assert.equal(delivered.delivered, true);
      assert.equal(fetchCalls, 1);
      assert.equal(inputs.length, 1);
      assert.match(inputs[0].effectKeyHash, /^[a-f0-9]{64}$/);
      assert.doesNotMatch(JSON.stringify(inputs[0]), /wecom-operation-1|webhook\/secret|Test body content/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
