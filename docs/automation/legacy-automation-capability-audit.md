# Phase1881A Legacy Automation Capability Audit

## Boundary

- Phase: Phase1881A
- Route: Route A / local_self_use_only
- Scope: legacy/ai-gateway-workspace, legacy/claudcodesrc-ponponon-master
- Legacy modified: false
- Legacy scripts executed: false
- Provider calls made: false
- Secret value exposed: false
- Deploy executed: false
- Chat modified: false
- Chat Gateway execute modified: false

## Answer

Legacy contains automation-related capabilities. Phase1881A audited them as read-only legacy assets only. They are not current Owner OS or Owner Automation Kernel capabilities.

## Candidate File Inventory

- Total candidate files: 4989
- Content files read for keyword classification: 4656
- Content files skipped by size/path/content-safety rule: 333

## Package Scripts

| package | name | script count | script names |
| --- | --- | ---: | --- |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/package.json | @anthropic-ai/claude-code | 1 | prepare |
| legacy/ai-gateway-workspace/.codex-audit-worktree/mnt/data/pme-runtime-v1/package.json | pme-runtime-v1 | 3 | dev, build, start |
| legacy/ai-gateway-workspace/.codex-audit-worktree/package.json |  | 0 |  |
| legacy/ai-gateway-workspace/.codex-audit-worktree/pme-runtime-v1/package.json | pme-runtime-v1 | 3 | dev, build, start |
| legacy/ai-gateway-workspace/.codex-audit-worktree/src/sdk/packages/typescript/package.json | @pme/ai-gateway-sdk | 2 | build, smoke |
| legacy/ai-gateway-workspace/.codex-audit-worktree/src/sdk/releases/0.6.0/src/sdk/packages/typescript/package.json | @pme/ai-gateway-sdk | 2 | build, smoke |
| legacy/ai-gateway-workspace/.codex-audit-worktree/src/sdk/releases/0.6.0-rc.2-snapshot/src/sdk/packages/typescript/package.json | @pme/ai-gateway-sdk | 2 | build, smoke |
| legacy/ai-gateway-workspace/.codex-hardening-integration/archive/repo-cleanup-pass-2/historical/00-source-snapshot/package.json | @anthropic-ai/claude-code | 1 | prepare |
| legacy/ai-gateway-workspace/.codex-hardening-integration/archive/repo-cleanup-pass-2/historical/mnt/data/pme-runtime-v1/package.json | pme-runtime-v1 | 3 | dev, build, start |
| legacy/ai-gateway-workspace/.codex-hardening-integration/package.json |  | 0 |  |
| legacy/ai-gateway-workspace/.codex-hardening-integration/pme-runtime-v1/package.json | pme-runtime-v1 | 3 | dev, build, start |
| legacy/ai-gateway-workspace/.codex-hardening-integration/src/sdk/packages/typescript/package.json | @pme/ai-gateway-sdk | 2 | build, smoke |
| legacy/ai-gateway-workspace/.codex-hardening-integration/src/sdk/releases/0.6.0/src/sdk/packages/typescript/package.json | @pme/ai-gateway-sdk | 2 | build, smoke |
| legacy/ai-gateway-workspace/.codex-hardening-integration/src/sdk/releases/0.6.0-rc.2-snapshot/src/sdk/packages/typescript/package.json | @pme/ai-gateway-sdk | 2 | build, smoke |
| legacy/ai-gateway-workspace/00-source-snapshot/package.json | @anthropic-ai/claude-code | 1 | prepare |
| legacy/ai-gateway-workspace/beta-package/app/package.json |  | 0 |  |
| legacy/ai-gateway-workspace/beta-package/app/src/sdk/packages/typescript/package.json | @pme/ai-gateway-sdk | 2 | build, smoke |
| legacy/ai-gateway-workspace/mnt/data/pme-runtime-v1/package.json | pme-runtime-v1 | 3 | dev, build, start |
| legacy/ai-gateway-workspace/package.json |  | 0 |  |
| legacy/ai-gateway-workspace/PME-AI-Gateway-beta/beta-package/app/package.json |  | 0 |  |
| legacy/ai-gateway-workspace/PME-AI-Gateway-beta/beta-package/app/src/sdk/packages/typescript/package.json | @pme/ai-gateway-sdk | 2 | build, smoke |
| legacy/ai-gateway-workspace/pme-runtime-v1/package.json | pme-runtime-v1 | 3 | dev, build, start |
| legacy/ai-gateway-workspace/src/sdk/packages/typescript/package.json | @pme/ai-gateway-sdk | 2 | build, smoke |
| legacy/ai-gateway-workspace/src/sdk/published-releases/0.6.0/src/sdk/packages/typescript/package.json | @pme/ai-gateway-sdk | 2 | build, smoke |
| legacy/ai-gateway-workspace/src/sdk/releases/0.6.0/src/sdk/packages/typescript/package.json | @pme/ai-gateway-sdk | 2 | build, smoke |
| legacy/ai-gateway-workspace/src/sdk/releases/0.6.0-rc.2-snapshot/src/sdk/packages/typescript/package.json | @pme/ai-gateway-sdk | 2 | build, smoke |
| legacy/claudcodesrc-ponponon-master/package/package.json | @anthropic-ai/claude-code | 1 | prepare |
| legacy/claudcodesrc-ponponon-master/package.json | @anthropic-ai/claude-code | 1 | prepare |

