# World-Class Sprint Execution Template

> 给执行型 Agent（如 MiMo v2.5 Pro / Codex）的**有界**冲刺模板。
> 目标：把本系统推向世界顶尖水平。
> **不是"无限计划模式"。是"持续到达标为止"的闭环。**

---

## 0. 给执行 Agent 的第一段话（必读）

你在执行一个已经有清晰诊断的系统升级。诊断结果（截至 2026-06-19，经第三方实测验证）：

**已达标（不要回退、不要重做）：**
- `/chat` 真实对话链路成立（NVIDIA llama-3.3-nemotron，`executionMode:"real"`）
- phase107a secret-safety = passed
- health:phase12a = service-health-ready（routes 全 true）
- safe-regression-matrix = passed，`providerCallRiskDetected:false`
- CI matrix = `[22]`，glob 隐患已消除
- 单元测试 235 项（src）+ e2e 19 项通过

**未达标（你的工作对象，每条都有实测证据）：**
1. `/metrics` 端点返回 HTTP 500（`metricsCollector.getMetrics is not a function`）
2. `fetch(agent:)` 连接池失效——undici 忽略 `agent` 选项，4 处死代码
3. `sqliteRepository.js` 名为 SQLite 实为 JSON 文件，无升级路径
4. `sqliteVecStore.js` 全量加载向量进内存做 cosine 暴力扫描
5. TypeScript 合约**从不编译**（`check` 只 `fs.accessSync`，不跑 tsc）
6. 零运行时校验（无 zod/ajv/joi）
7. God-files：`consolePage.js` 5709 行、`httpServer.js` 4642 行
8. `httpServer.js` 有 305 个 `if(pathname===...)` 分支 + 3 套未完成路由抽象
9. 可观测性全手写：OTel 不导出、Prometheus 手拼字符串、日志是 `console.error(JSON.stringify)`
10. 14 个空 `catch {}`、29 处生产路径 `console.*`
11. `.bak` 文件入库、孤儿 `.ts` 文件

**你的铁律（违反即作废）：**
- **禁止新增 phase 编号、禁止新增 verify:phase* 脚本、禁止新增 evidence JSON**
- **禁止重新发明基础设施**——需要 DB/缓存/校验/日志/OTel，**用被验证的库**
- **禁止"无限模式"**——每轮必须可验证、可回滚、有硬出口
- **禁止未经实测就声明完成**（见第 4 节验证闸门）
- 遵守 AGENTS.md 边界：不动 `legacy/`、不读 `.env`/auth.json、不打印明文密钥、不擅自部署/发布/打 tag/push/commit

---

## 1. 基线快照（执行前必须先冻结，作为防退化锚点）

每一轮开始前，先跑这组命令并记录输出到 `docs/world-class-baseline-<date>.md`：

```powershell
cd E:\AI-Data\AI网关系统\unified-ai-system

# 1. 测试基线（当前 257 tests / 217 pass / 40 fail）
cd apps/ai-gateway-service && pnpm test 2>&1 | grep -E "tests [0-9]|pass [0-9]|fail [0-9]"
cd ../..

# 2. 语法全检（当前 1084 文件全过）
pnpm -r --if-present check

# 3. 三大验证器
node ./tools/phase12a/health.mjs
node ./apps/ai-gateway-service/src/regression/runSafeRegressionMatrix.js
node ./apps/ai-gateway-service/src/entrypoints/verifySecretSafety.js

# 4. /chat 真实链路冒烟（确认 provider 仍可用）
curl -s -X POST http://127.0.0.1:3100/chat -H "Content-Type: application/json" -d "{\"prompt\":\"reply with: pong\"}"

# 5. 已知坏端点（修复目标，现在应该 500）
curl -s -o /dev/null -w "/metrics -> HTTP %{http_code}\n" http://127.0.0.1:3100/metrics
```

**防退化规则：** 每轮结束后重跑这 5 条。任何一项从绿变红，**必须先回滚再继续**，绝不带病推进。

