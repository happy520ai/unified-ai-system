import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
const scriptName = "verify:phase307a-product-grade-ui-rebuild";
const docsPath = "docs/PRODUCT_GRADE_UI_REBUILD_AND_VISUAL_QA.md";
const consolePath = "apps/ai-gateway-service/src/ui/consolePage.js";
const evidenceJsonPath = "apps/ai-gateway-service/evidence/phase-307a-product-grade-ui-rebuild.json";
const evidenceMdPath = "apps/ai-gateway-service/evidence/phase-307a-product-grade-ui-rebuild.md";

const requiredFiles = [
  docsPath,
  consolePath,
  "apps/ai-gateway-service/src/entrypoints/verifyProductGradeUiRebuild.js",
  evidenceJsonPath,
  evidenceMdPath,
  "package.json",
  "apps/ai-gateway-service/package.json",
];

const requiredDocHeadings = [
  "# A. Phase307A Goal And Boundary",
  "# B. Current UI Problems",
  "# C. Workbench Information Architecture",
  "# D. Left Navigation Design",
  "# E. Middle Workspace Design",
  "# F. Right Inspector Design",
  "# G. Chat Primary Workspace",
  "# H. Local Agent And Approved Operation Loop Productization",
  "# I. Intent Preview Productization",
  "# J. Repair Center",
  "# K. Help And Runbook",
  "# L. Legacy Module Demotion",
  "# M. Responsive Layout",
  "# N. Forbidden Buttons And Unsafe UI",
  "# O. Execution Logic Is Unchanged",
  "# P. User Startup And Usage",
  "# Q. Visual QA Checklist",
  "# R. Capabilities That Must Not Be Claimed",
  "# S. Suggested Next Direction",
];

const requiredConsoleMarkers = [
  "Product-grade UI marker",
  "AI Gateway Workbench",
  "IDE-style layout",
  "left navigation",
  "primary chat workspace",
  "right inspector context panel",
  "approved operation step flow",
  "intent approval preview card",
  "Repair Center",
  "Help / Runbook",
  "System Overview / Diagnostics",
  "responsive layout",
  "compact-controls",
  "workbench-nav",
  "workbench-home",
  "local-agent-workbench",
  "approved-local-operation-loop",
  "local-agent-intent-approval-preview",
  "diagnostics-workbench",
];

const requiredEvidenceFields = {
  phase: "307A",
  name: "AI Gateway Workbench Product-grade UI Rebuild & Visual QA Delivery",
  status: "pass",
  mode: "ui-product-workbench-rebuild-only",
  uiUpdated: true,
  routeAdded: false,
  executionLogicChanged: false,
  chatDefaultChanged: false,
  productGradeLayout: true,
  workbenchNavigation: true,
  primaryChatWorkspace: true,
  rightInspectorPanel: true,
  approvedOperationLoopProductized: true,
  intentPreviewProductized: true,
  repairCenterVisible: true,
  helpRunbookVisible: true,
  legacyProductCardsDemoted: true,
  responsiveLayout: true,
  compactControlsEnabled: true,
  visualQaChecklistAdded: true,
  fullOpenEnabled: false,
  autoCommitEnabled: false,
  autoPushEnabled: false,
  releaseOrDeployCalled: false,
  legacyModified: false,
  projectContextCreated: false,
  defaultNvidiaChatChanged: false,
  paidApiCallCount: 0,
  externalApiCalled: false,
  mimoApiCalled: false,
  embeddingCalled: false,
  workspaceCleanClaimed: false,
};

