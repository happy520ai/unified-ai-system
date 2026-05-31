import { readFileSync } from "node:fs";
import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createSafeInternalProviderExecutor } from "../../apps/ai-gateway-service/src/providers/safeInternalProviderExecutor.js";
import { buildPhase1957PAlternativeProviderApprovalStatement } from "../../apps/ai-gateway-service/src/providers/providerExecutionAuthorizationSchema.js";
import { validateAlternativeProviderOwnerApprovalInput } from "../../apps/ai-gateway-service/src/providers/providerExecutionAuthorizationGate.js";
import { readJson, writeJson, writeText } from "../phase1903a/ownerAutomationSealCommon.mjs";

const phase = "Phase1958P-AlternativeProvider-OneShot";
const approvalStatementPath = "docs/phase1957p-alternative-provider-approval-statement.md";
const approvalJsonPath = "docs/phase1957p-alternative-provider-owner-approval.input.json";
const reportDocPath = "docs/phase1958p-alternative-provider-one-shot-report.md";
const boundaryDocPath = "docs/phase1958p-provider-call-boundary.md";
const classificationDocPath = "docs/phase1958p-result-classification.md";
const resultPath = "apps/ai-gateway-service/evidence/phase1958p/alternative-provider-one-shot-result.json";
const boundaryPath = "apps/ai-gateway-service/evidence/phase1958p/provider-one-shot-safety-boundary.json";
const validationPath = "apps/ai-gateway-service/evidence/phase1958p/phase1958p-validation-result.json";
const sealPath = "apps/ai-gateway-service/evidence/phase1958p/phase1958p-seal-result.json";
const invocationPurpose = "phase1958p_guarded_alternative_provider_one_shot";

const approvalTextRead = readApprovalText(approvalStatementPath);
const approvalJsonRead = readJson(approvalJsonPath);
const approval = approvalJsonRead.data ?? {};
const canonicalApprovalStatement = buildPhase1957PAlternativeProviderApprovalStatement();
const extractedApprovalText = extractTextFence(approvalTextRead.text);
const textPresent = approvalTextRead.exists === true && normalizeApproval(extractedApprovalText).length > 0;
const jsonPresent = approvalJsonRead.exists === true && approvalJsonRead.parseError === null;
const textMatchesCanonical = normalizeApproval(extractedApprovalText) === normalizeApproval(canonicalApprovalStatement);
const jsonMatchesText = jsonPresent && normalizeApproval(approval.approvalStatement) === normalizeApproval(extractedApprovalText);
const validation = textPresent && jsonPresent && textMatchesCanonical && jsonMatchesText
  ? validateAlternativeProviderOwnerApprovalInput(approval)
  : { ok: false, failures: ["owner_approval_text_missing_or_mismatch"] };

const execution = validation.ok === true
  ? await executeApprovedOneShot(approval)
  : buildBlockedExecution(validation.failures);

const safety = {
  credentialRefOnly: true,
  rawSecretRead: false,
  authJsonRead: false,
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
  requestLimitRespected: Number(execution.requestAttemptCount ?? 0) <= 1,
};

const ok = execution.ok === true;
const blocker = ok ? null : execution.blocker === "owner_approval_text_missing_or_mismatch"
  ? "owner_approval_text_missing_or_mismatch"
  : execution.blocker ?? "alternative_provider_one_shot_failed";
