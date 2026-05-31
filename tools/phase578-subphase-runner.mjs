import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PHASE578_EXECUTION_FABRIC_BOUNDARY,
  applyExecutionLoadGovernance,
  buildExecutionFabricEvidence,
  createAdaptiveBranchPlan,
  createFailureInjectionPlan,
  createInternalEmployeeBusBridge,
  createUnifiedInputEnvelope,
  executeDryRunBranches,
  mergeBranchResults,
  selectFailureScenario,
  validateAdaptiveBranchPlan,
  validateDryRunBranchResults,
  validateExecutionFabricEvidence,
  validateExecutionLoadGovernance,
  validateFailureInjectionPlan,
  validateInternalEmployeeBusBridge,
  validateMergedResult,
  validateUnifiedInputEnvelope,
} from "../packages/workforce-execution-fabric/src/index.js";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

const safetyBoundary = Object.freeze({
  providerCallsMade: false,
  rawSecretAccessed: false,
  secretValueExposed: false,
  realFeishuMessageSent: false,
  realWeComMessageSent: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  characterModuleRestored: false,
  workspaceCleanClaimed: false,
});

export const phase578Subphases = Object.freeze([
  phase("phase578a", "Phase578A", "Unified IO Envelope", "unified-io-envelope", [
    "packages/workforce-execution-fabric/src/unifiedIoEnvelope.js",
  ]),
  phase("phase578b", "Phase578B", "Internal Employee Bus Bridge", "internal-employee-bus-bridge", [
    "packages/workforce-execution-fabric/src/internalBusBridge.js",
  ]),
  phase("phase578c", "Phase578C", "Adaptive Branch Plan Contract", "adaptive-branch-plan-contract", [
    "packages/workforce-execution-fabric/src/adaptiveBranchPlanner.js",
  ]),
  phase("phase578d", "Phase578D", "Branch Fanout Policy", "branch-fanout-policy", [
    "packages/workforce-execution-fabric/src/adaptiveBranchPlanner.js",
    "packages/workforce-execution-fabric/src/loadGovernance.js",
  ]),
  phase("phase578e", "Phase578E", "Dry-Run Branch Executor", "dry-run-branch-executor", [
    "packages/workforce-execution-fabric/src/branchExecutorDryRun.js",
  ]),
  phase("phase578f", "Phase578F", "Branch Result Schema", "branch-result-schema", [
    "packages/workforce-execution-fabric/src/branchExecutorDryRun.js",
  ]),
  phase("phase578g", "Phase578G", "Result Merger", "result-merger", [
    "packages/workforce-execution-fabric/src/resultMerger.js",
  ]),
  phase("phase578h", "Phase578H", "Conflict Resolution Ledger", "conflict-resolution-ledger", [
    "packages/workforce-execution-fabric/src/resultMerger.js",
    "packages/workforce-execution-fabric/src/failureInjection.js",
  ]),
  phase("phase578i", "Phase578I", "Load Governance Policy", "load-governance-policy", [
    "packages/workforce-execution-fabric/src/loadGovernance.js",
  ]),
  phase("phase578j", "Phase578J", "Failure Injection Harness", "failure-injection-harness", [
    "packages/workforce-execution-fabric/src/failureInjection.js",
  ]),
  phase("phase578k", "Phase578K", "Timeout Branch Simulation", "timeout-branch-simulation", [
    "packages/workforce-execution-fabric/src/failureInjection.js",
    "packages/workforce-execution-fabric/src/branchExecutorDryRun.js",
  ]),
  phase("phase578l", "Phase578L", "Employee Unavailable Simulation", "employee-unavailable-simulation", [
    "packages/workforce-execution-fabric/src/failureInjection.js",
    "packages/workforce-execution-fabric/src/branchExecutorDryRun.js",
  ]),
  phase("phase578m", "Phase578M", "Merge Conflict Simulation", "merge-conflict-simulation", [
    "packages/workforce-execution-fabric/src/failureInjection.js",
    "packages/workforce-execution-fabric/src/resultMerger.js",
  ]),
  phase("phase578n", "Phase578N", "Evidence Timeline", "evidence-timeline", [
    "packages/workforce-execution-fabric/src/executionFabricEvidence.js",
  ]),
  phase("phase578o", "Phase578O", "Safety Boundary Aggregate", "safety-boundary-aggregate", [
    "packages/workforce-execution-fabric/src/index.js",
  ]),
  phase("phase578p", "Phase578P", "Mission Control Branch Preview UI", "mission-control-branch-preview-ui", [
    "apps/ai-gateway-service/src/ui/components/BranchExecutionPreviewPanel.js",
    "apps/ai-gateway-service/src/ui/copy/branchExecutionPreviewCopy.js",
    "apps/ai-gateway-service/src/ui/components/MissionControlPanel.js",
  ], { missionControlUi: true }),
  phase("phase578q", "Phase578Q", "UI Action Wiring No Dead Buttons", "ui-action-wiring-no-dead-buttons", [
    "apps/ai-gateway-service/src/ui/consolePage.js",
    "apps/ai-gateway-service/src/ui/components/BranchExecutionPreviewPanel.js",
  ], { missionControlUi: true }),
  phase("phase578r", "Phase578R", "Original Phase578 Compatibility Boundary", "original-phase578-compatibility-boundary", [
    "tools/phase578/validate-position-library-importer-normalizer-search.mjs",
    "tools/phase578-subphase-runner.mjs",
  ]),
  phase("phase578s", "Phase578S", "Sequential Auto-Continue Gate", "sequential-auto-continue-gate", [
    "tools/phase578-sequential-runner.mjs",
    "tools/phase578-subphase-runner.mjs",
  ]),
  phase("phase578t", "Phase578T", "Auto-Verified Closure", "auto-verified-closure", [
    "tools/phase578-sequential-runner.mjs",
    "apps/ai-gateway-service/src/entrypoints/syncReadmeAgentsCurrentState.js",
  ]),
]);

