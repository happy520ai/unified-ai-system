import { existsSync, readdirSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { sleep } from "./entrypointUtils.js";

const testApiKey = "phase89-persistable-api-key-not-for-evidence";
const chatModelId = "phase89-persisted-chat-model";
const selectedPreviewValue = `openai-compatible::${chatModelId}`;
const expectedRuntimeValue = `generic-openai-compatible::${chatModelId}`;

export async function configureModel(cdp, mockProviderBaseUrl) {
  await openModelConfigWizard(cdp);
  await waitForExpression(cdp, `Boolean(document.querySelector("[data-command-wizard='model-config-v2']"))`, 20_000);
  await fillAndDetectModel(cdp, mockProviderBaseUrl);
  await waitForExpression(cdp, `document.querySelector("[data-command-provider-select]")?.value === ${JSON.stringify(selectedPreviewValue)}`, 20_000);
  await waitForExpression(cdp, `Boolean(document.querySelector("[data-command-feedback] [data-command-action='apply-detected-model']"))`, 20_000);
  await clickAction(cdp, "apply-detected-model");
  await waitForExpression(cdp, `document.getElementById("composer-model-status")?.dataset.modelProbeStatus === "passed"`, 25_000);
  await clickAction(cdp, "persist-detected-model");
  await clickAction(cdp, "continue-chat-after-model-check");
}

async function openModelConfigWizard(cdp) {
  await cdp.evaluate(`(() => {
    const button = document.getElementById("composer-model-config-button");
    if (!button) throw new Error("composer model config button missing");
    button.click();
    return true;
  })()`);
}

async function fillAndDetectModel(cdp, mockProviderBaseUrl) {
  await cdp.evaluate(`(() => {
    const secret = document.querySelector("[data-command-secret-draft]");
    const hint = document.querySelector("[data-command-provider-hint]");
    const baseUrl = document.querySelector("[data-command-base-url]");
    const detect = document.querySelector("[data-command-action='detect-provider-from-key']");
    secret.value = ${JSON.stringify(testApiKey)};
    secret.dispatchEvent(new Event("input", { bubbles: true }));
    hint.value = "openai-compatible";
    hint.dispatchEvent(new Event("change", { bubbles: true }));
    baseUrl.value = ${JSON.stringify(mockProviderBaseUrl)};
    baseUrl.dispatchEvent(new Event("input", { bubbles: true }));
    detect.click();
    return true;
  })()`);
}

async function clickAction(cdp, action) {
  const selector = `[data-command-feedback] [data-command-action="${action}"]`;
  await cdp.evaluate(`(() => {
    const button = document.querySelector(${JSON.stringify(selector)});
    if (!button) throw new Error("Missing action button: " + ${JSON.stringify(action)});
    button.click();
    return true;
  })()`);
}

export async function sendChat(cdp, prompt) {
  await cdp.evaluate(`(() => {
    window.__phase89Fetches = [];
    const input = document.getElementById("chat-input");
    const form = document.getElementById("chat-form");
    input.value = ${JSON.stringify(prompt)};
    input.dispatchEvent(new Event("input", { bubbles: true }));
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    return true;
  })()`);
}

export async function waitForChatResult(cdp, expectedMarker) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const state = await readState(cdp, expectedMarker);
    if ((state.assistantAnswerIncludesExpectedMarker && state.composerIdle) || state.assistantErrorText) {
      return state;
    }
    await sleep(150);
  }
  throw new Error(`Timed out waiting for configured-model chat answer: ${expectedMarker}`);
}

async function readState(cdp, expectedMarker) {
  return cdp.evaluate(`(() => {
    const fetches = window.__phase89Fetches || [];
    const assistantMessages = Array.from(document.querySelectorAll(".message.assistant"));
    const latestAssistant = assistantMessages[assistantMessages.length - 1];
    const latestAssistantText = latestAssistant?.querySelector(".message-text")?.textContent || latestAssistant?.textContent || "";
    const latestAssistantStatus = latestAssistant?.querySelector("[data-message-status]")?.textContent || latestAssistant?.textContent || "";
    const preference = JSON.parse(localStorage.getItem("pme-moving-earth-provider-preference-v1") || "{}");
    const pageText = document.body.textContent || "";
    const localStorageDump = Object.keys(localStorage).map((key) => key + ":" + localStorage.getItem(key)).join("\\n");
    const input = document.getElementById("chat-input");
    const stopButton = document.getElementById("stop-chat-button");
    const form = document.getElementById("chat-form");
    const modelStatus = document.getElementById("composer-model-status");
    const modelGuide = document.getElementById("composer-model-guide");
    const modelProbe = document.getElementById("composer-model-probe");
    const modelPreference = document.getElementById("composer-model-preference");
    return {
      providerSelectValue: document.getElementById("provider-select")?.value || "",
      composerModelReady: modelStatus?.dataset.modelReady || "",
      composerModelProviderId: modelStatus?.dataset.modelProviderId || "",
      composerModelId: modelStatus?.dataset.modelId || "",
      composerModelRestoredFromLocal: modelStatus?.dataset.modelRestoredFromLocal || "",
      composerModelCredentialStorage: modelStatus?.dataset.modelCredentialStorage || "",
      composerModelGuideText: modelGuide?.textContent || "",
      composerModelProbeText: modelProbe?.textContent || "",
      composerModelPreferenceText: modelPreference?.textContent || "",
      preferenceValue: preference.value || "",
      focusReturnedToChatInput: document.activeElement?.id === "chat-input",
      inputClearedAfterSend: (input?.value || "") === "",
      composerIdle: stopButton?.disabled === true && !form?.classList?.contains("is-sending"),
      latestAssistantText,
      latestAssistantStatus,
      assistantAnswerIncludesExpectedMarker: latestAssistantText.includes(${JSON.stringify(expectedMarker)}),
      assistantStatusDone: latestAssistantText.includes(${JSON.stringify(expectedMarker)}),
      assistantErrorText: latestAssistant?.classList?.contains("error") ? latestAssistantText : "",
      localStorageContainsSecret: localStorageDump.includes(${JSON.stringify(testApiKey)}),
      pageTextContainsSecret: pageText.includes(${JSON.stringify(testApiKey)}),
      chatStreamFetch: fetches.find((item) => item.path === "/chat/stream") || null,
      fetches,
    };
  })()`);
}

