# Phase3981A Rollback Runbook

## Global Rollback

- Revoke the owner approval packet.
- Set each capability runtime flag back to false.
- Preserve all evidence files and command summaries.
- Do not delete failure evidence to make a phase look clean.
- Do not claim workspace clean.

## Capability Rollback

### Workforce 多 Agent 执行

- Capability ID: workforce.multi_agent.execution
- Rollback: Set executionEnabled=false, clear active worker lease, stop queue intake, preserve evidence, and return to preview mode.

### GVC 自动修复循环

- Capability ID: gvc.automatic_repair_cycle
- Rollback: Apply recorded reverse patch or restore exact pre-mutation content hash, then rerun the verifier that proved the failure.

### 多 Provider 真实调用

- Capability ID: provider.multi_provider.real_call
- Rollback: Disable provider runtime gate, revoke the approval packet, keep model selectable state unchanged unless smoke evidence explicitly passes.

### 三模式 Normal/God/Tianshu

- Capability ID: mode.normal_god_tianshu.runtime
- Rollback: Disable isolated mode route flag and keep default /chat and /chat-gateway/execute unchanged.

### 夜间自动任务调度

- Capability ID: nightly.scheduler.real_registration
- Rollback: Run unregister script, verify task is absent, set nightlyAutomationEnabled=false, and preserve registration/removal evidence.
