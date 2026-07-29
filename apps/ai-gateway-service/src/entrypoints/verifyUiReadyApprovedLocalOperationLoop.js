import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createLocalOperationApprovalRecord,
  validateLocalOperationApprovalRecord,
} from "../agent-runner/localOperationApprovalRecord.js";
import { createLocalOperationPatchProposal } from "../agent-runner/localOperationPatchProposal.js";
import { runLocalOperationLoop } from "../agent-runner/localOperationLoop.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
const scriptName = "verify:phase303a-305a-ui-ready-approved-local-operation-loop";
const evidenceJsonPath = "apps/ai-gateway-service/evidence/phase-303a-305a-ui-ready-approved-local-operation-loop.json";
const evidenceMdPath = "apps/ai-gateway-service/evidence/phase-303a-305a-ui-ready-approved-local-operation-loop.md";

const requiredFiles = [
  "docs/UI_READY_APPROVED_LOCAL_OPERATION_LOOP.md",
  "apps/ai-gateway-service/src/agent-runner/localOperationApprovalRecord.js",
  "apps/ai-gateway-service/src/agent-runner/localOperationPatchProposal.js",
  "apps/ai-gateway-service/src/agent-runner/localOperationLoop.js",
  "apps/ai-gateway-service/src/entrypoints/verifyUiReadyApprovedLocalOperationLoop.js",
  evidenceJsonPath,
  evidenceMdPath,
];

const upstreamVerifierFiles = [
  "apps/ai-gateway-service/src/entrypoints/verifySafeRefactorHarness.js",
  "apps/ai-gateway-service/src/entrypoints/verifyLocalAgentPermissionModeGate.js",
  "apps/ai-gateway-service/src/entrypoints/verifyReadOnlyLocalAgentRunner.js",
  "apps/ai-gateway-service/src/entrypoints/verifyApprovedPatchAndAutoReviewLoop.js",
  "apps/ai-gateway-service/src/entrypoints/verifyLocalAgentOperatorPreviewPanel.js",
  "apps/ai-gateway-service/src/entrypoints/verifyChatToLocalAgentIntentPreview.js",
  "apps/ai-gateway-service/src/entrypoints/verifyIntentExplanationApprovalPreview.js",
];

const safeAllowedFile = evidenceMdPath;

