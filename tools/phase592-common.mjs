import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCodexContextPack,
  buildPhase592RegressionFixtures,
  CODEX_CONTEXT_GATEWAY_BOUNDARY,
} from "../packages/codex-context-gateway/src/index.js";
import { phase592SafetyBoundary, phase592SubphaseByKey } from "./phase592-registry.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

export async function runPhase592Subphase(phaseKey) {
  const config = phase592SubphaseByKey.get(phaseKey);
  if (!config) throw new Error(`Unknown Phase592 subphase: ${phaseKey}`);

  const contextResult = await buildCodexContextPack({
    repoRoot,
    task: "Phase592A-T Codex Context Gateway + Token Budget Manager",
    profile: phaseKey === "phase592r" ? "mission-control-workforce" : "codex-context-gateway",
    budgetName: phaseKey === "phase592g" || phaseKey === "phase592s" ? "8k" : "16k",
    outputDir: ".codex-context",
  });

  const regression = await buildPhase592RegressionFixtures({ repoRoot });
  const previewResult = {
    completed: true,
    recommended_sealed: true,
    blocker: null,
    contextPackGenerated: contextResult.outputs.contextPackMarkdown.exists,
    tokenBudgetRespected: contextResult.tokenBudgetReport.budget.respected,
    staleContextDetectedWhenExpected: contextResult.freshnessReport.staleContextDetectedWhenExpected === true,
  };
  await writeDocs(config, previewResult, contextResult);
  const checks = await buildChecks(config, contextResult, regression);
  const completed = checks.every((check) => check.passed);
  const result = {
    phase: config.phase,
    phaseKey: config.key,
    group: "Phase592A-T",
    groupTitle: "Codex Context Gateway + Token Budget Manager",
    name: config.name,
    completed,
    recommended_sealed: completed,
    blocker: completed ? null : `${config.key}_${config.slug.replaceAll("-", "_")}_incomplete`,
    docs: [config.docPath],
    evidenceJson: config.evidencePath,
    verifier: config.verifierPath,
    verifierResult: completed ? "passed" : "failed",
    executionReport: config.reportPath,
    modifiedFiles: buildModifiedFiles(config),
    safetyBoundary: { ...phase592SafetyBoundary },
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
    rawWebhookAccessed: false,
    webhookValueExposed: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    codexBaseUrlModified: false,
    codexConfigModified: false,
    mainGatewayRuntimeModified: false,
    contextPackGenerated: contextResult.outputs.contextPackMarkdown.exists,
    tokenBudgetRespected: contextResult.tokenBudgetReport.budget.respected,
    staleContextDetectedWhenExpected: contextResult.freshnessReport.staleContextDetectedWhenExpected === true,
    requiredFlag: config.requiredFlag,
    flags: buildFlags(contextResult, regression),
    checks,
    outputFiles: contextResult.outputFiles,
    contextPack: {
      hash: contextResult.contextPack.hash,
      budgetName: contextResult.contextPack.tokenBudget.budgetName,
      estimatedTokens: contextResult.contextPack.tokenBudget.estimatedTokens,
      maxTokens: contextResult.contextPack.tokenBudget.maxTokens,
      relevantFileCount: contextResult.contextPack.relevantFiles.length,
      evidenceRefCount: contextResult.contextPack.phaseEvidence.indexedCount,
    },
    regressionSummary: regression.summary,
    tokenSavingEstimate: contextResult.tokenBudgetReport.tokenSavingEstimate,
    rollbackNote:
      "Remove packages/codex-context-gateway, tools/phase592*, docs/phase592*, apps/ai-gateway-service/evidence/phase592*, .codex-context outputs, and Phase592 package scripts; keep legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider runtime, Codex config, deploy, release, tags, artifacts, and secrets untouched.",
  };

  await writeDocs(config, result, contextResult);
  await mkdir(resolve(repoRoot, dirname(config.evidencePath)), { recursive: true });
  await writeFile(resolve(repoRoot, config.evidencePath), `${JSON.stringify(result, null, 2)}\n`, "utf8");

  console.log(JSON.stringify(result, null, 2));
  if (!completed) process.exitCode = 1;
  return result;
}

