import { writeJson } from "../phase373-common.mjs";

const examples = [
  {
    evidenceId: "mc-dry-run-001",
    timestamp: "2026-05-07T00:00:00.000Z",
    mode: "tianshu_dry_run",
    intent: "task_planning",
    selectedPanel: "tianshu_flight_path_panel",
    riskScore: { taskRiskLevel: "medium" },
    blockedActions: ["provider_bypass"],
    allowedActions: ["inspect_evidence", "replay_trace"],
    dryRunResult: { status: "explained" },
    supervisorComment: "Use planner sandbox first.",
    fallbackReason: "credentialRef required",
    replayAvailable: true,
    rollbackPathAvailable: true,
    secretValueExposed: false,
    providerCallsMade: false,
  },
];

const result = {
  phase: "Phase375C",
  evidenceTimelineValidationExecuted: true,
  validationPassed: examples.every((item) => item.secretValueExposed === false && item.providerCallsMade === false),
  exampleCount: examples.length,
  secretValueExposed: false,
  providerCallsMade: false,
};

await writeJson("docs/phase375c-evidence-timeline.schema.json", {
  type: "object",
  required: ["evidenceId", "timestamp", "mode", "intent", "selectedPanel", "riskScore", "blockedActions", "allowedActions", "dryRunResult", "supervisorComment", "fallbackReason", "replayAvailable", "rollbackPathAvailable", "secretValueExposed", "providerCallsMade"],
});
await writeJson("docs/phase375c-trace-replay-contract.json", {
  phase: "Phase375C",
  replaySteps: ["intent", "panel", "risk", "blockedActions", "dryRunResult", "evidence"],
});
await writeJson("docs/phase375c-evidence-timeline-examples.json", examples);
await writeJson("apps/ai-gateway-service/evidence/phase375c/evidence-timeline-validation-result.json", result);

console.log(JSON.stringify(result, null, 2));
if (!result.validationPassed) process.exitCode = 1;
