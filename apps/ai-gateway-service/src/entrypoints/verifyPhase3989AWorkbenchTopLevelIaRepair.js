import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PHASE = "Phase3989A";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-3989a-workbench-top-level-ia-repair.json");
const evidenceMdPath = resolve(evidenceDir, "phase-3989a-workbench-top-level-ia-repair.md");
const docsPath = resolve(repoRoot, "docs/phase3989a-workbench-top-level-ia-repair.md");

const checks = [];
function expect(condition, id, detail = "") {
  checks.push({ id, pass: Boolean(condition), detail: String(detail || "") });
}

const evidence = readJson(evidenceJsonPath) ?? {};
const consolePage = readText("apps/ai-gateway-service/src/ui/consolePage.js");
const rootPackage = readText("package.json");
const servicePackage = readText("apps/ai-gateway-service/package.json");
const docs = existsSync(docsPath) ? readFileSync(docsPath, "utf8") : "";

expect(evidence.phase === PHASE, "phase_marker", evidence.phase);
expect(evidence.status === "pass", "smoke_status_pass", evidence.status);
expect(evidence.topNavStillFiveOnly === true, "top_nav_still_five_only");
expect(evidence.standalonePages?.localAgent === true, "local_agent_page_present");
expect(evidence.standalonePages?.repair === true, "repair_page_present");
expect(evidence.standalonePages?.help === true, "help_page_present");
expect(evidence.internalOpenButtons?.localAgent === true, "local_agent_open_button_present");
expect(evidence.internalOpenButtons?.repair === true, "repair_open_button_present");
expect(evidence.internalOpenButtons?.help === true, "help_open_button_present");
expect(evidence.localAgentWidgetsPresent === true, "local_agent_widgets_present");
expect(evidence.repairWidgetsPresent === true, "repair_widgets_present");
expect(evidence.helpWidgetsPresent === true, "help_widgets_present");
expect(evidence.localAgentIntentPreview?.providerCalled === false, "intent_preview_provider_not_called");
expect(evidence.localAgentOperationPlan?.providerCalled === false, "operation_plan_provider_not_called");
expect(evidence.localAgentPatchProposal?.providerCalled === false, "patch_proposal_provider_not_called");
expect(evidence.localAgentApprovalCreate?.providerCalled === false, "approval_create_provider_not_called");
expect(evidence.defaultChatChanged === false, "default_chat_unchanged");
expect(evidence.providerRuntimeModified === false, "provider_runtime_unchanged");
expect(evidence.chatGatewayExecuteModified === false, "chat_gateway_execute_unchanged");
expect(evidence.secretExposed === false, "secret_not_exposed");
expect(evidence.workspaceCleanClaimed === false, "workspace_clean_not_claimed");

expect(consolePage.includes('data-page="local-agent"'), "source_local_agent_page");
expect(consolePage.includes('data-page="repair"'), "source_repair_page");
expect(consolePage.includes('data-page="help"'), "source_help_page");
expect(!consolePage.includes('data-nav="local-agent"'), "source_no_local_agent_nav");
expect(!consolePage.includes('data-nav="repair"'), "source_no_repair_nav");
expect(!consolePage.includes('data-nav="help"'), "source_no_help_nav");
expect(consolePage.includes('data-open-page="local-agent"'), "source_local_agent_open_button");
expect(consolePage.includes('data-open-page="repair"'), "source_repair_open_button");
expect(consolePage.includes('data-open-page="help"'), "source_help_open_button");
expect(consolePage.includes('id="local-agent-task-input"'), "source_local_agent_task_input");
expect(consolePage.includes('id="local-agent-preview-button"'), "source_local_agent_preview_button");
expect(consolePage.includes('id="local-agent-plan-button"'), "source_local_agent_plan_button");
expect(consolePage.includes('id="local-agent-patch-button"'), "source_local_agent_patch_button");
expect(consolePage.includes('id="local-agent-create-approval-button"'), "source_local_agent_create_approval_button");
expect(consolePage.includes('id="repair-open-local-agent-button"'), "source_repair_open_local_agent_button");
expect(consolePage.includes('id="help-runbook-panel"'), "source_help_runbook_panel");
expect(consolePage.includes("/local-agent/intent-preview"), "source_intent_preview_route_present");
expect(consolePage.includes("/local-agent/operation-plan"), "source_operation_plan_route_present");
expect(consolePage.includes("/local-agent/patch-proposal"), "source_patch_proposal_route_present");
expect(consolePage.includes("/approvals/create"), "source_approval_create_route_present");
expect(consolePage.includes('/chat-gateway/execute'), "source_default_chat_route_still_present");

expect(rootPackage.includes("smoke:phase3989a-workbench-top-level-ia-repair"), "root_smoke_script");
expect(rootPackage.includes("verify:phase3989a-workbench-top-level-ia-repair"), "root_verify_script");
expect(servicePackage.includes("smoke:phase3989a-workbench-top-level-ia-repair"), "service_smoke_script");
expect(servicePackage.includes("verify:phase3989a-workbench-top-level-ia-repair"), "service_verify_script");
expect(docs.includes(PHASE), "docs_phase3989a_present");
expect(docs.includes("local-agent"), "docs_mentions_local_agent");
expect(docs.includes("repair"), "docs_mentions_repair");
expect(docs.includes("help"), "docs_mentions_help");
expect(docs.includes("/chat-gateway/execute"), "docs_mentions_chat_boundary");
expect(!containsSecretLikeValue(JSON.stringify(evidence)), "evidence_no_secret");

const failedChecks = checks.filter((item) => !item.pass);
const finalEvidence = {
  ...evidence,
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
  checksFailed: failedChecks.length,
}, null, 2));

if (failedChecks.length > 0) {
  process.exitCode = 1;
}

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function readText(relativePath) {
  const absolute = resolve(repoRoot, relativePath);
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : "";
}

function containsSecretLikeValue(source) {
  return /\b(?:nvapi[-_][A-Za-z0-9._-]{8,}|sk-proj[-_][A-Za-z0-9._-]{8,}|sk[-_][A-Za-z0-9._-]{8,}|pk[-_][A-Za-z0-9._-]{8,}|ak[-_][A-Za-z0-9._-]{8,})\b/i.test(String(source ?? ""));
}

function renderEvidenceMarkdown(data) {
  return [
    "# Phase3989A Workbench Top-Level IA Repair Verification",
    "",
    `- smokeStatus: ${data.status}`,
    `- verifierStatus: ${data.verifierStatus}`,
    `- blocker: ${data.verifierBlocker ? data.verifierBlocker.join("; ") : "none"}`,
    `- topNavStillFiveOnly: ${data.topNavStillFiveOnly}`,
    `- localAgentPage: ${data.standalonePages?.localAgent ?? false}`,
    `- repairPage: ${data.standalonePages?.repair ?? false}`,
    `- helpPage: ${data.standalonePages?.help ?? false}`,
    `- defaultChatChanged: ${data.defaultChatChanged}`,
    `- workspaceCleanClaimed: ${data.workspaceCleanClaimed}`,
    "",
  ].join("\n");
}
