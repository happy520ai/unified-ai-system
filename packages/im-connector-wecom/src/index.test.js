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
      return Response.json({ errcode: 0, msgid: "message-2" });
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

  it("uses the injected transport for markdown and rejects unsupported cards before sending", async () => {
    const calls = [];
    const connector = createWeComConnector({ dryRun: false, webhookUrl: "https://example.invalid/wecom",
      externalEffectGuard: { reserveAndCommit: async () => {} },
      transport: async (url, init) => { calls.push({ url, init }); return Response.json({ errcode: 0 }); } });
    const result = await connector.sendMessage({ title: "Title", body: "**Body**" }, { format: "markdown", externalEffectKey: "markdown-one" });
    assert.equal(result.status, "accepted"); assert.equal(calls[0].init.redirect, "error");
    assert.deepEqual(JSON.parse(calls[0].init.body), { msgtype: "markdown", markdown: { content: "## Title\n\n**Body**" } });
    assert.equal((await connector.sendMessage(mockEnvelope, { format: "card", externalEffectKey: "card-one" })).status, "not_sent");
    assert.equal(calls.length, 1);
  });

  it("never retries rejected or ambiguous sends and never reflects provider error text", async () => {
    for (const [reply, expected] of [[() => Response.json({ errcode: 99, errmsg: "private-value" }), "rejected"],
      [() => new Response("invalid-json"), "outcome_unknown"], [() => Response.json({ errcode: 99 }, { status: 503 }), "outcome_unknown"],
      [() => new Response("x".repeat(65537)), "outcome_unknown"]]) {
      let calls = 0;
      const connector = createWeComConnector({ dryRun: false, webhookUrl: "https://example.invalid/wecom",
        externalEffectGuard: { reserveAndCommit: async () => {} }, transport: async () => { calls++; return reply(); } });
      const result = await connector.sendMessage(mockEnvelope, { externalEffectKey: "failed-one" });
      assert.equal(result.status, expected); assert.equal(result.messageAttempted, true); assert.equal(calls, 1);
      assert.doesNotMatch(JSON.stringify(result), /private-value/u);
    }
  });

  it("close cancels a pending response and prevents a late accepted receipt", async () => {
    let entered, resolveResponse, cancelled = false;
    const reached = new Promise(resolve => { entered = resolve; });
    const connector = createWeComConnector({ dryRun: false, webhookUrl: "https://example.invalid/wecom",
      externalEffectGuard: { reserveAndCommit: async () => {} },
      transport: () => { entered(); return new Promise(resolve => { resolveResponse = resolve; }); } });
    const operation = connector.sendMessage(mockEnvelope, { externalEffectKey: "cancel-one" });
    await reached; await connector.close();
    assert.equal((await operation).status, "outcome_unknown");
    resolveResponse(new Response(new ReadableStream({ cancel() { cancelled = true; } })));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(cancelled, true); assert.equal(connector.getHealth().status, "closed");
  });
});
