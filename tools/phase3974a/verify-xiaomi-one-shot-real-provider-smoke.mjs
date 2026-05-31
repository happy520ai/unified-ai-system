import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

const ALLOWED_BLOCKERS = [
  "xiaomi_one_shot_smoke_approval_missing",
  "xiaomi_credentialref_missing",
  "xiaomi_credentialref_readiness_missing",
  "xiaomi_safe_executor_missing",
  "xiaomi_not_ready_for_real_provider_smoke",
  "mimo_api_key_missing_from_env",
  "phase3971a_not_completed",
];

async function main() {
  console.log("[Phase3974A] Xiaomi One-Shot Real Provider Smoke Verifier (dual-mode)");

  const resultPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-3974a-xiaomi-one-shot-real-provider-smoke/result.json");
  let result;
  try {
    result = JSON.parse(await readFile(resultPath, "utf8"));
  } catch {
    console.error("[Phase3974A] FAIL: result.json not found.");
    process.exit(1);
  }

  const isBlocked =
    result.blocker !== null ||
    result.realProviderSmokeExecuted === false ||
    result.providerCallsMade === false;

  const isExecuted =
    result.realProviderSmokeExecuted === true &&
    result.providerCallsMade === true;

  if (!isBlocked && !isExecuted) {
    console.error("[Phase3974A] FAIL: Result is neither blocked nor executed.");
    process.exit(1);
  }

  let pass = true;

  if (isBlocked) {
    console.log("[Phase3974A] Mode: BLOCKED");
    const blockedChecks = [
      { field: "completed", expected: true, actual: result.completed },
      { field: "recommendedSealed", expected: true, actual: result.recommendedSealed },
      { field: "realProviderSmokeExecuted", expected: false, actual: result.realProviderSmokeExecuted },
      { field: "providerCallsMade", expected: false, actual: result.providerCallsMade },
      { field: "rawSecretRead", expected: false, actual: result.rawSecretRead ?? result.secretRead },
      { field: "rawSecretPrinted", expected: false, actual: result.rawSecretPrinted ?? result.secretValuePrinted },
      { field: "authorizationHeaderPrinted", expected: false, actual: result.authorizationHeaderPrinted },
      { field: "chatModified", expected: false, actual: result.chatModified },
      { field: "chatGatewayExecuteModified", expected: false, actual: result.chatGatewayExecuteModified },
      { field: "deployExecuted", expected: false, actual: result.deployExecuted },
      { field: "productionReadyClaimed", expected: false, actual: result.productionReadyClaimed },
      { field: "providerStabilityClaimed", expected: false, actual: result.providerStabilityClaimed },
    ];

    for (const check of blockedChecks) {
      const ok = check.actual === check.expected;
      if (!ok) pass = false;
      console.log(`  ${ok ? "PASS" : "FAIL"}: ${check.field} = ${JSON.stringify(check.actual)} (expected ${JSON.stringify(check.expected)})`);
    }

    if (result.blocker && !ALLOWED_BLOCKERS.includes(result.blocker)) {
      console.log(`  WARN: blocker "${result.blocker}" is not in allowed list`);
    }
    console.log(`  INFO: blocker = ${result.blocker ?? "none"}`);
    console.log(`  INFO: requestAttemptCount = ${result.requestAttemptCount ?? 0}`);
    console.log(`  INFO: responseReceived = ${result.responseReceived ?? false}`);

  } else {
    console.log("[Phase3974A] Mode: EXECUTED");
    const executedChecks = [
      { field: "completed", expected: true, actual: result.completed },
      { field: "recommendedSealed", expected: true, actual: result.recommendedSealed },
      { field: "blocker", expected: null, actual: result.blocker },
      { field: "realProviderSmokeExecuted", expected: true, actual: result.realProviderSmokeExecuted },
      { field: "providerCallsMade", expected: true, actual: result.providerCallsMade },
      { field: "requestAttemptCount", expected: 1, actual: result.requestAttemptCount },
      { field: "retryAttemptCount", expected: 0, actual: result.retryAttemptCount },
      { field: "maxRequests", expected: 1, actual: result.maxRequests },
      { field: "credentialRefOnly", expected: true, actual: result.credentialRefOnly },
      { field: "responseReceived", expected: true, actual: result.responseReceived },
      { field: "responseClassified", expected: true, actual: result.responseClassified },
      { field: "latencyMsCaptured", expected: true, actual: result.latencyMsCaptured },
      { field: "rawSecretRead", expected: false, actual: result.rawSecretRead },
      { field: "secretValuePrinted", expected: false, actual: result.secretValuePrinted },
      { field: "authorizationHeaderPrinted", expected: false, actual: result.authorizationHeaderPrinted },
      { field: "chatModified", expected: false, actual: result.chatModified },
      { field: "chatGatewayExecuteModified", expected: false, actual: result.chatGatewayExecuteModified },
      { field: "deployExecuted", expected: false, actual: result.deployExecuted },
      { field: "productionReadyClaimed", expected: false, actual: result.productionReadyClaimed },
      { field: "providerStabilityClaimed", expected: false, actual: result.providerStabilityClaimed },
    ];

    for (const check of executedChecks) {
      const ok = check.actual === check.expected;
      if (!ok) pass = false;
      console.log(`  ${ok ? "PASS" : "FAIL"}: ${check.field} = ${JSON.stringify(check.actual)} (expected ${JSON.stringify(check.expected)})`);
    }
  }

  if (pass) {
    console.log("[Phase3974A] PASS: All checks passed.");
  } else {
    console.log("[Phase3974A] FAIL: Some checks failed.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[Phase3974A] Fatal:", error.message);
  process.exit(1);
});
