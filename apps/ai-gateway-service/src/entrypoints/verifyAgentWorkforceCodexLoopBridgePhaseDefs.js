import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { repoRoot } from "./verifyAgentWorkforceClosureSupport.js";

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

export {
  phaseDefinitions,
  ensureBridgeStructure,
  bridgeStructurePaths,
  createSampleCodexResult,
  createSampleHandoffPrompt,
};
