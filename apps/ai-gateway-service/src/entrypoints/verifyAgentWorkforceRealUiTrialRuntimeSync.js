import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson } from "./entrypointUtils.js"

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const evidenceDir = join(rootDir, "apps", "ai-gateway-service", "evidence");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}


function requireEvidenceFile(relativePath) {
  const absolutePath = join(rootDir, relativePath);
  assert(existsSync(absolutePath), `Missing evidence file: ${relativePath}`);
}

const evidence = await readJson("apps/ai-gateway-service/evidence/phase-199a-real-ui-trial-runtime-sync.json");
const manualTrial = await readJson("apps/ai-gateway-service/evidence/manual-real-ui-trial-current.json");
const planResponse = await readJson("apps/ai-gateway-service/evidence/phase-199a-real-trial-runtime-sync-plan-response.json");
const uiSource = await readFile(join(rootDir, "apps", "ai-gateway-service", "src", "ui", "consolePage.js"), "utf8");

const plan = planResponse.json?.data || {};
const acceptance = evidence.acceptance || {};
const boundary = evidence.boundary || {};
const missingSignals = evidence.currentMissingSignals || {};

[
  "apps/ai-gateway-service/evidence/phase-199a-real-ui-trial-runtime-sync.md",
  "apps/ai-gateway-service/evidence/phase-199a-real-trial-runtime-sync-save-response.json",
  "apps/ai-gateway-service/evidence/phase-199a-real-trial-runtime-sync-history-response.json",
  "apps/ai-gateway-service/evidence/phase-199a-real-trial-runtime-sync-export-response.json",
  "apps/ai-gateway-service/evidence/phase-199a-real-trial-runtime-sync-export-json-response.json",
  "apps/ai-gateway-service/evidence/phase-199a-real-trial-runtime-sync-export-markdown-response.json",
  "apps/ai-gateway-service/evidence/phase-199a-real-trial-runtime-sync-browser-summary.json",
  "apps/ai-gateway-service/evidence/manual-real-ui-trial-current.md",
  "apps/ai-gateway-service/evidence/manual-real-ui-trial-current-before.png",
  "apps/ai-gateway-service/evidence/manual-real-ui-trial-current-after.png",
  "apps/ai-gateway-service/evidence/manual-real-ui-trial-current-snapshot.html",
].forEach(requireEvidenceFile);

assert(evidence.phase === "phase-199a-real-ui-trial-runtime-sync", "Phase marker mismatch.");
assert(evidence.status === "passed-browser-ui-trial", "Phase 199A real UI trial did not pass.");
assert(manualTrial.status === "passed-browser-ui-trial", "Current manual real UI trial evidence is not refreshed to passed-browser-ui-trial.");
assert(evidence.blockerTriage?.serviceRestarted === true, "Runtime sync did not record service restart.");
assert(evidence.blockerTriage?.codeFixRequired === false, "Phase 199A should not require a business-code fix.");
assert(evidence.blockerTriage?.businessCodeModified === false, "Phase 199A should not modify business code.");

assert(acceptance.visitedUi === true, "Browser trial did not visit /ui.");
assert(acceptance.openedAgentWorkforceArea === true, "Browser trial did not open the Agent Workforce area.");
assert(acceptance.generatedPlan === true, "Browser trial did not generate a plan.");
assert(acceptance.savedPlan === true, "Browser trial did not save the plan.");
assert(acceptance.readHistory === true, "Browser trial did not read history.");
assert(acceptance.exportedJson === true, "Browser trial did not export JSON.");
assert(acceptance.exportedMarkdown === true, "Browser trial did not export Markdown.");
assert(acceptance.executionDisabledShown === true, "Execution Disabled was not visible.");
assert(acceptance.externalRunnerDisabledShown === true, "External Runner Disabled was not visible.");
assert(acceptance.misleadingExecutionCopyFound === false, "Misleading execution UI copy was found.");

assert(Object.values(missingSignals).every((value) => value === false), "One or more required runtime baseline signals are still missing.");
assert(boundary.previewOnly === true, "Preview-only boundary is not recorded.");
assert(boundary.executionEnabled === false, "Execution must remain disabled.");
assert(boundary.runnerEnabled === false, "Runner must remain disabled.");
assert(boundary.workflowRunEnabled === false, "Workflow run must remain disabled.");
assert(boundary.approvalPreviewIsExecutionPermission === false, "approval-preview must not be execution permission.");
assert(boundary.ohMyCodexCalled === false, "oh-my-codex must not be called.");
assert(boundary.worktreeCreated === false, "Worktree must not be created.");
assert(boundary.nvidiaChatLaneChanged === false, "Default NVIDIA /chat lane must remain unchanged.");
assert(boundary.plaintextApiKeyWritten === false, "Evidence must not record plaintext API keys.");

assert(Array.isArray(plan.roleTiers) && plan.roleTiers.length > 0, "Plan response is missing roleTiers.");
assert(Boolean(plan.omxHandoffPreview), "Plan response is missing omxHandoffPreview.");
assert(Boolean(plan.executionReadinessPreflight), "Plan response is missing executionReadinessPreflight.");
assert(Boolean(plan.externalOmxRunnerDesign), "Plan response is missing externalOmxRunnerDesign.");
assert(Boolean(plan.runnerRequestQueuePreview), "Plan response is missing runnerRequestQueuePreview.");
assert(Boolean(plan.executionApprovalRecordPreview), "Plan response is missing executionApprovalRecordPreview.");
assert(Boolean(plan.externalRunnerProtocolFreeze), "Plan response is missing externalRunnerProtocolFreeze.");
assert(Boolean(plan.productTemplatesPreview || plan.selectedTemplate || plan.templateContext), "Plan response is missing template context.");

[
  "workforce-template",
  "Execution Disabled",
  "External Runner Disabled",
  "OMX Handoff Preview",
  "Role Tiers",
  "approval-preview is not execution approval",
  "No worktree creation",
].forEach((marker) => {
  assert(uiSource.includes(marker), `UI source is missing marker: ${marker}`);
});

const result = {
  phase: "phase-199a-real-ui-trial-runtime-sync",
  status: "passed",
  conclusion: "runtime-sync-complete-browser-ui-trial-passed",
  evidenceDir,
  planId: evidence.browserTrial?.planId,
  workforceId: evidence.browserTrial?.workforceId,
  boundary,
};

console.log(JSON.stringify(result, null, 2));
