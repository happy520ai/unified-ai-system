import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const phaseRange = "Phase1861-1880AIO";
export const routeChoice = "A / local_self_use_only";
export const evidenceDir = "apps/ai-gateway-service/evidence/phase1861_1880";

export const designKnowledgePaths = Object.freeze([
  "docs/design/codex-design-knowledge/PME_DESIGN.md",
  "docs/design/codex-design-knowledge/OWNER_HOME_DESIGN.md",
  "docs/design/codex-design-knowledge/OWNER_REPORT_DESIGN.md",
  "docs/design/codex-design-knowledge/CHINESE_UI_COPY_RULES.md",
  "docs/design/codex-design-knowledge/DO_NOT_DESIGN_LIKE_THIS.md",
]);

export const evidencePaths = Object.freeze({
  retest: `${evidenceDir}/phase1875-automated-usability-assessment.json`,
  seal: `${evidenceDir}/phase1880-owner-os-one-click-retest-seal.json`,
  screenshot: `${evidenceDir}/screenshots/phase1873-owner-os-one-click-retest.png`,
  domSnapshot: `${evidenceDir}/dom/phase1874-owner-os-one-click-retest.html`,
  launcherLog: `${evidenceDir}/logs/phase1863-zero-learning-launcher-run.log`,
  browserLog: `${evidenceDir}/logs/phase1864-owner-os-browser-retest.log`,
  closureReport: `${evidenceDir}/reports/phase1879-owner-os-retest-closure-report.md`,
});

export const upstreamPaths = Object.freeze({
  phase1860Seal: "apps/ai-gateway-service/evidence/phase1841_1860/phase1860-owner-os-interface-rewrite-seal.json",
  phase1800Seal: "apps/ai-gateway-service/evidence/phase1781_1800/phase1800-desktop-one-click-operator-seal.json",
  phase1800ReportHtml: "apps/ai-gateway-service/evidence/phase1781_1800/reports/today-xiaotian-owner-report.html",
  phase1800ReportMd: "apps/ai-gateway-service/evidence/phase1781_1800/reports/today-xiaotian-owner-report.md",
});

export const launcherPaths = Object.freeze({
  cmd: "run-xiaotian-daily-check.cmd",
  powershell: "run-xiaotian-daily-check.ps1",
});

export const boundary = Object.freeze({
  routeChoice,
  localSelfUseOnly: true,
  providerCallsMade: false,
  rawSecretRead: false,
  authJsonRead: false,
  rawCredentialRefRead: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  productionReadyClaimed: false,
  ownerSatisfactionImprovedClaimed: false,
  manualHumanFeedbackClaimed: false,
});

export function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

export function isDirectRun(metaUrl, argv1 = process.argv[1]) {
  return Boolean(argv1) && resolve(argv1) === fileURLToPath(metaUrl);
}

export async function readText(relativePath, fallback = "") {
  try {
    return await readFile(repoPath(relativePath), "utf8");
  } catch {
    return fallback;
  }
}

export async function readJson(relativePath, fallback = {}) {
  const text = await readText(relativePath, "");
  if (!text.trim()) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export async function writeText(relativePath, text) {
  const absolutePath = repoPath(relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${String(text).trimEnd()}\n`, "utf8");
}

export async function writeJson(relativePath, data) {
  await writeText(relativePath, JSON.stringify(data, null, 2));
}

export async function ensureEvidenceDirs() {
  await Promise.all([
    mkdir(repoPath(`${evidenceDir}/screenshots`), { recursive: true }),
    mkdir(repoPath(`${evidenceDir}/dom`), { recursive: true }),
    mkdir(repoPath(`${evidenceDir}/logs`), { recursive: true }),
    mkdir(repoPath(`${evidenceDir}/reports`), { recursive: true }),
  ]);
}

export function summarizeChecks(checks) {
  const blocker = Object.entries(checks).find(([, passed]) => passed !== true)?.[0] ?? null;
  return {
    completed: blocker === null,
    recommended_sealed: blocker === null,
    blocker,
  };
}

export function hasForbiddenOwnerJargon(text) {
  return /(Phase\d+|\bverifier\b|\btrace\b|raw evidence path|CredentialRef|Provider Gate|\bDOM\b|\bJSON\b|token budget|regression matrix)/i.test(String(text ?? ""));
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

