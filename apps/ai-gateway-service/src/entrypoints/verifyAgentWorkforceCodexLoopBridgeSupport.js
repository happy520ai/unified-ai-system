import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import {
  countSecretFindings,
  createDisabledState,
  createSafety,
  noOhMyCodexDependency,
  noProjectContext,
  readEvidence,
  readRequired,
  readWorkspaceTexts,
  repoRoot,
  writeEvidence,
} from "./verifyAgentWorkforceClosureSupport.js";
import {
  phaseDefinitions,
  ensureBridgeStructure,
  bridgeStructurePaths,
  createSampleCodexResult,
  createSampleHandoffPrompt,
} from "./verifyAgentWorkforceCodexLoopBridgePhaseDefs.js";

const execFileAsync = promisify(execFile);


export async function runCodexLoopBridgeCheck(phase) {
  const definition = phaseDefinitions[phase];
  if (!definition) {
    throw new Error(`Unknown Codex loop bridge phase: ${phase}`);
  }

  if (definition.optionalRealTrial) {
    await runOptionalRealTrialCheck(phase, definition);
    return;
  }

  try {
    if (definition.prepare) {
      await definition.prepare();
    }

    const texts = await readWorkspaceTexts();
    const importScript = await readRequired(importScriptPath);
    const loopScript = await readRequired(loopScriptPath);
    const docs = {};
    for (const docPath of definition.docs || []) {
      docs[docPath] = await readRequired(docPath);
    }
    const requiredEvidence = [];
    for (const requiredPhase of definition.requiredEvidence || []) {
      requiredEvidence.push(await readEvidence(requiredPhase));
    }

    const roundtripTrial = definition.runRoundtripTrial ? await runRoundtripManualBridgeTrial() : null;
    const dryRunTrial = definition.runDryRunTrial ? await runCodexLoopDryRunTrial() : null;
    const allText = [
      texts.rootPackageText,
      texts.servicePackageText,
      texts.readme,
      texts.agentsDoc,
      texts.userManual,
      importScript,
      loopScript,
      ...Object.values(docs),
      roundtripTrial?.resultMarkdown || "",
      roundtripTrial?.feedback || "",
      dryRunTrial?.runSummaryText || "",
      dryRunTrial?.safetyGateText || "",
    ].join("\n\n");
    const secretFindingCount = countSecretFindings(allText, phase);

    const checks = {
      phase208Passed: (await readEvidence("phase-208a-clipboard-handoff-real-trial")).status === "passed",
      rootScriptPresent: texts.rootPackage.scripts?.[definition.script]?.includes(definition.script),
      serviceScriptPresent: texts.servicePackage.scripts?.[definition.script] === `node ./src/entrypoints/${definition.entrypoint}`,
      noOhMyCodexDependencyAdded: noOhMyCodexDependency(texts.rootPackageText, texts.servicePackageText),
      projectContextNotCreated: noProjectContext(),
      noPlainSecrets: secretFindingCount === 0,
      ...definition.checks({ texts, docs, importScript, loopScript, requiredEvidence, roundtripTrial, dryRunTrial }),
    };
    const passed = Object.values(checks).every(Boolean);
    await writeEvidence(phase, {
      phase,
      status: passed ? "passed" : "failed",
      generatedAt: new Date().toISOString(),
      checks,
      verifiedDocuments: definition.docs || [],
      disabledState: createDisabledState(),
      safety: createCodexLoopSafety(),
      secretFindingCount,
      conclusion: passed ? definition.conclusion : definition.conclusion.replace(/complete$/, "incomplete"),
      notes: [
        "Phase 209A-220A adds a local Codex result bridge and controlled loop dry-run.",
        "Default mode is dry-run/manual bridge. No unattended production execution, automatic commit/push, automatic worktree, workflow run, or default NVIDIA /chat change.",
      ],
      roundtripTrialSummary: roundtripTrial ? summarizeRoundtripTrial(roundtripTrial) : undefined,
      dryRunTrialSummary: dryRunTrial ? summarizeDryRunTrial(dryRunTrial) : undefined,
    });
    process.exitCode = passed ? 0 : 1;
  } catch (error) {
    await writeEvidence(phase, {
      phase,
      status: "failed",
      generatedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      disabledState: createDisabledState(),
      safety: createCodexLoopSafety(),
      conclusion: definition.conclusion.replace(/complete$/, "incomplete"),
    });
    process.exitCode = 1;
  }
}

