# PME 移动地球企业部署运行手册

本文是 Phase39A 的企业部署交付手册。它把当前已经验证过的默认命令集、企业治理能力、知识库能力、向量链路和启动自检口径收成一套可操作流程。它不新增业务能力，也不代表 SSO/IAM、K8s、CI/CD、SIEM 或外部治理平台已经完成。

## 1. 当前交付边界

当前系统已经具备以下真实可用能力：

- NVIDIA single-provider 默认 `/chat` 主链。
- Chat-first Web 前台：`http://127.0.0.1:3100/ui`。
- 本地知识库：local-keyword / file-sqlite 日常持久化。
- 显式向量链路：Gemini embedding + pgvector，在配置后通过 `verify:phase23` 复验。
- 企业治理基础：token auth、tenant、RBAC、audit、managed user lifecycle。
- 企业运维基础：deployment readiness、hash-only backup、restore validation dry-run。
- 企业启动自检：redacted startup readiness，不暴露 secret 值。
- 企业部署前可视化预检：Web console 里的 read-only preflight 面板聚合 service health、deployment readiness、startup readiness、security readiness 和 vector readiness。

当前仍不代表以下能力已经完整交付：

- DataEyes。
- SSO/SAML/OIDC 或完整 IAM。
- SCIM / 目录同步 / MFA。
- SIEM / 合规工单 / 审计保全。
- K8s / Docker / IaC / release automation。
- 外部连接器同步、production GraphRAG、长期记忆治理平台。

## 2. 关键入口

默认 Web 入口：

```text
http://127.0.0.1:3100/ui
```

默认日常命令：

```powershell
cmd /c pnpm help:phase14a
cmd /c pnpm dev:phase7b
cmd /c pnpm status:phase10a
cmd /c pnpm health:phase12a
cmd /c pnpm logs:phase16a
cmd /c pnpm idle:phase15a
```

企业验收命令：

```powershell
cmd /c pnpm verify:enterprise
cmd /c pnpm verify:phase37a
cmd /c pnpm verify:phase38a
cmd /c pnpm verify:phase40a
cmd /c pnpm verify:phase41a
cmd /c pnpm verify:phase42a
cmd /c pnpm verify:phase43a
cmd /c pnpm verify:phase44a
cmd /c pnpm verify:phase45a
cmd /c pnpm verify:phase46a
cmd /c pnpm verify:phase47a
cmd /c pnpm verify:phase48a
```

知识库验收命令：

```powershell
cmd /c pnpm verify:phase21
cmd /c pnpm verify:phase22
cmd /c pnpm verify:phase23
cmd /c pnpm verify:phase24
```

## 3. 配置文件模板

企业部署模板文件：

```text
.env.enterprise.example
```

使用原则：

1. 不要把真实密钥写回模板。
2. 不要提交真实 `.env`。
3. 生产环境优先使用系统环境变量或 secret manager。
4. `NVIDIA_API_KEY`、`KNOWLEDGE_EMBEDDING_API_KEY`、`PGVECTOR_CONNECTION_STRING`、`PME_AUTH_TOKEN` 都必须按 secret 处理。
5. Supabase pgvector 必须优先使用 Dashboard 提供的 pooler URI；当前环境已确认 direct host `db.<project>.supabase.co:5432` 不可靠。

Supabase pooler URI 通常类似：

```text
postgresql://postgres.<project-ref>:<password>@<region>.pooler.supabase.com:6543/postgres
```

## 4. 最小上线前检查

### 4.1 本地命令与代码检查

```powershell
cmd /c pnpm help:phase14a
cmd /c pnpm -r --if-present check
```

预期：

- `help:phase14a` 打印默认命令总览。
- workspace check 全部通过。

### 4.2 企业聚合检查

```powershell
cmd /c pnpm verify:enterprise
```

预期：

- Phase32A 到 Phase38A 均通过。
- 企业 auth、RBAC、audit、user lifecycle、backup、startup readiness 均有可复核证据。
- evidence 不包含 plaintext token 或 API key。

### 4.3 真实启动检查

先设置真实 NVIDIA 与企业环境变量，再启动：

```powershell
cmd /c pnpm dev:phase7b
cmd /c pnpm status:phase10a
cmd /c pnpm health:phase12a
cmd /c pnpm logs:phase16a
```

预期：

- `status:phase10a` 为 `running`。
- `health:phase12a` 通过。
- `logs:phase16a` 只读取 managed state 中记录的 logPath。

### 4.4 企业启动自检

启动服务后，在 Web UI 的企业区域查看 startup readiness，或通过受保护接口读取：

```text
GET /enterprise/startup/readiness
```

请求必须带企业 token：

```text
x-pme-auth-token: <your-token>
x-pme-tenant-id: default
```

预期：

- `status` 为 `ready`。
- `enterprise_auth_enabled` 为 ready。
- `nvidia_api_key_present` 为 ready。
- secret 只显示 `present: true` 和 `valueExposed: false`。
- 不返回真实 API key、token 或数据库密码。

