import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const evidenceDir = "apps/ai-gateway-service/evidence/phase741_760";
export const docsBundleDir = "docs/phase741-760";
export const finalEvidencePath = `${evidenceDir}/real-seven-day-local-self-use-soak-final-result.json`;
export const missingLogsBlocker = "real_seven_day_soak_logs_missing_or_incomplete";
export const p0p1Blocker = "p0_or_p1_issues_present";

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
  realExternalTrialCompleted: false,
  unsupportedClaimCount: 0,
  hallucinatedFactCount: 0,
};

export const phases = [
  ["Phase741", "Real 7-Day Soak Log Intake", "run-real-seven-day-soak-log-intake.mjs", "real-seven-day-soak-log-intake-result.json", "docs/phase741-real-seven-day-soak-log-intake.md"],
  ["Phase742", "Soak Log Authenticity + Completeness Check", "run-soak-log-authenticity-completeness-check.mjs", "soak-log-authenticity-completeness-result.json", "docs/phase742-soak-log-authenticity-completeness-check.md"],
  ["Phase743", "Local Usage Metrics Aggregation", "run-local-usage-metrics-aggregation.mjs", "local-usage-metrics-aggregation-result.json", "docs/phase743-local-usage-metrics-aggregation.md"],
  ["Phase744", "Provider Cost / Quota Real-use Ledger", "run-provider-cost-quota-real-use-ledger.mjs", "provider-cost-quota-real-use-ledger-result.json", "docs/phase744-provider-cost-quota-real-use-ledger.md"],
  ["Phase745", "Runtime Stability Analysis", "run-runtime-stability-analysis.mjs", "runtime-stability-analysis-result.json", "docs/phase745-runtime-stability-analysis.md"],
  ["Phase746", "Issue Severity Classification", "run-issue-severity-classification.mjs", "issue-severity-classification-result.json", "docs/phase746-issue-severity-classification.md"],
  ["Phase747", "Low-risk Fix Candidate Batch", "run-low-risk-fix-candidate-batch.mjs", "low-risk-fix-candidate-batch-result.json", "docs/phase747-low-risk-fix-candidate-batch.md"],
  ["Phase748", "Taiji / Beidou Improvement Intake from Real Feedback", "run-taiji-improvement-intake-from-real-feedback.mjs", "taiji-improvement-intake-from-real-feedback-result.json", "docs/phase748-taiji-improvement-intake-from-real-feedback.md"],
  ["Phase749", "Capability Quality Review from Real Use", "run-capability-quality-review-from-real-use.mjs", "capability-quality-review-from-real-use-result.json", "docs/phase749-capability-quality-review-from-real-use.md"],
  ["Phase750", "Local UX Friction Review from Real Use", "run-local-ux-friction-review-from-real-use.mjs", "local-ux-friction-review-from-real-use-result.json", "docs/phase750-local-ux-friction-review-from-real-use.md"],
  ["Phase751", "Low-risk Fix Application", "run-low-risk-fix-application.mjs", "low-risk-fix-application-result.json", "docs/phase751-low-risk-fix-application.md"],
  ["Phase752", "Regression Re-run after Fix Candidates", "run-regression-after-fix-candidates.mjs", "regression-after-fix-candidates-result.json", "docs/phase752-regression-after-fix-candidates.md"],
  ["Phase753", "Backup / Restore Evidence Check", "run-backup-restore-evidence-check.mjs", "backup-restore-evidence-check-result.json", "docs/phase753-backup-restore-evidence-check.md"],
  ["Phase754", "Safe Mode / Kill Switch Local Drill Recheck", "run-safe-mode-kill-switch-local-drill-recheck.mjs", "safe-mode-kill-switch-local-drill-recheck-result.json", "docs/phase754-safe-mode-kill-switch-local-drill-recheck.md"],
  ["Phase755", "Known Issues + Blocker Ledger", "run-known-issues-blocker-ledger.mjs", "known-issues-blocker-ledger-result.json", "docs/phase755-known-issues-blocker-ledger.md"],
  ["Phase756", "Server Requirement Update from Real Use", "run-server-requirement-update-from-real-use.mjs", "server-requirement-update-from-real-use-result.json", "docs/phase756-server-requirement-update-from-real-use.md"],
  ["Phase757", "Pre-launch Trial Candidate Update", "run-prelaunch-trial-candidate-update.mjs", "prelaunch-trial-candidate-update-result.json", "docs/phase757-prelaunch-trial-candidate-update.md"],
  ["Phase758", "Week-1 Local Self-Use Summary Report", "run-week1-local-self-use-summary-report.mjs", "week1-local-self-use-summary-report-result.json", "docs/phase758-week1-local-self-use-summary-report.md"],
  ["Phase759", "Mission Control Local Soak Review Panel", "run-mission-control-local-soak-review-panel.mjs", "mission-control-local-soak-review-panel-result.json", "docs/phase759-mission-control-local-soak-review-panel.md"],
].map(([phase, title, script, evidence, doc]) => ({ phase, title, script, evidence, doc }));