---

## 2. 五条推进轨道（按 ROI 排序，必须严格顺序）

每条轨道 = 多个 sprint。一个 sprint 只做一条轨道的一个子项。

### 轨道 A：止血（Bug 修复）— 最高优先，最先做

| # | 任务 | 验收 |
|---|---|---|
| A1 | 修 `/metrics` 500：对齐 metricsCollector 方法名 | `curl /metrics` 返回 200 + Prometheus 文本 |
| A2 | 删 `fetch(agent:)` 死代码（4 处），改用 undici 池或官方 SDK | grep `agent:` 在 providers 下 = 0；/chat 无回归 |
| A3 | 修 `sqliteRepository.js`：要么真用 better-sqlite3（在 gateway package.json 声明依赖），要么诚实改名 + 去掉"自动升级"假注释 | health 端点 `type` 字段反映真实实现 |
| A4 | 修 `sqliteVecStore`：真加载 vec 扩展，或诚实标注 brute-force 限制 + 加文档数阈值守护 | 1000 文档查询 < 500ms 或有清晰降级 |

### 轨道 B：边界可信（类型 + 校验）

| # | 任务 | 验收 |
|---|---|---|
| B1 | 引入 zod，为 `/chat`、`/chat/rag`、`/models/import/preview` 写请求 schema | 非 schema 请求返回结构化 400；/chat 无回归 |
| B2 | 让 shared-contracts **真的编译**：`check` 改为 `tsc --noEmit` | `pnpm --filter shared-contracts check` 跑 tsc，0 error |
| B3 | gateway 消费编译后的合约类型（至少新代码用） | 新 handler 有类型标注 |

### 轨道 C：架构拆分（God-files）

| # | 任务 | 验收 |
|---|---|---|
| C1 | `httpServer.js`：把 305 个 if/else 迁完到 routeTable | grep `pathname ===` 在 httpServer < 50 |
| C2 | 把 `runPhase312AChatGateway`、`createHealth`、`createSetupReadiness` 等业务逻辑搬到 `core/` 或 `chat-gateway/` | httpServer.js < 1500 行 |
| C3 | `consolePage.js`：前端单独构建，JS 里只留挂载点 | consolePage.js < 500 行 |

### 轨道 D：基础设施替换（用真库，停止手写）

| # | 任务 | 验收 |
|---|---|---|
| D1 | `structuredLogger` → pino | 所有日志走 pino，grep 生产路径 console.* < 5 |
| D2 | 手写 metrics → prom-client | /metrics 返回真 prom-client 格式 |
| D3 | OTel：接 OTLP exporter（本地 collector 即可） | span 能在 Jaeger/Tempo 看到 |
| D4 | LLM 客户端：官方 openai SDK 或修对 undici Pool | 连接复用经 ss/netstat 验证 |

### 轨道 E：真实负载 + dogfooding（最晚但最重）

| # | 任务 | 验收 |
|---|---|---|
| E1 | 用 autocannon/k6 对 /chat 压测 | 记录 P50/P95/P99，文档化当前上限 |
| E2 | 接入一个真实持久化（Postgres 或 SQLite-WAL 真驱动） | 重启后数据不丢 |
| E3 | 连续 7 天每日 dogfooding 日志（真实问答，非自动化） | docs/dogfooding/ 有 7 份真实记录 |

---

## 3. Sprint 循环（每个子项都按这个跑）

```
PLAN  → 写一句话目标 + 影响文件清单（allowedFiles）+ 回滚方式
APPLY → 改代码（每次只动一条轨道的一个子项）
CHECK → 跑第 4 节验证闸门
GATE  → 全绿才进下一个；任何红 → 回滚 → 重新 PLAN
```

**Sprint 硬约束：**
- 单 sprint 改动文件 ≤ 8 个（超过就拆）
- 单 sprint 不跨轨道
- 每个 sprint 结束产出一条 `docs/world-class-sprint-log.md` 追加记录（目标/改动/验证结果/回滚点）

