import { classifyPersonaEntry, ensure, phase380Safety, writeArtifacts } from "../phase380-common.mjs";
import { readJson } from "../phase373-common.mjs";

const examples = await readJson("docs/phase380b-yiyi-persona-entry-examples.json");
const decisions = examples.map((entry) => classifyPersonaEntry(entry));
ensure(decisions.some((item) => item.decision === "accepted_as_candidate"), "Expected accepted candidate decision.");
ensure(decisions.some((item) => item.decision === "rejected"), "Expected rejected unsafe decision.");
ensure(decisions.every((item) => item.providerCallsMade === false), "Persona editor must not call providers.");
ensure(decisions.every((item) => item.secretValueExposed === false), "Persona editor must not expose secrets.");

const result = {
  phase: "Phase380B",
  personaEditorDryRunCreated: true,
  supportedEntryTypes: [
    "canon",
    "editable_profile",
    "scenario_line",
    "behavior_rule",
    "emotion_mapping",
    "visual_note",
    "rejected_unsafe_entry",
  ],
  decisions,
  acceptedCount: decisions.filter((item) => item.decision === "accepted_as_candidate").length,
  rejectedCount: decisions.filter((item) => item.decision === "rejected").length,
  ...phase380Safety,
  validationPassed: true,
};

await writeArtifacts({
  reportPath: "docs/phase380b-yiyi-persona-profile-editor-dry-run.md",
  resultPath: "apps/ai-gateway-service/evidence/phase380b/yiyi-persona-editor-dry-run-result.json",
  result,
  reportLines: [
    "# Phase380B Yiyi Persona Profile Editor Dry-run",
    "",
    "- Added local dry-run classification for user-defined Yiyi persona entries.",
    "- Supports editable profile, scenario line, behavior rule, emotion mapping, visual note, and rejected unsafe entry categories.",
    "- Unsafe entries are rejected without provider calls, secret reads, or real persistence.",
    "- This phase does not add a backend database or real save path.",
  ],
});

console.log(JSON.stringify(result, null, 2));
