# Phase3988A 系统完成度缺口审计

## 阶段目标

在不修改 `legacy/`、不触发真实 Provider、不开启 deploy/release 的前提下，审计当前 unified-ai-system 是否已经达到“除生产部署上线之外，所有板块都真实实现并打通”的状态，并把结论固化为可验证 evidence。

## 已验证事实

- 当前 `/ui` 一级导航只有 5 个页面：`chat`、`models`、`approvals`、`files`、`diagnostics`。
- Chat 页发送动作真实调用 `POST /chat-gateway/execute`，并显示 `providerCalled`、`completionVerified`、`evidenceId`。
- 模型下拉经过 `smoke_passed + selectable + directChatAllowed + capabilityBucket` 过滤，不会把未验证模型混入普通聊天。
- 审批链存在真实路由：`/approvals`、`/approvals/create`、`/approvals/{id}/approve|reject`、`/local-operation/apply-approved`。
- 本地智能体相关路由存在：`/local-agent/intent-preview`、`/local-agent/operation-plan`、`/local-agent/patch-proposal`。
- Workforce 本地执行链存在：`POST /workforce/run-local`，会写本地 evidence，但不会调用 Provider、不会改项目业务文件。
- Provider 配置中心会隐藏密钥明文，保存按钮不会回显 API Key。

## 审计结论

当前不能声称“除部署外全部板块都已真实实现并打通”。

### 原因 1：Workbench 一级板块不完整

你要求的这些板块：

- 模型配置页面
- Chat 页面
- 本地智能体页面
- 审批任务页面
- 安全修复页面
- 使用帮助页面
- 系统诊断页面

当前真正作为一级页面存在的只有：

- Chat
- 模型
- 任务
- 文件
- 诊断

缺口：

- 本地智能体没有独立一级页
- 安全修复没有独立一级页
- 使用帮助没有独立一级页
- `files` 页当前是文件登记，不等于安全修复
- `diagnostics` 页兼带部分设置语义，不等于完整帮助/设置体系

### 原因 2：多 Provider 没有真正全链打通

- `provider-config/save` 允许 `nvidia` / `openrouter`
- 但 `provider-config/status` 实际只读 NVIDIA 状态
- `provider-config/test` 直接走 `createNvidiaUnifiedClient().chatCompletion()`
- 前端 `selectedProvider` 固定为 `nvidia`
- `capabilitySafeExecutionRouter` 明确阻断非 NVIDIA 的真实执行

因此当前不是多 Provider 配置、选择、测试、执行四段一致打通，只是：

- NVIDIA 主链可用
- 其他 Provider 仍处于未来槽位或局部入口状态

### 原因 3：本地智能体/安全修复是“路由存在，产品入口未完成”

- 后端已有 local-agent preview / operation-plan / patch-proposal / apply-approved
- 但当前 `/ui` 没有独立本地智能体一级页
- 安全修复也没有独立一级页

这类能力不能算“产品面完整打通”，只能算：

- 后端能力存在
- 局部 UI 能触发
- 但信息架构和一级入口未完成

### 原因 4：阶段状态文件仍有滞后

- `docs/project-brain/opencode-autopilot-state.json` 已经显示 `Phase3979A` 通过
- `docs/phase-orchestrator/current-phase-state.json` 仍停在 `Phase1955P-Retry-Fail`

这说明项目状态追踪还没有完全跟上现状，审计链不能声称“阶段管理已完全同步”。

## 当前可成立的说法

- Chat Gateway 主链已经接通，且 evidence/gate 规则真实存在
- 模型库 selectable gate 已经接入 UI 和后端执行链
- 审批任务链和本地安全 apply 链已具备真实路由
- Workforce 本地编排链已经存在并能落盘 evidence
- 当前仍未达到“除部署外全部板块都已真实实现”的状态

## 当前 blocker

- `local_agent_top_level_page_missing`
- `safe_repair_top_level_page_missing`
- `help_top_level_page_missing`
- `provider_config_test_nvidia_only`
- `chat_gateway_real_execution_nvidia_only`
- `phase_orchestrator_state_stale`

## 不可声称的能力

- 不可声称多 Provider 已全部真实打通
- 不可声称 Workbench 板块已经完全符合目标信息架构
- 不可声称所有模块都已实现
- 不可声称 workspace clean
- 不可声称生产可用或已可上线

## 本阶段验证命令

- `node --check apps/ai-gateway-service/src/entrypoints/verifyPhase3988ASystemCompletionGapAudit.js`
- `pnpm verify:phase3988a-system-completion-gap-audit`
- `pnpm verify:phase321a-workbench-product-recovery`
- `pnpm verify:phase107a-secret-safety`
- `pnpm health:phase12a`
- `pnpm doctor:phase13a`
- `pnpm verify:safe-regression-matrix`
- `pnpm -r --if-present check`
- `pnpm sync:readme-agents-current-state`
- `pnpm verify:phase306c-readme-agents-auto-sync-guard`

## 下一阶段建议

优先进入 `Phase3989A`：

- 不改默认 `/chat`
- 不动 deploy/release
- 只修 Workbench 一级信息架构缺口
- 把“本地智能体 / 安全修复 / 使用帮助 / 诊断”变成真实可达、非空壳、按钮可用的独立页面
- 保持 Provider 调用仍默认受控
