import { access, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const phaseRange = "Phase1451-1475-AIO";
export const title = "Real Local Dogfooding Intake + Issue Repair Closure";

export const upstreamResultPath = resolve(
  repoRoot,
  "apps/ai-gateway-service/evidence/phase1306-1450-taiji-beidou-local-dogfooding-mainline/taiji-beidou-local-dogfooding-mainline-result.json",
);
export const evidenceDir = resolve(
  repoRoot,
  "apps/ai-gateway-service/evidence/phase1451-1475-real-local-dogfooding-intake",
);
export const resultPath = resolve(evidenceDir, "real-local-dogfooding-intake-result.json");
export const validationPath = resolve(evidenceDir, "real-local-dogfooding-intake-validation-result.json");
export const closurePath = resolve(evidenceDir, "real-local-dogfooding-intake-evidence-closure.json");
export const reportPath = resolve(repoRoot, "docs/phase1451-1475-real-local-dogfooding-intake-report.md");
export const dogfoodingFrameworkDir = resolve(repoRoot, "docs/dogfooding/phase1426-1450");
export const dogfoodingDir = resolve(repoRoot, "docs/dogfooding/phase1451-1475");
export const dailyLedgerDir = resolve(dogfoodingDir, "daily-usage-ledger");
export const weeklyLedgerDir = resolve(dogfoodingDir, "weekly-review-ledger");
export const ownerFeedbackDir = resolve(dogfoodingDir, "owner-feedback");
export const issueLedgerPath = resolve(dogfoodingDir, "issue-ledger.json");
export const repairLedgerPath = resolve(dogfoodingDir, "repair-ledger.json");
export const knownLimitsPath = resolve(dogfoodingDir, "known-limits.md");
export const oneMonthReviewGatePath = resolve(dogfoodingDir, "one-month-review-gate.md");
export const twoMonthReviewGatePath = resolve(dogfoodingDir, "two-month-review-gate.md");

export const requiredFrameworkFiles = [
  "local-dogfooding-plan.md",
  "daily-usage-ledger-template.json",
  "weekly-review-ledger-template.json",
  "owner-feedback-intake-form.md",
];

export const phaseDefinitions = [
  [1451, "Dogfooding Intake Preflight"],
  [1452, "Real Owner Daily Ledger Intake"],
  [1453, "Real Owner Weekly Review Intake"],
  [1454, "Owner Feedback Intake Classification"],
  [1455, "Issue Severity Classification"],
  [1456, "P0 Immediate Stop Policy"],
  [1457, "P1 Risk Review"],
  [1458, "P2/P3 Repair Plan"],
  [1459, "Low-risk Repair Execution"],
  [1460, "Post-repair Regression"],
  [1461, "Mission Control Dogfooding Status Update"],
  [1462, "Evidence Replay Dogfooding Linkage"],
  [1463, "Provider / Secret Boundary Recheck"],
  [1464, "Default Enable Safety Recheck"],
  [1465, "Rollback / Emergency Disable Recheck"],
  [1466, "Dogfooding Claimability Review"],
  [1467, "Daily / Weekly Ledger Quality Review"],
  [1468, "Repair Ledger Generation"],
  [1469, "Known Limits Update"],
  [1470, "One-month Review Gate Preparation"],
  [1471, "Two-month Review Gate Preparation"],
  [1472, "Launch Deferral Gate Recheck"],
  [1473, "Post-1475 Route Recommendation"],
  [1474, "Final Dogfooding Intake Evidence Closure"],
  [1475, "Real Local Dogfooding Intake + Issue Repair Closure"],
];

export const safetyBoundary = Object.freeze({
  providerCallsMade: false,
  secretRead: false,
  authJsonRead: false,
  rawCredentialRefRead: false,
  secretValueExposed: false,
  credentialRefBypassed: false,
  quotaBypassed: false,
  budgetBypassed: false,
  selectableGateBypassed: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  commitCreated: false,
  pushExecuted: false,
  workspaceCleanClaimed: false,
  legacyModified: false,
  projectContextModified: false,
  characterModuleRestored: false,
  productionReadyClaimed: false,
  publicLaunchClaimed: false,
  realSemanticValidationClaimed: false,
  realOwnerDogfoodingRecordsFabricated: false,
  codexSelfTestCountedAsOwnerFeedback: false,
});

export function phaseKey(phaseNumber) {
  return `Phase${phaseNumber}`;
}

export function buildPhaseStatuses(blocker = null) {
  const phases = {};
  for (const [phaseNumber, phaseTitle] of phaseDefinitions) {
    phases[phaseKey(phaseNumber)] = {
      phase: phaseKey(phaseNumber),
      title: phaseTitle,
      completed: true,
      recommended_sealed: true,
      blocker,
    };
  }
  return phases;
}

export function isOwnerDailyLedger(record) {
  return record
    && record.ownerRecorded === true
    && typeof record.date === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(record.date);
}

export function isOwnerWeeklyLedger(record) {
  return record
    && record.ownerReviewed === true
    && typeof record.weekStart === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(record.weekStart);
}

export async function listJsonFiles(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === ".json")
      .map((entry) => resolve(dir, entry.name))
      .sort();
  } catch {
    return [];
  }
}

