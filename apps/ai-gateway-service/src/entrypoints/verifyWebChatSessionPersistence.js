import { spawn } from "node:child_process";
import { writeEvidencePair } from "./entrypointUtils.js";
import { existsSync, readdirSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { createConsolePage } from "../ui/consolePage.js";
import { sleep, listen, close, findBrowserPath } from "./entrypointUtils.js";

const PHASE = "phase-62a-web-chat-session-persistence";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-62a-web-chat-session-persistence.json");
const evidenceMdPath = resolve(evidenceDir, "phase-62a-web-chat-session-persistence.md");
const evidencePngPath = resolve(evidenceDir, "phase-62a-web-chat-session-persistence.png");

const storageKey = "pme-moving-earth-chat-history-v1";
const sessionsStorageKey = "pme-moving-earth-chat-sessions-v1";
const activeSessionStorageKey = "pme-moving-earth-active-chat-session-v1";
const prompt = "phase62a persistent chat prompt";
const answer = "phase62a persistent chat answer";

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

  browserProfileDir = await mkdtemp(resolve(tmpdir(), "phase62a-browser-profile-"));
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
  const pageTarget = await createCdpPage(cdpPort, uiUrl);
  const cdp = await connectCdp(pageTarget.webSocketDebuggerUrl);
  try {
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Page.navigate", { url: uiUrl });
    await waitForLoadEvent(cdp);
    await waitForExpression(cdp, "Boolean(document.getElementById('chat-form') && document.getElementById('clear-chat-button') && document.getElementById('new-chat-button') && document.getElementById('sidebar-new-chat-button') && document.getElementById('chat-session-list'))");

    await installFetchSimulation(cdp);
    await cdp.evaluate(`(() => {
      const input = document.getElementById("chat-input");
      input.value = ${JSON.stringify(prompt)};
      input.dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("chat-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      return true;
    })()`);
    await waitForExpression(cdp, `document.body.textContent.includes(${JSON.stringify(answer)}) && !document.getElementById("chat-form").classList.contains("is-sending")`);
    const afterSend = await readState(cdp);

    await cdp.send("Page.reload", { ignoreCache: true });
    await waitForLoadEvent(cdp);
    await waitForExpression(cdp, `document.body.textContent.includes(${JSON.stringify(prompt)}) && document.body.textContent.includes(${JSON.stringify(answer)})`);
    const afterReload = await readState(cdp);

    await cdp.evaluate(`(() => {
      document.getElementById("sidebar-new-chat-button").click();
      return true;
    })()`);
    await waitForExpression(cdp, `!document.body.textContent.includes(${JSON.stringify(prompt)}) && !document.body.textContent.includes(${JSON.stringify(answer)})`);
    const afterNew = await readState(cdp);

    const oldSessionClicked = await cdp.evaluate(`(() => {
      const raw = localStorage.getItem(${JSON.stringify(sessionsStorageKey)}) || "{}";
      let sessions = [];
      try {
        sessions = JSON.parse(raw).sessions || [];
      } catch {
        sessions = [];
      }
      const oldSession = sessions.find((item) => JSON.stringify(item.messages || []).includes(${JSON.stringify(prompt)}) &&
        JSON.stringify(item.messages || []).includes(${JSON.stringify(answer)}));
      if (!oldSession) return false;
      const button = document.querySelector("[data-chat-session-id='" + oldSession.id + "']");
      if (!button) return false;
      button.click();
      return true;
    })()`);
    await waitForExpression(cdp, `document.body.textContent.includes(${JSON.stringify(prompt)}) && document.body.textContent.includes(${JSON.stringify(answer)})`);
    const afterLoadOld = await readState(cdp);

    await mkdir(evidenceDir, { recursive: true });
    await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })
      .then(async (result) => writeFile(evidencePngPath, Buffer.from(result.data, "base64")));
    await cdp.close();

    const screenshot = await inspectPng(evidencePngPath);
    const passed = afterSend.storageContainsPrompt &&
      afterSend.storageContainsAnswer &&
      afterReload.bodyContainsPrompt &&
      afterReload.bodyContainsAnswer &&
      afterReload.statusText.includes("已恢复") &&
      !afterNew.bodyContainsPrompt &&
      !afterNew.bodyContainsAnswer &&
      !afterNew.storageContainsPrompt &&
      !afterNew.storageContainsAnswer &&
      afterNew.sessionsStorageContainsPrompt &&
      afterNew.sessionsStorageContainsAnswer &&
      afterNew.sessionButtonCount >= 2 &&
      afterNew.statusText.includes("新会话") &&
      oldSessionClicked &&
      afterLoadOld.bodyContainsPrompt &&
      afterLoadOld.bodyContainsAnswer &&
      afterLoadOld.activeSessionId === afterNew.oldSessionId &&
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
        storageKey,
        sessionsStorageKey,
        activeSessionStorageKey,
        prompt,
        answer,
        afterSend,
        afterReload,
        afterNew,
        afterLoadOld,
        oldSessionClicked,
      },
      screenshot: {
        path: "apps/ai-gateway-service/evidence/phase-62a-web-chat-session-persistence.png",
        bytes: screenshot.bytes,
        width: screenshot.width,
        height: screenshot.height,
        validPng: screenshot.validPng,
      },
      safety: {
        browserInteraction: true,
        localStorageOnly: true,
        simulatedChatOnly: true,
        fakeProviderOnly: true,
        defaultChatMainLaneChanged: false,
        backendBusinessRouteAdded: false,
        providerCalls: false,
        runtimeMutation: false,
        releaseAutomation: false,
        infrastructureProvisioning: false,
      },
      conclusion: passed ? "web-chat-session-persistence-connected" : "web-chat-session-persistence-not-connected",
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
    conclusion: "web-chat-session-persistence-not-connected",
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

