# PME 移动地球操作手册

本文是 PME 移动地球当前交付态的中文操作文档。它面向日常使用者：你不需要先理解所有源码，只要按本文的命令顺序操作，就能启动、检查、使用 knowledge、验证向量链路，并在出问题时给出可复现的缺陷报告。

## 1. 项目当前状态总览

### 1.1 当前系统是什么

PME 移动地球是一个本地 AI Gateway + 聊天窗口 + 知识库系统。它把上层交互入口、AI Gateway 服务、共享 SDK、共享协议和知识库能力放在一个统一工程里：

- `apps/agent-console`：上层交互入口。它通过 shared SDK 调用 AI Gateway service。
- `apps/ai-gateway-service`：核心服务。它提供 `/chat`、健康检查、knowledge API、knowledge infra readiness 等能力。
- `packages/shared-sdk`：共享客户端。agent-console 使用它访问 service。
- `packages/shared-contracts`：共享协议与结果结构。knowledge retrieve/load/result 等结构在这里冻结。
- `packages/shared-config`、`packages/shared-utils`：通用配置和工具。

`legacy/` 只作为只读参考，不是正式运行目录。

### 1.2 当前能做什么

当前系统已经具备以下可用能力：

- 单命令 managed 启动：`cmd /c pnpm dev:phase7b`
- 单命令状态查看：`cmd /c pnpm status:phase10a`
- 单命令健康检查：`cmd /c pnpm health:phase12a`
- 单命令日志查看：`cmd /c pnpm logs:phase16a`
- 单命令自检：`cmd /c pnpm doctor:phase13a`
- 单命令重启：`cmd /c pnpm restart:phase11a`
- 单命令安全停止/归零：`cmd /c pnpm idle:phase15a`
- NVIDIA single-provider chat 主链验证：`cmd /c pnpm verify:phase7a`
- readiness/wait 编排验收：`cmd /c pnpm verify:phase8a-4`
- knowledge local-keyword 能力验收：`cmd /c pnpm verify:phase21`
- knowledge 检索质量与 infra base 验收：`cmd /c pnpm verify:phase22`
- 显式向量生产链路验收：`cmd /c pnpm verify:phase23`
- 交付说明和真实资料样例验收：`cmd /c pnpm verify:phase24`
- Web 可视化操作台验收：`cmd /c pnpm verify:phase25a`
- Chat-first Web 前台验收：`cmd /c pnpm verify:phase26a`
- Chat 命令中心验收：`cmd /c pnpm verify:phase76a`
- Chat 模型选择持久化验收：`cmd /c pnpm verify:phase76b`
- Chat 配置向导体验验收：`cmd /c pnpm verify:phase76c`
- Chat 配置生效状态验收：`cmd /c pnpm verify:phase76d`
- Chat 当前模型可用性检测验收：`cmd /c pnpm verify:phase76e`
- Chat 一键应用并检测模型验收：`cmd /c pnpm verify:phase76f`
- Chat 模型配置高级项折叠验收：`cmd /c pnpm verify:phase76g`
- Chat 输入区模型状态条验收：`cmd /c pnpm verify:phase76h`
- Chat 发送前智能提示验收：`cmd /c pnpm verify:phase76i`
- Chat 顶部模型选择弱化验收：`cmd /c pnpm verify:phase76j`
- Chat 输入区动作减负验收：`cmd /c pnpm verify:phase76k`
- Chat 资料入库回执验收：`cmd /c pnpm verify:phase76l`
- Chat 知识命中引用细节验收：`cmd /c pnpm verify:phase76m`
- 本地文件 + SQLite 知识持久化验收：`cmd /c pnpm verify:phase27`
- 文档当前功能打通验收：`cmd /c pnpm verify:phase28a`
- 体验能力总验收：`cmd /c pnpm verify:phase31a`

### 1.3 Phase 31A 已补齐的体验能力

Phase 31A 已把此前只作为边界项的若干能力做成了“最小真实可体验闭环”：

- 流式 ChatGPT 风格输出：`POST /chat/rag/stream`，Web 前台可实时显示分片回复。
- 多 provider 可见与选择：Web UI 可查看 provider；运行时可通过 provider 配置选择候选。
- fallback 真执行：`AI_GATEWAY_FALLBACK_ENABLED=true` 时，可重试失败会切到后备 provider；`verify:phase31a` 已验证。
- 运行 Dashboard：`GET /dashboard/status`。
- evaluation / scoring：`POST /evaluation/score`，当前是本地启发式评分，不是完整评测平台。
- 长期记忆：`POST /memory/save`、`GET /memory/list`、`POST /memory/retrieve`，底层复用 knowledge store。
- 外部连接器：当前支持“显式粘贴文本导入”的最小 connector，不做外部系统爬取或同步。
- auth / tenant：支持可选 token 与 tenant header，不是完整企业 IAM。
- GraphRAG：当前是基于检索结果的 query-time graph，不是完整图数据库/生产 GraphRAG。

验收命令：

```powershell
cmd /c pnpm verify:phase31a
```

### 1.4 当前仍不代表什么

当前交付态仍不代表以下企业级或无边界能力已经完成：

- DataEyes
- 企业级多 provider 管理平台
- 企业级 fallback 策略治理
- 完整 evaluation 平台
- 企业级 governance/dashboard
- production RAG 平台
- 完整生产 GraphRAG
- 完整 IAM/auth/tenant
- 外部系统爬取/同步 connector
- streaming 平台基础设施
- release automation

特别注意：knowledge 能力已经可用，但它没有混入默认 NVIDIA `/chat` 主链。默认 chat 仍是 NVIDIA single-provider。

### 1.5 为什么可以进入日常使用态