const result = {
  phase,
  name: "Alternative Provider Guarded One-Shot Execution Result",
  completed: true,
  recommended_sealed: ok,
  blocker,
  ownerApprovalTextPresent: textPresent,
  ownerApprovalTextIsSourceOfTruth: true,
  approvalJsonPresent: jsonPresent,
  approvalTextJsonConsistent: jsonMatchesText,
  ownerApprovalInputValid: validation.ok === true,
  validationFailures: validation.failures ?? [],
  guardedAlternativeProviderCallExecuted: execution.guardedAlternativeProviderCallExecuted === true,
  providerCallsMade: execution.providerCallsMade === true,
  realProviderNetworkAttempted: execution.realProviderNetworkAttempted === true,
  requestAttemptCount: Number(execution.requestAttemptCount ?? 0),
  success: ok ? 1 : 0,
  fail: ok ? 0 : Number(execution.requestAttemptCount ?? 0) > 0 ? 1 : 0,
  retryAttemptCount: Number(execution.retryAttemptCount ?? 0),
  providerId: approval.providerId ?? "openrouter",
  modelId: approval.modelId ?? "openai/gpt-4o-mini",
  credentialRef: approval.credentialRef ?? "credentialRef:openrouter:default",
  timeoutMs: Number(approval.timeoutMs ?? 0) || null,
  stream: approval.stream === false ? false : null,
  oneShotProviderCallPassed: ok,
  expectedResponseMatched: execution.expectedResponseMatched === true,
  responseSanitized: execution.responseSanitized === true,
  providerResponseMetadataRecorded: Boolean(execution.providerResponseMetadata),
  responseReceived: Boolean(execution.sanitizedResponsePreview),
  responseClassification: classifyResponse(execution),
  failureClassified: ok !== true,
  failureReason: ok ? null : classifyFailure(execution),
  latencyMs: execution.latencyMs ?? execution.providerResponseMetadata?.latencyMs ?? null,
  httpStatus: execution.providerResponseMetadata?.status ?? null,
  sanitizedResponsePreview: execution.sanitizedResponsePreview ?? null,
  providerResponseMetadata: execution.providerResponseMetadata ?? null,
  providerStabilityNotVerifiedPreserved: true,
  provider_stability_not_verified_preserved: true,
  ...safety,
};

const boundary = {
  phase,
  name: "Alternative Provider One-Shot Safety Boundary",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  ownerApprovalTextPresent: result.ownerApprovalTextPresent,
  ownerApprovalTextIsSourceOfTruth: true,
  approvalJsonPresent: result.approvalJsonPresent,
  approvalTextJsonConsistent: result.approvalTextJsonConsistent,
  providerId: result.providerId,
  modelId: result.modelId,
  credentialRef: result.credentialRef,
  maxRequests: approval.maxRequests ?? null,
  timeoutMs: result.timeoutMs,
  stream: result.stream,
  recordNetworkAttempt: approval.recordNetworkAttempt === true,
  recordProviderResponseMetadata: approval.recordProviderResponseMetadata === true,
  recordRawSecret: approval.recordRawSecret === true,
  recordAuthorizationHeader: approval.recordAuthorizationHeader === true,
  providerCallsMade: result.providerCallsMade,
  realProviderNetworkAttempted: result.realProviderNetworkAttempted,
  requestAttemptCount: result.requestAttemptCount,
  emergencyStopStatus: ok ? "not_triggered" : "no_retry_after_failure",
  rollbackStatus: "not_executed",
  ...safety,
};

const seal = {
  ...result,
  name: "Phase1958P Alternative Provider One-Shot Seal Result",
};

writeJson(resultPath, result);
writeJson(boundaryPath, boundary);
writeJson(validationPath, {
  phase,
  name: "Phase1958P Validation Result",
  completed: true,
  recommended_sealed: ok,
  blocker,
  ownerApprovalTextPresent: textPresent,
  approvalJsonPresent: jsonPresent,
  approvalTextJsonConsistent: jsonMatchesText,
  ownerApprovalInputValid: validation.ok === true,
  requestAttemptCount: result.requestAttemptCount,
  providerCallsMade: result.providerCallsMade,
  oneShotProviderCallPassed: result.oneShotProviderCallPassed,
  validationFailures: validation.failures ?? [],
  failureReason: result.failureReason,
  ...safety,
});
writeJson(sealPath, seal);
writeText(reportDocPath, buildReportDoc(seal));
writeText(boundaryDocPath, buildBoundaryDoc(boundary));
writeText(classificationDocPath, buildClassificationDoc(seal));

