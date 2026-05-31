import { recheckRound2Authenticity } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, paths, readModeResults, writeDoc, writeJson } from "./phase941-960-common.mjs";

ensurePhaseDirs();
const result = {
  ...recheckRound2Authenticity({ modeResults: readModeResults() }),
  ...baseSafety(),
};
writeJson(paths.authenticity, result);
writeDoc("phase950-external-provider-authenticity-recheck.md", {
  title: "Phase950 External Provider Authenticity Recheck",
  goal: "Confirm every real Round 2 request has external_provider response source.",
  facts: [`externalProviderApiCallConfirmedCount=${result.externalProviderApiCallConfirmedCount}`, `realProviderRequestCount=${result.realProviderRequestCount}`],
  boundaries: ["Dry-run scenarios are not counted as external Provider calls."],
  outputs: [paths.authenticity],
});
console.log(JSON.stringify(result, null, 2));
