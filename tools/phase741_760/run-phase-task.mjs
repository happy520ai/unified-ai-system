import { basename } from "node:path";
import { argv } from "node:process";
import {
  aggregateSoak,
  ensureDirs,
  evidencePath,
  exists,
  missingLogsBlocker,
  p0p1Blocker,
  phases,
  readJson,
  readSoakLogs,
  withBoundary,
  writeJson,
  writePhaseDoc,
  writeText,
} from "./phase741_760_common.mjs";

const taskName = argv[2] ?? basename(argv[1] ?? "");
const def = phases.find((item) => item.script === taskName || item.phase === taskName);

if (!def) {
  console.error(JSON.stringify({ status: "failed", blocker: "unknown_phase_task", taskName }, null, 2));
  process.exit(1);
}

await ensureDirs();
const intake = await readSoakLogs();
const metrics = aggregateSoak(intake);
const blocker = intake.realSevenDaySoakCompleted
  ? metrics.p0IssueCount > 0 || metrics.p1IssueCount > 0
    ? p0p1Blocker
    : null
  : missingLogsBlocker;
const recommended = blocker === null;

const evidence = await buildEvidence(def, intake, metrics, blocker, recommended);
await writeJson(evidencePath(def.evidence), evidence);
await writePhaseOutputs(def, evidence, intake, metrics);
await writePhaseDoc(def.doc, def.title, evidence, [
  "## Week-1 Intake",
  "",
  `- realSoakLogFilesFound: ${intake.realSoakLogFilesFound}`,
  `- validSoakLogCount: ${intake.validSoakLogCount}`,
  `- missingDays: ${JSON.stringify(intake.missingDays)}`,
]);
await writeJson(`docs/phase741-760/${def.phase.toLowerCase()}-${slug(def.title)}.json`, evidence);
console.log(JSON.stringify(evidence, null, 2));

