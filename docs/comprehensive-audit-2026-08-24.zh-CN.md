# Unified AI System 全面审计与行业阶段报告

> 审计日期：2026-08-24；加固证据更新至 2026-08-25（Asia/Shanghai）
> 已发布版本：[`v0.5.0`](https://github.com/happy520ai/unified-ai-system/releases/tag/v0.5.0)，发布于 2026-08-15  
> 已审实现提交：`7475cc42d12f3ab51796f642e1c69b9b81ac3a28`
> 审计分支：`codex/protocol-client-compatibility`，GitHub [PR #115](https://github.com/happy520ai/unified-ai-system/pull/115)  
> 审计性质：全仓代码、配置、运行时、数据、安全、协议、部署、发布、文档与行业位置审计  
> 明确边界：未读取本地 `.mcp.json` 的用户改动、任何 `.env`、提供商密钥或私人授权记录；本轮没有发起真实提供商调用。

## 1. 结论先行

### 1.1 目前处于什么阶段

本系统已经越过“概念验证”和“功能样机”，当前应定级为：

> **已有公开 `v0.5.0` 的成熟 Public Preview；PR #115 是经过强安全、协议、计费、审计链与发布工程加固的下一版候选源码。它具备可信的单机/同主机自托管实用价值，并已有部分通过真实 PostgreSQL 17 验证的跨实例治理原语；但尚未获得“企业生产 GA”或“行业领导者”所需的端到端多主机、真实流量、独立安全与市场采用证据。**

阶段判断不是由版本号决定，而由证据决定：

| 阶段 | 状态 | 判定依据 |
| --- | --- | --- |
| 概念验证 | 已越过 | 核心路径均有真实实现，不是界面或文档桩。 |
| 可用开源产品 | 已达到 | 已发布 v0.5.0、Apache-2.0、公开容器、MCP Registry、文档与无密钥体验路径。 |
| 加固 Public Preview | **当前阶段** | 完整测试、公共克隆、依赖扫描、攻击回归、多架构容器、短时 SLO/背压/资源门均通过。 |
| 企业生产候选 | 部分达到 | 身份、租户、预算、审计、可观测性已有；PostgreSQL claim/usage/audit/A2A task state + execution lease/结构化对账已获 E3，但下游原子 fence、中央队列、HA/DR、provider-authenticated statement 和真实提供商阶段证据不足。 |
| 生产 GA | 未达到 | 缺独立渗透测试、真实提供商预生产验证、6–24 小时负载证据、故障切换与恢复演练。 |
| 行业领导者 | 未达到 | 独特方向成立，但提供商广度、生态采用、跨区域 HA 和第三方证明尚弱。 |

### 1.2 是否具备“大放异彩”的条件

**具备，但必须在正确赛道上竞争。** 它最可能突出的不是“支持最多模型”，而是：

- 本地优先、零密钥可试用、真实调用显式授权；
- 确定性 prompt 增强和可复现实验，而不是再用一个模型包装另一个模型；
- OpenAI、Anthropic、Gemini、MCP、A2A、CLI、HTTP 汇入同一个受治理网关；
- 将身份、租户、预算、影子流量、缓存、RAG、审计与工具权限放在不可绕过的执行边界；
- 公开承认证据边界，不把 fake-provider、短压测或测试通过写成盈利、SLA 或生产证明。

因此，本项目在“**可验证、受治理、面向智能体协议的自托管控制面**”细分市场有明显差异化；在“全球多模型聚合与成熟企业网关”大盘上，目前还不能诚实地宣称领先。

## 2. 审计证据分级

本报告对每项结论采用以下证据等级，避免把源码存在等同于生产有效：

| 等级 | 含义 | 可以证明什么 |
| --- | --- | --- |
| E1 | 静态源码、配置、契约和文档检查 | 能力或控制逻辑存在，不能证明运行正确。 |
| E2 | 聚焦测试或攻击回归 | 被覆盖场景按预期工作，不能替代完整系统门。 |
| E3 | 完整工作区、公共克隆、容器、CI 与短时压测 | 当前提交在公开、无密钥、可复现路径上通过。 |
| E4 | 真实提供商预生产、跨主机故障演练、长时间负载、独立评估 | 可支持生产候选或外部可信度判断。 |
| E5 | 多客户生产历史、SLA、第三方认证与市场采用 | 可支持生产 GA 或行业领导地位。 |

当前最强证据集中在 **E3**。E4/E5 仍是主要短板。

## 3. 审计范围与仓库快照

本轮覆盖：

- 两个应用入口：操作员控制台、AI 网关运行时；
- 共享契约、SDK、配置、工具、Forge、Knowledge、Workforce、MCP、A2A、缓存、计费、身份和企业治理包；
- HTTP、SSE、WebSocket、MCP stdio/Streamable HTTP、A2A JSON-RPC 与主流 SDK 兼容层；
- 身份与租户传播、权限声明、真实提供商三道门、出站网络、工具执行、文件读取和文档解析；
- 本地文件、SQLite、PostgreSQL、usage/billing ledger、审计链、备份和外部检查点；
- Docker、Compose、CI、依赖、供应链、公共仓库卫生、公共克隆与进程清理；
- README、协议文档、运维手册、发布声明与行业对标。

当前静态快照：

| 项目 | 数量/状态 |
| --- | --- |
| Git 跟踪文件 | 1,847（包含本报告，审计统计排除本地 `.mcp.json` 用户改动） |
| JS/TS/ESM 源文件 | 1,568 |
| 测试文件 | 323 |
| `docs/` Markdown/HTML | 97 |
| pnpm 工作区项目 | 20（含根项目） |
| PR 相对 `origin/master` 变化文件 | 346（包含本报告） |
| 已审实现相对 `origin/master` | 71 个提交领先 |
| 当前 GitHub 采用快照 | 6 stars、2 forks；这是采用度快照，不是质量评分 |

文件数、测试数和星标都不能单独证明质量；它们仅用于界定审计规模与市场成熟度。

## 4. 系统真实具备的作用

| 能力域 | 当前作用 | 用户得到什么 | 证据/边界 |
| --- | --- | --- | --- |
| 确定性 prompt 增强 | 本地把自然语言需求编译为结构化、可复核任务；保留原始请求 | 不需要先学复杂提示词，也不需要提供 API Key | E3；无提供商调用的评估、CLI、MCP 和公共克隆均通过 |
| OpenAI/Anthropic/Gemini 兼容入口 | Chat Completions、Responses、Messages、Gemini generate/stream/batch、多模态、工具与流式 | 现有 SDK 通常只需切换 base URL | E3；协议测试通过，真实提供商契约未在本轮重验 |
| MCP 网关 | 12 个受治理工具；stdio 与 Streamable HTTP；可聚合上游 MCP，并从 OpenAPI 生成工具 | Codex、Cursor、Cline 等可使用同一套可审计能力 | E3；当前源码认证 MCP `2026-07-28`，兼容 `2025-11-25`/`2025-06-18` |
| A2A v1.0 | 可验证 Agent Card/JWKS、JSON-RPC 任务、取消、Workforce 模式，以及有界 memory/同主机 SQLite/跨主机 PostgreSQL 任务与 fenced execution lease | 其他智能体可验证身份、发现并调用网关；多副本共享任务生命周期，同 tenant/owner/task 仅一个有效执行者，其他副本可撤销 lease | E3；真实 PostgreSQL 独立连接池通过；验证与最终 TaskStore commit 尚非原子、下游 sink 未普遍消费 fence，仍不等于 exactly-once；重叠签名轮换也未完成 |
| 提供商治理 | fake provider 默认；真实提供商需白名单、运行时授权与凭据三道门 | 防止“配置一改就误花钱”或静默调用外部模型 | E3；本轮没有真实提供商调用 |
| 虚拟密钥、预算与成本核对 | 虚拟 key、撤销、限流、token 预算、使用归属、spend 报告，以及精确 attempt-ID 的 USD statement comparison | 团队成员不持有底层提供商密钥；管理者可找出漏记、重复、未决、未知估值、模型/token 不符和成本差异 | E3；中央 usage 与结构化对账已通过真实 PostgreSQL，但输入仍由 operator 提供，未认证 provider 来源，也不是支付或法定发票系统 |
| 路由与韧性 | 加权路由、fallback、熔断、重试边界、影子流量单独计量 | 可迁移或比较模型，同时限制影子调用的额外成本 | E2/E3；无跨区域流量证据 |
| 缓存与 RAG | 租户隔离的精确/语义缓存、SQLite 向量检索、热路径 RAG | 降低重复推理成本，把本地知识注入受控执行路径 | E2/E3；没有大规模召回质量基准 |
| Guardrails | 本地密钥/PII/注入/禁词/大小检查，覆盖输入、工具与输出路径 | 在发往提供商前阻断明显泄密和越权内容 | E2/E3；规则防御不能证明语义级提示注入无风险 |
| 企业身份 | JWT/RBAC、OIDC Authorization Code + PKCE + JWKS、SCIM 2.0 | 接入企业 IdP，按主体、角色和租户执行 | E2/E3；没有外部 IdP 互操作认证 |
| 可观测性 | Prometheus、OpenTelemetry、Langfuse 可选出口、SLO 与质量趋势 | 看见 token、延迟、缓存、拒绝、guardrail、成本与健康状态 | E3；成熟度和托管平台仪表盘仍弱于头部产品 |
| 审计与备份 | 本地 HMAC 防篡改镜像、跨进程锁、签名检查点、加密签名备份，以及 PostgreSQL canonical audit chain | 能发现本地/中央篡改、回滚和多写者碰撞，并为多实例提供全局序号 | E3；真实 PostgreSQL 17 跨连接、外部 floor 和篡改检测通过；外部不可变/WORM 留存和破坏性恢复演练未完成 |
| Forge/Workforce | 受限、可取消、资源感知的编码/多角色执行；高风险工具需要权限检查；PostgreSQL claim/lease/fence | 把智能体执行置于网关预算、租户、权限和审计边界内，并防止跨主机重复 ownership | E3；真实 PostgreSQL 17 claim/fencing 通过，但中央队列/结果和所有不可逆 sink 的 fence 强制仍未完成 |
| 容器与发布 | 非 root、只读根文件系统、cap drop、no-new-privileges、受限 tmpfs、amd64+arm64、SBOM/provenance | 用户可无密钥启动，部署默认面更小，镜像架构可验证 | E3；Kubernetes/多区域/灾备不是已证实能力 |

## 5. 本轮发现并修复的主要风险

以下不是仅写建议；修复已在 PR #115 对应源码中落地并经过相应测试。严重度表示修复前风险。

| ID | 修复前严重度 | 发现 | 当前处置 | 证据 |
| --- | --- | --- | --- | --- |
| AUD-01 | 高 | 补丁/上下文文件路径可能越过允许根目录读取 | 解析后校验真实路径和允许根，加入穿越/链接回归 | E2/E3 |
| AUD-02 | 高 | Forge 可绕过网关治理，状态存在跨租户混用风险 | 强制进入受治理执行 lane，按租户隔离状态，高风险工具默认关闭 | E2/E3 |
| AUD-03 | 高 | 真实提供商调用与成本记录之间存在未计量窗口 | 强制真实模式使用持久、fsync 的 write-ahead usage lifecycle；未计量即 fail closed | E2/E3 |
| AUD-04 | 高 | 真实调用尝试可能先于可验证审计锚点 | 启动要求签名检查点，每次真实尝试先写审计，再进入 adapter | E2/E3 |
| AUD-05 | 高 | 多实例审计写存在碰撞、TOCTOU 和回滚窗口 | 跨进程锁、PID/nonce/心跳、陈旧锁恢复、fsync、签名外部 floor | E2/E3 |
| AUD-06 | 高 | 审计追加每次全链扫描形成 O(n²)，在开环负载下造成 54% 503 | 启动/周期全验 + 锁内 O(1) 尾部验证，仍保留回滚检测和每次签名检查点 | E3；修复后 CI 开环与背压门通过 |
| AUD-07 | 高 | OIDC state/token 校验和 SCIM 后授权刷新不足 | 强化 state、PKCE、JWKS/token 校验；SCIM 变更后刷新企业授权状态 | E2/E3 |
| AUD-08 | 高 | 代理/来源身份可能影响限流主体 | 仅在可信代理契约下接受转发身份，认证与限流使用服务端主体 | E2/E3 |
| AUD-09 | 中高 | 影子流量可能绕过成本保护或被当作主调用 | 真实影子需独立显式开关，逐次预算/usage 归属，失败不替换主响应 | E2/E3 |
| AUD-10 | 高 | 文档解析可在主进程耗尽 CPU/内存或拖死请求 | 解析工作隔离，设文件、页数、时间、输出和并发上限 | E2/E3 |
| AUD-11 | 中高 | JavaScript 大规模重构缺完整严格类型护栏 | 恢复仓库严格 TypeScript check，当前为 0 errors，并登记限时迁移例外 | E3 |
| AUD-12 | 高 | 容器可写面、Linux capabilities 和架构发布门不足 | 只读根、显式可写卷、cap drop、no-new-privileges、双架构强制验证、SBOM/provenance | E3 |
| AUD-13 | 中高 | MCP “当前协议”证明只覆盖旧时代行为 | 使用官方 SDK/client 对现代 `2026-07-28` 及两档兼容时代做 stdio/HTTP 认证 | E3 |
| AUD-14 | 中 | v0.5.0 已发布，但 A2A Agent Card 与当前兼容性文档仍自报/安装 v0.4.9 | Agent Card 回归固定 v0.5.0；中英文 A2A/MCP 文档与 Registry/镜像安装命令同步 | E2/E3 |
| AUD-15 | 中高 | A2A Agent Card 缺稳定身份签名，客户端无法验证发现内容 | 增加受限 Ed25519 私钥文件、官方 JCS/JWS、公开 JWKS、HTTPS 约束、required 失败关闭和官方 SDK 验签 | E2/E3 |
| AUD-16 | 中高 | 官方内存 TaskStore 无持久性与资源上限 | 增加租户/owner 隔离、有界 memory、TTL/容量/大小/历史/产物上限、keyset 分页和同主机 SQLite 重启恢复 | E2/E3 |
| AUD-17 | 高 | Workforce claim 只能同进程生效，多主机可能同时认领同一任务 | 增加 PostgreSQL 数据库时钟租约、原子唯一 owner、全局单调 fence、摘要 token、续租/释放/撤销、TLS/容量/namespace/readiness 门 | E3；真实 PostgreSQL 17 独立连接池集成通过 |
| AUD-18 | 高 | usage 台账虽同主机 fsync，但多主机无法形成一个原子总账 | 增加 PostgreSQL write-ahead start/terminal、幂等冲突检测、租户查询、容量/留存/TLS/readiness/metrics，并强制多实例真实调用使用中央台账 | E3；真实 PostgreSQL 17 幂等/冲突/容量/租户集成通过 |
| AUD-19 | 高 | 本地 audit chain 无法给多主机提供一个全局序号和 canonical source | 增加 PostgreSQL 事务序号、entry/state HMAC、外部 floor、幂等 ID、租户读取、分块全验、TLS/readiness，并保留本地 forensic mirror | E3；真实 PostgreSQL 17 独立连接池的并发、幂等/冲突、租户读取、外部 floor 与篡改检测通过 |
| AUD-20 | 高 | 中央 usage 虽能汇总，但无法把 provider statement 行与网关账本逐次核对 | 增加 `user:admin`、服务端 tenant 绑定、精确 attempt-ID、USD micro-unit 容差、缺失/重复/未决/未知/metadata 分类、版本化 SHA-256 摘要、字段/周期/行数/查询上限和审计摘要 | E3；单元 8/8、路由 2/2，真实 PostgreSQL usage 集成 2/2 含对账；provider 来源认证/签名和法律会计边界仍未完成 |
| AUD-21 | 中高 | A2A TaskStore 只能 memory/同主机 SQLite，多主机无法共享任务生命周期 | 增加显式 PostgreSQL 模式、数据库时钟 TTL、事务全局/owner 计数、task-scoped lock、陈旧时间戳拒绝、tenant/owner 查询、SHA-256 腐坏检测、repeatable-read keyset 分页、远端 verify-full TLS、safe health/metrics 和 central-required 门 | E3；真实 PostgreSQL 17 两个独立 pool 的共享/隔离/分页/更新/容量/陈旧写/篡改检测 1/1；未声称执行租约或 exactly-once |
| AUD-22 | 中 | Go 开环门要求 100 RPS/0 错误、允许 p95 750ms，却只给 managed gateway 16 个 in-flight 槽；runner 变慢时延迟仍在门内但会先触发 503，形成自相矛盾的抖动门 | 升级方法为 v2：managed cap 必须至少 `ceil(RPS × maxP95Seconds) + 5`，默认 80；独立突发扩大到 256 保留真实背压，矛盾的自定义参数直接拒绝 | E3；当前远端 v2 持续 500/500、0 错误、p95 7.16ms；突发 84 accepted/172 controlled 503，恢复与 8/8 中断均通过 |
| AUD-23 | 高 | A2A PostgreSQL 只共享 TaskStore 状态，两个网关副本仍可能同时执行同一 scoped task，其他副本也无法安全撤销远端执行权 | PostgreSQL task 模式自动要求 tenant+owner+task scoped lease；digest-only token、随机 instance、数据库时钟 TTL/heartbeat、单调 fence、重复执行拒绝、发布前 revalidate、跨副本 context-aware cancel、主动健康探针和脱敏指标 | E3；单元/执行器覆盖 8 项相关用例，真实 PostgreSQL A2A 文件 2/2（同 scope 拒绝、跨 tenant 隔离、远程撤销、旧 lease 失效、更高 fence、token 不落明文）；原子 sink commit 仍是阻断 |

在本轮已审范围和现有自动化证据内，**没有仍然已知且未处置的 P0/P1 代码级缺陷**。这句话不等于“没有未知漏洞”，也不覆盖下节列出的生产证据阻断。

## 6. 仍然存在的风险与阻断项

这些项目不能靠修改一行代码或把 CI 跑绿就诚实地关闭。

| 优先级 | 阻断项 | 当前影响 | 关闭条件 |
| --- | --- | --- | --- |
| 生产阻断 | 当前加固分支仍是开放 PR，尚未进入正式发布 | v0.5.0 用户没有自动获得本轮全部修复 | 审核、合并、从合并提交重跑发布门并发布新版本 |
| 生产阻断 | 本轮没有真实提供商预生产验证 | 无法确认最新 OpenAI/Anthropic/Gemini 等真实响应、计费与错误契约 | 使用限额凭据、出口 allowlist、硬成本上限逐家验证；不得复用旧证明 |
| 生产阻断 | 缺独立渗透测试和外部威胁模型复核 | 现有安全结论由仓库本地工具和本次审计产生 | 第三方测试、修复复测、签名报告 |
| 生产阻断 | 缺 6–24 小时真实工作负载 soak 与容量包线 | 当前短时门只能发现明显回归，不能证明无泄漏或峰值稳定 | 多负载混合、并发爬坡、故障注入、长时资源趋势 |
| 生产阻断 | Workforce 已有 PostgreSQL 跨主机 claim/fencing，但队列/结果仍是同主机 JSON，副作用 sink 尚未普遍强制 fence | 可防重复 ownership，但不能声称端到端 exactly-once 或完整分布式 Workforce | 中央队列/结果后端、所有不可逆副作用 fence 校验、数据库故障转移/分区/split-brain 测试 |
| 生产阻断 | usage/audit 已中央化，结构化 provider statement comparison 已能精确核对，但 statement 来源仍由 operator 提供，未通过 provider API/签名认证；外部 WORM 也未闭环 | 能发现技术账本差异，仍不能把输入真实性、支付状态、税务或外部不可变性视为已证明 | provider-authenticated/signed ingestion、持久对账历史、财务/税务边界，以及把 sequence/hash floor 写入并演练外部 WORM/object-lock |
| 生产阻断 | 未完成负载均衡器、TLS/mTLS、数据库故障切换、备份恢复和 DR 演练 | 无法给出 RTO/RPO 或多实例生产承诺 | 隔离环境破坏性恢复、主从切换、证书轮换、网络分区演练 |
| P1 能力差距 | A2A 已支持稳定 Ed25519/JWKS、memory/SQLite/PostgreSQL 任务和分布式 execution lease/fence，但 lease revalidate 与 TaskStore commit 尚非同一原子事务，下游 provider/sink 未普遍校验 fence，且缺重叠多签名轮换 | 能阻止同时持有有效执行权并远程撤销，但极窄 revoke/commit 竞态及已进入 provider 的副作用仍不能撤回 | 将 terminal commit 与 fence 校验原子化，所有不可逆 sink 拒绝陈旧 fence，做数据库故障转移/分区测试，并完成重叠轮换演练 |
| P1 工程债 | TypeScript 迁移例外仍存在 | 严格检查通过，但部分旧运行时仍依赖 JS 兼容边界 | 在 2026-10-31/11-13 前消除登记例外并保持契约兼容 |
| 市场阻断 | 采用度和第三方案例很小 | 不能把技术潜力写成行业领导地位 | 可复现用户案例、贡献者增长、独立基准、长期留存与生产参考 |

## 7. 验证结果

### 7.1 当前实现提交的本地门

| 验证 | 结果 |
| --- | --- |
| `pnpm check` | 通过；679 个网关文件语法检查，TypeScript 0 errors，语言策略通过，81 个权限声明/136 条活动路由，18 个受治理出站集成 |
| `pnpm test` | 通过；Forge 2,692/2,692；网关 Node 100/100；主要 Vitest 1,284 passed/19 skipped；隔离解析器 10/10；MCP 包 4/4；其余工作区套件通过 |
| `pnpm check:public` | 通过；1,847 个 tracked/candidate 文件，0 issue codes |
| `pnpm verify:public-clone` | 通过；干净克隆、fake-provider 强制、MCP `2026-07-28`、12 tools、0 次真实提供商调用、进程清理成功 |
| `pnpm verify:mcp` | 通过 4/4；现代 stdio、现代+兼容 HTTP、认证/CORS/清理 |
| `pnpm smoke:mcp --json` | 通过；现代协议时代 `2026-07-28` |
| `node tools/security-attack-regression.mjs` | 23/23 防住；含对账跨 tenant body 和 viewer 权限攻击；`SECURITY AUDIT: ALL DEFENDED` |
| `pnpm audit --prod --audit-level low` | 通过；0 个已知生产依赖漏洞 |
| 审计链顺序压测 | 500 条约 4.99 秒，约 100.23 records/s，最终链验证通过 |

### 7.2 当前实现提交的 GitHub 门

| 门 | 结果 | 可复核链接 |
| --- | --- | --- |
| 完整 `quality` | 通过；实现提交 `2b02c7a4`，6 分 43 秒 | [Run 32766288068](https://github.com/happy520ai/unified-ai-system/actions/runs/32766288068) |
| PostgreSQL 集成 | 通过；8 个文件、18/18，含 A2A TaskStore+execution lease 2/2、中央 audit 2/2、usage+statement comparison 2/2、Workforce claim 2/2 | 同一 quality run |
| SLO/故障隔离 | 通过 | 同一 quality run |
| 开环 soak/背压 | v2 通过；持续 500/500、0 错误、p95 7.16ms；突发 84 accepted/172 controlled 503；恢复与 8/8 中断通过 | 同一 quality run；v1 在两个慢 runner 上分别出现 45/199 个持续段 503，失败历史保留并用于修正方法，不写成长时稳定性证明 |
| 资源稳定性 soak | 通过 | 同一 quality run |
| MCP、CLI、Go/C#/SDK 示例 | 全部通过 | 同一 quality run |
| 代码/依赖扫描 | 通过 | [PR #115 checks](https://github.com/happy520ai/unified-ai-system/pull/115/checks) |
| 插件扫描 | 通过 | [PR #115 checks](https://github.com/happy520ai/unified-ai-system/pull/115/checks) |
| hardened amd64+arm64 容器 | 通过；实现提交 `2b02c7a4`，包含网关/MCP 镜像与匿名发布产物验证 | [Run 32767012331](https://github.com/happy520ai/unified-ai-system/actions/runs/32767012331) |

### 7.3 未执行的证据

- 没有读取或使用真实 provider key；没有真实 provider 请求。
- 没有对生产数据做恢复、迁移、删改或订单/支付操作。
- 没有独立第三方渗透测试、合规认证或真实客户生产证明。
- 没有同主机、同硬件、同流量模型的竞争产品基准；因此不声称性能领先。

## 8. 行业对标

对标仅使用各项目官方资料描述公开能力，不把营销数字当成本项目已验证的基准：

| 维度 | Unified AI System | 行业成熟基线 | 判断 |
| --- | --- | --- | --- |
| Provider/model 广度 | 已有主流协议与多提供商治理，但目录广度有限 | [LiteLLM](https://github.com/BerriAI/litellm-docs) 强调 100+ LLM；[Portkey](https://portkey.ai/docs/product/ai-gateway) 提供更大的模型/提供商目录 | **落后**，短期不要打“最多模型” |
| 路由与可靠性 | 加权、fallback、熔断、缓存、影子、成本门 | Portkey、[Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/features/) 和 [Kong AI Gateway](https://docs.konghq.com/gateway/latest/ai-gateway/) 已有成熟路由、限流和全球/企业部署叙事 | 功能接近，规模与生产证据落后 |
| 可观测与成本 | Prometheus、OTel、Langfuse、虚拟 key、预算、spend ledger | [Helicone](https://docs.helicone.ai/getting-started/platform-overview) 和 Cloudflare 有成熟托管分析体验 | 控制面扎实，产品化与托管体验落后 |
| 协议与智能体治理 | OpenAI/Anthropic/Gemini + MCP + A2A + reverse MCP + Forge/Workforce；A2A 已有稳定签名/JWKS、跨主机 PostgreSQL 状态与 fenced execution lease | [MCP `2026-07-28`](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/blog/content/posts/2026-07-28-spec-ga/index.md) 进入无会话现代时代；[A2A v1.0](https://github.com/a2aproject/A2A/blob/main/docs/announcing-1.0.md) 强调稳定、多租户与可签名 Agent Card | **项目最有机会领先的维度**；原子 fence sink、签名轮换和故障转移证据仍需补齐 |
| 确定性与无密钥验证 | 本地增强、fake provider、公共克隆、明确调用证据 | 多数网关更关注代理、路由和托管分析 | **差异化强**，可形成品牌心智 |
| 安全与发布工程 | fail-closed、攻击回归、严格类型门、公共检查、只读多架构容器、SBOM/provenance | 头部产品拥有更长生产历史、团队和第三方认证 | 仓库工程纪律强；外部保证不足 |
| HA/DR/全球规模 | 部分 PostgreSQL 跨主机状态；其余多为同主机/本地机制 | Cloudflare/Kong/商业网关具备成熟多区域和企业运维能力 | **明显落后** |
| 生态采用 | 6 stars、2 forks，案例少 | 头部项目拥有大量集成、贡献者和用户 | 技术潜力尚未转化为市场领导力 |

## 9. 它给用户带来了什么

### 对个人开发者

- 不注册、不配 key 就能验证 prompt 增强、MCP 工具和网关流程；
- 保留现有 OpenAI/Anthropic/Gemini 客户端习惯；
- 对每次执行看见 provider、model、fake/real、预算与治理证据；
- 本地运行，减少把 prompt、知识和工具上下文交给额外 SaaS 的必要。

### 对团队与平台工程

- 用虚拟 key、租户、RBAC、预算和统一审计代替散落的提供商密钥；
- 将缓存、RAG、guardrails、fallback、影子流量和工具权限集中到同一执行边界；
- 把 provider statement 的每一行与中央 usage attempt 精确核对，直接看到漏记、重复、未决、未知估值和超容差成本；
- 对 MCP/A2A/HTTP 客户端复用同一套治理策略，而非为每种客户端重复建设；
- 让不同主机上的 A2A 网关副本读取同一份受 tenant/owner 隔离、有容量/TTL/分页约束的任务状态；
- 同一 scoped A2A task 只允许一个有效执行 lease，并允许另一副本安全撤销远端 lease；
- 用公共克隆、攻击回归和 CI 证据降低“只有作者机器能跑”的风险。

### 对受监管或重视数据边界的组织

- 自托管、默认 fake、真实调用显式启用；
- OIDC/SCIM、租户隔离、日志净化、凭据加密、审计链和加密备份构成可检查基础；
- 对账结果保留“operator-supplied、非法律发票、非支付/税务证明”的机器可读边界；
- 但在 provider 来源认证、外部 WORM、合规认证、跨区域 HA、RTO/RPO 和第三方测试完成前，只能作为评估/候选，不应直接写入生产合规声明。

## 10. “大放异彩”的现实路径

项目不需要复制所有竞品，最有胜算的顺序是：

1. **守住差异化**：把“零密钥可试、确定性增强、真实调用显式、证据可复核”做成最短上手路径。
2. **补生产闭环**：中央 Workforce queue/result、A2A/Workforce terminal commit 与 fence 校验原子化、所有不可逆 sink 拒绝陈旧 fence、provider-authenticated statement ingestion/持久历史/外部 WORM、签名轮换、真实 provider staging、24 小时 soak、DR 与独立渗透测试。
3. **建立可信对标**：固定硬件、固定模型、固定流量，公开与 LiteLLM/Portkey/Kong 等同场的延迟、错误率、资源、成本和治理功能矩阵。
4. **扩大生态而非堆宣传词**：每个主流 MCP/A2A/SDK 客户端取得一份可复现第三方报告；把 2,084 个“待人工证据”逐步转成真实认证。
5. **用真实采用证明领先**：安装成功率、7/30 日留存、活跃部署、外部贡献者、生产案例与问题响应时间，比 star 口号更能说明市场价值。

若完成第 2–5 项，本项目有机会成为“受治理智能体网关/本地 AI 控制面”的代表项目。若不完成，它仍会是技术内容丰富、工程纪律较强，但市场影响有限的 Public Preview。

## 11. 发布与推广决策

当前 PR #115：

- 源码已推送，远端 HEAD 与本地已审实现提交一致；
- `quality`、scan、plugin scan、hardened multiarch container 均通过；
- PR 处于 open、mergeable 状态，尚无独立 review decision；
- 可进入维护者复核与下一版候选流程；
- **不能把“PR 全绿”写成“已合并、已发布、生产 GA 或行业领先”。**

适合对外传播的诚实表述是：

> Unified AI System 是一个自托管、协议优先、零密钥可验证的 AI 网关与智能体控制面。它把确定性 prompt 增强、MCP/A2A、虚拟 key、预算、缓存、RAG、guardrails、审计和可观测性放进同一个受治理执行路径。当前发布为 Public Preview；生产推广仍需真实提供商、跨主机、长时负载和独立安全证据。

## 12. 最终判定

| 问题 | 审计回答 |
| --- | --- |
| 系统现在能不能用？ | **能。** 对本地/单机/同主机、自托管、fake-provider、prompt 增强、MCP、协议兼容和团队治理评估已经有强 E3 证据。 |
| 是不是玩具？ | **不是。** 核心能力真实、跨协议、具备严格测试和发布工程。 |
| 能不能直接称生产级？ | **不能。** E4 的真实 provider、跨主机 HA/总账/DR、长时负载、独立安全证据不完整。 |
| 有没有独特价值？ | **有，而且清晰。** 确定性、可验证、默认无密钥、受治理执行是最强长板。 |
| 是否已经行业领先？ | **尚未。** 在治理方向有领先潜力，在提供商广度、HA、生态和生产历史上明显落后头部。 |
| 是否可以大放异彩？ | **可以，但属于有条件的“可以”。** 先成为受治理智能体网关细分赛道的第一选择，再用生产证据和真实采用扩大边界。 |

本报告是一份截至上述提交和日期的证据快照。任何后续合并、发布、依赖升级、真实提供商变更或部署拓扑变化，都应重新运行全部发布门并更新 E4/E5 证据。
