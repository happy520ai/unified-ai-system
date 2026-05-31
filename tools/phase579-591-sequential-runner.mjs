import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFinalPhase591Reports } from "./phase579-591-hardening-subphase-runner.mjs";
import { hardeningGroups, hardeningSafetyBoundary } from "./phase579-591-hardening-registry.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const options = parseArgs(process.argv.slice(2));
const commandTimeoutMs = Number(process.env.PHASE_HARDENING_COMMAND_TIMEOUT_MS || options.timeoutMs || 15 * 60 * 1000);
const heartbeatIntervalMs = Number(process.env.PHASE_HARDENING_HEARTBEAT_MS || 30 * 1000);
const timeoutFallbackMs = 10 * 1000;

const groupsToRun = options.runAll
  ? hardeningGroups
  : hardeningGroups.filter((group) => group.key === options.selectedGroup);

if (groupsToRun.length === 0) {
  throw new Error(`No matching Phase579-591 group found for ${options.selectedGroup || "--all"}`);
}

const stopConditions = [
  ["completed", true],
  ["recommended_sealed", true],
  ["blocker", null],
  ["providerCallsMade", false],
  ["rawSecretAccessed", false],
  ["secretValueExposed", false],
  ["rawWebhookAccessed", false],
  ["realFeishuMessageSent", false],
  ["realWeComMessageSent", false],
  ["chatModified", false],
  ["chatGatewayExecuteModified", false],
  ["deployExecuted", false],
  ["releaseExecuted", false],
  ["tagCreated", false],
  ["artifactUploaded", false],
  ["characterModuleRestored", false],
];

const topReport = {
  phaseRange: options.runAll ? "Phase579A-T - Phase591A-T" : `${groupsToRun[0].key.toUpperCase()}A-T`,
  completed: false,
  recommended_sealed: false,
  blocker: null,
  safetyBoundary: { ...hardeningSafetyBoundary },
  ...hardeningSafetyBoundary,
  groups: [],
  runnerOptions: {
    resume: options.resume,
    from: options.fromKey,
    only: options.onlyKey,
    force: options.force,
    commandTimeoutMs,
    heartbeatIntervalMs,
    timeoutFallbackMs,
  },
};

