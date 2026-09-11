import { createHash } from "node:crypto";
import { createLinkedAbortController, throwIfExecutionAborted } from "@unified-ai-system/shared-utils";
import { bindGatewayExecution, type GatewayExecutionContext } from "../http/httpRequestExecution.ts";
import { inheritVirtualKeyRequestAccounting } from "../enterprise/virtualKeyRequestAccounting.ts";
import type { GatewayWorkforceDispatchFence } from "../core/gatewayService.ts";
import { createGatewayBackedProviderAdapter } from "../providers/gatewayBackedProviderAdapter.ts";
import { HttpLLMProviderAdapter } from "../providers/httpLlmProviderAdapter.js";
import { estimateTokens } from "../cost/tokenEstimator.js";
import { containsSensitivePublicationText } from "../security/secretSafety.js";
import { externalRunnerHash } from "../workforce/workforceExternalRunnerProfile.ts";
import { readGovernedAgentTaskProfile, type GovernedAgentTaskProfile } from "./governedAgentTaskProfile.ts";
import { getResidentExecution } from "./governedAgentTaskResident.ts";

type Data = Record<string, any>;
type Phase = "planning" | "coding";
type GatewayPort = { execute(input: Record<string, unknown>, execution?: Record<string, unknown>): Promise<unknown> };
type GatewayProviderResponse = Awaited<ReturnType<ReturnType<typeof createGatewayBackedProviderAdapter>["generate"]>>;
export type GovernedAgentTaskProviderIntent = Readonly<{ version: 1; phase: Phase; profileHash: string; providerId: string; modelId: string;
  requestHash: string; messagesHash: string; toolsHash: string; optionsHash: string; messageCount: number; toolCount: number;
  requestBytes: number; estimatedInputTokens: number; estimateMethod: "approximate-no-provider-call";
  maxInputTokens: number; maxOutputTokens: number }>;
export type GovernedAgentTaskProviderReceipt = Readonly<{ version: 1; level: "gateway-provider-operation"; operationId: string | null; phase: Phase;
  status: "succeeded" | "blocked" | "cancelled" | "failed" | "outcome_unknown"; executionMode: "fake" | "real" | "unknown";
  providerCallAttempted: boolean | null; gatewayRequestId: string | null; providerId: string | null; modelId: string | null;
  usageReported: Readonly<{ inputTokens: boolean; outputTokens: boolean; totalTokens: boolean }>;
  inputTokens: number | null; outputTokens: number | null; totalTokens: number | null; estimatedCostUsd: null;
  input: Readonly<{ profile: "off"; messagesHash: string; toolsHash: string; optionsHash: string; messageCount: number; toolCount: number;
    gatewayInputHash: string; providerInputHash: string }> | null;
  errorCode: string | null }>;
export type GovernedAgentTaskProviderResponse = Omit<GatewayProviderResponse, "usage"> & {
  usage: Readonly<{ inputTokens: number | null; outputTokens: number | null; totalTokens: number | null }>;
  agentTaskReceipt: GovernedAgentTaskProviderReceipt;
};
export type GovernedAgentTaskProviderOptions = {
  profile: GovernedAgentTaskProfile; gatewayService: GatewayPort; providerRegistry: { get(providerId: string): unknown };
  requestExecution: GatewayExecutionContext; approvedRoute: string; phase: Phase; signal?: AbortSignal;
  identity: { tenantId: string; userId: string; role: string; permissions: readonly string[]; apiKeyFingerprint?: string };
  agentId: string; agentRunId: string; policyHash: string;
  /** The owner must recheck both the current Agent run and original task claim. */
  assertActive(phase: "reserve" | "commit"): Promise<unknown>;
  /** Resolves only after persisting the cumulative reservation and its unique operation ID. */
  reserve(intent: GovernedAgentTaskProviderIntent): Promise<string>;
  settle(receipt: GovernedAgentTaskProviderReceipt & { operationId: string }): Promise<void>;
};
const HEX = /^[a-f0-9]{64}$/u, HASH = /^sha256:[a-f0-9]{64}$/u;
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const data = (value: unknown): Data => value && typeof value === "object" && !Array.isArray(value) ? value as Data : {};
const safeId = (value: unknown): string | null => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u.test(value) ? value : null;
const usageValue = (value: unknown): number | null => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
function failure(code: string, receipt?: GovernedAgentTaskProviderReceipt) {
  return Object.assign(new Error("The governed Agent model operation did not complete within its approved binding."), {
    code, category: "provider", retryable: false as const, ...(receipt ? { agentTaskReceipt: receipt,
      providerCallAttempted: receipt.providerCallAttempted, outcomeUnknown: receipt.status === "outcome_unknown" } : {}),
  });
}
function check(ok: unknown, suffix: string): asserts ok { if (!ok) throw failure("AGENT_LONG_TASK_PROVIDER_" + suffix); }
function own(value: unknown, allowed: readonly string[]): Data {
  check(value && typeof value === "object" && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)), "INPUT_INVALID");
  const result: Data = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    const field = Object.getOwnPropertyDescriptor(value, key);
    check(typeof key === "string" && allowed.includes(key) && field?.enumerable && "value" in field, "INPUT_INVALID");
    if (field.value !== undefined) result[key] = field.value;
  }
  return result;
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value;
}
function jsonCopy<T>(value: T): T { externalRunnerHash(value); return freeze(JSON.parse(JSON.stringify(value))) as T; }
function identityText(value: unknown): string {
  check(typeof value === "string" && value.trim() && value.length <= 256 && !/[\u0000-\u001f\u007f]/u.test(value), "CONTEXT_INVALID"); return value;
}
function safeCode(error: unknown): string {
  const code = data(error).code; return typeof code === "string" && /^[A-Z][A-Z0-9_]{0,95}$/u.test(code) ? code : "AGENT_LONG_TASK_PROVIDER_FAILED";
}

