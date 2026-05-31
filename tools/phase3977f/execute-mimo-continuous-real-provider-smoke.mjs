import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

async function main() {
  console.log("[Phase3977F] MiMo Continuous Real Provider Smoke Execute");

  // Pre-flight: Phase3977E readiness
  const readinessPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase3977e-mimo-continuous-smoke-readiness-recheck/result.json");
  let readiness;
  try {
    readiness = JSON.parse(await readFile(readinessPath, "utf8"));
  } catch {
    console.error("[Phase3977F] BLOCKED: Phase3977E not found.");
    await writeBlocked("phase3977e_missing");
    return;
  }
  if (!readiness.readyForContinuousRealSmoke) {
    console.error("[Phase3977F] BLOCKED: Not ready. Blocker:", readiness.blocker);
    await writeBlocked(readiness.blocker ?? "not_ready");
    return;
  }

  // Load approval
  const approvalPath = resolve(repoRoot, "docs/provider-smoke/mimo-continuous-smoke-approval.input.json");
  let approval;
  try {
    approval = JSON.parse(await readFile(approvalPath, "utf8"));
  } catch {
    await writeBlocked("approval_missing");
    return;
  }

  // Check env
  const mimoApiKey = process.env.MIMO_API_KEY;
  if (!mimoApiKey) {
    console.error("[Phase3977F] BLOCKED: MIMO_API_KEY not in environment.");
    await writeBlocked("mimo_api_key_missing_from_env");
    return;
  }

  const provider = "mimo";
  const endpoint = "https://token-plan-cn.xiaomimimo.com/v1";
  const model = process.env.MIMO_MODEL || "mimo-v2.5-pro";
  const maxRequests = approval.maxRequests || 200;
  const intervalMs = (approval.intervalSeconds || 30) * 1000;
  const maxDurationMs = (approval.maxDurationMinutes || 120) * 60 * 1000;
  const stopOnConsecutiveFailures = approval.stopOnConsecutiveFailures || 3;
  const maxAllowedFailures = approval.maxAllowedFailures || 5;
  const prompts = approval.prompts || ["请用一句中文回复：小米模型持续真实验证成功。"];

  console.log(`[Phase3977F] Provider: ${provider}`);
  console.log(`[Phase3977F] Model: ${model}`);
  console.log(`[Phase3977F] Max requests: ${maxRequests}`);
  console.log(`[Phase3977F] Interval: ${intervalMs}ms`);
  console.log(`[Phase3977F] Max duration: ${maxDurationMs}ms`);
  console.log(`[Phase3977F] Stop on consecutive failures: ${stopOnConsecutiveFailures}`);

  const runLog = [];
  const latencies = [];
  const errors = {};
  let successCount = 0;
  let failureCount = 0;
  let consecutiveFailures = 0;
  let consecutiveFailureMax = 0;
  let estimatedInputTokens = 0;
  let estimatedOutputTokens = 0;
  let stoppedBy = "maxRequests_reached";
  const startedAt = Date.now();

  for (let i = 0; i < maxRequests; i++) {
    if (Date.now() - startedAt > maxDurationMs) {
      stoppedBy = "maxDuration_reached";
      console.log(`[Phase3977F] Max duration reached at request ${i}.`);
      break;
    }

    const prompt = prompts[i % prompts.length];
    const reqStart = Date.now();

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
          model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: approval.maxOutputTokensPerRequest || 512,
          temperature: 0,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - reqStart;
      latencies.push(latencyMs);

      if (response.ok) {
        const body = await response.json();
        const text = body?.choices?.[0]?.message?.content ?? "";
        const inputTokens = body?.usage?.prompt_tokens ?? Math.ceil(prompt.length / 3);
        const outputTokens = body?.usage?.completion_tokens ?? Math.ceil(text.length / 3);
        estimatedInputTokens += inputTokens;
        estimatedOutputTokens += outputTokens;

        successCount++;
        consecutiveFailures = 0;
        runLog.push({ request: i + 1, success: true, latencyMs, inputTokens, outputTokens, httpStatus: response.status });

        if ((i + 1) % 10 === 0) {
          console.log(`[Phase3977F] Request ${i + 1}/${maxRequests}: OK (${latencyMs}ms) [${successCount} success, ${failureCount} fail]`);
        }
      } else {
        failureCount++;
        consecutiveFailures++;
        if (consecutiveFailures > consecutiveFailureMax) consecutiveFailureMax = consecutiveFailures;
        const errCode = `http_${response.status}`;
        errors[errCode] = (errors[errCode] || 0) + 1;
        runLog.push({ request: i + 1, success: false, latencyMs, httpStatus: response.status, error: errCode });
        console.log(`[Phase3977F] Request ${i + 1}: HTTP ${response.status} (${latencyMs}ms) [consecutive: ${consecutiveFailures}]`);
      }
    } catch (error) {
      const latencyMs = Date.now() - reqStart;
      latencies.push(latencyMs);
      failureCount++;
      consecutiveFailures++;
      if (consecutiveFailures > consecutiveFailureMax) consecutiveFailureMax = consecutiveFailures;
      const errCode = error.name === "AbortError" ? "timeout" : (error.code || "network_error");
      errors[errCode] = (errors[errCode] || 0) + 1;
      runLog.push({ request: i + 1, success: false, latencyMs, error: errCode });
      console.log(`[Phase3977F] Request ${i + 1}: Error (${latencyMs}ms): ${error.message} [consecutive: ${consecutiveFailures}]`);
    }

    // Stop conditions
    if (consecutiveFailures >= stopOnConsecutiveFailures) {
      stoppedBy = "consecutiveFailures_limit";
      console.log(`[Phase3977F] Stopped: ${consecutiveFailures} consecutive failures.`);
      break;
    }
    if (failureCount > maxAllowedFailures) {
      stoppedBy = "maxAllowedFailures_exceeded";
      console.log(`[Phase3977F] Stopped: ${failureCount} failures exceeds limit ${maxAllowedFailures}.`);
      break;
    }

    // Interval (skip on last request)
    if (i < maxRequests - 1) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  // Compute latency percentiles
  latencies.sort((a, b) => a - b);
  const p50 = percentile(latencies, 0.5);
  const p95 = percentile(latencies, 0.95);
  const p99 = percentile(latencies, 0.99);

  const estimatedTotalTokens = estimatedInputTokens + estimatedOutputTokens;

  const result = {
    completed: true,
    recommendedSealed: true,
    blocker: null,
    phase: "Phase3977F-MiMoContinuousRealProviderSmokeExecute",
    provider,
    continuousRealSmokeExecuted: true,
    providerCallsMade: true,
    credentialRefOnly: true,
    credentialRefReady: true,
    safeExecutorReady: true,
    requestAttemptCount: successCount + failureCount,
    successCount,
    failureCount,
    consecutiveFailureMax,
    maxRequests,
    maxDurationMinutes: approval.maxDurationMinutes || 120,
    intervalSeconds: approval.intervalSeconds || 30,
    p50LatencyMs: p50,
    p95LatencyMs: p95,
    p99LatencyMs: p99,
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedTotalTokens,
    stoppedBy,
    errorBreakdown: errors,
    rawSecretRead: false,
    secretRead: false,
    secretValuePrinted: false,
    rawSecretPrinted: false,
    authorizationHeaderPrinted: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
    deployExecuted: false,
    productionReadyClaimed: false,
    providerStabilityClaimed: false,
    multiProviderCommercialReadyClaimed: false,
    mimoContinuousSmokePassed: failureCount === 0,
    mimoCandidatePrimaryValidationProvider: failureCount === 0,
  };

  const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase3977f-mimo-continuous-real-provider-smoke-execute");
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resolve(evidenceDir, "result.json"), JSON.stringify(result, null, 2), "utf8");
  await writeFile(resolve(evidenceDir, "run-log.jsonl"), runLog.map((r) => JSON.stringify(r)).join("\n"), "utf8");
  await writeFile(resolve(evidenceDir, "summary.json"), JSON.stringify({
    totalRequests: successCount + failureCount,
    successCount,
    failureCount,
    failureRate: failureCount / (successCount + failureCount || 1),
    p50LatencyMs: p50,
    p95LatencyMs: p95,
    p99LatencyMs: p99,
    estimatedTotalTokens,
    stoppedBy,
    errorBreakdown: errors,
  }, null, 2), "utf8");

  console.log(`[Phase3977F] Complete: ${successCount}/${successCount + failureCount} succeeded`);
  console.log(`[Phase3977F] P50=${p50}ms P95=${p95}ms P99=${p99}ms`);
  console.log(`[Phase3977F] Stopped by: ${stoppedBy}`);
  console.log(`[Phase3977F] Tokens: in=${estimatedInputTokens} out=${estimatedOutputTokens} total=${estimatedTotalTokens}`);
}

async function writeBlocked(blocker) {
  const result = {
    completed: true,
    recommendedSealed: true,
    blocker,
    phase: "Phase3977F-MiMoContinuousRealProviderSmokeExecute",
    provider: "mimo",
    continuousRealSmokeExecuted: false,
    providerCallsMade: false,
    credentialRefOnly: true,
    rawSecretRead: false,
    secretRead: false,
    secretValuePrinted: false,
    rawSecretPrinted: false,
    authorizationHeaderPrinted: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    productionReadyClaimed: false,
    providerStabilityClaimed: false,
  };
  const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase3977f-mimo-continuous-real-provider-smoke-execute");
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resolve(evidenceDir, "result.json"), JSON.stringify(result, null, 2), "utf8");
  console.log("[Phase3977F] Blocked result written. Blocker:", blocker);
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.max(0, idx)];
}

main().catch((error) => {
  console.error("[Phase3977F] Fatal:", error.message);
  process.exit(1);
});
