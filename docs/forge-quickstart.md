# Forge Vision Quickstart(设想族群点亮指南)

业主勾选"除 E 外全部接入"后,forge-core / taiji / workforce / three-mode 的
核心能力通过受治理端点点亮。所有端点走既有权限/预算/审计;forge 的 LLM
调用一律经网关 provider lane(fake 默认,真实需三道门),不旁路治理。

## 端点一览

| 端点 | 能力(族群) | 权限 |
| --- | --- | --- |
| `POST /forge/polish` | 迭代精修代码草稿(B) | chat:use |
| `POST /forge/quality` | 质量门评估代码(B) | workflow:run |
| `POST /forge/memory` `{action:"remember"\|"recall"}` | 工作记忆+语义记忆(C) | chat:use |
| `GET /forge/memory/stats` | 记忆统计(C) | dashboard:read |
| `POST /forge/orchestrate` | 目标编排(compile→run)(A+G,LLM 经当前网关) | workflow:run |
| `GET /forge/runs` | 编排运行列表(G) | workflow:run |
| `GET /forge/status` | 引擎状态与惰性加载报告(F) | dashboard:read |
| `GET /forge/consensus` | 共识引擎状态(A) | dashboard:read |
| `POST /taiji/compile` | 能力规格→免疫风险分类→清单草稿(H) | workflow:run |
| `POST /workforce/preview` | 多角色干跑预览(H) | workflow:run |
| `POST /three-mode/execute` | normal/god/tianshu 三模式真执行(H) | workflow:run |

## 命令行操作

受治理文字转语音使用同一编排端点，完整配置、审批和本地 WAV 保存流程见
[受治理语音产物](governed-media-tasks.md)。

CLI 通过共享 SDK 调用现有网关。需要鉴权时，通过 `AGENT_CONSOLE_ADMIN_KEY` 提供具有对应权限的
网关 Key；不要把凭据放进输入文件。`--json` 返回结构化结果，普通输出提供摘要和下一步。
`knowledge load`、`forge polish/memory/orchestrate` 默认只显示本地请求预览，确认后用同一命令加
`--yes` 才发送。预览中的请求摘要用于比对输入，不是服务端审批凭证。

```bash
uai knowledge health
uai knowledge sources --limit 20
uai knowledge load --input documents.json
uai knowledge load --input documents.json --yes
uai knowledge retrieve "启动方法" --source-id manual --limit 5
uai routing modes
uai routing preview "整理当前本地证据" --mode answer-path
uai routing preview "评估复杂编码任务" --mode quality-cost
uai forge status
uai forge runs
uai forge polish "export const add=(a,b)=>a+b"
uai forge polish "export const add=(a,b)=>a+b" --yes --passes 1
uai forge quality "export const add=(a,b)=>a+b"
uai forge memory "记住:网关默认 fake lane" --yes
uai forge recall "fake lane"
uai forge taiji "生成内部报表,读取数据库"
uai forge workforce "为网关设计 UX 修复计划"
```

`documents.json` 使用现有知识导入合同，例如：

```json
{
  "sourceId": "manual",
  "sourceTitle": "操作手册",
  "documents": [
    { "documentId": "startup", "title": "启动", "content": "先检查网关状态，再发起任务。" }
  ]
}
```

输入文件须为稳定的单一普通 JSON 文件，大小不超过 1 MiB；链接、凭据配置文件、明显凭据内容、
控制字符及不符合操作合同的数据会在请求前拒绝。导入按现有 `sourceId/documentId` 语义新增或更新；
建议给文档明确 ID。成功回执提供实际文档计数与引用，之后用 `sources` 和 `retrieve` 核对。
`health` 会显示实际存储模式，导入成功不意味着启用了持久化存储。

知识查询默认 `keyword`。显式 `--mode vector` 还需要 `--allow-real-provider`，因为所配置的嵌入服务
可能产生外部调用；服务端的可用性和治理限制仍会独立检查。`routing preview` 只执行本地路由模拟，
不调用模型、不改变实际路由配置；带 `--input` 时文件中的状态是模拟假设，不能当作实时验收证据。
`/route` 是实际生成端点，CLI 的路由预览不会调用它。

Forge 的模型操作默认明确选择 `local-fake-provider/local-fake-model`。真实或其他 Provider 选择需
显式指定 `--provider-id`、`--model-id` 和 `--allow-real-provider`；仅开启该标志而不指定二者时，
使用网关配置的选择策略。明确指定的模型会在每一次实际调用中保持绑定，并禁止加权分流或影子副本
改变该选择。JSON 标志本身不能伪造内部执行限制。真实调用仍需服务端配置、权限和预算允许。