/** Fixed model adapter. Durable budgets remain with the caller; no counters are reset or inferred here. */
export function createGovernedAgentTaskProvider(options: GovernedAgentTaskProviderOptions) {
  const profile = readGovernedAgentTaskProfile(options.profile), phase = options.phase;
  check(["planning", "coding"].includes(phase) && typeof options.gatewayService?.execute === "function" && typeof options.providerRegistry?.get === "function"
    && typeof options.assertActive === "function" && typeof options.reserve === "function" && typeof options.settle === "function", "CONFIGURATION_INVALID");
  const gateway = options.gatewayService, registry = options.providerRegistry;
  const assertActive = options.assertActive.bind(options), reserve = options.reserve.bind(options), settle = options.settle.bind(options);
  check(/^agt_[A-Za-z0-9_-]{1,128}$/u.test(options.agentId) && /^agr_[A-Za-z0-9_-]{1,128}$/u.test(options.agentRunId) && HASH.test(options.policyHash), "CONTEXT_INVALID");
  check(Array.isArray(options.identity?.permissions) && options.identity.permissions.every(item => typeof item === "string" && item.length <= 128), "CONTEXT_INVALID");
  const identity = Object.freeze({ tenantId: identityText(options.identity.tenantId), userId: identityText(options.identity.userId), role: identityText(options.identity.role),
    permissions: Object.freeze([...options.identity.permissions]), ...(options.identity.apiKeyFingerprint ? { apiKeyFingerprint: options.identity.apiKeyFingerprint } : {}) });
  if (identity.apiKeyFingerprint !== undefined) check(/^[a-f0-9]{12}$/u.test(identity.apiKeyFingerprint), "CONTEXT_INVALID");
  const agent = Object.freeze({ agentId: options.agentId, runId: options.agentRunId, policyHash: options.policyHash, tenantId: identity.tenantId, userId: identity.userId });
  const sourceHttp = options.requestExecution;
  const resident = getResidentExecution(sourceHttp);
  if (typeof options.approvedRoute === "string" && options.approvedRoute.startsWith("/internal/")) check(resident && phase === "coding"
    && options.approvedRoute === `/internal/agent-pool/${resident.taskId}/run`, "RESIDENT_CONTEXT_INVALID");
  check(sourceHttp?.signal instanceof AbortSignal && (options.signal === undefined || options.signal instanceof AbortSignal), "CONTEXT_INVALID");
  const http = Object.freeze({ signal: sourceHttp.signal, timeoutMs: sourceHttp.timeoutMs, deadlineAt: sourceHttp.deadlineAt,
    providerDispatchKeyHash: sourceHttp.providerDispatchKeyHash, providerDispatchKeyInvalid: sourceHttp.providerDispatchKeyInvalid,
    providerDispatchRoute: sourceHttp.providerDispatchRoute, transportRequestId: sourceHttp.transportRequestId, transportTraceId: sourceHttp.transportTraceId });
  inheritVirtualKeyRequestAccounting(sourceHttp, http);
  check(typeof options.approvedRoute === "string" && /^\/[A-Za-z0-9_:/.-]{1,511}$/u.test(options.approvedRoute) && !options.approvedRoute.includes("..")
    && http.providerDispatchRoute === options.approvedRoute && !http.providerDispatchKeyInvalid && Number.isFinite(http.deadlineAt)
    && (http.providerDispatchKeyHash === undefined || HEX.test(http.providerDispatchKeyHash)), "DISPATCH_CONTEXT_INVALID");
  const baseSignal = options.signal ? AbortSignal.any([http.signal, options.signal]) : http.signal;
  const provider = registry.get(profile.model.providerId), providerDescriptor = data(data(provider).descriptor);
  const fake = data(providerDescriptor.metadata).providerType === "fake";
  check((fake || provider instanceof HttpLLMProviderAdapter) && data(providerDescriptor.metadata).dryRun !== true
    && Array.isArray(providerDescriptor.models) && providerDescriptor.models.some(model => data(model).id === profile.model.modelId && data(model).enabled === true), "UNSUPPORTED");
  check(fake || http.providerDispatchKeyHash, "DISPATCH_KEY_REQUIRED");
  const descriptor = freeze({ id: profile.model.providerId, models: [{ id: profile.model.modelId }], metadata: { providerType: "gateway-governed" } });
  const spentIds = new Set<string>(); let busy = false, poisoned = false, last: GovernedAgentTaskProviderReceipt | null = null;
  return Object.freeze({
    governedProviderOperation: true as const, descriptor,
    getLastReceipt: () => last,
    async generate(value: unknown = {}): Promise<GovernedAgentTaskProviderResponse> {
      let operationId: string | null = null, dispatches = 0, inputReceipt: GovernedAgentTaskProviderReceipt["input"] = null;
      const current: { result: Data | null } = { result: null };
      let gatewayCalled = false, control: ReturnType<typeof createLinkedAbortController> | null = null;
      function receipt(status: GovernedAgentTaskProviderReceipt["status"], errorCode: string | null): GovernedAgentTaskProviderReceipt {
        const body = data(current.result?.data), usage = data(body.usage), flags = data(data(data(data(body.metadata).rawProviderMeta).workforceObservation).usageReported);
        const usageReported = Object.freeze({ inputTokens: flags.inputTokens === true, outputTokens: flags.outputTokens === true, totalTokens: flags.totalTokens === true });
        return Object.freeze({ version: 1, level: "gateway-provider-operation", operationId, phase, status,
          executionMode: body.executionMode === "fake" || body.executionMode === "real" ? body.executionMode : "unknown",
          providerCallAttempted: dispatches > 0 ? true : current.result?.success === true && gatewayCalled ? null : false,
          gatewayRequestId: safeId(body.id), providerId: safeId(body.providerId), modelId: safeId(body.model), usageReported,
          inputTokens: usageReported.inputTokens ? usageValue(usage.inputTokens) : null, outputTokens: usageReported.outputTokens ? usageValue(usage.outputTokens) : null,
          totalTokens: usageReported.totalTokens ? usageValue(usage.totalTokens) : null, estimatedCostUsd: null, input: inputReceipt, errorCode });
      }
      if (busy || poisoned) throw failure("AGENT_LONG_TASK_PROVIDER_" + (busy ? "OVERLAP" : "REPLAY_BLOCKED"), receipt("blocked", "AGENT_LONG_TASK_PROVIDER_" + (busy ? "OVERLAP" : "REPLAY_BLOCKED")));
      busy = true;
      let terminal: GovernedAgentTaskProviderReceipt | undefined, response: GatewayProviderResponse | undefined, failed = false;
      try {
        const input = own(value, ["request", "target", "execution"]), request = own(input.request ?? {}, ["messages", "options", "tools", "toolChoice"]);
        const target = own(input.target ?? {}, ["providerId", "modelId"]), execution = own(input.execution ?? {}, ["signal"]);
        check((target.providerId === undefined || target.providerId === profile.model.providerId) && (target.modelId === undefined || target.modelId === profile.model.modelId), "TARGET_MISMATCH");
        check(execution.signal === undefined || execution.signal instanceof AbortSignal, "INPUT_INVALID");
        const messages = jsonCopy(request.messages);
        check(Array.isArray(messages) && messages.length >= 1 && messages.length <= 128 && messages.every(message =>
          ["system", "user", "assistant", "tool"].includes(data(message).role)), "INPUT_INVALID");
        const toolOptions = jsonCopy(request.options ?? {}); check(toolOptions && typeof toolOptions === "object" && !Array.isArray(toolOptions), "INPUT_INVALID");
        const maxOutputTokens = toolOptions.maxOutputTokens ?? profile.model.maxOutputTokens;
        check(Number.isSafeInteger(maxOutputTokens) && maxOutputTokens >= 1 && maxOutputTokens <= profile.model.maxOutputTokens, "TOKEN_LIMIT");
        const tools = request.tools === undefined ? undefined : jsonCopy(request.tools);
        check(tools === undefined || Array.isArray(tools) && tools.length <= 128, "INPUT_INVALID");
        check(phase !== "planning" || tools === undefined || tools.length === 0, "PLANNING_TOOLS_FORBIDDEN");
        const wire = freeze({ messages, options: { ...toolOptions, maxOutputTokens }, ...(tools === undefined ? {} : { tools }),
          ...(request.toolChoice === undefined ? {} : { toolChoice: jsonCopy(request.toolChoice) }) });
        const requestBytes = Buffer.byteLength(JSON.stringify(wire)), estimate = estimateTokens({ text: JSON.stringify(wire) });
        check(requestBytes <= profile.limits.maxInputBytes && estimate.estimatedInputTokens <= profile.model.maxInputTokens, "TOKEN_LIMIT");
        const signal = execution.signal ? AbortSignal.any([baseSignal, execution.signal]) : baseSignal;
        const remaining = Math.min(profile.limits.chunkTimeoutMs, http.deadlineAt - Date.now()); check(remaining > 0, "DEADLINE_EXPIRED");
        control = createLinkedAbortController({ signal, timeoutMs: remaining, timeoutReason: failure("AGENT_LONG_TASK_PROVIDER_DEADLINE_EXPIRED") });
        const checkActive = async (phase: "reserve" | "commit") => {
          throwIfExecutionAborted(control!.signal); check(registry.get(profile.model.providerId) === provider, "PROVIDER_CHANGED");
          await assertActive(phase); throwIfExecutionAborted(control!.signal); check(registry.get(profile.model.providerId) === provider, "PROVIDER_CHANGED");
        };
        await checkActive("reserve");
        const intent: GovernedAgentTaskProviderIntent = Object.freeze({ version: 1, phase, profileHash: profile.profileHash, providerId: profile.model.providerId, modelId: profile.model.modelId,
          requestHash: "sha256:" + digest(wire), messagesHash: "sha256:" + digest(messages), toolsHash: "sha256:" + digest(tools ?? []), optionsHash: "sha256:" + digest(wire.options),
          messageCount: messages.length, toolCount: tools?.length ?? 0, requestBytes, estimatedInputTokens: estimate.estimatedInputTokens,
          estimateMethod: "approximate-no-provider-call", maxInputTokens: profile.model.maxInputTokens, maxOutputTokens });
        let reserved: unknown;
        try { reserved = await reserve(intent); } catch { poisoned = true; throw failure("AGENT_LONG_TASK_PROVIDER_RESERVATION_UNCONFIRMED"); }
        if (!safeId(reserved) || spentIds.has(reserved as string)) { poisoned = true; throw failure("AGENT_LONG_TASK_PROVIDER_RESERVATION_INVALID"); }
        operationId = reserved as string; spentIds.add(operationId);
        await checkActive("commit");
        const fence: GatewayWorkforceDispatchFence = Object.freeze({ providerId: profile.model.providerId, modelId: profile.model.modelId,
          async assertActive(phase: "reserve" | "commit") { check(busy && operationId && dispatches === 0, "DISPATCH_REPLAY"); await checkActive(phase); },
          onDispatch() { throwIfExecutionAborted(control!.signal); check(busy && operationId && dispatches === 0, "DISPATCH_REPLAY"); dispatches++; } });
        const key = http.providerDispatchKeyHash ? digest(["governed-agent-task-provider/v1", http.providerDispatchKeyHash, identity.tenantId,
          identity.userId, agent.agentId, agent.runId, operationId, profile.profileHash, phase]) : undefined;
        const dispatchExecution = Object.freeze({ ...http, signal: control.signal, providerDispatchKeyHash: key, workforceDispatchFence: fence });
        inheritVirtualKeyRequestAccounting(http, dispatchExecution);
        const bound = bindGatewayExecution(gateway, dispatchExecution, () => identity);
        const adapter = createGatewayBackedProviderAdapter({ providerId: profile.model.providerId, modelId: profile.model.modelId, descriptor,
          source: "governed-agent-task:" + phase, agentExecutionContext: agent,
          gatewayService: { async execute(request, execution) { gatewayCalled = true; const response = await bound.execute({ ...request, contextCodec: { profile: "off" } }, execution); current.result = data(response); return response; } } });
        response = await adapter.generate({ request: wire, target: { providerId: profile.model.providerId, modelId: profile.model.modelId }, execution: { signal: control.signal } });
        const body = data(current.result?.data), codec = data(data(body.metadata).contextCodec);
        check(dispatches === 1 && body.providerId === profile.model.providerId && body.model === profile.model.modelId && body.executionStatus === "success"
          && body.executionMode === (fake ? "fake" : "real") && safeId(body.id), "RECEIPT_UNCONFIRMED");
        check(codec.profile === "off" && codec.status === "original" && codec.originalMessageCount === messages.length && typeof codec.inputHash === "string"
          && HEX.test(codec.inputHash) && codec.inputHash === codec.providerInputHash, "INPUT_UNCONFIRMED");
        inputReceipt = Object.freeze({ profile: "off", messagesHash: intent.messagesHash, toolsHash: intent.toolsHash, optionsHash: intent.optionsHash,
          messageCount: intent.messageCount, toolCount: intent.toolCount, gatewayInputHash: codec.inputHash, providerInputHash: codec.providerInputHash });
        const hasTools = Array.isArray(response.toolCalls) && response.toolCalls.length > 0;
        check(typeof response.text === "string" && (response.text.trim() || phase === "coding" && hasTools) && (phase !== "planning" || !hasTools), "RESPONSE_INVALID");
        const checkpointProjection = jsonCopy({ text: response.text, message: response.message, toolCalls: response.toolCalls });
        const checkpointValues: unknown[] = [checkpointProjection, JSON.stringify(checkpointProjection)];
        while (checkpointValues.length) {
          const value = checkpointValues.pop();
          if (typeof value === "string") check(!containsSensitivePublicationText(value) && !/\bBearer\s+[A-Za-z0-9._~+/-]{8,}/iu.test(value), "RESPONSE_UNSAFE");
          else if (value && typeof value === "object") checkpointValues.push(...Object.values(value));
        }
        response = { ...response, ...checkpointProjection };
        terminal = receipt("succeeded", null);
        check(terminal.inputTokens === null || terminal.inputTokens <= profile.model.maxInputTokens, "RESPONSE_TOKEN_LIMIT");
        check(terminal.outputTokens === null || terminal.outputTokens <= maxOutputTokens, "RESPONSE_TOKEN_LIMIT");
        check(terminal.totalTokens === null || terminal.totalTokens <= profile.model.maxInputTokens + maxOutputTokens, "RESPONSE_TOKEN_LIMIT");
      } catch (error) {
        failed = true; const code = safeCode(error), httpStatus = data(data(current.result?.error).details).statusCode;
        const uncertain = dispatches > 0 && !["AGENT_LONG_TASK_PROVIDER_RESPONSE_INVALID", "AGENT_LONG_TASK_PROVIDER_RESPONSE_TOKEN_LIMIT", "AGENT_LONG_TASK_PROVIDER_RESPONSE_UNSAFE"].includes(code)
          && !(Number.isInteger(httpStatus) && httpStatus >= 400 && httpStatus <= 599) || current.result?.success === true && dispatches === 0;
        terminal = receipt(uncertain ? "outcome_unknown" : dispatches > 0 ? "failed" : control?.signal.aborted || baseSignal.aborted ? "cancelled" : "blocked", code);
        if (uncertain) poisoned = true;
      }
      try {
        last = terminal!;
        if (operationId !== null) {
          try { await settle(Object.freeze({ ...terminal!, operationId })); }
          catch { poisoned = true; last = receipt("outcome_unknown", "AGENT_LONG_TASK_PROVIDER_SETTLEMENT_UNCONFIRMED"); throw failure(last.errorCode!, last); }
        }
        if (failed) throw failure(last.errorCode!, last);
        check(response !== undefined, "RESPONSE_INVALID");
        return { ...response, usage: Object.freeze({ inputTokens: last.inputTokens, outputTokens: last.outputTokens, totalTokens: last.totalTokens }), agentTaskReceipt: last };
      } finally { control?.cleanup(); busy = false; }
    },
  });
}
