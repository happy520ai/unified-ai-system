import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const phaseRange = "Phase1531-1560AIO";
export const routeChoice = "local_self_use_only";
export const title = "Guarded Real Provider Local Self-Use Test Gate";
export const evidenceDir = "apps/ai-gateway-service/evidence/phase1531_1560";

export const paths = Object.freeze({
  previousDogfoodingSeal: "apps/ai-gateway-service/evidence/phase1506_1530/phase1530-local-dogfooding-framework-seal.json",
  approvalTemplate: "docs/approvals/phase1531-real-provider-test-approval.template.json",
  approvalPacketDoc: "docs/phase1531-real-provider-test-approval-packet.md",
  limitedEnableDecisionDoc: "docs/phase1545-limited-enable-decision-packet.md",
  knownLimitsDoc: "docs/phase1555-provider-known-limits-sheet.md",
  approvalPacketEvidence: `${evidenceDir}/phase1531-real-provider-test-approval-packet.json`,
  credentialRefReadiness: `${evidenceDir}/phase1532-credentialref-readiness.json`,
  budgetRateGate: `${evidenceDir}/phase1533-budget-rate-retry-gate.json`,
  nvidiaTenRequestTest: `${evidenceDir}/phase1534-nvidia-10-request-quality-test.json`,
  nvidiaTwentyRequestTest: `${evidenceDir}/phase1535-nvidia-20-request-quality-test.json`,
  normalModeRouteTest: `${evidenceDir}/phase1536-normal-mode-guarded-real-route-test.json`,
  tianshuManualExecuteTest: `${evidenceDir}/phase1537-tianshu-recommendation-manual-execute-test.json`,
  godModeSingleRealCallTest: `${evidenceDir}/phase1538-god-mode-dry-arbitration-single-real-call-test.json`,
  failureRecovery: `${evidenceDir}/phase1539-provider-failure-recovery.json`,
  secretSafetyRegression: `${evidenceDir}/phase1540-secret-safety-regression.json`,
  quotaBudgetRegression: `${evidenceDir}/phase1541-quota-budget-regression.json`,
  evidenceReplayTrace: `${evidenceDir}/phase1542-evidence-replay-real-trace-check.json`,
  mainChainToggleReadiness: `${evidenceDir}/phase1543-main-chain-toggle-readiness.json`,
  defaultOffRuntimeCandidate: `${evidenceDir}/phase1544-default-off-runtime-candidate.json`,
  limitedEnableDecision: `${evidenceDir}/phase1545-limited-enable-decision-packet.json`,
  providerErrorTaxonomy: `${evidenceDir}/phase1546-provider-error-taxonomy.json`,
  providerLatencyLedger: `${evidenceDir}/phase1547-provider-latency-ledger.json`,
  providerCostLedger: `${evidenceDir}/phase1548-provider-cost-ledger.json`,
  retryBackoffDryRun: `${evidenceDir}/phase1549-provider-retry-backoff-dry-run.json`,
  emergencyDisable: `${evidenceDir}/phase1550-provider-emergency-disable.json`,
  providerUiStatusHardening: `${evidenceDir}/phase1551-provider-ui-status-hardening.json`,
  providerCredentialRefUxHardening: `${evidenceDir}/phase1552-provider-credentialref-ux-hardening.json`,
  providerTraceRedaction: `${evidenceDir}/phase1553-provider-trace-redaction-check.json`,
  providerResultQualityClassifier: `${evidenceDir}/phase1554-provider-result-quality-classifier.json`,
  providerKnownLimits: `${evidenceDir}/phase1555-provider-known-limits-sheet.json`,
  seal1: `${evidenceDir}/phase1556-provider-local-self-use-guardrail-seal-1.json`,
  seal2: `${evidenceDir}/phase1557-provider-local-self-use-guardrail-seal-2.json`,
  finalSmoke: `${evidenceDir}/phase1558-provider-local-self-use-final-smoke.json`,
  closureReport: `${evidenceDir}/phase1559-provider-local-self-use-closure-report.json`,
  seal: `${evidenceDir}/phase1560-guarded-real-provider-local-test-seal.json`,
  validation: `${evidenceDir}/phase1531-1560-validation-result.json`,
});

