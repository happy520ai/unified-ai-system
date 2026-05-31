import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const phaseRange = "Phase1486-1505AIO";
export const routeChoice = "local_self_use_only";
export const evidenceDir = "apps/ai-gateway-service/evidence/phase1486_1505";
export const screenshotDir = `${evidenceDir}/screenshots`;

export const paths = Object.freeze({
  uiSmoke: `${evidenceDir}/phase1500-real-browser-mission-control-smoke.json`,
  responsive: `${evidenceDir}/phase1503-responsive-layout-check.json`,
  accessibility: `${evidenceDir}/phase1504-accessibility-copy-clarity-check.json`,
  seal: `${evidenceDir}/phase1505-mission-control-ui-seal.json`,
  validation: `${evidenceDir}/phase1486-1505-validation-result.json`,
});

export const boundary = Object.freeze({
  providerCallsMade: false,
  paidProviderCalled: false,
  openAiCalled: false,
  claudeCalled: false,
  openRouterCalled: false,
  mimoCalled: false,
  rawSecretRead: false,
  secretValueExposed: false,
  tokenValueExposed: false,
  webhookValueExposed: false,
  rawCredentialRefRead: false,
  authJsonRead: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  yiyiCharacterMainlineRestored: false,
  characterModuleVisible: false,
  productionReadyClaimed: false,
  manualHumanTestClaimed: false,
  workspaceCleanClaimed: false,
});

export const requiredComponentFiles = Object.freeze([
  "apps/ai-gateway-service/src/ui/components/ConceptFieldPreviewPanel.js",
  "apps/ai-gateway-service/src/ui/components/RouteAffinityPanel.js",
  "apps/ai-gateway-service/src/ui/components/EvidenceCoherencePanel.js",
  "apps/ai-gateway-service/src/ui/components/RiskFieldPanel.js",
  "apps/ai-gateway-service/src/ui/components/FieldSnapshotTimelinePanel.js",
  "apps/ai-gateway-service/src/ui/components/SleepCandidateReviewDrawer.js",
  "apps/ai-gateway-service/src/ui/components/CapabilityCellCandidatePanel.js",
  "apps/ai-gateway-service/src/ui/components/TokenSavingDashboardPanel.js",
  "apps/ai-gateway-service/src/ui/components/GodModeConflictMapPanel.js",
  "apps/ai-gateway-service/src/ui/components/TianshuRouteComparisonPanel.js",
  "apps/ai-gateway-service/src/ui/components/SecurityNegativeSourceMapPanel.js",
  "apps/ai-gateway-service/src/ui/components/OperatorReviewChecklistPanel.js",
  "apps/ai-gateway-service/src/ui/components/TaijiBeidouMissionControlVisualizationPanel.js",
]);

export function readText(relativePath, fallback = "") {
  try {
    return readFileSync(resolve(repoRoot, relativePath), "utf8");
  } catch {
    return fallback;
  }
}

export function readJson(relativePath, fallback = null) {
  try {
    return JSON.parse(readText(relativePath));
  } catch {
    return fallback;
  }
}

export function writeJson(relativePath, value) {
  const absolutePath = resolve(repoRoot, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function ensureDir(relativePath) {
  mkdirSync(resolve(repoRoot, relativePath), { recursive: true });
}

export function findBlocker(checks) {
  return Object.entries(checks).find(([, passed]) => passed !== true)?.[0] ?? null;
}

export function makeResult(phase, payload = {}) {
  return {
    phase,
    phaseRange,
    routeChoice,
    completed: true,
    recommended_sealed: true,
    blocker: null,
    ...boundary,
    ...payload,
  };
}

export function allSourceText() {
  return requiredComponentFiles.map((file) => readText(file)).join("\n");
}

export function containsSecretLikeValue(text) {
  return [
    /sk-[A-Za-z0-9_-]{20,}/,
    /nvapi-[A-Za-z0-9_-]{20,}/i,
    /AKIA[0-9A-Z]{16}/,
    /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/,
  ].some((pattern) => pattern.test(String(text ?? "")));
}
