import { CREDENTIAL_REF_RESOLVER_RUNTIME_CONTRACT } from "../../apps/ai-gateway-service/src/providers/credentialRefResolverRuntime.contract.js";
import { SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT } from "../../apps/ai-gateway-service/src/providers/safeInternalProviderExecutor.contract.js";
import { PHASE1957P_ALTERNATIVE_PROVIDER_ONE_SHOT_INTAKE_SCHEMA } from "../../apps/ai-gateway-service/src/providers/providerExecutionAuthorizationSchema.js";
import { readJson, writeJson, writeText } from "../phase1903a/ownerAutomationSealCommon.mjs";

const phase = "Phase1958P-Fix";
const credentialRef = "credentialRef:openrouter:default";
const providerId = "openrouter";
const modelId = "openai/gpt-4o-mini";
const phase1958SealPath = "apps/ai-gateway-service/evidence/phase1958p/phase1958p-seal-result.json";
const readinessPath = "apps/ai-gateway-service/evidence/phase1958p_fix/openrouter-credentialref-readiness-result.json";
const boundaryPath = "apps/ai-gateway-service/evidence/phase1958p_fix/openrouter-credentialref-boundary-result.json";
const sealPath = "apps/ai-gateway-service/evidence/phase1958p_fix/phase1958p-fix-seal-result.json";
const readinessDocPath = "docs/phase1958p-fix-openrouter-credentialref-readiness.md";
const setupDocPath = "docs/phase1958p-fix-openrouter-owner-credential-setup.md";
const boundaryDocPath = "docs/phase1958p-fix-credentialref-boundary.md";
const nextTemplatePath = "docs/phase1958p-fix-next-one-shot-authorization-template.json";

const phase1958Read = readJson(phase1958SealPath);
const phase1958Seal = phase1958Read.data ?? {};
const resolverRef = CREDENTIAL_REF_RESOLVER_RUNTIME_CONTRACT.supportedProviderRefs.find((candidate) => (
  candidate.providerId === providerId && candidate.credentialRef === credentialRef
));
const resolverContractDeclaresRef = Boolean(resolverRef);
const resolverContractAllowsModel = Boolean(resolverRef?.allowedModelIds?.includes(modelId));
const executorAllowlistDeclaresProvider = SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.allowedProviderIds.includes(providerId);
const executorAllowlistDeclaresModel = SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.allowedModelIds.includes(modelId);
const executorAllowlistDeclaresRef = SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.allowedCredentialRefs.includes(credentialRef);
const schemaDeclaresRef = PHASE1957P_ALTERNATIVE_PROVIDER_ONE_SHOT_INTAKE_SCHEMA.selectedCredentialRef === credentialRef;
const phase1958EvidenceImported = phase1958Read.exists === true && phase1958Seal.blocker === "alternative_provider_credential_missing";
const openRouterCredentialRefDeclared = resolverContractDeclaresRef
  && resolverContractAllowsModel
  && executorAllowlistDeclaresProvider
  && executorAllowlistDeclaresModel
  && executorAllowlistDeclaresRef
  && schemaDeclaresRef;

const metadataOnlyCredentialStatus = buildMetadataOnlyCredentialStatus({ phase1958EvidenceImported });
const openRouterCredentialRefResolvable = metadataOnlyCredentialStatus.resolvable === true;
const blocker = openRouterCredentialRefResolvable ? null : "openrouter_credentialref_still_missing";

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
  providerCallsMade: false,
  requestAttemptCountInThisPhase: 0,
  externalNetworkRequestMade: false,
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

const nextTemplate = buildNextOneShotAuthorizationTemplate();
const readiness = {
  phase,
  name: "OpenRouter CredentialRef Readiness Result",
  completed: true,
  recommended_sealed: true,
  blocker,
  openRouterCredentialRefDeclared,
  openRouterCredentialRefResolvable,
  credentialRef,
  providerId,
  modelId,
  resolverContractDeclaresRef,
  resolverContractAllowsModel,
  executorAllowlistDeclaresProvider,
  executorAllowlistDeclaresModel,
  executorAllowlistDeclaresRef,
  schemaDeclaresRef,
  phase1958EvidenceImported,
  phase1958Blocker: phase1958Seal.blocker ?? null,
  phase1958ProviderCallsMade: phase1958Seal.providerCallsMade === true,
  phase1958ExternalNetworkRequestMade: phase1958Seal.realProviderNetworkAttempted === true,
  credentialDetectionMode: "contract_allowlist_plus_sanitized_evidence",
  metadataOnlyCredentialStatus,
  nextOneShotAuthorizationTemplateGenerated: true,
  freshApprovalRequired: true,
  oldApprovalReusable: false,
  ...safety,
};

const boundary = {
  phase,
  name: "OpenRouter CredentialRef Boundary Result",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  credentialRef,
  providerId,
  modelId,
  sourceOfTruthForNextProviderCall: "fresh_text_owner_approval",
  jsonRole: "machine_validation_carrier_only",
  credentialValueReadableByThisPhase: false,
  rawSecretReadableByThisPhase: false,
  configDetectionLimit: "no_metadata_only_secret_status_source_available_in_this_phase",
  openRouterCredentialRefDeclared,
  openRouterCredentialRefResolvable,
  nextOneShotAuthorizationTemplateGenerated: true,
  freshApprovalRequired: true,
  oldApprovalReusable: false,
  ...safety,
};

const seal = {
  ...readiness,
  name: "Phase1958P-Fix OpenRouter CredentialRef Readiness Seal Result",
};

