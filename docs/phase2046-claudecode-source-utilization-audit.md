# Phase2046 Claude Code Source Utilization Audit

## Scope

This is a static source audit only. Claude Code was not executed, no Provider was called, no secret/auth/token/.env file was read, and no Claude Code private source was copied into PME.

## Source Discovery

- Claude Code source found: true
- Claude Code source path: E:\AI-Data\AI网关系统\claudcodesrc-ponponon-master
- Safe source file count: 1891
- Complete utilization by PME: false
- Utilization conclusion: partial_utilization_with_clear_gaps

## Read Module List

- src/utils/permissions/PermissionMode.ts
- src/utils/permissions/PermissionResult.ts
- src/utils/permissions/PermissionRule.ts
- src/utils/permissions/permissionRuleParser.ts
- src/utils/permissions/permissionsLoader.ts
- src/utils/permissions/pathValidation.ts
- src/utils/permissions/dangerousPatterns.ts
- src/utils/permissions/bashClassifier.ts
- src/hooks/toolPermission/PermissionContext.ts
- src/utils/Shell.ts
- src/utils/ShellCommand.ts
- src/utils/shell/readOnlyCommandValidation.ts
- src/utils/shell/outputLimits.ts
- src/utils/powershell/dangerousCmdlets.ts
- src/tools/BashTool/bashSecurity.ts
- src/tools/PowerShellTool/powershellSecurity.ts
- src/bootstrap/state.ts
- src/context.ts
- src/utils/sessionState.ts
- src/utils/sessionRestore.ts
- src/utils/agentContext.ts
- src/utils/queryContext.ts
- src/utils/readEditContext.ts
- src/assistant/sessionHistory.ts
- src/utils/classifierApprovals.ts
- src/utils/classifierApprovalsHook.ts
- src/hooks/useCanUseTool.tsx
- src/components/TrustDialog/TrustDialog.tsx
- src/services/mcpServerApproval.tsx
- src/memdir/memdir.ts
- src/memdir/memoryScan.ts
- src/memdir/memoryTypes.ts
- src/memdir/findRelevantMemories.ts
- src/utils/memoryFileDetection.ts
- src/services/SessionMemory/sessionMemory.ts
- src/entrypoints/mcp.ts
- src/services/mcp/config.ts
- src/services/mcp/client.ts
- src/utils/mcpValidation.ts
- src/utils/mcpOutputStorage.ts
- src/utils/plugins/mcpPluginIntegration.ts
- src/hooks/useMergedTools.ts
- src/utils/toolSchemaCache.ts
- src/utils/toolResultStorage.ts
- src/commands/diff/index.ts
- src/hooks/useTurnDiffs.ts
- src/hooks/useDiffData.ts
- src/hooks/useDiffInIDE.ts
- src/components/StructuredDiff.tsx
- src/utils/gitDiff.ts
- src/utils/diff.ts
- src/tools/FileEditTool/FileEditTool.ts
- src/tools/shared/gitOperationTracking.ts
- src/tools/ExitWorktreeTool/ExitWorktreeTool.ts
- src/utils/gitDiff.ts
- src/hooks/useTurnDiffs.ts
- src/ink/terminal.ts
- src/ink/terminal-querier.ts
- src/utils/terminal.ts
- src/utils/terminalPanel.ts
- src/ink/hooks/use-terminal-viewport.ts
- src/tools/AgentTool/AgentTool.tsx
- src/tools/AgentTool/forkSubagent.ts
- src/tools/AgentTool/agentMemory.ts
- src/tools/AgentTool/agentMemorySnapshot.ts
- src/utils/forkedAgent.ts
- src/utils/standaloneAgent.ts
- src/query/config.ts
- src/utils/config.ts
- src/utils/configConstants.ts
- src/utils/settings/permissionValidation.ts
- src/utils/settings/toolValidationConfig.ts
- src/utils/markdownConfigLoader.ts
- src/migrations/migrateBypassPermissionsAcceptedToSettings.ts
- src/utils/model/providers.ts
- src/utils/model/configs.ts
- src/utils/model/agent.ts
- src/components/agents/ModelSelector.tsx

