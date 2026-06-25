import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
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
import { fetchJson } from "./entrypointUtils.js";

const execFileAsync = promisify(execFile);
const scriptPath = "tools/agent-workforce/pull-codex-handoff.ps1";
const manualLoopDoc = "docs/AGENT_WORKFORCE_MANUAL_CODEX_EXECUTION_LOOP.md";
const safeRunnerDoc = "docs/AGENT_WORKFORCE_SAFE_DESKTOP_RUNNER_DESIGN.md";

const phaseDefinitions = {
  "phase-205a-desktop-handoff-pull-script": {
    script: "verify:phase205a-desktop-handoff-pull-script",
    entrypoint: "verifyAgentWorkforceDesktopHandoffPullScript.js",
    conclusion: "desktop-handoff-pull-script-complete",
    docs: [],
    checks: ({ scriptText }) => ({
      scriptFilePresent: existsSync(resolve(repoRoot, scriptPath)),
      parametersPresent:
        scriptText.includes("$BaseUrl = \"http://127.0.0.1:3100\"") &&
        scriptText.includes("$PlanId") &&
        scriptText.includes("[ValidateSet(\"markdown\", \"json\")]") &&
        scriptText.includes("$OutputDir = \".codex-handoff\"") &&
        scriptText.includes("$CopyToClipboard = $true") &&
        scriptText.includes("$OpenFile = $false") &&
        scriptText.includes("$OpenCodex = $false"),
      endpointCallsPresent:
        scriptText.includes("/workforce/plans") &&
        scriptText.includes("/export?format=markdown") &&
        scriptText.includes("/export?format=json"),
      outputFilesPresent:
        scriptText.includes("latest-codex-handoff.md") &&
        scriptText.includes("latest-codex-handoff.json") &&
        scriptText.includes("latest-metadata.json"),
      clipboardCopyPresent: scriptText.includes("Set-Clipboard"),
      serviceFailureIsExplicit: scriptText.includes("Ensure the local service is running and reachable"),
      noPlanFailureIsExplicit: scriptText.includes("No saved Agent Workforce plan found"),
      extractsCodexHandoffPack: scriptText.includes("codexDesktopHandoffPack") && scriptText.includes("Codex Desktop Handoff Pack was not present"),
      noAutomaticCodexExecution: !/codex\s+exec\b/i.test(scriptText) && !scriptText.includes("automaticPromptDispatch = $true"),
      noApplyMergeCommitPush:
        !/git\s+commit/i.test(scriptText) &&
        !/git\s+push/i.test(scriptText) &&
        !/apply\s+patch/i.test(scriptText) &&
        scriptText.includes("autoApply = $false") &&
        scriptText.includes("autoMerge = $false") &&
        scriptText.includes("autoCommit = $false") &&
        scriptText.includes("autoPush = $false"),
      noWorktreeWorkflowRunner:
        scriptText.includes("worktreeCreated = $false") &&
        scriptText.includes("workflowRun = $false") &&
        scriptText.includes("realExternalRunnerDispatch = $false"),
    }),
  },
  "phase-206a-one-command-codex-handoff-shortcut": {
    script: "verify:phase206a-one-command-codex-handoff-shortcut",
    entrypoint: "verifyAgentWorkforceOneCommandCodexHandoffShortcut.js",
    conclusion: "one-command-codex-handoff-shortcut-complete",
    checks: ({ texts, scriptText }) => ({
      defaultShortcutPresent:
        texts.rootPackage.scripts?.["handoff:codex"] === "powershell -ExecutionPolicy Bypass -File tools/agent-workforce/pull-codex-handoff.ps1",
      openFileShortcutPresent:
        texts.rootPackage.scripts?.["handoff:codex:open"] === "powershell -ExecutionPolicy Bypass -File tools/agent-workforce/pull-codex-handoff.ps1 -OpenFile true",
      openCodexShortcutPresent:
        texts.rootPackage.scripts?.["handoff:codex:app"] === "powershell -ExecutionPolicy Bypass -File tools/agent-workforce/pull-codex-handoff.ps1 -OpenCodex true",
      defaultShortcutDoesNotOpenCodex: !texts.rootPackage.scripts?.["handoff:codex"]?.includes("OpenCodex"),
      openCodexOnlyOpens:
        scriptText.includes("Get-Command codex") &&
        scriptText.includes("Opening Codex without prompt/task arguments") &&
        scriptText.includes("Start-Process -FilePath $codexCommand.Source") &&
        !/codex\s+exec\b/i.test(scriptText),
      missingCodexReportsHonestly: scriptText.includes("Codex command was not found"),
      noPromptPassedToCodex:
        !scriptText.includes("--prompt") &&
        !scriptText.includes("-p ") &&
        !scriptText.includes("automaticPromptDispatch = $true"),
    }),
  },
  "phase-207a-ui-handoff-automation-guide": {
    script: "verify:phase207a-ui-handoff-automation-guide",
    entrypoint: "verifyAgentWorkforceUiHandoffAutomationGuide.js",
    conclusion: "ui-handoff-automation-guide-complete",
    docs: [manualLoopDoc, safeRunnerDoc],
    checks: ({ texts, docs }) => {
      const manualLoop = docs[manualLoopDoc] || "";
      const safeRunner = docs[safeRunnerDoc] || "";
      const required = [
        "cmd /c pnpm run handoff:codex",
        ".codex-handoff/latest-codex-handoff.md",
        ".codex-handoff/latest-codex-handoff.json",
        ".codex-handoff/latest-metadata.json",
        "Windows clipboard",
      ];
      return {
        uiGuidePresent:
          texts.ui.includes("cmd /c pnpm run handoff:codex") &&
          texts.ui.includes(".codex-handoff/latest-codex-handoff.md") &&
          texts.ui.includes("handoff:codex:app only opens Codex and does not execute"),
        readmeGuidePresent: required.every((item) => texts.readme.includes(item)),
        userManualGuidePresent: required.every((item) => texts.userManual.includes(item)),
        manualLoopGuidePresent: required.every((item) => manualLoop.includes(item)) && manualLoop.includes("does not send the prompt"),
        safeRunnerGuidePresent:
          safeRunner.includes("The Phase 205A-208A clipboard helper is not a runner") &&
          safeRunner.includes("may only open Codex for a human paste") &&
          safeRunner.includes("must not execute a prompt or task"),
      };
    },
  },
  "phase-208a-clipboard-handoff-real-trial": {
    script: "verify:phase208a-clipboard-handoff-real-trial",
    entrypoint: "verifyAgentWorkforceClipboardHandoffRealTrial.js",
    conclusion: "clipboard-handoff-real-trial-complete",
    runRealTrial: true,
    checks: ({ realTrial }) => ({
      serviceHealthReady: realTrial.healthReady,
      savedPlanPresent: realTrial.savedPlanCount > 0,
      handoffCommandPassed: realTrial.handoffCommandPassed,
      markdownFileExists: realTrial.markdownFileExists,
      jsonFileExists: realTrial.jsonFileExists,
      metadataFileExists: realTrial.metadataFileExists,
      markdownContainsRequiredSections: realTrial.markdownContainsRequiredSections,
      clipboardContainsRequiredSections: realTrial.clipboardContainsRequiredSections,
      metadataRecordedClipboardCopy: realTrial.metadata?.clipboardCopied === true,
      noAutomaticCodexExecution:
        realTrial.metadata?.safety?.codexCliAutoExecution === false &&
        realTrial.metadata?.safety?.automaticPromptDispatch === false &&
        realTrial.metadata?.openCodexRequested === false,
      noWorktreeWorkflowRunner:
        realTrial.worktreeListUnchanged &&
        realTrial.metadata?.safety?.worktreeCreated === false &&
        realTrial.metadata?.safety?.workflowRun === false &&
        realTrial.metadata?.safety?.realExternalRunnerDispatch === false,
      noBusinessCodeModified: realTrial.businessStatusUnchanged,
    }),
  },
};

