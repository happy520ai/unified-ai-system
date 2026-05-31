import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2046-ClaudeCode-Source-Utilization-Audit";
const generatedAt = new Date().toISOString();

const outputPaths = {
  doc: "docs/phase2046-claudecode-source-utilization-audit.md",
  gapMap: "docs/phase2046-claudecode-gap-map.json",
  evidence: "apps/ai-gateway-service/evidence/phase2046-claudecode-source-utilization-audit/result.json",
};

const sourceCandidates = [
  path.resolve(repoRoot, "..", "claudcodesrc-ponponon-master"),
  path.resolve(repoRoot, "legacy", "claudcodesrc-ponponon-master"),
  path.resolve(repoRoot, "..", "ai-gateway-workspace", "claudcodesrc-ponponon-master"),
].map((candidatePath) => ({
  path: candidatePath,
  exists: existsSync(candidatePath),
  hasSrc: existsSync(path.join(candidatePath, "src")),
}));

const sourceCandidate = sourceCandidates.find((candidate) => candidate.exists && candidate.hasSrc) || null;
const sourceRoot = sourceCandidate?.path || "";

const focusSpecs = [
  {
    focusArea: "tool permission model",
    claudeModules: [
      "src/utils/permissions/PermissionMode.ts",
      "src/utils/permissions/PermissionResult.ts",
      "src/utils/permissions/PermissionRule.ts",
      "src/utils/permissions/permissionRuleParser.ts",
      "src/utils/permissions/permissionsLoader.ts",
      "src/utils/permissions/pathValidation.ts",
      "src/utils/permissions/dangerousPatterns.ts",
      "src/utils/permissions/bashClassifier.ts",
      "src/hooks/toolPermission/PermissionContext.ts",
    ],
    pmeAnalogues: [
      "tools/gvc/validate-risk-gate.mjs",
      "apps/ai-gateway-service/src/agent-runner/permissionModePolicy.js",
      "docs/project-brain/risk-policy.json",
    ],
    architecturalPattern: "A typed permission mode, rule, result, path validation, and command classifier layer separates what the agent wants to do from what the local environment may allow.",
    utilizationLevel: "partial",
    pmeCurrentUse: "PME has risk-policy JSON, permission modes, approval records, and GVC risk gates, but rules are still spread across phase verifiers and runner code.",
    gap: "No single reusable permission rule parser/result object is shared across Local Agent, GVC runner, Codex Context Gateway, and future external tool bridges.",
    recommendation: "Create a PME permission-rule DSL and shared evaluation result shape before expanding autonomous mutation surfaces.",
  },
  {
    focusArea: "command execution model",
    claudeModules: [
      "src/utils/Shell.ts",
      "src/utils/ShellCommand.ts",
      "src/utils/shell/readOnlyCommandValidation.ts",
      "src/utils/shell/outputLimits.ts",
      "src/utils/powershell/dangerousCmdlets.ts",
      "src/tools/BashTool/bashSecurity.ts",
      "src/tools/PowerShellTool/powershellSecurity.ts",
    ],
    pmeAnalogues: [
      "tools/gvc/run-timed-local-runner.mjs",
      "tools/gvc/low-risk-autonomous-executor.mjs",
      "apps/ai-gateway-service/src/agent-runner/approvedPatchRunner.js",
    ],
    architecturalPattern: "Shell execution is modeled as a classified command with read-only checks, output limits, shell-specific safety rules, and UI-visible semantics.",
    utilizationLevel: "weak_partial",
    pmeCurrentUse: "PME runs explicit verifier commands and blocks deploy/provider/chat operations, but command classification is mostly phase-specific.",
    gap: "PowerShell and shell safety are not yet centralized as reusable parse/classify/explain primitives for owner-facing automation.",
    recommendation: "Add a dry-run command classifier that labels read-only, mutation, forbidden, provider-risk, secret-risk, and deploy-risk commands without executing them.",
  },
  {
    focusArea: "session/context handling",
    claudeModules: [
      "src/bootstrap/state.ts",
      "src/context.ts",
      "src/utils/sessionState.ts",
      "src/utils/sessionRestore.ts",
      "src/utils/agentContext.ts",
      "src/utils/queryContext.ts",
      "src/utils/readEditContext.ts",
      "src/assistant/sessionHistory.ts",
    ],
    pmeAnalogues: [
      "docs/project-brain/current-state.json",
      "docs/project-brain/timed-runner-state.json",
      "packages/codex-context-gateway/src/contextPackGenerator.js",
      "packages/codex-context-gateway/src/contextFreshnessDetector.js",
    ],
    architecturalPattern: "Session state, query context, read/edit context, and restore history are distinct layers instead of one loose transcript.",
    utilizationLevel: "partial",
    pmeCurrentUse: "PME has project-brain state, Codex Context packs, stale guards, and runner state files.",
    gap: "PME lacks a compact unified session ledger connecting task intent, files read, edits planned, edits applied, verifier state, and resume pointer.",
    recommendation: "Unify project-brain, context pack, and execution history into a bounded session ledger with freshness and resume fields.",
  },
  {
    focusArea: "approval gate",
    claudeModules: [
      "src/utils/classifierApprovals.ts",
      "src/utils/classifierApprovalsHook.ts",
      "src/hooks/useCanUseTool.tsx",
      "src/components/TrustDialog/TrustDialog.tsx",
      "src/services/mcpServerApproval.tsx",
    ],
    pmeAnalogues: [
      "apps/ai-gateway-service/src/approval/approvalStore.js",
      "apps/ai-gateway-service/src/agent-runner/localAgentApprovalPreview.js",
      "docs/approvals/gvc-low-risk-autonomous-mutation-approval.json",
      "tools/gvc/read-runner-control.mjs",
    ],
    architecturalPattern: "Approval is a first-class state transition that can be previewed, explained, recorded, and consumed by tool permission checks.",
    utilizationLevel: "strong_partial",
    pmeCurrentUse: "PME already uses approval packets, approval preview surfaces, runner control files, and provider approval schemas.",
    gap: "Approval semantics are strong but fragmented by phase and product area; not all approval records share one canonical schema.",
    recommendation: "Define an approval-intent envelope shared by Local Agent, GVC runner, Provider gate, and external tool candidates.",
  },
  {
    focusArea: "project memory files",
    claudeModules: [
      "src/memdir/memdir.ts",
      "src/memdir/memoryScan.ts",
      "src/memdir/memoryTypes.ts",
      "src/memdir/findRelevantMemories.ts",
      "src/utils/memoryFileDetection.ts",
      "src/services/SessionMemory/sessionMemory.ts",
    ],
    pmeAnalogues: [
      "AGENTS.md",
      "README.md",
      "docs/project-brain/current-state.json",
      "docs/project-brain/goals.json",
      "docs/project-brain/completion-definition.json",
    ],
    architecturalPattern: "Memory files are discoverable, typed, age-aware, and relevance-filtered instead of treated as one global instruction blob.",
    utilizationLevel: "partial",
    pmeCurrentUse: "PME has AGENTS managed rules and project-brain JSON files.",
    gap: "Project memory is not yet relevance-ranked or age-scored before each autonomous runner loop.",
    recommendation: "Add memory age/relevance scoring for project-brain inputs and AGENTS managed state.",
  },
  {
    focusArea: "MCP/tool bridge",
    claudeModules: [
      "src/entrypoints/mcp.ts",
      "src/services/mcp/config.ts",
      "src/services/mcp/client.ts",
      "src/utils/mcpValidation.ts",
      "src/utils/mcpOutputStorage.ts",
      "src/utils/plugins/mcpPluginIntegration.ts",
      "src/hooks/useMergedTools.ts",
      "src/utils/toolSchemaCache.ts",
      "src/utils/toolResultStorage.ts",
    ],
    pmeAnalogues: [
      "packages/codex-context-gateway/src/runnerIntegrationPreview.js",
      "packages/codex-context-gateway/src/relayArchitectureDesign.js",
      "packages/codex-context-gateway/src/authorizationEvidenceBuilder.js",
    ],
    architecturalPattern: "Tool bridges benefit from schema caching, output storage, validation, merged command/tool registries, and approval-aware connection setup.",
    utilizationLevel: "weak_partial",
    pmeCurrentUse: "PME has Codex Context Gateway previews and external tool bridge designs, but not a general local MCP registry for PME tools.",
    gap: "No shared local tool schema cache or output ledger exists for all owner-facing tools.",
    recommendation: "Build a read-only PME tool registry preview before any real tool execution bridge.",
  },
  {
    focusArea: "diff/apply patch workflow",
    claudeModules: [
      "src/commands/diff/index.ts",
      "src/hooks/useTurnDiffs.ts",
      "src/hooks/useDiffData.ts",
      "src/hooks/useDiffInIDE.ts",
      "src/components/StructuredDiff.tsx",
      "src/utils/gitDiff.ts",
      "src/utils/diff.ts",
      "src/tools/FileEditTool/FileEditTool.ts",
    ],
    pmeAnalogues: [
      "apps/ai-gateway-service/src/agent-runner/localOperationPatchProposal.js",
      "apps/ai-gateway-service/src/agent-runner/patchApprovalPolicy.js",
      "apps/ai-gateway-service/src/agent-runner/approvedPatchRunner.js",
      "tools/gvc/low-risk-autonomous-executor.mjs",
    ],
    architecturalPattern: "Diffs are turn-scoped, structured, reviewable, and connect file edit intent to an approval/apply path.",
    utilizationLevel: "partial",
    pmeCurrentUse: "PME has patch proposal, approval policy, approved patch runner, and autonomous mutation plan/evidence.",
    gap: "Owner UI does not yet expose one consistent structured diff view for GVC mutations, Local Agent patches, and future tool edits.",
    recommendation: "Add a unified read-only diff ledger and structured diff panel before adding more write surfaces.",
  },
  {
    focusArea: "rollback/undo pattern",
    claudeModules: [
      "src/tools/shared/gitOperationTracking.ts",
      "src/tools/ExitWorktreeTool/ExitWorktreeTool.ts",
      "src/utils/gitDiff.ts",
      "src/hooks/useTurnDiffs.ts",
    ],
    pmeAnalogues: [
      "apps/ai-gateway-service/src/agent-runner/rollbackManifest.js",
      "tools/gvc/low-risk-autonomous-executor.mjs",
      "packages/codex-context-gateway/src/rollbackSimulation.js",
      "packages/model-routing-engine/src/routeRollbackDisable.js",
    ],
    architecturalPattern: "Edits should be paired with operation tracking, visible diffs, rollback manifests, and explicit exit/restore flows.",
    utilizationLevel: "strong_partial",
    pmeCurrentUse: "PME has rollback manifests, rollback simulation, route disable plans, and GVC rollback on verifier failure.",
    gap: "Rollback evidence is present, but not yet normalized into one owner-readable undo history across subsystems.",
    recommendation: "Create a cross-phase rollback ledger with last-known snapshot, verifier failure cause, rollback status, and owner-readable summary.",
  },
  {
    focusArea: "terminal safety",
    claudeModules: [
      "src/ink/terminal.ts",
      "src/ink/terminal-querier.ts",
      "src/utils/terminal.ts",
      "src/utils/terminalPanel.ts",
      "src/ink/hooks/use-terminal-viewport.ts",
      "src/components/tasks/ShellInput.tsx",
    ],
    pmeAnalogues: [
      "tools/gvc/run-timed-local-runner.mjs",
      "tools/gvc/start-timed-local-runner.cmd",
      "tools/gvc/start-timed-local-runner.ps1",
    ],
    architecturalPattern: "Terminal interaction is bounded by viewport, output handling, focus state, and shell-specific display components.",
    utilizationLevel: "weak_partial",
    pmeCurrentUse: "PME has manual launch scripts and runner logs/evidence, but limited terminal output classification.",
    gap: "Long command output and terminal state are not centrally summarized for owner control panels.",
    recommendation: "Introduce terminal transcript summaries and output limit policies for all local runner commands.",
  },
  {
    focusArea: "agent loop",
    claudeModules: [
      "src/tools/AgentTool/AgentTool.tsx",
      "src/tools/AgentTool/forkSubagent.ts",
      "src/tools/AgentTool/agentMemory.ts",
      "src/tools/AgentTool/agentMemorySnapshot.ts",
      "src/utils/forkedAgent.ts",
      "src/utils/standaloneAgent.ts",
    ],
    pmeAnalogues: [
      "tools/gvc/select-next-action.mjs",
      "tools/gvc/run-timed-local-runner.mjs",
      "tools/gvc/generate-next-actions.mjs",
      "tools/gvc/score-next-action-quality.mjs",
    ],
    architecturalPattern: "Agent loops should isolate agent memory, spawn/fork boundaries, progress state, and final result capture.",
    utilizationLevel: "partial",
    pmeCurrentUse: "PME has GVC next-action selection, timed runner, quality gate, and low-risk mutation executor.",
    gap: "PME runner is policy-rich but still lacks explicit per-agent memory snapshots and forked subtask result contracts.",
    recommendation: "Add an autonomous-runner task capsule with memory snapshot, allowed files, mutation plan, result, and rollback pointer.",
  },
  {
    focusArea: "config handling",
    claudeModules: [
      "src/query/config.ts",
      "src/utils/config.ts",
      "src/utils/configConstants.ts",
      "src/utils/settings/permissionValidation.ts",
      "src/utils/settings/toolValidationConfig.ts",
      "src/utils/markdownConfigLoader.ts",
      "src/migrations/migrateBypassPermissionsAcceptedToSettings.ts",
    ],
    pmeAnalogues: [
      "docs/project-brain/risk-policy.json",
      "docs/project-brain/runner-control.json",
      "docs/project-brain/safe-overnight-policy.json",
      "packages/codex-context-gateway/src/redactedConfigPreviewBuilder.js",
    ],
    architecturalPattern: "Config is loaded, validated, migrated, redacted, and explained before affecting runtime behavior.",
    utilizationLevel: "partial",
    pmeCurrentUse: "PME has control/policy JSON and redacted config preview tools.",
    gap: "Policy config migration/versioning is not yet uniform for project-brain, runner-control, and approval packets.",
    recommendation: "Version project-brain/control schemas and add migration checks before the runner reads them.",
  },
  {
    focusArea: "provider abstraction",
    claudeModules: [
      "src/utils/model/providers.ts",
      "src/utils/model/configs.ts",
      "src/utils/model/agent.ts",
      "src/components/agents/ModelSelector.tsx",
    ],
    pmeAnalogues: [
      "apps/ai-gateway-service/src/providers/providerRegistry.js",
      "apps/ai-gateway-service/src/providers/providerExecutionAuthorizationGate.js",
      "apps/ai-gateway-service/src/core/providerSelectionPolicy.js",
      "packages/global-model-library/src/providerCredentialReadinessGate.js",
    ],
    architecturalPattern: "Provider/model selection should be capability-aware, config-aware, and separated from direct execution.",
    utilizationLevel: "strong_partial",
    pmeCurrentUse: "PME has provider registry, credentialRef gates, model library status rules, and cost/quota/provider execution guards.",
    gap: "Provider abstraction is strong in AI Gateway, but it is intentionally not connected to GVC autonomous runner or Claude Code source audit.",
    recommendation: "Keep Provider bridges approval-gated and reuse only the abstraction pattern, not source code or direct runtime behavior.",
  },
];