async function runOptionalRealTrialCheck(phase, definition) {
  const explicitEnable = process.env.AGENT_WORKFORCE_ENABLE_CODEX_EXEC_REAL_TRIAL === "true";
  if (!explicitEnable) {
    await writeEvidence(phase, {
      phase,
      status: "skipped-not-enabled",
      generatedAt: new Date().toISOString(),
      checks: {
        explicitEnableProvided: false,
        codexExecInvoked: false,
        skippedHonestly: true,
        projectContextNotCreated: noProjectContext(),
      },
      disabledState: createDisabledState(),
      safety: createCodexLoopSafety(),
      secretFindingCount: 0,
      conclusion: definition.conclusion,
      notes: [
        "One-shot real Codex exec trial was not run because explicit enablement was not provided.",
        "Set AGENT_WORKFORCE_ENABLE_CODEX_EXEC_REAL_TRIAL=true and run the explicit one-shot command only after user approval.",
      ],
    });
    process.exitCode = 0;
    return;
  }

  try {
    const beforeWorktrees = await runGit(["worktree", "list", "--porcelain"]);
    const beforeStatus = filterBusinessStatus(await runGit(["status", "--short", "--untracked-files=all"]));
    const result = await runCommand("cmd", ["/c", "pnpm", "run", "codex:loop:once"], 300000);
    const afterWorktrees = await runGit(["worktree", "list", "--porcelain"]);
    const afterStatus = filterBusinessStatus(await runGit(["status", "--short", "--untracked-files=all"]));
    const summary = await readJsonIfExists(".codex-handoff/runs/latest-run-summary.json");
    const checks = {
      explicitEnableProvided: true,
      codexExecInvoked: summary?.codexExecInvoked === true,
      stdoutCaptured: existsSync(resolve(repoRoot, ".codex-handoff/runs/codex-stdout.txt")),
      stderrCaptured: existsSync(resolve(repoRoot, ".codex-handoff/runs/codex-stderr.txt")),
      inboxResultGenerated: existsSync(resolve(repoRoot, ".codex-handoff/inbox/latest-codex-result.md")),
      feedbackGenerated: existsSync(resolve(repoRoot, ".codex-handoff/review/latest-feedback-to-codex.md")),
      noWorktreeCreated: beforeWorktrees === afterWorktrees,
      noBusinessCodeModified: beforeStatus === afterStatus,
      noCommitPush: summary?.commitAttempted === false && summary?.pushAttempted === false,
    };
    const passed = Object.values(checks).every(Boolean);
    await writeEvidence(phase, {
      phase,
      status: passed ? "passed" : "blocked",
      generatedAt: new Date().toISOString(),
      checks,
      commandOutputPreview: result.slice(0, 1000),
      disabledState: createDisabledState(),
      safety: createCodexLoopSafety({ codexCliInvoked: summary?.codexCliInvoked === true }),
      secretFindingCount: 0,
      conclusion: passed ? "codex-loop-one-shot-real-trial-passed" : "codex-loop-one-shot-real-trial-blocked",
    });
    process.exitCode = passed ? 0 : 1;
  } catch (error) {
    await writeEvidence(phase, {
      phase,
      status: "blocked",
      generatedAt: new Date().toISOString(),
      checks: {
        explicitEnableProvided: true,
        codexExecInvoked: false,
      },
      error: error instanceof Error ? error.message : String(error),
      disabledState: createDisabledState(),
      safety: createCodexLoopSafety(),
      conclusion: "codex-loop-one-shot-real-trial-blocked",
    });
    process.exitCode = 1;
  }
}

async function runRoundtripManualBridgeTrial() {
  await ensureBridgeStructure();
  const inboxPath = resolve(repoRoot, ".codex-handoff/inbox/latest-codex-result.md");
  const resultMarkdown = createSampleCodexResult();
  await writeFile(inboxPath, resultMarkdown, "utf8");
  await writeFile(
    resolve(repoRoot, ".codex-handoff/inbox/latest-codex-result.json"),
    `${JSON.stringify({ sampleManualBridge: true, generatedAt: new Date().toISOString() }, null, 2)}\n`,
    "utf8",
  );

  const beforeWorktrees = await runGit(["worktree", "list", "--porcelain"]);
  const beforeStatus = filterBusinessStatus(await runGit(["status", "--short", "--untracked-files=all"]));
  const commandOutput = await runCommand("cmd", ["/c", "pnpm", "run", "codex:result:import"], 120000);
  const afterWorktrees = await runGit(["worktree", "list", "--porcelain"]);
  const afterStatus = filterBusinessStatus(await runGit(["status", "--short", "--untracked-files=all"]));
  const summary = await readJsonIfExists(".codex-handoff/review/latest-review-summary.json");
  const feedback = await readOptional(".codex-handoff/review/latest-feedback-to-codex.md");
  const clipboard = await runCommand("powershell", ["-NoProfile", "-Command", "Get-Clipboard -Raw"], 30000);

  return {
    sampleManualBridge: true,
    resultMarkdown,
    commandOutput,
    importCommandPassed: /"status"\s*:\s*"ok"/.test(commandOutput),
    systemReviewExists: existsSync(resolve(repoRoot, ".codex-handoff/review/latest-system-review.md")),
    feedbackExists: existsSync(resolve(repoRoot, ".codex-handoff/review/latest-feedback-to-codex.md")),
    reviewSummaryExists: existsSync(resolve(repoRoot, ".codex-handoff/review/latest-review-summary.json")),
    summary,
    feedback,
    feedbackCopiedToClipboard: summary?.feedbackCopiedToClipboard === true && clipboard.includes("# Feedback to Codex"),
    worktreeListUnchanged: beforeWorktrees === afterWorktrees,
    businessStatusUnchanged: beforeStatus === afterStatus,
  };
}

