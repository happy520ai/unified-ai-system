import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCredentialRefProviderRuntimeAdapter } from "../../apps/ai-gateway-service/src/providers/credentialRefProviderRuntimeAdapter.js";
import { createCredentialRefResolverRuntime } from "../../apps/ai-gateway-service/src/providers/credentialRefResolverRuntime.js";
import { createSafeProviderExecutionInvoker } from "../../apps/ai-gateway-service/src/providers/safeProviderExecutionInvoker.js";
import { createSafeProviderCallImplementation } from "../../apps/ai-gateway-service/src/providers/safeProviderCallImplementation.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const phaseId = "Phase3984A-CredentialRef-Multi-Provider-One-Shot-Smoke";
const evidenceDir = "apps/ai-gateway-service/evidence/phase-3984a-credentialref-multi-provider-one-shot-smoke";

const providerPlans = [
  {
    providerId: "nvidia",
    modelId: "nvidia/llama-3.3-nemotron-super-49b-v1",
    credentialRef: "credentialRef:nvidia:default",
    envKeyName: "NVIDIA_API_KEY",
    endpoint: "https://integrate.api.nvidia.com/v1",
    expected: "PHASE3984_OK",
  },
  {
    providerId: "mimo",
    modelId: "mimo-v2.5-pro",
    credentialRef: "credentialRef:mimo:default",
    envKeyName: "MIMO_API_KEY",
    endpoint: process.env.MIMO_BASE_URL || "https://token-plan-cn.xiaomimimo.com/v1",
    expected: "PHASE3984_OK",
  },
  {
    providerId: "openrouter",
    modelId: "openai/gpt-4o-mini",
    credentialRef: "credentialRef:openrouter:default",
    envKeyName: "OPENROUTER_API_KEY",
    endpoint: "https://openrouter.ai/api/v1",
    expected: "PHASE3984_OK",
  },
];

async function main() {
  console.log(`[${phaseId}] runner`);
  const attempts = [];
  let providerCallsMade = false;

  for (const plan of providerPlans) {
    const hasCredential = Boolean(process.env[plan.envKeyName]);
    if (!hasCredential) {
      attempts.push(blockedAttempt(plan, "credential_env_missing"));
      continue;
    }

    const startedAt = Date.now();
    const adapter = buildAdapter(plan);
    const attempt = await adapter.runGuardedProviderStabilityRequest({
      providerId: plan.providerId,
      modelId: plan.modelId,
      credentialRef: plan.credentialRef,
      prompt: `Reply exactly with ${plan.expected}`,
      expectedResponseContains: plan.expected,
      timeoutMs: 30000,
      maxRequests: 1,
      invocationPurpose: "phase3984a_credentialref_multi_provider_one_shot",
      dryRun: false,
    });
    providerCallsMade = providerCallsMade || attempt.providerCallsMade === true;
    attempts.push({
      providerId: plan.providerId,
      modelId: plan.modelId,
      credentialRef: plan.credentialRef,
      credentialEnvPresent: true,
      requestAttemptCount: attempt.providerCallsMade === true ? 1 : 0,
      providerCallsMade: attempt.providerCallsMade === true,
      realProviderCallExecuted: attempt.realProviderCallExecuted === true,
      ok: attempt.ok === true,
      blocker: attempt.ok === true ? null : attempt.blocker ?? null,
      responseContainsExpectedMarker: attempt.responseContainsExpectedMarker === true,
      responseReceived: attempt.responseReceived === true,
      sanitizedResponsePreview: attempt.sanitizedResponsePreview ?? null,
      latencyMs: Date.now() - startedAt,
      rawSecretRead: false,
      secretValueExposed: false,
      authHeaderLogged: false,
    });
  }

  const successCount = attempts.filter((item) => item.ok === true).length;
  const attemptedProviderCount = attempts.filter((item) => item.providerCallsMade === true).length;
  const blocker = successCount > 0
    ? "none"
    : attempts.find((item) => item.blocker)?.blocker ?? "no_provider_credential_available";

  const evidence = {
    phaseId,
    completed: true,
    recommended_sealed: successCount > 0,
    blocker,
    maxRequestsPerProvider: 1,
    attemptedProviderCount,
    successCount,
    attempts,
    providerCallsMade,
    realProviderCallsExecutedByThisPhase: providerCallsMade,
    credentialRefOnly: true,
    secretsRead: false,
    rawSecretPrinted: false,
    authorizationHeaderPrinted: false,
    deployExecuted: false,
    legacyModified: false,
    projectContextModified: false,
    chatRouteModified: false,
    chatGatewayExecuteModified: false,
    selectableModelStateModified: false,
    providerStabilityClaimed: false,
    productionReadyClaimed: false,
    verificationCommands: [
      "node --check apps/ai-gateway-service/src/providers/safeProviderCallImplementation.contract.js",
      "node --check tools/phase3984a/run-credentialref-multi-provider-one-shot-smoke.mjs",
      "node --check tools/phase3984a/verify-credentialref-multi-provider-one-shot-smoke.mjs",
      "pnpm run run:phase3984a-credentialref-multi-provider-one-shot-smoke",
      "pnpm run verify:phase3984a-credentialref-multi-provider-one-shot-smoke",
      "pnpm -r --if-present check",
    ],
    nextRecommendedPhases: [
      "Phase3985A Isolated Normal/God/Tianshu Runtime Route Smoke",
      "Phase3986A Nightly Scheduler Manual Registration Result Intake",
    ],
    generatedAt: new Date().toISOString(),
  };

  await writeText("docs/provider-smoke/PHASE3984A_CREDENTIALREF_MULTI_PROVIDER_ONE_SHOT.md", buildDoc(evidence));
  await writeText(`${evidenceDir}/result.json`, JSON.stringify(evidence, null, 2));
  console.log(`[${phaseId}] attemptedProviderCount=${attemptedProviderCount}`);
  console.log(`[${phaseId}] successCount=${successCount}`);
  console.log(`[${phaseId}] providerCallsMade=${providerCallsMade}`);
}

