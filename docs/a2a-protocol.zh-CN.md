# A2A v1.0 网关

Unified AI System `v0.5.0` 和当前源码均提供 Agent2Agent（A2A）v1.0
JSON-RPC 入口，底层使用官方 `@a2a-js/sdk` `1.0.1`。

## 端点

| 端点 | 用途 |
| --- | --- |
| `GET /.well-known/agent-card.json` | 公开发现 Agent Card。 |
| `GET /.well-known/a2a-jwks.json` | 配置签名后发布公开验签密钥。 |
| `POST /a2a/jsonrpc` | A2A v1.0 JSON-RPC 操作。 |

Agent Card 声明 `JSONRPC` 协议版本 `1.0`、`text/plain` 输入输出，并明确关闭
流式、推送通知和扩展卡片。外部访问地址与网关监听地址不同时，设置
`A2A_PUBLIC_BASE_URL`。

## 可验证的 Agent Card 身份

本地 fake-provider 预览仍保持零凭据，并允许返回未签名 Agent Card。部署环境可
挂载稳定的 Ed25519 PKCS#8 私钥，并要求每次发现响应携带规范化 JWS：

```bash
openssl genpkey -algorithm ED25519 \
  -out /run/secrets/a2a-agent-card-ed25519.pem
chmod 600 /run/secrets/a2a-agent-card-ed25519.pem

export A2A_PUBLIC_BASE_URL=https://gateway.example.com
export AI_GATEWAY_A2A_AGENT_CARD_SIGNING_KEY_FILE=/run/secrets/a2a-agent-card-ed25519.pem
export AI_GATEWAY_A2A_AGENT_CARD_SIGNING_REQUIRED=true
```

密钥路径必须是绝对路径；POSIX 密钥文件不得允许 group/other 访问；非回环 JWKS
地址必须使用 HTTPS。默认 JWS 受保护头指向
`<A2A_PUBLIC_BASE_URL>/.well-known/a2a-jwks.json`。只有单独运营的 HTTPS JWKS
确实发布同一公钥时，才设置 `AI_GATEWAY_A2A_AGENT_CARD_JWKS_URL`。

受保护头使用 `alg=EdDSA`、`typ=JOSE`、由 SHA-256 派生的 `kid` 和 `jku`；
JWKS 仅包含 Ed25519 公钥。签名走官方 SDK 的规范化与签名实现，聚焦测试再用
`verifyAgentCardSignature` 验签。required 模式下，缺失、格式错误、权限过宽、
非 Ed25519 或通过不安全地址发布的密钥都会失败关闭，并且不会输出密钥内容。

轮换时先让新的公钥可达，再通过 secret manager 更换挂载密钥并重启网关。
Agent Card/JWKS 缓存期为 5 分钟；重叠多签名轮换尚未实现。

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
- 当前档位没有启用流式、推送通知、gRPC、HTTP+JSON/REST、非文本 Part 和
  持久任务存储。只有配置稳定密钥文件后才启用 Agent Card 签名。

运行 `pnpm verify:public-clone` 可得到无需凭据的官方客户端验证结果。已发布的
`v0.5.0` 网关镜像和当前源码均包含这个 A2A 档位；当前源码还包含 PR #115
跟踪的发布后加固。
