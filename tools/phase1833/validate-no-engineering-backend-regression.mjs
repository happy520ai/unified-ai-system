import { createConsolePage } from "../../apps/ai-gateway-service/src/ui/consolePage.js";
import {
  boundary,
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

export async function validateNoEngineeringBackendRegression() {
  const html = createConsolePage();
  const ownerHome = extractOwnerHome(html);
  const checks = {
    noEngineeringBackendRegressionGuardPassed: ownerHome.includes("data-owner-boss-mode=\"one-button\"") &&
      ownerHome.includes("data-owner-daily-report=\"true\""),
    ownerHomeFirstNotEngineeringConsole: html.indexOf('id="owner-boss-view-panel"') > -1 &&
      html.indexOf('id="owner-boss-view-panel"') < html.indexOf('id="owner-advanced-system-details"'),
    engineeringModulesCollapsedByDefault: html.includes("data-engineering-modules-collapsed=\"true\"") &&
      !/<details[^>]+id="owner-advanced-system-details"[^>]*open/.test(html),
    engineeringDetailsNotInOwnerHome: !/(Mission Control|Concept Field|Evidence Replay|Context Gateway|Token Saving|CredentialRef|verifier|trace)/i.test(ownerHome),
    ownerResultLanguagePresent: ownerHome.includes("today-completed") &&
      ownerHome.includes("problems-found") &&
      ownerHome.includes("next-action"),
  };

  const summary = summarizeChecks(checks);
  const result = {
    phase: "Phase1833",
    phaseRange,
    ...summary,
    ...boundary,
    noEngineeringBackendRegressionGuardPassed: summary.completed,
    checks,
  };

  await writeJson(evidencePaths.noEngineering, result);
  return result;
}

if (isDirectRun(import.meta.url)) {
  const result = await validateNoEngineeringBackendRegression();
  console.log(JSON.stringify(result, null, 2));
  if (result.blocker) process.exitCode = 1;
}
