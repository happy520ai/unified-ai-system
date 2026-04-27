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

const PHASE = "phase-68a-web-chat-markdown-rendering";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-68a-web-chat-markdown-rendering.json");
const evidenceMdPath = resolve(evidenceDir, "phase-68a-web-chat-markdown-rendering.md");
const evidencePngPath = resolve(evidenceDir, "phase-68a-web-chat-markdown-rendering.png");

const prompt = "phase68a markdown rendering prompt";
const markdownAnswer = [
  "这是 Markdown-lite 渲染测试：",
  "",
  "- 第一条业务要点",
  "- 第二条包含安全链接 https://example.com/runbook",
  "",
  "1. 先检查状态",
  "2. 再执行归零",
  "",
  "```powershell",
  "cmd /c pnpm status:phase10a",
  "cmd /c pnpm idle:phase15a",
  "```",
  "",
  "参考：[交付指南](https://example.com/delivery)",
  "危险链接：[不要执行](javascript:alert(1))",
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

  browserProfileDir = await mkdtemp(resolve(tmpdir(), "phase68a-browser-profile-"));
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
      const state = window.__phase68ReadState();
      return state.done &&
        state.paragraphCount >= 2 &&
        state.bulletCount === 2 &&
        state.numberedCount === 2 &&
        state.codeBlockCount === 1 &&
        state.safeLinkCount === 2 &&
        state.unsafeLinkCount === 0 &&
        state.unsafeTextPresent === true;
    })()`);
    const afterAnswer = await readState(cdp);

    await cdp.evaluate(`(() => {
      window.__phase68LatestAssistant().querySelector('[data-message-action="copy-answer"]').click();
      return true;
    })()`);
    await waitForExpression(cdp, `window.__phase68ReadState().clipboard.at(-1) === ${JSON.stringify(markdownAnswer)}`);
    const afterCopyAnswer = await readState(cdp);

    await mkdir(evidenceDir, { recursive: true });
    await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })
      .then(async (result) => writeFile(evidencePngPath, Buffer.from(result.data, "base64")));
    await cdp.close();

    const screenshot = await inspectPng(evidencePngPath);
    const passed = afterAnswer.done &&
      afterAnswer.rawText === markdownAnswer &&
      afterAnswer.bulletCount === 2 &&
      afterAnswer.numberedCount === 2 &&
      afterAnswer.codeText.includes("cmd /c pnpm status:phase10a") &&
      afterAnswer.safeLinkCount === 2 &&
      afterAnswer.safeLinks.every((link) => link.href.startsWith("https://") && link.target === "_blank" && link.rel.includes("noopener")) &&
      afterAnswer.unsafeLinkCount === 0 &&
      afterAnswer.unsafeTextPresent &&
      afterCopyAnswer.clipboard.at(-1) === markdownAnswer &&
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
        afterCopyAnswer,
      },
      screenshot: {
        path: "apps/ai-gateway-service/evidence/phase-68a-web-chat-markdown-rendering.png",
        bytes: screenshot.bytes,
        width: screenshot.width,
        height: screenshot.height,
        validPng: screenshot.validPng,
      },
      safety: {
        browserInteraction: true,
        simulatedStreamOnly: true,
        markdownRenderingOnly: true,
        unsafeLinksRenderedAsText: afterAnswer.unsafeLinkCount === 0 && afterAnswer.unsafeTextPresent,
        rawAnswerPreservedForCopy: afterCopyAnswer.clipboard.at(-1) === markdownAnswer,
        fakeProviderOnly: true,
        defaultChatMainLaneChanged: false,
        backendBusinessRouteAdded: false,
        providerCalls: false,
        runtimeMutation: false,
        releaseAutomation: false,
        infrastructureProvisioning: false,
      },
      conclusion: passed ? "web-chat-markdown-rendering-connected" : "web-chat-markdown-rendering-not-connected",
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
    conclusion: "web-chat-markdown-rendering-not-connected",
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

async function installChatSimulation(cdp) {
  await cdp.evaluate(`(() => {
    window.__phase68Fetches = [];
    window.__phase68FetchStatuses = [];
    window.__phase68Clipboard = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__phase68Clipboard.push(String(text));
        },
      },
    });
    window.__phase68LatestAssistant = () => {
      const messages = Array.from(document.querySelectorAll(".message.assistant"));
      return messages[messages.length - 1];
    };
    window.__phase68ReadState = () => {
      const latestAssistant = window.__phase68LatestAssistant();
      const textNode = latestAssistant?.querySelector(".message-text");
      const safeLinks = textNode ? Array.from(textNode.querySelectorAll("a.md-link")).map((link) => ({
        text: link.textContent || "",
        href: link.href || "",
        target: link.target || "",
        rel: link.rel || "",
      })) : [];
      return {
        done: latestAssistant?.querySelector(".message-status")?.textContent.includes("回答完成") || false,
        renderedText: textNode?.textContent || "",
        rawText: textNode?.dataset.rawText || "",
        paragraphCount: textNode?.querySelectorAll("p").length || 0,
        bulletCount: textNode?.querySelectorAll("ul.md-list li").length || 0,
        numberedCount: textNode?.querySelectorAll("ol.md-list li").length || 0,
        codeBlockCount: textNode?.querySelectorAll("pre.md-code-block code").length || 0,
        codeText: textNode?.querySelector("pre.md-code-block code")?.textContent || "",
        safeLinkCount: safeLinks.length,
        safeLinks,
        unsafeLinkCount: textNode?.querySelectorAll('a[href^="javascript:"]').length || 0,
        unsafeTextPresent: textNode?.textContent.includes("不要执行 (javascript:alert(1))") || false,
        clipboard: window.__phase68Clipboard || [],
        fetches: window.__phase68Fetches || [],
        fetchStatuses: window.__phase68FetchStatuses || [],
        messageCount: document.querySelectorAll(".message").length,
      };
    };
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const path = String(args[0] || "");
      window.__phase68Fetches.push(path);
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
        window.__phase68FetchStatuses.push({ path, status: response.status, ok: response.ok, simulated: true });
        return response;
      }
      const response = await originalFetch(...args);
      window.__phase68FetchStatuses.push({ path, status: response.status, ok: response.ok, simulated: false });
      return response;
    };
    return true;
  })()`);
}

async function readState(cdp) {
  return cdp.evaluate("window.__phase68ReadState()");
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
    debugState = await cdp.evaluate(`typeof window.__phase68ReadState === "function" ? window.__phase68ReadState() : null`);
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
  return `# Phase 68A Web Chat Markdown Rendering Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.serviceUrl ?? "n/a"}
