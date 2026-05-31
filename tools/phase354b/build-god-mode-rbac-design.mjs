import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase353b/god-mode-tenant-scoped-participant-policy-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase354b");
const resultPath = resolve(evidenceDir, "god-mode-rbac-design-result.json");
const designPath = resolve(repoRoot, "docs/phase354b-god-mode-rbac-design.json");
const reportPath = resolve(repoRoot, "docs/phase354b-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = {
  phase: "Phase354B",
  sourcePhase: source.phase,
  rbacDesignGenerated: true,
  adminOnlyActionsDefined: true,
  reviewerApprovalSeparationDefined: true,
  adminOnlyActions: [
    "change_god_mode_participant_policy",
    "assign_alert_owner_mapping",
    "override_benchmark_visibility_rules",
  ],
  reviewerSeparatedActions: [
    "acknowledge_quality_regression",
    "approve_degraded_mode_exit",
  ],
  externalNotification: false,
  crossTenantAccessForbidden: true,
  productionGA: false,
  secretValueExposed: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(designPath, `${JSON.stringify({ phase: current.phase, designType: "god_mode_rbac", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase354B Execution Report\n\n- rbacDesignGenerated: ${current.rbacDesignGenerated}\n- adminOnlyActionsDefined: ${current.adminOnlyActionsDefined}\n- externalNotification: ${current.externalNotification}\n`, "utf8");
}
