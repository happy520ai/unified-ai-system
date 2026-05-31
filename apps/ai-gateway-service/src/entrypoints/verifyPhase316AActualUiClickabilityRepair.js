import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PHASE = "Phase316A";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-316a-actual-ui-clickability-repair.json");
const evidenceMdPath = resolve(evidenceDir, "phase-316a-actual-ui-clickability-repair.md");
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
  "apps/ai-gateway-service/src/entrypoints/smokePhase316AActualUiClickability.js",
  "apps/ai-gateway-service/src/entrypoints/verifyPhase316AActualUiClickabilityRepair.js",
  "docs/ACTUAL_UI_CLICKABILITY_REPAIR_AND_ACCEPTANCE.md",
  "apps/ai-gateway-service/evidence/phase-316a-actual-ui-clickability-repair.json",
  "apps/ai-gateway-service/evidence/phase-316a-actual-ui-clickability-repair.md",
]) {
  expect(existsSync(resolve(repoRoot, requiredFile)), `file_exists_${requiredFile}`);
}

const rootPackage = readText("package.json");
const servicePackage = readText("apps/ai-gateway-service/package.json");
expect(rootPackage.includes("smoke:phase316a-actual-ui-clickability"), "root_script_smoke_316a");
expect(servicePackage.includes("smoke:phase316a-actual-ui-clickability"), "service_script_smoke_316a");
expect(rootPackage.includes("verify:phase316a-actual-ui-clickability-repair"), "root_script_verify_316a");
expect(servicePackage.includes("verify:phase316a-actual-ui-clickability-repair"), "service_script_verify_316a");

const docs = readText("docs/ACTUAL_UI_CLICKABILITY_REPAIR_AND_ACCEPTANCE.md");
expect(docs.includes("Phase316A"), "docs_phase316a");
expect(docs.includes("clickability"), "docs_clickability");
expect(docs.includes("programmatic click"), "docs_programmatic");
expect(docs.includes("dead"), "docs_dead_buttons");
expect(docs.includes("workspace dirty"), "docs_workspace_dirty");

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

function containsSecretLikeValue(source) {
  return /\b(?:nvapi[-_][A-Za-z0-9._-]{8,}|sk-proj[-_][A-Za-z0-9._-]{8,}|sk[-_][A-Za-z0-9._-]{8,}|pk[-_][A-Za-z0-9._-]{8,}|ak[-_][A-Za-z0-9._-]{8,})\b/i.test(String(source ?? ""));
}

function renderEvidenceMarkdown(data) {
  return `# Phase316A Actual UI Clickability Repair & Acceptance — Verification

- Phase: ${data.phase}
- Verifier status: ${data.verifierStatus}
- Smoke status: ${data.status}
- Blocker: ${JSON.stringify(data.verifierBlocker)}
- Dead buttons found: ${data.deadButtonsFound}
- Empty pages: ${data.emptyPagesFound}
- Disabled without reason: ${data.disabledButtonsWithoutReason}
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
