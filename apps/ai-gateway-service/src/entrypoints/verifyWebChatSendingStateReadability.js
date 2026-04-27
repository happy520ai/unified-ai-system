import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const PHASE = "phase-60a-web-chat-sending-state-readability";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-60a-web-chat-sending-state-readability.json");
const evidenceMdPath = resolve(evidenceDir, "phase-60a-web-chat-sending-state-readability.md");
const evidencePngPath = resolve(evidenceDir, "phase-60a-web-chat-sending-state-readability.png");

const prompt = "phase60a duplicate submit smoke";
const duplicateHint = "正在生成回答，请等当前回复完成后再发送。";
const answerMarker = "phase60a streamed answer";

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

  browserProfileDir = await mkdtemp(resolve(tmpdir(), "phase60a-browser-profile-"));
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
    await waitForExpression(cdp, "Boolean(document.getElementById('chat-form') && document.getElementById('send-button'))");

    await cdp.evaluate(`(() => {
      window.__phase60Fetches = [];
      window.__phase60FetchStatuses = [];
      window.__phase60StreamResolveCount = 0;
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (...args) => {
        const path = String(args[0] || "");
        window.__phase60Fetches.push(path);
        if (path === "/chat/rag/stream") {
          return new Promise((resolve) => {
            window.__phase60ResolveStream = () => {
              window.__phase60StreamResolveCount += 1;
              const encoder = new TextEncoder();
              const frames = [
                "event: knowledge\\ndata: " + JSON.stringify({ type: "knowledge", citations: [], retrieved: false }) + "\\n\\n",
                "event: chunk\\ndata: " + JSON.stringify({ type: "chunk", textDelta: ${JSON.stringify(answerMarker)}, outputText: ${JSON.stringify(answerMarker)} }) + "\\n\\n",
                "event: done\\ndata: " + JSON.stringify({ type: "done", outputText: ${JSON.stringify(answerMarker)} }) + "\\n\\n",
              ].join("");
              const stream = new ReadableStream({
                start(controller) {
                  controller.enqueue(encoder.encode(frames));
                  controller.close();
                },
              });
              const response = new Response(stream, {
                status: 200,
                headers: { "content-type": "text/event-stream; charset=utf-8" },
              });
              window.__phase60FetchStatuses.push({ path, status: response.status, ok: response.ok, simulated: true });
              resolve(response);
            };
          });
        }
        const response = await originalFetch(...args);
        window.__phase60FetchStatuses.push({ path, status: response.status, ok: response.ok, simulated: false });
        return response;
      };
      return true;
    })()`);

    await cdp.evaluate(`(() => {
      const input = document.getElementById("chat-input");
      input.value = ${JSON.stringify(prompt)};
      input.dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("chat-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      return true;
    })()`);

    const sendingState = await waitForSendingState(cdp);
    await cdp.evaluate(`(() => {
      document.getElementById("chat-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      return true;
    })()`);
    const duplicateState = await waitForDuplicateHint(cdp);
    await cdp.evaluate(`(() => {
      if (typeof window.__phase60ResolveStream !== "function") {
        throw new Error("Phase60A stream resolver was not installed.");
      }
      window.__phase60ResolveStream();
      return true;
    })()`);
    const completedState = await waitForCompletedState(cdp);

    await mkdir(evidenceDir, { recursive: true });
    await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })
      .then(async (result) => writeFile(evidencePngPath, Buffer.from(result.data, "base64")));
    await cdp.close();

    const screenshot = await inspectPng(evidencePngPath);
    const ragStreamCount = completedState.fetches.filter((path) => path === "/chat/rag/stream").length;
    const passed = sendingState.sendButtonDisabled &&
      sendingState.sendButtonText === "生成中" &&
      duplicateState.systemText.includes(duplicateHint) &&
      completedState.sendButtonDisabled === true &&
      completedState.sendButtonText === "发送" &&
      completedState.assistantText.includes(answerMarker) &&
      ragStreamCount === 1 &&
      completedState.streamResolveCount === 1 &&
      !completedState.errorClassPresent &&
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
        prompt,
        duplicateHint,
        answerMarker,
        sendingState,
        duplicateState,
        completedState,
        ragStreamCount,
      },
      screenshot: {
        path: "apps/ai-gateway-service/evidence/phase-60a-web-chat-sending-state-readability.png",
        bytes: screenshot.bytes,
        width: screenshot.width,
        height: screenshot.height,
        validPng: screenshot.validPng,
      },
      safety: {
        browserInteraction: true,
        simulatedStreamOnly: true,
        duplicateSubmitBlocked: ragStreamCount === 1,
        defaultChatMainLaneChanged: false,
        backendBusinessRouteAdded: false,
        providerCalls: false,
        runtimeMutation: false,
        releaseAutomation: false,
        infrastructureProvisioning: false,
      },
      conclusion: passed ? "web-chat-sending-state-readability-connected" : "web-chat-sending-state-readability-not-connected",
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
    conclusion: "web-chat-sending-state-readability-not-connected",
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
  while (Date.now() < deadline) {
    const value = await cdp.evaluate(`Boolean(${expression})`);
    if (value) return true;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for expression: ${expression}`);
}

async function waitForSendingState(cdp) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const result = await readChatState(cdp);
    if (result.sendButtonDisabled && result.sendButtonText === "生成中") {
      return result;
    }
    await sleep(100);
  }
  throw new Error("Timed out waiting for chat sending state.");
}

async function waitForDuplicateHint(cdp) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const result = await readChatState(cdp);
    if (result.systemText.includes(duplicateHint)) {
      return result;
    }
    await sleep(100);
  }
  throw new Error("Timed out waiting for duplicate-submit hint.");
}

async function waitForCompletedState(cdp) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const result = await readChatState(cdp);
    if (result.assistantText.includes(answerMarker) && result.sendButtonText === "发送") {
      return result;
    }
    await sleep(100);
  }
  throw new Error("Timed out waiting for completed chat state.");
}

async function readChatState(cdp) {
  return cdp.evaluate(`(() => {
    const sendButton = document.getElementById("send-button");
    const assistantMessages = Array.from(document.querySelectorAll(".message.assistant"));
    const systemMessages = Array.from(document.querySelectorAll(".message.system"));
    const latestAssistant = assistantMessages[assistantMessages.length - 1];
    const latestSystem = systemMessages[systemMessages.length - 1];
    return {
      sendButtonDisabled: Boolean(sendButton?.disabled),
      sendButtonText: sendButton?.textContent || "",
      assistantText: latestAssistant?.textContent || "",
      systemText: latestSystem?.textContent || "",
      errorClassPresent: Boolean(latestAssistant?.classList?.contains("error")),
      fetches: window.__phase60Fetches || [],
      fetchStatuses: window.__phase60FetchStatuses || [],
      streamResolveCount: window.__phase60StreamResolveCount || 0,
      messageCount: document.querySelectorAll(".message").length,
      assistantCount: assistantMessages.length,
      systemCount: systemMessages.length,
      userCount: document.querySelectorAll(".message.user").length,
    };
  })()`);
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
  return `# Phase 60A Web Chat Sending State Readability Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.serviceUrl ?? "n/a"}
- Prompt: ${body.ui?.prompt ?? "n/a"}
- Duplicate hint: ${body.ui?.duplicateHint ?? "n/a"}
- Answer marker: ${body.ui?.answerMarker ?? "n/a"}
- Sending button disabled: ${body.ui?.sendingState?.sendButtonDisabled}
- Sending button text: ${body.ui?.sendingState?.sendButtonText ?? "n/a"}
- Duplicate hint present: ${body.ui?.duplicateState?.systemText?.includes?.(body.ui?.duplicateHint) ?? false}
- Completed button disabled: ${body.ui?.completedState?.sendButtonDisabled}
- Completed button text: ${body.ui?.completedState?.sendButtonText ?? "n/a"}
- Completed assistant text: ${body.ui?.completedState?.assistantText ?? "n/a"}
- RAG stream request count: ${body.ui?.ragStreamCount ?? "n/a"}
- Screenshot path: ${body.screenshot?.path ?? "n/a"}
- Screenshot bytes: ${body.screenshot?.bytes ?? "n/a"}
- Screenshot dimensions: ${body.screenshot?.width ?? "n/a"}x${body.screenshot?.height ?? "n/a"}
- Valid PNG: ${body.screenshot?.validPng}
- Browser interaction: ${body.safety?.browserInteraction}
- Simulated stream only: ${body.safety?.simulatedStreamOnly}
- Duplicate submit blocked: ${body.safety?.duplicateSubmitBlocked}
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
