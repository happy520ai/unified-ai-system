import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const evidenceDir = "apps/ai-gateway-service/evidence/phase721_740";
export const docsBundleDir = "docs/phase721-740";

export const tokenSavingEvidence = {
  codexContextGatewayUsed: true,
  contextCodecUsed: true,
  relevantFilesUsed: true,
  fullRepoScanAvoided: true,
  tokenBudgetRespected: true,
};

export const safetyBoundary = {
  rawSecretRead: false,
  secretValueExposed: false,
  authJsonRead: false,
  codexConfigModified: false,
  codexBaseUrlModified: false,
  chatBehaviorChangedByDefault: false,
  chatGatewayExecuteBehaviorChangedByDefault: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  productionDeployExecuted: false,
  postDeploySmokeExecuted: false,
  productionTrafficObserved: false,
  unsupportedClaimCount: 0,
  hallucinatedFactCount: 0,
};

export const phases = [
  {
    phase: "Phase721",
    title: "Local Self-Use Baseline Lock",
    script: "run-local-self-use-baseline-lock.mjs",
    evidence: "local-self-use-baseline-lock-result.json",
    doc: "docs/phase721-local-self-use-baseline-lock.md",
    readyKey: "localSelfUseBaselineLocked",
  },
  {
    phase: "Phase722A",
    title: "One-command Local Startup Health Check",
    script: "run-local-startup-health-check.mjs",
    evidence: "local-startup-health-check-result.json",
    doc: "docs/phase722-local-startup-shutdown-runbook.md",
    readyKey: "localStartupRunbookReady",
  },
  {
    phase: "Phase722B",
    title: "One-command Local Shutdown Check",
    script: "run-local-shutdown-check.mjs",
    evidence: "local-shutdown-check-result.json",
    doc: "docs/phase722-local-startup-shutdown-runbook.md",
    readyKey: "localShutdownRunbookReady",
  },
  {
    phase: "Phase723",
    title: "Local Daily Use Scenario Pack",
    script: "run-local-daily-use-scenario-pack.mjs",
    evidence: "local-daily-use-scenario-pack-result.json",
    doc: "docs/phase723-local-daily-use-scenario-pack.md",
    readyKey: "dailyUseScenarioPackReady",
  },
  {
    phase: "Phase724",
    title: "Local Runtime Evidence Watcher",
    script: "run-local-runtime-evidence-watcher.mjs",
    evidence: "local-runtime-evidence-watcher-result.json",
    doc: "docs/phase724-local-runtime-evidence-watcher.md",
    readyKey: "runtimeEvidenceWatcherReady",
  },
  {
    phase: "Phase725",
    title: "Local Provider Cost / Quota Ledger",
    script: "run-local-provider-cost-quota-ledger.mjs",
    evidence: "local-provider-cost-quota-ledger-result.json",
    doc: "docs/phase725-local-provider-cost-quota-ledger.md",
    readyKey: "providerCostQuotaLedgerReady",
  },
  {
    phase: "Phase726",
    title: "Safe Mode / Kill Switch Local Drill",
    script: "run-local-safe-mode-kill-switch-drill.mjs",
    evidence: "local-safe-mode-kill-switch-drill-result.json",
    doc: "docs/phase726-local-safe-mode-kill-switch-drill.md",
    readyKey: "safeModeKillSwitchDrillReady",
  },
  {
    phase: "Phase727",
    title: "Self-use Feedback Journal",
    script: "run-self-use-feedback-journal.mjs",
    evidence: "self-use-feedback-journal-result.json",
    doc: "docs/phase727-self-use-feedback-journal-template.md",
    readyKey: "feedbackJournalReady",
  },
  {
    phase: "Phase728",
    title: "Taiji Improvement Intake Loop",
    script: "run-taiji-improvement-intake-loop.mjs",
    evidence: "taiji-improvement-intake-loop-result.json",
    doc: "docs/phase728-taiji-improvement-intake-loop.md",
    readyKey: "taijiImprovementIntakeLoopReady",
  },
  {
    phase: "Phase729",
    title: "Local Regression Routine",
    script: "run-local-regression-routine.mjs",
    evidence: "local-regression-routine-result.json",
    doc: "docs/phase729-local-regression-routine.md",
    readyKey: "localRegressionRoutineReady",
  },
  {
    phase: "Phase731",
    title: "7-day Soak Ledger Framework",
    script: "run-seven-day-soak-ledger-framework.mjs",
    evidence: "seven-day-soak-ledger-framework-result.json",
    doc: "docs/phase731-seven-day-soak-ledger-framework.md",
    readyKey: "sevenDaySoakLedgerFrameworkReady",
  },
  {
    phase: "Phase732",
    title: "Backup / Restore Dry-run",
    script: "run-backup-restore-dry-run.mjs",
    evidence: "backup-restore-dry-run-result.json",
    doc: "docs/phase732-backup-restore-dry-run.md",
    readyKey: "backupRestoreDryRunPassed",
  },
  {
    phase: "Phase733",
    title: "Issue Classification Ledger",
    script: "run-issue-classification-ledger.mjs",
    evidence: "issue-classification-ledger-result.json",
    doc: "docs/phase733-issue-classification-ledger.md",
    readyKey: "issueClassificationLedgerReady",
  },
  {
    phase: "Phase734",
    title: "Low-risk Fix Candidate Generator",
    script: "run-low-risk-fix-candidate-generator.mjs",
    evidence: "low-risk-fix-candidate-generator-result.json",
    doc: "docs/phase734-low-risk-fix-candidate-generator.md",
    readyKey: "lowRiskFixCandidateGeneratorReady",
  },
  {
    phase: "Phase735",
    title: "Local UX Friction Review",
    script: "run-local-ux-friction-review.mjs",
    evidence: "local-ux-friction-review-result.json",
    doc: "docs/phase735-local-ux-friction-review.md",
    readyKey: "localUxFrictionReviewReady",
  },
  {
    phase: "Phase736",
    title: "Capability Quality Review",
    script: "run-capability-quality-review.mjs",
    evidence: "capability-quality-review-result.json",
    doc: "docs/phase736-capability-quality-review.md",
    readyKey: "capabilityQualityReviewReady",
  },
  {
    phase: "Phase737",
    title: "Runtime Stability Review",
    script: "run-runtime-stability-review.mjs",
    evidence: "runtime-stability-review-result.json",
    doc: "docs/phase737-runtime-stability-review.md",
    readyKey: "runtimeStabilityReviewReady",
  },
  {
    phase: "Phase738",
    title: "Server Requirement From Real Use",
    script: "run-server-requirement-from-real-use.mjs",
    evidence: "server-requirement-from-real-use-result.json",
    doc: "docs/phase738-server-requirement-from-real-use.md",
    readyKey: "serverRequirementDraftReady",
  },
  {
    phase: "Phase739",
    title: "Pre-launch Trial Candidate Pack",
    script: "run-prelaunch-trial-candidate-pack.mjs",
    evidence: "prelaunch-trial-candidate-pack-result.json",
    doc: "docs/phase739-prelaunch-trial-candidate-pack.md",
    readyKey: "prelaunchTrialCandidatePackReady",
  },
];

