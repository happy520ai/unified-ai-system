# Unified AI System 全面审计与行业阶段报告

> 审计日期：2026-08-24；加固证据更新至 2026-08-25（Asia/Shanghai）
> 已发布版本：[`v0.5.0`](https://github.com/happy520ai/unified-ai-system/releases/tag/v0.5.0)，发布于 2026-08-15  
> 已审代码提交：`0d658b77a9cba6b58d75bdde83a071c09b48f457`（PostgreSQL live-client reconnect：`0d658b77`；A2A overlapping signing-key rotation：`4ac41439`；PostgreSQL recovery root dependency：`7ac3832d`；destructive logical recovery：`b97a687f`；PDF native crash containment：`1a12c200`；双语 signal/Unicode share：`f1fe7b9d`；Agent completion/timeout 测试契约：`d2205a20`；采用/版本一致性：`05d49df1`；custom tool authority：`dd21f740`；MCP/OpenAPI mutation fence：`a864b2cf`；外部不可逆效果 fence：`4fa6001d`；PostgreSQL CI 覆盖闭环：`5ff8a0b6`；Provider dispatch：`725c1ab5`；间接 Provider sink 收口：`63569228`；运行时：`3adb9fe3`；A2A 原子终态：`0eeb2aa2`/`46da8708`）
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
| 企业生产候选 | 部分达到 | 身份、租户、预算、审计、可观测性已有；PostgreSQL claim/中央 Workforce queue+result+审批+生命周期、usage/audit、A2A task state+execution lease+原子终态、结构化对账、真实 Provider 调度墓碑，以及 built-in Git/shell、Webhooks、reverse MCP/OpenAPI、Agent MCP 与动态 custom tool authority 已获 E3；但运行中角色不能跨进程恢复，远端 exactly-once、治理 API 之外的任意原生代码、HA/DR、provider-authenticated statement 和真实提供商阶段证据不足。 |
| 生产 GA | 未达到 | 缺独立渗透测试、真实提供商预生产验证、6–24 小时负载、自动故障切换、PITR 与生产规模恢复证据；仓库已有的破坏性逻辑恢复只覆盖有界 CI 夹具。 |
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
| Git 跟踪文件 | 1,902（包含本报告，审计统计排除本地 `.mcp.json` 用户改动） |
| JS/TS/ESM 源文件 | 1,620 |
| 测试文件 | 348 |
| `docs/` Markdown/HTML | 100 |
| pnpm 工作区项目 | 20（含根项目） |
| PR 相对 `origin/master` 变化文件 | 488（包含本报告） |
| 已审分支相对 `origin/master` | 117 个提交领先；后段提交同时包含 PDF 原生崩溃遏制、双语/分享契约、PostgreSQL 破坏性逻辑恢复/连接池重连和 A2A 重叠签名轮换，不再只是报告更新 |
| 当前 GitHub 采用快照 | 6 stars、2 forks；截至 2026-08-23 的可见 traffic 为 205 views/38 unique visitors、2,591 clones/423 unique cloners。它只能证明发现/克隆行为，不能证明活跃用户、留存或生产采用 |

文件数、测试数和星标都不能单独证明质量；它们仅用于界定审计规模与市场成熟度。

## 4. 系统真实具备的作用

| 能力域 | 当前作用 | 用户得到什么 | 证据/边界 |
| --- | --- | --- | --- |
| 确定性 prompt 增强 | 本地把自然语言需求编译为结构化、可复核任务；保留原始请求 | 不需要先学复杂提示词，也不需要提供 API Key | E3；无提供商调用的评估、CLI、MCP 和公共克隆均通过 |
| OpenAI/Anthropic/Gemini 兼容入口 | Chat Completions、Responses、Messages、Gemini generate/stream/batch、多模态、工具与流式；真实调用先持久化调度墓碑 | 现有 SDK 通常只需切换 base URL；重试不会因网关崩溃或兼容路由缺少响应缓存而静默重复外呼 | E3；协议、HTTP/SSE 前置错误和 SQLite/PostgreSQL 跨副本去重通过，真实提供商响应契约未在本轮重验 |
| MCP 网关 | 12 个首方受治理工具；stdio 与 Streamable HTTP；可聚合上游 MCP，并从 OpenAPI 生成工具；reverse tool mutation 默认要求 durable key，只有运维 `readOnlyTools` 可豁免；Agent MCP 工具一律按 mutation+fence 注册 | Codex、Cursor、Cline 等可使用同一套可审计能力；外部 MCP/REST 写操作不会因客户端重试静默执行第二次 | E3；当前源码认证 MCP `2026-07-28`，兼容 `2025-11-25`/`2025-06-18`；远端与墓碑仍非同一事务，直接绕开 gateway service 的低层 client 不自动受保护 |
| A2A v1.0 | 可验证 Agent Card/JWKS、主密钥+最多三把旧密钥的重叠多签名轮换、JSON-RPC 任务、取消、Workforce 模式，以及有界 memory/同主机 SQLite/跨主机 PostgreSQL 任务与 fenced execution lease | 其他智能体可验证身份、在缓存窗口内同时信任新旧卡片、发现并调用网关；多副本共享任务生命周期，同 tenant/owner/task 仅一个有效执行者；completed/failed/canceled 与当前 fence 在一个事务提交，跨副本无本地 event bus 也可取消 | E3；每个新旧签名均经官方 SDK 独立验签，缓存旧卡可从 overlap JWKS 取旧公钥验证；真实 PostgreSQL 独立连接池通过。外部 JWKS 同步、真实客户端缓存/时钟偏差和 secret-manager 生产轮换仍需部署演练；远端副作用仍不能撤回或 exactly-once |
| 提供商治理 | fake provider 默认；真实提供商需白名单、运行时授权、凭据和持久调度 reservation；单机 SQLite、跨主机 PostgreSQL 均失败关闭 | 防止“配置一改就误花钱”、静默外呼和不确定重试造成的重复扣费；原始 `Idempotency-Key`/`Provider-Dispatch-Key` 不落执行上下文、日志或数据库 | E3；聊天、fallback、shadow、流式、Forge、Agent、Three Mode、Provider test 和 Multimodal 均回到核心门；本轮没有真实提供商调用，不能证明 Provider 侧 exactly-once |
| 虚拟密钥、预算与成本核对 | 虚拟 key、撤销、限流、token 预算、使用归属、spend 报告、逐调用调度墓碑，以及精确 attempt-ID 的 USD statement comparison | 团队成员不持有底层提供商密钥；管理者可找出漏记、重复、未决、未知估值、模型/token 不符和成本差异 | E3；中央 usage、独立 dispatch 表与结构化对账已通过真实 PostgreSQL，但 statement 输入仍由 operator 提供，未认证 provider 来源，也不是支付或法定发票系统 |
| 路由与韧性 | 加权路由、fallback、熔断、重试边界、影子流量单独计量 | 可迁移或比较模型，同时限制影子调用的额外成本 | E2/E3；无跨区域流量证据 |
| 缓存与 RAG | 租户隔离的精确/语义缓存、SQLite 向量检索、热路径 RAG | 降低重复推理成本，把本地知识注入受控执行路径 | E2/E3；没有大规模召回质量基准 |
| Guardrails | 本地密钥/PII/注入/禁词/大小检查，覆盖输入、工具与输出路径 | 在发往提供商前阻断明显泄密和越权内容 | E2/E3；规则防御不能证明语义级提示注入无风险 |
| 企业身份 | JWT/RBAC、OIDC Authorization Code + PKCE + JWKS、SCIM 2.0 | 接入企业 IdP，按主体、角色和租户执行 | E2/E3；没有外部 IdP 互操作认证 |
| 可观测性 | Prometheus、OpenTelemetry、Langfuse 可选出口、SLO 与质量趋势 | 看见 token、延迟、缓存、拒绝、guardrail、成本与健康状态 | E3；成熟度和托管平台仪表盘仍弱于头部产品 |
| 审计与备份 | 本地 HMAC 防篡改镜像、跨进程锁、签名检查点、加密签名企业 envelope、PostgreSQL canonical audit chain，以及数据库原生逻辑恢复演练 | 能发现本地/中央篡改、回滚和多写者碰撞；可把覆盖的中央状态从已销毁源库恢复到全新 PostgreSQL，并在数据库重启后继续读取 | E3；本地破坏性夹具覆盖 12 tables/4 sequences/13 rows 与 8 类应用契约。企业 envelope 不含中央数据库；自动 failover、PITR、生产规模 RTO/RPO 和外部 WORM 仍未完成 |
| Forge/Workforce | 受限、可取消、资源感知的编码/多角色执行；真实 HTTP 审批/状态/取消；PostgreSQL claim、中央 queue/result/审批/lifecycle 与原子终态 fence；LLM 调用强制使用请求绑定的核心网关适配器 | 把执行置于网关预算、租户、权限、调度去重和审计边界；多副本原子消费同一审批、共享状态/结果并可远程取消，过期 owner 由更高 fence 接管，旧 token 不能提交数据库终态；built-in Git/PR/任意 shell、Agent MCP 与动态 custom write 在 sink 前复核 fence | E3；修复 Forge 缓存首请求代理的身份/取消上下文滞留，并拒绝未带治理标记的 Workforce Provider 适配器；但崩溃中的角色调用栈不能重建，远端 Provider/Git/Webhook/MCP 接受与 Workforce fence 仍非同一原子事务，治理 API 外原生代码需要进程级 sandbox |
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
| AUD-23 | 高 | A2A PostgreSQL 只共享 TaskStore 状态，两个网关副本仍可能同时执行同一 scoped task，其他副本也无法安全撤销远端执行权 | PostgreSQL task 模式自动要求 tenant+owner+task scoped lease；digest-only token、随机 instance、数据库时钟 TTL/heartbeat、单调 fence、重复执行拒绝、发布前 revalidate、跨副本 context-aware cancel、主动健康探针和脱敏指标 | E3；初始真实 PostgreSQL A2A 文件 2/2 证明 lease 管理器；后续审计发现 HTTP/TaskStore 原子边界仍缺失并由 AUD-31 闭环，未把早期 2/2 单独当成端到端证明 |
| AUD-24 | 高 | Workforce 虽有 PostgreSQL claim，但队列/结果仍落本机 JSON；终态是先验证 lease、再写文件、再释放 claim，存在跨主机视图分裂和校验后竞态 | 新增同库 PostgreSQL queue/result：服务端 tenant+owner+plan 哈希作用域、数据库时钟恢复、行锁、容量/留存/大小上限、SHA-256 腐坏检测、递归敏感字段净化、verify-full TLS、独立 readiness/metrics；完成/失败在同一事务锁定摘要 token+单调 fence、写入 bounded result 并删除 claim，多实例真实执行自动失败关闭到中央模式 | E3；本地工厂/租户/DAG/健康回归通过；真实 PostgreSQL 17 两个独立队列实例 2/2，覆盖共享状态、跨 tenant 隔离、重复认领拒绝、过期接管、更高 fence、旧 token 拒绝、原子终态后 claim 消失、token/secret 不落库及篡改检测；外部 sink 仍不等于 exactly-once |
| AUD-25 | 中高 | 同一 v2 open-loop 门在实现/隔离顺序 run 通过后，纯报告 run 曾 47% 503/p95 3.5s，随后全新且最先执行 benchmark 的 runner 仍出现 67% 503/p95 4.27s；说明健康响应早于 JIT/后台初始化/本地持久状态真正稳定，单纯移动步骤不足 | v3 在 readiness 后增加一次有界、可审计的 steady-state 门：20 秒内必须连续 5 个 fake+协议有效且单次不高于 250ms；warmup 失败本身阻断，测量阶段只执行一次且仍为 100 RPS/0 错误/750ms，不重试、不降门槛；仍把该门置于其他重测试之前 | E3；历史失败保留。`32780596502` 首次尝试虽 warmup 5/5，随后仍因 runner 瞬时变慢出现 13% 503/p95 1,473.61ms并正确阻断。Provider dispatch 提交的 `32796784918` attempt 1 同样 warmup 5/5、arrival 1/lag p95 1.01ms，却在持续段出现 49/500 受控 503、p95 1,165.43ms；failed-job 复跑恢复为 500/500、0 错误、p95 7.88ms。外部效果提交的 `32808063876` attempt 1 又在 warmup 5/5、lag p95 1.03ms 后出现 339 个 503、20 transport timeout、p95 4,601.18ms并阻断；attempt 2 恢复 500/500、p95 7.32ms。后续 CI 覆盖提交 `32809195694` 首次即 500/500、p95 5.97ms。结论是门会 fail closed、共享 runner 波动真实存在，短测仍不是长时稳定性证明。 |
| AUD-26 | 高 | 受控 Workforce 的多个模块接口名/返回形状不一致：worktree 返回 `{success, worktree}` 却被当 record 使用，workspace guard 传错 `cwd`，真实安全模块导出 `pre/postExecutionCheck` 却调用不存在的 `Scan`，证据模块只有 session API 却调用不存在的 `capture`；optional chaining 令安全检查与证据静默跳过，worktree 失败可能继续、成功也可能不清理；生命周期内存又是按公开 planId 的模块全局 Map，快照写失败只打印日志 | 校正所有真实契约；worktree 创建失败立即阻断，`try/finally` 保证异常清理且清理失败使执行失败；repoRoot 实际进入 guard；tenant+owner+plan 哈希作用域贯穿 worktree/lifecycle/evidence；生命周期 Map 降为实例作用域，快照改为摘要文件名、串行原子 0600 写入、1MiB 上限、腐坏拒绝和初始化回滚；前后安全检查及审计失败关闭；安全审计使用哈希文件名、进程内串行、原子 0600 写入并拒绝腐坏；每角色 evidence 使用真实 session、敏感字段净化、1MiB 上限和原子写；Forge 必须声明并接收隔离 root | E2/E3；新增 8 项聚焦用例，含真实临时 Git 仓库/默认执行路径、7 角色证据、路径穿越、8 并发审计写、腐坏/不可写失败关闭、跨 lifecycle 实例隔离、清理失败终态；完整本地工作区与公共克隆通过 |
| AUD-27 | 高 | Workforce 审批和生命周期仍是进程/同主机状态，多副本可重复消费审批且不能可靠观察远端取消；`workforceRoutes.js` 的执行 handler 又从未接入真实 HTTP dispatcher，测试通过并不代表用户可调用 | 增加同库 PostgreSQL control：只存 tenant/plan/subject/execution SHA-256 key，原子单次审批消费、数据库时钟 TTL、版本化有界生命周期、摘要校验、行锁转换、verify-full TLS、容量/readiness/metrics；多实例真实执行缺中央 control 即启动失败；把 approve/revoke/execute/status/cancel 接入活动 dispatcher，服务端身份重新绑定 tenant+subject，远端取消轮询贯穿 DAG 到 provider `AbortSignal` | E3；真实 HTTP server 覆盖路由与越租户拒绝；本地/腐坏/容量/配置回归通过；真实 PostgreSQL 两个独立 control 实例 2/2，含并发审批仅一方成功、跨实例 cancel、明文标识/secret note 不落库及腐坏健康失败关闭；当前总 PostgreSQL 12 文件/25 测试 |
| AUD-28 | 高 | sandbox-merge 使用不存在的安全/证据/净化方法，绿分支在清理 worktree 时被自身删除，rollback 即使删除失败也可能返回成功 | 复用受控执行的真实 lifecycle/security/evidence/worktree 契约；提交前再次检查取消；错误输出净化；清理支持保留已验证候选分支，rollback 必须验证分支确已删除，任何清理/回滚失败均为终态失败 | E2/E3；真实临时 Git 仓库测试写入并提交候选，移除 worktree 后验证分支仍存在；错误契约与失败路径覆盖，完整本地/远端门通过 |
| AUD-29 | 高 | timeout 的外层 `Promise.race` 先返回，但 DAG 内部的 abort race 也可能先于实际 provider Promise 结束；随后删除 worktree 会让仍运行的底层任务面对已消失目录，旧 Forge 测试只比对源码字符串而未发现此竞态 | 取消后进入有界 drain，先等实际 role Promise 收敛；若 provider 在 `WORKFORCE_ABORT_DRAIN_TIMEOUT_MS` 内退出才允许清理，拒绝退出则标记 `execution_quiescence_unconfirmed` 并保留隔离 worktree；外层同时保留 timeout 原因与底层 settlement 错误；旧断言改为当前取消/收敛契约并增加行为测试 | E2/E3；延迟 50ms 响应 abort 的 provider 验证“先收敛、后清理”，永久忽略 abort 的 provider 验证“超时、工作树保留、remove 不调用”；本地 Forge 2,700/2,700、当前网关主要 Vitest 1,420 passed，远端完整门通过 |
| AUD-30 | 中 | CI 仍固定 Node 20 时代的 `actions/cache@v4` 和 `actions/upload-artifact@v4`，GitHub 已强制用 Node 24 执行并产生弃用警告 | 按官方稳定 tag 的不可变提交升级为 `actions/cache@v6.1.0` 与 `actions/upload-artifact@v7.0.1`，同步 CI、quality-trend、Docker 证据流和供应链固定 SHA 检查 | E3；`pnpm check:supply-chain-config` 与更新后 GitHub quality/Docker workflow 通过，不再出现该 Node 20 action-runtime 注记 |
| AUD-31 | 高 | A2A executor 在发布 completed 前只单独 `validate` lease，SDK 随后才在另一个事务写 TaskStore，存在 revoke/commit 竞态；更严重的是跨副本 cancel 在目标副本没有本地 event bus 时由官方 SDK 直接写 canceled，根本不会调用 executor 的 remote revoke，管理器测试不能证明真实 HTTP 路径 | PostgreSQL A2A acquire 在 claim 事务内锁定并检查 scoped TaskStore，终态后不可再领取；completed/failed 在同一全局锁序和事务内锁定 task+claim、校验 token digest/agent/fence/DB expiry、写 task 并删除 claim；cancel handler 即使无本地 bus 也走同一数据库边界，原子写 canceled 并删除现有 claim；终态不可重开/改写，精确 replay 幂等，等待 SDK commit 的内存 proof 有 10 秒 watchdog | E3；本地 A2A/健康/指标 67/67、网关主要 Vitest 1,420 passed；真实 PostgreSQL A2A 3/3 覆盖 success fence consume、remote cancel、terminal reacquire 拒绝、stale executor 拒绝、token 不落 task，整个 PostgreSQL 门 12 文件/25 测试 |
| AUD-32 | 中高 | 资源稳定性门同时要求 100 RPS、0 客户端丢弃，却把 outstanding 固定 64；共享 runner p95 超过约 640ms 时客户端先自我丢弃，`32786355822` 中网关 1,096/1,096 成功、资源全部有界，门仍因 arrival 0.91 和串行 scrape 漂移失败，重复了前一道容量门的职责 | 升级 v2：前一道 Go open-loop 继续独占 100 RPS/0 drop 容量契约；资源门保持 64 槽有界压力，要求至少 80% 固定到达被启动且所有 started 请求 0 错误；metrics 按固定 500ms 目标并发发起，不因上一次响应慢而漂移，仍保留 heap/RSS/event-loop 原阈值 | E3；本地慢速 Windows run 在 arrival 0.88、142 次有记录的客户端 shedding 下取得 1,058/1,058、25/25 scrape、heap +17.8MiB、RSS +37.7MiB并全门通过；最终 hosted quality 的独立 open-loop 零丢弃门和资源 v2 同时通过 |
| AUD-33 | 低 | Docker BuildKit 将公开布尔开关 `ENV PME_ENTERPRISE_AUTH_ENABLED=true` 按名称启发式标成 secret-in-ENV，虽无密钥泄漏但持续产生安全注记 | 将默认值移到 JSON CMD 的受控参数展开；显式 `true/false` 运行时值优先，`exec node` 保持 PID 1/信号语义，不全局跳过 Docker 安全检查 | E3；更新后 gateway/MCP 双架构 `push=false` 构建和只读容器 smoke 通过，原 SecretsUsedInArgOrEnv 注记消失 |
| AUD-34 | 中 | quality scorecard 把旧 Dockerfile 的 `ENV ...=true` 文本当作安全能力本身；安全等价重构后实际检查全部通过却被扣 20 分，尾部 trend smoke 因 250/270 正确阻断 | 将静态证据标记同步为新的 `CMD ... ${PME_ENTERPRISE_AUTH_ENABLED:-true} exec node` 契约，继续同时要求 Compose 显式认证、非 loopback 认证策略和攻击链证据；不改 270 分满分门槛 | E3；失败 run `32788034954` 保留；本地 scorecard 恢复 270/270、trend stable，最终 hosted quality 全门通过 |
| AUD-35 | 高 | `/chat` 只有响应级幂等，OpenAI/Anthropic/Gemini 兼容路由、流式、fallback、shadow 和内部多次调用没有跨进程的 Provider dispatch 身份；usage attempt 又是随机 ID，崩溃重放可能重复外呼/扣费 | HTTP 入口立即哈希 `Idempotency-Key`；真实调用默认强制 key；每个 invocation/fallback/shadow lane 在外呼前写 durable tombstone；SQLite 支持重启/同主机，PostgreSQL 使用独立 table/sequence/index/lock、verify-full TLS、同 usage 数据库和稳定 HMAC；容量、冲突、未知状态均失败关闭；SSE 在写 200 头前预取首事件；health/readiness/metrics 全接入 | E3；SQLite 重启、双实例竞争、负载冲突、容量和明文不落库覆盖；真实 PostgreSQL 17 两个独立 pool 仅一个 owner、重启重复拒绝、独立 invocation、专表隔离通过；普通 HTTP 幂等表不被 dispatch 墓碑挤占；不声称 Provider 侧 exactly-once |
| AUD-36 | 高 | LLM prompt enhancer、bounded Agent、Forge、Phase312A/Three Mode、Provider connection test、Multimodal 和可注入 Workforce Provider 曾可直接持有 adapter/client，绕过核心 usage/audit/dispatch；Forge 还会把首个请求绑定 proxy 缓存在 application，造成跨请求身份、取消和幂等上下文滞留；Knowledge `sqlite-vec` 可被环境变量悄然切到直连 HTTP embedding | 增加 TypeScript gateway-backed adapter 与通用 `executeProviderOperation`，将聊天、图像、Embedding、TTS、STT 的 policy→reservation→audit→usage-start→adapter→terminal 顺序收口；每个请求显式传入当前 bound gateway，禁止缓存 request proxy；Provider test/Three Mode/Phase chat 改走核心，未纳入核心的 Phase 非聊天端点明确阻断；Workforce 拒绝无治理标记 adapter；Knowledge 运行时忽略环境直连凭据并暴露 blocked health，注入外部 embedding 也必须带治理标记 | E2/E3；核心顺序、前置拒绝不调用 adapter、四类 Multimodal 映射、音频仅摘要、HTTP 缺 key/首次/重放、Forge 跨请求隔离、Prompt/Agent/Three Mode/Provider test/Knowledge/Workforce 行为测试通过；显式离线 vector production probe 不属于在线 application 路径 |
| AUD-37 | 高 | 服务端强制 dispatch key 后，shared SDK、CLI、Forge LLM/HTTP bridge 及多模态客户端未自动提供 key，真实调用会退化为 400；若普通随机 key 一律占用 `/chat` 响应重放表，还会把一次性调用变成无价值的缓存容量；Forge 低层 LLM 在 stream 失败后会再发 non-stream POST，显式 standalone direct fallback 也可能在 gateway POST 已发送但响应丢失后改为直连 Provider，均可制造重复扣费；认证 401 又曾被 GatewayBridge 当成“网关不可达” | 明确双头语义：显式 `Idempotency-Key` 同时请求响应重放与 Provider 墓碑，默认 `Provider-Dispatch-Key` 只占调度墓碑；shared SDK 对 Provider-bearing 方法自动生成 provider-only key，并允许两种显式 caller key 且拒绝歧义，JavaScript 实现与 TypeScript 公共声明同步；CLI 每次命令生成 provider-only key并透传企业 token；Forge bridge/LLM/stream 及图像、视频、Embedding、TTS、STT 默认 provider-only、显式 retry 才发标准 key并透传企业 token，多模态有界重试复用同一 key；只有 POST 前 transport probe 明确失败或权威 fake 证明才允许显式 direct，一旦 POST 已开始，chat/stream 均返回 `FORGE_GATEWAY_OUTCOME_UNCERTAIN`，不再切 direct/non-stream；任何 HTTP 响应都证明网关可达，401/503 不授予绕过权 | E2/E3；SDK 双头选择/歧义失败关闭/header 剥离 body/默认生成、HTTP 双头拒绝/CORS/provider-only Multimodal 重放、Forge auth/显式与默认 header 分流、五类多模态唯一 key/重试 key 稳定、401 不直连、chat uncertain POST 禁 direct、stream uncertain 禁 non-stream 的行为测试通过；standalone Forge 仅在 POST 前探针明确判定 transport 不可达且 operator 显式开启时保留 direct 能力，该路径不属于网关 usage/audit 证据 |
| AUD-38 | 高 | Tianshu 与 GodReview 的旧 `/chat/auto` 自调用没有 dispatch key/auth，GodReview 的 5xx/network retry 会生成重复 POST；两套神经元生成器又硬编码前端开发端口 `5191`。更基础的契约矛盾是：这些模块自己声称允许默认 loopback，却调用只允许公网单播的 `safeOutboundFetch`，所以 `127.0.0.1` 默认路径会在发请求前被安全策略永久阻断 | 新增 TypeScript internal gateway client 与专用 outbound resolver：只允许并 pin 精确 `127.0.0.1`/`localhost`/`::1`，其他目标继续执行公网单播、DNS pin 和禁止重定向策略；神经元调用合并到共享客户端，默认核心 `3100`/`AI_GATEWAY_SERVICE_PORT`；Tianshu/GodReview/Neurogenesis 全部透传 auth 与 provider-only key，GodReview 两次有界尝试复用同一 key，未知 POST 不切另一路径 | E3；真实 loopback HTTP server 4/4 覆盖 loopback pin/metadata 拒绝、Tianshu header、GodReview retry key 稳定与 Neurogenesis 核心响应形状；最终根级工作区、干净公共克隆及 hosted quality `32802349501` 均通过 |
| AUD-39 | 高 | `git_push`/`git_create_pr` 虽声明远端权限，却绕过高风险工具注册门；活跃 `httpServerRoutes03` 与未接线的抽取路由各有一套飞书/企微直发，早期测试只覆盖了未接线副本；IM 包和告警引擎也可直接发 Webhook；`shell_exec` 又能用任意脚本/别名绕过 Git/deploy 正则。上述路径没有统一、可重启、跨副本的外部效果身份，也没有把 Workforce 活跃 claim 带到 sink 提交边界 | 新增独立 durable external-effect gate：SQLite 单主机、PostgreSQL 多主机、专用 table/sequence/index/lock、稳定 HMAC、key/tenant/target/payload 只存哈希、容量/TTL/TLS/同 Workforce 数据库约束；两套路由共享一个 Webhook guard，实时错误状态不再被压成 422；IM 包和告警引擎无 guard 不发送；Git 远端工具进入高风险注册并在命令前 commit；所有 `shell_exec`（含未知脚本）都要求 gate+可信 fence；工具 key 来自 session+tool-call，调用方 context 不能替换 registry fence；Workforce 角色只得到冻结的 fencingToken+闭包断言，不暴露 claim token；readiness/metrics/静态出站策略全接入 | E3；聚焦类型/行为测试、完整根级 Forge 2,700/2,700、网关 Node 100/100、隔离解析器 10/10、主 Vitest 1,413 passed/26 conditional skipped、连接器包 9/9；真实 PostgreSQL 17 共 12 文件/25 测试，新增项证明双副本仅一个 owner、重启后墓碑、专表隔离和明文不落库。契约是 TTL 内 at-most-once attempt，不是远端 exactly-once；当时剩余的受治理 MCP/OpenAPI gap 随后由 AUD-41 闭环 |
| AUD-40 | 中高 | 新 external-effect PostgreSQL 集成在本地 12/25 通过，但 CI 的 PostgreSQL 步骤是显式文件清单，最初未加入该文件；因此 `2d2dbf9a` 的 hosted quality 虽最终通过，日志仍只有 11/24，不能当作新 PostgreSQL gate 的 hosted 证据 | 将 `externalEffectGate.postgres.integration.test.ts` 加入 CI 清单；同时让 `pnpm check:outbound-policy` 检查 workflow marker，今后删除或漏接该真实数据库测试会在 workspace checks 阶段失败 | E3；修复提交 `5ff8a0b6` 的 [quality run 32809195694](https://github.com/happy520ai/unified-ai-system/actions/runs/32809195694) 日志明确执行 external-effect 1/1，并汇总 PostgreSQL 12 files/25 tests；quality 6 分 58 秒、score 270，三项扫描通过 |
| AUD-41 | 高 | 活跃 `/mcp/call`、HTTP/stdio reverse MCP 与 OpenAPI REST bridge 只有 ACL/审计/出站限制，没有稳定操作 key；所有 allowed tool 都可产生外部副作用。两条 Agent MCP 注册器又把外部工具硬标 `isReadOnly: true`，直接 `mcpBridge.callTool`；且它们误把 bridge 的 `{status, tools}` 列表 envelope 当数组，实际接线行为与测试想象不一致。服务 shutdown 也未关闭 MCP client/stdio child；文档还一处错误声称缺 `allowedTools` 会暴露全部工具 | Reverse MCP 新增独立 `readOnlyTools` 运维证明，所有其他 allowed tool mutation-by-default；`/mcp/call` 只接受 header-derived hash context，在 ACL/大小/target 验证后写并 commit durable 墓碑，再调用 HTTP/stdio/OpenAPI；tool listing 暴露 `readOnly/externalEffectRequired`，MCP 配置自动启用 gate，多实例自动受 PostgreSQL 要求；所有拒绝/调用写审计且 auth 保持 403；两条 Agent adapter 支持真实 listing envelope，并一律注册为 `mcp:agent-tool-call`、non-read-only、fence-required，commit 后才 callTool；shutdown 关闭 MCP clients；静态策略固定四条接线 | E3；聚焦 46/46，完整根门 Forge 2,700/2,700、网关 Node 100/100、隔离解析器 10/10、主 Vitest 1,420 passed/26 conditional skipped，公共克隆 0 真实 Provider 且清理成功；[hosted run 32812616524](https://github.com/happy520ai/unified-ai-system/actions/runs/32812616524) 明确执行 `mcpGateway` 16、active route 2、Agent adapter 1 项并全门通过，PostgreSQL 仍 12/25；SQLite 证明 mutation 缺 key/歧义/重复/冲突均不调用 upstream，read-only 明确豁免。仓内低层 direct call 随后由 AUD-42 静态 allowlist 固定，远端 exactly-once 仍不声称关闭 |
| AUD-42 | 高 | `registerTool` 用 incoming `source` 而不是 existing tool 判断覆盖保护，传 `source:"custom"` 即可替换内置 `file_read`；新 custom tool 默认又会被 `buildTool` 标成 built-in，导致来源统计/注销错误。动态工具可零权限注册，non-read-only 可不声明 external effect，read-only 也没有可信 attestation；MCP adapter 还忽略 registry 的失败返回并把碰撞误报为已添加。由此未声明 custom sink 可绕过前两轮 fence | `registerTool` 现在验证有界 name/permission/effect 字段，任何 existing built-in 或 custom 都不能静默覆盖；所有动态来源强制改写为 `custom`。每个 custom 至少一个合法权限；read-only 必须 `readOnlyAttested=true`；其他必须提供 bounded `externalEffectType` 且 `externalEffectRequiresFence=true`。MCP/subagent 接线补齐 attestation/contract，adapter 只有注册成功才计入；静态门固定 override/effect markers，并禁止新的低层 MCP direct call site | E3；聚焦 46/46 覆盖恶意 `file_read` override、无权限、伪只读、未声明 write、合法注册/注销与 MCP 碰撞；完整根门 Forge 2,700/2,700、网关 Node 100/100、parser 10/10、主 Vitest 1,422 passed/26 conditional skipped，公共克隆 fake-only/0 real call/清理成功；[hosted run 32815030132](https://github.com/happy520ai/unified-ai-system/actions/runs/32815030132) 明确执行 policy 21 与 MCP adapter 2 项，score 270、PostgreSQL 12/25、全门通过。此契约治理 registry API，不能沙箱完全绕开 registry 的任意原生代码 |
| AUD-43 | 中高 | 当前源码契约已要求 Node `>=22.18.0`、pnpm `11.19.0`，但 README/CONTRIBUTING/getting-started/排障与 issue 模板仍引导 pnpm `9.15.4` 或 Node 20；CLI、排障、通用 MCP、增长脚本和发帖模板仍传播 `0.4.9`，而最新发布与 Registry 已是 `0.5.0`。中文主页/Quickstart 与社交图又残留 9 tools，首图和能力图使用“LiteLLM/Portkey-class”“every feature works with zero credentials”“Everything a commercial gateway ships”以及错误的 provider credential 哈希描述，既损害首次安装也超出 E3 证据 | 增加从根 `package.json` 派生 release version/镜像/User-Agent 的 ESM 单一来源，三套 Node growth/IndexNow 工具不再硬编码版本；当前用户路径、PowerShell fallback 与中英文入口统一到 Node 22.18.0、pnpm 11.19.0、发布镜像 0.5.0 和 12 tools。公共仓库门新增 source-onboarding、release-image 与营销源稿契约，旧工具链/镜像和已知过度表述重新出现即失败；README/主页明确 hardened Public Preview，三张 HTML 源稿经 Playwright 固定视口重绘，移除竞品级/全功能零凭证口号并把安全回归写成“evidence, not certification”。安全插件仍按 digest 固定到单独审查的 0.4.9，不把普通 0.5.0 安装与 hardened plugin 边界混为一谈 | E3；本地四门全通过，公共扫描 1,899/1,839、0 issues；发布网关 `0.5.0` demo 返回 `providerCalled=false`，普通 `0.5.0` MCP stdio 用官方 client 发现 12 tools。更强的 `--network none --read-only` 容器烟测在 30 秒 readiness 失败，证明 0.5.0 不能替代 reviewed 0.4.9 plugin 的 hardened 声明；未读取/调用 Provider。托管 [quality run 32819688606](https://github.com/happy520ai/unified-ai-system/actions/runs/32819688606) 6 分 49 秒全绿，PostgreSQL/公共克隆/MCP/CLI/三项性能门与证据 parity 均通过；[HOL scan 32819688608](https://github.com/happy520ai/unified-ai-system/actions/runs/32819688608) 和 plugin-scanner 通过 |
| AUD-44 | 中 | 在仅增加推广报告后进行的第三次本地完整 `pnpm test` 中，`agentExecRoutes.test.js` 的“应完成”用例把请求 wall-clock 固定为 30 秒；全仓 208-file Vitest 并发争用时，fake Agent 在 30.874 秒返回 `timeout`，形成 1 failed/1,421 passed/26 skipped。相同源码的前两次本地和两次 hosted 全门都通过，空闲聚焦又在 929ms 完成。测量显示 Agent 自动上下文会顺序扫描 4,218 个文件，空闲耗时约 0.78–0.95 秒；请求预算从 Agent loop 前开始，正确包含这段 I/O，因此失败证明的是测试错误地假设“任意主机负载下 30 秒必完成”，不是 runtime 忽略 timeout | 完成型与 tool-mode 语义用例改用产品已有 `defaultTimeoutMs=60_000`，runner 上限分别 90/130 秒，避免把宿主争用错误分类为功能失败；专用 timeout 用例仍使用 `minTimeoutMs=1_000` 加 1,500ms fake latency，继续证明 wall-clock 中断。没有修改运行时默认/最小/最大 timeout、Agent 行为或用户请求边界 | E3；修复前失败完整保留；空闲聚焦 6/6 证明原路径本身可完成，修复后相同文件连续 10/10 次通过，随后完整根测试恢复 Forge 2,700/2,700、网关 Node 100/100、parser 10/10、主 Vitest 1,422 passed/26 skipped；`pnpm check`、公共扫描 1,899/1,839 与公共克隆全绿。托管 [quality run 32824078807](https://github.com/happy520ai/unified-ai-system/actions/runs/32824078807) 6 分 53 秒通过 maintained tests、PostgreSQL 12/25、公共克隆和三项性能门；[HOL scan 32824078797](https://github.com/happy520ai/unified-ai-system/actions/runs/32824078797) 与 plugin-scanner 通过 |
| AUD-45 | 中 | 两个公开 good-first issue 与当前长板证据不一致：Prompt Lab 分享只测简单英文，没有多行 Unicode/URL-sensitive 字符的真实浏览器往返；六类 prompt signals 只有“一次全开”，无法定位单 signal 回归或误报。另一个 Helm issue 把仅支持 stdio 的 v0.5.0 MCP 镜像建议成 Kubernetes Deployment/Service/Ingress，若照做会产出不可用传输 | Prompt enhancer 新增 12 个窄双语 fixture（六类 signal 各 en/zh-CN）并要求其他五类为 false、对应 compiled section item 存在、original/deterministic/provider-free 不变；再加两条 mixed negative。真实 Chromium 从 UI 生成含换行、中文、`& # ? % +` 的 share URL，在新 page 精确恢复 input/profile/language、增强结果与证据，并断言 0 unrelated/provider requests。#113 改为 gateway-only Helm Phase 1，明确 stdio MCP 不得网络暴露；外部贡献者无法通过 GitHub assign API 分配时，不扩大仓库权限，允许以 draft PR 认领 | E3；聚焦 prompt 57/57、web-agent smoke 通过；完整根门主 Vitest 提升到 1,436 passed/26 skipped；[#107](https://github.com/happy520ai/unified-ai-system/issues/107)/[#108](https://github.com/happy520ai/unified-ai-system/issues/108) 移除 good-first/help-wanted 并在 PR #115 绑定 `Closes`，[#113](https://github.com/happy520ai/unified-ai-system/issues/113) 保留给贡献者且架构边界已纠正。托管 [quality run 32829554802](https://github.com/happy520ai/unified-ai-system/actions/runs/32829554802) 6 分 52 秒全绿，[HOL scan 32829554803](https://github.com/happy520ai/unified-ai-system/actions/runs/32829554803) 与 plugin-scanner 通过 |
| AUD-46 | 高 | 文档解析虽在 worker thread 内执行，但 `pdf-parse 2.4.5` 会加载原生 `@napi-rs/canvas`；Windows 上一个有效最小 PDF 可让承载 Vitest/gateway 的整个进程原生退出。完整根门曾出现 `isolatedVitest=1` 而主 1,436 项全过；默认 fork pool 的 PDF-only 第 6 次、全 parser 第 32 次出现 `Worker exited unexpectedly`，thread pool 第 31 次以 `0xC0000005` 访问冲突退出。DOCX-only 60/60、PDFParse 同进程 500/500 均通过，证明风险集中在 native addon + worker-thread 边界；因此攻击者反复上传有效 PDF 可能造成进程级 DoS，worker thread 不是 native crash containment | PDF 改用硬编码 Node fork 的独立 TypeScript 子进程；只通过 bounded advanced-IPC 发送已通过 25MiB 门的 Buffer，保留 15 秒、128MiB old/16MiB semi-space 和全局 2 active/4 queued 上限；环境仅允许 Windows loader/locale 字段，不继承 Provider secrets、`NODE_OPTIONS`、PATH 或 stdio；未知/原生失败归为可重试 availability，页数/文本等已知错误仍为 validation。Word/Excel 继续 worker thread，避免无差别增加开销。此处提供原生崩溃遏制，不声称子进程获得独立 OS 用户、文件系统或网络 sandbox | E3；修复后 parser 12/12（含 20 次 PDF child load 和环境净化契约）、同一父进程 100/100 次 PDF child-process stress、网关 Node 100/100 + isolated 12/12 + 主 Vitest 1,436/26、完整根四门与公共克隆通过；公共扫描 1,900/1,840、0 issues。Linux 托管 [quality run 32829554802](https://github.com/happy520ai/unified-ai-system/actions/runs/32829554802) 通过 maintained tests、PostgreSQL 12/25、三项性能门和公共克隆；native crash 未被“换 pool/复跑”当成关闭证据 |
| AUD-47 | 高 | `enterprise backup` 名称容易被误读成系统级 DR，但现有 envelope 只包含企业用户、有限 audit export、readiness 与 knowledge health，并明确 `restore-validate-only`；它没有中央 idempotency、Provider dispatch、external effect、usage、canonical audit、A2A 或 Workforce 表，也不执行数据库恢复。早期仓库只有单库集成；第一版恢复演练又在数据库重启后新建客户端，仍不能证明正在运行的 gateway pool 会自行恢复 | 固定 PostgreSQL 17、双容器/双卷、loopback-only 演练：应用 API 写入八类状态，`pg_dump` 后删除源容器+卷，`pg_restore --exit-on-error` 到全新库并要求 12-table/4-sequence/13-row inventory digest 精确一致。恢复端预分配固定 loopback 端口，八类同一 application client/pool 在首次 8/8 后保持打开；数据库重启、容器内+真实 client path ready 后仍用原对象再验 8/8，随后所有 client close 也必须成功。随机测试凭据只经 0600 临时 env-file，失败/成功都清理容器、卷和 artifact；CI 步骤和静态 marker 防漏接。文档明确 enterprise envelope 与数据库备份互不替代 | E3；增强后本地 run：33,943-byte dump、受控恢复 5,212ms、总计 10,662ms；托管 [run 32840149540](https://github.com/happy520ai/unified-ai-system/actions/runs/32840149540)：33,926-byte dump、受控恢复 2,398ms、总计 5,240ms；两者均为同一客户端首次/重启后 8/8、0 Provider call、0 残留。失败历史保留：不受支持 storage namespace；JSONB/投影假阴性；容器内 ready 早于宿主 SQL；tmpfs 重启 8/8 全丢失；Docker Desktop 随机发布端口实测重启 `64899→64905`，因此改用预分配固定端点；首个 hosted [run 32834038770](https://github.com/happy520ai/unified-ai-system/actions/runs/32834038770) 根 `pg` 依赖漏声明。此证据仍不是 automatic failover、continuous WAL/PITR、partition/split-brain 或生产 RTO/RPO |
| AUD-48 | 高 | Agent Card 只加载一把 Ed25519 私钥、发布一个 JWK 并生成一个 JWS；替换密钥会让缓存旧卡与刷新后 JWKS 失配，继续保留旧密钥又无法开始新信任链。文档明确承认没有 overlap rotation，生产轮换只能依赖不可验证的外部时序 | 新增 `AI_GATEWAY_A2A_AGENT_CARD_PREVIOUS_SIGNING_KEY_FILES_JSON`：结构化 JSON 数组允许 0–3 把旧 key；每条路径复用绝对路径、16KiB、POSIX 0600 与 Ed25519 检查，主/旧公钥 `kid` 必须唯一。官方 SDK signer 按 primary-first 顺序对同一 canonical card 逐一签名，本地 JWKS 按相同顺序只发布公钥；保留兼容 `keyId` 并新增无路径的 `keyIds/previousKeyIds/signatureCount`。缺主密钥、JSON 错误、超限、重复 path/kid、弱权限或错误算法均启动失败；外部 JWKS 必须由运维同步完整集合 | E3：A2A signing+gateway 聚焦 22/22；两条签名分别用官方 `verifyAgentCardSignature` 单独验证，旧部署缓存卡又用轮换 JWKS 验证，request handler 同样输出 2 signatures；full root/hosted 均为 Forge 2,700/2,700、gateway Node 100/100、parser 12/12、main Vitest 1,438 passed/26 skipped，四个本地门和 hosted [run 32837624093 attempt 2](https://github.com/happy520ai/unified-ai-system/actions/runs/32837624093) 全通过，HOL `32837624071` 通过。attempt 1 在代码测试前由原门以 80/80、0 error、p95 996.7ms > 750ms 正确阻断；未降阈值，failed-job 复跑 p95 41.05ms 后全链通过。外部 JWKS 内容、真实客户端 cache/skew 与 secret-manager 操作窗口仍需隔离部署轮换演练 |

在本轮已审范围和现有自动化证据内，**没有仍然已知且未处置的 P0 代码级缺陷，也没有已知仍可达的仓内低层 MCP/custom registry 旁路**。仍知的 P1 是完全绕开治理 API 的任意原生代码无法靠 JavaScript 运行时自动沙箱，以及任何远端系统都不参与本地墓碑事务；它们在下节保留为架构/生产阻断。

## 6. 仍然存在的风险与阻断项

这些项目不能靠修改一行代码或把 CI 跑绿就诚实地关闭。

| 优先级 | 阻断项 | 当前影响 | 关闭条件 |
| --- | --- | --- | --- |
| 生产阻断 | 当前加固分支仍是开放 PR，尚未进入正式发布 | v0.5.0 用户没有自动获得本轮全部修复 | 审核、合并、从合并提交重跑发布门并发布新版本 |
| 生产阻断 | 本轮没有真实提供商预生产验证 | 无法确认最新 OpenAI/Anthropic/Gemini 等真实响应、计费与错误契约 | 使用限额凭据、出口 allowlist、硬成本上限逐家验证；不得复用旧证明 |
| 生产阻断 | 缺独立渗透测试和外部威胁模型复核 | 现有安全结论由仓库本地工具和本次审计产生 | 第三方测试、修复复测、签名报告 |
| 生产阻断 | 缺 6–24 小时真实工作负载 soak 与容量包线 | 当前短时门只能发现明显回归，不能证明无泄漏或峰值稳定 | 多负载混合、并发爬坡、故障注入、长时资源趋势 |
| 生产阻断 | Workforce 的 claim、queue/result、审批和 lifecycle 已中央化，数据库终态已原子消费 fence；Provider、built-in Git/PR/任意 shell、Webhooks、受治理 MCP/OpenAPI 和动态 custom registry 都有声明/墓碑边界，但运行中的角色调用栈不能在副本崩溃后重建，远端接受不与本地 fence 同事务，完全绕开治理 API 的原生代码仍不受自动沙箱 | 跨副本授权、状态、取消、数据库终态和已覆盖 sink 的 TTL 内重复尝试防护已经闭环；进程崩溃仍只能由租约恢复/重新执行，已发出的远端副作用不能撤回，不能声称 durable resume 或端到端 exactly-once | 可重建执行状态机或明确幂等重放契约、中央/对象化证据、Provider/外部系统侧 idempotency 或可认证对账、以进程/容器 sandbox 禁止治理 API 外执行、数据库故障转移/分区/split-brain 测试 |
| 生产阻断 | usage/audit 已中央化，结构化 provider statement comparison 已能精确核对，但 statement 来源仍由 operator 提供，未通过 provider API/签名认证；外部 WORM 也未闭环 | 能发现技术账本差异，仍不能把输入真实性、支付状态、税务或外部不可变性视为已证明 | provider-authenticated/signed ingestion、持久对账历史、财务/税务边界，以及把 sequence/hash floor 写入并演练外部 WORM/object-lock |
| 生产阻断 | 已完成有界 PostgreSQL 逻辑备份、源库销毁、全新库恢复、恢复库重启及同一八类 application pool 断线重连演练，但未完成负载均衡器、TLS/mTLS、连续 WAL/PITR、自动主从切换、生产数据规模、网络分区和 split-brain 演练 | 能证明覆盖状态的 CI 夹具可恢复且现存连接池可在同端点数据库重启后恢复，仍不能给出生产 RTO/RPO、多实例透明故障切换或跨区域承诺 | 隔离预生产环境做真实拓扑的主从/代理/DNS endpoint 切换、证书轮换、连续归档/PITR、多容量恢复、网络分区/split-brain 与重复演练；RTO/RPO 由外部保留点和业务验收签署 |
| P1 能力差距 | A2A 已支持稳定 Ed25519/JWKS、bounded overlap multi-signature rotation、memory/SQLite/PostgreSQL 任务、分布式 lease/fence 和原子 TaskStore 终态；Provider、built-in Git/shell、Webhooks、受治理 MCP/OpenAPI 与 custom registry 已能阻断同 key 重放，但 fence 尚不能原子传递给远端，治理 API 外原生代码不能由语言运行时自动沙箱 | 数据库内 revoke/commit、覆盖 sink 的墓碑与网关侧重复外呼风险已分别关闭；它们不是同一远端事务，最终网络 TOCTOU 和未知结果仍存在，不能声称端到端 exactly-once | 以进程/容器级 sandbox 禁止治理 API 外执行；推动 Provider/外部系统消费 idempotency/fence 或完成可认证对账，并做数据库故障转移/分区与真实 secret-manager/JWKS 轮换演练 |
| P1 隔离差距 | PDF native addon 已移入最小环境、内存/时间受限的子进程，原生访问冲突不再与 gateway 同进程；但该子进程仍以同一 OS 用户运行，没有独立文件系统、网络 namespace、seccomp/AppContainer 或容器边界 | native crash 被遏制为单请求 availability 失败，但若解析依赖被利用，不能据此声称已阻止同权限文件读取或网络访问 | 在 Linux 容器/生产拓扑中增加专用 parser sandbox/sidecar、只读最小文件系统、禁网、seccomp/cgroup/进程限额与故障注入；Windows 需等价 AppContainer/job-object 或隔离服务证据 |
| P1 工程债 | TypeScript 迁移例外仍存在 | 严格检查通过，但部分旧运行时仍依赖 JS 兼容边界 | 在 2026-10-31/11-13 前消除登记例外并保持契约兼容 |
| 市场阻断 | 采用度和第三方案例很小 | 不能把技术潜力写成行业领导地位 | 可复现用户案例、贡献者增长、独立基准、长期留存与生产参考 |

## 7. 验证结果

### 7.1 当前实现提交的本地门

| 验证 | 结果 |
| --- | --- |
| `pnpm check` | 通过；679 个网关文件语法检查，TypeScript 0 errors，语言/供应链策略通过，83 个权限声明/136 条静态活动路由，18 个受治理出站集成；动态 Workforce dispatcher 另有真实 HTTP server 行为覆盖 |
| `pnpm test` | 当前完整命令通过；Forge 2,700/2,700；网关 Node 100/100、隔离解析器 12/12、主要 Vitest 1,438 passed/26 conditional skipped；shared SDK 18/18、Agent Console 17/17、MCP/其余工作区套件通过。本 external-effect tranche 首次根门在 Forge 2,698/2,700 被两条仍假设远端 Git 默认注册/旧 shell 源码窗口的契约测试正确阻断；更新断言后聚焦 59/59、完整 Forge 2,700/2,700 和后续根门通过。采用度报告后又出现 AUD-44 的 30 秒 completion 测试假阴性及 AUD-46 的 PDF native process crash；两者的原始失败、压力复现和修复后全门均保留，不把单次复跑替代失败历史 |
| 真实 PostgreSQL 集成（本地） | PostgreSQL 17 临时实例通过 12 个文件、25/25；新增 external-effect 证明双独立 pool 仅一个 owner、重启重复拒绝、专表/序列隔离、原始 key/tenant/effect type 不落库；Workforce queue 新增活跃/过期 claim 断言。临时容器已停止并删除 |
| `pnpm drill:postgres-recovery -- --json` | 通过；源容器+源卷先销毁，`pg_dump/pg_restore` 到独立恢复卷；12 tables/4 sequences/13 rows exact match；固定 loopback endpoint 上同一八类 application client/pool 在恢复后与数据库重启后均 8/8；受控恢复 5,212ms，总计 10,662ms；0 real Provider，client/container/volume/artifact 全清理。它不是 production RTO/RPO、PITR 或 automatic failover 证明 |
| `pnpm check:public` | 通过；1,902 个 tracked/candidate、1,842 个文本文件，0 issue codes；新增工具链/发布镜像/营销源稿一致性门；工作区 `.mcp.json` 有用户改动时从 Git 提交内容审计，未读取其本地内容 |
| `pnpm verify:public-clone` | 通过；干净克隆、fake-provider 强制、MCP `2026-07-28`、12 tools、0 次真实提供商调用、进程清理成功 |
| `pnpm verify:mcp` | 通过 4/4；现代 stdio、现代+兼容 HTTP、认证/CORS/清理 |
| `pnpm smoke:mcp --json` | 通过；现代协议时代 `2026-07-28` |
| `node tools/security-attack-regression.mjs` | 23/23 防住；含对账跨 tenant body 和 viewer 权限攻击；`SECURITY AUDIT: ALL DEFENDED` |
| `pnpm audit --prod --audit-level high` | 通过；0 个已知生产依赖漏洞 |
| 审计链顺序压测 | 500 条约 4.99 秒，约 100.23 records/s，最终链验证通过 |

### 7.2 当前实现提交的 GitHub 门

| 门 | 结果 | 可复核链接 |
| --- | --- | --- |
| A2A overlapping Agent Card rotation | `4ac41439` hosted maintained tests 通过 1,438/26，签名/JWKS overlap 聚焦 22/22 的源码与完整根门同 head；PostgreSQL 12/25、destructive recovery、公共克隆、MCP/CLI/examples 全通过。attempt 1 因共享 runner 非流式 p95 996.7ms > 750ms 阻断且跳过代码测试；未改门，attempt 2 p95 41.05ms、80/80、0 error 后 7 分 29 秒全绿 | [Run 32837624093](https://github.com/happy520ai/unified-ai-system/actions/runs/32837624093)（attempt 1 failure + attempt 2 success）；[HOL 32837624071](https://github.com/happy520ai/unified-ai-system/actions/runs/32837624071) |
| PostgreSQL destructive logical recovery + live-pool reconnect | `0d658b77` hosted quality 7 分 6 秒全绿；删除源容器+卷后恢复 12 tables/4 sequences/13 rows，固定 loopback endpoint 上同一八类 application clients 首次 8/8，数据库重启后原对象再 8/8，0 real Provider、client/container/volume/artifact cleanup complete；maintained tests、PostgreSQL 12/25、公共克隆及其他门同时通过 | [Run 32840149540](https://github.com/happy520ai/unified-ai-system/actions/runs/32840149540)；早期新客户端恢复 [32835235722](https://github.com/happy520ai/unified-ai-system/actions/runs/32835235722)；根依赖漏声明失败 [32834038770](https://github.com/happy520ai/unified-ai-system/actions/runs/32834038770) |
| PDF native containment + prompt contracts | `f1fe7b9d` 一次 hosted 通过；6 分 52 秒；parser child process、1,436/26、Unicode browser smoke、PostgreSQL 12/25、公共克隆和三项性能门全绿 | [Run 32829554802](https://github.com/happy520ai/unified-ai-system/actions/runs/32829554802) |
| Agent completion/timeout 测试契约 | `d2205a20` 一次 hosted 通过；6 分 53 秒；maintained tests、PostgreSQL 12/25、公共克隆、三项性能门、MCP/CLI/示例和 evidence parity 全绿 | [Run 32824078807](https://github.com/happy520ai/unified-ai-system/actions/runs/32824078807) |
| 采用度/版本一致性最终代码门 | `05d49df1` 一次通过；6 分 49 秒；四项基线门、三项性能门、PostgreSQL 12/25、MCP、CLI、示例与证据 parity 全绿 | [Run 32819688606](https://github.com/happy520ai/unified-ai-system/actions/runs/32819688606) |
| 完整 `quality` | custom tool 代码/报告基线 `dd21f740`/`44f855c8` 一次通过；7 分 14 秒，quality score 270，所有 required artifact parity 通过 | [Run 32815030132](https://github.com/happy520ai/unified-ai-system/actions/runs/32815030132) |
| PostgreSQL 集成 | 通过；12 个文件、25/25；日志明确含 external-effect 双副本/专表 1/1，另含 Provider dispatch 1/1、A2A TaskStore+execution lease+原子终态 3/3、中央 audit 2/2、usage+statement comparison 2/2、Workforce claim 2/2、中央 queue/result 2/2、中央 approval/lifecycle 2/2，以及 rate-limit/WebSocket/idempotency | 同一 quality run；早一提交 hosted 仅 11/24 的覆盖缺口按 AUD-40 保留 |
| SLO/故障隔离 | 通过 | 同一 quality run |
| 开环 soak/背压 | v3 通过；warmup 5/5（p95 30.47ms）；持续 500/500、0 错误、p95 6.47ms、scheduler lag p95 1.01ms；突发 83 accepted/173 controlled 503；恢复与 8/8 中断通过 | Run `32815030132`；`32808063876` attempt 1 的 339 个 503+20 transport timeout/p95 4,601.18ms 与 attempt 2 恢复历史均保留，不写成长时稳定性证明 |
| SLO | 非流式 80/80、p95 40.33ms/p99 43.01ms；流式 80/80、首内容 p95 48.94ms、总响应 p95 56.70ms；0 错误，故障隔离后恢复 | Run `32815030132` |
| 资源稳定性 soak | v2 通过；1,200/1,200、arrival 1.00、0 错误、25/25 scrape；heap +9.90MiB、RSS +16.34MiB、event-loop p99 bound 26.25ms | 同一 quality run；v1 客户端自限失败 `32786355822` 保留，前一道 open-loop 仍单独要求 100 RPS/0 drop |
| MCP、CLI、Go/C#/SDK 示例 | 全部通过 | 同一 quality run |
| 代码/依赖扫描 | 通过 | [PR #115 checks](https://github.com/happy520ai/unified-ai-system/pull/115/checks) |
| 插件扫描 | 最新代码 head 的 HOL scan 与独立 plugin-scanner 均通过 | [Run 32840149509](https://github.com/happy520ai/unified-ai-system/actions/runs/32840149509)、[PR #115 checks](https://github.com/happy520ai/unified-ai-system/pull/115/checks) |
| hardened amd64+arm64 容器 | 当前运行时 `3adb9fe3` 通过网关/MCP 双架构构建、只读/cap-drop/no-new-privileges 容器 smoke、SBOM/provenance 配置校验（`push=false`），且无 secret-in-ENV 注记；较早发布候选另有匿名拉取验证 | [Run 32788044494](https://github.com/happy520ai/unified-ai-system/actions/runs/32788044494)、[Run 32767012331](https://github.com/happy520ai/unified-ai-system/actions/runs/32767012331) |

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
| 路由与可靠性 | 加权、fallback、熔断、缓存、影子、成本门，以及单机/跨主机 durable Provider dispatch tombstone | Portkey、[Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/features/) 和 [Kong AI Gateway](https://docs.konghq.com/gateway/latest/ai-gateway/) 已有成熟路由、限流和全球/企业部署叙事 | 代码级成本安全与治理有差异化，全球规模、Provider 侧 exactly-once 和生产证据仍落后 |
| 可观测与成本 | Prometheus、OTel、Langfuse、虚拟 key、预算、spend ledger | [Helicone](https://docs.helicone.ai/getting-started/platform-overview) 和 Cloudflare 有成熟托管分析体验 | 控制面扎实，产品化与托管体验落后 |
| 协议与智能体治理 | OpenAI/Anthropic/Gemini + MCP + A2A + reverse MCP + Forge/Workforce；A2A 已有稳定签名/JWKS、bounded overlap rotation、跨主机 PostgreSQL 状态、fenced execution lease 与原子 TaskStore 终态；Provider、built-in Git/shell/Webhook、受治理 MCP/OpenAPI/custom tool 有独立 durable 墓碑 | [MCP `2026-07-28`](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/blog/content/posts/2026-07-28-spec-ga/index.md) 进入无会话现代时代；[A2A v1.0](https://github.com/a2aproject/A2A/blob/main/docs/announcing-1.0.md) 强调稳定、多租户与可签名 Agent Card | **项目最有机会领先的维度**；远端原子性、治理 API 外进程 sandbox、真实 JWKS/secret-manager 轮换和故障转移证据仍需补齐 |
| 确定性与无密钥验证 | 本地增强、fake provider、公共克隆、明确调用证据 | 多数网关更关注代理、路由和托管分析 | **差异化强**，可形成品牌心智 |
| 安全与发布工程 | fail-closed、攻击回归、严格类型门、公共检查、只读多架构容器、SBOM/provenance | 头部产品拥有更长生产历史、团队和第三方认证 | 仓库工程纪律强；外部保证不足 |
| HA/DR/全球规模 | 部分 PostgreSQL 跨主机状态；已有源库销毁后的有界逻辑恢复、恢复库重启及同一八类 client/pool 8/8 重连证据 | Cloudflare/Kong/商业网关具备成熟多区域、自动 failover、PITR 和企业运维能力 | 从“无恢复演练”前进到可复现 CI 逻辑恢复/同端点重连，但在生产规模、自动 endpoint 切换、连续 RPO、分区与跨区域上仍**明显落后** |
| 生态采用 | 6 stars、2 forks，案例少 | 头部项目拥有大量集成、贡献者和用户 | 技术潜力尚未转化为市场领导力 |

## 9. 它给用户带来了什么

### 对个人开发者

- 不注册、不配 key 就能验证 prompt 增强、MCP 工具和网关流程；
- 保留现有 OpenAI/Anthropic/Gemini 客户端习惯；
- 对每次执行看见 provider、model、fake/real、预算与治理证据；
- 对真实 Provider 请求使用一个客户端操作 key；网关在任何外呼前落 durable 墓碑，重复、冲突、容量不足和存储故障都不会静默再花一次钱；
- 对真实飞书/企微发送使用一个外部效果 key；重复或改载荷会在 Webhook 前拒绝，默认高风险 Git/PR/shell 工具不注册，显式启用后仍需权限、durable gate 和可信执行 fence；
- 调用受治理 reverse MCP/OpenAPI 时，工具列表会明确标出 read-only 或 mutation；mutation 必须提供稳定 key，Agent 导入的 MCP 工具则默认全部需要可信 fence；
- 本地运行，减少把 prompt、知识和工具上下文交给额外 SaaS 的必要。

### 对团队与平台工程

- 用虚拟 key、租户、RBAC、预算和统一审计代替散落的提供商密钥；
- 将缓存、RAG、guardrails、fallback、影子流量和工具权限集中到同一执行边界；
- 让 Chat、流式、多候选、Forge、Agent、Three Mode、Provider test、图像、Embedding、TTS 和 STT 共享同一 policy/dispatch/audit/usage 顺序，而不是各自直连 Provider；
- 把 provider statement 的每一行与中央 usage attempt 精确核对，直接看到漏记、重复、未决、未知估值和超容差成本；
- 对 MCP/A2A/HTTP 客户端复用同一套治理策略，而非为每种客户端重复建设；
- 让不同主机上的 A2A 网关副本读取同一份受 tenant/owner 隔离、有容量/TTL/分页约束的任务状态；
- 同一 scoped A2A task 只允许一个有效执行 lease，并允许另一副本安全撤销远端 lease；
- 让不同主机上的 Workforce 执行者共享同一队列与受限结果；租约过期后可由更高 fence 接管，旧执行者无法覆盖数据库终态；
- 让 Provider 调度与现有 Git/PR/shell/Webhook 各用独立容量的 durable 墓碑；跨副本重复、冲突、陈旧 claim 和存储故障在不可逆 sink 前失败关闭；
- 让 Workforce 审批只能被一个副本原子消费，并让任一已授权副本查看/取消同一执行；取消信号会进入 provider，拒绝停止的任务不会触发危险的 worktree 删除；
- 用公共克隆、攻击回归和 CI 证据降低“只有作者机器能跑”的风险。

### 对受监管或重视数据边界的组织

- 自托管、默认 fake、真实调用显式启用；
- OIDC/SCIM、租户隔离、日志净化、凭据加密、审计链和加密备份构成可检查基础；
- 对账结果保留“operator-supplied、非法律发票、非支付/税务证明”的机器可读边界；
- 但在 provider 来源认证、外部 WORM、合规认证、跨区域 HA、RTO/RPO 和第三方测试完成前，只能作为评估/候选，不应直接写入生产合规声明。

## 10. “大放异彩”的现实路径

项目不需要复制所有竞品，最有胜算的顺序是：

1. **守住差异化**：把“零密钥可试、确定性增强、真实调用显式、证据可复核”做成最短上手路径。
2. **补生产闭环**：把 Workforce 运行状态改成可重建/幂等重放并中央化证据，以进程/容器 sandbox 禁止绕开已覆盖 Provider/Git/shell/Webhook/MCP/OpenAPI/custom registry 的任意执行；再补远端可认证对账、provider-authenticated statement ingestion/持久历史/外部 WORM、真实 secret-manager/JWKS 轮换、真实 provider staging、24 小时 soak、DR 与独立渗透测试。
3. **建立可信对标**：固定硬件、固定模型、固定流量，公开与 LiteLLM/Portkey/Kong 等同场的延迟、错误率、资源、成本和治理功能矩阵。
4. **扩大生态而非堆宣传词**：每个主流 MCP/A2A/SDK 客户端取得一份可复现第三方报告；把 2,084 个“待人工证据”逐步转成真实认证。
5. **用真实采用证明领先**：安装成功率、7/30 日留存、活跃部署、外部贡献者、生产案例与问题响应时间，比 star 口号更能说明市场价值。

若完成第 2–5 项，本项目有机会成为“受治理智能体网关/本地 AI 控制面”的代表项目。若不完成，它仍会是技术内容丰富、工程纪律较强，但市场影响有限的 Public Preview。

## 11. 发布与推广决策

当前 PR #115：

- 源码和本报告已推送；已审运行时提交与 PR 历史一致，最终报告/CI 固定版本提交另行通过同一发布门；
- `quality`、scan、plugin scan、hardened multiarch container 均通过；
- PR 处于 open、mergeable 状态，尚无独立 review decision；
- 可进入维护者复核与下一版候选流程；
- **不能把“PR 全绿”写成“已合并、已发布、生产 GA 或行业领先”。**

截至 2026-08-25 已执行的推广闭环：

- GitHub 仓库描述已明确 `Public Preview`、协议优先、MCP/A2A/Gemini 与零密钥首跑；topics 移除容易造成竞品冒充印象的 `litellm`/过宽 `ai`，补 `a2a-protocol`/`gemini`；主页保持不变。
- 已原位更新 Discussions [#112](https://github.com/happy520ai/unified-ai-system/discussions/112)、[#1](https://github.com/happy520ai/unified-ai-system/discussions/1)、[#5](https://github.com/happy520ai/unified-ai-system/discussions/5)，而不是创建重复帖；三者均为 v0.5.0、12 tools、Public Preview，并移除“every feature”表述。
- Showcase [#20](https://github.com/happy520ai/unified-ai-system/issues/20) 与 good-first [#106](https://github.com/happy520ai/unified-ai-system/issues/106) 已同步到 v0.5.0/12 tools；受管理增长评论由 `growth:sync-thread` 更新，不新增状态噪音。
- 原 good-first [#107](https://github.com/happy520ai/unified-ai-system/issues/107)/[#108](https://github.com/happy520ai/unified-ai-system/issues/108) 的双语 signal 与 Unicode share 契约已在 `f1fe7b9d` 实现并绑定 PR `Closes`，移除 good-first/help-wanted 以免重复贡献；Helm [#113](https://github.com/happy520ai/unified-ai-system/issues/113) 已纠正为 gateway-only Phase 1，保留给主动联系的外部贡献者，未通过扩大仓库权限解决 GitHub 不可分配状态。
- 外部收录 PR [composio #206](https://github.com/composio-community/awesome-codex-skills/pull/206) 已推送 `20506f2`，OPEN/CLEAN/MERGEABLE；[awesome-mcp-servers #11745](https://github.com/punkpeye/awesome-mcp-servers/pull/11745) 已推送 `fc7c958`，OPEN/CLEAN/MERGEABLE 且 `check-submission` 通过；[Docker MCP Registry #4584](https://github.com/docker/mcp-registry/pull/4584) 已推送 `939ca58`，固定 v0.5.0 tag `fdfe2fc3` 并改为 12 tools，OPEN/MERGEABLE/REVIEW_REQUIRED，但本机缺 Go/Task、托管 validator 未运行，仍不能写成已收录。
- 冲突且只会把 0.4.5 升到过期 0.4.9 的 [awesome-codex-plugins #355](https://github.com/hashgraph-online/awesome-codex-plugins/pull/355) 已关闭；上游 `main` 已直接包含 v0.5.0/12 tools，因此关闭是去除回退风险，不是收录失败。
- [ToolSDK Registry #434](https://github.com/toolsdk-ai/toolsdk-mcp-registry/pull/434) 仍为 0.4.8/9 tools；其仓库 `AGENTS.md` 要求用户针对“修改该具体 PR”单独授权，总体推广授权未被扩张解释，因此本轮只读核验、没有修改。该项需要明确授权后再使用其可信 `main` validator 流程。
- 结构化反馈快照仍是 0 条社区报告、1 条维护者记录；因此外部 PR、clone、discussion 更新只能证明推广动作和发现面，不能证明真实用户转化或留存。

适合对外传播的诚实表述是：

> Unified AI System 是一个自托管、协议优先、零密钥可验证的 AI 网关与智能体控制面。它把确定性 prompt 增强、MCP/A2A、虚拟 key、预算、缓存、RAG、guardrails、审计、可观测性和真实 Provider 防重复外呼放进同一个受治理执行路径。当前发布为 Public Preview；生产推广仍需真实提供商、跨主机故障切换、长时负载和独立安全证据。

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
