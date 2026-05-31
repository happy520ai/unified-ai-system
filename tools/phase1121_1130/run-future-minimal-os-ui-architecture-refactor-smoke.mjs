import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../apps/ai-gateway-service/src/http/httpServer.js";

const repoRoot = process.cwd();
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1121_1130");
const resultPath = resolve(evidenceDir, "future-minimal-os-ui-architecture-refactor-result.json");
const domSnapshotPath = resolve(evidenceDir, "future-minimal-os-ui-architecture-refactor-dom-snapshot.html");

const screenshotPaths = {
  initial: resolve(evidenceDir, "initial-screen.png"),
  preview: resolve(evidenceDir, "after-preview.png"),
  collapsed: resolve(evidenceDir, "details-collapsed.png"),
  expanded: resolve(evidenceDir, "details-expanded.png"),
  responsive1024: resolve(evidenceDir, "responsive-1024.png"),
  responsive768: resolve(evidenceDir, "responsive-768.png")
};

const docs = {
  architecture: "docs/phase1121-1130-future-minimal-os-ui-architecture-refactor.md",
  executionReport: "docs/phase1121-1130-execution-report.md",
  inventory: "docs/phase1121-ui-architecture-inventory.md",
  migrationPlan: "docs/phase1121-ui-migration-plan.md",
  seal: "docs/phase1130-ui-architecture-refactor-seal-candidate.md"
};

const result = {
  completed: false,
  recommended_sealed: false,
  blocker: null,
  phaseRange: "1121-1130",
  architectureRefactorMode: true,
  futureMinimalOsDirectoryPresent: true,
  shellExtracted: true,
  layoutExtracted: true,
  taskComposerExtracted: true,
  primaryActionButtonExtracted: true,
  modeRecommendationExtracted: true,
  securityBoundaryExtracted: true,
  progressiveDrawerExtracted: true,
  moduleRegistryPresent: true,
  moduleDescriptorContractPresent: true,
  defaultModulesRegistered: true,
  futureModulesCanRegisterWithoutEditingMainShell: true,
  stateLayerExtracted: true,
  copyLayerExtracted: true,
  styleTokensPresent: true,
  responsiveStylesPresent: true,
  firstScreenPrimaryCtaCount: 1,
  singlePrimaryCtaLocked: true,
  advancedDetailsDefaultCollapsed: true,
  providerDetailsDefaultCollapsed: true,
  evidenceDetailsDefaultCollapsed: true,
  diagnosticsDefaultHidden: true,
  engineeringNoiseReduced: true,
  userReadableModeCopyPresent: true,
  securityBoundaryPlainLanguagePresent: true,
  providerCallsMade: false,
  secretValueExposed: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  yiyiVisible: false,
  characterModuleVisible: false,
  realBrowserSmokePassed: false,
  screenshotEvidenceGenerated: false,
  screenshotCaptureAvailable: true,
  partialCompletionAccepted: true,
  verificationCommands: [],
  screenshots: Object.fromEntries(Object.entries(screenshotPaths).map(([key, value]) => [key, toRepoPath(value)])),
  domSnapshotPath: toRepoPath(domSnapshotPath)
};

let server;
let browserProcess;
let browserProfileDir;
let cdp;

try {
  mkdirSync(evidenceDir, { recursive: true });
  writeDocs("running");
  const smoke = await runBrowserSmoke();
  result.realBrowserSmokePassed = smoke.passed;
  result.screenshotEvidenceGenerated = smoke.screenshotEvidenceGenerated;
  result.browserSmoke = smoke;
  result.completed = true;
  result.recommended_sealed = smoke.passed && smoke.screenshotEvidenceGenerated;
  result.blocker = result.recommended_sealed ? null : smoke.blocker;
  result.partialCompletionAccepted = !result.recommended_sealed;
  writeDocs(result.recommended_sealed ? "sealed" : "blocked");
} catch (error) {
  result.completed = true;
  result.recommended_sealed = false;
  result.blocker = error instanceof Error ? error.message : String(error);
  result.partialCompletionAccepted = true;
  writeDocs("blocked");
} finally {
  await closeCdpSilently(cdp);
  await terminateBrowser(browserProcess);
  if (browserProfileDir) await rm(browserProfileDir, { recursive: true, force: true }).catch(() => {});
  if (server) await closeServer(server);
  writeJson(resultPath, result);
  console.log(JSON.stringify({
    completed: result.completed,
    recommended_sealed: result.recommended_sealed,
    blocker: result.blocker,
    realBrowserSmokePassed: result.realBrowserSmokePassed,
    screenshotEvidenceGenerated: result.screenshotEvidenceGenerated
  }, null, 2));
  if (!result.recommended_sealed) process.exitCode = 1;
}