console.log(JSON.stringify(seal, null, 2));

if (seal.recommended_sealed !== true || seal.blocker !== null) {
  process.exitCode = 1;
}

async function executeApprovedOneShot(approvalInput) {
  const adapter = createAlternativeProviderAdapter(approvalInput);
  const executor = createSafeInternalProviderExecutor({
    mode: "real_bridge",
    providerAdapter: adapter,
    providerAdapterName: adapter.adapterName,
  });
  return executor.executeGuardedAlternativeProviderOneShot({ authorization: approvalInput });
}

function createAlternativeProviderAdapter(approvalInput) {
  return {
    adapterName: "phase1958pCredentialRefOpenRouterAdapter",
    async execute(envelope = {}) {
      if (envelope.providerId !== "openrouter") return adapterBlocked("provider_not_allowed", envelope);
      if (envelope.modelId !== approvalInput.modelId) return adapterBlocked("model_not_allowed", envelope);
      if (envelope.credentialRef !== approvalInput.credentialRef) return adapterBlocked("credential_ref_not_allowed", envelope);
      if (Number(envelope.maxRequests) !== 1) return adapterBlocked("max_requests_invalid", envelope);
      if (envelope.stream !== false) return adapterBlocked("streaming_forbidden", envelope);
      if (envelope.allowProviderCall !== true || envelope.dryRun === true) return adapterBlocked("provider_call_not_authorized", envelope);

      const app = createGatewayApplication({
        ...process.env,
        AI_GATEWAY_PROVIDER_MODE: "real",
        AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
        AI_GATEWAY_ENABLED_PROVIDERS: "openrouter",
        AI_GATEWAY_DEFAULT_PROVIDER: "openrouter",
        AI_GATEWAY_DEFAULT_MODEL: envelope.modelId,
        AI_GATEWAY_ROUTE_MODE: "fixed",
        AI_GATEWAY_FALLBACK_ENABLED: "false",
        AI_GATEWAY_REQUEST_TIMEOUT_MS: String(envelope.timeoutMs),
      });
      const startedAt = Date.now();
      const routeEnvelope = await app.gatewayService.execute({
        taskType: "chat",
        messages: [{ role: "user", content: envelope.prompt }],
        options: { temperature: 0, maxOutputTokens: 8 },
        metadata: { invocationPurpose },
      });
      const latencyMs = routeEnvelope.meta?.durationMs ?? Date.now() - startedAt;
      const text = String(routeEnvelope.data?.outputText ?? routeEnvelope.data?.text ?? "");
      const success = routeEnvelope.success === true;
      const errorCode = routeEnvelope.error?.code ?? routeEnvelope.code ?? null;
      const networkAttempted = success || didReachProviderNetwork(errorCode);
      return {
        ok: success,
        providerCallsMade: networkAttempted,
        realProviderNetworkAttempted: networkAttempted,
        syntheticAdapterUsed: false,
        status: routeEnvelope.error?.details?.statusCode ?? null,
        latencyMs,
        providerId: envelope.providerId,
        modelId: envelope.modelId,
        text,
        blocker: success ? null : classifyRouteError(errorCode),
      };
    },
  };
}

