import { createHash } from "node:crypto";
import { stableStringify } from "@unified-ai-system/policy-engine";
import { createWebAgent, createBrowserExecutor, launchBrowser } from "@unified-ai-system/web-agent";
import type { AgentGovernanceCallContext, AgentGovernanceToolProxy } from "../agent-governance/toolProxy.ts";
import type { GovernedRecordDescriptor } from "../agent-governance/governedRecordMeter.ts";
import type { ForgeWebTaskReview } from "@unified-ai-system/shared-contracts";

type Browser = Awaited<ReturnType<typeof launchBrowser>>;
type Page = Awaited<ReturnType<Awaited<ReturnType<Browser["newContext"]>>["newPage"]>>;
type Element = NonNullable<Awaited<ReturnType<Page["$"]>>>;
type Target = "query" | "search" | "details" | "result";
type Profile = ForgeWebTaskReview["profile"];
export type WebTaskRequest = ForgeWebTaskReview;
type Fence = { signal?: AbortSignal; assertActive?(phase: string): Promise<unknown> };
type Action = { type: string; observationId: string; targetId?: Target; value?: string };
const RECORDS: GovernedRecordDescriptor = Object.freeze({ kind: "record-array", selector: ["records"], itemKind: "object", onLimitExceeded: "replace" });
const ZERO: GovernedRecordDescriptor = Object.freeze({ kind: "zero-records" });
const TARGETS: Target[] = ["query", "search", "details", "result"];
export const WEB_LOOKUP_TASK_ID = "web-lookup";

function fail(code: string): never { throw Object.assign(new Error(code), { code }); }
function record(value: unknown, required: string[], optional: string[] = []): asserts value is Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail("FORGE_WEB_INPUT_INVALID");
  const fields = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(fields).some(key => typeof key !== "string" || !Object.hasOwn(fields[key], "value") || ![...required, ...optional].includes(key))
    || required.some(key => !Object.hasOwn(fields, key))) fail("FORGE_WEB_INPUT_INVALID");
}
function text(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && Buffer.byteLength(value, "utf8") <= max && !/[\u0000-\u001f\u007f]/u.test(value);
}
function identifier(value: unknown): value is string { return typeof value === "string" && /^[A-Za-z0-9_-]{1,80}$/u.test(value); }
function profilePath(value: unknown): value is string {
  return typeof value === "string" && /^\/[A-Za-z0-9/_-]{1,120}$/u.test(value) && !value.includes("//");
}