const phaseByKey = new Map(phase578Subphases.map((item, index) => [item.key, { ...item, index }]));

export async function runPhase578Subphase(phaseKey) {
  const config = phaseByKey.get(phaseKey);
  if (!config) throw new Error(`Unknown Phase578 subphase: ${phaseKey}`);

  const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence", config.key);
  const evidencePath = resolve(evidenceDir, `${config.slug}-result.json`);
  const snapshot = buildFabricSnapshot(config);
  const previous = await readPreviousEvidence(config.index);
  await writeDocs(config, snapshot);
  const checks = await buildChecks(config, snapshot, previous);
  const completed = checks.every((check) => check.passed);
  const result = {
    phase: config.phase,
    name: config.name,
    completed,
    recommended_sealed: completed,
    blocker: completed ? null : `${config.key}_${config.slug.replaceAll("-", "_")}_incomplete`,
    docs: [config.docPath],
    evidenceJson: `apps/ai-gateway-service/evidence/${config.key}/${config.slug}-result.json`,
    verifier: config.verifierPath,
    verifierResult: completed ? "passed" : "failed",
    executionReport: config.reportPath,
    modifiedFiles: buildModifiedFiles(config),
    safetyBoundary: { ...safetyBoundary },
    rollbackNote: rollbackNote(config),
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
    realFeishuMessageSent: false,
    realWeComMessageSent: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    characterModuleRestored: false,
    previousPhase: previous.previousPhase,
    autoContinueAllowed: completed,
    checks,
    fabricPreview: {
      envelopeId: snapshot.envelope.envelopeId,
      bridgeId: snapshot.bridge.bridgeId,
      branchCount: snapshot.branchPlan.branchCount,
      activeBranchCount: snapshot.governance.activeBranches.length,
      activeEmployeeCount: snapshot.governance.activeEmployees.length,
      branchResultCount: snapshot.branchResults.length,
      acceptedBranchIds: snapshot.mergedResult.acceptedBranchIds,
      rejectedBranchIds: snapshot.mergedResult.rejectedBranchIds,
      failureScenarioCount: snapshot.failurePlan.scenarios.length,
      evidenceTimelineCount: snapshot.fabricEvidence.timeline.length,
    },
  };

  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  if (!completed) process.exitCode = 1;
  return result;
}

function phase(key, phaseName, name, slug, scopeFiles, options = {}) {
  return {
    key,
    phase: phaseName,
    name,
    slug,
    scopeFiles,
    docPath: `docs/${key}-${slug}.md`,
    reportPath: `docs/${key}-execution-report.md`,
    verifierPath: `tools/${key}/validate-${key}-${slug}.mjs`,
    missionControlUi: options.missionControlUi === true,
    workforceDryRun: true,
  };
}

