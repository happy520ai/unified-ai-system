# 受治理语音产物

`POST /forge/orchestrate` 的 `options.mediaTask` 把一次固定的文字转语音请求交给
现有网关 Provider 通道。服务端核验 PCM WAV 后，通过响应交付音频；CLI 只把它保存到
操作者指定的新文件。配置 `local-fake-provider/local-fake-model` 的 profile 时，服务端使用
内建合成测试音验证交付流程，不调用真实 Provider，也不生成文字朗读。

本入口当前支持 `wav-pcm16`。其他媒体模态和语音格式仍使用各自的现有入口与验证范围。

## 配置与权限

沿用 [Agent 治理](agent-governance.md) 配置。操作者需要 `workflow:run`、`chat:use`，
并且是根 Agent 的所有者，或拥有 `agent:run:any`／`*` 委派权限。
该 Agent 的有效策略应包含：

```json
{
  "toolRules": {
    "forge_orchestrate": "require_approval",
    "media_synthesize_speech": "allow"
  }
}
```

工具仍须在策略的 capability ceiling 和 Agent 请求工具集合中，并具有对应的写入、
外部通信和 Forge 权限。仅给 `forge_orchestrate` 一个宽泛的 `allow` 不会跳过语音审批。
叶子工具的描述符也不授予原始 Provider 适配器：它只能在已批准的私有 Forge 执行上下文中使用。

服务端启动配置 `AI_GATEWAY_FORGE_MEDIA_PROFILES_JSON` 是最多 8 个 profile 的 JSON 数组，
整个配置最多 32 KiB。没有配置匹配租户的 profile 时，请求会拒绝，不自动创建演示配置。
以下是无真实 Provider 调用的演示配置；`tenantId` 要与实际操作者匹配。

```json
[
  {
    "id": "demo-speech",
    "tenantId": "tenant-a",
    "providerId": "local-fake-provider",
    "modelId": "local-fake-model",
    "voice": "alloy",
    "format": "wav-pcm16",
    "maxTextBytes": 4096,
    "maxAudioBytes": 4194304,
    "maxDurationMs": 120000,
    "timeoutMs": 30000
  }
]
```

请求只选 profile 并提供完整文本，不能提交服务器路径、下载 URL、任意声音配置或执行器。
审批材料包含原文本、UTF-8 字节数及哈希、完整 profile 与哈希、Provider/model、声音和限额。
文本前后的空白和换行保持原样；修改文本或 profile 后需要新的匹配审批。
根 Agent、完整目标、当前策略和模型选择也属于审批绑定；CLI 会核对目标、选项及媒体审阅摘要，
缺字段或哈希不匹配的内容不能作为完整审阅显示。`--yes` 仅确认发送请求，不代替服务端审批。

每个 profile 的 `maxTextBytes` 为 1–16384，`maxAudioBytes` 为 46–4194304，
`maxDurationMs` 为 1–120000，`timeoutMs` 为 1000–60000；均须为整数。
最终音频计为一个输出记录，策略的 `maxRecords: 0` 会在 Provider 调用前拒绝生成。

真实模型通过现有 Provider 配置及安全凭据入口供给，profile 不包含凭据。
必须先核实所选 Provider/model/voice 能返回此处声明的 WAV 格式；配置存在不代表真实语音质量已验证。

## 运行并保存

把实际根 Agent ID 写入 `speech.json`：

```json
{
  "agentId": "agt_<实际根Agent-ID>",
  "goal": "生成已审查的欢迎语音",
  "options": {
    "modelSelection": {
      "providerId": "local-fake-provider",
      "modelId": "local-fake-model"
    },
    "mediaTask": {
      "profileId": "demo-speech",
      "text": "你好，欢迎使用网关。"
    }
  }
}
```

`modelSelection` 必须与服务端 profile 完全一致。媒体任务不能同时携带 `webTask`，
也不能启用精修、代码智能或非空 checkpoint 列表。输出文件的父目录应已存在，目标必须是新的
`.wav` 文件。CLI 在发请求前核对目标，保存时重新核对；不会覆盖已有文件或自动换名。
`--audio-output` 只指定客户端本地路径，不会作为服务器输出路径提交。

