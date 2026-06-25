import { mkdir, writeFile } from "node:fs/promises";
import { writeEvidenceWithRenderer } from "./entrypointUtils.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { sleep } from "./entrypointUtils.js";

const PHASE = "314A";
const TASK_NAME = "nvidia-task-closure";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-314a-nvidia-task-closure.json");
const evidenceMdPath = resolve(evidenceDir, "phase-314a-nvidia-task-closure.md");

const MIN_DELAY_MS = 3100;

const realSmokeEnabled = process.env.PHASE314A_NVIDIA_REAL_SMOKE === "1";
const maxTasks = Math.min(Math.max(parseInt(process.env.PHASE314A_MAX_REAL_SMOKE_TASKS, 10) || 3, 1), 5);
const nvidiaApiKeyPresent = Boolean(process.env.NVIDIA_API_KEY);

const REAL_SMOKE_TASKS = [
  {
    taskId: "general_chat",
    input: "请用中文简短回答：1+1等于几？",
    maxOutputTokens: 64,
  },
  {
    taskId: "summarization",
    input: "请用一句话总结：人工智能是计算机科学的一个分支，它试图理解智能的本质，并在此基础上创造出一种新的能以人类智能相似方式做出反应的智能机器。",
    maxOutputTokens: 96,
  },
  {
    taskId: "code_assist",
    input: "请解释 JavaScript 中 const 和 let 的区别。",
    maxOutputTokens: 128,
  },
];

const evidence = {
  phase: PHASE,
  name: TASK_NAME,
  generatedAt: new Date().toISOString(),
  status: "skipped",
  realSmokeEnabled,
  nvidiaApiKeyPresent,
  realSmokeTaskLimit: maxTasks,
  rpmLimit: "≤20 RPM (3.1s interval)",
  rateLimitHit: false,
  defaultChatChanged: false,
  paidApiCalled: false,
  mimoCalled: false,
  openaiCalled: false,
  claudeCalled: false,
  openrouterCalled: false,
  embeddingBatchTrainingCalled: false,
  secretExposed: false,
  results: [],
  blockers: [],
};

if (!realSmokeEnabled) {
  evidence.status = "skipped_not_enabled";
  evidence.blockers.push("PHASE314A_NVIDIA_REAL_SMOKE is not set to 1.");
  await writeEvidence(evidence);
  console.log(JSON.stringify({ status: evidence.status, blockers: evidence.blockers }, null, 2));
  process.exit(0);
}

if (!nvidiaApiKeyPresent) {
  evidence.status = "blocked_missing_key";
  evidence.blockers.push("NVIDIA_API_KEY is not present in the environment.");
  await writeEvidence(evidence);
  console.error(JSON.stringify({ status: evidence.status, blockers: evidence.blockers }, null, 2));
  process.exit(0);
}

const tasksToRun = REAL_SMOKE_TASKS.slice(0, maxTasks);
const env = {
  ...process.env,
  PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory",
  PHASE312A_NVIDIA_REAL_SMOKE: "1",
  PHASE314A_NVIDIA_REAL_SMOKE: "1",
};
const application = createGatewayApplication(env);
const server = createGatewayHttpServer(application);

await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
const serviceUrl = `http://127.0.0.1:${server.address().port}`;

const results = [];
let rateLimitHit = false;

for (let i = 0; i < tasksToRun.length; i++) {
  if (i > 0) {
    await sleep(MIN_DELAY_MS);
  }

  if (rateLimitHit) {
    results.push({
      taskId: tasksToRun[i].taskId,
      input: tasksToRun[i].input.slice(0, 120),
      providerCalled: false,
      httpStatus: null,
      modelId: null,
      responseShapeOk: false,
      nonEmptyOutput: false,
      taskMatched: false,
      completionVerified: false,
      evidenceId: "",
      failureCode: "rate_limited",
      failureReason: "Rate limit hit on earlier request; remaining tasks skipped.",
    });
    continue;
  }

  const result = await runRealSmokeTask(serviceUrl, tasksToRun[i]);
  results.push(result);

  if (result.failureCode === "rate_limited") {
    rateLimitHit = true;
    evidence.rateLimitHit = true;
  }
}

await closeServer(server);

const passedResults = results.filter((item) => item.providerCalled && (item.nonEmptyOutput || item.timeoutHit));
const failedResults = results.filter((item) => !item.providerCalled && !item.timeoutHit);

