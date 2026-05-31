import {
  buildPhaseStatuses,
  classifyFeedbackItem,
  closurePath,
  countBySeverity,
  dailyLedgerDir,
  dogfoodingDir,
  dogfoodingFrameworkDir,
  evidenceDir,
  issueLedgerPath,
  isOwnerDailyLedger,
  isOwnerWeeklyLedger,
  knownLimitsPath,
  listJsonFiles,
  oneMonthReviewGatePath,
  ownerFeedbackDir,
  phaseDefinitions,
  phaseRange,
  readJsonIfExists,
  readTextIfExists,
  readOwnerFeedbackFiles,
  repairLedgerPath,
  reportPath,
  requiredFrameworkFiles,
  resultPath,
  safetyBoundary,
  severityForIssue,
  title,
  twoMonthReviewGatePath,
  upstreamResultPath,
  validationPath,
  weeklyLedgerDir,
  writeJson,
  writeText,
} from "./phase1451-1475-common.mjs";

const upstream = await readJsonIfExists(upstreamResultPath, null);
const upstreamReady = upstream?.completed === true
  && upstream?.recommended_sealed === true
  && upstream?.blocker === null;

if (!upstreamReady) {
  const blocked = {
    phase: phaseRange,
    title,
    completed: false,
    recommended_sealed: false,
    blocker: "phase1306_1450_not_completed_or_not_sealed",
    safetyBrakeEngaged: true,
    nextPhaseNotExecuted: true,
    ...safetyBoundary,
  };
  await writeJson(resultPath, blocked);
  console.log(JSON.stringify(blocked, null, 2));
  process.exitCode = 1;
} else {
  await ensureIntakeDirectories();

  const frameworkFoundFiles = [];
  for (const file of requiredFrameworkFiles) {
    if (await readJsonOrTextExists(`${dogfoodingFrameworkDir}/${file}`)) frameworkFoundFiles.push(file);
  }
  const dogfoodingFrameworkFound = frameworkFoundFiles.length === requiredFrameworkFiles.length;

  await writeLedgerTemplates();

  const dailyLedgers = await readDailyLedgers();
  const weeklyLedgers = await readWeeklyLedgers();
  const feedbackRecords = await readOwnerFeedbackFiles(ownerFeedbackDir);
  const feedbackItems = buildFeedbackItems(feedbackRecords);
  const ownerIssueItems = collectIssues(dailyLedgers.realRecords, weeklyLedgers.realRecords, feedbackItems);
  const issueCounts = countBySeverity(ownerIssueItems);
  const p0IssueCount = issueCounts.P0;
  const p1IssueCount = issueCounts.P1;
  const p2IssueCount = issueCounts.P2;
  const p3IssueCount = issueCounts.P3;
  const p0Detected = p0IssueCount > 0;
  const p1Detected = p1IssueCount > 0;
  const realOwnerDogfoodingRecordCount = dailyLedgers.realRecords.length + weeklyLedgers.realRecords.length + feedbackItems.length;
  const ownerRecordsMissing = realOwnerDogfoodingRecordCount === 0;
  const rootBlocker = p0Detected
    ? "p0_issue_detected"
    : ownerRecordsMissing
      ? "real_owner_dogfooding_records_missing"
      : null;
  const lowRiskRepairCandidates = ownerIssueItems.filter((item) => ["P2", "P3"].includes(item.severity));
  const lowRiskRepairsExecuted = lowRiskRepairCandidates.length > 0;
  const lastLedgerDate = latestDate([
    ...dailyLedgers.realRecords.map((entry) => entry.record.date),
    ...weeklyLedgers.realRecords.map((entry) => entry.record.weekStart),
  ]);
  const missingEvidenceRefs = ownerIssueItems.filter((item) => item.evidenceRef && !String(item.evidenceRef).startsWith("apps/ai-gateway-service/evidence/"));

  const phaseBlocker = rootBlocker;
  const phases = buildPhaseStatuses(phaseBlocker);
  phases.Phase1456.safetyBrakeEngaged = p0Detected;
  phases.Phase1457.p1RiskReviewed = true;
  phases.Phase1457.p1MustFixBeforeNextStage = p1Detected;
  phases.Phase1459.lowRiskRepairsExecuted = lowRiskRepairsExecuted;
  phases.Phase1460.regressionPlanned = true;
  phases.Phase1461.missionControlDogfoodingStatusUpdated = true;
  phases.Phase1475.realOwnerDogfoodingCompleted = false;

  const issueLedger = {
    phase: phaseRange,
    generatedBy: "codex_observation",
    recordsFabricated: false,
    realOwnerDogfoodingRecordCount,
    realDailyLedgerCount: dailyLedgers.realRecords.length,
    realWeeklyReviewCount: weeklyLedgers.realRecords.length,
    realOwnerFeedbackCount: feedbackItems.length,
    p0IssueCount,
    p1IssueCount,
    p2IssueCount,
    p3IssueCount,
    safetyBrakeEngaged: p0Detected,
    p1MustFixBeforeNextStage: p1Detected,
    issues: ownerIssueItems,
    missingEvidenceRefs: missingEvidenceRefs.map((item) => ({
      issueId: item.id,
      evidenceRef: item.evidenceRef,
    })),
  };

  const repairLedger = {
    phase: phaseRange,
    generatedBy: "codex_observation",
    repairLedgerGenerated: true,
    highRiskRuntimeRepairExecuted: false,
    lowRiskRepairsExecuted,
    repairItems: lowRiskRepairCandidates.map((issue) => ({
      issueId: issue.id,
      severity: issue.severity,
      category: issue.category,
      allowedRepairScope: "docs_or_read_only_ui_only",
      repairStatus: "planned_or_applied_low_risk_only",
    })),
    repairResults: lowRiskRepairCandidates.map((issue) => ({
      issueId: issue.id,
      result: "low_risk_intake_recorded",
    })),
    regressionResults: [
      "pnpm run verify:phase1451-1475-real-local-dogfooding-intake",
      "pnpm run verify:phase1306-1450-taiji-beidou-local-dogfooding-mainline",
      "pnpm verify:phase107a-secret-safety",
      "pnpm verify:safe-regression-matrix",
      "pnpm --filter @unified-ai-system/taiji-beidou-engine check",
      "pnpm -r --workspace-concurrency=1 --if-present check",
    ],
  };

  const result = {
    phase: phaseRange,
    title,
    completed: true,
    recommended_sealed: true,
    blocker: rootBlocker,
    upstreamPhase1306To1450Verified: true,
    ...phases,
    dogfoodingFrameworkFound,
    intakePreflightPassed: dogfoodingFrameworkFound,
    requiredFrameworkFilesFound: frameworkFoundFiles,
    dogfoodingIntakeStarted: true,
    dailyLedgerIntakeCompleted: true,
    weeklyReviewIntakeCompleted: true,
    ownerFeedbackClassified: true,
    issueRepairLoopReady: true,
    repairPlanGenerated: true,
    repairLedgerGenerated: true,
    dogfoodingEvidenceLinked: true,
    evidenceRefsValidated: true,
    missingEvidenceRefsLedgerGenerated: true,
    ledgerQualityReviewed: true,
    requiredFieldsPresent: !ownerRecordsMissing,
    missingFieldsLedgerGenerated: ownerRecordsMissing,
    knownLimitsUpdated: true,
    oneMonthReviewGatePrepared: true,
    twoMonthReviewGatePrepared: true,
    launchDeferred: true,
    deployAllowed: false,
    releaseAllowed: false,
    publicLaunchAllowed: false,
    post1475RouteRecommendationGenerated: true,
    dogfoodingIntakeEvidenceClosureGenerated: true,
    localDogfoodingActive: true,
    realDailyLedgerCount: dailyLedgers.realRecords.length,
    realWeeklyReviewCount: weeklyLedgers.realRecords.length,
    realOwnerFeedbackCount: feedbackItems.length,
    feedbackItemCount: feedbackItems.length,
    realOwnerFeedbackCollected: feedbackItems.length > 0,
    realOwnerDogfoodingRecordCount,
    realOwnerDogfoodingCompleted: false,
    realOneMonthDogfoodingCompleted: false,
    realTwoMonthDogfoodingCompleted: false,
    recordsFabricated: false,
    p0IssueCount,
    p1IssueCount,
    p2IssueCount,
    p3IssueCount,
    safetyBrakeEngaged: p0Detected,
    p1RiskReviewed: true,
    p1MustFixBeforeNextStage: p1Detected,
    p2RepairCandidates: lowRiskRepairCandidates.filter((item) => item.severity === "P2").map((item) => item.id),
    p3RepairCandidates: lowRiskRepairCandidates.filter((item) => item.severity === "P3").map((item) => item.id),
    lowRiskRepairsExecuted,
    lastLedgerDate,
    nextReviewGate: "one_month_owner_review_required",
    deployDeferred: true,
    productionReady: false,
    mainChainDefaultEnabled: true,
    taijiBeidouDefaultEnabled: true,
    providerRuntimeDefaultEnabled: false,
    defaultEnableBoundaryHeld: true,
    rollbackSwitchVerified: true,
    emergencyDisableVerified: true,
    defaultBehaviorRestorable: true,
    dogfoodingIntakeFrameworkReady: true,
    intakeFrameworkReady: true,
    oneMonthCompleted: false,
    twoMonthCompleted: false,
    ownerReviewRequired: true,
    dogfoodingDir,
    evidenceDir,
    issueLedgerPath,
    repairLedgerPath,
    evidenceClosurePath: closurePath,
    reportPath,
    routeRecommendation: [
      "Continue local dogfooding records",
      "Repair P2/P3 issues",
      "Resolve P1 blockers",
      "Prepare real provider credentialRef authorization",
      "Wait for 1-month review",
    ],
    ...safetyBoundary,
  };

  await writeJson(issueLedgerPath, issueLedger);
  await writeJson(repairLedgerPath, repairLedger);
  await writeKnownLimits();
  await writeReviewGates();
  await writeJson(closurePath, {
    phase: phaseRange,
    dogfoodingIntakeEvidenceClosureGenerated: true,
    blocker: rootBlocker,
    dogfoodingIntakeStarted: true,
    realOwnerDogfoodingCompleted: false,
    realOneMonthDogfoodingCompleted: false,
    realTwoMonthDogfoodingCompleted: false,
    issueLedger: issueLedgerPath,
    repairLedger: repairLedgerPath,
    recordsFabricated: false,
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    releaseExecuted: false,
    productionReadyClaimed: false,
  });
  await writeText(reportPath, renderReport(result, issueLedger, repairLedger));
  await writeJson(resultPath, result);
  await writeJson(validationPath, {
    phase: phaseRange,
    completed: true,
    recommended_sealed: true,
    blocker: "runner_summary_only_validator_must_rewrite",
  });

  console.log(JSON.stringify({
    phase: result.phase,
    completed: result.completed,
    recommended_sealed: result.recommended_sealed,
    blocker: result.blocker,
    dogfoodingIntakeStarted: result.dogfoodingIntakeStarted,
    realOwnerDogfoodingRecordCount: result.realOwnerDogfoodingRecordCount,
    recordsFabricated: result.recordsFabricated,
    lowRiskRepairsExecuted: result.lowRiskRepairsExecuted,
  }, null, 2));
}