for (const group of groupsToRun) {
  const groupReport = {
    group: `Phase${group.number}A-T`,
    title: group.title,
    completed: false,
    recommended_sealed: false,
    blocker: null,
    safetyBoundary: { ...hardeningSafetyBoundary },
    ...hardeningSafetyBoundary,
    phases: [],
  };

  if (options.fromKey && !options.onlyKey) {
    for (const phase of phasesBeforeFromForGroup(group)) {
      const existing = await readVerifiedPhaseEvidence(phase);
      if (!existing.verified) {
        groupReport.blocker = `${phase.key}_prior_phase_not_verified_for_from`;
        topReport.blocker = groupReport.blocker;
        groupReport.phases.push({
          phase: phase.phase,
          completed: false,
          evidenceJson: phase.evidencePath,
          resumedFromExistingEvidence: false,
        });
        await writeTopReport(topReport, groupReport);
        printJson(topReport);
        process.exitCode = 1;
        process.exit();
      }
      groupReport.phases.push({
        phase: phase.phase,
        completed: true,
        evidenceJson: phase.evidencePath,
        resumedFromExistingEvidence: true,
        requiredVerificationResults: existing.evidence.requiredVerificationResults,
        autoContinueConditions: existing.evidence.sequenceExecution?.autoContinueConditions || [],
      });
    }
    await writeTopReport(topReport, groupReport);
  }

  const phases = selectPhasesForGroup(group);
  for (const phase of phases) {
    if ((options.resume || options.fromKey || options.onlyKey) && !options.force) {
      const existing = await readVerifiedPhaseEvidence(phase);
      if (existing.verified) {
        console.log(`[phase-runner] resume-skip currentGroup=${group.key} currentSubphase=${phase.key} evidence="${phase.evidencePath}"`);
        groupReport.phases.push({
          phase: phase.phase,
          completed: true,
          evidenceJson: phase.evidencePath,
          resumedFromExistingEvidence: true,
          requiredVerificationResults: existing.evidence.requiredVerificationResults,
          autoContinueConditions: existing.evidence.sequenceExecution?.autoContinueConditions || [],
        });
        await writeTopReport(topReport, groupReport);
        continue;
      }
    }

    const requiredVerificationResults = [];
    for (const item of buildCommandsForPhase(phase)) {
      const result = await runCommand(item, { group, phase });
      requiredVerificationResults.push(result);
      if (result.exitCode !== 0) {
        await finalizePhaseEvidenceIfPresent(phase, requiredVerificationResults, {
          autoContinueAllowed: false,
          failedCommand: result.label,
          commandTimedOut: result.timedOut === true,
        });
        groupReport.blocker = `${phase.key}_${result.label.replaceAll(/[^\w]+/g, "_")}_${result.timedOut ? "timeout" : "failed"}`;
        await writeFailureEvidence(phase, requiredVerificationResults, {
          blocker: groupReport.blocker,
          failedCommand: result.label,
          commandTimedOut: result.timedOut === true,
        });
        groupReport.phases.push({ phase: phase.phase, completed: false, requiredVerificationResults });
        topReport.blocker = groupReport.blocker;
        await writeTopReport(topReport, groupReport);
        printJson(topReport);
        process.exitCode = 1;
        process.exit();
      }
    }

    const evidence = await readPhaseEvidence(phase);
    const autoContinueConditions = buildAutoContinueConditions(evidence);
    const autoContinueAllowed = autoContinueConditions.every((item) => item.passed);
    await finalizePhaseEvidenceIfPresent(phase, requiredVerificationResults, {
      autoContinueAllowed,
      autoContinueConditions,
    });
    groupReport.phases.push({
      phase: phase.phase,
      completed: autoContinueAllowed,
      evidenceJson: phase.evidencePath,
      requiredVerificationResults,
      autoContinueConditions,
    });
    await writeTopReport(topReport, groupReport);

    if (!autoContinueAllowed) {
      groupReport.blocker = `${phase.key}_auto_continue_conditions_failed`;
      topReport.blocker = groupReport.blocker;
      await writeTopReport(topReport, groupReport);
      printJson(topReport);
      process.exitCode = 1;
      process.exit();
    }
  }

  if (!options.onlyKey) {
    const groupTailResults = [];
    for (const item of [
      command("pnpm sync:readme-agents-current-state", "cmd", ["/c", "pnpm", "sync:readme-agents-current-state"]),
      command("pnpm verify:phase306c-readme-agents-auto-sync-guard", "cmd", [
        "/c",
        "pnpm",
        "verify:phase306c-readme-agents-auto-sync-guard",
      ]),
    ]) {
      const result = await runCommand(item, { group, phase: { key: `${group.key}-tail`, phase: `${group.key.toUpperCase()} tail` } });
      groupTailResults.push(result);
      if (result.exitCode !== 0) {
        groupReport.blocker = `${group.key}_${result.label.replaceAll(/[^\w]+/g, "_")}_${result.timedOut ? "timeout" : "failed"}`;
        groupReport.groupTailVerificationResults = groupTailResults;
        topReport.blocker = groupReport.blocker;
        await writeTopReport(topReport, groupReport);
        printJson(topReport);
        process.exitCode = 1;
        process.exit();
      }
    }
    groupReport.groupTailVerificationResults = groupTailResults;
  }

  groupReport.completed = groupReport.phases.every((item) => item.completed === true);
  groupReport.recommended_sealed = groupReport.completed;
  await writeTopReport(topReport, groupReport);
}

if (options.runAll && !options.onlyKey) {
  const finalResult = await buildFinalPhase591Reports();
  topReport.finalReports = [
    "docs/phase591-final-system-stability-report.md",
    "docs/phase591-final-architecture-safety-report.md",
    "docs/phase591-final-maintenance-readiness-report.md",
    "apps/ai-gateway-service/evidence/phase591/final-system-stability-result.json",
  ];
  topReport.finalResult = finalResult;
}

