import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, readText } from "./entrypointUtils.js"

const PHASE = "Phase317A";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-317a-real-ui-runtime-repair.json");
const evidenceMdPath = resolve(evidenceDir, "phase-317a-real-ui-runtime-repair.md");
const sourceDir = resolve(repoRoot, "apps/ai-gateway-service/src");

const checks = [];
function expect(condition, id, detail = "") {
  checks.push({ id, pass: Boolean(condition), detail: String(detail || "") });
}

const evidence = readJson(evidenceJsonPath) ?? {};

expect(evidence.status === "pass", "smoke_status_pass", evidence.status);
expect(evidence.deadButtonsFound === 0, "dead_buttons_zero", evidence.deadButtonsFound);
expect(evidence.disabledButtonsWithoutReason === 0, "disabled_buttons_reason_zero", evidence.disabledButtonsWithoutReason);
expect(evidence.emptyPagesFound === 0, "empty_pages_zero", evidence.emptyPagesFound);
expect(evidence.pageSwitchPassCount >= 10, "pages_switchable", evidence.pageSwitchPassCount);
expect(evidence.pageSwitchFailCount <= 0, "no_page_switch_fail", evidence.pageSwitchFailCount);
expect(evidence.modelDropdownVerified === true, "model_dropdown_verified");
expect(evidence.chatSendChainVerified === true, "chat_send_chain_verified");
expect(evidence.workbenchMainServed === true, "workbench_main_served");
expect(evidence.phase317CMarkerPresent === true, "phase317c_marker_present");
expect(evidence.wrongPmeTemplateServed === false, "pme_template_not_served");
expect(evidence.runtimeMarkerPresent === true, "phase317_runtime_marker_present");
expect(evidence.unifiedClickHandlerPresent === true, "unified_click_handler_present");
expect(Array.isArray(evidence.inlineScriptParseErrors) && evidence.inlineScriptParseErrors.length === 0, "inline_script_parse_ok", JSON.stringify(evidence.inlineScriptParseErrors));
expect(evidence.evidencePanelDefaultCollapsed === true, "evidence_panel_default_collapsed");
expect(evidence.evidenceDrawerOpenVerified === true, "evidence_drawer_open_verified");
expect(evidence.evidenceDrawerCloseVerified === true, "evidence_drawer_close_verified");
expect(evidence.chatMainAreaFreed === true, "chat_main_area_freed");
expect(evidence.unsafeSecretUiBlocked === true, "unsafe_secret_ui_blocked");
expect(evidence.unsafeReleaseUiBlocked === true, "unsafe_release_ui_blocked");
expect(evidence.unsupportedNonChatUiBlocked === true, "unsupported_non_chat_ui_blocked");
expect(evidence.keyPlaintextVisible === false, "key_not_plaintext");
expect(evidence.secretExposed === false, "secret_not_exposed");
expect(evidence.defaultChatChanged !== true, "default_chat_unchanged");
expect(evidence.paidApiCalled !== true, "paid_api_not_called");
expect(evidence.mimoCalled !== true, "mimo_not_called");
expect(evidence.openaiCalled !== true, "openai_not_called");
expect(evidence.claudeCalled !== true, "claude_not_called");
expect(evidence.openrouterCalled !== true, "openrouter_not_called");
expect(evidence.embeddingBatchTrainingCalled !== true, "embedding_batch_not_called");
expect(evidence.unverifiedModelInDropdown === false, "unverified_not_in_dropdown");
expect(evidence.failedModelInDropdown === false, "failed_not_in_dropdown");
expect(evidence.nonChatModelInDropdown === false, "non_chat_not_in_dropdown");
expect(evidence.workspaceCleanClaimed === false, "workspace_clean_not_claimed");

for (const requiredFile of [
  "apps/ai-gateway-service/src/entrypoints/smokePhase317ARealUiRuntimeClick.js",
  "apps/ai-gateway-service/src/entrypoints/verifyPhase317ARealUiRepair.js",
  "docs/REAL_UI_BUTTON_RUNTIME_REPAIR_AND_EVIDENCE_DRAWER.md",
  "apps/ai-gateway-service/evidence/phase-317a-real-ui-runtime-repair.json",
  "apps/ai-gateway-service/evidence/phase-317a-real-ui-runtime-repair.md",
]) {
  expect(existsSync(resolve(repoRoot, requiredFile)), `file_exists_${requiredFile}`);
}

const rootPackage = readText("package.json");
const servicePackage = readText("apps/ai-gateway-service/package.json");
expect(rootPackage.includes("smoke:phase316a-actual-ui-clickability"), "root_script_smoke_316a");
expect(servicePackage.includes("smoke:phase316a-actual-ui-clickability"), "service_script_smoke_316a");
expect(rootPackage.includes("verify:phase316a-actual-ui-clickability-repair"), "root_script_verify_316a");
expect(servicePackage.includes("verify:phase316a-actual-ui-clickability-repair"), "service_script_verify_316a");
expect(rootPackage.includes("smoke:phase317a-real-ui-runtime-click"), "root_script_smoke_317a");
expect(servicePackage.includes("smoke:phase317a-real-ui-runtime-click"), "service_script_smoke_317a");
expect(rootPackage.includes("verify:phase317a-real-ui-repair"), "root_script_verify_317a");
expect(servicePackage.includes("verify:phase317a-real-ui-repair"), "service_script_verify_317a");