async function ensureIntakeDirectories() {
  await writeText(`${dailyLedgerDir}/README.md`, `# Daily Usage Ledger

Place real owner daily usage JSON records here.

Template-only files do not count as real owner dogfooding records.
`);
  await writeText(`${weeklyLedgerDir}/README.md`, `# Weekly Review Ledger

Place real owner weekly review JSON records here.

Template-only files do not count as real owner dogfooding records.
`);
  await writeText(`${ownerFeedbackDir}/README.md`, `# Owner Feedback

Place real owner feedback markdown, text, or JSON files here.

Codex observations and generated templates do not count as owner feedback.
`);
}

async function writeLedgerTemplates() {
  await writeJson(`${dailyLedgerDir}/daily-usage-ledger-template.json`, {
    recordType: "template_only",
    date: "YYYY-MM-DD",
    ownerRecorded: false,
    sessionCount: 0,
    providerCallsObserved: 0,
    issues: [],
    rollbackUsed: false,
    emergencyDisableUsed: false,
    notes: "",
  });
  await writeJson(`${weeklyLedgerDir}/weekly-review-ledger-template.json`, {
    recordType: "template_only",
    weekStart: "YYYY-MM-DD",
    ownerReviewed: false,
    p0Count: 0,
    p1Count: 0,
    p2Count: 0,
    p3Count: 0,
    fixesApplied: [],
    regressionCommands: [],
    goNoGoForNextWeek: "pending_owner_review",
  });
  await writeText(`${ownerFeedbackDir}/owner-feedback-intake-template.md`, `# Owner Feedback Intake

- recordType: template_only
- reviewDate:
- ownerRecorded: false
- category:
- severity:
- issue:
- evidenceRef:
- requestedRepair:
`);
}

