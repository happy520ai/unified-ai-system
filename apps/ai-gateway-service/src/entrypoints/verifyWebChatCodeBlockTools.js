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

const PHASE = "phase-69a-web-chat-code-block-tools";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-69a-web-chat-code-block-tools.json");
const evidenceMdPath = resolve(evidenceDir, "phase-69a-web-chat-code-block-tools.md");
const evidencePngPath = resolve(evidenceDir, "phase-69a-web-chat-code-block-tools.png");

const prompt = "phase69a code block tools prompt";
const longLine = `Write-Output "${"phase69a-long-code-line-".repeat(12)}"`;
const codeText = [
  "cmd /c pnpm status:phase10a",
  "cmd /c pnpm logs:phase16a",
  "cmd /c pnpm idle:phase15a",
  longLine,
].join("\n");
const markdownAnswer = [
  "Phase69A code block polish:",
  "",
  "Use `cmd /c pnpm status:phase10a` before cleanup.",
  "",
  "```powershell",
  codeText,
  "```",
].join("\n");

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

  browserProfileDir = await mkdtemp(resolve(tmpdir(), "phase69a-browser-profile-"));
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
    await waitForExpression(cdp, "Boolean(document.getElementById('chat-form') && document.getElementById('chat-input'))");

    await installChatSimulation(cdp);

    await cdp.evaluate(`(() => {
      const input = document.getElementById("chat-input");
      input.focus();
      input.value = ${JSON.stringify(prompt)};
      document.getElementById("chat-form").requestSubmit();
      return true;
    })()`);

    await waitForExpression(cdp, `(() => {
      const state = window.__phase69ReadState();
      return state.rawText === ${JSON.stringify(markdownAnswer)} &&
        state.inlineCodeCount === 1 &&
        state.codeWrapCount === 1 &&
        state.codeBlockCount === 1 &&
        state.copyCodeButtonCount === 1 &&
        state.toolbarText.includes("powershell") &&
        state.codeText === ${JSON.stringify(codeText)} &&
        state.longCodeLinePresent &&
        state.codeOverflowX === "auto";
    })()`);
    const afterAnswer = await readState(cdp);

    await cdp.evaluate(`(() => {
      window.__phase69LatestAssistant().querySelector('[data-message-action="copy-code-block"]').click();
      return true;
    })()`);
    await waitForExpression(cdp, `window.__phase69ReadState().clipboard.at(-1) === ${JSON.stringify(codeText)}`);
    const afterCopyCode = await readState(cdp);

    await mkdir(evidenceDir, { recursive: true });
    await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })
      .then(async (result) => writeFile(evidencePngPath, Buffer.from(result.data, "base64")));
    await cdp.close();

    const screenshot = await inspectPng(evidencePngPath);
    const passed = afterAnswer.rawText === markdownAnswer &&
      afterAnswer.inlineCodeTexts.includes("cmd /c pnpm status:phase10a") &&
      afterAnswer.codeText === codeText &&
      afterAnswer.copyCodeButtonCount === 1 &&
      afterAnswer.codeOverflowX === "auto" &&
      afterAnswer.longCodeLinePresent &&
      afterCopyCode.clipboard.at(-1) === codeText &&
      afterCopyCode.systemText.includes("已复制代码块") &&
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
        afterAnswer,
        afterCopyCode,
      },
      screenshot: {
        path: "apps/ai-gateway-service/evidence/phase-69a-web-chat-code-block-tools.png",
        bytes: screenshot.bytes,
        width: screenshot.width,
        height: screenshot.height,
        validPng: screenshot.validPng,
      },
      safety: {
        browserInteraction: true,
        simulatedStreamOnly: true,
        codeBlockToolsOnly: true,
        inlineCodeRendering: afterAnswer.inlineCodeCount === 1,
        copyCodeButtonOnlyCopiesCode: afterCopyCode.clipboard.at(-1) === codeText,
        longCodeOverflowIsHorizontal: afterAnswer.codeOverflowX === "auto",
        fakeProviderOnly: true,
        defaultChatMainLaneChanged: false,
        backendBusinessRouteAdded: false,
        providerCalls: false,
        runtimeMutation: false,
        releaseAutomation: false,
        infrastructureProvisioning: false,
      },
      conclusion: passed ? "web-chat-code-block-tools-connected" : "web-chat-code-block-tools-not-connected",
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
    conclusion: "web-chat-code-block-tools-not-connected",
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

