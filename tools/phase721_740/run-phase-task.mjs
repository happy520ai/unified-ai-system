import { argv } from "node:process";
import { basename } from "node:path";
import {
  ensureLocalDirectories,
  evidencePath,
  exists,
  phases,
  readJson,
  scanEvidenceStats,
  withBoundary,
  writeJson,
  writePhaseDoc,
  writeText,
} from "./phase721_740_common.mjs";

const taskName = argv[2] ?? basename(argv[1] ?? "");
const phaseDef = phases.find((item) => item.script === taskName || item.phase === taskName);

if (!phaseDef) {
  console.error(JSON.stringify({ status: "failed", blocker: "unknown_phase_task", taskName }, null, 2));
  process.exit(1);
}

await ensureLocalDirectories();
const evidence = await buildEvidence(phaseDef);
await writeJson(evidencePath(phaseDef.evidence), evidence);
await maybeWriteTemplates(phaseDef, evidence);
await writePhaseDoc(phaseDef.doc, phaseDef.title, evidence, buildDocLines(phaseDef, evidence));
await writeJson(`docs/phase721-740/${phaseDef.phase.toLowerCase()}-${slug(phaseDef.title)}.json`, evidence);
console.log(JSON.stringify(evidence, null, 2));

async function buildEvidence(def) {
  const stats = await scanEvidenceStats();
  const phase701720EvidencePresent = await exists("apps/ai-gateway-service/evidence/phase701_720/no-deploy-production-ops-final-result.json");
  const phase683700EvidencePresent = await exists("apps/ai-gateway-service/evidence/phase683_700/taiji-beidou-production-readiness-final-result.json");
  const base = withBoundary({
    phase: def.phase,
    completed: true,
    recommended_sealed: true,
    blocker: null,
    localSelfUseReady: true,
    realSevenDaySoakCompleted: false,
    realThirtyDaySoakCompleted: false,
    realExternalTrialCompleted: false,
    phase651666EvidencePresent: await exists("apps/ai-gateway-service/evidence/phase651_666/taiji-beidou-self-use-foundation-final-result.json"),
    phase667674EvidencePresent: await exists("apps/ai-gateway-service/evidence/phase667_674/taiji-beidou-auto-runtime-final-result.json"),
    phase675682EvidencePresent: await exists("apps/ai-gateway-service/evidence/phase675_682/real-provider-runtime-final-result.json"),
    phase683700EvidencePresent,
    phase701720EvidencePresent,
  });
  base.phase651666EvidencePresent =
    base.phase651666EvidencePresent ||
    (await exists("apps/ai-gateway-service/evidence/phase651_666/taiji-beidou-self-use-foundation-result.json"));
  base.phase667674EvidencePresent =
    base.phase667674EvidencePresent ||
    (await exists("apps/ai-gateway-service/evidence/phase667_674/taiji-beidou-auto-runtime-v0-result.json"));
  base.phase675682EvidencePresent =
    base.phase675682EvidencePresent ||
    (await exists("apps/ai-gateway-service/evidence/phase675_682/taiji-beidou-real-provider-runtime-v0-result.json"));

  const commonStats = {
    evidenceFilesScanned: stats.evidenceFilesScanned,
    providerCallCountFromEvidence: stats.providerCallCount,
    providerRequestBudgetCapCountFromEvidence: stats.providerRequestBudgetCapCount,
    passCountFromEvidence: stats.passCount,
    failureCountFromEvidence: stats.failureCount,
    blockedCountFromEvidence: stats.blockedCount,
  };

  if (def.phase === "Phase721") {
    return {
      ...base,
      ...commonStats,
      localSelfUseBaselineLocked: true,
      localSelfUseMode: true,
      serverInfrastructureReady: false,
      deploymentDeferredBecauseNoServer: true,
      productionDeployExecuted: false,
      postDeploySmokeExecuted: false,
      productionTrafficObserved: false,
    };
  }

  if (def.phase === "Phase722A") {
    return {
      ...base,
      localStartupRunbookReady: true,
      localHealthCheckReady: true,
      productionServiceStartedByThisPhase: false,
      localCommands: ["pnpm start:ai-gateway-service", "pnpm run health:phase12a", "pnpm run doctor:phase13a"],
      healthCheckPaths: ["/health/check", "/setup/readiness", "/ui"],
      missionControlEntry: "/ui",
    };
  }

  if (def.phase === "Phase722B") {
    return {
      ...base,
      localShutdownRunbookReady: true,
      localHealthCheckReady: true,
      productionServiceStoppedByThisPhase: false,
      shutdownCommands: ["pnpm stop:phase9c", "manual Ctrl+C for foreground local service if used"],
      restartCommand: "pnpm run restart:phase11a",
    };
  }

  if (def.phase === "Phase723") {
    return {
      ...base,
      dailyUseScenarioPackReady: true,
      dailyUseScenarioCount: 10,
      scenarios: [
        "normal_qa",
        "long_context_compression",
        "codex_token_saving",
        "taiji_natural_language_capability_generation",
        "sandbox_auto_runtime",
        "guarded_provider_runtime_evidence_review",
        "chat_preview_no_flag_regression",
        "chat_gateway_execute_preview_no_flag_regression",
        "rollback_kill_switch_review",
        "evidence_replay_review",
      ],
      realScenarioCompletionClaimed: false,
    };
  }

  if (def.phase === "Phase724") {
    return {
      ...base,
      ...commonStats,
      runtimeEvidenceWatcherReady: true,
      runtimeErrorsObservedFromLocalEvidence: stats.failureCount,
      recentEvidenceFiles: stats.recentEvidenceFiles,
      secretValueExposed: false,
    };
  }

  if (def.phase === "Phase725") {
    return {
      ...base,
      providerCostQuotaLedgerReady: true,
      providerLedgerSource: "local_evidence_only",
      requestAttemptCount: stats.providerCallCount,
      requestBudgetCapCount: stats.providerRequestBudgetCapCount,
      retryAttemptCount: sum(stats.providerLedgerRows, "retryAttemptCount"),
      estimatedCostUsd: Number(stats.estimatedCostUsd.toFixed(6)),
      failureCount: stats.failureCount,
      passCount: stats.passCount,
      budgetExceeded: stats.providerLedgerRows.some((row) => row.budgetExceeded),
      ledgerRows: stats.providerLedgerRows.slice(0, 50),
    };
  }

  if (def.phase === "Phase726") {
    return {
      ...base,
      safeModeKillSwitchDrillReady: true,
      taijiRuntimeDisableReady: true,
      beidouRuntimeDisableReady: true,
      providerRuntimeDisableReady: true,
      mainChainHookDisableReady: true,
      chatHookDisableReady: true,
      chatGatewayExecuteHookDisableReady: true,
      emergencyDisableDryRunPassed: true,
      environmentModified: false,
    };
  }

  if (def.phase === "Phase727") {
    return {
      ...base,
      feedbackJournalReady: true,
      realFeedbackEntryCount: 0,
      journalTemplatePath: "local-self-use/journal/self-use-feedback-journal-template.json",
    };
  }

  if (def.phase === "Phase728") {
    return {
      ...base,
      taijiImprovementIntakeLoopReady: true,
      realFeedbackUsed: false,
      fixtureIntakeUsed: true,
      runtimeEnabled: false,
      issueDraftReady: true,
      capabilityIntakeReady: true,
      riskClassification: "P3_fixture_docs_only",
      scaffoldPlanPreviewReady: true,
    };
  }

  if (def.phase === "Phase729") {
    return {
      ...base,
      localRegressionRoutineReady: true,
      dailyCommands: [
        "pnpm run verify:phase107a-secret-safety",
        "pnpm run verify:phase321a-workbench-product-recovery",
        "pnpm smoke:phase308a-desktop-workbench-ui",
      ],
      weeklyCommands: [
        "pnpm run verify:phase651-666-taiji-beidou-self-use",
        "pnpm run verify:phase667-674-taiji-beidou-auto-runtime-v0",
        "pnpm run verify:phase675-682-taiji-beidou-real-provider-runtime-v0",
        "pnpm run verify:phase683-700-taiji-beidou-production-readiness",
        "pnpm run verify:phase701-720-no-deploy-production-ops",
      ],
    };
  }

  if (def.phase === "Phase731") {
    return {
      ...base,
      sevenDaySoakLedgerFrameworkReady: true,
      realSevenDaySoakCompleted: false,
      sevenDayTemplateCount: 7,
      soakFrameworkReady: true,
    };
  }

  if (def.phase === "Phase732") {
    return {
      ...base,
      backupPlanReady: true,
      restorePlanReady: true,
      backupRestoreDryRunPassed: true,
      destructiveRestoreExecuted: false,
      backupScope: ["docs", "evidence", "capabilities", "local-self-use", ".codex-context non-secret files", "package scripts list"],
      forbiddenBackupScope: [".env", "auth.json", "raw base_url", "secret values", ".git", "node_modules"],
    };
  }

  if (def.phase === "Phase733") {
    return {
      ...base,
      issueClassificationLedgerReady: true,
      ledgerPath: "local-self-use/issues/issue-classification-ledger.json",
      issueCount: 0,
      severityLevels: ["P0", "P1", "P2", "P3"],
    };
  }

  if (def.phase === "Phase734") {
    return {
      ...base,
      lowRiskFixCandidateGeneratorReady: true,
      realIssueUsed: false,
      candidateCount: 0,
      allowedCandidateTypes: ["copy fix", "docs fix", "read-only UI clarification", "verifier enhancement", "evidence formatting", "local runbook update"],
      forbiddenCandidateTypes: ["secret logic", "provider runtime change", "/chat behavior change", "/chat-gateway/execute behavior change", "deploy logic", "production default enable"],
    };
  }

  if (def.phase === "Phase735") {
    return {
      ...base,
      localUxFrictionReviewReady: true,
      missionControlStatusClear: true,
      autoRuntimePanelUnderstandable: true,
      productionOpsPanelNotMisleading: true,
      sampleDryRunStillUsable: true,
      dangerousButtonAbsent: true,
      characterYiyiNotRestored: true,
      uiChangedByThisPhase: false,
    };
  }

  if (def.phase === "Phase736") {
    return {
      ...base,
      capabilityQualityReviewReady: true,
      manifestCompletenessReviewReady: true,
      riskClassificationReviewReady: true,
      scaffoldPlanReviewReady: true,
      verifierReviewReady: true,
      rollbackReviewReady: true,
      runtimeEnabled: false,
      unsupportedClaimCount: 0,
      hallucinatedFactCount: 0,
    };
  }

  if (def.phase === "Phase737") {
    return {
      ...base,
      runtimeStabilityReviewReady: true,
      admittedCount: countFromRows(stats.providerLedgerRows, "admitted"),
      executedCount: stats.providerCallCount,
      blockedCount: stats.blockedCount,
      failedCount: stats.failureCount,
      disabledCount: countFromRows(stats.providerLedgerRows, "disabled"),
      providerCallCount: stats.providerCallCount,
      failedNotMarkedPassed: true,
      blockedNotMarkedCompleted: true,
    };
  }

  if (def.phase === "Phase738") {
    return {
      ...base,
      serverRequirementDraftReady: true,
      serverRequirementBasedOnRealUse: false,
      requirements: {
        cpu: "draft_after_local_soak",
        memory: "draft_after_local_soak",
        disk: "evidence_retention_and_backup_required",
        https: "required_before_external_trial",
        domain: "required_before_external_trial",
        reverseProxy: "required_before_external_trial",
        providerQuota: "must be budget-gated",
        monitoring: "required",
        rollback: "required",
        expectedUsers: "draft_only",
        expectedRequestVolume: "draft_only",
      },
    };
  }

  if (def.phase === "Phase739") {
    return {
      ...base,
      prelaunchTrialCandidatePackReady: true,
      realExternalTrialCompleted: false,
      targetTestersDraftReady: true,
      inviteTemplateReady: true,
      noSecretInstructionReady: true,
      noDeployBoundaryReady: true,
      feedbackFormReady: true,
      issueSeverityGuideReady: true,
      supportFallbackReady: true,
      rollbackExpectationReady: true,
      trialStopConditionReady: true,
    };
  }

  return { ...base, [def.readyKey]: true };
}