以下 token 设置适用于 Forge 的文本模型任务；语音任务使用已批准的文字、音频和时间限额。
CLI 每次文本模型请求默认上限为 4096 输出 tokens，可用 `--max-output-tokens` 设置 1–16384；服务端的
成本限制继续生效，较大参数仍可能被拒绝。网页任务还受自身最多 512 输出 tokens 的限制。
`--passes` 限制精修轮数，后续轮可能包含评审及改进两个模型请求；模型错误或空回复会使操作失败，
不会被当作成功草稿继续发起模型请求。精修结果显示质量分数和是否达到目标；质量分数是静态评估，
不代替项目测试。Forge 的模型操作默认客户端等待 245 秒，可用 `--timeout` 覆盖（上限 300 秒）；
服务端仍可按自己的期限提前停止。

运行非语音的受治理 Forge 任务，把目标、根 Agent 和可选网页参数保存为 `forge-request.json`。
语音使用下节带 `--audio-output` 的专门命令；同一请求不能同时包含网页和语音任务。

```bash
uai forge orchestrate --input forge-request.json
uai forge orchestrate --input forge-request.json --yes
uai agents approvals --agent-id agt_your_approved_root --json
uai agents approve --approval-id apr_from_gateway --yes
uai forge orchestrate --input forge-request.json --yes
```

命令不会自动批准服务端请求。审批显示完整目标、模型选择、适用限额和网页／语音 profile；
语音审阅还包含完整原文、UTF-8 字节数及哈希。
选项与目标摘要不一致时不会把它显示为完整审阅。更改模型、目标或配置需要匹配的新审批。
退出码：`0` 表示操作或本地预览成功，`3` 表示等待审批，`2` 表示输入错误，`1` 表示失败或结果未知。
`status` 字段进一步区分 `preview`、`completed`、`approval_required` 和失败，脚本不能只凭退出码把
预览当作执行。未知的导入或模型结果不会自动重发；按返回的运行 ID、知识来源或审批记录先核对。

`forge quality` 是静态代码检查；`forge taiji` 只生成能力草案，`workforce` 只生成本地分工预览，均不调用模型或激活能力。
`memory/recall` 操作当前 Forge 会话内存，不承诺重启持久化。

太极的实际候选评估、激活、执行、反馈修复及撤销使用独立的 `uai taiji` 命令族，参见[太极能力运行手册](./taiji-capabilities.md)。

## 受治理语音的命令行入口

管理员先按[受治理语音产物](governed-media-tasks.md)配置 `AI_GATEWAY_FORGE_MEDIA_PROFILES_JSON`，
并授予匹配的 Agent 工具权限和完整审批。请求的 `options.mediaTask` 只接受 `profileId` 与完整 `text`，
`options.modelSelection` 必须匹配 profile。`local-fake-provider/local-fake-model` 使用内建合成测试音，
用于检验交付流程，不是文字朗读；不配置 profile 不会自动创建一个。

语音 CLI 必须指定新的本地 `.wav` 文件，父目录须已存在。以手册中的 `speech.json` 为例：

```bash
uai forge orchestrate --input speech.json --audio-output speech.wav --json
uai forge orchestrate --input speech.json --audio-output speech.wav --yes --json
uai agents approvals --agent-id agt_your_approved_root --json
uai agents approve --approval-id apr_from_gateway --yes --json
uai forge orchestrate --input speech.json --audio-output speech.wav --yes --json
uai forge runs --json
```

第一条仅预览；第二条正常等待审批时退出码为 3。审阅并批准完整原请求后再提交。
更改文本、声音 profile 或模型选择需要新的匹配审批。真实 Provider 还需 `--allow-real-provider`
及服务端授权；语音不接受 `--max-output-tokens`、`maxTokens` 或 `maxCost`。

成功时 `data.audioOutput` 提供 `status: "saved"`、路径、字节数与 SHA-256，终端不打印音频 base64。
`generated-not-saved` 表示保存未完成，可能留下部分新文件；`saved-result-display-failed` 表示
文件已保存验证，但终端显示失败，退出码仍为 1。后者的 JSON 错误回执以及普通模式的标准错误输出
都保留保存路径、字节数、SHA-256 和运行 ID，应保管已保存文件，不重新生成。

外层治理收尾失败时，`forge runs` 可同时出现 `status: "failed"`、`generation.status: "completed"`
和 `mediaDelivery.status: "unknown"`／`retrySafe: false`：生成完成不能证明交付成功。
服务器不保留可恢复下载的音频副本，运行列表也只是当前实例的有限摘要；应核对首次错误、审批、
运行记录和本地保存回执，不能通过自动重发来恢复。

