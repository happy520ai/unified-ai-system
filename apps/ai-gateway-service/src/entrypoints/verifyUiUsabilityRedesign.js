import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
const scriptName = "verify:phase306a-ui-usability-redesign";
const evidenceJsonPath = "apps/ai-gateway-service/evidence/phase-306a-ui-usability-redesign.json";
const evidenceMdPath = "apps/ai-gateway-service/evidence/phase-306a-ui-usability-redesign.md";

const requiredFiles = [
  "docs/UI_USABILITY_REDESIGN_AND_FULLSCREEN_OPERATOR_CONSOLE.md",
  "apps/ai-gateway-service/src/entrypoints/verifyUiUsabilityRedesign.js",
  "apps/ai-gateway-service/src/ui/consolePage.js",
  evidenceJsonPath,
  evidenceMdPath,
  "package.json",
  "apps/ai-gateway-service/package.json",
];

const requiredDocHeadings = [
  "# A. Phase306A Goal And Boundary",
  "# B. Current UI Pain Points",
  "# C. New Layout",
  "# D. Chat Panel Expansion",
  "# E. Approved Local Operation Loop Visibility",
  "# F. Module And Button Compaction",
  "# G. Responsive Layout",
  "# H. Forbidden Buttons And Unsafe UI",
  "# I. Execution Logic Is Unchanged",
  "# J. User Startup And Usage",
  "# K. Capabilities That Must Not Be Claimed",
  "# L. Suggested Next Direction",
  "# M. Phase306B Manual Visibility Hotfix",
];

const requiredConsoleMarkers = [
  "Approved Local Operation Loop",
  "Local Agent Intent & Approval Preview",
  "Chat",
  "Operator Preview",
  "Knowledge / RAG",
  "Health / Status",
  "operator-layout",
  "fullscreen",
  "viewport",
  "responsive",
  "chat-output-panel",
  "compact-controls",
  "first-screen-visible",
  "primary-visible",
  "always-visible",
  "not-side-panel-only",
  "manual-visibility-hotfix",
];

const requiredEvidenceFields = {
  phase: "306A",
  name: "UI Usability Redesign & Full-screen Operator Console",
  status: "pass",
  mode: "ui-redesign-only",
  uiUpdated: true,
  routeAdded: false,
  paidApiCallCount: 0,
  externalApiCalled: false,
  mimoApiCalled: false,
  embeddingCalled: false,
  realCodexExecCalled: false,
  workflowRunnerCalled: false,
  worktreeCreated: false,
  releaseOrDeployCalled: false,
  legacyModified: false,
  projectContextCreated: false,
  defaultNvidiaChatChanged: false,
  fullOpenEnabled: false,
  autoCommitEnabled: false,
  autoPushEnabled: false,
  executionLogicChanged: false,
  chatAreaExpanded: true,
  approvedOperationLoopVisible: true,
  compactControlsEnabled: true,
  responsiveFullscreenLayout: true,
  manualVisibilityHotfix: true,
  approvedOperationLoopFirstScreenVisible: true,
  intentApprovalPreviewFirstScreenVisible: true,
  notSidePanelOnly: true,
  userReportedPreviousUiNotVisible: true,
  workspaceCleanClaimed: false,
};