const safeSourceFiles = sourceRoot ? listSafeFiles(path.join(sourceRoot, "src")) : [];
const skippedUnsafePaths = sourceRoot ? findSkippedUnsafePaths(sourceRoot) : [];
const readModules = focusSpecs.flatMap((spec) =>
  spec.claudeModules.map((relativePath) => readModuleSummary({ sourceRoot, focusArea: spec.focusArea, relativePath })),
);

const referenceArchitecturePoints = focusSpecs.map((spec) => ({
  focusArea: spec.focusArea,
  claudeCodeModules: spec.claudeModules.map((relativePath) => ({
    path: relativePath,
    exists: sourceRoot ? existsSync(path.join(sourceRoot, relativePath)) : false,
  })),
  architecturalPattern: spec.architecturalPattern,
  pmeCurrentUse: spec.pmeCurrentUse,
  utilizationLevel: spec.utilizationLevel,
  pmeAnalogues: spec.pmeAnalogues.map((relativePath) => ({
    path: relativePath,
    exists: existsSync(path.join(repoRoot, relativePath)),
  })),
  gap: spec.gap,
  recommendation: spec.recommendation,
}));

const pmeUsedPatterns = [
  {
    mechanism: "Risk-gated autonomous loop",
    pmeFiles: ["tools/gvc/validate-risk-gate.mjs", "tools/gvc/run-timed-local-runner.mjs", "docs/project-brain/risk-policy.json"],
    borrowedPatternLevel: "conceptual",
    status: "used",
  },
  {
    mechanism: "Approval packet and control-file gating",
    pmeFiles: ["docs/approvals/gvc-low-risk-autonomous-mutation-approval.json", "docs/project-brain/runner-control.json", "tools/gvc/read-runner-control.mjs"],
    borrowedPatternLevel: "conceptual",
    status: "used",
  },
  {
    mechanism: "Evidence-first verifier chain",
    pmeFiles: ["tools/gvc/verify-task-quality-gate.mjs", "tools/gvc/verify-phase2038-batch-rollback-audit.mjs", "apps/ai-gateway-service/evidence/"],
    borrowedPatternLevel: "independent PME pattern",
    status: "used",
  },
  {
    mechanism: "Patch proposal and approved local apply boundary",
    pmeFiles: ["apps/ai-gateway-service/src/agent-runner/localOperationPatchProposal.js", "apps/ai-gateway-service/src/agent-runner/patchApprovalPolicy.js", "apps/ai-gateway-service/src/agent-runner/approvedPatchRunner.js"],
    borrowedPatternLevel: "conceptual",
    status: "used",
  },
  {
    mechanism: "Rollback on verifier failure",
    pmeFiles: ["tools/gvc/low-risk-autonomous-executor.mjs", "apps/ai-gateway-service/src/agent-runner/rollbackManifest.js"],
    borrowedPatternLevel: "conceptual",
    status: "used",
  },
  {
    mechanism: "Context gateway with freshness and relevant-file scope",
    pmeFiles: ["packages/codex-context-gateway/src/contextPackGenerator.js", "packages/codex-context-gateway/src/staleContextGuard.js", "packages/codex-context-gateway/src/relevantFileScopeGate.js"],
    borrowedPatternLevel: "independent PME pattern",
    status: "used",
  },
  {
    mechanism: "Provider abstraction and credentialRef gate",
    pmeFiles: ["apps/ai-gateway-service/src/providers/providerExecutionAuthorizationGate.js", "packages/global-model-library/src/providerCredentialReadinessGate.js"],
    borrowedPatternLevel: "independent PME pattern",
    status: "used",
  },
];

