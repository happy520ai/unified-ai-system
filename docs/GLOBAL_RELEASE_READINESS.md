# PME 移动地球全球发布 Readiness 说明

本文用于说明当前仓库距离“全球发布版本”的真实状态。它不是发布公告，也不是 release automation；它是一份发布前预检口径，帮助团队判断哪些能力已经可体验，哪些仍然需要后续真实交付。

## 当前可体验能力

- Chat-first Web 前台：`http://127.0.0.1:3100/ui`
- 默认托管启动、状态、健康、日志、停止归零命令
- 本地知识库导入与检索
- PDF、Word `.docx`、Excel `.xls/.xlsx`、文本文件导入
- 本地文件 + SQLite 知识持久化
- 显式配置后的 Gemini embedding + pgvector 向量链路
- API Key 粘贴后的 provider/model 探测与运行时模型添加
- 有边界的 RAG chat、流式输出、引用展示、会话保存、停止生成、Markdown-lite 渲染
- 有边界的企业治理、审计、备份、readiness、交付候选只读预检

## 当前默认日常命令

```powershell
cmd /c pnpm help:phase14a
cmd /c pnpm start:pme
cmd /c pnpm dev:phase7b
cmd /c pnpm status:phase10a
cmd /c pnpm health:phase12a
cmd /c pnpm logs:phase16a
cmd /c pnpm idle:phase15a
```

`start:pme` 是面向普通用户的启动入口：它先做本地 first-run 预检，
确认 Node / pnpm / 核心脚本 / 文档入口存在，再复用 `dev:phase7b`
托管启动链路，并提示 Web 访问地址 `http://127.0.0.1:3100/ui`。

`health:phase12a` 只检查本地服务 `/health/check` 是否 ready，不调用真实 provider。真实 provider 烟测仍在：

```powershell
cmd /c pnpm verify:phase7a-1
cmd /c pnpm verify:phase7a
```

## 发布前必须守住的边界

- 默认 `/chat` 主链仍是 NVIDIA single-provider。
- Web chat 可通过 `/chat/rag` / `/chat/rag/stream` 使用本地知识增强，但这不等于完整生产 RAG 平台。
- local-keyword 是默认知识模式；pgvector/vector 需要显式配置。
- API Key、数据库密码、完整连接串不得写入 docs、evidence、console log 或 commit。
- `legacy/` 只读参考，不作为正式运行目录。
- 现阶段不代表 DataEyes、完整多 provider 治理平台、完整 fallback 策略治理、完整 IAM/SSO、生产 GraphRAG、外部连接器平台、SIEM、发布自动化已经完成。

## 全球发布前仍需继续真实交付的事项

- 安装器 / 桌面启动器 / 开机自启动体验。
- 首次启动向导，包括 Node/pnpm 检查、端口占用说明、provider 配置引导。
- 多语言 UI 文案切换与统一术语表。
- 生产级密钥存储，避免长期依赖浏览器 localStorage 或本地明文环境变量。
- 更严格的 provider catalog 更新机制与真实模型能力验证。
- 打包、签名、升级、回滚、遥测开关和隐私声明。
- 面向最终用户的错误恢复体验，例如 provider 超时、余额不足、模型不可用、网络不可达。

## 当前 Readiness 预检命令

```powershell
cmd /c pnpm verify:phase78a
cmd /c pnpm verify:phase79a
cmd /c pnpm verify:phase80a
cmd /c pnpm verify:phase81a
cmd /c pnpm verify:phase82a
cmd /c pnpm verify:phase83a
cmd /c pnpm verify:phase84a
cmd /c pnpm verify:phase85a
cmd /c pnpm verify:phase86a
cmd /c pnpm verify:phase87a
cmd /c pnpm verify:phase88a
cmd /c pnpm verify:phase89a
cmd /c pnpm verify:phase90a
cmd /c pnpm verify:phase91a
cmd /c pnpm verify:phase92a
cmd /c pnpm verify:phase93a
cmd /c pnpm verify:phase94a
cmd /c pnpm verify:phase95a
cmd /c pnpm verify:phase96a
cmd /c pnpm verify:phase97a
cmd /c pnpm verify:phase98a
cmd /c pnpm verify:phase99a
cmd /c pnpm verify:phase100a
cmd /c pnpm verify:phase101a
```

Phase 88A adds a browser regression for the first real chat after successful model configuration: the chat composer sends through `/chat/stream` with the selected runtime provider/model, receives a streamed answer, clears the input, restores focus, and does not store the API Key in browser state or evidence. The check uses a local mock OpenAI-compatible provider and does not call real providers or change the default NVIDIA `/chat` lane.

Phase 89A adds a browser/service restart regression for model configuration persistence: after a successful local-file runtime model configuration, the same browser reload and same-port service restart must restore the provider/model selection and send chat through `/chat/stream` without re-entering the API Key. The check uses a temporary local credential file and local mock OpenAI-compatible provider, removes the temp file after verification, and does not call real providers or change the default NVIDIA `/chat` lane.