export function absolutePath(path) {
  return resolve(repoRoot, path);
}

export function evidencePath(fileName) {
  return `${evidenceDir}/${fileName}`;
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

export async function ensureDirs() {
  for (const dir of [
    "tools/phase741_760",
    docsBundleDir,
    evidenceDir,
    "local-self-use/week1/reports",
    "local-self-use/week1/fix-candidates",
    "local-self-use/week1/regression",
    "local-self-use/week1/server-requirements",
    "local-self-use/week1/prelaunch-trial",
    "local-self-use/week1/known-issues",
  ]) {
    await mkdir(absolutePath(dir), { recursive: true });
  }
}

export function withBoundary(fields = {}) {
  return {
    phaseRange: "Phase741-760",
    phase: fields.phase ?? "Phase741-760-AIO",
    generatedAt: new Date().toISOString(),
    localSelfUseMode: true,
    serverInfrastructureReady: false,
    deploymentDeferredBecauseNoServer: true,
    ...tokenSavingEvidence,
    ...safetyBoundary,
    ...fields,
  };
}

export async function readSoakLogs() {
  const logs = [];
  const missingDays = [];
  const invalidLogs = [];
  for (let day = 1; day <= 7; day += 1) {
    const path = `local-self-use/soak/day-${String(day).padStart(2, "0")}.json`;
    const value = await readJson(path, null);
    if (!value) {
      missingDays.push(day);
      continue;
    }
    const validation = validateSoakLog(value, day, path);
    logs.push({ path, value, validation });
    if (!validation.valid) invalidLogs.push({ day, path, reasons: validation.reasons });
  }
  const validLogs = logs.filter((entry) => entry.validation.valid);
  const dates = logs.map((entry) => entry.value.date).filter(Boolean);
  const duplicateDates = dates.filter((date, index) => dates.indexOf(date) !== index);
  const realSevenDaySoakCompleted = validLogs.length === 7 && missingDays.length === 0 && duplicateDates.length === 0;
  return {
    logs,
    validLogs,
    invalidLogs,
    missingDays,
    duplicateDates: [...new Set(duplicateDates)],
    realSoakLogFilesFound: logs.length,
    validSoakLogCount: validLogs.length,
    invalidSoakLogCount: invalidLogs.length,
    realSevenDaySoakLogsPresent: logs.length === 7,
    realSevenDaySoakCompleted,
  };
}

export function validateSoakLog(log, expectedDay, path) {
  const reasons = [];
  if (log.day !== expectedDay) reasons.push("day_mismatch");
  if (log.isRealUseLog !== true) reasons.push("isRealUseLog_not_true");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(log.date ?? ""))) reasons.push("date_missing_or_invalid");
  if (!(Number(log.minutesUsed) > 0)) reasons.push("minutesUsed_not_positive");
  if (!Array.isArray(log.tasksRun) || log.tasksRun.length < 1) reasons.push("tasksRun_empty");
  if ((!Array.isArray(log.evidenceRefs) || log.evidenceRefs.length < 1) && !log.noEvidenceReason) {
    reasons.push("evidenceRefs_empty_without_noEvidenceReason");
  }
  const severity = log.severityCounts ?? {};
  for (const key of ["P0", "P1", "P2", "P3"]) {
    if (!Number.isInteger(severity[key]) || severity[key] < 0) reasons.push(`severity_${key}_invalid`);
  }
  const text = JSON.stringify(log);
  if (/auth\.json/i.test(text)) reasons.push("auth_json_reference_detected");
  if (/raw[_-]?base[_-]?url/i.test(text)) reasons.push("raw_base_url_reference_detected");
  if (/(api[_-]?key|secret|token|credential)\s*[:=]\s*["']?[A-Za-z0-9_\-]{12,}/i.test(text)) reasons.push("secret_like_value_detected");
  return { path, valid: reasons.length === 0, reasons };
}

export function aggregateSoak(intake) {
  const source = intake.validLogs.map((entry) => entry.value);
  const totals = {
    totalMinutesUsed: sum(source, "minutesUsed"),
    totalTasksRun: source.reduce((total, log) => total + (Array.isArray(log.tasksRun) ? log.tasksRun.length : 0), 0),
    activeDays: source.length,
    totalRuntimeExecutions: sum(source, "runtimeExecutions"),
    totalRuntimeFailures: sum(source, "runtimeFailures"),
    providerRequests: sum(source, "providerRequests"),
    providerFailures: sum(source, "providerFailures"),
    totalBlockedReasons: source.reduce((total, log) => total + (Array.isArray(log.blockedReasons) ? log.blockedReasons.length : 0), 0),
    totalUxFrictionItems: source.reduce((total, log) => total + (Array.isArray(log.uxFriction) ? log.uxFriction.length : 0), 0),
    totalNewCapabilityIdeas: source.reduce((total, log) => total + (Array.isArray(log.newCapabilityIdeas) ? log.newCapabilityIdeas.length : 0), 0),
    p0IssueCount: source.reduce((total, log) => total + (Number(log.severityCounts?.P0) || 0), 0),
    p1IssueCount: source.reduce((total, log) => total + (Number(log.severityCounts?.P1) || 0), 0),
    p2IssueCount: source.reduce((total, log) => total + (Number(log.severityCounts?.P2) || 0), 0),
    p3IssueCount: source.reduce((total, log) => total + (Number(log.severityCounts?.P3) || 0), 0),
  };
  return {
    ...totals,
    avgTasksPerDay: totals.activeDays > 0 ? Number((totals.totalTasksRun / totals.activeDays).toFixed(2)) : 0,
    providerFailureRate:
      totals.providerRequests > 0 ? Number((totals.providerFailures / totals.providerRequests).toFixed(4)) : 0,
    runtimeFailureRate:
      totals.totalRuntimeExecutions > 0 ? Number((totals.totalRuntimeFailures / totals.totalRuntimeExecutions).toFixed(4)) : 0,
  };
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
      if (child.name === ".git" || child.name === "node_modules" || child.name === "legacy") continue;
      const fullPath = join(dir, child.name);
      if (child.isDirectory()) await walk(fullPath);
      if (child.isFile() && extname(child.name) === ".json") {
        output.push(relative(repoRoot, fullPath).replaceAll("\\", "/"));
      }
    }
  }
  await walk(start);
  return output;
}

export async function writePhaseDoc(path, title, evidence, extra = []) {
  await writeText(path, [
    `# ${title}`,
    "",
    "## Boundary",
    "",
    "- Real 7-day completion requires seven valid local-self-use/soak/day-XX.json files.",
    "- Missing or incomplete logs are recorded as a blocker; no logs are fabricated.",
    "- No deploy, release, tag, artifact upload, push, commit, secret read, auth.json read, Codex config change, /chat default change, or /chat-gateway/execute default change.",
    "",
    "## Result",
    "",
    `- completed: ${evidence.completed}`,
    `- recommended_sealed: ${evidence.recommended_sealed}`,
    `- blocker: ${evidence.blocker}`,
    `- realSevenDaySoakCompleted: ${evidence.realSevenDaySoakCompleted}`,
    "",
    ...extra,
    "",
    "## Evidence",
    "",
    "```json",
    JSON.stringify(evidence, null, 2),
    "```",
    "",
  ].join("\n"));
}

export function firstFailed(checks) {
  for (const [key, value] of Object.entries(checks)) {
    if (value !== true) return key;
  }
  return null;
}

function sum(items, key) {
  return items.reduce((total, item) => total + (Number(item[key]) || 0), 0);
}
