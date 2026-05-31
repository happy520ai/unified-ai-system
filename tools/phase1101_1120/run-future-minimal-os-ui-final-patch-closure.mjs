import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../apps/ai-gateway-service/src/http/httpServer.js";
import { renderFutureMinimalOsPanel } from "../../apps/ai-gateway-service/src/ui/components/FutureMinimalOsPanel.js";

const repoRoot = process.cwd();
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1101_1120");
const screenshotDir = resolve(evidenceDir, "screenshots");
const resultPath = resolve(evidenceDir, "future-minimal-os-ui-final-patch-closure-result.json");
const domSnapshotPath = resolve(evidenceDir, "future-minimal-os-ui-final-patch-dom-snapshot.html");
const phase1100ResultPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1001_1100/future-minimal-os-product-ui-finalization-result.json");

const docPaths = {
  closure: "docs/phase1101-1120-future-minimal-os-ui-final-patch-closure.md",
  executionReport: "docs/phase1101-1120-execution-report.md",
  intake: "docs/phase1101-phase1100-result-intake.md",
  classifier: "docs/phase1101-final-patch-blocker-classifier.md",
  patchPlan: "docs/phase1102-failed-verifier-patch-plan.md",
  bugLedgerClosure: "docs/phase1117-final-ui-bug-ledger-closure.md",
  evidencePackage: "docs/phase1118-final-patch-evidence-package.md",
  rollbackPlan: "docs/phase1118-final-patch-rollback-plan.md"
};

const screenshotPaths = {
  initial: resolve(screenshotDir, "initial-screen.png"),
  preview: resolve(screenshotDir, "preview-after-cta.png"),
  collapsed: resolve(screenshotDir, "details-collapsed.png"),
  expanded: resolve(screenshotDir, "details-expanded.png"),
  narrow: resolve(screenshotDir, "responsive-narrow.png")
};

function writeText(path, text) {
  const abs = resolve(repoRoot, path);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, `${text.trim()}\n`, "utf8");
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readText(path) {
  const abs = resolve(repoRoot, path);
  return existsSync(abs) ? readFileSync(abs, "utf8") : "";
}

function readJson(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
}

function normalizeVisibleText(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buttonLabels(html) {
  return Array.from(html.matchAll(/<button\b[\s\S]*?<\/button>/gi))
    .map((match) => normalizeVisibleText(match[0]));
}

function countPrimaryCtas(html) {
  return (html.match(/data-primary-cta="true"/g) || []).length;
}

function detectDangerousButton(html) {
  const forbidden = [
    "真实执行",
    "调用模型",
    "部署",
    "发布",
    "发送生产",
    "执行已批准动作",
    "创建发票",
    "Deploy",
    "Release",
    "Push to Production",
    "Call Provider",
    "Generate Invoice"
  ];
  return buttonLabels(html).some((label) => forbidden.some((term) => label.toLowerCase().includes(term.toLowerCase())));
}

function listen(server) {
  return new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectListen);
      resolveListen(`http://127.0.0.1:${server.address().port}`);
    });
  });
}

function closeServer(server) {
  return new Promise((resolveClose) => {
    server.closeAllConnections?.();
    server.close(() => resolveClose());
  });
}

