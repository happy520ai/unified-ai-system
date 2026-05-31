import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(
  repoRoot,
  "apps/ai-gateway-service/evidence/phase359d/credential-vault-final-production-risk-gate-result.json",
);
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase360d");
const resultPath = resolve(evidenceDir, "credential-vault-production-candidate-signoff-result.json");
const docPath = resolve(repoRoot, "docs/phase360d-credential-vault-production-candidate-signoff.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const blockers = Array.isArray(source.blockers) ? source.blockers : [];
const result = {
  phase: "Phase360D",
  sourcePhase: source.phase,
  signoffGenerated: true,
  deployAuthorized: false,
  releaseAuthorized: false,
  productionGaAuthorized: false,
  humanApprovalRequiredBeforeDeploy: true,
  blockerCount: blockers.length,
  blockers,
  credentialRefRequired: blockers.includes("credentialRef"),
  accessDecisionRequired: blockers.includes("accessDecision"),
  vaultBackendApprovalRequired: blockers.includes("vault_backend_approval_record"),
  realVaultConnected: false,
  rawSecretReturned: false,
  unauthorizedProviderCalled: false,
  providerRealCallExecuted: false,
  secretValueExposed: false,
  workspaceCleanClaimed: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(
  docPath,
  [
    "# Phase360D Credential Vault Production Candidate Signoff",
    "",
    "- signoffGenerated: true",
    "- deployAuthorized: false",
    "- releaseAuthorized: false",
    "- productionGaAuthorized: false",
    `- blockerCount: ${blockers.length}`,
    `- blockers: ${blockers.join(", ") || "none"}`,
    "- realVaultConnected: false",
    "- providerRealCallExecuted: false",
    "- rawSecretReturned: false",
  ].join("\n"),
  "utf8",
);

console.log(JSON.stringify(result, null, 2));
