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

export async function validateNoPhaseJargonOwnerHome() {
  const html = createConsolePage();
  const ownerHome = extractOwnerHome(html);
  const forbiddenPatterns = {
    phase: /\bPhase\d+/i,
    verifier: /\bverifier\b/i,
    trace: /\btrace\b/i,
    rawEvidencePath: /evidence path|apps\/ai-gateway-service\/evidence|\.json/i,
    providerGate: /Provider Gate/i,
    credentialRef: /CredentialRef/i,
    rawProviderDetails: /raw provider|raw credential|base_url/i,
  };
  const matches = Object.fromEntries(
    Object.entries(forbiddenPatterns).map(([name, pattern]) => [name, pattern.test(ownerHome)])
  );
  const checks = {
    noPhaseJargonOwnerHomeGuardPassed: Object.values(matches).every((matched) => matched === false),
    ownerHomeExists: ownerHome.length > 0,
    advancedModeExistsForJargon: html.includes("owner-advanced-system-details"),
  };

  const summary = summarizeChecks(checks);
  const result = {
    phase: "Phase1835",
    phaseRange,
    ...summary,
    ...boundary,
    noPhaseJargonOwnerHomeGuardPassed: summary.completed,
    forbiddenMatches: matches,
    checks,
  };

  await writeJson(evidencePaths.noPhaseJargon, result);
  return result;
}

if (isDirectRun(import.meta.url)) {
  const result = await validateNoPhaseJargonOwnerHome();
  console.log(JSON.stringify(result, null, 2));
  if (result.blocker) process.exitCode = 1;
}
