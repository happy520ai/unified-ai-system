// =============================================================================
// providerRoutes.js — Provider 路由模块
// 从 httpServer.js 抽取的 /providers、/config/runtime、/route/* 路由
// =============================================================================

import { getSafeRuntimeConfig } from "@unified-ai-system/shared-config";

/**
 * 创建 Provider 相关路由的 handler 集合
 * @param {Object} application - Gateway application context
 * @param {Object} helpers — { readJson, writeJson, writeServiceLog, createOkEnvelope, createErrorEnvelope }
 * @returns {Object} { handlers: Map<string, Function> }
 */
export function createProviderRoutes(application, helpers) {
  const { gatewayService, config, providerConfigRoutes } = application;
  const { readJson, writeJson, writeServiceLog, createOkEnvelope, createErrorEnvelope } = helpers;

  // ── GET /providers — 列出所有 Provider ──
  async function handleProviders(_req, res, { startedAt }) {
    const providers = createProviders();
    writeJson(res, 200, createOkEnvelope(providers, { startedAt }));
  }

  // ── GET /config/runtime — 运行时配置 ──
  async function handleConfigRuntime(_req, res, { startedAt }) {
    const runtimeConfig = getSafeRuntimeConfig(config);
    writeJson(res, 200, createOkEnvelope(runtimeConfig, { startedAt }));
  }

  // ── GET /route/modes — 路由模式 ──
  async function handleRouteModes(_req, res, { startedAt }) {
    const modes = createRouteModes();
    writeJson(res, 200, createOkEnvelope(modes, { startedAt }));
  }

  // ── POST /route — 路由决策 ──
  async function handleRoute(req, res, { startedAt, body }) {
    if (!body) {
      writeJson(res, 400, createErrorEnvelope(
        "route_invalid_json",
        "Route request body must be valid JSON.",
        { startedAt, category: "validation" },
      ));
      return;
    }

    try {
      const result = await gatewayService.execute(body);
      if (writeServiceLog) {
        writeServiceLog(result.success ? "route_decision_completed" : "route_decision_failed", {
          method: "POST",
          path: "/route",
          code: result.code,
          requestId: result.meta?.requestId,
          provider: result.data?.selectedProvider ?? result.error?.provider,
          durationMs: Date.now() - startedAt,
        });
      }
      writeJson(res, result.success ? 200 : 400, result);
    } catch (error) {
      if (writeServiceLog) {
        writeServiceLog("route_decision_failed", {
          method: "POST",
          path: "/route",
          code: error?.code,
          durationMs: Date.now() - startedAt,
        });
      }
      writeJson(res, 500, createErrorEnvelope(
        error?.code ?? "route_execution_failed",
        error instanceof Error ? error.message : "Route execution failed.",
        { startedAt, category: "internal" },
      ));
    }
  }

  // ── 内部辅助函数 ──

  /**
   * 构建 Provider 列表,附加运行时凭证状态
   */
  function createProviders() {
    return gatewayService.getProviderDescriptors().map((provider) => {
      const credential = application.runtimeCredentialStore?.describe?.(provider.id);
      return {
        ...provider,
        metadata: {
          ...(provider.metadata ?? {}),
          runtimeCredentialPresent: Boolean(application.runtimeCredentialStore?.has(provider.id)),
          runtimeCredentialPersisted: credential?.persisted === true,
          runtimeCredentialStorage: credential?.secretStorage ?? "memory-only",
        },
      };
    });
  }

  /**
   * 返回支持的路由模式
   */
  function createRouteModes() {
    return {
      modes: ["fake", "real", "auto"],
      routeModes: ["fixed", "registry-default"],
    };
  }

  // ── 导出 ──

  const handlers = new Map([
    ["GET /providers", { handler: handleProviders, public: true, description: "列出所有 Provider" }],
    ["GET /config/runtime", { handler: handleConfigRuntime, public: false, permission: "provider:read", description: "运行时配置" }],
    ["GET /route/modes", { handler: handleRouteModes, public: true, description: "路由模式" }],
    ["POST /route", { handler: handleRoute, public: true, description: "路由决策" }],
  ]);

  return { handlers };
}

