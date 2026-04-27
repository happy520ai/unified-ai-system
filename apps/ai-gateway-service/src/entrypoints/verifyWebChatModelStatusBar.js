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

const PHASE = "phase-76h-web-chat-model-status-bar";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-76h-web-chat-model-status-bar.json");
const evidenceMdPath = resolve(evidenceDir, "phase-76h-web-chat-model-status-bar.md");
const evidencePngPath = resolve(evidenceDir, "phase-76h-web-chat-model-status-bar.png");
const selectedProvider = "local-fake-provider::local-fake-model";

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
  const uiUrl = `${serviceUrl}/ui?showFakeProviders=1`;

  browserProfileDir = await mkdtemp(resolve(tmpdir(), "phase76h-browser-profile-"));
  browserProcess = spawn(browserPath, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${browserProfileDir}`,
    "--window-size=1440,1100",
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
    await cdp.send("Page.navigate", { url: uiUrl });
    await waitForLoadEvent(cdp);
    await waitForExpression(cdp, "document.getElementById('provider-select').options.length > 1");
    await installFetchRecorder(cdp);

    const initialState = await readState(cdp);
    await cdp.evaluate(`(() => {
      const input = document.getElementById("chat-input");
      input.value = "配置模型";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("chat-form").requestSubmit();
      return true;
    })()`);
    await waitForExpression(cdp, `Boolean(document.querySelector("[data-command-wizard='model-config-v2']"))`, 20_000);
    const openedState = await readState(cdp);
    await cdp.evaluate(`(() => {
      const select = document.querySelector("[data-command-provider-select]");
      select.value = ${JSON.stringify(selectedProvider)};
      select.dispatchEvent(new Event("change", { bubbles: true }));
      document.querySelector("[data-command-action='apply-and-probe-provider']").click();
      return true;
    })()`);
    await waitForExpression(cdp, `document.getElementById("composer-model-status")?.dataset.modelProbeStatus === "passed"`, 20_000);
    const finalState = await readState(cdp);

    await mkdir(evidenceDir, { recursive: true });
    await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false })
      .then(async (result) => writeFile(evidencePngPath, Buffer.from(result.data, "base64")));
    await cdp.close();

    const screenshot = await inspectPng(evidencePngPath);
    const passed = initialState.statusBarPresent &&
      initialState.configButtonPresent &&
      initialState.configButtonText.includes("配置模型") &&
      initialState.configButtonAriaLabel.includes("模型配置") &&
      initialState.modelGuidePresent &&
      initialState.modelGuideText.includes("自动识别可用模型") &&
      !initialState.quickAddModelChipPresent &&
      initialState.modelProbeStatus === "not-checked" &&
      openedState.wizardPresent &&
      finalState.modelProbeStatus === "passed" &&
      finalState.modelValue === selectedProvider &&
      finalState.modelLabelText.includes("local-fake-provider") &&
      finalState.modelProbeText.includes("检测通过") &&
      finalState.fetches.includes("/chat") &&
      !finalState.fetches.includes("/chat/rag/stream") &&
      !finalState.fetches.includes("/chat/rag") &&
      screenshot.validPng &&
      screenshot.bytes > 10000;

    evidence = {
      phase: PHASE,
      status: passed ? "passed" : "failed",
      generatedAt: new Date().toISOString(),
      browserPath,
      serviceUrl,
      ui: {
        url: uiUrl,
        initialState,
        openedState,
        finalState,
      },
      screenshot: {
        path: "apps/ai-gateway-service/evidence/phase-76h-web-chat-model-status-bar.png",
        bytes: screenshot.bytes,
        width: screenshot.width,
        height: screenshot.height,
        validPng: screenshot.validPng,
      },
      safety: {
        browserInteraction: true,
        composerStatusBar: true,
        configButtonOpensChatWizard: true,
        oneClickProbeSyncsComposerStatus: true,
        fakeProviderOnly: true,
        backendBusinessRouteAdded: false,
        defaultChatMainLaneChanged: false,
      },
      conclusion: passed ? "web-chat-model-status-bar-connected" : "web-chat-model-status-bar-not-connected",
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
    conclusion: "web-chat-model-status-bar-not-connected",
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
  if (!match) throw new Error("Console page script not found.");
  new vm.Script(match[1], { filename: "consolePage-inline.js" });
}

async function installFetchRecorder(cdp) {
  await cdp.evaluate(`(() => {
    window.__phase76hFetches = [];
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const path = String(args[0] || "");
      window.__phase76hFetches.push(path);
      return originalFetch(...args);
    };
    return true;
  })()`);
}

async function readState(cdp) {
  return cdp.evaluate(`(() => {
    const status = document.getElementById("composer-model-status");
    return {
      statusBarPresent: Boolean(status),
      configButtonPresent: Boolean(document.getElementById("composer-model-config-button")),
      configButtonText: document.getElementById("composer-model-config-button")?.textContent || "",
      configButtonAriaLabel: document.getElementById("composer-model-config-button")?.getAttribute("aria-label") || "",
      modelGuidePresent: Boolean(document.getElementById("composer-model-guide")),
      modelGuideText: document.getElementById("composer-model-guide")?.textContent || "",
      quickAddModelChipPresent: Array.from(document.querySelectorAll(".chip")).some((item) =>
        (item.textContent || "").includes("添加模型") && item.dataset.prompt === "配置模型"
      ),
      wizardPresent: Boolean(document.querySelector("[data-command-wizard='model-config-v2']")),
      modelProbeStatus: status?.dataset.modelProbeStatus || "",
      modelValue: status?.dataset.modelValue || "",
      modelLabelText: document.getElementById("composer-model-label")?.textContent || "",
      modelProbeText: document.getElementById("composer-model-probe")?.textContent || "",
      modelPreferenceText: document.getElementById("composer-model-preference")?.textContent || "",
      fetches: window.__phase76hFetches || [],
    };
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
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  if (!response.ok) throw new Error(`Unable to create CDP page: HTTP ${response.status}`);
  return response.json();
}

async function terminateBrowser(targetProcess) {
  if (!targetProcess || targetProcess.killed) return;
  const exited = new Promise((resolveExit) => targetProcess.once("exit", () => resolveExit(true)));
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
      const result = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed.");
      return result.result?.value;
    },
    takeEvent(method) {
      const index = events.findIndex((event) => event.method === method);
      return index >= 0 ? events.splice(index, 1)[0] : null;
    },
    async close() {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
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
      if (await cdp.evaluate(`Boolean(${expression})`)) return true;
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
  const validPng = buffer.length >= 24 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  return { bytes: stats.size, width: validPng ? buffer.readUInt32BE(16) : 0, height: validPng ? buffer.readUInt32BE(20) : 0, validPng };
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

async function writeEvidence(body) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, createEvidenceMarkdown(body), "utf8");
}