## Automation Classification

| class | present | count | samples |
| --- | --- | ---: | --- |
| browser automation | yes | 276 | legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/commands/commands.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/mcp/auth.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/mcp/client.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/mcp/config.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/mcp/elicitationHandler.ts |
| desktop automation | yes | 289 | legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeApi.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/types.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/commands/commands.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/runtime/query.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/runtime/QueryEngine.ts |
| file automation | yes | 488 | legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgePointer.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/inboundAttachments.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/sessionRunner.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/mcp/auth.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/mcp/client.ts |
| shell automation | yes | 654 | legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeMain.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgePointer.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeUI.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/initReplBridge.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/replBridge.ts |
| agent orchestration | yes | 1113 | legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeApi.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeDebug.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeMain.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeMessaging.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/codeSessionApi.ts |
| dry-run only | yes | 583 | legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeDebug.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeEnabled.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeMain.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeMessaging.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/initReplBridge.ts |

## Specific Capability Answers

| capability | present | count | samples |
| --- | --- | ---: | --- |
| create file | yes | 302 | legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgePointer.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/inboundAttachments.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/sessionRunner.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/mcp/auth.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/mcp/client.ts |
| create table / spreadsheet | yes | 101 | legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/tools/AgentTool/built-in/exploreAgent.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/tools/AgentTool/prompt.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/tools/BashTool/destructiveCommandWarning.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/tools/BashTool/readOnlyValidation.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/tools/PowerShellTool/destructiveCommandWarning.ts |
| open browser | yes | 248 | legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/commands/commands.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/mcp/auth.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/mcp/client.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/mcp/config.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/mcp/elicitationHandler.ts |
| operate desktop | yes | 114 | legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeApi.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/types.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/commands/commands.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/runtime/query.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/runtime/QueryEngine.ts |
| run local command | yes | 654 | legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeMain.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgePointer.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeUI.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/initReplBridge.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/replBridge.ts |
| automated workflow | yes | 810 | legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeApi.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeDebug.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeMain.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/capacityWake.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/codeSessionApi.ts |
| agent runner | yes | 2128 | legacy/ai-gateway-workspace/.codex-audit-worktree/.tmp/governance-v45-bridge/dashboard-snapshots/history/snap_v45_001.json<br>legacy/ai-gateway-workspace/.codex-audit-worktree/.tmp/governance-v45-bridge/dashboard-snapshots/latest.json<br>legacy/ai-gateway-workspace/.codex-audit-worktree/.tmp/governance-v45-bridge/governance-audits/a1.json<br>legacy/ai-gateway-workspace/.codex-audit-worktree/.tmp/governance-v45-bridge/version-timelines/v4.4-governed-v2.json<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeApi.ts |
| evidence / log record | yes | 1662 | legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeDebug.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeMain.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeUI.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/debugUtils.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/remoteBridgeCore.ts |

## Risk Classification

These are risk signals from path/script/source classification. They are not proof that Phase1881A executed any legacy script or called any provider.

| risk signal | present | count | samples |
| --- | --- | ---: | --- |
| secret read | yes | 786 | legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeApi.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeConfig.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeEnabled.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeMain.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgePointer.ts |
| provider call | yes | 1785 | legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeApi.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeConfig.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeDebug.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeEnabled.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeMain.ts |
| deploy/release | yes | 657 | legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeMain.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeMessaging.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/initReplBridge.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/replBridge.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/replBridgeHandle.ts |
| delete/overwrite file | yes | 329 | legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeConfig.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeMain.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgePointer.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/createSession.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/inboundAttachments.ts |
| external request | yes | 616 | legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeApi.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeDebug.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeMain.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/codeSessionApi.ts<br>legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/createSession.ts |

## Notable Automation Files

