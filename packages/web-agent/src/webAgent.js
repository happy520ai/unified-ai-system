import { createBrowserExecutor } from "./browserExecutor.js";
import { createLlmBrain } from "./llmBrain.js";
import { parseManual } from "./manualParser.js";
import { recognizeModules } from "./moduleRecognizer.js";
import { randomUUID } from "node:crypto";

export function createWebAgent(options = {}) {
  return {
    async run(input = {}) {
      const manual = parseManual(input.manual || input.goal || "");
      const browser = options.browser;
      if (!browser) {
        throw new Error("browser is required");
      }
      if (typeof options.verifyGoal !== "function") throw new Error("WEB_GOAL_VERIFIER_REQUIRED");
      const brain = createLlmBrain({ generate: options.generate });
      if (typeof options.execute !== "function" && typeof options.resolveTarget !== "function") throw new Error("WEB_TARGET_RESOLVER_REQUIRED");
      const maxSteps = options.limits?.maxSteps ?? 8;
      if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 32) throw new Error("WEB_ACTION_LIMIT_INVALID");
      const signal = options.signal;
      signal?.throwIfAborted();
      const trace = [];
      const extracted = [];
      let stepsCompleted = 0;
      let verified = false;
      let context;
      let closing;
      let failure;
      const close = () => closing ??= context ? context.close() : Promise.resolve();
      const onAbort = () => { close().catch(() => {}); };
      try {
        context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block", acceptDownloads: false });
        signal?.addEventListener("abort", onAbort, { once: true });
        signal?.throwIfAborted();
        const page = await context.newPage();
        await options.initialize?.({ page, context, signal });
        signal?.throwIfAborted();
        if (input.startUrl) {
          if (options.navigate) await options.navigate(page, input.startUrl);
          else await page.goto(input.startUrl, { waitUntil: "domcontentloaded", timeout: 10000 });
          signal?.throwIfAborted();
          trace.push({ type: "goto", url: page.url() });
        }
        const executor = createBrowserExecutor(page, { resolveTarget: options.resolveTarget, signal });
        for (let index = 0; index < maxSteps; index += 1) {
          signal?.throwIfAborted();
          const observationId = randomUUID();
          const observed = options.observe ? await options.observe(page, observationId)
            : await recognizeModules(page, { maxModules: 200 });
          signal?.throwIfAborted();
          const snapshot = { ...observed, observationId };
          const action = await untilAborted(brain.decide({ goal: manual.goal, steps: manual.steps, snapshot }, { signal }), signal);
          signal?.throwIfAborted();
          if (action.observationId !== observationId) throw new Error("WEB_OBSERVATION_STALE");
          if (action.type === "done") {
            verified = stepsCompleted > 0 && await options.verifyGoal(page, { input, trace, signal }) === true;
            signal?.throwIfAborted();
            break;
          }
          const result = options.execute ? await options.execute(page, action) : await executor.execute(action);
          signal?.throwIfAborted();
          if (!result || typeof result !== "object") throw new Error("WEB_ACTION_RESULT_INVALID");
          trace.push({ step: index + 1, type: action.type, targetId: action.targetId, result: summarizeResult(result) });
          if (result.text) {
            if (typeof result.text !== "string" || !result.text.trim() || extracted.reduce((sum, item) => sum + Buffer.byteLength(item.text, "utf8"), 0) + Buffer.byteLength(result.text, "utf8") > 8000) throw new Error("WEB_RESULT_TOO_LARGE");
            extracted.push({ step: index + 1, targetId: action.targetId, text: result.text });
          }
          stepsCompleted += 1;
        }
      } catch (error) {
        failure = error;
      } finally {
        signal?.removeEventListener("abort", onAbort);
        try { await close(); } catch (error) {
          if (failure) failure.cleanupError = "WEB_CONTEXT_CLEANUP_FAILED";
          else failure = Object.assign(new Error("WEB_CONTEXT_CLEANUP_FAILED"), { cause: error });
        }
      }
      if (failure) throw failure;
      signal?.throwIfAborted();
      return { success: verified, status: verified ? "completed" : "goal_not_verified",
        stepsCompleted, stepsTotal: maxSteps, actionsTotal: stepsCompleted, extracted, trace, tokenUsage: brain.getUsage() };
    },
  };
}

function untilAborted(pending, signal) {
  if (!signal) return pending;
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason ?? new Error("WEB_RUN_ABORTED"));
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
    Promise.resolve(pending).then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

function summarizeResult(result) {
  if (!result || !result.text) return result;
  return { ...result, text: result.text.slice(0, 500) };
}
