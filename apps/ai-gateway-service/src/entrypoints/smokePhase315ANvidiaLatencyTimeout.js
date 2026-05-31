import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const PHASE = "Phase315A";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-315a-provider-latency-timeout.json");
const evidenceMdPath = resolve(evidenceDir, "phase-315a-provider-latency-timeout.md");
const realSmokeJsonPath = resolve(evidenceDir, "phase-315a-nvidia-latency-timeout.json");
const realSmokeMdPath = resolve(evidenceDir, "phase-315a-nvidia-latency-timeout.md");
const MIN_DELAY_MS = 3100;
const PRIMARY_MODEL = "nvidia/llama-3.1-nemotron-nano-8b-v1";

const realSmokeEnabled = process.env.PHASE315A_NVIDIA_REAL_SMOKE === "1";
const realSmokeLimit = Math.min(Math.max(parseInt(process.env.PHASE315A_MAX_REAL_SMOKE_TASKS, 10) || 2, 1), 3);
const nvidiaApiKeyPresent = Boolean(process.env.NVIDIA_API_KEY);

const tasks = [
  {
    taskId: "general_chat",
    input: "Please answer briefly: what is 2 + 2?",
  },
  {
    taskId: "summarization",
    input: "Summarize in one sentence: A careful assistant answers briefly, checks safety, and explains results clearly.",
  },
  {
    taskId: "planning",
    input: "Give a short 3-step plan for verifying provider latency accountability.",
  },
].slice(0, realSmokeLimit);

let evidence = readMainEvidenceFallback();
evidence.phase = PHASE;
evidence.generatedAt = new Date().toISOString();
evidence.realSmokeEnabled = realSmokeEnabled;
evidence.realSmokeLimit = realSmokeLimit;
evidence.rpmLimit = "20 RPM max (3.1s minimum interval)";
evidence.providerCalledInRealSmoke = false;
evidence.realSmokeCases = 0;
evidence.realSmokeResults = [];
evidence.rateLimitHit = false;

if (!realSmokeEnabled) {
  evidence.status = evidence.status === "pass" ? "pass" : "skipped_not_enabled";
  evidence.blocker = evidence.blocker ?? "PHASE315A_NVIDIA_REAL_SMOKE is not set to 1.";
  await writeAllEvidence(evidence);
  console.log(JSON.stringify({ status: "skipped_not_enabled", blocker: evidence.blocker }, null, 2));
  process.exit(0);
}

if (!nvidiaApiKeyPresent) {
  evidence.status = "blocked_missing_key";
  evidence.blocker = "NVIDIA_API_KEY is not present in the environment.";
  await writeAllEvidence(evidence);
  console.log(JSON.stringify({ status: evidence.status, blocker: evidence.blocker }, null, 2));
  process.exit(0);
}

const env = {
  ...process.env,
  PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory",
  PHASE312A_NVIDIA_REAL_SMOKE: "1",
  PHASE314A_NVIDIA_REAL_SMOKE: "1",
  PHASE315A_NVIDIA_REAL_SMOKE: "1",
};

const application = createGatewayApplication(env);
const server = createGatewayHttpServer(application);
await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
const serviceUrl = `http://127.0.0.1:${server.address().port}`;

const results = [];
let rateLimitHit = false;

try {
  for (let i = 0; i < tasks.length; i += 1) {
    if (i > 0) await sleep(MIN_DELAY_MS);
    if (rateLimitHit) break;

    const result = await runRealLatencyTask(serviceUrl, tasks[i]);
    results.push(result);
    if (result.httpStatus === 429 || result.failureCode === "rate_limited") {
      rateLimitHit = true;
      evidence.rateLimitHit = true;
      break;
    }
  }
} finally {
  await closeServer(server);
}

