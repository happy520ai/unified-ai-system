// forgeRoutes.js — forge 设想族群的受治理入口(A/B/C/D/F/G)。
//
//   POST /forge/polish      迭代精修(B,chat:use)
//   POST /forge/quality     质量门(B,workflow:run)
//   POST /forge/memory      记忆写入/检索(C,memory:write/read 按 action)
//   GET  /forge/memory/stats 记忆统计(C,memory:read)
//   POST /forge/orchestrate 目标编排(A+G,workflow:run,LLM 需真实凭证)
//   GET  /forge/runs        编排运行列表(workflow:run)
//   GET  /forge/status      引擎状态(F,dashboard:read)
//   GET  /forge/consensus   共识引擎状态(A,dashboard:read)

import { ROUTE_NOT_HANDLED } from "./httpRouteDispatch.js";
import { readJson, writeJson } from "./utils/responseUtils.js";
import { createErrorEnvelope, createOkEnvelope } from "@unified-ai-system/shared-utils";
import { createForgeGatewayService } from "../forge/forgeGatewayService.js";
import { classifyImmuneRisk, generateManifestDraft } from "@unified-ai-system/taiji-beidou-engine";
import { runRealTaskWorkforceDryRun } from "../workforce-preview/workforcePreviewService.js";

export function isForgeRoute(pathname) {
  const path = String(pathname ?? "");
  return path.startsWith("/forge/") || path === "/taiji/compile" || path === "/workforce/preview";
}

export async function dispatchForgeRoutes(context) {
  const { application, request, response, startedAt, url, writeServiceLog } = context;
  if (!isForgeRoute(url.pathname)) return ROUTE_NOT_HANDLED;

  // 服务实例挂在 application 上(与 knowledgeService 等同生命周期),惰性构造。
  const gatewayService = context.gatewayService ?? application?.gatewayService;
  if (!application.__forgeGatewayService) {
    application.__forgeGatewayService = createForgeGatewayService({
      // Never retain a request-bound proxy here. Each LLM-bearing operation
      // receives the current request's gateway below, preserving cancellation,
      // tenant identity, and provider-dispatch invocation lanes.
      gatewayService: application?.gatewayService,
      env: application.runtimeEnv ?? process.env,
    });
  }
  const forge = application.__forgeGatewayService;
  const tenantIdentity = request.enterpriseIdentity ?? null;

  const fail = (status, code, message) => {
    writeJson(response, status, createErrorEnvelope(code, message, { startedAt, category: "forge" }));
  };

  // ── H 族网关设想面:taiji 能力编译与 workforce 干跑预览 ──
  if (request.method === "POST" && url.pathname === "/taiji/compile") {
    let body;
    try {
      body = await readJson(request);
    } catch {
      return fail(400, "invalid_json", "Request body must be valid JSON.");
    }
    const spec = {
      capabilityId: String(body.capabilityId ?? "cap_custom"),
      displayName: String(body.displayName ?? body.capabilityId ?? "Custom Capability"),
      description: String(body.description ?? body.request ?? ""),
      intakeText: String(body.request ?? body.description ?? ""),
    };
    const risk = classifyImmuneRisk(spec);
    const manifest = generateManifestDraft(spec, risk);
    writeServiceLog?.("taiji_compile_completed", { method: "POST", path: url.pathname, capabilityId: spec.capabilityId, startedAt });
    writeJson(response, 200, createOkEnvelope({ spec, risk, manifest }, { startedAt }));
    return;
  }

  if (request.method === "POST" && url.pathname === "/workforce/preview") {
    let body;
    try {
      body = await readJson(request);
    } catch {
      return fail(400, "invalid_json", "Request body must be valid JSON.");
    }
    const task = typeof body.task === "string" && body.task.trim() ? body.task : undefined;
    const preview = runRealTaskWorkforceDryRun(task);
    writeJson(response, 200, createOkEnvelope({ route: "/workforce/preview", preview }, { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/forge/status") {
    writeJson(response, 200, createOkEnvelope(forge.getStatus({ tenantIdentity, gatewayService }), { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/forge/consensus") {
    writeJson(response, 200, createOkEnvelope(forge.consensusStatus(), { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/forge/runs") {
    writeJson(response, 200, createOkEnvelope(forge.listRuns({ tenantIdentity }), { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/forge/memory/stats") {
    writeJson(response, 200, createOkEnvelope(forge.memoryStats({ tenantIdentity }), { startedAt }));
    return;
  }

  const postHandlers = {
    "/forge/polish": async (body) => {
      const result = await forge.polish({
        content: body.content,
        task: body.task ?? {},
        passes: body.passes,
        tenantIdentity,
        gatewayService,
      });
      if (!result.ok) return fail(400, result.code, result.reason ?? "polish failed.");
      writeServiceLog?.("forge_polish_completed", {
        method: "POST", path: url.pathname,
        durationMs: result.durationMs, startedAt,
      });
      writeJson(response, 200, createOkEnvelope(result, { startedAt }));
    },
    "/forge/quality": async (body) => {
      const result = await forge.quality({ code: body.code, task: body.task ?? {} });
      if (!result.ok) return fail(400, result.code, result.reason ?? "quality check failed.");
      writeJson(response, 200, createOkEnvelope(result, { startedAt }));
    },
    "/forge/orchestrate": async (body) => {
      const result = await forge.orchestrate({
        goal: body.goal,
        options: body.options ?? {},
        tenantIdentity,
        gatewayService,
      });
      if (!result.ok && result.code === "FORGE_INPUT_INVALID") {
        return fail(400, result.code, result.reason ?? "goal is required.");
      }
      writeJson(response, result.ok ? 200 : 422, createOkEnvelope(result, { startedAt }));
    },
    "/forge/memory": async (body) => {
      if (body.action === "remember") {
        const result = forge.memoryRemember({
          content: body.content,
          metadata: body.metadata ?? {},
          tenantIdentity,
        });
        if (!result.ok) return fail(400, result.code, result.reason ?? "remember failed.");
        writeJson(response, 200, createOkEnvelope(result, { startedAt }));
        return;
      }
      if (body.action === "recall" || body.action === "search") {
        const result = forge.memoryRecall({
          query: body.query,
          limit: body.limit,
          tenantIdentity,
        });
        if (!result.ok) return fail(400, result.code, result.reason ?? "recall failed.");
        writeJson(response, 200, createOkEnvelope(result, { startedAt }));
        return;
      }
      fail(400, "FORGE_MEMORY_ACTION_INVALID", "action must be 'remember' or 'recall'.");
    },
  };

  const handler = postHandlers[url.pathname.replace(/\/+$/, "")];
  if (!handler) {
    if (isForgeRoute(url.pathname)) {
      writeJson(response, 404, createErrorEnvelope("forge_route_not_found", `No forge route for ${request.method} ${url.pathname}`, { startedAt, category: "routing" }));
      return;
    }
    return ROUTE_NOT_HANDLED;
  }
  if (request.method !== "POST") {
    writeJson(response, 405, createErrorEnvelope("method_not_allowed", `Only POST is supported for ${url.pathname}.`, { startedAt, category: "routing" }));
    return;
  }

  return (async () => {
    let body;
    try {
      body = await readJson(request);
    } catch {
      return fail(400, "invalid_json", "Request body must be valid JSON.");
    }
    await handler(body ?? {});
  })();
}