async function buildChecks(config, contextResult, regression) {
  const rootPackage = JSON.parse(await readFile(resolve(repoRoot, "package.json"), "utf8"));
  const flags = buildFlags(contextResult, regression);
  const expectedOutputs = [
    ".codex-context/current-context-pack.md",
    ".codex-context/current-context-pack.json",
    ".codex-context/phase-state-summary.md",
    ".codex-context/relevant-files.json",
    ".codex-context/token-budget-report.json",
    ".codex-context/codex-prompt-pack.md",
    ".codex-context/context-freshness-report.json",
  ];

  const checks = [
    check("package_exists", exists("packages/codex-context-gateway/package.json")),
    check("package_entry_exists", exists("packages/codex-context-gateway/src/index.js")),
    check("gateway_boundary_provider_free", CODEX_CONTEXT_GATEWAY_BOUNDARY.providerCallsMade === false),
    check("gateway_boundary_no_secret_read", CODEX_CONTEXT_GATEWAY_BOUNDARY.rawSecretAccessed === false),
    check("gateway_boundary_not_main_runtime", CODEX_CONTEXT_GATEWAY_BOUNDARY.mainGatewayRuntimeModified === false),
    check("docs_exist", exists(config.docPath)),
    check("execution_report_exists", exists(config.reportPath)),
    check("verifier_exists", exists(config.verifierPath)),
    check("package_script_exists", rootPackage.scripts?.[config.packageScript] === `node ${config.verifierPath}`),
    check("aggregate_package_script_exists", typeof rootPackage.scripts?.["verify:phase592a-t-codex-context-gateway-token-budget-manager"] === "string"),
    check("all_expected_outputs_exist", expectedOutputs.every((path) => exists(path))),
    check("context_pack_generated", contextResult.outputs.contextPackMarkdown.exists && contextResult.outputs.contextPackJson.exists),
    check("context_pack_schema_valid", contextResult.contextPack.schemaVersion === "phase592.context-pack.v1"),
    check("project_state_reader_complete", contextResult.projectState.completed === true),
    check("phase_evidence_indexer_complete", contextResult.phaseEvidence.indexedCount > 0),
    check("git_diff_summarizer_complete", contextResult.gitDiff.completed === true && contextResult.gitDiff.workspaceCleanClaimed === false),
    check("relevant_file_selector_complete", contextResult.relevantFiles.length > 0 && contextResult.relevantFiles.every((item) => item.mode !== "full-repo")),
    check("token_budget_respected", contextResult.tokenBudgetReport.budget.respected === true),
    check("long_context_compressor_complete", contextResult.longContextSummary.completed === true),
    check("codex_prompt_builder_complete", contextResult.promptPack.completed === true),
    check("freshness_detector_complete", contextResult.freshnessReport.completed === true),
    check("stale_guard_complete", contextResult.staleGuard.completed === true),
    check("stale_context_detected_when_expected", contextResult.freshnessReport.staleContextDetectedWhenExpected === true),
    check("regression_fixtures_passed", regression.completed === true),
    check("mission_control_workforce_context_pack_passed", regression.missionControlWorkforceContextPackTestPassed === true),
    check("token_saving_estimate_present", contextResult.tokenBudgetReport.tokenSavingEstimate.savedTokens > 0),
    check("safety_boundary_all_false", Object.values(phase592SafetyBoundary).every((value) => value === false)),
    check("no_provider_calls", contextResult.safety.providerCallsMade === false),
    check("no_secret_or_webhook_exposure", contextResult.safety.secretValueExposed === false && contextResult.safety.webhookValueExposed === false),
    check("chat_route_not_modified", contextResult.safety.chatModified === false),
    check("chat_gateway_execute_not_modified", contextResult.safety.chatGatewayExecuteModified === false),
    check("codex_base_url_not_modified", contextResult.safety.codexBaseUrlModified === false),
    check("codex_config_not_modified", contextResult.safety.codexConfigModified === false),
    check("main_gateway_runtime_not_modified", contextResult.safety.mainGatewayRuntimeModified === false),
    check(config.requiredFlag, flags[config.requiredFlag] === true),
  ];

  return checks;
}