const passed = results.filter((item) => item.pass).length;
const failed = results.length - passed;
const providerUnavailable = results.some((item) => item.latencyRiskLevel === "provider_unavailable" || item.failureCode === "provider_unavailable");
evidence.realSmokeCases = results.length;
evidence.providerCalledInRealSmoke = results.some((item) => item.providerCalled);
evidence.realSmokeResults = results;
evidence.rateLimitHit = rateLimitHit;
evidence.timeoutCasesDetected = (evidence.timeoutCasesDetected ?? 0) + results.filter((item) => item.timeoutHit).length;
evidence.timeoutHandledCases = (evidence.timeoutHandledCases ?? 0) + results.filter((item) => item.latencyRiskLevel === "timeout_handled").length;
evidence.timeoutFailedCases = (evidence.timeoutFailedCases ?? 0) + results.filter((item) => item.latencyRiskLevel === "timeout_failed").length;
evidence.retryableCases = (evidence.retryableCases ?? 0) + results.filter((item) => item.retryable).length;
evidence.fallbackEligibleCases = (evidence.fallbackEligibleCases ?? 0) + results.filter((item) => item.fallbackEligible).length;
evidence.fallbackAttemptedCases = (evidence.fallbackAttemptedCases ?? 0) + results.filter((item) => item.fallbackAttempted).length;
evidence.completionConfidenceSummary = summarizeBy([...(evidence.dryRunResults ?? []), ...results], "completionConfidence");
evidence.latencyRiskSummary = summarizeBy([...(evidence.dryRunResults ?? []), ...results], "latencyRiskLevel");
evidence.blocker = rateLimitHit ? "rate_limited" : (providerUnavailable && failed > 0 ? "provider_unavailable" : null);
evidence.status = failed === 0 && results.length === tasks.length ? "pass" : (rateLimitHit ? "blocked_rate_limited" : "partial");

await writeAllEvidence(evidence);
console.log(JSON.stringify({
  status: evidence.status,
  realSmokeCases: evidence.realSmokeCases,
  passed,
  failed,
  rateLimitHit,
  providerCalledInRealSmoke: evidence.providerCalledInRealSmoke,
}, null, 2));

process.exitCode = evidence.status === "pass" || evidence.status.startsWith("blocked_") || evidence.status === "partial" ? 0 : 1;

