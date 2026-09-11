import type { WorkforceRoleContribution, WorkforceRoleContributionReceipt,
  WorkforceRoleExecutionBinding } from "../../shared-contracts/src/contracts/workforce.ts";

type RuntimeContext = Omit<WorkforceRoleContribution, "version" | "contributionText" | "receipt">;
type ProviderPort = {
  governedProviderOperation: true;
  binding: WorkforceRoleExecutionBinding;
  generate(request: unknown): Promise<{ text?: unknown; workforceReceipt?: unknown }>;
};

/** Server injection only: this package receives a governed capability, never credentials. */
export function createRuntimeGatewayBrainAdapter(options: { context: RuntimeContext; providerAdapter: ProviderPort }) {
  const provider = options?.providerAdapter;
  const source = options?.context;
  if (provider?.governedProviderOperation !== true || typeof provider.generate !== "function" || !source) throw invalid();
  const context: RuntimeContext = Object.freeze({
    employeeId: id(source.employeeId), roleId: id(source.roleId),
    governedAgentId: id(source.governedAgentId), agentRunId: id(source.agentRunId),
    executionId: id(source.executionId), taskId: id(source.taskId), planId: id(source.planId),
    planDigest: digest(source.planDigest, false), profileHash: digest(source.profileHash, true),
  });
  if (!context.governedAgentId.startsWith("agt_") || !context.agentRunId.startsWith("agr_")
    || provider.binding?.roleId !== context.roleId || provider.binding?.employeeId !== context.employeeId) throw invalid();
  const binding = Object.freeze({ ...provider.binding });
  const generate = provider.generate.bind(provider);
  return Object.freeze({
    governedProviderOperation: true as const,
    runtimeBrainOperation: true as const,
    binding,
    async generate(request: unknown) {
      const response = await generate(request);
      const receipt = successReceipt(response?.workforceReceipt, binding);
      if (typeof response?.text !== "string" || !response.text.trim()) throw invalid();
      const contribution: WorkforceRoleContribution = Object.freeze({
        version: 1, ...context, contributionText: response.text, receipt,
      });
      return Object.freeze({ text: response.text, workforceReceipt: receipt, workforceContribution: contribution });
    },
  });
}

function successReceipt(value: unknown, binding: WorkforceRoleExecutionBinding): WorkforceRoleContributionReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  const receipt = value as WorkforceRoleContributionReceipt;
  if (receipt.version !== 1 || receipt.level !== "gateway-provider-operation" || receipt.status !== "succeeded"
    || !["fake", "real"].includes(receipt.executionMode) || receipt.providerCallAttempted !== true
    || receipt.providerId !== binding.providerId || receipt.modelId !== binding.modelId || receipt.errorCode !== null) throw invalid();
  return Object.freeze({ version: 1, level: "gateway-provider-operation", status: "succeeded",
    executionMode: receipt.executionMode, gatewayRequestId: id(receipt.gatewayRequestId),
    providerId: binding.providerId, modelId: binding.modelId, providerCallAttempted: true,
    inputTokens: usage(receipt.inputTokens), outputTokens: usage(receipt.outputTokens), totalTokens: usage(receipt.totalTokens),
    estimatedCostUsd: receipt.estimatedCostUsd === null ? null : cost(receipt.estimatedCostUsd), errorCode: null,
  });
}
function id(value: unknown): string { if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/.test(value)) throw invalid(); return value; }
function digest(value: unknown, prefixed: boolean): string { if (typeof value !== "string" || !(prefixed ? /^sha256:[a-f0-9]{64}$/ : /^[a-f0-9]{64}$/).test(value)) throw invalid(); return value; }
function usage(value: unknown): number | null { if (value === null) return null; if (!Number.isSafeInteger(value) || Number(value) < 0) throw invalid(); return Number(value); }
function cost(value: unknown): number { if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw invalid(); return value; }
function invalid() { return Object.assign(new Error("The employee runtime requires a bound, successful governed Gateway contribution."), { code: "EMPLOYEE_RUNTIME_CONTRIBUTION_INVALID", retryable: false }); }
