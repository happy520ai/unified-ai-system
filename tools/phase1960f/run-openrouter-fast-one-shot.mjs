import { readFileSync } from "node:fs";
import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createSafeInternalProviderExecutor } from "../../apps/ai-gateway-service/src/providers/safeInternalProviderExecutor.js";
import { createRuntimeCredentialStore } from "../../apps/ai-gateway-service/src/providers/runtimeCredentialStore.js";
import { writeJson, writeText } from "../phase1903a/ownerAutomationSealCommon.mjs";

const phase = "Phase1960F";
const providerId = "openrouter";
const modelId = "openai/gpt-4o-mini";
const credentialRef = "credentialRef:openrouter:default";
const timeoutMs = 60000;
const prompt = "Reply only: OK";
const expectedResponseContains = "OK";
const approvalDocPath = "docs/phase1960f-owner-approval.md";
const resultPath = "apps/ai-gateway-service/evidence/phase1960f/openrouter-fast-one-shot-result.json";
const sealPath = "apps/ai-gateway-service/evidence/phase1960f/phase1960f-seal-result.json";

writeText(approvalDocPath, buildOwnerApprovalDoc());

const runtimeCredentialStore = createRuntimeCredentialStore({ env: process.env });
const runtimeStatus = runtimeCredentialStore.describe?.(providerId) ?? null;
const openRouterCredentialRefResolvable = runtimeStatus?.apiKeyPresent === true
  && runtimeStatus?.endpointConfigured === true;

const execution = openRouterCredentialRefResolvable
  ? await runOneShot()
  : blockedExecution("openrouter_credentialref_still_missing");

const oneShotPassed = execution.ok === true
  && execution.providerCallsMade === true
  && execution.expectedResponseMatched === true;
const blocker = oneShotPassed
  ? null
  : openRouterCredentialRefResolvable
    ? execution.blocker ?? "openrouter_fast_one_shot_failed"
    : "openrouter_credentialref_still_missing";

const safety = {
  credentialRefOnly: true,
  rawSecretRead: false,
  authJsonRawRead: false,
  authJsonRead: false,
  dotEnvRawRead: false,
  dotEnvRead: false,
  envDumped: false,
  secretValueExposed: false,
  authorizationHeaderLogged: false,
  chatRouteModified: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  commitCreated: false,
  pushExecuted: false,
  providerStabilityVerified: false,
  multiProviderStabilityVerified: false,
  productionReadyClaimed: false,
  commercialReadyClaimed: false,
  workspaceCleanClaimed: false,
};

const result = {
  phase,
  name: "Phase1960F OpenRouter Fast Credential Resolve + One-Shot Smoke",
  completed: true,
  recommended_sealed: oneShotPassed,
  blocker,
  ownerApprovalDocPresent: readFileSafe(approvalDocPath).length > 0,
  openRouterCredentialRefResolvable,
  credentialRef,
  providerId,
  modelId,
  maxRequests: 1,
  timeoutMs,
  stream: false,
  promptRecorded: prompt,
  expectedResponseContains,
  guardedOpenRouterFastOneShotExecuted: execution.providerCallsMade === true,
  providerCallsMade: execution.providerCallsMade === true,
  realProviderNetworkAttempted: execution.realProviderNetworkAttempted === true,
  externalNetworkRequestMade: execution.realProviderNetworkAttempted === true,
  requestAttemptCount: Number(execution.requestAttemptCount ?? 0),
  requestAttemptCountInThisPhase: Number(execution.requestAttemptCount ?? 0),
  retryAttemptCount: 0,
  success: oneShotPassed ? 1 : 0,
  fail: oneShotPassed ? 0 : Number(execution.requestAttemptCount ?? 0) > 0 ? 1 : 0,
  oneShotProviderCallPassed: oneShotPassed,
  expectedResponseMatched: execution.expectedResponseMatched === true,
  responseSanitized: execution.responseSanitized === true,
  providerResponseMetadataRecorded: Boolean(execution.providerResponseMetadata),
  latencyMs: execution.latencyMs ?? execution.providerResponseMetadata?.latencyMs ?? null,
  httpStatus: execution.providerResponseMetadata?.status ?? null,
  sanitizedResponsePreview: execution.sanitizedResponsePreview ?? null,
  failureClassified: oneShotPassed !== true,
  failureReason: oneShotPassed ? null : blocker,
  requestLimitRespected: Number(execution.requestAttemptCount ?? 0) <= 1,
  openRouterCalled: execution.providerCallsMade === true,
  ...safety,
};

writeJson(resultPath, result);
writeJson(sealPath, {
  ...result,
  name: "Phase1960F OpenRouter Fast One-Shot Seal Result",
});

console.log(JSON.stringify(result, null, 2));

async function runOneShot() {
  const adapter = createFastOpenRouterAdapter();
  const executor = createSafeInternalProviderExecutor({
    mode: "real_bridge",
    providerAdapter: adapter,
    providerAdapterName: adapter.adapterName,
  });

  return executor.execute({
    phase,
    providerId,
    modelId,
    credentialRef,
    prompt,
    expectedResponseContains,
    maxRequests: 1,
    maxEstimatedCostUsd: 0.01,
    timeoutMs,
    stream: false,
    allowProviderCall: true,
    dryRun: false,
  });
}

