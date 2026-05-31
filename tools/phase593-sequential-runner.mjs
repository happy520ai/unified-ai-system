import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { phase593Group, phase593SafetyBoundary, phase593Subphases } from "./phase593-registry.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const commandTimeoutMs = Number(process.env.PHASE593_COMMAND_TIMEOUT_MS || 10 * 60 * 1000);

const report = {
  phaseRange: "Phase593A-T",
  title: "Codex Context Gateway Operator Panel Preview",
  completed: false,
  recommended_sealed: false,
  blocker: null,
  phases: [],
  safetyBoundary: { ...phase593SafetyBoundary },
};

for (const phase of phase593Subphases) {
  const checkResult = await runCommand(`node --check ${phase.verifierPath}`, "node", ["--check", phase.verifierPath]);
  if (checkResult.exitCode !== 0) {
    await fail(phase, [checkResult], "node_check_failed");
  }

  const verifyResult = await runCommand(`node ${phase.verifierPath}`, "node", [phase.verifierPath]);
  if (verifyResult.exitCode !== 0) {
    await fail(phase, [checkResult, verifyResult], "verifier_failed");
  }

  const evidence = JSON.parse(await readFile(resolve(repoRoot, phase.evidencePath), "utf8"));
  const phasePassed =
    evidence.completed === true &&
    evidence.recommended_sealed === true &&
    evidence.blocker === null &&
    evidence.providerCallsMade === false &&
    evidence.rawSecretAccessed === false &&
    evidence.secretValueExposed === false &&
    evidence.rawWebhookAccessed === false &&
    evidence.webhookValueExposed === false &&
    evidence.codexConfigModified === false &&
    evidence.codexBaseUrlModified === false &&
    evidence.chatModified === false &&
    evidence.chatGatewayExecuteModified === false &&
    evidence.deployExecuted === false &&
    evidence.releaseExecuted === false &&
    evidence.tagCreated === false &&
    evidence.artifactUploaded === false &&
    evidence.characterModuleRestored === false;

  report.phases.push({
    phase: phase.phase,
    evidenceJson: phase.evidencePath,
    completed: phasePassed,
    requiredVerificationResults: [checkResult, verifyResult],
  });
  if (!phasePassed) {
    report.blocker = `${phase.key}_evidence_contract_failed`;
    await writeTopReport();
    console.error(JSON.stringify(report, null, 2));
    process.exitCode = 1;
    process.exit();
  }
}

report.completed = report.phases.length === phase593Group.subphases.length && report.phases.every((item) => item.completed === true);
report.recommended_sealed = report.completed;
const closureAggregate = await readClosureAggregate();
if (closureAggregate?.phaseCount === 20) {
  const finalReport = {
    ...closureAggregate,
    verificationRun: {
      completed: report.completed,
      recommended_sealed: report.recommended_sealed,
      blocker: report.blocker,
      phases: report.phases,
    },
  };
  await writeTopReport(finalReport);
  console.log(JSON.stringify(finalReport, null, 2));
} else {
  await writeTopReport();
  console.log(JSON.stringify(report, null, 2));
}

async function fail(phase, results, reason) {
  report.blocker = `${phase.key}_${reason}`;
  report.phases.push({
    phase: phase.phase,
    evidenceJson: phase.evidencePath,
    completed: false,
    requiredVerificationResults: results,
  });
  await writeTopReport();
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 1;
  process.exit();
}

async function runCommand(label, executable, args) {
  const startedAt = Date.now();
  let stdout = "";
  let stderr = "";
  let timedOut = false;
  const child = spawn(executable, args, {
    cwd: repoRoot,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const timeout = setTimeout(() => {
    timedOut = true;
    terminateProcess(child.pid);
  }, commandTimeoutMs);
  child.stdout.on("data", (chunk) => {
    stdout += String(chunk);
    process.stdout.write(String(chunk));
  });
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
    process.stderr.write(String(chunk));
  });
  const exitCode = await new Promise((resolveExit) => {
    child.on("error", () => resolveExit(1));
    child.on("close", (code) => resolveExit(timedOut ? 124 : typeof code === "number" ? code : 1));
  });
  clearTimeout(timeout);
  return {
    label,
    command: [executable, ...args].join(" "),
    exitCode,
    timedOut,
    durationMs: Date.now() - startedAt,
    stdoutTail: redact(stdout).slice(-1600),
    stderrTail: redact(stderr).slice(-1600),
  };
}

function terminateProcess(pid) {
  if (!pid) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    return;
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {}
}

async function readClosureAggregate() {
  try {
    return JSON.parse(await readFile(resolve(repoRoot, phase593Group.sequenceEvidencePath), "utf8"));
  } catch {
    return null;
  }
}

async function writeTopReport(payload = report) {
  await writeFileWithRetry(resolve(repoRoot, phase593Group.sequenceEvidencePath), `${JSON.stringify(payload, null, 2)}\n`);
}

function redact(text) {
  return String(text || "")
    .replace(/(api[_-]?key|token|secret|credential|webhook)(\s*[:=]\s*)\S+/gi, "$1$2[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [REDACTED]");
}

async function writeFileWithRetry(filePath, contents) {
  const retryableCodes = new Set(["UNKNOWN", "EBUSY", "EPERM", "EACCES"]);
  let lastError = null;
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      await writeFile(filePath, contents, "utf8");
      return;
    } catch (error) {
      lastError = error;
      if (!retryableCodes.has(error?.code) || attempt === 20) break;
      await delay(attempt * 250);
    }
  }
  throw lastError;
}

function delay(ms) {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, ms);
  });
}
