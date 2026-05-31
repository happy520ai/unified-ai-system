import { createConsolePage } from "../../apps/ai-gateway-service/src/ui/consolePage.js";
import {
  boundary,
  countMatches,
  evidencePaths,
  isDirectRun,
  phaseRange,
  summarizeChecks,
  writeJson,
} from "../phase1821_1840/phase1840-common.mjs";

function extractOwnerHome(html) {
  const markerIndex = html.indexOf('id="owner-boss-view-panel"');
  const sectionStart = html.lastIndexOf("<section", markerIndex);
  const nextSection = html.indexOf('id="owner-advanced-system-details"', markerIndex);
  if (markerIndex < 0) return "";
  return html.slice(sectionStart >= 0 ? sectionStart : markerIndex, nextSection > markerIndex ? nextSection : undefined);
}

export async function validateNoButtonWall() {
  const html = createConsolePage();
  const ownerHome = extractOwnerHome(html);
  const buttonCount = countMatches(ownerHome, /<button\b/gi);
  const primaryCtaCount = countMatches(ownerHome, /owner-primary-cta/g);
  const ownerActionCount = countMatches(ownerHome, /data-owner-boss-action=/g);
  const checks = {
    noButtonWallGuardPassed: buttonCount <= 1,
    primaryCtaCountOne: primaryCtaCount === 1,
    ownerActionCountOne: ownerActionCount === 1,
    noSecondaryOwnerButtons: !/<button\b(?![^>]*owner-primary-cta)/i.test(ownerHome),
  };

  const summary = summarizeChecks(checks);
  const result = {
    phase: "Phase1834",
    phaseRange,
    ...summary,
    ...boundary,
    noButtonWallGuardPassed: summary.completed,
    counts: {
      buttonCount,
      primaryCtaCount,
      ownerActionCount,
    },
    checks,
  };

  await writeJson(evidencePaths.noButtonWall, result);
  return result;
}

if (isDirectRun(import.meta.url)) {
  const result = await validateNoButtonWall();
  console.log(JSON.stringify(result, null, 2));
  if (result.blocker) process.exitCode = 1;
}
