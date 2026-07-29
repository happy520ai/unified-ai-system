export const fullyAutomatedLoopPhaseDefinitions = {
  "phase-225a-agent-workforce-auto-save-latest-plan": {
    conclusion: "agent-workforce-auto-save-latest-plan-complete",
    runAutoSaveTrial: true,
  },
  "phase-226a-goal-to-handoff-automation": {
    conclusion: "goal-to-handoff-automation-complete",
    scriptPath: "tools/agent-workforce/goal-to-codex-handoff.ps1",
    runGoalToHandoffTrial: true,
  },
  "phase-227a-auto-result-waiter-importer": {
    conclusion: "auto-result-waiter-importer-complete",
    scriptPath: "tools/agent-workforce/wait-and-import-codex-result.ps1",
    runWaitImportTrial: true,
  },
  "phase-228a-one-click-manual-bridge-loop": {
    conclusion: "one-click-manual-bridge-loop-complete",
    scriptPath: "tools/agent-workforce/run-manual-bridge-loop.ps1",
    runManualLoopTrial: true,
  },
  "phase-229a-controlled-codex-exec-auto-loop": {
    conclusion: "controlled-codex-exec-auto-loop-dry-run-complete",
    scriptPath: "tools/agent-workforce/run-controlled-codex-auto-loop.ps1",
    runControlledDryRunTrial: true,
  },
  "phase-230a-desktop-fully-automated-control-bat": {
    conclusion: "desktop-fully-automated-control-bat-complete",
    checkDesktopBat: true,
  },
  "phase-231a-auto-loop-documentation": {
    conclusion: "auto-loop-documentation-complete",
    checkDocs: true,
  },
  "phase-232a-fully-automated-controlled-loop-closure": {
    conclusion: "fully-automated-controlled-loop-closure-complete",
    checkClosure: true,
    requiredEvidence: [
      "phase-225a-agent-workforce-auto-save-latest-plan",
      "phase-226a-goal-to-handoff-automation",
      "phase-227a-auto-result-waiter-importer",
      "phase-228a-one-click-manual-bridge-loop",
      "phase-229a-controlled-codex-exec-auto-loop",
      "phase-230a-desktop-fully-automated-control-bat",
      "phase-231a-auto-loop-documentation",
    ],
  },
};
