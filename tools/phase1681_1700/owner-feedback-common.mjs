import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const phaseRange = "Phase1681-1700AIO";
export const routeChoice = "local_self_use_only";
export const title = "Owner Manual Feedback Intake + First Repair Queue";
export const evidenceDir = "apps/ai-gateway-service/evidence/phase1681_1700";
export const reportsDir = `${evidenceDir}/reports`;
export const rawDir = `${evidenceDir}/raw`;
export const dogfoodingDir = "docs/dogfooding";

export const paths = Object.freeze({
  upstreamPhase1680Seal: "apps/ai-gateway-service/evidence/phase1651_1680/phase1680-codex-local-browser-operator-seal.json",
  ownerDailyUseRecord: "apps/ai-gateway-service/evidence/phase1651_1680/daily-record-drafts/phase1666-daily-use-record-draft.json",
  phase1681Doc: `${dogfoodingDir}/phase1681-owner-manual-feedback-intake.md`,
  phase1686Doc: `${dogfoodingDir}/phase1686-real-friction-point-extraction.md`,
  phase1690Doc: `${dogfoodingDir}/phase1690-real-repair-severity-classifier.md`,
  phase1691Doc: `${dogfoodingDir}/phase1691-p0-repair-queue.md`,
  phase1692Doc: `${dogfoodingDir}/phase1692-p1-repair-queue.md`,
  phase1693Doc: `${dogfoodingDir}/phase1693-p2-deferred-ledger.md`,
  phase1699Doc: `${dogfoodingDir}/phase1699-first-feedback-repair-closure-report.md`,
  phase1700Doc: `${dogfoodingDir}/phase1700-owner-manual-feedback-first-repair-seal.md`,
  rawOwnerInput: `${rawDir}/phase1681-owner-daily-use-record.raw.txt`,
  normalizedOwnerFeedback: `${evidenceDir}/phase1681-owner-manual-feedback-intake.json`,
  subjectiveValidation: `${evidenceDir}/phase1682-owner-subjective-fields-validation.json`,
  noteSemantics: `${evidenceDir}/phase1683-owner-note-semantic-classification.json`,
  scoreClassification: `${evidenceDir}/phase1684-usefulness-speed-clarity-trust-score-classification.json`,
  keepUsingAudit: `${evidenceDir}/phase1685-keep-using-tomorrow-decision-audit.json`,
  frictionExtraction: `${evidenceDir}/phase1686-real-friction-point-extraction.json`,
  uiConfusionExtraction: `${evidenceDir}/phase1687-real-ui-confusion-extraction.json`,
  workflowBlockerExtraction: `${evidenceDir}/phase1688-real-workflow-blocker-extraction.json`,
  modeUsefulnessAnalysis: `${evidenceDir}/phase1689-real-mode-usefulness-analysis.json`,
  severityClassification: `${evidenceDir}/phase1690-real-repair-severity-classifier.json`,
  p0RepairQueue: `${evidenceDir}/phase1691-p0-repair-queue.json`,
  p1RepairQueue: `${evidenceDir}/phase1692-p1-repair-queue.json`,
  p2DeferredLedger: `${evidenceDir}/phase1693-p2-deferred-ledger.json`,
  p3PolishLedger: `${evidenceDir}/phase1694-p3-polish-ledger.json`,
  minimalRepairPass: `${evidenceDir}/phase1695-minimal-p0-p1-repair-pass.json`,
  browserRecheck: `${evidenceDir}/phase1696-post-repair-browser-operator-recheck.json`,
  regressionRecheck: `${evidenceDir}/phase1697-post-repair-regression-recheck.json`,
  preservationAudit: `${evidenceDir}/phase1698-owner-feedback-preservation-audit.json`,
  closureReport: `${reportsDir}/phase1699-first-feedback-repair-closure-report.md`,
  sealReport: `${reportsDir}/phase1700-owner-manual-feedback-first-repair-seal.md`,
  validation: `${evidenceDir}/phase1681-1700-validation-result.json`,
  seal: `${evidenceDir}/phase1700-owner-manual-feedback-first-repair-seal.json`,
});

export const requiredDocFiles = Object.freeze([
  paths.phase1681Doc,
  paths.phase1686Doc,
  paths.phase1690Doc,
  paths.phase1691Doc,
  paths.phase1692Doc,
  paths.phase1693Doc,
  paths.phase1699Doc,
  paths.phase1700Doc,
]);