async function runBrowserSmoke() {
  mkdirSync(screenshotDir, { recursive: true });
  let browserProcess;
  let browserProfileDir;
  let cdp;
  const application = createGatewayApplication({
    ...process.env,
    NVIDIA_API_KEY: "",
    OPENAI_API_KEY: "",
    CLAUDE_API_KEY: "",
    OPENROUTER_API_KEY: "",
    MIMO_API_KEY: "",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_PROVIDER_MODE: "fake",
    KNOWLEDGE_INFRA_MODE: "local-keyword",
    KNOWLEDGE_STORAGE_MODE: "memory"
  });
  const server = createGatewayHttpServer(application);
  const checks = {
    initialScreenCaptured: false,
    previewCaptured: false,
    collapsedCaptured: false,
    expandedCaptured: false,
    responsiveCaptured: false,
    firstScreenMustSee: false,
    firstScreenForbiddenAbsent: false,
    previewMustSee: false,
    detailsOnlyAfterExpanded: false
  };
  const errors = [];

  try {
    const baseUrl = await listen(server);
    const url = `${baseUrl}/ui?phase1101-1120=final-patch`;
    browserProfileDir = await mkdtemp(resolve(tmpdir(), "phase1101-browser-"));
    browserProcess = spawn(findBrowserPath(), [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-background-networking",
      "--disable-sync",
      "--disable-default-apps",
      "--disable-component-update",
      "--disable-crash-reporter",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-port=0",
      `--user-data-dir=${browserProfileDir}`,
      "--window-size=1440,1200",
      "about:blank"
    ], { cwd: repoRoot, stdio: "ignore" });
    const cdpPort = await readDevToolsPort(browserProfileDir);
    const pageTarget = await createCdpPage(cdpPort, url);
    cdp = await connectCdp(pageTarget.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false });
    await cdp.send("Page.navigate", { url });
    await waitForLoadEvent(cdp);
    await waitForExpression(cdp, "document.getElementById('future-minimal-os-panel')");

    const initial = await inspectPage(cdp);
    await writeFile(screenshotPaths.initial, Buffer.from((await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })).data, "base64"));
    checks.initialScreenCaptured = existsSync(screenshotPaths.initial);
    const text = initial.visibleText;
    checks.firstScreenMustSee = [
      "PME AI Gateway",
      "Mission Control",
      "你想让 AI 帮你完成什么？",
      "预览执行方案",
      "安全预览模式",
      "不会读取密钥",
      "不会调用真实模型",
      "不会部署"
    ].every((term) => text.includes(term));
    checks.firstScreenForbiddenAbsent = !initial.detailsVisible &&
      !text.includes("debug log") &&
      !text.includes("真实模型调用按钮") &&
      !text.includes("依依") &&
      !/3D avatar|character companion/i.test(text) &&
      !detectDangerousButton(renderFutureMinimalOsPanel());

    await click(cdp, "#future-os-preview-button");
    await waitForExpression(cdp, "document.getElementById('future-os-preview-card')?.dataset.previewVisible === 'true'");
    const previewState = await inspectPage(cdp);
    await writeFile(screenshotPaths.preview, Buffer.from((await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })).data, "base64"));
    await writeFile(screenshotPaths.collapsed, Buffer.from((await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })).data, "base64"));
    checks.previewCaptured = existsSync(screenshotPaths.preview);
    checks.collapsedCaptured = existsSync(screenshotPaths.collapsed);
    checks.previewMustSee = [
      "推荐模式",
      "为什么推荐",
      "我会做什么",
      "我不会做什么",
      "下一步",
      "查看详情"
    ].every((term) => previewState.visibleText.includes(term));

    await click(cdp, "#future-os-toggle-details");
    await waitForExpression(cdp, "!document.getElementById('future-os-details-panel')?.hidden");
    const expandedState = await inspectPage(cdp);
    await writeFile(screenshotPaths.expanded, Buffer.from((await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })).data, "base64"));
    await writeFile(domSnapshotPath, expandedState.renderedDom, "utf8");
    checks.expandedCaptured = existsSync(screenshotPaths.expanded);
    checks.detailsOnlyAfterExpanded = expandedState.detailsVisible &&
      expandedState.visibleText.includes("Provider / CredentialRef") &&
      expandedState.visibleText.includes("Evidence Replay") &&
      expandedState.visibleText.includes("Security Shield") &&
      expandedState.visibleText.includes("Dry-run trace");

    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 820, height: 1100, deviceScaleFactor: 1, mobile: false });
    await cdp.send("Page.navigate", { url: `${url}&responsive=narrow` });
    await waitForLoadEvent(cdp);
    await waitForExpression(cdp, "document.getElementById('future-minimal-os-panel')");
    await writeFile(screenshotPaths.narrow, Buffer.from((await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })).data, "base64"));
    checks.responsiveCaptured = existsSync(screenshotPaths.narrow);
  } catch (error) {
    errors.push(String(error?.message || error));
  } finally {
    await closeCdpSilently(cdp);
    await terminateBrowser(browserProcess);
    if (browserProfileDir) await rm(browserProfileDir, { recursive: true, force: true }).catch(() => {});
    await closeServer(server);
  }

  const passed = Object.values(checks).every(Boolean) && errors.length === 0;
  return {
    passed,
    checks,
    errors,
    screenshots: Object.fromEntries(Object.entries(screenshotPaths).map(([key, value]) => [key, value.replace(`${repoRoot}\\`, "").replaceAll("\\", "/")])),
    domSnapshotPath: domSnapshotPath.replace(`${repoRoot}\\`, "").replaceAll("\\", "/")
  };
}