## Reference Architecture Points

- tool permission model: A typed permission mode, rule, result, path validation, and command classifier layer separates what the agent wants to do from what the local environment may allow. PME utilization=partial.
- command execution model: Shell execution is modeled as a classified command with read-only checks, output limits, shell-specific safety rules, and UI-visible semantics. PME utilization=weak_partial.
- session/context handling: Session state, query context, read/edit context, and restore history are distinct layers instead of one loose transcript. PME utilization=partial.
- approval gate: Approval is a first-class state transition that can be previewed, explained, recorded, and consumed by tool permission checks. PME utilization=strong_partial.
- project memory files: Memory files are discoverable, typed, age-aware, and relevance-filtered instead of treated as one global instruction blob. PME utilization=partial.
- MCP/tool bridge: Tool bridges benefit from schema caching, output storage, validation, merged command/tool registries, and approval-aware connection setup. PME utilization=weak_partial.
- diff/apply patch workflow: Diffs are turn-scoped, structured, reviewable, and connect file edit intent to an approval/apply path. PME utilization=partial.
- rollback/undo pattern: Edits should be paired with operation tracking, visible diffs, rollback manifests, and explicit exit/restore flows. PME utilization=strong_partial.
- terminal safety: Terminal interaction is bounded by viewport, output handling, focus state, and shell-specific display components. PME utilization=weak_partial.
- agent loop: Agent loops should isolate agent memory, spawn/fork boundaries, progress state, and final result capture. PME utilization=partial.
- config handling: Config is loaded, validated, migrated, redacted, and explained before affecting runtime behavior. PME utilization=partial.
- provider abstraction: Provider/model selection should be capability-aware, config-aware, and separated from direct execution. PME utilization=strong_partial.

## Already Used By PME

- Risk-gated autonomous loop: tools/gvc/validate-risk-gate.mjs, tools/gvc/run-timed-local-runner.mjs, docs/project-brain/risk-policy.json
- Approval packet and control-file gating: docs/approvals/gvc-low-risk-autonomous-mutation-approval.json, docs/project-brain/runner-control.json, tools/gvc/read-runner-control.mjs
- Evidence-first verifier chain: tools/gvc/verify-task-quality-gate.mjs, tools/gvc/verify-phase2038-batch-rollback-audit.mjs, apps/ai-gateway-service/evidence/
- Patch proposal and approved local apply boundary: apps/ai-gateway-service/src/agent-runner/localOperationPatchProposal.js, apps/ai-gateway-service/src/agent-runner/patchApprovalPolicy.js, apps/ai-gateway-service/src/agent-runner/approvedPatchRunner.js
- Rollback on verifier failure: tools/gvc/low-risk-autonomous-executor.mjs, apps/ai-gateway-service/src/agent-runner/rollbackManifest.js
- Context gateway with freshness and relevant-file scope: packages/codex-context-gateway/src/contextPackGenerator.js, packages/codex-context-gateway/src/staleContextGuard.js, packages/codex-context-gateway/src/relevantFileScopeGate.js
- Provider abstraction and credentialRef gate: apps/ai-gateway-service/src/providers/providerExecutionAuthorizationGate.js, packages/global-model-library/src/providerCredentialReadinessGate.js

## Gaps Worth Absorbing

