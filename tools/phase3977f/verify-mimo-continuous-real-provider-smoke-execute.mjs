import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

async function main() {
  console.log("[Phase3977F] MiMo Continuous Real Smoke Execute Verifier (dual-mode)");

  const resultPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase3977f-mimo-continuous-real-provider-smoke-execute/result.json");
  let result;
  try {
    result = JSON.parse(await readFile(resultPath, "utf8"));
  } catch {
    console.error("[Phase3977F] FAIL: result.json not found.");
    process.exit(1);
  }

  const isBlocked = result.blocker !== null || result.continuousRealSmokeExecuted === false || result.providerCallsMade === false;
  const isExecuted = result.continuousRealSmokeExecuted === true && result.providerCallsMade === true;

  let pass = true;

  if (isBlocked) {
    console.log("[Phase3977F] Mode: BLOCKED");
    const checks = [
      { field: "completed", expected: true, actual: result.completed },
      { field: "recommendedSealed", expected: true, actual: result.recommendedSealed },
      { field: "continuousRealSmokeExecuted", expected: false, actual: result.continuousRealSmokeExecuted },
      { field: "providerCallsMade", expected: false, actual: result.providerCallsMade },
      { field: "rawSecretRead", expected: false, actual: result.rawSecretRead },
      { field: "secretValuePrinted", expected: false, actual: result.secretValuePrinted },
      { field: "authorizationHeaderPrinted", expected: false, actual: result.authorizationHeaderPrinted },
      { field: "chatModified", expected: false, actual: result.chatModified },
      { field: "chatGatewayExecuteModified", expected: false, actual: result.chatGatewayExecuteModified },
      { field: "deployExecuted", expected: false, actual: result.deployExecuted },
      { field: "productionReadyClaimed", expected: false, actual: result.productionReadyClaimed },
      { field: "providerStabilityClaimed", expected: false, actual: result.providerStabilityClaimed },
    ];
    for (const c of checks) {
      const ok = c.actual === c.expected;
      if (!ok) pass = false;
      console.log(`  ${ok ? "PASS" : "FAIL"}: ${c.field} = ${JSON.stringify(c.actual)} (expected ${JSON.stringify(c.expected)})`);
    }
    console.log(`  INFO: blocker = ${result.blocker}`);
  } else {
    console.log("[Phase3977F] Mode: EXECUTED");
    const checks = [
      { field: "completed", expected: true, actual: result.completed },
      { field: "recommendedSealed", expected: true, actual: result.recommendedSealed },
      { field: "blocker", expected: null, actual: result.blocker },
      { field: "continuousRealSmokeExecuted", expected: true, actual: result.continuousRealSmokeExecuted },
      { field: "providerCallsMade", expected: true, actual: result.providerCallsMade },
      { field: "credentialRefOnly", expected: true, actual: result.credentialRefOnly },
      { field: "credentialRefReady", expected: true, actual: result.credentialRefReady },
      { field: "safeExecutorReady", expected: true, actual: result.safeExecutorReady },
      { field: "rawSecretRead", expected: false, actual: result.rawSecretRead },
      { field: "secretValuePrinted", expected: false, actual: result.secretValuePrinted },
      { field: "authorizationHeaderPrinted", expected: false, actual: result.authorizationHeaderPrinted },
      { field: "chatModified", expected: false, actual: result.chatModified },
      { field: "chatGatewayExecuteModified", expected: false, actual: result.chatGatewayExecuteModified },
      { field: "deployExecuted", expected: false, actual: result.deployExecuted },
      { field: "productionReadyClaimed", expected: false, actual: result.productionReadyClaimed },
      { field: "providerStabilityClaimed", expected: false, actual: result.providerStabilityClaimed },
      { field: "multiProviderCommercialReadyClaimed", expected: false, actual: result.multiProviderCommercialReadyClaimed },
    ];
    for (const c of checks) {
      const ok = c.actual === c.expected;
      if (!ok) pass = false;
      console.log(`  ${ok ? "PASS" : "FAIL"}: ${c.field} = ${JSON.stringify(c.actual)} (expected ${JSON.stringify(c.expected)})`);
    }
    console.log(`  INFO: requestAttemptCount = ${result.requestAttemptCount}`);
    console.log(`  INFO: successCount = ${result.successCount}`);
    console.log(`  INFO: failureCount = ${result.failureCount}`);
    console.log(`  INFO: p50LatencyMs = ${result.p50LatencyMs}`);
    console.log(`  INFO: p95LatencyMs = ${result.p95LatencyMs}`);
    console.log(`  INFO: p99LatencyMs = ${result.p99LatencyMs}`);
    console.log(`  INFO: estimatedTotalTokens = ${result.estimatedTotalTokens}`);
    console.log(`  INFO: stoppedBy = ${result.stoppedBy}`);
    console.log(`  INFO: mimoContinuousSmokePassed = ${result.mimoContinuousSmokePassed}`);
    console.log(`  INFO: mimoCandidatePrimaryValidationProvider = ${result.mimoCandidatePrimaryValidationProvider}`);
  }

  console.log(`[Phase3977F] ${pass ? "PASS" : "FAIL"}: ${pass ? "All checks passed." : "Some checks failed."}`);
  if (!pass) process.exit(1);
}

main().catch((error) => {
  console.error("[Phase3977F] Fatal:", error.message);
  process.exit(1);
});
