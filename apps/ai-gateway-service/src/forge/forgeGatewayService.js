// forgeGatewayService.js — 把 forge-core 的设想接进网关(受治理)。
//
// 点亮的族群(业主 2026-08-23 勾选,除 E 外全部):
//   A 多智能体锻造:Forge 主类(compile→pool→run)、ConsensusEngine
//   B 打磨质量:IterativeRefiner、QualityGate
//   C 记忆体系:MemoryEngine、SemanticMemory
//   D 韧性:GracefulDegradation(forge lane 内)
//   F 观测:轻量健康状态(/forge/status)
//   G 执行底座:TaskStore 持久化
//
// 设计约束:
//   - 惰性构造:首个请求才实例化各引擎,网关热路径零新增成本;
//   - llmCaller 桥:forge 的 LLM 调用全部走本网关 provider lane
//     (fake 默认/真实三道门),治理与预算不旁路;
//   - 默认开启(业主要求"全部接入"),FORGE_LANE_ENABLED=false 可整体关。

import {
  Forge,
  IterativeRefiner,
  QualityGate,
  MemoryEngine,
  SemanticMemory,
  ConsensusEngine,
  GracefulDegradation,
  runWithLlmCaller,
} from "@unified-ai-system/forge-core";
import { createHash } from "node:crypto";
import { mkdtempSync, realpathSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { redactSecretsInText } from "../security/secretSafety.js";

function createForgeGatewayError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function throwIfForgeGatewayAborted(signal) {
  if (!signal?.aborted) return;
  const reason = signal.reason;
  const error = createForgeGatewayError(
    "FORGE_RUN_ABORTED",
    reason instanceof Error
      ? reason.message
      : (typeof reason === "string" && reason ? reason : "Forge execution was aborted."),
  );
  error.name = "AbortError";
  if (reason instanceof Error) error.cause = reason;
  throw error;
}

function combineAbortSignals(...candidates) {
  const signals = [...new Set(candidates.filter(
    (signal) => signal && typeof signal.addEventListener === "function",
  ))];
  if (signals.length === 0) return { signal: null, dispose() {} };
  if (signals.length === 1) return { signal: signals[0], dispose() {} };

  const controller = new AbortController();
  const listeners = new Map();
  const abortFrom = (source) => {
    if (!controller.signal.aborted) controller.abort(source.reason);
  };
  for (const source of signals) {
    if (source.aborted) {
      abortFrom(source);
      break;
    }
    const listener = () => abortFrom(source);
    listeners.set(source, listener);
    source.addEventListener("abort", listener, { once: true });
  }
  return {
    signal: controller.signal,
    dispose() {
      for (const [source, listener] of listeners) source.removeEventListener("abort", listener);
      listeners.clear();
    },
  };
}

/**
 * Adapt the gateway Agent Governance Tool Proxy to Forge's trusted per-action
 * contract. Callers must build this object from authenticated server state;
 * forgeRoutes never accepts it from the JSON request body.
 */
export function createForgeGovernedExecution({
  context,
  toolProxy,
  executionLease = null,
  signal = null,
} = {}) {
  if (!context || typeof context.agentId !== "string" || typeof context.tenantId !== "string") {
    throw new TypeError("createForgeGovernedExecution requires authenticated agent and tenant context.");
  }
  if (!toolProxy || typeof toolProxy.enforce !== "function" || typeof toolProxy.enforceResult !== "function") {
    throw new TypeError("createForgeGovernedExecution requires a complete server-owned Tool Proxy.");
  }
  const runSignal = signal ?? executionLease?.signal ?? null;
  const frozenContext = Object.freeze({ ...context });
  return Object.freeze({
    context: frozenContext,
    signal: runSignal,
    async assertActive(phase = "reserve") {
      throwIfForgeGatewayAborted(runSignal);
      if (typeof executionLease?.assertActive === "function") {
        await executionLease.assertActive(phase);
      }
      throwIfForgeGatewayAborted(runSignal);
      return true;
    },
    async beforeAction(request) {
      throwIfForgeGatewayAborted(runSignal);
      if (typeof executionLease?.assertActive === "function") {
        await executionLease.assertActive("reserve");
      }
      const verdict = await toolProxy.enforce({
        context: frozenContext,
        toolName: request.toolName,
        params: request.params,
        resourceContext: request.resourceContext,
      });
      try {
        throwIfForgeGatewayAborted(runSignal);
      } catch (error) {
        verdict?.executionLease?.release?.();
        throw error;
      }
      const outcome = verdict?.outcome ?? verdict?.verdict;
      if (outcome === "allow"
        && (!verdict?.policy || typeof verdict?.executionLease?.release !== "function")) {
        verdict?.executionLease?.release?.();
        throw createForgeGatewayError(
          "FORGE_ACTION_LEASE_REQUIRED",
          `Governance allowed ${request.toolName} without a verified policy and releasable action lease.`,
        );
      }
      return verdict;
    },
    async afterAction(event) {
      if (event.error || typeof toolProxy.enforceResult !== "function" || !event.authorization?.policy) {
        return null;
      }
      const governedResult = event.actionType === "diff" && Array.isArray(event.result?.errors)
        ? {
            ...event.result,
            errorCount: event.result.errors.length,
            errors: event.result.errors.join("; "),
          }
        : event.result;
      return toolProxy.enforceResult({
        context: frozenContext,
        toolName: event.toolName,
        policy: event.authorization.policy,
        result: governedResult,
        descriptor: { kind: "zero-records" },
      });
    },
  });
}

export function createForgeGatewayService({
  gatewayService,
  env = process.env,
  clock = () => Date.now(),
  forgeFactory = (options) => new Forge(options),
  governanceRequired: configuredGovernanceRequired,
  temporaryDirectoryFactory = (prefix) => mkdtempSync(prefix),
  temporaryDirectoryRemover = (path) => rmSync(path, {
    recursive: true,
    force: true,
    maxRetries: 3,
    retryDelay: 50,
  }),
} = {}) {
  let refiner = null;
  let qualityGate = null;
  const memoryEngines = new Map();
  const semanticMemories = new Map();
  const memoryLedgers = new Map();
  let consensus = null;
  let degradation = null;
  const forgeRuns = new Map(); // runId → { tenantKey, goal, status, startedAt, result }
  const maxRunHistory = boundedInteger(env.AI_GATEWAY_FORGE_RUN_HISTORY_MAX, 200, 1, 5_000);
  const runHistoryTtlMs = boundedInteger(
    env.AI_GATEWAY_FORGE_RUN_HISTORY_TTL_MS,
    24 * 60 * 60 * 1_000,
    60_000,
    30 * 24 * 60 * 60 * 1_000,
  );
  const maxTenantCaches = boundedInteger(env.AI_GATEWAY_FORGE_TENANT_CACHE_MAX, 100, 1, 10_000);
  const maxMemoryEntriesPerTenant = boundedInteger(
    env.AI_GATEWAY_FORGE_MEMORY_MAX_ENTRIES_PER_TENANT,
    500,
    1,
    100_000,
  );
  const maxMemoryBytesPerTenant = boundedInteger(
    env.AI_GATEWAY_FORGE_MEMORY_MAX_BYTES_PER_TENANT,
    4 * 1024 * 1024,
    1_024,
    256 * 1024 * 1024,
  );
  const configuredWorkspace = resolveConfiguredForgeWorkspace(env.AI_GATEWAY_FORGE_WORKING_DIRECTORY);
  let configuredWorkspaceBusy = false;
  let cleanupFailureCount = 0;
  let lastCleanupFailure = null;
  const defaultGovernanceRequired = configuredGovernanceRequired === undefined
    ? String(env.FORGE_ACTION_GOVERNANCE_REQUIRED ?? "false").trim().toLowerCase() === "true"
    : configuredGovernanceRequired === true;

  function enabled() {
    return String(env.FORGE_LANE_ENABLED ?? "true").trim().toLowerCase() !== "false";
  }

  function pruneTenantCaches(nextTenantKey) {
    if (memoryEngines.has(nextTenantKey) || semanticMemories.has(nextTenantKey)
      || memoryLedgers.has(nextTenantKey)) return;
    while (new Set([
      ...memoryEngines.keys(), ...semanticMemories.keys(), ...memoryLedgers.keys(),
    ]).size >= maxTenantCaches) {
      const oldest = memoryLedgers.keys().next().value
        ?? memoryEngines.keys().next().value
        ?? semanticMemories.keys().next().value;
      if (oldest === undefined) break;
      memoryEngines.delete(oldest);
      semanticMemories.delete(oldest);
      memoryLedgers.delete(oldest);
    }
  }

  function getMemoryLedger(tenantIdentity = null) {
    const tenantKey = getTenantKey(tenantIdentity);
    pruneTenantCaches(tenantKey);
    if (!memoryLedgers.has(tenantKey)) {
      memoryLedgers.set(tenantKey, { entries: new Map(), bytes: 0 });
    }
    return memoryLedgers.get(tenantKey);
  }

  function removeMemoryEntry(tenantIdentity, id) {
    const tenantKey = getTenantKey(tenantIdentity);
    const ledger = memoryLedgers.get(tenantKey);
    const tracked = ledger?.entries.get(id);
    memoryEngines.get(tenantKey)?.forget?.(id);
    semanticMemories.get(tenantKey)?.remove?.(id);
    if (tracked && ledger) {
      ledger.entries.delete(id);
      ledger.bytes = Math.max(0, ledger.bytes - tracked.bytes);
    }
  }

  function pruneExpiredMemory(tenantIdentity = null) {
    const ledger = getMemoryLedger(tenantIdentity);
    const currentTime = clock();
    for (const [id, tracked] of ledger.entries) {
      if (tracked.expiresAt !== null && tracked.expiresAt <= currentTime) {
        removeMemoryEntry(tenantIdentity, id);
      }
    }
  }

  function reserveMemoryCapacity(tenantIdentity, bytes) {
    pruneExpiredMemory(tenantIdentity);
    const ledger = getMemoryLedger(tenantIdentity);
    while (ledger.entries.size >= maxMemoryEntriesPerTenant
      || ledger.bytes + bytes > maxMemoryBytesPerTenant) {
      const oldestId = ledger.entries.keys().next().value;
      if (oldestId === undefined) break;
      removeMemoryEntry(tenantIdentity, oldestId);
    }
    return ledger.entries.size < maxMemoryEntriesPerTenant
      && ledger.bytes + bytes <= maxMemoryBytesPerTenant;
  }

  function touchMemoryResults(tenantIdentity, ...collections) {
    const ledger = getMemoryLedger(tenantIdentity);
    for (const collection of collections) {
      if (!Array.isArray(collection)) continue;
      for (const item of collection) {
        const id = typeof item?.id === "string" ? item.id : null;
        const tracked = id ? ledger.entries.get(id) : null;
        if (!id || !tracked) continue;
        ledger.entries.delete(id);
        ledger.entries.set(id, { ...tracked, lastAccessAt: clock() });
      }
    }
  }

  function pruneRunHistory(reserveSlot = false) {
    const cutoff = clock() - runHistoryTtlMs;
    for (const [runId, run] of forgeRuns) {
      if (run.status !== "running" && Number(run.finishedAtMs ?? run.startedAtMs ?? 0) < cutoff) {
        forgeRuns.delete(runId);
      }
    }
    const targetSize = reserveSlot ? Math.max(0, maxRunHistory - 1) : maxRunHistory;
    while (forgeRuns.size > targetSize) {
      const oldest = [...forgeRuns.entries()].find(([, run]) => run.status !== "running");
      if (!oldest) break;
      forgeRuns.delete(oldest[0]);
    }
  }

  /**
   * llmCaller 桥:forge 约定 (userPrompt, systemPrompt, opts) → 文本。
   * 走网关 provider lane——预算、guardrails、审计全部生效。
   */
  async function executeGatewayLlm(executionGatewayService, tenantIdentity, userPrompt, systemPrompt, opts = {}) {
    throwIfForgeGatewayAborted(opts.signal);
    const activeGatewayService = executionGatewayService ?? gatewayService;
    if (!activeGatewayService || typeof activeGatewayService.execute !== "function") {
      throw new Error("FORGE_GATEWAY_UNAVAILABLE: gateway provider lane is required.");
    }
    const messages = [
      ...(systemPrompt ? [{ role: "system", content: String(systemPrompt) }] : []),
      { role: "user", content: String(userPrompt ?? "") },
    ];
    const gatewayInput = {
      taskType: "chat",
      messages,
      options: {
        ...(Number.isFinite(Number(opts?.maxTokens)) ? { maxOutputTokens: Number(opts.maxTokens) } : {}),
        ...(Number.isFinite(Number(opts?.temperature)) ? { temperature: Number(opts.temperature) } : {}),
      },
      metadata: {
        source: "forge-lane",
        forge: { caller: "forge-core", ...(tenantIdentity?.tenantId ? { tenantId: tenantIdentity.tenantId } : {}) },
      },
    };
    const result = opts.signal
      ? await activeGatewayService.execute(gatewayInput, { signal: opts.signal })
      : await activeGatewayService.execute(gatewayInput);
    throwIfForgeGatewayAborted(opts.signal);
    if (!result?.success) {
      const error = new Error(`forge llmCaller lane failed: ${result?.error?.code ?? "unknown"}`);
      error.code = "FORGE_LLM_LANE_FAILED";
      throw error;
    }
    const providerUsage = result.data?.usage ?? {};
    return {
      text: result.data?.message?.content ?? result.data?.text ?? "",
      usage: {
        inputTokens: providerUsage.inputTokens ?? providerUsage.prompt_tokens ?? 0,
        outputTokens: providerUsage.outputTokens ?? providerUsage.completion_tokens ?? 0,
        totalTokens: providerUsage.totalTokens ?? providerUsage.total_tokens ?? 0,
        model: result.data?.selectedModel ?? "gateway-scoped",
      },
    };
  }

  function makeLlmCaller(tenantIdentity = null, executionGatewayService = null, signal = null) {
    return async (userPrompt, systemPrompt, opts = {}) => {
      const result = await executeGatewayLlm(
        executionGatewayService,
        tenantIdentity,
        userPrompt,
        systemPrompt,
        { ...opts, ...(signal ? { signal } : {}) },
      );
      return result.text;
    };
  }

  function makeScopedLlmCaller(tenantIdentity = null, executionGatewayService = null, signal = null) {
    return (userPrompt, systemPrompt, opts = {}) => executeGatewayLlm(
      executionGatewayService,
      tenantIdentity,
      userPrompt,
      systemPrompt,
      { ...opts, ...(signal ? { signal } : {}) },
    );
  }

  function getRefiner() {
    refiner ??= new IterativeRefiner({
      maxPasses: 3,
      qualityThreshold: 70,
      selfCritiqueEnabled: true,
      minImprovement: 2,
    });
    return refiner;
  }

  function getQualityGate() {
    qualityGate ??= new QualityGate({ minScore: 60 });
    return qualityGate;
  }

  function getTenantKey(tenantIdentity = null) {
    const tenantId = String(tenantIdentity?.tenantId ?? "").trim();
    return tenantId || "local";
  }

  function getMemoryEngine(tenantIdentity = null) {
    const tenantKey = getTenantKey(tenantIdentity);
    pruneTenantCaches(tenantKey);
    if (!memoryEngines.has(tenantKey)) {
      memoryEngines.set(tenantKey, new MemoryEngine({
        hotMaxEntries: maxMemoryEntriesPerTenant,
        autoConsolidateThreshold: Number.MAX_SAFE_INTEGER,
      }));
    }
    return memoryEngines.get(tenantKey);
  }

  function getSemanticMemory(tenantIdentity = null) {
    const tenantKey = getTenantKey(tenantIdentity);
    pruneTenantCaches(tenantKey);
    if (!semanticMemories.has(tenantKey)) {
      semanticMemories.set(tenantKey, new SemanticMemory({}));
    }
    return semanticMemories.get(tenantKey);
  }

  function getConsensus() {
    consensus ??= new ConsensusEngine({});
    return consensus;
  }

  function getDegradation() {
    degradation ??= new GracefulDegradation();
    degradation.registerModule("forge-llm-lane", 10, {
      execute: async (input) => makeLlmCaller()(input.userPrompt, input.systemPrompt, input.opts),
      degraded: async (input) => `[forge:degraded] LLM lane unavailable; original task preserved.\n${input.userPrompt ?? ""}`,
    });
    return degradation;
  }

  return {
    enabled,
    makeLlmCaller,

    // ── B:打磨 ──
    async polish({ content, task = {}, passes, tenantIdentity = null, gatewayService: executionGatewayService = null } = {}) {
      if (!enabled()) return { ok: false, code: "FORGE_LANE_DISABLED" };
      if (typeof content !== "string" || !content.trim()) {
        return { ok: false, code: "FORGE_INPUT_INVALID", reason: "content is required." };
      }
      const startedAt = clock();
      const result = await getRefiner().refine(
        { ...task, content },
        makeLlmCaller(tenantIdentity, executionGatewayService),
        Number.isInteger(passes) ? { maxPasses: Math.min(passes, 10) } : {},
      );
      return {
        ok: true,
        result,
        passes: result?.passes ?? result?.iterations ?? null,
        durationMs: clock() - startedAt,
      };
    },

    // ── B:质量门 ──
    async quality({ code, task = {} } = {}) {
      if (!enabled()) return { ok: false, code: "FORGE_LANE_DISABLED" };
      if (typeof code !== "string" || !code.trim()) {
        return { ok: false, code: "FORGE_INPUT_INVALID", reason: "code is required." };
      }
      const startedAt = clock();
      const evaluation = await getQualityGate().evaluate(code, task);
      return { ok: true, evaluation, durationMs: clock() - startedAt };
    },

    // ── C:记忆(短文本工作记忆 + 语义检索)──
    memoryRemember({ content, metadata = {}, tenantIdentity = null } = {}) {
      if (!enabled()) return { ok: false, code: "FORGE_LANE_DISABLED" };
      if (typeof content !== "string" || !content.trim()) {
        return { ok: false, code: "FORGE_INPUT_INVALID", reason: "content is required." };
      }
      const bytes = memoryEntryBytes(content, metadata);
      if (bytes > maxMemoryBytesPerTenant || !reserveMemoryCapacity(tenantIdentity, bytes)) {
        return {
          ok: false,
          code: "FORGE_MEMORY_CAPACITY_EXCEEDED",
          reason: "The memory entry exceeds the configured per-tenant capacity.",
        };
      }
      const working = getMemoryEngine(tenantIdentity);
      const semantic = getSemanticMemory(tenantIdentity);
      const entry = working.remember(content, metadata);
      const id = typeof entry?.id === "string" ? entry.id : String(entry);
      try {
        semantic.index(id, content, metadata);
      } catch (error) {
        working.forget?.(id);
        throw error;
      }
      const ttl = Number(metadata?.ttl);
      const ledger = getMemoryLedger(tenantIdentity);
      ledger.entries.set(id, {
        bytes,
        lastAccessAt: clock(),
        expiresAt: Number.isFinite(ttl) && ttl > 0 ? clock() + ttl : null,
      });
      ledger.bytes += bytes;
      return { ok: true, id };
    },

    memoryRecall({ query, limit = 5, tenantIdentity = null } = {}) {
      if (!enabled()) return { ok: false, code: "FORGE_LANE_DISABLED" };
      if (typeof query !== "string" || !query.trim()) {
        return { ok: false, code: "FORGE_INPUT_INVALID", reason: "query is required." };
      }
      pruneExpiredMemory(tenantIdentity);
      const working = getMemoryEngine(tenantIdentity).recall(query, { limit });
      const semantic = getSemanticMemory(tenantIdentity).search(query, { limit });
      touchMemoryResults(tenantIdentity, working, semantic);
      return { ok: true, working, semantic };
    },

    memoryStats({ tenantIdentity = null } = {}) {
      pruneExpiredMemory(tenantIdentity);
      const ledger = getMemoryLedger(tenantIdentity);
      return {
        ok: true,
        working: getMemoryEngine(tenantIdentity).getStats?.() ?? null,
        semantic: getSemanticMemory(tenantIdentity).getStats?.() ?? null,
        capacity: {
          entries: ledger.entries.size,
          bytes: ledger.bytes,
          maxEntries: maxMemoryEntriesPerTenant,
          maxBytes: maxMemoryBytesPerTenant,
        },
      };
    },

    // ── A:共识(轻量直通,供编排使用)──
    consensusStatus() {
      if (!enabled()) return { ok: false, code: "FORGE_LANE_DISABLED" };
      return { ok: true, status: getConsensus().getStatus() };
    },

    // ── A+G:目标编排(Forge 主类,单目标 run;多目标池后续按需)──
    async orchestrate({
      goal,
      options = {},
      tenantIdentity = null,
      gatewayService: executionGatewayService = null,
      governedExecution = null,
      governanceRequired: requestedGovernanceRequired,
      signal = null,
    } = {}) {
      if (!enabled()) return { ok: false, code: "FORGE_LANE_DISABLED" };
      if (typeof goal !== "string" || !goal.trim()) {
        return { ok: false, code: "FORGE_INPUT_INVALID", reason: "goal is required." };
      }
      const governanceRequired = defaultGovernanceRequired || requestedGovernanceRequired === true;
      if ((governanceRequired || governedExecution)
        && (typeof governedExecution?.beforeAction !== "function"
          || typeof governedExecution?.afterAction !== "function")) {
        return {
          ok: false,
          code: "FORGE_ACTION_GOVERNANCE_REQUIRED",
          reason: "Gateway-governed Forge execution requires complete server-owned beforeAction/afterAction hooks.",
          governance: { enforced: false, required: governanceRequired },
        };
      }
      const combinedSignal = combineAbortSignals(
        signal,
        governedExecution?.signal,
        governedExecution?.executionLease?.signal,
      );
      try {
        throwIfForgeGatewayAborted(combinedSignal.signal);
      } catch (error) {
        combinedSignal.dispose();
        return { ok: false, code: error.code, reason: error.message };
      }
      const runId = `forge_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      pruneRunHistory(true);
      if (forgeRuns.size >= maxRunHistory) {
        combinedSignal.dispose();
        return { ok: false, code: "FORGE_RUN_CAPACITY_REACHED", reason: "Forge run history is at capacity." };
      }
      if (configuredWorkspace && configuredWorkspaceBusy) {
        combinedSignal.dispose();
        return { ok: false, code: "FORGE_WORKSPACE_BUSY", reason: "The configured Forge workspace already has an active run." };
      }
      const tenantKey = getTenantKey(tenantIdentity);
      const temporaryWorkspace = configuredWorkspace === null;
      let workRoot;
      let runtimeRoot;
      try {
        workRoot = configuredWorkspace ?? temporaryDirectoryFactory(join(tmpdir(), "uai-forge-run-"));
        runtimeRoot = temporaryWorkspace
          ? workRoot
          : temporaryDirectoryFactory(join(
              tmpdir(),
              `uai-forge-state-${createHash("sha256").update(tenantKey, "utf8").digest("hex").slice(0, 12)}-`,
            ));
      } catch (error) {
        combinedSignal.dispose();
        if (temporaryWorkspace && workRoot) {
          try { temporaryDirectoryRemover(workRoot); } catch { /* reported by the structured creation failure */ }
        }
        return {
          ok: false,
          code: "FORGE_WORKSPACE_CREATE_FAILED",
          reason: safeForgeErrorMessage(error?.message),
        };
      }
      if (configuredWorkspace) configuredWorkspaceBusy = true;
      const governance = governanceRequired
        ? { enforced: true, mode: "gateway-governed" }
        : { enforced: false, mode: "standalone-development-only" };
      forgeRuns.set(runId, {
        tenantKey,
        goalDigest: createHash("sha256").update(goal, "utf8").digest("hex"),
        goalPreview: goal.slice(0, 200),
        status: "running",
        startedAt: new Date(clock()).toISOString(),
        startedAtMs: clock(),
        governance,
      });
      let forge = null;
      try {
        const rawOptions = options && typeof options === "object" && !Array.isArray(options)
          ? options
          : {};
        // These values are server-owned and cannot be overridden by request JSON.
        const {
          governedExecution: _ignoredGovernedExecution,
          governanceRequired: _ignoredGovernanceRequired,
          signal: _ignoredSignal,
          ...forgeOptions
        } = rawOptions;
        forge = forgeFactory({
          projectRoot: workRoot,
          dbPath: join(runtimeRoot, "forge-tasks.sqlite"),
          enableProgress: false,
          enableCostTracking: true,
          governedExecution,
          governanceRequired,
          signal: combinedSignal.signal,
        });
        const result = await runWithLlmCaller(
          makeScopedLlmCaller(tenantIdentity, executionGatewayService, combinedSignal.signal),
          () => forge.run(goal, {
            ...forgeOptions,
            governedExecution,
            governanceRequired,
            signal: combinedSignal.signal,
          }),
        );
        throwIfForgeGatewayAborted(combinedSignal.signal);
        forgeRuns.set(runId, {
          tenantKey,
          goalDigest: createHash("sha256").update(goal, "utf8").digest("hex"),
          goalPreview: goal.slice(0, 200),
          status: "completed",
          startedAt: forgeRuns.get(runId).startedAt,
          startedAtMs: forgeRuns.get(runId).startedAtMs,
          finishedAtMs: clock(),
          result: summarizeForgeRunResult(result),
          governance,
        });
        return { ok: true, runId, result, governance, workspace: { configured: !temporaryWorkspace } };
      } catch (error) {
        const aborted = combinedSignal.signal?.aborted
          || error?.name === "AbortError"
          || error?.code === "FORGE_RUN_ABORTED";
        const code = aborted ? "FORGE_RUN_ABORTED" : (error?.code ?? "FORGE_RUN_FAILED");
        const safeMessage = safeForgeErrorMessage(error?.message);
        forgeRuns.set(runId, {
          tenantKey,
          goalDigest: createHash("sha256").update(goal, "utf8").digest("hex"),
          goalPreview: goal.slice(0, 200),
          status: "failed",
          startedAt: forgeRuns.get(runId)?.startedAt,
          startedAtMs: forgeRuns.get(runId)?.startedAtMs,
          finishedAtMs: clock(),
          error: { message: safeMessage, code },
          governance,
        });
        return { ok: false, runId, code, reason: safeMessage, governance };
      } finally {
        const cleanupErrors = [];
        try {
          await forge?.close?.();
        } catch (error) {
          cleanupErrors.push({ code: "FORGE_TASK_STORE_CLOSE_FAILED", message: safeForgeErrorMessage(error?.message) });
        }
        combinedSignal.dispose();
        if (configuredWorkspace) configuredWorkspaceBusy = false;
        if (runtimeRoot) {
          try {
            temporaryDirectoryRemover(runtimeRoot);
          } catch (error) {
            cleanupErrors.push({ code: "FORGE_TEMP_CLEANUP_FAILED", message: safeForgeErrorMessage(error?.message) });
          }
        }
        const finishedRun = forgeRuns.get(runId);
        if (cleanupErrors.length > 0) {
          cleanupFailureCount = Math.min(Number.MAX_SAFE_INTEGER, cleanupFailureCount + 1);
          lastCleanupFailure = {
            at: new Date(clock()).toISOString(),
            codes: cleanupErrors.map((item) => item.code),
          };
          if (finishedRun) {
            forgeRuns.set(runId, {
              ...finishedRun,
              cleanup: { ok: false, errors: cleanupErrors.slice(0, 2) },
            });
          }
        } else if (finishedRun) {
          forgeRuns.set(runId, { ...finishedRun, cleanup: { ok: true } });
        }
      }
    },

    listRuns({ tenantIdentity = null, limit = 50 } = {}) {
      pruneRunHistory();
      const tenantKey = getTenantKey(tenantIdentity);
      const runs = [...forgeRuns.entries()]
        .filter(([, run]) => run.tenantKey === tenantKey)
        .slice(-Math.min(100, Math.max(1, Math.floor(Number(limit) || 50))))
        .map(([runId, { tenantKey: _tenantKey, startedAtMs: _startedAtMs,
          finishedAtMs: _finishedAtMs, ...run }]) => ({ runId, ...run }));
      return { ok: true, runs, total: [...forgeRuns.values()].filter((run) => run.tenantKey === tenantKey).length };
    },

    // ── D:韧性演示/直通(内部由 polish 使用)──
    async degrade(input, { gatewayService: executionGatewayService = null } = {}) {
      if (executionGatewayService) {
        try {
          return await makeLlmCaller(null, executionGatewayService)(
            input?.userPrompt,
            input?.systemPrompt,
            input?.opts,
          );
        } catch {
          return `[forge:degraded] LLM lane unavailable; original task preserved.\n${input?.userPrompt ?? ""}`;
        }
      }
      return getDegradation().execute(input);
    },

    // ── F:状态面 ──
    getStatus({ tenantIdentity = null, gatewayService: executionGatewayService = null } = {}) {
      pruneRunHistory();
      const tenantKey = getTenantKey(tenantIdentity);
      return {
        ok: true,
        enabled: enabled(),
        engines: {
          iterativeRefiner: Boolean(refiner ?? true),
          qualityGate: Boolean(qualityGate ?? true),
          memoryEngine: true,
          semanticMemory: true,
          consensus: Boolean(consensus ?? true),
          gracefulDegradation: Boolean(degradation ?? true),
        },
        lazyLoaded: {
          refiner: refiner !== null,
          qualityGate: qualityGate !== null,
          memoryEngine: memoryEngines.has(tenantKey),
          semanticMemory: semanticMemories.has(tenantKey),
          consensus: consensus !== null,
        },
        activeRuns: [...forgeRuns.values()].filter((run) => (
          run.tenantKey === tenantKey && run.status === "running"
        )).length,
        retainedRuns: [...forgeRuns.values()].filter((run) => run.tenantKey === tenantKey).length,
        llmLane: executionGatewayService || gatewayService ? "gateway-provider-lane" : "unavailable",
        actionGovernance: defaultGovernanceRequired
          ? { required: true, mode: "gateway-governed" }
          : { required: false, mode: "standalone-development-only", productionGoverned: false },
        cleanup: {
          failureCount: cleanupFailureCount,
          lastFailure: lastCleanupFailure,
        },
      };
    },
  };
}

function resolveConfiguredForgeWorkspace(value) {
  const configured = typeof value === "string" ? value.trim() : "";
  if (!configured) return null;
  if (!isAbsolute(configured)) {
    throw createForgeGatewayError(
      "FORGE_WORKSPACE_INVALID",
      "AI_GATEWAY_FORGE_WORKING_DIRECTORY must be an absolute existing directory.",
    );
  }
  const canonical = realpathSync.native(resolve(configured));
  if (!statSync(canonical).isDirectory()) {
    throw createForgeGatewayError("FORGE_WORKSPACE_INVALID", "Configured Forge workspace is not a directory.");
  }
  return canonical;
}

function summarizeForgeRunResult(result) {
  if (result === null || result === undefined || typeof result === "boolean" || typeof result === "number") {
    return result ?? null;
  }
  if (typeof result === "string") {
    return result.length <= 2_000 ? result : `${result.slice(0, 2_000)}...(truncated)`;
  }
  if (typeof result !== "object") return { type: typeof result };
  const descriptors = Object.getOwnPropertyDescriptors(result);
  const summary = Object.create(null);
  for (const key of ["ok", "status", "code", "summary", "taskCount", "completedTasks", "failedTasks"]) {
    const descriptor = descriptors[key];
    if (!descriptor || !("value" in descriptor)) continue;
    const value = descriptor.value;
    if (typeof value === "string") summary[key] = value.slice(0, 2_000);
    else if (typeof value === "boolean" || typeof value === "number" || value === null) summary[key] = value;
  }
  summary.type = Array.isArray(result) ? "array" : "object";
  return summary;
}

function safeForgeErrorMessage(value) {
  const redacted = redactSecretsInText(typeof value === "string" ? value : "Forge run failed.")
    .replace(/\b(password|token|secret|authorization|api[_-]?key)\s*[:=]\s*([^\s,;]+)/giu,
      "$1=***REDACTED***");
  return redacted.length <= 2_000 ? redacted : `${redacted.slice(0, 2_000)}...(truncated)`;
}

function memoryEntryBytes(content, metadata) {
  let serializedMetadata;
  try {
    serializedMetadata = JSON.stringify(metadata ?? {});
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
  return Buffer.byteLength(content, "utf8") + Buffer.byteLength(serializedMetadata ?? "{}", "utf8");
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
}