async function runCodexLoopDryRunTrial() {
  await ensureBridgeStructure();
  const outboxPrompt = resolve(repoRoot, ".codex-handoff/outbox/latest-codex-handoff.md");
  const rootPrompt = resolve(repoRoot, ".codex-handoff/latest-codex-handoff.md");
  if (!existsSync(outboxPrompt)) {
    if (existsSync(rootPrompt)) {
      await copyFile(rootPrompt, outboxPrompt);
    } else {
      await writeFile(outboxPrompt, createSampleHandoffPrompt(), "utf8");
    }
  }

  const beforeWorktrees = await runGit(["worktree", "list", "--porcelain"]);
  const beforeStatus = filterBusinessStatus(await runGit(["status", "--short", "--untracked-files=all"]));
  const commandOutput = await runCommand("cmd", ["/c", "pnpm", "run", "codex:loop:dry-run"], 120000);
  const afterWorktrees = await runGit(["worktree", "list", "--porcelain"]);
  const afterStatus = filterBusinessStatus(await runGit(["status", "--short", "--untracked-files=all"]));

  const summary = await readJsonIfExists(".codex-handoff/runs/latest-run-summary.json");
  const safetyGate = await readJsonIfExists(".codex-handoff/runs/safety-gate-summary.json");
  const runSummaryText = await readOptional(".codex-handoff/runs/latest-run-summary.json");
  const safetyGateText = await readOptional(".codex-handoff/runs/safety-gate-summary.json");

  return {
    commandOutput,
    dryRunCommandPassed: /"status"\s*:\s*"dry-run"/.test(commandOutput),
    runSummaryExists: existsSync(resolve(repoRoot, ".codex-handoff/runs/latest-run-summary.json")),
    safetyGateSummaryExists: existsSync(resolve(repoRoot, ".codex-handoff/runs/safety-gate-summary.json")),
    summary,
    safetyGate,
    runSummaryText,
    safetyGateText,
    safetyGateChecked: Boolean(safetyGate?.promptExists !== undefined && safetyGate?.maxRoundsWithinLimit !== undefined),
    worktreeListUnchanged: beforeWorktrees === afterWorktrees,
    businessStatusUnchanged: beforeStatus === afterStatus,
  };
}


async function readOptional(relativePath) {
  const fullPath = resolve(repoRoot, relativePath);
  if (!existsSync(fullPath)) {
    return "";
  }
  return readFile(fullPath, "utf8");
}

async function readJsonIfExists(relativePath) {
  const text = await readOptional(relativePath);
  if (!text) {
    return null;
  }
  return JSON.parse(text);
}

async function runCommand(command, args, timeout = 60000) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd: repoRoot,
      timeout,
      windowsHide: true,
      maxBuffer: 20 * 1024 * 1024,
    });
    return `${stdout || ""}${stderr || ""}`;
  } catch (error) {
    const stdout = error?.stdout ? String(error.stdout) : "";
    const stderr = error?.stderr ? String(error.stderr) : "";
    throw new Error(`Command failed: ${command} ${args.join(" ")}\n${stdout}${stderr}`);
  }
}

async function runGit(args, timeout = 60000) {
  return runCommand("git", ["-c", `safe.directory=${repoRoot}`, ...args], timeout);
}

function filterBusinessStatus(statusText) {
  return statusText
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .filter((line) => !line.includes(".codex-handoff/"))
    .join("\n");
}

function createCodexLoopSafety(overrides = {}) {
  return {
    ...createSafety(),
    codexCliInvoked: false,
    codexExecInvoked: false,
    automaticPromptDispatch: false,
    autoApply: false,
    autoMerge: false,
    autoCommit: false,
    autoPush: false,
    ...overrides,
  };
}

function summarizeRoundtripTrial(trial) {
  return {
    sampleManualBridge: trial.sampleManualBridge,
    importCommandPassed: trial.importCommandPassed,
    decision: trial.summary?.decision,
    feedbackCopiedToClipboard: trial.feedbackCopiedToClipboard,
    worktreeListUnchanged: trial.worktreeListUnchanged,
    businessStatusUnchanged: trial.businessStatusUnchanged,
  };
}

function summarizeDryRunTrial(trial) {
  return {
    dryRunCommandPassed: trial.dryRunCommandPassed,
    codexExecInvoked: trial.summary?.codexExecInvoked,
    runSummaryExists: trial.runSummaryExists,
    safetyGateSummaryExists: trial.safetyGateSummaryExists,
    promptExists: trial.safetyGate?.promptExists,
    executionAllowed: trial.safetyGate?.executionAllowed,
    worktreeListUnchanged: trial.worktreeListUnchanged,
    businessStatusUnchanged: trial.businessStatusUnchanged,
  };
}