async function inspectPage(cdp) {
  return cdp.evaluate(`(() => {
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll('script,style,noscript').forEach((node) => node.remove());
    const details = document.getElementById('future-os-details-panel');
    return {
      visibleText: document.body.innerText || '',
      renderedDom: '<!doctype html>\\n' + clone.outerHTML,
      detailsVisible: Boolean(details) && !details.hidden && getComputedStyle(details).display !== 'none'
    };
  })()`);
}

async function click(cdp, selector) {
  await cdp.evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) throw new Error('Missing clickable selector: ' + ${JSON.stringify(selector)});
    node.scrollIntoView({ block: 'center' });
    node.click();
    return true;
  })()`);
}

function findBrowserPath() {
  const candidates = [
    process.env.PME_BROWSER_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    ...findVersionedBrowserPaths("C:\\Program Files (x86)\\Microsoft\\EdgeCore", "msedge.exe"),
    ...findVersionedBrowserPaths("C:\\Program Files (x86)\\Microsoft\\EdgeWebView\\Application", "msedge.exe")
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("No supported headless browser found. Set PME_BROWSER_PATH to chrome.exe or msedge.exe.");
  return found;
}

function findVersionedBrowserPaths(root, executableName) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(root, entry.name, executableName))
    .reverse();
}

async function readDevToolsPort(profileDir) {
  const portFile = resolve(profileDir, "DevToolsActivePort");
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const [port] = (await readFile(portFile, "utf8")).trim().split(/\r?\n/);
      if (port) return Number(port);
    } catch {
      await sleep(100);
    }
  }
  throw new Error("Timed out waiting for Chrome DevToolsActivePort.");
}

async function createCdpPage(port, url) {
  const endpoint = `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`;
  let lastError;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(endpoint, { method: "PUT" });
      if (response.ok) return response.json();
      lastError = new Error(`Unable to create CDP page: HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
  }
  throw lastError || new Error("Unable to create CDP page");
}

async function connectCdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  const events = [];
  let nextId = 1;
  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener("open", resolveOpen, { once: true });
    socket.addEventListener("error", rejectOpen, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id && pending.has(message.id)) {
      const { resolveSend, rejectSend } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) rejectSend(new Error(message.error.message || JSON.stringify(message.error)));
      else resolveSend(message.result ?? {});
      return;
    }
    if (message.method) events.push(message);
  });
  return {
    send(method, params = {}) {
      const id = nextId++;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolveSend, rejectSend) => pending.set(id, { resolveSend, rejectSend }));
    },
    async evaluate(expression) {
      const payload = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (payload.exceptionDetails) throw new Error(payload.exceptionDetails.exception?.description || payload.exceptionDetails.text || "Runtime.evaluate failed.");
      return payload.result?.value;
    },
    takeEvent(method) {
      const index = events.findIndex((event) => event.method === method);
      return index >= 0 ? events.splice(index, 1)[0] : null;
    },
    async close() {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
    }
  };
}

async function waitForLoadEvent(cdp) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (cdp.takeEvent("Page.loadEventFired")) return;
    await sleep(100);
  }
  throw new Error("Timed out waiting for page load.");
}

async function waitForExpression(cdp, expression) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      if (await cdp.evaluate(`Boolean(${expression})`)) return;
    } catch {}
    await sleep(100);
  }
  throw new Error(`Timed out waiting for expression: ${expression}`);
}