const docs = readText("docs/REAL_UI_BUTTON_RUNTIME_REPAIR_AND_EVIDENCE_DRAWER.md");
expect(docs.includes("Phase317A"), "docs_phase317a");
expect(docs.includes("Evidence Drawer"), "docs_evidence_drawer");
expect(docs.includes("manualRealBrowserVerificationRequired"), "docs_manual_browser_boundary");
expect(docs.includes("dead"), "docs_dead_buttons");
expect(docs.includes("workspace dirty"), "docs_workspace_dirty");

const consolePage = readText("apps/ai-gateway-service/src/ui/consolePage.js");
expect(consolePage.includes("return createPhase317CWorkbenchPage();"), "source_ui_returns_phase317c_workbench");
expect(consolePage.includes('data-phase="phase317c-workbench-main"'), "source_phase317c_marker");
expect(consolePage.includes("function handleWorkbenchClick(event)"), "source_handle_workbench_click");
expect(consolePage.includes("bindWorkbenchRuntimeEvents"), "source_bind_workbench_runtime_events");
expect(consolePage.includes('data-phase317-runtime-repair="true"'), "source_phase317_runtime_marker");
expect(consolePage.includes("composer-provider-status"), "source_compact_gateway_status");
expect(consolePage.includes("data-workbench-drawer=\"gateway-evidence\""), "source_evidence_drawer_action");

expect(!containsSecretLikeValue(JSON.stringify(evidence)), "evidence_no_secret");

const failedChecks = checks.filter((item) => !item.pass);
const finalEvidence = {
  ...evidence,
  phase: PHASE,
  verifiedAt: new Date().toISOString(),
  verifierStatus: failedChecks.length === 0 ? "pass" : "fail",
  verifierBlocker: failedChecks.length === 0 ? null : failedChecks.map((item) => `${item.id}: ${item.detail}`),
  verifierChecks: checks,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(evidenceJsonPath, `${JSON.stringify(finalEvidence, null, 2)}\n`, "utf8");
await writeFile(evidenceMdPath, renderEvidenceMarkdown(finalEvidence), "utf8");

console.log(JSON.stringify({
  status: finalEvidence.verifierStatus,
  blocker: finalEvidence.verifierBlocker,
  smokeStatus: finalEvidence.status,
  deadButtonsFound: finalEvidence.deadButtonsFound,
  emptyPagesFound: finalEvidence.emptyPagesFound,
  checksTotal: checks.length,
  checksFailed: failedChecks.length,
}, null, 2));

process.exitCode = finalEvidence.verifierStatus === "pass" ? 0 : 1;



function containsSecretLikeValue(source) {
  return /\b(?:nvapi[-_][A-Za-z0-9._-]{8,}|sk-proj[-_][A-Za-z0-9._-]{8,}|sk[-_][A-Za-z0-9._-]{8,}|pk[-_][A-Za-z0-9._-]{8,}|ak[-_][A-Za-z0-9._-]{8,})\b/i.test(String(source ?? ""));
}

function renderEvidenceMarkdown(data) {
  return `# Phase317A Real UI Runtime Repair — Verification

- Phase: ${data.phase}
- Verifier status: ${data.verifierStatus}
- Smoke status: ${data.status}
- Blocker: ${JSON.stringify(data.verifierBlocker)}
- Workbench main served: ${data.workbenchMainServed}
- Phase317C marker: ${data.phase317CMarkerPresent}
- PME template served: ${data.wrongPmeTemplateServed}
- Runtime marker: ${data.runtimeMarkerPresent}
- Unified click handler: ${data.unifiedClickHandlerPresent}
- Inline script parse errors: ${JSON.stringify(data.inlineScriptParseErrors)}
- Dead buttons found: ${data.deadButtonsFound}
- Empty pages: ${data.emptyPagesFound}
- Disabled without reason: ${data.disabledButtonsWithoutReason}
- Evidence drawer default collapsed: ${data.evidencePanelDefaultCollapsed}
- Evidence drawer open/close: ${data.evidenceDrawerOpenVerified} / ${data.evidenceDrawerCloseVerified}
- Chat main area freed: ${data.chatMainAreaFreed}
- Page switch pass/fail: ${data.pageSwitchPassCount} / ${data.pageSwitchFailCount}
- Model dropdown: ${data.modelDropdownVerified}
- Chat send chain: ${data.chatSendChainVerified}
- Unsafe secret blocked: ${data.unsafeSecretUiBlocked}
- Key plaintext: ${data.keyPlaintextVisible}
- Secret exposed: ${data.secretExposed}
- Default /chat changed: ${data.defaultChatChanged}
- Workspace clean claimed: ${data.workspaceCleanClaimed}
`;
}