function createEvidenceMarkdown(body) {
  return `# Phase 76H Web Chat Model Status Bar Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.serviceUrl ?? "n/a"}
- Status bar present: ${body.ui?.initialState?.statusBarPresent}
- Config button present: ${body.ui?.initialState?.configButtonPresent}
- Config button text: ${body.ui?.initialState?.configButtonText ?? "n/a"}
- Config button aria-label: ${body.ui?.initialState?.configButtonAriaLabel ?? "n/a"}
- Quick add-model chip present: ${body.ui?.initialState?.quickAddModelChipPresent}
- Wizard opened from composer: ${body.ui?.openedState?.wizardPresent}
- Final model probe status: ${body.ui?.finalState?.modelProbeStatus ?? "n/a"}
- Final model value: ${body.ui?.finalState?.modelValue ?? "n/a"}
- Final model label: ${body.ui?.finalState?.modelLabelText ?? "n/a"}
- Final probe text: ${body.ui?.finalState?.modelProbeText ?? "n/a"}
- Probe used /chat: ${body.ui?.finalState?.fetches?.includes?.("/chat") ?? false}
- Fake provider only: ${body.safety?.fakeProviderOnly}
- Backend business route added: ${body.safety?.backendBusinessRouteAdded}
- Default chat main lane changed: ${body.safety?.defaultChatMainLaneChanged}
- Screenshot path: ${body.screenshot?.path ?? "n/a"}
- Screenshot bytes: ${body.screenshot?.bytes ?? "n/a"}
- Screenshot dimensions: ${body.screenshot?.width ?? "n/a"}x${body.screenshot?.height ?? "n/a"}
- Valid PNG: ${body.screenshot?.validPng}
- Conclusion: ${body.conclusion}
`;
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}