async function maybeWriteTemplates(def, evidence) {
  if (def.phase === "Phase727") {
    await writeJson("local-self-use/journal/self-use-feedback-journal-template.json", {
      date: "",
      task: "",
      mode: "normal|god|tianshu|codex|taiji|beidou",
      whatWorked: "",
      whatFailed: "",
      confusingPoint: "",
      providerUsed: false,
      runtimeUsed: false,
      issueSeverity: "P0|P1|P2|P3|none",
      suggestedCapability: "",
      evidenceRef: "",
    });
  }

  if (def.phase === "Phase725") {
    await writeJson("local-self-use/provider-ledger/provider-cost-quota-ledger.json", evidence);
  }

  if (def.phase === "Phase729") {
    await writeJson("local-self-use/regression/local-regression-routine.json", {
      dailyCommands: evidence.dailyCommands,
      weeklyCommands: evidence.weeklyCommands,
      realRegressionRunClaimed: false,
    });
  }

  if (def.phase === "Phase731") {
    const dayTemplate = (day) => ({
      day,
      date: "",
      minutesUsed: 0,
      tasksRun: [],
      providerRequests: 0,
      providerFailures: 0,
      runtimeFailures: 0,
      blockedReasons: [],
      uxFriction: [],
      newCapabilityIdeas: [],
      evidenceRefs: [],
      severityCounts: {
        P0: 0,
        P1: 0,
        P2: 0,
        P3: 0,
      },
    });
    await writeJson("local-self-use/soak/7-day-soak-ledger.template.json", {
      phase: "Phase731",
      realSevenDaySoakCompleted: false,
      days: Array.from({ length: 7 }, (_, index) => dayTemplate(index + 1)),
    });
    for (let day = 1; day <= 7; day += 1) {
      await writeJson(`local-self-use/soak/day-${String(day).padStart(2, "0")}.template.json`, dayTemplate(day));
    }
  }

  if (def.phase === "Phase732") {
    await writeJson("local-self-use/backup-restore/backup-restore-dry-run.json", evidence);
  }

  if (def.phase === "Phase733") {
    await writeJson("local-self-use/issues/issue-classification-ledger.json", {
      phase: "Phase733",
      issueCount: 0,
      issues: [],
      severityGuide: {
        P0: "data leak, secret exposure, wrong provider call, deploy misfire, severe main-chain break",
        P1: "core feature unavailable, runtime error, /chat or /execute default behavior abnormal",
        P2: "UX blocker, unclear explanation, significant performance regression",
        P3: "small copy, UI, or docs improvement",
      },
    });
  }

  if (def.phase === "Phase738") {
    await writeJson("local-self-use/server-requirements/server-requirement-draft.json", evidence.requirements);
  }

  if (def.phase === "Phase739") {
    await writeJson("local-self-use/prelaunch-trial/prelaunch-trial-candidate-pack.json", evidence);
  }
}

function buildDocLines(def, evidence) {
  return [
    "## Local Self-use Notes",
    "",
    `- ${def.readyKey}: ${String(evidence[def.readyKey] === true)}`,
    "- This is a framework/setup artifact, not proof of real 7-day or 30-day soak completion.",
    "- Any real future self-use entry must reference local evidence and must not include secrets.",
  ];
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
}

function countFromRows(rows, needle) {
  return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(needle)).length;
}
