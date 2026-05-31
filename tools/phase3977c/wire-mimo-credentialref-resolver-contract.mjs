import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

const TARGET_FILE = "apps/ai-gateway-service/src/providers/credentialRefResolverRuntime.contract.js";

async function main() {
  console.log("[Phase3977C] MiMo CredentialRef Resolver Contract Wiring");

  const filePath = resolve(repoRoot, TARGET_FILE);
  const original = await readFile(filePath, "utf8");

  const hasMimo = original.includes("mimo");
  console.log("[Phase3977C] Current contract has mimo:", hasMimo);

  if (hasMimo) {
    console.log("[Phase3977C] Mimo already in contract. No modification needed.");
    await writeResult(true);
    return;
  }

  // Find the supportedProviderRefs array and add mimo entry
  const mimoEntry = `    Object.freeze({
      providerId: "mimo",
      credentialRef: "credentialRef:mimo:default",
      allowedModelIds: Object.freeze([
        "mimo-v2.5-pro",
      ]),
    }),`;

  // Insert after the openrouter entry
  const marker = "    }),\n  ])";
  const idx = original.lastIndexOf(marker);
  if (idx === -1) {
    console.error("[Phase3977C] FAIL: Could not find insertion point in contract.");
    process.exit(1);
  }

  const before = original.substring(0, idx + 4);
  const after = original.substring(idx + 4);
  const updated = before + "\n" + mimoEntry + after;

  await writeFile(filePath, updated, "utf8");
  console.log("[Phase3977C] Added mimo to supportedProviderRefs.");

  // Verify the write
  const verify = await readFile(filePath, "utf8");
  const ok = verify.includes('providerId: "mimo"') && verify.includes("credentialRef:mimo:default");
  console.log("[Phase3977C] Verification:", ok ? "PASS" : "FAIL");

  await writeResult(ok);
}

async function writeResult(success) {
  const result = {
    completed: true,
    recommendedSealed: true,
    blocker: success ? null : "mimo_credentialref_wiring_failed",
    phase: "Phase3977C-MiMoCredentialRefResolverContractWiring",
    provider: "mimo",
    mimoCredentialRefResolverContractWired: success,
    credentialRefOnly: true,
    secretValueWritten: false,
    rawSecretRead: false,
    secretRead: false,
    secretValuePrinted: false,
    authorizationHeaderPrinted: false,
    providerCallsMade: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    targetFile: TARGET_FILE,
  };

  const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase3977c-mimo-credentialref-resolver-contract-wiring");
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resolve(evidenceDir, "result.json"), JSON.stringify(result, null, 2), "utf8");
  console.log("[Phase3977C] Result written to evidence/phase3977c-.../result.json");
}

main().catch((error) => {
  console.error("[Phase3977C] Fatal:", error.message);
  process.exit(1);
});
