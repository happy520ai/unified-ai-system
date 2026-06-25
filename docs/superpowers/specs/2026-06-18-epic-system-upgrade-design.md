# AI Gateway 系统史诗级提升设计方案

- 日期: 2026-06-18
- 状态: 已批准
- 策略: 逐模块渐进 + 保守模式（核心链路永不中断，新功能默认关闭）

---

## 1. 设计目标

将 AI Gateway 系统从当前的实验性/预览状态提升到生产级可用状态，同时保持：

- 核心链路（`/chat`、`/knowledge`、`/health`）始终可用
- 逐模块升级，每步可验证
- Feature Flag 控制新功能
- 证据驱动，每个模块通过验证后才继续

## 2. 当前系统评估

### 优势
- 30+ LLM Provider 已配置
- 知识库/RAG 系统功能完整（本地 TF-IDF，无需外部模型）
- Enterprise 治理（用户/角色/审计/撤销）架构完整
- 安全基础设施（SSRF 防护、熔断器、速率限制、审计哈希链）
- 响应缓存系统（语义判断、新鲜度守卫）
- 多模态 API（图像/嵌入/TTS/STT）

### 待改进
- `httpServer.js` 192KB 巨型文件
- 硬编码 API Key 在配置文件中
- 测试覆盖率低（核心路由层 0 测试）
- 缺少 OpenAPI 文档
- 可观测性不足（无 OpenTelemetry）
- Workforce 声明为 beta
- UI 单文件 244KB

## 3. 模块升级计划

### P1: httpServer.js 拆分（192KB → 模块化）

**目标**: 将 3900+ 行的单文件拆分为模块化路由结构

**目标架构**:
```
src/http/
├── httpServer.js              (~200行：中间件链+路由分发)
├── middleware/
│   ├── rateLimitMiddleware.js
│   ├── corsMiddleware.js
│   ├── requestIdMiddleware.js
│   └── errorHandlerMiddleware.js
├── routes/
│   ├── diagnosticsRoutes.js   (已有)
│   ├── costCacheRoutes.js     (已有)
│   ├── knowledgeRoutes.js     (已有)
│   ├── workforceRoutes.js     (已有)
│   ├── enterpriseRoutes.js    (已有)
│   ├── chatRoutes.js          (新建：/chat, /chat/stream)
│   ├── providerRoutes.js      (新建：/providers, /config/runtime)
│   ├── modelRoutes.js         (新建：/models/*)
│   ├── multimodalRoutes.js    (新建：/v1/*)
│   ├── forgeRoutes.js         (新建：/forge/*)
│   ├── workflowRoutes.js      (新建：/workflow/*)
│   └── uiRoutes.js            (新建：/ui, /console)
├── connectionPool.js          (已有)
├── webSocketServer.js         (已有)
├── rateLimiter.js             (已有)
└── structuredLogger.js        (已有)
```

**迁移策略**:
1. 渐进式迁移：每次从 httpServer.js 抽取一个路由组
2. 接口不变：所有 API 端点路径和行为保持不变
3. 每步验证：运行 `verify:safe-regression-matrix`
4. Feature Flag：`ROUTE_MODULARIZATION=true` 开启新路由

**验收标准**:
- [ ] httpServer.js < 300 行
- [ ] 所有路由模块独立可测试
- [ ] `verify:safe-regression-matrix` 通过
- [ ] 所有现有 API 端点行为不变

---

### P2: Provider 系统增强

**目标**: 从简单优先级列表升级为智能负载均衡

**新增组件**:
```
src/providers/
├── providerHealthScorer.js      — 健康评分引擎（延迟+成功率+成本）
├── providerLoadBalancer.js      — 加权随机选择
├── providerFailoverChain.js     — 故障自动转移链
└── providerConfigWatcher.js     — 配置文件热更新（fs.watch）
```

**健康评分算法**:
```
score = (successRate * 0.5) + (latencyScore * 0.3) + (costScore * 0.2)
- successRate: 成功率 (0-1)
- latencyScore: 延迟反比 (0-1, P50 < 2s = 1.0)
- costScore: 成本反比 (0-1, 最低成本 = 1.0)
```

**故障转移链**:
1. 主 Provider 调用失败
2. 等待 100ms（避免级联）
3. 选择下一个健康分数最高的 Provider
4. 最多重试 3 次
5. 全部失败返回 503

**验收标准**:
- [ ] 健康评分实时更新（每 30s）
- [ ] 故障转移延迟 < 500ms
- [ ] 配置热更新无需重启
- [ ] 现有 Provider 行为兼容

---

### P3: 测试覆盖补充

**目标**: 核心链路测试覆盖率从 ~20% 提升到 80%+

**优先测试模块**:
1. `routes/chatRoutes.js` — 核心聊天链路
2. `routes/knowledgeRoutes.js` — 知识库链路
3. `providers/httpLlmProviderAdapter.js` — Provider 调用
4. `core/gatewayService.js` — 网关核心
5. `workforce/workforceService.js` — Workforce 服务

**测试策略**:
- 单元测试：mock application 对象，测试路由逻辑
- 集成测试：完整 HTTP 请求链路
- 回归测试：确保每次修改不破坏已有功能