const gapsWorthAbsorbing = focusSpecs
  .filter((spec) => spec.utilizationLevel !== "strong")
  .map((spec) => ({
    focusArea: spec.focusArea,
    gap: spec.gap,
    expectedValue: valueForFocusArea(spec.focusArea),
    safeNextStep: spec.recommendation,
    copyBoundary: "Use architecture ideas only. Do not copy Claude Code source into PME.",
  }));

const licenseAndCopyRisk = [
  {
    risk: "Local source tree is a recovered/non-official Claude Code source tree, not a PME-owned dependency.",
    impact: "Direct copying into PME can create license, copyright, and provenance risk.",
    policy: "Do not copy source, comments, or implementation bodies. Keep only pattern-level audit notes and independent PME implementations.",
  },
  {
    risk: "The local package metadata declares license handling outside a normal permissive open-source grant.",
    impact: "Commercial reuse requires independent legal review before any code reuse.",
    policy: "Treat this phase as static architecture research only.",
  },
  {
    risk: "Some modules relate to auth/session/provider behavior.",
    impact: "Unsafe files could accidentally expose secret handling details if blindly scanned.",
    policy: "The audit skips auth.json, .env, token-named, secret-named, archive, dependency, and oversized bundle files.",
  },
];

const nextPhaseRecommendations = [
  {
    phase: "Phase2047-PME-Permission-Rule-DSL-Design",
    goal: "Define a shared permission rule/result schema for Local Agent, GVC runner, Codex Context Gateway, and future tool bridges.",
    boundary: "docs/spec/verifier only; no runtime tool execution.",
  },
  {
    phase: "Phase2048-PME-Shell-Command-Classifier-DryRun",
    goal: "Build a dry-run command classifier for PowerShell/cmd/node/pnpm/git/provider/deploy/secret risks.",
    boundary: "classification only; no command execution beyond verifier tests.",
  },
  {
    phase: "Phase2049-PME-Tool-Registry-And-Result-Ledger-Preview",
    goal: "Create a read-only tool schema cache and result ledger preview for owner-facing tool governance.",
    boundary: "read-only preview; no MCP connection or external tool invocation.",
  },
  {
    phase: "Phase2050-PME-Session-Ledger-Context-Unification",
    goal: "Unify project-brain, context pack, next-actions, mutation evidence, and rollback pointers into a bounded session ledger.",
    boundary: "local files only; no Provider, no chat route modification.",
  },
];

