import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

async function main() {
  console.log("[Phase3972A] Xiaomi CredentialRef Readiness Without Secret");

  const phase3971Path = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-3971a-xiaomi-provider-readiness-matrix/result.json");
  let phase3971;
  try {
    phase3971 = JSON.parse(await readFile(phase3971Path, "utf8"));
  } catch {
    console.error("[Phase3972A] FAIL: Phase3971A result.json not found.");
    process.exit(1);
  }

  if (!phase3971.completed || phase3971.providerCallsMade) {
    console.error("[Phase3972A] FAIL: Phase3971A not properly sealed.");
    process.exit(1);
  }

  const providerId = phase3971.matrix?.providerId ?? "mimo";
  console.log("[Phase3972A] Provider ID from Phase3971A:", providerId);

  const credentialRefContractPath = resolve(repoRoot, "apps/ai-gateway-service/src/providers/credentialRefResolverRuntime.contract.js");
  const credentialRefContract = await readFile(credentialRefContractPath, "utf8");

  const safeExecutorContractPath = resolve(repoRoot, "apps/ai-gateway-service/src/providers/safeInternalProviderExecutor.contract.js");
  const safeExecutorContract = await readFile(safeExecutorContractPath, "utf8");

  const credentialRefName = `credentialRef:${providerId}:default`;
  const credentialRefInContract = credentialRefContract.includes(credentialRefName);
  const credentialRefInAllowlist = safeExecutorContract.includes(credentialRefName);
  const providerInAllowlist = safeExecutorContract.includes(`"${providerId}"`);

  const blockers = [];
  if (!credentialRefInContract) blockers.push("credentialref_not_in_resolver_contract");
  if (!credentialRefInAllowlist) blockers.push("credentialref_not_in_executor_allowlist");
  if (!providerInAllowlist) blockers.push("provider_not_in_executor_allowlist");

  const readyForSmoke = blockers.length === 0;

  const result = {
    completed: true,
    recommendedSealed: true,
    blocker: blockers.length > 0 ? blockers[0] : null,
    xiaomiCredentialRefReadinessChecked: true,
    credentialRefOnly: true,
    rawSecretRead: false,
    secretValuePrinted: false,
    authorizationHeaderPrinted: false,
    providerCallsMade: false,
    readyForOwnerAuthorizedOneShotSmoke: readyForSmoke,
    chatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    details: {
      providerId,
      credentialRefName,
      credentialRefInContract,
      credentialRefInAllowlist,
      providerInAllowlist,
      blockers,
    },
  };

  const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-3972a-xiaomi-credentialref-readiness-without-secret");
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resolve(evidenceDir, "result.json"), JSON.stringify(result, null, 2), "utf8");

  console.log("[Phase3972A] CredentialRef name:", credentialRefName);
  console.log("[Phase3972A] In resolver contract:", credentialRefInContract);
  console.log("[Phase3972A] In executor allowlist:", credentialRefInAllowlist);
  console.log("[Phase3972A] Provider in allowlist:", providerInAllowlist);
  console.log("[Phase3972A] Ready for one-shot smoke:", readyForSmoke);
  console.log("[Phase3972A] Blockers:", blockers.length > 0 ? blockers.join(", ") : "none");
  console.log("[Phase3972A] Raw secret read: false");
  console.log("[Phase3972A] Result written to evidence/phase-3972a-xiaomi-credentialref-readiness-without-secret/result.json");

  return result;
}

main().catch((error) => {
  console.error("[Phase3972A] Fatal:", error.message);
  process.exit(1);
});
