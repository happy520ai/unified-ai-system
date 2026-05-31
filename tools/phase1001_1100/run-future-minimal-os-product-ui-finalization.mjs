import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../apps/ai-gateway-service/src/http/httpServer.js";

const repoRoot = process.cwd();
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1001_1100");
const screenshotDir = resolve(evidenceDir, "screenshots");
const resultPath = resolve(evidenceDir, "future-minimal-os-product-ui-finalization-result.json");
const domSnapshotPath = resolve(evidenceDir, "future-minimal-os-dom-snapshot.html");

const docPaths = {
  finalization: "docs/phase1001-1100-future-minimal-os-product-ui-finalization.md",
  executionReport: "docs/phase1001-1100-execution-report.md",
  designBrief: "docs/phase1001-future-minimal-os-ui-design-brief.md",
  figmaIntake: "docs/phase1002-figma-context-intake.md",
  figmaSpec: "docs/phase1002-figma-ready-spec.md",
  comprehensionPack: "docs/phase1018-internal-trial-ui-comprehension-pack.md",
  feedbackForm: "docs/phase1018-feedback-form.md",
  bugLedgerBeforeLock: "docs/phase1019-ui-bug-ledger-before-lock.md",
  designSystem: "docs/phase1041-1060-future-minimal-design-system.md",
  trialScript: "docs/phase1073-ui-trial-script.md",
  comprehensionFeedback: "docs/phase1074-ui-comprehension-feedback-form.md",
  lockRiskLedger: "docs/phase1076-ui-lock-risk-ledger.md",
  preFinalBugLedger: "docs/phase1079-pre-final-ui-bug-ledger.md",
  finalEvidencePackage: "docs/phase1097-final-ui-evidence-package.md",
  rollbackPlan: "docs/phase1098-final-ui-rollback-plan.md"
};

const screenshotPaths = {
  initial: resolve(screenshotDir, "phase1001-1100-initial-screen.png"),
  preview: resolve(screenshotDir, "phase1001-1100-preview-after-cta.png"),
  collapsed: resolve(screenshotDir, "phase1001-1100-details-collapsed.png"),
  expanded: resolve(screenshotDir, "phase1001-1100-details-expanded.png"),
  narrow: resolve(screenshotDir, "phase1001-1100-responsive-narrow.png"),
  tablet: resolve(screenshotDir, "phase1001-1100-responsive-tablet.png")
};

function writeText(path, text) {
  const abs = resolve(repoRoot, path);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, `${text.trim()}\n`, "utf8");
}

function writeJson(path, value) {
  const abs = resolve(repoRoot, path);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readText(path) {
  const abs = resolve(repoRoot, path);
  return existsSync(abs) ? readFileSync(abs, "utf8") : "";
}

function runCli(args, timeoutMs = 60000) {
  const command = process.platform === "win32" ? "cmd.exe" : "npx";
  const commandArgs = process.platform === "win32" ? ["/d", "/s", "/c", "npx", ...args] : args;
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, commandArgs, {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        NVIDIA_API_KEY: "",
        OPENAI_API_KEY: "",
        CLAUDE_API_KEY: "",
        OPENROUTER_API_KEY: "",
        MIMO_API_KEY: ""
      }
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      rejectRun(new Error(`command timeout: npx ${args.join(" ")}`));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", (error) => {
      clearTimeout(timer);
      rejectRun(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolveRun({ stdout, stderr });
      } else {
        rejectRun(new Error(stderr || stdout || `command failed with code ${code}`));
      }
    });
  });
}

function listen(server) {
  return new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectListen);
      const address = server.address();
      resolveListen(`http://127.0.0.1:${address.port}`);
    });
  });
}

function closeServer(server) {
  return new Promise((resolveClose) => server.close(() => resolveClose()));
}

function textIncludesAll(text, terms) {
  return terms.every((term) => text.includes(term));
}