当前可进入日常使用态，是因为默认命令集已经冻结并经过真实回归，knowledge 也已经完成三层闭环：

- service 内部 knowledge API 可用。
- source/document load 可用。
- agent-console 可以通过 shared-sdk 调用 service 的 knowledge load/retrieve。

同时，Phase 23Z 已经在显式配置下通过真实 Gemini embedding + pgvector write/read/retrieve probe；Phase 24Z 已经验证最终交付说明和真实资料样例 load/retrieve。

日常使用时，你主要记住这条短链路即可：

```powershell
cmd /c pnpm dev:phase7b
cmd /c pnpm status:phase10a
cmd /c pnpm health:phase12a
cmd /c pnpm logs:phase16a
cmd /c pnpm idle:phase15a
cmd /c pnpm status:phase10a
```

## 2. 系统架构说明

### 2.1 `apps/agent-console`

`apps/agent-console` 是上层交互入口。它不再本地直连 provider，而是通过 `packages/shared-sdk` 调用 `apps/ai-gateway-service`。

当前它承担两类作用：

- 默认 chat 链路的上层调用入口。
- knowledge 链路的上层验证入口，例如 `verify:phase21c` 会证明 agent-console 可以通过 SDK 调用 service 的 `/knowledge/load` 和 `/knowledge/retrieve`。

### 2.2 `apps/ai-gateway-service`

`apps/ai-gateway-service` 是核心服务。当前主要提供：

- `GET /health`
- `GET /health/check`
- `POST /chat`
- `GET /knowledge/health`
- `GET /knowledge/sources`
- `GET /knowledge/infra/readiness`
- `POST /knowledge/load`
- `POST /knowledge/retrieve`

其中 `/chat` 仍走 NVIDIA single-provider 主链。knowledge API 是独立能力面，不会自动参与 chat 生成。

### 2.3 `packages/shared-sdk`

`packages/shared-sdk` 是上层调用 service 的统一客户端。当前已提供：

- `health()`
- `chat(...)`
- `chatStream(...)`
- `knowledgeLoad(...)`
- `knowledgeRetrieve(...)`
- `knowledgeInfraReadiness()`
- `generate(...)`

agent-console 的 knowledge 验证不是直接拼 HTTP，而是通过 shared-sdk 发起调用，这证明 knowledge 已经不是 service 内部孤立接口。

### 2.4 `packages/shared-contracts`

`packages/shared-contracts` 冻结 public protocol 类型。knowledge 相关结构包括：

- `KnowledgeLoadRequest`
- `KnowledgeLoadResponse`
- `KnowledgeRetrieveRequest`
- `KnowledgeRetrieveResponse`
- `KnowledgeChunk`
- `KnowledgeDocumentRef`
- `KnowledgeScoreBreakdown`
- `KnowledgeInfraReadinessResponse`

当前 retrieve result 的重点字段包括：

- `query`
- `normalizedQuery`
- `chunks`
- `topHit`
- `topChunk`
- `topDocument`
- `snippet`
- `highlights`
- `matchedTerms`
- `score`
- `scoreBreakdown`
- `document.metadata`

### 2.5 knowledge 模块

knowledge 模块当前有两条线：

- 默认线：`local-keyword`，直接可用，不需要外部数据库或 embedding；日常 managed 启动默认使用 `file-sqlite` 本地持久化，独立验收服务仍可使用 `in-memory`。
- 显式向量线：`vector / Gemini embedding / pgvector`，需要环境变量配置后才启用。

默认线支持 source/document load 和 keyword retrieve。它会做 query normalization、关键词匹配、字段加权、稳定排序、snippet、highlights、matchedTerms 和 scoreBreakdown。

向量线用于生产向量链路 readiness/probe。它不替代默认 local-keyword，也不会自动混入 chat。

### 2.6 NVIDIA single-provider chat 主链

当前默认 chat 主链是：

```text
agent-console
-> shared-sdk
-> ai-gateway-service
-> POST /chat
-> NVIDIA provider
```

这条链路的边界是 NVIDIA single-provider。它不代表多 provider、fallback、scoring/evaluation 或 governance 已完成。

### 2.7 knowledge 链路

当前 knowledge 链路是：

```text
agent-console
-> shared-sdk
-> ai-gateway-service
-> /knowledge/load 或 /knowledge/retrieve
-> structured knowledge result
```

knowledge result 是结构化结果，不是直接混入 `/chat` 的回答。调用方可以读取 `topHit`、`snippet`、`highlights`、`matchedTerms`、`scoreBreakdown`、`metadata` 等字段，再决定怎么使用。

## 3. 默认命令集完整说明

### 3.1 `cmd /c pnpm help:phase14a`

用途：显示当前默认命令总览和边界说明。

何时使用：

- 第一次进入项目时。
- 忘记命令名时。
- 想确认当前默认边界时。

预期结果：

- 打印 PME 移动地球 command overview。
- 列出 start、status、logs、idle、knowledge verify 等命令。
- 说明 chat 仍是 NVIDIA single-provider，knowledge 默认是 local keyword。

失败时怎么看：

- 如果提示脚本不存在，先看 `package.json` 是否完整。
- 如果 `pnpm` 不存在，先确认本机安装了 pnpm，且 Node 版本满足项目要求。

### 3.2 `cmd /c pnpm dev:phase7b`

用途：启动当前默认 managed 链路。

它会：

- 通过 Phase 9C wrapper 记录 PID 归属。
- 启动 `ai-gateway-service`。
- 等待 `/health/check` ready。
- 再启动/运行 `agent-console` startup request。
- 记录 managed state 和 logPath。

何时使用：

- 日常启动系统。
- 准备跑 status、health、logs、knowledge 验证前。

