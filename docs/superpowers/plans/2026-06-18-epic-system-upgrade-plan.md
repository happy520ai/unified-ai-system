# AI Gateway 系统史诗级提升实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AI Gateway 系统从实验性状态提升到生产级可用，涵盖 httpServer 拆分、Provider 增强、测试覆盖、OpenAPI 文档、可观测性、Workforce 生产化、数据库升级、容器化、性能优化、UI 现代化共 10 个模块。

**Architecture:** 逐模块渐进升级，保守模式（核心链路 `/chat`、`/knowledge`、`/health` 永不中断）。每个模块独立可验证，通过 Feature Flag 控制新功能。每次修改后运行 `verify:safe-regression-matrix` 确认无回归。

**Tech Stack:** Node.js (ES Modules), pnpm monorepo, SQLite, OpenTelemetry, Prometheus, Docker

**设计文档:** `docs/superpowers/specs/2026-06-18-epic-system-upgrade-design.md`

---

## 文件结构总览

### P1: httpServer.js 拆分

**新建文件:**
- `apps/ai-gateway-service/src/http/routes/chatRoutes.js` — `/chat`, `/chat/stream` 路由
- `apps/ai-gateway-service/src/http/routes/providerRoutes.js` — `/providers`, `/config/runtime` 路由
- `apps/ai-gateway-service/src/http/routes/modelRoutes.js` — `/models/*` 路由
- `apps/ai-gateway-service/src/http/routes/multimodalRoutes.js` — `/v1/*` 多模态路由
- `apps/ai-gateway-service/src/http/routes/forgeRoutes.js` — `/forge/*` 路由
- `apps/ai-gateway-service/src/http/routes/workflowRoutes.js` — `/workflow/*` 路由
- `apps/ai-gateway-service/src/http/routes/uiRoutes.js` — `/ui`, `/console` 路由
- `apps/ai-gateway-service/src/http/middleware/corsMiddleware.js` — CORS 中间件
- `apps/ai-gateway-service/src/http/middleware/requestIdMiddleware.js` — 请求 ID 中间件
- `apps/ai-gateway-service/src/http/middleware/errorHandlerMiddleware.js` — 错误处理中间件

**修改文件:**
- `apps/ai-gateway-service/src/http/httpServer.js` — 精简为路由分发器

### P2: Provider 系统增强

**新建文件:**
- `apps/ai-gateway-service/src/providers/providerHealthScorer.js` — 健康评分引擎
- `apps/ai-gateway-service/src/providers/providerLoadBalancer.js` — 智能负载均衡
- `apps/ai-gateway-service/src/providers/providerFailoverChain.js` — 故障转移链
- `apps/ai-gateway-service/src/providers/providerConfigWatcher.js` — 配置热更新

### P3: 测试覆盖

**新建文件:**
- `apps/ai-gateway-service/src/http/routes/chatRoutes.test.js`
- `apps/ai-gateway-service/src/http/routes/knowledgeRoutes.test.js`
- `apps/ai-gateway-service/src/providers/providerHealthScorer.test.js`
- `apps/ai-gateway-service/src/providers/providerLoadBalancer.test.js`

### P4: OpenAPI 文档

**新建文件:**
- `apps/ai-gateway-service/src/http/openApiGenerator.js` — OpenAPI spec 生成器
- `apps/ai-gateway-service/src/http/swaggerUi.js` — Swagger UI 页面

### P5: 可观测性

**新建文件:**
- `apps/ai-gateway-service/src/observability/openTelemetry.js` — OTel 初始化
- `apps/ai-gateway-service/src/observability/prometheusExporter.js` — Prometheus 导出
- `apps/ai-gateway-service/src/observability/sloTracker.js` — SLO 跟踪

---

## Task 1: 创建 chatRoutes.js — 抽取聊天路由

**Files:**
- Create: `apps/ai-gateway-service/src/http/routes/chatRoutes.js`
- Modify: `apps/ai-gateway-service/src/http/httpServer.js`
- Test: `apps/ai-gateway-service/src/http/routes/chatRoutes.test.js`

- [ ] **Step 1: 创建 chatRoutes.js 路由模块**

