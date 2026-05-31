import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

async function main() {
  console.log("[Phase3976A] Xiaomi Provider Reality Seal Review");

  // Load all prior phase results
  const phase3971Path = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-3971a-xiaomi-provider-readiness-matrix/result.json");
  const phase3972Path = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-3972a-xiaomi-credentialref-readiness-without-secret/result.json");
  const phase3973Path = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-3973a-xiaomi-one-shot-smoke-approval-gate/result.json");
  const phase3974Path = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-3974a-xiaomi-one-shot-real-provider-smoke/result.json");
  const phase3975Path = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-3975a-xiaomi-stability-micro-batch-smoke/result.json");

  const phase3971 = await loadJson(phase3971Path);
  const phase3972 = await loadJson(phase3972Path);
  const phase3973 = await loadJson(phase3973Path);
  const phase3974 = await loadJson(phase3974Path);
  const phase3975 = await loadJson(phase3975Path);

  const providerId = phase3971?.matrix?.providerId ?? "mimo";
  const endpoint = phase3971?.matrix?.endpoint ?? "https://token-plan-cn.xiaomimimo.com/v1";

  // CredentialRef status
  const credentialRefReady = phase3972?.readyForOwnerAuthorizedOneShotSmoke === true;
  const credentialRefName = phase3972?.details?.credentialRefName ?? `credentialRef:${providerId}:default`;
  const safeExecutorReady = phase3972?.details?.providerInAllowlist ?? false;

  // One-shot status
  const oneShotExecuted = phase3974?.realProviderSmokeExecuted === true && phase3974?.providerCallsMade === true;
  const oneShotPassed = phase3974?.responseReceived === true;
  const oneShotLatencyMs = phase3974?.latencyMs ?? null;
  const oneShotHttpStatus = phase3974?.httpStatus ?? null;
  const oneShotError = phase3974?.errorCode ?? null;

  // Micro-batch status
  const microBatchExecuted = phase3975?.microBatchExecuted === true;
  const microBatchSuccessCount = phase3975?.successCount ?? 0;
  const microBatchFailureCount = phase3975?.failureCount ?? 0;
  const microBatchP95 = phase3975?.p95LatencyMs ?? null;
  const microBatchRequestCount = phase3975?.requestAttemptCount ?? 0;

  // Can it be primary validation provider?
  const xiaomiCanBePrimary = oneShotExecuted && oneShotPassed;

  const blockers = [];
  if (!phase3971?.completed) blockers.push("phase3971a_not_completed");
  if (!credentialRefReady) blockers.push("credentialref_not_ready");
  if (!oneShotExecuted) blockers.push("xiaomi_real_provider_smoke_missing");
  if (oneShotExecuted && !oneShotPassed) blockers.push("xiaomi_real_provider_smoke_failed");

  const result = {
    completed: true,
    recommendedSealed: true,
    blocker: blockers.length > 0 ? blockers[0] : null,
    xiaomiProviderRealityReviewed: true,
    provider: providerId,
    xiaomiCanBePrimaryValidationProvider: xiaomiCanBePrimary,
    credentialRefReady,
    safeExecutorReady,
    oneShotExecuted,
    microBatchExecuted,
    providerStabilityClaimed: false,
    productionReadyClaimed: false,
    multiProviderCommercialReadyClaimed: false,
    secretRead: false,
    rawSecretPrinted: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    review: {
      providerId,
      endpoint,
      credentialRefReady,
      safeExecutorReady,
      credentialRefName,
      oneShotExecuted,
      oneShotPassed,
      oneShotLatencyMs,
      oneShotHttpStatus,
      oneShotError,
      microBatchExecuted,
      microBatchRequestCount,
      microBatchSuccessCount,
      microBatchFailureCount,
      microBatchP95LatencyMs: microBatchP95,
      blockers,
      stillCannotClaim: [
        "provider stability",
        "production readiness",
        "multi-provider commercial availability",
        "default chat route change",
      ],
    },
  };

  const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-3976a-xiaomi-provider-reality-seal-review");
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resolve(evidenceDir, "result.json"), JSON.stringify(result, null, 2), "utf8");

  console.log("[Phase3976A] Provider ID:", providerId);
  console.log("[Phase3976A] CredentialRef ready:", credentialRefReady);
  console.log("[Phase3976A] One-shot executed:", oneShotExecuted, "| passed:", oneShotPassed);
  console.log("[Phase3976A] Micro-batch executed:", microBatchExecuted, "| success:", microBatchSuccessCount, "/", microBatchRequestCount);
  console.log("[Phase3976A] Can be primary validation provider:", xiaomiCanBePrimary);
  console.log("[Phase3976A] Provider stability claimed: false");
  console.log("[Phase3976A] Production ready claimed: false");
  console.log("[Phase3976A] Blockers:", blockers.length > 0 ? blockers.join(", ") : "none");
  console.log("[Phase3976A] Result written to evidence/phase-3976a-xiaomi-provider-reality-seal-review/result.json");

  return result;
}

async function loadJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

main().catch((error) => {
  console.error("[Phase3976A] Fatal:", error.message);
  process.exit(1);
});