### 4.5 企业部署前可视化预检

启动服务后打开：

```text
http://127.0.0.1:3100/ui
```

在能力面板中填写企业 token 和 tenant，然后点击：

```text
Run deployment preflight
```

该按钮只读聚合以下现有接口：

- `GET /health/check`
- `GET /enterprise/deployment/readiness`
- `GET /enterprise/startup/readiness`
- `GET /enterprise/security/readiness`
- `GET /knowledge/infra/readiness`

验证命令：

```powershell
cmd /c pnpm verify:phase40a
```

预期：

- UI 中能看到部署预检入口。
- service health、deployment readiness、startup readiness、security readiness 可被复核。
- 未携带 token 访问受保护 readiness 仍会被拒绝。
- 结果只显示 readiness 和 secret presence，不显示真实密钥。

### 4.6 Enterprise config wizard

After the service is running, open:

```text
http://127.0.0.1:3100/ui
```

Use the Enterprise config wizard panel to paste a private `.env` draft and click `Check config locally`.

Validation command:

```powershell
cmd /c pnpm verify:phase41a
```

Expected behavior:

- The pasted config is parsed in the browser only.
- The wizard reports missing required settings and secret presence.
- Secret values are not uploaded, saved, echoed, logged, or written to evidence.
- This is a local configuration check only; it is not a secret manager, IAM provisioning system, or deployment automation.

### 4.7 Enterprise handoff manifest

The handoff manifest is:

```text
docs/ENTERPRISE_HANDOFF_MANIFEST.md
```

Validation command:

```powershell
cmd /c pnpm verify:phase42a
```

Expected behavior:

- It checks delivery docs, this runbook, operation manual, `.env.enterprise.example`, enterprise scripts, and Web console safety markers.
- It is read-only.
- It does not provision infrastructure, create releases, run release automation, mutate runtime configuration, or record secret values.

### 4.8 Enterprise acceptance report

The acceptance report is:

```text
docs/ENTERPRISE_ACCEPTANCE_REPORT.md
```

Validation command:

```powershell
cmd /c pnpm verify:phase43a
```

Expected behavior:

- It summarizes existing evidence, required docs, command coverage, and boundary markers.
- It is read-only over existing artifacts.
- It does not call providers, provision infrastructure, create releases, run release automation, mutate runtime data, or record secret values.

### 4.9 Enterprise acceptance report Web view

The Web console exposes the acceptance report through a protected read-only
route:

```text
GET /enterprise/acceptance/report
```

Validation command:

```powershell
cmd /c pnpm verify:phase44a
```

Expected behavior:

- The `/ui` enterprise panel contains the acceptance report view.
- The route reads the existing Phase43A report and evidence only.
- An enterprise auditor/admin token is required when enterprise auth is enabled.
- It does not call providers, mutate runtime data, provision infrastructure,
  create releases, run release automation, or record secret values.

### 4.10 Enterprise release-candidate dry-run

Validation command:

```powershell
cmd /c pnpm verify:phase45a
```

Expected behavior:

- It reads the current delivery docs, operation manual, safe environment
  template, enterprise scripts, existing evidence, Web console markers, and
  boundary wording.
- It reports whether the current handoff set is complete enough to treat as a
  release candidate for manual delivery review.
- It does not create packages, publish releases, call providers, mutate runtime
  data, provision infrastructure, run release automation, or record secret
  values.

### 4.11 Enterprise release-candidate Web view

The Web console exposes the release-candidate dry-run result through a
protected read-only route:

```text
GET /enterprise/release-candidate/dry-run
```

Validation command:

```powershell
cmd /c pnpm verify:phase46a
```

Expected behavior:

- The `/ui` enterprise panel contains the release-candidate dry-run view.
- The route reads the existing Phase45A evidence only.
- An enterprise auditor/admin token is required when enterprise auth is enabled.
- It does not create packages, publish releases, call providers, mutate runtime
  data, provision infrastructure, run release automation, or record secret
  values.

### 4.12 Enterprise overview Web view

The Web console exposes a consolidated enterprise overview through a protected
read-only route:

```text
GET /enterprise/overview
```

Validation command:

```powershell
cmd /c pnpm verify:phase47a
```

Expected behavior:

- The `/ui` enterprise panel contains the enterprise overview view.
- The route aggregates existing governance health, deployment readiness,
  startup readiness, security readiness, vector readiness, acceptance evidence,
  and release-candidate dry-run evidence.
- An enterprise auditor/admin token is required when enterprise auth is enabled.
- It does not call providers, mutate runtime data, create packages, publish
  releases, provision infrastructure, run release automation, or record secret
  values.

## 5. 知识库上线检查

默认本地知识库：

```powershell
cmd /c pnpm verify:phase21
cmd /c pnpm verify:phase22
cmd /c pnpm verify:phase24
```

