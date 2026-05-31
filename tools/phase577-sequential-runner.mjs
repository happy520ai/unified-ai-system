import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { phase577Subphases } from "./phase577-subphase-runner.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

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
  phaseRange: "Phase577A-T",
  name: "Auto-Verified Sequential Execution",
  completed: false,
  recommended_sealed: false,
  blocker: null,
  phases: [],
};

for (const phase of phase577Subphases) {
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

  const requiredVerificationResults = [];
  for (const item of commands) {
    const result = runCommand(item);
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

function command(label, executable, args) {
  return { label, executable, args };
}

function runCommand(item) {
  const startedAt = Date.now();
  const child = spawnSync(item.executable, item.args, {
    cwd: repoRoot,
    encoding: "utf8",
    windowsHide: true,
  });
  const stdout = redact(child.stdout || "");
  const stderr = redact(child.stderr || "");
  return {
    label: item.label,
    command: [item.executable, ...item.args].join(" "),
    exitCode: typeof child.status === "number" ? child.status : 1,
    durationMs: Date.now() - startedAt,
    stdoutTail: tail(stdout),
    stderrTail: tail(stderr),
  };
}

async function finalizePhaseEvidence(phase, requiredVerificationResults, extra) {
  const path = evidencePath(phase);
  const evidence = JSON.parse(await readFile(path, "utf8"));
  evidence.requiredVerificationResults = requiredVerificationResults;
  evidence.sequenceExecution = {
    phaseRange: "Phase577A-T",
    requiredBaseChecksExecuted: requiredVerificationResults.every((item) => item.exitCode === 0),
    ...extra,
  };
  await writeFile(path, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}

async function readPhaseEvidence(phase) {
  return JSON.parse(await readFile(evidencePath(phase), "utf8"));
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
    resolve(repoRoot, "apps/ai-gateway-service/evidence/phase577a-t-auto-verified-sequential-execution.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
}

function redact(text) {
  return text
    .replace(/(api[_-]?key|token|secret|credential)(\\s*[:=]\\s*)\\S+/gi, "$1$2[REDACTED]")
    .replace(/Bearer\\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [REDACTED]");
}

function tail(text) {
  return text.length > 1200 ? text.slice(-1200) : text;
}
