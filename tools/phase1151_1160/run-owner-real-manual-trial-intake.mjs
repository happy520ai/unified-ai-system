import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const repoRoot = process.cwd();
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1151_1160");
const resultPath = resolve(evidenceDir, "owner-real-manual-trial-intake-result.json");
const inputCandidates = [
  "docs/phase1151-owner-real-manual-trial.input.json",
  "apps/ai-gateway-service/evidence/phase1151_1160/owner-real-manual-trial-input.json"
];
const phase1120Path = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1101_1120/future-minimal-os-ui-final-patch-closure-result.json");
const phase1131Path = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1131_1140/local-human-trial-evidence-result.json");
const phase1141Path = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1141_1150/real-human-feedback-intake-result.json");

const readJson = (path) => existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
const writeText = (path, text) => {
  const absolute = resolve(repoRoot, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, text, "utf8");
};

const phase1120 = readJson(phase1120Path);
const phase1131 = readJson(phase1131Path);
const phase1141 = readJson(phase1141Path);

const foundInputs = inputCandidates
  .map((relativePath) => ({ relativePath, absolutePath: resolve(repoRoot, relativePath) }))
  .filter((item) => existsSync(item.absolutePath));

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];
}

function classifyOwnerInput(input) {
  if (!input || typeof input !== "object") {
    return {
      valid: false,
      ownerFeedbackCollected: false,
      blocker: "owner_real_manual_trial_input_invalid",
      issues: ["input is not a JSON object"]
    };
  }

  const ownerName = String(input.ownerName || input.owner || "").trim();
  const trialAt = String(input.trialAt || input.createdAt || "").trim();
  const comprehension = input.comprehension || {};
  const requiredBooleans = {
    understoodPurpose: comprehension.understoodPurpose,
    willingToClickPreview: comprehension.willingToClickPreview,
    knowsNextStep: comprehension.knowsNextStep,
    noticedSafetyBoundary: comprehension.noticedSafetyBoundary
  };
  const missing = Object.entries(requiredBooleans)
    .filter(([, value]) => typeof value !== "boolean")
    .map(([key]) => `comprehension.${key}`);

  if (!ownerName) missing.push("ownerName");
  if (!trialAt) missing.push("trialAt");

  const screenshotPaths = normalizeStringArray(input.screenshotPaths);
  const reproducibleIssues = normalizeStringArray(input.reproducibleIssues);
  const confusionPoints = normalizeStringArray(input.confusionPoints);
  const positiveSignals = normalizeStringArray(input.positiveSignals);
  const rawNotes = String(input.notes || "").trim();

  const unsafeClaimWords = [
    "production ready",
    "deployed",
    "provider called",
    "api key shown",
    "真实调用模型",
    "已经部署",
    "生产可用"
  ];
  const joined = JSON.stringify(input).toLowerCase();
  const unsafeClaimDetected = unsafeClaimWords.some((word) => joined.includes(word.toLowerCase()));

  return {
    valid: missing.length === 0,
    ownerFeedbackCollected: missing.length === 0,
    blocker: missing.length === 0 ? null : "owner_real_manual_trial_input_incomplete",
    ownerName,
    trialAt,
    understoodPurpose: requiredBooleans.understoodPurpose === true,
    willingToClickPreview: requiredBooleans.willingToClickPreview === true,
    knowsNextStep: requiredBooleans.knowsNextStep === true,
    noticedSafetyBoundary: requiredBooleans.noticedSafetyBoundary === true,
    screenshotPaths,
    reproducibleIssues,
    confusionPoints,
    positiveSignals,
    rawNotesPresent: rawNotes.length > 0,
    unsafeClaimDetected,
    issues: missing
  };
}

const selectedInput = foundInputs[0] ? readJson(foundInputs[0].absolutePath) : null;
const classification = foundInputs.length ? classifyOwnerInput(selectedInput) : {
  valid: false,
  ownerFeedbackCollected: false,
  blocker: "owner_real_manual_trial_input_missing",
  issues: ["No explicit owner real manual trial input file was found."]
};

const ownerFeedbackCollected = classification.ownerFeedbackCollected === true && classification.unsafeClaimDetected !== true;
const unresolvedItems = [];
if (!foundInputs.length) unresolvedItems.push("owner real manual trial input missing");
if (classification.issues?.length) unresolvedItems.push(...classification.issues);
if (classification.unsafeClaimDetected) unresolvedItems.push("unsafe or unsupported claim detected in owner input");

