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

const PHASE = "phase-63a-web-chat-abort-interaction";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-63a-web-chat-abort-interaction.json");
const evidenceMdPath = resolve(evidenceDir, "phase-63a-web-chat-abort-interaction.md");
const evidencePngPath = resolve(evidenceDir, "phase-63a-web-chat-abort-interaction.png");

const prompt = "phase63a abort streaming chat prompt";
const partialAnswer = "phase63a streamed partial answer";
const stoppedMarker = "已停止生成";
const stoppedHint = "已停止当前回答，可以继续发送下一条。";

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

  browserProfileDir = await mkdtemp(resolve(tmpdir(), "phase63a-browser-profile-"));
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
    await waitForExpression(cdp, "Boolean(document.getElementById('chat-form') && document.getElementById('stop-chat-button'))");

    await installFetchSimulation(cdp);
    await cdp.evaluate(`(() => {
      const input = document.getElementById("chat-input");
      input.value = ${JSON.stringify(prompt)};
      input.dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("chat-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      return true;
    })()`);

    await waitForExpression(cdp, `(() => {
      const state = window.__phase63ReadState();
      return state.assistantText.includes(${JSON.stringify(partialAnswer)}) &&
        state.stopButtonDisabled === false &&
        state.sendButtonDisabled === true;
    })()`);
    const duringStream = await readState(cdp);

    await cdp.evaluate(`(() => {
      document.getElementById("stop-chat-button").click();
      return true;
    })()`);

    await waitForExpression(cdp, `(() => {
      const state = window.__phase63ReadState();
      return window.__phase63AbortSeen === true &&
        state.assistantText.includes(${JSON.stringify(stoppedMarker)}) &&
        state.systemText.includes(${JSON.stringify(stoppedHint)}) &&
        state.sendButtonDisabled === true &&
        state.inputValue === "" &&
        state.stopButtonDisabled === true;
    })()`);
    const afterStop = await readState(cdp);

    await mkdir(evidenceDir, { recursive: true });
    await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })
      .then(async (result) => writeFile(evidencePngPath, Buffer.from(result.data, "base64")));
    await cdp.close();

    const screenshot = await inspectPng(evidencePngPath);
    const ragStreamCount = afterStop.fetches.filter((path) => path === "/chat/rag/stream").length;
    const fallbackCount = afterStop.fetches.filter((path) => path === "/chat/rag").length;
    const passed = duringStream.stopButtonDisabled === false &&
      duringStream.sendButtonDisabled === true &&
      afterStop.abortSeen &&
      afterStop.assistantText.includes(partialAnswer) &&
      afterStop.assistantText.includes(stoppedMarker) &&
      afterStop.systemText.includes(stoppedHint) &&
      afterStop.sendButtonText === "发送" &&
      afterStop.sendButtonDisabled === true &&
      afterStop.inputValue === "" &&
      afterStop.stopButtonDisabled === true &&
      ragStreamCount === 1 &&
      fallbackCount === 0 &&
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
        partialAnswer,
        stoppedMarker,
        stoppedHint,
        duringStream,
        afterStop,
        ragStreamCount,
        fallbackCount,
      },
      screenshot: {
        path: "apps/ai-gateway-service/evidence/phase-63a-web-chat-abort-interaction.png",
        bytes: screenshot.bytes,
        width: screenshot.width,
        height: screenshot.height,
        validPng: screenshot.validPng,
      },
      safety: {
        browserInteraction: true,
        simulatedStreamOnly: true,
        userAbortOnly: true,
        fallbackSkippedAfterAbort: fallbackCount === 0,
        fakeProviderOnly: true,
        defaultChatMainLaneChanged: false,
        backendBusinessRouteAdded: false,
        providerCalls: false,
        runtimeMutation: false,
        releaseAutomation: false,
        infrastructureProvisioning: false,
      },
      conclusion: passed ? "web-chat-abort-interaction-connected" : "web-chat-abort-interaction-not-connected",
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
    conclusion: "web-chat-abort-interaction-not-connected",
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

