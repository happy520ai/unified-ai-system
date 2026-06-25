// =============================================================================
// phaseUtils.js — Phase 相关工具函数
// 从 httpServer.js 提取的 Phase 312/314/315 等工具
// =============================================================================

/**
 * 运行 Phase 312A Chat Gateway
 */
export async function runPhase312AChatGateway({ application, body, startedAt }) {
  const input = String(body?.input ?? body?.message ?? body?.messages?.at?.(-1)?.content ?? "").trim();
  if (!input) {
    return {
      success: false,
      code: "phase312a_input_missing",
      message: "input is required",
      startedAt,
      durationMs: Date.now() - startedAt,
    };
  }

  const providerId = body?.providerId ?? body?.provider ?? "nvidia";
  const model = body?.model ?? "meta/llama-3.3-nemotron-super-49b-v1";

  try {
    const result = await application.gatewayService.execute({
      messages: [{ role: "user", content: input }],
      providerId,
      model,
      taskType: "chat",
    });

    return {
      success: result.success,
      code: result.code,
      message: result.message,
      data: result.data,
      startedAt,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      success: false,
      code: error?.code ?? "phase312a_execution_failed",
      message: error instanceof Error ? error.message : "Execution failed",
      startedAt,
      durationMs: Date.now() - startedAt,
    };
  }
}

/**
 * 创建 Phase 312A 真实调用禁用执行
 */
export function createPhase312ARealCallDisabledExecution(input, providerId, model, startedAt) {
  return {
    phase: "phase-312a-real-call-disabled",
    mode: "disabled",
    input: input.slice(0, 200),
    providerId,
    model,
    message: "Real provider calls are disabled. Enable with AI_GATEWAY_REAL_PROVIDER_ENABLED=true",
    startedAt,
    durationMs: Date.now() - startedAt,
  };
}

/**
 * 运行 Phase 314A Dry-Run 任务
 */
export async function runPhase314ADryRunTask({ application, body, startedAt }) {
  const goal = String(body?.goal ?? body?.input ?? "").trim();
  if (!goal) {
    return {
      success: false,
      code: "phase314a_goal_missing",
      message: "goal is required",
      startedAt,
      durationMs: Date.now() - startedAt,
    };
  }

  const plan = {
    id: `plan_${Date.now()}`,
    goal,
    tasks: [
      { id: "task_1", title: "Analyze goal", status: "pending" },
      { id: "task_2", title: "Generate solution", status: "pending" },
      { id: "task_3", title: "Validate output", status: "pending" },
    ],
    createdAt: Date.now(),
  };

  return createPhase314ADryRunExecution(plan, `evidence_${Date.now()}`);
}

/**
 * 创建 Phase 314A Dry-Run 执行
 */
export function createPhase314ADryRunExecution(plan, evidenceId) {
  return {
    phase: "phase-314a-dry-run",
    mode: "dry-run",
    plan,
    evidenceId,
    message: "Dry-run execution completed. No real provider calls made.",
    startedAt: Date.now(),
    durationMs: 0,
  };
}

/**
 * 运行 Phase 315A 延迟 Dry-Run
 */
export function runPhase315ALatencyDryRun(body = {}) {
  const testCases = body?.testCases ?? [
    { input: "Hello", expectedLatencyMs: 1000 },
    { input: "Write a poem", expectedLatencyMs: 3000 },
    { input: "Explain quantum computing", expectedLatencyMs: 5000 },
  ];

  return testCases.map((testCase) => buildPhase315ALatencyDryRunResult(testCase));
}

/**
 * 构建 Phase 315A 延迟 Dry-Run 结果
 */
export function buildPhase315ALatencyDryRunResult(testCase) {
  const simulatedLatency = testCase.expectedLatencyMs * (0.8 + Math.random() * 0.4);
  return {
    input: testCase.input,
    simulatedLatencyMs: Math.round(simulatedLatency),
    status: simulatedLatency < testCase.expectedLatencyMs * 1.5 ? "pass" : "warn",
    message: `Simulated latency: ${Math.round(simulatedLatency)}ms (expected: ${testCase.expectedLatencyMs}ms)`,
  };
}