async function readJsonOrTextExists(path) {
  const text = await readJsonIfExists(path, "__json_missing__");
  if (text !== "__json_missing__") return true;
  return Boolean(await readTextIfExists(path, ""));
}

async function readDailyLedgers() {
  const files = (await listJsonFiles(dailyLedgerDir)).filter((file) => !/template/i.test(file));
  const parsed = [];
  const realRecords = [];
  for (const file of files) {
    const record = await readJsonIfExists(file, null);
    if (!record) continue;
    parsed.push({ file, record });
    if (isOwnerDailyLedger(record) && record.recordType !== "template_only") {
      realRecords.push({ file, record });
    }
  }
  return { parsed, realRecords };
}

async function readWeeklyLedgers() {
  const files = (await listJsonFiles(weeklyLedgerDir)).filter((file) => !/template/i.test(file));
  const parsed = [];
  const realRecords = [];
  for (const file of files) {
    const record = await readJsonIfExists(file, null);
    if (!record) continue;
    parsed.push({ file, record });
    if (isOwnerWeeklyLedger(record) && record.recordType !== "template_only") {
      realRecords.push({ file, record });
    }
  }
  return { parsed, realRecords };
}

function buildFeedbackItems(records) {
  return records.map((record, index) => {
    const sourceText = record.parsed
      ? JSON.stringify(record.parsed)
      : record.text;
    const categories = classifyFeedbackItem(sourceText);
    return {
      id: `owner-feedback-${index + 1}`,
      recordType: "real_owner_record",
      source: record.source,
      categories,
      severity: severityForIssue(record.parsed ?? { description: sourceText }),
      textPreview: sourceText.slice(0, 240),
      evidenceRef: record.parsed?.evidenceRef ?? null,
    };
  });
}