这条新应用边界及公共契约优先使用 TypeScript，现有 Forge／Provider／SDK 的 ESM 加载保持兼容。
语言比较、必要兼容模块、验证范围和整条媒体接线的回退步骤见手册的
[Language Selection](governed-media-tasks.md#language-selection)。

## 性能(更流畅)

2026-08-23 优化后(fake lane、单机、基准工具复测):
chat JSON p50 **15.7ms → 3.3ms(≈4.8×)**,SSE TTFT **2.6ms → 1.6ms**。
来源:审计落盘改为后台串行队列(不再阻塞响应)、provider 注册表与模型
列表版本化缓存、fake 回声通道去除人为 20ms 延迟。

## 未点亮(保持在场)

E 族上下文工程由 codex-channel-gateway 直系承担;forge-dashboard 浏览器
面默认关(与"无浏览器 UI"诚实边界一致,JSON 面在 /forge/status);
agent-pool 常驻池与 self-loop/self-healing 待治理线成熟后按需点亮。

## 受治理的本地网页目录查询

网页查询使用现有 `/forge/orchestrate`，执行一个已登记的目录页任务：填写条目 ID、
点击搜索、打开详情、提取结果，再由程序读取真实 DOM 核对条目和预期文字。
每次动作前重新观察；模型返回 `done` 只请求校验，不能自行宣布成功。

这是一个有限的本地网页 profile。它不连接用户现有浏览器、不载入登录或 cookies，
不支持任意网站、上传、发消息或支付。媒体 Worker 的其他模态仍需各自的执行和产物验证。
普通 Forge coding 行为保留；直接调用旧 WebWorker 而没有受治理 profile 会明确拒绝。

在网关自己的非敏感配置中设置 `AI_GATEWAY_FORGE_WEB_PROFILES_JSON`，例如：

```json
[
  {
    "id": "local-catalog",
    "tenantId": "example-tenant",
    "origin": "http://127.0.0.1:8088",
    "startPath": "/catalog",
    "searchPath": "/search",
    "detailPath": "/detail",
    "targets": { "query": "query", "search": "search", "details": "details", "result": "result" },
    "maxSteps": 8,
    "timeoutMs": 30000
  }
]
```

`origin` 必须是已指定端口的字面量 `http://127.0.0.1`；不能写 `localhost`、用户信息、
其他地址或通配符。一个配置至多 8 个 profile，每个绑定一个租户。`targets` 是网页上
四个既有元素的唯一 HTML `id`，由管理员登记，模型不能提交 selector。默认使用已安装的
Playwright Chromium；如需本机 Chrome 或 Edge，可在 profile 明确设置
`browserChannel` 为 `chrome` 或 `msedge`，仍会启动独立临时浏览器。二进制不可用时失败，
不自动安装，也不接管现有浏览器。

目录应用需要遵守这个有限合同：

- `query` 是可见、可写的文本/搜索输入；`search` 和 `details` 是可见按钮或链接。
- 点击搜索后才出现 `details`；请求为 `GET /search?q=<已批准条目ID>`。
- 点击详情后出现 `result`；请求为 `GET /detail?id=<同一条目ID>`。
- `result` 是只读的 `div`、`section`、`output` 或 `article`，其 `data-item-id` 等于条目 ID，
  去除首尾空白后的可见文字等于请求的 `expectedText`。模型不能填入这个结果元素。
- 目录页使用内嵌脚本；导航、搜索、详情各自只能在对应动作获准后请求一次精确 GET URL，
  不允许页面自行提前或重复请求，也不允许另取脚本、图片或其他资源。
  这里的“只读”指目录应用的查询合同，不是对任意网站 GET 的无副作用承诺。

操作员先按 [Agent 治理流程](./agent-governance.md) 审阅并激活有限的执行策略，然后创建根 Agent。
策略必须明确允许 `browser_navigate`、`browser_observe`、`browser_interact` 与
`forge_orchestrate`；后者建议设为 `require_approval`。浏览器交互保留 `write_capable` 和
`external_communication` 风险，因此还需策略允许写入及外部通信；这不会自动授予任何 IM 工具。
内置执行策略不会因新增工具而静默扩大权限，现有 Agent 也不会自动升级。

```json
{
  "agentId": "agt_your_approved_root",
  "goal": "查询指定本地目录条目的详情",
  "options": {
    "budget": { "maxTokens": 32000 },
    "webTask": {
      "profileId": "local-catalog",
      "itemId": "item-123",
      "expectedText": "已批准的详情文字"
    }
  }
}
```

`itemId` 仅接受 1–80 位字母、数字、下划线或连字符；预期文字至多 1000 UTF-8 字节。
审阅包含完整 profile、目标和参数，其摘要与根 Agent、当前策略及完整目标一起封存。
按既有审批 API 批准后，原样再次提交请求；配置或参数变化需要新的匹配审批。
网页内容、模型输出或请求 JSON 都不能注入执行函数、浏览器实例或自行签发成功回执。

返回 `result.web.goalVerified=true` 的前提是必要交互完成、独立 DOM 校验通过、当前授权有效，
而且本次拥有的浏览器已关闭。`records` 提供已治理的提取内容；记录数限制、文字脱敏和每步
工具租约都生效。`tokenUsage.llmCalls` 来自真实网关调用次数；Provider 没有提供用量时 token
为 `null`，费用不编造为零。每次模型请求最多 512 输出 tokens，另有输入字节加输出上限的
保守预算预留；这个预留不是实际账单。动作数最多 16，执行超时上限最多 60 秒；取消后仍需等待
本次浏览器完成关闭，不能在清理尚未确认时提前报告成功。

模型缺失、空/非法动作、过期观察、元素被替换、目标未达、额度耗尽或取消均不报告完成。
动作可能已开始而结果不能确认时，返回既有 `FORGE_EXTERNAL_EFFECT_OUTCOME_UNCERTAIN`，
需要先核对目录应用状态；Forge 不重试网页任务，也不恢复旧浏览器会话。

网络处理不会让 Chromium 自动跟随响应重定向：先通过 Playwright `route.fetch` 获取已批准的
精确 URL，显式设置 `maxRedirects: 0`、`maxRetries: 0`、超时和取消，再检查响应并交给浏览器。
非 2xx 或带下载提示的响应一律阻断；响应交付上限为 256 KiB（不是浏览器进程的硬内存配额）。另阻断弹窗、下载、
子 frame、WebSocket，禁用 Service Worker 及 Worker/WebTransport/WebRTC 页面构造入口。
这些是有限受管应用的浏览器控制，不代替操作系统网络隔离，也不宣称可运行任意恶意网站。
有关重定向和取消行为见 [Playwright Route 文档](https://playwright.dev/docs/api/class-route#route-fetch)，
WebSocket/上下文隔离见 [BrowserContext 文档](https://playwright.dev/docs/api/class-browsercontext)。

自动验证包含真实本地 Chromium 与临时目录页，模型决策来自确定性 fake Provider，
分别覆盖引擎、实际 HTTP/审批/Forge/工具治理链、越界端口计数和取消。
这不等于真实外部模型质量、任意网站能力或生产认证。

### Language Selection 与回滚

工作负载是既有 Forge 与浏览器之间的有限、可审阅执行路径。新增 profile/授权/资源生命周期
使用 TypeScript，共享审批形状仍由 shared-contracts 拥有；既有 web-agent 与 Forge JS 模块
局部修正，保持现有导出和运行环境。新边界的工程判断评分如下（每项满分 5，不是性能测量）：

| 方案 | 领域适配 | 维护 | 运维 | 类型安全 | 迁移成本 | 生态适配 | 总分 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 新边界 TypeScript、既有 JS 局部修正 | 5 | 5 | 5 | 5 | 4 | 5 | 29 |
| 新边界也使用 JavaScript | 5 | 4 | 5 | 3 | 5 | 5 | 27 |
| 另建语言/浏览器服务 | 3 | 2 | 2 | 4 | 1 | 2 | 14 |

选择首项，以类型约束新增审批与执行边界，同时避免为语言迁移重写既有引擎。
不新增第三方依赖、数据库表或后台服务。

改动超过 8 文件的原因是实际断点横跨引擎、DAG/Worker、网关审批及共享审阅合同：
只改角色白名单不能完成这些边界。应用显式依赖已有 web-agent；后者原先未使用的网关 peer
依赖移除，避免形成新的包依赖环。目录查询保存为既有 `explore` 类型和 `web` 角色，不迁移 TaskStore。
回滚时先停用这个 profile/对应工具策略、撤销相关 Agent，再整体回退这批源码与锁文件。
不删除审批审计或重放结果未知的动作；已有浏览器用户数据从未参与此路径。

命令行补齐还触及 CLI、SDK 类型与固定路由、Forge 模型设置、审批存储和 HTTP 执行包装。
这些改动必须一起完成，才能让默认模拟调用及明确的模型选择在真实调用、后台分流和审批之间保持一致。
复用原有内部执行限制并传递其约束，没有新增服务、数据库结构或第三方依赖。新增输入解析与参数验证
使用 TypeScript，既有 SDK/引擎 JS 仅作局部接线；按上表在类型安全、维护和运行兼容性上的理由选择。
回滚 CLI 批次时整体回退客户端和对应模型设置接线；未携带新增参数的既有 API 继续采用原有策略。
知识、审批及运行记录属于用户数据，不能随代码回退删除；不重发结果未知的操作。
