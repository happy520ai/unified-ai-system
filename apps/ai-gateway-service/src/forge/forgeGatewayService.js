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
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function createForgeGatewayService({
  gatewayService,
  env = process.env,
  clock = () => Date.now(),
  forgeFactory = (options) => new Forge(options),
} = {}) {
  let refiner = null;
  let qualityGate = null;
  const memoryEngines = new Map();
  const semanticMemories = new Map();
  let consensus = null;
  let degradation = null;
  const forgeRuns = new Map(); // runId → { tenantKey, goal, status, startedAt, result }

  function enabled() {
    return String(env.FORGE_LANE_ENABLED ?? "true").trim().toLowerCase() !== "false";
  }

  /**
   * llmCaller 桥:forge 约定 (userPrompt, systemPrompt, opts) → 文本。
   * 走网关 provider lane——预算、guardrails、审计全部生效。
   */
  async function executeGatewayLlm(tenantIdentity, userPrompt, systemPrompt, opts = {}) {
    if (!gatewayService || typeof gatewayService.execute !== "function") {
      throw new Error("FORGE_GATEWAY_UNAVAILABLE: gateway provider lane is required.");
    }
    const messages = [
      ...(systemPrompt ? [{ role: "system", content: String(systemPrompt) }] : []),
      { role: "user", content: String(userPrompt ?? "") },
    ];
    const result = await gatewayService.execute({
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
    });
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

  function makeLlmCaller(tenantIdentity = null) {
    return async (userPrompt, systemPrompt, opts = {}) => {
      const result = await executeGatewayLlm(tenantIdentity, userPrompt, systemPrompt, opts);
      return result.text;
    };
  }

  function makeScopedLlmCaller(tenantIdentity = null) {
    return (userPrompt, systemPrompt, opts = {}) => executeGatewayLlm(
      tenantIdentity,
      userPrompt,
      systemPrompt,
      opts,
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
    if (!memoryEngines.has(tenantKey)) {
      memoryEngines.set(tenantKey, new MemoryEngine({}));
    }
    return memoryEngines.get(tenantKey);
  }

  function getSemanticMemory(tenantIdentity = null) {
    const tenantKey = getTenantKey(tenantIdentity);
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
    async polish({ content, task = {}, passes, tenantIdentity = null } = {}) {
      if (!enabled()) return { ok: false, code: "FORGE_LANE_DISABLED" };
      if (typeof content !== "string" || !content.trim()) {
        return { ok: false, code: "FORGE_INPUT_INVALID", reason: "content is required." };
      }
      const startedAt = clock();
      const result = await getRefiner().refine(
        { ...task, content },
        makeLlmCaller(tenantIdentity),
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
      const id = getMemoryEngine(tenantIdentity).remember(content, metadata);
      getSemanticMemory(tenantIdentity).index(id, content, metadata);
      return { ok: true, id };
    },

    memoryRecall({ query, limit = 5, tenantIdentity = null } = {}) {
      if (!enabled()) return { ok: false, code: "FORGE_LANE_DISABLED" };
      if (typeof query !== "string" || !query.trim()) {
        return { ok: false, code: "FORGE_INPUT_INVALID", reason: "query is required." };
      }
      const working = getMemoryEngine(tenantIdentity).recall(query, { limit });
      const semantic = getSemanticMemory(tenantIdentity).search(query, { limit });
      return { ok: true, working, semantic };
    },

    memoryStats({ tenantIdentity = null } = {}) {
      return {
        ok: true,
        working: getMemoryEngine(tenantIdentity).getStats?.() ?? null,
        semantic: getSemanticMemory(tenantIdentity).getStats?.() ?? null,
      };
    },

    // ── A:共识(轻量直通,供编排使用)──
    consensusStatus() {
      if (!enabled()) return { ok: false, code: "FORGE_LANE_DISABLED" };
      return { ok: true, status: getConsensus().getStatus() };
    },

    // ── A+G:目标编排(Forge 主类,单目标 run;多目标池后续按需)──
    async orchestrate({ goal, options = {}, tenantIdentity = null } = {}) {
      if (!enabled()) return { ok: false, code: "FORGE_LANE_DISABLED" };
      if (typeof goal !== "string" || !goal.trim()) {
        return { ok: false, code: "FORGE_INPUT_INVALID", reason: "goal is required." };
      }
      const runId = `forge_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const workRoot = mkdtempSync(join(tmpdir(), "uai-forge-run-"));
      const tenantKey = getTenantKey(tenantIdentity);
      forgeRuns.set(runId, { tenantKey, goal, status: "running", startedAt: new Date().toISOString() });
      let forge = null;
      try {
        forge = forgeFactory({
          projectRoot: workRoot,
          dbPath: join(workRoot, "forge-tasks.sqlite"),
          enableProgress: false,
          enableCostTracking: true,
        });
        const result = await runWithLlmCaller(
          makeScopedLlmCaller(tenantIdentity),
          () => forge.run(goal, options),
        );
        forgeRuns.set(runId, { tenantKey, goal, status: "completed", startedAt: forgeRuns.get(runId).startedAt, result });
        return { ok: true, runId, result, workRoot };
      } catch (error) {
        forgeRuns.set(runId, {
          tenantKey,
          goal,
          status: "failed",
          startedAt: forgeRuns.get(runId)?.startedAt,
          error: { message: error?.message, code: error?.code },
        });
        return { ok: false, runId, code: error?.code ?? "FORGE_RUN_FAILED", reason: error?.message };
      } finally {
        try {
          forge?.close?.();
        } catch {
          // The governed result is already recorded; close is best-effort cleanup.
        }
      }
    },

    listRuns({ tenantIdentity = null } = {}) {
      const tenantKey = getTenantKey(tenantIdentity);
      const runs = [...forgeRuns.entries()]
        .filter(([, run]) => run.tenantKey === tenantKey)
        .map(([runId, { tenantKey: _tenantKey, ...run }]) => ({ runId, ...run }));
      return { ok: true, runs };
    },

    // ── D:韧性演示/直通(内部由 polish 使用)──
    async degrade(input) {
      return getDegradation().execute(input);
    },

    // ── F:状态面 ──
    getStatus({ tenantIdentity = null } = {}) {
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
        activeRuns: [...forgeRuns.values()].filter((run) => run.tenantKey === tenantKey).length,
        llmLane: gatewayService ? "gateway-provider-lane" : "unavailable",
      };
    },
  };
}
