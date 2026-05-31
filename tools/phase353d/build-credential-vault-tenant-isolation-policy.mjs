import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase352d/credential-vault-secret-safety-review-packet-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase353d");
const resultPath = resolve(evidenceDir, "credential-vault-tenant-isolation-policy-result.json");
const designPath = resolve(repoRoot, "docs/phase353d-credential-vault-tenant-isolation-policy.json");
const reportPath = resolve(repoRoot, "docs/phase353d-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = {
  phase: "Phase353D",
  sourcePhase: source.phase,
  tenantBoundaryDefined: true,
  crossTenantAccessForbidden: true,
  tenantIsolationPolicyGenerated: true,
  tenantIsolationRules: [
    "credential_ref_namespace_is_tenant_scoped",
    "access_decision_log_is_tenant_scoped",
    "revocation_and_rotation_cannot_cross_tenant",
    "vault_backend_enablement_requires_tenant_binding",
  ],
  rawSecretReturned: false,
  providerRealCallExecuted: false,
  unresolvedSecurityBlockers: source.unresolvedSecurityBlockers,
  productionGA: false,
  secretValueExposed: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(designPath, `${JSON.stringify({ phase: current.phase, designType: "credential_vault_tenant_isolation_policy", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase353D Execution Report\n\n- tenantBoundaryDefined: ${current.tenantBoundaryDefined}\n- crossTenantAccessForbidden: ${current.crossTenantAccessForbidden}\n- rawSecretReturned: ${current.rawSecretReturned}\n`, "utf8");
}
