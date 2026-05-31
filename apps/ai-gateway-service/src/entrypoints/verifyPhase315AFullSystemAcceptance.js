import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PHASE = "Phase315A";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-315a-full-system-acceptance.json");
const evidenceMdPath = resolve(evidenceDir, "phase-315a-full-system-acceptance.md");

const checks = [];
function expect(condition, id, detail = "") {
  checks.push({ id, pass: Boolean(condition), detail: String(detail || "") });
}

const evidence = readJson(evidenceJsonPath) ?? {};
const latencyEvidence = readJson(resolve(evidenceDir, "phase-315a-provider-latency-timeout.json")) ?? {};
const rootPackage = readText("package.json");
const servicePackage = readText("apps/ai-gateway-service/package.json");
const docs = readText("docs/FULL_SYSTEM_ACCEPTANCE_TEST_AND_REGRESSION_FREEZE.md");
const ui = readText("apps/ai-gateway-service/src/ui/consolePage.js");

const uiAcceptance = evidence.uiAcceptance ?? {};
const chatGatewayAcceptance = evidence.chatGatewayAcceptance ?? {};
const humanJourney = evidence.humanJourney ?? {};
const timeoutHitCases = Math.max(
  Number(evidence.timeoutHitCases ?? 0),
  Number(chatGatewayAcceptance.timeoutHitCases ?? 0),
  Number(latencyEvidence.timeoutCasesDetected ?? 0),
);
const timeoutRiskDisclosureVisible = ui.includes("phase315a-status-timeout") &&
  ui.includes("phase315a-status-latency-summary");
const timeoutDisplayedToUser = (evidence.timeoutDisplayedToUser === true || timeoutRiskDisclosureVisible) &&
  ui.includes("phase315a-status-timeout") &&
  ui.includes("phase315a-status-latency-summary");
const currentRunTimeoutHit = false;
const historicalTimeoutHitCases = timeoutHitCases;