Phase 90A adds a readability regression for that restored state: after reload and service restart, the composer status must visibly explain that the model and API Key were restored from local user configuration, remain usable after service restart, and can be used directly without re-entering the key.

Phase 98A adds a visible user-journey regression for model configuration: the Chat-first composer prompt, three-step model configuration wizard, one-click add/detect flow, success explanation, and continue-to-chat focus recovery must be understandable and actionable. The check uses a local mock provider only, keeps API keys out of evidence/browser state, and does not call real providers or change the default NVIDIA `/chat` lane.

Phase 99A adds the final visual check for that model configuration journey: it delegates Phase 98A, validates the generated screenshot evidence, and checks that the composer prompt, wizard, success card, and ready-to-chat guidance are still readable and safe. The check uses local mock provider evidence only and does not call real providers or change the default NVIDIA `/chat` lane.

Phase 100A freezes the bounded Web chat model-configuration chain by aggregating provider model import, explicit model-list probing, model configuration success/repair regressions, ready-first-message behavior, and the final visual journey. It uses local mocks and existing evidence only, keeps secrets out of evidence, and does not call real providers or change the default NVIDIA `/chat` lane.

Phase 91A adds the recovery regression for a restored configuration that later fails: the chat error and composer status must tell the user to re-check the restored API Key/provider/base URL/model, switch the composer action to `重新检测模型`, and keep the page usable without changing the default NVIDIA `/chat` lane.

Phase 92A adds the repair-loop regression after that recovery prompt: clicking `重新检测模型` must open the model configuration wizard in repair mode, carry forward the current provider/model/base URL where available, guide the user to replace or re-check the API Key, and re-run the existing `/chat` availability probe. It uses simulated browser failure/repair responses only and does not call real providers or change the default NVIDIA `/chat` lane.

Phase 93A adds the continue-after-repair regression: after the repair probe passes, the model configuration card must offer `继续刚才的问题` and resend the previously failed prompt without requiring the user to type it again. It uses simulated browser failure/repair responses only and does not call real providers or change the default NVIDIA `/chat` lane.

Phase 96A adds the ready-first-message regression: after successful model configuration, the UI must return focus to the chat input, accept the first typed prompt, send it through the selected runtime model, clear the input, return an assistant answer, and restore focus to the composer. It aggregates the Phase 95A ready-to-chat check and Phase 88A first-chat browser check, uses local mock provider responses, and does not call real providers or change the default NVIDIA `/chat` lane.

Phase 97A adds the model-configuration aggregate regression: it runs the bounded browser checks for successful configuration, first configured chat, repair-and-continue, repair visual polish, ready-to-chat, and ready-first-message as one command. It uses local mock provider responses, keeps secrets out of evidence, and does not call real providers or change the default NVIDIA `/chat` lane.

这些命令是只读预检，会检查：

- 核心文档是否存在并能按 UTF-8 正常读取。
- 文档中是否出现常见乱码标记。
- 默认命令、knowledge 命令、Chat 验收命令、企业验收命令是否存在。
- `health:phase12a` 是否保持为本地服务健康检查。
- 文档和 evidence 中是否出现明显明文 API Key 或数据库连接串。
- `start:pme` 用户启动入口是否可用，且是否仍复用 Phase 9C 托管启动链。
- `/ui` 首屏是否展示面向普通用户的首次使用三步向导。
- `start:pme` 启动成功后是否会尝试打开 Web 前台，并支持用
  `PME_SKIP_BROWSER_OPEN=1` 或 `PME_AUTO_OPEN_BROWSER=0` 关闭自动打开。
- `/ui` 聊天输入区是否提供清晰可见的“配置模型”入口，并说明 API Key
  检测通过后再发送问题。
- Chat 失败和模型检测失败是否会给出可操作恢复建议，包括 API Key /
  权限、base URL、超时、限流、网络波动和 health / logs 排查路径。
- 模型配置失败或成功后是否提供下一步动作按钮，例如重新检测、选择
  provider、填写 base URL、手填模型 ID、查看排查命令和继续聊天。
- 浏览器实测是否覆盖模型配置失败路径，包括无法判断 provider、只有非聊天
  模型、provider 超时等情况，并确认每条路径都有可点击下一步。
- 浏览器实测是否覆盖模型配置成功路径，包括 provider models API 拉取模型、
  confirm 后映射到真实 runtime provider、`/chat` 小探测、记住默认选择和
  回到聊天输入区；测试使用本地 mock provider，不调用真实服务商。
- 浏览器实测是否覆盖模型配置成功后的用户可感知状态解释，包括 provider
  已识别、模型已选择、已加入当前服务、`/chat` 探测通过、当前聊天可用、
  默认选择是否已记住，以及 API Key 不写入浏览器/聊天/evidence。

它不会：

- 启动或停止服务。
- 调用 provider。
- 发布软件包。
- 连接外部数据库。
- 修改运行数据。
- 刷新真实 provider evidence。