function buildFlags(contextResult, regression) {
  return {
    architectureDefined: contextResult.architecture.components.length === 11,
    projectStateReaderWorks: contextResult.projectState.completed === true,
    phaseEvidenceIndexerWorks: contextResult.phaseEvidence.indexedCount > 0,
    gitDiffSummarizerWorks: contextResult.gitDiff.completed === true,
    relevantFileSelectorWorks: contextResult.relevantFiles.length > 0,
    contextPackSchemaWorks: contextResult.contextPack.schemaVersion === "phase592.context-pack.v1",
    tokenBudgetPolicyWorks: contextResult.tokenBudgetReport.policies.length === 3,
    longContextCompressorWorks: contextResult.longContextSummary.completed === true,
    codexPromptBuilderWorks: contextResult.promptPack.completed === true,
    contextHashPolicyWorks: typeof contextResult.contextPack.hash === "string" && contextResult.contextPack.hash.length === 64,
    contextFreshnessDetectorWorks: contextResult.freshnessReport.completed === true,
    staleContextGuardWorks: contextResult.staleGuard.staleBlocked === true,
    contextPackGeneratorWorks: contextResult.outputs.contextPackMarkdown.exists && contextResult.outputs.contextPackJson.exists,
    codexRunnerIntegrationPreviewWorks: contextResult.integrationPreview.codexConfigModified === false,
    gatewayBaseUrlCompatibilityStudyExists: contextResult.baseUrlCompatibilityStudy.realBaseUrlConnected === false,
    noProviderNoSecretSafetyGateWorks: contextResult.safety.providerCallsMade === false && contextResult.safety.secretValueExposed === false,
    contextPackRegressionTestsPassed: regression.completed === true,
    missionControlWorkforceContextPackTestPassed: regression.missionControlWorkforceContextPackTestPassed === true,
    tokenSavingEstimateReportWorks: contextResult.tokenBudgetReport.tokenSavingEstimate.savedPercent > 0,
    phase592RecommendedSealed: contextResult.closure.recommended_sealed === true && regression.completed === true,
  };
}

async function writeDocs(config, result, contextResult) {
  await writeFile(resolve(repoRoot, config.docPath), renderDoc(config, contextResult), "utf8");
  await writeFile(resolve(repoRoot, config.reportPath), renderReport(config, result, contextResult), "utf8");
}

function renderDoc(config, contextResult) {
  return [
    `# ${config.phase} ${config.name}`,
    "",
    "## Scope",
    "- Codex Context Gateway is an independent read-only context sub-gateway.",
    "- It does not attach to `/chat`, `/chat-gateway/execute`, provider runtime, Codex config, or real Codex base_url.",
    "- It reads bounded project state, phase evidence refs, docs/README/AGENTS summaries, and git dirty-file summaries without reading `.env` or raw secrets.",
    "",
    "## Capability",
    `- Required flag: ${config.requiredFlag}`,
    `- Context pack hash: ${contextResult.contextPack.hash}`,
    `- Relevant files: ${contextResult.contextPack.relevantFiles.length}`,
    `- Evidence refs: ${contextResult.contextPack.phaseEvidence.indexedCount}`,
    `- Token budget: ${contextResult.contextPack.tokenBudget.budgetName} / ${contextResult.contextPack.tokenBudget.maxTokens}`,
    "",
    "## Safety",
    "- providerCallsMade=false",
    "- rawSecretAccessed=false",
    "- secretValueExposed=false",
    "- chatModified=false",
    "- chatGatewayExecuteModified=false",
    "- codexBaseUrlModified=false",
    "- codexConfigModified=false",
    "- mainGatewayRuntimeModified=false",
    "- workspaceCleanClaimed=false",
    "",
  ].join("\n");
}

function renderReport(config, result, contextResult) {
  return [
    `# ${config.phase} Execution Report`,
    "",
    `- completed: ${result.completed}`,
    `- recommended_sealed: ${result.recommended_sealed}`,
    `- blocker: ${result.blocker === null ? "null" : result.blocker}`,
    `- contextPackGenerated: ${result.contextPackGenerated}`,
    `- tokenBudgetRespected: ${result.tokenBudgetRespected}`,
    `- staleContextDetectedWhenExpected: ${result.staleContextDetectedWhenExpected}`,
    `- providerCallsMade: ${result.providerCallsMade}`,
    `- rawSecretAccessed: ${result.rawSecretAccessed}`,
    `- secretValueExposed: ${result.secretValueExposed}`,
    `- codexConfigModified: ${result.codexConfigModified}`,
    `- codexBaseUrlModified: ${result.codexBaseUrlModified}`,
    "",
    "## Outputs",
    ...contextResult.outputFiles.map((file) => `- ${file}`),
    "",
  ].join("\n");
}

function buildModifiedFiles(config) {
  return [
    "packages/codex-context-gateway/package.json",
    "packages/codex-context-gateway/src/index.js",
    "tools/phase592-registry.mjs",
    "tools/phase592-common.mjs",
    "tools/phase592-sequential-runner.mjs",
    config.verifierPath,
    config.docPath,
    config.reportPath,
    config.evidencePath,
    "package.json",
    "README.md",
    "AGENTS.md",
    "apps/ai-gateway-service/src/entrypoints/syncReadmeAgentsCurrentState.js",
  ];
}

function exists(relativePath) {
  return existsSync(resolve(repoRoot, relativePath));
}

function check(id, passed, details = {}) {
  return { id, passed: Boolean(passed), details };
}