预期结果：

- 命令可能前台长运行，不返回是正常现象。
- 另开一个终端执行 `cmd /c pnpm status:phase10a`，应看到 running。

失败时怎么看：

- 如果 status 是 stopped，说明没有成功记录 managed 运行态。
- 如果 status 是 stale，说明 state 里记录过 PID，但对应进程已经不在。
- 如果出现 `NVIDIA_REQUEST_TIMEOUT`，它可能只是 provider 请求可重试超时。启动成功与真实 provider 响应验证是分开的；真实验证看 `health:phase12a`、`verify:phase7a`、`verify:phase8a-4`。

### 3.3 `cmd /c pnpm status:phase10a`

用途：只读查看 managed 启动状态。

何时使用：

- 启动后确认是否 running。
- idle 后确认是否 stopped。
- 排查 dev 是否真的起来。

预期结果：

- `running`：当前 managed PID 仍在。
- `stopped`：当前没有 managed 运行链路。
- `stale`：state 里有旧记录，但进程已不存在或归属不再有效。

失败时怎么看：

- status 命令本身不应改状态。
- 如果一直 stale，先执行 `cmd /c pnpm idle:phase15a` 归零，再重新启动。

### 3.4 `cmd /c pnpm health:phase12a`

用途：执行默认健康检查。

它是 `verify:phase7a-1` 的别名，复用 ai-gateway-service service-entry health 检查。

何时使用：

- 启动后确认 service 健康。
- 日常检查服务是否能正常响应。

预期结果：

- 返回成功。
- evidence 会证明 service entry 和 health 路径可用。

失败时怎么看：

- 如果服务没启动，先跑 `status:phase10a`。
- 如果服务启动但 health 失败，看 `logs:phase16a`。
- 如果涉及真实 provider 超时，不要直接判定启动失败，先区分 service health 和 provider response。

### 3.5 `cmd /c pnpm doctor:phase13a`

用途：只读自检。

它等价于：

```powershell
cmd /c pnpm status:phase10a
cmd /c pnpm -r --if-present check
```

何时使用：

- 想确认 managed 状态和工作区语法检查都没问题。
- 交付前做轻量自检。

预期结果：

- status 可读。
- workspace check 通过。

失败时怎么看：

- 如果 status 不符合预期，按 status 逻辑排查。
- 如果 check 失败，看具体 package 的 `node --check` 报错文件。

### 3.6 `cmd /c pnpm logs:phase16a`

用途：只读查看当前 managed 启动链路自己的日志。

何时使用：

- 启动后想看 service/console 输出。
- health 或 verify 失败后查看关键输出。

预期结果：

- 读取 Phase 9C managed state 中记录的 `logPath`。
- 只看归属日志，不扫描全盘、不读系统日志。

失败时怎么看：

- 如果提示无可归属输出，说明当前没有 managed state/logPath，或已经归零。
- 先跑 `status:phase10a` 确认状态。

### 3.7 `cmd /c pnpm restart:phase11a`

用途：安全重启当前 managed 链路。

它等价于：

```powershell
cmd /c pnpm stop:phase9c
cmd /c pnpm dev:phase7b
```

何时使用：

- 修改环境变量后需要重启。
- 当前运行态不干净，需要按归属 PID 停掉再启动。

预期结果：

- 先按 Phase 9C PID 归属停止。
- 再进入 `dev:phase7b` 的长运行启动流程。

失败时怎么看：

- 不要用广谱 taskkill 或端口强杀替代。
- 先看 `stop:phase9c` 是否能完成，再看 `dev:phase7b` 输出。

### 3.8 `cmd /c pnpm idle:phase15a`

用途：安全停止并归零到 stopped。

它等价于：

```powershell
cmd /c pnpm stop:phase9c
cmd /c pnpm status:phase10a
```

何时使用：

- 日常结束使用。
- 需要清理当前 managed 链路。
- 想确认最终状态回到 stopped。

预期结果：

- 停止当前 managed PID 归属链路。
- 最后 status 应显示 stopped。

失败时怎么看：

- 如果出现 stale，说明旧 state 和进程状态不一致。
- 不要扩大 stop 范围，不要用端口强杀作为默认口径。

### 3.9 `cmd /c pnpm stop:phase9c`

用途：只停止 Phase 9C managed 启动记录里的进程树。

何时使用：

- 只想停止，不需要自动 status 确认时。
- restart/idle 内部也复用它。

预期结果：

- 只停止 `dev:phase7b` 记录的归属 PID。
- 不杀无关进程。

失败时怎么看：

- 如果没有 managed state，可能提示没有可停止对象。
- 如果进程已消失，后续用 `status:phase10a` 确认。

### 3.10 `cmd /c pnpm verify:phase7a`

用途：默认 NVIDIA single-provider agent-console -> service 联调验收。

它会串联：

- `verify:phase7a-1`
- `verify:phase7a-2`
- `pnpm -r --if-present check`

何时使用：

- 想验证默认 chat 主链是否可用。
- 改动 service/console/shared-sdk 后做回归。

预期结果：

- service health ready。
- agent-console 通过 shared-sdk 调用 service。
- `/chat` 内部固定进入 NVIDIA single-provider 路径。

失败时怎么看：

- `NVIDIA_REQUEST_TIMEOUT` 表示真实 NVIDIA 请求超时，先看网络/provider/key/model。
- 不要把它理解成多 provider 或 fallback 问题。

### 3.11 `cmd /c pnpm verify:phase8a-4`

用途：默认 readiness/wait 编排验收。

它会：

- 启动 ai-gateway-service。
- 等待 service health ready。
- 运行 agent-console。
- 执行 `verify:phase7a`。
- 清理它自己启动的 service 进程。

