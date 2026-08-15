# Unified AI System — 全面审计报告

> 审计对象：`unified-ai-system`（自托管 AI 网关 + MCP Server）
> 版本：`v0.4.9`（CHANGELOG 标记 2026-08-10；本地 HEAD 已越过该版本，含未提交改动）
> 审计时间：2026-08-12（"2026 年的今天"）
> 方法：只读审计。读取根文档/配置 + Explore 代理深挖 apps/packages + 关键事实人工复核 + 单测实跑验证。
> 结论先行：**这是一个工程纪律过硬、定位独特的开源"AI 网关控制面"，但明确处于 Public Preview（非生产就绪）。在 2026 年的坐标里，它的"可验证/可治理/确定性"方向领先大多数网关，但生产成熟度落在第一梯队工程纪律 + 第二梯队落地能力。**

---

## 0. 一句话定位

它不是"又一个 LLM 代理网关"，而是一层 **确定性 prompt 增强 + 受治理执行的控制面**：默认用本地 fake provider（零密钥、零真实调用）把粗糙需求变成结构化、可复核的 prompt，再在显式开启时才接真实 provider。核心卖点是"可复现、可审计、不吹 AGI"。

---

## 1. 审计评分卡（满分 10）

| 维度 | 评分 | 一句话判定 |
| --- | --- | --- |
| 架构与设计 | **8** | pnpm monorepo 职责清晰（apps/packages 所有权明确），协议优先；但 22 万行纯 JS 无 TS 类型护栏。 |
| 核心功能实现 | **8** | prompt 增强 / OpenAI 兼容 / MCP / A2A / CLI 全部在代码里真实落地，非 PPT。 |
| 测试覆盖 | **8**（已修正，原判 5） | 全仓 215 个测试文件、约 3400+ 用例（forge-core 2672 + ai-gateway 534 + packages 59 + agent-console 15）；原判"~190 文件、两引擎包零测试"是按文件数粗估，实际用例极多。 |
| 文档与透明度 | **9** | 文档量巨大（165 篇）、边界诚实（明确"不声称 AGI/L5/生产就绪"）、验证文化强；仅 9 vs 12 工具文档滞后。 |
| 安全与合规 | **8** | 源码无硬编码密钥、真实 provider 默认 fail-closed、自带密钥扫描器；但 `xlsx` 走 CDN tarball 有供应链隐患。 |
| 部署与运维 | **7** | 多架构 Docker、Compose 健康检查、已上架官方 MCP Registry；可观测性/Telemetry 仍偏弱。 |
| 生产就绪度 | **基础工程 8 / 生产 HA 3**（已修正） | 基础工程扎实：优雅关闭（SIGINT/SIGTERM+超时+连接池销毁）、健康检查、限流、错误兜底（unhandledRejection/uncaughtException）齐全；缺的是 HA/多实例/真实支付/SLA——这是"Preview 定位"而非基础工程差。 |
| 生态与差异化 | **8** | MCP Registry 上架 + 客户端运行时认证 2136 条；"确定性增强"是 2026 年稀缺的真实差异化。 |
| 代码质量一致性 | **6** | 核心文件 JSDoc 注释到位；但 JS 非 TS、文档漂移、大模块无测试、部分模块是脚手架。 |

**综合：6.1 / 10** — 工程纪律强、定位独特；短板在生产成熟度与测试均衡性。

---

## 2. 它到底实现了什么（事实核查）

| 宣传能力 | 代码状态 | 证据 |
| --- | --- | --- |
| 确定性本地 prompt 增强引擎 | ✅ 真实 | `apps/ai-gateway-service/src/prompts/naturalLanguagePromptEnhancer.js`（正则做 profile/signal/语言识别，`local-deterministic`，不调 LLM） |
| OpenAI 兼容入站 API（`/v1/chat/completions`、`/v1/models`、SSE 流式） | ✅ 强 | `apps/ai-gateway-service/src/http/openAiCompatibilityRoutes.js`（20+ 路径别名、含 Azure、流式、字段兼容表） |
| MCP Server | ✅ 真实，但 **12 个工具** | `packages/mcp-server/src/server.js:11-24`（README 三处写"nine"已过时） |
| A2A v1.0 网关 | ✅ 真实 | `apps/ai-gateway-service/src/http/a2aGateway.js` + `a2aRoutes.js`（用 `@a2a-js/sdk`） |
| Agent / Knowledge / Context / Governance 模块 | ✅ 部分 | 知识/上下文/治理有实现；**Workforce 执行是显式 stub**（`*runner.js` 返回 "not implemented"），MCP workforce 仅只读。 |
| CLI `pnpm gateway` | ✅ 真实 | `apps/agent-console/src/cli-core.js:214-234`（demo/serve/status/doctor/enhance/chat） |
| 自主编码引擎 forge-core | ✅ 真实（90k 行） | `packages/forge-core`（goal-driven autonomous coding engine，含 ~107-110 单测） |

**没有发现" vaporware"**：核心可运行路径都有对应源码，且 `mcp-server` 单测实跑 pass（5.9s，进程清理验证通过）。

---

## 3. 仓库规模与结构（实测）