async function installFetchSimulation(cdp) {
  await cdp.evaluate(`(() => {
    window.__phase63Fetches = [];
    window.__phase63FetchStatuses = [];
    window.__phase63AbortSeen = false;
    window.__phase63SignalSeen = false;
    window.__phase63StreamCancelled = false;
    window.__phase63ReadState = () => {
      const sendButton = document.getElementById("send-button");
      const stopButton = document.getElementById("stop-chat-button");
      const assistantMessages = Array.from(document.querySelectorAll(".message.assistant"));
      const systemMessages = Array.from(document.querySelectorAll(".message.system"));
      const latestAssistant = assistantMessages[assistantMessages.length - 1];
      const latestSystem = systemMessages[systemMessages.length - 1];
      return {
        sendButtonDisabled: Boolean(sendButton?.disabled),
        sendButtonText: sendButton?.textContent || "",
        stopButtonDisabled: Boolean(stopButton?.disabled),
        stopButtonText: stopButton?.textContent || "",
        inputValue: document.getElementById("chat-input")?.value || "",
        assistantText: latestAssistant?.textContent || "",
        assistantError: Boolean(latestAssistant?.classList?.contains("error")),
        systemText: latestSystem?.textContent || "",
        messageCount: document.querySelectorAll(".message").length,
        fetches: window.__phase63Fetches || [],
        fetchStatuses: window.__phase63FetchStatuses || [],
        abortSeen: Boolean(window.__phase63AbortSeen),
        signalSeen: Boolean(window.__phase63SignalSeen),
        streamCancelled: Boolean(window.__phase63StreamCancelled),
      };
    };
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const path = String(args[0] || "");
      const options = args[1] || {};
      window.__phase63Fetches.push(path);
      if (path === "/chat/rag/stream") {
        const encoder = new TextEncoder();
        const frames = [
          "event: knowledge\\ndata: " + JSON.stringify({ type: "knowledge", citations: [], retrieved: false }) + "\\n\\n",
          "event: chunk\\ndata: " + JSON.stringify({ type: "chunk", textDelta: ${JSON.stringify(partialAnswer)}, outputText: ${JSON.stringify(partialAnswer)} }) + "\\n\\n",
        ].join("");
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(frames));
            if (options.signal) {
              window.__phase63SignalSeen = true;
              const abort = () => {
                window.__phase63AbortSeen = true;
                controller.error(new DOMException("Phase63A user abort", "AbortError"));
              };
              if (options.signal.aborted) {
                abort();
              } else {
                options.signal.addEventListener("abort", abort, { once: true });
              }
            }
          },
          cancel(reason) {
            window.__phase63StreamCancelled = true;
            window.__phase63CancelReason = String(reason || "");
          },
        });
        const response = new Response(stream, {
          status: 200,
          headers: { "content-type": "text/event-stream; charset=utf-8" },
        });
        window.__phase63FetchStatuses.push({ path, status: response.status, ok: response.ok, simulated: true });
        return response;
      }
      const response = await originalFetch(...args);
      window.__phase63FetchStatuses.push({ path, status: response.status, ok: response.ok, simulated: false });
      return response;
    };
    return true;
  })()`);
}

async function readState(cdp) {
  return cdp.evaluate("window.__phase63ReadState()");
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
  let debugState = null;
  try {
    debugState = await cdp.evaluate(`typeof window.__phase63ReadState === "function" ? window.__phase63ReadState() : null`);
  } catch (error) {
    debugState = { error: error instanceof Error ? error.message : String(error) };
  }
  throw new Error(`Timed out waiting for expression: ${expression}; lastError=${lastError || "none"}; debug=${JSON.stringify(debugState)}`);
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
  return `# Phase 63A Web Chat Abort Interaction Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.serviceUrl ?? "n/a"}
- Prompt: ${body.ui?.prompt ?? "n/a"}
- Partial answer: ${body.ui?.partialAnswer ?? "n/a"}
- Stopped marker: ${body.ui?.stoppedMarker ?? "n/a"}
- Stopped hint: ${body.ui?.stoppedHint ?? "n/a"}
- During stream stop button disabled: ${body.ui?.duringStream?.stopButtonDisabled}
- During stream send button disabled: ${body.ui?.duringStream?.sendButtonDisabled}
- After stop assistant text: ${body.ui?.afterStop?.assistantText ?? "n/a"}
- After stop system text: ${body.ui?.afterStop?.systemText ?? "n/a"}
- After stop send button disabled: ${body.ui?.afterStop?.sendButtonDisabled}
- After stop input value empty: ${body.ui?.afterStop?.inputValue === ""}
- After stop abort seen: ${body.ui?.afterStop?.abortSeen}
- RAG stream request count: ${body.ui?.ragStreamCount ?? "n/a"}
- Fallback request count: ${body.ui?.fallbackCount ?? "n/a"}
- Screenshot path: ${body.screenshot?.path ?? "n/a"}
- Screenshot bytes: ${body.screenshot?.bytes ?? "n/a"}
- Screenshot dimensions: ${body.screenshot?.width ?? "n/a"}x${body.screenshot?.height ?? "n/a"}
- Valid PNG: ${body.screenshot?.validPng}
- Browser interaction: ${body.safety?.browserInteraction}
- Simulated stream only: ${body.safety?.simulatedStreamOnly}
- User abort only: ${body.safety?.userAbortOnly}
- Fallback skipped after abort: ${body.safety?.fallbackSkippedAfterAbort}
- Fake provider only: ${body.safety?.fakeProviderOnly}
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
