import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { phase604AllowedBlockers, phase604Group, phase604SafetyBoundary, phase604Subphases } from "./phase604-registry.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const commandTimeoutMs = Number(process.env.PHASE604_COMMAND_TIMEOUT_MS || 90 * 60 * 1000);
const report = { phaseRange: "Phase604A-T", title: phase604Group.title, completed: false, recommended_sealed: false, blocker: null, phases: [], safetyBoundary: { ...phase604SafetyBoundary } };

for (const phase of phase604Subphases) {
  const checkResult = await runCommand(`node --check ${phase.verifierPath}`, "node", ["--check", phase.verifierPath]);
  if (checkResult.exitCode !== 0) await fail(phase, [checkResult], "node_check_failed");
  const verifyResult = await runCommand(`node ${phase.verifierPath}`, "node", [phase.verifierPath]);
  if (verifyResult.exitCode !== 0) await fail(phase, [checkResult, verifyResult], "verifier_failed");
  const evidence = JSON.parse(await readFile(resolve(repoRoot, phase.evidencePath), "utf8"));
  const phasePassed =
    evidence.completed === true &&
    phase604AllowedBlockers.includes(evidence.blocker) &&
    evidence.oneShotOnly === true &&
    evidence.customModelProviderRoute === true &&
    evidence.requestAttemptCount <= 1 &&
    evidence.retryAttemptCount === 0 &&
    evidence.authJsonRead === false &&
    evidence.authJsonTouched === false &&
    evidence.authJsonCopied === false &&
    evidence.authJsonWrittenToEvidence === false &&
    evidence.rawSecretAccessed === false &&
    evidence.secretValueExposed === false &&
    evidence.rawWebhookAccessed === false &&
    evidence.webhookValueExposed === false &&
    evidence.rawBaseUrlValueExposed === false &&
    evidence.codexConfigModified === false &&
    evidence.userCodexConfigModified === false &&
    evidence.projectCodexConfigModified === false &&
    evidence.persistentConfigWritePerformed === false &&
    evidence.chatModified === false &&
    evidence.chatGatewayExecuteModified === false &&
    evidence.deployExecuted === false &&
    evidence.releaseExecuted === false &&
    evidence.tagCreated === false &&
    evidence.artifactUploaded === false &&
    evidence.characterModuleRestored === false;
  report.phases.push({ phase: phase.phase, evidenceJson: phase.evidencePath, completed: phasePassed, requiredVerificationResults: [checkResult, verifyResult] });
  if (!phasePassed) {
    report.blocker = `${phase.key}_evidence_contract_failed`;
    await writeTopReport();
    console.error(JSON.stringify(report, null, 2));
    process.exitCode = 1;
    process.exit();
  }
}

report.completed = report.phases.length === phase604Group.subphases.length && report.phases.every((item) => item.completed === true);
report.recommended_sealed = report.completed;
const closure = await readClosureAggregate();
await writeTopReport(closure?.phaseCount === 20 ? { ...closure, verificationRun: report } : report);
console.log(JSON.stringify(closure?.phaseCount === 20 ? { ...closure, verificationRun: report } : report, null, 2));

async function fail(phase, results, reason) {
  report.blocker = `${phase.key}_${reason}`;
  report.phases.push({ phase: phase.phase, evidenceJson: phase.evidencePath, completed: false, requiredVerificationResults: results });
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
  const child = spawn(executable, args, { cwd: repoRoot, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
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
  return { label, command: [executable, ...args].join(" "), exitCode, timedOut, durationMs: Date.now() - startedAt, stdoutTail: redact(stdout).slice(-1600), stderrTail: redact(stderr).slice(-1600) };
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
    return JSON.parse(await readFile(resolve(repoRoot, phase604Group.sequenceEvidencePath), "utf8"));
  } catch {
    return null;
  }
}

async function writeTopReport(payload = report) {
  await writeFile(resolve(repoRoot, phase604Group.sequenceEvidencePath), `${JSON.stringify(payload, null, 2)}\n`);
}

function redact(text) {
  return String(text || "")
    .replace(/(api[_-]?key|token|secret|credential|webhook)(\s*[:=]\s*)\S+/gi, "$1$2[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [REDACTED]");
}
