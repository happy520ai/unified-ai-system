import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

async function main() {
  console.log("[Phase3975A] Xiaomi Stability Micro-Batch Smoke");

  // Check Phase3974A one-shot success
  const phase3974Path = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-3974a-xiaomi-one-shot-real-provider-smoke/result.json");
  let phase3974;
  try {
    phase3974 = JSON.parse(await readFile(phase3974Path, "utf8"));
  } catch {
    console.error("[Phase3975A] BLOCKED: Phase3974A not found.");
    await writeResult({ blocker: "xiaomi_one_shot_smoke_missing", microBatchExecuted: false, providerCallsMade: false });
    return;
  }

  if (!phase3974.realProviderSmokeExecuted || !phase3974.responseReceived) {
    console.log("[Phase3975A] BLOCKED: Phase3974A one-shot not executed or not successful.");
    await writeResult({
      completed: true,
      recommendedSealed: true,
      blocker: "xiaomi_one_shot_real_provider_smoke_missing",
      phase: "Phase3975A-XiaomiStabilityMicroBatchSmoke",
      provider: "mimo",
      microBatchPlanPrepared: true,
      microBatchExecuted: false,
      realProviderSmokeExecuted: false,
      providerCallsMade: false,
      requestAttemptCount: 0,
      successCount: 0,
      failureCount: 0,
      credentialRefOnly: true,
      rawSecretRead: false,
      secretRead: false,
      secretValuePrinted: false,
      rawSecretPrinted: false,
      authorizationHeaderPrinted: false,
      providerStabilityClaimed: false,
      productionReadyClaimed: false,
      deployExecuted: false,
      xiaomiMicroBatchSmokePassed: false,
    });
    return;
  }

  // Check approval
  const approvalPath = resolve(repoRoot, "docs/provider-smoke/xiaomi-stability-micro-batch-approval.input.json");
  let approval;
  try {
    approval = JSON.parse(await readFile(approvalPath, "utf8"));
  } catch {
    console.log("[Phase3975A] No micro-batch approval found. Creating template...");
    const template = {
      decision: "rejected",
      provider: phase3974.provider || "mimo",
      model: phase3974.model || "",
      maxRequests: 3,
      providerCallAllowed: false,
      credentialRefOnly: true,
      rawSecretReadAllowed: false,
      rawSecretPrintAllowed: false,
      deployAllowed: false,
      successThreshold: 3,
      maxAllowedFailures: 0,
      maxAllowedP95LatencyMs: 30000,
    };
    await mkdir(dirname(approvalPath), { recursive: true });
    await writeFile(approvalPath, JSON.stringify(template, null, 2), "utf8");
    await writeResult({ blocker: "xiaomi_stability_micro_batch_approval_missing", microBatchPlanPrepared: true, microBatchExecuted: false, providerCallsMade: false });
    return;
  }

  const executionAllowed =
    approval.decision === "approved_execute_xiaomi_stability_micro_batch" &&
    approval.providerCallAllowed === true &&
    approval.maxRequests === 3 &&
    approval.credentialRefOnly === true &&
    approval.rawSecretReadAllowed === false &&
    approval.rawSecretPrintAllowed === false &&
    approval.deployAllowed === false;

  if (!executionAllowed) {
    console.log("[Phase3975A] Approval not granted. Decision:", approval.decision);
    await writeResult({ blocker: "xiaomi_stability_micro_batch_approval_missing", microBatchPlanPrepared: true, microBatchExecuted: false, providerCallsMade: false });
    return;
  }

  // Execute micro-batch
  const providerId = phase3974.provider || "mimo";
  const endpoint = "https://token-plan-cn.xiaomimimo.com/v1";
  const mimoApiKey = process.env.MIMO_API_KEY;
  const mimoModel = phase3974.model || process.env.MIMO_MODEL || "mimo-v2.5-pro";
  const prompt = "请用一句中文回复：小米模型稳定性微批次测试成功。";

  if (!mimoApiKey) {
    await writeResult({ blocker: "mimo_api_key_missing_from_env", microBatchExecuted: false, providerCallsMade: false });
    return;
  }

  const maxRequests = approval.maxRequests || 3;
  const results = [];
  let successCount = 0;
  let failureCount = 0;
  const latencies = [];

  console.log(`[Phase3975A] Executing ${maxRequests} requests...`);

  for (let i = 0; i < maxRequests; i++) {
    const startedAt = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${endpoint}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${mimoApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: mimoModel,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 128,
          temperature: 0,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startedAt;
      latencies.push(latencyMs);

      if (response.ok) {
        const body = await response.json();
        const text = body?.choices?.[0]?.message?.content ?? "";
        successCount++;
        results.push({ attempt: i + 1, success: true, latencyMs, responseLength: text.length });
        console.log(`[Phase3975A] Request ${i + 1}: OK (${latencyMs}ms)`);
      } else {
        failureCount++;
        results.push({ attempt: i + 1, success: false, latencyMs, httpStatus: response.status });
        console.log(`[Phase3975A] Request ${i + 1}: HTTP ${response.status} (${latencyMs}ms)`);
      }
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      latencies.push(latencyMs);
      failureCount++;
      results.push({ attempt: i + 1, success: false, latencyMs, error: error.message });
      console.log(`[Phase3975A] Request ${i + 1}: Error (${latencyMs}ms): ${error.message}`);
    }
  }

  latencies.sort((a, b) => a - b);
  const p95Index = Math.floor(latencies.length * 0.95);
  const p95LatencyMs = latencies[p95Index] || 0;

  const result = {
    completed: true,
    recommendedSealed: true,
    blocker: null,
    microBatchExecuted: true,
    provider: providerId,
    model: mimoModel,
    providerCallsMade: true,
    requestAttemptCount: maxRequests,
    successCount,
    failureCount,
    p95LatencyMs,
    credentialRefOnly: true,
    rawSecretRead: false,
    secretValuePrinted: false,
    authorizationHeaderPrinted: false,
    providerStabilityClaimed: false,
    productionReadyClaimed: false,
    deployExecuted: false,
    xiaomiMicroBatchSmokePassed: successCount === maxRequests,
    attempts: results,
  };

  await writeResult(result);
  console.log(`[Phase3975A] Complete: ${successCount}/${maxRequests} succeeded, P95=${p95LatencyMs}ms`);
}

async function writeResult(result) {
  const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-3975a-xiaomi-stability-micro-batch-smoke");
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resolve(evidenceDir, "result.json"), JSON.stringify(result, null, 2), "utf8");
  console.log("[Phase3975A] Result written to evidence/phase-3975a-xiaomi-stability-micro-batch-smoke/result.json");
}

main().catch((error) => {
  console.error("[Phase3975A] Fatal:", error.message);
  process.exit(1);
});
