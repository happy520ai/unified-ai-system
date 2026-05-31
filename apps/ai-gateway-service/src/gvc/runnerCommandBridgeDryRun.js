const SUPPORTED_COMMANDS = new Set(["pause", "resume", "stop"]);

export function buildRunnerCommandDryRun(commandIntent, options = {}) {
  const normalizedIntent = normalizeCommandIntent(commandIntent);
  const now = options.now ?? new Date().toISOString();
  const currentControl = isPlainObject(options.currentControl) ? options.currentControl : {};

  if (!SUPPORTED_COMMANDS.has(normalizedIntent)) {
    return {
      phaseId: "Phase2023-GVC-Runner-Command-Bridge-DryRun",
      status: "rejected",
      commandIntent: normalizedIntent,
      generatedAt: now,
      reason: "unsupported_command_intent",
      supportedCommandIntents: Array.from(SUPPORTED_COMMANDS),
      wouldWriteControlFile: false,
      realWritePerformed: false,
      processSignalSent: false,
      providerCallsMade: false,
      secretRead: false,
      deployExecuted: false,
      chatModified: false,
      chatGatewayExecuteModified: false,
      legacyModified: false,
      projectContextModified: false,
    };
  }

  const targetControlPatch = buildTargetControlPatch(normalizedIntent, currentControl);

  return {
    phaseId: "Phase2023-GVC-Runner-Command-Bridge-DryRun",
    status: "dry-run-preview",
    commandIntent: normalizedIntent,
    generatedAt: now,
    controlFile: "docs/project-brain/runner-control.json",
    wouldWriteControlFile: true,
    realWritePerformed: false,
    processSignalSent: false,
    runnerStopped: false,
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
    safetyFlags: {
      dryRunOnly: true,
      noProvider: true,
      noSecret: true,
      noDeploy: true,
      noBackgroundServiceRegistration: true,
      noStartupAutoRunRegistration: true,
    },
    targetControlPatch,
    previewSummary: buildPreviewSummary(normalizedIntent),
  };
}

export function buildRunnerCommandDryRunMatrix(options = {}) {
  return ["pause", "resume", "stop"].map((commandIntent) =>
    buildRunnerCommandDryRun(commandIntent, options),
  );
}

function normalizeCommandIntent(commandIntent) {
  return String(commandIntent ?? "").trim().toLowerCase();
}

function buildTargetControlPatch(commandIntent, currentControl) {
  const base = {
    maxTasksPerLoop: Number.isInteger(currentControl.maxTasksPerLoop) ? currentControl.maxTasksPerLoop : 1,
    dryRunOnly: true,
    noProvider: true,
    noSecret: true,
    noDeploy: true,
  };

  if (commandIntent === "pause") {
    return {
      ...base,
      paused: true,
      stopRequested: false,
    };
  }

  if (commandIntent === "resume") {
    return {
      ...base,
      paused: false,
      stopRequested: false,
    };
  }

  return {
    ...base,
    paused: currentControl.paused === true,
    stopRequested: true,
  };
}

function buildPreviewSummary(commandIntent) {
  if (commandIntent === "pause") {
    return "Would set paused=true and stopRequested=false in runner-control.json, but Phase2023 does not write it.";
  }
  if (commandIntent === "resume") {
    return "Would set paused=false and stopRequested=false in runner-control.json, but Phase2023 does not write it.";
  }
  return "Would set stopRequested=true in runner-control.json, but Phase2023 does not write it or stop a process.";
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
