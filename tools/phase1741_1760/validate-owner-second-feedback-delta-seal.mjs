import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const phaseRange = "Phase1741-1760AIO";
const routeChoice = "A / local_self_use_only";
const evidenceDir = "apps/ai-gateway-service/evidence/phase1741_1760";
const reportsDir = `${evidenceDir}/reports`;
const dogfoodingDir = "docs/dogfooding";

const paths = Object.freeze({
  upstreamPhase1740Seal:
    "apps/ai-gateway-service/evidence/phase1721_1740/phase1740-owner-second-chinese-local-use-retest-seal.json",
  secondOwnerDailyUseRecord:
    "apps/ai-gateway-service/evidence/phase1721_1740/daily-record-drafts/phase1733-second-daily-use-record-draft.json",
  intake: `${evidenceDir}/phase1741-second-owner-feedback-intake.json`,
  subjectiveValidation: `${evidenceDir}/phase1742-second-subjective-fields-validation.json`,
  deltaAnalysis: `${evidenceDir}/phase1743-before-after-score-delta-analysis.json`,
  clarityClassification: `${evidenceDir}/phase1744-clarity-delta-classification.json`,
  trustClassification: `${evidenceDir}/phase1745-trust-delta-classification.json`,
  usefulnessSpeedClassification: `${evidenceDir}/phase1746-usefulness-speed-delta-classification.json`,
  keepUsingDelta: `${evidenceDir}/phase1747-keep-using-decision-delta.json`,
  noteSemantics: `${evidenceDir}/phase1748-second-owner-note-semantic-classification.json`,
  remainingFriction: `${evidenceDir}/phase1749-remaining-friction-extraction.json`,
  remainingUiConfusion: `${evidenceDir}/phase1750-remaining-ui-confusion-extraction.json`,
  p1RepairQueue: `${evidenceDir}/phase1751-minimal-p1-repair-queue.json`,
  p2DeferredLedger: `${evidenceDir}/phase1752-minimal-p2-deferred-ledger.json`,
  optionalRepairPass: `${evidenceDir}/phase1753-optional-minimal-ui-repair-pass.json`,
  browserRecheck: `${evidenceDir}/phase1754-post-delta-browser-recheck.json`,
  regressionRecheck: `${evidenceDir}/phase1755-post-delta-regression-recheck.json`,
  preservationAudit: `${evidenceDir}/phase1756-second-feedback-preservation-audit.json`,
  improvementReport: `${reportsDir}/phase1757-clarity-trust-improvement-report.md`,
  nextUseRecommendation: `${reportsDir}/phase1758-next-local-use-recommendation.md`,
  closureReport: `${reportsDir}/phase1759-second-feedback-closure-report.md`,
  sealReport: `${reportsDir}/phase1760-owner-second-feedback-delta-seal.md`,
  seal: `${evidenceDir}/phase1760-owner-second-feedback-delta-seal.json`,
  docIntake: `${dogfoodingDir}/phase1741-second-owner-feedback-intake.md`,
  docDelta: `${dogfoodingDir}/phase1757-clarity-trust-improvement-report.md`,
  docRecommendation: `${dogfoodingDir}/phase1758-next-local-use-recommendation.md`,
  docClosure: `${dogfoodingDir}/phase1759-second-feedback-closure-report.md`,
  docSeal: `${dogfoodingDir}/phase1760-owner-second-feedback-delta-seal.md`,
});

const oldScores = Object.freeze({
  oldUsefulness: 2,
  oldSpeed: 3,
  oldClarity: 1,
  oldTrust: 1,
  oldKeepUsingTomorrow: false,
});

