# A2A v1.0 网关

Unified AI System 在当前源码中提供 Agent2Agent（A2A）v1.0 JSON-RPC 入口，
底层使用官方 `@a2a-js/sdk` `1.0.1`。

## 端点

| 端点 | 用途 |
| --- | --- |
| `GET /.well-known/agent-card.json` | 公开发现 Agent Card。 |
| `POST /a2a/jsonrpc` | A2A v1.0 JSON-RPC 操作。 |

Agent Card 声明 `JSONRPC` 协议版本 `1.0`、`text/plain` 输入输出，并明确关闭
流式、推送通知和扩展卡片。外部访问地址与网关监听地址不同时，设置
`A2A_PUBLIC_BASE_URL`。

## 官方 SDK 示例

启动网关，再运行受检客户端：

```bash
pnpm gateway serve
node docs/examples/a2a-sdk-client.mjs
```

示例使用官方 A2A JavaScript SDK 发现 Agent Card，调用 `SendMessage`，再通过
`GetTask` 读取任务，并使用 `ListTasks` 找到它。

## 自然语言增强

可以在 A2A 请求元数据中显式启用同一套本地确定性提示词增强器：

```json
{
  "unifiedAi": {
    "promptEnhancement": {
      "enabled": true,
      "profile": "coding",
      "language": "zh-CN"
    }
  }
}
```

这段元数据放在 `SendMessageRequest.metadata` 中。它属于 Unified AI System
扩展，不是 A2A 标准字段。

## 安全与限制

- A2A 执行固定使用 `local-fake-provider`；结果不能证明 fake 执行时会失败关闭。
- Agent Card 公开可读；`/a2a/jsonrpc` 继续使用网关现有企业鉴权和
  `chat:use` 权限策略。
- 启用企业鉴权后，Agent Card 会声明 HTTP Bearer 鉴权；Provider Key 仍留在服务端。
- 任务使用官方内存任务存储，按认证用户和企业租户隔离，服务进程重启后不会保留。
- 官方请求处理器提供 `SendMessage`、`GetTask`、`ListTasks` 和 `CancelTask`。
  取消是协作式的，不能保证已经运行的 provider 操作被真正中断。
- 当前档位没有启用流式、推送通知、gRPC、HTTP+JSON/REST、非文本 Part、
  Agent Card 签名和持久任务存储。

运行 `pnpm verify:public-clone` 可得到无需凭据的官方客户端验证结果。这个源码
能力尚未包含在已经发布的 `v0.4.9` 镜像中。