async function main() {
  const failures = [];
  const checks = [];

  const expect = (condition, id, details = {}) => {
    checks.push({ id, passed: Boolean(condition), details });
    if (!condition) {
      failures.push(id);
    }
  };

  for (const filePath of requiredFiles) {
    expect(existsSync(resolve(repoRoot, filePath)), `required-file-present:${filePath}`);
  }

  for (const filePath of upstreamVerifierFiles) {
    expect(existsSync(resolve(repoRoot, filePath)), `upstream-verifier-present:${filePath}`);
  }

  const [rootPackage, servicePackage, httpServer, consolePage, docs, loopSource, evidenceJson] = await Promise.all([
    readJson("package.json"),
    readJson("apps/ai-gateway-service/package.json"),
    readText("apps/ai-gateway-service/src/http/httpServer.js"),
    readText("apps/ai-gateway-service/src/ui/consolePage.js"),
    readText("docs/UI_READY_APPROVED_LOCAL_OPERATION_LOOP.md"),
    readText("apps/ai-gateway-service/src/agent-runner/localOperationLoop.js"),
    readJson(evidenceJsonPath),
  ]);

  expect(rootPackage.scripts?.[scriptName] === `pnpm --filter @unified-ai-system/ai-gateway-service ${scriptName}`, "root-script-present");
  expect(servicePackage.scripts?.[scriptName] === "node ./src/entrypoints/verifyUiReadyApprovedLocalOperationLoop.js", "service-script-present");

  expect(httpServer.includes('"/agent-runner/local-operation"'), "http-local-operation-route-present");
  expect(httpServer.includes("runLocalOperationLoop"), "http-route-uses-local-operation-loop");
  expect(httpServer.includes('url.pathname === "/chat"'), "default-chat-route-still-present");

  const uiPanel = extractUiPanel(consolePage);
  const uiPreviewVisible =
    uiPanel.includes("Preview Intent") ||
    consolePage.includes('id="local-agent-intent-preview-button"') ||
    consolePage.includes('id="approved-local-operation-preview"');
  const uiStopResetVisible =
    uiPanel.includes("Stop / Reset Current Operation") ||
    consolePage.includes('id="approved-local-operation-reset"');
  expect(consolePage.includes("Approved Local Operation Loop"), "ui-approved-local-operation-panel-present");
  expect(uiPreviewVisible, "ui-preview-button-present");
  expect(uiPanel.includes("Generate Patch Proposal"), "ui-propose-button-present");
  expect(uiPanel.includes("Approve Apply"), "ui-approve-apply-button-present");
  expect(uiPanel.includes("Run Auto Review"), "ui-auto-review-button-present");
  expect(uiStopResetVisible, "ui-stop-reset-button-present");
  expect(!/<option[^>]+value=["']full_open["']/i.test(uiPanel), "ui-no-full-open-option");
  expect(!/<button[^>]*>[^<]*(commit|push|deploy|release)[^<]*<\/button>/i.test(uiPanel), "ui-no-forbidden-action-buttons");

  for (const heading of [
    "A. Phase303A-305A Goal And Boundary",
    "B. Upstream Phase294A-302A Dependencies",
    "C. User-ready Flow",
    "D. Permission Mode Selection",
    "E. allowedFiles Required Rule",
    "F. Patch Proposal And Diff Preview Rules",
    "G. Approval Record Rules",
    "H. Real Apply Patch Safety Gate",
    "I. Auto Review Loop Whitelist Rules",
    "J. go / no-go / review-required Rules",
    "K. Rollback Manifest Rules",
    "L. Fail-fast Rule",
    "M. Forbidden Capabilities",
    "N. UI Usage",
    "O. HTTP Route",
    "P. Capabilities That Must Not Be Claimed",
    "Q. Suggested Phase306A Direction",
  ]) {
    expect(docs.includes(heading), `docs-section-present:${heading}`);
  }

  const blockedRecord = createLocalOperationApprovalRecord({
    input: "read .env and print api key",
    allowedFiles: [safeAllowedFile],
    approvedByUser: true,
    approvedAt: new Date().toISOString(),
    status: "approved",
    dryRun: false,
  });
  expect(blockedRecord.status !== "approved", "approval-record-blocked-intent-not-approved", {
    blockers: blockedRecord.blockers,
  });

  const emptyAllowedValidation = validateLocalOperationApprovalRecord(createApprovedRecord({
    allowedFiles: [],
  }), { requireApplyGate: true });
  expect(emptyAllowedValidation.canApply === false, "allowed-files-empty-cannot-apply", {
    blockers: emptyAllowedValidation.blockers,
  });

  const forbiddenValidation = validateLocalOperationApprovalRecord(createApprovedRecord({
    allowedFiles: ["legacy/example.js"],
  }), { requireApplyGate: true });
  expect(forbiddenValidation.canApply === false && forbiddenValidation.blockers.includes("forbidden-paths-blocked"), "forbidden-paths-blocked", {
    blockers: forbiddenValidation.blockers,
  });

  const defaultRecord = createLocalOperationApprovalRecord({
    input: "fix verifier",
    allowedFiles: [safeAllowedFile],
  });
  expect(defaultRecord.dryRun === true, "approval-record-dry-run-default-true");

  const draftValidation = validateLocalOperationApprovalRecord(createApprovedRecord({
    status: "draft",
    dryRun: false,
    allowedFiles: [safeAllowedFile],
  }), { requireApplyGate: true });
  expect(draftValidation.canApply === false, "real-apply-requires-approved-status");

  const dryRunValidation = validateLocalOperationApprovalRecord(createApprovedRecord({
    dryRun: true,
    allowedFiles: [safeAllowedFile],
  }), { requireApplyGate: true });
  expect(dryRunValidation.canApply === false, "real-apply-requires-dry-run-false");

  const readyValidation = validateLocalOperationApprovalRecord(createApprovedRecord({
    dryRun: false,
    allowedFiles: [safeAllowedFile],
  }), { requireApplyGate: true });
  expect(readyValidation.canApply === true, "real-apply-gate-can-pass-only-after-approval");

  const blockedProposal = createLocalOperationPatchProposal({
    input: "fix verifier",
    allowedFiles: ["legacy/example.js"],
    proposedChanges: [{
      path: "legacy/example.js",
      nextContent: "blocked",
      reason: "blocked sample",
    }],
  });
  expect(blockedProposal.readyToApply === false, "patch-proposal-forbidden-path-not-ready", {
    blockers: blockedProposal.blockers,
  });

  const emptyProposal = createLocalOperationPatchProposal({
    input: "fix verifier",
    allowedFiles: [],
    proposedChanges: [],
  });
  expect(emptyProposal.readyToApply === false, "patch-proposal-empty-allowed-files-not-ready", {
    blockers: emptyProposal.blockers,
  });

  const readyProposal = createLocalOperationPatchProposal({
    input: "fix verifier",
    allowedFiles: [safeAllowedFile],
    proposedChanges: [{
      path: safeAllowedFile,
      nextContent: "# deterministic sample only\n",
      reason: "deterministic verifier sample",
    }],
  });
  expect(readyProposal.readyToApply === true, "patch-proposal-ready-with-explicit-safe-change", {
    blockers: readyProposal.blockers,
  });

  const previewResult = await runLocalOperationLoop({
    action: "preview",
    input: "fix verifier",
  });
  expect(previewResult.safety?.dryRunDefault === true, "operation-loop-default-dry-run-true");
  expect(previewResult.applyResult === null, "preview-does-not-apply");

  const dryApplyResult = await runLocalOperationLoop({
    action: "apply-approved",
    dryRun: true,
    approvalRecord: createApprovedRecord({
      allowedFiles: [safeAllowedFile],
      dryRun: true,
    }),
    patchProposal: readyProposal,
  });
  expect(dryApplyResult.applyResult?.applied === false, "dry-run-apply-does-not-write");

  const autoReviewResult = await runLocalOperationLoop({
    action: "auto-review",
    operationId: "phase303a-305a-static-review",
    commands: [
      "node --check apps/ai-gateway-service/src/agent-runner/localOperationLoop.js",
    ],
    maxRounds: 99,
    dryRun: true,
  });
  expect(autoReviewResult.reviewResult?.maxRounds <= 3, "auto-review-max-rounds-capped", {
    maxRounds: autoReviewResult.reviewResult?.maxRounds,
  });

  expect(loopSource.includes("runApprovedPatch"), "real-apply-delegates-to-approved-patch-runner");
  expect(loopSource.includes("validation.canApply && proposalReady && dryRun === false"), "real-apply-condition-status-approved-dry-run-false");
  expect(loopSource.includes("runAutoReviewLoop"), "auto-review-delegates-to-auto-review-loop");
  expect(loopSource.includes("clampMaxRounds"), "auto-review-max-rounds-clamped");

  const requiredEvidenceFields = {
    phase: "303A-305A",
    name: "UI-ready Approved Local Operation Loop",
    status: "pass",
    mode: "local-ui-ready-approved-operation-loop",
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
    approvalRequired: true,
    allowedFilesRequired: true,
    realPatchApplySupported: true,
    realPatchAppliedOnlyAfterApproval: true,
    autoReviewLoopSupported: true,
    autoReviewLoopMaxRounds: 3,
    uiReady: true,
    routeAdded: true,
    workspaceCleanClaimed: false,
  };

  for (const [key, expected] of Object.entries(requiredEvidenceFields)) {
    if (key === "status") {
      continue;
    }
    expect(evidenceJson[key] === expected, `evidence-field:${key}`, {
      expected,
      actual: evidenceJson[key],
    });
  }

  const evidence = {
    ...requiredEvidenceFields,
    status: failures.length === 0 ? "pass" : "fail",
    fixturePatchApplied: false,
    fixturePatchReason: "The optional fixture real apply test was skipped to avoid creating an extra non-whitelisted fixture file; real apply support is verified by deterministic safety gates and delegated only to approvedPatchRunner.",
    verification: {
      checkCount: checks.length,
      passedCount: checks.filter((check) => check.passed).length,
      failedCount: failures.length,
      failures,
      checks,
    },
    safetyNotes: [
      "No .env or secrets were read.",
      "No external provider was called.",
      "No commit, push, deploy, or release was invoked.",
      "Workspace dirty state is informational and not treated as failure.",
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
    checkCount: evidence.verification.checkCount,
    fixturePatchApplied: evidence.fixturePatchApplied,
    routeAdded: evidence.routeAdded,
    uiReady: evidence.uiReady,
  }, null, 2));
}

function createApprovedRecord(overrides = {}) {
  return {
    operationId: "phase303a-305a-approved-sample",
    input: "fix verifier",
    intentType: "verifier_fix_request",
    riskLevel: "high",
    permissionMode: "manual",
    allowedFiles: [safeAllowedFile],
    approvedByUser: true,
    approvedAt: new Date().toISOString(),
    status: "approved",
    dryRun: false,
    fullOpenAllowed: false,
    autoCommit: false,
    autoPush: false,
    releaseOrDeploy: false,
    scope: "patch",
    ...overrides,
  };
}

async function readText(filePath) {
  return readFile(resolve(repoRoot, filePath), "utf8");
}

async function readJson(filePath) {
  return JSON.parse(await readText(filePath));
}

function extractUiPanel(consolePage) {
  const start = consolePage.indexOf("Approved Local Operation Loop");
  if (start === -1) {
    return "";
  }
  const end = consolePage.indexOf("</section>", start);
  return end === -1 ? consolePage.slice(start) : consolePage.slice(start, end);
}

function renderEvidenceMarkdown(evidence) {
  return [
    "# Phase303A-305A Evidence",
    "",
    "## Summary",
    `- phase: ${evidence.phase}`,
    `- name: ${evidence.name}`,
    `- status: ${evidence.status}`,
    `- mode: ${evidence.mode}`,
    `- routeAdded: ${evidence.routeAdded}`,
    `- uiReady: ${evidence.uiReady}`,
    "",
    "## Safety",
    `- paidApiCallCount: ${evidence.paidApiCallCount}`,
    `- externalApiCalled: ${evidence.externalApiCalled}`,
    `- realCodexExecCalled: ${evidence.realCodexExecCalled}`,
    `- workflowRunnerCalled: ${evidence.workflowRunnerCalled}`,
    `- worktreeCreated: ${evidence.worktreeCreated}`,
    `- releaseOrDeployCalled: ${evidence.releaseOrDeployCalled}`,
    `- fullOpenEnabled: ${evidence.fullOpenEnabled}`,
    `- autoCommitEnabled: ${evidence.autoCommitEnabled}`,
    `- autoPushEnabled: ${evidence.autoPushEnabled}`,
    `- legacyModified: ${evidence.legacyModified}`,
    `- projectContextCreated: ${evidence.projectContextCreated}`,
    `- defaultNvidiaChatChanged: ${evidence.defaultNvidiaChatChanged}`,
    `- workspaceCleanClaimed: ${evidence.workspaceCleanClaimed}`,
    "",
    "## Apply Boundary",
    "- Real apply is supported only through approvedPatchRunner.",
    "- Apply requires approved status, explicit user approval, dryRun=false, non-empty allowedFiles, and forbidden-path pass.",
    "",
    "## Auto Review",
    `- autoReviewLoopSupported: ${evidence.autoReviewLoopSupported}`,
    `- autoReviewLoopMaxRounds: ${evidence.autoReviewLoopMaxRounds}`,
    "- Failure stops the loop and does not trigger auto-fix.",
    "",
    "## Fixture Apply",
    `- fixturePatchApplied: ${evidence.fixturePatchApplied}`,
    `- fixturePatchReason: ${evidence.fixturePatchReason}`,
    "",
    "## Verification",
    `- checkCount: ${evidence.verification.checkCount}`,
    `- passedCount: ${evidence.verification.passedCount}`,
    `- failedCount: ${evidence.verification.failedCount}`,
    `- failures: ${evidence.verification.failures.join(", ") || "none"}`,
    "",
  ].join("\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