const gapMap = {
  phaseId,
  generatedAt,
  auditMode: "static_source_audit_only",
  claudeCodeSourceFound: Boolean(sourceRoot),
  claudeCodeSourcePath: sourceRoot,
  sourceCandidates,
  safeSourceFileCount: safeSourceFiles.length,
  readModules,
  referenceArchitecturePoints,
  pmeUsedPatterns,
  gapsWorthAbsorbing,
  licenseAndCopyRisk,
  nextPhaseRecommendations,
  completeUtilization: false,
  utilizationConclusion: "partial_utilization_with_clear_gaps",
  safety: buildSafety(),
};

const evidence = {
  phaseId,
  status: sourceRoot ? "passed" : "blocked",
  generatedAt,
  claudeCodeSourceFound: Boolean(sourceRoot),
  claudeCodeSourcePath: sourceRoot,
  readModuleCount: readModules.filter((entry) => entry.read).length,
  readModules: readModules.filter((entry) => entry.read).map((entry) => entry.relativePath),
  completeUtilization: false,
  utilizationConclusion: "PME uses several Claude-Code-like governance patterns, but it does not fully utilize or replicate the Claude Code source architecture.",
  outputs: outputPaths,
  skippedUnsafePaths,
  safety: buildSafety(),
  recommendedSealed: Boolean(sourceRoot),
  blocker: sourceRoot ? "none" : "claude_code_source_not_found",
};

