import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import vm from "node:vm";
import { createConsolePage } from "../ui/consolePage.js";
import { sleep } from "./entrypointUtils.js";

const MOCK_CHAT_MODEL_ID = "phase98-chat-model";
const MOCK_TEST_API_KEY = "phase98-secret-must-not-persist";

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
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Runtime.evaluate failed.");
      }
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

async function createCdpPage(port, url) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  if (!response.ok) throw new Error(`Unable to create CDP page: HTTP ${response.status}`);
  return response.json();
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

function createMockOpenAiCompatibleProvider(requests) {
  return createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const bodyText = Buffer.concat(chunks).toString("utf8");
    const body = safeJsonParse(bodyText);
    requests.push({
      method: request.method,
      url: request.url,
      hasAuthorization: Boolean(request.headers.authorization),
      authorizationRedacted: request.headers.authorization ? "Bearer ***" : "",
      model: body?.model || "",
      stream: body?.stream === true,
    });

    if (request.method === "GET" && request.url === "/v1/models") {
      return sendJson(response, 200, {
        object: "list",
        data: [{
          id: MOCK_CHAT_MODEL_ID,
          object: "model",
          owned_by: "phase98-mock",
          capabilities: ["chat", "summary"],
          input_modalities: ["text"],
          output_modalities: ["text"],
        }],
      });
    }

    if (request.method === "POST" && request.url === "/v1/chat/completions") {
      return sendJson(response, 200, {
        id: "phase98-chat-completion",
        object: "chat.completion",
        model: body?.model || MOCK_CHAT_MODEL_ID,
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: "phase98 model config user journey probe ok",
          },
          finish_reason: "stop",
        }],
      });
    }

    sendJson(response, 404, { error: { message: "not found" } });
  });
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function safeJsonParse(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function verifyEmbeddedScriptSyntax() {
  const html = createConsolePage();
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) throw new Error("Console page script not found.");
  new vm.Script(match[1], { filename: "consolePage-inline.js" });
}