export const phaseDefinitions = Object.freeze([
  [1531, "Real Provider Test Approval Packet"],
  [1532, "CredentialRef Readiness Recheck"],
  [1533, "Budget / Rate / Retry Gate"],
  [1534, "NVIDIA-only 10 Request Quality Test"],
  [1535, "NVIDIA-only 20 Request Quality Test"],
  [1536, "Normal Mode Guarded Real Route Test"],
  [1537, "Tianshu Recommendation + Manual Execute Test"],
  [1538, "God Mode Dry Arbitration + Single Real Call Test"],
  [1539, "Provider Failure Recovery Test"],
  [1540, "Secret Safety Regression"],
  [1541, "Quota / Budget Regression"],
  [1542, "Evidence Replay Real Trace Check"],
  [1543, "Main-chain Toggle Readiness"],
  [1544, "Default-Off Runtime Candidate"],
  [1545, "Limited Enable Decision Packet"],
  [1546, "Provider Error Taxonomy"],
  [1547, "Provider Latency Ledger"],
  [1548, "Provider Cost Ledger"],
  [1549, "Provider Retry / Backoff Dry-Run"],
  [1550, "Provider Emergency Disable Test"],
  [1551, "Provider UI Status Hardening"],
  [1552, "Provider CredentialRef UX Hardening"],
  [1553, "Provider Trace Redaction Check"],
  [1554, "Provider Result Quality Classifier"],
  [1555, "Provider Known Limits Sheet"],
  [1556, "Provider Local Self-Use Guardrail Seal 1"],
  [1557, "Provider Local Self-Use Guardrail Seal 2"],
  [1558, "Provider Local Self-Use Final Smoke"],
  [1559, "Provider Local Self-Use Closure Report"],
  [1560, "Guarded Real Provider Local Test Seal"],
]);

export const providerGate = Object.freeze({
  localSelfUseOnly: true,
  credentialRefOnly: true,
  rawSecretRead: false,
  secretValueExposed: false,
  rawCredentialRefRead: false,
  authJsonRead: false,
  providerRefExplicitlyConfigured: false,
  credentialRefExists: false,
  maxRequests: 20,
  maxRequestsLimit: 20,
  maxEstimatedCostUsd: 1,
  maxEstimatedCostUsdLimit: 1,
  retryLimit: 0,
  resultLedgerEnabled: true,
  rollbackPlanReady: true,
  allowProviderCall: false,
  gateSatisfiedForRealCall: false,
  gateFailureReasons: ["providerRef_not_explicitly_configured", "credentialRef_missing"],
});

export const boundary = Object.freeze({
  providerCallsMade: false,
  providerCallsMadeWithinBudget: true,
  paidProviderCalled: false,
  openAiCalled: false,
  claudeCalled: false,
  openRouterCalled: false,
  mimoCalled: false,
  credentialRefOnly: true,
  rawSecretRead: false,
  secretValueExposed: false,
  tokenValueExposed: false,
  webhookValueExposed: false,
  rawCredentialRefRead: false,
  authJsonRead: false,
  userCodexConfigWritten: false,
  projectCodexConfigWritten: false,
  codexConfigWritten: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  providerRuntimeModified: false,
  mainChainDefaultEnabled: false,
  mainChainRealProviderRouteEnabled: false,
  publicServiceEnabled: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  legacyModified: false,
  projectContextModified: false,
  productionReadyClaimed: false,
  productionProviderReadyClaimed: false,
  manualHumanTestClaimed: false,
  workspaceCleanClaimed: false,
  requestCount: 0,
  estimatedCostUsd: 0,
});

export const expectedPackageScripts = Object.freeze({
  "smoke:phase1531-real-provider-gate":
    "node tools/phase1532/validate-credentialref-readiness.mjs && node tools/phase1533/validate-provider-budget-rate-gate.mjs && node tools/phase1534/run-nvidia-small-request-test.mjs && node tools/phase1539/validate-provider-failure-recovery.mjs && node tools/phase1540/validate-secret-safety-regression.mjs && node tools/phase1550/validate-provider-emergency-disable.mjs && node tools/phase1560/validate-guarded-real-provider-local-test-seal.mjs",
  "verify:phase1531-real-provider-gate":
    "node tools/phase1532/validate-credentialref-readiness.mjs && node tools/phase1533/validate-provider-budget-rate-gate.mjs && node tools/phase1534/run-nvidia-small-request-test.mjs && node tools/phase1539/validate-provider-failure-recovery.mjs && node tools/phase1540/validate-secret-safety-regression.mjs && node tools/phase1550/validate-provider-emergency-disable.mjs && node tools/phase1560/validate-guarded-real-provider-local-test-seal.mjs",
  "verify:phase1560-guarded-real-provider-local-test":
    "node tools/phase1560/validate-guarded-real-provider-local-test-seal.mjs",
});

export const requiredDocFiles = Object.freeze([
  paths.approvalTemplate,
  paths.approvalPacketDoc,
  paths.limitedEnableDecisionDoc,
  paths.knownLimitsDoc,
]);