---

## 4. 验证闸门（声明完成前必须全部实测通过，不许跳）

每一项都要**在本消息内重新执行并贴输出**，不许引用之前的结果：

```
[必须绿]
□ pnpm test                          → pass 数 ≥ 上一轮基线，fail 数 ≤ 基线
□ pnpm -r --if-present check         → EXIT 0
□ node ./tools/phase12a/health.mjs   → status: passed, routes.chat: true
□ node .../runSafeRegressionMatrix.js → status: passed
□ node .../verifySecretSafety.js     → status: passed
□ curl POST /chat                    → executionMode: real, success: true

[本 sprint 目标验收]
□ <填入本 sprint 的具体验收命令>

[防退化]
□ 基线 5 条命令全部不劣化
□ git diff 不触碰 legacy/ .env .git auth.json
□ 改动文件数 ≤ 8
```

**证据规则（继承 AGENTS.md）：**
- 不许声明 pass 如果验证链被阻塞
- 不许声明 workspace clean
- verifier 误伤无关 evidence 要如实报告为 side effect

---

## 5. 防退化与终止（这是"有界"的核心）

### 什么时候必须停止当前 sprint 并回滚
- /chat 从 real 退化 → 立即回滚
- secret-safety 从 passed 退化 → 立即回滚
- 单元测试 pass 数下降 → 立即回滚
- 任何改动触碰禁改路径（legacy/PROJECT_CONTEXT/.env/.git/auth.json）

### 什么时候整个升级"完成"（达成世界顶尖门槛）
全部满足才算结项，少一个都不算：
1. 轨道 A 全部子项完成（4 个真实 bug 清零）
2. 轨道 B 全部完成（zod + 真编译 TS）
3. 轨道 C 全部完成（无 >1000 行文件）
4. 轨道 D 至少 D1+D2 完成（pino + prom-client）
5. 轨道 E E1 完成（有压测基线数字）
6. 以下"世界顶尖门槛"打分达到 ≥ B+（见下表）

### 世界顶尖门槛打分表（每轮自评，诚实打）

| 维度 | 现状 | 目标 |
|---|---|---|
| 安全中间件 | A- | 维持 A- |
| 可测试性/DI | B+ | 维持 B+ |
| 路由架构 | D | ≥ B |
| 文件大小纪律 | F | ≥ B（无 >1000 行） |
| 类型安全 | F（摆设） | ≥ B（真编译） |
| 运行时校验 | F | ≥ B（zod 全边界） |
| 持久化 | F | ≥ B（真驱动） |
| 可观测性 | D | ≥ B（真 OTel+prom） |
| 真实 bug | C | A（0 已知） |

**最低结项线：上表无 F、无 D，且真实 bug = 0。**

---

## 6. 与项目治理的兼容性声明

本模板遵守 AGENTS.md 全部边界：
- dryRun 默认开；apply 前 approvalRecord + allowedFiles + forbiddenPaths
- forbiddenPaths 必须含 legacy/、PROJECT_CONTEXT.md、.env、.git、node_modules、auth.json
- 不擅自 commit/push/release/deploy/tag
- 不读明文密钥；provider 真调用需 owner 显式授权（maxRequests=1, credentialRefOnly）
- 所有产物 docs-only 或 source-only，不产生新 phase 编号、不产生新 verify 脚本

---

## 7. 启动指令（给执行 Agent 的第一行 prompt）

> 读取 `docs/WORLD_CLASS_SPRINT_EXECUTION_TEMPLATE.md`。
> 先执行第 1 节冻结基线到 `docs/world-class-baseline-<date>.md`。
> 然后从**轨道 A 的 A1**开始，严格按第 3 节 Sprint 循环执行。
> 每完成一个子项，跑第 4 节闸门并贴实测输出，全绿才进下一个。
> 不许新增 phase、不许手写基础设施、不许跳过验证。
