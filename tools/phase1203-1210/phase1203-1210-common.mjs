import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const phaseRange = "Phase1203-1210-AIO";
export const closureEvidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1203-1210-taiji-beidou-dry-run-closure");
export const closureResultPath = resolve(closureEvidenceDir, "taiji-beidou-dry-run-closure-result.json");
export const closureValidationPath = resolve(closureEvidenceDir, "taiji-beidou-dry-run-closure-validation-result.json");
export const closureReportPath = resolve(repoRoot, "docs/phase1203-1210-taiji-beidou-dry-run-closure-report.md");
export const closureExecutionReportPath = resolve(repoRoot, "docs/phase1203-1210-execution-report.md");
export const missionControlPanelPath = resolve(repoRoot, "apps/ai-gateway-service/src/ui/components/MissionControlPanel.js");
export const missionControlReadoutPanelPath = resolve(repoRoot, "apps/ai-gateway-service/src/ui/components/TaijiBeidouDryRunReadoutPreviewPanel.js");

export const phaseConfigs = {
  phase1203: {
    phase: "Phase1203",
    title: "Capability Candidate Readout Schema",
    evidenceDir: "apps/ai-gateway-service/evidence/phase1203-capability-candidate-readout",
    resultFile: "capability-candidate-readout-result.json",
    validationFile: "capability-candidate-readout-validation-result.json",
    docsFile: "docs/phase1203-capability-candidate-readout-schema.md",
    smokeScript: "smoke:phase1203-taiji-beidou-capability-candidate-readout:dry-run",
    verifyScript: "verify:phase1203-taiji-beidou-capability-candidate-readout",
    runCommand: "node tools/phase1203/run-capability-candidate-readout.mjs",
    validateCommand: "node tools/phase1203/validate-capability-candidate-readout.mjs",
    generatedFlag: "capabilityCandidatesGenerated",
    requiredFields: ["candidateCapabilities", "candidateModules", "candidatePhases", "candidateExecutionPaths", "blockedCandidates", "approvalRequiredCandidates"],
  },
  phase1204: {
    phase: "Phase1204",
    title: "Tianshu Dry-run Planner Alignment",
    evidenceDir: "apps/ai-gateway-service/evidence/phase1204-tianshu-planner-alignment",
    resultFile: "tianshu-planner-alignment-result.json",
    validationFile: "tianshu-planner-alignment-validation-result.json",
    docsFile: "docs/phase1204-tianshu-dry-run-planner-alignment.md",
    smokeScript: "smoke:phase1204-taiji-beidou-tianshu-planner-alignment:dry-run",
    verifyScript: "verify:phase1204-taiji-beidou-tianshu-planner-alignment",
    runCommand: "node tools/phase1204/run-tianshu-planner-alignment.mjs",
    validateCommand: "node tools/phase1204/validate-tianshu-planner-alignment.mjs",
    generatedFlag: "plannerAlignmentGenerated",
    requiredFields: ["plannerInput", "plannerRecommendation", "routeCandidates", "modeRecommendation", "executionPlanPreview"],
  },
  phase1205: {
    phase: "Phase1205",
    title: "Evidence Replay for Field Reasoning",
    evidenceDir: "apps/ai-gateway-service/evidence/phase1205-field-reasoning-evidence-replay",
    resultFile: "field-reasoning-evidence-replay-result.json",
    validationFile: "field-reasoning-evidence-replay-validation-result.json",
    docsFile: "docs/phase1205-field-reasoning-evidence-replay.md",
    smokeScript: "smoke:phase1205-taiji-beidou-field-reasoning-evidence-replay:dry-run",
    verifyScript: "verify:phase1205-taiji-beidou-field-reasoning-evidence-replay",
    runCommand: "node tools/phase1205/run-field-reasoning-evidence-replay.mjs",
    validateCommand: "node tools/phase1205/validate-field-reasoning-evidence-replay.mjs",
    generatedFlag: "evidenceReplayPreviewGenerated",
    requiredFields: ["sourceTrace", "fieldStepTrace", "candidateTrace", "blockedReasonTrace", "approvalReasonTrace", "readoutTrace"],
  },
  phase1206: {
    phase: "Phase1206",
    title: "Safety Negative Sources + Cost Sources",
    evidenceDir: "apps/ai-gateway-service/evidence/phase1206-safety-cost-sources",
    resultFile: "safety-cost-sources-result.json",
    validationFile: "safety-cost-sources-validation-result.json",
    docsFile: "docs/phase1206-safety-negative-sources-cost-sources.md",
    smokeScript: "smoke:phase1206-taiji-beidou-safety-cost-sources:dry-run",
    verifyScript: "verify:phase1206-taiji-beidou-safety-cost-sources",
    runCommand: "node tools/phase1206/run-safety-cost-sources.mjs",
    validateCommand: "node tools/phase1206/validate-safety-cost-sources.mjs",
    generatedFlag: "safetyCostSourcesGenerated",
    requiredFields: ["safetyNegativeSources", "forbiddenCapabilitySources", "costConstraintSources", "providerBoundarySources", "secretBoundarySources", "deploymentBoundarySources"],
  },
  phase1207: {
    phase: "Phase1207",
    title: "Capability Cell Generation Dry-run",
    evidenceDir: "apps/ai-gateway-service/evidence/phase1207-capability-cell-generation",
    resultFile: "capability-cell-generation-result.json",
    validationFile: "capability-cell-generation-validation-result.json",
    docsFile: "docs/phase1207-capability-cell-generation-dry-run.md",
    smokeScript: "smoke:phase1207-taiji-beidou-capability-cell-generation:dry-run",
    verifyScript: "verify:phase1207-taiji-beidou-capability-cell-generation",
    runCommand: "node tools/phase1207/run-capability-cell-generation.mjs",
    validateCommand: "node tools/phase1207/validate-capability-cell-generation.mjs",
    generatedFlag: "capabilityCellsGenerated",
    requiredFields: ["capabilityCells", "cellInputs", "cellOutputs", "cellRisks", "cellDependencies", "cellEvidenceRefs"],
  },
  phase1208: {
    phase: "Phase1208",
    title: "Capability Repair / Prune / Reweight Dry-run",
    evidenceDir: "apps/ai-gateway-service/evidence/phase1208-capability-cell-repair-prune-reweight",
    resultFile: "capability-cell-repair-prune-reweight-result.json",
    validationFile: "capability-cell-repair-prune-reweight-validation-result.json",
    docsFile: "docs/phase1208-capability-cell-repair-prune-reweight-dry-run.md",
    smokeScript: "smoke:phase1208-taiji-beidou-capability-cell-repair-prune-reweight:dry-run",
    verifyScript: "verify:phase1208-taiji-beidou-capability-cell-repair-prune-reweight",
    runCommand: "node tools/phase1208/run-capability-cell-repair-prune-reweight.mjs",
    validateCommand: "node tools/phase1208/validate-capability-cell-repair-prune-reweight.mjs",
    generatedFlag: "repairPruneReweightGenerated",
    requiredFields: ["repairedCells", "prunedCells", "reweightedCells", "repairReasons", "pruneReasons", "weightingReasons"],
  },
  phase1209: {
    phase: "Phase1209",
    title: "Mission Control Read-only Preview",
    evidenceDir: "apps/ai-gateway-service/evidence/phase1209-mission-control-taiji-beidou-preview",
    resultFile: "mission-control-taiji-beidou-preview-result.json",
    validationFile: "mission-control-taiji-beidou-preview-validation-result.json",
    docsFile: "docs/phase1209-mission-control-taiji-beidou-readonly-preview.md",
    smokeScript: "smoke:phase1209-mission-control-taiji-beidou-preview:dry-run",
    verifyScript: "verify:phase1209-mission-control-taiji-beidou-preview",
    runCommand: "node tools/phase1209/run-mission-control-taiji-beidou-preview.mjs",
    validateCommand: "node tools/phase1209/validate-mission-control-taiji-beidou-preview.mjs",
    generatedFlag: "missionControlReadOnlyPreviewGenerated",
    requiredFields: ["missionControlPreview", "previewCards", "previewCopy", "syntheticEvidenceRefs"],
  },
  phase1210: {
    phase: "Phase1210",
    title: "Main-chain Entry Human Approval Packet",
    evidenceDir: "apps/ai-gateway-service/evidence/phase1210-main-chain-entry-approval-packet",
    resultFile: "main-chain-entry-approval-packet-result.json",
    validationFile: "main-chain-entry-approval-packet-validation-result.json",
    docsFile: "docs/phase1210-main-chain-entry-human-approval-packet.md",
    smokeScript: "smoke:phase1210-main-chain-entry-approval-packet:dry-run",
    verifyScript: "verify:phase1210-main-chain-entry-approval-packet",
    runCommand: "node tools/phase1210/run-main-chain-entry-approval-packet.mjs",
    validateCommand: "node tools/phase1210/validate-main-chain-entry-approval-packet.mjs",
    generatedFlag: "mainChainApprovalPacketGenerated",
    requiredFields: ["mainChainEntryApprovalPacket", "riskLedger", "rollbackPlan", "noFlagRegressionPlan", "requiredHumanApprovalFields", "futureExecutionGate"],
  },
};

