# Phase3981A Safety Boundary

## Defaults

- 默认不读取 `.env`、`auth.json`、raw secret、raw API key、token、credential 原文。
- 默认不打印 Authorization header、API key、secret、CredentialRef 解析后的明文值。
- 默认不调用真实 Provider；本阶段只承认 owner 已表达后续可真实调用模型，但本阶段没有执行真实 Provider 调用。
- 默认不 deploy、不 release、不 tag、不 artifact upload、不 commit、不 push。
- 默认不修改 `legacy/`。
- 默认不修改 `PROJECT_CONTEXT.md`。
- 默认不修改 `/chat`。
- 默认不修改 `/chat-gateway/execute`。
- 默认不把 dry-run、preview、template、approval-ready 写成已经真实完成。

## Real Provider Test Conditions

- `ownerApprovalPacket.providerCallAllowed` 必须为 true。
- `credentialRefOnly` 必须为 true。
- `rawSecretPrintAllowed` 必须为 false。
- `maxRequests` 首次必须小于等于 1，除非后续阶段另有明确批准。
- provider allowlist 必须明确列出 provider 和 model。
- 失败、timeout、rate limit 不得写成 pass。

## Real Deployment Conditions

- 需要单独 deploy approval packet。
- 需要回滚路径、健康检查、发布范围、责任人和窗口期。
- 本阶段没有 deploy approval，也没有执行部署。

## Owner Confirmation Conditions

- 真实 Provider 调用、GVC 真实 mutation、Workforce 多 worker 真执行、三模式接入默认主链、Windows Task Scheduler 注册、deploy/release/push/commit 都必须有明确 owner confirmation。
- owner confirmation 只授权指定动作，不自动授权无限后续动作。