export async function navigateAndWait(cdp, url) {
  await cdp.send("Page.navigate", { url });
  await waitForLoadEvent(cdp);
  await waitForExpression(cdp, "document.getElementById('provider-select') !== null", 15_000);
}

export async function installFetchRecorderOnNewDocument(cdp) {
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      (() => {
        window.__phase89Fetches = [];
        const originalFetch = window.fetch.bind(window);
        window.fetch = async (...args) => {
          const path = String(args[0] || "");
          const options = args[1] || {};
          const item = { path };
          try {
            const parsed = JSON.parse(options.body || "{}");
            if (path === "/models/import/preview") {
              item.providerHint = parsed.providerHint || "";
              item.baseUrl = parsed.baseUrl || "";
              item.hasApiKey = Boolean(parsed.apiKey);
              item.apiKeyRedacted = parsed.apiKey ? "***" : "";
            } else if (path === "/models/import/confirm") {
              item.providerId = parsed.providerId || "";
              item.modelId = parsed.modelId || "";
              item.hasApiKeyRef = Boolean(parsed.apiKeyRef);
            } else if (path === "/chat" || path === "/chat/stream" || path === "/chat/rag" || path === "/chat/rag/stream") {
              item.providerId = parsed.providerId || "";
              item.model = parsed.model || "";
              item.prompt = parsed.prompt || "";
              item.knowledgeRequested = Boolean(parsed.knowledge);
            }
          } catch {
            item.bodyParseFailed = true;
          }
          window.__phase89Fetches.push(item);
          return originalFetch(...args);
        };
      })();
    `,
  });
}

export async function readPersistedStoreSummary(path) {
  const parsed = JSON.parse(await readFile(path, "utf8"));
  const records = Array.isArray(parsed?.records) ? parsed.records : [];
  return {
    version: parsed?.version ?? null,
    recordCount: records.length,
    providers: records.map((record) => String(record.providerId || "")),
    endpointConfigured: records.map((record) => Boolean(record.endpoint)),
    modelIds: records.flatMap((record) => Array.isArray(record.models) ? record.models.map((model) => String(model.id || model.modelId || "")) : []),
    apiKeyPresent: records.map((record) => Boolean(record.apiKey)),
  };
}

export async function inspectPng(pngPath) {
  const stats = await stat(pngPath);
  const buffer = await readFile(pngPath);
  const validPng = buffer.length >= 24 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  return { bytes: stats.size, width: validPng ? buffer.readUInt32BE(16) : 0, height: validPng ? buffer.readUInt32BE(20) : 0, validPng };
}

export function findVersionedBrowserPaths(root, executableName) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(root, entry.name, executableName))
    .reverse();
}

export async function readDevToolsPort(profileDir) {
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

export async function createCdpPage(port, url) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  if (!response.ok) throw new Error(`Unable to create CDP page: HTTP ${response.status}`);
  return response.json();
}

export async function connectCdp(webSocketUrl) {
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

export async function closeCdpSilently(cdp) {
  try {
    await cdp?.close();
  } catch {
    // Best-effort cleanup only.
  }
}

export async function waitForLoadEvent(cdp) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (cdp.takeEvent("Page.loadEventFired")) return;
    await sleep(100);
  }
  throw new Error("Timed out waiting for page load.");
}

export async function waitForExpression(cdp, expression, timeoutMs = 15_000) {
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

export async function terminateBrowser(targetProcess) {
  if (!targetProcess || targetProcess.killed) return;
  const exited = new Promise((resolveExit) => targetProcess.once("exit", () => resolveExit(true)));
  targetProcess.kill();
  await Promise.race([exited, sleep(2000)]);
}