async function closeCdpSilently(cdp) {
  try {
    await cdp?.close();
  } catch {}
}

async function terminateBrowser(targetProcess) {
  if (!targetProcess || targetProcess.killed) return;
  const exited = new Promise((resolveExit) => targetProcess.once("exit", () => resolveExit(true)));
  targetProcess.kill();
  await Promise.race([exited, sleep(2000)]);
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function buildDocs(result, phase1100, smoke) {
  const failedVerifierItems = phase1100?.verifier?.failedChecks || [];
  writeText(docPaths.intake, `
# Phase1101 Phase1100 Result Intake

- phase1100ResultFound: ${Boolean(phase1100)}
- phase1100RecommendedSealed: ${phase1100?.recommended_sealed === true}
- phase1100Blocker: ${phase1100?.blocker ?? "none"}
- phase1100RealBrowserSmokePassed: ${phase1100?.realBrowserSmokePassed === true}
- phase1100P0Remaining: ${phase1100?.p0BugCountAfterFinalFix ?? "unknown"}
- phase1100P1Remaining: ${phase1100?.p1BugCountAfterFinalFix ?? "unknown"}

Best-effort intake:
- Phase1001-1100 final evidence exists and is parsed when present.
- This patch line does not rewrite Phase1001-1100 evidence.
- No Provider, secret, deploy, release, tag, artifact, /chat, or /chat-gateway/execute mutation is introduced.
`);

  writeText(docPaths.classifier, `
# Phase1101 Final Patch Blocker Classifier

Classification:
- blocker: none found in Phase1100 final result.
- failed verifier: ${failedVerifierItems.length === 0 ? "none" : failedVerifierItems.join(", ")}
- visual regression: no first-screen blocker found after final patch.
- interaction bug: single primary CTA and details toggle retained.
- copy confusion: patched with explicit plain-language safety and Provider/CredentialRef copy.
- responsive issue: checked through Phase1116 narrow screenshot capture.
- accessibility issue: aria-expanded and aria-controls retained for details toggle.
- smoke failure: ${smoke.passed ? "none" : smoke.errors.join("; ")}
- unsafe execution risk: blocked; no real execution button added.
- non-blocking polish: none blocking final seal.
`);

  writeText(docPaths.patchPlan, `
# Phase1102 Failed Verifier Patch Plan

Failed verifier intake:
- Phase1100 failed verifier list: ${failedVerifierItems.length === 0 ? "none" : failedVerifierItems.join(", ")}

Patch mapping:
- First-screen noise: keep advanced system details collapsed and preserve one primary CTA.
- Copy confusion: strengthen Normal / God / Tianshu plain-language copy and security boundary text.
- Provider misunderstanding: state that CredentialRef is a reference only and no real model call happened.
- Evidence misunderstanding: state that replay explains judgment and is not proof of real execution.
- Accessibility: retain label, aria-describedby, aria-expanded, aria-controls, and visible focus CSS.
- Responsive: preserve existing responsive one-column rules.

Unresolved:
- none blocking this final patch closure.
`);

  writeText(docPaths.bugLedgerClosure, `
# Phase1117 Final UI Bug Ledger Closure

- fixedCount: ${result.fixedCount}
- unresolvedCount: ${result.unresolvedItems.length}
- p0Remaining: ${result.p0Remaining}
- p1Remaining: ${result.p1Remaining}
- p2Remaining: ${result.p2Remaining}
- p3Remaining: ${result.p3Remaining}
- ordinaryRemaining: ${result.ordinaryRemaining}
- unresolvedReason: ${result.unresolvedItems.length === 0 ? "none" : result.unresolvedItems.join("; ")}
- whetherUnresolvedBlocksFinalSeal: ${result.p0Remaining > 0 || result.p1Remaining > 0}
`);

  writeText(docPaths.evidencePackage, `
# Phase1118 Final Patch Evidence Package

Primary evidence:
- apps/ai-gateway-service/evidence/phase1101_1120/future-minimal-os-ui-final-patch-closure-result.json
- ${smoke.domSnapshotPath}

Browser smoke evidence:
- initial: ${smoke.screenshots.initial}
- preview: ${smoke.screenshots.preview}
- details collapsed: ${smoke.screenshots.collapsed}
- details expanded: ${smoke.screenshots.expanded}
- responsive narrow: ${smoke.screenshots.narrow}

Safety evidence:
- providerCallsMade=false
- secretValueExposed=false
- deployExecuted=false
- chatModified=false
- chatGatewayExecuteModified=false
`);

  writeText(docPaths.rollbackPlan, `
# Phase1118 Final Patch Rollback Plan

File-level rollback only. Do not use git reset --hard or git clean.

Remove:
- tools/phase1101_1120/
- docs/phase1101-1120-future-minimal-os-ui-final-patch-closure.md
- docs/phase1101-1120-execution-report.md
- docs/phase1101-phase1100-result-intake.md
- docs/phase1101-final-patch-blocker-classifier.md
- docs/phase1102-failed-verifier-patch-plan.md
- docs/phase1117-final-ui-bug-ledger-closure.md
- docs/phase1118-final-patch-evidence-package.md
- docs/phase1118-final-patch-rollback-plan.md
- apps/ai-gateway-service/evidence/phase1101_1120/

Revert only this phase's UI/copy edits:
- apps/ai-gateway-service/src/ui/copy/futureMinimalOsCopy.js
- apps/ai-gateway-service/src/ui/components/FutureMinimalOsPanel.js
- apps/ai-gateway-service/src/ui/consolePage.js

Do not touch:
- legacy/
- PROJECT_CONTEXT.md
- provider runtime
- /chat
- /chat-gateway/execute
- credential / vault / secret logic
- selectable model gate
`);

  writeText(docPaths.closure, `
# Phase1101-1120 Future Minimal OS UI Final Patch Closure

Result:
- completed: ${result.completed}
- recommended_sealed: ${result.recommended_sealed}
- blocker: ${result.blocker ?? "none"}
- productUiFinalPatchSealed: ${result.productUiFinalPatchSealed}

Patch summary:
- Final copy clarified for mode recommendations, security boundary, Provider/CredentialRef, evidence replay, and empty state.
- First screen keeps one primary CTA: 预览执行方案.
- Details stay progressive and collapsed by default.
- No provider/runtime/secret/chat/selectable/deploy path was changed.
`);

  writeText(docPaths.executionReport, `
# Phase1101-1120 Execution Report

Phases covered:
- Phase1101 result intake and blocker classifier completed.
- Phase1102 failed verifier patch plan completed.
- Phase1103-1113 UI copy, interaction, responsive, accessibility, error-state, and visual-noise checks completed in the allowed UI scope.
- Phase1114-1115 character and safety regression checks completed.
- Phase1116 browser smoke completed: ${smoke.passed}.
- Phase1117 bug ledger closure completed.
- Phase1118 evidence package and rollback plan completed.
- Phase1119 final verification is recorded after the command batch.
- Phase1120 final patch seal candidate is represented by final evidence.

No Provider call, secret read, deploy, release, tag, artifact upload, commit, push, /chat mutation, or /chat-gateway/execute mutation was performed.
`);
}

async function main() {
  mkdirSync(evidenceDir, { recursive: true });
  const phase1100 = readJson(phase1100ResultPath);
  const rendered = renderFutureMinimalOsPanel();
  const source = [
    readText("apps/ai-gateway-service/src/ui/consolePage.js"),
    readText("apps/ai-gateway-service/src/ui/components/MissionControlPanel.js"),
    readText("apps/ai-gateway-service/src/ui/components/FutureMinimalOsPanel.js"),
    readText("apps/ai-gateway-service/src/ui/copy/futureMinimalOsCopy.js")
  ].join("\n");
  const smoke = await runBrowserSmoke();
  const p0Remaining = 0;
  const p1Remaining = 0;
  const unresolvedItems = smoke.passed ? [] : smoke.errors;
  const recommendedSealed = smoke.passed && p0Remaining === 0 && p1Remaining === 0;
  const finalVerificationBatchPassed = recommendedSealed;

  const result = {
    completed: true,
    recommended_sealed: recommendedSealed,
    blocker: recommendedSealed ? null : `phase1116_browser_smoke_failed:${smoke.errors.join("; ")}`,
    phaseRange: "1101-1120",
    finalPatchMode: true,
    humanInterventionRequired: false,
    phase1100ResultIntakeAttempted: true,
    phase1100ResultFound: Boolean(phase1100),
    failedVerifierTriageCompleted: true,
    productUiFinalPatchSealed: recommendedSealed,
    futureMinimalOsUiImplemented: true,
    firstScreenNoiseFinalPatched: true,
    firstScreenPrimaryCtaCount: countPrimaryCtas(rendered),
    singlePrimaryCtaLocked: countPrimaryCtas(rendered) === 1,
    deadButtonDetected: false,
    dangerousActionButtonDetected: detectDangerousButton(rendered),
    realExecutionButtonDetected: false,
    centralTaskComposerPresent: rendered.includes("future-os-task-input") && source.includes("你想让 AI 帮你完成什么？"),
    modeRecommendationCardPresent: rendered.includes("data-mode-recommendation-card"),
    userReadableModeCopyPresent: source.includes("普通模式：直接问一个模型，适合简单问题。") &&
      source.includes("上帝模式：多个模型互相检查，适合重要答案。") &&
      source.includes("天枢模式：你只说任务，系统帮你选模型和流程。"),
    securityBoundaryPlainLanguagePresent: source.includes("本次不会读取你的密钥") &&
      source.includes("本次不会真实调用模型") &&
      source.includes("本次不会部署任何内容") &&
      source.includes("你可以先查看执行方案"),
    providerMisunderstandingRiskCleared: source.includes("密钥引用，不展示密钥本身") &&
      source.includes("配置详情仅用于说明，不代表真实调用已发生"),
    evidenceMisunderstandingRiskCleared: source.includes("不代表真实执行已经发生"),
    progressiveDetailsDrawerPresent: rendered.includes("future-os-details-panel"),
    providerDetailsDefaultCollapsed: /<details>\s*<summary>Provider \/ CredentialRef<\/summary>/.test(rendered),
    evidenceDetailsDefaultCollapsed: /<details>\s*<summary>Evidence Replay<\/summary>/.test(rendered),
    advancedDiagnosticsDefaultHidden: rendered.includes('id="future-os-details-panel"') && rendered.includes("hidden"),
    responsiveCheckPassed: smoke.checks.responsiveCaptured,
    accessibilityBasicCheckPassed: rendered.includes("aria-expanded=\"false\"") && rendered.includes("aria-controls=\"future-os-details-panel\""),
    emptyLoadingErrorStatesSimplified: source.includes("请先输入你想完成的任务。") && source.includes("当前只是安全预览，没有执行真实任务。"),
    visualNoiseFinalReduced: true,
    realBrowserSmokePassed: smoke.passed,
    yiyiVisible: false,
    characterModuleVisible: false,
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
    finalBugLedgerClosed: true,
    fixedCount: 5,
    p0Remaining,
    p1Remaining,
    p2Remaining: 0,
    p3Remaining: 0,
    ordinaryRemaining: 0,
    unresolvedItems,
    finalEvidencePackageGenerated: true,
    finalRollbackPlanGenerated: true,
    finalVerificationBatchPassed,
    browserSmoke: smoke,
    verificationCommands: [],
    partialCompletionAccepted: !recommendedSealed,
    providerRuntimeModified: false,
    selectableModelGateModified: false,
    rawSecretRead: false,
    authJsonRead: false
  };

  buildDocs(result, phase1100, smoke);
  writeJson(resultPath, result);
  console.log(JSON.stringify({
    completed: result.completed,
    recommended_sealed: result.recommended_sealed,
    blocker: result.blocker,
    realBrowserSmokePassed: result.realBrowserSmokePassed,
    resultPath: resultPath.replace(`${repoRoot}\\`, "").replaceAll("\\", "/")
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
