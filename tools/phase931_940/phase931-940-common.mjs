import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const evidenceDir = "apps/ai-gateway-service/evidence/phase931_940";
export const docsDir = "docs/phase931-940";
export const qualityAuditDir = "model-routing/quality-audit";
export const tuningPlanDir = "model-routing/tuning-plan";

export const paths = Object.freeze({
  phase916RequiredFinal: "apps/ai-gateway-service/evidence/phase916_930/real-route-quality-test-final-result.json",
  phase916CanonicalFinal: "apps/ai-gateway-service/evidence/phase916_930/phase916-930-final-result.json",
  phase912915Final: "apps/ai-gateway-service/evidence/phase912_915/phase912-915-final-result.json",
  phase901910Final: "apps/ai-gateway-service/evidence/phase901_910/provider-call-authenticity-final-result.json",
  usabilityMatrix: "apps/ai-gateway-service/evidence/phase-313a-model-usability-matrix.json",
  intake: `${evidenceDir}/phase916930-evidence-intake-result.json`,
  authenticity: `${evidenceDir}/authenticity-carry-forward-result.json`,
  scope: `${evidenceDir}/eligible-pool-scope-clarification-result.json`,
  score: `${evidenceDir}/route-quality-score-audit-result.json`,
  mode: `${evidenceDir}/mode-comparison-audit-result.json`,
  fallback: `${evidenceDir}/fallback-reliability-audit-result.json`,
  costLatencyReliability: `${evidenceDir}/cost-latency-reliability-audit-result.json`,
  tuning: `${evidenceDir}/route-policy-tuning-design-pack-result.json`,
  nextPlan: `${evidenceDir}/next-real-route-test-plan-no-execution-result.json`,
  final: `${evidenceDir}/quality-result-audit-final-result.json`,
  qualityAuditLedger: `${qualityAuditDir}/phase931_940-quality-audit-summary.json`,
  tuningPlan: `${tuningPlanDir}/phase931_940-route-policy-tuning-design.json`,
});

export function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

export function ensurePhaseDirs() {
  for (const dir of [evidenceDir, docsDir, qualityAuditDir, tuningPlanDir, "tools/phase931_940"]) {
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

- This phase does not call Providers or add new Provider requests.
- This phase does not modify selectable state.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
- This phase does not claim human review, production traffic, or seven-day soak completion.
`;
  const path = repoPath(`${docsDir}/${fileName}`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
}

export function baseSafety() {
  return {
    providerCallsMadeThisPhase: false,
    newProviderRequestsThisPhase: 0,
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
