# Forge Vision Quickstart(设想族群点亮指南)

业主勾选"除 E 外全部接入"后,forge-core / taiji / workforce / three-mode 的
核心能力通过受治理端点点亮。所有端点走既有权限/预算/审计;forge 的 LLM
调用一律经网关 provider lane(fake 默认,真实需三道门),不旁路治理。

## 端点一览

| 端点 | 能力(族群) | 权限 |
| --- | --- | --- |
| `POST /forge/polish` | 迭代精修文本/产物(B) | chat:use |
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

## CLI(更好用)

```bash
uai forge status
uai forge polish "把这段设计文档打磨成可执行任务"
uai forge quality "export const add=(a,b)=>a+b"
uai forge memory "记住:网关默认 fake lane"
uai forge recall "fake lane"
uai forge taiji "生成内部报表,读取数据库"
uai forge workforce "为网关设计 UX 修复计划"
```

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
