import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(
  repoRoot,
  "apps/ai-gateway-service/evidence/phase359b/god-mode-final-production-risk-gate-result.json",
);
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase360b");
const resultPath = resolve(evidenceDir, "god-mode-production-candidate-signoff-result.json");
const docPath = resolve(repoRoot, "docs/phase360b-god-mode-production-candidate-signoff.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const blockers = Array.isArray(source.blockers) ? source.blockers : [];
const result = {
  phase: "Phase360B",
  sourcePhase: source.phase,
  signoffGenerated: true,
  deployAuthorized: false,
  releaseAuthorized: false,
  productionGaAuthorized: false,
  humanApprovalRequiredBeforeDeploy: true,
  blockerCount: blockers.length,
  blockers,
  benchmarkEvidenceRequired: blockers.includes("benchmarkEvidenceRef"),
  reviewerQualitySignoffRequired: blockers.includes("reviewer_quality_signoff"),
  externalNotificationEnabled: false,
  unauthorizedProviderCalled: false,
  secretValueExposed: false,
  workspaceCleanClaimed: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(
  docPath,
  [
    "# Phase360B God Mode Production Candidate Signoff",
    "",
    "- signoffGenerated: true",
    "- deployAuthorized: false",
    "- releaseAuthorized: false",
    "- productionGaAuthorized: false",
    `- blockerCount: ${blockers.length}`,
    `- blockers: ${blockers.join(", ") || "none"}`,
    "- externalNotificationEnabled: false",
  ].join("\n"),
  "utf8",
);

console.log(JSON.stringify(result, null, 2));