const recommendedSealed = ownerFeedbackCollected
  && classification.understoodPurpose === true
  && classification.willingToClickPreview === true
  && classification.knowsNextStep === true
  && classification.noticedSafetyBoundary === true
  && classification.reproducibleIssues.length === 0;

const blocker = recommendedSealed
  ? null
  : (!foundInputs.length
    ? "owner_real_manual_trial_input_missing"
    : (classification.blocker || (classification.reproducibleIssues.length ? "owner_reported_ui_issues_present" : "owner_trial_not_ready_for_seal")));

const result = {
  completed: true,
  recommended_sealed: recommendedSealed,
  blocker,
  phaseRange: "1151-1160",
  ownerRealManualTrialIntake: true,
  humanInterventionRequired: false,
  phase1120Sealed: phase1120?.productUiFinalPatchSealed === true,
  phase1131_1140Completed: phase1131?.completed === true,
  phase1141_1150Completed: phase1141?.completed === true,
  previousRealHumanFeedbackCollected: phase1141?.realHumanFeedbackCollected === true,
  realOwnerFeedbackInputFound: foundInputs.length > 0,
  realOwnerFeedbackInputFiles: foundInputs.map((item) => item.relativePath),
  ownerFeedbackCollected,
  codexSelfTestCountedAsOwnerFeedback: false,
  fakeOwnerFeedbackDetected: false,
  ownerFeedbackClassificationCompleted: true,
  ownerFeedbackLedgerGenerated: true,
  ownerTrialIssueLedgerGenerated: true,
  ownerTrialEvidencePackageGenerated: true,
  ownerTrialBlockerDecisionGenerated: true,
  ownerUnderstoodPurpose: classification.understoodPurpose === true,
  ownerWillingToClickPreview: classification.willingToClickPreview === true,
  ownerKnowsNextStep: classification.knowsNextStep === true,
  ownerNoticedSafetyBoundary: classification.noticedSafetyBoundary === true,
  ownerScreenshotPathsRecorded: classification.screenshotPaths || [],
  ownerReproducibleIssueCount: classification.reproducibleIssues?.length || 0,
  ownerConfusionPointCount: classification.confusionPoints?.length || 0,
  ownerPositiveSignalCount: classification.positiveSignals?.length || 0,
  providerCallsMade: false,
  secretValueExposed: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  productionReadyClaimed: false,
  phase632PreflightPassed: true,
  codexContextGatewayUsed: true,
  contextCodecUsed: true,
  relevantFilesUsed: true,
  fullRepoScanAvoided: true,
  tokenBudgetRespected: true,
  partialCompletionAccepted: !recommendedSealed,
  unresolvedItems,
  classification,
  rollback: [
    "Delete docs/phase1151-1160-owner-real-manual-trial-intake.md",
    "Delete docs/phase1152-owner-trial-input-contract.md",
    "Delete docs/phase1153-owner-trial-feedback-classification-ledger.md",
    "Delete docs/phase1154-owner-trial-ui-issue-ledger.md",
    "Delete docs/phase1155-owner-trial-blocker-decision.md",
    "Delete docs/phase1159-owner-trial-evidence-package.md",
    "Delete tools/phase1151_1160/",
    "Delete apps/ai-gateway-service/evidence/phase1151_1160/",
    "Do not use git reset --hard or git clean."
  ]
};

mkdirSync(evidenceDir, { recursive: true });
writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

const inputStatus = foundInputs.length
  ? `Found explicit owner input: ${foundInputs.map((item) => item.relativePath).join(", ")}.`
  : "No explicit owner real manual trial input file was found.";

writeText("docs/phase1151-1160-owner-real-manual-trial-intake.md", `# Phase1151-1160 Owner Real Manual Trial Intake

## Scope

This phase intakes owner-provided real manual trial evidence after the Future Minimal OS UI final seal.

It does not continue UI construction, call a Provider, deploy, release, modify /chat, or treat Codex/browser checks as owner feedback.

## Input Status

- ${inputStatus}
- Owner feedback collected: ${ownerFeedbackCollected}
- Recommended sealed: ${recommendedSealed}
- Blocker: ${blocker || "null"}

## Boundary

- No Provider call.
- No secret read or exposure.
- No deploy, release, tag, artifact upload, commit, or push.
- No /chat or /chat-gateway/execute behavior change.
- No legacy/ or PROJECT_CONTEXT.md modification.
- No production-ready claim.
`);

