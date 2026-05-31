import { existsSync, readdirSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const safetyFalseKeys = [
  "providerCallsMade",
  "nonNvidiaProviderCallsMade",
  "secretValueExposed",
  "rawSecretAccessed",
  "deployExecuted",
  "releaseExecuted",
  "tagCreated",
  "artifactUploaded",
  "evidenceModified",
  "approvalForged",
  "billingExecuted",
  "invoiceGenerated",
  "productionGaClaimed",
  "dangerousActionButtonDetected",
  "workspaceCleanClaimed",
];

export const phase383Safety = Object.fromEntries(safetyFalseKeys.map((key) => [key, false]));

export function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

export async function readJson(path) {
  return JSON.parse(await readFile(resolve(path), "utf8"));
}

export async function readText(path) {
  return readFile(resolve(path), "utf8");
}

export async function writeJson(path, value) {
  const target = resolve(path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeText(path, value) {
  const target = resolve(path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, value.endsWith("\n") ? value : `${value}\n`, "utf8");
}

export function listFiles(root) {
  const output = [];
  if (!existsSync(resolve(root))) return output;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else output.push(full);
    }
  };
  walk(resolve(root));
  return output;
}

export function extractPhaseNumber(value) {
  const match = String(value || "").match(/phase[-_ ]?(\d+)/i);
  return match ? Number(match[1]) : 0;
}

export function normalizePhaseResult(raw) {
  const safety = { ...(raw.safety || {}) };
  for (const key of safetyFalseKeys) {
    if (raw[key] !== undefined && safety[key] === undefined) safety[key] = raw[key];
  }
  if (safety.rawSecretAccessed === undefined) safety.rawSecretAccessed = false;
  if (safety.evidenceModified === undefined) safety.evidenceModified = false;
  const recommendedSealed = raw.recommended_sealed ?? raw.recommendedSealed ?? raw.recommended_sealed === true;
  const validationsPassed = raw.validationsPassed ?? raw.browserSmokePassed ?? raw.validationPassed ?? raw.completed ?? false;
  return {
    phase: raw.phase,
    title: raw.title || "",
    completed: raw.completed === true,
    recommended_sealed: recommendedSealed === true,
    blocker: raw.blocker ?? null,
    phaseType: raw.phaseType || "legacy_or_phase_specific",
    riskLevel: raw.riskLevel || "low",
    modifiedFiles: Array.isArray(raw.modifiedFiles) ? raw.modifiedFiles : [],
    createdFiles: Array.isArray(raw.createdFiles) ? raw.createdFiles : [],
    validationsRun: Array.isArray(raw.validationsRun) ? raw.validationsRun : [],
    validationsPassed: validationsPassed === true,
    safety,
    remainingRisks: Array.isArray(raw.remainingRisks) ? raw.remainingRisks : [],
    nextRecommendedPhases: Array.isArray(raw.nextRecommendedPhases) ? raw.nextRecommendedPhases : [],
    rollbackPlan: Array.isArray(raw.rollbackPlan) ? raw.rollbackPlan : [],
    raw,
  };
}

export function resultWarnings(normalized) {
  const warnings = [];
  if (!normalized.title) warnings.push("missing_title");
  if (!normalized.raw.recommended_sealed && normalized.raw.recommendedSealed !== undefined) warnings.push("used_legacy_recommendedSealed");
  if (!Array.isArray(normalized.raw.validationsRun)) warnings.push("missing_validationsRun");
  if (!normalized.raw.safety) warnings.push("used_root_safety_fields");
  return warnings;
}

export function isClosureCandidate(file) {
  const normalized = file.replaceAll("\\", "/");
  if (!/apps\/ai-gateway-service\/evidence\/phase\d+/i.test(normalized)) return false;
  if (!/\.json$/i.test(normalized)) return false;
  return /closure-result\.json$/i.test(normalized) || /result\.json$/i.test(normalized);
}

export function resultPriority(file) {
  const normalized = file.replaceAll("\\", "/");
  if (/closure-result\.json$/i.test(normalized)) return 3;
  if (/phase\d+\/[^/]*closure/i.test(normalized)) return 2;
  return 1;
}

export function relativePath(file) {
  return resolve(file).replace(resolve(".") + "\\", "").replaceAll("\\", "/");
}

export function fileMtimeMs(path) {
  return statSync(resolve(path)).mtimeMs;
}