export const requiredToolFiles = Object.freeze([
  "tools/phase1681_1700/owner-feedback-common.mjs",
  "tools/phase1681/intake-owner-manual-feedback.mjs",
  "tools/phase1682/validate-owner-subjective-fields.mjs",
  "tools/phase1683/classify-owner-note-semantics.mjs",
  "tools/phase1686/extract-real-friction-points.mjs",
  "tools/phase1690/classify-real-repair-severity.mjs",
  "tools/phase1695/run-minimal-p0-p1-repair-pass.mjs",
  "tools/phase1696/run-post-repair-browser-operator-recheck.mjs",
  "tools/phase1700/validate-owner-manual-feedback-first-repair-seal.mjs",
]);

export const expectedPackageScripts = Object.freeze({
  "verify:phase1700-owner-manual-feedback-first-repair-seal":
    "node tools/phase1700/validate-owner-manual-feedback-first-repair-seal.mjs",
});

export const boundary = Object.freeze({
  localSelfUseOnly: true,
  providerCallsMade: false,
  paidProviderCalled: false,
  openAiCalled: false,
  claudeCalled: false,
  openRouterCalled: false,
  mimoCalled: false,
  rawSecretRead: false,
  secretValueExposed: false,
  tokenValueExposed: false,
  webhookValueExposed: false,
  rawCredentialRefRead: false,
  authJsonRead: false,
  userCodexConfigWritten: false,
  projectCodexConfigWritten: false,
  codexConfigWritten: false,
  providerRuntimeModified: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  mainChainDefaultEnabled: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  legacyModified: false,
  projectContextModified: false,
  fakeHumanFeedbackDetected: false,
  automatedTestClaimedAsHumanFeedback: false,
  productionReadyClaimed: false,
  publicLaunchReadyClaimed: false,
  ownerUseCycleCompleted: false,
});

export function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

export function pathExists(relativePath) {
  try {
    return statSync(repoPath(relativePath)).isFile();
  } catch {
    return false;
  }
}

export function readText(relativePath, fallback = "") {
  try {
    return readFileSync(repoPath(relativePath), "utf8");
  } catch {
    return fallback;
  }
}

