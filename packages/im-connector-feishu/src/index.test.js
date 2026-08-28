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

  it("fails closed without an external-effect guard and sends only after hashed reservation", async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = async () => {
      fetchCalls += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({ code: 0, message_id: "message-1" }),
      };
    };
    try {
      const unguarded = createFeishuConnector({
        dryRun: false,
        webhookUrl: "https://open.feishu.example/webhook/secret",
      });
      const denied = await unguarded.sendMessage(mockEnvelope, {
        externalEffectKey: "feishu-operation-1",
      });
      assert.equal(denied.error, "feishu_external_effect_guard_required");
      assert.equal(fetchCalls, 0);

      let reservationInput;
      const guarded = createFeishuConnector({
        dryRun: false,
        webhookUrl: "https://open.feishu.example/webhook/secret",
        externalEffectGuard: {
          async reserveAndCommit(input) { reservationInput = input; },
        },
      });
      const delivered = await guarded.sendMessage(mockEnvelope, {
        externalEffectKey: "feishu-operation-1",
      });
      assert.equal(delivered.delivered, true);
      assert.equal(fetchCalls, 1);
      assert.match(reservationInput.effectKeyHash, /^[a-f0-9]{64}$/);
      assert.match(reservationInput.targetFingerprint, /^[a-f0-9]{64}$/);
      assert.match(reservationInput.payloadFingerprint, /^[a-f0-9]{64}$/);
      assert.doesNotMatch(JSON.stringify(reservationInput), /feishu-operation-1|webhook\/secret|Test body content/);
      assert.equal(guarded.getHealth().externalEffectGuardConfigured, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
