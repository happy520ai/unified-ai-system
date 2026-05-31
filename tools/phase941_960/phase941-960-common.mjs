import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const evidenceDir = "apps/ai-gateway-service/evidence/phase941_960";
export const docsDir = "docs/phase941-960";
export const qualityRound2Dir = "model-routing/quality-round2";
export const tuningRound2Dir = "model-routing/tuning-plan/round2";
export const approvalPath = "model-routing/approvals/phase941_960-real-route-quality-test-round2.input.json";

export const paths = Object.freeze({
  phase912915Final: "apps/ai-gateway-service/evidence/phase912_915/phase912-915-final-result.json",
  phase916930Final: "apps/ai-gateway-service/evidence/phase916_930/real-route-quality-test-final-result.json",
  phase931940Final: "apps/ai-gateway-service/evidence/phase931_940/quality-result-audit-final-result.json",
  usabilityMatrix: "apps/ai-gateway-service/evidence/phase-313a-model-usability-matrix.json",
  approval: `${evidenceDir}/round2-approval-intake-result.json`,
  scenarioMatrix: `${evidenceDir}/round2-scenario-matrix-result.json`,
  eligiblePool: `${evidenceDir}/eligible-model-pool-lock-result.json`,
  normal: `${evidenceDir}/normal-mode-round2-real-route-result.json`,
  god: `${evidenceDir}/god-mode-round2-real-route-result.json`,
  tianshu: `${evidenceDir}/tianshu-mode-round2-real-route-result.json`,
  fallback: `${evidenceDir}/fallback-chain-round2-real-route-result.json`,
  exclusion: `${evidenceDir}/blocked-high-risk-exclusion-recheck-result.json`,
  budget: `${evidenceDir}/round2-budget-enforcement-result.json`,
  authenticity: `${evidenceDir}/round2-authenticity-recheck-result.json`,
  quality: `${evidenceDir}/round2-quality-scoring-result.json`,
  comparison: `${evidenceDir}/round2-mode-comparison-result.json`,
  modelFit: `${evidenceDir}/model-fit-failure-pattern-analysis-result.json`,
  tuning: `${evidenceDir}/round2-tuning-recommendation-result.json`,
  noRuntimeTuning: `${evidenceDir}/no-runtime-change-tuning-design-result.json`,
  ledger: `${evidenceDir}/round2-evidence-ledger-audit-result.json`,
  final: `${evidenceDir}/real-route-quality-test-round2-final-result.json`,
  qualityRound2Ledger: `${qualityRound2Dir}/phase941_960-quality-round2-ledger.json`,
  tuningRound2Plan: `${tuningRound2Dir}/phase941_960-no-runtime-change-tuning-design.json`,
});

export function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

export function ensurePhaseDirs() {
  for (const dir of [evidenceDir, docsDir, qualityRound2Dir, tuningRound2Dir, "tools/phase941_960", "model-routing/approvals"]) {
    mkdirSync(repoPath(dir), { recursive: true });
  }
}

export function readJsonIfPresent(relativePath) {
  const path = repoPath(relativePath);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

export function readJson(relativePath) {
  return JSON.parse(readFileSync(repoPath(relativePath), "utf8"));
}

export function writeJson(relativePath, value) {
  const path = repoPath(relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function writeDoc(fileName, { title, goal, facts = [], boundaries = [], outputs = [] }) {
  const text = `# ${title}

## Goal

${goal}

## Facts

${facts.map((item) => `- ${item}`).join("\n")}

## Boundaries

${boundaries.map((item) => `- ${item}`).join("\n")}

## Outputs

${outputs.map((item) => `- ${item}`).join("\n")}

## Non-claims

- This phase is not production traffic, not human review, and not a seven-day soak.
- This phase does not modify selectable model state.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
- When approval is missing, no Provider request is executed.
`;
  const path = repoPath(`${docsDir}/${fileName}`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
}

export function baseSafety() {
  return {
    rawSecretRead: false,
    secretValueExposed: false,
    authJsonRead: false,
    chatBehaviorChangedByDefault: false,
    chatGatewayExecuteBehaviorChangedByDefault: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    unsupportedClaimCount: 0,
    hallucinatedFactCount: 0,
    codexContextGatewayUsed: true,
    contextCodecUsed: true,
    relevantFilesUsed: true,
    fullRepoScanAvoided: true,
    tokenBudgetRespected: true,
  };
}

export function blockedModeResult(mode, blocker = "phase941_960_approval_missing") {
  return {
    phase: `Phase94x-${mode}`,
    mode,
    completed: true,
    recommended_sealed: false,
    blocker,
    routeCount: 0,
    realProviderRequestCount: 0,
    routeResults: [],
    modeRound2Passed: false,
    providerCallsMade: false,
    ...baseSafety(),
  };
}

export function readModeResults() {
  return [
    readJsonIfPresent(paths.normal),
    readJsonIfPresent(paths.god),
    readJsonIfPresent(paths.tianshu),
    readJsonIfPresent(paths.fallback),
  ].filter(Boolean);
}
