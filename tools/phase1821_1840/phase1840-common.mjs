import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const phaseRange = "Phase1821-1840AIO";
export const evidenceDir = "apps/ai-gateway-service/evidence/phase1821_1840";

export const knowledgePaths = Object.freeze({
  readme: "docs/design/codex-design-knowledge/README.md",
  pmeDesign: "docs/design/codex-design-knowledge/PME_DESIGN.md",
  ownerHome: "docs/design/codex-design-knowledge/OWNER_HOME_DESIGN.md",
  ownerReport: "docs/design/codex-design-knowledge/OWNER_REPORT_DESIGN.md",
  chineseCopy: "docs/design/codex-design-knowledge/CHINESE_UI_COPY_RULES.md",
  componentPatterns: "docs/design/codex-design-knowledge/COMPONENT_PATTERNS.md",
  antiPatterns: "docs/design/codex-design-knowledge/DO_NOT_DESIGN_LIKE_THIS.md",
  sourceAudit: "docs/design/codex-design-knowledge/AWESOME_DESIGN_SOURCE_AUDIT.md",
  playbook: "docs/design/codex-design-knowledge/CODEX_UI_REWRITE_PLAYBOOK.md",
});

export const sourcePaths = Object.freeze({
  ownerBossViewPanel: "apps/ai-gateway-service/src/ui/components/OwnerBossViewPanel.js",
  ownerPrimaryAction: "apps/ai-gateway-service/src/ui/components/OwnerPrimaryAction.js",
  ownerStatusCard: "apps/ai-gateway-service/src/ui/components/OwnerStatusCard.js",
  ownerBossViewCopy: "apps/ai-gateway-service/src/ui/copy/ownerBossViewCopy.js",
  ownerDesignTokens: "apps/ai-gateway-service/src/ui/styles/ownerDesignTokens.js",
  consolePage: "apps/ai-gateway-service/src/ui/consolePage.js",
  reportGenerator: "tools/phase1781_1800/generate-owner-daily-report.mjs",
  reportMarkdown: "apps/ai-gateway-service/evidence/phase1781_1800/reports/today-xiaotian-owner-report.md",
  reportHtml: "apps/ai-gateway-service/evidence/phase1781_1800/reports/today-xiaotian-owner-report.html",
  readme: "README.md",
  agents: "AGENTS.md",
});

export const evidencePaths = Object.freeze({
  knowledgePack: `${evidenceDir}/design-knowledge-pack-validation.json`,
  ownerHome: `${evidenceDir}/owner-home-design-contract-result.json`,
  ownerReport: `${evidenceDir}/owner-report-design-contract-result.json`,
  noEngineering: `${evidenceDir}/no-engineering-backend-regression-result.json`,
  noButtonWall: `${evidenceDir}/no-button-wall-result.json`,
  noPhaseJargon: `${evidenceDir}/no-phase-jargon-owner-home-result.json`,
  seal: `${evidenceDir}/phase1840-codex-design-knowledge-pack-seal.json`,
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
  const text = await readText(relativePath, "");
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

export function countMatches(value, pattern) {
  return [...String(value ?? "").matchAll(pattern)].length;
}

export function hasAll(text, needles) {
  return needles.every((needle) => String(text ?? "").includes(needle));
}

export function noRemoteAssetReference(text) {
  return !/(https?:\/\/|cdn\.|@import\s+url|fonts\.googleapis|fonts\.gstatic|<img\s+[^>]*src=["']https?:)/i.test(String(text ?? ""));
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

export function summarizeChecks(checks) {
  const blocker = Object.entries(checks).find(([, passed]) => passed !== true)?.[0] ?? null;
  return {
    completed: blocker === null,
    recommended_sealed: blocker === null,
    blocker,
  };
}