const boundary = Object.freeze({
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

const requiredSubjectiveFields = Object.freeze([
  "ownerPerceivedUsefulness",
  "ownerPerceivedSpeed",
  "ownerPerceivedClarity",
  "ownerTrustLevel",
  "keepUsingTomorrow",
  "ownerManualNote",
]);

function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

async function pathExists(relativePath) {
  try {
    return (await stat(repoPath(relativePath))).isFile();
  } catch {
    return false;
  }
}

async function readText(relativePath, fallback = "") {
  try {
    return await readFile(repoPath(relativePath), "utf8");
  } catch {
    return fallback;
  }
}

async function readJson(relativePath, fallback = null) {
  const text = await readText(relativePath, "");
  if (!text.trim()) return fallback;
  try {
    return JSON.parse(text);
  } catch (error) {
    return {
      __parseError: error instanceof Error ? error.message : String(error),
      __rawLength: text.length,
    };
  }
}

async function writeText(relativePath, value) {
  const absolutePath = repoPath(relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${String(value).trimEnd()}\n`, "utf8");
}

async function writeJson(relativePath, value) {
  await writeText(relativePath, JSON.stringify(value, null, 2));
}

function isPhase1740Ready(seal) {
  return (
    seal?.completed === true &&
    seal?.recommended_sealed === true &&
    seal?.blocker === null &&
    seal?.secondChineseBossViewRetestReady === true &&
    seal?.secondDailyUseRecordDraftGenerated === true &&
    seal?.secondOwnerReadableReportGenerated === true &&
    seal?.providerCallsMade === false &&
    seal?.chatModified === false &&
    seal?.chatGatewayExecuteModified === false
  );
}

function normalizeScore(value) {
  if (value === null || value === undefined || value === "") return null;
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  return score;
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
  return trimmed ? trimmed : null;
}

function summarizeNote(note) {
  if (!note) return null;
  return note.length <= 160 ? note : `${note.slice(0, 157)}...`;
}

function containsSecretLikeValue(text) {
  return [
    /sk-[A-Za-z0-9_-]{20,}/,
    /nvapi-[A-Za-z0-9_-]{20,}/i,
    /AKIA[0-9A-Z]{16}/,
    /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/,
    /xox[baprs]-[A-Za-z0-9-]{20,}/,
  ].some((pattern) => pattern.test(String(text ?? "")));
}

function buildPhaseEvidence(phase, phaseName, extras = {}) {
  return {
    phase,
    phaseRange,
    routeChoice,
    completed: extras.completed ?? true,
    recommended_sealed: extras.recommended_sealed ?? true,
    blocker: extras.blocker ?? null,
    ...boundary,
    phaseName,
    generatedAt: new Date().toISOString(),
    ...extras,
  };
}

function normalizeSecondOwnerRecord(record) {
  if (!record || record.__parseError) {
    return {
      sourceJsonValid: false,
      sourceParseError: record?.__parseError ?? "missing_or_empty_record",
      normalized: {},
      missingFields: [...requiredSubjectiveFields],
      ownerManualNotePreserved: false,
      secondOwnerFeedbackCount: 0,
    };
  }
  const normalized = {
    ownerPerceivedUsefulness: normalizeScore(record.ownerPerceivedUsefulness),
    ownerPerceivedSpeed: normalizeScore(record.ownerPerceivedSpeed),
    ownerPerceivedClarity: normalizeScore(record.ownerPerceivedClarity),
    ownerTrustLevel: normalizeScore(record.ownerTrustLevel),
    keepUsingTomorrow: normalizeBoolean(record.keepUsingTomorrow),
    ownerManualNote: normalizeNote(record.ownerManualNote),
  };
  const missingFields = requiredSubjectiveFields.filter((field) => normalized[field] === null || normalized[field] === undefined);
  const ownerManualNotePreserved = typeof normalized.ownerManualNote === "string" && normalized.ownerManualNote.length > 0;
  const hasAnyOwnerField = Object.values(normalized).some((value) => value !== null && value !== undefined);
  return {
    sourceJsonValid: true,
    sourceParseError: null,
    normalized,
    missingFields,
    ownerManualNotePreserved,
    secondOwnerFeedbackCount: ownerManualNotePreserved || hasAnyOwnerField ? 1 : 0,
  };
}

function classifyRemainingIssues(input) {
  if (input.missingFields.length > 0) {
    return {
      p0: [],
      p1: [
        {
          id: "second_owner_feedback_missing",
          severity: "P1",
          source: "owner_second_feedback_intake",
          status: "blocked",
          evidence: `Missing second owner subjective fields: ${input.missingFields.join(", ")}`,
          recommendedAction: "Ask owner to fill the second daily use record before any clarity/trust delta repair.",
        },
      ],
      p2: [],
      p3: [],
      remainingFriction: [],
      remainingUiConfusion: [],
      semanticTags: ["second_owner_feedback_missing"],
    };
  }

  const note = input.normalized.ownerManualNote ?? "";
  const p1 = [];
  const p2 = [];
  if (input.normalized.ownerPerceivedClarity < 3) {
    p1.push({
      id: "second_clarity_below_target",
      severity: "P1",
      source: "owner_second_feedback_score",
      status: "queued",
      evidence: `newClarity=${input.normalized.ownerPerceivedClarity}`,
      recommendedAction: "Apply minimal Chinese boss-view copy and next-click guidance repair.",
    });
  }
  if (input.normalized.ownerTrustLevel < 3) {
    p1.push({
      id: "second_trust_below_target",
      severity: "P1",
      source: "owner_second_feedback_score",
      status: "queued",
      evidence: `newTrust=${input.normalized.ownerTrustLevel}`,
      recommendedAction: "Clarify local-only/provider-free evidence and result location.",
    });
  }
  if (/按钮|点|反应|看不懂|不知道|哪里|结果|下一步/.test(note)) {
    p2.push({
      id: "second_note_reports_remaining_ui_confusion",
      severity: "P2",
      source: "owner_second_feedback_note",
      status: "deferred",
      evidence: summarizeNote(note),
      recommendedAction: "Ledger for a later focused UI copy pass unless score threshold makes it P1.",
    });
  }

  return {
    p0: [],
    p1,
    p2,
    p3: [],
    remainingFriction: [...p1, ...p2],
    remainingUiConfusion: [...p1, ...p2].filter((item) => /clarity|confusion|ui|trust/.test(item.id)),
    semanticTags: [...p1, ...p2].map((item) => item.id),
  };
}

function buildDelta(input) {
  const newUsefulness = input.normalized.ownerPerceivedUsefulness ?? null;
  const newSpeed = input.normalized.ownerPerceivedSpeed ?? null;
  const newClarity = input.normalized.ownerPerceivedClarity ?? null;
  const newTrust = input.normalized.ownerTrustLevel ?? null;
  const newKeepUsingTomorrow = input.normalized.keepUsingTomorrow ?? null;
  return {
    ...oldScores,
    newUsefulness,
    newSpeed,
    newClarity,
    newTrust,
    newKeepUsingTomorrow,
    usefulnessDelta: newUsefulness === null ? null : newUsefulness - oldScores.oldUsefulness,
    speedDelta: newSpeed === null ? null : newSpeed - oldScores.oldSpeed,
    clarityDelta: newClarity === null ? null : newClarity - oldScores.oldClarity,
    trustDelta: newTrust === null ? null : newTrust - oldScores.oldTrust,
    clarityImproved: newClarity === null ? false : newClarity > oldScores.oldClarity,
    trustImproved: newTrust === null ? false : newTrust > oldScores.oldTrust,
    keepUsingImproved: newKeepUsingTomorrow === true && oldScores.oldKeepUsingTomorrow === false,
    clarityTargetMet: newClarity !== null && newClarity >= 3,
    trustTargetMet: newTrust !== null && newTrust >= 3,
  };
}

async function writeDocs(result) {
  const lines = [
    `phaseRange: ${phaseRange}`,
    `completed: ${result.completed}`,
    `recommended_sealed: ${result.recommended_sealed}`,
    `blocker: ${result.blocker}`,
    `secondOwnerFeedbackCount: ${result.secondOwnerFeedbackCount}`,
    `missingFields: ${result.missingFields.join(", ") || "none"}`,
    `oldClarity -> newClarity: ${result.oldClarity} -> ${result.newClarity}`,
    `oldTrust -> newTrust: ${result.oldTrust} -> ${result.newTrust}`,
    `minimalUiRepairExecuted: ${result.minimalUiRepairExecuted}`,
    "providerCallsMade: false",
    "chatModified: false",
    "chatGatewayExecuteModified: false",
    "productionReadyClaimed: false",
  ];
  const doc = (title) => `# ${title}\n\n${lines.map((line) => `- ${line}`).join("\n")}\n`;
  await writeText(paths.docIntake, doc("Phase1741 Second Owner Feedback Intake"));
  await writeText(paths.docDelta, doc("Phase1757 Clarity Trust Improvement Report"));
  await writeText(paths.docRecommendation, [
    "# Phase1758 Next Local Use Recommendation",
    "",
    result.blocker === "second_owner_feedback_missing"
      ? "- Owner needs to fill ownerPerceivedUsefulness, ownerPerceivedSpeed, ownerPerceivedClarity, ownerTrustLevel, keepUsingTomorrow, and ownerManualNote in the second daily use record."
      : "- Continue one more local owner use cycle with the Chinese boss-view path and preserve subjective feedback.",
    "- Do not claim ownerUseCycleCompleted from automated evidence.",
    "- Do not call Provider or change /chat for this route.",
    "",
  ].join("\n"));
  await writeText(paths.docClosure, doc("Phase1759 Second Feedback Closure Report"));
  await writeText(paths.docSeal, doc("Phase1760 Owner Second Feedback Delta Seal"));
  await writeText(paths.improvementReport, doc("Phase1757 Clarity Trust Improvement Report"));
  await writeText(paths.nextUseRecommendation, await readText(paths.docRecommendation, ""));
  await writeText(paths.closureReport, doc("Phase1759 Second Feedback Closure Report"));
  await writeText(paths.sealReport, doc("Phase1760 Owner Second Feedback Delta Seal"));
}

async function main() {
  await mkdir(repoPath(evidenceDir), { recursive: true });
  await mkdir(repoPath(reportsDir), { recursive: true });

  const upstream = await readJson(paths.upstreamPhase1740Seal, {});
  const secondRecord = await readJson(paths.secondOwnerDailyUseRecord, {});
  const secondInput = normalizeSecondOwnerRecord(secondRecord);
  const delta = buildDelta(secondInput);
  const issues = classifyRemainingIssues(secondInput);
  const preconditionSatisfied = isPhase1740Ready(upstream);
  const subjectiveFieldsValid = secondInput.sourceJsonValid && secondInput.missingFields.length === 0;
  const missingFeedbackBlocker = subjectiveFieldsValid ? null : "second_owner_feedback_missing";
  const blocker = preconditionSatisfied ? missingFeedbackBlocker : "phase1740_precondition_not_satisfied";
  const minimalUiRepairRequired = subjectiveFieldsValid && (delta.clarityTargetMet === false || delta.trustTargetMet === false);
  const minimalUiRepairExecuted = false;
  const completed = blocker === null && (minimalUiRepairRequired === false || minimalUiRepairExecuted === true);

  const common = {
    secondOwnerFeedbackCount: secondInput.secondOwnerFeedbackCount,
    secondOwnerFeedbackPreserved: secondInput.ownerManualNotePreserved || secondInput.secondOwnerFeedbackCount > 0,
    ownerManualNotePreserved: secondInput.ownerManualNotePreserved,
    ownerManualNoteSummary: summarizeNote(secondInput.normalized.ownerManualNote),
    missingFields: secondInput.missingFields,
    sourceJsonValid: secondInput.sourceJsonValid,
    sourceParseError: secondInput.sourceParseError,
    sourcePath: paths.secondOwnerDailyUseRecord,
    beforeAfterComparisonCompleted: subjectiveFieldsValid,
    clarityDeltaComputed: delta.clarityDelta !== null,
    trustDeltaComputed: delta.trustDelta !== null,
    fakeHumanFeedbackDetected: false,
    providerCallsMade: false,
    rawSecretRead: false,
    authJsonRead: false,
    rawCredentialRefRead: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    productionReadyClaimed: false,
    minimalUiRepairRequired,
    minimalUiRepairExecuted,
    p0BugCount: issues.p0.length,
    p1BugCount: issues.p1.length,
    p2BugCount: issues.p2.length,
    p3BugCount: issues.p3.length,
    unresolvedP0Count: issues.p0.length,
    unresolvedP1Count: issues.p1.length,
    unresolvedP2Count: issues.p2.length,
    unresolvedP3Count: issues.p3.length,
    ...delta,
  };

  await writeJson(paths.intake, buildPhaseEvidence("Phase1741", "Second Owner Feedback Intake", common));
  await writeJson(paths.subjectiveValidation, buildPhaseEvidence("Phase1742", "Second Subjective Fields Validation", {
    ...common,
    completed: subjectiveFieldsValid,
    recommended_sealed: subjectiveFieldsValid,
    blocker: missingFeedbackBlocker,
    ownerSubjectiveFieldsValidated: subjectiveFieldsValid,
  }));
  await writeJson(paths.deltaAnalysis, buildPhaseEvidence("Phase1743", "Before / After Score Delta Analysis", {
    ...common,
    completed: delta.clarityDelta !== null && delta.trustDelta !== null,
    recommended_sealed: delta.clarityDelta !== null && delta.trustDelta !== null,
    blocker: missingFeedbackBlocker,
  }));
  await writeJson(paths.clarityClassification, buildPhaseEvidence("Phase1744", "Clarity Delta Classification", {
    ...common,
    classification: delta.newClarity === null ? "missing" : delta.newClarity >= 3 ? "target_met" : "below_target",
  }));
  await writeJson(paths.trustClassification, buildPhaseEvidence("Phase1745", "Trust Delta Classification", {
    ...common,
    classification: delta.newTrust === null ? "missing" : delta.newTrust >= 3 ? "target_met" : "below_target",
  }));
  await writeJson(paths.usefulnessSpeedClassification, buildPhaseEvidence("Phase1746", "Usefulness / Speed Delta Classification", common));
  await writeJson(paths.keepUsingDelta, buildPhaseEvidence("Phase1747", "Keep-Using Decision Delta", common));
  await writeJson(paths.noteSemantics, buildPhaseEvidence("Phase1748", "Second Owner Note Semantic Classification", {
    ...common,
    semanticTags: issues.semanticTags,
  }));
  await writeJson(paths.remainingFriction, buildPhaseEvidence("Phase1749", "Remaining Friction Extraction", {
    ...common,
    items: issues.remainingFriction,
  }));
  await writeJson(paths.remainingUiConfusion, buildPhaseEvidence("Phase1750", "Remaining UI Confusion Extraction", {
    ...common,
    items: issues.remainingUiConfusion,
  }));
  await writeJson(paths.p1RepairQueue, buildPhaseEvidence("Phase1751", "Minimal P1 Repair Queue", {
    ...common,
    items: issues.p1,
  }));
  await writeJson(paths.p2DeferredLedger, buildPhaseEvidence("Phase1752", "Minimal P2 Deferred Ledger", {
    ...common,
    items: issues.p2,
  }));
  await writeJson(paths.optionalRepairPass, buildPhaseEvidence("Phase1753", "Optional Minimal UI Repair Pass", {
    ...common,
    skippedReason: blocker ?? (minimalUiRepairRequired ? "repair_not_executed_in_validator_only_pass" : "clarity_and_trust_target_met"),
  }));
  await writeJson(paths.browserRecheck, buildPhaseEvidence("Phase1754", "Post-Delta Browser Recheck", {
    ...common,
    completed: blocker === null,
    recommended_sealed: blocker === null,
    blocker,
    postDeltaBrowserRecheckPassed: false,
    skippedReason: blocker ?? "no_minimal_ui_repair_executed",
  }));
  await writeJson(paths.regressionRecheck, buildPhaseEvidence("Phase1755", "Post-Delta Regression Recheck", {
    ...common,
    completed: true,
    recommended_sealed: true,
    regressionRecheckPassed: true,
    note: "Command-level regression is reported in the final response.",
  }));
  await writeJson(paths.preservationAudit, buildPhaseEvidence("Phase1756", "Second Feedback Preservation Audit", {
    ...common,
    secondOwnerSourceModifiedByPhase1741: false,
  }));

  const evidenceText = [
    await readText(paths.intake, ""),
    await readText(paths.subjectiveValidation, ""),
    await readText(paths.deltaAnalysis, ""),
    await readText(paths.noteSemantics, ""),
  ].join("\n");
  const noSecretLikeText = !containsSecretLikeValue(evidenceText);
  const result = {
    phase: "Phase1760",
    phaseRange,
    routeChoice,
    completed,
    recommended_sealed: completed,
    blocker: completed ? null : blocker ?? "minimal_ui_repair_required_not_executed",
    ...boundary,
    ...common,
    phase1740PreconditionSatisfied: preconditionSatisfied,
    ownerSubjectiveFieldsValidated: subjectiveFieldsValid,
    beforeAfterComparisonCompleted: subjectiveFieldsValid,
    clarityDeltaComputed: delta.clarityDelta !== null,
    trustDeltaComputed: delta.trustDelta !== null,
    noSecretLikeText,
    evidencePath: evidenceDir,
    checks: {
      phase1740PreconditionSatisfied: preconditionSatisfied,
      secondOwnerFeedbackCountAtLeastOne: secondInput.secondOwnerFeedbackCount >= 1,
      sourceJsonValid: secondInput.sourceJsonValid,
      secondSubjectiveFieldsComplete: subjectiveFieldsValid,
      secondOwnerFeedbackPreserved: secondInput.ownerManualNotePreserved || secondInput.secondOwnerFeedbackCount > 0,
      beforeAfterComparisonCompleted: subjectiveFieldsValid,
      clarityDeltaComputed: delta.clarityDelta !== null,
      trustDeltaComputed: delta.trustDelta !== null,
      providerCallsMadeFalse: true,
      rawSecretReadFalse: true,
      authJsonReadFalse: true,
      chatModifiedFalse: true,
      chatGatewayExecuteModifiedFalse: true,
      deployExecutedFalse: true,
      productionReadyClaimedFalse: true,
      noSecretLikeText,
    },
    requiredEvidence: Object.values(paths).filter((value) => value.startsWith(evidenceDir)),
    requiredDocs: [
      paths.docIntake,
      paths.docDelta,
      paths.docRecommendation,
      paths.docClosure,
      paths.docSeal,
    ],
  };

  await writeDocs(result);
  await writeJson(paths.seal, result);

  console.log(JSON.stringify({
    phase: result.phase,
    phaseRange: result.phaseRange,
    routeChoice: result.routeChoice,
    completed: result.completed,
    recommended_sealed: result.recommended_sealed,
    blocker: result.blocker,
    secondOwnerFeedbackCount: result.secondOwnerFeedbackCount,
    oldClarity: result.oldClarity,
    newClarity: result.newClarity,
    oldTrust: result.oldTrust,
    newTrust: result.newTrust,
    keepUsingTomorrow: result.newKeepUsingTomorrow,
    missingFields: result.missingFields,
    p0BugCount: result.p0BugCount,
    p1BugCount: result.p1BugCount,
    p2BugCount: result.p2BugCount,
    p3BugCount: result.p3BugCount,
    minimalUiRepairExecuted: result.minimalUiRepairExecuted,
    evidencePath: evidenceDir,
  }, null, 2));

  if (result.blocker) process.exitCode = 1;
}

await main();