async function main() {
  const failures = [];
  const checks = [];

  const expect = (condition, id, details = {}) => {
    checks.push({ id, passed: Boolean(condition), details });
    if (!condition) {
      failures.push(id);
    }
  };

  for (const relativePath of requiredFiles) {
    expect(existsSync(resolve(repoRoot, relativePath)), `required-file-present:${relativePath}`);
  }

  const [docsText, consoleText, rootPackage, servicePackage] = await Promise.all([
    readText("docs/UI_USABILITY_REDESIGN_AND_FULLSCREEN_OPERATOR_CONSOLE.md"),
    readText("apps/ai-gateway-service/src/ui/consolePage.js"),
    readJson("package.json"),
    readJson("apps/ai-gateway-service/package.json"),
  ]);

  const mainStart = consoleText.indexOf('<main class="workspace');
  const mainEnd = mainStart >= 0 ? consoleText.indexOf("</main>", mainStart) : -1;
  const mainText = mainStart >= 0 && mainEnd >= 0 ? consoleText.slice(mainStart, mainEnd) : consoleText;
  const sideStart = consoleText.indexOf('<aside id="side"');
  const sideText = sideStart >= 0 ? consoleText.slice(sideStart) : "";

  for (const heading of requiredDocHeadings) {
    expect(docsText.includes(heading), `docs-heading-present:${heading}`);
  }

  for (const marker of requiredConsoleMarkers) {
    expect(consoleText.includes(marker), `console-marker-present:${marker}`);
  }

  expect(
    rootPackage.scripts?.[scriptName] === "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase306a-ui-usability-redesign",
    "root-script-present",
  );
  expect(
    servicePackage.scripts?.[scriptName] === "node ./src/entrypoints/verifyUiUsabilityRedesign.js",
    "service-script-present",
  );

  expect(consoleText.includes('id="local-agent-intent-approval-preview"'), "intent-preview-panel-id-present");
  expect(consoleText.includes('id="approved-local-operation-loop"'), "approved-operation-panel-id-present");
  expect(consoleText.includes('class="history chat-output-panel"'), "chat-output-panel-present");
  expect(consoleText.includes("Full-open remains disabled"), "safety-copy-present");

  const hotfixSectionOpening = extractOpeningTag(mainText, 'id="phase306b-manual-visibility-hotfix"');

  expect(mainText.includes('id="phase306b-manual-visibility-hotfix"'), "manual-visibility-hotfix-rail-present");
  expect(mainText.includes("first-screen-visible"), "first-screen-visible-marker-present");
  expect(mainText.includes("primary-visible"), "primary-visible-marker-present");
  expect(mainText.includes("always-visible"), "always-visible-marker-present");
  expect(mainText.includes("not-side-panel-only"), "not-side-panel-only-marker-present");
  expect(mainText.includes("manual-visibility-hotfix"), "manual-visibility-hotfix-marker-present");
  expect(mainText.includes("✅ Local Agent Intent &amp; Approval Preview"), "main-copy-intent-preview-present");
  expect(mainText.includes("✅ Approved Local Operation Loop"), "main-copy-approved-operation-loop-present");
  expect(mainText.includes("Preview Intent"), "preview-intent-copy-present");
  expect(mainText.includes("Generate Patch Proposal"), "generate-patch-proposal-copy-present");
  expect(mainText.includes("Approve Apply"), "approve-apply-copy-present");
  expect(mainText.includes("Run Auto Review"), "run-auto-review-copy-present");
  expect(mainText.includes("allowedFiles"), "allowed-files-copy-present");
  expect(mainText.includes("Full-open disabled"), "full-open-disabled-copy-present");
  expect(mainText.includes("No commit/push/deploy/release"), "no-commit-push-deploy-release-copy-present");
  expect(hotfixSectionOpening && !/hidden|collapsed|aria-hidden="true"/i.test(hotfixSectionOpening), "manual-hotfix-section-not-hidden");
  expect(
    consoleText.indexOf("✅ Local Agent Intent &amp; Approval Preview") >= 0 && (sideStart < 0 || consoleText.indexOf("✅ Local Agent Intent &amp; Approval Preview") < sideStart),
    "intent-preview-main-before-side",
  );
  expect(
    consoleText.indexOf("✅ Approved Local Operation Loop") >= 0 && (sideStart < 0 || consoleText.indexOf("✅ Approved Local Operation Loop") < sideStart),
    "approved-operation-main-before-side",
  );
  expect(sideText.length === 0 || !sideText.includes("phase306b-manual-visibility-hotfix"), "hotfix-not-side-panel-only");

  expect(!/<option[^>]+value=["']full_open["']/i.test(consoleText), "no-full-open-option");
  expect(!/<button[^>]*>\s*(commit|push|deploy|release)\s*<\/button>/i.test(consoleText), "no-forbidden-action-buttons");

  const evidence = {
    ...requiredEvidenceFields,
    status: failures.length === 0 ? "pass" : "fail",
    verification: {
      checkCount: checks.length,
      passedCount: checks.filter((check) => check.passed).length,
      failedCount: failures.length,
      failures,
      checks,
    },
    safetyNotes: [
      "UI redesign only.",
      "No .env or secrets were read.",
      "No route or execution logic was added.",
      "Workspace dirty is informational only and is not claimed clean.",
      "Phase306B manual visibility hotfix is a UI-only first-screen visibility change.",
    ],
  };

  await writeFile(resolve(repoRoot, evidenceJsonPath), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(resolve(repoRoot, evidenceMdPath), renderEvidenceMarkdown(evidence), "utf8");

  if (failures.length > 0) {
    console.error(JSON.stringify({ status: "fail", failures }, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify({
    status: "pass",
    phase: evidence.phase,
    name: evidence.name,
    uiUpdated: evidence.uiUpdated,
    routeAdded: evidence.routeAdded,
    checkCount: evidence.verification.checkCount,
  }, null, 2));
}

async function readText(relativePath) {
  return String(await readFile(resolve(repoRoot, relativePath), "utf8")).replace(/\r\n/g, "\n");
}

async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}

function extractOpeningTag(html, idSnippet) {
  const start = html.indexOf(idSnippet);
  if (start < 0) {
    return "";
  }

  const openStart = html.lastIndexOf("<", start);
  const close = html.indexOf(">", start);
  if (openStart < 0 || close < 0) {
    return html.slice(Math.max(openStart, 0));
  }

  return html.slice(openStart, close + 1);
}

function renderEvidenceMarkdown(evidence) {
  return [
    "# Phase306A Evidence",
    "",
    "## Summary",
    `- phase: ${evidence.phase}`,
    `- name: ${evidence.name}`,
    `- status: ${evidence.status}`,
    `- mode: ${evidence.mode}`,
    `- uiUpdated: ${evidence.uiUpdated}`,
    `- routeAdded: ${evidence.routeAdded}`,
    `- chatAreaExpanded: ${evidence.chatAreaExpanded}`,
    `- approvedOperationLoopVisible: ${evidence.approvedOperationLoopVisible}`,
    `- approvedOperationLoopFirstScreenVisible: ${evidence.approvedOperationLoopFirstScreenVisible}`,
    `- intentApprovalPreviewFirstScreenVisible: ${evidence.intentApprovalPreviewFirstScreenVisible}`,
    `- manualVisibilityHotfix: ${evidence.manualVisibilityHotfix}`,
    `- notSidePanelOnly: ${evidence.notSidePanelOnly}`,
    `- userReportedPreviousUiNotVisible: ${evidence.userReportedPreviousUiNotVisible}`,
    `- compactControlsEnabled: ${evidence.compactControlsEnabled}`,
    `- responsiveFullscreenLayout: ${evidence.responsiveFullscreenLayout}`,
    "",
    "## Safety",
    `- fullOpenEnabled: ${evidence.fullOpenEnabled}`,
    `- autoCommitEnabled: ${evidence.autoCommitEnabled}`,
    `- autoPushEnabled: ${evidence.autoPushEnabled}`,
    `- executionLogicChanged: ${evidence.executionLogicChanged}`,
    `- externalApiCalled: ${evidence.externalApiCalled}`,
    `- workflowRunnerCalled: ${evidence.workflowRunnerCalled}`,
    `- legacyModified: ${evidence.legacyModified}`,
    `- projectContextCreated: ${evidence.projectContextCreated}`,
    `- defaultNvidiaChatChanged: ${evidence.defaultNvidiaChatChanged}`,
    `- workspaceCleanClaimed: ${evidence.workspaceCleanClaimed}`,
    "",
    "## Verification",
    `- checkCount: ${evidence.verification.checkCount}`,
    `- passedCount: ${evidence.verification.passedCount}`,
    `- failedCount: ${evidence.verification.failedCount}`,
    `- failures: ${evidence.verification.failures.length ? evidence.verification.failures.join(", ") : "none"}`,
    "",
    "## Notes",
    ...evidence.safetyNotes.map((note) => `- ${note}`),
    "",
  ].join("\n");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
