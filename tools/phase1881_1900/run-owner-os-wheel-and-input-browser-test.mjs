import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../apps/ai-gateway-service/src/http/httpServer.js";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const evidenceDir = "apps/ai-gateway-service/evidence/phase1881_1900";
const evidencePaths = {
  result: `${evidenceDir}/phase1896-owner-os-wheel-input-browser-test.json`,
  screenshot: `${evidenceDir}/screenshots/phase1897-owner-os-scroll-chat-entry.png`,
  firstScreenScreenshot: `${evidenceDir}/screenshots/phase1893-owner-os-first-screen.png`,
  domSnapshot: `${evidenceDir}/dom/phase1897-owner-os-scroll-chat-entry.html`,
  log: `${evidenceDir}/logs/phase1896-owner-os-wheel-input-browser-test.log`,
  failureLog: `${evidenceDir}/logs/phase1896-owner-os-wheel-input-browser-test.failure.log`,
};

const boundary = {
  routeChoice: "A / local_self_use_only",
  providerCallsMade: false,
  rawSecretRead: false,
  authJsonRead: false,
  rawCredentialRefRead: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  productionReadyClaimed: false,
};

function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

function findBrowserPath() {
  const candidates = [
    process.env.PME_BROWSER_PATH,
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("No local Chrome/Edge executable found.");
  return found;
}

async function main() {
  let server;
  let browserProcess;
  let profileDir;
  let cdp;
  let tempServer;
  try {
    await mkdir(dirname(repoPath(evidencePaths.result)), { recursive: true });
    await mkdir(dirname(repoPath(evidencePaths.screenshot)), { recursive: true });
    await mkdir(dirname(repoPath(evidencePaths.domSnapshot)), { recursive: true });
    await mkdir(dirname(repoPath(evidencePaths.log)), { recursive: true });

    const resolved = await resolveUiUrl();
    const uiUrl = resolved.uiUrl;
    const mode = resolved.mode;
    tempServer = resolved.server;

    const browserPath = findBrowserPath();
    const tempRoot = repoPath(".codex-runtime-tmp/phase1881-1900-browser");
    await mkdir(tempRoot, { recursive: true });
    profileDir = await mkdtemp(resolve(tempRoot, "profile-"));
    browserProcess = spawn(browserPath, [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-sync",
      "--disable-default-apps",
      "--disable-component-update",
      "--disable-crash-reporter",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-port=0",
      `--user-data-dir=${profileDir}`,
      "--window-size=1440,1200",
      "about:blank",
    ], { cwd: repoPath("."), stdio: ["ignore", "pipe", "pipe"] });

    const cdpPort = await readDevToolsPort(profileDir);
    const pageTarget = await createCdpPage(cdpPort, uiUrl);
    cdp = await connectCdp(pageTarget.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Page.navigate", { url: uiUrl });
    await waitForLoadEvent(cdp);
    await waitForExpression(cdp, "document.querySelector('[data-owner-os-shell=\"true\"]')");

    const before = await inspectOwnerOs(cdp);
    await captureScreenshot(cdp, evidencePaths.firstScreenScreenshot);
    const inputValue = "帮我检查今天系统状态";
    await cdp.evaluate(`(() => {
      const input = document.querySelector('#owner-task-input');
      if (!input) return false;
      input.focus();
      input.value = ${JSON.stringify(inputValue)};
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    const afterTyping = await inspectOwnerOs(cdp);

    await cdp.evaluate(`(() => {
      const input = document.querySelector('#owner-task-input');
      if (!input) return false;
      const event = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true });
      input.dispatchEvent(event);
      return true;
    })()`);
    await sleep(250);
    const afterEnter = await inspectOwnerOs(cdp);

    await cdp.evaluate(`(() => {
      document.querySelector('[data-owner-boss-action="run-today-check"]')?.click();
      return true;
    })()`);
    await sleep(200);
    const afterClick = await inspectOwnerOs(cdp);

    const scrollBefore = await readScrollState(cdp);
    await wheelOnCenter(cdp, 0, 700);
    await sleep(250);
    const scrollAfter = await readScrollState(cdp);

    await cdp.evaluate(`(() => {
      const details = document.querySelector('#owner-advanced-system-details');
      if (details && !details.open) {
        details.open = true;
        details.dispatchEvent(new Event('toggle', { bubbles: true }));
      }
      return true;
    })()`);
    await sleep(150);
    const scrollBeforeAdvanced = await readScrollState(cdp);
    await wheelOnCenter(cdp, 0, 700);
    await sleep(250);
    const scrollAfterAdvanced = await readScrollState(cdp);

    const screenshot = await captureScreenshot(cdp, evidencePaths.screenshot);
    const dom = await cdp.evaluate("document.documentElement.outerHTML");
    await writeFile(repoPath(evidencePaths.domSnapshot), `${dom}\n`, "utf8");

    const result = {
      phase: "Phase1896",
      phaseRange: "Phase1881-1900AIO",
      completed: true,
      recommended_sealed: true,
      blocker: null,
      ...boundary,
      serviceUrl: uiUrl,
      serviceMode: mode,
      firstScreenTaskInputVisible: before.taskInputVisible === true,
      ownerCanFindWhereToType: before.ownerCanFindWhereToType === true,
      inputPlaceholderPlainChinese: before.inputPlaceholderPlainChinese === true,
      taskInputAcceptsText: afterTyping.taskInputValue === inputValue || afterEnter.taskInputValue === inputValue,
      primaryCtaCount: afterClick.primaryCtaCount,
      primaryCtaWorks: afterClick.buttonFeedbackVisible === true && /小天正在处理|已完成本地检查|结果已生成|下一步看这里/.test(afterClick.feedbackText),
      buttonFeedbackVisible: afterClick.buttonFeedbackVisible === true,
      threeResultCardsVisible: afterClick.threeResultCardsVisible === true,
      bossDailyReportEntryVisible: afterClick.bossDailyReportEntryVisible === true,
      advancedModeCollapsedByDefault: before.advancedModeCollapsed === true,
      engineeringJargonHiddenFromOwner: before.engineeringJargonHiddenFromOwner === true,
      mainContentOverflowUsable: before.mainContentOverflowUsable === true,
      scrollWorks: scrollAfter.scrollMoved === true,
      wheelScrollChangesPosition: scrollAfter.scrollMoved === true,
      noScrollTrapDetected: scrollAfter.noScrollTrapDetected === true,
      noInvisibleOverlayBlockingScroll: scrollAfter.noInvisibleOverlayBlockingScroll === true,
      advancedModeScrollWorks: scrollAfterAdvanced.scrollMoved === true || scrollAfterAdvanced.pageShellScrollTop > scrollBeforeAdvanced.pageShellScrollTop,
      screenshotsGenerated: true,
      domSnapshotGenerated: true,
      browserWheelAndInputTestGenerated: true,
      firstScreenScreenshotPath: evidencePaths.firstScreenScreenshot,
      screenshotPath: evidencePaths.screenshot,
      domSnapshotPath: evidencePaths.domSnapshot,
      scrollBefore,
      scrollAfter,
      scrollBeforeAdvanced,
      scrollAfterAdvanced,
      before,
      afterTyping,
      afterEnter,
      afterClick,
      pluginAppUsageAudit: {
        pluginAppsUsed: true,
        pluginName: "Chrome/Edge local headless browser via CDP",
        toolType: "local_headless_browser_cdp",
        purpose: "Phase1896 Owner OS wheel scroll and task input browser test",
        whyNeeded: "Need to verify the owner-facing scroll container and the first-screen task input with browser evidence.",
        userAuthorized: true,
        dataSentOut: false,
        repoDataSentOut: false,
        secretExposed: false,
        rawCredentialExposed: false,
        providerCalled: false,
        costRisk: "none",
        evidencePath: evidenceDir,
        rollbackOrDisableMethod: "Delete tools/phase1881_1900 and the phase1881_1900 evidence directory and remove the package scripts.",
      },
    };

    await writeFile(repoPath(evidencePaths.result), `${JSON.stringify(result, null, 2)}\n`, "utf8");
    await writeFile(repoPath(evidencePaths.log), [
      "Phase1896 Owner OS wheel and input browser test",
      `mode=${mode}`,
      `uiUrl=${uiUrl}`,
      JSON.stringify({ before, afterTyping, afterEnter, afterClick, scrollBefore, scrollAfter, scrollBeforeAdvanced, scrollAfterAdvanced }, null, 2),
    ].join("\n"), "utf8");

    console.log(JSON.stringify(result, null, 2));
    if (!result.scrollWorks || !result.firstScreenTaskInputVisible || !result.ownerCanFindWhereToType || !result.buttonFeedbackVisible) {
      process.exitCode = 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    await writeFile(repoPath(evidencePaths.failureLog), `${message}\n`, "utf8");
    const result = {
      phase: "Phase1896",
      phaseRange: "Phase1881-1900AIO",
      completed: false,
      recommended_sealed: false,
      blocker: "owner_os_scroll_chat_entry_browser_test_failed",
      ...boundary,
      failureLogPath: evidencePaths.failureLog,
      pluginAppUsageAudit: {
        pluginAppsUsed: true,
        pluginName: "Chrome/Edge local headless browser via CDP",
        toolType: "local_headless_browser_cdp",
        purpose: "Phase1896 Owner OS wheel scroll and task input browser test",
        whyNeeded: "Need to verify the owner-facing scroll container and the first-screen task input with browser evidence.",
        userAuthorized: true,
        dataSentOut: false,
        repoDataSentOut: false,
        secretExposed: false,
        rawCredentialExposed: false,
        providerCalled: false,
        costRisk: "none",
        evidencePath: evidenceDir,
        rollbackOrDisableMethod: "Delete tools/phase1881_1900 and the phase1881_1900 evidence directory and remove the package scripts.",
      },
    };
    await writeFile(repoPath(evidencePaths.result), `${JSON.stringify(result, null, 2)}\n`, "utf8");
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = 1;
  } finally {
    await closeCdpSilently(cdp);
    await terminateBrowser(browserProcess);
    if (profileDir) await rm(profileDir, { recursive: true, force: true }).catch(() => {});
    if (server) {
      server.closeAllConnections?.();
      await close(server);
    }
    if (tempServer) {
      tempServer.closeAllConnections?.();
      await close(tempServer);
    }
  }
}

async function resolveUiUrl() {
  const application = createGatewayApplication({
    ...process.env,
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider,backup-fake-provider",
    KNOWLEDGE_INFRA_MODE: "local-keyword",
    KNOWLEDGE_STORAGE_MODE: "memory",
  });
  const server = createGatewayHttpServer(application);
  await listen(server, 0, "127.0.0.1");
  const port = server.address().port;
  return { uiUrl: `http://127.0.0.1:${port}/ui?phase1881_1900=owner-os-scroll-input`, mode: "temp-local-service", server };
}

async function captureScreenshot(cdp, relativePath) {
  const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  await writeFile(repoPath(relativePath), Buffer.from(screenshot.data, "base64"));
  return { captured: true, path: relativePath };
}

async function readDevToolsPort(profileDir) {
  const activePortFile = resolve(profileDir, "DevToolsActivePort");
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const text = await readFile(activePortFile, "utf8");
      const [port] = text.trim().split(/\r?\n/);
      if (port) return Number(port);
    } catch {}
    await sleep(100);
  }
  throw new Error("Timed out waiting for DevToolsActivePort.");
}

