import { baseSafety, ensurePhaseDirs, paths, readJsonIfPresent, writeDoc, writeJson } from "./phase966-970-common.mjs";
import { buildGodPromptMarkerContractPreview } from "../../packages/model-routing-engine/src/index.js";

ensurePhaseDirs();

const phase961965Audit = readJsonIfPresent(paths.phase961965Audit) || {};
const phase961965Design = readJsonIfPresent(paths.phase961965Design) || {};
const result = {
  ...buildGodPromptMarkerContractPreview({ phase961965Audit, phase961965Design }),
  providerCallsMade: false,
  newProviderRequestsThisPhase: 0,
  ...baseSafety(),
};

writeJson(paths.contract, result);
writeDoc("phase967-god-prompt-marker-contract-preview.md", {
  title: "Phase967 God Prompt Marker Contract Preview",
  goal: "Build the corrected prompt, marker, structure, and scoring contract preview.",
  facts: [
    `promptMarkerContractReady=${result.promptMarkerContractReady}`,
    `rootCauseFromPhase961965=${result.rootCauseFromPhase961965}`,
    `expectedMarker=${result.markerContract.expectedMarker}`,
  ],
  boundaries: ["Preview only.", "No runtime route policy change."],
  outputs: [paths.contract],
});

console.log(JSON.stringify(result, null, 2));
