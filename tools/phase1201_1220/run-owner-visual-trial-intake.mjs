import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  baseResult,
  classifyFeedbackItems,
  docsDir,
  fixCandidateDir,
  ownerFeedbackInputPath,
  ownerTrialDir,
  phaseDir,
  readJsonIfExists,
  visualFeedbackInputPath,
  writeJson,
  writeText
} from "./phase1201-common.mjs";

const phase1181 = readJsonIfExists(resolve(process.cwd(), "apps/ai-gateway-service/evidence/phase1181_1200/final-frontend-visual-experience-result.json"), {});
const ownerFeedback = readJsonIfExists(ownerFeedbackInputPath, null);
const visualFeedback = readJsonIfExists(visualFeedbackInputPath, null);
const feedback = ownerFeedback || visualFeedback;

const schema = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Phase1201 Owner Visual Trial Feedback Input",
  "type": "object",
  "required": ["feedbackSource", "isRealManualTrial", "trialDate", "trialDurationMinutes", "walkedPaths", "tasksTried"],
  "properties": {
    "feedbackSource": { "const": "owner" },
    "ownerName": { "type": "string" },
    "isRealManualTrial": { "const": true },
    "trialDate": { "type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$" },
    "trialDurationMinutes": { "type": "number", "exclusiveMinimum": 0 },
    "chromeUsed": { "type": "boolean" },
    "targetUrl": { "type": "string" },
    "walkedPaths": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
    "tasksTried": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
    "whatWorked": { "type": "array", "items": { "type": "string" } },
    "whatFailed": { "type": "array", "items": { "type": "string" } },
    "confusingPoints": { "type": "array", "items": { "type": "string" } },
    "bugsObserved": { "type": "array", "items": { "type": "string" } },
    "severitySuggestions": { "type": "array", "items": { "type": "string" } },
    "visualP2P3Suggestions": { "type": "array", "items": { "type": "string" } },
    "evidenceRefs": { "type": "array", "items": { "type": "string" } },
    "noEvidenceReason": { "type": "string" },
    "readyForP2P3MicroFix": { "type": "boolean" },
    "notes": { "type": "string" }
  }
};

const template = {
  feedbackSource: "owner",
  ownerName: "",
  isRealManualTrial: true,
  trialDate: "YYYY-MM-DD",
  trialDurationMinutes: 0,
  chromeUsed: true,
  targetUrl: "http://127.0.0.1:3100/ui",
  walkedPaths: [
    "initial screen",
    "mission input",
    "primary CTA preview",
    "Normal / God / Tianshu cards",
    "details collapsed",
    "details expanded",
    "bottom status dock"
  ],
  tasksTried: [],
  whatWorked: [],
  whatFailed: [],
  confusingPoints: [],
  bugsObserved: [],
  severitySuggestions: [],
  visualP2P3Suggestions: [],
  evidenceRefs: [],
  noEvidenceReason: "",
  readyForP2P3MicroFix: false,
  notes: ""
};

writeJson(resolve(ownerTrialDir, "visual-feedback.input.schema.json"), schema);
writeJson(resolve(ownerTrialDir, "visual-feedback.input.template.json"), template);

writeText(resolve(docsDir, "phase1201-owner-real-manual-visual-trial-guide.md"), `# Phase1201-1220 Owner Real Manual Visual Trial Guide

Open Google Chrome and visit:

\`http://127.0.0.1:3100/ui\`

Manual paths to try:

1. First screen: confirm the page feels like a clean Future Minimal OS entry, not a backend admin screen.
2. Mission input: type a real task and check whether the command surface feels clear.
3. Primary CTA: click only \`预览执行方案\`; confirm it creates a preview and does not imply real execution.
4. Modes: inspect Normal / God / Tianshu clarity.
5. Details: confirm Provider / Evidence / Diagnostics are folded by default and clear after expansion.
6. Bottom status dock: confirm Provider / Secret / Deploy boundaries are understandable.
7. Responsive: narrow the browser and check if the CTA and modes remain readable.

Fill one of these files after the trial:

- \`local-self-use/v1/owner-trial/owner-feedback.input.json\`
- \`local-self-use/v1/owner-trial/visual-feedback.input.json\`

Codex self-test must not be counted as owner feedback.
`);

