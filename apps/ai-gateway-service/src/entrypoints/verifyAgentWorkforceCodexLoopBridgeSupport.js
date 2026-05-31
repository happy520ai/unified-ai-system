import { existsSync } from "node:fs";
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

const execFileAsync = promisify(execFile);

const importScriptPath = "tools/agent-workforce/import-codex-result.ps1";
const loopScriptPath = "tools/agent-workforce/run-codex-exec-loop.ps1";
const inboxContractDoc = "docs/AGENT_WORKFORCE_CODEX_RESULT_INBOX_CONTRACT.md";
const execCaptureDesignDoc = "docs/AGENT_WORKFORCE_OPTIONAL_CODEX_EXEC_CAPTURE_DESIGN.md";
const feedbackLoopClosureDoc = "docs/AGENT_WORKFORCE_CODEX_FEEDBACK_LOOP_CLOSURE.md";
const continuousPolicyDoc = "docs/AGENT_WORKFORCE_CODEX_CONTINUOUS_LOOP_POLICY.md";
const continuousClosureDoc = "docs/AGENT_WORKFORCE_CODEX_CONTINUOUS_LOOP_CLOSURE.md";

const phaseDefinitions = {
  "phase-209a-codex-result-inbox-contract": {
    script: "verify:phase209a-codex-result-inbox-contract",
    entrypoint: "verifyAgentWorkforceCodexResultInboxContract.js",
    conclusion: "codex-result-inbox-contract-complete",
    docs: [inboxContractDoc],
    prepare: ensureBridgeStructure,
    checks: ({ docs }) => {
      const doc = docs[inboxContractDoc] || "";
      const required = [
        ".codex-handoff/",
        "outbox/",
        "latest-codex-handoff.md",
        "feedback-to-codex.md",
        "inbox/",
        "latest-codex-result.md",
        "latest-codex-result.json",
        "review/",
        "latest-system-review.md",
        "latest-feedback-to-codex.md",
        "latest-review-summary.json",
        "runs/",
        "latest-run-summary.json",
        "codex-stdout.txt",
        "codex-stderr.txt",
        "# Codex Result",
        "## Summary",
        "## Changed Files",
        "## Commands Run",
        "## Tests Passed",
        "## Evidence Paths",
        "## Known Issues",
        "## Boundary Check",
        "## Next Steps",
        "PROJECT_CONTEXT.md",
        "oh-my-codex / OMX / team / ralph",
        "NVIDIA `/chat`",
      ];
      return {
        inboxContractDocPresent: existsSync(resolve(repoRoot, inboxContractDoc)),
        directoryContractPresent: required.every((item) => doc.includes(item)),
        bridgeStructureCreated: bridgeStructurePaths().every((item) => existsSync(resolve(repoRoot, item))),
        defaultManualDryRunBoundary:
          doc.includes("Default bridge mode is manual/dry-run") &&
          doc.includes("Imported Codex results are reviewed only") &&
          doc.includes("never commits or pushes automatically"),
      };
    },
  },
  "phase-210a-codex-result-import-script": {
    script: "verify:phase210a-codex-result-import-script",
    entrypoint: "verifyAgentWorkforceCodexResultImportScript.js",
    conclusion: "codex-result-import-script-complete",
    checks: ({ texts, importScript }) => ({
      importScriptPresent: existsSync(resolve(repoRoot, importScriptPath)),
      rootCommandPresent:
        texts.rootPackage.scripts?.["codex:result:import"] ===
        "powershell -ExecutionPolicy Bypass -File tools/agent-workforce/import-codex-result.ps1",
      parametersPresent:
        importScript.includes("$InputPath = \".codex-handoff/inbox/latest-codex-result.md\"") &&
        importScript.includes("$OutputDir = \".codex-handoff/review\"") &&
        importScript.includes("$CopyFeedbackToClipboard = $true") &&
        importScript.includes("$FailOnBoundaryViolation = $true"),
      outputFilesPresent:
        importScript.includes("latest-system-review.md") &&
        importScript.includes("latest-feedback-to-codex.md") &&
        importScript.includes("latest-review-summary.json"),
      forbiddenSignalsChecked:
        importScript.includes("legacy-modified") &&
        importScript.includes("project-context-created") &&
        importScript.includes("omx-called") &&
        importScript.includes("worktree-created") &&
        importScript.includes("workflow-run-hookup") &&
        importScript.includes("nvidia-chat-changed") &&
        importScript.includes("secret-exposed") &&
        importScript.includes("verification-failed"),
      noCodexCliInvocation: !importScript.includes("codex exec") && !importScript.includes("codexCliInvoked = $true"),
      noAutoApplyCommitPush:
        importScript.includes("autoApply = $false") &&
        importScript.includes("autoCommit = $false") &&
        importScript.includes("autoPush = $false"),
    }),
  },
  "phase-211a-codex-feedback-outbox-generator": {
    script: "verify:phase211a-codex-feedback-outbox-generator",
    entrypoint: "verifyAgentWorkforceCodexFeedbackOutboxGenerator.js",
    conclusion: "codex-feedback-outbox-generator-complete",
    checks: ({ importScript }) => ({
      feedbackFileGenerated: importScript.includes("latest-feedback-to-codex.md"),
      feedbackHeadingsPresent:
        importScript.includes("# Feedback to Codex") &&
        importScript.includes("## Review Decision") &&
        importScript.includes("## Required Fixes") &&
        importScript.includes("## Verification Gaps") &&
        importScript.includes("## Boundary Issues") &&
        importScript.includes("## Follow-up Instructions") &&
        importScript.includes("## Required Response Format"),
      decisionStatesPresent:
        importScript.includes("accepted-preview") &&
        importScript.includes("needs-fix") &&
        importScript.includes("blocked"),
      clipboardCopyPresent: importScript.includes("Set-Clipboard"),
      doesNotAutoSendToCodex: !importScript.includes("codex exec") && !importScript.includes("Start-Process"),
    }),
  },
  "phase-212a-roundtrip-manual-bridge-trial": {
    script: "verify:phase212a-roundtrip-manual-bridge-trial",
    entrypoint: "verifyAgentWorkforceRoundtripManualBridgeTrial.js",
    conclusion: "roundtrip-manual-bridge-trial-complete",
    runRoundtripTrial: true,
    checks: ({ roundtripTrial }) => ({
      sampleManualBridgeDeclared: roundtripTrial.sampleManualBridge,
      importCommandPassed: roundtripTrial.importCommandPassed,
      systemReviewExists: roundtripTrial.systemReviewExists,
      feedbackExists: roundtripTrial.feedbackExists,
      reviewSummaryExists: roundtripTrial.reviewSummaryExists,
      feedbackCopiedToClipboard: roundtripTrial.feedbackCopiedToClipboard,
      noCodexCliInvocation: roundtripTrial.summary?.safety?.codexCliInvoked === false,
      noWorktreeCreated: roundtripTrial.worktreeListUnchanged,
      noCommitPush: roundtripTrial.summary?.safety?.autoCommit === false && roundtripTrial.summary?.safety?.autoPush === false,
      noBusinessCodeModified: roundtripTrial.businessStatusUnchanged,
    }),
  },
  "phase-213a-optional-codex-exec-capture-design": {
    script: "verify:phase213a-optional-codex-exec-capture-design",
    entrypoint: "verifyAgentWorkforceOptionalCodexExecCaptureDesign.js",
    conclusion: "optional-codex-exec-capture-design-complete",
    docs: [execCaptureDesignDoc],
    checks: ({ docs }) => {
      const doc = docs[execCaptureDesignDoc] || "";
      return {
        designDocPresent: existsSync(resolve(repoRoot, execCaptureDesignDoc)),
        defaultDisabled: doc.includes("codexExecEnabled=false") && doc.includes("designOnly=true"),
        explicitParameterRequired: doc.includes("explicit user command") && doc.includes("explicit script"),
        capturePathsPresent:
          doc.includes(".codex-handoff/runs/codex-stdout.txt") &&
          doc.includes(".codex-handoff/runs/codex-stderr.txt") &&
          doc.includes(".codex-handoff/inbox/latest-codex-result.md"),
        safetyRequirementsPresent:
          doc.includes("Maximum rounds are limited to 3") &&
          doc.includes("No automatic commit or push") &&
          doc.includes("No workflow run hookup"),
      };
    },
  },
  "phase-214a-codex-feedback-loop-closure": {
    script: "verify:phase214a-codex-feedback-loop-closure",
    entrypoint: "verifyAgentWorkforceCodexFeedbackLoopClosure.js",
    conclusion: "codex-feedback-loop-closure-complete",
    docs: [feedbackLoopClosureDoc],
    requiredEvidence: [
      "phase-209a-codex-result-inbox-contract",
      "phase-210a-codex-result-import-script",
      "phase-211a-codex-feedback-outbox-generator",
      "phase-212a-roundtrip-manual-bridge-trial",
      "phase-213a-optional-codex-exec-capture-design",
    ],
    checks: ({ docs, requiredEvidence }) => {
      const doc = docs[feedbackLoopClosureDoc] || "";
      return {
        closureDocPresent: existsSync(resolve(repoRoot, feedbackLoopClosureDoc)),
        priorEvidencePassed: requiredEvidence.every((item) => item.status === "passed"),
        bridgePiecesListed:
          doc.includes("Result import script reads") &&
          doc.includes("latest-system-review.md") &&
          doc.includes("latest-feedback-to-codex.md") &&
          doc.includes("latest-review-summary.json"),
        defaultNoExecution: doc.includes("Web service Codex execution remains disabled"),
        blockerNone: doc.includes("Current blocker: none"),
      };
    },
  },
  "phase-215a-controlled-codex-exec-runner-script": {
    script: "verify:phase215a-controlled-codex-exec-runner-script",
    entrypoint: "verifyAgentWorkforceControlledCodexExecRunnerScript.js",
    conclusion: "controlled-codex-exec-runner-script-complete",
    checks: ({ texts, loopScript }) => ({
      runnerScriptPresent: existsSync(resolve(repoRoot, loopScriptPath)),
      rootDryRunCommandPresent:
        texts.rootPackage.scripts?.["codex:loop:dry-run"] ===
        "powershell -ExecutionPolicy Bypass -File tools/agent-workforce/run-codex-exec-loop.ps1",
      rootOnceCommandPresent:
        texts.rootPackage.scripts?.["codex:loop:once"] ===
        "powershell -ExecutionPolicy Bypass -File tools/agent-workforce/run-codex-exec-loop.ps1 -EnableCodexExec true -DryRun false -MaxRounds 1",
      defaultDisabledDryRun:
        loopScript.includes("$EnableCodexExec = $false") &&
        loopScript.includes("$DryRun = $true") &&
        loopScript.includes("Dry-run only. Codex CLI was not invoked."),
      parametersPresent:
        loopScript.includes("$PromptPath = \".codex-handoff/outbox/latest-codex-handoff.md\"") &&
        loopScript.includes("$FeedbackPath = \".codex-handoff/review/latest-feedback-to-codex.md\"") &&
        loopScript.includes("$MaxRounds = 1") &&
        loopScript.includes("$RequireCleanGit = $true") &&
        loopScript.includes("$NoCommit = $true") &&
        loopScript.includes("$NoPush = $true"),
      capturePathsPresent:
        loopScript.includes("codex-stdout.txt") &&
        loopScript.includes("codex-stderr.txt") &&
        loopScript.includes("latest-codex-result.md"),
      explicitCodexExecOnly:
        loopScript.includes("if (-not $EnableCodexExec -or $DryRun)") &&
        loopScript.includes("& cmd /c where codex") &&
        loopScript.includes("& codex exec $combinedPrompt"),
      noAutoCommitPush: loopScript.includes("commitAttempted = $false") && loopScript.includes("pushAttempted = $false"),
    }),
  },
  "phase-216a-codex-loop-safety-gate": {
    script: "verify:phase216a-codex-loop-safety-gate",
    entrypoint: "verifyAgentWorkforceCodexLoopSafetyGate.js",
    conclusion: "codex-loop-safety-gate-complete",
    checks: ({ loopScript }) => ({
      safetyGateSummaryPathPresent: loopScript.includes("safety-gate-summary.json"),
      cleanGitGatePresent: loopScript.includes("cleanGitWorkspace") && loopScript.includes("RequireCleanGit"),
      promptExistsGatePresent: loopScript.includes("promptExists"),
      secretGatePresent: loopScript.includes("noPlaintextSecretsInPrompt") && loopScript.includes("Test-PlainSecret"),
      forbiddenActionsGatePresent:
        loopScript.includes("Do not modify legacy/") &&
        loopScript.includes("Do not create PROJECT_CONTEXT.md") &&
        loopScript.includes("oh-my-codex / OMX") &&
        loopScript.includes("NVIDIA /chat"),
      maxRoundsGatePresent: loopScript.includes("maxRoundsWithinLimit") && loopScript.includes("$MaxRounds -le 3"),
      noCommitNoPushGatePresent: loopScript.includes("noCommit") && loopScript.includes("noPush"),
    }),
  },
  "phase-217a-codex-loop-dry-run-trial": {
    script: "verify:phase217a-codex-loop-dry-run-trial",
    entrypoint: "verifyAgentWorkforceCodexLoopDryRunTrial.js",
    conclusion: "codex-loop-dry-run-trial-complete",
    runDryRunTrial: true,
    checks: ({ dryRunTrial }) => ({
      dryRunCommandPassed: dryRunTrial.dryRunCommandPassed,
      codexExecNotInvoked: dryRunTrial.summary?.codexExecInvoked === false,
      runSummaryExists: dryRunTrial.runSummaryExists,
      safetyGateSummaryExists: dryRunTrial.safetyGateSummaryExists,
      promptFound: dryRunTrial.safetyGate?.promptExists === true,
      safetyGateChecked: dryRunTrial.safetyGateChecked,
      noWorktreeCreated: dryRunTrial.worktreeListUnchanged,
      noCommitPush: dryRunTrial.summary?.commitAttempted === false && dryRunTrial.summary?.pushAttempted === false,
      noBusinessCodeModified: dryRunTrial.businessStatusUnchanged,
    }),
  },
  "phase-218a-codex-loop-one-shot-real-trial": {
    script: "verify:phase218a-codex-loop-one-shot-real-trial",
    entrypoint: "verifyAgentWorkforceCodexLoopOneShotRealTrial.js",
    conclusion: "codex-loop-one-shot-real-trial-skipped-not-enabled",
    optionalRealTrial: true,
  },
  "phase-219a-continuous-loop-policy-freeze": {
    script: "verify:phase219a-continuous-loop-policy-freeze",
    entrypoint: "verifyAgentWorkforceContinuousLoopPolicyFreeze.js",
    conclusion: "continuous-loop-policy-freeze-complete",
    docs: [continuousPolicyDoc],
    checks: ({ docs }) => {
      const doc = docs[continuousPolicyDoc] || "";
      return {
        policyDocPresent: existsSync(resolve(repoRoot, continuousPolicyDoc)),
        defaultDryRun: doc.includes("Default mode is dry-run"),
        explicitRealExecRequired: doc.includes("Real `codex exec` requires an explicit command"),
        roundLimitsPresent: doc.includes("Batch loops are capped at 3 rounds"),
        boundaryBlocked: doc.includes("boundary violation immediately blocks"),
        noCommitPushWorktreeWorkflow:
          doc.includes("does not automatically commit or push") &&
          doc.includes("does not automatically create worktrees") &&
          doc.includes("does not connect workflow run"),
        noHumanBypass: doc.includes("does not bypass human confirmation"),
      };
    },
  },
  "phase-220a-codex-continuous-loop-closure": {
    script: "verify:phase220a-codex-continuous-loop-closure",
    entrypoint: "verifyAgentWorkforceCodexContinuousLoopClosure.js",
    conclusion: "codex-continuous-loop-closure-complete",
    docs: [continuousClosureDoc],
    requiredEvidence: [
      "phase-209a-codex-result-inbox-contract",
      "phase-210a-codex-result-import-script",
      "phase-211a-codex-feedback-outbox-generator",
      "phase-212a-roundtrip-manual-bridge-trial",
      "phase-213a-optional-codex-exec-capture-design",
      "phase-214a-codex-feedback-loop-closure",
      "phase-215a-controlled-codex-exec-runner-script",
      "phase-216a-codex-loop-safety-gate",
      "phase-217a-codex-loop-dry-run-trial",
      "phase-218a-codex-loop-one-shot-real-trial",
      "phase-219a-continuous-loop-policy-freeze",
    ],
    checks: ({ docs, requiredEvidence }) => {
      const doc = docs[continuousClosureDoc] || "";
      const phase218 = requiredEvidence.find((item) => item.phase === "phase-218a-codex-loop-one-shot-real-trial");
      return {
        closureDocPresent: existsSync(resolve(repoRoot, continuousClosureDoc)),
        priorEvidenceAcceptable: requiredEvidence.every((item) => item.status === "passed" || item.status === "skipped-not-enabled"),
        phase218SkippedOrPassed: phase218?.status === "passed" || phase218?.status === "skipped-not-enabled",
        loopPathListed:
          doc.includes("Agent Workforce plan") &&
          doc.includes("Codex handoff") &&
          doc.includes("Codex result import") &&
          doc.includes("system review") &&
          doc.includes("feedback to Codex") &&
          doc.includes("controlled loop dry-run"),
        limitsExplicit:
          doc.includes("not unattended production execution") &&
          doc.includes("does not automatically commit or push") &&
          doc.includes("does not automatically create worktrees") &&
          doc.includes("does not connect workflow run") &&
          doc.includes("does not modify the default NVIDIA `/chat`"),
        blockerNone: doc.includes("Current blocker: none"),
      };
    },
  },
};

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

