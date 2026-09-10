import { validateBrowserAction } from "./llmBrain.js";

export function createBrowserExecutor(page, options = {}) {
  return {
    execute(action) {
      return executeAction(page, action, options);
    },
  };
}

export async function executeAction(page, action, options = {}) {
  action = validateBrowserAction(action);
  if (action.type === "done") throw new Error("WEB_DONE_REQUIRES_GOAL_VERIFIER");
  if (typeof options.resolveTarget !== "function") throw new Error("WEB_TARGET_RESOLVER_REQUIRED");
  const timeout = options.timeoutMs ?? 5000;
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 10000) throw new Error("WEB_ACTION_LIMIT_INVALID");
  options.signal?.throwIfAborted();
  // The trusted resolver must return the observed element handle, never rebind
  // a model-provided selector to a different element after authorization.
  const element = await options.resolveTarget(page, action);
  options.signal?.throwIfAborted();
  if (!element) throw new Error("WEB_TARGET_UNAVAILABLE");
  if (action.type === "click") await element.click({ timeout });
  else if (action.type === "fill") await element.fill(action.value, { timeout });
  else {
    const text = await element.evaluate((node) => (node.innerText ?? node.textContent ?? "").slice(0, 8001));
    options.signal?.throwIfAborted();
    if (!text.trim()) throw new Error("WEB_EMPTY_EXTRACTION");
    if (Buffer.byteLength(text, "utf8") > 8000) throw new Error("WEB_RESULT_TOO_LARGE");
    return { type: action.type, targetId: action.targetId, text };
  }
  options.signal?.throwIfAborted();
  return { type: action.type, targetId: action.targetId };
}