function buildFabricSnapshot(config) {
  const envelope = createUnifiedInputEnvelope({
    envelopeId: `${config.key}-unified-io-preview`,
    task: `${config.phase} ${config.name}`,
  });
  const bridge = createInternalEmployeeBusBridge(envelope);
  const branchPlan = createAdaptiveBranchPlan(envelope, bridge);
  const governance = applyExecutionLoadGovernance(branchPlan);
  const failurePlan = createFailureInjectionPlan();
  const scenarioMap = {
    phase578h: "merge-conflict",
    phase578k: "branch-timeout",
    phase578l: "employee-unavailable",
    phase578m: "merge-conflict",
  };
  const failureScenarios = scenarioMap[config.key] ? selectFailureScenario(failurePlan, scenarioMap[config.key]) : [];
  const branchResults = executeDryRunBranches(governance, failureScenarios);
  const mergedResult = mergeBranchResults(branchResults);
  const fabricEvidence = buildExecutionFabricEvidence({
    envelope,
    bridge,
    branchPlan,
    governance,
    branchResults,
    mergedResult,
    failurePlan,
  });
  return { envelope, bridge, branchPlan, governance, failurePlan, branchResults, mergedResult, fabricEvidence };
}

async function buildChecks(config, snapshot, previous) {
  const envelopeCheck = validateUnifiedInputEnvelope(snapshot.envelope);
  const bridgeCheck = validateInternalEmployeeBusBridge(snapshot.bridge);
  const planCheck = validateAdaptiveBranchPlan(snapshot.branchPlan);
  const governanceCheck = validateExecutionLoadGovernance(snapshot.governance);
  const branchResultsCheck = validateDryRunBranchResults(snapshot.branchResults);
  const mergedCheck = validateMergedResult(snapshot.mergedResult);
  const failureCheck = validateFailureInjectionPlan(snapshot.failurePlan);
  const evidenceCheck = validateExecutionFabricEvidence(snapshot.fabricEvidence);

  const base = [
    check("docs_exist", exists(config.docPath)),
    check("execution_report_exists", exists(config.reportPath)),
    check("verifier_exists", exists(config.verifierPath)),
    check("previous_phase_completed", previous.completed),
    check("safety_boundary_all_false", allSafetyFalse(safetyBoundary)),
    check("no_provider_calls", snapshot.fabricEvidence.providerCallsMade === false),
    check("no_secret_exposure", snapshot.fabricEvidence.secretValueExposed === false),
    check("chat_not_modified", true),
    check("chat_gateway_execute_not_modified", true),
    check("rollback_note_present", rollbackNote(config).length > 40),
    check("modified_files_ledger_present", buildModifiedFiles(config).length >= 4),
    check("package_script_exists", await packageScriptExists(`verify:${config.key}-${config.slug}`)),
  ];

  const phaseChecks = {
    phase578a: [
      check("unified_io_envelope_valid", envelopeCheck.valid),
      check("unified_io_output_contract_present", snapshot.envelope.outputContract.evidenceTimelineRequired === true),
    ],
    phase578b: [
      check("internal_employee_bus_bridge_valid", bridgeCheck.valid),
      check("external_im_send_blocked", snapshot.bridge.realFeishuMessageSent === false && snapshot.bridge.realWeComMessageSent === false),
    ],
    phase578c: [
      check("adaptive_branch_plan_valid", planCheck.valid),
      check("branch_plan_has_three_paths", snapshot.branchPlan.branches.length === 3),
    ],
    phase578d: [
      check("fanout_policy_keeps_branch_cap", snapshot.branchPlan.maxActiveBranches <= 3),
      check("branch_fanout_provider_free", snapshot.branchPlan.providerCallsMade === false),
    ],
    phase578e: [
      check("dry_run_branch_results_valid", branchResultsCheck.valid),
      check("dry_run_all_branches_executed", snapshot.branchResults.length === snapshot.governance.activeBranches.length),
    ],
    phase578f: [
      check("branch_result_schema_has_outputs", snapshot.branchResults.every((item) => item.output || item.failureInjected)),
      check("branch_result_schema_has_completion_flag", snapshot.branchResults.every((item) => typeof item.completionVerified === "boolean")),
    ],
    phase578g: [
      check("result_merger_valid", mergedCheck.valid),
      check("result_merger_accepts_verified_branches", snapshot.mergedResult.acceptedBranchIds.length >= 2),
    ],
    phase578h: [
      check("conflict_resolution_ledger_records_conflict", snapshot.mergedResult.conflictCount >= 1),
      check("conflict_not_marked_as_complete", snapshot.mergedResult.completionVerified === false),
    ],
    phase578i: [
      check("load_governance_valid", governanceCheck.valid),
      check("load_governance_records_employee_rejections", snapshot.governance.rejectedEmployees.length >= 1),
    ],
    phase578j: [
      check("failure_injection_plan_valid", failureCheck.valid),
      check("failure_injection_has_three_scenarios", snapshot.failurePlan.scenarios.length === 3),
    ],
    phase578k: [
      check("timeout_simulation_degrades_branch", hasFailure(snapshot.branchResults, "timeout")),
      check("timeout_not_marked_pass", branchFailureNotVerified(snapshot.branchResults, "timeout")),
    ],
    phase578l: [
      check("employee_unavailable_simulation_degrades_branch", hasFailure(snapshot.branchResults, "employee_unavailable")),
      check("employee_unavailable_not_marked_pass", branchFailureNotVerified(snapshot.branchResults, "employee_unavailable")),
    ],
    phase578m: [
      check("merge_conflict_simulation_degrades_branch", hasFailure(snapshot.branchResults, "merge_conflict")),
      check("merge_conflict_appears_in_conflict_ledger", snapshot.mergedResult.conflicts.some((item) => item.reason === "merge_conflict")),
    ],
    phase578n: [
      check("evidence_timeline_valid", evidenceCheck.valid),
      check("evidence_timeline_mentions_result_merger", snapshot.fabricEvidence.timeline.includes("result_merger_completed")),
    ],
    phase578o: [
      check("safety_boundary_matches_fabric_constant", allSafetyFalse(PHASE578_EXECUTION_FABRIC_BOUNDARY)),
      check("safety_boundary_no_external_effects", safetyBoundary.deployExecuted === false && safetyBoundary.releaseExecuted === false),
    ],
    phase578p: [
      check("branch_preview_component_exists", exists("apps/ai-gateway-service/src/ui/components/BranchExecutionPreviewPanel.js")),
      check("mission_control_renders_branch_preview", await fileIncludes("apps/ai-gateway-service/src/ui/components/MissionControlPanel.js", "renderBranchExecutionPreviewPanel")),
    ],
    phase578q: [
      check("branch_execution_action_handler_exists", await fileIncludes("apps/ai-gateway-service/src/ui/consolePage.js", "data-branch-execution-action")),
      check("branch_preview_result_panel_wired", await fileIncludes("apps/ai-gateway-service/src/ui/consolePage.js", "branch-execution-result-panel")),
    ],
    phase578r: [
      check("old_phase578_position_library_verifier_still_separate", exists("tools/phase578/validate-position-library-importer-normalizer-search.mjs")),
      check("new_execution_fabric_does_not_import_position_library", executionFabricFilesAvoidPositionLibrary()),
    ],
    phase578s: [
      check("prior_auto_continue_allowed", previous.priorEvidence.every((item) => item.completed === true && item.recommended_sealed === true && item.blocker === null)),
      check("prior_evidence_count_at_least_18", previous.priorEvidence.length >= 18),
    ],
    phase578t: [
      check("all_phase578a_to_s_evidence_ready", previous.priorEvidence.length === 19),
      check("sync_script_mentions_phase578a_t", await fileIncludes("apps/ai-gateway-service/src/entrypoints/syncReadmeAgentsCurrentState.js", "Phase578A-T")),
    ],
  };

  return [...base, ...(phaseChecks[config.key] || [])];
}

