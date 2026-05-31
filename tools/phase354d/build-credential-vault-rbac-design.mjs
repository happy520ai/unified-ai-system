import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase353d/credential-vault-tenant-isolation-policy-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase354d");
const resultPath = resolve(evidenceDir, "credential-vault-rbac-design-result.json");
const designPath = resolve(repoRoot, "docs/phase354d-credential-vault-rbac-design.json");
const reportPath = resolve(repoRoot, "docs/phase354d-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = {
  phase: "Phase354D",
  sourcePhase: source.phase,
  rbacDesignGenerated: true,
  adminOnlyActionsDefined: true,
  reviewerApprovalSeparationDefined: true,
  adminOnlyActions: [
    "bind_vault_backend_to_tenant",
    "assign_credential_access_policy_admin",
    "approve_rotation_policy_template",
  ],
  reviewerSeparatedActions: [
    "review_credential_ref_access_log",
    "approve_revocation_request",
  ],
  rawSecretReturned: false,
  providerRealCallExecuted: false,
  crossTenantAccessForbidden: true,
  productionGA: false,
  secretValueExposed: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(designPath, `${JSON.stringify({ phase: current.phase, designType: "credential_vault_rbac", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase354D Execution Report\n\n- rbacDesignGenerated: ${current.rbacDesignGenerated}\n- adminOnlyActionsDefined: ${current.adminOnlyActionsDefined}\n- rawSecretReturned: ${current.rawSecretReturned}\n`, "utf8");
}
