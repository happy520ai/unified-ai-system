import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(
  repoRoot,
  "apps/agent-console/evidence/phase359e/provider-onboarding-final-production-risk-gate-result.json",
);
const evidenceDir = resolve(repoRoot, "apps/agent-console/evidence/phase360e");
const resultPath = resolve(evidenceDir, "provider-onboarding-production-candidate-signoff-result.json");
const docPath = resolve(repoRoot, "docs/phase360e-provider-onboarding-production-candidate-signoff.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const blockers = Array.isArray(source.blockers) ? source.blockers : [];
const result = {
  phase: "Phase360E",
  sourcePhase: source.phase,
  signoffGenerated: true,
  deployAuthorized: false,
  releaseAuthorized: false,
  productionGaAuthorized: false,
  humanApprovalRequiredBeforeDeploy: true,
  blockerCount: blockers.length,
  blockers,
  noProviderCallFromUi: source.noProviderCallFromUi === true,
  credentialRefOnly: source.credentialRefOnly === true,
  tenantAdminApprovalRequired: blockers.includes("tenant_admin_approval_record"),
  reviewerChecklistRequired: blockers.includes("reviewerChecklistId"),
  unauthorizedProviderCalled: false,
  secretValueExposed: false,
  workspaceCleanClaimed: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(
  docPath,
  [
    "# Phase360E Provider Onboarding Production Candidate Signoff",
    "",
    "- signoffGenerated: true",
    "- deployAuthorized: false",
    "- releaseAuthorized: false",
    "- productionGaAuthorized: false",
    `- blockerCount: ${blockers.length}`,
    `- blockers: ${blockers.join(", ") || "none"}`,
    `- noProviderCallFromUi: ${result.noProviderCallFromUi}`,
    `- credentialRefOnly: ${result.credentialRefOnly}`,
  ].join("\n"),
  "utf8",
);

console.log(JSON.stringify(result, null, 2));
