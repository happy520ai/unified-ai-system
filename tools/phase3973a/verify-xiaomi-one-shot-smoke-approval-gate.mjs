import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

async function main() {
  console.log("[Phase3973A] Xiaomi One-Shot Smoke Approval Gate Verifier");

  const resultPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-3973a-xiaomi-one-shot-smoke-approval-gate/result.json");
  let result;
  try {
    result = JSON.parse(await readFile(resultPath, "utf8"));
  } catch {
    console.error("[Phase3973A] FAIL: result.json not found.");
    process.exit(1);
  }

  const checks = [
    { field: "completed", expected: true, actual: result.completed },
    { field: "recommendedSealed", expected: true, actual: result.recommendedSealed },
    { field: "xiaomiOneShotApprovalGatePrepared", expected: true, actual: result.xiaomiOneShotApprovalGatePrepared },
    { field: "providerCallsMade", expected: false, actual: result.providerCallsMade },
    { field: "secretRead", expected: false, actual: result.secretRead },
    { field: "rawSecretPrinted", expected: false, actual: result.rawSecretPrinted },
    { field: "deployExecuted", expected: false, actual: result.deployExecuted },
  ];

  let pass = true;
  for (const check of checks) {
    const ok = check.actual === check.expected;
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}: ${check.field} = ${JSON.stringify(check.actual)} (expected ${JSON.stringify(check.expected)})`);
  }

  console.log(`  INFO: providerSmokeExecutionAllowed = ${result.providerSmokeExecutionAllowed}`);
  console.log(`  INFO: blocker = ${result.blocker ?? "none"}`);
  if (result.approvalInput) {
    console.log(`  INFO: approval decision = ${result.approvalInput.decision}`);
    console.log(`  INFO: providerCallAllowed = ${result.approvalInput.providerCallAllowed}`);
  }

  if (pass) {
    console.log("[Phase3973A] PASS: All checks passed.");
  } else {
    console.log("[Phase3973A] FAIL: Some checks failed.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[Phase3973A] Fatal:", error.message);
  process.exit(1);
});