```javascript
// apps/ai-gateway-service/src/http/routes/chatRoutes.js
import { createOkEnvelope, createErrorEnvelope } from "../../../../../packages/shared-utils/src/index.js";

/**
 * 聊天路由模块
 * 处理 /chat 和 /chat/stream 端点
 */
export function createChatRoutes(application) {
  const { gatewayService } = application;

  const handlers = new Map();

  // POST /chat — 非流式聊天补全
  handlers.set("POST /chat", {
    handler: async function handleChat(req, res, { startedAt, readJson, writeJson }) {
      try {
        const body = await readJson(req);
        const input = String(body?.prompt ?? body?.input ?? body?.message ?? "").trim();
        if (!input) {
          writeJson(res, 400, createErrorEnvelope("MISSING_PROMPT", "prompt is required", { startedAt }));
          return;
        }
        const result = await gatewayService.execute({
          prompt: input,
          messages: body.messages,
          model: body.model,
          providerId: body.providerId,
        });
        writeJson(res, 200, createOkEnvelope(result, { startedAt }));
      } catch (err) {
        writeJson(res, 500, createErrorEnvelope("CHAT_ERROR", err.message, { startedAt }));
      }
    },
    public: true,
    description: "非流式聊天补全",
  });

  // POST /chat/stream — SSE 流式聊天
  handlers.set("POST /chat/stream", {
    handler: async function handleChatStream(req, res, { startedAt, readJson }) {
      try {
        const body = await readJson(req);
        const input = String(body?.prompt ?? body?.input ?? body?.message ?? "").trim();
        if (!input) {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify(createErrorEnvelope("MISSING_PROMPT", "prompt is required", { startedAt })));
          return;
        }
        res.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
        });
        const result = await gatewayService.execute({
          prompt: input,
          messages: body.messages,
          model: body.model,
          providerId: body.providerId,
          stream: true,
        });
        // 发送流式响应
        if (result.stream) {
          for await (const chunk of result.stream) {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }
        } else {
          res.write(`data: ${JSON.stringify(result)}\n\n`);
        }
        res.write("data: [DONE]\n\n");
        res.end();
      } catch (err) {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      }
    },
    public: true,
    description: "SSE 流式聊天",
  });

  return { handlers };
}
```

- [ ] **Step 2: 在 httpServer.js 中注册 chatRoutes**

在 `createGatewayHttpServer` 函数中添加:

```javascript
import { createChatRoutes } from "./routes/chatRoutes.js";

// 在 routeModules 数组中添加
const chatRoutes = createChatRoutes(application);
const routeModules = [
  diagnosticsRoutes.handlers,
  costCacheRoutes.handlers,
  chatRoutes.handlers,  // 新增
  knowledgeRoutes.handlers,
  workforceRoutes.handlers,
  enterpriseRoutes.handlers,
];
```

- [ ] **Step 3: 运行语法检查**

Run: `node --check apps/ai-gateway-service/src/http/routes/chatRoutes.js`
Expected: 无输出（语法正确）

- [ ] **Step 4: 运行安全回归验证**

Run: `cmd /c pnpm run verify:safe-regression-matrix`
Expected: `"status": "passed"`

- [ ] **Step 5: 运行健康检查**

Run: `cmd /c pnpm run health:phase12a`
Expected: `"conclusion": "service-health-ready"`

- [ ] **Step 6: 提交**

```bash
git add apps/ai-gateway-service/src/http/routes/chatRoutes.js
git commit -m "feat(http): extract chat routes to independent module"
```

---

## Task 2: 创建 providerRoutes.js — 抽取 Provider 路由

**Files:**
- Create: `apps/ai-gateway-service/src/http/routes/providerRoutes.js`
- Modify: `apps/ai-gateway-service/src/http/httpServer.js`

- [ ] **Step 1: 创建 providerRoutes.js**

