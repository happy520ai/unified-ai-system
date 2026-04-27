import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const PHASE = "phase-55a-web-multi-file-upload-interaction";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-55a-web-multi-file-upload-interaction.json");
const evidenceMdPath = resolve(evidenceDir, "phase-55a-web-multi-file-upload-interaction.md");
const evidencePngPath = resolve(evidenceDir, "phase-55a-web-multi-file-upload-interaction.png");

const uploadedFileName = "phase55a-upload.txt";
const skippedFileName = "phase55a-too-large.txt";
const marker = "phase55a-multi-file-upload-marker";
const fileContent = `This uploaded browser file proves the Chat-first UI can load one document, skip an oversized file, and retrieve the loaded document later. ${marker}`;
const overLimitBytes = (100 * 1024 * 1024) + 1;
const prompt = "请根据刚上传的文件说明 phase55a multi file upload marker 的作用。";

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

  browserProfileDir = await mkdtemp(resolve(tmpdir(), "phase55a-browser-profile-"));
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
    await waitForExpression(cdp, "Boolean(document.getElementById('file-input') && document.getElementById('chat-form'))");
    await waitForExpression(cdp, "document.getElementById('provider-select').options.length > 1");

    await cdp.evaluate(`(() => {
      window.__phase55Fetches = [];
      window.__phase55FetchStatuses = [];
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (...args) => {
        const path = String(args[0] || "");
        window.__phase55Fetches.push(path);
        const response = await originalFetch(...args);
        window.__phase55FetchStatuses.push({ path, status: response.status, ok: response.ok });
        return response;
      };
      const select = document.getElementById("provider-select");
      const option = Array.from(select.options).find((item) => item.value === "local-fake-provider::local-fake-model");
      if (option) select.value = option.value;
      return { optionCount: select.options.length, selected: select.value };
    })()`);

    await cdp.evaluate(`(() => {
      const file = new File([${JSON.stringify(fileContent)}], ${JSON.stringify(uploadedFileName)}, { type: "text/plain" });
      const tooLargeFile = new File([new Uint8Array(${overLimitBytes})], ${JSON.stringify(skippedFileName)}, { type: "text/plain" });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      transfer.items.add(tooLargeFile);
      const input = document.getElementById("file-input");
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);

    const upload = await waitForUploadResult(cdp);

    await cdp.evaluate(`(() => {
      const input = document.getElementById("chat-input");
      input.value = ${JSON.stringify(prompt)};
      input.dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("chat-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      return true;
    })()`);

    const chat = await waitForChatResult(cdp);
    await mkdir(evidenceDir, { recursive: true });
    await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })
      .then(async (result) => writeFile(evidencePngPath, Buffer.from(result.data, "base64")));
    await cdp.close();

    const screenshot = await inspectPng(evidencePngPath);
    const skipMessage = `${skippedFileName} 超过 100MB`;
    const passed = upload.uploadStatus.includes("已导入 1 个文档") &&
      upload.uploadStatus.includes("跳过") &&
      upload.uploadStatus.includes(skipMessage) &&
      upload.fetches.includes("/knowledge/load/file") &&
      chat.fetches.includes("/chat/rag/stream") &&
      chat.assistantText.includes("[fake:local-fake-provider/local-fake-model]") &&
      chat.assistantText.includes(marker) &&
      chat.errorMessage === "" &&
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
        uploadedFileNames: [uploadedFileName, skippedFileName],
        loadedFileName: uploadedFileName,
        skippedFileName,
        prompt,
        uploadStatus: upload.uploadStatus,
        fetches: chat.fetches,
        fetchStatuses: chat.fetchStatuses,
        loadFileCalled: upload.fetches.includes("/knowledge/load/file"),
        multiFileInput: true,
        oversizedFileBytes: overLimitBytes,
        skipMessage,
        skipMessagePresent: upload.uploadStatus.includes(skipMessage),
        ragStreamCalled: chat.fetches.includes("/chat/rag/stream"),
        assistantTextPresent: Boolean(chat.assistantText),
        assistantTextIncludesFakeProvider: chat.assistantText.includes("[fake:local-fake-provider/local-fake-model]"),
        markerMatched: chat.assistantText.includes(marker),
        errorMessage: chat.errorMessage,
        messageCount: chat.messageCount,
      },
      screenshot: {
        path: "apps/ai-gateway-service/evidence/phase-55a-web-multi-file-upload-interaction.png",
        bytes: screenshot.bytes,
        width: screenshot.width,
        height: screenshot.height,
        validPng: screenshot.validPng,
      },
      safety: {
        browserFileInteraction: true,
        fakeProviderOnly: true,
        defaultChatMainLaneChanged: false,
        backendBusinessRouteAdded: false,
        providerCalls: false,
        runtimeMutationBeyondBoundedKnowledgeFileLoad: false,
        releaseAutomation: false,
        infrastructureProvisioning: false,
      },
      conclusion: passed ? "web-multi-file-upload-interaction-connected" : "web-multi-file-upload-interaction-not-connected",
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
    conclusion: "web-multi-file-upload-interaction-not-connected",
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

async function waitForUploadResult(cdp) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const result = await cdp.evaluate(`(() => ({
      uploadStatus: document.getElementById("upload-status")?.textContent || "",
      fetches: window.__phase55Fetches || [],
      fetchStatuses: window.__phase55FetchStatuses || [],
      systemMessages: Array.from(document.querySelectorAll(".message.system")).map((node) => node.textContent),
    }))()`);
    if (result.uploadStatus?.includes("已导入") || result.fetchStatuses?.some((item) => item.path === "/knowledge/load/file" && item.status >= 400)) {
      return result;
    }
    await sleep(150);
  }
  throw new Error("Timed out waiting for browser file upload result.");
}

async function waitForChatResult(cdp) {
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    const result = await cdp.evaluate(`(() => {
      const assistantMessages = Array.from(document.querySelectorAll(".message.assistant"));
      const latestAssistant = assistantMessages[assistantMessages.length - 1];
      const errorMessage = latestAssistant?.classList?.contains("error") ? latestAssistant.textContent : "";
      return {
        assistantText: latestAssistant?.textContent || "",
        errorMessage: errorMessage || "",
        fetches: window.__phase55Fetches || [],
        fetchStatuses: window.__phase55FetchStatuses || [],
        messageCount: document.querySelectorAll(".message").length,
      };
    })()`);
    if (result.assistantText?.includes(marker) || result.errorMessage) {
      return result;
    }
    await sleep(150);
  }
  throw new Error("Timed out waiting for browser chat result.");
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
  return `# Phase 55A Web Multi-File Upload Interaction Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.serviceUrl ?? "n/a"}
- Uploaded files: ${(body.ui?.uploadedFileNames ?? []).join(", ") || "n/a"}
- Loaded file: ${body.ui?.loadedFileName ?? "n/a"}
- Skipped file: ${body.ui?.skippedFileName ?? "n/a"}
- Upload status: ${body.ui?.uploadStatus ?? "n/a"}
- Multi-file input: ${body.ui?.multiFileInput}
- Oversized file bytes: ${body.ui?.oversizedFileBytes ?? "n/a"}
- Skip message present: ${body.ui?.skipMessagePresent}
- Load file called: ${body.ui?.loadFileCalled}
- RAG stream called: ${body.ui?.ragStreamCalled}
- Prompt: ${body.ui?.prompt ?? "n/a"}
- Fetches: ${(body.ui?.fetches ?? []).join(", ") || "none"}
- Assistant text present: ${body.ui?.assistantTextPresent}
- Assistant includes fake provider: ${body.ui?.assistantTextIncludesFakeProvider}
- Marker matched: ${body.ui?.markerMatched}
- Error message: ${body.ui?.errorMessage || "none"}
- Message count: ${body.ui?.messageCount ?? "n/a"}
- Screenshot path: ${body.screenshot?.path ?? "n/a"}
- Screenshot bytes: ${body.screenshot?.bytes ?? "n/a"}
- Screenshot dimensions: ${body.screenshot?.width ?? "n/a"}x${body.screenshot?.height ?? "n/a"}
- Valid PNG: ${body.screenshot?.validPng}
- Browser file interaction: ${body.safety?.browserFileInteraction}
- Fake provider only: ${body.safety?.fakeProviderOnly}
- Default chat main lane changed: ${body.safety?.defaultChatMainLaneChanged}
- Backend business route added: ${body.safety?.backendBusinessRouteAdded}
- Provider calls: ${body.safety?.providerCalls}
- Runtime mutation beyond bounded knowledge file load: ${body.safety?.runtimeMutationBeyondBoundedKnowledgeFileLoad}
- Release automation: ${body.safety?.releaseAutomation}
- Infrastructure provisioning: ${body.safety?.infrastructureProvisioning}
- Conclusion: ${body.conclusion}
`;
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}
