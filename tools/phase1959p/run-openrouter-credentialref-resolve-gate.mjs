import { createRuntimeCredentialStore } from "../../apps/ai-gateway-service/src/providers/runtimeCredentialStore.js";
import { readJson, writeJson, writeText } from "../phase1903a/ownerAutomationSealCommon.mjs";

const phase = "Phase1959P";
const providerId = "openrouter";
const modelId = "openai/gpt-4o-mini";
const credentialRef = "credentialRef:openrouter:default";

const previousSealPath = "apps/ai-gateway-service/evidence/phase1958p_credentialsetup/phase1958p-credentialsetup-seal-result.json";
const resolveGateDocPath = "docs/phase1959p-openrouter-credentialref-resolve-gate.md";
const phase1960TextTemplatePath = "docs/phase1960p-openrouter-owner-approval-template.md";
const phase1960PacketPath = "docs/phase1960p-openrouter-one-shot-authorization-packet.json";
const gateResultPath = "apps/ai-gateway-service/evidence/phase1959p/openrouter-credentialref-resolve-gate-result.json";
const sealPath = "apps/ai-gateway-service/evidence/phase1959p/phase1959p-seal-result.json";

const previousRead = readJson(previousSealPath);
const previousSeal = previousRead.data ?? {};
const previousSealImported = previousRead.exists === true
  && previousRead.parseError === null
  && previousSeal.completed === true
  && previousSeal.recommended_sealed === true;

const runtimeCredentialStore = createRuntimeCredentialStore({ env: process.env });
const runtimeStatus = runtimeCredentialStore.describe?.(providerId) ?? null;
const openRouterCredentialRefResolvable = runtimeStatus?.apiKeyPresent === true
  && runtimeStatus?.endpointConfigured === true;
const blocker = openRouterCredentialRefResolvable ? null : "openrouter_credentialref_still_missing";
const phase1960Generated = openRouterCredentialRefResolvable;

const safety = {
  providerCallsMade: false,
  requestAttemptCountInThisPhase: 0,
  externalNetworkRequestMade: false,
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
  oneShotProviderCallPassed: false,
  providerStabilityVerified: false,
  productionReadyClaimed: false,
  commercialReadyClaimed: false,
  workspaceCleanClaimed: false,
};

const maskedRuntimeCredentialStatus = {
  providerId: runtimeStatus?.providerId ?? providerId,
  apiKeyPresent: runtimeStatus?.apiKeyPresent === true,
  endpointConfigured: runtimeStatus?.endpointConfigured === true,
  secretStorage: runtimeStatus?.secretStorage ?? "local-user-file",
  persisted: runtimeStatus?.persisted === true,
  source: runtimeStatus?.source ?? null,
  runtimeModelCount: Number(runtimeStatus?.runtimeModelCount ?? 0),
};

const result = {
  phase,
  name: "Phase1959P OpenRouter CredentialRef Resolve Gate Result",
  completed: true,
  recommended_sealed: true,
  blocker,
  previousCredentialSetupSealImported: previousSealImported,
  previousOpenRouterCredentialRefResolvable: previousSeal.openRouterCredentialRefResolvable === true,
  credentialRef,
  providerId,
  modelId,
  openRouterCredentialRefResolvable,
  maskedRuntimeCredentialStatus,
  phase1960FreshAuthorizationTemplateGenerated: phase1960Generated,
  phase1960OneShotAuthorizationPacketGenerated: phase1960Generated,
  phase1960ProviderExecutionGenerated: false,
  allowProviderCallInThisPhase: false,
  allowProviderCallForNextPhase: phase1960Generated,
  freshApprovalRequired: true,
  oldApprovalReusable: false,
  textFirstOwnerApprovalRequired: true,
  jsonRole: "machine_validation_carrier_only",
  ...safety,
};

writeText(resolveGateDocPath, buildResolveGateDoc(result));

if (phase1960Generated) {
  writeText(phase1960TextTemplatePath, buildPhase1960TextTemplate());
  writeJson(phase1960PacketPath, buildPhase1960AuthorizationPacket());
}

writeJson(gateResultPath, result);
writeJson(sealPath, {
  ...result,
  name: "Phase1959P OpenRouter CredentialRef Resolve Gate Seal Result",
});

console.log(JSON.stringify(result, null, 2));

