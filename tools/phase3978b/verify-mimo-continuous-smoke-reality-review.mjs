import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

async function main() {
  console.log("[Phase3978B] MiMo Continuous Smoke Reality Review Verifier");

  const resultPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase3978b-mimo-continuous-smoke-reality-review/result.json");
  let result;
  try {
    result = JSON.parse(await readFile(resultPath, "utf8"));
  } catch {
    console.error("[Phase3978B] FAIL: result.json not found.");
    process.exit(1);
  }

  let pass = true;
  const checks = [
    { field: "completed", expected: true, actual: result.completed },
    { field: "recommendedSealed", expected: true, actual: result.recommendedSealed },
    { field: "mimoContinuousSmokeReviewed", expected: true, actual: result.mimoContinuousSmokeReviewed },
    { field: "providerStabilityClaimed", expected: false, actual: result.providerStabilityClaimed },
    { field: "productionReadyClaimed", expected: false, actual: result.productionReadyClaimed },
    { field: "multiProviderCommercialReadyClaimed", expected: false, actual: result.multiProviderCommercialReadyClaimed },
    { field: "secretRead", expected: false, actual: result.secretRead },
    { field: "rawSecretPrinted", expected: false, actual: result.rawSecretPrinted },
    { field: "authorizationHeaderPrinted", expected: false, actual: result.authorizationHeaderPrinted },
    { field: "chatModified", expected: false, actual: result.chatModified },
    { field: "chatGatewayExecuteModified", expected: false, actual: result.chatGatewayExecuteModified },
    { field: "deployExecuted", expected: false, actual: result.deployExecuted },
  ];

  for (const c of checks) {
    const ok = c.actual === c.expected;
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}: ${c.field} = ${JSON.stringify(c.actual)} (expected ${JSON.stringify(c.expected)})`);
  }

  console.log(`  INFO: mimoCanBePrimaryValidationProvider = ${result.mimoCanBePrimaryValidationProvider}`);
  console.log(`  INFO: mimoContinuousSmokePassed = ${result.mimoContinuousSmokePassed}`);
  console.log(`  INFO: blocker = ${result.blocker ?? "none"}`);
  if (result.review) {
    console.log(`  INFO: requestAttemptCount = ${result.review.requestAttemptCount}`);
    console.log(`  INFO: successCount = ${result.review.successCount}`);
    console.log(`  INFO: failureCount = ${result.review.failureCount}`);
    console.log(`  INFO: failureRate = ${result.review.failureRate}`);
    console.log(`  INFO: p50LatencyMs = ${result.review.p50LatencyMs}`);
    console.log(`  INFO: p95LatencyMs = ${result.review.p95LatencyMs}`);
    console.log(`  INFO: p99LatencyMs = ${result.review.p99LatencyMs}`);
    console.log(`  INFO: stoppedBy = ${result.review.stoppedBy}`);
  }

  console.log(`[Phase3978B] ${pass ? "PASS" : "FAIL"}: ${pass ? "All checks passed." : "Some checks failed."}`);
  if (!pass) process.exit(1);
}

main().catch((error) => {
  console.error("[Phase3978B] Fatal:", error.message);
  process.exit(1);
});