writeJson(outputPaths.gapMap, gapMap);
writeJson(outputPaths.evidence, evidence);
writeText(outputPaths.doc, renderMarkdown({ gapMap, evidence }));

console.log(JSON.stringify({
  phaseId,
  status: evidence.status,
  claudeCodeSourceFound: evidence.claudeCodeSourceFound,
  claudeCodeSourcePath: evidence.claudeCodeSourcePath,
  readModuleCount: evidence.readModuleCount,
  completeUtilization: evidence.completeUtilization,
  blocker: evidence.blocker,
}, null, 2));

if (!sourceRoot) process.exit(1);

function buildSafety() {
  return {
    staticSourceAuditOnly: true,
    claudeCodeExecuted: false,
    providerCallsMade: false,
    secretRead: false,
    rawSecretExposed: false,
    authJsonRead: false,
    envFileRead: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    pushExecuted: false,
    commitCreated: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
    copiedClaudeCodeSourceIntoProject: false,
    workspaceCleanClaimed: false,
    productionReadyClaimed: false,
  };
}

function listSafeFiles(rootDir, result = []) {
  if (!existsSync(rootDir)) return result;
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const absolutePath = path.join(rootDir, entry.name);
    if (shouldSkipPath(absolutePath)) continue;
    if (entry.isDirectory()) {
      listSafeFiles(absolutePath, result);
      continue;
    }
    if (entry.isFile() && isSafeReadableFile(absolutePath)) {
      result.push(path.relative(sourceRoot, absolutePath).replaceAll("\\", "/"));
    }
  }
  return result;
}

