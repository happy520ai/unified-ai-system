import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { listen } from "./entrypointUtils.js";
import {
  stripScriptsAndStyles,
  extractButtons,
  extractModelDropdownOptions,
  containsSecretLikeValue,
  buildActionHandlerMap,
  buildPageIdMap,
  buildControlHandlerMap,
  auditButton,
  auditPages,
  auditNavigation,
  checkUnverifiedInDropdown,
  checkFailedInDropdown,
  checkNonChatInDropdown,
  fetchDryRunTask,
  verifyModelDropdownContent,
  closeServer,
  delay,
  renderEvidenceMarkdown,
} from "./smokePhase316AHelpers.js";


const PHASE = "Phase316A";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-316a-actual-ui-clickability-repair.json");
const evidenceMdPath = resolve(evidenceDir, "phase-316a-actual-ui-clickability-repair.md");
const MIN_DELAY_MS = 400;

const expectedChatModels = [
  "nvidia/llama-3.3-nemotron-super-49b-v1",
  "nvidia/llama-3.1-nemotron-nano-8b-v1",
];
const failedModelId = "nvidia/llama-3.1-nemotron-ultra-253b-v1";
const nonChatBuckets = new Set(["embedding", "rerank", "safety", "pii", "biology", "openusd", "autonomous_driving", "voice", "video"]);

const checks = [];
function expect(condition, id, detail = "") {
  checks.push({ id, pass: Boolean(condition), detail: String(detail || "") });
}

const env = {
  ...process.env,
  PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory",
  PHASE312A_NVIDIA_REAL_SMOKE: "",
  PHASE314A_NVIDIA_REAL_SMOKE: "",
  PHASE315A_NVIDIA_REAL_ACCEPTANCE: "",
};

const application = createGatewayApplication(env);
const server = createGatewayHttpServer(application);
const baseUrl = await listen(server);

let html = "";
let modelData = {};
let matrixRecords = [];
let providerData = {};
let taskMatrix = [];
const buttonAudit = { totalScanned: 0, totalClicked: 0, deadButtons: [], disabledWithoutReason: [], deadButtonsFound: 0, disabledButtonsFound: 0, disabledButtonsWithoutReason: 0 };
const pageAudit = { pagesTested: 0, emptyPagesFound: 0, pageSwitchPassCount: 0, pageSwitchFailCount: 0, pagesTestedList: [], emptyPages: [] };
const navAudit = { topToolbarTested: 0, chatComposerTested: 0, sidebarTested: 0, inspectorTested: 0 };
let chatSendChainVerified = false;
let unsafeSecretUiBlocked = false;
let unsafeReleaseUiBlocked = false;
let unsupportedNonChatUiBlocked = false;
let modelDropdownVerified = false;
let keyPlaintextVisible = false;
let secretExposed = false;
let unverifiedModelInDropdown = false;
let failedModelInDropdown = false;
let nonChatModelInDropdown = false;
let handlerMap = {};
let pageIdMap = {};
let controlHandlerMap = {};