export async function runDesktopHandoffAutomationCheck(phase) {
  const definition = phaseDefinitions[phase];
  if (!definition) {
    throw new Error(`Unknown desktop handoff automation phase: ${phase}`);
  }

  try {
    const phase204 = await readEvidence("phase-204a-safe-desktop-runner-design");
    const texts = await readWorkspaceTexts();
    const scriptText = await readRequired(scriptPath);
    const docs = {};
    for (const docPath of definition.docs || []) {
      docs[docPath] = await readRequired(docPath);
    }
    const realTrial = definition.runRealTrial ? await runClipboardRealTrial() : null;
    const allText = [
      texts.rootPackageText,
      texts.servicePackageText,
      texts.ui,
      texts.readme,
      texts.agentsDoc,
      texts.userManual,
      scriptText,
      ...Object.values(docs),
      realTrial?.markdown || "",
      JSON.stringify(realTrial?.metadata || {}),
    ].join("\n\n");
    const secretFindingCount = countSecretFindings(allText, phase);

    const checks = {
      phase204Passed: phase204.status === "passed",
      rootScriptPresent: texts.rootPackage.scripts?.[definition.script]?.includes(definition.script),
      serviceScriptPresent: texts.servicePackage.scripts?.[definition.script] === `node ./src/entrypoints/${definition.entrypoint}`,
      noOhMyCodexDependencyAdded: noOhMyCodexDependency(texts.rootPackageText, texts.servicePackageText),
      projectContextNotCreated: noProjectContext(),
      noPlainSecrets: secretFindingCount === 0,
      ...definition.checks({ texts, docs, scriptText, realTrial }),
    };
    const passed = Object.values(checks).every(Boolean);
    await writeEvidence(phase, {
      phase,
      status: passed ? "passed" : "failed",
      generatedAt: new Date().toISOString(),
      checks,
      verifiedDocuments: definition.docs || [],
      disabledState: createDisabledState(),
      safety: {
        ...createSafety(),
        codexCliAutoExecution: false,
        automaticPromptDispatch: false,
        autoApply: false,
        autoMerge: false,
        autoCommit: false,
        autoPush: false,
      },
      secretFindingCount,
      conclusion: passed ? definition.conclusion : definition.conclusion.replace(/complete$/, "incomplete"),
      notes: [
        "Phase 205A-208A only automates pulling, writing, and clipboard-copying the manual handoff pack.",
        "No real Agent execution, no automatic Codex execution, no worktree, no workflow run, no real external runner dispatch, no auto apply/merge/commit/push.",
      ],
      realTrialSummary: realTrial ? summarizeRealTrial(realTrial) : undefined,
    });
    process.exitCode = passed ? 0 : 1;
  } catch (error) {
    await writeEvidence(phase, {
      phase,
      status: "failed",
      generatedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      disabledState: createDisabledState(),
      safety: {
        ...createSafety(),
        codexCliAutoExecution: false,
        automaticPromptDispatch: false,
        autoApply: false,
        autoMerge: false,
        autoCommit: false,
        autoPush: false,
      },
      conclusion: definition.conclusion.replace(/complete$/, "incomplete"),
    });
    process.exitCode = 1;
  }
}