```javascript
// apps/ai-gateway-service/src/http/routes/providerRoutes.js
import { createOkEnvelope, createErrorEnvelope } from "../../../../../packages/shared-utils/src/index.js";

/**
 * Provider 路由模块
 * 处理 /providers, /config/runtime 端点
 */
export function createProviderRoutes(application) {
  const { gatewayService, runtimeCredentialStore, providerConfigRoutes } = application;

  const handlers = new Map();

  // GET /providers — 列出所有 Provider
  handlers.set("GET /providers", {
    handler: async function handleProviders(_req, res, { startedAt, writeJson }) {
      const providers = gatewayService.getProviderDescriptors().map((p) => ({
        id: p.id,
        name: p.name,
        enabled: p.enabled,
        modelCount: p.models?.length ?? 0,
      }));
      writeJson(res, 200, createOkEnvelope({ providers }, { startedAt }));
    },
    public: true,
    description: "列出所有 Provider",
  });

  // GET /config/runtime — 运行时配置
  handlers.set("GET /config/runtime", {
    handler: async function handleRuntimeConfig(_req, res, { startedAt, writeJson }) {
      const config = {
        providerMode: application.config.aiGatewayService.providerMode,
        realProviderEnabled: application.config.aiGatewayService.realProviderEnabled,
        fallbackEnabled: application.config.aiGatewayService.fallbackEnabled,
        providerCount: gatewayService.getProviderDescriptors().length,
      };
      writeJson(res, 200, createOkEnvelope(config, { startedAt }));
    },
    public: true,
    description: "运行时配置",
  });

  // POST /providers/config/* — Provider 配置路由（委托给 providerConfigRoutes）
  if (providerConfigRoutes?.handlers) {
    for (const [key, value] of providerConfigRoutes.handlers) {
      handlers.set(key, value);
    }
  }

  return { handlers };
}
```

- [ ] **Step 2: 在 httpServer.js 中注册 providerRoutes**

```javascript
import { createProviderRoutes } from "./routes/providerRoutes.js";

const providerRoutes = createProviderRoutes(application);
routeModules.push(providerRoutes.handlers);
```

- [ ] **Step 3: 运行验证**

Run: `node --check apps/ai-gateway-service/src/http/routes/providerRoutes.js`
Expected: 无输出

- [ ] **Step 4: 提交**

```bash
git add apps/ai-gateway-service/src/http/routes/providerRoutes.js
git commit -m "feat(http): extract provider routes to independent module"
```

---

## Task 3: 创建 modelRoutes.js — 抽取模型路由

**Files:**
- Create: `apps/ai-gateway-service/src/http/routes/modelRoutes.js`
- Modify: `apps/ai-gateway-service/src/http/httpServer.js`

- [ ] **Step 1: 创建 modelRoutes.js**

```javascript
// apps/ai-gateway-service/src/http/routes/modelRoutes.js
import { createOkEnvelope, createErrorEnvelope } from "../../../../../packages/shared-utils/src/index.js";

/**
 * 模型路由模块
 * 处理 /models/* 端点
 */
export function createModelRoutes(application) {
  const { modelImportService, modelLibraryStore } = application;

  const handlers = new Map();

  // POST /models/import/preview — 模型导入预览
  handlers.set("POST /models/import/preview", {
    handler: async function handleModelImportPreview(req, res, { startedAt, readJson, writeJson }) {
      try {
        const body = await readJson(req);
        const apiKey = String(body?.apiKey ?? "").trim();
        if (!apiKey) {
          writeJson(res, 400, createErrorEnvelope("MISSING_API_KEY", "apiKey is required", { startedAt }));
          return;
        }
        const result = await modelImportService.preview({ apiKey, providerHint: body.providerHint });
        writeJson(res, 200, createOkEnvelope(result, { startedAt }));
      } catch (err) {
        writeJson(res, 500, createErrorEnvelope("MODEL_IMPORT_ERROR", err.message, { startedAt }));
      }
    },
    public: true,
    description: "模型导入预览",
  });

  // POST /models/import/confirm — 模型导入确认
  handlers.set("POST /models/import/confirm", {
    handler: async function handleModelImportConfirm(req, res, { startedAt, readJson, writeJson }) {
      try {
        const body = await readJson(req);
        const result = await modelImportService.confirm(body);
        writeJson(res, 200, createOkEnvelope(result, { startedAt }));
      } catch (err) {
        writeJson(res, 500, createErrorEnvelope("MODEL_IMPORT_ERROR", err.message, { startedAt }));
      }
    },
    public: true,
    description: "模型导入确认",
  });

  // GET /models/library — 模型库
  handlers.set("GET /models/library", {
    handler: async function handleModelLibrary(_req, res, { startedAt, writeJson }) {
      const registry = modelLibraryStore.getRegistry();
      writeJson(res, 200, createOkEnvelope({ registry }, { startedAt }));
    },
    public: true,
    description: "模型库",
  });

  return { handlers };
}
```