何时使用：

- 想验证一键 readiness/wait 编排是否成立。
- 做默认命令集真实回归时。

预期结果：

- service ready 必须硬通过。
- 如果已经到真实 NVIDIA 请求阶段，仅因可重试 `NVIDIA_REQUEST_TIMEOUT` 失败，可记录 warning/soft-fail，不再把 readiness/wait 判死。
- 其他失败仍是硬失败。

### 3.12 `cmd /c pnpm verify:phase21`

用途：knowledge 当前可用态聚合验收。

它纯串联：

- `verify:phase21a`
- `verify:phase21b`
- `verify:phase21c`

何时使用：

- 想快速确认 knowledge 基础链路完整。
- 改动 knowledge API、shared-sdk、agent-console knowledge verifier 后。

预期结果：

- knowledge health/sources/retrieve 可用。
- source/document load 可用。
- agent-console -> shared-sdk -> service knowledge chain 可用。

### 3.13 `cmd /c pnpm verify:phase22`

用途：knowledge 检索质量 + next-gen infra base 验收。

它会先跑 Phase 21 聚合，再验证：

- query normalization
- weighted keyword ranking
- topHit/topChunk/topDocument
- snippet/highlights/matchedTerms
- scoreBreakdown
- metadata
- off-by-default infra readiness
- embedding provider interface 和 vector store interface 诊断

何时使用：

- 想确认默认 local-keyword 结果质量结构是否完整。
- 想确认 vector infra base 没破坏默认模式。

预期结果：

- 默认 mode 仍是 local-keyword。
- infra 默认 disabled/not-configured，不影响 keyword retrieval。

### 3.14 `cmd /c pnpm verify:phase23`

用途：Phase 23Z knowledge production-readiness gate。

它会先跑 Phase 22 聚合，再验证：

- keyword quality v2。
- 显式 vector mode 下的真实 embedding + pgvector write/read/retrieve probe。

何时使用：

- 已配置 Gemini embedding 和 Supabase pgvector pooler URI 后。
- 想证明真实向量生产链路是否接通。

预期结果：

- 未配置 vector 时：默认 local-keyword 仍可用，但 production vector deliverable 不能声称完成。
- 显式配置并通过时：evidence 中应出现 vector ready、provider/model、dimension、top document、similarity、write/read/retrieve completed。

失败时怎么看：

- 如果 embedding key/model 缺失，看环境变量。
- 如果 pgvector 连接失败，优先检查是否使用 Supabase pooler URI。
- 如果 probe 没有 top document，说明向量写入或检索链路没有形成可复核结果。

### 3.15 `cmd /c pnpm verify:phase24`

用途：最终交付说明 + 真实资料样例 load/retrieve 验收。

它会：

- 检查 `docs/DELIVERY_GUIDE.md` 存在。
- 读取 `apps/ai-gateway-service/knowledge-samples/real-usage-sample.md`。
- 通过 `/knowledge/load` 装载 3 个真实风格 document。
- 通过 `/knowledge/retrieve` 检索。
- 验证 topHit、snippet、highlights、matchedTerms、scoreBreakdown、metadata。
- 如果 vector env 已显式配置，则对同一批样例补跑 Gemini embedding + pgvector probe。

何时使用：

- 交付前验证使用手册、真实资料样例和 knowledge 检索是否仍闭环。
- 想确认 local-keyword 和显式 vector path 是否同时保持可用。

预期结果：

- local keyword ready 为 true。
- topHit 为 `phase-24-delivery-operations`。
- vector active 时 vector ready 为 true。

### 3.16 `cmd /c pnpm verify:phase28a`

用途：验证本文档当前声明的“已可用功能”是否真的被服务、UI、知识导入、知识检索和文档口径连起来。

它会验证：

- README / AGENTS / DELIVERY_GUIDE / OPERATION_MANUAL 中有当前核心命令和边界标记。
- `/ui` 能打开，并且显示 Chat-first、PME 移动地球、本地持久化、文件导入等当前口径。
- `/health/check`、`/knowledge/health`、`/knowledge/file-types` 可用。
- `POST /knowledge/load/file` 能装入一个文档。
- `POST /knowledge/retrieve` 能命中新装入的文档。
- 页面不再出现“重启后临时导入会清空”这类过期口径。

它不会验证 DataEyes、多 provider、fallback、GraphRAG、长期记忆、external connector、streaming 或 release automation，因为这些在本文中是边界项，不是当前已完成能力。

## 4. 日常使用流程

最推荐的日常顺序如下：

```powershell
cmd /c pnpm dev:phase7b
cmd /c pnpm status:phase10a
cmd /c pnpm health:phase12a
cmd /c pnpm logs:phase16a
cmd /c pnpm idle:phase15a
cmd /c pnpm status:phase10a
```

### 4.1 启动

运行：

```powershell
cmd /c pnpm dev:phase7b
```

这个命令是长运行入口。不返回不代表卡死。它负责启动 service 并让 console 在 service ready 后进入启动请求阶段。

### 4.2 查看状态

另开一个终端运行：

```powershell
cmd /c pnpm status:phase10a
```

看到 `running` 表示 managed 链路已经起来。

### 4.3 健康检查

运行：

```powershell
cmd /c pnpm health:phase12a
```

它复用 service-entry health 检查。通过后说明 service 基础健康路径可用。

### 4.4 查看日志

运行：

```powershell
cmd /c pnpm logs:phase16a
```

它只读当前 managed state 记录的 logPath，不会扫描全盘。

### 4.5 停止归零

运行：

```powershell
cmd /c pnpm idle:phase15a
```

它会先按归属 PID 停止，再输出 status。

### 4.6 最终确认 stopped

运行：