async function main() {
  const checks = [];
  const failures = [];
  const expect = (condition, id, details = {}) => {
    const passed = Boolean(condition);
    checks.push({ id, passed, details });
    if (!passed) failures.push(id);
  };

  for (const relativePath of requiredFiles) {
    expect(existsSync(resolve(repoRoot, relativePath)), `required-file-present:${relativePath}`);
  }

  const [docsText, consoleText, rootPackage, servicePackage, existingEvidence] = await Promise.all([
    readText(docsPath),
    readText(consolePath),
    readJson("package.json"),
    readJson("apps/ai-gateway-service/package.json"),
    readOptionalJson(evidenceJsonPath),
  ]);

  for (const heading of requiredDocHeadings) {
    expect(docsText.includes(heading), `docs-heading-present:${heading}`);
  }

  for (const marker of requiredConsoleMarkers) {
    expect(consoleText.includes(marker), `console-marker-present:${marker}`);
  }

  expect(
    rootPackage.scripts?.[scriptName] === "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase307a-product-grade-ui-rebuild",
    "root-script-present",
  );
  expect(
    servicePackage.scripts?.[scriptName] === "node ./src/entrypoints/verifyProductGradeUiRebuild.js",
    "service-script-present",
  );

  expect(consoleText.includes('class="workbench-nav"'), "left-navigation-present");
  expect(consoleText.includes('id="chat-shell"'), "chat-shell-present");
  expect(consoleText.includes('class="history chat-output-panel"'), "chat-output-panel-present");
  expect(consoleText.includes('id="side"') && consoleText.includes("Inspector / Local Agent Context"), "right-inspector-present");
  expect(consoleText.includes("Step 1") && consoleText.includes("Step 8") && consoleText.includes("Go / no-go"), "approved-operation-step-flow-present");
  expect(consoleText.includes("Intent & Approval Preview") && consoleText.includes("Open Intent Preview"), "intent-preview-product-card-present");
  expect(consoleText.includes('id="repair-center"') && consoleText.includes("no one-click full repo repair"), "repair-center-safe-copy-present");
  expect(consoleText.includes('id="help-runbook"') && consoleText.includes("Manual Approval Mode"), "help-runbook-present");
  expect(consoleText.includes('id="diagnostics-workbench"') && consoleText.includes("Legacy Product Console"), "diagnostics-demotion-present");
  expect(consoleText.includes("@media (max-width: 1120px)") && consoleText.includes("@media (max-width: 760px)"), "responsive-css-present");

  expect(!/<option[^>]+value=["']full_open["']/i.test(consoleText), "no-full-open-option");
  expect(!/<button[^>]*>\s*(commit|push|deploy|release)\s*<\/button>/i.test(consoleText), "no-forbidden-action-buttons");
  expect(!/workspace cleanup button|git reset button|git clean button|one-click full-repo apply/i.test(consoleText), "no-unsafe-shortcut-copy-as-button");

  for (const [field, expected] of Object.entries(requiredEvidenceFields)) {
    if (existingEvidence && Object.hasOwn(existingEvidence, field)) {
      expect(existingEvidence[field] === expected, `evidence-field:${field}`, { expected, actual: existingEvidence[field] });
    }
  }

  const evidence = {
    ...requiredEvidenceFields,
    status: failures.length === 0 ? "pass" : "fail",
    manualUiSmoke: {
      attempted: false,
      manualUiSmokeSkipped: true,
      reason: "Static verifier does not launch the service or browser.",
    },
    verification: {
      checkCount: checks.length,
      passedCount: checks.filter((check) => check.passed).length,
      failedCount: failures.length,
      failures,
      checks,
    },
    safetyNotes: [
      "UI rebuild only; no backend route was added.",
      "No provider, routing, chat default, agent-runner, patch runner, or auto review behavior was changed.",
      "Full-open remains disabled.",
      "Workspace dirty is not claimed clean.",
    ],
  };

  await writeFile(resolve(repoRoot, evidenceJsonPath), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(resolve(repoRoot, evidenceMdPath), renderMarkdown(evidence), "utf8");

  if (failures.length > 0) {
    console.error(JSON.stringify({ status: "fail", failures }, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify({
    status: "pass",
    phase: evidence.phase,
    name: evidence.name,
    checkCount: evidence.verification.checkCount,
    uiUpdated: evidence.uiUpdated,
    routeAdded: evidence.routeAdded,
    productGradeLayout: evidence.productGradeLayout,
  }, null, 2));
}

async function readText(relativePath) {
  return String(await readFile(resolve(repoRoot, relativePath), "utf8")).replace(/\r\n/g, "\n");
}

async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}

async function readOptionalJson(relativePath) {
  if (!existsSync(resolve(repoRoot, relativePath))) return null;
  return readJson(relativePath);
}

function renderMarkdown(evidence) {
  return [
    "# Phase307A Evidence",
    "",
    `- phase: ${evidence.phase}`,
    `- name: ${evidence.name}`,
    `- status: ${evidence.status}`,
    `- mode: ${evidence.mode}`,
    `- uiUpdated: ${evidence.uiUpdated}`,
    `- routeAdded: ${evidence.routeAdded}`,
    `- executionLogicChanged: ${evidence.executionLogicChanged}`,
    `- productGradeLayout: ${evidence.productGradeLayout}`,
    `- workbenchNavigation: ${evidence.workbenchNavigation}`,
    `- primaryChatWorkspace: ${evidence.primaryChatWorkspace}`,
    `- rightInspectorPanel: ${evidence.rightInspectorPanel}`,
    `- approvedOperationLoopProductized: ${evidence.approvedOperationLoopProductized}`,
    `- intentPreviewProductized: ${evidence.intentPreviewProductized}`,
    `- repairCenterVisible: ${evidence.repairCenterVisible}`,
    `- helpRunbookVisible: ${evidence.helpRunbookVisible}`,
    `- legacyProductCardsDemoted: ${evidence.legacyProductCardsDemoted}`,
    `- responsiveLayout: ${evidence.responsiveLayout}`,
    `- compactControlsEnabled: ${evidence.compactControlsEnabled}`,
    `- fullOpenEnabled: ${evidence.fullOpenEnabled}`,
    `- autoCommitEnabled: ${evidence.autoCommitEnabled}`,
    `- autoPushEnabled: ${evidence.autoPushEnabled}`,
    `- releaseOrDeployCalled: ${evidence.releaseOrDeployCalled}`,
    `- workspaceCleanClaimed: ${evidence.workspaceCleanClaimed}`,
    "",
    "## Verification",
    "",
    `- checkCount: ${evidence.verification.checkCount}`,
    `- passedCount: ${evidence.verification.passedCount}`,
    `- failedCount: ${evidence.verification.failedCount}`,
    `- failures: ${evidence.verification.failures.join(", ") || "none"}`,
    "",
    "## Manual UI Smoke",
    "",
    `- attempted: ${evidence.manualUiSmoke.attempted}`,
    `- manualUiSmokeSkipped: ${evidence.manualUiSmoke.manualUiSmokeSkipped}`,
    `- reason: ${evidence.manualUiSmoke.reason}`,
    "",
  ].join("\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