async function installFetchRecorderOnNewDocument(cdp) {
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      (() => {
        window.__phase98Fetches = [];
        const originalFetch = window.fetch.bind(window);
        window.fetch = async (...args) => {
          const path = String(args[0] || "");
          const options = args[1] || {};
          const item = { path };
          try {
            const parsed = JSON.parse(options.body || "{}");
            if (path === "/models/import/preview") {
              item.providerHint = parsed.providerHint || "";
              item.baseUrlPresent = Boolean(parsed.baseUrl);
              item.hasApiKey = Boolean(parsed.apiKey);
              item.apiKeyRedacted = parsed.apiKey ? "***" : "";
            } else if (path === "/models/import/confirm") {
              item.providerId = parsed.providerId || "";
              item.modelId = parsed.modelId || "";
              item.hasApiKeyRef = Boolean(parsed.apiKeyRef);
            } else if (path === "/chat") {
              item.providerId = parsed.providerId || "";
              item.model = parsed.model || "";
              item.promptPresent = Boolean(parsed.prompt);
            }
          } catch {
            item.bodyParseFailed = true;
          }
          window.__phase98Fetches.push(item);
          return originalFetch(...args);
        };
      })();
    `,
  });
}

async function openModelConfigWizard(cdp) {
  await cdp.evaluate(`(() => {
    const button = document.getElementById("composer-model-config-button");
    if (!button) throw new Error("composer model config button missing");
    button.click();
    return true;
  })()`);
}

async function fillAndQuickApply(cdp, mockProviderBaseUrl) {
  await cdp.evaluate(`(() => {
    const secret = document.querySelector("[data-command-secret-draft]");
    const hint = document.querySelector("[data-command-provider-hint]");
    const baseUrl = document.querySelector("[data-command-base-url]");
    const quickApply = document.querySelector("[data-command-action='apply-and-probe-provider']");
    secret.value = ${JSON.stringify(MOCK_TEST_API_KEY)};
    secret.dispatchEvent(new Event("input", { bubbles: true }));
    hint.value = "openai-compatible";
    hint.dispatchEvent(new Event("change", { bubbles: true }));
    baseUrl.value = ${JSON.stringify(mockProviderBaseUrl)};
    baseUrl.dispatchEvent(new Event("input", { bubbles: true }));
    quickApply.click();
    return true;
  })()`);
}

async function clickAction(cdp, action) {
  await cdp.evaluate(`(() => {
    const button = document.querySelector("[data-command-feedback] [data-command-action='${action}']");
    if (!button) throw new Error("Missing action button: ${action}");
    button.click();
    return true;
  })()`);
}

async function readInitialState(cdp) {
  return cdp.evaluate(`(() => {
    const guide = document.getElementById("composer-model-guide")?.textContent || "";
    return {
      entryButtonText: document.getElementById("composer-model-config-button")?.textContent || "",
      modelLabel: document.getElementById("composer-model-label")?.textContent || "",
      probeText: document.getElementById("composer-model-probe")?.textContent || "",
      guide,
      guideIncludesApiKey: guide.includes("Key"),
      guideIncludesDirectChat: guide.includes("直接聊"),
    };
  })()`);
}

async function readWizardState(cdp) {
  return cdp.evaluate(`(() => {
    const wizard = document.querySelector("[data-command-wizard='model-config-v2']");
    const feedback = document.querySelector("[data-command-feedback]");
    return {
      hasWizard: Boolean(wizard),
      text: wizard?.textContent || "",
      stepTitles: Array.from(document.querySelectorAll(".chat-config-step-body > strong")).map((node) => node.textContent || ""),
      hasSecretInput: Boolean(document.querySelector("[data-command-secret-draft]")),
      hasProviderHint: Boolean(document.querySelector("[data-command-provider-hint]")),
      hasBaseUrlInput: Boolean(document.querySelector("[data-command-base-url]")),
      hasDetectButton: Boolean(document.querySelector("[data-command-action='detect-provider-from-key']")),
      quickApplyButtonText: document.querySelector("[data-command-action='apply-and-probe-provider']")?.textContent || "",
      feedbackTitle: feedback?.querySelector(":scope > strong")?.textContent || "",
      feedbackHasPasteAction: Boolean(document.querySelector("[data-command-action='focus-api-key-draft']")),
      advancedOptionsCollapsed: document.querySelector("[data-command-advanced-options]")?.open === false,
    };
  })()`);
}

async function readSuccessState(cdp) {
  return cdp.evaluate(`(() => {
    const feedback = document.querySelector("[data-command-feedback]");
    const secret = document.querySelector("[data-command-secret-draft]");
    const visibleLines = Array.from(feedback?.querySelectorAll(":scope > p") || []).map((node) => node.textContent || "");
    return {
      providerSelectValue: document.getElementById("provider-select")?.value || "",
      statusTitle: feedback?.querySelector(":scope > strong")?.textContent || "",
      visibleLines,
      feedbackCompact: feedback?.dataset.modelConfigSuccess || "",
      hasDetails: Boolean(feedback?.querySelector("[data-model-config-success-details='true']")),
      continueChatActionPresent: Boolean(feedback?.querySelector("[data-command-action='continue-chat-after-model-check']")),
      persistActionPresent: Boolean(feedback?.querySelector("[data-command-action='persist-detected-model']")),
      composerModelGuide: document.getElementById("composer-model-guide")?.textContent || "",
      secretInputCleared: (secret?.value || "") === "",
    };
  })()`);
}

async function readReadyState(cdp) {
  return cdp.evaluate(`(() => {
    const input = document.getElementById("chat-input");
    const localStorageDump = Object.keys(localStorage).map((key) => key + ":" + localStorage.getItem(key)).join("\\n");
    return {
      focusReturnedToChatInput: document.activeElement?.id === "chat-input",
      inputPlaceholder: input?.getAttribute("placeholder") || "",
      composerGuidanceKind: document.getElementById("composer-shortcut-hint")?.dataset.composerGuidanceKind || "",
      composerGuidanceText: document.getElementById("composer-shortcut-hint")?.textContent || "",
      sessionStatusText: document.getElementById("chat-session-status")?.textContent || "",
      sendButtonDisabled: document.getElementById("send-button")?.disabled === true,
      fetches: window.__phase98Fetches || [],
      pageTextContainsSecret: document.body.textContent.includes(${JSON.stringify(MOCK_TEST_API_KEY)}),
      localStorageContainsSecret: localStorageDump.includes(${JSON.stringify(MOCK_TEST_API_KEY)}),
    };
  })()`);
}

export {
  MOCK_CHAT_MODEL_ID,
  MOCK_TEST_API_KEY,
  connectCdp,
  createCdpPage,
  readDevToolsPort,
  closeCdpSilently,
  waitForLoadEvent,
  waitForExpression,
  createMockOpenAiCompatibleProvider,
  verifyEmbeddedScriptSyntax,
  installFetchRecorderOnNewDocument,
  openModelConfigWizard,
  fillAndQuickApply,
  clickAction,
  readInitialState,
  readWizardState,
  readSuccessState,
  readReadyState,
};
