import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

async function main() {
  console.log("[Phase3977E] MiMo Continuous Smoke Readiness Verifier");

  const resultPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase3977e-mimo-continuous-smoke-readiness-recheck/result.json");
  let result;
  try {
    result = JSON.parse(await readFile(resultPath, "utf8"));
  } catch {
    console.error("[Phase3977E] FAIL: result.json not found.");
    process.exit(1);
  }

  let pass = true;
  const checks = [
    { field: "completed", expected: true, actual: result.completed },
    { field: "recommendedSealed", expected: true, actual: result.recommendedSealed },
    { field: "credentialRefOnly", expected: true, actual: result.credentialRefOnly },
    { field: "providerCallsMade", expected: false, actual: result.providerCallsMade },
    { field: "rawSecretRead", expected: false, actual: result.rawSecretRead },
    { field: "secretValuePrinted", expected: false, actual: result.secretValuePrinted },
    { field: "authorizationHeaderPrinted", expected: false, actual: result.authorizationHeaderPrinted },
    { field: "chatModified", expected: false, actual: result.chatModified },
    { field: "chatGatewayExecuteModified", expected: false, actual: result.chatGatewayExecuteModified },
    { field: "deployExecuted", expected: false, actual: result.deployExecuted },
  ];

  for (const check of checks) {
    const ok = check.actual === check.expected;
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}: ${check.field} = ${JSON.stringify(check.actual)} (expected ${JSON.stringify(check.expected)})`);
  }

  console.log(`  INFO: readyForContinuousRealSmoke = ${result.readyForContinuousRealSmoke}`);
  console.log(`  INFO: credentialRefReady = ${result.credentialRefReady}`);
  console.log(`  INFO: safeExecutorReady = ${result.safeExecutorReady}`);
  console.log(`  INFO: blocker = ${result.blocker ?? "none"}`);

  console.log(`[Phase3977E] ${pass ? "PASS" : "FAIL"}: ${pass ? "All checks passed." : "Some checks failed."}`);
  if (!pass) process.exit(1);
}

main().catch((error) => {
  console.error("[Phase3977E] Fatal:", error.message);
  process.exit(1);
});