export async function readOwnerFeedbackFiles(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && !/template|readme/i.test(entry.name) && [".json", ".md", ".txt"].includes(extname(entry.name).toLowerCase()))
      .map((entry) => resolve(dir, entry.name))
      .sort();
    const records = [];
    for (const file of files) {
      const text = await readTextIfExists(file, "");
      if (!text.trim()) continue;
      let parsed = null;
      if (extname(file).toLowerCase() === ".json") {
        parsed = await readJsonIfExists(file, null);
      }
      records.push({
        type: "real_owner_record",
        source: file,
        parsed,
        text,
      });
    }
    return records;
  } catch {
    return [];
  }
}

export function classifyFeedbackItem(text) {
  const value = String(text ?? "").toLowerCase();
  const categories = [];
  const rules = [
    ["credential_boundary", /credential|secret|api key|token|auth|\.env/],
    ["provider_boundary", /provider|quota|budget|paid|openai|claude|openrouter|mimo|nvidia/],
    ["routing_quality", /route|routing|model selection|intent|fallback/],
    ["mission_control_ux", /mission control|panel|status|button|label|ui|ux/],
    ["taiji_beidou_behavior", /taiji|beidou|god|tianshu/],
    ["evidence_replay", /evidence|ledger|replay|trace|record/],
    ["performance", /slow|latency|performance|timeout/],
    ["bug", /bug|error|fail|crash|broken|exception/],
    ["risk", /risk|unsafe|danger|bypass|deploy|release/],
    ["usability", /confusing|unclear|copy|wording|usability|friction/],
  ];
  for (const [category, pattern] of rules) {
    if (pattern.test(value)) categories.push(category);
  }
  return categories.length > 0 ? categories : ["usability"];
}

export function severityForIssue(issue) {
  const text = `${issue?.severity ?? ""} ${issue?.category ?? ""} ${issue?.title ?? ""} ${issue?.description ?? ""}`.toLowerCase();
  if (/\bp0\b|secret exposure|unsafe execution|provider bypass|deploy risk|default route break/.test(text)) return "P0";
  if (/\bp1\b|route boundary|rollback failure|no-flag regression/.test(text)) return "P1";
  if (/\bp2\b|ux|evidence visibility|confusing status|minor behavior mismatch/.test(text)) return "P2";
  return "P3";
}

export function countBySeverity(items) {
  const counts = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const item of items) {
    const severity = item.severity ?? severityForIssue(item);
    if (Object.hasOwn(counts, severity)) counts[severity] += 1;
  }
  return counts;
}

export async function pathExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function dirExists(path) {
  try {
    const info = await stat(path);
    return info.isDirectory();
  } catch {
    return false;
  }
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
  if (!text.trim()) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
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

export function findBlocker(checks) {
  for (const [key, passed] of Object.entries(checks)) {
    if (passed !== true) return key;
  }
  return null;
}