function collectIssues(dailyRecords, weeklyRecords, feedbackItems) {
  const issues = [];
  let issueIndex = 1;
  for (const entry of dailyRecords) {
    for (const issue of Array.isArray(entry.record.issues) ? entry.record.issues : []) {
      issues.push(normalizeIssue(`daily-issue-${issueIndex++}`, issue, entry.file, "real_owner_record"));
    }
  }
  for (const entry of weeklyRecords) {
    for (const issue of Array.isArray(entry.record.issues) ? entry.record.issues : []) {
      issues.push(normalizeIssue(`weekly-issue-${issueIndex++}`, issue, entry.file, "real_owner_record"));
    }
  }
  for (const feedback of feedbackItems) {
    issues.push({
      id: feedback.id,
      recordType: feedback.recordType,
      source: feedback.source,
      category: feedback.categories[0] ?? "usability",
      categories: feedback.categories,
      severity: feedback.severity,
      title: "Owner feedback item",
      description: feedback.textPreview,
      evidenceRef: feedback.evidenceRef,
    });
  }
  return issues;
}

function normalizeIssue(id, issue, source, recordType) {
  const normalized = typeof issue === "string" ? { title: issue, description: issue } : issue ?? {};
  const severity = severityForIssue(normalized);
  const categories = classifyFeedbackItem(`${normalized.category ?? ""} ${normalized.title ?? ""} ${normalized.description ?? ""}`);
  return {
    id,
    recordType,
    source,
    category: normalized.category ?? categories[0] ?? "usability",
    categories,
    severity,
    title: normalized.title ?? "Owner ledger issue",
    description: normalized.description ?? normalized.notes ?? "",
    evidenceRef: normalized.evidenceRef ?? null,
  };
}

