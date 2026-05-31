import { createConsolePage } from "../../apps/ai-gateway-service/src/ui/consolePage.js";
import {
  boundary,
  countMatches,
  evidencePaths,
  isDirectRun,
  noRemoteAssetReference,
  phaseRange,
  readText,
  sourcePaths,
  summarizeChecks,
  writeJson,
} from "../phase1821_1840/phase1840-common.mjs";

function extractOwnerHome(html) {
  const marker = 'id="owner-boss-view-panel"';
  const markerIndex = html.indexOf(marker);
  const sectionStart = html.lastIndexOf("<section", markerIndex);
  const nextSection = html.indexOf('id="owner-advanced-system-details"', markerIndex);
  if (markerIndex < 0) return "";
  return html.slice(sectionStart >= 0 ? sectionStart : markerIndex, nextSection > markerIndex ? nextSection : undefined);
}

export async function validateOwnerHomeDesignContract() {
  const html = createConsolePage();
  const ownerHome = extractOwnerHome(html);
  const ownerPanel = await readText(sourcePaths.ownerBossViewPanel);
  const ownerPrimaryAction = await readText(sourcePaths.ownerPrimaryAction);
  const ownerStatusCard = await readText(sourcePaths.ownerStatusCard);
  const ownerCopy = await readText(sourcePaths.ownerBossViewCopy);
  const ownerTokens = await readText(sourcePaths.ownerDesignTokens);

  const combinedOwnerSource = [ownerHome, ownerPanel, ownerPrimaryAction, ownerStatusCard, ownerCopy, ownerTokens].join("\n");
  const checks = {
    chineseBossViewEntryVisible: ownerHome.includes("data-owner-boss-view-entry=\"true\""),
    firstScreenOnePrimaryCta: countMatches(ownerHome, /data-owner-boss-action=/g) === 1 &&
      countMatches(ownerHome, /owner-primary-cta/g) === 1,
    primaryCtaIsOwnerCheck: ownerPrimaryAction.includes("data-owner-boss-action=\"run-today-check\""),
    threeCoreCardsVisible: ["today-completed", "problems-found", "next-action"]
      .every((card) => ownerHome.includes(`data-owner-summary-card="${card}"`)),
    engineeringModulesCollapsedByDefault: html.includes("data-engineering-modules-collapsed=\"true\"") &&
      !/<details[^>]+id="owner-advanced-system-details"[^>]*open/.test(html),
    advancedModeNotDistracting: html.includes("owner-advanced-system-details") &&
      html.indexOf('id="owner-advanced-system-details"') > html.indexOf('id="owner-boss-view-panel"') &&
      !/<details[^>]+id="owner-advanced-system-details"[^>]*open/.test(html),
    buttonClickFeedbackVisible: ownerHome.includes("role=\"status\"") &&
      ownerHome.includes("data-owner-action-log"),
    ownerDailyReportVisible: ownerHome.includes("data-owner-daily-report=\"true\"") &&
      ownerHome.includes("owner-daily-report-panel"),
    noRemoteFontCdnOrHotlink: noRemoteAssetReference(combinedOwnerSource),
  };

  const summary = summarizeChecks(checks);
  const result = {
    phase: "Phase1831",
    phaseRange,
    ...summary,
    ...boundary,
    ownerHomeDesignVerifierPassed: summary.completed,
    checks,
  };

  await writeJson(evidencePaths.ownerHome, result);
  return result;
}

if (isDirectRun(import.meta.url)) {
  const result = await validateOwnerHomeDesignContract();
  console.log(JSON.stringify(result, null, 2));
  if (result.blocker) process.exitCode = 1;
}