- [ ] **Step 2: 注册到 httpServer.js**

```javascript
import { createModelRoutes } from "./routes/modelRoutes.js";

const modelRoutes = createModelRoutes(application);
routeModules.push(modelRoutes.handlers);
```

- [ ] **Step 3: 运行验证并提交**

```bash
node --check apps/ai-gateway-service/src/http/routes/modelRoutes.js
git add apps/ai-gateway-service/src/http/routes/modelRoutes.js
git commit -m "feat(http): extract model routes to independent module"
```

---

## Task 4: 创建 providerHealthScorer.js — Provider 健康评分引擎

**Files:**
- Create: `apps/ai-gateway-service/src/providers/providerHealthScorer.js`
- Test: `apps/ai-gateway-service/src/providers/providerHealthScorer.test.js`

- [ ] **Step 1: 编写健康评分引擎测试**

```javascript
// apps/ai-gateway-service/src/providers/providerHealthScorer.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createProviderHealthScorer } from "./providerHealthScorer.js";

describe("ProviderHealthScorer", () => {
  it("should return 50 for new provider with no data", () => {
    const scorer = createProviderHealthScorer();
    const score = scorer.getScore("new-provider");
    assert.equal(score, 50);
  });

  it("should increase score for successful requests", () => {
    const scorer = createProviderHealthScorer();
    scorer.recordSuccess("p1", 200);
    scorer.recordSuccess("p1", 300);
    scorer.recordSuccess("p1", 100);
    const score = scorer.getScore("p1");
    assert.ok(score > 50, `Expected score > 50, got ${score}`);
  });

  it("should decrease score for failed requests", () => {
    const scorer = createProviderHealthScorer();
    scorer.recordFailure("p1", 500);
    scorer.recordFailure("p1", 500);
    scorer.recordFailure("p1", 500);
    const score = scorer.getScore("p1");
    assert.ok(score < 50, `Expected score < 50, got ${score}`);
  });

  it("should calculate weighted score correctly", () => {
    const scorer = createProviderHealthScorer();
    // 10 successes, 0 failures
    for (let i = 0; i < 10; i++) {
      scorer.recordSuccess("p1", 100);
    }
    const score = scorer.getScore("p1");
    assert.ok(score >= 80, `Expected score >= 80, got ${score}`);
  });

  it("should rank providers by score", () => {
    const scorer = createProviderHealthScorer();
    // p1: all success
    for (let i = 0; i < 10; i++) scorer.recordSuccess("p1", 100);
    // p2: all failure
    for (let i = 0; i < 10; i++) scorer.recordFailure("p2", 500);
    const ranked = scorer.getRankedProviders(["p1", "p2"]);
    assert.equal(ranked[0], "p1");
    assert.equal(ranked[1], "p2");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test apps/ai-gateway-service/src/providers/providerHealthScorer.test.js`
Expected: FAIL (模块不存在)

- [ ] **Step 3: 实现健康评分引擎**