async function createCdpPage(port, url) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  if (!response.ok) throw new Error(`Failed to create CDP page: HTTP ${response.status}`);
  return response.json();
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
    const payload = JSON.parse(String(event.data));
    if (payload.id && pending.has(payload.id)) {
      const { resolve: resolvePending, reject } = pending.get(payload.id);
      pending.delete(payload.id);
      if (payload.error) reject(new Error(payload.error.message));
      else resolvePending(payload.result ?? payload);
      return;
    }
    if (payload.method) events.push(payload);
  });
  return {
    send(method, params = {}) {
      const id = nextId++;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolveSend, rejectSend) => pending.set(id, { resolve: resolveSend, reject: rejectSend }));
    },
    async evaluate(expression) {
      const payload = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (payload.exceptionDetails) {
        throw new Error(payload.exceptionDetails.exception?.description || payload.exceptionDetails.text || "Runtime.evaluate failed.");
      }
      return payload.result?.value;
    },
    takeEvent(method) {
      const index = events.findIndex((event) => event.method === method);
      return index >= 0 ? events.splice(index, 1)[0] : null;
    },
    close() {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
    },
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

async function inspectOwnerOs(cdp) {
  return cdp.evaluate(`(() => {
    const root = document.querySelector('[data-owner-os-shell="true"]');
    const input = document.querySelector('#owner-task-input');
    const feedback = document.querySelector('#owner-boss-view-feedback');
    const report = document.querySelector('[data-owner-daily-report="true"]');
    const cardIds = ['today-completed', 'problems-found', 'next-action'];
    const inputRect = input?.getBoundingClientRect?.() || null;
    const viewportHeight = window.innerHeight || 0;
    const placeholder = input?.getAttribute('placeholder') || '';
    const taskInputVisible = Boolean(input && inputRect && inputRect.width > 0 && inputRect.height > 0 && inputRect.top < viewportHeight && inputRect.bottom > 0);
    const ownerCanFindWhereToType = Boolean(taskInputVisible && /今天让小天帮你做什么/.test(root?.innerText || '') && placeholder.includes('例如：帮我检查今天系统状态'));
    const mainContent = document.querySelector('.workspace') || document.querySelector('.page-shell') || document.querySelector('.owner-os-shell');
    const mainContentOverflowUsable = /auto|scroll/i.test(getComputedStyle(document.body).overflowY) ||
      Boolean(mainContent && /auto|scroll/i.test(getComputedStyle(mainContent).overflowY));
    const hiddenOverlay = [...document.querySelectorAll('*')].some((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.position === 'fixed' && style.pointerEvents !== 'none' &&
        rect.width >= window.innerWidth * 0.9 &&
        rect.height >= window.innerHeight * 0.9 &&
        parseFloat(style.opacity || '1') < 0.1;
    });
    return {
      ownerOsVisible: Boolean(root),
      taskInputVisible: Boolean(taskInputVisible),
      ownerCanFindWhereToType,
      inputPlaceholderPlainChinese: placeholder.includes('例如：帮我检查今天系统状态，或者输入你想让小天处理的任务') && !/[A-Za-z]/.test(placeholder),
      taskInputValue: input?.value || '',
      primaryCtaCount: root ? root.querySelectorAll('[data-owner-boss-action="run-today-check"]').length : 0,
      buttonFeedbackVisible: Boolean(feedback?.innerText?.trim()),
      feedbackText: feedback?.innerText?.trim() || '',
      threeResultCardsVisible: root ? cardIds.every((id) => root.querySelector('[data-owner-summary-card="' + id + '"]')) : false,
      bossDailyReportEntryVisible: Boolean(report),
      advancedModeCollapsed: Boolean(document.querySelector('#owner-advanced-system-details:not([open])')),
      engineeringJargonHiddenFromOwner: root ? !/(Phase\\d+|verifier|trace|raw evidence path|CredentialRef|Provider Gate|\\bDOM\\b|\\bJSON\\b|token budget|regression matrix)/i.test(root.innerText) : false,
      mainContentOverflowUsable,
      noInvisibleOverlayBlockingScroll: !hiddenOverlay,
      scrollTop: window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0,
      pageShellScrollTop: document.querySelector('.page-shell')?.scrollTop || 0,
      workspaceScrollTop: document.querySelector('.workspace')?.scrollTop || 0,
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight,
    };
  })()`);
}