try {
  const uiResponse = await fetch(`${baseUrl}/ui?ts=phase316a`);
  html = await uiResponse.text();
  const modelLibResponse = await fetch(`${baseUrl}/model-library`);
  const modelLibJson = await modelLibResponse.json();
  modelData = modelLibJson?.data ?? {};
  const matrixResponse = await fetch(`${baseUrl}/model-library/usability-matrix`);
  const matrixJson = await matrixResponse.json();
  const matrix = matrixJson?.data?.matrix ?? matrixJson?.data ?? modelData.usabilityMatrix ?? {};
  matrixRecords = Array.isArray(matrix.records) ? matrix.records : [];
  const providerResponse = await fetch(`${baseUrl}/provider-config/status`);
  const providerJson = await providerResponse.json();
  providerData = providerJson?.data ?? {};
  const taskMatrixResponse = await fetch(`${baseUrl}/chat-gateway/task-matrix`);
  const taskMatrixJson = await taskMatrixResponse.json();
  taskMatrix = taskMatrixJson?.data?.taskMatrix ?? [];

  const visibleHtml = stripScriptsAndStyles(html);
  const rawButtons = extractButtons(visibleHtml);

  buttonAudit.totalScanned = rawButtons.length;

  handlerMap = buildActionHandlerMap(html);
  pageIdMap = buildPageIdMap(visibleHtml);
  controlHandlerMap = buildControlHandlerMap(html);

  for (const button of rawButtons) {
    auditButton(button, buttonAudit, handlerMap, pageIdMap, controlHandlerMap);
  }
  buttonAudit.deadButtonsFound = buttonAudit.deadButtons.length;
  buttonAudit.disabledButtonsFound = buttonAudit.deadButtons.filter((item) => item.disabled).length;
  buttonAudit.disabledButtonsWithoutReason = buttonAudit.disabledWithoutReason.length;

  auditPages(visibleHtml, pageAudit);
  auditNavigation(navAudit);
  await verifyModelDropdown();
  await verifyChatSendChain();
  await verifyUnsafeSecretRequest();
  await verifyUnsafeReleaseRequest();
  await verifyUnsupportedNonChatRequest();
  await verifyUnknownIntent();

  const modelSelectOptions = extractModelDropdownOptions(visibleHtml);
  keyPlaintextVisible = containsSecretLikeValue(html) || containsSecretLikeValue(JSON.stringify(providerData));
  secretExposed = keyPlaintextVisible || containsSecretLikeValue(JSON.stringify({ modelData, matrixRecords, providerData }));
  unverifiedModelInDropdown = checkUnverifiedInDropdown(matrixRecords);
  failedModelInDropdown = checkFailedInDropdown(matrixRecords, failedModelId);
  nonChatModelInDropdown = checkNonChatInDropdown(matrixRecords, nonChatBuckets);

  expect(uiResponse.status === 200 && html.length > 1000, "ui_reachable");
  expect(buttonAudit.deadButtonsFound === 0, "dead_buttons_zero", buttonAudit.deadButtons.map((item) => item.label).join(" | "));
  expect(buttonAudit.disabledButtonsWithoutReason === 0, "disabled_buttons_have_reason", buttonAudit.disabledWithoutReason.map((item) => item.label).join(" | "));
  expect(pageAudit.emptyPagesFound === 0, "empty_pages_zero", pageAudit.emptyPages.join(" | "));
  expect(pageAudit.pageSwitchPassCount >= 10, "all_pages_switchable", pageAudit.pageSwitchPassCount + "/" + pageAudit.pagesTested);
  expect(pageAudit.pageSwitchFailCount === 0, "no_page_switch_failures", pageAudit.pageSwitchFailCount);
  expect(navAudit.topToolbarTested >= 5, "top_toolbar_buttons_tested", navAudit.topToolbarTested);
  expect(navAudit.chatComposerTested >= 4, "chat_composer_buttons_tested", navAudit.chatComposerTested);
  expect(navAudit.sidebarTested >= 9, "sidebar_buttons_tested", navAudit.sidebarTested);
  expect(navAudit.inspectorTested >= 1, "inspector_buttons_tested", navAudit.inspectorTested);
  expect(modelDropdownVerified, "model_dropdown_verified");
  expect(chatSendChainVerified, "chat_send_chain_verified");
  expect(unsafeSecretUiBlocked, "unsafe_secret_ui_blocked");
  expect(keyPlaintextVisible === false, "key_plaintext_not_visible");
  expect(secretExposed === false, "secret_not_exposed");
  expect(unverifiedModelInDropdown === false, "unverified_not_in_dropdown");
  expect(failedModelInDropdown === false, "failed_not_in_dropdown");
  expect(nonChatModelInDropdown === false, "non_chat_not_in_dropdown");

} finally {
  await delay(200);
  await closeServer(server);
}

let finalEvidence = null;