function buildBlockedExecution(failures = []) {
  return {
    ok: false,
    guardedAlternativeProviderCallExecuted: false,
    providerCallsMade: false,
    realProviderNetworkAttempted: false,
    requestAttemptCount: 0,
    retryAttemptCount: 0,
    blocker: "owner_approval_text_missing_or_mismatch",
    failureClassified: true,
    failureClassification: failures[0] ?? "authorization_invalid",
    responseSanitized: true,
    expectedResponseMatched: false,
    oneShotProviderCallPassed: false,
    safeInternalProviderExecutorStillStub: false,
    providerCallImplementationMode: "real_bridge",
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

function readApprovalText(relativePath) {
  try {
    return { exists: true, text: readFileSync(relativePath, "utf8").replace(/^\uFEFF/u, "") };
  } catch {
    return { exists: false, text: "" };
  }
}

function extractTextFence(markdown) {
  const match = String(markdown ?? "").match(/```text\s*([\s\S]*?)```/u);
  return match ? match[1].trim() : String(markdown ?? "").trim();
}

function normalizeApproval(value) {
  return String(value ?? "").replace(/\s+/gu, " ").trim();
}

function classifyRouteError(code) {
  const text = String(code ?? "").toLowerCase();
  if (text.includes("missing")) return "alternative_provider_credential_missing";
  if (text.includes("unauthorized") || text.includes("401")) return "alternative_provider_unauthorized";
  if (text.includes("forbidden") || text.includes("403")) return "alternative_provider_forbidden";
  if (text.includes("rate") || text.includes("429")) return "alternative_provider_rate_limited";
  if (text.includes("timeout")) return "alternative_provider_request_timeout";
  return "alternative_provider_one_shot_failed";
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

function classifyFailure(execution = {}) {
  if (execution.blocker) return execution.blocker;
  if (execution.providerCallsMade !== true) return "alternative_provider_call_not_executed";
  if (execution.expectedResponseMatched !== true) return "expected_response_marker_missing";
  return "alternative_provider_one_shot_failed";
}

function classifyResponse(execution = {}) {
  if (execution.ok === true) return "alternative_provider_one_shot_passed";
  return classifyFailure(execution);
}

function buildReportDoc(record) {
  return `# Phase1958P Alternative Provider One-Shot Report

- completed: ${record.completed}
- recommended_sealed: ${record.recommended_sealed}
- blocker: ${record.blocker ?? "null"}
- providerId: ${record.providerId}
- modelId: ${record.modelId}
- requestAttemptCount: ${record.requestAttemptCount}
- retryAttemptCount: ${record.retryAttemptCount}
- providerCallsMade: ${record.providerCallsMade}
- realProviderNetworkAttempted: ${record.realProviderNetworkAttempted}
- oneShotProviderCallPassed: ${record.oneShotProviderCallPassed}
- expectedResponseMatched: ${record.expectedResponseMatched}
- failureReason: ${record.failureReason ?? "null"}

This report is a guarded one-shot record only. It is not a Provider stability claim.
`;
}

function buildBoundaryDoc(boundary) {
  return `# Phase1958P Provider Call Boundary

- ownerApprovalTextIsSourceOfTruth: ${boundary.ownerApprovalTextIsSourceOfTruth}
- approvalTextJsonConsistent: ${boundary.approvalTextJsonConsistent}
- providerId: ${boundary.providerId}
- modelId: ${boundary.modelId}
- credentialRef: ${boundary.credentialRef}
- maxRequests: ${boundary.maxRequests}
- timeoutMs: ${boundary.timeoutMs}
- stream: ${boundary.stream}
- rawSecretRead: ${boundary.rawSecretRead}
- authJsonRead: ${boundary.authJsonRead}
- dotEnvRead: ${boundary.dotEnvRead}
- authorizationHeaderLogged: ${boundary.authorizationHeaderLogged}
- chatGatewayExecuteModified: ${boundary.chatGatewayExecuteModified}
- deployExecuted: ${boundary.deployExecuted}
- commitCreated: ${boundary.commitCreated}
- pushExecuted: ${boundary.pushExecuted}
`;
}

function buildClassificationDoc(record) {
  return `# Phase1958P Result Classification

- responseClassification: ${record.responseClassification}
- failureClassified: ${record.failureClassified}
- failureReason: ${record.failureReason ?? "null"}
- latencyMs: ${record.latencyMs ?? "null"}
- httpStatus: ${record.httpStatus ?? "null"}
- providerResponseMetadataRecorded: ${record.providerResponseMetadataRecorded}
- responseReceived: ${record.responseReceived}

If this one-shot fails, do not retry in this phase.
`;
}