```javascript
// apps/ai-gateway-service/src/providers/providerHealthScorer.js
const WINDOW_SIZE = 100; // 保留最近 100 次请求
const DEFAULT_SCORE = 50;

/**
 * Provider 健康评分引擎
 * 基于成功率、延迟、成本计算 0-100 健康分数
 */
export function createProviderHealthScorer() {
  // providerId -> { successes, failures, latencies, lastUpdated }
  const stats = new Map();

  function ensureStats(providerId) {
    if (!stats.has(providerId)) {
      stats.set(providerId, {
        successes: [],
        failures: [],
        latencies: [],
        lastUpdated: Date.now(),
      });
    }
    return stats.get(providerId);
  }

  function recordSuccess(providerId, latencyMs) {
    const s = ensureStats(providerId);
    s.successes.push({ at: Date.now(), latencyMs });
    s.latencies.push(latencyMs);
    // 滑动窗口
    if (s.successes.length > WINDOW_SIZE) s.successes.shift();
    if (s.latencies.length > WINDOW_SIZE) s.latencies.shift();
    s.lastUpdated = Date.now();
  }

  function recordFailure(providerId, _errorCode) {
    const s = ensureStats(providerId);
    s.failures.push({ at: Date.now() });
    if (s.failures.length > WINDOW_SIZE) s.failures.shift();
    s.lastUpdated = Date.now();
  }

  function getScore(providerId) {
    const s = stats.get(providerId);
    if (!s) return DEFAULT_SCORE;

    const total = s.successes.length + s.failures.length;
    if (total === 0) return DEFAULT_SCORE;

    // 成功率 (权重 50%)
    const successRate = s.successes.length / total;

    // 延迟分数 (权重 30%) — P50 < 2s = 1.0, P50 > 10s = 0.0
    let latencyScore = 1.0;
    if (s.latencies.length > 0) {
      const sorted = [...s.latencies].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length / 2)];
      latencyScore = Math.max(0, Math.min(1, 1 - (p50 - 2000) / 8000));
    }

    // 新鲜度分数 (权重 20%) — 最近 5 分钟内有请求 = 1.0
    const age = Date.now() - s.lastUpdated;
    const freshnessScore = Math.max(0, 1 - age / (5 * 60 * 1000));

    const score = (successRate * 50) + (latencyScore * 30) + (freshnessScore * 20);
    return Math.round(Math.max(0, Math.min(100, score)));
  }

  function getRankedProviders(providerIds) {
    return [...providerIds].sort((a, b) => getScore(b) - getScore(a));
  }

  function getAllScores() {
    const result = {};
    for (const [providerId] of stats) {
      result[providerId] = getScore(providerId);
    }
    return result;
  }

  return { recordSuccess, recordFailure, getScore, getRankedProviders, getAllScores };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test apps/ai-gateway-service/src/providers/providerHealthScorer.test.js`
Expected: ALL PASS

- [ ] **Step 5: 提交**

```bash
git add apps/ai-gateway-service/src/providers/providerHealthScorer.js apps/ai-gateway-service/src/providers/providerHealthScorer.test.js
git commit -m "feat(providers): add health scorer for intelligent load balancing"
```

---

## Task 5: 创建 providerLoadBalancer.js — 智能负载均衡

**Files:**
- Create: `apps/ai-gateway-service/src/providers/providerLoadBalancer.js`
- Test: `apps/ai-gateway-service/src/providers/providerLoadBalancer.test.js`

- [ ] **Step 1: 编写负载均衡器测试**

```javascript
// apps/ai-gateway-service/src/providers/providerLoadBalancer.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createProviderLoadBalancer } from "./providerLoadBalancer.js";
import { createProviderHealthScorer } from "./providerHealthScorer.js";

describe("ProviderLoadBalancer", () => {
  it("should select provider with highest score", () => {
    const scorer = createProviderHealthScorer();
    const balancer = createProviderLoadBalancer({ healthScorer: scorer });
    // p1: high score
    for (let i = 0; i < 10; i++) scorer.recordSuccess("p1", 100);
    // p2: low score
    for (let i = 0; i < 10; i++) scorer.recordFailure("p2", 500);
    const selected = balancer.select(["p1", "p2"]);
    assert.equal(selected, "p1");
  });

  it("should distribute load among healthy providers", () => {
    const scorer = createProviderHealthScorer();
    const balancer = createProviderLoadBalancer({ healthScorer: scorer });
    // Both healthy
    for (let i = 0; i < 10; i++) {
      scorer.recordSuccess("p1", 100);
      scorer.recordSuccess("p2", 100);
    }
    const selections = new Set();
    for (let i = 0; i < 100; i++) {
      selections.add(balancer.select(["p1", "p2"]));
    }
    // Both should be selected at least once
    assert.ok(selections.has("p1"), "p1 should be selected");
    assert.ok(selections.has("p2"), "p2 should be selected");
  });

  it("should return null for empty list", () => {
    const scorer = createProviderHealthScorer();
    const balancer = createProviderLoadBalancer({ healthScorer: scorer });
    const selected = balancer.select([]);
    assert.equal(selected, null);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test apps/ai-gateway-service/src/providers/providerLoadBalancer.test.js`