```powershell
pnpm gateway forge orchestrate --input speech.json --audio-output 欢迎.wav --json
pnpm gateway forge orchestrate --input speech.json --audio-output 欢迎.wav --yes --json
pnpm gateway agents approvals --agent-id <实际根Agent-ID> --json
pnpm gateway agents approve --approval-id <返回的批准ID> --yes --json
pnpm gateway forge orchestrate --input speech.json --audio-output 欢迎.wav --yes --json
pnpm gateway forge runs --json
```

第一条只显示本地预览；第二条通常返回 `approval_required`（退出码 3）。审查完整材料并批准后，
重复原请求。真实 Provider 还必须显式加 `--allow-real-provider`，不会因为 profile 指向真实模型而自动授权。

成功输出的 `data.audioOutput.status` 为 `"saved"`，包含本地路径、字节数及 SHA-256；
顶层 `status: "completed"`、退出码 0 表示这次生成与本地保存流程完成。
普通和 JSON 终端输出都只展示音频元数据，不打印 base64。SDK 的 `forgeOrchestrate` 保留原响应形状，
`decodeForgeMediaAudio(artifact)` 可重新校验并返回 `Uint8Array`，供 SDK 调用者自行保管。

## 限额与结果含义

- 每个任务只有一次语音 Provider 操作；不会调用规划 LLM、旧 MediaWorker 或 AgentPool，也不自动重试或恢复生成。
- 文本最多 16 KiB，音频最多 4 MiB、120 秒，请求期限最多 60 秒；每个 profile 可进一步收紧。
- 输出支持单／双声道、8–48 kHz、16-bit PCM。服务端验证 RIFF 长度、块边界、fmt/data 唯一性、帧和时长，并核对全部字节的 SHA。
- SDK 对完整响应按实际读取字节执行 6 MiB 上限，拒绝重定向和损坏、截断或绑定不符的音频；CLI 写入、同步、同句柄回读和文件身份检查完成后才报告 saved。
- 虚拟 Key 准入、网关派发、当前 Agent 策略、取消和结果治理仍生效。输出字段被策略删除或替换时不能交付成功。
- 本接口未收到 Provider 的 token／货币用量报告时，`usage.reported` 保持 `null`。显式 `maxTokens`、`maxCost` 或 `maxOutputTokens` 不适用于此语音配置，会被拒绝；使用已批准的文本、音频和时间限额。

`synthetic: true` 表示测试音，不是文字朗读。WAV 和哈希通过证明格式与交付完整性，不能代替对
实际发音、语调、声音身份或内容准确性的独立试听。

## 失败与恢复

生成、治理收尾、保存和结果显示是不同阶段。网络断开、取消、未知响应或治理收尾失败后，
不要自动再次调用 Provider；已有派发可能已经产生费用。保留原请求摘要、运行 ID、审批 ID 和首次失败。
CLI 的 `retryAllowed: false`、服务端的 `retrySafe: false` 都不能解释成一次可安全重发的请求。

| 观察到的状态 | 含义与处理 |
| --- | --- |
| `approval_required`，退出码 3 | 正常等待完整审批；审阅并批准匹配的请求后再提交。 |
| `completed` 且 `data.audioOutput.status: "saved"`，退出码 0 | 新 WAV 已保存、同步并回读校验；保留文件和回执。 |
| `generated-not-saved`，退出码 1 | 已接收并验证音频，但本地保存未完成。错误回执的 `audioOutput.saved` 为 `false`；核对 `fileCreated` 与 `outcomeUnknown`，可能留下部分新文件。 |
| `saved-result-display-failed`，退出码 1 | WAV 已保存并验证，随后显示结果失败。错误回执保留 `audioOutput.status: "saved"`、`saved: true`、`outcomeUnknown: false`、路径、字节数、SHA-256 及运行 ID。保留文件，不要为修复显示而重新生成。 |

保存后显示失败时，`--json` 把上述结构化回执写到标准错误；普通模式也会在标准错误中列出
保存路径、字节数、SHA-256 和运行 ID。退出码 1 不等于音频文件不存在。