/** Configuration contains no credentials. Request JSON selects one tenant-owned profile. */
export function resolveGovernedWebTaskRequest(env: Record<string, unknown>, value: unknown, tenantId: string): WebTaskRequest | null {
  if (value === undefined) return null;
  record(value, ["profileId", "itemId", "expectedText"]);
  if (!identifier(value.profileId) || !identifier(value.itemId) || !text(value.expectedText, 1000)) fail("FORGE_WEB_INPUT_INVALID");
  const raw = env.AI_GATEWAY_FORGE_WEB_PROFILES_JSON;
  if (!text(raw, 32768)) fail("FORGE_WEB_PROFILE_UNAVAILABLE");
  let entries: unknown;
  try { entries = JSON.parse(raw); } catch { fail("FORGE_WEB_PROFILE_INVALID"); }
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > 8) fail("FORGE_WEB_PROFILE_INVALID");
  const profiles: Profile[] = [];
  for (const entry of entries) {
    record(entry, ["id", "tenantId", "origin", "startPath", "searchPath", "detailPath", "targets"], ["browserChannel", "maxSteps", "timeoutMs"]);
    if (!identifier(entry.id) || !identifier(entry.tenantId) || typeof entry.origin !== "string"
      || !/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/u.test(entry.origin)) fail("FORGE_WEB_PROFILE_INVALID");
    let origin: URL;
    try { origin = new URL(entry.origin); } catch { fail("FORGE_WEB_PROFILE_INVALID"); }
    if (origin.origin !== entry.origin || !origin.port) fail("FORGE_WEB_PROFILE_INVALID");
    if (![entry.startPath, entry.searchPath, entry.detailPath].every(profilePath)
      || new Set([entry.startPath, entry.searchPath, entry.detailPath]).size !== 3) fail("FORGE_WEB_PROFILE_INVALID");
    record(entry.targets, TARGETS);
    if (!TARGETS.every(key => typeof entry.targets[key] === "string" && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/u.test(entry.targets[key]))
      || new Set(Object.values(entry.targets)).size !== 4) fail("FORGE_WEB_PROFILE_INVALID");
    if (entry.browserChannel !== undefined && !["chrome", "msedge"].includes(entry.browserChannel)) fail("FORGE_WEB_PROFILE_INVALID");
    const maxSteps = entry.maxSteps ?? 8, timeoutMs = entry.timeoutMs ?? 30000;
    if (!Number.isInteger(maxSteps) || maxSteps < 5 || maxSteps > 16 || !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) fail("FORGE_WEB_PROFILE_INVALID");
    if (profiles.some(profile => profile.id === entry.id)) fail("FORGE_WEB_PROFILE_INVALID");
    profiles.push(Object.freeze({ id: entry.id, tenantId: entry.tenantId, origin: entry.origin, startPath: entry.startPath,
      searchPath: entry.searchPath, detailPath: entry.detailPath, targets: Object.freeze({ ...entry.targets }) as Profile["targets"],
      ...(entry.browserChannel ? { browserChannel: entry.browserChannel } : {}), maxSteps, timeoutMs }));
  }
  const profile = profiles.find(item => item.id === value.profileId && item.tenantId === tenantId);
  if (!profile) fail("FORGE_WEB_PROFILE_UNAVAILABLE");
  return Object.freeze({ profile, profileHash: createHash("sha256").update(stableStringify(profile)).digest("hex"), itemId: value.itemId, expectedText: value.expectedText });
}

/** Revalidate the entire sealed review; admitting an unknown options object is not sufficient. */
export function readGovernedWebTaskReview(value: unknown): WebTaskRequest {
  record(value, ["profile", "profileHash", "itemId", "expectedText"]);
  record(value.profile, ["id", "tenantId", "origin", "startPath", "searchPath", "detailPath", "targets", "maxSteps", "timeoutMs"], ["browserChannel"]);
  record(value.profile.targets, TARGETS);
  if (!identifier(value.itemId) || !text(value.expectedText, 1000) || !text(value.profileHash, 64)
    || Object.entries(value.profile).some(([key, item]) => key !== "targets" && !["string", "number"].includes(typeof item))
    || Object.values(value.profile.targets).some(item => typeof item !== "string")) fail("FORGE_WEB_REVIEW_INVALID");
  const normalized = resolveGovernedWebTaskRequest({ AI_GATEWAY_FORGE_WEB_PROFILES_JSON: JSON.stringify([value.profile]) },
    { profileId: value.profile.id, itemId: value.itemId, expectedText: value.expectedText }, value.profile.tenantId)!;
  if (stableStringify(normalized) !== stableStringify(value)) fail("FORGE_WEB_REVIEW_INVALID");
  return normalized;
}

async function elementState(element: Element) {
  return element.evaluate(node => {
    const el = node as HTMLElement, input = el as HTMLInputElement, form = input.form;
    const rect = el.getBoundingClientRect(), style = getComputedStyle(el);
    return { tag: el.tagName, id: el.id, label: (el.getAttribute("aria-label") ?? el.innerText ?? "").slice(0, 256),
      type: el.getAttribute("type"), href: el.getAttribute("href"), target: el.getAttribute("target"), download: el.hasAttribute("download"),
      formAction: form?.action ?? null, formMethod: form?.method ?? null, formTarget: form?.target ?? null,
      disabled: input.disabled === true, readOnly: input.readOnly === true,
      visible: el.isConnected && rect.width > 0 && rect.height > 0 && style.visibility === "visible" && style.display !== "none" };
  });
}