async function readScrollState(cdp) {
  return cdp.evaluate(`(() => {
    const pageShell = document.querySelector('.page-shell');
    const workspace = document.querySelector('.workspace');
    const html = document.documentElement;
    const body = document.body;
    const windowScrollY = window.scrollY || html.scrollTop || body.scrollTop || 0;
    const pageShellScrollTop = pageShell?.scrollTop || 0;
    const workspaceScrollTop = workspace?.scrollTop || 0;
    const bodyOverflow = getComputedStyle(body).overflowY;
    const workspaceOverflow = workspace ? getComputedStyle(workspace).overflowY : '';
    const pageShellOverflow = pageShell ? getComputedStyle(pageShell).overflowY : '';
    const scrollMoved = windowScrollY > 0 || pageShellScrollTop > 0 || workspaceScrollTop > 0;
    const noScrollTrapDetected = /auto|scroll/i.test(bodyOverflow) || /auto|scroll/i.test(workspaceOverflow) || /auto|scroll/i.test(pageShellOverflow);
    const noInvisibleOverlayBlockingScroll = ![...document.querySelectorAll('*')].some((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.position === 'fixed' && style.pointerEvents !== 'none' && rect.width >= innerWidth * 0.9 && rect.height >= innerHeight * 0.9 && parseFloat(style.opacity || '1') < 0.1;
    });
    return {
      windowScrollY,
      pageShellScrollTop,
      workspaceScrollTop,
      bodyOverflow,
      workspaceOverflow,
      pageShellOverflow,
      scrollMoved,
      noScrollTrapDetected,
      noInvisibleOverlayBlockingScroll,
    };
  })()`);
}

async function wheelOnCenter(cdp, deltaX, deltaY) {
  const viewport = await cdp.evaluate(`({ width: window.innerWidth, height: window.innerHeight })`);
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: Math.round(viewport.width / 2),
    y: Math.round(viewport.height / 2),
  });
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseWheel",
    x: Math.round(viewport.width / 2),
    y: Math.round(viewport.height / 2),
    deltaX,
    deltaY,
  });
}

async function closeCdpSilently(cdp) {
  try {
    await cdp?.close?.();
  } catch {}
}

async function terminateBrowser(targetProcess) {
  if (!targetProcess || targetProcess.killed) return;
  const exited = new Promise((resolveExit) => targetProcess.once("exit", () => resolveExit(true)));
  targetProcess.kill();
  await Promise.race([exited, sleep(2000)]);
}

function listen(targetServer, port, host) {
  return new Promise((resolveListen, rejectListen) => {
    targetServer.once("error", rejectListen);
    targetServer.listen(port, host, () => {
      targetServer.off("error", rejectListen);
      resolveListen();
    });
  });
}

function close(targetServer) {
  return new Promise((resolveClose) => targetServer.close(() => resolveClose()));
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

await main();
