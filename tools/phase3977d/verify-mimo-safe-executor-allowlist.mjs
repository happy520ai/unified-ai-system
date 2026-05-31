import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

async function main() {
  console.log("[Phase3977D] MiMo Safe Executor Allowlist Verifier");

  const resultPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase3977d-mimo-safe-executor-allowlist-wiring/result.json");
  let result;
  try {
    result = JSON.parse(await readFile(resultPath, "utf8"));
  } catch {
    console.error("[Phase3977D] FAIL: result.json not found.");
    process.exit(1);
  }

  const contractPath = resolve(repoRoot, "apps/ai-gateway-service/src/providers/safeInternalProviderExecutor.contract.js");
  const contract = await readFile(contractPath, "utf8");
  const hasMimo = contract.includes('"mimo"') && contract.includes("credentialRef:mimo:default") && contract.includes("mimo-v2.5-pro");

  let pass = true;
  const checks = [
    { field: "completed", expected: true, actual: result.completed },
    { field: "recommendedSealed", expected: true, actual: result.recommendedSealed },
    { field: "mimoProviderAddedToSafeExecutorAllowlist", expected: true, actual: result.mimoProviderAddedToSafeExecutorAllowlist },
    { field: "mimoCredentialRefAddedToExecutorAllowlist", expected: true, actual: result.mimoCredentialRefAddedToExecutorAllowlist },
    { field: "safeExecutorReadyForMimo", expected: true, actual: result.safeExecutorReadyForMimo },
    { field: "providerCallsMade", expected: false, actual: result.providerCallsMade },
    { field: "rawSecretRead", expected: false, actual: result.rawSecretRead },
    { field: "secretValuePrinted", expected: false, actual: result.secretValuePrinted },
    { field: "authorizationHeaderPrinted", expected: false, actual: result.authorizationHeaderPrinted },
    { field: "chatModified", expected: false, actual: result.chatModified },
    { field: "chatGatewayExecuteModified", expected: false, actual: result.chatGatewayExecuteModified },
    { field: "deployExecuted", expected: false, actual: result.deployExecuted },
    { field: "contractVerification", expected: true, actual: hasMimo },
  ];

  for (const check of checks) {
    const ok = check.actual === check.expected;
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}: ${check.field} = ${JSON.stringify(check.actual)} (expected ${JSON.stringify(check.expected)})`);
  }

  console.log(`[Phase3977D] ${pass ? "PASS" : "FAIL"}: ${pass ? "All checks passed." : "Some checks failed."}`);
  if (!pass) process.exit(1);
}

main().catch((error) => {
  console.error("[Phase3977D] Fatal:", error.message);
  process.exit(1);
});