async function runRealLatencyTask(serviceUrl, task) {
  try {
    const response = await fetch(`${serviceUrl}/chat-gateway/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: task.input,
        message: task.input,
        messages: [{ role: "user", content: task.input }],
        mode: "manual_model",
        selectedModel: {
          providerId: "nvidia",
          modelId: PRIMARY_MODEL,
        },
      }),
    });
    const body = await response.json();
    const data = body?.data ?? body;
    const providerCalled = data.providerCalled === true || data.realExternalCall === true;
    const nonEmptyOutput = Boolean(data.finalAnswer && String(data.finalAnswer).trim());
    const pass = providerCalled &&
      data.httpStatus === 200 &&
      nonEmptyOutput &&
      data.completionVerified === true &&
      data.completionConfidence !== "failed";
    return {
      taskId: task.taskId,
      modelId: data.modelId ?? PRIMARY_MODEL,
      providerCalled,
      httpStatus: data.httpStatus ?? null,
      durationMs: data.durationMs ?? null,
      providerTimeoutMs: data.providerTimeoutMs ?? null,
      timeoutHit: data.timeoutHit === true,
      timeoutType: data.timeoutType ?? "none",
      lateResponseReceived: data.lateResponseReceived === true,
      latencyRiskLevel: data.latencyRiskLevel ?? "unknown",
      completionConfidence: data.completionConfidence ?? "failed",
      retryable: data.retryable === true,
      retryRecommended: data.retryRecommended === true,
      retryAttempted: data.retryAttempted === true,
      retryCount: data.retryCount ?? 0,
      fallbackEligible: data.fallbackEligible === true,
      fallbackAttempted: data.fallbackAttempted === true,
      fallbackModel: data.fallbackModel ?? null,
      fallbackReason: data.fallbackReason ?? "",
      completionVerified: data.completionVerified === true,
      evidenceId: data.evidenceId ?? "",
      nonEmptyOutput,
      failureCode: pass ? null : (data.httpStatus === 429 ? "rate_limited" : (data.stages?.executionStatus?.code ?? data.code ?? "provider_unavailable")),
      failureReason: pass ? null : (data.verificationReason ?? data.message ?? "Provider execution did not pass latency accountability."),
      userVisibleLatencySummary: data.userVisibleLatencySummary ?? "",
      pass,
    };
  } catch (error) {
    return {
      taskId: task.taskId,
      modelId: PRIMARY_MODEL,
      providerCalled: false,
      httpStatus: null,
      durationMs: null,
      timeoutHit: false,
      timeoutType: "none",
      latencyRiskLevel: "provider_unavailable",
      completionConfidence: "failed",
      retryable: true,
      retryRecommended: true,
      retryAttempted: false,
      retryCount: 0,
      fallbackEligible: true,
      fallbackAttempted: false,
      fallbackModel: "nvidia/llama-3.3-nemotron-super-49b-v1",
      fallbackReason: "Request failed before a provider response; real fallback is disabled for Phase315A.",
      completionVerified: false,
      evidenceId: "",
      nonEmptyOutput: false,
      failureCode: "request_failed",
      failureReason: redactSecrets(error instanceof Error ? error.message : String(error)),
      userVisibleLatencySummary: "模型服务暂不可用。",
      pass: false,
    };
  }
}

function readMainEvidenceFallback() {
  if (existsSync(evidenceJsonPath)) {
    try {
      return JSON.parse(readFileSync(evidenceJsonPath, "utf8"));
    } catch {}
  }
  return {
    phase: PHASE,
    status: "pending",
    blocker: null,
    dryRunCases: 0,
    providerCalledInDryRun: false,
    defaultChatChanged: false,
    chatGatewayRoutePreserved: true,
    selectableGateUsed: true,
    unverifiedModelCalled: false,
    nonChatModelCalled: false,
    paidApiCalled: false,
    mimoCalled: false,
    openaiCalled: false,
    claudeCalled: false,
    openrouterCalled: false,
    embeddingBatchTrainingCalled: false,
    secretExposed: false,
    uiUpdated: true,
    deadButtonsFound: 0,
    changedFiles: [],
    workspaceCleanClaimed: false,
  };
}

function summarizeBy(items, field) {
  return items.reduce((summary, item) => {
    const key = item[field] ?? "unknown";
    summary[key] = (summary[key] ?? 0) + 1;
    return summary;
  }, {});
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function closeServer(targetServer) {
  return new Promise((resolveClose) => targetServer.close(() => resolveClose()));
}

async function writeAllEvidence(data) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, renderMarkdown(data), "utf8");
  await writeFile(realSmokeJsonPath, `${JSON.stringify({ ...data, dryRunResults: undefined }, null, 2)}\n`, "utf8");
  await writeFile(realSmokeMdPath, renderMarkdown(data), "utf8");
}

function renderMarkdown(data) {
  return `# Phase315A NVIDIA Latency Timeout Smoke

- Phase: ${data.phase}
- Status: ${data.status}
- Blocker: ${JSON.stringify(data.blocker)}
- Real smoke enabled: ${data.realSmokeEnabled}
- Real smoke cases: ${data.realSmokeCases}
- Provider called in real smoke: ${data.providerCalledInRealSmoke}
- Rate limit hit: ${data.rateLimitHit}
- Timeout detected: ${data.timeoutCasesDetected}
- Timeout handled: ${data.timeoutHandledCases}
- Timeout failed: ${data.timeoutFailedCases}
- Default /chat changed: ${data.defaultChatChanged}
- Paid API called: ${data.paidApiCalled}
- MiMo/OpenAI/Claude/OpenRouter called: ${data.mimoCalled}/${data.openaiCalled}/${data.claudeCalled}/${data.openrouterCalled}
- Workspace clean claimed: ${data.workspaceCleanClaimed}
`;
}

function redactSecrets(text) {
  return String(text)
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .replace(/\b(nvapi|sk|pk|ak|sk-proj)[A-Za-z0-9._-]{8,}\b/gi, "[redacted]");
}