function findSkippedUnsafePaths(rootDir) {
  const skipped = [];
  walkForSkipped(rootDir, skipped);
  return skipped.slice(0, 50);
}

function walkForSkipped(rootDir, skipped) {
  if (!existsSync(rootDir)) return;
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const absolutePath = path.join(rootDir, entry.name);
    const relativePath = path.relative(rootDir, absolutePath).replaceAll("\\", "/");
    if (isUnsafePath(absolutePath)) {
      skipped.push(relativePath);
      continue;
    }
    if (entry.isDirectory() && !isDependencyOrArchivePath(absolutePath)) {
      walkForSkipped(absolutePath, skipped);
    }
  }
}

function readModuleSummary({ sourceRoot: localSourceRoot, focusArea, relativePath }) {
  const absolutePath = localSourceRoot ? path.join(localSourceRoot, relativePath) : "";
  const exists = Boolean(absolutePath && existsSync(absolutePath));
  const summary = {
    focusArea,
    relativePath,
    exists,
    read: false,
    sizeBytes: 0,
    lineCount: 0,
    keywordHits: [],
  };
  if (!exists || shouldSkipPath(absolutePath) || !isSafeReadableFile(absolutePath)) return summary;
  const stat = statSync(absolutePath);
  summary.sizeBytes = stat.size;
  if (stat.size > 250_000) return summary;
  const text = readFileSync(absolutePath, "utf8").replace(/^\uFEFF/, "");
  summary.read = true;
  summary.lineCount = text.split(/\r?\n/).length;
  summary.keywordHits = keywordHits(text);
  return summary;
}

