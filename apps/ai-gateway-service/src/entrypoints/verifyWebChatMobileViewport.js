import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { createConsolePage } from "../ui/consolePage.js";

const PHASE = "phase-73a-web-chat-mobile-viewport";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-73a-web-chat-mobile-viewport.json");
const evidenceMdPath = resolve(evidenceDir, "phase-73a-web-chat-mobile-viewport.md");
const evidencePngPath = resolve(evidenceDir, "phase-73a-web-chat-mobile-viewport.png");

let server;
let browserProcess;
let browserProfileDir;
let evidence;

try {
  verifyEmbeddedScriptSyntax();

  const browserPath = findBrowserPath();
  const application = createGatewayApplication({
    ...process.env,
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_ROUTE_MODE: "registry-default",
    AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider,backup-fake-provider",
    KNOWLEDGE_INFRA_MODE: "local-keyword",
    KNOWLEDGE_STORAGE_MODE: "memory",
    PME_ENTERPRISE_AUTH_ENABLED: "false",
  });
  server = createGatewayHttpServer(application);
  await listen(server, 0, "127.0.0.1");
  const serviceUrl = `http://127.0.0.1:${server.address().port}`;
  const uiUrl = `${serviceUrl}/ui`;

  browserProfileDir = await mkdtemp(resolve(tmpdir(), "phase73a-browser-profile-"));
  browserProcess = spawn(browserPath, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${browserProfileDir}`,
    "--window-size=390,844",
    "about:blank",
  ], {
    cwd: repoRoot,
    stdio: "ignore",
  });

  const cdpPort = await readDevToolsPort(browserProfileDir);
  const pageTarget = await createCdpPage(cdpPort, uiUrl);
  const cdp = await connectCdp(pageTarget.webSocketDebuggerUrl);
  try {
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await cdp.send("Page.navigate", { url: uiUrl });
    await waitForLoadEvent(cdp);
    await waitForExpression(cdp, "Boolean(document.getElementById('chat-shell') && document.getElementById('chat-input'))");

    const mobileState = await readState(cdp);

    await mkdir(evidenceDir, { recursive: true });
    await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false })
      .then(async (result) => writeFile(evidencePngPath, Buffer.from(result.data, "base64")));
    await cdp.close();

    const screenshot = await inspectPng(evidencePngPath);
    const passed = mobileState.innerWidth <= 430 &&
      mobileState.pageHasNoHorizontalOverflow &&
      mobileState.pageHasNoDocumentScroll &&
      mobileState.shellWithinViewport &&
      mobileState.historyUsableHeight &&
      mobileState.composerCompactHeight &&
      mobileState.composerWithinViewport &&
      mobileState.inputWithinViewport &&
      mobileState.sendButtonVisible &&
      mobileState.stopButtonVisible &&
      mobileState.quickStartHiddenOnMobile &&
      mobileState.chipsScrollableOnMobile &&
      mobileState.sideFullWidthOnMobile &&
      screenshot.validPng &&
      screenshot.width === 390 &&
      screenshot.height === 844 &&
      screenshot.bytes > 10000;

    evidence = {
      phase: PHASE,
      status: passed ? "passed" : "failed",
      generatedAt: new Date().toISOString(),
      browserPath,
      serviceUrl,
      ui: {
        url: uiUrl,
        mobileState,
      },
      screenshot: {
        path: "apps/ai-gateway-service/evidence/phase-73a-web-chat-mobile-viewport.png",
        bytes: screenshot.bytes,
        width: screenshot.width,
        height: screenshot.height,
        validPng: screenshot.validPng,
      },
      safety: {
        browserInteraction: true,
        mobileViewportOnly: true,
        simulatedProviderConfigOnly: true,
        defaultChatMainLaneChanged: false,
        backendBusinessRouteAdded: false,
        providerCalls: false,
        runtimeMutation: false,
        releaseAutomation: false,
        infrastructureProvisioning: false,
      },
      conclusion: passed ? "web-chat-mobile-viewport-connected" : "web-chat-mobile-viewport-not-connected",
    };
  } finally {
    await closeCdpSilently(cdp);
  }

  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = evidence.status === "passed" ? 0 : 1;
} catch (error) {
  evidence = {
    phase: PHASE,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "web-chat-mobile-viewport-not-connected",
  };
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  await terminateBrowser(browserProcess);
  if (browserProfileDir) {
    await rm(browserProfileDir, { recursive: true, force: true }).catch(() => undefined);
  }
  if (server) {
    await close(server);
  }
}

function verifyEmbeddedScriptSyntax() {
  const html = createConsolePage();
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error("Console page script not found.");
  }
  new vm.Script(match[1], { filename: "consolePage-inline.js" });
}

async function readState(cdp) {
  return cdp.evaluate(`(() => {
    const shell = document.getElementById("chat-shell");
    const history = document.getElementById("history");
    const composer = document.getElementById("chat-form");
    const input = document.getElementById("chat-input");
    const sendButton = document.getElementById("send-button");
    const stopButton = document.getElementById("stop-chat-button");
    const quickStart = document.querySelector(".quick-start");
    const chips = document.querySelector(".chips");
    const side = document.getElementById("side");
    const shellRect = shell.getBoundingClientRect();
    const historyRect = history.getBoundingClientRect();
    const composerRect = composer.getBoundingClientRect();
    const inputRect = input.getBoundingClientRect();
    const sendRect = sendButton.getBoundingClientRect();
    const stopRect = stopButton.getBoundingClientRect();
    const doc = document.documentElement;
    const body = document.body;
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      documentScrollWidth: doc.scrollWidth,
      documentScrollHeight: doc.scrollHeight,
      bodyScrollWidth: body.scrollWidth,
      bodyScrollHeight: body.scrollHeight,
      pageHasNoHorizontalOverflow: doc.scrollWidth <= window.innerWidth + 1 && body.scrollWidth <= window.innerWidth + 1,
      pageHasNoDocumentScroll: doc.scrollHeight <= window.innerHeight + 1 && body.scrollHeight <= window.innerHeight + 1,
      shellRect: rect(shellRect),
      historyRect: rect(historyRect),
      composerRect: rect(composerRect),
      inputRect: rect(inputRect),
      sendRect: rect(sendRect),
      stopRect: rect(stopRect),
      shellWithinViewport: shellRect.left >= -1 && shellRect.right <= window.innerWidth + 1 && shellRect.bottom <= window.innerHeight + 1,
      historyUsableHeight: historyRect.height >= 300,
      composerWithinViewport: composerRect.left >= -1 && composerRect.right <= window.innerWidth + 1 && composerRect.bottom <= window.innerHeight + 1,
      composerCompactHeight: composerRect.height <= 260,
      inputWithinViewport: inputRect.left >= -1 && inputRect.right <= window.innerWidth + 1,
      sendButtonVisible: sendRect.width >= 120 && sendRect.height >= 36 && sendRect.bottom <= window.innerHeight + 1,
      stopButtonVisible: stopRect.width >= 120 && stopRect.height >= 36 && stopRect.bottom <= window.innerHeight + 1,
      quickStartDisplay: getComputedStyle(quickStart).display,
      quickStartHiddenOnMobile: getComputedStyle(quickStart).display === "none",
      chipsOverflowX: getComputedStyle(chips).overflowX,
      chipsScrollableOnMobile: ["auto", "scroll"].includes(getComputedStyle(chips).overflowX),
      sideWidth: Math.round(side.getBoundingClientRect().width),
      sideFullWidthOnMobile: Math.round(side.getBoundingClientRect().width) >= window.innerWidth - 1,
      sendButtonDisabled: Boolean(sendButton.disabled),
      inputPlaceholderPresent: Boolean(input.getAttribute("placeholder")),
    };

    function rect(value) {
      return {
        top: Math.round(value.top),
        left: Math.round(value.left),
        right: Math.round(value.right),
        bottom: Math.round(value.bottom),
        width: Math.round(value.width),
        height: Math.round(value.height),
      };
    }
  })()`);
}

function findBrowserPath() {
  const candidates = [
    process.env.PME_BROWSER_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    ...findVersionedBrowserPaths("C:\\Program Files (x86)\\Microsoft\\EdgeCore", "msedge.exe"),
    ...findVersionedBrowserPaths("C:\\Program Files (x86)\\Microsoft\\EdgeWebView\\Application", "msedge.exe"),
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error("No supported headless browser found. Set PME_BROWSER_PATH to chrome.exe or msedge.exe.");
  }
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
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, {
    method: "PUT",
  });
  if (!response.ok) {
    throw new Error(`Unable to create CDP page: HTTP ${response.status}`);
  }
  return response.json();
}

async function terminateBrowser(targetProcess) {
  if (!targetProcess || targetProcess.killed) return;
  const exited = new Promise((resolveExit) => {
    targetProcess.once("exit", () => resolveExit(true));
  });
  targetProcess.kill();
  await Promise.race([exited, sleep(2000)]);
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
      if (message.error) {
        rejectSend(new Error(message.error.message || JSON.stringify(message.error)));
      } else {
        resolveSend(message.result ?? {});
      }
      return;
    }
    if (message.method) {
      events.push(message);
    }
  });

  return {
    send(method, params = {}) {
      const id = nextId++;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolveSend, rejectSend) => {
        pending.set(id, { resolveSend, rejectSend });
      });
    },
    async evaluate(expression) {
      const result = await this.send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed.");
      }
      return result.result?.value;
    },
    takeEvent(method) {
      const index = events.findIndex((event) => event.method === method);
      return index >= 0 ? events.splice(index, 1)[0] : null;
    },
    async close() {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    },
  };
}

async function closeCdpSilently(cdp) {
  try {
    await cdp?.close();
  } catch {
    // Best-effort cleanup only.
  }
}

async function waitForLoadEvent(cdp) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (cdp.takeEvent("Page.loadEventFired")) return;
    await sleep(100);
  }
  throw new Error("Timed out waiting for page load.");
}

async function waitForExpression(cdp, expression, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const value = await cdp.evaluate(`Boolean(${expression})`);
      if (value) return true;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for expression: ${expression}; lastError=${lastError || "none"}`);
}