```powershell
cmd /c pnpm status:phase10a
```

最后应确认回到 `stopped`。

## 5. 知识库使用说明

### 5.1 默认模式

默认知识模式是：

- `mode: local-keyword`
- `storage: file-sqlite`（通过 `cmd /c pnpm dev:phase7b` 日常启动时）
- `storage: in-memory`（独立验收服务或未启用持久化时）
- `embedding: not-configured`
- `retrieveMode: keyword`

这意味着默认使用本地关键词检索，不需要外部 embedding、向量数据库或 pgvector。日常启动会把导入资料写入 `.data/knowledge` 下的本地 JSON 和 SQLite；独立验收服务为了隔离测试，仍可能显示 `in-memory`。

### 5.2 Knowledge API

当前 service 暴露这些 knowledge API：

- `GET /knowledge/health`
- `GET /knowledge/sources`
- `GET /knowledge/infra/readiness`
- `GET /knowledge/file-types`
- `POST /knowledge/load`
- `POST /knowledge/load/file`
- `POST /knowledge/retrieve`

### 5.3 `/knowledge/health`

作用：查看 knowledge 当前模式和基本状态。

典型信息：

- mode
- storage
- embedding
- sourceCount
- documentCount
- supportedModes
- quality
- persistence

如果日常启动后显示 `local-keyword`、`file-sqlite`、`not-configured`，这是默认正常状态；如果独立验收服务显示 `in-memory`，也属于隔离验证的正常状态。

### 5.4 `/knowledge/sources`

作用：列出当前内存里已加载的 source 和 document。

它可以帮助你确认：

- sourceId 是否存在。
- documentCount 是否增加。
- documentId/title/metadata 是否被记录。

### 5.5 `/knowledge/load`

作用：把结构化文本资料装入当前 knowledge 服务。

最小结构：

```json
{
  "sourceId": "my-local-source",
  "sourceTitle": "My Local Source",
  "metadata": {
    "sourceType": "manual-load"
  },
  "documents": [
    {
      "documentId": "doc-001",
      "title": "Example Document",
      "content": "这里是要检索的正文内容。",
      "metadata": {
        "topic": "example"
      }
    }
  ]
}
```

注意：

- 通过 `cmd /c pnpm dev:phase7b` 日常启动时，导入内容会写入本地 JSON + SQLite，服务重启或电脑重启后仍可恢复。
- 独立验收服务可能使用 in-memory，退出后不会保留临时测试资料。
- 当前不是完整 ingestion pipeline。
- 当前不做外部 connector。

### 5.5.1 `/knowledge/load/file`

作用：把浏览器上传的文件解析成 knowledge document，再装入当前 knowledge 服务。

当前支持：

- 文本类：`.txt`、`.md`、`.json`、`.csv`、`.log`、`.html`、`.xml`、`.yaml`、`.yml`
- PDF：`.pdf`
- Word：`.docx`
- Excel：`.xls`、`.xlsx`

当前限制：

- 单个文件最大 100MB。
- 旧版二进制 Word `.doc` 暂不支持。
- 这是最小文件解析入口，不是完整外部 connector 或复杂 ingestion pipeline。

### 5.6 `/knowledge/retrieve`

作用：按关键词检索已加载文档。

最小结构：

```json
{
  "query": "phase24 delivery operations health logs",
  "mode": "keyword",
  "sourceIds": ["phase-24-real-usage-source"],
  "topK": 3
}
```

返回重点字段：

- `topHit`：当前排序第一的命中 chunk。
- `topChunk`：当前最推荐 chunk，当前等价于 topHit。
- `topDocument`：当前最推荐 document。
- `snippet`：围绕命中词生成的片段。
- `highlights`：命中词在文本中的位置。
- `matchedTerms`：命中的 query terms。
- `score`：总分。
- `scoreBreakdown`：termCoverage、titleCoverage、bodyCoverage、phraseMatch、exactMatch 等分项。
- `document.metadata`：文档 metadata。

### 5.7 `verify:phase21` / `verify:phase22` / `verify:phase24` 分别验证什么

`cmd /c pnpm verify:phase21`：

- 验证 knowledge health/sources/retrieve。
- 验证 source/document load。
- 验证 agent-console 通过 shared-sdk 调 knowledge。

`cmd /c pnpm verify:phase22`：

- 在 Phase 21 基础上验证检索质量结构。
- 验证 normalizedQuery、weighted ranking、topHit、snippet、highlights、matchedTerms、scoreBreakdown。
- 验证 off-by-default infra readiness。

`cmd /c pnpm verify:phase24`：

- 验证交付说明存在。
- 加载真实风格样例资料。
- 检索并确认 topHit、snippet、highlights、matchedTerms、scoreBreakdown、metadata。
- 如果 vector env 已配置，还会验证同一批样例的向量 probe。

### 5.8 如何导入真实资料

当前推荐做法是先用现有 `/knowledge/load` 或 shared-sdk `knowledgeLoad` 装入小批量文档。

每个 document 至少包含：

- `sourceId`
- `documentId`
- `title`
- `content` 或 `text`
- `metadata`

建议从小集合开始，例如 2-3 个 document。确认 `/knowledge/sources` 看到 source 后，再用 `/knowledge/retrieve` 检索。

### 5.9 如何判断检索结果是否好

优先看这几个字段：

- `topHit.document.documentId` 是否是你预期文档。
- `snippet` 是否包含关键上下文。
- `highlights` 是否覆盖关键命中词。
- `matchedTerms` 是否包含你 query 里的核心词。
- `scoreBreakdown.matchedTermCount` 是否足够高。
- `scoreBreakdown.titleCoverage` / `bodyCoverage` 是否符合直觉。
- `document.metadata` 是否能帮助你判断来源。

