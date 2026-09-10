import assert from "node:assert/strict";
import test from "node:test";
import { createLlmBrain, validateBrowserAction } from "../src/llmBrain.js";
import { executeAction } from "../src/browserExecutor.js";
import { createWebAgent } from "../src/webAgent.js";

test("an absent model cannot produce a browser decision", async () => {
  await assert.rejects(async () => createLlmBrain().decide({}), /WEB_MODEL_REQUIRED/);
});

test("empty or malformed model output cannot become an extract action", async () => {
  for (const content of ["", "not JSON", "null", "[]", '{"type":"wait"}', '{"type":"extractText","selector":"body"}']) {
    await assert.rejects(() => createLlmBrain({ generate: async () => ({ content }) }).decide({}), /WEB_DECISION_INVALID/);
  }
});

test("unknown browser actions cannot read page text", async () => {
  let reads = 0;
  const page = { locator: () => ({ innerText: async () => { reads++; return "not a completed goal"; } }) };
  await assert.rejects(() => executeAction(page, { type: "unknown" }), /WEB_DECISION_INVALID/);
  assert.equal(reads, 0);
});

test("the loop cannot claim completion without an independent goal verifier", async () => {
  let contexts = 0;
  const browser = { newContext: async () => { contexts++; return {
    newPage: async () => ({ $$eval: async () => [], url: () => "about:blank", title: async () => "", locator: () => ({ innerText: async () => "fixture" }) }),
    close: async () => {},
  }; } };
  await assert.rejects(() => createWebAgent({ browser, generate: async () => ({ content: '{"type":"extractText"}' }) }).run({ goal: "Find the approved item" }), /WEB_GOAL_VERIFIER_REQUIRED/);
  assert.equal(contexts, 0);
});

test("actions reject extra fields, accessors, hidden fields, prototypes, invalid identities and oversized values", () => {
  const valid = { type: "fill", observationId: "observation-1", targetId: "query", value: "approved-item" };
  assert.deepEqual(validateBrowserAction(valid), valid);
  let getterReads = 0;
  const accessor = { ...valid }; Object.defineProperty(accessor, "value", { get() { getterReads++; return "bad"; } });
  const hidden = { ...valid }; Object.defineProperty(hidden, "selector", { value: "body" });
  for (const action of [{ ...valid, url: "https://outside.invalid" }, accessor, hidden,
    Object.assign(Object.create({}), valid), { ...valid, observationId: "../old" },
    { ...valid, value: "x".repeat(4097) }, { ...valid, value: "\u0000" }]) assert.throws(() => validateBrowserAction(action), /WEB_DECISION_INVALID/);
  assert.equal(getterReads, 0);
});

