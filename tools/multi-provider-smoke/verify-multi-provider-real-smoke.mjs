import { existsSync, readFileSync } from "node:fs";

const resultPath = "apps/ai-gateway-service/evidence/multi-provider-smoke/result.json";

function verify() {
  if (!existsSync(resultPath)) {
    console.error("[FAIL] Multi-provider smoke evidence not found.");
    console.error("Run `pnpm run:multi-provider-smoke` first.");
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(resultPath, "utf-8"));

  const checks = [
    ["smoke_executed", data.phase === "MultiProviderRealSmoke"],
    ["providers_checked", data.summary.providersChecked > 0],
    ["models_tested", data.summary.modelsTested > 0],
    ["has_pass_rate", typeof data.summary.passRate === "number"],
    ["multi_tenant_enabled", data.multiTenant.enabled === true],
    ["enterprise_audit_enabled", data.enterpriseSecurity.auditLogEnabled === true],
    ["workforce_activated", data.workforceActivation.enabled === true],
    ["gvc_activated", data.gvcActivation.enabled === true],
    ["three_mode_normal", data.threeModeActivation.normal === true],
    ["three_mode_god", data.threeModeActivation.god === true],
    ["three_mode_tianshu", data.threeModeActivation.tianshu === true],
    ["no_secrets_leaked", data.safety.rawSecretPrinted === false],
    ["no_deploy", data.safety.deployExecuted === false],
  ];

  let allPassed = true;
  for (const [name, passed] of checks) {
    const status = passed ? "PASS" : "FAIL";
    console.log(`  ${status}: ${name}`);
    if (!passed) allPassed = false;
  }

  console.log("");
  console.log(`[RESULT] ${allPassed ? "PASS" : "FAIL"}`);
  console.log(`  Providers Active: ${data.summary.providersActive}/${data.summary.providersChecked}`);
  console.log(`  Models Passed: ${data.summary.modelsPassed}/${data.summary.modelsTested}`);
  console.log(`  Pass Rate: ${data.summary.passRate}%`);
  console.log(`  Multi-Tenant: ${data.multiTenant.enabled ? "Enabled" : "Disabled"}`);
  console.log(`  Enterprise Audit: ${data.enterpriseSecurity.auditLogEnabled ? "On" : "Off"}`);
  console.log(`  Workforce: ${data.workforceActivation.enabled ? "Active" : "Inactive"}`);
  console.log(`  GVC: ${data.gvcActivation.enabled ? "Active" : "Inactive"}`);
  console.log(`  Three-Mode: Normal=${data.threeModeActivation.normal}, God=${data.threeModeActivation.god}, Tianshu=${data.threeModeActivation.tianshu}`);

  process.exit(allPassed ? 0 : 1);
}

verify();
