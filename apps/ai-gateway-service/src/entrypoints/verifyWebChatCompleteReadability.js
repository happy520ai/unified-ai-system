import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const PHASE = "phase-61a-web-chat-complete-readability";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-61a-web-chat-complete-readability.json");
const evidenceMdPath = resolve(evidenceDir, "phase-61a-web-chat-complete-readability.md");
const evidencePngPath = resolve(evidenceDir, "phase-61a-web-chat-complete-readability.png");

const fallbackAnswer = "phase61 fallback answer from ordinary RAG";
const fallbackFailureCode = "PHASE61_FALLBACK_FAILED";
const emptyStreamText = "流式请求已完成，但没有返回文本。";
const fallbackSuccessHint = "流式连接中断，已自动切换普通回答。本次回答仍来自同一个 AI Gateway。";

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

  browserProfileDir = await mkdtemp(resolve(tmpdir(), "phase61a-browser-profile-"));
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
    await waitForExpression(cdp, "document.getElementById('provider-select').options.length > 1");

    await installFetchSimulation(cdp);

    const fallbackSuccess = await runScenario(cdp, {
      scenario: "fallback-success",
      prompt: "phase61 fallback success prompt",
      waitExpression: `(() => {
        const state = window.__phase61ReadState();
        return !state.formSending &&
          state.latestAssistantText.includes(${JSON.stringify(fallbackAnswer)}) &&
          state.latestSystemText.includes(${JSON.stringify(fallbackSuccessHint)});
      })()`,
    });

    const fallbackFailure = await runScenario(cdp, {
      scenario: "fallback-failure",
      prompt: "phase61 fallback failure prompt",
      waitExpression: `(() => {
        const state = window.__phase61ReadState();
        return !state.formSending &&
          state.latestAssistantError &&
          state.latestAssistantText.includes("聊天请求失败") &&
          state.latestAssistantText.includes(${JSON.stringify(fallbackFailureCode)}) &&
          state.latestAssistantText.includes("HTTP 502") &&
          state.latestAssistantText.includes("可以稍后重试");
      })()`,
    });

    const emptyStream = await runScenario(cdp, {
      scenario: "empty-stream",
      prompt: "phase61 empty stream prompt",
      waitExpression: `(() => {
        const state = window.__phase61ReadState();
        return !state.formSending &&
          state.latestAssistantText.includes(${JSON.stringify(emptyStreamText)}) &&
          !state.latestAssistantError;
      })()`,
    });
    const fetches = await cdp.evaluate("window.__phase61Fetches || []");

    await mkdir(evidenceDir, { recursive: true });
    await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })
      .then(async (result) => writeFile(evidencePngPath, Buffer.from(result.data, "base64")));
    await cdp.close();

    const screenshot = await inspectPng(evidencePngPath);
    const passed = fallbackSuccess.latestAssistantText.includes(fallbackAnswer) &&
      fallbackSuccess.latestSystemText.includes(fallbackSuccessHint) &&
      !fallbackSuccess.latestAssistantError &&
      fallbackFailure.latestAssistantError &&
      fallbackFailure.latestAssistantText.includes("聊天请求失败") &&
      fallbackFailure.latestAssistantText.includes(fallbackFailureCode) &&
      fallbackFailure.latestAssistantText.includes("HTTP 502") &&
      fallbackFailure.latestAssistantText.includes("health / doctor / logs") &&
      emptyStream.latestAssistantText.includes(emptyStreamText) &&
      !emptyStream.latestAssistantError &&
      fallbackSuccess.sendButtonText === "发送" &&
      fallbackFailure.sendButtonText === "发送" &&
      emptyStream.sendButtonText === "发送" &&
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
        fallbackSuccess,
        fallbackFailure,
        emptyStream,
        fetches,
      },
      screenshot: {
        path: "apps/ai-gateway-service/evidence/phase-61a-web-chat-complete-readability.png",
        bytes: screenshot.bytes,
        width: screenshot.width,
        height: screenshot.height,
        validPng: screenshot.validPng,
      },
      safety: {
        browserInteraction: true,
        simulatedChatFailuresOnly: true,
        fakeProviderOnly: true,
        defaultChatMainLaneChanged: false,
        backendBusinessRouteAdded: false,
        providerCalls: false,
        runtimeMutation: false,
        releaseAutomation: false,
        infrastructureProvisioning: false,
      },
      conclusion: passed ? "web-chat-complete-readability-connected" : "web-chat-complete-readability-not-connected",
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
    conclusion: "web-chat-complete-readability-not-connected",
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