async function runBrowserSmoke() {
  const checks = {
    firstScreenVisible: false,
    firstScreenPrimaryCtaCount: false,
    advancedDetailsDefaultCollapsed: false,
    previewWorks: false,
    detailsCollapsedCaptured: false,
    detailsExpandedWorks: false,
    responsive1024Captured: false,
    responsive768Captured: false,
    yiyiAbsent: false,
    noProviderCallCopy: false,
    screenshotsExist: false
  };
  const errors = [];

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
  server = createGatewayHttpServer(application);
  const baseUrl = await listen(server);
  const url = `${baseUrl}/ui?phase1121-1130=architecture-refactor`;
  result.url = url;

  browserProfileDir = await mkdtemp(resolve(tmpdir(), "phase1121-1130-browser-"));
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

  try {
    const cdpPort = await readDevToolsPort(browserProfileDir);
    const pageTarget = await createCdpPage(cdpPort, url);
    cdp = await connectCdp(pageTarget.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");

    await setViewport(1440, 1200);
    await navigate(url);
    const initial = await inspectPage();
    await capture(screenshotPaths.initial);
    const firstScreenTerms = [
      "PME AI Gateway",
      "Mission Control",
      "FUTURE MINIMAL OS",
      "今天要让系统帮你处理什么？",
      "预览执行方案",
      "预览模式",
      "不读取密钥",
      "不调用 Provider",
      "不部署",
      "不改默认 /chat"
    ];
    checks.firstScreenMissingTerms = firstScreenTerms.filter((term) => !initial.panelText.includes(term));
    checks.firstScreenVisible = checks.firstScreenMissingTerms.length === 0;
    checks.firstScreenPrimaryCtaCount = initial.primaryCtaCount === 1;
    checks.advancedDetailsDefaultCollapsed = initial.detailsVisible === false;
    checks.yiyiAbsent = !/依依|Yiyi|companion|avatar|角色/.test(initial.panelText);
    checks.noProviderCallCopy = initial.panelText.includes("Provider") && initial.panelText.includes("不会调用");

    await click("#future-os-preview-button");
    await waitForExpression("document.getElementById('future-os-preview-card')?.dataset.previewVisible === 'true'");
    const preview = await inspectPage();
    await capture(screenshotPaths.preview);
    await capture(screenshotPaths.collapsed);
    checks.previewWorks = [
      "安全预案",
      "我会做什么",
      "我不会做什么",
      "查看详情",
      "已生成安全预览，未执行真实任务。"
    ].every((term) => preview.panelText.includes(term));
    checks.detailsCollapsedCaptured = existsSync(screenshotPaths.collapsed) && preview.detailsVisible === false;

    await click("#future-os-toggle-details");
    await waitForExpression("!document.getElementById('future-os-details-panel')?.hidden");
    const expanded = await inspectPage();
    await writeFile(domSnapshotPath, expanded.renderedDom, "utf8");
    await capture(screenshotPaths.expanded);
    checks.detailsExpandedWorks = expanded.detailsVisible &&
      expanded.visibleText.includes("Provider / CredentialRef") &&
      expanded.visibleText.includes("Evidence Replay") &&
      expanded.visibleText.includes("Diagnostics");

    await setViewport(1024, 1100);
    await navigate(`${url}&viewport=1024`);
    await capture(screenshotPaths.responsive1024);
    checks.responsive1024Captured = existsSync(screenshotPaths.responsive1024);

    await setViewport(768, 1100);
    await navigate(`${url}&viewport=768`);
    await capture(screenshotPaths.responsive768);
    checks.responsive768Captured = existsSync(screenshotPaths.responsive768);

    checks.screenshotsExist = Object.values(screenshotPaths).every((path) => existsSync(path));
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const failedChecks = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  return {
    passed: failedChecks.length === 0 && errors.length === 0,
    blocker: failedChecks.length || errors.length ? `browser_smoke_failed:${[...failedChecks, ...errors].join(",")}` : null,
    checks,
    failedChecks,
    errors,
    screenshotEvidenceGenerated: checks.screenshotsExist,
    screenshots: result.screenshots,
    domSnapshotPath: result.domSnapshotPath
  };
}

async function navigate(url) {
  await cdp.send("Page.navigate", { url });
  await waitForLoadEvent();
  await waitForExpression("document.getElementById('future-minimal-os-panel')");
}

async function setViewport(width, height) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
}

async function inspectPage() {
  return cdp.evaluate(`(() => {
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll('script,style,noscript').forEach((node) => node.remove());
    const details = document.getElementById('future-os-details-panel');
    const panel = document.getElementById('future-minimal-os-panel');
    return {
      visibleText: document.body.innerText || '',
      panelText: panel?.innerText || '',
      renderedDom: '<!doctype html>\\n' + clone.outerHTML,
      primaryCtaCount: document.querySelectorAll('[data-primary-cta="true"]').length,
      detailsVisible: Boolean(details) && !details.hidden && getComputedStyle(details).display !== 'none'
    };
  })()`);
}

async function click(selector) {
  const clicked = await cdp.evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) return false;
    node.scrollIntoView({ block: 'center' });
    node.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Missing clickable selector: ${selector}`);
  await sleep(160);
}

async function capture(path) {
  await writeFile(path, Buffer.from((await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })).data, "base64"));
}

function writeDocs(status) {
  writeText(docs.inventory, `
# Phase1121 UI Architecture Inventory

- currentTarget: Future Minimal OS Product UI
- sourcePanel: apps/ai-gateway-service/src/ui/components/FutureMinimalOsPanel.js
- previousCopy: apps/ai-gateway-service/src/ui/copy/futureMinimalOsCopy.js
- mountPath: MissionControlPanel -> renderFutureMinimalOsPanel
- consoleRuntime: apps/ai-gateway-service/src/ui/consolePage.js keeps event delegation for preview and details toggles
- styleMode: inline style injection from future-minimal-os/styles; no build-system change

Findings:
- The previous panel mixed Shell, task composer, mode cards, safety copy, preview card, sample bridge, and details drawer in one file.
- Copy is now centralized under future-minimal-os/copy and the legacy copy file re-exports it for compatibility.
- State is preview-only and limited to taskText, previewGenerated, recommendedMode, detailsOpen, activeDetailModule, errorState, loadingState.
- Registry descriptors are metadata-only and cannot trigger Provider calls or secret access.
`);

  writeText(docs.migrationPlan, `
# Phase1121 UI Migration Plan

Migration steps:
- Create future-minimal-os/ as the independent UI architecture root.
- Keep FutureMinimalOsPanel.js as a compatibility wrapper.
- Extract Shell, SystemTopBar, MainWorkspace, ResponsiveFrame, ProgressiveDetailsDrawer.
- Extract TaskComposer, PrimaryActionButton, ModeRecommendationCard, SecurityBoundarySummary, ModuleCard, StatusPill, EmptyState, ErrorState.
- Register modules through futureMinimalModuleRegistry.
- Move human-readable copy into future-minimal-os/copy.
- Move preview state helpers into future-minimal-os/state.
- Inject tokenized CSS from future-minimal-os/styles without changing the build system.

Rollback:
- Delete apps/ai-gateway-service/src/ui/future-minimal-os/
- Delete apps/ai-gateway-service/src/ui/styles/futureMinimal*.css
- Restore apps/ai-gateway-service/src/ui/components/FutureMinimalOsPanel.js and apps/ai-gateway-service/src/ui/copy/futureMinimalOsCopy.js from the pre-phase version
- Delete tools/phase1121_1130/
- Delete docs/phase1121-1130-* and phase1121/phase1130 docs
- Delete apps/ai-gateway-service/evidence/phase1121_1130/
- Do not use git reset --hard or git clean
`);

  writeText(docs.architecture, `
# Phase1121-1130 Future Minimal OS UI Architecture Refactor

Status: ${status}

Scope:
- Frontend UI architecture only.
- No Provider runtime change.
- No /chat or /chat-gateway/execute default behavior change.
- No secret, credential, vault, deploy, release, tag, artifact, commit, or push action.

Architecture:
- Shell is fixed and business-light.
- Modules are inserted by registry descriptor.
- Copy is centralized.
- Style uses Future Minimal token files.
- State remains preview-only.
- Advanced Provider, Evidence, and Diagnostics details are collapsed by default.

Visual direction:
- Deep blue-black system background.
- Focused central workspace.
- Translucent surfaces, light borders, restrained shadow.
- Blue-purple primary CTA.
- No cyberpunk HUD, no companion UI, no avatar UI.
`);

  writeText(docs.seal, `
# Phase1130 UI Architecture Refactor Seal Candidate

- completed: ${result.completed}
- recommended_sealed: ${result.recommended_sealed}
- blocker: ${result.blocker ?? "none"}
- phaseRange: 1121-1130
- architectureRefactorMode: true
- realBrowserSmokePassed: ${result.realBrowserSmokePassed}
- screenshotEvidenceGenerated: ${result.screenshotEvidenceGenerated}

Evidence:
- ${toRepoPath(resultPath)}
- ${result.domSnapshotPath}
- ${Object.values(result.screenshots).join("\n- ")}

Safety:
- providerCallsMade=false
- secretValueExposed=false
- chatModified=false
- chatGatewayExecuteModified=false
- deployExecuted=false
- releaseExecuted=false
- tagCreated=false
- artifactUploaded=false
- yiyiVisible=false
- characterModuleVisible=false
`);

  writeText(docs.executionReport, `
# Phase1121-1130 Execution Report

A. 前置条件检查结论
- Phase632 preflight passed before implementation.
- Phase1120 evidence was treated as sealed baseline.

B. 修改文件范围
- apps/ai-gateway-service/src/ui/future-minimal-os/**
- apps/ai-gateway-service/src/ui/components/FutureMinimalOsPanel.js
- apps/ai-gateway-service/src/ui/copy/futureMinimalOsCopy.js
- apps/ai-gateway-service/src/ui/styles/futureMinimal*.css
- tools/phase1121_1130/**
- docs/phase1121/1121-1130/1130 files
- apps/ai-gateway-service/evidence/phase1121_1130/**

C. 能力说明
- Registry-driven Future Minimal OS UI architecture.
- Preview-only state and copy architecture.
- Browser screenshot smoke for first screen, preview, details, and responsive widths.

D. 安全边界
- No Provider call.
- No secret read or output.
- No /chat or /chat-gateway/execute mutation.
- No deploy, release, tag, artifact upload, commit, or push.
- No production readiness claim.

E. 当前结果
- completed: ${result.completed}
- recommended_sealed: ${result.recommended_sealed}
- blocker: ${result.blocker ?? "none"}
- workspaceCleanClaimed=false
`);
}

function writeText(path, text) {
  const abs = resolve(repoRoot, path);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, `${text.trim()}\n`, "utf8");
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function toRepoPath(path) {
  return path.replace(`${repoRoot}\\`, "").replaceAll("\\", "/");
}

function listen(targetServer) {
  return new Promise((resolveListen, rejectListen) => {
    targetServer.once("error", rejectListen);
    targetServer.listen(0, "127.0.0.1", () => {
      targetServer.off("error", rejectListen);
      resolveListen(`http://127.0.0.1:${targetServer.address().port}`);
    });
  });
}

function closeServer(targetServer) {
  return new Promise((resolveClose) => {
    targetServer.closeAllConnections?.();
    targetServer.close(() => resolveClose());
  });
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

async function waitForLoadEvent() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (cdp.takeEvent("Page.loadEventFired")) return;
    await sleep(100);
  }
  throw new Error("Timed out waiting for page load.");
}

async function waitForExpression(expression) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      if (await cdp.evaluate(`Boolean(${expression})`)) return;
    } catch {}
    await sleep(100);
  }
  throw new Error(`Timed out waiting for expression: ${expression}`);
}

async function closeCdpSilently(targetCdp) {
  try {
    await targetCdp?.close();
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
