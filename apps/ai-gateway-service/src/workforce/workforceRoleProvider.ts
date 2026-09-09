import { createHash } from "node:crypto";
import type { WorkforceRoleContributionReceipt, WorkforceRoleExecutionProfile } from "@unified-ai-system/shared-contracts";
import { createLinkedAbortController, throwIfExecutionAborted } from "@unified-ai-system/shared-utils";
import { estimateTokens } from "../cost/tokenEstimator.js";
import { bindGatewayExecution, type GatewayExecutionContext } from "../http/httpRequestExecution.ts";
import type { GatewayWorkforceDispatchFence } from "../core/gatewayService.ts";
import { createGatewayBackedProviderAdapter } from "../providers/gatewayBackedProviderAdapter.ts";
import { HttpLLMProviderAdapter } from "../providers/httpLlmProviderAdapter.js";
import { containsSensitivePublicationText } from "../security/secretSafety.js";
import { readFrozenWorkforceRoleExecutionProfile } from "./workforceRoleExecutionProfile.ts";

type GatewayPort = { execute(input: Record<string, unknown>, execution?: Record<string, unknown>): Promise<unknown> };
type Fence = { assertActive(phase: "reserve" | "commit"): Promise<unknown>; signal?: AbortSignal };
export interface WorkforceRoleRunContext {
  identity: { tenantId: string; userId: string; role: string; permissions: readonly string[]; apiKeyFingerprint?: string };
  agentId: string; agentRunId: string; policyHash: string;
  executionId: string; planId: string; planDigest: string; profileHash: string;
  requestExecution: GatewayExecutionContext;
  signal: AbortSignal;
  agentFence: Fence;
}

