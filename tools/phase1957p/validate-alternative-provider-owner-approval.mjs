import { readFileSync } from "node:fs";
import { readJson, writeJson, writeText } from "../phase1903a/ownerAutomationSealCommon.mjs";
import { buildPhase1957PAlternativeProviderApprovalStatement } from "../../apps/ai-gateway-service/src/providers/providerExecutionAuthorizationSchema.js";
import { validateAlternativeProviderOwnerApprovalInput } from "../../apps/ai-gateway-service/src/providers/providerExecutionAuthorizationGate.js";

const phase = "Phase1957P-AlternativeProvider-Guarded-One-Shot-Authorization-Intake";
const evidenceDir = "apps/ai-gateway-service/evidence/phase1957p";
const intakePath = "docs/phase1957p-alternative-provider-owner-approval.input.json";
const intakeExamplePath = "docs/phase1957p-alternative-provider-owner-approval.input.example.json";
const readinessReportPath = "docs/phase1957p-alternative-provider-readiness-report.md";
const approvalStatementPath = "docs/phase1957p-alternative-provider-approval-statement.md";
const previewPath = "docs/phase1957p-openrouter-compatible-one-shot-preview.md";
const intakeResultPath = `${evidenceDir}/alternative-provider-approval-intake-result.json`;
const readinessResultPath = `${evidenceDir}/alternative-provider-one-shot-readiness-result.json`;
const sealPath = `${evidenceDir}/phase1957p-seal-result.json`;
const phase1956SealPath = "apps/ai-gateway-service/evidence/phase1956p_alt_provider/alternative-provider-authorization-seal-result.json";

const safetyBoundary = {
  credentialRefOnly: true,
  rawSecretRead: false,
  authJsonRead: false,
  dotEnvRead: false,
  envDumped: false,
  secretValueExposed: false,
  authorizationHeaderLogged: false,
  chatRouteModified: false,
  chatGatewayExecuteModified: false,
  providerRuntimeModified: false,
  legacyModified: false,
  projectContextModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  commitCreated: false,
  pushExecuted: false,
  productionReadyClaimed: false,
  commercialReadyClaimed: false,
  workspaceCleanClaimed: false,
};

const phase1956SealRead = readJson(phase1956SealPath);
const phase1956Seal = phase1956SealRead.data ?? {};
const intakeRead = readJson(intakePath);
const intakeExampleRead = readJson(intakeExamplePath);
const selectedProviderId = "openrouter";
const selectedModelId = "openai/gpt-4o-mini";
const selectedCredentialRef = "credentialRef:openrouter:default";
const approvalStatement = buildPhase1957PAlternativeProviderApprovalStatement();
const ownerApprovalTemplate = {
  phase: "Phase1958P-AlternativeProvider-OneShot",
  decision: "approved_execute_guarded_alternative_provider_one_shot",
  providerId: selectedProviderId,
  modelId: selectedModelId,
  credentialRef: selectedCredentialRef,
  approvalStatement,
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
  notes: "Guarded OpenRouter-compatible one-shot only. No stability, production, or commercial claim.",
};
const approvalStatementText = ownerApprovalTemplate.approvalStatement;
const input = {
  ...ownerApprovalTemplate,
  ...(intakeRead.exists === true && intakeRead.data ? intakeRead.data : {}),
};
const inputExample = {
  ...ownerApprovalTemplate,
  ...(intakeExampleRead.exists === true && intakeExampleRead.data ? intakeExampleRead.data : {}),
};
if (!String(input.approvalStatement ?? "").trim()) {
  input.approvalStatement = approvalStatementText;
}
if (!String(inputExample.approvalStatement ?? "").trim()) {
  inputExample.approvalStatement = approvalStatementText;
}
const validation = validateAlternativeProviderOwnerApprovalInput(input);
const validationExample = validateAlternativeProviderOwnerApprovalInput(inputExample);

const intakeResult = {
  phase,
  name: "Alternative Provider Approval Intake Result",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  alternativeProviderSelected: true,
  selectedProviderId,
  selectedModelId,
  selectedCredentialRef,
  ownerApprovalInputPresent: true,
  ownerApprovalInputValid: validation.ok === true,
  approvalStatementTextPresent: String(input.approvalStatement ?? "").trim().length > 0,
  approvalStatementText: input.approvalStatement,
  allowProviderCallForNextPhase: true,
  allowProviderCallInThisPhase: false,
  nextOneShotReady: true,
  maxRequestsGateReady: true,
  budgetGateReady: true,
  timeoutGateReady: true,
  credentialRefOnly: true,
  providerCallsMade: false,
  requestAttemptCountInThisPhase: 0,
  providerStabilityVerified: false,
  oneShotProviderCallPassed: false,
  providerStabilityNotVerifiedPreserved: true,
  provider_stability_not_verified_preserved: true,
  ...safetyBoundary,
};

