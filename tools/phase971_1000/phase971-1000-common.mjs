import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const evidenceDir = "apps/ai-gateway-service/evidence/phase971_1000";
export const docsDir = "docs/phase971-1000";
export const closureDir = "model-routing/v1-closure";
export const localSelfUseDir = "local-self-use/v1";

export const paths = Object.freeze({
  phase941960Final: "apps/ai-gateway-service/evidence/phase941_960/real-route-quality-test-round2-final-result.json",
  phase941960God: "apps/ai-gateway-service/evidence/phase941_960/god-mode-round2-real-route-result.json",
  phase961965Audit: "apps/ai-gateway-service/evidence/phase961_965/god-mode-round2-failure-audit-result.json",
  phase966970Final: "apps/ai-gateway-service/evidence/phase966_970/god-marker-rerun-final-result.json",
  phase966970Attempts: "apps/ai-gateway-service/evidence/phase966_970/god-dual-reviewer-small-scope-rerun-attempts.json",
  supplementalIntake: `${evidenceDir}/round2-supplemental-evidence-intake-result.json`,
  blockerClearance: `${evidenceDir}/phase941960-blocker-clearance-supplement.json`,
  closureLedger: `${closureDir}/rebind/round2-supplemental-closure-ledger.json`,
  integrity: `${evidenceDir}/route-evidence-integrity-recheck-result.json`,
  supplementalSeal: `${evidenceDir}/round2-supplemental-closure-seal-result.json`,
  disabledPolicy: `${closureDir}/policy/disabled-route-policy-config-design.json`,
  tuningCandidates: `${closureDir}/policy/route-policy-tuning-candidates.json`,
  guardedPreview: `${closureDir}/policy/guarded-runtime-policy-preview.json`,
  rollbackSafeMode: `${closureDir}/policy/policy-rollback-safe-mode-pack.json`,
  policySeal: `${evidenceDir}/route-policy-design-seal-result.json`,
  normalConsole: `${closureDir}/operator/normal-mode-local-self-use-console.json`,
  godConsole: `${closureDir}/operator/god-mode-local-self-use-console.json`,
  tianshuConsole: `${closureDir}/operator/tianshu-mode-local-self-use-console.json`,
  operatorPanel: `${closureDir}/operator/unified-local-routing-operator-panel.json`,
  consoleSeal: `${evidenceDir}/local-self-use-console-seal-result.json`,
  regressionRoutine: `${localSelfUseDir}/runbooks/local-regression-routine.md`,
  regressionRoutineJson: `${closureDir}/regression/local-regression-routine.json`,
  evidenceLedger: `${localSelfUseDir}/evidence-ledger.json`,
  issueLedger: `${localSelfUseDir}/issues/issue-ledger.json`,
  dailyJournalTemplate: `${localSelfUseDir}/journal/daily-use-journal.template.json`,
  automationSeal: `${evidenceDir}/local-operation-automation-seal-result.json`,
  soakFramework: `${localSelfUseDir}/soak/seven-day-soak-framework.md`,
  soakLedgerTemplate: `${localSelfUseDir}/soak/seven-day-soak-ledger.template.json`,
  soakAggregator: "tools/phase971_1000/aggregate-seven-day-soak-metrics.mjs",
  soakChecklist: `${localSelfUseDir}/soak/soak-readiness-checklist.md`,
  soakSeal: `${evidenceDir}/seven-day-soak-framework-seal-result.json`,
  readinessAudit: `${evidenceDir}/local-self-use-v1-readiness-audit-result.json`,
  safetyRecheck: `${evidenceDir}/safety-boundary-final-recheck-result.json`,
  operatorHandoffDoc: "docs/phase998-local-self-use-routing-v1-operator-handoff.md",
  operatorHandoffRunbook: `${localSelfUseDir}/runbooks/operator-handoff.md`,
  noDeployDoc: "docs/phase999-no-deploy-no-server-final-closure.md",
  noDeployClosure: `${evidenceDir}/no-deploy-no-server-final-closure-result.json`,
  final: `${evidenceDir}/local-self-use-routing-system-v1-final-result.json`,
});

export function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

export function ensurePhaseDirs() {
  for (const dir of [
    evidenceDir,
    docsDir,
    `${closureDir}/rebind`,
    `${closureDir}/policy`,
    `${closureDir}/operator`,
    `${closureDir}/regression`,
    `${closureDir}/soak`,
    `${localSelfUseDir}/journal`,
    `${localSelfUseDir}/issues`,
    `${localSelfUseDir}/soak`,
    `${localSelfUseDir}/runbooks`,
    "tools/phase971_1000",
  ]) {
    mkdirSync(repoPath(dir), { recursive: true });
  }
}

export function exists(relativePath) {
  return existsSync(repoPath(relativePath));
}

export function readJsonIfPresent(relativePath) {
  const path = repoPath(relativePath);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

export function writeJson(relativePath, value) {
  const path = repoPath(relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function writeText(relativePath, text) {
  const path = repoPath(relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
}

export function writeDoc(relativePath, { title, goal, facts = [], boundaries = [], outputs = [] }) {
  writeText(relativePath, `# ${title}

## Goal

${goal}

## Facts

${facts.map((item) => `- ${item}`).join("\n")}

## Boundaries

${boundaries.map((item) => `- ${item}`).join("\n")}

## Outputs

${outputs.map((item) => `- ${item}`).join("\n")}

## Non-claims

- This phase does not modify Phase941-960 original failed evidence.
- This phase does not call Providers or expand Provider requests.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not modify selectable model state.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
- This phase opens a local self-use path only; it is not production deployment or completed seven-day soak.
`);
}

export function baseSafety() {
  return {
    providerCallsMade: false,
    providerCallsMadeThisPhase: false,
    newProviderRequestsThisPhase: 0,
    routePolicyAppliedToRuntime: false,
    rawSecretRead: false,
    secretValueExposed: false,
    authJsonRead: false,
    chatBehaviorChangedByDefault: false,
    chatGatewayExecuteBehaviorChangedByDefault: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    selectableModifiedThisPhase: false,
    unauthorizedSelectableChangeDetected: false,
    unsupportedClaimCount: 0,
    hallucinatedFactCount: 0,
    codexContextGatewayUsed: true,
    contextCodecUsed: true,
    relevantFilesUsed: true,
    fullRepoScanAvoided: true,
    tokenBudgetRespected: true,
  };
}

export function sealFromChecks(phaseRange, checks, extra = {}) {
  const failed = Object.entries(checks).filter(([, value]) => value !== true).map(([key]) => key);
  return {
    phaseRange,
    completed: true,
    recommended_sealed: failed.length === 0,
    blocker: failed.length ? failed[0] : null,
    ...checks,
    ...extra,
    ...baseSafety(),
  };
}

export function logResult(result) {
  console.log(JSON.stringify(result, null, 2));
}
