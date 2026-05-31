import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { phase578Subphases } from "./phase578-subphase-runner.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const options = parseArgs(process.argv.slice(2));
const commandTimeoutMs = Number(process.env.PHASE578_COMMAND_TIMEOUT_MS || 60 * 60 * 1000);
const heartbeatIntervalMs = Number(process.env.PHASE578_HEARTBEAT_MS || 30 * 1000);
const timeoutFallbackMs = 10 * 1000;

const stopConditions = [
  "completed",
  "recommended_sealed",
  "blocker",
  "providerCallsMade",
  "rawSecretAccessed",
  "secretValueExposed",
  "realFeishuMessageSent",
  "realWeComMessageSent",
  "chatModified",
  "chatGatewayExecuteModified",
  "deployExecuted",
  "releaseExecuted",
  "tagCreated",
  "artifactUploaded",
  "characterModuleRestored",
];

const sequenceReport = {
  phaseRange: "Phase578A-T",
  name: "Unified IO + Internal Employee Communication Bus + Adaptive Branch Execution Fabric",
  completed: false,
  recommended_sealed: false,
  blocker: null,
  phases: [],
};

for (const phase of phase578Subphases) {
  if (options.resume && !options.force) {
    const existing = await readVerifiedPhaseEvidence(phase);
    if (existing.verified) {
      console.log(`[phase578-runner] resume-skip currentSubphase=${phase.key} evidence="${evidencePath(phase)}"`);
      sequenceReport.phases.push({
        phase: phase.phase,
        completed: true,
        evidenceJson: `apps/ai-gateway-service/evidence/${phase.key}/${phase.slug}-result.json`,
        resumedFromExistingEvidence: true,
        requiredVerificationResults: existing.evidence.requiredVerificationResults,
        autoContinueConditions: existing.evidence.sequenceExecution?.autoContinueConditions || [],
      });
      await writeSequenceReport(sequenceReport);
      continue;
    }
  }

  const commands = [
    command("node --check corresponding verifier", "node", ["--check", phase.verifierPath]),
    command("node corresponding verifier", "node", [phase.verifierPath]),
    command("pnpm -r --if-present check", "cmd", ["/c", "pnpm", "-r", "--if-present", "check"]),
    command("pnpm verify:phase107a-secret-safety", "cmd", ["/c", "pnpm", "verify:phase107a-secret-safety"]),
    command("pnpm verify:phase321a-workbench-product-recovery", "cmd", [
      "/c",
      "pnpm",
      "verify:phase321a-workbench-product-recovery",
    ]),
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
    );
  }

  if (phase.workforceDryRun) {
    commands.push(command("node tools/phase576f/validate-real-task-workforce-dry-run-no-provider.mjs", "node", [
      "tools/phase576f/validate-real-task-workforce-dry-run-no-provider.mjs",
    ]));
  }

  const requiredVerificationResults = [];
  for (const item of commands) {
    const result = await runCommand(item, phase);
    requiredVerificationResults.push(result);
    if (result.exitCode !== 0) {
      await finalizePhaseEvidence(phase, requiredVerificationResults, {
        autoContinueAllowed: false,
        failedCommand: result.label,
      });
      sequenceReport.blocker = `${phase.key}_${result.label.replaceAll(" ", "_")}_failed`;
      sequenceReport.phases.push({ phase: phase.phase, completed: false, requiredVerificationResults });
      await writeSequenceReport(sequenceReport);
      process.exitCode = 1;
      console.log(JSON.stringify(sequenceReport, null, 2));
      process.exit();
    }
  }

  const phaseEvidence = await readPhaseEvidence(phase);
  const autoContinueConditions = buildAutoContinueConditions(phaseEvidence);
  const autoContinueAllowed = autoContinueConditions.every((item) => item.passed);
  await finalizePhaseEvidence(phase, requiredVerificationResults, {
    autoContinueAllowed,
    autoContinueConditions,
  });

  sequenceReport.phases.push({
    phase: phase.phase,
    completed: autoContinueAllowed,
    evidenceJson: `apps/ai-gateway-service/evidence/${phase.key}/${phase.slug}-result.json`,
    requiredVerificationResults,
    autoContinueConditions,
  });

  if (!autoContinueAllowed) {
    sequenceReport.blocker = `${phase.key}_auto_continue_conditions_failed`;
    await writeSequenceReport(sequenceReport);
    process.exitCode = 1;
    console.log(JSON.stringify(sequenceReport, null, 2));
    process.exit();
  }
}

