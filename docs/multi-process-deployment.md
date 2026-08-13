# 多进程部署指南（横向扩展 / HA 数据层）

> 本文说明如何用**多个 gateway 进程 + 共享 SQLite 存储 + nginx 负载均衡**做横向扩展。
> 诚实边界：当前完成的是**数据层就绪**（状态存储支持跨进程 SQLite）。完整 HA 还需把内存态（healthScorer、限流、RBAC 用户角色）无状态化或外置，本文只覆盖数据层这一半。

---

## 一、为什么需要 SQLite 后端

gateway 原本用本地 JSON 文件存状态（计划、用户、凭据），配合进程内互斥锁。这在**单进程**下够用，但**多进程部署时每个实例各自写自己的文件**，状态会分裂、互相覆盖。

SQLite（`node:sqlite`，Node 22 内置）提供 ACID + WAL，多个进程可以安全地读写**同一个数据库文件**，是数据层横向扩展的基础。

---

## 二、三个 SQLite 开关

| 状态存储 | 模式开关 | 路径开关 | 默认路径（未配置时） |
| --- | --- | --- | --- |
| 计划（workforcePlanStore） | `WORKFORCE_PLAN_STORE_MODE=sqlite` | `WORKFORCE_PLAN_STORE_PATH` | `<tmpdir>/unified-ai-system/workforce-plans.json` |
| 用户/令牌（enterpriseGovernanceService） | `PME_ENTERPRISE_USER_STORE_MODE=sqlite` | `PME_ENTERPRISE_USER_STORE_PATH` | `.data/enterprise/users.json` |
| 运行时凭据（runtimeCredentialStore） | `PME_RUNTIME_CREDENTIAL_STORE_MODE=sqlite` | `PME_RUNTIME_CREDENTIAL_STORE_PATH` | `<LOCALAPPDATA>/PME-Moving-Earth/unified-ai-system/runtime-credentials.json` |

> 说明：模式开关设为 `sqlite` 时，**路径开关指向的文件会被当作 SQLite 数据库**。建议路径改用 `.db` 扩展名以表意清晰（如 `/data/gateway/plans.db`）。默认（不设模式开关）仍是原 JSON 文件后端，行为不变。

---

## 三、部署步骤

### 1. 准备共享存储目录

所有实例都要能访问同一个目录（本地多实例用同一路径；跨机器用共享卷，如 NFS / 云磁盘）：

```bash
mkdir -p /data/gateway/state
```

### 2. 配置三个 SQLite 开关（写入 `.env`）

```bash
# 计划存储
WORKFORCE_PLAN_STORE_MODE=sqlite
WORKFORCE_PLAN_STORE_PATH=/data/gateway/state/workforce-plans.db

# 用户/令牌
PME_ENTERPRISE_USER_STORE_MODE=sqlite
PME_ENTERPRISE_USER_STORE_PATH=/data/gateway/state/enterprise-users.db

# 运行时凭据
PME_RUNTIME_CREDENTIAL_STORE_MODE=sqlite
PME_RUNTIME_CREDENTIAL_STORE_PATH=/data/gateway/state/runtime-credentials.db
```

### 3. 启动多个实例（不同端口）

```bash
# 实例 1
AI_GATEWAY_SERVICE_PORT=3100 pnpm gateway serve &
# 实例 2
AI_GATEWAY_SERVICE_PORT=3101 pnpm gateway serve &
# 实例 3
AI_GATEWAY_SERVICE_PORT=3102 pnpm gateway serve &
```

每个实例指向同一份 `.env`（同一组 SQLite 文件），状态即共享。

### 4. nginx 负载均衡（改造 `deploy/nginx.conf` 的 upstream）

```nginx
upstream ai_gateway {
    server 127.0.0.1:3100;
    server 127.0.0.1:3101;
    server 127.0.0.1:3102;
    keepalive 32;
}
```

其余 TLS / WebSocket / SSE 配置保持不变（`deploy/nginx.conf` 已含）。

---

## 四、注意事项

1. **SQLite 文件权限**：运行时凭据含明文 API key，SQLite 后端已自动 `chmod 0o600`。计划/用户存储不强制，但建议放在权限受限的目录。
2. **WAL 多进程安全**：SQLite 后端已启用 `PRAGMA journal_mode=WAL`，多进程并发读写安全。
3. **内存态仍是单实例**：`healthScorer`（provider 健康分数）、`rateLimiter`（限流计数）、`advancedRBAC`（用户角色）是内存态，多实例下各自独立、不共享。这些是下一步"无状态化/外置"的范畴。
4. **不要混用后端**：同一批实例必须用同一种存储模式（都 `sqlite` 或都 `json`），不要一个 sqlite 一个 json。

---

## 五、当前状态与下一步

| 项 | 状态 |
| --- | --- |
| 四个状态存储支持 SQLite | ✅ 已实现（env 开关，默认 json 向后兼容） |
| 读改写原子化（跨进程无 lost update） | ✅ 四个后端全部改为原子 upsert/remove，经多进程并发验证（workforcePlanStore 3 进程并发 30/30） |
| 多进程共享状态 | ✅ 数据层完整 |
| 内存态无状态化 / 外置 | ⚠️ 部分（`advancedRBAC` 已 SQLite 化；`rateLimiter` 计数高频、`healthScorer` 软状态无需共享） |
| 完整 HA（会话亲和、故障转移） | ❌ 未做 |

**下一步建议**：`rateLimiter` 计数外置（高频，建议 Redis 而非 SQLite）、会话亲和 + 故障转移，即可接近完整 HA。
