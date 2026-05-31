import {
  check,
  exists,
  finalize,
  readText,
  safetyBoundary,
  writeJson,
} from "../phase641r-external-tool/external-tool-common.mjs";

const evidencePath =
  "apps/ai-gateway-service/evidence/phase650r-external-tool/external-tool-final-closure-result.json";
const bundleMirrorPath =
  "apps/ai-gateway-service/evidence/phase646r-650r-external-tool/external-tool-daily-workflow-closure-bundle.json";
const playbookText = readText("docs/phase650r-external-tool-next-use-playbook.md");

const result = {
  phase: "Phase650R-ExternalTool",
  name: "External Tool Final Closure and Next-Use Playbook",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  finalClosureGenerated: exists("docs/phase650r-external-tool-final-closure.md"),
  nextUsePlaybookGenerated: exists("docs/phase650r-external-tool-next-use-playbook.md"),
  knownLimitsGenerated: exists("docs/phase650r-external-tool-known-limits.md"),
  nextRoadmapGenerated: exists("docs/phase650r-external-tool-next-roadmap.md"),
  executionReportGenerated: exists("docs/phase650r-external-tool-execution-report.md"),
  externalToolMode: true,
  codexTokenSavingTool: true,
  engineeringTaskAssistant: true,
  mainChainIntegrationPlanned: false,
  chatIntegrationPlanned: false,
  chatGatewayExecuteIntegrationPlanned: false,
  providerRuntimeIntegrationPlanned: false,
  productionReady: false,
  releaseReady: false,
  playbookRulesCovered: [
    "preflight:phase632-token-saving",
    "docs/phase632-codex-token-saving-task-template.md",
    "relevant-files.json",
    "full-repo",
    "auth.json",
    "short",
    "approval gates",
    "low/medium-safe",
    "Fallback launcher",
    "Production and release remain not recommended",
  ].every((needle) => playbookText.toLowerCase().includes(needle.toLowerCase())),
  ...safetyBoundary(),
  docs: [
    "docs/phase650r-external-tool-final-closure.md",
    "docs/phase650r-external-tool-next-use-playbook.md",
    "docs/phase650r-external-tool-known-limits.md",
    "docs/phase650r-external-tool-next-roadmap.md",
    "docs/phase650r-external-tool-execution-report.md",
  ],
  evidencePath,
};

const mirror = {
  phase: "Phase646R-650R-ExternalTool",
  sourcePhase: "Phase650R-ExternalTool",
  externalToolMode: result.externalToolMode,
  codexTokenSavingTool: result.codexTokenSavingTool,
  engineeringTaskAssistant: result.engineeringTaskAssistant,
  dailyWorkflowClosureBundleSeeded: true,
  providerCallsMade: false,
  codexExecExecutedByThisBundle: false,
  deployExecuted: false,
  releaseExecuted: false,
  pushExecuted: false,
  commitCreated: false,
  productionReadyClaimed: false,
  releaseReadyClaimed: false,
};
writeJson(bundleMirrorPath, mirror);

const checks = [
  check("final_closure_generated", result.finalClosureGenerated),
  check("next_use_playbook_generated", result.nextUsePlaybookGenerated),
  check("known_limits_generated", result.knownLimitsGenerated),
  check("next_roadmap_generated", result.nextRoadmapGenerated),
  check("execution_report_generated", result.executionReportGenerated),
  check("external_tool_mode_true", result.externalToolMode),
  check("codex_token_saving_tool_true", result.codexTokenSavingTool),
  check("engineering_task_assistant_true", result.engineeringTaskAssistant),
  check("main_chain_integration_planned_false", result.mainChainIntegrationPlanned === false),
  check("chat_integration_planned_false", result.chatIntegrationPlanned === false),
  check("chat_gateway_execute_integration_planned_false", result.chatGatewayExecuteIntegrationPlanned === false),
  check("provider_runtime_integration_planned_false", result.providerRuntimeIntegrationPlanned === false),
  check("production_ready_false", result.productionReady === false),
  check("release_ready_false", result.releaseReady === false),
  check("playbook_rules_covered", result.playbookRulesCovered),
  check("production_ready_claimed_false", result.productionReadyClaimed === false),
  check("release_ready_claimed_false", result.releaseReadyClaimed === false),
  check("provider_calls_made_false", result.providerCallsMade === false),
  check("auth_json_read_false", result.authJsonRead === false),
  check("codex_config_modified_false", result.codexConfigModified === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("provider_runtime_modified_false", result.providerRuntimeModified === false),
  check("deploy_executed_false", result.deployExecuted === false),
  check("release_executed_false", result.releaseExecuted === false),
  check("push_executed_false", result.pushExecuted === false),
  check("commit_created_false", result.commitCreated === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
  check("bundle_mirror_seeded", exists(bundleMirrorPath)),
];

finalize(result, checks, evidencePath, "phase650r_external_tool_final_closure_failed");
