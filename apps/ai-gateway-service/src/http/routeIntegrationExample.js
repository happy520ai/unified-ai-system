// =============================================================================
// routeIntegrationExample.js — 路由模块集成示例
//
// 展示如何将 diagnosticsRoutes.js 和 costCacheRoutes.js 接入 httpServer.js
// 这是一个参考文档,不是要直接替换 httpServer.js
// =============================================================================

/**
 * 集成步骤(在 httpServer.js 中):
 *
 * 1. 在文件顶部 import 路由模块:
 *
 *    import { createDiagnosticsRoutes } from "./diagnosticsRoutes.js";
 *    import { createCostCacheRoutes } from "./costCacheRoutes.js";
 *
 * 2. 在 createGatewayHttpServer 函数开头初始化路由模块:
 *
 *    const diagnosticsRoutes = createDiagnosticsRoutes(application);
 *    const costCacheRoutes = createCostCacheRoutes(application);
 *
 *    // 合并所有路由模块的 handlers
 *    const routeModules = [
 *      diagnosticsRoutes.handlers,
 *      costCacheRoutes.handlers,
 *      // 未来继续添加更多模块...
 *    ];
 *
 * 3. 在路由分发链的开头,添加路由表查找(在企业鉴权之后):
 *
 *    // ── 路由表查找(优先于 if/else 链) ──
 *    const routeKey = `${request.method} ${url.pathname}`;
 *    for (const moduleHandlers of routeModules) {
 *      const route = moduleHandlers.get(routeKey);
 *      if (route) {
 *        // 检查公共路由
 *        if (!route.public && !isPublicRoute(url.pathname)) {
 *          // 企业鉴权已在上面处理,这里直接执行
 *        }
 *        try {
 *          let body = null;
 *          if (request.method === "POST" || request.method === "PUT") {
 *            body = await readJson(request);
 *          }
 *          await route.handler(request, response, {
 *            startedAt,
 *            body,
 *            params: {}, // 未来支持路径参数
 *          });
 *        } catch (routeError) {
 *          writeJson(response, 500, createErrorEnvelope(
 *            "route_handler_error",
 *            routeError.message,
 *            { startedAt, category: "internal" }
 *          ));
 *        }
 *        return;
 *      }
 *    }
 *
 *    // ── 如果路由表未命中,继续原有 if/else 链 ──
 *    // (原有的路由代码保持不变,逐步迁移)
 *
 * 4. 逐批迁移:
 *
 *    批次 1: 诊断路由(已完成) — /health, /health/check, /metrics, /dashboard/status, /auth/status, /setup/readiness, /ws/info
 *    批次 2: 成本/缓存路由(已完成) — /cost/*, /cache/*
 *    批次 3: 知识库路由 — /knowledge/*
 *    批次 4: 企业路由 — /enterprise/*
 *    批次 5: 聊天主链路由 — /chat, /chat/stream, /chat-gateway/*
 *    批次 6: 剩余路由
 *
 * 每批次:
 *   - 从 httpServer.js 提取 handler 体到对应路由模块
 *   - 在 httpServer.js 中删除对应的 if/else 块
 *   - 运行 node --check 验证语法
 *   - 手动 curl 验证路由正常
 *   - 运行 pnpm run check 验证测试
 *
 * 优势:
 *   - 路由模块可独立测试(不需要启动整个 HTTP 服务)
 *   - 路由注册是声明式的(一目了然有哪些路由)
 *   - 渐进式迁移(每次只动一批路由,风险可控)
 *   - 保持原有 if/else 链作为兜底(未迁移的路由仍然工作)
 */

// 示例:如何在测试中单独测试路由模块
// (不需要启动 HTTP 服务)

import { createDiagnosticsRoutes } from "./diagnosticsRoutes.js";
import { createCostCacheRoutes } from "./costCacheRoutes.js";

/**
 * 示例:创建 mock application 上下文用于测试
 */
export function createMockApplication() {
  return {
    config: {
      aiGatewayService: {
        providerMode: "fake",
        realProviderEnabled: false,
      },
    },
    knowledgeService: { getHealth: () => ({ status: "ready", mode: "local-keyword" }) },
    knowledgeInfra: { getReadiness: () => ({ ready: true }) },
    workflowService: { getHealth: () => ({ status: "ready" }) },
    workforceService: { getHealth: () => ({ status: "ready", ready: true, roleCount: 5, mode: "sandbox-merge-auto" }) },
    enterpriseGovernanceService: { getHealth: () => ({ enabled: true }) },
    gatewayService: { getProviderDescriptors: () => [{ providerId: "fake", enabled: true }] },
    auditHashChain: { getEntryCount: () => 42 },
    revocationStore: { getStats: () => ({ totalRevocations: 0 }) },
    authRateLimiter: { getStats: () => ({ totalAttempts: 10, blockedAttempts: 0 }) },
    metricsCollector: { enabled: true, getMetrics: () => ({ requests: 100 }) },
    circuitBreakerRegistry: { getStats: () => ({ breakers: {} }) },
    wsServer: { getConnectionCount: () => 1 },
  };
}

/**
 * 示例:列出所有已注册路由
 */
export function listAllModuleRoutes() {
  const app = createMockApplication();
  const diagnostics = createDiagnosticsRoutes(app);
  const costCache = createCostCacheRoutes(app);

  const allRoutes = [];
  for (const [key, meta] of diagnostics.handlers) {
    allRoutes.push({ key, ...meta, module: "diagnostics" });
  }
  for (const [key, meta] of costCache.handlers) {
    allRoutes.push({ key, ...meta, module: "costCache" });
  }
  return allRoutes;
}

// 如果直接运行此文件,输出所有已注册路由
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (isMain) {
  const routes = listAllModuleRoutes();
  console.log(`\n=== Registered Routes (${routes.length}) ===\n`);
  for (const r of routes) {
    const pub = r.public ? " [PUBLIC]" : "";
    const perm = r.permission ? ` [${r.permission}]` : "";
    console.log(`  ${r.key}${pub}${perm} — ${r.description ?? ""}`);
  }
  console.log("");
}
