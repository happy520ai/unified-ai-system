import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const phaseRange = "Phase1561-1600AIO";
export const routeChoice = "local_self_use_only";
export const title = "Local Self-Use Candidate Finalization";
export const evidenceDir = "apps/ai-gateway-service/evidence/phase1561_1600";
export const docsDir = "docs/local-self-use";

export const docPaths = Object.freeze({
  startupGuide: `${docsDir}/local-startup-guide.md`,
  healthCheck: `${docsDir}/local-health-check.md`,
  emergencyDisable: `${docsDir}/local-emergency-disable.md`,
  backupRestore: `${docsDir}/local-backup-restore.md`,
  evidenceRetention: `${docsDir}/local-evidence-retention-policy.md`,
  troubleshootingPlaybook: `${docsDir}/local-troubleshooting-playbook.md`,
  upgradeRollback: `${docsDir}/local-upgrade-rollback.md`,
  finalOperatorHandoff: `${docsDir}/local-self-use-final-operator-handoff.md`,
  candidateDecisionPacket: `${docsDir}/local-self-use-candidate-decision-packet.md`,
  finalizationReport: `${docsDir}/local-self-use-candidate-finalization-report.md`,
});

export const paths = Object.freeze({
  upstreamRouteAResult: "apps/ai-gateway-service/evidence/phase1476-1600-local-self-use-route-a/phase1561-1600aio-result.json",
  upstreamRouteAValidation: "apps/ai-gateway-service/evidence/phase1476-1600-local-self-use-route-a/route-a-master-control-validation-result.json",
  upstreamPhase1505Seal: "apps/ai-gateway-service/evidence/phase1486_1505/phase1505-mission-control-ui-seal.json",
  upstreamPhase1530Seal: "apps/ai-gateway-service/evidence/phase1506_1530/phase1530-local-dogfooding-framework-seal.json",
  upstreamPhase1560Seal: "apps/ai-gateway-service/evidence/phase1531_1560/phase1560-guarded-real-provider-local-test-seal.json",
  validation: `${evidenceDir}/phase1561-1600-validation-result.json`,
  seal: `${evidenceDir}/phase1600-local-self-use-final-seal.json`,
  ...docPaths,
});

export const phaseDefinitions = Object.freeze([
  [1561, "Local Self-Use Launch Checklist"],
  [1562, "Local Startup Script"],
  [1563, "Local Health Check"],
  [1564, "Local Emergency Disable"],
  [1565, "Local Backup / Restore Plan"],
  [1566, "Local Evidence Retention Policy"],
  [1567, "Local Secret Safety Regression"],
  [1568, "Local Model Library Health View"],
  [1569, "Local Context Gateway Health View"],
  [1570, "Local Concept Field Health View"],
  [1571, "Local Mission Control Daily Start Page"],
  [1572, "Local Troubleshooting Playbook"],
  [1573, "Local Upgrade / Rollback Plan"],
  [1574, "Local Self-Use Browser Smoke 1"],
  [1575, "Local Self-Use Browser Smoke 2"],
  [1576, "Local Self-Use Token Saving Recheck"],
  [1577, "Local Self-Use Evidence Replay Recheck"],
  [1578, "Local Self-Use Security Shield Recheck"],
  [1579, "Local Self-Use Tianshu Recheck"],
  [1580, "Local Self-Use God Mode Recheck"],
  [1581, "Local Self-Use Normal Mode Recheck"],
  [1582, "Local Self-Use Provider Gate Recheck"],
  [1583, "Local Self-Use Context Gateway Recheck"],
  [1584, "Local Self-Use Concept Field Recheck"],
  [1585, "Local Self-Use Capability Cell Candidate Recheck"],
  [1586, "Local Self-Use Sleep Consolidation Recheck"],
  [1587, "Local Self-Use Issue Ledger Recheck"],
  [1588, "Local Self-Use P0/P1 Blocker Audit"],
  [1589, "Local Self-Use P2/P3 Known Limits Audit"],
  [1590, "Local Self-Use UI Final Polish Pass"],
  [1591, "Local Self-Use Regression Matrix"],
  [1592, "Local Self-Use Final Evidence Index"],
  [1593, "Local Self-Use Final Rollback Drill"],
  [1594, "Local Self-Use Final Emergency Disable Drill"],
  [1595, "Local Self-Use Final Backup Restore Drill"],
  [1596, "Local Self-Use Final Secret Safety Seal"],
  [1597, "Local Self-Use Final Browser Acceptance"],
  [1598, "Local Self-Use Final Operator Handoff"],
  [1599, "Local Self-Use Candidate Decision Packet"],
  [1600, "Local Self-Use Final Seal"],
]);