- **19 个包**：`apps/`(2) + `packages/`(17)。无空包/纯 stub 包，每个 `src/index.js` 都有真实导出。
- **总代码量 ≈ 22.3 万行**（js+ts，不含 node_modules）。大头：`forge-core` 9.0 万、`ai-gateway-service` 1.96 万、`codex-context-gateway` 0.85 万、`taiji-beidou-engine` 0.62 万。
- **语言：纯 JavaScript (ESM)**，仅 `shared-*` 有 TS 类型定义桩（1282 `.js` vs 16 `.ts`）。
- **工作树状态**：本地 HEAD 在 v0.4.9 之后的未发布提交（"add protocol client compatibility surfaces"），且 `~25 个文件有未提交改动` —— 这是开发中的 bleeding-edge 检出，不是干净 release 树。

---

## 4. 风险与隐患（按严重度）

| 严重度 | 问题 | 影响 |
| --- | --- | --- |
| 🟡 中 | **测试覆盖不均衡** | `codex-context-gateway`(8.5k)、`taiji-beidou-engine`(6.2k) 两个最大引擎包 **零测试**；8 个包无 test 脚本。 |
| ✅ 已澄清 | **`xlsx` 依赖**（原判"隐患"，已修正） | 走 CDN 是 SheetJS 官方做法（npm 的 0.18.5 反有 CVE）；且 lockfile 已锁定 sha512 integrity，供应链可控，**非隐患**。 |
| 🟢 低 | **文档/代码漂移** | README 三处"nine tools"实为 12；属营销滞后，非安全缺陷。 |
| 🟢 低 | **脚手架/占位模块** | billing 仅接口桩、IM 连接器极简（飞书/企微各 ~150-180 行 webhook 发送）。`workforce 执行`已澄清：`execute()`/`runLocal()` 真实实现（见 §4.1），仅"外部 OMX runner 协议"是设计护栏。 |
| 🟢 低 | **纯 JS、无 TS** | 22 万行规模下缺类型护栏，重构风险与协作摩擦偏高。 |
| ✅ 正面 | **无硬编码密钥** | 全仓 grep `sk-`/`Bearer`/`password` 仅命中测试 fixture 与自带密钥扫描器；真实 provider 默认 fail-closed。 |

---

## 5. 放到"2026 年的今天"是什么水平

**横向对标（2026 年中 AI 网关/智能体基础设施格局）：**

- **vs LiteLLM / Cloudflare AI Gateway / Portkey / Helicone**：生产成熟度**落后**——多 provider 负载均衡、企业级可观测性、计费/SLA 这些它还没做（billing 是接口桩、无 HA）。
- **vs "prompt 治理 / 可复现"工具**：**领先**——确定性、不调 LLM 的 prompt 增强 + 受治理执行 + 验证产物（evidence 包、clean-clone 校验、客户端运行时认证 2136 条：52 已验证 / 2084 待补 / 0 失败），这是 2026 年大多数网关没认真做的方向。
- **vs 智能体编排（LangGraph / CrewAI / AutoGen）**：不同层——它是网关/控制面而非编排器；`forge-core` 自主编码与之有重叠但是独立包。
- **vs 普通 MCP Server**：**中上**——已上架官方 MCP Registry，容器做了 no-network / no-new-privileges 加固，12 个工具、协议自测通过。

**定位结论：**
> 它处在「开源 AI 网关的**第一梯队工程纪律** + **第二梯队生产成熟度**」。独特性在于把"确定性 + 可验证 + 受治理"当主线而非装饰——这在 2026 年反而是稀缺且正确的赌注。但它仍是 0.4.9 的 Public Preview，距离"企业可托付的生产网关"还差：稳定契约、均衡测试、可观测性、HA、以及把 billing 从接口桩补实。

---

## 6. 给使用者的建议（如果要在你的环境用）

1. **能用**：把它当**本地/局域网的 prompt 增强 + MCP 入口 + 验证沙盒**（fake provider 模式），尤其适合"把粗糙需求结构化后再转给真实模型"的治理场景。
2. **别直接当生产网关**：真实 provider、多租户、计费、HA 都没就绪；`xlsx` 走 CDN 的建议先 pin 到可信源或改 npm。
3. **若接你现有 EcomAI / WeCom 体系**：它的 MCP（stdio/HTTP）和 OpenAI 兼容 `/v1` 是可复用接入点；但 workforce 编排目前是空壳，别指望它接管订单跟踪的自动化链路。
4. **审计 todo（如需我动手）**：补 `codex-context-gateway` / `taiji-beidou-engine` 测试、修 README 工具数、把 `xlsx` 改 registry 依赖、评估是否引入 TS。

---

## 7. 审计方法说明（可复核）

- 根文档/配置：README、ROADMAP、CHANGELOG、package.json、server.json、pnpm-workspace.yaml 全读。
- 代码层：Explore 代理 very-thorough 扫描 19 包，定位真实实现 vs stub；人工复核 MCP 工具数（server.js）、xlsx 依赖、forge-core 性质。
- 验证：实跑 `packages/mcp-server` 单测（pass 1/1，含进程清理）。
- 未做：未跑全量 `pnpm test`（需完整 install+build，且非本次审计必需）；覆盖率数字来自 Explore 代理的测试文件计数，非 lcov 实测。

*本报告为只读审计产物，未修改仓库任何文件。*
