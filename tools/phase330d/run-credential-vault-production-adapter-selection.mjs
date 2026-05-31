import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase330d");
const resultPath = resolve(evidenceDir, "credential-vault-production-adapter-selection-result.json");
const matrixPath = resolve(repoRoot, "docs/phase330d-adapter-selection-matrix.json");
const checklistPath = resolve(repoRoot, "docs/phase330d-production-vault-readiness-checklist.md");
const decisionPath = resolve(repoRoot, "docs/phase330d-selected-adapter-decision-record.md");
const rolloutPath = resolve(repoRoot, "docs/phase330d-vault-rollout-and-rollback-plan.md");

const matrix = buildMatrix();
const result = {
  phase: "Phase330D",
  selectedAdapter: "vaultReferenceAdapter",
  selectedForStage: "preferred_production_target_not_configured",
  productionReady: false,
  blockers: ["VAULT_BACKEND_NOT_CONFIGURED", "ROTATION_POLICY_NOT_VERIFIED", "AUDIT_BACKEND_NOT_VERIFIED"],
  requiredBeforeProduction: ["configure real vault backend", "verify access policy", "verify rotation and revoke", "verify audit retention"],
  secretValueExposed: false,
  rawSecretReturned: false,
};
await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(matrixPath, `${JSON.stringify(matrix, null, 2)}\n`, "utf8");
await writeFile(checklistPath, renderChecklist(result), "utf8");
await writeFile(decisionPath, renderDecision(result), "utf8");
await writeFile(rolloutPath, renderRollout(), "utf8");
console.log(JSON.stringify(result, null, 2));

function buildMatrix() {
  return {
    phase: "Phase330D",
    candidates: [
      { adapter: "envCredentialAdapter", secretExposureRisk: "medium", operationalComplexity: "low", auditability: "limited", rotationSupport: "manual", revokeSupport: "manual", perUserOwnership: "weak", providerScopeControl: "medium", environmentPortability: "low", betaReadiness: true, productionReadiness: false },
      { adapter: "encryptedReferenceAdapter", secretExposureRisk: "low_if_service_exists", operationalComplexity: "medium", auditability: "medium", rotationSupport: "requires_policy", revokeSupport: "requires_policy", perUserOwnership: "medium", providerScopeControl: "medium", environmentPortability: "medium", betaReadiness: false, productionReadiness: false },
      { adapter: "vaultReferenceAdapter", secretExposureRisk: "lowest_with_real_vault", operationalComplexity: "high", auditability: "high", rotationSupport: "strong", revokeSupport: "strong", perUserOwnership: "strong", providerScopeControl: "strong", environmentPortability: "high", betaReadiness: false, productionReadiness: false }
    ],
  };
}

function renderChecklist(result) {
  return [
    "# Phase330D Production Vault Readiness Checklist",
    "",
    `- productionReady: ${result.productionReady}`,
    "- real vault backend configured: false",
    "- rotation policy verified: false",
    "- revoke policy verified: false",
    "- audit retention verified: false",
    "",
  ].join("\n");
}

function renderDecision(result) {
  return [
    "# Phase330D Selected Adapter Decision Record",
    "",
    `- selectedAdapter: ${result.selectedAdapter}`,
    `- selectedForStage: ${result.selectedForStage}`,
    `- productionReady: ${result.productionReady}`,
    "- decision: vaultReferenceAdapter remains the preferred production target, but production is blocked until a real vault backend is configured.",
    "",
  ].join("\n");
}

function renderRollout() {
  return [
    "# Phase330D Vault Rollout And Rollback Plan",
    "",
    "- rollout: configure vault backend, verify policy, run adapter integration, run secret safety.",
    "- rollback: disable provider beta, revert adapter selection, keep envCredentialAdapter internal-test only.",
    "",
  ].join("\n");
}