async function ensureBridgeStructure() {
  const dirs = [
    ".codex-handoff/outbox",
    ".codex-handoff/inbox",
    ".codex-handoff/review",
    ".codex-handoff/runs",
  ];
  for (const dir of dirs) {
    await mkdir(resolve(repoRoot, dir), { recursive: true });
  }
  const files = [
    [".codex-handoff/outbox/feedback-to-codex.md", "# Feedback to Codex\n\nNo feedback has been generated yet.\n"],
    [".codex-handoff/inbox/latest-codex-result.json", "{\n  \"status\": \"empty\"\n}\n"],
    [".codex-handoff/review/latest-system-review.md", "# System Review\n\nNo Codex result has been imported yet.\n"],
    [".codex-handoff/review/latest-feedback-to-codex.md", "# Feedback to Codex\n\nNo Codex result has been imported yet.\n"],
    [".codex-handoff/review/latest-review-summary.json", "{\n  \"status\": \"empty\"\n}\n"],
    [".codex-handoff/runs/latest-run-summary.json", "{\n  \"status\": \"empty\"\n}\n"],
    [".codex-handoff/runs/codex-stdout.txt", ""],
    [".codex-handoff/runs/codex-stderr.txt", ""],
  ];
  for (const [file, content] of files) {
    const fullPath = resolve(repoRoot, file);
    if (!existsSync(fullPath)) {
      await writeFile(fullPath, content, "utf8");
    }
  }
  const outboxPrompt = resolve(repoRoot, ".codex-handoff/outbox/latest-codex-handoff.md");
  if (!existsSync(outboxPrompt)) {
    await writeFile(outboxPrompt, createSampleHandoffPrompt(), "utf8");
  }
  const inboxResult = resolve(repoRoot, ".codex-handoff/inbox/latest-codex-result.md");
  if (!existsSync(inboxResult)) {
    await writeFile(inboxResult, createSampleCodexResult(), "utf8");
  }
}