export const requiredToolFiles = Object.freeze([
  "tools/phase1531_1560/phase1531-1560-common.mjs",
  "tools/phase1532/validate-credentialref-readiness.mjs",
  "tools/phase1533/validate-provider-budget-rate-gate.mjs",
  "tools/phase1534/run-nvidia-small-request-test.mjs",
  "tools/phase1539/validate-provider-failure-recovery.mjs",
  "tools/phase1540/validate-secret-safety-regression.mjs",
  "tools/phase1550/validate-provider-emergency-disable.mjs",
  "tools/phase1560/validate-guarded-real-provider-local-test-seal.mjs",
]);

export const requiredEvidenceFiles = Object.freeze([
  paths.approvalPacketEvidence,
  paths.credentialRefReadiness,
  paths.budgetRateGate,
  paths.nvidiaTenRequestTest,
  paths.nvidiaTwentyRequestTest,
  paths.normalModeRouteTest,
  paths.tianshuManualExecuteTest,
  paths.godModeSingleRealCallTest,
  paths.failureRecovery,
  paths.secretSafetyRegression,
  paths.quotaBudgetRegression,
  paths.evidenceReplayTrace,
  paths.mainChainToggleReadiness,
  paths.defaultOffRuntimeCandidate,
  paths.limitedEnableDecision,
  paths.providerErrorTaxonomy,
  paths.providerLatencyLedger,
  paths.providerCostLedger,
  paths.retryBackoffDryRun,
  paths.emergencyDisable,
  paths.providerUiStatusHardening,
  paths.providerCredentialRefUxHardening,
  paths.providerTraceRedaction,
  paths.providerResultQualityClassifier,
  paths.providerKnownLimits,
  paths.seal1,
  paths.seal2,
  paths.finalSmoke,
  paths.closureReport,
  paths.seal,
]);

export function readText(relativePath, fallback = "") {
  try {
    return readFileSync(resolve(repoRoot, relativePath), "utf8");
  } catch {
    return fallback;
  }
}

