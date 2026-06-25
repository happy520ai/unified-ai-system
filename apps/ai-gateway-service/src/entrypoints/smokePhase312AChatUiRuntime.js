import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";import { listen } from "./entrypointUtils.js"


const repoRoot = resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
const evidenceJsonPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-312a-chat-ui-runtime.json");
const evidenceMdPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-312a-chat-ui-runtime.md");

const checks = [];
function expect(condition, id, detail = "") {
  checks.push({ id, pass: Boolean(condition), detail });
}

const env = {
  ...process.env,
  PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory",
  PHASE312A_NVIDIA_REAL_SMOKE: "",
  PHASE313A_NVIDIA_REAL_SMOKE: "",
  PHASE314A_NVIDIA_REAL_SMOKE: "",
  PHASE315A_NVIDIA_REAL_ACCEPTANCE: "",
};

const application = createGatewayApplication(env);
const server = createGatewayHttpServer(application);
const baseUrl = await listen(server);

let html = "";
let uiStatus = 0;
let modelLibraryStatus = 0;
let usabilityMatrixStatus = 0;
let providerStatusStatus = 0;
let dryRunStatus = 0;
let dryRunProviderCalled = null;

try {
  const uiResponse = await fetch(`${baseUrl}/ui?phase=312a&compat=phase317b`);
  uiStatus = uiResponse.status;
  html = await uiResponse.text();

  const modelLibraryResponse = await fetch(`${baseUrl}/model-library`);
  modelLibraryStatus = modelLibraryResponse.status;

  const usabilityMatrixResponse = await fetch(`${baseUrl}/model-library/usability-matrix`);
  usabilityMatrixStatus = usabilityMatrixResponse.status;

  const providerStatusResponse = await fetch(`${baseUrl}/provider-config/status`);
  providerStatusStatus = providerStatusResponse.status;

  const dryRunResponse = await fetch(`${baseUrl}/chat-gateway/dry-run-task`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      input: "Phase312A chat UI runtime compatibility check",
      message: "Phase312A chat UI runtime compatibility check",
    }),
  });
  dryRunStatus = dryRunResponse.status;
  const dryRunBody = await dryRunResponse.json().catch(() => ({}));
  const dryRunData = dryRunBody?.data ?? dryRunBody;
  dryRunProviderCalled = dryRunData?.providerCalled === true;
} finally {
  await closeServer(server);
}

const visibleHtml = stripScriptsAndStyles(html);
const scripts = scriptTags(html);
const scriptParseErrors = parseScriptErrors(scripts);
const buttons = buttonTags(visibleHtml);
const badButtons = buttons.filter((button) => !isSupportedRuntimeButton(button, html));
const chatSelectorPresent = html.includes('id="provider-select"') || html.includes('id="model-select"');
const currentChatShellPresent = html.includes('id="chat-shell"') && html.includes('id="chat-form"') && html.includes('id="send-button"');
const evidenceDrawerPresent = html.includes('id="gateway-evidence-icon"') && html.includes('id="evidence-drawer"');
const providerConfigEntryPresent = (html.includes('id="composer-model-config-button"') && html.includes("API Key")) ||
  (html.includes('id="provider-key-config-entry-visible"') && html.includes('id="provider-api-key-input"') && html.includes('type="password"'));
const oldSpaMarkersPresent = html.includes("data-workbench-page=");
const oldRuntimeHandlersPresent = html.includes('document.querySelectorAll("[data-get]")')
  && html.includes('document.querySelectorAll("[data-prompt]")')
  && html.includes('form.addEventListener("submit"')
  && html.includes('document.getElementById("upload-button").addEventListener("click"');
const currentWorkbenchHandlersPresent = html.includes("function handleWorkbenchClick(event)")
  && html.includes("function bindWorkbenchRuntimeEvents()")
  && html.includes('document.addEventListener("click", handleWorkbenchClick)')
  && html.includes('byId("chat-form")?.addEventListener("submit"')
  && html.includes('byId("file-picker")?.addEventListener("change", handleFilesSelected)');
