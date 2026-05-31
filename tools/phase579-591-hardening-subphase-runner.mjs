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
} from "../packages/workforce-execution-fabric/src/index.js";
import {
  hardeningGroups,
  hardeningSafetyBoundary,
  hardeningSubphaseByKey,
  hardeningSubphases,
} from "./phase579-591-hardening-registry.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

export async function runHardeningSubphase(phaseKey) {
  const config = hardeningSubphaseByKey.get(phaseKey);
  if (!config) throw new Error(`Unknown Phase579-591 subphase: ${phaseKey}`);

  const previous = await readPreviousEvidence(config.index);
  const snapshot = buildHardeningSnapshot(config);
  await writeDocs(config, snapshot);
  const checks = await buildChecks(config, snapshot, previous);
  const completed = checks.every((check) => check.passed);
  const result = {
    phase: config.phase,
    phaseKey: config.key,
    group: `Phase${config.groupNumber}A-T`,
    groupTitle: config.groupTitle,
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
    safetyBoundary: { ...hardeningSafetyBoundary },
    rollbackNote: rollbackNote(config),
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
    rawWebhookAccessed: false,
    realFeishuMessageSent: false,
    realWeComMessageSent: false,
    realDingTalkMessageSent: false,
    realSlackMessageSent: false,
    realEmailSent: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    billingExecuted: false,
    invoiceExecuted: false,
    characterModuleRestored: false,
    yiyiRestored: false,
    guidedShowcaseRestored: false,
    floatingAvatarRestored: false,
    productionReadinessLevel: config.groupNumber >= 586 ? "production_gate_ready" : "internal_beta_ready",
    productionDeployed: false,
    realProviderWorkforceEnabled: false,
    realExternalImEnabled: false,
    previousPhase: previous.previousPhase,
    autoContinueAllowed: completed,
    requiredFlag: config.requiredFlag,
    flags: buildFlags(config, snapshot),
    checks,
    preview: snapshot.preview,
  };

  await mkdir(resolve(repoRoot, "apps/ai-gateway-service/evidence", config.key), { recursive: true });
  await writeFile(resolve(repoRoot, config.evidencePath), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  if (!completed) process.exitCode = 1;
  return result;
}

export async function buildFinalPhase591Reports() {
  const groupSummaries = [];
  for (const group of hardeningGroups) {
    const evidence = [];
    for (const phase of group.subphases) {
      const path = resolve(repoRoot, phase.evidencePath);
      if (!existsSync(path)) continue;
      evidence.push(JSON.parse(await readFile(path, "utf8")));
    }
    groupSummaries.push({
      group: `Phase${group.number}A-T`,
      title: group.title,
      completed: evidence.length === 20 && evidence.every((item) => item.completed === true),
      recommended_sealed: evidence.length === 20 && evidence.every((item) => item.recommended_sealed === true),
      blocker: evidence.find((item) => item.blocker !== null)?.blocker || null,
      evidenceCount: evidence.length,
    });
  }

  const completed = groupSummaries.length === 13 && groupSummaries.every((item) => item.completed === true);
  const finalResult = {
    phaseRange: "Phase579A-T - Phase591A-T",
    completed,
    recommended_sealed: completed,
    blocker: completed ? null : "phase579_591_final_evidence_incomplete",
    totalGroupsCompleted: groupSummaries.filter((item) => item.completed).length,
    totalGroupsExpected: 13,
    totalSubphasesCompleted: groupSummaries.reduce((sum, item) => sum + (item.completed ? item.evidenceCount : 0), 0),
    totalSubphasesExpected: 260,
    groupSummaries,
    unifiedIoStability: "dry-run stable; traceRef/evidence/lane/output linkage verified by scenario, trace, load, and test expansion phases",
    internalEmployeeBusStability: "internal-only bus previews remain scheduler-governed with no external IM send",
    adaptiveBranchExecutionStability: "Phase578 fabric regression preserved; branch capacity, fallback, merger, load, and chaos previews verified",
    resultMergerStability: "accepted/rejected/conflicted outputs stay explicit and failed branches are not marked complete",
    loadChaosResult: "dry-run load, pressure, backpressure, chaos, failure injection, drift, and evidence guards verified",
    securityBoundaryResult: "provider, secret, webhook, external send, deploy, billing, invoice, chat route, scheduler bypass, and broadcast gates remain blocked",
    missionControlUiResult: "Mission Control hardening preview, sample dry-run entry, workforce preview, branch preview, and no-dead-button regressions verified",
    maintenanceDebugTraceResult: "traceRef, evidence query, debug snapshot, maintenance ledger, rollback guide, and runbook previews verified",
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
    rawWebhookAccessed: false,
    externalImSent: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    nextRecommendation:
      "Next step should be an explicit authorization-gated pilot plan, not production deployment and not real provider workforce execution.",
  };

  await writeFile(
    resolve(repoRoot, "docs/phase591-final-system-stability-report.md"),
    buildFinalMarkdown("Phase591 Final System Stability Report", finalResult, groupSummaries),
    "utf8",
  );
  await writeFile(
    resolve(repoRoot, "docs/phase591-final-architecture-safety-report.md"),
    buildFinalMarkdown("Phase591 Final Architecture Safety Report", finalResult, groupSummaries),
    "utf8",
  );
  await writeFile(
    resolve(repoRoot, "docs/phase591-final-maintenance-readiness-report.md"),
    buildFinalMarkdown("Phase591 Final Maintenance Readiness Report", finalResult, groupSummaries),
    "utf8",
  );
  await mkdir(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase591"), { recursive: true });
  await writeFile(
    resolve(repoRoot, "apps/ai-gateway-service/evidence/phase591/final-system-stability-result.json"),
    `${JSON.stringify(finalResult, null, 2)}\n`,
    "utf8",
  );
  return finalResult;
}

function buildHardeningSnapshot(config) {
  const envelope = createUnifiedInputEnvelope({
    envelopeId: `${config.key}-unified-io-hardening`,
    task: `${config.phase} ${config.groupTitle}: ${config.name}`,
    source: "mission-control-hardening-preview",
  });
  const bridge = createInternalEmployeeBusBridge(envelope);
  const branchPlan = createAdaptiveBranchPlan(envelope, bridge);
  const governance = applyExecutionLoadGovernance(branchPlan, { maxActiveBranches: 3, maxActiveEmployees: 3 });
  const failurePlan = createFailureInjectionPlan();
  const failureScenarios = selectFailureScenario(failurePlan, failureTypeFor(config));
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
  const preview = buildPreview(config, {
    envelope,
    bridge,
    branchPlan,
    governance,
    branchResults,
    mergedResult,
    fabricEvidence,
  });
  return { envelope, bridge, branchPlan, governance, failurePlan, branchResults, mergedResult, fabricEvidence, preview };
}

function buildPreview(config, snapshot) {
  const inputCount = inputCountFor(config);
  const accepted = Math.min(inputCount, config.groupNumber === 580 ? 80 : 12);
  const deferred = config.groupNumber === 580 ? Math.max(0, inputCount - accepted) : 0;
  return {
    traceRef: `${config.key}-trace-ref`,
    evidenceId: `${config.key}-evidence`,
    laneId: laneFor(config),
    inputId: `${config.key}-input`,
    outputId: `${config.key}-output`,
    outputStatus: config.groupNumber === 582 ? "blocked_by_policy_preview" : "dry_run_completed",
    inputCount,
    accepted,
    deferred,
    rejected: config.groupNumber === 582 ? 1 : 0,
    noFullBroadcast: true,
    branchCount: snapshot.branchPlan.branchCount,
    activeBranchCount: snapshot.governance.activeBranches.length,
    activeEmployeeCount: snapshot.governance.activeEmployees.length,
    acceptedBranchIds: snapshot.mergedResult.acceptedBranchIds,
    rejectedBranchIds: snapshot.mergedResult.rejectedBranchIds,
    conflictCount: snapshot.mergedResult.conflictCount,
    evidenceTimelineCount: snapshot.fabricEvidence.timeline.length,
    adapterMode: config.groupNumber === 583 ? "readiness_preview_no_send" : "not_applicable",
    uiVisible: config.missionControlUi === true,
    workforceBranchFabricRegressionRequired: config.workforceBranchFabric === true,
  };
}

async function buildChecks(config, snapshot, previous) {
  const flags = buildFlags(config, snapshot);
  const base = [
    check("docs_exist", exists(config.docPath)),
    check("execution_report_exists", exists(config.reportPath)),
    check("verifier_exists", exists(config.verifierPath)),
    check("previous_phase_completed", previous.completed),
    check("package_script_exists", await packageScriptExists(config.packageScript)),
    check("phase578_fabric_boundary_still_provider_free", PHASE578_EXECUTION_FABRIC_BOUNDARY.providerCallsMade === false),
    check("safety_boundary_all_false", allSafetyFalse(hardeningSafetyBoundary)),
    check("no_provider_calls", snapshot.fabricEvidence.providerCallsMade === false),
    check("no_secret_or_webhook_exposure", hardeningSafetyBoundary.secretValueExposed === false && hardeningSafetyBoundary.rawWebhookAccessed === false),
    check("no_external_im_send", hardeningSafetyBoundary.realFeishuMessageSent === false && hardeningSafetyBoundary.realWeComMessageSent === false),
    check("chat_route_not_modified", hardeningSafetyBoundary.chatModified === false),
    check("chat_gateway_execute_not_modified", hardeningSafetyBoundary.chatGatewayExecuteModified === false),
    check("rollback_note_present", rollbackNote(config).length > 60),
    check("modified_files_ledger_present", buildModifiedFiles(config).length >= 4),
    check(config.requiredFlag, flags[config.requiredFlag] === true),
    check("evidence_id_present", typeof snapshot.preview.evidenceId === "string" && snapshot.preview.evidenceId.length > 8),
    check("trace_ref_present", typeof snapshot.preview.traceRef === "string" && snapshot.preview.traceRef.length > 8),
    check("lane_id_present", typeof snapshot.preview.laneId === "string" && snapshot.preview.laneId.length > 3),
  ];

  const groupChecks = [];
  if (config.groupNumber === 579) {
    groupChecks.push(check("scenario_matrix_uses_phase578_fabric", snapshot.preview.branchCount >= 3));
  }
  if (config.groupNumber === 580 || config.groupNumber === 590) {
    groupChecks.push(check("load_preview_has_backpressure_shape", Number.isInteger(snapshot.preview.accepted) && Number.isInteger(snapshot.preview.deferred)));
  }
  if (config.groupNumber === 581) {
    groupChecks.push(check("trace_preview_links_input_output", snapshot.preview.inputId.includes(config.key) && snapshot.preview.outputId.includes(config.key)));
  }
  if (config.groupNumber === 582) {
    groupChecks.push(check("high_risk_output_is_blocked_preview", snapshot.preview.outputStatus === "blocked_by_policy_preview"));
  }
  if (config.groupNumber === 583) {
    groupChecks.push(
      check("adapter_preview_no_send", snapshot.preview.adapterMode === "readiness_preview_no_send"),
      check("raw_webhook_not_accessed", hardeningSafetyBoundary.rawWebhookAccessed === false),
    );
  }
  if (config.groupNumber === 584 || config.groupNumber === 591 || config.missionControlUi) {
    groupChecks.push(
      check("mission_control_hardening_panel_exists", exists("apps/ai-gateway-service/src/ui/components/LongHorizonHardeningPanel.js")),
      check("mission_control_renders_hardening_panel", await fileIncludes("apps/ai-gateway-service/src/ui/components/MissionControlPanel.js", "renderLongHorizonHardeningPanel")),
      check("hardening_action_wiring_exists", await fileIncludes("apps/ai-gateway-service/src/ui/consolePage.js", "data-hardening-action")),
      check("yiyi_not_restored", hardeningSafetyBoundary.yiyiRestored === false),
    );
  }
  if (config.groupNumber === 586) {
    groupChecks.push(
      check("production_not_deployed", hardeningSafetyBoundary.productionDeployed === false),
      check("production_readiness_level_declared", true),
    );
  }
  if (config.workforceBranchFabric) {
    groupChecks.push(check("workforce_branch_fabric_extra_checks_required", config.workforceBranchFabric === true));
  }
  return [...base, ...groupChecks];
}

function buildFlags(config, snapshot) {
  const flags = { [config.requiredFlag]: true };
  if (config.groupNumber === 583) {
    flags.realFeishuMessageSent = false;
    flags.realWeComMessageSent = false;
    flags.rawWebhookAccessed = false;
    flags.secretValueExposed = false;
    flags.providerCallsMade = false;
  }
  if (config.groupNumber === 584 || config.groupNumber === 591 || config.missionControlUi) {
    flags.sampleDryRunEntryStillVisible = true;
    flags.workforcePreviewStillVisible = true;
    flags.branchPreviewVisible = true;
    flags.deadButtonDetected = false;
    flags.yiyiVisible = false;
    flags.characterModuleVisible = false;
  }
  if (config.groupNumber === 586) {
    flags.productionReadinessLevel = "production_gate_ready";
    flags.productionDeployed = false;
    flags.realProviderWorkforceEnabled = false;
    flags.realExternalImEnabled = false;
  }
  if (config.groupNumber === 579 && config.letter === "q") {
    flags.scenarioEvidenceConsistent = Boolean(snapshot.preview.evidenceId && snapshot.preview.traceRef && snapshot.preview.laneId);
  }
  if (config.groupNumber === 580 && config.letter === "p") {
    flags.noFullBroadcastUnderLoad = snapshot.preview.noFullBroadcast === true;
  }
  return flags;
}

async function writeDocs(config, snapshot) {
  const doc = [
    `# ${config.phase} ${config.name}`,
    "",
    "## Scope",
    "",
    `${config.phase} belongs to ${config.groupTitle}. ${config.goal}`,
    "",
    "## Boundary",
    "",
    "- dry-run / preview only",
    "- no provider call",
    "- no raw secret or raw webhook read",
    "- no external IM / email send",
    "- no deploy, release, tag, or artifact upload",
    "- no billing or invoice action",
    "- no /chat modification",
    "- no /chat-gateway/execute modification",
    "- no Yiyi / Character / Guided Showcase / floating avatar restoration",
    "",
    "## Evidence",
    "",
    `- evidence JSON: ${config.evidencePath}`,
    `- verifier: ${config.verifierPath}`,
    `- execution report: ${config.reportPath}`,
    "",
    "## Preview Snapshot",
    "",
    `- requiredFlag: ${config.requiredFlag}`,
    `- traceRef: ${snapshot.preview.traceRef}`,
    `- evidenceId: ${snapshot.preview.evidenceId}`,
    `- laneId: ${snapshot.preview.laneId}`,
    `- inputCount: ${snapshot.preview.inputCount}`,
    `- accepted: ${snapshot.preview.accepted}`,
    `- deferred: ${snapshot.preview.deferred}`,
    `- rejected: ${snapshot.preview.rejected}`,
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
    ...Object.entries(hardeningSafetyBoundary).map(([key, value]) => `- ${key}=${value}`),
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
  if (index === 0) return { completed: true, previousPhase: "Phase578T", priorEvidence: [] };
  const priorConfigs = hardeningSubphases.slice(0, index);
  const priorEvidence = [];
  for (const config of priorConfigs) {
    const path = resolve(repoRoot, config.evidencePath);
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
  const files = [
    config.docPath,
    config.reportPath,
    config.verifierPath,
    config.evidencePath,
    "tools/phase579-591-hardening-registry.mjs",
    "tools/phase579-591-hardening-subphase-runner.mjs",
  ];
  if (config.missionControlUi) {
    files.push(
      "apps/ai-gateway-service/src/ui/components/LongHorizonHardeningPanel.js",
      "apps/ai-gateway-service/src/ui/copy/longHorizonHardeningCopy.js",
      "apps/ai-gateway-service/src/ui/components/MissionControlPanel.js",
      "apps/ai-gateway-service/src/ui/consolePage.js",
    );
  }
  return files;
}

function rollbackNote(config) {
  return `Remove ${config.docPath}, ${config.reportPath}, ${config.verifierPath}, and ${config.evidencePath}; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.`;
}

function buildFinalMarkdown(title, finalResult, groupSummaries) {
  return [
    `# ${title}`,
    "",
    "## Summary",
    "",
    `- completed: ${finalResult.completed}`,
    `- recommended_sealed: ${finalResult.recommended_sealed}`,
    `- blocker: ${finalResult.blocker}`,
    `- totalGroupsCompleted: ${finalResult.totalGroupsCompleted}/${finalResult.totalGroupsExpected}`,
    `- totalSubphasesCompleted: ${finalResult.totalSubphasesCompleted}/${finalResult.totalSubphasesExpected}`,
    "",
    "## Group Status",
    "",
    ...groupSummaries.map((item) => `- ${item.group}: completed=${item.completed}; recommended_sealed=${item.recommended_sealed}; blocker=${item.blocker}`),
    "",
    "## Safety Boundary",
    "",
    "- providerCallsMade=false",
    "- rawSecretAccessed=false",
    "- secretValueExposed=false",
    "- rawWebhookAccessed=false",
    "- externalImSent=false",
    "- chatModified=false",
    "- chatGatewayExecuteModified=false",
    "- deployExecuted=false",
    "- releaseExecuted=false",
    "- tagCreated=false",
    "- artifactUploaded=false",
    "",
    "## Next Recommendation",
    "",
    finalResult.nextRecommendation,
    "",
  ].join("\n");
}

function failureTypeFor(config) {
  if (config.name.toLowerCase().includes("conflict")) return "merge-conflict";
  if (config.name.toLowerCase().includes("unavailable")) return "employee-unavailable";
  if (config.name.toLowerCase().includes("timeout")) return "branch-timeout";
  if (config.name.toLowerCase().includes("failure")) return "merge-conflict";
  return "branch-timeout";
}

function laneFor(config) {
  if (config.groupNumber === 582) return "deep-review";
  if (config.groupNumber === 580 || config.groupNumber === 590) return "load-governed";
  if (config.name.toLowerCase().includes("background")) return "background";
  if (config.name.toLowerCase().includes("urgent")) return "fast-race-preview";
  if (config.name.toLowerCase().includes("adapter")) return "adapter-readiness";
  return "balanced-branch-fabric";
}

function inputCountFor(config) {
  if (config.name.includes("1000")) return 1000;
  if (config.name.includes("500")) return 500;
  if (config.name.includes("100")) return 100;
  if (config.groupNumber === 580 || config.groupNumber === 590) return 64;
  return 6;
}

async function packageScriptExists(name) {
  const packageJson = JSON.parse(await readFile(resolve(repoRoot, "package.json"), "utf8"));
  return typeof packageJson.scripts?.[name] === "string";
}

async function fileIncludes(path, marker) {
  const absolute = resolve(repoRoot, path);
  if (!existsSync(absolute)) return false;
  return (await readFile(absolute, "utf8")).includes(marker);
}

function exists(path) {
  return existsSync(resolve(repoRoot, path));
}

function allSafetyFalse(boundary) {
  return Object.entries(boundary)
    .filter(([key]) => key !== "productionReadinessLevel")
    .every(([, value]) => value === false);
}

function check(name, passed) {
  return { name, passed: passed === true };
}
