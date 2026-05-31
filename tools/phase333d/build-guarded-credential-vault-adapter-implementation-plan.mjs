import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase333d");
const resultPath = resolve(evidenceDir, "guarded-credential-vault-adapter-implementation-plan-result.json");
const milestonesPath = resolve(repoRoot, "docs/phase333d-guarded-adapter-milestones.json");
const acceptancePath = resolve(repoRoot, "docs/phase333d-guarded-adapter-acceptance-criteria.json");
const spike = await readJson("apps/ai-gateway-service/evidence/phase332d/credential-vault-adapter-spike-result.json");
const blockers = [...(spike.productionReady ? [] : ["VAULT_BACKEND_NOT_CONFIGURED"]), ...(spike.blocked > 0 ? ["SPIKE_HAS_BLOCKED_CASES"] : [])];
const result = {
  phase: "Phase333D",
  implementationPlanGenerated: true,
  guardedImplementationAllowed: blockers.length === 0,
  productionReady: false,
  selectedAdapter: spike.selectedAdapter,
  spikeStatus: spike.spikeStatus,
  blockers,
  acceptedSpikeFindings: spike.findings || [],
  guardedImplementationScope: ["metadata-only resolution", "redaction guard", "scope policy tests", "audit event validation"],
  nonGoals: ["production vault enablement", "raw secret return", "unguarded provider calls"],
  milestones: buildMilestones(),
  acceptanceCriteria: buildAcceptanceCriteria(),
  nextSteps: spike.nextImplementationSteps || [],
  secretValueExposed: false,
  rawSecretReturned: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(milestonesPath, `${JSON.stringify({ phase: "Phase333D", milestones: result.milestones }, null, 2)}\n`, "utf8");
await writeFile(acceptancePath, `${JSON.stringify(result.acceptanceCriteria, null, 2)}\n`, "utf8");
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(resolve(repoRoot, "docs/phase333d-guarded-vault-adapter-implementation-plan.md"), renderPlan(result), "utf8");
await writeFile(resolve(repoRoot, "docs/phase333d-guarded-adapter-test-plan.md"), renderTestPlan(), "utf8");
await writeFile(resolve(repoRoot, "docs/phase333d-guarded-adapter-risk-register.md"), renderRiskRegister(), "utf8");
await writeFile(resolve(repoRoot, "docs/phase333d-execution-report.md"), renderPlan(result), "utf8");
console.log(JSON.stringify(result, null, 2));

async function readJson(path) {
  return JSON.parse(await readFile(resolve(repoRoot, path), "utf8"));
}

function buildMilestones() {
  return [
    "adapter_contract_freeze",
    "redaction_guard_tests",
    "credential_scope_policy_tests",
    "env_adapter_internal_test",
    "encrypted_reference_adapter_spike",
    "vault_reference_adapter_spike",
    "guarded_real_call_integration_test",
    "revoke_rotation_test",
    "audit_event_validation",
    "rollback_drill",
  ].map((id, index) => ({ id, order: index + 1, status: id.includes("vault") ? "gated" : "planned" }));
}

function buildAcceptanceCriteria() {
  return {
    phase: "Phase333D",
    secretValueExposed: false,
    rawSecretReturned: false,
    unauthorizedScopeRejected: true,
    revokedCredentialRejected: true,
    unsupportedReferenceTypeRejected: true,
    redactionAlwaysApplied: true,
    auditEventRecorded: true,
    rollbackDocumented: true,
  };
}

function renderPlan(result) {
  return [
    "# Phase333D Guarded Vault Adapter Implementation Plan",
    "",
    `- selectedAdapter: ${result.selectedAdapter}`,
    `- guardedImplementationAllowed: ${result.guardedImplementationAllowed}`,
    `- productionReady: ${result.productionReady}`,
    `- blockers: ${result.blockers.join(", ") || "none"}`,
    "",
  ].join("\n");
}

function renderTestPlan() {
  return [
    "# Phase333D Guarded Adapter Test Plan",
    "",
    "- Validate redaction guard tests.",
    "- Validate credential scope policy tests.",
    "- Validate revoke and rotation behavior before any guarded real-call test.",
    "- Record audit events without secret values.",
    "",
  ].join("\n");
}

function renderRiskRegister() {
  return [
    "# Phase333D Guarded Adapter Risk Register",
    "",
    "- Real vault backend remains unconfigured.",
    "- Guarded implementation must remain blocked until revoke and rotation tests exist.",
    "- Production readiness remains false.",
    "",
  ].join("\n");
}