**验收标准**:
- [ ] 核心路由模块每个端点至少 3 个测试（正常/错误/边界）
- [ ] `pnpm -r --if-present test` 全部通过
- [ ] 测试覆盖率达到 80%+

---

### P4: OpenAPI 文档自动生成

**目标**: API 文档零手工维护

**方案**:
- 从路由模块元数据自动生成 OpenAPI 3.0 spec
- `GET /api-docs` 返回 Swagger UI
- 每个路由模块声明：路径、方法、参数、响应格式

**新增文件**:
```
src/http/
├── openApiGenerator.js    — 从路由元数据生成 OpenAPI spec
└── swaggerUi.js           — 内嵌 Swagger UI（无外部 CDN）
```

**验收标准**:
- [ ] 所有 API 端点在 Swagger UI 中可见
- [ ] 请求/响应格式自动推断
- [ ] 无外部 CDN 依赖

---

### P5: 可观测性升级

**目标**: 从基础日志升级为全栈可观测性

**增强内容**:
- OpenTelemetry 集成（分布式追踪）
- Prometheus 指标导出（`GET /metrics`）
- SLO 仪表板（延迟 P50/P95/P99、错误率、吞吐量）
- 告警规则（错误率 > 5% 或延迟 P99 > 10s）

**新增文件**:
```
src/observability/
├── openTelemetry.js       — OTel 初始化
├── prometheusExporter.js  — Prometheus 格式
├── sloTracker.js          — SLO 跟踪
└── alertRules.js          — 告警规则引擎
```

**验收标准**:
- [ ] Trace ID 贯穿完整请求链路
- [ ] Prometheus 指标可被 Grafana 采集
- [ ] SLO 仪表板实时更新

---

### P6: Workforce 生产化

**目标**: 从 beta 升级为生产可用

**增强内容**:
- 执行稳定性：超时处理、死锁检测、资源限制
- 结果持久化：执行结果写入 SQLite
- Webhook 回调：执行完成/失败时通知
- 执行历史：查询历史记录、统计成功率

**验收标准**:
- [ ] 执行超时自动终止
- [ ] 结果持久化到 SQLite
- [ ] Webhook 回调可靠送达
- [ ] 执行历史可查询

---

### P7: 数据库层升级

**目标**: 统一数据访问层，支持可选 PostgreSQL

**方案**:
- 保持 SQLite 作为默认（零配置）
- 可选 PostgreSQL（通过 `DATABASE_URL` 环境变量切换）
- Repository 模式统一数据访问
- 版本化 schema 迁移

**验收标准**:
- [ ] SQLite 默认工作（零配置）
- [ ] PostgreSQL 可选切换
- [ ] 数据迁移脚本版本化

---

### P8: 容器化部署

**目标**: 一键部署到任何环境

**方案**:
- 多阶段 Dockerfile（构建 + 运行）
- Docker Compose（Gateway + SQLite + 可选 Redis）
- 健康检查端点用于容器编排
- 环境变量配置

**验收标准**:
- [ ] `docker compose up` 一键启动
- [ ] 健康检查通过
- [ ] 镜像大小 < 200MB

---

### P9: 性能优化

**目标**: 提升吞吐量和响应速度

**方案**:
- 连接池优化：HTTP keep-alive 调优
- 响应缓存增强：语义相似度命中率提升
- 请求批处理：相似请求合并
- 背压控制：高负载时排队

**验收标准**:
- [ ] P99 延迟降低 30%
- [ ] 缓存命中率提升到 40%+
- [ ] 高负载时优雅降级

---

### P10: UI 现代化

**目标**: 从单文件巨型页面升级为组件化结构

**方案**:
- 拆分 `consolePage.js`（244KB）为组件
- 响应式布局（移动端支持）
- 实时状态更新（WebSocket 推送）
- 深色/浅色主题

**验收标准**:
- [ ] consolePage.js < 50KB
- [ ] 移动端可用
- [ ] 主题切换流畅

---

## 4. 实施顺序

```
P1 httpServer.js 拆分 (第1-2周)
  ↓
P2 Provider 增强 (第3周)
  ↓
P3 测试覆盖 (第4-5周)
  ↓
P4 OpenAPI 文档 (第6周)
  ↓
P5 可观测性 (第7周)
  ↓
P6 Workforce 生产化 (第8-9周)
  ↓
P7 数据库升级 (第10周)
  ↓
P8 容器化 (第11周)
  ↓
P9 性能优化 (第12周)
  ↓
P10 UI 现代化 (第13-14周)
```

## 5. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 拆分引入回归 | 高 | 每步运行 safe-regression-matrix |
| Provider 故障转移循环 | 中 | 熔断器 + 最大重试次数 |
| 测试覆盖不足 | 中 | 先写测试再写代码（TDD） |
| 数据库迁移数据丢失 | 高 | 迁移前自动备份 |
| 容器镜像过大 | 低 | 多阶段构建 + 依赖精简 |

## 6. 验证检查点

每个模块完成后必须通过：
1. `node --check` 所有修改的 JS 文件
2. `pnpm -r --if-present check` 全包语法检查
3. `pnpm run verify:safe-regression-matrix` 安全回归
4. `pnpm run health:phase12a` 服务健康检查
5. 模块特定的验证脚本

---

*设计文档完成，等待用户审阅后进入实施计划阶段。*