function keywordHits(text) {
  const keywords = ["permission", "approval", "shell", "command", "session", "context", "memory", "mcp", "tool", "diff", "patch", "rollback", "terminal", "agent", "config", "provider"];
  return keywords.filter((keyword) => new RegExp(`\\b${keyword}\\b`, "i").test(text));
}

function shouldSkipPath(absolutePath) {
  return isUnsafePath(absolutePath) || isDependencyOrArchivePath(absolutePath);
}

function isUnsafePath(absolutePath) {
  const normalized = absolutePath.replaceAll("\\", "/").toLowerCase();
  return (
    /(^|\/)\.env[^/]*(\/|$)/.test(normalized) ||
    /(^|\/)auth\.json$/.test(normalized) ||
    normalized.includes("secret") ||
    normalized.includes("token")
  );
}

function isDependencyOrArchivePath(absolutePath) {
  const normalized = absolutePath.replaceAll("\\", "/").toLowerCase();
  return (
    normalized.includes("/node_modules/") ||
    normalized.includes("/.git/") ||
    normalized.includes("/vendor/") ||
    /\.(tar|tgz|zip|gz|7z|rar|png|jpg|jpeg|gif|webp|pdf|docx|map)$/i.test(normalized)
  );
}

function isSafeReadableFile(absolutePath) {
  return /\.(ts|tsx|js|jsx|json|md)$/i.test(absolutePath) && !absolutePath.endsWith("cli.js");
}