- tool permission model: No single reusable permission rule parser/result object is shared across Local Agent, GVC runner, Codex Context Gateway, and future external tool bridges. Next: Create a PME permission-rule DSL and shared evaluation result shape before expanding autonomous mutation surfaces.
- command execution model: PowerShell and shell safety are not yet centralized as reusable parse/classify/explain primitives for owner-facing automation. Next: Add a dry-run command classifier that labels read-only, mutation, forbidden, provider-risk, secret-risk, and deploy-risk commands without executing them.
- session/context handling: PME lacks a compact unified session ledger connecting task intent, files read, edits planned, edits applied, verifier state, and resume pointer. Next: Unify project-brain, context pack, and execution history into a bounded session ledger with freshness and resume fields.
- approval gate: Approval semantics are strong but fragmented by phase and product area; not all approval records share one canonical schema. Next: Define an approval-intent envelope shared by Local Agent, GVC runner, Provider gate, and external tool candidates.
- project memory files: Project memory is not yet relevance-ranked or age-scored before each autonomous runner loop. Next: Add memory age/relevance scoring for project-brain inputs and AGENTS managed state.
- MCP/tool bridge: No shared local tool schema cache or output ledger exists for all owner-facing tools. Next: Build a read-only PME tool registry preview before any real tool execution bridge.
- diff/apply patch workflow: Owner UI does not yet expose one consistent structured diff view for GVC mutations, Local Agent patches, and future tool edits. Next: Add a unified read-only diff ledger and structured diff panel before adding more write surfaces.
- rollback/undo pattern: Rollback evidence is present, but not yet normalized into one owner-readable undo history across subsystems. Next: Create a cross-phase rollback ledger with last-known snapshot, verifier failure cause, rollback status, and owner-readable summary.
- terminal safety: Long command output and terminal state are not centrally summarized for owner control panels. Next: Introduce terminal transcript summaries and output limit policies for all local runner commands.
- agent loop: PME runner is policy-rich but still lacks explicit per-agent memory snapshots and forked subtask result contracts. Next: Add an autonomous-runner task capsule with memory snapshot, allowed files, mutation plan, result, and rollback pointer.
- config handling: Policy config migration/versioning is not yet uniform for project-brain, runner-control, and approval packets. Next: Version project-brain/control schemas and add migration checks before the runner reads them.
- provider abstraction: Provider abstraction is strong in AI Gateway, but it is intentionally not connected to GVC autonomous runner or Claude Code source audit. Next: Keep Provider bridges approval-gated and reuse only the abstraction pattern, not source code or direct runtime behavior.

## License And Copy Boundary

- Local source tree is a recovered/non-official Claude Code source tree, not a PME-owned dependency. Policy: Do not copy source, comments, or implementation bodies. Keep only pattern-level audit notes and independent PME implementations.
- The local package metadata declares license handling outside a normal permissive open-source grant. Policy: Treat this phase as static architecture research only.
- Some modules relate to auth/session/provider behavior. Policy: The audit skips auth.json, .env, token-named, secret-named, archive, dependency, and oversized bundle files.

Copying source is forbidden for this phase. PME may only absorb independently reimplemented design patterns after a separate approval/legal review if needed.

## Next Recommendations

- Phase2047-PME-Permission-Rule-DSL-Design: Define a shared permission rule/result schema for Local Agent, GVC runner, Codex Context Gateway, and future tool bridges. Boundary: docs/spec/verifier only; no runtime tool execution.
- Phase2048-PME-Shell-Command-Classifier-DryRun: Build a dry-run command classifier for PowerShell/cmd/node/pnpm/git/provider/deploy/secret risks. Boundary: classification only; no command execution beyond verifier tests.
- Phase2049-PME-Tool-Registry-And-Result-Ledger-Preview: Create a read-only tool schema cache and result ledger preview for owner-facing tool governance. Boundary: read-only preview; no MCP connection or external tool invocation.
- Phase2050-PME-Session-Ledger-Context-Unification: Unify project-brain, context pack, next-actions, mutation evidence, and rollback pointers into a bounded session ledger. Boundary: local files only; no Provider, no chat route modification.

## Safety Result

- providerCallsMade=false
- secretRead=false
- claudeCodeExecuted=false
- deployExecuted=false
- chatModified=false
- chatGatewayExecuteModified=false
- legacyModified=false
- projectContextModified=false
- copiedClaudeCodeSourceIntoProject=false