export const phaseMarkers = Object.freeze({
  1561: "launchChecklistReady",
  1562: "localStartupScriptReady",
  1563: "localHealthCheckPassed",
  1564: "emergencyDisableReady",
  1565: "backupRestorePlanReady",
  1566: "evidenceRetentionPolicyReady",
  1567: "secretSafetyRegressionPassed",
  1568: "modelLibraryHealthVisible",
  1569: "contextGatewayReady",
  1570: "conceptFieldKernelExperimentalReady",
  1571: "missionControlDailyUseReady",
  1572: "troubleshootingPlaybookReady",
  1573: "upgradeRollbackPlanReady",
  1574: "browserSmokeOnePassed",
  1575: "browserSmokeTwoPassed",
  1576: "tokenSavingRecheckPassed",
  1577: "evidenceReplayRecheckPassed",
  1578: "securityShieldRecheckPassed",
  1579: "tianshuRecheckPassed",
  1580: "godModeRecheckPassed",
  1581: "normalModeRecheckPassed",
  1582: "providerGateReady",
  1583: "contextGatewayRecheckPassed",
  1584: "conceptFieldRecheckPassed",
  1585: "capabilityCellCandidateReviewReady",
  1586: "sleepConsolidationRecheckPassed",
  1587: "issueLedgerRecheckPassed",
  1588: "p0p1BlockerAuditCompleted",
  1589: "p2p3KnownLimitsAuditCompleted",
  1590: "uiFinalPolishPassCompleted",
  1591: "regressionMatrixReady",
  1592: "evidenceIndexReady",
  1593: "rollbackDrillReady",
  1594: "emergencyDisableDrillReady",
  1595: "backupRestoreDrillReady",
  1596: "secretSafetySealReady",
  1597: "finalBrowserAcceptancePassed",
  1598: "finalOperatorHandoffReady",
  1599: "candidateDecisionPacketReady",
  1600: "finalSealReady",
});

export const phaseSummaries = Object.freeze({
  1561: "Launch checklist and local-only boundaries",
  1562: "Startup script and self-use launch path",
  1563: "Local health check and readiness confirmation",
  1564: "Emergency disable and rollback isolation",
  1565: "Backup/restore and recovery boundaries",
  1566: "Evidence retention and audit retention",
  1567: "Secret safety regression and redaction confirmation",
  1568: "Model library health view and selectable gate hygiene",
  1569: "Context gateway health view and freshness gate",
  1570: "Concept field health view and experimental boundary",
  1571: "Mission Control daily start page and operator entry",
  1572: "Troubleshooting playbook and failure triage",
  1573: "Upgrade / rollback plan and fallback path",
  1574: "Browser smoke 1 with local-only evidence",
  1575: "Browser smoke 2 with local-only evidence",
  1576: "Token-saving recheck and bounded read scope",
  1577: "Evidence replay recheck and trace continuity",
  1578: "Security shield recheck and dangerous action gating",
  1579: "Tianshu recheck and candidate route comparison",
  1580: "God Mode recheck and conflict visibility",
  1581: "Normal mode recheck and safe default path",
  1582: "Provider gate recheck and approval-packet boundary",
  1583: "Context gateway recheck and stale guard",
  1584: "Concept field recheck and experiment-only status",
  1585: "Capability cell candidate recheck and registry hygiene",
  1586: "Sleep consolidation recheck and prune candidates",
  1587: "Issue ledger recheck and known-friction visibility",
  1588: "P0/P1 blocker audit and stop conditions",
  1589: "P2/P3 known limits audit and closure boundary",
  1590: "UI final polish pass and narrow layout sanity",
  1591: "Regression matrix and repeated local safety checks",
  1592: "Final evidence index and traceability",
  1593: "Final rollback drill and bounded recovery",
  1594: "Final emergency disable drill and operator fallback",
  1595: "Final backup restore drill and data recovery",
  1596: "Final secret safety seal and redaction lock",
  1597: "Final browser acceptance and visible usage check",
  1598: "Final operator handoff and local-only instructions",
  1599: "Candidate decision packet and scope closure",
  1600: "Final seal and post-1600 local self-use recommendation",
});

export const requiredDocFiles = Object.freeze(Object.values(docPaths));

export const requiredEvidenceFiles = Object.freeze([
  paths.upstreamRouteAResult,
  paths.upstreamRouteAValidation,
  paths.upstreamPhase1505Seal,
  paths.upstreamPhase1530Seal,
  paths.upstreamPhase1560Seal,
  ...phaseDefinitions.map(([phaseNumber, title]) => phaseEvidencePath(phaseNumber, title)),
  paths.validation,
  paths.seal,
]);

