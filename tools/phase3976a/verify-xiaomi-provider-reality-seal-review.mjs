import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

async function main() {
  console.log("[Phase3976A] Xiaomi Provider Reality Seal Review Verifier");

  const resultPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-3976a-xiaomi-provider-reality-seal-review/result.json");
  let result;
  try {
    result = JSON.parse(await readFile(resultPath, "utf8"));
  } catch {
    console.error("[Phase3976A] FAIL: result.json not found.");
    process.exit(1);
  }

  const checks = [
    { field: "completed", expected: true, actual: result.completed },
    { field: "recommendedSealed", expected: true, actual: result.recommendedSealed },
    { field: "xiaomiProviderRealityReviewed", expected: true, actual: result.xiaomiProviderRealityReviewed },
    { field: "providerStabilityClaimed", expected: false, actual: result.providerStabilityClaimed },
    { field: "productionReadyClaimed", expected: false, actual: result.productionReadyClaimed },
    { field: "multiProviderCommercialReadyClaimed", expected: false, actual: result.multiProviderCommercialReadyClaimed },
    { field: "secretRead", expected: false, actual: result.secretRead },
    { field: "rawSecretPrinted", expected: false, actual: result.rawSecretPrinted },
    { field: "chatModified", expected: false, actual: result.chatModified },
    { field: "chatGatewayExecuteModified", expected: false, actual: result.chatGatewayExecuteModified },
    { field: "deployExecuted", expected: false, actual: result.deployExecuted },
  ];

  let pass = true;
  for (const check of checks) {
    const ok = check.actual === check.expected;
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}: ${check.field} = ${JSON.stringify(check.actual)} (expected ${JSON.stringify(check.expected)})`);
  }

  console.log(`  INFO: xiaomiCanBePrimaryValidationProvider = ${result.xiaomiCanBePrimaryValidationProvider}`);
  console.log(`  INFO: blocker = ${result.blocker ?? "none"}`);
  if (result.review) {
    console.log(`  INFO: providerId = ${result.review.providerId}`);
    console.log(`  INFO: credentialRefReady = ${result.review.credentialRefReady}`);
    console.log(`  INFO: oneShotExecuted = ${result.review.oneShotExecuted}`);
    console.log(`  INFO: oneShotPassed = ${result.review.oneShotPassed}`);
    console.log(`  INFO: oneShotLatencyMs = ${result.review.oneShotLatencyMs}`);
    console.log(`  INFO: microBatchExecuted = ${result.review.microBatchExecuted}`);
    console.log(`  INFO: microBatchSuccessCount = ${result.review.microBatchSuccessCount}`);
    console.log(`  INFO: microBatchFailureCount = ${result.review.microBatchFailureCount}`);
    console.log(`  INFO: microBatchP95LatencyMs = ${result.review.microBatchP95LatencyMs}`);
    console.log(`  INFO: blockers = ${result.review.blockers?.join(", ") ?? "none"}`);
  }

  if (pass) {
    console.log("[Phase3976A] PASS: All checks passed.");
  } else {
    console.log("[Phase3976A] FAIL: Some checks failed.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[Phase3976A] Fatal:", error.message);
  process.exit(1);
});
