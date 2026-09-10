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
      return Response.json({ code: 0, message_id: "message-1" });
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

describe("Feishu API and actual wire formats", () => {
  function apiFixture(overrides = {}) {
    const calls = [], reservations = [];
    const connector = createFeishuConnector({ mode: "api", appId: "fixture-app", appSecret: "fixture-secret", dryRun: false,
      externalEffectGuard: { reserveAndCommit: async input => { reservations.push(input); } },
      transport: async (url, init) => {
        calls.push({ url, init });
        return Response.json(url.includes("tenant_access_token") ? { code: 0, tenant_access_token: "fixture-token", expire: 3600 }
          : { code: 0, data: { message_id: "om_fixture" } });
      }, ...overrides });
    return { connector, calls, reservations };
  }
  const target = { targetId: "oc_fixture", receiveIdType: "chat_id", externalEffectKey: "operation-one" };

  it("reserves before materializing the secret, then sends the API content and reads its nested receipt", async () => {
    const events = [], calls = [];
    const connector = createFeishuConnector({ mode: "api", appId: "fixture-app", dryRun: false,
      getAppSecret: async () => { events.push("secret"); return "fixture-secret"; },
      externalEffectGuard: { reserveAndCommit: async () => { events.push("reserve"); } },
      transport: async (url, init) => {
        calls.push({ url, init }); events.push(calls.length === 1 ? "auth" : "message");
        return Response.json(calls.length === 1 ? { code: 0, tenant_access_token: "fixture-token", expire: 3600 }
          : { code: 0, data: { message_id: "om_fixture" } });
      } });
    const result = await connector.sendMessage({ title: "Title", body: "Content" },
      { targetId: "oc_fixture", receiveIdType: "chat_id", format: "text", externalEffectKey: "operation-one" });
    assert.equal(result.delivered, true);
    assert.equal(result.status, "accepted");
    assert.equal(result.externalMessageId, "om_fixture");
    assert.deepEqual(events, ["reserve", "secret", "auth", "message"]);
    assert.equal(calls[0].url, "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal");
    assert.equal(calls[1].url, "https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id");
    assert.deepEqual(JSON.parse(calls[1].init.body), { receive_id: "oc_fixture", msg_type: "text", content: JSON.stringify({ text: "[Title]\nContent" }) });
    assert.doesNotMatch(JSON.stringify(result), /fixture-secret|fixture-token/u);
  });

  it("sends markdown as a real interactive webhook payload", async t => {
    let payload;
    t.mock.method(globalThis, "fetch", async (_url, init) => { payload = JSON.parse(init.body); return Response.json({ code: 0 }); });
    const connector = createFeishuConnector({ dryRun: false, webhookUrl: "https://example.invalid/fixed-webhook",
      externalEffectGuard: { reserveAndCommit: async () => {} } });
    const result = await connector.sendMessage({ body: "**Markdown**" }, { format: "markdown", externalEffectKey: "markdown-one" });
    assert.equal(result.delivered, true);
    assert.equal(payload.msg_type, "interactive");
    assert.equal(payload.card.elements[0].content, "**Markdown**");
  });

  it("uses the exact API recipient and payload shape for all supported types and formats", async () => {
    const { connector, calls, reservations } = apiFixture();
    for (const receiveIdType of ["open_id", "user_id", "union_id", "email", "chat_id"]) {
      for (const format of ["text", "markdown", "card"]) {
        const targetId = receiveIdType === "email" ? "test@example.invalid" : "fixture-recipient";
        const result = await connector.sendMessage({ title: "Title", body: "**Body**" },
          { ...target, targetId, receiveIdType, format, externalEffectKey: `${receiveIdType}-${format}` });
        assert.equal(result.status, "accepted");
        const call = calls.at(-1), payload = JSON.parse(call.init.body), content = JSON.parse(payload.content);
        assert.equal(call.url, `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=${receiveIdType}`);
        assert.equal(call.init.redirect, "error"); assert.equal(call.init.headers.authorization, "Bearer fixture-token");
        assert.equal(payload.receive_id, targetId);
        assert.equal(payload.msg_type, format === "text" ? "text" : "interactive");
        assert.equal(format === "text" ? content.text : content.elements[0].content, format === "text" ? "[Title]\n**Body**" : "**Body**");
      }
    }
    assert.equal(calls.filter(call => call.url.includes("tenant_access_token")).length, 1);
    assert.equal(reservations.length, 15);
    assert.equal(new Set(reservations.map(item => item.targetFingerprint)).size, 5);
    assert.doesNotMatch(JSON.stringify(reservations), /fixture-secret|fixture-token|fixture-recipient|\*\*Body/u);
    await connector.close();
    assert.equal((await connector.sendMessage({ body: "closed" }, target)).messageAttempted, false);
  });

  it("rejects invalid format, recipient and key before reservation or authentication", async () => {
    const { connector, calls, reservations } = apiFixture();
    for (const badTarget of [{ ...target, format: "video" }, { ...target, receiveIdType: "arbitrary" },
      { ...target, targetId: "bad\nrecipient" }, { ...target, targetId: "" }, { ...target, externalEffectKey: "" }]) {
      const result = await connector.sendMessage({ body: "text" }, badTarget);
      assert.equal(result.status, "not_sent"); assert.equal(result.messageAttempted, false);
    }
    assert.equal((await connector.sendMessage({ body: "x".repeat(16385) }, target)).status, "not_sent");
    assert.equal(calls.length, 0); assert.equal(reservations.length, 0);
  });

  it("does not authenticate a duplicate key or disclose guard/credential failures", async () => {
    let materialized = 0;
    const { connector, calls } = apiFixture({ getAppSecret: async () => { materialized++; return "private-value"; },
      externalEffectGuard: { reserveAndCommit: async () => { throw new Error("private-value"); } } });
    const result = await connector.sendMessage({ body: "text" }, target);
    assert.equal(result.error, "feishu_external_effect_rejected");
    assert.equal(materialized, 0); assert.equal(calls.length, 0);
    assert.doesNotMatch(JSON.stringify(result), /private-value/u);
  });

  it("refuses malformed authentication and never submits a message", async () => {
    for (const data of [{ code: 1, msg: "private-value" }, { code: 0, tenant_access_token: "private-value" },
      { code: 0, tenant_access_token: "token\ninvalid", expire: 3600 }, { code: 0, tenant_access_token: "private-value", expire: 0 }]) {
      let calls = 0;
      const { connector } = apiFixture({ transport: async () => { calls++; return Response.json(data); } });
      const result = await connector.sendMessage({ body: "text" }, target);
      assert.equal(result.status, "not_sent"); assert.equal(result.messageAttempted, false); assert.equal(calls, 1);
      assert.doesNotMatch(JSON.stringify(result), /private-value/u);
    }
  });

  it("does not reuse a token inside its expiry safety margin", async () => {
    let authCalls = 0;
    const { connector } = apiFixture({ transport: async url => {
      if (url.includes("tenant_access_token")) { authCalls++; return Response.json({ code: 0, tenant_access_token: "fixture-token", expire: 1 }); }
      return Response.json({ code: 0, data: { message_id: "om_fixture" } });
    } });
    await connector.sendMessage({ body: "one" }, target);
    await connector.sendMessage({ body: "two" }, { ...target, externalEffectKey: "operation-two" });
    assert.equal(authCalls, 2);
  });

  it("classifies explicit rejection and ambiguous receipts without retrying", async () => {
    for (const [reply, expected] of [
      [() => Response.json({ code: 77, msg: "fixture-secret fixture-token" }), "rejected"],
      [() => Response.json({ code: 0, data: {} }), "outcome_unknown"],
      [() => Response.json({ code: 77 }, { status: 503 }), "outcome_unknown"],
      [() => new Response("not-json"), "outcome_unknown"],
      [() => new Response("x".repeat(65537)), "outcome_unknown"],
    ]) {
      let messages = 0;
      const { connector } = apiFixture({ transport: async url => {
        if (url.includes("tenant_access_token")) return Response.json({ code: 0, tenant_access_token: "fixture-token", expire: 3600 });
        messages++; return reply();
      } });
      const result = await connector.sendMessage({ body: "text" }, target);
      assert.equal(result.status, expected); assert.equal(result.delivered, false); assert.equal(result.messageAttempted, true);
      assert.equal(messages, 1); assert.doesNotMatch(JSON.stringify(result), /fixture-secret|fixture-token/u);
    }
  });

  it("cancels before auth, after auth and during a message without late success", async () => {
    for (const stage of ["reserve", "auth", "message"]) {
      const abort = new AbortController(); let messages = 0, authCalls = 0;
      const { connector } = apiFixture({ externalEffectGuard: { reserveAndCommit: async () => { if (stage === "reserve") abort.abort(); } },
        transport: async url => {
          if (url.includes("tenant_access_token")) { authCalls++; if (stage === "auth") abort.abort(); return Response.json({ code: 0, tenant_access_token: "fixture-token", expire: 3600 }); }
          messages++; abort.abort(); return Response.json({ code: 0, data: { message_id: "om_late" } });
        } });
      const result = await connector.sendMessage({ body: "text" }, target, { signal: abort.signal });
      assert.equal(result.delivered, false); assert.equal(messages, stage === "message" ? 1 : 0);
      assert.equal(authCalls, stage === "reserve" ? 0 : 1);
      assert.equal(result.outcomeUnknown, stage === "message");
    }
  });

  it("close interrupts a pending secret read and never makes a late auth request", async () => {
    let finishSecret, entered;
    const reached = new Promise(resolve => { entered = resolve; });
    const { connector, calls } = apiFixture({ getAppSecret: () => { entered(); return new Promise(resolve => { finishSecret = resolve; }); } });
    const operation = connector.sendMessage({ body: "text" }, target);
    await reached; await connector.close();
    assert.equal((await operation).status, "not_sent");
    finishSecret("fixture-secret"); await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls.length, 0); assert.equal(connector.getHealth().status, "closed");
  });

  it("times out and cancels a stalled response body", async () => {
    let cancelled = false;
    const keepAlive = setTimeout(() => {}, 100);
    try {
      const { connector } = apiFixture({ timeoutMs: 15, transport: async url => url.includes("tenant_access_token")
        ? Response.json({ code: 0, tenant_access_token: "fixture-token", expire: 3600 })
        : new Response(new ReadableStream({ cancel() { cancelled = true; } })) });
      const result = await connector.sendMessage({ body: "text" }, target);
      assert.equal(result.status, "outcome_unknown"); assert.equal(result.messageAttempted, true); assert.equal(cancelled, true);
    } finally { clearTimeout(keepAlive); }
  });
});