/** One-shot private port; the HTTP handler never deserializes an executor. */
export function createGovernedWebTaskExecution(input: { request: WebTaskRequest; context: AgentGovernanceCallContext;
  toolProxy: AgentGovernanceToolProxy; executionLease: Fence; signal?: AbortSignal | null; policyHash: string;
  gatewayService: { execute(input: unknown, options: { signal: AbortSignal }): Promise<any> }; maxTokens?: number }) {
  const { request, executionLease, policyHash } = input;
  const identity = Object.freeze({ ...input.context });
  const enforce = input.toolProxy.enforce.bind(input.toolProxy), enforceResult = input.toolProxy.enforceResult.bind(input.toolProxy);
  const gatewayExecute = input.gatewayService?.execute?.bind(input.gatewayService);
  if (!gatewayExecute || !policyHash) fail("FORGE_WEB_RUNTIME_UNAVAILABLE");
  const tokenLimit = Math.min(input.maxTokens ?? 32000, 32000);
  if (!Number.isInteger(tokenLimit) || tokenLimit < 1) fail("FORGE_WEB_INPUT_INVALID");
  const { profile, itemId, expectedText, profileHash } = request;
  const startUrl = profile.origin + profile.startPath;
  const allowedUrls = new Set([startUrl, `${profile.origin}${profile.searchPath}?q=${encodeURIComponent(itemId)}`,
    `${profile.origin}${profile.detailPath}?id=${encodeURIComponent(itemId)}`]);
  let claimed = false;
  let terminal: any = null;
  return Object.freeze({
    taskId: WEB_LOOKUP_TASK_ID,
    summary: `Lookup ${itemId} using approved web profile ${profile.id}`,
    getResult() { return terminal ? structuredClone(terminal) : null; },
    async execute(task: { id: string; goal_id?: string; agent_role?: string }, context: { signal?: AbortSignal } = {}) {
      if (claimed || task.id !== WEB_LOOKUP_TASK_ID || task.agent_role !== "web" || !task.goal_id) fail("FORGE_WEB_CAPABILITY_INVALID");
      claimed = true;
      const localAbort = new AbortController();
      const signal = AbortSignal.any([localAbort.signal, ...[input.signal, executionLease.signal, context.signal].filter((value): value is AbortSignal => Boolean(value))]);
      const timer = setTimeout(() => localAbort.abort(new Error("FORGE_WEB_DEADLINE_EXCEEDED")), profile.timeoutMs);
      const taskId = task.id, goalId = task.goal_id;
      let browser: Browser | undefined, closing: Promise<void> | undefined, engineResult: any, failure: any;
      let effectStarted = false, tokenReservation = 0, currentObservation = "", cleanupFailed = false;
      let expectedRequest: string | null = null, networkRequests = 0;
      let usageKnown = true;
      const measuredUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, llmCalls: 0 };
      const completed: string[] = [];
      const handles = new Map<Target, { element: Element; signature: string }>();
      const closeBrowser = () => closing ??= browser ? browser.close() : Promise.resolve();
      const onAbort = () => { if (browser) closeBrowser().catch(() => {}); };
      const active = async (phase = "reserve") => { signal.throwIfAborted(); await executionLease.assertActive?.(phase); signal.throwIfAborted(); };
      const denyNetwork = () => { if (!signal.aborted) localAbort.abort(new Error("FORGE_WEB_NETWORK_DENIED")); };
      async function governed<T>(toolName: string, params: object, descriptor: GovernedRecordDescriptor, operation: () => Promise<T>): Promise<T> {
        await active();
        const authorization = await enforce({ context: identity, toolName,
          params: { profileHash, itemId, goalId, taskId, ...params },
          resourceContext: { resourceKeys: { webOrigin: profile.origin, webProfileId: profile.id, webItemId: itemId, forgeTaskId: taskId },
            resources: [`web:${profile.origin}${profile.startPath}`] } });
        try {
          await active("commit");
          if (authorization.outcome !== "allow" || authorization.policy?.policyHash !== policyHash || !authorization.executionLease) fail("FORGE_WEB_ACTION_DENIED");
          if (authorization.approvedParams !== undefined
            && stableStringify(authorization.approvedParams) !== stableStringify({ profileHash, itemId, goalId, taskId, ...params })) fail("FORGE_WEB_APPROVED_PARAMS_MISMATCH");
          const result = await operation();
          await active("complete");
          const verdict = await enforceResult({ context: identity, toolName, policy: authorization.policy, result, descriptor });
          await active("complete");
          if (verdict.verdict !== "allow" || !Object.hasOwn(verdict, "result")) fail("FORGE_WEB_RESULT_UNAVAILABLE");
          return verdict.result as T;
        } finally { await authorization.executionLease?.release(); }
      }
      try {
        await active();
        browser = await launchBrowser({ headless: true, ...(profile.browserChannel ? { channel: profile.browserChannel } : {}) });
        signal.addEventListener("abort", onAbort, { once: true });
        await active();
        const agent = createWebAgent({ browser, signal, limits: { maxSteps: profile.maxSteps },
          initialize: async ({ page, context: browserContext }: { page: Page; context: Awaited<ReturnType<Browser["newContext"]>> }) => {
            if (typeof browserContext.routeWebSocket !== "function") fail("FORGE_WEB_NETWORK_GUARD_UNAVAILABLE");
            await browserContext.route("**/*", async route => {
              const outgoing = route.request();
              let allowed = false;
              try { allowed = !signal.aborted && outgoing.method() === "GET" && outgoing.url() === expectedRequest
                && allowedUrls.has(outgoing.url()) && outgoing.frame() === page.mainFrame(); } catch { /* worker or detached frame: deny */ }
              if (!allowed) { await route.abort(); denyNetwork(); return; }
              // One exact request belongs to this authorized interaction.
              // Page scripts cannot reuse the profile's URL set autonomously.
              expectedRequest = null; networkRequests++;
              // Chromium routing may expose only the first URL of a redirect
              // chain. Fetch that exact approved URL without following redirects
              // and inspect the response before letting Chromium consume it.
              try {
                const fetched = await route.fetch({ maxRedirects: 0, maxRetries: 0, timeout: 5000, signal });
                try {
                  const length = fetched.headers()["content-length"];
                  if (fetched.status() < 200 || fetched.status() >= 300 || fetched.headers()["content-disposition"] !== undefined
                    || length !== undefined && (!/^\d+$/u.test(length) || Number(length) > 262144)) {
                    await route.abort(); denyNetwork(); return;
                  }
                  const body = await fetched.body();
                  if (body.length > 262144 || signal.aborted) { await route.abort(); denyNetwork(); return; }
                  await route.fulfill({ response: fetched, body });
                } finally { await fetched.dispose(); }
              } catch { denyNetwork(); }
            });
            await browserContext.routeWebSocket("**/*", async socket => { await socket.close(); denyNetwork(); });
            browserContext.on("page", extra => { if (extra !== page) { denyNetwork(); } });
            browserContext.on("serviceworker", denyNetwork);
            page.on("download", download => { void download.cancel(); denyNetwork(); });
            page.on("frameattached", denyNetwork);
            page.on("dialog", dialog => { void dialog.dismiss(); denyNetwork(); });
            await browserContext.addInitScript(() => {
              for (const name of ["Worker", "SharedWorker", "WebTransport", "RTCPeerConnection", "webkitRTCPeerConnection"]) {
                Object.defineProperty(globalThis, name, { configurable: false, writable: false, value: function () { throw new Error("WEB_CHANNEL_DISABLED"); } });
              }
            });
          },
          navigate: async (page: Page, url: string) => governed("browser_navigate", { url }, ZERO, async () => {
            if (url !== startUrl) fail("FORGE_WEB_NETWORK_DENIED");
            expectedRequest = url;
            effectStarted = true;
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: 5000 });
            return { url: page.url() };
          }),
          observe: async (page: Page, observationId: string) => governed("browser_observe", { observationId }, RECORDS, async () => {
            if (!allowedUrls.has(page.url())) fail("FORGE_WEB_NETWORK_DENIED");
            for (const prior of handles.values()) await prior.element.dispose();
            handles.clear(); currentObservation = observationId;
            const records = [];
            for (const targetId of TARGETS) {
              const matches = await page.$$("#" + profile.targets[targetId]);
              if (matches.length > 1) fail("FORGE_WEB_TARGET_AMBIGUOUS");
              if (!matches.length) continue;
              const element = matches[0], state = await elementState(element);
              if (!state.visible || state.disabled) { await element.dispose(); continue; }
              handles.set(targetId, { element, signature: stableStringify(state) });
              records.push({ targetId, label: state.label, tag: state.tag });
            }
            return { observationId, records };
          }),
          execute: async (page: Page, action: Action) => {
            const targetId = action.targetId;
            if (!targetId || action.observationId !== currentObservation || !handles.has(targetId)) fail("FORGE_WEB_OBSERVATION_STALE");
            if (!(action.type === "fill" && targetId === "query" && action.value === itemId)
              && !(action.type === "click" && ["search", "details"].includes(targetId))
              && !(action.type === "extractText" && targetId === "result")) fail("FORGE_WEB_ACTION_DENIED");
            const stepKey = `${action.type}:${targetId}`;
            const expected = ["fill:query", "click:search", "click:details", "extractText:result"];
            if (expected[completed.length] !== stepKey) fail("FORGE_WEB_ACTION_ORDER_INVALID");
            const result = await governed(action.type === "extractText" ? "browser_observe" : "browser_interact",
              { ...action }, ZERO, async () => {
                const bound = handles.get(targetId)!;
                const matches = await page.$$("#" + profile.targets[targetId]);
                const same = matches.length === 1 && await matches[0].evaluate((node, original) => node === original, bound.element);
                for (const candidate of matches) await candidate.dispose();
                if (!same || stableStringify(await elementState(bound.element)) !== bound.signature) fail("FORGE_WEB_TARGET_CHANGED");
                const state = await elementState(bound.element);
                if (targetId === "query" && (state.tag !== "INPUT" || state.readOnly || ![null, "text", "search"].includes(state.type))) fail("FORGE_WEB_TARGET_INVALID");
                if (targetId === "result" && !["DIV", "SECTION", "OUTPUT", "ARTICLE"].includes(state.tag)) fail("FORGE_WEB_TARGET_INVALID");
                if (["search", "details"].includes(targetId) && !["BUTTON", "A"].includes(state.tag)) fail("FORGE_WEB_TARGET_INVALID");
                if (state.download || (state.target && state.target !== "_self") || (state.formTarget && state.formTarget !== "_self")) fail("FORGE_WEB_TARGET_INVALID");
                if (state.tag === "A" && (!state.href || !allowedUrls.has(new URL(state.href, page.url()).href))) fail("FORGE_WEB_TARGET_INVALID");
                if (state.formAction && (state.formMethod !== "get" || state.formAction !== profile.origin + profile.searchPath)) fail("FORGE_WEB_TARGET_INVALID");
                await active("commit");
                if (targetId === "search") expectedRequest = `${profile.origin}${profile.searchPath}?q=${encodeURIComponent(itemId)}`;
                if (targetId === "details") expectedRequest = `${profile.origin}${profile.detailPath}?id=${encodeURIComponent(itemId)}`;
                effectStarted = true;
                const result = await createBrowserExecutor(page, { signal, resolveTarget: async () => bound.element }).execute(action);
                if (targetId === "search" || targetId === "details") {
                  await page.locator("#" + profile.targets[targetId === "search" ? "details" : "result"]).waitFor({ state: "visible", timeout: 5000 });
                }
                return result;
              });
            completed.push(stepKey);
            return result;
          },
          verifyGoal: async (page: Page) => {
            const verdict = await governed("browser_observe", { verifyGoal: true, observationId: currentObservation }, ZERO, async () => {
              const result = page.locator("#" + profile.targets.result);
              return { verified: completed.length === 4 && networkRequests === 3 && expectedRequest === null
                && allowedUrls.has(page.url()) && await result.count() === 1 && await result.isVisible()
                && await result.getAttribute("data-item-id") === itemId
                && (await result.evaluate(node => ((node as HTMLElement).innerText ?? "").slice(0, 1001))).trim() === expectedText };
            });
            return verdict.verified === true;
          },
          generate: async ({ messages }: { messages: Array<{ role: string; content: string }> }) => {
            await active();
            tokenReservation += messages.reduce((sum, message) => sum + Buffer.byteLength(message.content, "utf8"), 0) + 512;
            if (tokenReservation > tokenLimit) fail("FORGE_WEB_TOKEN_BUDGET_EXHAUSTED");
            measuredUsage.llmCalls++;
            const response = await gatewayExecute({ taskType: "chat", messages, options: { maxOutputTokens: 512, temperature: 0 },
              metadata: { source: "forge-lane", forge: { agentId: identity.agentId, tenantId: identity.tenantId, goalId, taskId, profileHash } } }, { signal });
            await active("complete");
            if (response?.success !== true) { usageKnown = false; fail("FORGE_WEB_MODEL_FAILED"); }
            const usage = response.data?.usage;
            const normalized = usage ? { inputTokens: usage.inputTokens ?? usage.prompt_tokens, outputTokens: usage.outputTokens ?? usage.completion_tokens, totalTokens: usage.totalTokens ?? usage.total_tokens } : null;
            if (normalized && Object.values(normalized).every(value => Number.isSafeInteger(value) && value >= 0)) {
              for (const key of ["inputTokens", "outputTokens", "totalTokens"] as const) measuredUsage[key] += normalized[key];
            } else usageKnown = false;
            return { content: response.data?.message?.content ?? response.data?.text,
              ...(normalized ? { usage: normalized } : {}) };
          },
        });
        engineResult = await agent.run({ goal: `Search for item ${itemId}, open its details, extract the result, then request verification. Expected result: ${expectedText}`, startUrl });
        await active("complete");
      } catch (error) { failure = error; if (!engineResult) usageKnown = false; }
      finally {
        try { await closeBrowser(); } catch (error) { cleanupFailed = true; failure ??= Object.assign(new Error("FORGE_WEB_BROWSER_CLEANUP_FAILED"), { cause: error }); }
        clearTimeout(timer); signal.removeEventListener("abort", onAbort);
      }
      if (signal.aborted) failure ??= signal.reason;
      const success = !failure && engineResult?.success === true && browser?.isConnected() === false;
      terminal = { profileId: profile.id, profileHash, policyHash, agentId: identity.agentId, tenantId: identity.tenantId, goalId, taskId,
        success, goalVerified: success, status: success ? "completed" : "failed", outcomeUnknown: Boolean(failure && effectStarted),
        error: success ? null : (typeof failure?.message === "string" && /^(?:FORGE_)?WEB_[A-Z_]+$/u.test(failure.message) ? failure.message : "FORGE_WEB_GOAL_NOT_VERIFIED"),
        browserClosed: browser ? !browser.isConnected() : true, cleanupFailed,
        contextCleanupFailed: failure?.cleanupError === "WEB_CONTEXT_CLEANUP_FAILED" || failure?.message === "WEB_CONTEXT_CLEANUP_FAILED",
        actionsCompleted: completed.length, networkRequests,
        tokenUsage: { ...measuredUsage, ...(!usageKnown ? { inputTokens: null, outputTokens: null, totalTokens: null } : {}) },
        records: success ? engineResult.extracted : [] };
      return { success, output: success ? "Approved webpage lookup verified." : "Webpage lookup did not complete; inspect the governed result before retrying.",
        error: terminal.error, filesModified: [], toolCalls: completed.length, tokenUsage: terminal.tokenUsage };
    },
  });
}