async function installChatSimulation(cdp) {
  await cdp.evaluate(`(() => {
    window.__phase69Fetches = [];
    window.__phase69FetchStatuses = [];
    window.__phase69Clipboard = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__phase69Clipboard.push(String(text));
        },
      },
    });
    window.__phase69LatestAssistant = () => {
      const messages = Array.from(document.querySelectorAll(".message.assistant"));
      return messages[messages.length - 1];
    };
    window.__phase69ReadState = () => {
      const latestAssistant = window.__phase69LatestAssistant();
      const textNode = latestAssistant?.querySelector(".message-text");
      const codeWrap = textNode?.querySelector(".md-code-wrap");
      const codeBlock = codeWrap?.querySelector("pre.md-code-block");
      const codeNode = codeBlock?.querySelector("code");
      const inlineCodes = textNode ? Array.from(textNode.querySelectorAll("code.md-inline-code")).map((code) => code.textContent || "") : [];
      const copyButtons = textNode ? Array.from(textNode.querySelectorAll('[data-message-action="copy-code-block"]')) : [];
      return {
        rawText: textNode?.dataset.rawText || "",
        renderedText: textNode?.textContent || "",
        inlineCodeCount: inlineCodes.length,
        inlineCodeTexts: inlineCodes,
        codeWrapCount: textNode?.querySelectorAll(".md-code-wrap").length || 0,
        codeBlockCount: textNode?.querySelectorAll("pre.md-code-block code").length || 0,
        copyCodeButtonCount: copyButtons.length,
        copyCodeButtonText: copyButtons[0]?.textContent || "",
        toolbarText: codeWrap?.querySelector(".md-code-toolbar")?.textContent || "",
        codeText: codeNode?.textContent || "",
        codeOverflowX: codeBlock ? getComputedStyle(codeBlock).overflowX : "",
        codeScrollWidth: codeBlock?.scrollWidth || 0,
        codeClientWidth: codeBlock?.clientWidth || 0,
        longCodeLinePresent: codeNode?.textContent.includes(${JSON.stringify(longLine)}) || false,
        systemText: Array.from(document.querySelectorAll(".message.system")).map((node) => node.textContent || "").join("\\n"),
        clipboard: window.__phase69Clipboard || [],
        fetches: window.__phase69Fetches || [],
        fetchStatuses: window.__phase69FetchStatuses || [],
        messageCount: document.querySelectorAll(".message").length,
      };
    };
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const path = String(args[0] || "");
      window.__phase69Fetches.push(path);
      if (path === "/chat/rag/stream") {
        const encoder = new TextEncoder();
        const frames = [
          "event: chunk\\ndata: " + JSON.stringify({ type: "chunk", textDelta: ${JSON.stringify(markdownAnswer)}, outputText: ${JSON.stringify(markdownAnswer)} }) + "\\n\\n",
          "event: done\\ndata: " + JSON.stringify({ type: "done", outputText: ${JSON.stringify(markdownAnswer)} }) + "\\n\\n",
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
        window.__phase69FetchStatuses.push({ path, status: response.status, ok: response.ok, simulated: true });
        return response;
      }
      const response = await originalFetch(...args);
      window.__phase69FetchStatuses.push({ path, status: response.status, ok: response.ok, simulated: false });
      return response;
    };
    return true;
  })()`);
}

async function readState(cdp) {
  return cdp.evaluate("window.__phase69ReadState()");
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
    debugState = await cdp.evaluate(`typeof window.__phase69ReadState === "function" ? window.__phase69ReadState() : null`);
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

