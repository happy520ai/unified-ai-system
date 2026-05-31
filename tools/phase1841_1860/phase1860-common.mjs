import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const phaseRange = "Phase1841-1860AIO";
export const evidenceDir = "apps/ai-gateway-service/evidence/phase1841_1860";

export const knowledgeRequiredPaths = Object.freeze([
  "docs/design/codex-design-knowledge/PME_DESIGN.md",
  "docs/design/codex-design-knowledge/OWNER_HOME_DESIGN.md",
  "docs/design/codex-design-knowledge/OWNER_REPORT_DESIGN.md",
  "docs/design/codex-design-knowledge/CHINESE_UI_COPY_RULES.md",
  "docs/design/codex-design-knowledge/COMPONENT_PATTERNS.md",
  "docs/design/codex-design-knowledge/DO_NOT_DESIGN_LIKE_THIS.md",
  "docs/design/codex-design-knowledge/CODEX_UI_REWRITE_PLAYBOOK.md",
]);

export const sourcePaths = Object.freeze({
  ownerBossViewPanel: "apps/ai-gateway-service/src/ui/components/OwnerBossViewPanel.js",
  ownerPrimaryAction: "apps/ai-gateway-service/src/ui/components/OwnerPrimaryAction.js",
  ownerStatusCard: "apps/ai-gateway-service/src/ui/components/OwnerStatusCard.js",
  ownerBossViewCopy: "apps/ai-gateway-service/src/ui/copy/ownerBossViewCopy.js",
  ownerDesignTokens: "apps/ai-gateway-service/src/ui/styles/ownerDesignTokens.js",
  ownerOsTheme: "apps/ai-gateway-service/src/ui/styles/ownerOsTheme.js",
  missionControlPanel: "apps/ai-gateway-service/src/ui/components/MissionControlPanel.js",
  consolePage: "apps/ai-gateway-service/src/ui/consolePage.js",
  reportGenerator: "tools/phase1781_1800/generate-owner-daily-report.mjs",
  reportMarkdown: "apps/ai-gateway-service/evidence/phase1781_1800/reports/today-xiaotian-owner-report.md",
  reportHtml: "apps/ai-gateway-service/evidence/phase1781_1800/reports/today-xiaotian-owner-report.html",
});

export const evidencePaths = Object.freeze({
  validation: `${evidenceDir}/owner-os-interface-rewrite-validation.json`,
  browserRecheck: `${evidenceDir}/reports/phase1858-owner-os-browser-recheck.json`,
  closure: `${evidenceDir}/reports/phase1859-owner-os-rewrite-closure-report.json`,
  seal: `${evidenceDir}/phase1860-owner-os-interface-rewrite-seal.json`,
  screenshot: `${evidenceDir}/screenshots/phase1858-owner-os-home.png`,
  domSnapshot: `${evidenceDir}/dom/phase1858-owner-os-home.html`,
  failureLog: `${evidenceDir}/reports/phase1858-browser-failure.log`,
});

export const boundary = Object.freeze({
  routeChoice: "A / local_self_use_only",
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
  remoteFontUsed: false,
  cdnImportUsed: false,
  externalImageHotlinkUsed: false,
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
  const text = await readText(relativePath);
  if (!text.trim()) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export async function writeJson(relativePath, data) {
  const absolutePath = repoPath(relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function writeText(relativePath, text) {
  const absolutePath = repoPath(relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${String(text).trimEnd()}\n`, "utf8");
}

export function countMatches(value, pattern) {
  return [...String(value ?? "").matchAll(pattern)].length;
}

export function noRemoteAssetReference(text) {
  return !/(https?:\/\/|cdn\.|@import\s+url|fonts\.googleapis|fonts\.gstatic|<img\s+[^>]*src=["']https?:)/i.test(String(text ?? ""));
}

export function containsForbiddenOwnerJargon(text) {
  return /(Phase\d+|\bverifier\b|\btrace\b|raw evidence path|Provider Gate|raw provider|raw credential|\bDOM\b|\bJSON\b|token budget|regression matrix)/i.test(String(text ?? ""));
}

export function summarizeChecks(checks) {
  const blocker = Object.entries(checks).find(([, passed]) => passed !== true)?.[0] ?? null;
  return {
    completed: blocker === null,
    recommended_sealed: blocker === null,
    blocker,
  };
}

export async function readKnowledgePack() {
  const entries = [];
  for (const path of knowledgeRequiredPaths) {
    entries.push({ path, text: await readText(path) });
  }
  return entries;
}
