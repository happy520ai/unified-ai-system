# Phase1964A Five Capability UI Visual Smoke

## 目标

验证五大能力真实可用面板在真实本地浏览器中可见、可点击、可展示结果，并保留截图、DOM 和 evidence。

## 范围

- 包含 `/ui#five-capability-activation-panel` 的真实浏览器打开。
- 包含点击“一键激活五大能力”。
- 包含检查 `/real-capabilities/status` 与 `/real-capabilities/activate-five` 链路。
- 不包含生产部署。
- 不包含公开发布。
- 不调用 Provider，不读取密钥，不修改 Codex 配置。

## 安全边界

- `providerCallsMade=false`
- `paidApiCalled=false`
- `secretValueExposed=false`
- `authJsonRead=false`
- `codexConfigModified=false`
- `chatRouteModified=false`
- `chatGatewayExecuteModified=false`
- `deployExecuted=false`
- `releaseExecuted=false`
- `commitCreated=false`
- `pushExecuted=false`
- `workspaceCleanClaimed=false`

## 验证命令

```powershell
cmd /c pnpm run smoke:phase1964a-five-capability-ui-visual-smoke
cmd /c pnpm run verify:phase1964a-five-capability-ui-visual-smoke
```

## Evidence

- `apps/ai-gateway-service/evidence/phase1964a/five-capability-ui-visual-smoke-run-result.json`
- `apps/ai-gateway-service/evidence/phase1964a/five-capability-ui-visual-smoke-result.json`
- `apps/ai-gateway-service/evidence/phase1964a/five-capability-ui-visual-smoke.html`
- `apps/ai-gateway-service/evidence/phase1964a/screenshots/five-capability-ui-visual-smoke.png`