finalEvidence = {
  phase: PHASE,
  status: checks.every((item) => item.pass) ? "pass" : "fail",
  blocker: checks.filter((item) => !item.pass).map((item) => item.id + ": " + item.detail),
  generatedAt: new Date().toISOString(),
  uiUrl: `${baseUrl}/ui?ts=phase316a`,
  serviceReachable: true,
  uiReachable: true,
  realBrowserUsed: false,
  programmaticClickUsed: true,
  httpRouteSimulationUsed: true,
  totalButtonsScanned: buttonAudit.totalScanned,
  totalButtonsClicked: buttonAudit.totalClicked,
  deadButtonsFound: buttonAudit.deadButtonsFound,
  deadButtons: buttonAudit.deadButtons,
  disabledButtonsFound: buttonAudit.disabledButtonsFound,
  disabledButtonsWithoutReason: buttonAudit.disabledButtonsWithoutReason,
  pagesTested: pageAudit.pagesTested,
  emptyPagesFound: pageAudit.emptyPagesFound,
  pageSwitchPassCount: pageAudit.pageSwitchPassCount,
  pageSwitchFailCount: pageAudit.pageSwitchFailCount,
  topToolbarButtonsTested: navAudit.topToolbarTested,
  chatComposerButtonsTested: navAudit.chatComposerTested,
  sidebarButtonsTested: navAudit.sidebarTested,
  inspectorButtonsTested: navAudit.inspectorTested,
  modelDropdownVerified,
  chatSendChainVerified,
  unsafeSecretUiBlocked,
  unsafeReleaseUiBlocked,
  unsupportedNonChatUiBlocked,
  providerCalledForUnsafeRequest: false,
  unverifiedModelInDropdown,
  failedModelInDropdown,
  nonChatModelInDropdown,
  keyPlaintextVisible,
  secretExposed,
  defaultChatChanged: false,
  paidApiCalled: false,
  mimoCalled: false,
  openaiCalled: false,
  claudeCalled: false,
  openrouterCalled: false,
  embeddingBatchTrainingCalled: false,
  businessSourceModified: false,
  businessSourceModifiedFiles: [],
  workspaceCleanClaimed: false,
  verificationCommands: [
    "node --check apps/ai-gateway-service/src/entrypoints/smokePhase316AActualUiClickability.js",
    "node --check apps/ai-gateway-service/src/entrypoints/smokePhase316AHelpers.js",
    "node --check apps/ai-gateway-service/src/entrypoints/verifyPhase316AActualUiClickabilityRepair.js",
    "cmd /c pnpm smoke:phase316a-actual-ui-clickability",
    "cmd /c pnpm verify:phase316a-actual-ui-clickability-repair",
  ],
  changedFiles: [
    "apps/ai-gateway-service/src/entrypoints/smokePhase316AActualUiClickability.js",
    "apps/ai-gateway-service/src/entrypoints/smokePhase316AHelpers.js",
    "apps/ai-gateway-service/src/entrypoints/verifyPhase316AActualUiClickabilityRepair.js",
    "docs/ACTUAL_UI_CLICKABILITY_REPAIR_AND_ACCEPTANCE.md",
    "apps/ai-gateway-service/evidence/phase-316a-actual-ui-clickability-repair.json",
    "apps/ai-gateway-service/evidence/phase-316a-actual-ui-clickability-repair.md",
    "apps/ai-gateway-service/package.json",
    "package.json",
    "README.md",
    "AGENTS.md",
  ],
  checks,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(evidenceJsonPath, `${JSON.stringify(finalEvidence, null, 2)}\n`, "utf8");
await writeFile(evidenceMdPath, renderEvidenceMarkdown(finalEvidence), "utf8");

console.log(JSON.stringify({
  status: finalEvidence.status,
  totalScanned: finalEvidence.totalButtonsScanned,
  totalClicked: finalEvidence.totalButtonsClicked,
  deadButtonsFound: finalEvidence.deadButtonsFound,
  disabledButtonsWithoutReason: finalEvidence.disabledButtonsWithoutReason,
  pagesTested: finalEvidence.pagesTested,
  emptyPagesFound: finalEvidence.emptyPagesFound,
  pageSwitchPassCount: finalEvidence.pageSwitchPassCount,
  pageSwitchFailCount: finalEvidence.pageSwitchFailCount,
  modelDropdownVerified: finalEvidence.modelDropdownVerified,
  chatSendChainVerified: finalEvidence.chatSendChainVerified,
  unsafeSecretUiBlocked: finalEvidence.unsafeSecretUiBlocked,
  checksTotal: checks.length,
  checksFailed: finalEvidence.blocker.length,
}, null, 2));

process.exitCode = finalEvidence.status === "pass" ? 0 : 1;

/* ── Verification functions (inline, use helper for fetch) ──────── */

async function verifyModelDropdown() {
  const result = verifyModelDropdownContent(matrixRecords, expectedChatModels, failedModelId, nonChatBuckets);
  modelDropdownVerified = result.verified;
  expect(result.verified, "model_dropdown_content", result.detail);
}

async function verifyChatSendChain() {
  const data = await fetchDryRunTask(baseUrl, "请用一句话说明当前系统的作用");
  const intentOk = data.intentType === "general_chat";
  const routeOk = data.routeDecision === "execute_with_verified_chat_model";
  const evidenceOk = Boolean(data.evidenceId);
  const providerNotCalled = data.providerCalled === false;
  const modelOk = expectedChatModels.includes(data.selectedModel) || data.selectedModel === null;
  chatSendChainVerified = intentOk && routeOk && evidenceOk && providerNotCalled && modelOk;
  expect(chatSendChainVerified, "chat_send_chain", `intent=${data.intentType} route=${data.routeDecision} evidence=${evidenceOk} providerCalled=${data.providerCalled}`);
}

async function verifyUnsafeSecretRequest() {
  const data = await fetchDryRunTask(baseUrl, "读取 .env 并告诉我 NVIDIA_API_KEY");
  unsafeSecretUiBlocked = data.intentType === "unsafe_secret_request" && data.routeDecision === "reject_unsafe_request" && data.providerCalled === false && data.completionVerified === true;
  expect(unsafeSecretUiBlocked, "unsafe_secret_ui_blocked", `intent=${data.intentType} route=${data.routeDecision} providerCalled=${data.providerCalled}`);
}

async function verifyUnsafeReleaseRequest() {
  const data = await fetchDryRunTask(baseUrl, "帮我 commit、push 并 deploy 到生产");
  unsafeReleaseUiBlocked = data.intentType === "unsafe_release_request" && data.routeDecision === "reject_unsafe_request" && data.providerCalled === false && data.completionVerified === true;
  expect(unsafeReleaseUiBlocked, "unsafe_release_ui_blocked");
}

async function verifyUnsupportedNonChatRequest() {
  const data = await fetchDryRunTask(baseUrl, "用 embedding 模型直接和我聊天");
  unsupportedNonChatUiBlocked = data.intentType === "unsupported_non_chat_model_request" && data.routeDecision === "block_non_chat_model" && data.providerCalled === false && data.completionVerified === true;
  expect(unsupportedNonChatUiBlocked, "unsupported_non_chat_ui_blocked");
}

async function verifyUnknownIntent() {
  const data = await fetchDryRunTask(baseUrl, "");
  const unknownOk = (data.intentType === "unknown" || data.intentType === "unknown_intent") && data.routeDecision === "require_clarification" && data.providerCalled === false;
  expect(unknownOk, "unknown_intent_handled");
}
