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

## 有界与持久任务

所有任务存储模式现在都强制租户 + 已认证 owner 双重隔离，并默认采用 7 天 TTL、
全局/owner 容量、序列化任务大小、历史与产物数量上限，以及绑定作用域和筛选条件
的 keyset 游标分页。客户端传入的 `ListTasks.tenant` 不能覆盖服务端调用上下文。

本地预览使用有界的内存 SQLite 数据库。需要同主机重启恢复时，配置专用本地路径：

```bash
export AI_GATEWAY_A2A_TASK_STORE_MODE=sqlite
export AI_GATEWAY_A2A_TASK_STORE_PATH=/var/lib/unified-ai-system/a2a-tasks.sqlite
export AI_GATEWAY_A2A_TASK_STORE_REQUIRED=true
```

未显式设置 A2A mode 时，`AI_GATEWAY_MULTI_INSTANCE=true` 默认选择 SQLite。
SQLite 使用 WAL、`synchronous=FULL`、有界 busy timeout、原子 upsert/容量事务、
私有目录，并在支持 POSIX 权限的平台把数据库设为 0600。`/healthz` 与 `/ready`
只公开安全的模式/上限/可用性快照，存储探针失败时 readiness 失败关闭。

可通过 `AI_GATEWAY_A2A_TASK_TTL_MS`、`AI_GATEWAY_A2A_TASK_MAX_ENTRIES`、
`AI_GATEWAY_A2A_TASK_MAX_ENTRIES_PER_OWNER`、`AI_GATEWAY_A2A_TASK_MAX_BYTES`、
`AI_GATEWAY_A2A_TASK_MAX_HISTORY_MESSAGES`、`AI_GATEWAY_A2A_TASK_MAX_ARTIFACTS`
和 `AI_GATEWAY_A2A_TASK_SQLITE_BUSY_TIMEOUT_MS` 在强制范围内调整。

这个 SQLite 档位仅适合同主机。不要把它放在 NFS、SMB 或云文件系统上。跨主机
副本可以显式使用 PostgreSQL 共享有界任务生命周期：

```bash
export AI_GATEWAY_A2A_TASK_STORE_MODE=postgres
export AI_GATEWAY_A2A_TASK_STORE_CENTRAL_REQUIRED=true
export AI_GATEWAY_A2A_TASK_STORE_POSTGRES_URL='<secret>?sslmode=verify-full'
export AI_GATEWAY_A2A_TASK_STORE_NAMESPACE=production
```

PostgreSQL 模式使用数据库时钟 TTL、事务维护的全局/owner 容量计数器、task-scoped
事务锁、单调 status timestamp 保护、SHA-256 腐坏检测、repeatable-read 分页和固定
参数化表。它还会自动启用基于服务端 tenant + 已认证 owner + task 的数据库时钟执行
lease：同一时刻只有一个副本持有 lease，heartbeat 负责续租，检测到 lease 丢失时抑制
结果，其他副本收到取消时也能撤销正确 tenant 作用域的 lease。原始 lease token 只在
执行器内存存在，PostgreSQL 仅保存 digest 和单调 fence。非 loopback URL 强制
`sslmode=verify-full`；健康与指标不暴露 URL、
namespace、任务正文或数据库错误文本。

任务会有意保存 A2A history、metadata 和 artifacts，应使用最小权限数据库角色、
静态加密、有界留存及经过演练的备份/删除流程。SHA-256 能发现偶发或未同步重算的
修改，但不能抵抗同时重写任务和 hash 的数据库攻击者。执行 lease 能阻止通过本网关
同时持有有效执行权，并把 fence 传入内部 Workforce context；但发布结果前的验证与
下游 TaskStore 写入并非同一原子事务，仍存在很窄的 revoke/commit 竞态。provider
操作及每一个不可逆 sink 仍需独立拒绝陈旧 fence，已经运行的工作仍是协作式取消，
因此不能声称 exactly-once。数据库故障切换、网络分区和 split-brain 也仍需独立证据。

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
- 任务始终有界，并按认证 owner 和企业租户隔离；默认 memory 模式重启不保留，
  显式 SQLite 模式可在同一主机上重启恢复，PostgreSQL 可跨主机共享状态和 fenced
  execution ownership。
- 官方请求处理器提供 `SendMessage`、`GetTask`、`ListTasks` 和 `CancelTask`。
  其他副本可以撤销 tenant-scoped PostgreSQL lease，但取消仍是协作式的，不能保证
  已经运行的 provider 操作被真正中断。
- 当前档位没有启用流式、推送通知、gRPC、HTTP+JSON/REST、非文本 Part 或
  fence-aware 不可逆 side-effect sink。持久/分布式任务与 Agent Card 签名仍是显式部署选项。

运行 `pnpm verify:public-clone` 可得到无需凭据的官方客户端验证结果。已发布的
`v0.5.0` 网关镜像和当前源码均包含这个 A2A 档位；当前源码还包含 PR #115
跟踪的发布后加固。