function valueForFocusArea(focusArea) {
  const values = {
    "tool permission model": "Reduces drift between UI approvals, GVC risk gate, and local operation policy.",
    "command execution model": "Prevents unsafe command execution and improves owner-visible explanations.",
    "session/context handling": "Improves long-running runner resume and auditability.",
    "approval gate": "Reduces fragmented approval packets and dry-run/real-write confusion.",
    "project memory files": "Keeps autonomous runs focused on fresh, relevant state.",
    "MCP/tool bridge": "Creates a safer path to future tool integrations without connecting runtime too early.",
    "diff/apply patch workflow": "Makes owner review and rollback easier to trust.",
    "rollback/undo pattern": "Improves recovery evidence after verifier failures.",
    "terminal safety": "Keeps local automation understandable and bounded.",
    "agent loop": "Makes autonomous tasks easier to isolate, verify, and stop.",
    "config handling": "Prevents stale or invalid policy files from silently changing runner behavior.",
    "provider abstraction": "Keeps Provider calls gated while preserving a clean future extension path.",
  };
  return values[focusArea] || "Improves governed local automation quality.";
}

function renderMarkdown({ gapMap, evidence }) {
  const utilized = gapMap.pmeUsedPatterns.map((entry) => `- ${entry.mechanism}: ${entry.pmeFiles.join(", ")}`).join("\n");
  const gaps = gapMap.gapsWorthAbsorbing.map((entry) => `- ${entry.focusArea}: ${entry.gap} Next: ${entry.safeNextStep}`).join("\n");
  const referencePoints = gapMap.referenceArchitecturePoints
    .map((entry) => `- ${entry.focusArea}: ${entry.architecturalPattern} PME utilization=${entry.utilizationLevel}.`)
    .join("\n");
  const modules = evidence.readModules.map((relativePath) => `- ${relativePath}`).join("\n");
  const recommendations = gapMap.nextPhaseRecommendations.map((entry) => `- ${entry.phase}: ${entry.goal} Boundary: ${entry.boundary}`).join("\n");
  const risks = gapMap.licenseAndCopyRisk.map((entry) => `- ${entry.risk} Policy: ${entry.policy}`).join("\n");
  return `# Phase2046 Claude Code Source Utilization Audit

## Scope

This is a static source audit only. Claude Code was not executed, no Provider was called, no secret/auth/token/.env file was read, and no Claude Code private source was copied into PME.

## Source Discovery

- Claude Code source found: ${gapMap.claudeCodeSourceFound}
- Claude Code source path: ${gapMap.claudeCodeSourcePath || "not found"}
- Safe source file count: ${gapMap.safeSourceFileCount}
- Complete utilization by PME: ${gapMap.completeUtilization}
- Utilization conclusion: ${gapMap.utilizationConclusion}

## Read Module List

${modules || "- none"}

## Reference Architecture Points

${referencePoints}

## Already Used By PME

${utilized}

## Gaps Worth Absorbing

${gaps}

## License And Copy Boundary

${risks}

Copying source is forbidden for this phase. PME may only absorb independently reimplemented design patterns after a separate approval/legal review if needed.

## Next Recommendations

${recommendations}

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
`;
}

function writeJson(relativePath, value) {
  writeText(relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(relativePath, value) {
  const filePath = path.join(repoRoot, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, "utf8");
}