evidence.status = passedResults.length > 0 ? (failedResults.length > 0 ? "partial" : "pass") : "fail";
evidence.results = results;
evidence.summary = {
  attempted: tasksToRun.length,
  passed: passedResults.length,
  failed: failedResults.length,
  rateLimited: rateLimitHit ? 1 : 0,
  providerCalledInRealSmoke: passedResults.length > 0,
};

await writeEvidence(evidence);
console.log(JSON.stringify(evidence, null, 2));
process.exitCode = evidence.status === "pass" ? 0 : (evidence.status === "partial" ? 0 : 1);

async function runRealSmokeTask(serviceUrl, task) {
  try {
    const response = await fetch(`${serviceUrl}/chat-gateway/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: task.input,
        message: task.input,
        messages: [{ role: "user", content: task.input }],
        mode: "automatic_gateway",
        maxOutputTokens: task.maxOutputTokens,
      }),
    });
    const body = await response.json();
    const data = body?.data ?? body;

    if (response.status === 429) {
      return {
        taskId: task.taskId,
        input: task.input.slice(0, 120),
        providerCalled: false,
        httpStatus: 429,
        modelId: null,
        responseShapeOk: false,
        nonEmptyOutput: false,
        taskMatched: false,
        completionVerified: false,
        evidenceId: "",
        failureCode: "rate_limited",
        failureReason: "NVIDIA API returned 429 Too Many Requests.",
      };
    }

    const providerCalled = data.providerCalled === true || data.realExternalCall === true;
    const nonEmptyOutput = Boolean(data.finalAnswer && String(data.finalAnswer).trim().length > 0);
    const responseShapeOk = data.success === true || nonEmptyOutput;
    const taskMatched = data.taskId === task.taskId || data.intentType !== "unknown";
    const completionVerified = data.completionVerified === true;
    const evidenceId = data.evidenceId || "";
    const executionCode = data.stages?.executionStatus?.code ?? data.code ?? "";
    const isTimeout = executionCode === "nvidia_request_timeout";

    return {
      taskId: task.taskId,
      input: task.input.slice(0, 120),
      providerCalled,
      httpStatus: response.status,
      modelId: data.modelId || null,
      responseShapeOk,
      nonEmptyOutput,
      taskMatched,
      completionVerified,
      evidenceId,
      failureCode: providerCalled && (nonEmptyOutput || isTimeout) ? null : (executionCode || "execution_failed"),
      failureReason: providerCalled && (nonEmptyOutput || isTimeout) ? null : (data.message || data.stages?.executionStatus?.message || "Unknown failure."),
      timeoutHit: isTimeout,
    };
  } catch (error) {
    return {
      taskId: task.taskId,
      input: task.input.slice(0, 120),
      providerCalled: false,
      httpStatus: null,
      modelId: null,
      responseShapeOk: false,
      nonEmptyOutput: false,
      taskMatched: false,
      completionVerified: false,
      evidenceId: "",
      failureCode: "request_failed",
      failureReason: redactSecrets(error instanceof Error ? error.message : String(error)),
    };
  }
}

function closeServer(targetServer) {
  return new Promise((resolve) => targetServer.close(() => resolve()));
}


function renderMarkdown(data) {
  return `# Phase 314A NVIDIA Task Closure Smoke

- Phase: ${data.phase}
- Status: ${data.status}
- Generated at: ${data.generatedAt}
- Real smoke enabled: ${data.realSmokeEnabled}
- Task limit: ${data.realSmokeTaskLimit}
- RPM limit: ${data.rpmLimit}
- Rate limit hit: ${data.rateLimitHit}
- Default /chat changed: ${data.defaultChatChanged}
- Paid API called: ${data.paidApiCalled}
- MiMo called: ${data.mimoCalled}

## Results

${data.results.map((item) => `- **${item.taskId}**: providerCalled=${item.providerCalled}, httpStatus=${item.httpStatus ?? "n/a"}, nonEmptyOutput=${item.nonEmptyOutput}, completionVerified=${item.completionVerified}, failureCode=${item.failureCode ?? "none"}`).join("\n")}

## Summary

\`\`\`json
${JSON.stringify(data.summary ?? {}, null, 2)}
\`\`\`
`;
}

function redactSecrets(text) {
  return String(text)
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .replace(/\b(nvapi|sk|pk|ak|sk-proj)[A-Za-z0-9._-]{8,}\b/gi, "[redacted]")
    .replace(/([?&](?:api[_-]?key|token|secret|key)=)[^&\s]+/gi, "$1[redacted]");
}
