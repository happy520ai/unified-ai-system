import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const evidencePath = "apps/ai-gateway-service/evidence/phase1881_1900/phase1896-owner-os-wheel-input-browser-test.json";
const packageScriptName = "smoke:phase1896-owner-os-wheel-and-input-browser-test";
const sealScriptName = "verify:phase1900-owner-os-scroll-chat-entry-seal";

function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

async function readJson(relativePath, fallback = {}) {
  try {
    const text = await readFile(repoPath(relativePath), "utf8");
    return text.trim() ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
}

function checkBoolean(value) {
  return value === true;
}

async function main() {
  const result = await readJson(evidencePath, {});
  const packageJson = await readJson("package.json", {});
  const checks = {
    resultExists: existsSync(repoPath(evidencePath)),
    completed: checkBoolean(result.completed),
    recommendedSealed: checkBoolean(result.recommended_sealed),
    blockerNull: result.blocker === null,
    scrollWorks: checkBoolean(result.scrollWorks),
    wheelScrollChangesPosition: checkBoolean(result.wheelScrollChangesPosition),
    mainContentOverflowUsable: checkBoolean(result.mainContentOverflowUsable),
    noScrollTrapDetected: checkBoolean(result.noScrollTrapDetected),
    noInvisibleOverlayBlockingScroll: checkBoolean(result.noInvisibleOverlayBlockingScroll),
    firstScreenTaskInputVisible: checkBoolean(result.firstScreenTaskInputVisible),
    ownerCanFindWhereToType: checkBoolean(result.ownerCanFindWhereToType),
    inputPlaceholderPlainChinese: checkBoolean(result.inputPlaceholderPlainChinese),
    taskInputAcceptsText: checkBoolean(result.taskInputAcceptsText),
    primaryCtaCountOne: result.primaryCtaCount === 1,
    primaryCtaWorks: checkBoolean(result.primaryCtaWorks),
    buttonFeedbackVisible: checkBoolean(result.buttonFeedbackVisible),
    threeResultCardsVisible: checkBoolean(result.threeResultCardsVisible),
    bossDailyReportEntryVisible: checkBoolean(result.bossDailyReportEntryVisible),
    advancedModeCollapsedByDefault: checkBoolean(result.advancedModeCollapsedByDefault),
    engineeringJargonHiddenFromOwner: checkBoolean(result.engineeringJargonHiddenFromOwner),
    screenshotsGenerated: checkBoolean(result.screenshotsGenerated) && existsSync(repoPath(result.screenshotPath || "")),
    domSnapshotGenerated: checkBoolean(result.domSnapshotGenerated) && existsSync(repoPath(result.domSnapshotPath || "")),
    browserWheelAndInputTestGenerated: checkBoolean(result.browserWheelAndInputTestGenerated),
    packageScriptPresent: packageJson?.scripts?.[packageScriptName] === "node tools/phase1881_1900/run-owner-os-wheel-and-input-browser-test.mjs" &&
      packageJson?.scripts?.[sealScriptName] === "node tools/phase1881_1900/validate-owner-os-scroll-chat-entry-seal.mjs",
    providerCallsMadeFalse: result.providerCallsMade === false,
    rawSecretReadFalse: result.rawSecretRead === false,
    authJsonReadFalse: result.authJsonRead === false,
    rawCredentialRefReadFalse: result.rawCredentialRefRead === false,
    chatModifiedFalse: result.chatModified === false,
    chatGatewayExecuteModifiedFalse: result.chatGatewayExecuteModified === false,
    deployExecutedFalse: result.deployExecuted === false,
    productionReadyClaimedFalse: result.productionReadyClaimed === false,
    pluginAuditRecorded: result.pluginAppUsageAudit?.pluginAppsUsed === true &&
      result.pluginAppUsageAudit?.providerCalled === false &&
      result.pluginAppUsageAudit?.dataSentOut === false &&
      result.pluginAppUsageAudit?.secretExposed === false &&
      result.pluginAppUsageAudit?.rawCredentialExposed === false,
  };

  const blocker = Object.entries(checks).find(([, passed]) => passed !== true)?.[0] ?? null;
  const sealed = blocker === null;
  const summary = {
    phase: "Phase1900",
    phaseRange: "Phase1881-1900AIO",
    ...result,
    phase: "Phase1900",
    phaseRange: "Phase1881-1900AIO",
    completed: sealed,
    recommended_sealed: sealed,
    blocker,
    checks,
  };

  await writeJson(`${evidencePath.replace(/phase1896-owner-os-wheel-input-browser-test\.json$/, "phase1900-owner-os-scroll-chat-entry-seal.json")}`, summary);
  console.log(JSON.stringify(summary, null, 2));
  if (blocker) process.exitCode = 1;
}

async function writeJson(relativePath, data) {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const absolutePath = repoPath(relativePath);
  await mkdir(resolve(absolutePath, ".."), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

await main();
