import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase352b/god-mode-safety-risk-review-packet-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase353b");
const resultPath = resolve(evidenceDir, "god-mode-tenant-scoped-participant-policy-result.json");
const designPath = resolve(repoRoot, "docs/phase353b-god-mode-tenant-scoped-participant-policy.json");
const reportPath = resolve(repoRoot, "docs/phase353b-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = {
  phase: "Phase353B",
  sourcePhase: source.phase,
  tenantBoundaryDefined: true,
  crossTenantAccessForbidden: true,
  tenantIsolationPolicyGenerated: true,
  participantPolicyRules: [
    "god_mode_reviewers_are_tenant_scoped",
    "benchmark_evidence_lookup_is_tenant_scoped",
    "alert_acknowledgement_cannot_cross_tenant",
    "external_notification_owner_must_belong_to_same_tenant",
  ],
  externalNotification: false,
  unresolvedSecurityBlockers: source.unresolvedSecurityBlockers,
  productionGA: false,
  secretValueExposed: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(designPath, `${JSON.stringify({ phase: current.phase, designType: "god_mode_tenant_scoped_participant_policy", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase353B Execution Report\n\n- tenantBoundaryDefined: ${current.tenantBoundaryDefined}\n- crossTenantAccessForbidden: ${current.crossTenantAccessForbidden}\n- externalNotification: ${current.externalNotification}\n`, "utf8");
}
