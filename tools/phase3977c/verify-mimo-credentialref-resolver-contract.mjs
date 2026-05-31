import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

async function main() {
  console.log("[Phase3977C] MiMo CredentialRef Resolver Contract Verifier");

  const resultPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase3977c-mimo-credentialref-resolver-contract-wiring/result.json");
  let result;
  try {
    result = JSON.parse(await readFile(resultPath, "utf8"));
  } catch {
    console.error("[Phase3977C] FAIL: result.json not found.");
    process.exit(1);
  }

  // Verify the actual contract file
  const contractPath = resolve(repoRoot, "apps/ai-gateway-service/src/providers/credentialRefResolverRuntime.contract.js");
  const contract = await readFile(contractPath, "utf8");
  const hasMimo = contract.includes('providerId: "mimo"') && contract.includes("credentialRef:mimo:default");

  let pass = true;
  const checks = [
    { field: "completed", expected: true, actual: result.completed },
    { field: "recommendedSealed", expected: true, actual: result.recommendedSealed },
    { field: "mimoCredentialRefResolverContractWired", expected: true, actual: result.mimoCredentialRefResolverContractWired },
    { field: "credentialRefOnly", expected: true, actual: result.credentialRefOnly },
    { field: "secretValueWritten", expected: false, actual: result.secretValueWritten },
    { field: "rawSecretRead", expected: false, actual: result.rawSecretRead },
    { field: "secretValuePrinted", expected: false, actual: result.secretValuePrinted },
    { field: "authorizationHeaderPrinted", expected: false, actual: result.authorizationHeaderPrinted },
    { field: "providerCallsMade", expected: false, actual: result.providerCallsMade },
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

  console.log(`[Phase3977C] ${pass ? "PASS" : "FAIL"}: ${pass ? "All checks passed." : "Some checks failed."}`);
  if (!pass) process.exit(1);
}

main().catch((error) => {
  console.error("[Phase3977C] Fatal:", error.message);
  process.exit(1);
});
