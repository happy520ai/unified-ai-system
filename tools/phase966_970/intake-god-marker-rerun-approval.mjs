import { ensurePhaseDirs, approvalPath, baseSafety, paths, readJsonIfPresent, templatePath, writeDoc, writeJson } from "./phase966-970-common.mjs";
import { evaluateGodMarkerRerunApproval } from "../../packages/model-routing-engine/src/index.js";

ensurePhaseDirs();

const template = readJsonIfPresent(templatePath);
const approval = readJsonIfPresent(approvalPath);
const phase961965Audit = readJsonIfPresent(paths.phase961965Audit) || {};
const phase961965Design = readJsonIfPresent(paths.phase961965Design) || {};
const result = {
  ...evaluateGodMarkerRerunApproval({ template, approval, phase961965Audit, phase961965Design }),
  providerCallsMade: false,
  newProviderRequestsThisPhase: 0,
  ...baseSafety(),
};

writeJson(paths.approval, result);
writeDoc("phase966-god-marker-rerun-approval-intake.md", {
  title: "Phase966 God Marker Rerun Approval Intake",
  goal: "Read the rerun template and true approval input before any provider rerun.",
  facts: [
    `approvalPresent=${result.approvalPresent}`,
    `recommended_sealed=${result.recommended_sealed}`,
    `blocker=${result.blocker}`,
  ],
  boundaries: ["No approval means no Provider request.", "NVIDIA-only and credentialRef-only."],
  outputs: [paths.approval],
});

console.log(JSON.stringify(result, null, 2));