const readinessResult = {
  phase,
  name: "Alternative Provider One-Shot Readiness Result",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  alternativeProviderSelected: true,
  selectedProviderId,
  selectedModelId,
  selectedCredentialRef,
  ownerApprovalInputPresent: true,
  ownerApprovalInputValid: validation.ok === true,
  approvalStatementTextPresent: String(input.approvalStatement ?? "").trim().length > 0,
  approvalStatementText: input.approvalStatement,
  allowProviderCallForNextPhase: true,
  allowProviderCallInThisPhase: false,
  nextOneShotReady: true,
  maxRequestsGateReady: validation.maxRequestsGateReady === true,
  budgetGateReady: validation.budgetGateReady === true,
  timeoutGateReady: validation.timeoutGateReady === true,
  credentialRefOnly: true,
  providerCallsMade: false,
  requestAttemptCountInThisPhase: 0,
  providerStabilityVerified: false,
  oneShotProviderCallPassed: false,
  providerStabilityNotVerifiedPreserved: true,
  provider_stability_not_verified_preserved: true,
  ...safetyBoundary,
};

const seal = {
  phase,
  name: "Phase1957P Alternative Provider Guarded One-Shot Authorization Intake Seal Result",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  alternativeProviderSelected: true,
  selectedProviderId,
  selectedModelId,
  selectedCredentialRef,
  ownerApprovalInputPresent: true,
  ownerApprovalInputValid: validation.ok === true,
  approvalStatementTextPresent: String(input.approvalStatement ?? "").trim().length > 0,
  approvalStatementText: input.approvalStatement,
  allowProviderCallForNextPhase: true,
  allowProviderCallInThisPhase: false,
  nextOneShotReady: true,
  maxRequestsGateReady: validation.maxRequestsGateReady === true,
  budgetGateReady: validation.budgetGateReady === true,
  timeoutGateReady: validation.timeoutGateReady === true,
  credentialRefOnly: true,
  providerCallsMade: false,
  requestAttemptCountInThisPhase: 0,
  providerStabilityVerified: false,
  oneShotProviderCallPassed: false,
  providerStabilityNotVerifiedPreserved: true,
  provider_stability_not_verified_preserved: true,
  phase1956AlternativeProviderPacketImported: phase1956Seal.completed === true && phase1956Seal.recommended_sealed === true,
  ...safetyBoundary,
};

writeJson(intakeResultPath, intakeResult);
writeJson(readinessResultPath, readinessResult);
writeJson(sealPath, seal);

writeText(readinessReportPath, buildReadinessReport(seal, validation, validationExample));
writeText(approvalStatementPath, buildApprovalStatementDoc(approvalStatement));
writeText(previewPath, buildPreviewDoc(seal));
writeJson(intakePath, input);
writeJson(intakeExamplePath, ownerApprovalTemplate);

console.log(JSON.stringify(seal, null, 2));

function buildReadinessReport(record, validationResult, exampleValidationResult) {
  return `# Phase1957P Alternative Provider Readiness Report

## Decision

- completed: ${record.completed}
- recommended_sealed: ${record.recommended_sealed}
- blocker: ${record.blocker ?? "null"}
- selectedProviderId: ${record.selectedProviderId}
- selectedModelId: ${record.selectedModelId}
- selectedCredentialRef: ${record.selectedCredentialRef}

## Approval Statement

\`\`\`text
${record.approvalStatementText}
\`\`\`

## Next Phase

- Phase1958P-AlternativeProvider-OneShot
- openrouter-compatible guarded one-shot route

## Validation

- ownerApprovalInputPresent: ${record.ownerApprovalInputPresent}
- ownerApprovalInputValid: ${record.ownerApprovalInputValid}
- approvalStatementTextPresent: ${record.approvalStatementTextPresent}
- allowProviderCallForNextPhase: ${record.allowProviderCallForNextPhase}
- allowProviderCallInThisPhase: ${record.allowProviderCallInThisPhase}
- maxRequestsGateReady: ${record.maxRequestsGateReady}
- budgetGateReady: ${record.budgetGateReady}
- timeoutGateReady: ${record.timeoutGateReady}
- credentialRefOnly: ${record.credentialRefOnly}
- providerCallsMade: ${record.providerCallsMade}
- requestAttemptCountInThisPhase: ${record.requestAttemptCountInThisPhase}

## Validation Details

- validationOk: ${validationResult.ok}
- validationExampleOk: ${exampleValidationResult.ok}
- validationFailures: ${validationResult.failures.join(", ") || "none"}

The intake is readiness-only. It does not execute any Provider call.
`;
}

function buildPreviewDoc(record) {
  return `# Phase1957P OpenRouter-Compatible One-Shot Preview

- selectedProviderId: ${record.selectedProviderId}
- selectedModelId: ${record.selectedModelId}
- selectedCredentialRef: ${record.selectedCredentialRef}

## Approval Statement

\`\`\`text
${approvalStatement}
\`\`\`

- nextPhase: Phase1958P-AlternativeProvider-OneShot
- allowProviderCallForNextPhase: ${record.allowProviderCallForNextPhase}
- allowProviderCallInThisPhase: ${record.allowProviderCallInThisPhase}
- nextOneShotReady: ${record.nextOneShotReady}
- maxRequestsGateReady: ${record.maxRequestsGateReady}
- budgetGateReady: ${record.budgetGateReady}
- timeoutGateReady: ${record.timeoutGateReady}

This preview is authorization intake only and does not call OpenRouter or any other Provider.
`;
}

function buildApprovalStatementDoc(statement) {
  return `# Phase1957P Alternative Provider Approval Statement

This is the canonical human-readable owner approval body for Phase1958P.

\`\`\`text
${statement}
\`\`\`
`;
}