export const phaseKeys = Object.keys(phaseConfigs);

export function phaseBoundary() {
  return {
    providerCallsMade: false,
    secretRead: false,
    secretValueExposed: false,
    authJsonRead: false,
    gloveDownloaded: false,
    chatModified: false,
    chatRuntimeModified: false,
    chatGatewayExecuteModified: false,
    chatGatewayExecuteRuntimeModified: false,
    mainChainIntegrationExecuted: false,
    mainChainDefaultEnabled: false,
    providerRuntimeDefaultEnabled: false,
    providerRuntimeEnabled: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    commitCreated: false,
    pushExecuted: false,
    workspaceCleanClaimed: false,
    legacyModified: false,
    projectContextModified: false,
    realSemanticValidationClaimed: false,
    syntheticOnly: true,
  };
}

export function resultPathFor(key) {
  const config = phaseConfigs[key];
  return resolve(repoRoot, config.evidenceDir, config.resultFile);
}

export function validationPathFor(key) {
  const config = phaseConfigs[key];
  return resolve(repoRoot, config.evidenceDir, config.validationFile);
}

export function docsPathFor(key) {
  return resolve(repoRoot, phaseConfigs[key].docsFile);
}

export async function readTextIfExists(path, fallback = "") {
  try {
    return String(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

export async function readJsonIfExists(path, fallback = null) {
  const text = await readTextIfExists(path, "");
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export async function pathExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeText(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${String(value).trimEnd()}\n`, "utf8");
}

export async function validatePhaseEvidence(key) {
  const config = phaseConfigs[key];
  const result = await readJsonIfExists(resultPathFor(key), null);
  const docsText = await readTextIfExists(docsPathFor(key), "");
  const packageJson = JSON.parse(await readTextIfExists(resolve(repoRoot, "package.json"), "{}"));
  const packageScripts = packageJson.scripts || {};
  const componentText = await readTextIfExists(missionControlReadoutPanelPath, "");
  const missionControlText = await readTextIfExists(missionControlPanelPath, "");

  const checks = {
    resultExists: Boolean(result),
    completedTrue: result?.completed === true,
    recommendedSealedTrue: result?.recommended_sealed === true,
    blockerNull: result?.blocker === null,
    generatedFlagTrue: result?.[config.generatedFlag] === true,
    requiredFieldsPresent: config.requiredFields.every((field) => fieldHasContent(result?.[field], key, field)),
    boundaryMatches: matchesBoundary(result),
    docsGenerated: docsText.includes(config.phase) && docsText.includes("synthetic dry-run") && docsText.includes("providerCallsMade=false"),
    packageSmokeScriptExists: packageScripts[config.smokeScript] === `${config.runCommand} && ${config.validateCommand}`,
    packageVerifyScriptExists: packageScripts[config.verifyScript] === config.validateCommand,
  };

  if (key === "phase1206") {
    checks.requiredSafetyBlocksPresent = [
      "unauthorized_provider_call",
      "secret_read_requested",
      "chat_gateway_execute_integration_requested",
      "deploy_requested",
      "real_semantic_claim_requested",
    ].every((id) => JSON.stringify(result).includes(id));
  }

  if (key === "phase1209") {
    checks.missionControlReadOnlyComponentExists = componentText.includes("data-taiji-beidou-dry-run-readout-preview=\"true\"");
    checks.missionControlPanelWired = missionControlText.includes("renderTaijiBeidouDryRunReadoutPreviewPanel");
    checks.noExecutionButtonsInReadoutPanel = !/<button\b/i.test(componentText);
    checks.collapsedByDefault = componentText.includes("<details") && !componentText.includes(" open");
    checks.noYiyiOrCharacterRestore = !/Yiyi|yiyi|character/i.test(componentText);
  }

  if (key === "phase1210") {
    checks.approvalPacketOnly = result?.approvalPacketOnly === true;
    checks.ownerApprovedFalse = result?.mainChainEntryApprovalPacket?.ownerApproved === false;
    checks.mainChainIntegrationAllowedFalse = result?.mainChainEntryApprovalPacket?.mainChainIntegrationAllowed === false;
    checks.docsContainApprovalSections = [
      "A. 是否请求进入主链候选",
      "B. 请求范围",
      "C. 不请求范围",
      "D. 是否允许修改 /chat",
      "E. 是否允许修改 /chat-gateway/execute",
      "F. 是否允许真实 Provider 调用",
      "G. 是否允许 secret / CredentialRef 读取",
      "H. 是否允许 deploy / release / tag / artifact",
      "I. rollback plan",
      "J. emergency disable plan",
      "K. no-flag regression plan",
      "L. approval fields",
      "M. explicit owner decision placeholder",
      "ownerApproved=false",
      "mainChainIntegrationAllowed=false",
      "chatModificationAllowed=false",
      "chatGatewayExecuteModificationAllowed=false",
      "providerCallAllowed=false",
      "secretReadAllowed=false",
      "deploymentAllowed=false",
    ].every((marker) => docsText.includes(marker));
  }

  const blocker = findBlocker(checks);
  const validation = {
    phase: config.phase,
    title: config.title,
    completed: blocker === null,
    recommended_sealed: blocker === null,
    blocker,
    checks,
    evidenceRef: relativePath(resultPathFor(key)),
    docsRef: config.docsFile,
  };

  await writeJson(validationPathFor(key), validation);
  console.log(JSON.stringify({
    phase: validation.phase,
    completed: validation.completed,
    recommended_sealed: validation.recommended_sealed,
    blocker: validation.blocker,
  }, null, 2));

  if (blocker) process.exitCode = 1;
  return validation;
}

export async function validateClosureEvidence() {
  const closure = await readJsonIfExists(closureResultPath, null);
  const docsText = await readTextIfExists(closureReportPath, "");
  const executionReportText = await readTextIfExists(closureExecutionReportPath, "");
  const packageJson = JSON.parse(await readTextIfExists(resolve(repoRoot, "package.json"), "{}"));
  const packageScripts = packageJson.scripts || {};
  const checks = {
    closureResultExists: Boolean(closure),
    phase1203Completed: closure?.phase1203?.completed === true,
    phase1204Completed: closure?.phase1204?.completed === true,
    phase1205Completed: closure?.phase1205?.completed === true,
    phase1206Completed: closure?.phase1206?.completed === true,
    phase1207Completed: closure?.phase1207?.completed === true,
    phase1208Completed: closure?.phase1208?.completed === true,
    phase1209Completed: closure?.phase1209?.completed === true,
    phase1210Completed: closure?.phase1210?.completed === true,
    phase1203RecommendedSealed: closure?.phase1203?.recommended_sealed === true,
    phase1204RecommendedSealed: closure?.phase1204?.recommended_sealed === true,
    phase1205RecommendedSealed: closure?.phase1205?.recommended_sealed === true,
    phase1206RecommendedSealed: closure?.phase1206?.recommended_sealed === true,
    phase1207RecommendedSealed: closure?.phase1207?.recommended_sealed === true,
    phase1208RecommendedSealed: closure?.phase1208?.recommended_sealed === true,
    phase1209RecommendedSealed: closure?.phase1209?.recommended_sealed === true,
    phase1210RecommendedSealed: closure?.phase1210?.recommended_sealed === true,
    allBlockersNull: closure?.allBlockersNull === true,
    capabilityCandidatesGenerated: closure?.capabilityCandidatesGenerated === true,
    plannerAlignmentGenerated: closure?.plannerAlignmentGenerated === true,
    evidenceReplayPreviewGenerated: closure?.evidenceReplayPreviewGenerated === true,
    safetyCostSourcesGenerated: closure?.safetyCostSourcesGenerated === true,
    capabilityCellsGenerated: closure?.capabilityCellsGenerated === true,
    repairPruneReweightGenerated: closure?.repairPruneReweightGenerated === true,
    missionControlReadOnlyPreviewGenerated: closure?.missionControlReadOnlyPreviewGenerated === true,
    mainChainApprovalPacketGenerated: closure?.mainChainApprovalPacketGenerated === true,
    boundaryMatches: matchesBoundary(closure),
    mainChainIntegrationExecutedFalse: closure?.mainChainIntegrationExecuted === false,
    docsGenerated: docsText.includes(phaseRange) && docsText.includes("未真实进入主链") && docsText.includes("providerCallsMade=false"),
    executionReportGenerated: executionReportText.includes("A. 是否完成") && executionReportText.includes("U. 下一步建议"),
    packageSmokeScriptExists: packageScripts["smoke:phase1203-1210-taiji-beidou-dry-run-closure"] === "node tools/phase1203-1210/run-taiji-beidou-dry-run-closure.mjs && node tools/phase1203-1210/validate-taiji-beidou-dry-run-closure.mjs",
    packageVerifyScriptExists: packageScripts["verify:phase1203-1210-taiji-beidou-dry-run-closure"] === "node tools/phase1203-1210/validate-taiji-beidou-dry-run-closure.mjs",
  };
  const blocker = findBlocker(checks);
  const validation = {
    phase: phaseRange,
    title: "Taiji / Beidou Dry-run Capability Candidate Closure",
    completed: blocker === null,
    recommended_sealed: blocker === null,
    blocker,
    checks,
    evidenceRef: relativePath(closureResultPath),
  };
  await writeJson(closureValidationPath, validation);
  console.log(JSON.stringify({
    phase: validation.phase,
    completed: validation.completed,
    recommended_sealed: validation.recommended_sealed,
    blocker: validation.blocker,
  }, null, 2));
  if (blocker) process.exitCode = 1;
  return validation;
}

function matchesBoundary(evidence) {
  if (!evidence) return false;
  return Object.entries(phaseBoundary()).every(([key, expected]) => evidence[key] === expected);
}

function fieldHasContent(value, phaseKey = "", field = "") {
  if (phaseKey === "phase1208" && field === "prunedCells") return Array.isArray(value);
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return Boolean(value);
}

function findBlocker(checks) {
  for (const [key, value] of Object.entries(checks)) {
    if (value !== true) return key;
  }
  return null;
}

function relativePath(path) {
  return path.replace(`${repoRoot}\\`, "").replaceAll("\\", "/");
}