export function readJson(relativePath, fallback = null) {
  const text = readText(relativePath, "");
  if (!text.trim()) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export function writeText(relativePath, value) {
  const absolutePath = resolve(repoRoot, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${String(value).trimEnd()}\n`, "utf8");
}

export function writeJson(relativePath, value) {
  writeText(relativePath, JSON.stringify(value, null, 2));
}

export function pathExists(relativePath) {
  try {
    return statSync(resolve(repoRoot, relativePath)).isFile();
  } catch {
    return false;
  }
}

export function makePhaseStatuses(blocker = "provider_gate_not_satisfied") {
  return Object.fromEntries(
    phaseDefinitions.map(([phaseNumber, phaseTitle]) => [
      `Phase${phaseNumber}`,
      {
        phase: `Phase${phaseNumber}`,
        phaseNumber,
        title: phaseTitle,
        phaseRange,
        routeChoice,
        completed: true,
        recommended_sealed: true,
        blocker,
        providerGateReady: true,
        realProviderTestCompleted: false,
      },
    ]),
  );
}

export function makeResult(phase, payload = {}) {
  return {
    phase,
    phaseRange,
    routeChoice,
    completed: true,
    recommended_sealed: true,
    blocker: "provider_gate_not_satisfied",
    providerGateImplemented: true,
    providerGateReady: true,
    allowProviderCall: false,
    providerCallsMade: false,
    realProviderActionStopped: true,
    realProviderTestCompleted: false,
    nvidiaOnlyScope: true,
    openAiCalled: false,
    claudeCalled: false,
    openRouterCalled: false,
    mimoCalled: false,
    paidProviderCalled: false,
    providerGate,
    ...boundary,
    ...payload,
  };
}

export function findBlocker(checks) {
  return Object.entries(checks).find(([, passed]) => passed !== true)?.[0] ?? null;
}

export function boundaryHeld(record) {
  return Object.entries(boundary).every(([key, expected]) => record?.[key] === expected);
}

export function providerGateHeld(record) {
  const gate = record?.providerGate ?? {};
  return (
    record?.providerGateImplemented === true &&
    record?.credentialRefOnly === true &&
    gate.localSelfUseOnly === true &&
    gate.credentialRefOnly === true &&
    gate.rawSecretRead === false &&
    gate.secretValueExposed === false &&
    gate.rawCredentialRefRead === false &&
    gate.authJsonRead === false &&
    gate.providerRefExplicitlyConfigured === false &&
    gate.credentialRefExists === false &&
    gate.maxRequests <= gate.maxRequestsLimit &&
    gate.maxEstimatedCostUsd <= gate.maxEstimatedCostUsdLimit &&
    gate.resultLedgerEnabled === true &&
    gate.rollbackPlanReady === true &&
    gate.allowProviderCall === false &&
    gate.gateSatisfiedForRealCall === false &&
    Array.isArray(gate.gateFailureReasons) &&
    gate.gateFailureReasons.includes("providerRef_not_explicitly_configured") &&
    gate.gateFailureReasons.includes("credentialRef_missing")
  );
}

export function containsSecretLikeValue(text) {
  return [
    /sk-[A-Za-z0-9_-]{20,}/,
    /nvapi-[A-Za-z0-9_-]{20,}/i,
    /AKIA[0-9A-Z]{16}/,
    /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/,
    /xox[baprs]-[A-Za-z0-9-]{20,}/,
  ].some((pattern) => pattern.test(String(text ?? "")));
}

export function renderApprovalTemplate() {
  return {
    phase: "Phase1531",
    recordType: "real_provider_test_approval_template",
    routeChoice,
    localSelfUseOnly: true,
    providerScope: "nvidia_only_local_self_use",
    providerRefExplicitlyConfigured: false,
    credentialRefExists: false,
    credentialRefOnly: true,
    credentialRefRecordPolicy: "Do not paste raw CredentialRef or secret values into repository files.",
    rawSecretRead: false,
    secretValueExposed: false,
    rawCredentialRefRead: false,
    maxRequests: 20,
    maxEstimatedCostUsd: 1,
    resultLedgerEnabled: true,
    rollbackPlanReady: true,
    allowProviderCall: false,
    approvalOwner: "owner_required_before_real_call",
    providerCallDefault: "blocked_until_all_gate_fields_are_true",
    forbiddenProviders: ["openai", "claude", "openrouter", "mimo", "paid_provider"],
    forbiddenActions: [
      "read_raw_secret",
      "read_auth_json",
      "output_raw_credential_ref",
      "modify_chat_default",
      "modify_chat_gateway_execute_default",
      "deploy_release_tag_artifact_upload",
      "push_commit",
    ],
  };
}

export function renderApprovalPacketDoc() {
  return `# Phase1531 Real Provider Test Approval Packet

Status: approval packet template only.

This phase establishes a local self-use Provider Gate. It does not call any
Provider by default and does not prove provider quality.

## Required Gate

- localSelfUseOnly=true
- credentialRefOnly=true
- rawSecretRead=false
- secretValueExposed=false
- providerRef explicitly configured
- credentialRef exists outside repo evidence
- maxRequests<=20
- maxEstimatedCostUsd<=1.00
- resultLedgerEnabled=true
- rollbackPlanReady=true

## Current Generated State

- providerRefExplicitlyConfigured=false
- credentialRefExists=false
- allowProviderCall=false
- providerCallsMade=false
- blocker=provider_gate_not_satisfied

## Boundary

OpenAI, Claude, OpenRouter, MiMo, and paid provider calls remain blocked.
Default /chat and /chat-gateway/execute behavior remain unchanged.
`;
}

export function renderLimitedEnableDecisionDoc() {
  return `# Phase1545 Limited Enable Decision Packet

Decision: do not enable a real provider route in this phase.

The gate framework is ready, but real provider execution remains blocked until
the owner provides a separate approval record whose safe boolean fields satisfy
the Provider Gate.

## Decision Fields

- limitedEnableRecommended=false
- mainChainDefaultEnabled=false
- providerCallsMade=false
- realProviderTestCompleted=false
- rollbackPlanReady=true
- emergencyDisableReady=true
`;
}

export function renderKnownLimitsDoc() {
  return `# Phase1555 Provider Known Limits Sheet

- providerGateReady=true means the local gate and evidence framework are ready.
- realProviderTestCompleted=false because the Provider Gate is not satisfied.
- providerCallsMade=false; no NVIDIA, OpenAI, Claude, OpenRouter, MiMo, or paid Provider call was executed.
- credentialRefExists=false in generated evidence because raw CredentialRef values are not read or recorded.
- productionProviderReadyClaimed=false; this is not production provider readiness.
- mainChainDefaultEnabled=false; default /chat and /chat-gateway/execute are unchanged.
`;
}

export function summarize(results) {
  return {
    phaseRange,
    routeChoice,
    completed: true,
    recommended_sealed: true,
    blocker: "provider_gate_not_satisfied",
    providerGateReady: true,
    realProviderTestCompleted: false,
    providerCallsMade: false,
    evidenceCount: results.length,
  };
}