writeJson(readinessPath, readiness);
writeJson(boundaryPath, boundary);
writeJson(sealPath, seal);
writeJson(nextTemplatePath, nextTemplate);
writeText(readinessDocPath, buildReadinessDoc(readiness));
writeText(setupDocPath, buildSetupDoc(readiness));
writeText(boundaryDocPath, buildBoundaryDoc(boundary));

console.log(JSON.stringify(seal, null, 2));

function buildMetadataOnlyCredentialStatus({ phase1958EvidenceImported: imported }) {
  if (imported) {
    return {
      checked: true,
      resolvable: false,
      status: "declared_but_missing_at_last_guarded_execution",
      evidenceSource: phase1958SealPath,
      reason: "Phase1958P blocked before any external network attempt with alternative_provider_credential_missing.",
    };
  }
  return {
    checked: true,
    resolvable: false,
    status: "not_safely_confirmed",
    evidenceSource: null,
    reason: "No sanitized metadata-only evidence proves that credentialRef:openrouter:default is configured.",
  };
}

function buildNextOneShotAuthorizationTemplate() {
  const approvalStatement = [
    "I approve a fresh guarded OpenRouter-compatible one-shot execution after credentialRef readiness is confirmed.",
    "",
    "Provider: openrouter",
    "Model: openai/gpt-4o-mini",
    "CredentialRef: credentialRef:openrouter:default",
    "Limits: allowProviderCall=true, maxRequests=1, timeoutMs=60000, stream=false",
    "",
    "Hard boundaries:",
    "- no raw secret read",
    "- no auth json raw read",
    "- no dot env raw read",
    "- no env dump",
    "- no default chat route change",
    "- no chat-gateway execute route change",
    "- no deploy, release, tag, artifact, commit, push, stability, production, or commercial claim",
  ].join("\n");

  return {
    phase: "Phase1958P-Fix-NextOneShot",
    targetPhase: "Phase1958P-Fresh-AlternativeProvider-OneShot",
    decision: "approved_execute_guarded_openrouter_one_shot_after_credentialref_ready",
    ownerApprovalTextSourceOfTruth: true,
    approvalStatement,
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
    createdBy: "owner",
    notes: "Fresh guarded OpenRouter-compatible one-shot only. No stability, production, or commercial claim.",
  };
}

function buildReadinessDoc(record) {
  return `# Phase1958P-Fix OpenRouter CredentialRef Readiness

## Result

- completed: ${record.completed}
- recommended_sealed: ${record.recommended_sealed}
- blocker: ${record.blocker ?? "null"}
- providerId: ${record.providerId}
- modelId: ${record.modelId}
- credentialRef: ${record.credentialRef}

## Detection

- openRouterCredentialRefDeclared: ${record.openRouterCredentialRefDeclared}
- openRouterCredentialRefResolvable: ${record.openRouterCredentialRefResolvable}
- detectionMode: ${record.credentialDetectionMode}
- metadataOnlyStatus: ${record.metadataOnlyCredentialStatus.status}

The system contract and allowlist know about the OpenRouter CredentialRef. The last sanitized Phase1958P one-shot evidence still reports credential missing before any network request. This phase did not inspect secret values, local secret files, or provider responses.

## Next Step

Use the owner setup document to configure the OpenRouter credential binding, then create a fresh text-first owner approval for a new one-shot phase. The Phase1957P approval must not be reused.
`;
}

function buildSetupDoc(record) {
  return `# Phase1958P-Fix OpenRouter Owner Credential Setup

## Required Binding

- providerId: ${record.providerId}
- credentialRef: ${record.credentialRef}
- modelId for next one-shot: ${record.modelId}

## Owner Action

Configure the OpenRouter credential through the existing product credential configuration path or another approved CredentialRef-only setup flow. Do not paste the key into docs, evidence, chat, terminal logs, or approval text. The setup must bind the secret value to ${record.credentialRef} without exposing the value.

## Safety Rules

- Do not store raw keys in this repository.
- Do not include keys in JSON approval files.
- Do not print keys or authorization headers.
- Do not reuse the Phase1957P approval.
- Do not run a Provider one-shot until a fresh text approval is created after setup.
`;
}

function buildBoundaryDoc(record) {
  return `# Phase1958P-Fix CredentialRef Boundary

## Boundary

- sourceOfTruthForNextProviderCall: ${record.sourceOfTruthForNextProviderCall}
- jsonRole: ${record.jsonRole}
- credentialValueReadableByThisPhase: ${record.credentialValueReadableByThisPhase}
- rawSecretReadableByThisPhase: ${record.rawSecretReadableByThisPhase}
- openRouterCredentialRefDeclared: ${record.openRouterCredentialRefDeclared}
- openRouterCredentialRefResolvable: ${record.openRouterCredentialRefResolvable}

## Non-Execution Confirmation

- providerCallsMade: ${record.providerCallsMade}
- requestAttemptCountInThisPhase: ${record.requestAttemptCountInThisPhase}
- externalNetworkRequestMade: ${record.externalNetworkRequestMade}
- rawSecretRead: ${record.rawSecretRead}
- authJsonRawRead: ${record.authJsonRawRead}
- dotEnvRawRead: ${record.dotEnvRawRead}
- secretValueExposed: ${record.secretValueExposed}
- authorizationHeaderLogged: ${record.authorizationHeaderLogged}

This phase is an intake and detection closure only. It does not call OpenRouter or any other Provider.
`;
}