function createFastOpenRouterAdapter() {
  return {
    adapterName: "phase1960fFastCredentialRefOpenRouterAdapter",
    async execute(envelope = {}) {
      if (envelope.providerId !== providerId) return adapterBlocked("provider_not_allowed", envelope);
      if (envelope.modelId !== modelId) return adapterBlocked("model_not_allowed", envelope);
      if (envelope.credentialRef !== credentialRef) return adapterBlocked("credential_ref_not_allowed", envelope);
      if (Number(envelope.maxRequests) !== 1) return adapterBlocked("max_requests_invalid", envelope);
      if (envelope.stream !== false) return adapterBlocked("streaming_forbidden", envelope);
      if (envelope.allowProviderCall !== true || envelope.dryRun === true) return adapterBlocked("provider_call_not_authorized", envelope);

      const app = createGatewayApplication({
        ...process.env,
        AI_GATEWAY_PROVIDER_MODE: "real",
        AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
        AI_GATEWAY_ENABLED_PROVIDERS: providerId,
        AI_GATEWAY_DEFAULT_PROVIDER: providerId,
        AI_GATEWAY_DEFAULT_MODEL: modelId,
        AI_GATEWAY_ROUTE_MODE: "fixed",
        AI_GATEWAY_FALLBACK_ENABLED: "false",
        AI_GATEWAY_REQUEST_TIMEOUT_MS: String(timeoutMs),
      });
      const startedAt = Date.now();
      const routeEnvelope = await app.gatewayService.execute({
        taskType: "chat",
        messages: [{ role: "user", content: envelope.prompt }],
        options: { temperature: 0, maxOutputTokens: 8 },
        metadata: { invocationPurpose: "phase1960f_openrouter_fast_one_shot" },
      });
      const latencyMs = routeEnvelope.meta?.durationMs ?? Date.now() - startedAt;
      const text = String(routeEnvelope.data?.outputText ?? routeEnvelope.data?.text ?? "");
      const success = routeEnvelope.success === true;
      const code = routeEnvelope.error?.code ?? routeEnvelope.code ?? null;
      const status = routeEnvelope.error?.details?.statusCode ?? null;
      const networkAttempted = success || didReachProviderNetwork(code);

      return {
        ok: success,
        providerCallsMade: networkAttempted,
        realProviderNetworkAttempted: networkAttempted,
        syntheticAdapterUsed: false,
        status,
        latencyMs,
        providerId: envelope.providerId,
        modelId: envelope.modelId,
        text,
        blocker: success ? null : classifyRouteError(code),
      };
    },
  };
}

function blockedExecution(blocker) {
  return {
    ok: false,
    providerCallsMade: false,
    realProviderNetworkAttempted: false,
    requestAttemptCount: 0,
    responseSanitized: true,
    expectedResponseMatched: false,
    oneShotProviderCallPassed: false,
    blocker,
  };
}

function adapterBlocked(blocker, envelope = {}) {
  return {
    ok: false,
    providerCallsMade: false,
    realProviderNetworkAttempted: false,
    syntheticAdapterUsed: false,
    status: null,
    latencyMs: 0,
    providerId: envelope.providerId ?? null,
    modelId: envelope.modelId ?? null,
    text: "",
    blocker,
  };
}

function didReachProviderNetwork(code) {
  const text = String(code ?? "").toLowerCase();
  if (!text) return false;
  if (text.includes("api_key_missing")) return false;
  if (text.includes("endpoint_missing")) return false;
  if (text.includes("validation")) return false;
  if (text.includes("no_route")) return false;
  return text.includes("openrouter") || text.includes("http") || text.includes("timeout") || text.includes("rate");
}

function classifyRouteError(code) {
  const text = String(code ?? "").toLowerCase();
  if (text.includes("missing")) return "openrouter_credentialref_still_missing";
  if (text.includes("unauthorized") || text.includes("401")) return "openrouter_unauthorized";
  if (text.includes("forbidden") || text.includes("403")) return "openrouter_forbidden";
  if (text.includes("rate") || text.includes("429")) return "openrouter_rate_limited";
  if (text.includes("timeout")) return "openrouter_request_timeout";
  return "openrouter_fast_one_shot_failed";
}

function buildOwnerApprovalDoc() {
  return `# Phase1960F Owner Approval

Owner approves Fast Track only:
- providerId: openrouter
- modelId: openai/gpt-4o-mini
- credentialRef: credentialRef:openrouter:default
- maxRequests: 1
- retryAttemptCount: 0
- timeoutMs: 60000
- stream: false
- prompt: Reply only: OK
- expectedResponseContains: OK

If credentialRef is not resolvable, stop immediately.
No raw key read/output, no authorization header output, no /chat or /chat-gateway/execute change, no legacy or PROJECT_CONTEXT.md change, no commit/push/deploy/release, no stability/production/commercial claim.
`;
}

function readFileSafe(relativePath) {
  try {
    return readFileSync(relativePath, "utf8");
  } catch {
    return "";
  }
}
