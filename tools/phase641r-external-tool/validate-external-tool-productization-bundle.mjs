import {
  check,
  exists,
  finalize,
  readJson,
  readText,
  safetyBoundary,
} from "./external-tool-common.mjs";

const evidencePath =
  "apps/ai-gateway-service/evidence/phase641r-645r-external-tool/external-tool-productization-bundle-result.json";
const phase641 = readJson("apps/ai-gateway-service/evidence/phase641r-external-tool/codex-external-tool-cli-wrapper-result.json", {});
const phase642 = readJson("apps/ai-gateway-service/evidence/phase642r-external-tool/external-tool-operator-panel-hardening-result.json", {});
const phase643 = readJson("apps/ai-gateway-service/evidence/phase643r-external-tool/nightly-safe-runner-reliability-result.json", {});
const phase644 = readJson("apps/ai-gateway-service/evidence/phase644r-external-tool/open-source-dry-run-tool-pack-result.json", {});
const phase645 = readJson("apps/ai-gateway-service/evidence/phase645r-external-tool/token-saving-benchmark-recheck-result.json", {});
const phase640Matrix = readJson("docs/phase640r-external-tool-capability-matrix.json", {});
const panelText = readText("apps/ai-gateway-service/src/ui/components/CodexContextGatewayPanel.js");
const packageJson = readJson("package.json", {});
const scripts = packageJson.data?.scripts ?? {};

const failed = [];
function phaseDone(name, evidence) {
  const done = evidence.exists === true && !evidence.parseErrorReason && evidence.data?.completed === true && evidence.data?.recommended_sealed === true && evidence.data?.blocker === null;
  if (!done) failed.push(name);
  return done;
}

const result = {
  phase: "Phase641R-645R-ExternalTool",
  name: "Codex External Tool Productization Bundle",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phase641Completed: phaseDone("phase641", phase641),
  phase642Completed: phaseDone("phase642", phase642),
  phase643Completed: phaseDone("phase643", phase643),
  phase644Completed: phaseDone("phase644", phase644),
  phase645Completed: phaseDone("phase645", phase645),
  failed,
  externalToolMode: phase640Matrix.data?.externalToolMode === true,
  mainChainIntegrationPlanned: phase640Matrix.data?.mainChainIntegrationPlanned === true,
  chatIntegrationPlanned: phase640Matrix.data?.chatIntegrationPlanned === true,
  chatGatewayExecuteIntegrationPlanned: phase640Matrix.data?.chatGatewayExecuteIntegrationPlanned === true,
  providerRuntimeIntegrationPlanned: phase640Matrix.data?.providerRuntimeIntegrationPlanned === true,
  cliWrapperReady: phase641.data?.cliWrapperGenerated === true,
  operatorPanelReady:
    phase642.data?.operatorPanelHardened === true &&
    panelText.includes("data-codex-phase641r-645r-external-tool-bundle=\"true\""),
  nightlySafeRunnerReliabilityChecked: phase643.data?.nightlyReliabilityCheckGenerated === true,
  openSourceDryRunToolPackReady: phase644.data?.openSourceDryRunToolPackGenerated === true,
  tokenSavingBenchmarkRechecked: phase645.data?.tokenSavingBenchmarkRecheckGenerated === true,
  packageScriptsGenerated: Boolean(
    scripts["codex:external-tool:preflight"] &&
    scripts["verify:phase641r-external-tool-cli-wrapper"] &&
    scripts["verify:phase642r-external-tool-operator-panel-hardening"] &&
    scripts["verify:phase643r-external-tool-nightly-safe-runner-reliability"] &&
    scripts["verify:phase644r-external-tool-open-source-dry-run-tool-pack"] &&
    scripts["verify:phase645r-external-tool-token-saving-benchmark-recheck"] &&
    scripts["verify:phase641r-645r-external-tool-productization-bundle"],
  ),
  ...safetyBoundary(),
  docs: [
    "docs/phase641r-645r-external-tool-productization-closure.md",
    "docs/phase641r-645r-external-tool-execution-report.md",
  ],
  evidencePath,
};

const checks = [
  check("phase641_completed", result.phase641Completed),
  check("phase642_completed", result.phase642Completed),
  check("phase643_completed", result.phase643Completed),
  check("phase644_completed", result.phase644Completed),
  check("phase645_completed", result.phase645Completed),
  check("failed_empty", result.failed.length === 0),
  check("external_tool_mode_true", result.externalToolMode),
  check("main_chain_integration_planned_false", result.mainChainIntegrationPlanned === false),
  check("chat_integration_planned_false", result.chatIntegrationPlanned === false),
  check("chat_gateway_execute_integration_planned_false", result.chatGatewayExecuteIntegrationPlanned === false),
  check("provider_runtime_integration_planned_false", result.providerRuntimeIntegrationPlanned === false),
  check("cli_wrapper_ready", result.cliWrapperReady),
  check("operator_panel_ready", result.operatorPanelReady),
  check("nightly_safe_runner_reliability_checked", result.nightlySafeRunnerReliabilityChecked),
  check("open_source_dry_run_tool_pack_ready", result.openSourceDryRunToolPackReady),
  check("token_saving_benchmark_rechecked", result.tokenSavingBenchmarkRechecked),
  check("package_scripts_generated", Boolean(result.packageScriptsGenerated)),
  check("provider_calls_made_false", result.providerCallsMade === false),
  check("codex_exec_executed_by_this_bundle_false", result.codexExecExecutedByThisBundle === false),
  check("auth_json_read_false", result.authJsonRead === false),
  check("codex_config_modified_false", result.codexConfigModified === false),
  check("project_codex_config_modified_false", result.projectCodexConfigModified === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("provider_runtime_modified_false", result.providerRuntimeModified === false),
  check("secret_value_exposed_false", result.secretValueExposed === false),
  check("raw_base_url_value_exposed_false", result.rawBaseUrlValueExposed === false),
  check("webhook_value_exposed_false", result.webhookValueExposed === false),
  check("deploy_executed_false", result.deployExecuted === false),
  check("release_executed_false", result.releaseExecuted === false),
  check("tag_created_false", result.tagCreated === false),
  check("artifact_uploaded_false", result.artifactUploaded === false),
  check("push_executed_false", result.pushExecuted === false),
  check("commit_created_false", result.commitCreated === false),
  check("production_ready_claimed_false", result.productionReadyClaimed === false),
  check("release_ready_claimed_false", result.releaseReadyClaimed === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
  check("closure_doc_generated", exists("docs/phase641r-645r-external-tool-productization-closure.md")),
  check("execution_report_generated", exists("docs/phase641r-645r-external-tool-execution-report.md")),
];

finalize(result, checks, evidencePath, "phase641r_645r_external_tool_bundle_failed");