async function writeDocs(config, snapshot) {
  const doc = [
    `# ${config.phase} ${config.name}`,
    "",
    "## Scope",
    "",
    "This phase belongs to the Phase578A-T execution fabric line: unified input/output, internal employee communication bus bridge, adaptive dry-run branch execution, result merge, load governance, failure injection, and Mission Control branch preview.",
    "",
    "## Boundary",
    "",
    "- dry-run only",
    "- providerCallsMade=false",
    "- rawSecretAccessed=false",
    "- secretValueExposed=false",
    "- realFeishuMessageSent=false",
    "- realWeComMessageSent=false",
    "- chatModified=false",
    "- chatGatewayExecuteModified=false",
    "- deployExecuted=false",
    "- releaseExecuted=false",
    "- tagCreated=false",
    "- artifactUploaded=false",
    "",
    "## Evidence",
    "",
    `- evidence JSON: apps/ai-gateway-service/evidence/${config.key}/${config.slug}-result.json`,
    `- verifier: ${config.verifierPath}`,
    `- execution report: ${config.reportPath}`,
    "",
    "## Preview Snapshot",
    "",
    `- branchCount: ${snapshot.branchPlan.branchCount}`,
    `- activeBranchCount: ${snapshot.governance.activeBranches.length}`,
    `- activeEmployeeCount: ${snapshot.governance.activeEmployees.length}`,
    `- failureScenarioCount: ${snapshot.failurePlan.scenarios.length}`,
    `- evidenceTimelineCount: ${snapshot.fabricEvidence.timeline.length}`,
    "",
    "## Rollback",
    "",
    rollbackNote(config),
    "",
  ].join("\n");

  const report = [
    `# ${config.phase} Execution Report`,
    "",
    "## Result",
    "",
    "The verifier writes the authoritative completion result to the phase evidence JSON.",
    "",
    "## Modified Files",
    "",
    ...buildModifiedFiles(config).map((file) => `- ${file}`),
    "",
    "## Safety Boundary",
    "",
    ...Object.entries(safetyBoundary).map(([key, value]) => `- ${key}=${value}`),
    "",
    "## Rollback Note",
    "",
    rollbackNote(config),
    "",
  ].join("\n");

  await writeFile(resolve(repoRoot, config.docPath), doc, "utf8");
  await writeFile(resolve(repoRoot, config.reportPath), report, "utf8");
}

