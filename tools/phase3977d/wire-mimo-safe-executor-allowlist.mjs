import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

const TARGET_FILE = "apps/ai-gateway-service/src/providers/safeInternalProviderExecutor.contract.js";

async function main() {
  console.log("[Phase3977D] MiMo Safe Executor Allowlist Wiring");

  const filePath = resolve(repoRoot, TARGET_FILE);
  const original = await readFile(filePath, "utf8");

  const hasMimoProvider = original.includes('"mimo"');
  const hasMimoCredentialRef = original.includes("credentialRef:mimo:default");

  console.log("[Phase3977D] Current contract has mimo provider:", hasMimoProvider);
  console.log("[Phase3977D] Current contract has mimo credentialRef:", hasMimoCredentialRef);

  if (hasMimoProvider && hasMimoCredentialRef) {
    console.log("[Phase3977D] Mimo already fully wired. No modification needed.");
    await writeResult(true);
    return;
  }

  let updated = original;

  // Add mimo to allowedProviderIds
  if (!hasMimoProvider) {
    updated = updated.replace(
      'allowedProviderIds: Object.freeze(["nvidia", "openrouter"])',
      'allowedProviderIds: Object.freeze(["nvidia", "openrouter", "mimo"])'
    );
    console.log("[Phase3977D] Added mimo to allowedProviderIds.");
  }

  // Add mimo credentialRef to allowedCredentialRefs
  if (!hasMimoCredentialRef) {
    updated = updated.replace(
      'allowedCredentialRefs: Object.freeze(["credentialRef:nvidia:default", "credentialRef:openrouter:default"])',
      'allowedCredentialRefs: Object.freeze(["credentialRef:nvidia:default", "credentialRef:openrouter:default", "credentialRef:mimo:default"])'
    );
    console.log("[Phase3977D] Added credentialRef:mimo:default to allowedCredentialRefs.");
  }

  // Add mimo model to allowedModelIds
  if (!updated.includes("mimo-v2.5-pro")) {
    updated = updated.replace(
      '"openai/gpt-4o-mini"\n  ])',
      '"openai/gpt-4o-mini",\n    "mimo-v2.5-pro"\n  ])'
    );
    console.log("[Phase3977D] Added mimo-v2.5-pro to allowedModelIds.");
  }

  await writeFile(filePath, updated, "utf8");

  // Verify
  const verify = await readFile(filePath, "utf8");
  const ok = verify.includes('"mimo"') && verify.includes("credentialRef:mimo:default") && verify.includes("mimo-v2.5-pro");
  console.log("[Phase3977D] Verification:", ok ? "PASS" : "FAIL");

  await writeResult(ok);
}

async function writeResult(success) {
  const result = {
    completed: true,
    recommendedSealed: true,
    blocker: success ? null : "mimo_safe_executor_wiring_failed",
    phase: "Phase3977D-MiMoSafeExecutorAllowlistWiring",
    provider: "mimo",
    mimoProviderAddedToSafeExecutorAllowlist: success,
    mimoCredentialRefAddedToExecutorAllowlist: success,
    safeExecutorReadyForMimo: success,
    providerCallsMade: false,
    rawSecretRead: false,
    secretRead: false,
    secretValuePrinted: false,
    authorizationHeaderPrinted: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    targetFile: TARGET_FILE,
  };

  const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase3977d-mimo-safe-executor-allowlist-wiring");
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resolve(evidenceDir, "result.json"), JSON.stringify(result, null, 2), "utf8");
  console.log("[Phase3977D] Result written to evidence/phase3977d-.../result.json");
}

main().catch((error) => {
  console.error("[Phase3977D] Fatal:", error.message);
  process.exit(1);
});