不要只看 `chunks.length`。真正有价值的是 topHit 是否稳定、snippet 是否可读、scoreBreakdown 是否能解释为什么排第一。

### 5.10 当前真实资料样例

Phase 24Z 当前样例文件：

```text
apps/ai-gateway-service/knowledge-samples/real-usage-sample.md
```

它会被拆成 3 个真实风格 document：

- `phase-24-delivery-operations`
- `phase-24-knowledge-default-mode`
- `phase-24-vector-production-mode`

Phase 24 的 query：

```text
phase24 delivery operations help status health logs idle command
```

预期 topHit：

```text
phase-24-delivery-operations
```

## 5.11 Web 可视化操作台

Phase 25A 增加了最小 Web 可视化操作台。默认 service 运行后访问：

```text
http://127.0.0.1:3100/ui
```

等价别名：

```text
http://127.0.0.1:3100/console
```

它支持：

- 检查 service health。
- 检查 knowledge health。
- 查看 knowledge sources。
- 在聊天窗口直接拖入 PDF / Word / Excel / 文本文件并装入 knowledge。
- 在高级工具中手动装载一个本地 knowledge document。
- 输入 query 调用 `/knowledge/retrieve`。
- 展示 `topHit`、`snippet`、`highlights`、`matchedTerms`、`scoreBreakdown`、`metadata`。
- 查看 vector readiness。
- 展示默认命令提示。

它只是操作层 UI，只调用现有 HTTP API：

- 不改 `/chat`。
- 不改变 NVIDIA single-provider chat 主链。
- 不改变 knowledge 默认 `local-keyword` 检索模式；日常启动仍使用本地持久化保存导入资料。
- Web UI 会在发送聊天前自动检索本地知识并把少量命中片段作为 prompt 上下文传给 `/chat`，但不会改变 service `/chat` contract 或 NVIDIA provider lane。
- 聊天输入框也可以识别“配置模型”“服务状态”“健康检查”“知识库状态”等本地指令，并在聊天窗口内展示命令卡片；这些卡片只调用现有安全 API，不保存 API Key，也不改变默认 `/chat` 主链。
- “配置模型”卡片可以把 provider/model 选择记住在当前浏览器里，刷新后自动恢复；API Key 草稿不会保存，启动配置模板会使用占位符而不是回显真实密钥。
- 不新增外部 connector、GraphRAG、长期记忆或权限系统。

## 6. 向量库 / pgvector 使用说明

### 6.1 vector/pgvector 不是默认模式

默认 knowledge 模式永远先保持：

```text
local-keyword
```

vector/pgvector 是显式配置后启用的生产向量链路。它不会自动影响默认 keyword 检索，也不会混入 NVIDIA `/chat`。

### 6.2 Gemini embedding + Supabase pgvector 的用途

显式向量链路用于验证：

- 文档可以被真实 embedding provider 向量化。
- 向量可以写入 pgvector。
- 可以从 pgvector 读回。
- 可以基于 query embedding 做 vector retrieve。
- top document 和 similarity 可复核。

Phase 23Z 已经证明：在显式配置 Gemini embedding + Supabase pgvector pooler URI 后，真实 write/read/retrieve probe 可以通过。

### 6.3 必要环境变量

运行 `cmd /c pnpm verify:phase23` 的真实向量链路前，需要在当前 PowerShell 设置：

```powershell
$env:KNOWLEDGE_INFRA_MODE='vector'
$env:KNOWLEDGE_EMBEDDING_PROVIDER='gemini'
$env:KNOWLEDGE_EMBEDDING_MODEL='gemini-embedding-001'
$env:KNOWLEDGE_EMBEDDING_API_KEY='<your-gemini-api-key>'
$env:KNOWLEDGE_VECTOR_STORE='pgvector'
$env:PGVECTOR_CONNECTION_STRING='<your-supabase-pooler-uri>'
$env:PGVECTOR_TABLE='knowledge_chunks'
$env:KNOWLEDGE_VECTOR_NAMESPACE='default'
cmd /c pnpm verify:phase23
```

不要把 API key、数据库密码、完整连接串贴到公开聊天、提交到 git，或写入文档。

### 6.4 Supabase 连接注意事项

不要使用 Supabase direct host：

```text
db.<project>.supabase.co:5432
```

当前环境已确认 direct host 不可达。必须使用 Supabase Dashboard 里的 pooler URI。

通常形式：

```text
postgresql://postgres.<project-ref>:<password>@aws-0-xxx.pooler.supabase.com:6543/postgres
```

实际区域可能不是 `aws-0-xxx`，以 Supabase Dashboard 的 Connect -> Connection pooling 页面复制出来的 URI 为准。

### 6.5 `verify:phase23` 的作用

`verify:phase23` 是生产向量 readiness gate。它不是普通 smoke，也不是只看 env 是否存在。

它要确认：

- Phase 22 keyword quality 仍通过。
- vector mode 已显式启用。
- embedding provider 已配置。
- pgvector store 已配置。
- 真实 embedding 调用成功。
- pgvector 写入成功。
- pgvector 读取成功。
- vector retrieve 能返回预期 top document。

### 6.6 如何判断 vector/pgvector 真的通过

看 Phase 23 evidence：

```text
apps/ai-gateway-service/evidence/phase-23-knowledge-production-readiness.md
```

关键字段应包含：

- `Vector production ready: true`
- `Vector mode: vector`
- `Vector status: ready`
- `Embedding status: configured`
- `Vector store status: configured`
- `pgvector status: configured`
- `Probe provider: gemini`
- `Probe model: gemini-embedding-001`
- `Probe dimension: 3072`
- `Probe top document: ...`
- `Probe top similarity: ...`
- `Probe write/read/retrieve completed: true`
- `Blockers: none`

