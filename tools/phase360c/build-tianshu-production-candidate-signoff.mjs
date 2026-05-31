import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(
  repoRoot,
  "apps/ai-gateway-service/evidence/phase359c/tianshu-final-production-risk-gate-result.json",
);
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase360c");
const resultPath = resolve(evidenceDir, "tianshu-production-candidate-signoff-result.json");
const docPath = resolve(repoRoot, "docs/phase360c-tianshu-production-candidate-signoff.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const blockers = Array.isArray(source.blockers) ? source.blockers : [];
const result = {
  phase: "Phase360C",
  sourcePhase: source.phase,
  signoffGenerated: true,
  deployAuthorized: false,
  releaseAuthorized: false,
  productionGaAuthorized: false,
  humanApprovalRequiredBeforeDeploy: true,
  blockerCount: blockers.length,
  blockers,
  reviewerDecisionRequired: blockers.includes("reviewer_decision_record"),
  activationRemainsBlocked: true,
  policyActivated: false,
  trainingTriggered: false,
  embeddingBatchTriggered: false,
  unauthorizedProviderCalled: false,
  secretValueExposed: false,
  workspaceCleanClaimed: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(
  docPath,
  [
    "# Phase360C Tianshu Production Candidate Signoff",
    "",
    "- signoffGenerated: true",
    "- deployAuthorized: false",
    "- releaseAuthorized: false",
    "- productionGaAuthorized: false",
    `- blockerCount: ${blockers.length}`,
    `- blockers: ${blockers.join(", ") || "none"}`,
    "- policyActivated: false",
    "- trainingTriggered: false",
    "- embeddingBatchTriggered: false",
  ].join("\n"),
  "utf8",
);

console.log(JSON.stringify(result, null, 2));