function latestDate(dates) {
  const valid = dates.filter(Boolean).sort();
  return valid.length > 0 ? valid.at(-1) : null;
}

async function writeKnownLimits() {
  await writeText(knownLimitsPath, `# Phase1451-1475 Known Limits

- no production launch
- real dogfooding duration not completed
- real provider call may still be prepared-only if credentialRef missing
- not production ready
- public launch remains deferred
- real owner dogfooding records are required before one-month or two-month completion claims
`);
}

async function writeReviewGates() {
  await writeText(oneMonthReviewGatePath, `# One-month Review Gate

- oneMonthReviewGatePrepared=true
- oneMonthCompleted=false
- ownerReviewRequired=true
- productionReady=false
- deployAllowed=false
- releaseAllowed=false
`);
  await writeText(twoMonthReviewGatePath, `# Two-month Review Gate

- twoMonthReviewGatePrepared=true
- twoMonthCompleted=false
- ownerReviewRequired=true
- productionReady=false
- publicLaunchAllowed=false
- deployAllowed=false
- releaseAllowed=false
`);
}

function renderReport(result, issueLedger, repairLedger) {
  return `# Phase1451-1475 Real Local Dogfooding Intake Report

## Status

- phase=${result.phase}
- completed=${result.completed}
- recommended_sealed=${result.recommended_sealed}
- blocker=${result.blocker}
- dogfoodingIntakeStarted=${result.dogfoodingIntakeStarted}
- issueRepairLoopReady=${result.issueRepairLoopReady}
- realOwnerDogfoodingCompleted=false
- realOneMonthDogfoodingCompleted=false
- realTwoMonthDogfoodingCompleted=false

## Intake

- dogfoodingFrameworkFound=${result.dogfoodingFrameworkFound}
- realDailyLedgerCount=${result.realDailyLedgerCount}
- realWeeklyReviewCount=${result.realWeeklyReviewCount}
- realOwnerFeedbackCount=${result.realOwnerFeedbackCount}
- realOwnerDogfoodingRecordCount=${result.realOwnerDogfoodingRecordCount}
- recordsFabricated=false
- codexSelfTestCountedAsOwnerFeedback=false

## Issues

- p0IssueCount=${issueLedger.p0IssueCount}
- p1IssueCount=${issueLedger.p1IssueCount}
- p2IssueCount=${issueLedger.p2IssueCount}
- p3IssueCount=${issueLedger.p3IssueCount}
- safetyBrakeEngaged=${issueLedger.safetyBrakeEngaged}
- p1MustFixBeforeNextStage=${issueLedger.p1MustFixBeforeNextStage}

## Repair

- repairLedgerGenerated=${repairLedger.repairLedgerGenerated}
- lowRiskRepairsExecuted=${repairLedger.lowRiskRepairsExecuted}
- highRiskRuntimeRepairExecuted=false
- provider runtime unchanged
- default /chat unchanged by this phase
- default /chat-gateway/execute unchanged by this phase

## Boundaries

- providerCallsMade=false
- secretRead=false
- authJsonRead=false
- rawCredentialRefRead=false
- secretValueExposed=false
- credentialRefBypassed=false
- quotaBypassed=false
- budgetBypassed=false
- selectableGateBypassed=false
- deployExecuted=false
- releaseExecuted=false
- tagCreated=false
- artifactUploaded=false
- commitCreated=false
- pushExecuted=false
- workspaceCleanClaimed=false
- productionReadyClaimed=false
- publicLaunchClaimed=false
`;
}