预期：

- `POST /knowledge/load` 可装载 source/document。
- `POST /knowledge/retrieve` 可返回 topHit、snippet、highlights、matchedTerms、scoreBreakdown、metadata。
- managed daily startup 使用 file-sqlite 时，导入文档在重启后仍可恢复。

显式向量链路：

```powershell
cmd /c pnpm verify:phase23
```

预期：

- 仅当 `KNOWLEDGE_INFRA_MODE=vector` 且 embedding / pgvector 配置完整时，真实 probe 才能通过。
- 通过时代表 Gemini embedding -> pgvector write/read/retrieve 链路已接通。
- 未配置时不影响默认 local-keyword 日常使用。

## 6. 企业备份与恢复验证

当前备份能力是 hash-only JSON backup，不导出 plaintext token。

验证命令：

```powershell
cmd /c pnpm verify:phase37a
```

受保护能力：

- `POST /enterprise/backup`
- `POST /enterprise/restore/validate`

当前 restore 只做 validation dry-run，不会修改 live service。不要把它理解成完整在线恢复系统。

## 7. 上线 Go / No-Go 规则

可以进入日常使用态的最低条件：

- `cmd /c pnpm -r --if-present check` 通过。
- `cmd /c pnpm verify:enterprise` 通过。
- `cmd /c pnpm verify:phase45a` 通过；这只代表交付候选只读检查通过，不代表已经创建发布包或完成 release automation。
- `cmd /c pnpm verify:phase46a` 通过；这只代表 Web 只读查看入口通过，不代表已经创建发布包或完成 release automation。
- `cmd /c pnpm verify:phase47a` 通过；这只代表企业总览只读聚合入口通过，不代表已经创建发布包或完成 release automation。

### 4.13 Enterprise overview readable summary

The Web console renders the same enterprise overview as a one-screen read-only
summary for operators. The raw JSON remains available below the summary for
diagnosis.

```powershell
cmd /c pnpm verify:phase48a
```

This check validates the `/ui` summary marker, renderer, protected overview
route, read-only safety flags, and secret redaction. It must not call
providers, mutate runtime data, package artifacts, publish releases, provision
infrastructure, or run release automation.
- `cmd /c pnpm verify:phase21`、`verify:phase22`、`verify:phase24` 通过。
- 真实启动后 `status:phase10a` 为 running。
- startup readiness 没有 blocker。
- 真实 secret 不出现在日志、evidence、HTTP 响应或文档中。

必须暂停上线的情况：

- enterprise auth 开启但没有 active admin token。
- startup readiness 出现 blocker。
- `NVIDIA_API_KEY` 缺失但要求真实 `/chat`。
- vector 模式开启但 pgvector / embedding 未配置完整。
- audit path、backup dir、knowledge persistence path 指向不可写目录。
- evidence 或 backup 中出现 plaintext token。

## 8. 日常操作流程

启动：

```powershell
cmd /c pnpm dev:phase7b
```

查看状态：

```powershell
cmd /c pnpm status:phase10a
```

查看健康：

```powershell
cmd /c pnpm health:phase12a
```

查看日志：

```powershell
cmd /c pnpm logs:phase16a
```

安全停止并归零：

```powershell
cmd /c pnpm idle:phase15a
cmd /c pnpm status:phase10a
```

## 9. 常见故障

`dev:phase7b` 不返回：

- 正常。它是 managed long-running start。
- 另开一个终端运行 `cmd /c pnpm status:phase10a`。

`status` 是 `stale`：

- 表示 managed state 里记录的 owner PID 已不再运行。
- 先执行 `cmd /c pnpm idle:phase15a`，再重新启动。

`NVIDIA_REQUEST_TIMEOUT`：

- 通常是真实 provider 请求超时。
- 启动阶段可记录 warning；真实 provider 验证仍看 `health:phase12a`、`verify:phase7a`、`verify:phase8a-4`。

`verify:phase23` 失败：

- 优先检查 embedding key、provider/model、pgvector pooler URI、表名、namespace。
- 不要使用 Supabase direct host `db.<project>.supabase.co:5432`。

PowerShell / pnpm 出现 EPERM：

- 先确认没有其他进程占用文件。
- 在受限 sandbox 中，pnpm 可能需要提升权限运行。
- 不要用 broad kill；优先使用 `cmd /c pnpm idle:phase15a`。

## 10. 缺陷上报模板

```text
复现命令：
实际失败：
期望表现：
唯一失败点：
关键输出：
```

## 11. Phase39A 正式结论

Phase39A 是企业部署配置模板与部署运行手册收口。它把企业生产启动前的配置、检查、日常操作、备份验证、向量链路验证和故障上报统一成可执行说明。

它不新增命令、不改业务代码、不新增依赖，也不把当前系统虚假包装成完整 IAM、SSO、SIEM、K8s 或 release automation 平台。
