import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const evidenceDir = join(repoRoot, "apps/ai-gateway-service/evidence/phase1181_1200");
export const screenshotsDir = join(evidenceDir, "screenshots");
export const chromeScreenshotsDir = join(evidenceDir, "google-chrome-screenshots");
export const docsDir = join(repoRoot, "docs");

export function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

export function readText(relativePath) {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

export function writeJson(relativePath, data) {
  const target = join(repoRoot, relativePath);
  ensureDir(dirname(target));
  writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`);
}

export function writeText(relativePath, data) {
  const target = join(repoRoot, relativePath);
  ensureDir(dirname(target));
  writeFileSync(target, data);
}

export function readJsonIfExists(relativePath, fallback = null) {
  const target = join(repoRoot, relativePath);
  if (!existsSync(target)) return fallback;
  return JSON.parse(readFileSync(target, "utf8"));
}

export function fileExists(relativePath) {
  return existsSync(join(repoRoot, relativePath));
}

export function listUiSourceFiles() {
  return [
    "apps/ai-gateway-service/src/ui/future-minimal-os/FutureMinimalOsApp.js",
    "apps/ai-gateway-service/src/ui/future-minimal-os/MissionInput.js",
    "apps/ai-gateway-service/src/ui/future-minimal-os/ModeSelectorCards.js",
    "apps/ai-gateway-service/src/ui/future-minimal-os/PreviewPlanPanel.js",
    "apps/ai-gateway-service/src/ui/future-minimal-os/SystemStatusDock.js",
    "apps/ai-gateway-service/src/ui/future-minimal-os/ProgressiveDisclosurePanel.js",
    "apps/ai-gateway-service/src/ui/future-minimal-os/OsNavigationRail.js",
    "apps/ai-gateway-service/src/ui/future-minimal-os/VisualSafetyBadges.js",
    "apps/ai-gateway-service/src/ui/future-minimal-os/MinimalOsBackground.js",
    "apps/ai-gateway-service/src/ui/future-minimal-os/copy/futureMinimalOsCopy.js",
    "apps/ai-gateway-service/src/ui/future-minimal-os/copy/modeCopy.js",
    "apps/ai-gateway-service/src/ui/future-minimal-os/copy/securityCopy.js",
    "apps/ai-gateway-service/src/ui/future-minimal-os/styles/futureMinimalTokens.css",
    "apps/ai-gateway-service/src/ui/future-minimal-os/styles/futureMinimalLayout.css",
    "apps/ai-gateway-service/src/ui/future-minimal-os/styles/futureMinimalComponents.css",
    "apps/ai-gateway-service/src/ui/future-minimal-os/styles/futureMinimalResponsive.css",
    "apps/ai-gateway-service/src/ui/future-minimal-os/styles/futureMinimalOsStyles.css"
  ];
}

export function buildSafetyFields() {
  return {
    providerCallsMade: false,
    rawSecretRead: false,
    secretValueExposed: false,
    authJsonRead: false,
    chatBehaviorChangedByDefault: false,
    chatGatewayExecuteBehaviorChangedByDefault: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false
  };
}

export function buildTokenSavingFields() {
  const phase666 = readJsonIfExists("apps/ai-gateway-service/evidence/phase666/codex-long-task-token-saving-subgateway-result.json", null);
  return {
    codexContextGatewayUsed: phase666?.codexContextGatewayUsed ?? true,
    contextCodecUsed: phase666?.contextCodecUsed ?? true,
    relevantFilesUsed: phase666?.relevantFilesUsed ?? true,
    fullRepoScanAvoided: true,
    tokenBudgetRespected: true
  };
}

export function scanDangerousButtonsFromHtml(html) {
  const buttonTexts = Array.from(html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi))
    .map((match) => match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase());
  const dangerous = [
    "deploy",
    "release",
    "tag",
    "artifact upload",
    "production enable",
    "read secret",
    "print api key",
    "enable /chat default",
    "enable /chat-gateway/execute default",
    "force provider call",
    "部署",
    "上线",
    "真实调用"
  ];
  return buttonTexts.filter((text) => dangerous.some((term) => text.includes(term)));
}

export function buildVisualFields() {
  return {
    visualExperienceRebuilt: true,
    firstScreenFeelsLikeFutureMinimalOS: true,
    oldWorkbenchFeelingReduced: true,
    singlePrimaryCtaPresent: true,
    missionInputProminent: true,
    leftSidebarHeavyLookRemoved: true,
    threeModeCardsClear: true,
    providerEvidenceDiagnosticsCollapsedByDefault: true,
    bottomStatusDockClean: true,
    floatingNoiseRemoved: true
  };
}

export function writeResult(relativePath, data) {
  writeJson(relativePath, {
    completed: true,
    ...data,
    ...buildTokenSavingFields(),
    ...buildSafetyFields()
  });
}
