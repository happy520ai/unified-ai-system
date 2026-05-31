import {
  boundary,
  makePhaseStatuses,
  makeResult,
  paths,
  phaseDogfoodingDir,
  phaseRange,
  writeJson,
  writeText,
} from "../phase1506_1530/phase1506-1530-common.mjs";

writeJson(paths.localDogfoodingLedgerSchema, {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Phase1506 Local Self-Use Ledger Schema",
  type: "object",
  required: [
    "recordType",
    "date",
    "ownerRecorded",
    "automatedTaskRun",
    "automatedEvidenceNotClaimedAsHuman",
    "providerCallsMade",
    "entries",
  ],
  properties: {
    recordType: { const: "owner_daily_ledger" },
    date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    ownerRecorded: { type: "boolean" },
    automatedTaskRun: { type: "boolean" },
    automatedBrowserWalkthrough: { type: "boolean" },
    automatedScreenshotCaptured: { type: "boolean" },
    automatedTokenSavingMeasured: { type: "boolean" },
    automatedFailureDetected: { type: "boolean" },
    automatedRegressionExecuted: { type: "boolean" },
    automatedEvidenceNotClaimedAsHuman: { const: true },
    ownerManualFeedback: { const: false },
    realHumanFeedbackCollected: { const: false },
    dogfoodingCompleted: { const: false },
    providerCallsMade: { const: false },
    entries: {
      type: "array",
      items: {
        type: "object",
        required: ["taskId", "taskType", "result", "evidenceRef"],
        properties: {
          taskId: { type: "string" },
          taskType: { type: "string" },
          result: { enum: ["pass", "fail", "blocked", "observation_only"] },
          evidenceRef: { type: "string" },
        },
      },
    },
  },
});

writeJson(paths.ownerManualNoteTemplate, {
  recordType: "owner_manual_note_template",
  phaseRange,
  ownerProvided: false,
  ownerManualFeedback: false,
  realHumanFeedbackCollected: false,
  noteDate: "YYYY-MM-DD",
  taskId: "",
  friction: "",
  expectedBehavior: "",
  actualBehavior: "",
  severity: "P3",
  evidenceRef: "",
  codexGeneratedTemplateOnly: true,
  instructions: [
    "Only the owner may change ownerProvided to true.",
    "Codex must not count this template as human feedback.",
    "Do not include API keys, secrets, tokens, webhooks, or raw CredentialRef values.",
  ],
});

writeJson(paths.weeklyReviewTemplate, {
  recordType: "weekly_review_template",
  phaseRange,
  ownerReviewed: false,
  ownerManualFeedback: false,
  realHumanFeedbackCollected: false,
  dogfoodingCompleted: false,
  weekStart: "YYYY-MM-DD",
  weekEnd: "YYYY-MM-DD",
  realDailyLedgerCount: 0,
  automatedEvidenceReviewed: false,
  ownerNotesReviewed: false,
  p0Count: 0,
  p1Count: 0,
  p2Count: 0,
  p3Count: 0,
  decision: "pending_owner_review",
  codexGeneratedTemplateOnly: true,
});

writeJson(`${phaseDogfoodingDir}/daily-ledger/daily-ledger.template.json`, {
  recordType: "owner_daily_ledger",
  phaseRange,
  date: "YYYY-MM-DD",
  ownerRecorded: false,
  automatedTaskRun: false,
  automatedBrowserWalkthrough: false,
  automatedScreenshotCaptured: false,
  automatedTokenSavingMeasured: false,
  automatedFailureDetected: false,
  automatedRegressionExecuted: false,
  automatedEvidenceNotClaimedAsHuman: true,
  ownerManualFeedback: false,
  realHumanFeedbackCollected: false,
  dogfoodingCompleted: false,
  providerCallsMade: false,
  entries: [],
});

writeJson(`${phaseDogfoodingDir}/weekly-review/weekly-review.template.json`, {
  ...JSON.parse(JSON.stringify({
    recordType: "owner_weekly_review",
    phaseRange,
    ownerReviewed: false,
    weekStart: "YYYY-MM-DD",
    weekEnd: "YYYY-MM-DD",
    realDailyLedgerCount: 0,
    automatedEvidenceReviewed: false,
    dogfoodingCompleted: false,
    ownerManualFeedback: false,
    realHumanFeedbackCollected: false,
    decision: "pending_owner_review",
  })),
});

writeJson(`${phaseDogfoodingDir}/owner-notes/owner-manual-note.template.json`, {
  recordType: "owner_manual_note",
  phaseRange,
  ownerProvided: false,
  ownerManualFeedback: false,
  realHumanFeedbackCollected: false,
  dogfoodingCompleted: false,
  note: "",
});

writeText(paths.dailyStartFlowDoc, `# Phase1506-1530 Local Self-Use Daily Start Flow

- Run Phase632 preflight before local dogfooding work.
- Review latest Phase1506-1530 evidence index.
- Confirm providerCallsMade=false unless a later explicit gate authorizes real provider testing.
- Start with automated local trial scenarios only.
- Do not mark ownerManualFeedback=true from automation.
`);