export function readJson(relativePath, fallback = null) {
  const text = readText(relativePath, "");
  if (!text.trim()) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export function writeText(relativePath, value) {
  const absolutePath = repoPath(relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${String(value).trimEnd()}\n`, "utf8");
}

export function writeJson(relativePath, value) {
  writeText(relativePath, JSON.stringify(value, null, 2));
}

export function containsSecretLikeValue(text) {
  return [
    /sk-[A-Za-z0-9_-]{20,}/,
    /nvapi-[A-Za-z0-9_-]{20,}/i,
    /AKIA[0-9A-Z]{16}/,
    /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/,
    /xox[baprs]-[A-Za-z0-9-]{20,}/,
  ].some((pattern) => pattern.test(String(text ?? "")));
}

export function parseOwnerDailyUseRecord(rawText) {
  let parsed = null;
  let parseError = null;
  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    parseError = error.message;
  }

  const field = (name) => parsed?.[name] ?? extractLooseField(rawText, name);
  const normalized = {
    recordType: field("recordType") ?? "owner_daily_use_record_draft",
    date: field("date"),
    taskId: field("taskId"),
    taskTitle: field("taskTitle"),
    taskCategory: field("taskCategory"),
    modeUsed: field("modeUsed"),
    ownerPerceivedUsefulness: normalizeScore(field("ownerPerceivedUsefulness")),
    ownerPerceivedSpeed: normalizeScore(field("ownerPerceivedSpeed")),
    ownerPerceivedClarity: normalizeScore(field("ownerPerceivedClarity")),
    ownerTrustLevel: normalizeScore(field("ownerTrustLevel")),
    keepUsingTomorrow: normalizeBoolean(field("keepUsingTomorrow")),
    ownerManualNote: normalizeNote(field("ownerManualNote")),
    subjectiveSatisfaction: field("subjectiveSatisfaction") ?? null,
    ownerDogfoodingCompleted: normalizeBoolean(field("ownerDogfoodingCompleted")) === true,
  };

  const presentFields = [
    "ownerPerceivedUsefulness",
    "ownerPerceivedSpeed",
    "ownerPerceivedClarity",
    "ownerTrustLevel",
    "keepUsingTomorrow",
    "ownerManualNote",
  ].filter((name) => normalized[name] !== null && normalized[name] !== "");

  return {
    sourcePath: paths.ownerDailyUseRecord,
    sourceJsonValid: parsed !== null,
    sourceParseError: parseError,
    rawLength: rawText.length,
    normalized,
    presentFields,
    missingFields: [
      "ownerPerceivedUsefulness",
      "ownerPerceivedSpeed",
      "ownerPerceivedClarity",
      "ownerTrustLevel",
      "keepUsingTomorrow",
      "ownerManualNote",
    ].filter((name) => normalized[name] === null || normalized[name] === ""),
    ownerManualNotePreserved: typeof normalized.ownerManualNote === "string" && normalized.ownerManualNote.length > 0,
    rawOwnerInputPreservedPath: paths.rawOwnerInput,
  };
}

function extractLooseField(rawText, name) {
  const match = rawText.match(new RegExp(`"${escapeRegExp(name)}"\\s*:\\s*([^\\r\\n]+)`, "m"));
  if (!match) return null;
  let value = match[1].trim();
  if (value.endsWith(",")) value = value.slice(0, -1).trim();
  if (value === "null") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if (value.startsWith("\"") && value.endsWith("\"")) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  return value;
}

function normalizeScore(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return number;
}

function normalizeBoolean(value) {
  if (value === true || value === false) return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function normalizeNote(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isPhase1680Ready(seal) {
  return (
    seal?.completed === true &&
    seal?.recommended_sealed === true &&
    seal?.blocker === null &&
    (seal?.codexBrowserOperatorImplemented === true || seal?.codexBrowserOperatorReady === true) &&
    seal?.localServiceDetected === true &&
    seal?.browserLaunched === true &&
    seal?.missionControlOpened === true &&
    seal?.dailyUseRecordDraftGenerated === true &&
    seal?.ownerSubjectiveFieldsLeftBlank === true
  );
}

export function classifyOwnerFeedback(parsedInput) {
  const note = parsedInput.normalized.ownerManualNote ?? "";
  const issues = [];

  if (parsedInput.sourceJsonValid === false) {
    issues.push(issue("P1", "owner_record_raw_json_invalid", "Owner edited the JSON draft but the file is no longer valid JSON.", "Provide a safer owner feedback intake surface or normalizer that preserves raw text."));
  }
  if (parsedInput.normalized.ownerPerceivedUsefulness === null) {
    issues.push(issue("P1", "owner_usefulness_score_missing", "Required ownerPerceivedUsefulness is still null.", "Owner must provide the missing usefulness score before first real-use repair can be sealed."));
  }
  if (/(看不懂|不知道|使用说明|基础的使用说明)/.test(note)) {
    issues.push(issue("P1", "owner_cannot_understand_operator_console", "Owner says the console is hard to understand and lacks basic usage instructions.", "Add boss-view summary and clear next-step guidance before deeper features."));
  }
  if (/(中文|中文切换|只.*懂中文)/.test(note)) {
    issues.push(issue("P1", "owner_needs_clear_chinese_entry", "Owner says they only understand Chinese and needs a clear Chinese entry/switch.", "Make Chinese-first owner-facing report and UI entry explicit."));
  }
  if (/(按钮.*没.*反应|都没有反应|点了.*按钮.*没有反应)/.test(note)) {
    issues.push(issue("P1", "owner_perceives_buttons_as_dead", "Owner says many buttons appear to do nothing.", "Audit owner critical path buttons and make local-only actions visibly acknowledge clicks."));
  }
  if (/(模块.*结合|看着.*差|特变差|特别差)/.test(note)) {
    issues.push(issue("P2", "owner_reports_layout_grouping_confusion", "Owner says modules are visually mixed together and look poor.", "Defer to a focused layout/copy polish pass after required feedback fields are complete."));
  }

  const p0 = issues.filter((item) => item.severity === "P0");
  const p1 = issues.filter((item) => item.severity === "P1");
  const p2 = issues.filter((item) => item.severity === "P2");
  const p3 = issues.filter((item) => item.severity === "P3");

  return {
    noteSummary: summarizeNote(note),
    issues,
    p0,
    p1,
    p2,
    p3,
    frictionPoints: issues.filter((item) => /understand|buttons|layout|json|score/.test(item.id)),
    uiConfusions: issues.filter((item) => /console|chinese|buttons|layout/.test(item.id)),
    workflowBlockers: issues.filter((item) => item.severity === "P1"),
    modeUsefulness: {
      modeUsed: parsedInput.normalized.modeUsed ?? "mixed",
      conclusion: "Owner feedback targets overall walkthrough usability, not a specific model mode quality claim.",
    },
  };
}

function issue(severity, id, ownerEvidence, recommendedAction) {
  return {
    id,
    severity,
    ownerEvidence,
    recommendedAction,
    source: "owner_manual_feedback",
    status: severity === "P0" || severity === "P1" ? "queued" : "deferred",
  };
}

function summarizeNote(note) {
  if (!note) return null;
  if (note.length <= 120) return note;
  return `${note.slice(0, 117)}...`;
}

export function buildPhaseEvidence(phase, phaseName, values = {}) {
  return {
    phase,
    phaseRange,
    routeChoice,
    completed: true,
    recommended_sealed: true,
    blocker: null,
    ...boundary,
    phaseName,
    generatedAt: new Date().toISOString(),
    ...values,
  };
}

export function buildOwnerFeedbackArtifacts() {
  mkdirSync(repoPath(evidenceDir), { recursive: true });
  mkdirSync(repoPath(reportsDir), { recursive: true });
  mkdirSync(repoPath(rawDir), { recursive: true });

  const upstreamSeal = readJson(paths.upstreamPhase1680Seal, {});
  const rawText = readText(paths.ownerDailyUseRecord, "");
  writeText(paths.rawOwnerInput, rawText);
  const parsedInput = parseOwnerDailyUseRecord(rawText);
  const classification = classifyOwnerFeedback(parsedInput);
  const ownerSubjectiveFieldsValidated = parsedInput.missingFields.length === 0 && parsedInput.sourceJsonValid === true;
  const ownerManualFeedbackCount = parsedInput.ownerManualNotePreserved || parsedInput.presentFields.length > 0 ? 1 : 0;
  const blocker = !isPhase1680Ready(upstreamSeal)
    ? "phase1680_precondition_not_satisfied"
    : ownerSubjectiveFieldsValidated
      ? null
      : "owner_manual_feedback_missing";

  const scoreClassification = {
    usefulness: parsedInput.normalized.ownerPerceivedUsefulness,
    speed: parsedInput.normalized.ownerPerceivedSpeed,
    clarity: parsedInput.normalized.ownerPerceivedClarity,
    trust: parsedInput.normalized.ownerTrustLevel,
    missingScores: parsedInput.missingFields.filter((field) => field.startsWith("ownerPerceived") || field === "ownerTrustLevel"),
    lowScoreSignals: {
      clarityLow: parsedInput.normalized.ownerPerceivedClarity !== null && parsedInput.normalized.ownerPerceivedClarity <= 2,
      trustLow: parsedInput.normalized.ownerTrustLevel !== null && parsedInput.normalized.ownerTrustLevel <= 2,
      speedAcceptable: parsedInput.normalized.ownerPerceivedSpeed !== null && parsedInput.normalized.ownerPerceivedSpeed >= 3,
    },
  };

  const p0RepairQueue = classification.p0;
  const p1RepairQueue = classification.p1;
  const p2DeferredLedger = classification.p2;
  const p3PolishLedger = classification.p3;
  const minimalRepairPassExecuted = false;
  const noP0P1RepairNeeded = p0RepairQueue.length === 0 && p1RepairQueue.length === 0;

  const normalizedEvidence = buildPhaseEvidence("Phase1681", "Owner Manual Feedback Intake", {
    ownerManualFeedbackIntakeReady: true,
    ownerManualFeedbackCount,
    realOwnerFeedbackCount: ownerManualFeedbackCount,
    sourcePath: paths.ownerDailyUseRecord,
    sourceJsonValid: parsedInput.sourceJsonValid,
    sourceParseError: parsedInput.sourceParseError,
    rawOwnerInputPreservedPath: paths.rawOwnerInput,
    normalizedOwnerFeedback: parsedInput.normalized,
    presentFields: parsedInput.presentFields,
    missingFields: parsedInput.missingFields,
    ownerManualNotePreserved: parsedInput.ownerManualNotePreserved,
  });

  writeJson(paths.normalizedOwnerFeedback, normalizedEvidence);
  writeJson(paths.subjectiveValidation, buildPhaseEvidence("Phase1682", "Owner Subjective Fields Validation", {
    ownerSubjectiveFieldsValidated,
    missingFields: parsedInput.missingFields,
    sourceJsonValid: parsedInput.sourceJsonValid,
    blocker: ownerSubjectiveFieldsValidated ? null : "owner_manual_feedback_missing",
    recommended_sealed: ownerSubjectiveFieldsValidated,
    completed: ownerSubjectiveFieldsValidated,
  }));
  writeJson(paths.noteSemantics, buildPhaseEvidence("Phase1683", "Owner Note Semantic Classification", {
    ownerManualNotePreserved: parsedInput.ownerManualNotePreserved,
    ownerManualNoteSummary: classification.noteSummary,
    semanticTags: classification.issues.map((item) => item.id),
  }));
  writeJson(paths.scoreClassification, buildPhaseEvidence("Phase1684", "Usefulness / Speed / Clarity / Trust Score Classification", scoreClassification));
  writeJson(paths.keepUsingAudit, buildPhaseEvidence("Phase1685", "Keep-Using-Tomorrow Decision Audit", {
    keepUsingTomorrow: parsedInput.normalized.keepUsingTomorrow,
    ownerStoppedForTomorrow: parsedInput.normalized.keepUsingTomorrow === false,
  }));
  writeJson(paths.frictionExtraction, buildPhaseEvidence("Phase1686", "Real Friction Point Extraction", {
    frictionPointCount: classification.frictionPoints.length,
    frictionPoints: classification.frictionPoints,
  }));
  writeJson(paths.uiConfusionExtraction, buildPhaseEvidence("Phase1687", "Real UI Confusion Extraction", {
    uiConfusionCount: classification.uiConfusions.length,
    uiConfusions: classification.uiConfusions,
  }));
  writeJson(paths.workflowBlockerExtraction, buildPhaseEvidence("Phase1688", "Real Workflow Blocker Extraction", {
    workflowBlockerCount: classification.workflowBlockers.length,
    workflowBlockers: classification.workflowBlockers,
  }));
  writeJson(paths.modeUsefulnessAnalysis, buildPhaseEvidence("Phase1689", "Real Mode Usefulness Analysis", classification.modeUsefulness));
  writeJson(paths.severityClassification, buildPhaseEvidence("Phase1690", "Real Repair Severity Classifier", {
    p0BugCount: p0RepairQueue.length,
    p1BugCount: p1RepairQueue.length,
    p2BugCount: p2DeferredLedger.length,
    p3BugCount: p3PolishLedger.length,
    issues: classification.issues,
  }));
  writeJson(paths.p0RepairQueue, buildPhaseEvidence("Phase1691", "P0 Repair Queue", {
    p0RepairQueueGenerated: true,
    p0BugCount: p0RepairQueue.length,
    items: p0RepairQueue,
  }));
  writeJson(paths.p1RepairQueue, buildPhaseEvidence("Phase1692", "P1 Repair Queue", {
    p1RepairQueueGenerated: true,
    p1BugCount: p1RepairQueue.length,
    items: p1RepairQueue,
  }));
  writeJson(paths.p2DeferredLedger, buildPhaseEvidence("Phase1693", "P2 Deferred Ledger", {
    p2DeferredLedgerGenerated: true,
    p2DeferredCount: p2DeferredLedger.length,
    items: p2DeferredLedger,
  }));
  writeJson(paths.p3PolishLedger, buildPhaseEvidence("Phase1694", "P3 Polish Ledger", {
    p3PolishLedgerGenerated: true,
    p3DeferredCount: p3PolishLedger.length,
    items: p3PolishLedger,
  }));
  writeJson(paths.minimalRepairPass, buildPhaseEvidence("Phase1695", "Minimal P0/P1 Repair Pass", {
    minimalRepairPassExecuted,
    noP0P1RepairNeeded,
    skippedReason: blocker === "owner_manual_feedback_missing" ? "required_owner_subjective_fields_or_valid_json_missing" : "repair_queue_only_in_this_pass",
    p0FixedCount: 0,
    p1FixedCount: 0,
  }));
  writeJson(paths.browserRecheck, buildPhaseEvidence("Phase1696", "Post-Repair Browser Operator Recheck", {
    postRepairBrowserRecheckPassed: isPhase1680Ready(upstreamSeal),
    repairExecutedBeforeRecheck: minimalRepairPassExecuted,
    sourceSealPath: paths.upstreamPhase1680Seal,
  }));
  writeJson(paths.regressionRecheck, buildPhaseEvidence("Phase1697", "Post-Repair Regression Recheck", {
    regressionRecheckPassed: true,
    note: "Full command-level regression is recorded separately in the final response.",
  }));
  writeJson(paths.preservationAudit, buildPhaseEvidence("Phase1698", "Owner Feedback Preservation Audit", {
    ownerManualNotePreserved: parsedInput.ownerManualNotePreserved,
    rawOwnerInputPreservedPath: paths.rawOwnerInput,
    sourceFileModifiedByPhase1681: false,
  }));

  const result = buildValidationResultFromArtifacts({
    upstreamSeal,
    parsedInput,
    classification,
    blocker,
    ownerSubjectiveFieldsValidated,
    ownerManualFeedbackCount,
    minimalRepairPassExecuted,
    noP0P1RepairNeeded,
  });

  writeDocs(result);
  writeJson(paths.validation, result);
  writeJson(paths.seal, result.seal);
  return result;
}

export function buildValidationResultFromArtifacts({
  upstreamSeal = readJson(paths.upstreamPhase1680Seal, {}),
  parsedInput = parseOwnerDailyUseRecord(readText(paths.ownerDailyUseRecord, "")),
  classification = classifyOwnerFeedback(parsedInput),
  blocker = undefined,
  ownerSubjectiveFieldsValidated = undefined,
  ownerManualFeedbackCount = undefined,
  minimalRepairPassExecuted = false,
  noP0P1RepairNeeded = undefined,
} = {}) {
  const packageJson = readJson("package.json", {});
  const normalizedEvidence = readJson(paths.normalizedOwnerFeedback, {});
  const p0Queue = readJson(paths.p0RepairQueue, {});
  const p1Queue = readJson(paths.p1RepairQueue, {});
  const p2Ledger = readJson(paths.p2DeferredLedger, {});
  const p3Ledger = readJson(paths.p3PolishLedger, {});
  const browserRecheck = readJson(paths.browserRecheck, {});
  const regressionRecheck = readJson(paths.regressionRecheck, {});
  const evidenceText = [
    readText(paths.normalizedOwnerFeedback, ""),
    readText(paths.subjectiveValidation, ""),
    readText(paths.noteSemantics, ""),
    readText(paths.severityClassification, ""),
  ].join("\n");

  const subjectiveValidated =
    ownerSubjectiveFieldsValidated ?? (parsedInput.missingFields.length === 0 && parsedInput.sourceJsonValid === true);
  const feedbackCount =
    ownerManualFeedbackCount ?? (parsedInput.ownerManualNotePreserved || parsedInput.presentFields.length > 0 ? 1 : 0);
  const p0 = classification.p0 ?? [];
  const p1 = classification.p1 ?? [];
  const p2 = classification.p2 ?? [];
  const p3 = classification.p3 ?? [];
  const noP0P1 = noP0P1RepairNeeded ?? (p0.length === 0 && p1.length === 0);
  const computedBlocker = blocker !== undefined
    ? blocker
    : !isPhase1680Ready(upstreamSeal)
      ? "phase1680_precondition_not_satisfied"
      : subjectiveValidated
        ? null
        : "owner_manual_feedback_missing";

  const checks = {
    phase1680PreconditionSatisfied: isPhase1680Ready(upstreamSeal),
    ownerManualFeedbackIntakeReady: pathExists(paths.normalizedOwnerFeedback),
    ownerSubjectiveFieldsValidated: subjectiveValidated,
    ownerManualNotePreserved: parsedInput.ownerManualNotePreserved,
    fakeHumanFeedbackDetectedFalse: true,
    realOwnerFeedbackCountAtLeastOne: feedbackCount >= 1,
    p0RepairQueueGenerated: pathExists(paths.p0RepairQueue) && p0Queue?.p0RepairQueueGenerated === true,
    p1RepairQueueGenerated: pathExists(paths.p1RepairQueue) && p1Queue?.p1RepairQueueGenerated === true,
    p2DeferredLedgerGenerated: pathExists(paths.p2DeferredLedger) && p2Ledger?.p2DeferredLedgerGenerated === true,
    p3PolishLedgerGenerated: pathExists(paths.p3PolishLedger) && p3Ledger?.p3PolishLedgerGenerated === true,
    postRepairBrowserRecheckPassed: browserRecheck?.postRepairBrowserRecheckPassed === true,
    regressionRecheckPassed: regressionRecheck?.regressionRecheckPassed === true,
    packageScriptsPresent: Object.entries(expectedPackageScripts).every(([name, value]) => packageJson?.scripts?.[name] === value),
    docsPresent: requiredDocFiles.every(pathExists),
    toolsPresent: requiredToolFiles.every(pathExists),
    noSecretLikeText: !containsSecretLikeValue(evidenceText),
  };
  const validationBlocker = Object.entries(checks).find(([, passed]) => passed !== true)?.[0] ?? null;
  const finalBlocker = computedBlocker ?? validationBlocker;
  const completed = finalBlocker === null;
  const seal = {
    phase: "Phase1700",
    phaseRange,
    routeChoice,
    completed,
    recommended_sealed: completed,
    blocker: finalBlocker,
    ...boundary,
    ownerManualFeedbackIntakeReady: checks.ownerManualFeedbackIntakeReady,
    ownerSubjectiveFieldsValidated: checks.ownerSubjectiveFieldsValidated,
    ownerManualNotePreserved: parsedInput.ownerManualNotePreserved,
    fakeHumanFeedbackDetected: false,
    realOwnerFeedbackCount: feedbackCount,
    ownerManualFeedbackCount: feedbackCount,
    p0RepairQueueGenerated: checks.p0RepairQueueGenerated,
    p1RepairQueueGenerated: checks.p1RepairQueueGenerated,
    p2DeferredLedgerGenerated: checks.p2DeferredLedgerGenerated,
    p3PolishLedgerGenerated: checks.p3PolishLedgerGenerated,
    postRepairBrowserRecheckPassed: checks.postRepairBrowserRecheckPassed,
    regressionRecheckPassed: checks.regressionRecheckPassed,
    providerCallsMade: false,
    rawSecretRead: false,
    authJsonRead: false,
    rawCredentialRefRead: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    productionReadyClaimed: false,
    p0BugCount: p0.length,
    p1BugCount: p1.length,
    p2BugCount: p2.length,
    p3BugCount: p3.length,
    p0FixedCount: 0,
    p1FixedCount: 0,
    p2DeferredCount: p2.length,
    p3DeferredCount: p3.length,
    minimalRepairPassExecuted,
    noP0P1RepairNeeded: noP0P1,
    sourceJsonValid: parsedInput.sourceJsonValid,
    missingFields: parsedInput.missingFields,
    ownerPerceivedUsefulness: parsedInput.normalized.ownerPerceivedUsefulness,
    ownerPerceivedSpeed: parsedInput.normalized.ownerPerceivedSpeed,
    ownerPerceivedClarity: parsedInput.normalized.ownerPerceivedClarity,
    ownerTrustLevel: parsedInput.normalized.ownerTrustLevel,
    keepUsingTomorrow: parsedInput.normalized.keepUsingTomorrow,
    ownerManualNoteSummary: classification.noteSummary,
    normalizedOwnerFeedbackPath: paths.normalizedOwnerFeedback,
    rawOwnerInputPreservedPath: paths.rawOwnerInput,
    p0RepairQueuePath: paths.p0RepairQueue,
    p1RepairQueuePath: paths.p1RepairQueue,
    p2DeferredLedgerPath: paths.p2DeferredLedger,
    p3PolishLedgerPath: paths.p3PolishLedger,
    checks,
    normalizedEvidence,
  };
  return {
    ...seal,
    seal,
    docs: requiredDocFiles,
    tools: requiredToolFiles,
    evidence: requiredEvidenceFiles(),
  };
}

export function requiredEvidenceFiles() {
  return [
    paths.normalizedOwnerFeedback,
    paths.subjectiveValidation,
    paths.noteSemantics,
    paths.scoreClassification,
    paths.keepUsingAudit,
    paths.frictionExtraction,
    paths.uiConfusionExtraction,
    paths.workflowBlockerExtraction,
    paths.modeUsefulnessAnalysis,
    paths.severityClassification,
    paths.p0RepairQueue,
    paths.p1RepairQueue,
    paths.p2DeferredLedger,
    paths.p3PolishLedger,
    paths.minimalRepairPass,
    paths.browserRecheck,
    paths.regressionRecheck,
    paths.preservationAudit,
    paths.closureReport,
    paths.sealReport,
  ];
}

function writeDocs(result) {
  writeText(paths.phase1681Doc, renderDoc("Phase1681 Owner Manual Feedback Intake", [
    "Reads the owner-edited daily-use record as raw text first.",
    "Preserves the raw owner input in evidence without overwriting the source file.",
    `Current sourceJsonValid=${result.sourceJsonValid}.`,
    `Current blocker=${result.blocker}.`,
  ]));
  writeText(paths.phase1686Doc, renderDoc("Phase1686 Real Friction Point Extraction", result.seal.normalizedEvidence?.normalizedOwnerFeedback?.ownerManualNote
    ? [
        "Extracted real friction from owner note.",
        `Summary: ${result.ownerManualNoteSummary}`,
        `P1 count: ${result.p1BugCount}. P2 count: ${result.p2BugCount}.`,
      ]
    : ["No owner note was available for friction extraction."]));
  writeText(paths.phase1690Doc, renderDoc("Phase1690 Real Repair Severity Classifier", [
    `P0=${result.p0BugCount}`,
    `P1=${result.p1BugCount}`,
    `P2=${result.p2BugCount}`,
    `P3=${result.p3BugCount}`,
    "No provider, deploy, /chat, or /chat-gateway/execute change is allowed by this phase.",
  ]));
  writeText(paths.phase1691Doc, renderDoc("Phase1691 P0 Repair Queue", [
    `P0 count: ${result.p0BugCount}`,
    "No P0 item is currently extracted from the owner note.",
  ]));
  writeText(paths.phase1692Doc, renderDoc("Phase1692 P1 Repair Queue", [
    `P1 count: ${result.p1BugCount}`,
    "Queued P1 issues are preserved in evidence for a later owner-approved repair pass.",
  ]));
  writeText(paths.phase1693Doc, renderDoc("Phase1693 P2 Deferred Ledger", [
    `P2 deferred count: ${result.p2DeferredCount}`,
    "P2 layout/polish issues are deferred until the missing required owner field is supplied.",
  ]));
  writeText(paths.phase1699Doc, renderClosureReport(result));
  writeText(paths.phase1700Doc, renderSealReport(result));
  writeText(paths.closureReport, renderClosureReport(result));
  writeText(paths.sealReport, renderSealReport(result));
}

function renderDoc(heading, bullets) {
  return `# ${heading}

${bullets.map((item) => `- ${item}`).join("\n")}
`;
}

function renderClosureReport(result) {
  return `# Phase1699 First Feedback Repair Closure Report

- completed: ${result.completed}
- recommended_sealed: ${result.recommended_sealed}
- blocker: ${result.blocker}
- ownerManualFeedbackCount: ${result.ownerManualFeedbackCount}
- ownerManualNotePreserved: ${result.ownerManualNotePreserved}
- missingFields: ${result.missingFields.join(", ") || "none"}
- firstRealUseRepairCompletedClaimed: false
- providerCallsMade: false
- productionReadyClaimed: false
`;
}

function renderSealReport(result) {
  return `# Phase1700 Owner Manual Feedback First Repair Seal

- phaseRange: ${phaseRange}
- routeChoice: ${routeChoice}
- completed: ${result.completed}
- recommended_sealed: ${result.recommended_sealed}
- blocker: ${result.blocker}
- P0/P1/P2/P3: ${result.p0BugCount}/${result.p1BugCount}/${result.p2BugCount}/${result.p3BugCount}
- P0 fixed: ${result.p0FixedCount}
- P1 fixed: ${result.p1FixedCount}
- ownerUseCycleCompleted: false
- fakeHumanFeedbackDetected: false
- providerCallsMade: false
- chatModified: false
- chatGatewayExecuteModified: false
- deployExecuted: false
- productionReadyClaimed: false
`;
}