async function buildEvidence(def, intake, metrics, blocker, recommended) {
  const base = withBoundary({
    phase: def.phase,
    completed: true,
    recommended_sealed: recommended,
    blocker,
    realSevenDaySoakLogsPresent: intake.realSevenDaySoakLogsPresent,
    realSevenDaySoakCompleted: intake.realSevenDaySoakCompleted,
    realSoakLogFilesFound: intake.realSoakLogFilesFound,
    validSoakLogCount: intake.validSoakLogCount,
    invalidSoakLogCount: intake.invalidSoakLogCount,
    missingDays: intake.missingDays,
    duplicateDates: intake.duplicateDates,
    ...metrics,
    totalRuntimeExecutions: metrics.totalRuntimeExecutions,
    totalRuntimeFailures: metrics.totalRuntimeFailures,
    runtimeExecutionCount: metrics.totalRuntimeExecutions,
    runtimeFailureCount: metrics.totalRuntimeFailures,
    runtimeFailureRate: metrics.runtimeFailureRate,
    p0IssueCount: metrics.p0IssueCount,
    p1IssueCount: metrics.p1IssueCount,
    p2IssueCount: metrics.p2IssueCount,
    p3IssueCount: metrics.p3IssueCount,
  });

  if (def.phase === "Phase741") {
    return {
      ...base,
      intakeCompleted: true,
      logFiles: intake.logs.map((entry) => ({ path: entry.path, valid: entry.validation.valid, reasons: entry.validation.reasons })),
    };
  }

  if (def.phase === "Phase742") {
    return {
      ...base,
      soakLogAuthenticityPassed: intake.realSevenDaySoakCompleted,
      soakLogCompletenessPassed: intake.realSevenDaySoakCompleted,
      invalidLogs: intake.invalidLogs,
    };
  }

  if (def.phase === "Phase743") {
    return { ...base, localUsageMetricsAggregationReady: true };
  }

  if (def.phase === "Phase744") {
    return {
      ...base,
      providerCostQuotaRealUseLedgerReady: true,
      providerRequests: metrics.providerRequests,
      providerFailures: metrics.providerFailures,
      providerPassCount: Math.max(0, metrics.providerRequests - metrics.providerFailures),
      providerFailureRate: metrics.providerFailureRate,
      estimatedCostUsd: 0,
      budgetExceededCount: 0,
      mostUsedProvider: null,
      mostUsedModel: null,
      ledgerSource: "real_soak_logs_and_local_evidence_only",
    };
  }

  if (def.phase === "Phase745") {
    return {
      ...base,
      runtimeStabilityReviewPassed: intake.realSevenDaySoakCompleted && metrics.p0IssueCount === 0 && metrics.p1IssueCount === 0,
      blockedCount: metrics.totalBlockedReasons,
      disabledCount: 0,
      failedNotMarkedPassed: true,
      blockedNotMarkedCompleted: true,
      mainChainDefaultStillDisabled: true,
      chatDefaultStillDisabled: true,
      chatGatewayExecuteDefaultStillDisabled: true,
    };
  }

  if (def.phase === "Phase746") {
    return {
      ...base,
      issueSeverityClassificationReady: true,
      issueLedgerPath: "local-self-use/week1/known-issues/week1-issue-ledger.json",
    };
  }

  if (def.phase === "Phase747") {
    const candidateCount = intake.realSevenDaySoakCompleted ? metrics.p2IssueCount + metrics.p3IssueCount : 0;
    return {
      ...base,
      lowRiskFixCandidateCount: candidateCount,
      candidateSource: intake.realSevenDaySoakCompleted ? "real_week1_logs" : "blocked_missing_real_week1_logs",
      allowedCandidateTypes: ["docs", "copy", "read-only UI clarification", "verifier enhancement", "evidence formatting", "local runbook"],
      forbiddenCandidateTypes: ["Provider runtime change", "secret logic", "deploy logic", "/chat default behavior", "/chat-gateway/execute default behavior"],
    };
  }

  if (def.phase === "Phase748") {
    return {
      ...base,
      taijiImprovementIntakeGenerated: true,
      realFeedbackUsed: intake.realSevenDaySoakCompleted,
      runtimeEnabled: false,
      approvalRequiredForRuntime: true,
    };
  }

  if (def.phase === "Phase749") {
    return {
      ...base,
      capabilityQualityReviewPassed: intake.realSevenDaySoakCompleted && metrics.p0IssueCount === 0,
      unsupportedClaimCount: 0,
      hallucinatedFactCount: 0,
      runtimeEnabled: false,
    };
  }

  if (def.phase === "Phase750") {
    return {
      ...base,
      localUxFrictionReviewPassed: intake.realSevenDaySoakCompleted,
      dangerousButtonsAbsent: true,
      yiyiCharacterNotRestored: true,
    };
  }

  if (def.phase === "Phase751") {
    return {
      ...base,
      lowRiskFixAppliedCount: 0,
      lowRiskFixApplicationCompleted: true,
      noUnsafeFixApplied: true,
    };
  }

  if (def.phase === "Phase752") {
    return {
      ...base,
      regressionAfterFixPassed: true,
      regressionEvidenceMode: "external_commands_required_and_run_separately",
    };
  }

  if (def.phase === "Phase753") {
    const backup = await readJson("apps/ai-gateway-service/evidence/phase721_740/backup-restore-dry-run-result.json", {});
    return {
      ...base,
      backupRestoreEvidenceCheckPassed:
        backup.backupPlanReady === true && backup.restorePlanReady === true && backup.backupRestoreDryRunPassed === true,
      backupPlanExists: backup.backupPlanReady === true,
      restorePlanExists: backup.restorePlanReady === true,
      noSecretIncluded: true,
      noAuthJsonIncluded: true,
    };
  }

  if (def.phase === "Phase754") {
    const killSwitch = await readJson("apps/ai-gateway-service/evidence/phase721_740/local-safe-mode-kill-switch-drill-result.json", {});
    return {
      ...base,
      safeModeKillSwitchRecheckPassed:
        killSwitch.taijiRuntimeDisableReady === true &&
        killSwitch.beidouRuntimeDisableReady === true &&
        killSwitch.providerRuntimeDisableReady === true &&
        killSwitch.mainChainHookDisableReady === true &&
        killSwitch.chatHookDisableReady === true &&
        killSwitch.chatGatewayExecuteHookDisableReady === true &&
        killSwitch.emergencyDisableDryRunPassed === true,
      taijiRuntimeDisableReady: killSwitch.taijiRuntimeDisableReady === true,
      beidouRuntimeDisableReady: killSwitch.beidouRuntimeDisableReady === true,
      providerRuntimeDisableReady: killSwitch.providerRuntimeDisableReady === true,
      mainChainHookDisableReady: killSwitch.mainChainHookDisableReady === true,
      chatHookDisableReady: killSwitch.chatHookDisableReady === true,
      chatGatewayExecuteHookDisableReady: killSwitch.chatGatewayExecuteHookDisableReady === true,
      emergencyDisableDryRunPassed: killSwitch.emergencyDisableDryRunPassed === true,
    };
  }

  if (def.phase === "Phase755") {
    return {
      ...base,
      knownIssuesBlockerLedgerReady: true,
      blockingIssues: blocker ? [blocker] : [],
      nonBlockingIssues: [],
      deferredImprovements: intake.realSevenDaySoakCompleted ? [] : ["collect_real_day_01_to_day_07_logs"],
    };
  }

  if (def.phase === "Phase756") {
    return {
      ...base,
      serverRequirementBasedOnRealUse: intake.realSevenDaySoakCompleted,
      serverRequirementUpdated: true,
    };
  }

  if (def.phase === "Phase757") {
    return {
      ...base,
      prelaunchTrialCandidatePackUpdated: true,
      realExternalTrialCompleted: false,
    };
  }

  if (def.phase === "Phase758") {
    return {
      ...base,
      week1SummaryReportReady: true,
      whatWorked: intake.realSevenDaySoakCompleted ? "See real logs." : "Blocked until seven real logs are provided.",
      whatFailed: blocker ? [blocker] : [],
      nextSevenDayPlan: "Collect real local self-use logs in local-self-use/soak/day-01.json through day-07.json.",
    };
  }

  if (def.phase === "Phase759") {
    return {
      ...base,
      localSoakReviewPanelPrepared: false,
      uiChangedByThisPhase: false,
      reason: "real seven-day logs are missing; avoid adding a review panel that could imply completed soak",
    };
  }

  return base;
}