test("real Chromium observes changing controls, verifies the DOM, and closes each context", async (t) => {
  const { chromium } = await import("playwright");
  const { existsSync } = await import("node:fs");
  const browser = await chromium.launch({ headless: true, ...(existsSync(chromium.executablePath()) ? {} : { channel: "chrome" }) });
  t.after(async () => { await browser.close(); assert.equal(browser.isConnected(), false); });
  const html = `<input data-target="query"><button data-target="search" onclick="document.querySelector('#results').innerHTML='<button data-target=detail onclick=showDetail()>Details</button>'">Search</button><div id="results"></div><div data-target="result"></div>
    <script>function showDetail(){ const node=document.querySelector('[data-target=result]'); node.dataset.itemId=document.querySelector('input').value; node.textContent='Approved details'; }</script>`;
  function options(extra = {}) {
    return { browser, initialize: ({ page }) => page.setContent(html),
      observe: async (page) => ({ targets: await page.$$eval("[data-target]", (nodes) => nodes.map((node) => node.dataset.target)) }),
      resolveTarget: (page, action) => page.$(`[data-target="${action.targetId}"]`),
      verifyGoal: async (page) => await page.locator('[data-target="result"]').getAttribute("data-item-id") === "approved-item"
        && await page.locator('[data-target="result"]').innerText() === "Approved details", ...extra };
  }
  const decisions = [{ type: "fill", targetId: "query", value: "approved-item" }, { type: "click", targetId: "search" },
    { type: "click", targetId: "detail" }, { type: "extractText", targetId: "result" }, { type: "done" }];
  await t.test("dynamic search and detail extraction uses fresh observations and real element operations", async () => {
    const seen = []; let next = 0;
    const agent = createWebAgent(options({ generate: async ({ messages }) => {
      const { snapshot } = JSON.parse(messages[1].content); seen.push(snapshot);
      const action = decisions[next++];
      if (action.targetId) assert.ok(snapshot.targets.includes(action.targetId));
      return { content: JSON.stringify({ ...action, observationId: snapshot.observationId }) };
    } }));
    const result = await agent.run({ goal: "Search approved-item and extract details" });
    assert.equal(result.success, true); assert.equal(result.status, "completed");
    assert.equal(result.actionsTotal, 4); assert.equal(result.tokenUsage.llmCalls, 5);
    assert.equal(result.tokenUsage.totalTokens, null); assert.equal(result.extracted[0].text, "Approved details");
    assert.equal(new Set(seen.map((item) => item.observationId)).size, 5);
    assert.equal(seen[0].targets.includes("detail"), false); assert.equal(seen[2].targets.includes("detail"), true);
    assert.equal(browser.contexts().length, 0);
  });
  await t.test("stale observations fail before any effect", async () => {
    let effects = 0;
    const agent = createWebAgent(options({ execute: async () => { effects++; return {}; }, generate: async () => ({ content: JSON.stringify({ type: "click", targetId: "search", observationId: "old" }) }) }));
    await assert.rejects(() => agent.run({ goal: "Search" }), /WEB_OBSERVATION_STALE/);
    assert.equal(effects, 0); assert.equal(browser.contexts().length, 0);
  });
  await t.test("done alone, a failed predicate and a consumed action budget cannot report success", async () => {
    for (const scenario of ["done-only", "wrong-item", "budget"]) {
      let next = 0;
      const agent = createWebAgent(options({ limits: { maxSteps: scenario === "budget" ? 1 : 3 }, generate: async ({ messages }) => {
        const { observationId } = JSON.parse(messages[1].content).snapshot;
        const action = next++ === 0 && scenario !== "done-only" ? { type: "click", targetId: "search" } : { type: "done" };
        return { content: JSON.stringify({ ...action, observationId }) };
      } }));
      const result = await agent.run({ goal: "Find approved-item" });
      assert.equal(result.success, false); assert.equal(result.status, "goal_not_verified");
      assert.equal(browser.contexts().length, 0);
    }
  });
  await t.test("empty extraction fails rather than becoming a completed action", async () => {
    const agent = createWebAgent(options({ generate: async ({ messages }) => ({ content: JSON.stringify({ type: "extractText", targetId: "result", observationId: JSON.parse(messages[1].content).snapshot.observationId }) }) }));
    await assert.rejects(() => agent.run({ goal: "Read result" }), /WEB_EMPTY_EXTRACTION/);
    assert.equal(browser.contexts().length, 0);
  });
  await t.test("cancelling a pending model closes the context and a late decision cannot act", async () => {
    const controller = new AbortController(); let effects = 0; let completeModel;
    let entered; const modelEntered = new Promise((resolve) => { entered = resolve; });
    const agent = createWebAgent(options({ signal: controller.signal, execute: async () => { effects++; return {}; },
      generate: async () => { entered(); return new Promise((resolve) => { completeModel = resolve; }); } }));
    const pending = agent.run({ goal: "Search" }); const rejected = assert.rejects(pending, /cancel-fixture/);
    await modelEntered; controller.abort(new Error("cancel-fixture")); await rejected;
    completeModel({ content: '{"type":"done","observationId":"late"}' });
    assert.equal(effects, 0); assert.equal(browser.contexts().length, 0);
  });
});

test("context cleanup failure preserves the first execution failure and never returns success", async () => {
  let closes = 0;
  const failure = new Error("first-action-failure");
  const agent = createWebAgent({ browser: { newContext: async () => ({ newPage: async () => ({}), close: async () => { closes++; throw new Error("cleanup-failure"); } }) },
    generate: async () => ({}), verifyGoal: async () => true, execute: async () => ({}), initialize: async () => { throw failure; } });
  await assert.rejects(() => agent.run({ goal: "Search" }), (error) => error === failure && error.cleanupError === "WEB_CONTEXT_CLEANUP_FAILED");
  assert.equal(closes, 1);
});
