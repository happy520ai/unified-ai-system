import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase331d");
const resultPath = resolve(evidenceDir, "credential-vault-implementation-plan-result.json");
const milestonesPath = resolve(repoRoot, "docs/phase331d-vault-implementation-milestones.json");

const phase330d = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase330d/credential-vault-production-adapter-selection-result.json"), "utf8"));
const productionReady = phase330d.productionReady === true;
const result = {
  phase: "Phase331D",
  selectedAdapter: phase330d.selectedAdapter,
  targetStage: "limited_beta_to_production_readiness_path",
  productionReadyFromPhase330D: productionReady,
  implementationPlanStatus: productionReady ? "ready_for_implementation_planning" : "blocked_by_vault_backend_not_configured",
  blockers: phase330d.blockers || [],
  requiredBeforeImplementation: phase330d.requiredBeforeProduction || [],
  milestones: buildMilestones(),
  testPlan: "validate redaction, access policy, rotation, revoke, guarded real-call gate, and rollback drill before enabling production vault",
  rollbackPlan: "disable vaultReferenceAdapter selection, revert to guarded beta only, and revoke any test credential references",
  adapterImplemented: false,
  secretValueExposed: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(milestonesPath, `${JSON.stringify({ phase: "Phase331D", milestones: result.milestones }, null, 2)}\n`, "utf8");
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(resolve(repoRoot, "docs/phase331d-credential-vault-selected-adapter-implementation-plan.md"), renderPlan(result), "utf8");
await writeFile(resolve(repoRoot, "docs/phase331d-vault-adapter-work-breakdown.md"), renderWorkBreakdown(), "utf8");
await writeFile(resolve(repoRoot, "docs/phase331d-vault-risk-and-migration-plan.md"), renderRiskPlan(), "utf8");
await writeFile(resolve(repoRoot, "docs/phase331d-vault-test-and-validation-plan.md"), renderTestPlan(), "utf8");
await writeFile(resolve(repoRoot, "docs/phase331d-execution-report.md"), renderPlan(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function buildMilestones() {
  return [
    "adapter_interface_freeze",
    "secret_redaction_validation",
    "vault_backend_configuration",
    "access_policy_validation",
    "credential_rotation_test",
    "credential_revoke_test",
    "guarded_real_call_test",
    "limited_beta_enablement",
    "rollback_drill",
    "production_readiness_review",
  ].map((id, index) => ({
    id,
    order: index + 1,
    status: id === "vault_backend_configuration" ? "blocked" : "planned",
  }));
}

function renderPlan(result) {
  return [
    "# Phase331D Credential Vault Selected Adapter Implementation Plan",
    "",
    `- selectedAdapter: ${result.selectedAdapter}`,
    `- targetStage: ${result.targetStage}`,
    `- productionReadyFromPhase330D: ${result.productionReadyFromPhase330D}`,
    `- implementationPlanStatus: ${result.implementationPlanStatus}`,
    `- adapterImplemented: ${result.adapterImplemented}`,
    "",
  ].join("\n");
}

function renderWorkBreakdown() {
  return [
    "# Phase331D Vault Adapter Work Breakdown",
    "",
    "- Freeze adapter contract and error codes.",
    "- Configure real vault backend outside this phase.",
    "- Validate credential ownership, provider scope, mode scope, audit, rotation, and revoke.",
    "",
  ].join("\n");
}

function renderRiskPlan() {
  return [
    "# Phase331D Vault Risk And Migration Plan",
    "",
    "- Risk: no real vault backend configured.",
    "- Migration: keep env/internal test and encrypted reference paths guarded until vaultReferenceAdapter is verified.",
    "- Secret safety: never return raw secret values from adapter calls.",
    "",
  ].join("\n");
}

function renderTestPlan() {
  return [
    "# Phase331D Vault Test And Validation Plan",
    "",
    "- Test redaction metadata only.",
    "- Test unknown reference type denial.",
    "- Test unauthorized provider and mode scope denial.",
    "- Test rotation, revoke, audit retention, and rollback drill before any production readiness claim.",
    "",
  ].join("\n");
}