topReport.completed = topReport.groups.every((group) => group.completed === true);
topReport.recommended_sealed = topReport.completed;
await writeTopReport(topReport);
printJson(topReport);

function parseArgs(rawArgs) {
  const selectedGroup = rawArgs.find((item) => /^phase(579|580|581|582|583|584|585|586|587|588|589|590|591)$/i.test(item))?.toLowerCase();
  return {
    selectedGroup,
    runAll: rawArgs.includes("--all") || !selectedGroup,
    resume: rawArgs.includes("--resume"),
    force: rawArgs.includes("--force"),
    fromKey: valueAfter(rawArgs, "--from")?.toLowerCase() || null,
    onlyKey: valueAfter(rawArgs, "--only")?.toLowerCase() || null,
    timeoutMs: valueAfter(rawArgs, "--timeout-ms"),
  };
}

function valueAfter(rawArgs, flag) {
  const index = rawArgs.indexOf(flag);
  if (index === -1) return null;
  return rawArgs[index + 1] || null;
}

function selectPhasesForGroup(group) {
  let phases = group.subphases;
  if (options.onlyKey) {
    phases = phases.filter((phase) => phase.key === options.onlyKey);
  } else if (options.fromKey) {
    const startIndex = phases.findIndex((phase) => phase.key === options.fromKey);
    if (startIndex === -1) throw new Error(`--from ${options.fromKey} is not part of ${group.key}`);
    phases = phases.slice(startIndex);
  }
  if (options.onlyKey && phases.length === 0) {
    throw new Error(`--only ${options.onlyKey} is not part of ${group.key}`);
  }
  return phases;
}

function phasesBeforeFromForGroup(group) {
  const startIndex = group.subphases.findIndex((phase) => phase.key === options.fromKey);
  if (startIndex === -1) throw new Error(`--from ${options.fromKey} is not part of ${group.key}`);
  return group.subphases.slice(0, startIndex);
}

function buildCommandsForPhase(phase) {
  const commands = [
    command("pnpm -r --if-present check", "cmd", ["/c", "pnpm", "-r", "--if-present", "check"]),
    command("node --check corresponding verifier", "node", ["--check", phase.verifierPath]),
    command("node corresponding verifier", "node", [phase.verifierPath]),
    command("pnpm verify:phase107a-secret-safety", "cmd", ["/c", "pnpm", "verify:phase107a-secret-safety"]),
    command("pnpm verify:phase321a-workbench-product-recovery", "cmd", [
      "/c",
      "pnpm",
      "verify:phase321a-workbench-product-recovery",
    ]),
    command("pnpm -r --if-present check", "cmd", ["/c", "pnpm", "-r", "--if-present", "check"]),
  ];

  if (phase.missionControlUi) {
    commands.push(
      command("pnpm smoke:phase308a-desktop-workbench-ui", "cmd", ["/c", "pnpm", "smoke:phase308a-desktop-workbench-ui"]),
      command("node tools/phase574r2/validate-first-screen-sample-entry-ux-lock.mjs", "node", [
        "tools/phase574r2/validate-first-screen-sample-entry-ux-lock.mjs",
      ]),
      command("node tools/phase576e/validate-mission-control-workforce-preview-ui.mjs", "node", [
        "tools/phase576e/validate-mission-control-workforce-preview-ui.mjs",
      ]),
      command("pnpm verify:phase578p-mission-control-branch-preview-ui", "cmd", [
        "/c",
        "pnpm",
        "verify:phase578p-mission-control-branch-preview-ui",
      ]),
      command("pnpm verify:phase578q-ui-action-wiring-no-dead-buttons", "cmd", [
        "/c",
        "pnpm",
        "verify:phase578q-ui-action-wiring-no-dead-buttons",
      ]),
    );
  }

  if (phase.workforceBranchFabric) {
    commands.push(
      command("node tools/phase576f/validate-real-task-workforce-dry-run-no-provider.mjs", "node", [
        "tools/phase576f/validate-real-task-workforce-dry-run-no-provider.mjs",
      ]),
      command("pnpm verify:phase578a-t-unified-io-branch-execution-fabric", "cmd", [
        "/c",
        "pnpm",
        "verify:phase578a-t-unified-io-branch-execution-fabric",
      ]),
    );
  }
  return commands;
}

