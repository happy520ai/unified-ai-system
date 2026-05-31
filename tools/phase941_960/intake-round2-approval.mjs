import { evaluateRound2Approval } from "../../packages/model-routing-engine/src/index.js";
import { approvalPath, baseSafety, ensurePhaseDirs, paths, readJsonIfPresent, writeDoc, writeJson } from "./phase941-960-common.mjs";

ensurePhaseDirs();
const result = {
  ...evaluateRound2Approval({
    approval: readJsonIfPresent(approvalPath),
    phase912915: readJsonIfPresent(paths.phase912915Final) || {},
    phase916930: readJsonIfPresent(paths.phase916930Final) || {},
    phase931940: readJsonIfPresent(paths.phase931940Final) || {},
  }),
  ...baseSafety(),
  providerCallsMade: false,
  newProviderRequestsThisPhase: 0,
};

writeJson(paths.approval, result);
writeDoc("phase941-round2-approval-intake.md", {
  title: "Phase941 Round 2 Approval Intake",
  goal: "Validate the independent Phase941-960 approval before any real Provider request.",
  facts: [
    `round2ApprovalPresent=${result.round2ApprovalPresent}`,
    `authorizationComplete=${result.authorizationComplete}`,
    `blocker=${result.blocker}`,
  ],
  boundaries: ["Approval missing blocks execution.", "No Provider call in intake."],
  outputs: [paths.approval],
});
console.log(JSON.stringify(result, null, 2));