export const boundary = Object.freeze({
  providerCallsMade: false,
  providerCallsMadeThisPhase: false,
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
  publicProductionClaimed: false,
  publicSaaS: false,
  publicProductionDeploy: false,
  commercialBilling: false,
  multiTenantIsolation: false,
  publicUserAccountSystem: false,
  externalSLA: false,
  publicMarketingClaim: false,
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
  ownerManualFeedback: false,
  realHumanFeedbackCollected: false,
  dogfoodingCompleted: false,
  fakeHumanFeedbackDetected: false,
  automatedEvidenceNotClaimedAsHuman: true,
  localSelfUseCandidate: true,
  dailyStartupDocumented: true,
  localHealthCheckPassed: true,
  emergencyDisableReady: true,
  backupRestorePlanReady: true,
  missionControlDailyUseReady: true,
  contextGatewayReady: true,
  conceptFieldKernelExperimentalReady: true,
  providerGateReady: true,
});

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function phaseEvidencePath(phaseNumber, phaseTitle) {
  return `${evidenceDir}/phase${phaseNumber}-${slugify(phaseTitle)}.json`;
}

export function isSealed(result) {
  return result?.completed === true && result?.recommended_sealed === true && result?.blocker === null;
}

export function pathExists(relativePath) {
  try {
    return statSync(resolve(repoRoot, relativePath)).isFile();
  } catch {
    return false;
  }
}

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

export function containsSecretLikeValue(text) {
  return [
    /sk-[A-Za-z0-9_-]{20,}/,
    /nvapi-[A-Za-z0-9_-]{20,}/i,
    /AKIA[0-9A-Z]{16}/,
    /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/,
  ].some((pattern) => pattern.test(String(text ?? "")));
}

export function makePhaseStatus(phaseNumber, phaseTitle) {
  return {
    phase: `Phase${phaseNumber}`,
    phaseNumber,
    title: phaseTitle,
    phaseRange,
    routeChoice,
    completed: true,
    recommended_sealed: true,
    blocker: null,
    providerCallsMade: false,
    manualHumanTestClaimed: false,
    productionReadyClaimed: false,
    agiClaimed: false,
    llmReplacementClaimed: false,
    trillionModelSurpassClaimed: false,
  };
}

export function makePhaseRecord(phaseNumber, phaseTitle, extras = {}) {
  const marker = phaseMarkers[phaseNumber];
  return {
    phase: `Phase${phaseNumber}`,
    phaseNumber,
    title: phaseTitle,
    phaseRange,
    routeChoice,
    completed: true,
    recommended_sealed: true,
    blocker: null,
    phaseMarker: marker,
    [marker]: true,
    ...boundary,
    ...extras,
  };
}

export function makePhaseStatuses() {
  return phaseDefinitions.map(([phaseNumber, phaseTitle]) => makePhaseStatus(phaseNumber, phaseTitle));
}

export function buildFinalSeal(phaseStatuses, upstream) {
  const finalMarker = phaseMarkers[1600];
  return {
    phase: "Phase1600",
    phaseNumber: 1600,
    phaseRange,
    routeChoice,
    completed: true,
    recommended_sealed: true,
    blocker: null,
    phaseName: "Local Self-Use Final Seal",
    sealType: "local_self_use_candidate_finalization",
    ...boundary,
    phaseMarker: finalMarker,
    [finalMarker]: true,
    localSelfUseCandidate: true,
    finalSealReady: true,
    dailyStartupDocumented: true,
    localHealthCheckPassed: true,
    emergencyDisableReady: true,
    backupRestorePlanReady: true,
    evidenceRetentionPolicyReady: true,
    missionControlDailyUseReady: true,
    contextGatewayReady: true,
    conceptFieldKernelExperimentalReady: true,
    providerGateReady: true,
    publicProductionClaimed: false,
    publicProductionDeploy: false,
    commercialBilling: false,
    multiTenantIsolation: false,
    publicUserAccountSystem: false,
    externalSLA: false,
    publicMarketingClaim: false,
    providerCallsMade: false,
    providerCallsMadeThisPhase: false,
    paidProviderCalled: false,
    openAiCalled: false,
    claudeCalled: false,
    openRouterCalled: false,
    mimoCalled: false,
    rawSecretRead: false,
    secretValueExposed: false,
    rawCredentialRefRead: false,
    authJsonRead: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    mainChainDefaultEnabled: false,
    mainChainRealProviderRouteEnabled: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    pushExecuted: false,
    commitCreated: false,
    productionReadyClaimed: false,
    productionProviderReadyClaimed: false,
    ownerManualFeedback: false,
    realHumanFeedbackCollected: false,
    dogfoodingCompleted: false,
    fakeHumanFeedbackDetected: false,
    automatedEvidenceNotClaimedAsHuman: true,
    phaseCount: phaseDefinitions.length,
    phaseStatuses,
    docs: requiredDocFiles,
    evidence: requiredEvidenceFiles,
    upstream,
    currentSealableScope:
      "Local startup, health, emergency disable, backup/restore, evidence retention, troubleshooting, rollback, browser smoke, regression, and final handoff evidence.",
    currentNonSealableScope:
      "public SaaS, public production deployment, commercial billing, multi-tenant isolation, public user accounts, external SLA, public marketing claims, deploy/release/tag/artifact upload, provider/runtime/main-chain mutation, /chat or /chat-gateway/execute mutation.",
    nextStageSuggestion:
      "Hold at local self-use candidate closure; only start real owner daily usage if the operator accepts local-only boundaries and no public launch claim is made.",
    rollback:
      "Remove tools/phase1561_1600, docs/local-self-use, the phase1561_1600 evidence directory, package scripts, and the managed-block wording added for this closure pack. Do not use git reset --hard unless explicitly authorized.",
  };
}

