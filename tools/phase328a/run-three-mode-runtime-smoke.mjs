import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../apps/ai-gateway-service/src/http/httpServer.js";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase328a");
const reportPath = resolve(repoRoot, "docs/phase328a-three-mode-runtime-smoke-report.md");

const mode = parseMode();
const smokeModes = mode === "all" ? ["normal", "god", "tianshu"] : [mode];

const application = createGatewayApplication(process.env);
const server = createGatewayHttpServer(application);
const baseUrl = await listen(server);
const results = [];

try {
  await mkdir(evidenceDir, { recursive: true });
  for (const item of smokeModes) {
    const result = await runSmoke(item);
    results.push(result);
    await writeFile(resolve(evidenceDir, `three-mode-${item}-runtime-smoke.json`), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }
  await writeFile(reportPath, renderReport(results), "utf8");
  console.log(JSON.stringify({ phase: "Phase328A", mode, results: results.map((item) => ({ mode: item.mode, status: item.status, success: item.success })) }, null, 2));
  if (results.some((item) => item.status !== "pass")) process.exitCode = 1;
} finally {
  await close(server);
}

function parseMode() {
  const index = process.argv.indexOf("--mode");
  const value = index >= 0 ? process.argv[index + 1] : "all";
  if (!["normal", "god", "tianshu", "all"].includes(value)) throw new Error("--mode must be normal, god, tianshu, or all");
  return value;
}

async function runSmoke(smokeMode) {
  const request = requestForMode(smokeMode);
  const response = await fetch(`${baseUrl}/three-mode/execute`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  const payload = await response.json();
  const data = payload.data ?? {};
  const auditTrace = data.auditTrace ?? {};
  const finalAnswerPresent = String(data.finalAnswer ?? "").trim().length > 0;
  const status = payload.success === true && finalAnswerPresent && auditTrace.providerCallsMade === true ? "pass" : "fail";
  return {
    phase: "Phase328A",
    mode: smokeMode,
    status,
    success: payload.success === true,
    httpStatus: response.status,
    request,
    response: payload,
    selectedModelId: data.selectedModel?.modelId ?? null,
    selectedModels: data.plannerDecision?.selectedModels ?? (data.selectedModel?.modelId ? [data.selectedModel.modelId] : []),
    participantModels: (data.participantModels ?? []).map((item) => item.modelId),
    participantCallCount: Number(auditTrace.participantCallCount ?? 0),
    supervisorCallCount: Number(auditTrace.supervisorCallCount ?? 0),
    supervisorDecisionPresent: Boolean(data.supervisorDecision),
    plannerDecisionPresent: Boolean(data.plannerDecision),
    finalAnswerPresent,
    providerCallsMade: auditTrace.providerCallsMade === true,
    nonNvidiaProviderCallsMade: auditTrace.nonNvidiaProviderCallsMade === true,
    secretValueExposed: auditTrace.secretValueExposed === true,
    fallbackUsed: auditTrace.fallbackUsed === true,
    generatedAt: new Date().toISOString(),
  };
}

function requestForMode(smokeMode) {
  if (smokeMode === "normal") {
    return {
      requestId: "phase328a-test-normal-001",
      mode: "normal",
      input: { content: "用一句话介绍当前系统三模式" },
      modelSelection: { selectedModelId: "meta/llama-3.2-1b-instruct" },
      executionPolicy: { timeoutMs: 60000, allowFallback: true, allowParallelExecution: false, allowGodEscalation: false },
      audit: { traceEnabled: true },
    };
  }
  if (smokeMode === "god") {
    return {
      requestId: "phase328a-test-god-001",
      mode: "god",
      input: { content: "评估这个产品三模式设计的优缺点，用三句话回答" },
      modelSelection: {
        participantModelIds: ["meta/llama-3.2-1b-instruct", "nvidia/nemotron-mini-4b-instruct"],
        supervisorModelId: "meta/llama-3.2-3b-instruct",
        allowSystemModelSelection: true,
      },
      executionPolicy: { timeoutMs: 120000, allowParallelExecution: true, maxParticipants: 2 },
      audit: { traceEnabled: true, includeModelContributions: true },
    };
  }
  return {
    requestId: "phase328a-test-tianshu-001",
    mode: "tianshu",
    input: { content: "帮我判断这个任务应该用哪个模型完成：写一个代码审查报告" },
    executionPolicy: { timeoutMs: 120000, allowFallback: true, allowGodEscalation: true },
    audit: { traceEnabled: true, includePlannerDecision: true },
  };
}

function renderReport(items) {
  return [
    "# Phase328A Three Mode Runtime Smoke Report",
    "",
    ...items.flatMap((item) => [
      `## ${item.mode}`,
      "",
      `- status: ${item.status}`,
      `- success: ${item.success}`,
      `- providerCallsMade: ${item.providerCallsMade}`,
      `- nonNvidiaProviderCallsMade: ${item.nonNvidiaProviderCallsMade}`,
      `- secretValueExposed: ${item.secretValueExposed}`,
      `- finalAnswerPresent: ${item.finalAnswerPresent}`,
      `- selectedModelId: ${item.selectedModelId ?? "n/a"}`,
      `- participantCallCount: ${item.participantCallCount}`,
      `- supervisorCallCount: ${item.supervisorCallCount}`,
      "",
    ]),
  ].join("\n");
}

function listen(targetServer) {
  return new Promise((resolveListen) => {
    targetServer.listen(0, "127.0.0.1", () => {
      const address = targetServer.address();
      resolveListen(`http://127.0.0.1:${address.port}`);
    });
  });
}

function close(targetServer) {
  return new Promise((resolveClose) => targetServer.close(resolveClose));
}