sequenceReport.completed = true;
sequenceReport.recommended_sealed = true;
await writeSequenceReport(sequenceReport);
console.log(JSON.stringify(sequenceReport, null, 2));

function parseArgs(rawArgs) {
  return {
    resume: rawArgs.includes("--resume"),
    force: rawArgs.includes("--force"),
  };
}

function command(label, executable, args) {
  return { label, executable, args };
}

async function runCommand(item, phase) {
  const startedAt = Date.now();
  const commandText = [item.executable, ...item.args].join(" ");
  console.log(`[phase578-runner] start currentSubphase=${phase.key} currentCommand="${item.label}" timeoutMs=${commandTimeoutMs}`);
  let stdout = "";
  let stderr = "";
  let timedOut = false;
  const child = spawn(item.executable, item.args, {
    cwd: repoRoot,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const heartbeat = setInterval(() => {
    console.log(`[phase578-runner] heartbeat currentSubphase=${phase.key} currentCommand="${item.label}" elapsedMs=${Date.now() - startedAt}`);
  }, heartbeatIntervalMs);

  const timeout = setTimeout(() => {
    timedOut = true;
    console.error(`[phase578-runner] timeout currentSubphase=${phase.key} currentCommand="${item.label}" elapsedMs=${Date.now() - startedAt}`);
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
  console.log(`[phase578-runner] end currentSubphase=${phase.key} currentCommand="${item.label}" exitCode=${exitCode} elapsedMs=${result.durationMs}`);
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

async function finalizePhaseEvidence(phase, requiredVerificationResults, extra) {
  const path = evidencePath(phase);
  const evidence = JSON.parse(await readFile(path, "utf8"));
  evidence.requiredVerificationResults = requiredVerificationResults;
  evidence.sequenceExecution = {
    phaseRange: "Phase578A-T",
    requiredBaseChecksExecuted: requiredVerificationResults.every((item) => item.exitCode === 0),
    missionControlUiChecksExecuted: phase.missionControlUi === true,
    workforceDryRunChecksExecuted: phase.workforceDryRun === true,
    ...extra,
  };
  await writeFile(path, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}

async function readPhaseEvidence(phase) {
  return JSON.parse(await readFile(evidencePath(phase), "utf8"));
}

async function readVerifiedPhaseEvidence(phase) {
  const evidence = await readPhaseEvidence(phase).catch(() => null);
  if (!evidence) return { verified: false, evidence: null };
  const results = Array.isArray(evidence.requiredVerificationResults) ? evidence.requiredVerificationResults : [];
  const expectedMinimum = 5 + (phase.missionControlUi ? 3 : 0) + (phase.workforceDryRun ? 1 : 0);
  const verified =
    evidence.completed === true &&
    evidence.recommended_sealed === true &&
    evidence.blocker === null &&
    evidence.sequenceExecution?.autoContinueAllowed === true &&
    results.length >= expectedMinimum &&
    results.every((item) => item.exitCode === 0 && item.timedOut !== true);
  return { verified, evidence };
}

function evidencePath(phase) {
  return resolve(repoRoot, "apps/ai-gateway-service/evidence", phase.key, `${phase.slug}-result.json`);
}

function buildAutoContinueConditions(evidence) {
  return stopConditions.map((field) => {
    let expected = false;
    if (field === "completed" || field === "recommended_sealed") expected = true;
    if (field === "blocker") expected = null;
    return {
      field,
      expected,
      actual: evidence[field],
      passed: evidence[field] === expected,
    };
  });
}

async function writeSequenceReport(report) {
  await writeFile(
    resolve(repoRoot, "apps/ai-gateway-service/evidence/phase578a-t-auto-verified-sequential-execution.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
}

function redact(text) {
  return text
    .replace(/(api[_-]?key|token|secret|credential)(\s*[:=]\s*)\S+/gi, "$1$2[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [REDACTED]");
}

function tail(text) {
  return text.length > 1200 ? text.slice(-1200) : text;
}