function verifyEmbeddedScriptSyntax() {
  const html = createConsolePage();
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error("Console page script not found.");
  }
  new vm.Script(match[1], { filename: "consolePage-inline.js" });
}

async function installFetchSimulation(cdp) {
  await cdp.evaluate(`(() => {
    window.__phase62Fetches = [];
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const path = String(args[0] || "");
      window.__phase62Fetches.push(path);
      if (path === "/chat/rag/stream") {
        const encoder = new TextEncoder();
        const frames = [
          "event: knowledge\\ndata: " + JSON.stringify({ type: "knowledge", citations: [], retrieved: false }) + "\\n\\n",
          "event: chunk\\ndata: " + JSON.stringify({ type: "chunk", textDelta: ${JSON.stringify(answer)}, outputText: ${JSON.stringify(answer)} }) + "\\n\\n",
          "event: done\\ndata: " + JSON.stringify({ type: "done", outputText: ${JSON.stringify(answer)} }) + "\\n\\n",
        ].join("");
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(frames));
            controller.close();
          },
        });
        return new Response(stream, {
          status: 200,
          headers: { "content-type": "text/event-stream; charset=utf-8" },
        });
      }
      return originalFetch(...args);
    };
    return true;
  })()`);
}

async function readState(cdp) {
  return cdp.evaluate(`(() => {
    const storageValue = localStorage.getItem(${JSON.stringify(storageKey)}) || "";
    const sessionsStorageValue = localStorage.getItem(${JSON.stringify(sessionsStorageKey)}) || "";
    const activeSessionId = localStorage.getItem(${JSON.stringify(activeSessionStorageKey)}) || "";
    const bodyText = document.body.textContent || "";
    const statusText = document.getElementById("chat-session-status")?.textContent || "";
    const sessionButtons = Array.from(document.querySelectorAll("[data-chat-session-id]")).map((node) => ({
      id: node.dataset.chatSessionId || "",
      text: node.textContent || "",
      active: node.classList.contains("active"),
    }));
    let oldSessionId = "";
    try {
      const parsed = JSON.parse(sessionsStorageValue || "{}");
      const sessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
      const oldSession = sessions.find((item) => JSON.stringify(item.messages || []).includes(${JSON.stringify(prompt)}) &&
        JSON.stringify(item.messages || []).includes(${JSON.stringify(answer)}));
      oldSessionId = oldSession?.id || "";
    } catch {
      oldSessionId = "";
    }
    return {
      bodyContainsPrompt: bodyText.includes(${JSON.stringify(prompt)}),
      bodyContainsAnswer: bodyText.includes(${JSON.stringify(answer)}),
      storageContainsPrompt: storageValue.includes(${JSON.stringify(prompt)}),
      storageContainsAnswer: storageValue.includes(${JSON.stringify(answer)}),
      sessionsStorageContainsPrompt: sessionsStorageValue.includes(${JSON.stringify(prompt)}),
      sessionsStorageContainsAnswer: sessionsStorageValue.includes(${JSON.stringify(answer)}),
      storageValueLength: storageValue.length,
      sessionsStorageValueLength: sessionsStorageValue.length,
      activeSessionId,
      oldSessionId,
      sessionButtonCount: sessionButtons.length,
      activeSessionButtonCount: sessionButtons.filter((item) => item.active).length,
      sessionListText: document.getElementById("chat-session-list")?.textContent || "",
      statusText,
      messageCount: document.querySelectorAll(".message").length,
      fetches: window.__phase62Fetches || [],
      sendButtonText: document.getElementById("send-button")?.textContent || "",
      sendButtonDisabled: Boolean(document.getElementById("send-button")?.disabled),
      formIsSending: Boolean(document.getElementById("chat-form")?.classList.contains("is-sending")),
      newChatButtonPresent: Boolean(document.getElementById("new-chat-button")),
      sidebarNewChatButtonPresent: Boolean(document.getElementById("sidebar-new-chat-button")),
    };
  })()`);
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

