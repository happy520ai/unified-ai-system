# Phase3981A Restricted Capability Graduation Ledger

## One-line Definition

本阶段把五个受限能力从 preview/dry-run/gated 状态升级为 owner-authorized real-use ready 状态，但不默认放开、不改默认 `/chat`、不读取 secret、不部署。

## Current Graduation Status

| capabilityId | owner-facing name | previous state | graduated state | default enabled | real-use gate |
| --- | --- | --- | --- | --- | --- |
| workforce.multi_agent.execution | Workforce 多 Agent 执行 | preview_only | ready_for_owner_authorized_real_use | false | ownerApprovalPacket.capabilities includes workforce.multi_agent.execution; maxWorkers <= 3 for first real run; executionEnabled=true; no 144-worker fanout until staged evidence passes |
| gvc.automatic_repair_cycle | GVC 自动修复循环 | dry_run_gated | ready_for_owner_authorized_real_use | false | ownerApprovalPacket.capabilities includes gvc.automatic_repair_cycle; allowedFiles are explicit; maxFilesChanged <= 1 for first real run; rollback plan exists before mutation |
| provider.multi_provider.real_call | 多 Provider 真实调用 | default_off_requires_explicit_approval | ready_for_owner_authorized_real_use | false | ownerApprovalPacket.providerCallAllowed=true; credentialRefOnly=true; rawSecretPrintAllowed=false; maxRequests <= 1 per provider for first smoke; provider allowlist is explicit |
| mode.normal_god_tianshu.runtime | 三模式 Normal/God/Tianshu | code_exists_not_default_main_chain | ready_for_owner_authorized_isolated_real_use | false | Use isolated non-default route or command; do not modify default /chat or /chat-gateway/execute; ownerApprovalPacket.capabilities includes mode.normal_god_tianshu.runtime |
| nightly.scheduler.real_registration | 夜间自动任务调度 | script_ready_scheduler_unregistered | ready_for_manual_permissioned_registration | false | Manual administrator registration or explicit owner-approved scheduler registration intake; Phase632 preflight; no provider/secret/deploy actions in nightly task |

## Important Truth Boundary

- `ready_for_owner_authorized_real_use` means the capability now has an explicit approval packet, bounded first-run rule, evidence rule, stop condition, and rollback rule.
- It does not mean 144 workers already ran.
- It does not mean GVC has already mutated production source in this phase.
- It does not mean this phase called MiMo, OpenAI, Claude, OpenRouter, NVIDIA, or any paid provider.
- It does not mean Windows Task Scheduler has already been registered.
- It does not mean `/chat` or `/chat-gateway/execute` has been changed.

## Read Scope

- package.json
- docs/project-brain/opencode-autopilot-policy.json
- docs/automation/opencode-autopilot-task-queue.json
- docs/system-atlas/CURRENT_CAPABILITY_LEDGER.md
- docs/system-atlas/SAFETY_BOUNDARY_MAP.md
- apps/ai-gateway-service/src/providers/credentialRefResolverRuntime.contract.js

## Forbidden Paths Skipped

- legacy/
- PROJECT_CONTEXT.md
- .env
- .env.local
- .env.production
- auth.json
- secrets/
- apps/ai-gateway-service/src/routes/chat/
- apps/ai-gateway-service/src/routes/chat-gateway/
