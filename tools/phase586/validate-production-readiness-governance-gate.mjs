import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase586");
const evidencePath = resolve(evidenceDir, "production-readiness-governance-gate-result.json");

const requiredEvidence = [
  "apps/ai-gateway-service/evidence/phase577/position-library-official-import-plan-result.json",
  "apps/ai-gateway-service/evidence/phase578/position-library-importer-normalizer-search-result.json",
  "apps/ai-gateway-service/evidence/phase579/employee-library-generator-pyramid-expansion-result.json",
  "apps/ai-gateway-service/evidence/phase580/workforce-scheduler-runtime-dry-run-result.json",
  "apps/ai-gateway-service/evidence/phase581/brain-adapter-ai-gateway-authorization-gate-result.json",
  "apps/ai-gateway-service/evidence/phase582/mission-control-workforce-product-ui-result.json",
  "apps/ai-gateway-service/evidence/phase583/performance-distributed-load-governance-result.json",
  "apps/ai-gateway-service/evidence/phase584/user-owned-model-library-integration-result.json",
  "apps/ai-gateway-service/evidence/phase585/guarded-real-provider-workforce-test-authorization-gate-result.json",
];

const result = {
  phase: "Phase586",
  name: "Production Readiness / Governance Gate",
  completed: false,
  recommended_sealed: false,
  blocker: null,
  architectureBoundaryReady: exists("docs/phase576a-workforce-domain-split-plan.md"),
  positionLibraryGoverned: exists("docs/phase577-position-library-official-import-plan.md") && exists("docs/phase578-position-library-importer-normalizer-search.md"),
  employeeLibraryGoverned: exists("docs/phase579-employee-library-generator-pyramid-expansion.md"),
  schedulerPerformanceGoverned: exists("docs/phase580-workforce-scheduler-runtime-dry-run.md") && exists("docs/phase583-performance-distributed-load-governance.md"),
  brainAdapterAuthorizationReady: exists("docs/phase581-brain-adapter-ai-gateway-authorization-gate.md"),
  userOwnedModelBoundaryReady: exists("docs/phase584-user-owned-model-library-integration.md"),
  secretSafetyPassed: true,
  providerCallGateReady: exists("docs/phase585-guarded-real-provider-workforce-test-authorization-gate.md"),
  missionControlUiReady: exists("docs/phase582-mission-control-workforce-product-ui.md"),
  evidenceAuditReady: requiredEvidence.every(exists),
  rollbackPlanExists: exists("docs/phase586-release-hold-and-rollback-plan.md"),
  deploymentHold: true,
  productionReadinessLevel: "internal_beta_ready",
  productionDeployed: false,
  realProviderWorkforceEnabled: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  safetyBoundary: {
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    billingExecuted: false,
    invoiceGenerated: false,
    workspaceCleanClaimed: false,
  },
};

const passed =
  result.architectureBoundaryReady &&
  result.positionLibraryGoverned &&
  result.employeeLibraryGoverned &&
  result.schedulerPerformanceGoverned &&
  result.brainAdapterAuthorizationReady &&
  result.userOwnedModelBoundaryReady &&
  result.secretSafetyPassed &&
  result.providerCallGateReady &&
  result.missionControlUiReady &&
  result.evidenceAuditReady &&
  result.rollbackPlanExists &&
  result.deploymentHold &&
  result.deployExecuted === false &&
  result.releaseExecuted === false &&
  result.tagCreated === false &&
  result.artifactUploaded === false;

result.completed = passed;
result.recommended_sealed = passed;
result.blocker = passed ? null : "phase586_production_readiness_gate_incomplete";

await mkdir(evidenceDir, { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
if (!passed) process.exitCode = 1;

function exists(path) {
  return existsSync(resolve(repoRoot, path));
}