async function runClipboardRealTrial() {
  const baseUrl = "http://127.0.0.1:3100";
  const outputDir = resolve(repoRoot, ".codex-handoff");
  const markdownPath = resolve(outputDir, "latest-codex-handoff.md");
  const jsonPath = resolve(outputDir, "latest-codex-handoff.json");
  const metadataPath = resolve(outputDir, "latest-metadata.json");

  const health = await fetchJson(`${baseUrl}/health/check`);
  const healthText = JSON.stringify(health.body || {});
  const healthReady = health.httpStatus === 200 && healthText.includes("ready");
  if (!healthReady) {
    throw new Error("Local service is not ready at http://127.0.0.1:3100/health/check.");
  }

  const plansResponse = await fetchJson(`${baseUrl}/workforce/plans`);
  const plans = Array.isArray(plansResponse.body?.data?.plans) ? plansResponse.body.data.plans : [];
  if (plans.length === 0) {
    throw new Error("No saved Agent Workforce plan found. Generate and save a plan in /ui before Phase 208A.");
  }

  const beforeWorktrees = await runGit(["worktree", "list", "--porcelain"]);
  const beforeStatus = filterBusinessStatus(await runGit(["status", "--short", "--untracked-files=all"]));
  const handoffResult = await runCommand("cmd", ["/c", "pnpm", "run", "handoff:codex"], 120000);
  const afterWorktrees = await runGit(["worktree", "list", "--porcelain"]);
  const afterStatus = filterBusinessStatus(await runGit(["status", "--short", "--untracked-files=all"]));

  const markdownFileExists = existsSync(markdownPath);
  const jsonFileExists = existsSync(jsonPath);
  const metadataFileExists = existsSync(metadataPath);
  const markdown = markdownFileExists ? await readFile(markdownPath, "utf8") : "";
  const metadata = metadataFileExists ? JSON.parse(await readFile(metadataPath, "utf8")) : {};
  const clipboard = await runCommand("powershell", ["-NoProfile", "-Command", "Get-Clipboard -Raw"], 30000);

  const requiredMarkers = [
    "Codex Desktop Handoff Pack",
    "Task Goal",
    "Implementation Constraints",
    "Forbidden Actions",
    "Verification Commands",
    "Response Format",
    "Do not modify legacy/",
    "Do not create PROJECT_CONTEXT.md",
    "oh-my-codex / OMX",
    "worktree",
    "NVIDIA /chat",
  ];

  return {
    baseUrl,
    healthReady,
    savedPlanCount: plans.length,
    latestPlanId: plans[0]?.planId,
    handoffCommandPassed: /"status"\s*:\s*"ok"/.test(handoffResult),
    markdownPath,
    jsonPath,
    metadataPath,
    markdownFileExists,
    jsonFileExists,
    metadataFileExists,
    markdown,
    metadata,
    clipboardLength: clipboard.length,
    markdownContainsRequiredSections: requiredMarkers.every((marker) => markdown.includes(marker)),
    clipboardContainsRequiredSections: requiredMarkers.every((marker) => clipboard.includes(marker)),
    worktreeListUnchanged: beforeWorktrees === afterWorktrees,
    businessStatusUnchanged: beforeStatus === afterStatus,
  };
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

function summarizeRealTrial(realTrial) {
  return {
    baseUrl: realTrial.baseUrl,
    healthReady: realTrial.healthReady,
    savedPlanCount: realTrial.savedPlanCount,
    latestPlanId: realTrial.latestPlanId,
    markdownPath: realTrial.markdownPath,
    jsonPath: realTrial.jsonPath,
    metadataPath: realTrial.metadataPath,
    clipboardLength: realTrial.clipboardLength,
    clipboardCopied: realTrial.metadata?.clipboardCopied === true,
    openCodexRequested: realTrial.metadata?.openCodexRequested === true,
    worktreeListUnchanged: realTrial.worktreeListUnchanged,
    businessStatusUnchanged: realTrial.businessStatusUnchanged,
  };
}
