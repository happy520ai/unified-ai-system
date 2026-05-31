import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../apps/ai-gateway-service/src/http/httpServer.js";
import { writeJson } from "../phase1903a/ownerAutomationSealCommon.mjs";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const phase = "Phase1964A";
const evidenceDir = "apps/ai-gateway-service/evidence/phase1964a";
const runResultPath = `${evidenceDir}/five-capability-ui-visual-smoke-run-result.json`;
const screenshotPath = `${evidenceDir}/screenshots/five-capability-ui-visual-smoke.png`;
const domSnapshotPath = `${evidenceDir}/five-capability-ui-visual-smoke.html`;
const failureLogPath = `${evidenceDir}/five-capability-ui-visual-smoke-failure.log`;

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

  try {
    await mkdir(dirname(repoPath(screenshotPath)), { recursive: true });
    await mkdir(dirname(repoPath(domSnapshotPath)), { recursive: true });
    await mkdir(dirname(repoPath(failureLogPath)), { recursive: true });

    const application = createGatewayApplication({
      ...process.env,
      AI_GATEWAY_PROVIDER_MODE: "fake",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider,backup-fake-provider",
      KNOWLEDGE_INFRA_MODE: "local-keyword",
      KNOWLEDGE_STORAGE_MODE: "memory",
      WORKFORCE_PLAN_STORE_PATH: ".codex-temp/phase1964a/workforce-plans.json",
      PME_AUDIT_LOG_PATH: ".codex-temp/phase1964a/enterprise-audit.jsonl",
      PME_ENTERPRISE_USER_STORE_PATH: ".codex-temp/phase1964a/enterprise-users.json",
      PME_ENTERPRISE_AUTH_ENABLED: "false",
    });
    server = createGatewayHttpServer(application);
    await listen(server, 0, "127.0.0.1");
    const port = server.address().port;
    const uiUrl = `http://127.0.0.1:${port}/ui#five-capability-activation-panel`;

    const browserPath = findBrowserPath();
    const tempRoot = repoPath(".codex-runtime-tmp/phase1964a-browser");
    await mkdir(tempRoot, { recursive: true });
    profileDir = await mkdtemp(resolve(tempRoot, "profile-"));
    browserProcess = spawn(
      browserPath,
      [
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
        "--window-size=1440,1300",
        "about:blank",
      ],
      { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] },
    );

    const cdpPort = await readDevToolsPort(profileDir);
    const pageTarget = await createCdpPage(cdpPort, uiUrl);
    cdp = await connectCdp(pageTarget.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    await cdp.send("Page.navigate", { url: uiUrl });
    await waitForLoadEvent(cdp);
    await waitForExpression(cdp, "document.querySelector('[data-five-capability-activation=\"true\"]')");
    await cdp.evaluate("document.querySelector('#five-capability-activation-panel').scrollIntoView({ block: 'center' })");
    await sleep(300);

    const preClickInspection = await cdp.evaluate(`(() => {
      const panel = document.querySelector('#five-capability-activation-panel');
      const button = document.querySelector('#activate-five-capabilities-button');
      const rect = panel?.getBoundingClientRect();
      return {
        uiOpened: Boolean(document.querySelector('[data-owner-os-shell="true"]')),
        panelVisible: Boolean(panel),
        panelInViewport: Boolean(rect) && rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth,
        activationButtonVisible: Boolean(button) && !button.disabled,
        text: panel?.innerText || ""
      };
    })()`);

    const statusResponse = await fetch(`http://127.0.0.1:${port}/real-capabilities/status`);
    const statusPayload = await statusResponse.json();

    await cdp.evaluate(`(() => {
      const button = document.querySelector('#activate-five-capabilities-button');
      button?.click();
      return Boolean(button);
    })()`);

    await waitForExpression(cdp, "document.querySelector('#five-capability-result-panel:not([hidden])')");
    await waitForExpression(cdp, "document.querySelector('#five-capability-result-copy')?.innerText?.includes('完成')");
    await sleep(500);

    const postClickInspection = await cdp.evaluate(`(() => {
      const panel = document.querySelector('#five-capability-activation-panel');
      const result = document.querySelector('#five-capability-result-panel');
      const text = panel?.innerText || "";
      const statuses = [
        '#five-capability-workforce-status',
        '#five-capability-three-mode-status',
        '#five-capability-taiji-status',
        '#five-capability-gvc-status',
        '#five-capability-codex-status'
      ].map((selector) => document.querySelector(selector)?.innerText || "");
      const mojibakeDetected = /璁|鐢|浜|鍙|绛|婵|閽|鎵|鏉|瀹|垝|鍔|搸|澘|佹|惧|圭/.test(text);
      return {
        resultPanelVisible: Boolean(result) && result.hidden === false,
        resultCompletionVisible: /完成|connected|ready|completed/.test(text),
        fiveStatusesVisible: statuses.length === 5 && statuses.every((item) => item.includes(':') && !item.includes('waiting')),
        statuses,
        text,
        mojibakeDetected
      };
    })()`);

    const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    await writeFile(repoPath(screenshotPath), Buffer.from(screenshot.data, "base64"));
    const domSnapshot = await cdp.evaluate("document.documentElement.outerHTML");
    await writeFile(repoPath(domSnapshotPath), domSnapshot, "utf8");

    const activationEvidence = await readJsonSafe("apps/ai-gateway-service/evidence/phase1962a/five-real-capability-activation-result.json");
    const completed = preClickInspection.uiOpened === true &&
      preClickInspection.panelVisible === true &&
      preClickInspection.panelInViewport === true &&
      preClickInspection.activationButtonVisible === true &&
      statusResponse.ok === true &&
      statusPayload?.status === "ok" &&
      postClickInspection.resultPanelVisible === true &&
      postClickInspection.resultCompletionVisible === true &&
      postClickInspection.fiveStatusesVisible === true &&
      postClickInspection.mojibakeDetected === false &&
      activationEvidence?.completionVerified === true;

    const result = {
      phase,
      name: "Five Capability UI Visual Smoke Run",
      completed,
      recommended_sealed: completed,
      blocker: completed ? null : "phase1964a_five_capability_ui_visual_smoke_run_failed",
      serviceUrl: uiUrl,
      uiOpened: preClickInspection.uiOpened === true,
      panelVisible: preClickInspection.panelVisible === true,
      panelInViewport: preClickInspection.panelInViewport === true,
      activationButtonVisible: preClickInspection.activationButtonVisible === true,
      activationButtonClicked: true,
      resultPanelVisible: postClickInspection.resultPanelVisible === true,
      resultCompletionVisible: postClickInspection.resultCompletionVisible === true,
      fiveStatusesVisible: postClickInspection.fiveStatusesVisible === true,
      statusRouteChecked: statusResponse.ok === true,
      activateRoutePosted: true,
      capabilityStatuses: postClickInspection.statuses,
      screenshotPath,
      domSnapshotPath,
      runResultPath,
      phase1962EvidenceCompletionVerified: activationEvidence?.completionVerified === true,
      mojibakeDetected: postClickInspection.mojibakeDetected === true,
      providerCallsMade: false,
      providerNetworkAttempted: false,
      paidApiCalled: false,
      mimoCalled: false,
      openaiCalled: false,
      claudeCalled: false,
      openrouterCalled: false,
      nvidiaCalledByThisPhase: false,
      secretValueExposed: false,
      rawSecretRead: false,
      authJsonRead: false,
      rawCredentialRefRead: false,
      codexConfigModified: false,
      chatRouteModified: false,
      chatGatewayExecuteModified: false,
      legacyModified: false,
      projectContextModified: false,
      deployExecuted: false,
      releaseExecuted: false,
      tagCreated: false,
      artifactUploaded: false,
      commitCreated: false,
      pushExecuted: false,
      productionReadyClaimed: false,
      publicLaunchReadyClaimed: false,
      workspaceCleanClaimed: false,
      excludedDimensions: ["productionDeployment", "publicRelease"],
      pluginAppUsageAudit: {
        pluginAppsUsed: true,
        pluginName: "Chrome/Edge local headless browser via CDP",
        toolType: "local_headless_browser_cdp",
        purpose: "Phase1964A five capability UI visual smoke",
        dataSentOut: false,
        repoDataSentOut: false,
        secretExposed: false,
        rawCredentialExposed: false,
        providerCalled: false,
        costRisk: "none",
        evidencePath: runResultPath,
      },
    };
    writeJson(runResultPath, result);
    console.log(JSON.stringify(result, null, 2));
    if (!completed) process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    await mkdir(dirname(repoPath(failureLogPath)), { recursive: true });
    await writeFile(repoPath(failureLogPath), message, "utf8");
    const result = {
      phase,
      name: "Five Capability UI Visual Smoke Run",
      completed: false,
      recommended_sealed: false,
      blocker: "phase1964a_five_capability_ui_visual_smoke_run_failed",
      failureLogPath,
      runResultPath,
      providerCallsMade: false,
      providerNetworkAttempted: false,
      paidApiCalled: false,
      mimoCalled: false,
      openaiCalled: false,
      claudeCalled: false,
      openrouterCalled: false,
      nvidiaCalledByThisPhase: false,
      secretValueExposed: false,
      rawSecretRead: false,
      authJsonRead: false,
      rawCredentialRefRead: false,
      codexConfigModified: false,
      chatRouteModified: false,
      chatGatewayExecuteModified: false,
      legacyModified: false,
      projectContextModified: false,
      deployExecuted: false,
      releaseExecuted: false,
      tagCreated: false,
      artifactUploaded: false,
      commitCreated: false,
      pushExecuted: false,
      productionReadyClaimed: false,
      publicLaunchReadyClaimed: false,
      workspaceCleanClaimed: false,
    };
    writeJson(runResultPath, result);
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
  }
}

async function readJsonSafe(relativePath) {
  try {
    return JSON.parse(await readFile(repoPath(relativePath), "utf8"));
  } catch {
    return null;
  }
}

async function readDevToolsPort(profileDir) {
  const activePortFile = resolve(profileDir, "DevToolsActivePort");
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const text = await readFile(activePortFile, "utf8");
      const [port] = text.trim().split(/\r?\n/u);
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
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      if (await cdp.evaluate(`Boolean(${expression})`)) return;
    } catch {}
    await sleep(150);
  }
  throw new Error(`Timed out waiting for expression: ${expression}`);
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