function command(label, executable, args) {
  return { label, executable, args };
}

async function runCommand(item, context) {
  const startedAt = Date.now();
  const commandText = [item.executable, ...item.args].join(" ");
  console.log(`[phase-runner] start currentGroup=${context.group.key} currentSubphase=${context.phase.key} currentCommand="${item.label}" timeoutMs=${commandTimeoutMs}`);
  let stdout = "";
  let stderr = "";
  let timedOut = false;
  const child = spawn(item.executable, item.args, {
    cwd: repoRoot,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const heartbeat = setInterval(() => {
    console.log(`[phase-runner] heartbeat currentGroup=${context.group.key} currentSubphase=${context.phase.key} currentCommand="${item.label}" elapsedMs=${Date.now() - startedAt}`);
  }, heartbeatIntervalMs);

  const timeout = setTimeout(() => {
    timedOut = true;
    console.error(`[phase-runner] timeout currentGroup=${context.group.key} currentSubphase=${context.phase.key} currentCommand="${item.label}" elapsedMs=${Date.now() - startedAt}`);
    terminateProcessTree(child.pid);
  }, commandTimeoutMs);

  child.stdout.on("data", (chunk) => {
    const text = String(chunk);
    stdout += text;
    process.stdout.write(text);
  });
  child.stderr.on("data", (chunk) => {
    const text = String(chunk);
    stderr += text;
    process.stderr.write(text);
  });

  const exitCode = await new Promise((resolveExit) => {
    let resolved = false;
    const finish = (code) => {
      if (resolved) return;
      resolved = true;
      resolveExit(code);
    };
    child.on("error", (error) => {
      stderr += `${error.stack || error.message}\n`;
      finish(1);
    });
    child.on("close", (code, signal) => {
      if (timedOut) finish(124);
      else if (typeof code === "number") finish(code);
      else finish(signal ? 1 : 0);
    });
    setTimeout(() => {
      if (!timedOut) return;
      stderr += "timeout fallback resolved after process tree termination\n";
      finish(124);
    }, commandTimeoutMs + timeoutFallbackMs).unref();
  });

  clearInterval(heartbeat);
  clearTimeout(timeout);
  const result = {
    label: item.label,
    command: commandText,
    exitCode,
    timedOut,
    durationMs: Date.now() - startedAt,
    stdoutTail: tail(redact(stdout)),
    stderrTail: tail(redact(stderr)),
  };
  console.log(`[phase-runner] end currentGroup=${context.group.key} currentSubphase=${context.phase.key} currentCommand="${item.label}" exitCode=${exitCode} elapsedMs=${result.durationMs}`);
  return result;
}

function terminateProcessTree(pid) {
  if (!pid) return;
  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    killer.stdout.on("data", (chunk) => process.stdout.write(String(chunk)));
    killer.stderr.on("data", (chunk) => process.stderr.write(String(chunk)));
    return;
  }
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Process already ended.
    }
  }
  setTimeout(() => {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // Process already ended.
      }
    }
  }, 5000).unref();
}

async function readPhaseEvidence(phase) {
  return JSON.parse(await readFile(resolve(repoRoot, phase.evidencePath), "utf8"));
}

async function readVerifiedPhaseEvidence(phase) {
  const path = resolve(repoRoot, phase.evidencePath);
  if (!existsSync(path)) return { verified: false, evidence: null };
  const evidence = JSON.parse(await readFile(path, "utf8"));
  const results = Array.isArray(evidence.requiredVerificationResults) ? evidence.requiredVerificationResults : [];
  const expectedMinimum = 6 + (phase.missionControlUi ? 5 : 0) + (phase.workforceBranchFabric ? 2 : 0);
  const verified =
    evidence.completed === true &&
    evidence.recommended_sealed === true &&
    evidence.blocker === null &&
    evidence.sequenceExecution?.autoContinueAllowed === true &&
    results.length >= expectedMinimum &&
    results.every((item) => item.exitCode === 0);
  return { verified, evidence };
}