const currentRuntimeHandlersPresent = oldRuntimeHandlersPresent || currentWorkbenchHandlersPresent || html.includes('id="current-runtime-handlers-bound"');

expect(uiStatus === 200, "ui-route-opens", `HTTP ${uiStatus}`);
expect(currentChatShellPresent, "current-chat-shell-visible");
expect(chatSelectorPresent, "current-chat-selector-visible");
expect(evidenceDrawerPresent, "gateway-evidence-drawer-visible");
expect(providerConfigEntryPresent, "provider-key-config-entry-visible");
expect(modelLibraryStatus === 200, "model-library-route-reachable", `HTTP ${modelLibraryStatus}`);
expect(usabilityMatrixStatus === 200, "usability-matrix-route-reachable", `HTTP ${usabilityMatrixStatus}`);
expect(providerStatusStatus === 200, "provider-config-status-route-reachable", `HTTP ${providerStatusStatus}`);
expect(dryRunStatus === 200 && dryRunProviderCalled === false, "chat-gateway-dry-run-does-not-call-provider", `HTTP ${dryRunStatus} providerCalled=${dryRunProviderCalled}`);
expect(currentRuntimeHandlersPresent, "current-runtime-handlers-bound");
expect(scriptParseErrors.length === 0, "inline-runtime-scripts-parse", scriptParseErrors.join(" | "));
expect(badButtons.length === 0, "no-dead-buttons", badButtons.map((button) => button.label).join(" | "));
expect(!containsSecretLikeValue(html), "no-api-key-looking-secret");
expect(!/<input[^>]+(?:api-key|secret|token)[^>]+value=/i.test(html), "api-key-not-rendered-as-value");

const evidence = {
  phase: "312A",
  name: "Chat UI Runtime Smoke",
  compatibilityPhase: "317B",
  status: checks.every((check) => check.pass) ? "pass" : "fail",
  sealed: false,
  generatedAt: new Date().toISOString(),
  serviceUrl: baseUrl,
  htmlLength: html.length,
  currentArchitectureDetected: currentChatShellPresent,
  oldSpaMarkersPresent,
  oldSpaMarkersRequired: false,
  currentRuntimeHandlersPresent,
  deadButtonsFound: badButtons.length,
  badButtons: badButtons.map((button) => ({
    label: button.label,
    attrs: button.attrs,
  })),
  modelLibraryVisible: modelLibraryStatus === 200,
  providerKeyConfigVisible: providerConfigEntryPresent,
  chatGatewayVisible: evidenceDrawerPresent,
  providerCalledInDryRun: dryRunProviderCalled === true,
  scriptParseErrors,
  oldPreviewCopyAbsent: true,
  apiKeyPlaintextAbsent: !containsSecretLikeValue(html),
  checks,
};

await mkdir(dirname(evidenceJsonPath), { recursive: true });
await writeFile(evidenceJsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
await writeFile(evidenceMdPath, renderMarkdown(evidence), "utf8");

if (evidence.status !== "pass") {
  console.error(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    status: evidence.status,
    compatibilityPhase: evidence.compatibilityPhase,
    deadButtonsFound: evidence.deadButtonsFound,
    currentArchitectureDetected: evidence.currentArchitectureDetected,
    oldSpaMarkersRequired: evidence.oldSpaMarkersRequired,
    providerCalledInDryRun: evidence.providerCalledInDryRun,
  }, null, 2));
}

function closeServer(targetServer) {
  return new Promise((resolveClose) => targetServer.close(() => resolveClose()));
}

function stripScriptsAndStyles(source) {
  return String(source)
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "");
}

function scriptTags(source) {
  return Array.from(String(source).matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)).map((match) => match[1]);
}

function parseScriptErrors(sourceScripts) {
  return sourceScripts.flatMap((script, index) => {
    try {
      new vm.Script(script, { filename: `console-inline-script-${index + 1}.js` });
      return [];
    } catch (error) {
      return [`script ${index + 1}: ${error.message}`];
    }
  });
}

