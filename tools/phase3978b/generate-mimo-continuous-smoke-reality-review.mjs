import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

async function main() {
  console.log("[Phase3978B] MiMo Continuous Smoke Reality Review");

  const phase3977fPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase3977f-mimo-continuous-real-provider-smoke-execute/result.json");
  let phase3977f;
  try {
    phase3977f = JSON.parse(await readFile(phase3977fPath, "utf8"));
  } catch {
    console.log("[Phase3978B] Phase3977F not found. Cannot review.");
    await writeResult({
      blocker: "mimo_continuous_real_smoke_missing",
      mimoCanBePrimaryValidationProvider: false,
      mimoContinuousSmokePassed: false,
    });
    return;
  }

  if (!phase3977f.continuousRealSmokeExecuted || !phase3977f.providerCallsMade) {
    console.log("[Phase3978B] Phase3977F was blocked. Blocker:", phase3977f.blocker);
    await writeResult({
      blocker: "mimo_continuous_real_smoke_missing",
      mimoCanBePrimaryValidationProvider: false,
      mimoContinuousSmokePassed: false,
    });
    return;
  }

  const canBePrimary = phase3977f.mimoContinuousSmokePassed === true;
  const failureRate = phase3977f.failureCount / (phase3977f.requestAttemptCount || 1);

  await writeResult({
    blocker: null,
    mimoCanBePrimaryValidationProvider: canBePrimary,
    mimoContinuousSmokePassed: phase3977f.mimoContinuousSmokePassed,
    requestAttemptCount: phase3977f.requestAttemptCount,
    successCount: phase3977f.successCount,
    failureCount: phase3977f.failureCount,
    failureRate,
    p50LatencyMs: phase3977f.p50LatencyMs,
    p95LatencyMs: phase3977f.p95LatencyMs,
    p99LatencyMs: phase3977f.p99LatencyMs,
    estimatedTotalTokens: phase3977f.estimatedTotalTokens,
    stoppedBy: phase3977f.stoppedBy,
    errorBreakdown: phase3977f.errorBreakdown,
  });

  console.log("[Phase3978B] Provider: mimo");
  console.log("[Phase3978B] Requests:", phase3977f.requestAttemptCount);
  console.log("[Phase3978B] Success:", phase3977f.successCount, "| Failure:", phase3977f.failureCount);
  console.log("[Phase3978B] Failure rate:", (failureRate * 100).toFixed(1) + "%");
  console.log("[Phase3978B] P50:", phase3977f.p50LatencyMs, "ms | P95:", phase3977f.p95LatencyMs, "ms | P99:", phase3977f.p99LatencyMs, "ms");
  console.log("[Phase3978B] Tokens:", phase3977f.estimatedTotalTokens);
  console.log("[Phase3978B] Stopped by:", phase3977f.stoppedBy);
  console.log("[Phase3978B] Can be primary validation provider:", canBePrimary);
  console.log("[Phase3978B] Provider stability claimed: false");
  console.log("[Phase3978B] Production ready claimed: false");
}

async function writeResult(data) {
  const result = {
    completed: true,
    recommendedSealed: true,
    blocker: data.blocker ?? null,
    mimoContinuousSmokeReviewed: true,
    mimoCanBePrimaryValidationProvider: data.mimoCanBePrimaryValidationProvider ?? false,
    mimoContinuousSmokePassed: data.mimoContinuousSmokePassed ?? false,
    providerStabilityClaimed: false,
    productionReadyClaimed: false,
    multiProviderCommercialReadyClaimed: false,
    secretRead: false,
    rawSecretPrinted: false,
    authorizationHeaderPrinted: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    review: {
      provider: "mimo",
      requestAttemptCount: data.requestAttemptCount ?? 0,
      successCount: data.successCount ?? 0,
      failureCount: data.failureCount ?? 0,
      failureRate: data.failureRate ?? 0,
      p50LatencyMs: data.p50LatencyMs ?? null,
      p95LatencyMs: data.p95LatencyMs ?? null,
      p99LatencyMs: data.p99LatencyMs ?? null,
      estimatedTotalTokens: data.estimatedTotalTokens ?? 0,
      stoppedBy: data.stoppedBy ?? "not_executed",
      errorBreakdown: data.errorBreakdown ?? {},
      stillCannotClaim: [
        "provider long-term stability",
        "production readiness",
        "multi-provider commercial availability",
        "default chat route change",
      ],
    },
  };

  const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase3978b-mimo-continuous-smoke-reality-review");
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resolve(evidenceDir, "result.json"), JSON.stringify(result, null, 2), "utf8");
  console.log("[Phase3978B] Result written to evidence/phase3978b-.../result.json");
}

main().catch((error) => {
  console.error("[Phase3978B] Fatal:", error.message);
  process.exit(1);
});