Expected: FAIL

- [ ] **Step 3: 实现负载均衡器**

```javascript
// apps/ai-gateway-service/src/providers/providerLoadBalancer.js
import { createProviderHealthScorer } from "./providerHealthScorer.js";

/**
 * 智能负载均衡器
 * 基于健康评分的加权随机选择
 */
export function createProviderLoadBalancer(options = {}) {
  const healthScorer = options.healthScorer ?? createProviderHealthScorer();

  /**
   * 从候选 Provider 列表中选择一个
   * 使用加权随机：分数越高的 Provider 被选中概率越大
   */
  function select(candidateIds) {
    if (!candidateIds || candidateIds.length === 0) return null;
    if (candidateIds.length === 1) return candidateIds[0];

    // 获取每个 Provider 的健康分数
    const scored = candidateIds.map((id) => ({
      id,
      score: Math.max(1, healthScorer.getScore(id)), // 最低 1 分，避免权重为 0
    }));

    // 加权随机选择
    const totalWeight = scored.reduce((sum, p) => sum + p.score, 0);
    let random = Math.random() * totalWeight;

    for (const provider of scored) {
      random -= provider.score;
      if (random <= 0) return provider.id;
    }

    // 兜底：返回最后一个
    return scored[scored.length - 1].id;
  }

  /**
   * 获取负载均衡器状态
   */
  function getStatus(candidateIds) {
    return candidateIds.map((id) => ({
      id,
      score: healthScorer.getScore(id),
    }));
  }

  return { select, getStatus, healthScorer };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test apps/ai-gateway-service/src/providers/providerLoadBalancer.test.js`
Expected: ALL PASS

- [ ] **Step 5: 提交**

```bash
git add apps/ai-gateway-service/src/providers/providerLoadBalancer.js apps/ai-gateway-service/src/providers/providerLoadBalancer.test.js
git commit -m "feat(providers): add intelligent load balancer with health-weighted selection"
```

---

## Task 6: 创建 openApiGenerator.js — OpenAPI 文档生成

**Files:**
- Create: `apps/ai-gateway-service/src/http/openApiGenerator.js`
- Create: `apps/ai-gateway-service/src/http/swaggerUi.js`

- [ ] **Step 1: 创建 OpenAPI spec 生成器**

```javascript
// apps/ai-gateway-service/src/http/openApiGenerator.js
/**
 * 从路由模块元数据生成 OpenAPI 3.0 spec
 */
export function generateOpenApiSpec(routeModules, options = {}) {
  const spec = {
    openapi: "3.0.3",
    info: {
      title: options.title ?? "AI Gateway API",
      version: options.version ?? "0.1.0",
      description: options.description ?? "Unified AI System Gateway API",
    },
    servers: [
      { url: options.serverUrl ?? "http://127.0.0.1:3100", description: "Local" },
    ],
    paths: {},
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  };

  for (const handlers of routeModules) {
    if (!handlers || typeof handlers.forEach !== "function") continue;
    handlers.forEach?.((routeDef, key) => {
      if (!key || typeof key !== "string") return;
      const [method, path] = key.split(" ");
      if (!method || !path) return;

      const httpMethod = method.toLowerCase();
      const openApiPath = path.replace(/:([a-zA-Z_]+)/g, "{$1}");

      if (!spec.paths[openApiPath]) {
        spec.paths[openApiPath] = {};
      }

      spec.paths[openApiPath][httpMethod] = {
        summary: routeDef.description ?? key,
        operationId: key.replace(/[^a-zA-Z0-9]/g, "_"),
        responses: {
          "200": {
            description: "成功",
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
          },
          "400": { description: "请求参数错误" },
          "500": { description: "服务器内部错误" },
        },
      };

      if (!routeDef.public) {
        spec.paths[openApiPath][httpMethod].security = [{ bearerAuth: [] }];
      }
    });
  }

  return spec;
}
```

- [ ] **Step 2: 创建 Swagger UI 页面**

