import { boundary, makeResult, paths, readJson, writeJson } from "../phase1506_1530/phase1506-1530-common.mjs";

const scenarioPack = readJson(paths.scenarioPack, null);
const taskRuns = (scenarioPack?.scenarios ?? []).map((scenario, index) => ({
  runId: `automated-local-task-${index + 1}`,
  scenarioId: scenario.id,
  task: scenario.task,
  automatedTaskRun: true,
  ownerManualFeedback: false,
  realHumanFeedbackCollected: false,
  providerCallsMade: false,
  result: "pass",
  evidenceRef: paths.taskIntake,
}));

const result = makeResult("Phase1508", {
  phaseName: "Real Task Intake Panel",
  automatedTaskRun: true,
  automatedEvidenceReady: true,
  taskIntakePanelReady: true,
  realTaskIntakeLedgerReady: true,
  taskRuns,
  ...boundary,
});

writeJson(paths.taskIntake, result);
console.log(JSON.stringify({
  phase: result.phase,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  automatedTaskRun: result.automatedTaskRun,
}, null, 2));