function buildResolveGateDoc(record) {
  const nextAction = record.openRouterCredentialRefResolvable
    ? "Generate Phase1960P fresh text-first owner approval template and authorization packet only. Do not call OpenRouter in this phase."
    : "Stay in Phase1959P with blocker=openrouter_credentialref_still_missing. Do not enter Phase1960P.";

  return `# Phase1959P OpenRouter CredentialRef Resolve Gate

## Scope

Phase1959P only checks whether \`${credentialRef}\` is resolvable through the masked runtime credential status path.

This phase does not call OpenRouter or any other Provider. It does not read raw API keys, auth json raw content, dot env raw content, or authorization headers.

## Result

- completed: ${record.completed}
- recommended_sealed: ${record.recommended_sealed}
- blocker: ${record.blocker ?? "null"}
- providerId: ${record.providerId}
- modelId: ${record.modelId}
- credentialRef: ${record.credentialRef}
- openRouterCredentialRefResolvable: ${record.openRouterCredentialRefResolvable}
- phase1960FreshAuthorizationTemplateGenerated: ${record.phase1960FreshAuthorizationTemplateGenerated}
- phase1960ProviderExecutionGenerated: ${record.phase1960ProviderExecutionGenerated}

## Masked Runtime Status

- apiKeyPresent: ${record.maskedRuntimeCredentialStatus.apiKeyPresent}
- endpointConfigured: ${record.maskedRuntimeCredentialStatus.endpointConfigured}
- persisted: ${record.maskedRuntimeCredentialStatus.persisted}
- runtimeModelCount: ${record.maskedRuntimeCredentialStatus.runtimeModelCount}

## Decision

${nextAction}

## Safety Boundary

- providerCallsMade: false
- requestAttemptCountInThisPhase: 0
- externalNetworkRequestMade: false
- rawSecretRead: false
- authJsonRawRead: false
- dotEnvRawRead: false
- envDumped: false
- secretValueExposed: false
- authorizationHeaderLogged: false
- chatRouteModified: false
- chatGatewayExecuteModified: false
- legacyModified: false
- projectContextModified: false
- commitCreated: false
- pushExecuted: false
- deployExecuted: false
- workspaceCleanClaimed: false
`;
}

function buildPhase1960TextTemplate() {
  return `# Phase1960P Fresh OpenRouter Text-First Owner Approval Template

Owner approval text is the source of truth. JSON is only a machine-validation carrier.

Copy this statement into the future Phase1960P approval statement file only after confirming you still want one guarded OpenRouter-compatible one-shot:

\`\`\`text
I approve one guarded OpenRouter-compatible provider one-shot call for Phase1960P.

Provider: openrouter
Model: openai/gpt-4o-mini
CredentialRef: credentialRef:openrouter:default
Limits: maxRequests=1, retryAttemptCount=0, timeoutMs=60000, stream=false, maxEstimatedCostUsd=0.01
Prompt: Reply only: OK
Expected response contains: OK

I do not approve raw secret reads, auth.json raw reads, dot env raw reads, env dumps, Authorization header logging, default /chat changes, /chat-gateway/execute changes, deploy, release, tag, artifact upload, commit, push, provider stability claims, production claims, or commercial readiness claims.
\`\`\`

Phase1959P does not execute this approval and does not call OpenRouter.
`;
}

function buildPhase1960AuthorizationPacket() {
  return {
    phase: "Phase1960P",
    decision: "template_only_fresh_text_first_openrouter_one_shot_authorization",
    ownerApprovalTextSourceOfTruth: true,
    jsonRole: "machine_validation_carrier_only",
    providerId,
    modelId,
    credentialRef,
    allowProviderCall: true,
    allowRawSecretRead: false,
    allowAuthJsonRead: false,
    allowEnvDump: false,
    allowChatGatewayExecuteModification: false,
    allowDeploy: false,
    maxRequests: 1,
    retryAttemptCount: 0,
    maxEstimatedCostUsd: 0.01,
    timeoutMs: 60000,
    stream: false,
    prompt: "Reply only: OK",
    expectedResponseContains: "OK",
    recordNetworkAttempt: true,
    recordProviderResponseMetadata: true,
    recordRawSecret: false,
    recordAuthorizationHeader: false,
    createdBy: "codex_phase1959p_template_generator",
    notes: "Template only. Phase1959P does not call OpenRouter or any Provider.",
  };
}
