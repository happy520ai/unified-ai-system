# Phase574 Execution Report

## 结论

Phase574 已新增“试用一个任务”sample dry-run 体验入口，解决当前 Mission Control 作为控制台可见但试用者不知道第一步该做什么的问题。

本阶段没有恢复人物模块，没有调用 provider，没有读取 secret，没有部署，没有修改 `/chat` 或 `/chat-gateway/execute`。

## 修改文件

- `apps/ai-gateway-service/src/ui/components/ScenarioTrialPanel.js`
- `apps/ai-gateway-service/src/ui/components/ScenarioDryRunResultPanel.js`
- `apps/ai-gateway-service/src/ui/copy/scenarioTrialCopy.js`
- `apps/ai-gateway-service/src/ui/components/MissionControlPanel.js`
- `apps/ai-gateway-service/src/ui/consolePage.js`
- `tools/phase574/validate-scenario-based-first-real-trial-experience.mjs`
- `docs/phase574-scenario-based-first-real-trial-experience.md`
- `docs/phase574-execution-report.md`
- `apps/ai-gateway-service/evidence/phase574/scenario-based-first-real-trial-experience-result.json`

## 最小改动说明

- 新增 Scenario trial copy，集中维护 sample task、dry-run 边界和步骤说明。
- 新增 Scenario trial 入口组件，使用锚点动作展示体验路径，不绑定真实执行。
- 新增 Scenario dry-run result 组件，展示任务理解、模式推荐、安全检查、Provider 边界、Evidence Replay 和下一步建议。
- 在 Mission Control 首屏挂载 Scenario trial 区域。
- 在 Workbench CSS 中补充 sample task、步骤卡片、模式解释和 Evidence preview 的样式。
- 新增 Phase574 真实浏览器 verifier，生成截图、DOM snapshot 和 evidence JSON。

## Dry-Run 链路

本次 sample task 展示的链路为：

用户任务 -> Mission Understanding -> Recommended Mode: Tianshu -> Security Shield guarded -> Provider / CredentialRef no-provider-call -> Evidence Replay preview -> Next Step guidance。

## 真实浏览器 Evidence

已生成：

- `apps/ai-gateway-service/evidence/phase574/phase574-mission-control-with-sample-task.png`
- `apps/ai-gateway-service/evidence/phase574/phase574-sample-task-dry-run-result.png`
- `apps/ai-gateway-service/evidence/phase574/phase574-security-shield-sample.png`
- `apps/ai-gateway-service/evidence/phase574/phase574-evidence-replay-sample.png`
- `apps/ai-gateway-service/evidence/phase574/phase574-provider-boundary-sample.png`
- `apps/ai-gateway-service/evidence/phase574/phase574-rendered-dom-snapshot.html`

## 安全边界

- providerCallsMade=false
- nonNvidiaProviderCallsMade=false
- secretValueExposed=false
- rawSecretAccessed=false
- deployExecuted=false
- releaseExecuted=false
- tagCreated=false
- artifactUploaded=false
- billingExecuted=false
- invoiceGenerated=false
- chatGatewayRuntimeModified=false
- workspaceCleanClaimed=false

## 推荐封板

`recommended_sealed=true`

当前 blocker：null

## 下一步建议

进入 Phase575：基于 Phase574 的 sample dry-run 入口重新准备非 Codex 真人试用指引，让 2-3 位真实内部试用者先完成 sample task 链路，再填写 Phase572/Phase573 的理解反馈表。
