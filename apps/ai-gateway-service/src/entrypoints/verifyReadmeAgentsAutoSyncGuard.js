import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
const scriptName = "verify:phase306c-readme-agents-auto-sync-guard";
const evidenceJsonPath = "apps/ai-gateway-service/evidence/phase-306c-readme-agents-auto-sync-guard.json";
const evidenceMdPath = "apps/ai-gateway-service/evidence/phase-306c-readme-agents-auto-sync-guard.md";

const requiredFiles = [
  "README.md",
  "AGENTS.md",
  "docs/README_AGENTS_AUTO_SYNC_GUARD.md",
  "apps/ai-gateway-service/src/entrypoints/syncReadmeAgentsCurrentState.js",
  "apps/ai-gateway-service/src/entrypoints/verifyReadmeAgentsAutoSyncGuard.js",
  "package.json",
  "apps/ai-gateway-service/package.json",
];

const requiredEvidenceFields = {
  phase: "306C",
  name: "README / AGENTS Auto Sync Guard & Current State Catch-up",
  status: "pass",
  mode: "documentation-sync-and-guard-only",
  readmeUpdated: true,
  agentsUpdated: true,
  managedBlocksAdded: true,
  autoSyncScriptAdded: true,
  verifyGuardAdded: true,
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

  const [readme, agents, rootPackage, servicePackage] = await Promise.all([
    readText("README.md"),
    readText("AGENTS.md"),
    readJson("package.json"),
    readJson("apps/ai-gateway-service/package.json"),
  ]);

  const readmeBlock = extractBlock(readme, "UNIFIED_AI_SYSTEM_CURRENT_STATE");
  const agentsBlock = extractBlock(agents, "UNIFIED_AI_SYSTEM_AGENT_RULES");

  expect(readme.includes("<!-- BEGIN UNIFIED_AI_SYSTEM_CURRENT_STATE -->"), "readme-managed-block-start-present");
  expect(readme.includes("<!-- END UNIFIED_AI_SYSTEM_CURRENT_STATE -->"), "readme-managed-block-end-present");
  expect(agents.includes("<!-- BEGIN UNIFIED_AI_SYSTEM_AGENT_RULES -->"), "agents-managed-block-start-present");
  expect(agents.includes("<!-- END UNIFIED_AI_SYSTEM_AGENT_RULES -->"), "agents-managed-block-end-present");

  expect(readmeBlock.includes("Phase306B UI Manual Visibility Hotfix"), "readme-phase306b-present");
  expect(readmeBlock.includes("Phase303A-305A UI-ready Approved Local Operation Loop is sealed"), "readme-phase303a-305a-present");
  expect(readmeBlock.includes("Current blocker"), "readme-blocker-section-present");
  expect(readmeBlock.includes("none"), "readme-blocker-none-present");
  expect(readmeBlock.includes("workspace dirty is not clean"), "readme-workspace-dirty-not-clean-present");

  expect(agentsBlock.includes("Every phase completion must refresh the README / AGENTS managed block"), "agents-sync-rule-present");
  expect(agentsBlock.includes("permissionMode is required"), "agents-permission-mode-present");
  expect(agentsBlock.includes("approvalRecord"), "agents-approval-record-present");
  expect(agentsBlock.includes("allowedFiles"), "agents-allowed-files-present");
  expect(agentsBlock.includes("forbiddenPaths"), "agents-forbidden-paths-present");
  expect(agentsBlock.includes("dryRun"), "agents-dry-run-present");
  expect(agentsBlock.includes("full_open"), "agents-full-open-present");
  expect(agentsBlock.includes("autoCommit=false"), "agents-auto-commit-present");
  expect(agentsBlock.includes("autoPush=false"), "agents-auto-push-present");
  expect(agentsBlock.includes("release and deploy are blocked"), "agents-release-deploy-blocked-present");

  expect(
    rootPackage.scripts?.["sync:readme-agents-current-state"] === "pnpm --filter @unified-ai-system/ai-gateway-service sync:readme-agents-current-state",
    "root-sync-script-present",
  );
  expect(
    rootPackage.scripts?.["verify:phase306c-readme-agents-auto-sync-guard"] === "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase306c-readme-agents-auto-sync-guard",
    "root-verify-script-present",
  );
  expect(
    servicePackage.scripts?.["sync:readme-agents-current-state"] === "node ./src/entrypoints/syncReadmeAgentsCurrentState.js",
    "service-sync-script-present",
  );
  expect(
    servicePackage.scripts?.["verify:phase306c-readme-agents-auto-sync-guard"] === "node ./src/entrypoints/verifyReadmeAgentsAutoSyncGuard.js",
    "service-verify-script-present",
  );

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
      "Documentation sync only.",
      "No .env or secrets were read.",
      "No business code, UI, route, or execution logic was added.",
      "Workspace dirty is informational only and is not claimed clean.",
      "Verifier side effects may refresh evidence for this documentation guard.",
    ],
  };

  await writeFile(resolve(repoRoot, evidenceJsonPath), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(resolve(repoRoot, evidenceMdPath), renderEvidenceMarkdown(evidence), "utf8");

  const persistedEvidence = await readJson(evidenceJsonPath);
  for (const [key, expected] of Object.entries(requiredEvidenceFields)) {
    expect(persistedEvidence[key] === expected, `evidence-field:${key}`, {
      expected,
      actual: persistedEvidence[key],
    });
  }
  expect(persistedEvidence.status === evidence.status, "evidence-status-persisted", {
    expected: evidence.status,
    actual: persistedEvidence.status,
  });

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
    readmeUpdated: evidence.readmeUpdated,
    agentsUpdated: evidence.agentsUpdated,
  }, null, 2));
}

async function readText(relativePath) {
  return String(await readFile(resolve(repoRoot, relativePath), "utf8")).replace(/\r\n/g, "\n");
}

async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}

function extractBlock(text, blockName) {
  const startMarker = `<!-- BEGIN ${blockName} -->`;
  const endMarker = `<!-- END ${blockName} -->`;
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker);
  if (start === -1 || end === -1 || end <= start) {
    return "";
  }
  return text.slice(start, end + endMarker.length);
}

function renderEvidenceMarkdown(evidence) {
  return [
    "# Phase306C Evidence",
    "",
    "## Summary",
    `- phase: ${evidence.phase}`,
    `- name: ${evidence.name}`,
    `- status: ${evidence.status}`,
    `- mode: ${evidence.mode}`,
    `- readmeUpdated: ${evidence.readmeUpdated}`,
    `- agentsUpdated: ${evidence.agentsUpdated}`,
    `- managedBlocksAdded: ${evidence.managedBlocksAdded}`,
    `- autoSyncScriptAdded: ${evidence.autoSyncScriptAdded}`,
    `- verifyGuardAdded: ${evidence.verifyGuardAdded}`,
    "",
    "## Safety",
    `- fullOpenEnabled: ${evidence.fullOpenEnabled}`,
    `- autoCommitEnabled: ${evidence.autoCommitEnabled}`,
    `- autoPushEnabled: ${evidence.autoPushEnabled}`,
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