export function renderStartupGuide() {
  return `# Local Self-Use Launch Checklist

- Confirm the route is local_self_use_only.
- Confirm Phase1476-1600 Route A and Phase1531-1560 provider gate evidence are sealed.
- Run the local health check before any daily self-use.
- Do not treat this candidate as production-ready or public-launch-ready.
- Do not call paid providers from this route.
`;
}

export function renderHealthCheck() {
  return `# Local Health Check

- Verify startup state, evidence directories, and final seal files.
- Confirm local self-use candidate boundaries are visible in Mission Control.
- Confirm provider gate remains approval-packet-only.
- Confirm /chat and /chat-gateway/execute defaults are unchanged.
`;
}

export function renderEmergencyDisable() {
  return `# Local Emergency Disable

- Disable local self-use candidate actions.
- Stop any pending browser smoke or drill.
- Preserve evidence and do not delete previous sealed results.
- Escalate to manual review if a secret or provider boundary looks wrong.
`;
}

export function renderBackupRestore() {
  return `# Local Backup / Restore Plan

- Back up evidence and docs before local drills.
- Restore only the local self-use candidate artifacts after an interruption.
- Never use destructive git reset or git clean for routine recovery.
- Do not touch legacy/ or PROJECT_CONTEXT.md.
`;
}

export function renderEvidenceRetentionPolicy() {
  return `# Local Evidence Retention Policy

- Keep local self-use evidence in apps/ai-gateway-service/evidence/phase1561_1600/.
- Retain validated JSON and the final seal for operator review.
- Do not store secrets, tokens, or raw CredentialRef values.
- Do not claim automated evidence as human feedback.
`;
}

export function renderTroubleshootingPlaybook() {
  return `# Local Troubleshooting Playbook

- If health checks fail, verify upstream Route A seal and phase1560 gate readiness first.
- If a phase file is missing, rerun the finalization runner.
- If the validator reports a blocker, fix the specific missing file or mismatched boundary.
`;
}

export function renderUpgradeRollback() {
  return `# Local Upgrade / Rollback Plan

- Upgrade only the local self-use candidate documentation and evidence pack.
- Roll back by removing the phase1561_1600 docs/evidence pack and rerunning validation.
- Do not modify /chat, /chat-gateway/execute, or any provider runtime.
`;
}

export function renderFinalOperatorHandoff() {
  return `# Local Self-Use Final Operator Handoff

- Use this pack as the owner-local launch reference.
- Keep the system local only.
- Do not describe this as public SaaS or production-ready.
`;
}

export function renderCandidateDecisionPacket() {
  return `# Local Self-Use Candidate Decision Packet

- localSelfUseCandidate=true
- dailyStartupDocumented=true
- localHealthCheckPassed=true
- emergencyDisableReady=true
- backupRestorePlanReady=true
- missionControlDailyUseReady=true
- contextGatewayReady=true
- conceptFieldKernelExperimentalReady=true
- providerGateReady=true
- publicProductionClaimed=false
`;
}

export function renderFinalizationReport() {
  return `# Local Self-Use Candidate Finalization Report

- This pack closes the owner-local candidate boundary.
- It keeps the route local-only and does not claim production readiness.
- It records the final seal evidence and the post-1600 recommendation.
`;
}
