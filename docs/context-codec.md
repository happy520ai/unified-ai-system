# Context Codec：实际请求与对照验证

Context Codec 可以把明确选定的 JSON 数据块换成 YAML、JSONL 或表格形式，再交给同一个模型。它不总结或删除事实，也不改消息角色、工具调用 ID、引用值和未选中的内容。网关会真正解码并核对键、类型、值及数组顺序；失败时整次保留原输入，不再调用另一个压缩器。

这是可选能力，默认关闭。没有 `contextCodec` 的请求继续使用原有上下文压缩行为。既有 `runContextCodecAdapter` 仍是预演；它的阶段标记、子串恢复检查和估算结果不用于实际模型请求。

## 选择合适的配置

| profile | 接受的数据 | 模型收到的形式 |
| --- | --- | --- |
| `yaml_state` | JSON 对象、数组或标量 | 带原始类型说明的 YAML 1.2，保留字符串与数值类型 |
| `jsonl_facts` | JSON 对象或数组 | 合法 JSON 元数据首行；对象每行 `[key,value]`，数组每行一个有序值 |
| `compact_trace` | 非空、字段集合相同的对象数组 | 带 `columns` 和 `rows` 的 JSON 表格，减少重复字段名 |
| `off` | 对照请求 | 原始消息，不执行旧摘要或新编码 |

只有明确作为数据提供的 JSON 文本适合重编码。需要逐字保留格式的代码、普通自然语言指令或非 JSON 文本不要选入 targets。实际 HTTP 支持原生 `/chat` 和 `/chat/stream`；这里不承诺 OpenAI/Anthropic/Gemini 兼容入口接受相同扩展字段。

每个选中块最多 256 KiB，JSON 深度最多 32、节点最多 20,000（键也计入）；每个请求最多 16 个块、合计 1 MiB。重复键、不安全整数、数值精度损失和非规范数字写法会保留原输入，例如 `9007199254740993`、`0.10000000000000001`、`1.0`、`-0`。YAML 不接受别名、自定义标签、多文档或复杂键。

## 启用与调用

在已有候选启动配置中设置下面两项，再按现有方式启动或重启网关：

```text
AI_GATEWAY_CONTEXT_CODEC_ENABLED=true
AI_GATEWAY_CONTEXT_CODEC_MIN_ESTIMATED_SAVING_PERCENT=30
```

阈值是同一 `ceil(text.length / 4)` 估算器对实际前后文本的比较，不是真实 token 节省。只有估算达到阈值且 UTF-8 字节数也减少，才应用编码。事实检查始终要求完整相等，不能降低到“包含了某些字样”。

请求必须明确 `providerId` 和 `model`；新路径保留现有权限、真实 Provider 开关、内容策略、预算和计量。该请求不参与加权改路由或影子请求，也不会降级到其他模型。JSON 调用者不能借这个限制扩大权限。

在普通原生请求上增加：

```json
{
  "contextCodec": {
    "profile": "compact_trace",
    "targets": [
      { "messageIndex": 1, "contentSha256": "这里填写原始content字符串UTF-8字节的64位SHA-256" }
    ]
  }
}
```

消息索引从 0 开始。多模态消息可加 `partIndex`，只选 `type: "text"` 的部分；图片和其他部分保留原样。哈希绑定实际字符串；如果上游增强或上下文注入改变了位置/内容，网关保留原输入并报告 `target_changed`。SDK 的 `client.chat()`、`client.chatStream()` 接受相同字段；这两种带 codec 的调用拒绝 HTTP 重定向。

普通响应的 `data.metadata.contextCodec`，以及流式 `start`/`done` 的 `meta.contextCodec`，提供处理回执：

- `status: applied` 表示选中块已编码并通过数据恢复；`original` 表示保留原输入，`reason` 说明原因。
- `inputHash` 绑定归一化原请求；`providerInputHash` 绑定转换后请求；`policyHash` 绑定启用状态与阈值。生成的 requestId/traceId 不参加输入对照。
- `targets` 包含原文本/编码文本/原数据哈希和事实计数，不包含原始内容。
- `estimatedTokensBefore/After` 和 `estimatedSavingPercent` 都是估算；`modelQuality: not-evaluated` 明确表示数据往返本身没有评价模型答案。

实际派发及完成前还会核对输入未被异步调用方改变；变更后返回 `CONTEXT_CODEC_INPUT_CHANGED`，不会把旧哈希当成新输入的证明。

## 一次可以复核的模型对照

`codec preview` 在本地解析 case 文件、构造哈希并展示模型和最多两次请求的范围。`codec compare` 只有加 `--yes` 才发送请求；默认选择本地 fake，非默认 Provider 还要显式 `--allow-real-provider`。认证沿用已有的安全管理入口，不要把 Key 放进 case 文件。