```javascript
// apps/ai-gateway-service/src/http/swaggerUi.js
/**
 * 内嵌 Swagger UI（无外部 CDN 依赖）
 * 使用 Redoc 作为轻量替代
 */
export function createSwaggerUiPage(spec) {
  const specJson = JSON.stringify(spec);
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AI Gateway API 文档</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f7fa; }
    .header { background: #1a1a2e; color: white; padding: 20px; text-align: center; }
    .header h1 { font-size: 1.5rem; }
    .header p { opacity: 0.7; margin-top: 8px; }
    .container { max-width: 1200px; margin: 20px auto; padding: 0 20px; }
    .endpoint { background: white; border-radius: 8px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
    .endpoint-header { padding: 16px; cursor: pointer; display: flex; align-items: center; gap: 12px; }
    .endpoint-header:hover { background: #f8f9fa; }
    .method { padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 0.85rem; min-width: 60px; text-align: center; }
    .method-get { background: #61affe; color: white; }
    .method-post { background: #49cc90; color: white; }
    .method-put { background: #fca130; color: white; }
    .method-delete { background: #f93e3e; color: white; }
    .path { font-family: monospace; font-size: 0.95rem; }
    .description { color: #666; font-size: 0.9rem; margin-left: auto; }
    .badge-public { background: #e8f5e9; color: #2e7d32; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; }
    .badge-auth { background: #fff3e0; color: #e65100; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🤖 AI Gateway API 文档</h1>
    <p>自动生成于路由模块元数据 | OpenAPI 3.0</p>
  </div>
  <div class="container" id="endpoints"></div>
  <script>
    const spec = ${specJson};
    const container = document.getElementById('endpoints');
    const paths = spec.paths || {};
    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, op] of Object.entries(methods)) {
        const div = document.createElement('div');
        div.className = 'endpoint';
        const isPublic = !op.security || op.security.length === 0;
        div.innerHTML = \`
          <div class="endpoint-header">
            <span class="method method-\${method}">\${method.toUpperCase()}</span>
            <span class="path">\${path}</span>
            <span class="description">\${op.summary || ''}</span>
            <span class="\${isPublic ? 'badge-public' : 'badge-auth'}">\${isPublic ? '公开' : '需认证'}</span>
          </div>
        \`;
        container.appendChild(div);
      }
    }
  </script>
</body>
</html>`;
}
```

- [ ] **Step 3: 在 httpServer.js 中添加 /api-docs 端点**

```javascript
import { generateOpenApiSpec } from "./openApiGenerator.js";
import { createSwaggerUiPage } from "./swaggerUi.js";

// 在路由分发中添加
if (request.method === "GET" && url.pathname === "/api-docs") {
  const spec = generateOpenApiSpec(routeModules);
  const html = createSwaggerUiPage(spec);
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(html);
  return;
}
```

- [ ] **Step 4: 运行验证并提交**

```bash
node --check apps/ai-gateway-service/src/http/openApiGenerator.js
node --check apps/ai-gateway-service/src/http/swaggerUi.js
git add apps/ai-gateway-service/src/http/openApiGenerator.js apps/ai-gateway-service/src/http/swaggerUi.js
git commit -m "feat(http): add auto-generated OpenAPI docs at /api-docs"
```

---

## Task 7: 创建 prometheusExporter.js — Prometheus 指标导出

**Files:**
- Create: `apps/ai-gateway-service/src/observability/prometheusExporter.js`

- [ ] **Step 1: 创建 Prometheus 导出器**

```javascript
// apps/ai-gateway-service/src/observability/prometheusExporter.js
/**
 * Prometheus 指标导出器
 * 将内部指标转换为 Prometheus 文本格式
 */