/** Dormant until the application explicitly supplies an approved execution profile. */
export function createWorkforceRoleProviderFactory(options: {
  gatewayService: GatewayPort; providerRegistry: { get(providerId: string): unknown };
  profile: WorkforceRoleExecutionProfile;
  assertDispatch?: () => void;
}) {
  const profile = readFrozenWorkforceRoleExecutionProfile(options.profile);
  const gatewayService = options.gatewayService;
  const providerRegistry = options.providerRegistry;
  const assertDispatch = options.assertDispatch;
  if (assertDispatch !== undefined && typeof assertDispatch !== "function") throw roleError("WORKFORCE_ROLE_PROVIDER_UNSUPPORTED");
  const bindings = new Map(profile.bindings.map((binding) => [binding.roleId, binding]));
  const resolveBinding = (roleId: string) => {
    const binding = bindings.get(roleId);
    if (!binding) throw roleError("WORKFORCE_ROLE_BINDING_INVALID");
    const provider = providerRegistry.get(binding.providerId);
    const descriptor = record(record(provider).descriptor);
    const fake = record(descriptor.metadata).providerType === "fake";
    if ((!fake && !(provider instanceof HttpLLMProviderAdapter)) || record(descriptor.metadata).dryRun === true
      || !Array.isArray(descriptor.models) || !descriptor.models.some((model) => record(model).id === binding.modelId && record(model).enabled === true)) {
      throw roleError("WORKFORCE_ROLE_PROVIDER_UNSUPPORTED");
    }
    return { binding, fake };
  };
  return Object.freeze({
    profile,
    forRun(input: WorkforceRoleRunContext) {
      if (!input?.identity || !Array.isArray(input.identity.permissions)
        || input.identity.permissions.some((permission) => typeof permission !== "string" || permission.length > 128)
        || !(input.signal instanceof AbortSignal) || !(input.requestExecution?.signal instanceof AbortSignal)
        || !/^agt_[A-Za-z0-9_-]{1,128}$/.test(input.agentId) || !/^agr_[A-Za-z0-9_-]{1,128}$/.test(input.agentRunId)
        || !/^sha256:[a-f0-9]{64}$/.test(input.policyHash) || !/^[a-f0-9]{64}$/.test(input.planDigest)
        || input.profileHash !== profile.profileHash || typeof input.agentFence?.assertActive !== "function") throw roleError("WORKFORCE_ROLE_RUN_INVALID");
      const identity = Object.freeze({ tenantId: identityText(input.identity.tenantId), userId: identityText(input.identity.userId),
        role: identityText(input.identity.role), permissions: Object.freeze([...input.identity.permissions]),
        ...(input.identity.apiKeyFingerprint ? { apiKeyFingerprint: input.identity.apiKeyFingerprint } : {}) });
      const executionId = identifier(input.executionId);
      const planId = identifier(input.planId);
      const agentContext = Object.freeze({ agentId: input.agentId, runId: input.agentRunId,
        policyHash: input.policyHash, tenantId: identity.tenantId, userId: identity.userId });
      const http = Object.freeze({ signal: input.requestExecution.signal, timeoutMs: input.requestExecution.timeoutMs,
        deadlineAt: input.requestExecution.deadlineAt, providerDispatchKeyHash: input.requestExecution.providerDispatchKeyHash,
        providerDispatchKeyInvalid: input.requestExecution.providerDispatchKeyInvalid,
        providerDispatchRoute: input.requestExecution.providerDispatchRoute,
        transportRequestId: input.requestExecution.transportRequestId, transportTraceId: input.requestExecution.transportTraceId });
      if (http.providerDispatchKeyInvalid || (http.providerDispatchKeyHash !== undefined
        && !/^[a-f0-9]{64}$/.test(http.providerDispatchKeyHash)) || http.providerDispatchRoute !== "/workforce/execute"
        || !Number.isFinite(http.deadlineAt)) throw roleError("WORKFORCE_ROLE_DISPATCH_CONTEXT_INVALID");
      const runSignal = AbortSignal.any([http.signal, input.signal, ...(input.agentFence.signal ? [input.agentFence.signal] : [])]);
      const assertAgentActive = input.agentFence.assertActive.bind(input.agentFence);
      const boundRoles = new Set<string>();
      const receipts: Readonly<{ roleId: string; employeeId: string; taskId: string; receipt: WorkforceRoleContributionReceipt }>[] = [];
      let totalRequests = 0;
      let activeRoles = 0;
      return Object.freeze({
        profile, executionId, planId,
        getReceipts: () => Object.freeze([...receipts]),
        getUsage: () => Object.freeze({ totalRequests, activeRoles }),
        validateRoles(roleIds: string[]) {
          for (const roleId of roleIds) {
            const { fake } = resolveBinding(roleId);
            if (!fake && !http.providerDispatchKeyHash) throw roleError("WORKFORCE_ROLE_DISPATCH_KEY_REQUIRED");
          }
        },
        createRoleAdapter(role: { roleId: string; taskId: string; signal: AbortSignal; taskFence: Fence }) {
          const binding = bindings.get(role.roleId);
          if (!binding || boundRoles.has(role.roleId) || typeof role.taskFence?.assertActive !== "function") throw roleError("WORKFORCE_ROLE_BINDING_INVALID");
          const taskId = identifier(role.taskId);
          const { fake } = resolveBinding(role.roleId);
          if (!fake && !http.providerDispatchKeyHash) throw roleError("WORKFORCE_ROLE_DISPATCH_KEY_REQUIRED");
          boundRoles.add(role.roleId);
          const taskFence = role.taskFence;
          const assertTaskActive = taskFence.assertActive.bind(taskFence);
          const signal = AbortSignal.any([runSignal, role.signal, ...(taskFence.signal ? [taskFence.signal] : [])]);
          let requests = 0;
          let busy = false;
          let current: { dispatches: number; result: Record<string, unknown> | null } | null = null;
          const saveReceipt = (receipt: WorkforceRoleContributionReceipt) => receipts.push(Object.freeze({
            roleId: binding.roleId, employeeId: binding.employeeId, taskId, receipt,
          }));
          const fence: GatewayWorkforceDispatchFence = Object.freeze({
            providerId: binding.providerId, modelId: binding.modelId,
            async assertActive(phase: "reserve" | "commit") {
              throwIfExecutionAborted(signal);
              if (!busy || requests >= binding.maxRequests || totalRequests >= profile.maxTotalRequests) throw roleError("WORKFORCE_ROLE_REQUEST_LIMIT");
              await assertAgentActive(phase);
              await assertTaskActive(phase);
              throwIfExecutionAborted(signal);
            },
            onDispatch() {
              throwIfExecutionAborted(signal);
              if (!current || requests >= binding.maxRequests || totalRequests >= profile.maxTotalRequests) throw roleError("WORKFORCE_ROLE_REQUEST_LIMIT");
              // Final synchronous check, after every asynchronous Agent/task fence.
              try { if (assertDispatch?.() !== undefined) throw roleError("WORKFORCE_PROVIDER_DISPATCH_DENIED"); }
              catch (error) {
                const denied = roleError("WORKFORCE_PROVIDER_DISPATCH_DENIED");
                Object.defineProperty(denied, "cause", { value: error });
                throw denied;
              }
              requests += 1; totalRequests += 1; current.dispatches += 1;
            },
          });
          const dispatchHash = http.providerDispatchKeyHash
            ? createHash("sha256").update(JSON.stringify(["workforce-role/v1", http.providerDispatchKeyHash,
              identity.tenantId, identity.userId, executionId, taskId, binding.roleId, binding.employeeId])).digest("hex") : undefined;
          const boundGateway = bindGatewayExecution(gatewayService, Object.freeze({ ...http, signal,
            providerDispatchKeyHash: dispatchHash, workforceDispatchFence: fence }), () => identity);
          const adapter = createGatewayBackedProviderAdapter({ providerId: binding.providerId, modelId: binding.modelId,
            source: `workforce-role:${binding.roleId}`, agentExecutionContext: agentContext,
            gatewayService: { async execute(request, execution) {
              const result = await boundGateway.execute(request, execution);
              if (current) current.result = record(result);
              return result;
            } },
          });
          return Object.freeze({
            governedProviderOperation: true as const,
            descriptor: adapter.descriptor,
            binding,
            async generate(request: { request?: { messages?: unknown; options?: Record<string, unknown> };
              target?: { providerId?: unknown; modelId?: unknown } } = {}) {
              if (busy || activeRoles >= profile.maxConcurrentRoles) {
                const receipt = projectReceipt(null, 0, "blocked", "WORKFORCE_ROLE_CONCURRENCY_LIMIT");
                saveReceipt(receipt);
                throw Object.assign(roleError("WORKFORCE_ROLE_CONCURRENCY_LIMIT"), { workforceReceipt: receipt });
              }
              busy = true; activeRoles += 1; current = { dispatches: 0, result: null };
              let control: ReturnType<typeof createLinkedAbortController> | null = null;
              try {
                const remaining = Math.min(binding.timeoutMs, http.deadlineAt - Date.now());
                if (remaining <= 0) throw roleError("WORKFORCE_ROLE_DEADLINE_EXPIRED");
                control = createLinkedAbortController({ signal, timeoutMs: remaining,
                  timeoutReason: roleError("WORKFORCE_ROLE_DEADLINE_EXPIRED") });
                const messages = textMessages(request.request?.messages);
                const maxOutputTokens = request.request?.options?.maxOutputTokens ?? binding.maxOutputTokens;
                if (!Number.isSafeInteger(maxOutputTokens) || Number(maxOutputTokens) < 1 || Number(maxOutputTokens) > binding.maxOutputTokens
                  || estimateTokens({ messages }).estimatedInputTokens > binding.maxInputTokens) throw roleError("WORKFORCE_ROLE_TOKEN_LIMIT");
                await fence.assertActive("reserve");
                const response = await adapter.generate({ request: { messages, options: { temperature: 0.3, maxOutputTokens } },
                  target: { providerId: request.target?.providerId ?? binding.providerId,
                    modelId: request.target?.modelId ?? binding.modelId }, execution: { signal: control.signal } });
                const data = record(current.result?.data);
                if (!current.dispatches || data.providerId !== binding.providerId || data.model !== binding.modelId
                  || !["fake", "real"].includes(String(data.executionMode)) || data.executionStatus !== "success") throw roleError("WORKFORCE_ROLE_RECEIPT_UNCONFIRMED");
                const receipt = projectReceipt(current.result, current.dispatches, "succeeded", null);
                const observation = record(record(record(data.metadata).rawProviderMeta).workforceObservation);
                if (typeof response.text !== "string" || !response.text.trim()
                  || data.executionMode === "real" && observation.contentPresent !== true
                  || Array.isArray(response.toolCalls) && response.toolCalls.length > 0
                  || receipt.inputTokens !== null && receipt.inputTokens > binding.maxInputTokens
                  || receipt.outputTokens !== null && receipt.outputTokens > binding.maxOutputTokens) throw roleError("WORKFORCE_ROLE_CONTRIBUTION_INVALID");
                if (containsSensitivePublicationText(response.text)) throw roleError("WORKFORCE_ROLE_CONTRIBUTION_UNSAFE");
                saveReceipt(receipt);
                return { ...response, workforceReceipt: receipt };
              } catch (error) {
                const code = safeCode(error);
                const httpStatus = record(record(current.result?.error).details).statusCode;
                const knownHttpFailure = Number.isInteger(httpStatus) && httpStatus >= 400 && httpStatus <= 599;
                const status = code === "WORKFORCE_ROLE_RECEIPT_UNCONFIRMED" ? "outcome_unknown"
                  : current.dispatches === 0 ? (control?.signal.aborted || signal.aborted ? "cancelled" : "blocked")
                    : ["WORKFORCE_ROLE_CONTRIBUTION_INVALID", "WORKFORCE_ROLE_CONTRIBUTION_UNSAFE"].includes(code) || knownHttpFailure ? "failed" : "outcome_unknown";
                const receipt = projectReceipt(current.result, current.dispatches, status, code);
                saveReceipt(receipt);
                const failure = Object.assign(roleError(code), { workforceReceipt: receipt });
                Object.defineProperty(failure, "cause", { value: error });
                throw failure;
              } finally {
                control?.cleanup(); current = null; busy = false; activeRoles -= 1;
              }
            },
          });
        },
      });
    },
  });
}