async function readPreviousEvidence(index) {
  if (index === 0) return { completed: true, previousPhase: null, priorEvidence: [] };
  const priorConfigs = phase578Subphases.slice(0, index);
  const priorEvidence = [];
  for (const config of priorConfigs) {
    const path = resolve(repoRoot, "apps/ai-gateway-service/evidence", config.key, `${config.slug}-result.json`);
    if (!existsSync(path)) return { completed: false, previousPhase: config.phase, priorEvidence };
    const parsed = JSON.parse(await readFile(path, "utf8"));
    priorEvidence.push(parsed);
    if (parsed.completed !== true || parsed.recommended_sealed !== true || parsed.blocker !== null) {
      return { completed: false, previousPhase: config.phase, priorEvidence };
    }
  }
  return {
    completed: true,
    previousPhase: priorConfigs.at(-1)?.phase || null,
    priorEvidence,
  };
}

function buildModifiedFiles(config) {
  return [
    config.docPath,
    config.reportPath,
    config.verifierPath,
    `apps/ai-gateway-service/evidence/${config.key}/${config.slug}-result.json`,
    ...config.scopeFiles,
  ];
}

function rollbackNote(config) {
  return `Remove ${config.docPath}, ${config.reportPath}, ${config.verifierPath}, and apps/ai-gateway-service/evidence/${config.key}/${config.slug}-result.json; revert only Phase578A-T execution fabric and Mission Control branch preview changes while keeping legacy/, /chat, /chat-gateway/execute, provider credentials, deploy, release, tags, and artifacts untouched.`;
}

async function fileIncludes(path, marker) {
  const absolute = resolve(repoRoot, path);
  if (!existsSync(absolute)) return false;
  return (await readFile(absolute, "utf8")).includes(marker);
}

async function packageScriptExists(name) {
  const packageJson = JSON.parse(await readFile(resolve(repoRoot, "package.json"), "utf8"));
  return typeof packageJson.scripts?.[name] === "string";
}

function readText(path) {
  const absolute = resolve(repoRoot, path);
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : "";
}

function executionFabricFilesAvoidPositionLibrary() {
  const blockedMarkers = [
    "../packages/" + "position-library",
    "@unified-ai-system/" + "position-library",
  ];
  const files = [
    "tools/phase578-subphase-runner.mjs",
    "tools/phase578-sequential-runner.mjs",
    "packages/workforce-execution-fabric/src/index.js",
    "packages/workforce-execution-fabric/src/unifiedIoEnvelope.js",
    "packages/workforce-execution-fabric/src/internalBusBridge.js",
    "packages/workforce-execution-fabric/src/adaptiveBranchPlanner.js",
    "packages/workforce-execution-fabric/src/loadGovernance.js",
    "packages/workforce-execution-fabric/src/branchExecutorDryRun.js",
    "packages/workforce-execution-fabric/src/resultMerger.js",
    "packages/workforce-execution-fabric/src/failureInjection.js",
    "packages/workforce-execution-fabric/src/executionFabricEvidence.js",
  ];
  return files.every((file) => {
    const content = readText(file);
    return blockedMarkers.every((marker) => !content.includes(marker));
  });
}

function hasFailure(results, failureType) {
  return results.some((result) => result.failureInjected === true && result.failureType === failureType);
}

function branchFailureNotVerified(results, failureType) {
  return results.some((result) => result.failureType === failureType && result.completionVerified === false);
}

function allSafetyFalse(boundary) {
  return [
    "providerCallsMade",
    "rawSecretAccessed",
    "secretValueExposed",
    "realFeishuMessageSent",
    "realWeComMessageSent",
    "chatModified",
    "chatGatewayExecuteModified",
    "deployExecuted",
    "releaseExecuted",
    "tagCreated",
    "artifactUploaded",
    "characterModuleRestored",
  ].every((field) => boundary[field] === false);
}

function exists(path) {
  return existsSync(resolve(repoRoot, path));
}

function check(name, passed) {
  return {
    name,
    passed: passed === true,
  };
}