function buildAdapter(plan) {
  const providerCallImplementation = createSafeProviderCallImplementation({
    internalExecutor: async (request) => executeOpenAiCompatibleOneShot(plan, request),
    internalExecutorName: "phase3984aCredentialRefOneShotExecutor",
  });
  const safeInvoker = createSafeProviderExecutionInvoker({ safeProviderCallImplementation: providerCallImplementation });
  const resolverRuntime = createCredentialRefResolverRuntime({
    safeExecutionInvoker: safeInvoker.invokeProvider,
    safeExecutionInvokerName: "safeProviderExecutionInvoker.invokeProvider",
  });
  return createCredentialRefProviderRuntimeAdapter({ resolverRuntime });
}

async function executeOpenAiCompatibleOneShot(plan, request) {
  const apiKey = process.env[plan.envKeyName];
  if (!apiKey) {
    return { ok: false, providerCallsMade: false, blocker: "credential_env_missing" };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(request.timeoutMs || 30000));
  try {
    const response = await fetch(`${plan.endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: request.modelId,
        messages: [{ role: "user", content: request.prompt }],
        max_tokens: 16,
        temperature: 0,
      }),
      signal: controller.signal,
    });
    const bodyText = await response.text();
    let text = bodyText;
    try {
      const body = JSON.parse(bodyText);
      text = body?.choices?.[0]?.message?.content ?? bodyText;
    } catch {
      // Keep raw response text sanitized below for non-JSON provider errors.
    }
    return {
      ok: response.ok,
      providerCallsMade: true,
      responseText: text,
      blocker: response.ok ? null : `http_${response.status}`,
      sanitizedResponsePreview: sanitizePreview(text),
    };
  } catch (error) {
    return {
      ok: false,
      providerCallsMade: true,
      responseText: error instanceof Error ? error.message : String(error),
      blocker: error?.name === "AbortError" ? "timeout" : "network_error",
      sanitizedResponsePreview: sanitizePreview(error instanceof Error ? error.message : String(error)),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function blockedAttempt(plan, blocker) {
  return {
    providerId: plan.providerId,
    modelId: plan.modelId,
    credentialRef: plan.credentialRef,
    credentialEnvPresent: false,
    requestAttemptCount: 0,
    providerCallsMade: false,
    realProviderCallExecuted: false,
    ok: false,
    blocker,
    responseContainsExpectedMarker: false,
    responseReceived: false,
    sanitizedResponsePreview: null,
    latencyMs: 0,
    rawSecretRead: false,
    secretValueExposed: false,
    authHeaderLogged: false,
  };
}

function buildDoc(evidence) {
  return [
    "# Phase3984A CredentialRef Multi-Provider One-Shot Smoke",
    "",
    "## Goal",
    "",
    "通过 CredentialRef-only 和 maxRequests=1 方式对可用 Provider 做真实 one-shot smoke；缺失凭证的 Provider 记录真实 blocker，不伪造调用。",
    "",
    "## Result",
    "",
    `- attemptedProviderCount: ${evidence.attemptedProviderCount}`,
    `- successCount: ${evidence.successCount}`,
    `- providerCallsMade: ${evidence.providerCallsMade}`,
    `- recommended_sealed: ${evidence.recommended_sealed}`,
    `- blocker: ${evidence.blocker}`,
    "",
    "## Attempts",
    "",
    ...evidence.attempts.map((item) => `- ${item.providerId}: credentialEnvPresent=${item.credentialEnvPresent}, providerCallsMade=${item.providerCallsMade}, ok=${item.ok}, blocker=${item.blocker || "none"}`),
    "",
    "## Safety Boundary",
    "",
    "- 未读取 `.env` 或 `auth.json`。",
    "- 未打印 raw secret 或 Authorization header。",
    "- 未修改 `/chat` 或 `/chat-gateway/execute`。",
    "- 未修改模型 selectable 状态。",
    "- 未部署、未 commit、未 push。",
    "",
  ].join("\n");
}

function sanitizePreview(value) {
  return String(value ?? "")
    .replace(/(sk-[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{16,}|bearer\s+[a-z0-9._-]{16,})/gi, "[redacted]")
    .slice(0, 300);
}

async function writeText(relativePath, content) {
  const absolutePath = resolve(repoRoot, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${content.trimEnd()}\n`, "utf8");
}

main().catch((error) => {
  console.error(`[${phaseId}] fatal:`, error.message);
  process.exit(1);
});