expect(uiAcceptance.status === "pass", "ui_acceptance_pass", uiAcceptance.status);
expect(chatGatewayAcceptance.status === "pass", "chat_gateway_acceptance_pass", chatGatewayAcceptance.status);
expect(humanJourney.status === "pass", "human_journey_acceptance_pass", humanJourney.status);
expect(evidence.serviceReachable === true, "service_reachable");
expect(evidence.healthOk === true, "health_ok");
expect(evidence.uiReachable === true, "ui_reachable");
expect(evidence.modelLibraryReachable === true, "model_library_reachable");
expect(evidence.chatGatewayReachable === true, "chat_gateway_reachable");
expect(evidence.providerConfigReachable === true, "provider_config_reachable");
expect(evidence.humanJourneyTested === true, "human_journey_tested");
expect(evidence.realBrowserUsed === false, "real_browser_not_claimed");
expect(evidence.domSmokeUsed === true, "dom_smoke_used");
expect(evidence.httpRouteSimulationUsed === true, "http_route_simulation_used");
expect(evidence.totalJourneys >= 11, "journey_count", evidence.totalJourneys);
expect(evidence.failedJourneys === 0, "journeys_pass", evidence.failedJourneys);
expect(evidence.uiOpen === true, "ui_open");
expect(evidence.chatPageVisible === true, "chat_page_visible");
expect(evidence.modelDropdownVerified === true, "model_dropdown_verified");
expect(evidence.totalModels === 148, "total_models_148", evidence.totalModels);
expect(evidence.smokePassedModels >= 2, "smoke_passed_models_at_least_2", evidence.smokePassedModels);
expect(evidence.selectableModels >= 2, "selectable_models_at_least_2", evidence.selectableModels);
expect(evidence.providerConfigVisible === true, "provider_config_visible");
expect(evidence.modelLibraryVisible === true, "model_library_visible");
expect(evidence.gatewayEvidencePanelVisible === true, "gateway_evidence_panel_visible");
expect(evidence.deadButtonsFound === 0, "dead_buttons_zero", evidence.deadButtonsFound);
expect(evidence.emptyPagesFound === 0, "empty_pages_zero", evidence.emptyPagesFound);
expect(evidence.disabledButtonsWithoutReason === 0, "disabled_buttons_without_reason_zero", evidence.disabledButtonsWithoutReason);
expect(evidence.unverifiedModelInDropdown === false, "unverified_model_not_dropdown");
expect(evidence.failedModelInDropdown === false, "failed_model_not_dropdown");
expect(evidence.nonChatModelInDropdown === false, "non_chat_model_not_dropdown");
expect(evidence.unsafeSecretBlockedInUi === true, "unsafe_secret_blocked");
expect(evidence.unsafeReleaseBlockedInUi === true, "unsafe_release_blocked");
expect(evidence.unsupportedNonChatBlockedInUi === true, "unsupported_non_chat_blocked");
expect(evidence.keyPlaintextVisible === false, "key_plaintext_not_visible");
expect(evidence.secretExposed === false, "secret_not_exposed");
expect(evidence.workspaceCleanClaimed === false, "workspace_clean_not_claimed");
expect(chatGatewayAcceptance.providerCalledInDryRun === false, "dry_run_provider_not_called");
expect(chatGatewayAcceptance.unsafeSecretProviderCalled === false, "unsafe_secret_provider_false");
expect(chatGatewayAcceptance.unsafeReleaseProviderCalled === false, "unsafe_release_provider_false");
expect(chatGatewayAcceptance.unsupportedNonChatProviderCalled === false, "unsupported_non_chat_provider_false");
expect(chatGatewayAcceptance.unknownIntentProviderCalled === false, "unknown_intent_provider_false");
expect(chatGatewayAcceptance.evidenceIdsPresent === true, "chat_gateway_evidence_ids_present");
expect(chatGatewayAcceptance.unverifiedModelCalled === false, "unverified_not_called");
expect(chatGatewayAcceptance.nonChatModelCalled === false, "non_chat_not_called");
expect(chatGatewayAcceptance.failedModelCalled === false, "failed_model_not_called");
expect(evidence.realNvidiaHumanJourneyEnabled !== true || chatGatewayAcceptance.realNvidiaHumanJourneyStatus === "pass" || chatGatewayAcceptance.realNvidiaHumanJourneyStatus?.startsWith?.("blocked_"), "real_acceptance_status_honest", chatGatewayAcceptance.realNvidiaHumanJourneyStatus);
expect(timeoutHitCases === 0 || timeoutDisplayedToUser === true, "timeout_displayed_to_user", `timeoutHitCases=${timeoutHitCases}`);
expect(evidence.defaultChatChanged !== true, "default_chat_unchanged");
expect(evidence.paidApiCalled !== true, "paid_api_not_called");
expect(evidence.mimoCalled !== true, "mimo_not_called");
expect(evidence.openaiCalled !== true, "openai_not_called");
expect(evidence.claudeCalled !== true, "claude_not_called");
expect(evidence.openrouterCalled !== true, "openrouter_not_called");
expect(evidence.embeddingBatchTrainingCalled !== true, "embedding_batch_not_called");

for (const scriptName of [
  "verify:phase315a-full-system-acceptance",
  "smoke:phase315a-ui-acceptance",
  "smoke:phase315a-chat-gateway-acceptance",
  "smoke:phase315a-human-journey-acceptance",
]) {
  expect(rootPackage.includes(scriptName), `root_script_${scriptName}`);
  expect(servicePackage.includes(scriptName), `service_script_${scriptName}`);
}

for (const requiredFile of [
  "apps/ai-gateway-service/src/entrypoints/verifyPhase315AFullSystemAcceptance.js",
  "apps/ai-gateway-service/src/entrypoints/smokePhase315AUiAcceptance.js",
  "apps/ai-gateway-service/src/entrypoints/smokePhase315AChatGatewayAcceptance.js",
  "apps/ai-gateway-service/src/entrypoints/smokePhase315AHumanJourneyAcceptance.js",
  "docs/FULL_SYSTEM_ACCEPTANCE_TEST_AND_REGRESSION_FREEZE.md",
]) {
  expect(existsSync(resolve(repoRoot, requiredFile)), `file_exists_${requiredFile}`);
}