async function installFetchSimulation(cdp) {
  await cdp.evaluate(`(() => {
    window.__phase61Fetches = [];
    window.__phase61Scenario = "";
    window.__phase61ReadState = () => {
      const sendButton = document.getElementById("send-button");
      const assistantMessages = Array.from(document.querySelectorAll(".message.assistant"));
      const systemMessages = Array.from(document.querySelectorAll(".message.system"));
      const latestAssistant = assistantMessages[assistantMessages.length - 1];
      const latestSystem = systemMessages[systemMessages.length - 1];
      return {
        sendButtonDisabled: Boolean(sendButton?.disabled),
        sendButtonText: sendButton?.textContent || "",
        formSending: Boolean(document.getElementById("chat-form")?.classList?.contains("is-sending")),
        latestAssistantText: latestAssistant?.textContent || "",
        latestAssistantError: Boolean(latestAssistant?.classList?.contains("error")),
        latestSystemText: latestSystem?.textContent || "",
        messageCount: document.querySelectorAll(".message").length,
      };
    };
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const path = String(args[0] || "");
      const scenario = window.__phase61Scenario || "passthrough";
      window.__phase61Fetches.push({ path, scenario });
      if (path === "/chat/rag/stream") {
        if (scenario === "empty-stream") {
          return createSseResponse([
            { event: "knowledge", data: { type: "knowledge", citations: [], retrieved: false, chunkCount: 0 } },
            { event: "done", data: { type: "done", outputText: "" } },
          ]);
        }
        return createSseResponse([
          {
            event: "error",
            data: {
              type: "error",
              error: {
                code: "PHASE61_STREAM_ERROR_EVENT",
                message: "Phase61 simulated stream error event",
                retryable: true,
              },
            },
          },
        ]);
      }
      if (path === "/chat/rag") {
        if (scenario === "fallback-success") {
          return new Response(JSON.stringify({
            success: true,
            data: {
              answer: ${JSON.stringify(fallbackAnswer)},
              knowledge: { citations: [] },
            },
          }), {
            status: 200,
            headers: { "content-type": "application/json; charset=utf-8" },
          });
        }
        if (scenario === "fallback-failure") {
          return new Response(JSON.stringify({
            success: false,
            error: {
              code: ${JSON.stringify(fallbackFailureCode)},
              message: "Phase61 simulated fallback failure",
            },
          }), {
            status: 502,
            headers: { "content-type": "application/json; charset=utf-8" },
          });
        }
      }
      return originalFetch(...args);
    };
    function createSseResponse(events) {
      const encoder = new TextEncoder();
      const frames = events.map((item) => "event: " + item.event + "\\ndata: " + JSON.stringify(item.data) + "\\n\\n").join("");
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
    return true;
  })()`);
}

async function runScenario(cdp, { scenario, prompt, waitExpression }) {
  await cdp.evaluate(`(() => {
    window.__phase61Scenario = ${JSON.stringify(scenario)};
    const input = document.getElementById("chat-input");
    input.value = ${JSON.stringify(prompt)};
    input.dispatchEvent(new Event("input", { bubbles: true }));
    document.getElementById("chat-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    return true;
  })()`);
  await waitForExpression(cdp, waitExpression, 15_000);
  return cdp.evaluate("window.__phase61ReadState()");
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
    debugState = await cdp.evaluate(`({
      state: typeof window.__phase61ReadState === "function" ? window.__phase61ReadState() : null,
      fetches: window.__phase61Fetches || [],
      scenario: window.__phase61Scenario || null
    })`);
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
  return `# Phase 61A Web Chat Complete Readability Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.serviceUrl ?? "n/a"}
- Fallback success assistant text: ${body.ui?.fallbackSuccess?.latestAssistantText ?? "n/a"}
- Fallback success system hint: ${body.ui?.fallbackSuccess?.latestSystemText ?? "n/a"}
- Fallback failure assistant text: ${body.ui?.fallbackFailure?.latestAssistantText ?? "n/a"}
- Empty stream assistant text: ${body.ui?.emptyStream?.latestAssistantText ?? "n/a"}
- Fetches: ${JSON.stringify(body.ui?.fetches ?? [])}
- Screenshot path: ${body.screenshot?.path ?? "n/a"}
- Screenshot bytes: ${body.screenshot?.bytes ?? "n/a"}
- Screenshot dimensions: ${body.screenshot?.width ?? "n/a"}x${body.screenshot?.height ?? "n/a"}
- Valid PNG: ${body.screenshot?.validPng}
- Browser interaction: ${body.safety?.browserInteraction}
- Simulated chat failures only: ${body.safety?.simulatedChatFailuresOnly}
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
