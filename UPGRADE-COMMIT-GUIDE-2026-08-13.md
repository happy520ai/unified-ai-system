# 十六轮改动提交指南

> 当前 `git status`：**136 个未提交改动**（79 未跟踪 + 57 已修改，其中 52 个测试文件）。
> 这些改动 = 十六轮「提升→测试→查漏→修复→回归」的成果，叠加在更早的未提交 WIP 之上。
> 本文把改动按**逻辑主题**分组，建议按顺序提交（每个 commit 自洽、可独立 revert）。

---

## 建议提交顺序（Conventional Commits）

### ① fix: 可观测性台账接线 + 成本记账
第一轮核心成果——把孤儿 `requestLogger` 接进调用链。
- `apps/ai-gateway-service/src/core/gatewayService.js`（`#recordUsage`）
- `apps/ai-gateway-service/src/application/createGatewayApplication.js`（注入 requestLogger）
- `apps/ai-gateway-service/src/http/httpServerRoutes02.js`（`/usage/summary` + `/metrics` 端点）
- `apps/ai-gateway-service/src/logging/requestLogger.js`（成本精度修复）
- `apps/ai-gateway-service/src/observability/prometheusExporter.js`
- 测试：`core/gatewayService.usageLedger.test.js`、`logging/requestLogger.test.js`、`observability/prometheusExporter.test.js`

### ② fix: 权限映射 + 并发丢失 + 安全默认值
三个真实 bug 修复。
- `apps/ai-gateway-service/src/http/utils/enterpriseUtils.js`（`/usage/summary`、`/metrics` 权限）
- `apps/ai-gateway-service/src/workforce/workforcePlanStore-utils.js`（原子写）
- `apps/ai-gateway-service/src/workforce/workforcePlanStore.js`（互斥锁）
- `.env.example`（默认 fake provider）
- 测试：`http/utils/resolvePermission.test.js`、`workforce/workforcePlanStore.concurrent.test.js`

### ③ feat: 治理做实——成本守卫 + 模型访问控制
第十二、十四、十五轮。
- `apps/ai-gateway-service/src/cost/tokenCostGuard.js`（`enforceTokenCostGuard`）
- `apps/ai-gateway-service/src/core/gatewayService.js`（`#enforceCostGuard`、`#enforceModelAccess`）
- `apps/ai-gateway-service/src/application/createGatewayApplication.js`（governance 注入 + 两个 env 开关）
- 测试：`cost/tokenCostGuard.test.js`、`core/gatewayService.costGuard.test.js`、`core/gatewayService.modelAccess.test.js`、`application/createGatewayApplication.rbac.test.js`、`enterprise/advancedRBAC.test.js`

### ④ test: 补测试覆盖（引擎包 + 小包 + provider + workforce）
第三、七、八、九、十三轮。
- `packages/codex-context-gateway/src/*.test.js`、`packages/taiji-beidou-engine/src/*.test.js`
- `packages/shared-config/src/*.test.js`、`packages/workforce-scheduler/src/*.test.js`
- `packages/position-library/src/*.test.js`、`packages/employee-brain-adapter/src/*.test.js`
- `apps/ai-gateway-service/src/providers/httpProviderMapping.response.test.js`
- `apps/ai-gateway-service/src/providers/httpLlmProviderAdapter.e2e.test.js`
- `apps/ai-gateway-service/src/workforce/workforceService.execute.test.js`
- 6 个 `packages/*/package.json`（加 `test` script）

### ⑤ docs: 工具数修正 + 升级总结
第八、十一轮 + 本指南。
- `README.md`、`README.zh-CN.md`（MCP 工具数 9→12）
- `UPGRADE-SUMMARY-2026-08-13.md`
- `AUDIT-REPORT-2026-08-12.md`

> ⚠️ 注意：`git status` 里还有一部分是**十六轮之前**的未提交 WIP（如 `a2aGateway.js`、`httpServer.js`、`workforceService.js`、`workforceRealLocalRunner.js`、`multimodalRoutes.js` 等 workforce/A2A 相关）。这些不属于十六轮成果，建议**单独审查**或并入相关主题提交。

---

## 提交前验证

每个 commit 前建议跑：
```bash
node apps/ai-gateway-service/src/entrypoints/runTestSuite.js --scope=unit --framework=all
```

当前全量：**589 个测试全绿**（apps 530 + 引擎包 30 + 小包 29）。

---

## 当前状态小结

- 审计（6.1/10）→ 十六轮后（约 7.0/10，工程健康度）
- 3 个真实 bug 修复 + 2 处安全/文档隐患修复
- 测试 485 → 589
- P0 采用门槛三项全部完成（真实 provider 冒烟、可观测、一键部署）
- 治理做实（成本守卫 + 模型访问控制，默认关闭可 opt-in）