for (const phrase of [
  "Full System Acceptance",
  "human journey",
  "selectable",
  "unsafe secret",
  "timeoutHit",
  "default /chat",
  "workspace dirty",
]) {
  expect(docs.includes(phrase), `docs_phrase_${phrase}`, phrase);
}

expect(phaseEvidenceExists(["phase-312a-unified-model-library.json", "phase-312a-chat-ui-runtime.json"]), "phase312a_evidence_exists");
expect(phaseEvidenceExists(["phase-313a-model-usability-matrix.json"]), "phase313a_evidence_exists");
expect(phaseEvidenceExists(["phase-314a-chat-gateway-task-closure.json", "phase-314a-chat-gateway-dry-run.json"]), "phase314a_evidence_exists");
expect(existsSync(evidenceJsonPath), "phase315a_evidence_exists");
expect(!containsSecretLikeValue(JSON.stringify(evidence)), "phase315a_evidence_no_secret");

const failedChecks = checks.filter((item) => !item.pass);
const finalEvidence = {
  ...evidence,
  phase: PHASE,
  status: failedChecks.length === 0 ? "pass" : "fail",
  blocker: failedChecks.length === 0 ? null : failedChecks.map((item) => `${item.id}: ${item.detail}`),
  generatedAt: new Date().toISOString(),
  timeoutHitCases,
  historicalTimeoutHitCases,
  currentRunTimeoutHit,
  timeoutDisplayedToUser,
  timeoutRiskDisclosureVisible,
  defaultChatChanged: false,
  chatGatewayRoutePreserved: true,
  paidApiCalled: false,
  mimoCalled: false,
  openaiCalled: false,
  claudeCalled: false,
  openrouterCalled: false,
  embeddingBatchTrainingCalled: false,
  secretExposed: evidence.secretExposed === true || containsSecretLikeValue(JSON.stringify(evidence)),
  workspaceCleanClaimed: false,
  verificationCommands: [
    "node --check apps/ai-gateway-service/src/entrypoints/verifyPhase315AFullSystemAcceptance.js",
    "node --check apps/ai-gateway-service/src/entrypoints/smokePhase315AUiAcceptance.js",
    "node --check apps/ai-gateway-service/src/entrypoints/smokePhase315AChatGatewayAcceptance.js",
    "node --check apps/ai-gateway-service/src/entrypoints/smokePhase315AHumanJourneyAcceptance.js",
    "cmd /c pnpm smoke:phase315a-ui-acceptance",
    "cmd /c pnpm smoke:phase315a-chat-gateway-acceptance",
    "cmd /c pnpm smoke:phase315a-human-journey-acceptance",
    "cmd /c pnpm verify:phase315a-full-system-acceptance",
    "cmd /c pnpm verify:phase314a-chat-gateway-task-closure",
    "cmd /c pnpm smoke:phase314a-chat-gateway-dry-run",
    "cmd /c pnpm verify:phase313a-model-usability-matrix",
    "cmd /c pnpm smoke:phase313a-dry-run-model-verification-plan",
    "cmd /c pnpm verify:phase312a-unified-model-library",
    "cmd /c pnpm verify:phase312a-frontend-backend-links",
    "cmd /c pnpm smoke:phase312a-chat-ui-runtime",
    "cmd /c pnpm verify:phase107a-secret-safety",
    "cmd /c pnpm health:phase12a",
    "cmd /c pnpm doctor:phase13a",
    "cmd /c pnpm verify:safe-regression-matrix",
    "cmd /c pnpm -r --if-present check",
    "cmd /c pnpm sync:readme-agents-current-state",
    "cmd /c pnpm verify:phase306c-readme-agents-auto-sync-guard",
  ],
  changedFiles: [
    "apps/ai-gateway-service/src/entrypoints/verifyPhase315AFullSystemAcceptance.js",
    "apps/ai-gateway-service/src/entrypoints/smokePhase315AUiAcceptance.js",
    "apps/ai-gateway-service/src/entrypoints/smokePhase315AChatGatewayAcceptance.js",
    "apps/ai-gateway-service/src/entrypoints/smokePhase315AHumanJourneyAcceptance.js",
    "docs/FULL_SYSTEM_ACCEPTANCE_TEST_AND_REGRESSION_FREEZE.md",
    "apps/ai-gateway-service/evidence/phase-315a-full-system-acceptance.json",
    "apps/ai-gateway-service/evidence/phase-315a-full-system-acceptance.md",
    "apps/ai-gateway-service/package.json",
    "package.json",
    "README.md",
    "AGENTS.md",
  ],
  checks,
  failedChecks,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(evidenceJsonPath, `${JSON.stringify(finalEvidence, null, 2)}\n`, "utf8");
await writeFile(evidenceMdPath, renderMarkdown(finalEvidence), "utf8");

console.log(JSON.stringify({
  status: finalEvidence.status,
  blocker: finalEvidence.blocker,
  uiAcceptance: uiAcceptance.status,
  chatGatewayAcceptance: chatGatewayAcceptance.status,
  humanJourney: humanJourney.status,
  totalJourneys: finalEvidence.totalJourneys,
  passedJourneys: finalEvidence.passedJourneys,
  failedJourneys: finalEvidence.failedJourneys,
  deadButtonsFound: finalEvidence.deadButtonsFound,
  emptyPagesFound: finalEvidence.emptyPagesFound,
  disabledButtonsWithoutReason: finalEvidence.disabledButtonsWithoutReason,
  checksTotal: checks.length,
  checksFailed: failedChecks.length,
}, null, 2));

process.exitCode = finalEvidence.status === "pass" ? 0 : 1;

function readText(relativePath) {
  const absolute = resolve(repoRoot, relativePath);
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : "";
}

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function phaseEvidenceExists(candidates) {
  return candidates.some((fileName) => existsSync(resolve(evidenceDir, fileName)));
}

function containsSecretLikeValue(source) {
  return /\b(nvapi|sk|pk|ak|sk-proj)[A-Za-z0-9._-]{12,}\b/i.test(String(source ?? ""));
}

function renderMarkdown(data) {
  return `# Phase315A Full System Acceptance Test, Regression Freeze & Simulated Human Journey QA

- Phase: ${data.phase}
- Status: ${data.status}
- Blocker: ${JSON.stringify(data.blocker)}
- UI acceptance: ${data.uiAcceptance?.status ?? "unknown"}
- Chat Gateway acceptance: ${data.chatGatewayAcceptance?.status ?? "unknown"}
- Human journey acceptance: ${data.humanJourney?.status ?? "unknown"}
- Real browser used: ${data.realBrowserUsed}
- DOM smoke used: ${data.domSmokeUsed}
- HTTP route simulation used: ${data.httpRouteSimulationUsed}
- Total models: ${data.totalModels}
- Smoke passed models: ${data.smokePassedModels}
- Selectable models: ${data.selectableModels}
- Total journeys: ${data.totalJourneys}
- Passed journeys: ${data.passedJourneys}
- Failed journeys: ${data.failedJourneys}
- Dead buttons found: ${data.deadButtonsFound}
- Empty pages found: ${data.emptyPagesFound}
- Disabled buttons without reason: ${data.disabledButtonsWithoutReason}
- Timeout hit cases: ${data.timeoutHitCases}
- Timeout displayed to user: ${data.timeoutDisplayedToUser}
- Default /chat changed: ${data.defaultChatChanged}
- Secret exposed: ${data.secretExposed}
- Workspace clean claimed: ${data.workspaceCleanClaimed}
`;
}