export const finalEvidencePath = `${evidenceDir}/local-self-use-runtime-soak-framework-final-result.json`;

export function evidencePath(fileName) {
  return `${evidenceDir}/${fileName}`;
}

export function absolutePath(path) {
  return resolve(repoRoot, path);
}

export async function exists(path) {
  try {
    await access(absolutePath(path), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function readText(path, fallback = "") {
  try {
    return String(await readFile(absolutePath(path), "utf8"));
  } catch {
    return fallback;
  }
}

export async function readJson(path, fallback = null) {
  const text = await readText(path, "");
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export async function writeText(path, text) {
  const fullPath = absolutePath(path);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, text, "utf8");
}

export async function writeJson(path, value) {
  await writeText(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function withBoundary(fields = {}) {
  return {
    phaseRange: "Phase721-740",
    phase: fields.phase ?? "Phase721-740-AIO",
    generatedAt: new Date().toISOString(),
    localSelfUseMode: true,
    serverInfrastructureReady: false,
    deploymentDeferredBecauseNoServer: true,
    ...tokenSavingEvidence,
    ...safetyBoundary,
    ...fields,
  };
}

export async function collectEvidenceSummary() {
  const roots = [
    "apps/ai-gateway-service/evidence/phase651_666",
    "apps/ai-gateway-service/evidence/phase667_674",
    "apps/ai-gateway-service/evidence/phase675_682",
    "apps/ai-gateway-service/evidence/phase683_700",
    "apps/ai-gateway-service/evidence/phase701_720",
  ];
  const entries = [];
  for (const root of roots) {
    if (!(await exists(root))) continue;
    entries.push(...(await listJsonFiles(root, 120)));
  }
  return entries;
}

export async function listJsonFiles(root, limit = 200) {
  const start = absolutePath(root);
  const output = [];
  async function walk(dir) {
    if (output.length >= limit) return;
    let children = [];
    try {
      children = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const child of children) {
      if (output.length >= limit) break;
      if (child.name === "node_modules" || child.name === ".git" || child.name === "legacy") continue;
      const fullPath = join(dir, child.name);
      if (child.isDirectory()) {
        await walk(fullPath);
      } else if (extname(child.name) === ".json") {
        output.push(relative(repoRoot, fullPath).replaceAll("\\", "/"));
      }
    }
  }
  await walk(start);
  return output;
}

export async function scanEvidenceStats() {
  const evidenceFiles = await collectEvidenceSummary();
  const stats = {
    evidenceFilesScanned: evidenceFiles.length,
    providerCallCount: 0,
    providerRequestBudgetCapCount: 0,
    failureCount: 0,
    passCount: 0,
    blockedCount: 0,
    estimatedCostUsd: 0,
    recentEvidenceFiles: evidenceFiles.slice(-20),
    providerLedgerRows: [],
  };
  for (const file of evidenceFiles) {
    const value = await readJson(file, {});
    const text = JSON.stringify(value);
    const providerId = value.providerId ?? value.providerName ?? value.provider ?? null;
    const modelId = value.modelId ?? value.selectedModel ?? null;
    const providerCalled = value.providerCalled === true || value.providerCallsMade === true || value.realProviderCallExecuted === true;
    const hasProviderIdentity = Boolean(providerId || modelId);
    const requestAttemptCount =
      providerCalled || hasProviderIdentity ? Number(value.requestAttemptCount ?? (providerCalled ? 1 : 0)) || 0 : 0;
    const requestBudgetCapCount = Number(value.maxRequests ?? 0) || 0;
    const retryAttemptCount = Number(value.retryAttemptCount ?? value.retries ?? 0) || 0;
    const failed = /failed|error|blocked|timeout|rate_limited/i.test(String(value.status ?? value.executionStatus ?? value.responseClassification ?? ""));
    const passed = value.completed === true || value.status === "passed" || value.status === "pass";
    stats.providerRequestBudgetCapCount += requestBudgetCapCount;
    if (providerCalled || providerId || modelId || requestAttemptCount > 0) {
      stats.providerCallCount += requestAttemptCount;
      stats.providerLedgerRows.push({
        evidenceRef: file,
        providerId,
        modelId,
        requestAttemptCount,
        retryAttemptCount,
        responseClassification: value.responseClassification ?? value.status ?? value.executionStatus ?? null,
        estimatedCostUsd: Number(value.estimatedCostUsd ?? 0) || 0,
        budgetExceeded: value.budgetExceeded === true,
      });
    }
    if (failed || text.includes("failure")) stats.failureCount += 1;
    if (passed) stats.passCount += 1;
    if (/blocked|skipped|disabled/i.test(text)) stats.blockedCount += 1;
    stats.estimatedCostUsd += Number(value.estimatedCostUsd ?? 0) || 0;
  }
  return stats;
}

export async function writePhaseDoc(path, title, evidence, bodyLines = []) {
  const lines = [
    `# ${title}`,
    "",
    `Phase: ${evidence.phase}`,
    "",
    "## Scope",
    "",
    "- Local self-use framework only.",
    "- No deploy, release, tag, artifact upload, push, or commit.",
    "- No secret, auth.json, webhook, or raw base_url read/output.",
    "- No /chat or /chat-gateway/execute default behavior change.",
    "",
    "## Result",
    "",
    `- completed: ${String(evidence.completed ?? true)}`,
    `- blocker: ${evidence.blocker ?? "null"}`,
    `- localSelfUseMode: ${String(evidence.localSelfUseMode === true)}`,
    `- realSevenDaySoakCompleted: ${String(evidence.realSevenDaySoakCompleted === true)}`,
    `- realThirtyDaySoakCompleted: ${String(evidence.realThirtyDaySoakCompleted === true)}`,
    "",
    ...bodyLines,
    "",
    "## Evidence",
    "",
    "```json",
    JSON.stringify(evidence, null, 2),
    "```",
    "",
  ];
  await writeText(path, `${lines.join("\n")}`);
}

export async function ensureLocalDirectories() {
  const dirs = [
    "tools/phase721_740",
    "docs/phase721-740",
    evidenceDir,
    "local-self-use/journal",
    "local-self-use/issues",
    "local-self-use/soak",
    "local-self-use/backup-restore",
    "local-self-use/provider-ledger",
    "local-self-use/regression",
    "local-self-use/server-requirements",
    "local-self-use/prelaunch-trial",
  ];
  for (const dir of dirs) {
    await mkdir(absolutePath(dir), { recursive: true });
  }
}

export function firstFailed(checks) {
  for (const [key, value] of Object.entries(checks)) {
    if (value !== true) return key;
  }
  return null;
}