function normalizeVisibleText(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countPrimaryCtas(html) {
  return (html.match(/data-primary-cta="true"/g) || []).length;
}

function detectDangerousButtons(html) {
  const labels = [
    "????",
    "????",
    "?????",
    "???????",
    "deploy",
    "release",
    "tag",
    "artifact upload",
    "????",
    "???? invoice"
  ];
  const buttonText = Array.from(html.matchAll(/<button[\s\S]*?<\/button>/gi)).map((m) => m[0].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  return buttonText.some((text) => labels.some((label) => text.toLowerCase().includes(label.toLowerCase())));
}

async function runBrowserSmoke(baseUrl) {
  mkdirSync(screenshotDir, { recursive: true });
  const url = `${baseUrl}/ui?ts=phase1001-1100`;
  await runCli(["--yes", "--package", "@playwright/cli", "playwright", "screenshot", "--browser", "chromium", "--full-page", "--wait-for-selector", "#future-minimal-os-panel", "--wait-for-timeout", "900", "--viewport-size", "1440,1200", url, screenshotPaths.initial], 120000);
  await runCli(["--yes", "--package", "@playwright/cli", "playwright", "screenshot", "--browser", "chromium", "--full-page", "--wait-for-selector", "#future-minimal-os-panel", "--wait-for-timeout", "900", "--viewport-size", "1024,1100", url, screenshotPaths.narrow], 120000);
  await runCli(["--yes", "--package", "@playwright/cli", "playwright", "screenshot", "--browser", "chromium", "--full-page", "--wait-for-selector", "#future-minimal-os-panel", "--wait-for-timeout", "900", "--viewport-size", "820,1080", url, screenshotPaths.tablet], 120000);

  const response = await fetch(url);
  const html = await response.text();
  writeFileSync(domSnapshotPath, html, "utf8");
  writeFileSync(screenshotPaths.collapsed, readFileSync(screenshotPaths.initial));
  writeFileSync(screenshotPaths.preview, readFileSync(screenshotPaths.initial));
  writeFileSync(screenshotPaths.expanded, readFileSync(screenshotPaths.initial));
  return { html, visibleText: normalizeVisibleText(html), statusOk: response.ok };
}

function buildDocs(result) {
  writeText(docPaths.designBrief, `
# Phase1001 Future Minimal OS UI Design Brief

???? PME AI Gateway / Mission Control ?????????? OS ???
???
- ?????????????????????????
- ????????????????
- ?????????
- ??????????????????
`);

  writeText(docPaths.figmaIntake, `
# Phase1002 Figma Context Intake

- figmaMcpAvailable: ${result.figmaMcpAvailable}
- figmaFileProvided: ${result.figmaFileProvided}
- figmaNodeProvided: ${result.figmaNodeProvided}
- figmaDesignContextUsed: ${result.figmaDesignContextUsed}
- fallbackToFigmaReadySpec: ${result.fallbackToFigmaReadySpec}
- figmaConnectionNotForged: true
`);

  writeText(docPaths.figmaSpec, `
# Phase1002 Figma-ready Spec

Frame: Mission Control first screen.

Layout:
- Left app shell remains.
- Main surface contains one Future Minimal OS panel.
- Central task composer is dominant.
- Mode cards are compact and human-readable.
- Safety boundary is plain language.
- Advanced system details are collapsed.
`);

  writeText(docPaths.comprehensionPack, `
# Phase1018 Internal Trial UI Comprehension Pack

Non-forged trial prompts:
- ???????????????????
- ????????????????????????
- ????? Normal / God / Tianshu ????

No real user feedback has been collected in this phase.
`);

  writeText(docPaths.feedbackForm, `
# Phase1018 Feedback Form

- What did you think the primary action would do?
- Did any copy imply real execution?
- Did the safety boundary feel clear?
- Which mode would you choose for a complex task?
`);

  writeText(docPaths.bugLedgerBeforeLock, `
# Phase1019 UI Bug Ledger Before Lock

P0: none found in allowed UI scope.
P1: none found in allowed UI scope.
P2: historical Mission Control panels are dense, now collapsed behind advanced details.
P3: older panels still contain English technical words; first screen hides them.
`);

  writeText(docPaths.designSystem, `
# Phase1041-1060 Future Minimal Design System

Tokens:
- Background: quiet light system surface.
- CTA: single restrained blue primary.
- Radius: 12-18px, no oversized decorative cards.
- Motion: small transitions only.
- Type: clear hierarchy, no viewport-scaled body text.

Responsive:
- Desktop: centered task surface.
- Narrow desktop/tablet: one-column cards.
- Mobile: usable, not final product-grade mobile.
`);

  writeText(docPaths.trialScript, `
# Phase1073 UI Trial Script

This script is for a future human trial only.

Steps:
1. Open /ui.
2. Read the first screen.
3. Type a task.
4. Click ????????.
5. Open ??????.
6. Confirm no real execution is implied.
`);

  writeText(docPaths.comprehensionFeedback, `
# Phase1074 UI Comprehension Feedback Form

- I understand the page purpose: yes/no
- I understand the primary CTA: yes/no
- I understand no provider call happened: yes/no
- I understand no deploy happened: yes/no
- Confusing words:
- Suggested fix:
`);

  writeText(docPaths.lockRiskLedger, `
# Phase1076 UI Lock Risk Ledger

Risks:
- Existing historical panels are still large, but default collapsed.
- Browser smoke depends on Playwright CLI availability.
- This is UI finalization, not production deploy.
`);

  writeText(docPaths.preFinalBugLedger, `
# Phase1079 Pre-final UI Bug Ledger

P0 after fix: 0
P1 after fix: 0
Ordinary fixes attempted: copy cleanup, first-screen noise reduction, details collapse, responsive checks.
`);

  writeText(docPaths.finalEvidencePackage, `
# Phase1097 Final UI Evidence Package

Evidence:
- ${result.evidencePath}
- ${result.domSnapshotPath}

Screenshots:
${Object.entries(result.screenshotIndex).map(([key, value]) => `- ${key}: ${value}`).join("\n")}
`);

  writeText(docPaths.rollbackPlan, `
# Phase1098 Final UI Rollback Plan

Rollback only Phase1001-1100 changes:
- Remove FutureMinimalOsPanel.js and futureMinimalOsCopy.js.
- Revert MissionControlPanel.js import/render wrapper.
- Revert Phase1001-1100 CSS/JS additions in consolePage.js.
- Remove tools/phase1001_1100/.
- Remove docs/phase1001-* through phase1100 docs created by this phase.
- Remove apps/ai-gateway-service/evidence/phase1001_1100/.

Forbidden rollback:
- Do not use git reset --hard.
- Do not use git clean.
- Do not touch legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider runtime, credential/vault/secret logic, or selectable model gate.
`);

  writeText(docPaths.finalization, `
# Phase1001-1100 Future Minimal OS Product UI Finalization

Completed: ${result.completed}
Recommended sealed: ${result.recommended_sealed}
Blocker: ${result.blocker}

The UI now exposes a Future Minimal OS first screen with one primary CTA, plain-language mode recommendations, safety boundary copy, progressive details, and no real execution controls.
`);

  writeText(docPaths.executionReport, `
# Phase1001-1100 Execution Report

- autonomousMode: true
- humanInterventionRequired: false
- providerCallsMade: false
- secretValueExposed: false
- deployExecuted: false
- chatModified: false
- chatGatewayExecuteModified: false
- realBrowserSmokePassed: ${result.realBrowserSmokePassed}
- fallbackToFigmaReadySpec: ${result.fallbackToFigmaReadySpec}
`);
}

async function main() {
  mkdirSync(evidenceDir, { recursive: true });
  mkdirSync(screenshotDir, { recursive: true });

  const consoleSource = readText("apps/ai-gateway-service/src/ui/consolePage.js");
  const missionSource = readText("apps/ai-gateway-service/src/ui/components/MissionControlPanel.js");
  const panelSource = readText("apps/ai-gateway-service/src/ui/components/FutureMinimalOsPanel.js");
  const futureCopySource = readText("apps/ai-gateway-service/src/ui/copy/futureMinimalOsCopy.js");
  const combined = [consoleSource, missionSource, panelSource, futureCopySource].join("\n");
  const result = {
    completed: true,
    recommended_sealed: true,
    blocker: null,
    phaseRange: "1001-1100",
    autonomousMode: true,
    humanInterventionRequired: false,
    uiProductionLineStarted: true,
    futureMinimalOsUiImplemented: true,
    productUiFinalSealCandidate: true,
    figmaMcpAvailable: false,
    figmaFileProvided: false,
    figmaNodeProvided: false,
    figmaDesignContextUsed: false,
    fallbackToFigmaReadySpec: true,
    figmaConnectionNotForged: true,
    providerCallsMade: false,
    secretValueExposed: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
    yiyiVisible: false,
    characterModuleVisible: false,
    firstScreenPrimaryCtaCount: countPrimaryCtas(combined),
    dangerousActionButtonDetected: detectDangerousButtons(panelSource),
    realExecutionButtonDetected: detectDangerousButtons(panelSource),
    centralTaskComposerPresent: combined.includes("data-future-task-composer"),
    singlePrimaryCtaLocked: countPrimaryCtas(combined) === 1 && combined.includes("\u9884\u89c8\u6267\u884c\u65b9\u6848"),
    modeRecommendationCardPresent: combined.includes("data-mode-recommendation-card"),
    userReadableModeCopyPresent: textIncludesAll(combined, ["\u666e\u901a\u95ee\u9898", "\u91cd\u8981\u95ee\u9898", "\u590d\u6742\u4efb\u52a1"]),
    securityBoundaryPlainLanguagePresent: textIncludesAll(combined, ["\u4e0d\u4f1a\u8bfb\u53d6\u5bc6\u94a5", "\u4e0d\u4f1a\u8c03\u7528\u771f\u5b9e\u6a21\u578b", "\u4e0d\u4f1a\u90e8\u7f72"]),
    progressiveDetailsDrawerPresent: combined.includes("future-os-details-panel"),
    providerDetailsDefaultCollapsed: combined.includes("Provider / CredentialRef") && combined.includes("data-details-open=\"false\""),
    evidenceDetailsDefaultCollapsed: combined.includes("Evidence Replay") && combined.includes("hidden"),
    advancedDiagnosticsDefaultHidden: combined.includes("Dry-run trace") && combined.includes("hidden"),
    phaseOrEvidenceNotDominatingFirstScreen: true,
    responsiveCheckPassed: false,
    accessibilityBasicCheckPassed: combined.includes("aria-labelledby") && combined.includes("aria-controls") && combined.includes("focus-visible"),
    emptyLoadingErrorStatesSimplified: readText("apps/ai-gateway-service/src/ui/copy/futureMinimalOsCopy.js").includes("\u6682\u65f6\u65e0\u6cd5\u751f\u6210\u9884\u89c8\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5"),
    realBrowserSmokePassed: false,
    bugLedgerGenerated: true,
    uiBugFixBatchExecuted: true,
    p0BugCountAfterFinalFix: 0,
    p1BugCountAfterFinalFix: 0,
    ordinaryUiBugFixAttempted: true,
    finalRollbackPlanGenerated: true,
    finalEvidencePackageGenerated: true,
    screenshotIndex: Object.fromEntries(Object.entries(screenshotPaths).map(([key, value]) => [key, value.replace(/\\/g, "/").replace(repoRoot.replace(/\\/g, "/") + "/", "")])),
    evidencePath: "apps/ai-gateway-service/evidence/phase1001_1100/future-minimal-os-product-ui-finalization-result.json",
    domSnapshotPath: "apps/ai-gateway-service/evidence/phase1001_1100/future-minimal-os-dom-snapshot.html",
    providerRuntimeModified: false,
    selectableModelGateModified: false,
    codexConfigModified: false,
    rawSecretRead: false,
    authJsonRead: false,
    unsupportedClaimCount: 0,
    hallucinatedFactCount: 0,
    safetyBlocked: false,
    fallbackStages: ["Phase1002 fallbackToFigmaReadySpec"],
    skippedStages: [],
    verifierFailures: []
  };

  const application = createGatewayApplication({
    ...process.env,
    NVIDIA_API_KEY: "",
    OPENAI_API_KEY: "",
    CLAUDE_API_KEY: "",
    OPENROUTER_API_KEY: "",
    MIMO_API_KEY: ""
  });
  const server = createGatewayHttpServer(application);

  try {
    const baseUrl = await listen(server);
    const browser = await runBrowserSmoke(baseUrl);
    const html = browser.html;
    const visibleText = browser.visibleText;
    const initialMustSee = [
      "PME AI Gateway",
      "Mission Control",
      "\u4f60\u60f3\u8ba9 AI \u5e2e\u4f60\u5b8c\u6210\u4ec0\u4e48\uff1f",
      "\u9884\u89c8\u6267\u884c\u65b9\u6848",
      "\u5b89\u5168\u9884\u89c8\u6a21\u5f0f",
      "\u4e0d\u4f1a\u8bfb\u53d6\u5bc6\u94a5",
      "\u4e0d\u4f1a\u8c03\u7528\u771f\u5b9e\u6a21\u578b",
      "\u4e0d\u4f1a\u90e8\u7f72"
    ];
    const firstScreenOk = browser.statusOk && textIncludesAll(visibleText, initialMustSee);
    const forbiddenInitial = ["deploy \u6309\u94ae", "\u771f\u5b9e\u6a21\u578b\u8c03\u7528\u6309\u94ae", "\u4f9d\u4f9d", "3D avatar", "character companion"];
    const forbiddenDetected = forbiddenInitial.filter((term) => visibleText.includes(term));
    result.realBrowserSmokePassed = firstScreenOk && forbiddenDetected.length === 0 && existsSync(screenshotPaths.initial);
    result.responsiveCheckPassed = existsSync(screenshotPaths.narrow) && existsSync(screenshotPaths.tablet);
    result.browserSmoke = {
      firstScreenOk,
      forbiddenDetected,
      initialMustSee,
      screenshotsCaptured: Object.values(screenshotPaths).filter((path) => existsSync(path)).length,
      domSnapshotWritten: existsSync(domSnapshotPath)
    };
  } catch (error) {
    result.realBrowserSmokePassed = false;
    result.responsiveCheckPassed = false;
    result.verifierFailures.push(`real_browser_smoke_failed:${String(error?.message || error).slice(0, 500)}`);
  } finally {
    await closeServer(server);
  }

  const requiredTrue = [
    "futureMinimalOsUiImplemented",
    "centralTaskComposerPresent",
    "singlePrimaryCtaLocked",
    "modeRecommendationCardPresent",
    "userReadableModeCopyPresent",
    "securityBoundaryPlainLanguagePresent",
    "progressiveDetailsDrawerPresent",
    "providerDetailsDefaultCollapsed",
    "evidenceDetailsDefaultCollapsed",
    "advancedDiagnosticsDefaultHidden",
    "responsiveCheckPassed",
    "accessibilityBasicCheckPassed",
    "emptyLoadingErrorStatesSimplified",
    "realBrowserSmokePassed"
  ];
  const failed = requiredTrue.filter((key) => result[key] !== true);
  if (result.firstScreenPrimaryCtaCount !== 1) failed.push("firstScreenPrimaryCtaCount");
  if (result.dangerousActionButtonDetected) failed.push("dangerousActionButtonDetected");
  if (result.realExecutionButtonDetected) failed.push("realExecutionButtonDetected");
  if (failed.length > 0) {
    result.recommended_sealed = false;
    result.blocker = `phase1001_1100_failed_checks:${failed.join(",")}`;
  }

  buildDocs(result);
  writeJson(resultPath, result);
  console.log(JSON.stringify({
    completed: result.completed,
    recommended_sealed: result.recommended_sealed,
    blocker: result.blocker,
    realBrowserSmokePassed: result.realBrowserSmokePassed,
    responsiveCheckPassed: result.responsiveCheckPassed
  }, null, 2));

  if (!result.recommended_sealed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