case 文件最多 256 KiB，必须包含 `request`、`profile`、`targets`、`expectedJson`。下面的 JavaScript 可生成一个不含凭据的示例文件：

```js
import { writeFile } from "node:fs/promises";
const rows = Array.from({ length: 30 }, (_, index) => ({
  count: index, ref: `document://item-${index}`, note: `条目 ${index}`,
}));
await writeFile("codec-case.json", JSON.stringify({
  request: {
    messages: [
      { role: "system", content: "Return ONLY JSON for the selected entry. Preserve every field." },
      { role: "user", content: JSON.stringify(rows, null, 8) },
      { role: "user", content: "Return the entry whose count is 3." },
    ],
    options: { temperature: 0, maxOutputTokens: 256 },
  },
  profile: "compact_trace",
  targets: [{ messageIndex: 1 }],
  expectedJson: rows[3],
  minReportedInputSavingPercent: 10,
}, null, 2));
```

在源码工作区运行：

```text
pnpm gateway codec preview --input codec-case.json --json
pnpm gateway codec compare --input codec-case.json --yes --json
```

已安装 CLI 时可将 `pnpm gateway` 换成 `uai`。默认 fake 的普通回复不保证满足示例答案；基线不通过就停止，不伪造质量通过。真实对照须选择已配置、已获准的目标，例如另加 `--provider-id <目标> --model-id <模型> --allow-real-provider`。

执行顺序固定：原输入 `off` 基线一次，再用同一模型和参数执行编码输入一次。默认每次输出上限 512，允许明确设为 1–4096；总请求数最多 2。基线答案不等于 `expectedJson`、服务未启用或本地估算不足时，第二次不会发送。

结果严格比较完整 JSON 答案，而非相似度或关键词。两次输入哈希、策略哈希、模型 ID 和执行模式必须相符；编码回执中的块哈希还必须与本地预览相符。`case_passed` 只表示这个明确样例的答案匹配、输入 token 减少并达到设定阈值；fake 证据仅能得到 `synthetic_case_passed`。

用量只取 Provider 完整上报且校验有效的 `usageObservation`。默认填零、缺失、部分或估算用量不会成为节省证明。保留每次输入/输出/总量及原答案；`inputSavingPercent` 只比较输入 token，不能代替账单、平均成本或总体模型质量。真实模型也可能在保持数据完整的情况下答错，因此应逐个实际任务建立样例，而不是从一次对照推断普遍收益。

## 失败与恢复

编码或收益检查失败时，服务器仍可用原输入完成普通请求，回执显示 `original`。模型调用失败和流式取消继续使用现有失败/取消协议；没有最终 `done` 就不算完成。

CLI 保留两次请求各自的 requestId、幂等键与已取得的结果。第二次失败或回复丢失时，第一次结果不会被覆盖，也不会自动重试；`failed_or_unknown` 不表示未计费。先按这些 ID 核对现有网关请求/用量和幂等记录。重新运行 `compare` 会创建新的比较 ID，不能把它当作原比较的恢复操作。

关闭 `AI_GATEWAY_CONTEXT_CODEC_ENABLED` 并重启即可停用编码；已明确传入 `contextCodec` 的请求保留原输入并显示停用原因。没有新数据库、持久状态或常驻服务需要迁移。代码回退时同步撤回 codec CLI/SDK扩展与网关接线，并让调用方停止发送该选项；已有外部调用和用量记录应保留。

## Language Selection

工作负载为有界 JSON/YAML 解析、编解码、请求处理、回执投影和一次两请求对照。新实现使用 TypeScript；既有 JavaScript 文件只增加接线。

| 方案 | 领域适配 | 维护 | 运维 | 类型与错误边界 | 迁移成本 | 生态 | 合计 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| TypeScript / Node | 5 | 5 | 5 | 5 | 5 | 5 | 30 |
| 纯 JavaScript / Node | 5 | 4 | 5 | 3 | 5 | 5 | 27 |
| Rust 独立组件 | 2 | 2 | 3 | 5 | 1 | 2 | 15 |

这里选择现有 TypeScript/Node 模式，减少格式/角色/回执的类型混淆，也保留现有部署路径。引擎声明仓库已有的 `yaml 2.9.0`、`jsonc-parser 3.3.1`，CLI复用该工作区引擎；没有引入新第三方库版本。依赖链接是离线执行、没有下载、没有执行安装脚本。

跨引擎、共享合同/配置、网关、SDK和CLI的修改是让同一编码真实生效且可验证所必需的；没有另建网关、控制平面或存储。兼容性边界仅为显式 codec 请求和新命令，默认请求保持原行为。验证覆盖三格式的真实恢复/篡改拒绝、异步输入变化拒绝、原内容策略、流式消息关联，以及实际本地HTTP/CLI的错误答案/未知用量/丢回复。真实 Provider 的质量与用量结论必须另有对应的实际对照记录。
