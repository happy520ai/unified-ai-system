import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

async function main() {
  console.log("[Phase3975A] Xiaomi Stability Micro-Batch Smoke Verifier (dual-mode)");

  const resultPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-3975a-xiaomi-stability-micro-batch-smoke/result.json");
  let result;
  try {
    result = JSON.parse(await readFile(resultPath, "utf8"));
  } catch {
    console.error("[Phase3975A] FAIL: result.json not found.");
    process.exit(1);
  }

  const isBlocked =
    result.blocker !== null ||
    result.microBatchExecuted === false ||
    result.providerCallsMade === false;

  const isExecuted =
    result.microBatchExecuted === true &&
    result.providerCallsMade === true;

  if (!isBlocked && !isExecuted) {
    console.error("[Phase3975A] FAIL: Result is neither blocked nor executed.");
    process.exit(1);
  }

  let pass = true;

  if (isBlocked) {
    console.log("[Phase3975A] Mode: BLOCKED");
    const blockedChecks = [
      { field: "completed", expected: true, actual: result.completed },
      { field: "recommendedSealed", expected: true, actual: result.recommendedSealed },
      { field: "microBatchExecuted", expected: false, actual: result.microBatchExecuted },
      { field: "providerCallsMade", expected: false, actual: result.providerCallsMade },
      { field: "rawSecretRead", expected: false, actual: result.rawSecretRead ?? result.secretRead },
      { field: "rawSecretPrinted", expected: false, actual: result.rawSecretPrinted ?? result.secretValuePrinted },
      { field: "providerStabilityClaimed", expected: false, actual: result.providerStabilityClaimed },
      { field: "productionReadyClaimed", expected: false, actual: result.productionReadyClaimed },
      { field: "deployExecuted", expected: false, actual: result.deployExecuted },
    ];

    for (const check of blockedChecks) {
      const ok = check.actual === check.expected;
      if (!ok) pass = false;
      console.log(`  ${ok ? "PASS" : "FAIL"}: ${check.field} = ${JSON.stringify(check.actual)} (expected ${JSON.stringify(check.expected)})`);
    }

    console.log(`  INFO: blocker = ${result.blocker ?? "none"}`);
    console.log(`  INFO: microBatchPlanPrepared = ${result.microBatchPlanPrepared}`);

  } else {
    console.log("[Phase3975A] Mode: EXECUTED");
    const executedChecks = [
      { field: "completed", expected: true, actual: result.completed },
      { field: "recommendedSealed", expected: true, actual: result.recommendedSealed },
      { field: "blocker", expected: null, actual: result.blocker },
      { field: "microBatchExecuted", expected: true, actual: result.microBatchExecuted },
      { field: "providerCallsMade", expected: true, actual: result.providerCallsMade },
      { field: "credentialRefOnly", expected: true, actual: result.credentialRefOnly },
      { field: "rawSecretRead", expected: false, actual: result.rawSecretRead },
      { field: "secretValuePrinted", expected: false, actual: result.secretValuePrinted },
      { field: "authorizationHeaderPrinted", expected: false, actual: result.authorizationHeaderPrinted },
      { field: "providerStabilityClaimed", expected: false, actual: result.providerStabilityClaimed },
      { field: "productionReadyClaimed", expected: false, actual: result.productionReadyClaimed },
      { field: "deployExecuted", expected: false, actual: result.deployExecuted },
    ];

    for (const check of executedChecks) {
      const ok = check.actual === check.expected;
      if (!ok) pass = false;
      console.log(`  ${ok ? "PASS" : "FAIL"}: ${check.field} = ${JSON.stringify(check.actual)} (expected ${JSON.stringify(check.expected)})`);
    }

    console.log(`  INFO: requestAttemptCount = ${result.requestAttemptCount}`);
    console.log(`  INFO: successCount = ${result.successCount}`);
    console.log(`  INFO: failureCount = ${result.failureCount}`);
    console.log(`  INFO: p95LatencyMs = ${result.p95LatencyMs}`);
    console.log(`  INFO: xiaomiMicroBatchSmokePassed = ${result.xiaomiMicroBatchSmokePassed}`);
  }

  if (pass) {
    console.log("[Phase3975A] PASS: All checks passed.");
  } else {
    console.log("[Phase3975A] FAIL: Some checks failed.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[Phase3975A] Fatal:", error.message);
  process.exit(1);
});
