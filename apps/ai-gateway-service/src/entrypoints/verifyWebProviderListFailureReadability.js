import { spawn } from "node:child_process";
import { writeEvidencePair } from "./entrypointUtils.js";
import { existsSync, readdirSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { sleep, listen, close, findBrowserPath } from "./entrypointUtils.js";

const PHASE = "phase-59a-web-provider-list-failure-readability";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-59a-web-provider-list-failure-readability.json");
const evidenceMdPath = resolve(evidenceDir, "phase-59a-web-provider-list-failure-readability.md");
const evidencePngPath = resolve(evidenceDir, "phase-59a-web-provider-list-failure-readability.png");

const expectedProviderFailureHint = "provider 列表暂时加载失败，将继续使用服务端默认路由。";

let server;
let browserProcess;
let browserProfileDir;
let evidence;

try {
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

  browserProfileDir = await mkdtemp(resolve(tmpdir(), "phase59a-browser-profile-"));
  browserProcess = spawn(browserPath, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${browserProfileDir}`,
    "--window-size=1440,1200",
    "about:blank",
  ], {
    cwd: repoRoot,
    stdio: "ignore",
  });

  const cdpPort = await readDevToolsPort(browserProfileDir);
  const pageTarget = await createCdpPage(cdpPort, "about:blank");
  const cdp = await connectCdp(pageTarget.webSocketDebuggerUrl);
  try {
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        (() => {
          window.__phase59Fetches = [];
          window.__phase59FetchStatuses = [];
          const originalFetch = window.fetch.bind(window);
          window.fetch = async (...args) => {
            const path = String(args[0] || "");
            window.__phase59Fetches.push(path);
            if (path === "/providers") {
              const response = new Response(JSON.stringify({
                error: {
                  code: "PHASE59A_FORCED_PROVIDER_LIST_FAILURE",
                  message: "Phase59A forced provider list failure.",
                },
              }), {
                status: 503,
                headers: { "content-type": "application/json; charset=utf-8" },
              });
              window.__phase59FetchStatuses.push({ path, status: response.status, ok: response.ok, simulated: true });
              return response;
            }
            const response = await originalFetch(...args);
            window.__phase59FetchStatuses.push({ path, status: response.status, ok: response.ok, simulated: false });
            return response;
          };
        })();
      `,
    });
    await cdp.send("Page.navigate", { url: uiUrl });
    await waitForLoadEvent(cdp);
    await waitForExpression(cdp, "Boolean(document.getElementById('chat-form') && document.getElementById('provider-select'))");

    const interaction = await waitForProviderFailureHint(cdp);
    await mkdir(evidenceDir, { recursive: true });
    await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })
      .then(async (result) => writeFile(evidencePngPath, Buffer.from(result.data, "base64")));
    await cdp.close();

    const screenshot = await inspectPng(evidencePngPath);
    const providerFetch = interaction.fetchStatuses.find((item) => item.path === "/providers");
    const disallowedChatFetches = interaction.fetches.filter((path) => path === "/chat/rag/stream" || path === "/chat/rag" || path === "/chat");
    const passed = interaction.systemText.includes(expectedProviderFailureHint) &&
      providerFetch?.status === 503 &&
      providerFetch?.simulated === true &&
      interaction.providerOptionCount === 1 &&
      interaction.providerSelectValue === "" &&
      disallowedChatFetches.length === 0 &&
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
        expectedProviderFailureHint,
        systemText: interaction.systemText,
        providerFailureHintPresent: interaction.systemText.includes(expectedProviderFailureHint),
        providerSelectValue: interaction.providerSelectValue,
        providerOptionCount: interaction.providerOptionCount,
        fetches: interaction.fetches,
        fetchStatuses: interaction.fetchStatuses,
        disallowedChatFetches,
        messageCount: interaction.messageCount,
        systemCount: interaction.systemCount,
      },
      screenshot: {
        path: "apps/ai-gateway-service/evidence/phase-59a-web-provider-list-failure-readability.png",
        bytes: screenshot.bytes,
        width: screenshot.width,
        height: screenshot.height,
        validPng: screenshot.validPng,
      },
      safety: {
        browserInteraction: true,
        simulatedProviderListFailureOnly: true,
        noChatRequestSent: disallowedChatFetches.length === 0,
        fakeProviderOnly: true,
        defaultChatMainLaneChanged: false,
        backendBusinessRouteAdded: false,
        providerCalls: false,
        runtimeMutation: false,
        releaseAutomation: false,
        infrastructureProvisioning: false,
      },
      conclusion: passed ? "web-provider-list-failure-readability-connected" : "web-provider-list-failure-readability-not-connected",
    };
  } finally {
    await closeCdpSilently(cdp);
  }

  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = evidence.status === "passed" ? 0 : 1;
} catch (error) {
  evidence = {
    phase: PHASE,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "web-provider-list-failure-readability-not-connected",
  };
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
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
  while (Date.now() < deadline) {
    const value = await cdp.evaluate(`Boolean(${expression})`);
    if (value) return true;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for expression: ${expression}`);
}

async function waitForProviderFailureHint(cdp) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const result = await cdp.evaluate(`(() => {
      const systemMessages = Array.from(document.querySelectorAll(".message.system"));
      const latestSystem = systemMessages[systemMessages.length - 1];
      const providerSelect = document.getElementById("provider-select");
      return {
        systemText: latestSystem?.textContent || "",
        providerSelectValue: providerSelect?.value ?? null,
        providerOptionCount: providerSelect?.options?.length ?? 0,
        fetches: window.__phase59Fetches || [],
        fetchStatuses: window.__phase59FetchStatuses || [],
        messageCount: document.querySelectorAll(".message").length,
        systemCount: systemMessages.length,
      };
    })()`);
    if (result.systemText?.includes(expectedProviderFailureHint)) {
      return result;
    }
    await sleep(100);
  }
  throw new Error("Timed out waiting for provider list failure readability result.");
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