const authenticity = checkAuthenticity(feedback);
const ownerFeedbackCollected = Boolean(feedback);
const classifications = authenticity.ownerFeedbackAuthentic ? classifyFeedbackItems(feedback) : [];
const p0p1 = classifications.filter((item) => item.severity === "P0" || item.severity === "P1");
const p2p3 = classifications.filter((item) => item.severity === "P2" || item.severity === "P3");
const activeUnsafeRiskDetected = p0p1.some((item) => item.activeUnsafeRisk);

writeJson(resolve(phaseDir, "owner-visual-trial-intake-result.json"), baseResult({
  phaseRange: "Phase1201-1220",
  phase1181_1200Sealed: phase1181.recommended_sealed === true,
  ownerFeedbackInputPath: "local-self-use/v1/owner-trial/owner-feedback.input.json",
  visualFeedbackInputPath: "local-self-use/v1/owner-trial/visual-feedback.input.json",
  ownerFeedbackCollected,
  ...authenticity,
  codexSelfTestCountedAsOwnerFeedback: false,
  externalTesterFeedbackCount: 0,
  noFakeHumanFeedback: true
}));

writeJson(resolve(phaseDir, "owner-visual-feedback-classification.json"), baseResult({
  phaseRange: "Phase1201-1220",
  ownerFeedbackCollected,
  ownerFeedbackAuthentic: authenticity.ownerFeedbackAuthentic,
  knownIssuesClassified: true,
  classifications,
  p0Count: classifications.filter((item) => item.severity === "P0").length,
  p1Count: classifications.filter((item) => item.severity === "P1").length,
  p2Count: classifications.filter((item) => item.severity === "P2").length,
  p3Count: classifications.filter((item) => item.severity === "P3").length,
  activeUnsafeRiskDetected
}));

const fixCandidates = p2p3.map((issue) => ({
  issueId: issue.issueId,
  severity: issue.severity,
  category: issue.category,
  title: issue.title,
  allowedFixScope: ["copy", "layout", "spacing", "contrast", "interaction clarity"],
  excludedFixScope: ["provider runtime", "/chat default", "/chat-gateway/execute default", "deploy/release/tag/artifact", "secret/auth.json"],
  approvalRequiredBeforeApply: false,
  chromeSmokeRequiredAfterApply: true,
  rollbackPlan: "Revert the specific copy/layout/spacing/contrast/interaction clarity edit; do not use git reset --hard or git clean."
}));

writeJson(resolve(fixCandidateDir, "phase1201-1220-owner-visual-p2p3-fix-candidates.json"), {
  phaseRange: "Phase1201-1220",
  completed: true,
  ownerFeedbackCollected,
  ownerFeedbackAuthentic: authenticity.ownerFeedbackAuthentic,
  actualFixesAppliedThisPhase: false,
  p0p1Blocked: p0p1.length > 0,
  fixCandidates,
  ...safety()
});

const blocker = !ownerFeedbackCollected
  ? "owner_real_manual_feedback_missing"
  : !authenticity.ownerFeedbackAuthentic
    ? "owner_feedback_authenticity_failed"
    : p0p1.length > 0
      ? "owner_feedback_p0_p1_blocker_present"
      : null;

const finalResult = baseResult({
  phaseRange: "Phase1201-1220",
  completed: true,
  recommended_sealed: blocker === null,
  blocker,
  phase1181_1200Sealed: phase1181.recommended_sealed === true,
  ownerFeedbackCollected,
  ownerFeedbackAuthentic: authenticity.ownerFeedbackAuthentic,
  noFakeHumanFeedback: true,
  codexSelfTestCountedAsOwnerFeedback: false,
  externalTesterFeedbackCount: 0,
  p0p1BlockerPresent: p0p1.length > 0,
  activeUnsafeRiskDetected,
  p2p3FixCandidatesGenerated: true,
  p2p3FixCandidateCount: fixCandidates.length,
  actualFixesAppliedThisPhase: false,
  chromeSmokeRequiredForActualUiFix: true,
  chromeSmokeExecutedThisPhase: false,
  chromeScreenshotsGeneratedThisPhase: false,
  visualMicroFixIntakeReady: true,
  ownerTrialSchemaGenerated: true,
  ownerTrialTemplateGenerated: true,
  ownerTrialGuideGenerated: true,
  ownerVisualClassificationGenerated: true,
  ownerFixCandidatePackGenerated: true
});