writeText(paths.endOfDayReviewFlowDoc, `# Phase1506-1530 End-of-Day Review Flow

- Record automated task outcomes in evidence only.
- Add owner notes only from an owner-provided manual note file.
- Classify P0/P1/P2/P3 issues without changing /chat or /chat-gateway/execute.
- Keep dogfoodingCompleted=false until sufficient real owner records exist.
`);

writeJson(paths.oneWeekClosureTemplate, {
  recordType: "one_week_closure_template",
  phaseRange,
  ownerReviewed: false,
  dogfoodingCompleted: false,
  realHumanFeedbackCollected: false,
  minimumRealDailyLedgerCountRequired: 5,
  codexGeneratedTemplateOnly: true,
});

writeJson(paths.twoWeekClosureTemplate, {
  recordType: "two_week_closure_template",
  phaseRange,
  ownerReviewed: false,
  dogfoodingCompleted: false,
  realHumanFeedbackCollected: false,
  minimumRealDailyLedgerCountRequired: 10,
  codexGeneratedTemplateOnly: true,
});

writeJson(paths.repairQueueTemplate, {
  recordType: "repair_queue_template",
  phaseRange,
  p0: [],
  p1: [],
  p2: [],
  p3: [],
  highRiskRepairAutoExecuted: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
});

writeJson(paths.scenarioPack, {
  recordType: "automated_trial_scenario_pack",
  phaseRange,
  scenarios: [
    {
      id: "local-task-intake-preview",
      task: "Open Mission Control and inspect dogfooding framework state.",
      expected: "local-only preview, no provider call, evidence recorded",
    },
    {
      id: "token-saving-counter-preview",
      task: "Compare bounded relevant-file read scope against broad scan estimate.",
      expected: "token saving estimate recorded as automated metric only",
    },
    {
      id: "failure-friction-ledger-preview",
      task: "Classify synthetic friction observations into P0/P1/P2/P3 repair queue.",
      expected: "issues classified without claiming owner feedback",
    },
  ],
  providerCallsMade: false,
  automatedEvidenceNotClaimedAsHuman: true,
});

writeText(paths.knownLimitsDoc, `# Phase1506-1530 Local Dogfooding Known Limits

- dogfoodingFrameworkReady=true means the framework, templates, automated local trial, and classifier exist.
- dogfoodingCompleted=false until enough real owner daily/weekly records exist.
- ownerManualFeedback=false unless owner provided manual note.
- realHumanFeedbackCollected=false unless an external human record exists.
- automated evidence is not human feedback.
- No Provider call, secret read, auth.json read, /chat change, /chat-gateway/execute change, deploy, release, tag, artifact upload, push, or commit is allowed in this phase.
- This phase must not claim production readiness.
`);

writeText(paths.phaseReport, `# Phase1506-1530 Local Dogfooding Framework Seal Report

## Scope

- phaseRange=Phase1506-1530AIO
- routeChoice=local_self_use_only
- dogfoodingFrameworkReady=true is the sealable scope.
- automated local trial, token saving counter, failure/friction ledger, issue classifier, manual note schema, and closure templates are in scope.

## Claim Boundary

- ownerManualFeedback=false unless owner provided manual note.
- realHumanFeedbackCollected=false unless an external human record exists.
- dogfoodingCompleted=false before sufficient real owner records exist.
- automated evidence is not human feedback.
- automated browser walkthrough is not manual operator feedback.

## Safety Boundary

- providerCallsMade=false
- authJsonRead=false
- rawCredentialRefRead=false
- secretValueExposed=false
- chatModified=false
- chatGatewayExecuteModified=false
- deployExecuted=false
- releaseExecuted=false
- tagCreated=false
- artifactUploaded=false
- pushExecuted=false
- commitCreated=false
- productionReadyClaimed=false
`);

const result = makeResult("Phase1506", {
  phaseName: "Owner Daily Dogfooding Ledger v1",
  dogfoodingFrameworkReady: true,
  ownerManualNoteSchemaReady: true,
  weeklyReviewSchemaReady: true,
  realDailyLedgerCount: 0,
  realOwnerFeedbackCount: 0,
  frameworkDocs: [
    paths.localDogfoodingLedgerSchema,
    paths.ownerManualNoteTemplate,
    paths.weeklyReviewTemplate,
    paths.knownLimitsDoc,
    paths.dailyStartFlowDoc,
    paths.endOfDayReviewFlowDoc,
  ],
  phaseStatuses: makePhaseStatuses(null),
  ...boundary,
});

writeJson(paths.frameworkResult, result);

console.log(JSON.stringify({
  phase: result.phase,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  dogfoodingFrameworkReady: result.dogfoodingFrameworkReady,
}, null, 2));