/**
 * 响应延迟字段
 */
export function responseLatencyFields(execution, verification) {
  return {
    executionLatencyMs: execution?.durationMs ?? 0,
    verificationLatencyMs: verification?.durationMs ?? 0,
    totalLatencyMs: (execution?.durationMs ?? 0) + (verification?.durationMs ?? 0),
  };
}

/**
 * 构建用户可见摘要
 */
export function buildUserVisibleSummary({ verification, execution, plan }) {
  return {
    planGoal: plan?.goal ?? "Unknown",
    executionStatus: execution?.status ?? "unknown",
    verificationStatus: verification?.status ?? "unknown",
    summary: `Plan "${plan?.goal ?? "Unknown"}" executed with status "${execution?.status ?? "unknown"}"`,
  };
}

/**
 * 测试 Phase 312A 模型
 */
export async function testPhase312AModel({ application, body }) {
  const providerId = body?.providerId ?? "nvidia";
  const model = body?.model ?? "meta/llama-3.3-nemotron-super-49b-v1";

  try {
    const result = await application.gatewayService.execute({
      messages: [{ role: "user", content: "Say hello in one word" }],
      providerId,
      model,
      taskType: "chat",
    });

    return {
      success: result.success,
      providerId,
      model,
      response: result.data?.text?.slice(0, 100),
      durationMs: result.meta?.durationMs,
    };
  } catch (error) {
    return {
      success: false,
      providerId,
      model,
      error: error.message,
    };
  }
}

/**
 * 调用模型冒烟测试
 */
export async function callModelSmoke({ client, model }) {
  try {
    const start = Date.now();
    const response = await client.chat({
      messages: [{ role: "user", content: "Say hello" }],
      model,
    });
    return {
      success: true,
      latencyMs: Date.now() - start,
      response: response.text?.slice(0, 100),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 分类冒烟状态
 */
export function classifySmokeStatus(result) {
  if (result.success) return "pass";
  if (result.error?.includes("rate limit")) return "rate_limited";
  if (result.error?.includes("timeout")) return "timeout";
  return "fail";
}

/**
 * 规范化 Gateway 模式
 */
export function normalizeGatewayMode(mode) {
  const validModes = ["auto", "fixed", "registry-default"];
  return validModes.includes(mode) ? mode : "auto";
}

/**
 * 规范化模型选择
 */
export function normalizeModelSelection(value) {
  if (!value || typeof value !== "string") return null;
  const parts = value.split("/");
  if (parts.length === 2) return { provider: parts[0], model: parts[1] };
  return { model: value };
}

/**
 * 创建 Provider 列表
 */
export function createProviders(application) {
  return application.gatewayService.getProviderDescriptors().map((p) => ({
    id: p.id,
    name: p.name,
    enabled: p.enabled,
    modelCount: p.models?.length ?? 0,
  }));
}

/**
 * 设置运行时 Provider 凭据
 */
export function setRuntimeProviderCredential(application, body) {
  const { providerId, apiKey, baseUrl } = body;
  if (!providerId) throw new Error("providerId is required");
  if (!apiKey) throw new Error("apiKey is required");

  application.runtimeCredentialStore.set(providerId, { apiKey, baseUrl });
  return { success: true, providerId };
}

/**
 * 规范化运行时凭据模型
 */
export function normalizeRuntimeCredentialModels(body, providerId) {
  const models = body?.models ?? [];
  return models.map((m) => ({
    providerId,
    modelId: m.id ?? m.modelId,
    enabled: m.enabled ?? true,
  }));
}

/**
 * 清理凭据错误详情
 */
export function sanitizeCredentialErrorDetails(details) {
  if (!details) return null;
  const sanitized = { ...details };
  delete sanitized.apiKey;
  delete sanitized.secret;
  delete sanitized.token;
  delete sanitized.password;
  return sanitized;
}

/**
 * 创建路由模式
 */
export function createRouteModes() {
  return [
    { id: "auto", name: "Auto", description: "Automatically select provider based on task" },
    { id: "fixed", name: "Fixed", description: "Use default provider for all requests" },
    { id: "registry-default", name: "Registry Default", description: "Use registry default provider" },
  ];
}