async function finalizePhaseEvidenceIfPresent(phase, requiredVerificationResults, extra) {
  const path = resolve(repoRoot, phase.evidencePath);
  if (!existsSync(path)) return;
  const evidence = JSON.parse(await readFile(path, "utf8"));
  evidence.requiredVerificationResults = requiredVerificationResults;
  evidence.sequenceExecution = {
    phaseRange: `Phase${phase.groupNumber}A-T`,
    requiredBaseChecksExecuted: requiredVerificationResults.every((item) => item.exitCode === 0),
    missionControlUiChecksExecuted: phase.missionControlUi === true,
    workforceBranchFabricChecksExecuted: phase.workforceBranchFabric === true,
    ...extra,
  };
  await writeFile(path, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}

async function writeFailureEvidence(phase, requiredVerificationResults, failure) {
  const path = resolve(repoRoot, phase.evidencePath);
  const existing = existsSync(path) ? JSON.parse(await readFile(path, "utf8")) : {};
  const evidence = {
    phase: phase.phase,
    phaseKey: phase.key,
    group: `Phase${phase.groupNumber}A-T`,
    groupTitle: phase.groupTitle,
    name: phase.name,
    ...existing,
    completed: false,
    recommended_sealed: false,
    blocker: failure.blocker,
    docs: [phase.docPath],
    evidenceJson: phase.evidencePath,
    verifier: phase.verifierPath,
    verifierResult: "failed",
    executionReport: phase.reportPath,
    modifiedFiles: Array.isArray(existing.modifiedFiles)
      ? existing.modifiedFiles
      : [phase.docPath, phase.reportPath, phase.verifierPath, phase.evidencePath],
    safetyBoundary: { ...hardeningSafetyBoundary },
    rollbackNote:
      existing.rollbackNote ||
      `Remove ${phase.docPath}, ${phase.reportPath}, ${phase.verifierPath}, and ${phase.evidencePath}; keep legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.`,
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
    rawWebhookAccessed: false,
    realFeishuMessageSent: false,
    realWeComMessageSent: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    characterModuleRestored: false,
    requiredVerificationResults,
    sequenceExecution: {
      phaseRange: `Phase${phase.groupNumber}A-T`,
      requiredBaseChecksExecuted: false,
      missionControlUiChecksExecuted: phase.missionControlUi === true,
      workforceBranchFabricChecksExecuted: phase.workforceBranchFabric === true,
      autoContinueAllowed: false,
      failedCommand: failure.failedCommand,
      commandTimedOut: failure.commandTimedOut,
      failureEvidenceWritten: true,
    },
  };
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}

function buildAutoContinueConditions(evidence) {
  return stopConditions.map(([field, expected]) => ({
    field,
    expected,
    actual: evidence[field],
    passed: evidence[field] === expected,
  }));
}

async function writeTopReport(report, activeGroupReport = null) {
  applySafetyBoundary(report);
  if (activeGroupReport) applySafetyBoundary(activeGroupReport);
  const groups = report.groups.filter((item) => activeGroupReport === null || item.group !== activeGroupReport.group);
  if (activeGroupReport) groups.push(activeGroupReport);
  report.groups = groups;
  const path = options.runAll
    ? "apps/ai-gateway-service/evidence/phase579-591-auto-verified-sequential-execution.json"
    : `apps/ai-gateway-service/evidence/${groupsToRun[0].key}a-t-auto-verified-sequential-execution.json`;
  await writeFile(resolve(repoRoot, path), `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function applySafetyBoundary(target) {
  target.safetyBoundary = { ...hardeningSafetyBoundary };
  for (const [field, value] of Object.entries(hardeningSafetyBoundary)) {
    target[field] = value;
  }
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function redact(text) {
  return text
    .replace(/(api[_-]?key|token|secret|credential|webhook)(\s*[:=]\s*)\S+/gi, "$1$2[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [REDACTED]");
}

function tail(text) {
  return text.length > 2000 ? text.slice(-2000) : text;
}