若音频生成已完成，但外层结果治理、租约释放或交付取消检查失败，HTTP 会拒绝交付成功。
相应 `forge runs` 记录保留生成事实，同时把整次运行标记为失败；相关字段示例如下：

```json
{
  "status": "failed",
  "generation": { "status": "completed", "completedTasks": 1, "failedTasks": 0 },
  "mediaDelivery": { "status": "unknown", "retrySafe": false }
}
```

`generation.status: "completed"` 只说明生成阶段完成，不能代替交付或保存回执。
`mediaDelivery.status: "unknown"` 也不证明 Provider 已停止或未收费。先核对运行记录中的
首个错误、`causeCode`／`cleanupCodes`、审批状态和现有本地文件；不要把失败记录改读为成功，
也不要用重发请求来覆盖首次失败。

成功保存的文件独立于 Forge 的临时工作目录和网关进程而保留。服务器不提供此响应音频的持久找回副本；
运行列表只保存当前服务实例内的有限摘要，会受重启、容量和保留期限影响；它不是音频下载库。
`forge runs` 中缺少记录不能证明未调用 Provider。SDK 调用者应保留已经收到的字节，CLI 不会擅自删除失败后可能残留的新文件。

## 验证

```powershell
node --test packages/forge-core/test/governed-media.test.js packages/shared-sdk/src/index.test.js apps/agent-console/src/forgeMediaOutput.test.ts
pnpm exec vitest run apps/ai-gateway-service/src/forge/governedMediaArtifact.test.ts apps/ai-gateway-service/src/forge/governedMediaTaskRuntime.test.ts apps/ai-gateway-service/src/providers/multimodalTtsTransport.test.ts apps/ai-gateway-service/src/http/governedMediaHttp.e2e.test.ts --maxWorkers=1
```

这些测试使用合成 Provider 响应，包括实际网关、Tool Proxy、HTTP、Node CLI 和文件操作。
真实语音质量、全仓门禁、托管 CI 和部署状态须各自记录实际结果。

## Language Selection

- **Workload:** 把已有 TTS 传输接到 Forge 的审批、执行和结果边界，验证二进制产物并保存到操作者的新文件。
- **Primary path:** `governedMediaTaskProfile.ts`、`governedMediaTaskRuntime.ts`、`governedMediaArtifact.ts`、`forgeMediaOutput.ts` 及 shared-contracts 的媒体契约。
- **选择:** 新应用验证与执行、CLI 文件操作和公共契约优先使用 TypeScript。现有 Forge、Provider 和 SDK JavaScript 入口保持 ESM 兼容；SDK 的 `forgeMediaResponse.js` 辅助模块沿用可直接加载的 ESM 形式，公共接口由 TypeScript 入口描述。Provider 传输补准确 JSDoc，避免丢失可选参数和二进制返回类型。
- **比较:** 按 domain fit、maintenance、operability、safety、migration debt、ecosystem fit 的 1–5 分制，TypeScript 新边界配合现有 ESM 兼容为 `5/5/5/4/5/5=29`；整体迁移为 `4/4/4/5/3/4=24`；新应用模块也使用 JavaScript 为 `5/4/5/3/5/5=27`。这是工程判断，不是性能测量；前者加强审批和结果类型约束，同时避免更改整套加载与构建流程。
- **影响面:** 同一条调用链跨审批契约、Gateway、Forge、SDK、CLI 及必要测试与说明；没有新依赖、数据库、服务器音频库或常驻进程。
- **兼容与回退:** 普通 Forge、现有多模态入口的默认调用和原生登录保持原边界；TTS 传输选项是增量接口。回退前停止接收新语音任务，核对在途运行是否收尾，保留已保存文件、审批历史与首次失败，再一致回退 Gateway／Forge／SDK／CLI 的媒体接线并验证原入口。未知请求仍需人工核对，不能交给旧 Worker 自动重放，也不能随回退删除用户音频。
- **验证:** 字节与协议负例、真实局部 HTTP/CLI 保存、所有者及批准绑定、输出删改、取消、失败收尾与保存后显示失败分别验证；遵循 [Language Selection Playbook](language-selection-playbook.md)。
