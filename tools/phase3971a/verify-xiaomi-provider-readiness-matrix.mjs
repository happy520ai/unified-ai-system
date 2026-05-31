import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

async function main() {
  console.log("[Phase3971A] Xiaomi Provider Readiness Matrix Verifier");

  const resultPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-3971a-xiaomi-provider-readiness-matrix/result.json");
  let result;
  try {
    result = JSON.parse(await readFile(resultPath, "utf8"));
  } catch {
    console.error("[Phase3971A] FAIL: result.json not found. Run generate first.");
    process.exit(1);
  }

  const checks = [
    { field: "completed", expected: true, actual: result.completed },
    { field: "recommendedSealed", expected: true, actual: result.recommendedSealed },
    { field: "xiaomiProviderReadinessChecked", expected: true, actual: result.xiaomiProviderReadinessChecked },
    { field: "providerCallsMade", expected: false, actual: result.providerCallsMade },
    { field: "secretRead", expected: false, actual: result.secretRead },
    { field: "rawSecretPrinted", expected: false, actual: result.rawSecretPrinted },
    { field: "chatModified", expected: false, actual: result.chatModified },
    { field: "chatGatewayExecuteModified", expected: false, actual: result.chatGatewayExecuteModified },
    { field: "deployExecuted", expected: false, actual: result.deployExecuted },
    { field: "productionReadyClaimed", expected: false, actual: result.productionReadyClaimed },
  ];

  let pass = true;
  for (const check of checks) {
    const ok = check.actual === check.expected;
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}: ${check.field} = ${JSON.stringify(check.actual)} (expected ${JSON.stringify(check.expected)})`);
  }

  if (!result.matrix) {
    console.error("[Phase3971A] FAIL: matrix field missing from result.json");
    pass = false;
  } else {
    console.log(`  INFO: providerId = ${result.matrix.providerId}`);
    console.log(`  INFO: adapterExists = ${result.matrix.adapterExists}`);
    console.log(`  INFO: modelRegistryExists = ${result.matrix.modelRegistryExists}`);
    console.log(`  INFO: credentialRefNameExists = ${result.matrix.credentialRefNameExists}`);
    console.log(`  INFO: smokeRunnerExists = ${result.matrix.smokeRunnerExists}`);
    console.log(`  INFO: selectableNow = ${result.matrix.selectableNow}`);
    console.log(`  INFO: realProviderCallAllowedNow = ${result.matrix.realProviderCallAllowedNow}`);
    console.log(`  INFO: blockers = ${result.matrix.blockers?.join(", ") ?? "none"}`);
  }

  if (pass) {
    console.log("[Phase3971A] PASS: All checks passed.");
  } else {
    console.log("[Phase3971A] FAIL: Some checks failed.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[Phase3971A] Fatal:", error.message);
  process.exit(1);
});