function bridgeStructurePaths() {
  return [
    ".codex-handoff/outbox/latest-codex-handoff.md",
    ".codex-handoff/outbox/feedback-to-codex.md",
    ".codex-handoff/inbox/latest-codex-result.md",
    ".codex-handoff/inbox/latest-codex-result.json",
    ".codex-handoff/review/latest-system-review.md",
    ".codex-handoff/review/latest-feedback-to-codex.md",
    ".codex-handoff/review/latest-review-summary.json",
    ".codex-handoff/runs/latest-run-summary.json",
    ".codex-handoff/runs/codex-stdout.txt",
    ".codex-handoff/runs/codex-stderr.txt",
  ];
}

function createSampleCodexResult() {
  return `# Codex Result

## Summary
Sample/manual bridge result used to verify the local result import path. This is not a real Codex execution.

## Changed Files
- none

## Commands Run
- sample/manual bridge only

## Tests Passed
- passed: sample/manual bridge validation only.

## Evidence Paths
- .codex-handoff/inbox/latest-codex-result.md

## Known Issues
- none

## Boundary Check
- legacy/ modified: no
- PROJECT_CONTEXT.md created: no
- oh-my-codex / OMX called: no
- worktree created: no
- workflow run hookup: no
- default NVIDIA /chat lane changed: no
- secret exposed: no
- failed verification: no

## Next Steps
- Import this sample result and generate feedback.
`;
}

function createSampleHandoffPrompt() {
  return `# Codex Desktop Handoff Pack

## Task Goal
Verify the controlled Codex loop dry-run path.

## Implementation Constraints
- Manual bridge / dry-run only by default.

## Forbidden Actions
- Do not modify legacy/
- Do not create PROJECT_CONTEXT.md
- Do not call oh-my-codex / OMX / team / ralph.
- Do not create a worktree.
- Do not connect workflow run.
- Do not change the default NVIDIA /chat lane.
- Do not commit, push, or expose secrets.

## Verification Commands
- cmd /c pnpm run codex:loop:dry-run

## Response Format
- Summary
- Changed Files
- Commands Run
- Tests Passed
- Evidence Paths
- Boundary Check
`;
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