writeJson(resolve(phaseDir, "phase1201-1220-final-result.json"), finalResult);
writeText(resolve(docsDir, "phase1201-1220-owner-visual-micro-fix-intake-report.md"), `# Phase1201-1220 Owner Real Manual Trial + Visual P2/P3 Micro-Fix Intake

Status: ${finalResult.recommended_sealed ? "sealed" : "blocked"}

- ownerFeedbackCollected: ${ownerFeedbackCollected}
- ownerFeedbackAuthentic: ${authenticity.ownerFeedbackAuthentic}
- blocker: ${blocker ?? "none"}
- P0/P1 blocker present: ${p0p1.length > 0}
- P2/P3 fix candidates generated: ${fixCandidates.length}
- actualFixesAppliedThisPhase: false

No Codex self-test was counted as owner feedback.

## Boundary

- providerCallsMade=false
- rawSecretRead=false
- secretValueExposed=false
- authJsonRead=false
- /chat default changed=false
- /chat-gateway/execute default changed=false
- deploy/release/tag/artifact=false
- Yiyi/character/avatar/companion restored=false

## Next manual step

Fill \`local-self-use/v1/owner-trial/visual-feedback.input.json\` after a real Google Chrome manual trial.
`);

console.log(JSON.stringify({
  completed: finalResult.completed,
  recommended_sealed: finalResult.recommended_sealed,
  blocker: finalResult.blocker,
  ownerFeedbackCollected: finalResult.ownerFeedbackCollected,
  p2p3FixCandidateCount: finalResult.p2p3FixCandidateCount
}, null, 2));

if (!finalResult.recommended_sealed) {
  process.exitCode = 1;
}

function checkAuthenticity(input) {
  if (!input) {
    return {
      ownerFeedbackAuthentic: false,
      authenticityFailureReasons: ["owner_feedback_input_missing"]
    };
  }
  const reasons = [];
  if (input.feedbackSource !== "owner") reasons.push("feedbackSource_not_owner");
  if (input.isRealManualTrial !== true) reasons.push("isRealManualTrial_not_true");
  if (!input.trialDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.trialDate)) reasons.push("trialDate_missing_or_invalid");
  if (!(Number(input.trialDurationMinutes) > 0)) reasons.push("trialDurationMinutes_not_positive");
  if (!Array.isArray(input.walkedPaths) || input.walkedPaths.length === 0) reasons.push("walkedPaths_empty");
  if (!Array.isArray(input.tasksTried) || input.tasksTried.length === 0) reasons.push("tasksTried_empty");
  const feedbackArrays = ["whatWorked", "whatFailed", "confusingPoints", "bugsObserved", "visualP2P3Suggestions"];
  if (!feedbackArrays.some((key) => Array.isArray(input[key]) && input[key].length > 0)) reasons.push("feedback_content_empty");
  if ((!Array.isArray(input.evidenceRefs) || input.evidenceRefs.length === 0) && !input.noEvidenceReason) reasons.push("noEvidenceReason_required_when_evidenceRefs_empty");
  return {
    ownerFeedbackAuthentic: reasons.length === 0,
    authenticityFailureReasons: reasons
  };
}

function safety() {
  return {
    providerCallsMade: false,
    rawSecretRead: false,
    secretValueExposed: false,
    authJsonRead: false,
    chatBehaviorChangedByDefault: false,
    chatGatewayExecuteBehaviorChangedByDefault: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false
  };
}