- Prompt: ${body.ui?.prompt ?? "n/a"}
- Paragraph count: ${body.ui?.afterAnswer?.paragraphCount ?? "n/a"}
- Bullet count: ${body.ui?.afterAnswer?.bulletCount ?? "n/a"}
- Numbered count: ${body.ui?.afterAnswer?.numberedCount ?? "n/a"}
- Code block count: ${body.ui?.afterAnswer?.codeBlockCount ?? "n/a"}
- Code text: ${body.ui?.afterAnswer?.codeText ?? "n/a"}
- Safe link count: ${body.ui?.afterAnswer?.safeLinkCount ?? "n/a"}
- Unsafe link count: ${body.ui?.afterAnswer?.unsafeLinkCount ?? "n/a"}
- Unsafe text present: ${body.ui?.afterAnswer?.unsafeTextPresent}
- Raw answer preserved for copy: ${body.safety?.rawAnswerPreservedForCopy}
- Screenshot path: ${body.screenshot?.path ?? "n/a"}
- Screenshot bytes: ${body.screenshot?.bytes ?? "n/a"}
- Screenshot dimensions: ${body.screenshot?.width ?? "n/a"}x${body.screenshot?.height ?? "n/a"}
- Valid PNG: ${body.screenshot?.validPng}
- Browser interaction: ${body.safety?.browserInteraction}
- Simulated stream only: ${body.safety?.simulatedStreamOnly}
- Markdown rendering only: ${body.safety?.markdownRenderingOnly}
- Unsafe links rendered as text: ${body.safety?.unsafeLinksRenderedAsText}
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