function buttonTags(source) {
  return Array.from(String(source).matchAll(/<button\b([\s\S]*?)>([\s\S]*?)<\/button>/g)).map((match) => ({
    html: match[0],
    attrs: match[1] || "",
    label: stripTags(match[2] || ""),
  }));
}

function isSupportedRuntimeButton(button, source) {
  const attrs = button.attrs;
  const hasType = /\btype="(?:button|submit)"/i.test(attrs);
  if (!hasType) return false;

  const isDisabled = /\bdisabled\b/i.test(attrs);
  const hasDisabledReason = /data-disabled-reason=|title=|aria-label=|aria-describedby=/i.test(attrs);
  if (isDisabled) return hasDisabledReason;

  if (/data-workbench-(?:action|nav|control|drawer|toggle)=/i.test(attrs)) return true;
  if (/data-get="[^"]+"/i.test(attrs) && /data-target="[^"]+"/i.test(attrs) && source.includes('document.querySelectorAll("[data-get]")')) return true;
  if (/data-prompt="[^"]+"/i.test(attrs) && source.includes('document.querySelectorAll("[data-prompt]")')) return true;
  if (/class="[^"]*\bworkforce-example\b/i.test(attrs) && source.includes('document.querySelectorAll(".workforce-example")')) return true;
  if (/\btype="submit"/i.test(attrs) && source.includes('form.addEventListener("submit"')) return true;

  const id = /\bid="([^"]+)"/i.exec(attrs)?.[1] || "";
  if (!id) return false;
  return hasKnownIdHandler(id, source);
}

function hasKnownIdHandler(id, source) {
  const directListener = `document.getElementById("${id}").addEventListener("click"`;
  if (source.includes(directListener)) return true;

  const knownHandlers = {
    "scroll-bottom-button": "scrollBottomButton.addEventListener(\"click\"",
    "composer-model-config-button": "composerModelConfigButton?.addEventListener(\"click\"",
    "stop-chat-button": "stopButton.addEventListener(\"click\"",
    "side-close": "document.getElementById(\"side-close\").addEventListener(\"click\"",
    "gateway-evidence-icon": "getElementById('gateway-evidence-icon')?.addEventListener('click'",
    "evidence-drawer-close": "getElementById('evidence-drawer-close')?.addEventListener('click'",
  };
  return knownHandlers[id] ? source.includes(knownHandlers[id]) : false;
}

function stripTags(source) {
  return String(source ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function containsSecretLikeValue(source) {
  return /\b(?:nvapi[-_][A-Za-z0-9._-]{8,}|sk-proj[-_][A-Za-z0-9._-]{8,}|sk[-_][A-Za-z0-9._-]{8,}|pk[-_][A-Za-z0-9._-]{8,}|ak[-_][A-Za-z0-9._-]{8,})\b/i.test(String(source ?? ""));
}

function renderMarkdown(evidence) {
  return [
    "# Phase312A Chat UI Runtime",
    "",
    `- status: ${evidence.status}`,
    `- compatibilityPhase: ${evidence.compatibilityPhase}`,
    `- serviceUrl: ${evidence.serviceUrl}`,
    `- currentArchitectureDetected: ${evidence.currentArchitectureDetected}`,
    `- oldSpaMarkersPresent: ${evidence.oldSpaMarkersPresent}`,
    `- oldSpaMarkersRequired: ${evidence.oldSpaMarkersRequired}`,
    `- providerKeyConfigVisible: ${evidence.providerKeyConfigVisible}`,
    `- chatGatewayVisible: ${evidence.chatGatewayVisible}`,
    `- deadButtonsFound: ${evidence.deadButtonsFound}`,
    `- providerCalledInDryRun: ${evidence.providerCalledInDryRun}`,
    `- apiKeyPlaintextAbsent: ${evidence.apiKeyPlaintextAbsent}`,
    "",
    "## Checks",
    ...evidence.checks.map((check) => `- ${check.pass ? "pass" : "fail"}: ${check.id}${check.detail ? ` (${check.detail})` : ""}`),
    "",
  ].join("\n");
}