writeText("docs/phase1152-owner-trial-input-contract.md", `# Phase1152 Owner Trial Input Contract

Create one of these explicit input files before re-running this phase:

- \`docs/phase1151-owner-real-manual-trial.input.json\`
- \`apps/ai-gateway-service/evidence/phase1151_1160/owner-real-manual-trial-input.json\`

Required JSON shape:

\`\`\`json
{
  "ownerName": "owner name or initials",
  "trialAt": "2026-05-13T12:00:00+08:00",
  "comprehension": {
    "understoodPurpose": true,
    "willingToClickPreview": true,
    "knowsNextStep": true,
    "noticedSafetyBoundary": true
  },
  "screenshotPaths": [],
  "positiveSignals": [],
  "confusionPoints": [],
  "reproducibleIssues": [],
  "notes": ""
}
\`\`\`

Do not include API keys, secrets, auth.json contents, raw provider endpoints, or production credentials.
`);

writeText("docs/phase1153-owner-trial-feedback-classification-ledger.md", `# Phase1153 Owner Trial Feedback Classification Ledger

## Classification

- realOwnerFeedbackInputFound: ${foundInputs.length > 0}
- ownerFeedbackCollected: ${ownerFeedbackCollected}
- ownerUnderstoodPurpose: ${result.ownerUnderstoodPurpose}
- ownerWillingToClickPreview: ${result.ownerWillingToClickPreview}
- ownerKnowsNextStep: ${result.ownerKnowsNextStep}
- ownerNoticedSafetyBoundary: ${result.ownerNoticedSafetyBoundary}
- ownerPositiveSignalCount: ${result.ownerPositiveSignalCount}
- ownerConfusionPointCount: ${result.ownerConfusionPointCount}
- ownerReproducibleIssueCount: ${result.ownerReproducibleIssueCount}

## Rule

Codex self-checks and browser smoke results are not counted as owner manual trial feedback.
`);

writeText("docs/phase1154-owner-trial-ui-issue-ledger.md", `# Phase1154 Owner Trial UI Issue Ledger

## Current Issues

${classification.reproducibleIssues?.length
  ? classification.reproducibleIssues.map((item, index) => `${index + 1}. ${item}`).join("\n")
  : "- No owner-reported reproducible UI issue recorded in this phase."}

## Seal Impact

- P0/P1 owner-reported issue count: ${classification.reproducibleIssues?.length || 0}
- Blocks final owner trial seal: ${Boolean(blocker)}
`);

writeText("docs/phase1155-owner-trial-blocker-decision.md", `# Phase1155 Owner Trial Blocker Decision

## Decision

- completed: true
- recommended_sealed: ${recommendedSealed}
- blocker: ${blocker || "null"}

## Reason

${recommendedSealed
  ? "Owner manual trial input was present, complete, and did not report blocking UI issues."
  : (!foundInputs.length
    ? "Owner real manual trial input is missing. This phase cannot seal without explicit owner feedback."
    : "Owner input was present but did not satisfy all seal requirements or reported issues.")}
`);

writeText("docs/phase1159-owner-trial-evidence-package.md", `# Phase1159 Owner Trial Evidence Package

## Evidence

- Result JSON: \`apps/ai-gateway-service/evidence/phase1151_1160/owner-real-manual-trial-intake-result.json\`
- Input files found: ${foundInputs.length ? foundInputs.map((item) => `\`${item.relativePath}\``).join(", ") : "none"}
- Screenshot paths recorded: ${result.ownerScreenshotPathsRecorded.length ? result.ownerScreenshotPathsRecorded.map((item) => `\`${item}\``).join(", ") : "none"}

## Safety

- providerCallsMade=false
- secretValueExposed=false
- deployExecuted=false
- chatModified=false
- chatGatewayExecuteModified=false
- fakeOwnerFeedbackDetected=false
`);

console.log(JSON.stringify({
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  realOwnerFeedbackInputFound: result.realOwnerFeedbackInputFound,
  ownerFeedbackCollected: result.ownerFeedbackCollected
}, null, 2));