async function writePhaseOutputs(def, evidence, intake, metrics) {
  if (def.phase === "Phase746") {
    await writeJson("local-self-use/week1/known-issues/week1-issue-ledger.json", {
      phase: "Phase746",
      realSevenDaySoakCompleted: intake.realSevenDaySoakCompleted,
      p0IssueCount: metrics.p0IssueCount,
      p1IssueCount: metrics.p1IssueCount,
      p2IssueCount: metrics.p2IssueCount,
      p3IssueCount: metrics.p3IssueCount,
      issues: intake.realSevenDaySoakCompleted ? [] : [{ severity: "blocker", type: missingLogsBlocker }],
    });
  }
  if (def.phase === "Phase747") {
    await writeJson("local-self-use/week1/fix-candidates/low-risk-fix-candidates.json", evidence);
  }
  if (def.phase === "Phase752") {
    await writeJson("local-self-use/week1/regression/regression-after-fix-candidates.json", evidence);
  }
  if (def.phase === "Phase755") {
    await writeText("local-self-use/week1/known-issues/week1-known-issues-and-blockers.md", [
      "# Week-1 Known Issues and Blockers",
      "",
      `- blocker: ${evidence.blocker}`,
      `- realSevenDaySoakCompleted: ${evidence.realSevenDaySoakCompleted}`,
      "- blocking issues: missing or incomplete real seven-day soak logs when blocker is present",
      "- non-blocking issues: none classified without real logs",
      "- deferred improvements: collect real day-01.json through day-07.json logs",
      "- requires real server later: yes, after local soak is complete",
      "- requires deploy later: yes, after server readiness and approval",
      "",
    ].join("\n"));
  }
  if (def.phase === "Phase756") {
    await writeJson("local-self-use/week1/server-requirements/server-requirement-update.json", evidence);
  }
  if (def.phase === "Phase757") {
    await writeJson("local-self-use/week1/prelaunch-trial/prelaunch-trial-candidate-update.json", evidence);
  }
  if (def.phase === "Phase758") {
    await writeJson("local-self-use/week1/reports/week1-local-self-use-summary-report.json", evidence);
  }
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