如果这些不成立，就不能声称真实向量生产链路已通过。

### 6.7 未配置 vector 时会怎样

未设置 vector env 时：

- local-keyword 仍可正常使用。
- `/knowledge/infra/readiness` 会显示 disabled 或 not-configured。
- `verify:phase21`、`verify:phase22`、`verify:phase24` 的 local 部分仍可验证。
- 不能声称 real vector production deliverable 已完成。

## 7. 验收与证据文件说明

### 7.1 Phase 21A evidence

路径：

```text
apps/ai-gateway-service/evidence/phase-21a-knowledge-entry.md
```

证明：

- `GET /knowledge/health` 可用。
- `GET /knowledge/sources` 可用。
- `POST /knowledge/retrieve` 可用。
- 默认 mode 是 local-keyword。
- 默认 storage 是 in-memory。
- embedding 是 not-configured。
- 默认内置 operating knowledge 可以被检索。

### 7.2 Phase 21B evidence

路径：

```text
apps/ai-gateway-service/evidence/phase-21b-knowledge-source-load.md
```

证明：

- `POST /knowledge/load` 可用。
- 本地 source/document 可以装入。
- `/knowledge/sources` 能看到新 source。
- `/knowledge/retrieve` 能命中新装入的 document。

### 7.3 Phase 21C evidence

路径：

```text
apps/agent-console/evidence/phase-21c-console-knowledge-chain.md
```

证明：

- agent-console 可以通过 shared-sdk 调用 service 的 knowledge load/retrieve。
- knowledge 不只是 service 内部接口，上层入口也能用。
- 仍然不混入默认 `/chat`。

### 7.4 Phase 22 evidence

路径：

```text
apps/ai-gateway-service/evidence/phase-22-knowledge-quality-infra.md
```

证明：

- keyword retrieval 质量结构已增强。
- normalized query、weighted ranking、topHit、snippet、highlights、matchedTerms、scoreBreakdown 可用。
- next-gen infra base 有 readiness diagnostic。
- 默认 infra 是 disabled，不影响 local-keyword。

### 7.5 Phase 23 evidence

路径：

```text
apps/ai-gateway-service/evidence/phase-23-knowledge-production-readiness.md
```

证明：

- keyword quality v2 仍通过。
- 在显式 vector 配置下，Gemini embedding + pgvector write/read/retrieve probe 通过。
- 真实向量链路具备可复核 top document 和 similarity。

### 7.6 Phase 24 evidence

路径：

```text
apps/ai-gateway-service/evidence/phase-24-delivery-knowledge.md
```

证明：

- 交付说明存在。
- 真实风格样例资料被装入。
- local-keyword retrieve 命中预期 topHit。
- 返回了 snippet、highlights、matchedTerms、scoreBreakdown、metadata。
- 如果 vector env 启用，同一批样例也通过 vector probe。

## 8. 常见问题与排查

### 8.1 `dev:phase7b` 长运行不返回是不是正常

正常。`dev:phase7b` 是默认启动入口，会让 managed 链路在前台运行。

正确做法是另开终端运行：

```powershell
cmd /c pnpm status:phase10a
```

看到 running 就说明链路已经起来。

### 8.2 status 的 running / stopped / stale 怎么理解

- `running`：当前 managed owner PID 还活着。
- `stopped`：没有当前 managed 运行链路。
- `stale`：state 里有旧 PID，但进程已不存在或归属不再有效。

stale 时先用：

```powershell
cmd /c pnpm idle:phase15a
cmd /c pnpm status:phase10a
```

不要直接用端口强杀或模糊进程名强杀。

### 8.3 `NVIDIA_REQUEST_TIMEOUT` 怎么理解

`NVIDIA_REQUEST_TIMEOUT` 表示真实 NVIDIA provider 请求超时。

它不等于 service 没启动，也不等于 managed start 一定失败。当前系统已经把“启动成功判定”和“一次 provider 响应是否成功”做了边界切分。

处理顺序：

1. 先看 `status:phase10a` 是否 running。
2. 再看 `health:phase12a`。
3. 再看 `logs:phase16a`。
4. 如果只是真实 NVIDIA 请求超时，检查网络、API key、模型名和 provider 可用性。

### 8.4 logs 没内容怎么办

`logs:phase16a` 只读 managed state 里的 `logPath`。

如果没有内容，可能是：

- 当前还没有通过 `dev:phase7b` 启动。
- 已经 `idle:phase15a` 归零。
- state 没有记录可归属 logPath。

先跑：

```powershell
cmd /c pnpm status:phase10a
```

确认状态后再判断。

### 8.5 health 失败怎么办

先确认是否启动：

```powershell
cmd /c pnpm status:phase10a
```

如果不是 running，先启动：

```powershell
cmd /c pnpm dev:phase7b
```

如果 running 但 health 失败，查看日志：

```powershell
cmd /c pnpm logs:phase16a
```

再根据错误判断是 service entry、provider、环境变量还是网络问题。

### 8.6 `verify:phase23` 失败怎么办

先分清是哪一类失败：

- 缺 env：检查 `KNOWLEDGE_INFRA_MODE`、embedding provider/model/key、`KNOWLEDGE_VECTOR_STORE`、`PGVECTOR_CONNECTION_STRING`。
- embedding 失败：检查 Gemini key、模型名、额度、网络。
- pgvector 失败：检查 Supabase pooler URI、密码、表名、连接权限。
- retrieve 没命中：看 top document、similarity、hitOrder 和 expected document。

如果没有真实 embedding + pgvector write/read/retrieve completed，就不能声称 Phase 23 生产向量交付成立。