async function inspectPng(path) {
  const stats = await stat(path);
  const buffer = await readFile(path);
  const validPng = buffer.length >= 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  return {
    bytes: stats.size,
    width: validPng ? buffer.readUInt32BE(16) : 0,
    height: validPng ? buffer.readUInt32BE(20) : 0,
    validPng,
  };
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
  return new Promise((resolveClose) => {
    targetServer.close(() => resolveClose());
  });
}

async function writeEvidence(body) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, createEvidenceMarkdown(body), "utf8");
}

function createEvidenceMarkdown(body) {
  return `# Phase 73A Web Chat Mobile Viewport Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.serviceUrl ?? "n/a"}
- Inner size: ${body.ui?.mobileState?.innerWidth ?? "n/a"}x${body.ui?.mobileState?.innerHeight ?? "n/a"}
- Page has no horizontal overflow: ${body.ui?.mobileState?.pageHasNoHorizontalOverflow}
- Page has no document scroll: ${body.ui?.mobileState?.pageHasNoDocumentScroll}
- Shell within viewport: ${body.ui?.mobileState?.shellWithinViewport}
- History usable height: ${body.ui?.mobileState?.historyUsableHeight}
- Composer within viewport: ${body.ui?.mobileState?.composerWithinViewport}
- Composer compact height: ${body.ui?.mobileState?.composerCompactHeight}
- Input within viewport: ${body.ui?.mobileState?.inputWithinViewport}
- Send button visible: ${body.ui?.mobileState?.sendButtonVisible}
- Stop button visible: ${body.ui?.mobileState?.stopButtonVisible}
- Quick start hidden on mobile: ${body.ui?.mobileState?.quickStartHiddenOnMobile}
- Chips scrollable on mobile: ${body.ui?.mobileState?.chipsScrollableOnMobile}
- Side full width on mobile: ${body.ui?.mobileState?.sideFullWidthOnMobile}
- Screenshot path: ${body.screenshot?.path ?? "n/a"}
- Screenshot bytes: ${body.screenshot?.bytes ?? "n/a"}
- Screenshot dimensions: ${body.screenshot?.width ?? "n/a"}x${body.screenshot?.height ?? "n/a"}
- Valid PNG: ${body.screenshot?.validPng}
- Browser interaction: ${body.safety?.browserInteraction}
- Mobile viewport only: ${body.safety?.mobileViewportOnly}
- Simulated provider config only: ${body.safety?.simulatedProviderConfigOnly}
- Default chat main lane changed: ${body.safety?.defaultChatMainLaneChanged}
- Backend business route added: ${body.safety?.backendBusinessRouteAdded}
- Provider calls: ${body.safety?.providerCalls}
- Runtime mutation: ${body.safety?.runtimeMutation}
- Release automation: ${body.safety?.releaseAutomation}
- Infrastructure provisioning: ${body.safety?.infrastructureProvisioning}
- Conclusion: ${body.conclusion}
`;
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}
