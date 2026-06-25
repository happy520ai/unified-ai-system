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
import { sleep, listen, findBrowserPath, close } from "./entrypointUtils.js";

const PHASE = "phase-76m-web-chat-citation-insight";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-76m-web-chat-citation-insight.json");
const evidenceMdPath = resolve(evidenceDir, "phase-76m-web-chat-citation-insight.md");
const evidencePngPath = resolve(evidenceDir, "phase-76m-web-chat-citation-insight.png");

const prompt = "phase76m citation insight prompt";
const answer = "phase76m answer proves citation insight cards are readable";
const marker = "phase76m-citation-insight-marker";
const snippet = `The ${marker} explains why citation scoring, matched terms, and highlighted snippets make knowledge hits easier to trust.`;

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

  browserProfileDir = await mkdtemp(resolve(tmpdir(), "phase76m-browser-profile-"));
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
      input.dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("chat-form").requestSubmit();
      return true;
    })()`);

    const afterAnswer = await waitForCitationInsight(cdp);

    await mkdir(evidenceDir, { recursive: true });
    await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })
      .then(async (result) => writeFile(evidencePngPath, Buffer.from(result.data, "base64")));
    await cdp.close();

    const screenshot = await inspectPng(evidencePngPath);
    const passed = afterAnswer.latestAssistantText.includes(answer) &&
      afterAnswer.citationHeading.includes("知识命中") &&
      afterAnswer.citationHeading.includes("引用 1 条") &&
      afterAnswer.firstSummary.includes("Phase 76M Citation Source") &&
      afterAnswer.scorePill.includes("0.9321") &&
      afterAnswer.termPills.includes("phase76m") &&
      afterAnswer.termPills.includes("citation") &&
      afterAnswer.metaText.includes("phase76m-source") &&
      afterAnswer.metaText.includes("phase76m-doc") &&
      afterAnswer.snippetText.includes(marker) &&
      afterAnswer.highlightCount >= 2 &&
      afterAnswer.copySingleButtonCount === 1 &&
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
      },
      screenshot: {
        path: "apps/ai-gateway-service/evidence/phase-76m-web-chat-citation-insight.png",
        bytes: screenshot.bytes,
        width: screenshot.width,
        height: screenshot.height,
        validPng: screenshot.validPng,
      },
      safety: {
        browserInteraction: true,
        simulatedStreamOnly: true,
        citationInsightOnly: true,
        fakeProviderOnly: true,
        defaultChatMainLaneChanged: false,
        backendBusinessRouteAdded: false,
        providerCalls: false,
        runtimeMutation: false,
        releaseAutomation: false,
        infrastructureProvisioning: false,
      },
      conclusion: passed ? "web-chat-citation-insight-connected" : "web-chat-citation-insight-not-connected",
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
    conclusion: "web-chat-citation-insight-not-connected",
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
  if (!match) throw new Error("Console page script not found.");
  new vm.Script(match[1], { filename: "consolePage-inline.js" });
}

async function installChatSimulation(cdp) {
  await cdp.evaluate(`(() => {
    window.__phase76mFetches = [];
    window.__phase76mFetchStatuses = [];
    window.__phase76mLatestAssistant = () => {
      const messages = Array.from(document.querySelectorAll(".message.assistant"));
      return messages[messages.length - 1];
    };
    window.__phase76mReadState = () => {
      const latestAssistant = window.__phase76mLatestAssistant();
      const firstCard = latestAssistant?.querySelector(".citation-card");
      return {
        latestAssistantText: latestAssistant?.querySelector(".message-text")?.textContent || "",
        citationHeading: latestAssistant?.querySelector(".citation-heading")?.textContent || "",
        firstSummary: firstCard?.querySelector("summary")?.textContent || "",
        scorePill: firstCard?.querySelector(".citation-pill.score")?.textContent || "",
        termPills: Array.from(firstCard?.querySelectorAll(".citation-pill.term") || []).map((item) => item.textContent || ""),
        allPills: Array.from(firstCard?.querySelectorAll(".citation-pill") || []).map((item) => item.textContent || ""),
        metaText: firstCard?.querySelector(".citation-meta-grid")?.textContent || "",
        snippetText: firstCard?.querySelector(".citation-snippet")?.textContent || "",
        highlightCount: firstCard?.querySelectorAll(".citation-snippet mark").length || 0,
        copySingleButtonCount: latestAssistant?.querySelectorAll('[data-message-action="copy-single-citation"]').length || 0,
        fetches: window.__phase76mFetches || [],
        fetchStatuses: window.__phase76mFetchStatuses || [],
      };
    };
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const path = String(args[0] || "");
      window.__phase76mFetches.push(path);
      if (path === "/chat/rag/stream") {
        const citations = [{
          index: 1,
          sourceId: "phase76m-source",
          documentId: "phase76m-doc",
          title: "Phase 76M Citation Source",
          snippet: ${JSON.stringify(snippet)},
          matchedTerms: ["phase76m", "citation", "scoring"],
          score: 0.9321,
          scoreBreakdown: { exact: 2, phrase: true, fieldWeight: "title+body" },
          metadata: { fileName: "phase76m-citation.md", namespace: "ui" },
        }];
        const encoder = new TextEncoder();
        const frames = [
          "event: knowledge\\ndata: " + JSON.stringify({ type: "knowledge", citations, retrieved: true, topHit: citations[0] }) + "\\n\\n",
          "event: chunk\\ndata: " + JSON.stringify({ type: "chunk", textDelta: ${JSON.stringify(answer)}, outputText: ${JSON.stringify(answer)} }) + "\\n\\n",
          "event: done\\ndata: " + JSON.stringify({ type: "done", outputText: ${JSON.stringify(answer)} }) + "\\n\\n",
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
        window.__phase76mFetchStatuses.push({ path, status: response.status, ok: response.ok, simulated: true });
        return response;
      }
      const response = await originalFetch(...args);
      window.__phase76mFetchStatuses.push({ path, status: response.status, ok: response.ok, simulated: false });
      return response;
    };
    return true;
  })()`);
}

async function waitForCitationInsight(cdp) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const result = await cdp.evaluate("window.__phase76mReadState()");
    if (result.latestAssistantText?.includes(answer) && result.citationHeading && result.scorePill) {
      return result;
    }
    await sleep(150);
  }
  throw new Error("Timed out waiting for citation insight UI.");
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