### 8.7 Supabase 连接失败怎么办

优先检查是否误用了 direct host：

```text
db.<project>.supabase.co:5432
```

当前环境已确认 direct host 不可达。请到 Supabase Dashboard 的 Connect -> Connection pooling 复制 pooler URI。

pooler URI 通常类似：

```text
postgresql://postgres.<project-ref>:<password>@aws-0-xxx.pooler.supabase.com:6543/postgres
```

不要把真实密码贴到聊天或提交到仓库。

### 8.8 API key / password 不要贴给别人

不要把以下内容写入 README、AGENTS、docs、evidence 或 git commit：

- NVIDIA API key
- Gemini API key
- Supabase password
- 完整 `PGVECTOR_CONNECTION_STRING`
- 任何 provider token

如果必须交流，使用占位符：

```text
<your-api-key>
<your-supabase-pooler-uri>
<password>
```

### 8.9 pnpm 在 sandbox 里 EPERM 怎么处理

如果在受限 sandbox 或被占用的 Windows 目录里遇到 `EPERM`：

1. 先停止当前 managed 链路：

   ```powershell
   cmd /c pnpm idle:phase15a
   ```

2. 关闭可能占用文件的终端或编辑器任务。
3. 在普通 PowerShell 里重试同一条命令。
4. 不要用广谱删除、不要重置仓库、不要删除 `node_modules`，除非已经明确确认这是唯一问题且有备份/可恢复方案。

如果是在 Codex 沙箱里运行网络或外部连接命令失败，优先判断是否需要用户批准外部访问，而不是改业务代码。

## 9. 安全边界

当前系统已经具备 Phase 31A 的最小真实体验闭环：流式输出、多 provider 可见与选择、可重试 fallback 真执行、dashboard、启发式 scoring、knowledge-backed 长期记忆、显式文本 connector、可选 auth/tenant header、query-time graph retrieval，以及安全本地 workflow。

当前系统仍不代表以下企业级或无边界能力完成：

- DataEyes
- 企业级多 provider 管理平台
- 企业级 fallback 策略治理
- 完整 evaluation 平台
- 企业级 governance/dashboard
- production RAG
- 完整生产 GraphRAG
- 完整 IAM/auth/tenant
- 外部系统爬取/同步 connector
- streaming 平台基础设施
- release automation

当前冻结边界：

- `/chat`：NVIDIA single-provider。
- knowledge 默认：local-keyword；日常 managed 启动默认 file-sqlite 本地持久化，独立验收服务可使用 in-memory。
- vector/pgvector：显式配置后才启用。
- Web UI 可自动检索 knowledge 并把命中片段作为 prompt 上下文传给 `/chat`；service `/chat` contract 和 NVIDIA single-provider 主链不变。
- `legacy/` 只读参考。

## 10. 缺陷上报模板

出问题时，不要只说“有问题”。请按这个模板提供一个具体问题：

```text
复现命令：
实际失败：
期望表现：
唯一失败点：
关键输出：
```

示例：

```text
复现命令：cmd /c pnpm health:phase12a
实际失败：health 检查超时退出
期望表现：应返回成功并显示 service health ready
唯一失败点：ai-gateway-service health check 未返回 ready
关键输出：粘贴关键错误，不要粘贴 API key 或数据库密码
```

一次只报一个问题。不要把多个不相关问题混在一起。

## 11. 最终交付结论

### 11.0 Phase 27 知识持久化补充

从 Phase 27 开始，默认日常启动入口 `cmd /c pnpm dev:phase7b` 会默认设置：

```powershell
KNOWLEDGE_STORAGE_MODE=file-sqlite
KNOWLEDGE_PERSISTENCE_DIR=.data/knowledge
```

这表示通过 Web 聊天窗口、文件拖拽或 `/knowledge/load` 导入的知识，会同时写入：

- `.data/knowledge/knowledge-documents.json`
- `.data/knowledge/knowledge-documents.sqlite`

所以在默认 managed 启动方式下，服务重启或电脑关机再打开后，之前导入的本地知识不会因为进程结束而消失。`cmd /c pnpm verify:phase27` 用来验证“导入 -> 写入本地文件和 SQLite -> 重新创建服务 -> 再次检索命中”这条闭环。

需要注意：local-keyword 仍然是默认检索模式；SQLite 和本地文件解决的是本地持久化，pgvector/Supabase 仍然是显式配置后启用的向量链路，并通过 `cmd /c pnpm verify:phase23` 验证。

当前 PME 移动地球已可进入交付 / 日常使用态。

正式口径：

- 默认命令集已冻结，可按本文执行日常启动、状态、健康、日志、停止、验收。
- 默认 NVIDIA single-provider Gateway 主链可用。
- knowledge local-keyword 可用；独立验收仍可用 in-memory，默认 managed 启动使用 file-sqlite 持久化，支持 source/document load 与 retrieve。
- agent-console 已能通过 shared-sdk 调 service 的 knowledge load/retrieve。
- keyword retrieve 已具备 normalized query、weighted ranking、topHit/topChunk/topDocument、snippet、highlights、matchedTerms、scoreBreakdown 和 metadata。
- vector/pgvector 在显式配置 Gemini embedding 和 Supabase pooler URI 后可验证，Phase 23Z 已通过真实 write/read/retrieve probe。
- Phase 24Z 已完成最终交付说明与真实资料样例 load/retrieve 验证。

后续推进规则：

- 日常使用按默认命令集执行。
- 出问题按缺陷模板报一个具体问题。
- 新能力必须显式开新主线。
- 不因为一个缺陷顺手扩 DataEyes、多 provider、fallback、GraphRAG、长期记忆、governance 或 release automation。