| path | classes | risks |
| --- | --- | --- |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeApi.ts | desktop automation, agent orchestration | secret_read_risk, provider_call_risk, external_network_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeConfig.ts |  | secret_read_risk, provider_call_risk, delete_or_overwrite_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeDebug.ts | agent orchestration, dry-run only | provider_call_risk, external_network_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeEnabled.ts | dry-run only | secret_read_risk, provider_call_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeMain.ts | shell automation, agent orchestration, dry-run only | secret_read_risk, provider_call_risk, deploy_release_risk, delete_or_overwrite_risk, external_network_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeMessaging.ts | agent orchestration, dry-run only | provider_call_risk, deploy_release_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgePointer.ts | file automation, shell automation | secret_read_risk, provider_call_risk, delete_or_overwrite_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeStatusUtil.ts |  | provider_call_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/bridgeUI.ts | shell automation | secret_read_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/codeSessionApi.ts | agent orchestration | provider_call_risk, external_network_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/createSession.ts | agent orchestration | provider_call_risk, delete_or_overwrite_risk, external_network_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/debugUtils.ts |  | provider_call_risk, external_network_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/envLessBridgeConfig.ts |  | provider_call_risk, external_network_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/flushGate.ts | agent orchestration |  |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/inboundAttachments.ts | file automation | provider_call_risk, delete_or_overwrite_risk, external_network_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/inboundMessages.ts |  | provider_call_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/initReplBridge.ts | shell automation, agent orchestration, dry-run only | secret_read_risk, provider_call_risk, deploy_release_risk, delete_or_overwrite_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/pollConfig.ts | dry-run only |  |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/pollConfigDefaults.ts | agent orchestration, dry-run only |  |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/remoteBridgeCore.ts | agent orchestration | secret_read_risk, provider_call_risk, external_network_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/replBridge.ts | shell automation, agent orchestration, dry-run only | secret_read_risk, provider_call_risk, deploy_release_risk, delete_or_overwrite_risk, external_network_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/replBridgeHandle.ts |  | deploy_release_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/replBridgeTransport.ts | shell automation, agent orchestration | provider_call_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/sessionIdCompat.ts | agent orchestration | deploy_release_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/sessionRunner.ts | file automation, shell automation, agent orchestration, dry-run only | secret_read_risk, provider_call_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/trustedDevice.ts |  | secret_read_risk, provider_call_risk, external_network_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/types.ts | desktop automation, shell automation, agent orchestration | secret_read_risk, provider_call_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/bridge/workSecret.ts | agent orchestration | provider_call_risk, deploy_release_risk, external_network_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/commands/commands.ts | browser automation, desktop automation, shell automation, agent orchestration | secret_read_risk, provider_call_risk, deploy_release_risk, delete_or_overwrite_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/mcp/auth.ts | browser automation, file automation, agent orchestration, dry-run only | secret_read_risk, provider_call_risk, deploy_release_risk, delete_or_overwrite_risk, external_network_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/mcp/channelAllowlist.ts |  | deploy_release_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/mcp/channelNotification.ts | agent orchestration, dry-run only | provider_call_risk, deploy_release_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/mcp/channelPermissions.ts | agent orchestration, dry-run only | provider_call_risk, deploy_release_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/mcp/claudeai.ts | dry-run only | secret_read_risk, provider_call_risk, external_network_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/mcp/client.ts | browser automation, file automation, shell automation, agent orchestration, dry-run only | secret_read_risk, provider_call_risk, deploy_release_risk, delete_or_overwrite_risk, external_network_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/mcp/config.ts | browser automation, file automation, dry-run only | provider_call_risk, delete_or_overwrite_risk, external_network_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/mcp/elicitationHandler.ts | browser automation, agent orchestration |  |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/mcp/envExpansion.ts |  | secret_read_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/mcp/headersHelper.ts | shell automation | secret_read_risk, provider_call_risk |
| legacy/ai-gateway-workspace/.codex-audit-worktree/00-source-snapshot/mcp/normalization.ts |  | provider_call_risk |

## Reuse Decision

- Reusable as design reference only: evidence/log ledger shape, runner naming, dry-run preview language, and local file persistence boundaries.
- Reusable after reimplementation: browser automation patterns and UI screenshot evidence, because current Owner OS already has its own verified browser path.
- Reusable after isolation: file/table automation concepts such as CSV/XLSX naming, allowed output directory contracts, and write-evidence ledgers.
- Reusable after strict gates: agent runner/orchestration ideas, approval records, queues, and workflow result ledgers.

## Not Directly Reusable Or High Risk

- Any node_modules, generated snapshot, temp runtime, or archived worktree content under legacy.
- Any script that can start shell/PowerShell commands, copy/move/delete files, download external resources, publish, deploy, or call providers.
- Any provider/runtime integration path because it is outside current Owner Automation Kernel and lacks current Phase1881A approval.
- Any desktop automation that opens applications or sends input without Owner Automation permission gates.

## Why Owner OS Cannot Create A Desktop Spreadsheet Yet

- Current Owner OS phases are verified for one-click local launch, browser UI checks, report generation, scroll/input evidence, and read-only owner guidance.
- No current Owner Automation Kernel route exposes a verified table/spreadsheet creation contract.
- No approved file-write gate exists yet for owner-requested CSV/XLSX output with permissionMode, approvalRecord, allowedFiles, forbiddenPaths, dryRun default, and evidence.
- Legacy file/table/desktop automation is not wired into current runtime and cannot be treated as current capability.
- Excel or desktop spreadsheet opening would require a separate desktop-automation adapter and verifier; this phase only audits read-only.

## Evidence

- apps/ai-gateway-service/evidence/phase1881a-legacy-automation-audit.json