function projectReceipt(result: Record<string, unknown> | null, dispatches: number,
  status: WorkforceRoleContributionReceipt["status"], errorCode: string | null): WorkforceRoleContributionReceipt {
  const data = record(result?.data);
  const usage = record(data.usage);
  const reported = record(record(record(record(data.metadata).rawProviderMeta).workforceObservation).usageReported);
  return Object.freeze({ version: 1, level: "gateway-provider-operation", status,
    executionMode: data.executionMode === "fake" || data.executionMode === "real" ? data.executionMode : "unknown",
    gatewayRequestId: safeReceiptId(data.id), providerId: safeReceiptId(data.providerId), modelId: safeReceiptId(data.model),
    providerCallAttempted: dispatches > 0 ? true : errorCode === "WORKFORCE_ROLE_RECEIPT_UNCONFIRMED" ? null : false,
    inputTokens: reported.inputTokens === true ? finiteUsage(usage.inputTokens) : null,
    outputTokens: reported.outputTokens === true ? finiteUsage(usage.outputTokens) : null,
    totalTokens: reported.totalTokens === true ? finiteUsage(usage.totalTokens) : null, estimatedCostUsd: null, errorCode,
  });
}

function textMessages(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 32) throw roleError("WORKFORCE_ROLE_INPUT_INVALID");
  return value.map((entry) => {
    const message = record(entry);
    if (!["system", "user", "assistant"].includes(String(message.role)) || typeof message.content !== "string") throw roleError("WORKFORCE_ROLE_INPUT_INVALID");
    return { role: String(message.role), content: message.content };
  });
}
function record(value: unknown): Record<string, any> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {}; }
function identifier(value: unknown): string { if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/.test(value)) throw roleError("WORKFORCE_ROLE_RUN_INVALID"); return value; }
function identityText(value: unknown): string { if (typeof value !== "string" || !value.trim() || value.trim().length > 256 || /[\u0000-\u001f\u007f]/u.test(value)) throw roleError("WORKFORCE_ROLE_RUN_INVALID"); return value.trim(); }
function finiteUsage(value: unknown): number | null { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null; }
function safeReceiptId(value: unknown): string | null { return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/.test(value) ? value : null; }
function safeCode(error: unknown): string { const code = record(error).code; return typeof code === "string" && /^[A-Z][A-Z0-9_]{0,95}$/.test(code) ? code : "WORKFORCE_ROLE_PROVIDER_FAILED"; }
function roleError(code: string) { return Object.assign(new Error("The Workforce role Provider operation could not complete within its approved binding."), { code, category: "provider", type: "authorization", retryable: false }); }
