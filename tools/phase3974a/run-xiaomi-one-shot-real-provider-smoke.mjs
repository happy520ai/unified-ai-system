import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

async function main() {
  console.log("[Phase3974A] Xiaomi One-Shot Real Provider Smoke");

  // Check Phase3973A approval
  const approvalPath = resolve(repoRoot, "docs/provider-smoke/xiaomi-one-shot-smoke-approval.input.json");
  let approval;
  try {
    approval = JSON.parse(await readFile(approvalPath, "utf8"));
  } catch {
    console.log("[Phase3974A] BLOCKED: Approval input not found.");
    await writeBlockedResult("xiaomi_one_shot_smoke_approval_missing");
    return;
  }

  const executionAllowed =
    approval.decision === "approved_execute_xiaomi_one_shot_real_provider_smoke" &&
    approval.providerCallAllowed === true &&
    approval.maxRequests === 1 &&
    approval.credentialRefOnly === true &&
    approval.rawSecretReadAllowed === false &&
    approval.rawSecretPrintAllowed === false &&
    approval.deployAllowed === false;

  if (!executionAllowed) {
    console.log("[Phase3974A] BLOCKED: Approval not granted. Decision:", approval.decision);
    await writeBlockedResult("xiaomi_one_shot_smoke_approval_missing");
    return;
  }

  // Check Phase3972A readiness
  const phase3972Path = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-3972a-xiaomi-credentialref-readiness-without-secret/result.json");
  let phase3972;
  try {
    phase3972 = JSON.parse(await readFile(phase3972Path, "utf8"));
  } catch {
    console.log("[Phase3974A] BLOCKED: Phase3972A not found.");
    await writeBlockedResult("xiaomi_credentialref_readiness_missing");
    return;
  }

  if (!phase3972.readyForOwnerAuthorizedOneShotSmoke) {
    console.log("[Phase3974A] BLOCKED: CredentialRef not ready.");
    await writeBlockedResult("xiaomi_credentialref_missing");
    return;
  }

  // If we reach here, execute real smoke (not reached in current state)
  console.log("[Phase3974A] All gates passed. Would execute real smoke here.");
  console.log("[Phase3974A] NOTE: This path is not reached because approval is rejected.");
}

async function writeBlockedResult(blocker) {
  const result = {
    completed: true,
    recommendedSealed: true,
    blocker,
    phase: "Phase3974A-XiaomiOneShotRealProviderSmoke",
    provider: "mimo",
    realProviderSmokeExecuted: false,
    providerCallsMade: false,
    providerSmokeExecutionAllowed: false,
    requestAttemptCount: 0,
    retryAttemptCount: 0,
    maxRequests: 1,
    credentialRefOnly: true,
    rawSecretRead: false,
    secretRead: false,
    secretValuePrinted: false,
    rawSecretPrinted: false,
    authorizationHeaderPrinted: false,
    responseReceived: false,
    responseClassified: false,
    latencyMsCaptured: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
    deployExecuted: false,
    productionReadyClaimed: false,
    providerStabilityClaimed: false,
  };

  const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-3974a-xiaomi-one-shot-real-provider-smoke");
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resolve(evidenceDir, "result.json"), JSON.stringify(result, null, 2), "utf8");
  console.log("[Phase3974A] Blocked result written. Blocker:", blocker);
  console.log("[Phase3974A] Provider calls made: false");
  console.log("[Phase3974A] Secret read: false");
}

main().catch((error) => {
  console.error("[Phase3974A] Fatal:", error.message);
  process.exit(1);
});