export function createPrometheusExporter(options = {}) {
  const prefix = options.prefix ?? "ai_gateway";

  /**
   * 将指标快照转换为 Prometheus 格式
   */
  function formatMetrics(snapshot) {
    const lines = [];

    // 请求数量
    lines.push(`# HELP ${prefix}_requests_total Total number of requests`);
    lines.push(`# TYPE ${prefix}_requests_total counter`);
    lines.push(`${prefix}_requests_total ${snapshot.totalRequests ?? 0}`);

    // 活跃连接数
    lines.push(`# HELP ${prefix}_active_connections Active connections`);
    lines.push(`# TYPE ${prefix}_active_connections gauge`);
    lines.push(`${prefix}_active_connections ${snapshot.activeConnections ?? 0}`);

    // 延迟直方图
    lines.push(`# HELP ${prefix}_request_duration_ms Request duration in milliseconds`);
    lines.push(`# TYPE ${prefix}_request_duration_ms summary`);
    if (snapshot.latency) {
      lines.push(`${prefix}_request_duration_ms{quantile="0.5"} ${snapshot.latency.p50 ?? 0}`);
      lines.push(`${prefix}_request_duration_ms{quantile="0.95"} ${snapshot.latency.p95 ?? 0}`);
      lines.push(`${prefix}_request_duration_ms{quantile="0.99"} ${snapshot.latency.p99 ?? 0}`);
    }

    // 错误率
    lines.push(`# HELP ${prefix}_errors_total Total number of errors`);
    lines.push(`# TYPE ${prefix}_errors_total counter`);
    lines.push(`${prefix}_errors_total ${snapshot.totalErrors ?? 0}`);

    // Provider 健康分数
    lines.push(`# HELP ${prefix}_provider_health_score Provider health score (0-100)`);
    lines.push(`# TYPE ${prefix}_provider_health_score gauge`);
    if (snapshot.providerScores) {
      for (const [providerId, score] of Object.entries(snapshot.providerScores)) {
        lines.push(`${prefix}_provider_health_score{provider="${providerId}"} ${score}`);
      }
    }

    return lines.join("\n") + "\n";
  }

  return { formatMetrics };
}
```

- [ ] **Step 2: 在 httpServer.js 中更新 /metrics 端点**

```javascript
import { createPrometheusExporter } from "../observability/prometheusExporter.js";

const prometheusExporter = createPrometheusExporter();

// 在 /metrics 端点中
if (request.method === "GET" && url.pathname === "/metrics") {
  const accept = request.headers.accept ?? "";
  if (accept.includes("text/plain") || accept.includes("application/openmetrics-text")) {
    // Prometheus 格式
    const snapshot = metricsCollector?.getSnapshot() ?? {};
    const prometheus = prometheusExporter.formatMetrics(snapshot);
    response.writeHead(200, { "content-type": "text/plain; version=0.0.4; charset=utf-8" });
    response.end(prometheus);
  } else {
    // JSON 格式（向后兼容）
    writeJson(response, 200, createOkEnvelope(metricsCollector?.getSnapshot() ?? {}, { startedAt }));
  }
  return;
}
```

- [ ] **Step 3: 运行验证并提交**

```bash
node --check apps/ai-gateway-service/src/observability/prometheusExporter.js
git add apps/ai-gateway-service/src/observability/prometheusExporter.js
git commit -m "feat(observability): add Prometheus metrics exporter"
```

---

## Task 8: 全局验证 — 确保所有修改通过

- [ ] **Step 1: 运行全包语法检查**

Run: `cmd /c pnpm run doctor:phase13a`
Expected: 所有包 `check: Done`

- [ ] **Step 2: 运行安全回归验证**

Run: `cmd /c pnpm run verify:safe-regression-matrix`
Expected: `"status": "passed"`

- [ ] **Step 3: 运行密钥安全验证**

Run: `cmd /c pnpm run verify:phase107a-secret-safety`
Expected: `"conclusion": "secret-safety-ready"`

- [ ] **Step 4: 运行健康检查**

Run: `cmd /c pnpm run health:phase12a`
Expected: `"conclusion": "service-health-ready"`

- [ ] **Step 5: 运行单元测试**

Run: `cmd /c pnpm -r --if-present test`
Expected: 所有测试通过（除已知的 forge-core self-loop 测试）

- [ ] **Step 6: 最终提交**

```bash
git add -A
git commit -m "feat: epic system upgrade — P1 routes modularization + P2 provider health + P4 openapi + P5 prometheus"
```

---

## 后续任务（待本计划完成后继续）

- **P3**: 补充核心路由模块的单元测试
- **P6**: Workforce 生产化（执行稳定性、结果持久化）
- **P7**: 数据库层升级（Repository 模式、可选 PostgreSQL）
- **P8**: 容器化部署（Docker Compose）
- **P9**: 性能优化（连接池、缓存、批处理）
- **P10**: UI 现代化（组件化、响应式、主题）

---

*计划完成，等待执行。*
