import { mkdir, readFile, writeFile } from "node:fs/promises";

import { openCodeLoopPaths, printJson, readJsonIfPresent, resolveRepoPath, safeStat } from "./opencodeLoopShared.js";
import { readOpenCodeDesktopStatus } from "./opencodeDesktopStatus.js";

const requiredFiles = [
  "package.json",
  "apps/ai-gateway-service/package.json",
  "apps/ai-gateway-service/src/entrypoints/opencodeLoopShared.js",
  "apps/ai-gateway-service/src/entrypoints/opencodeDbSafeReader.js",
  "apps/ai-gateway-service/src/entrypoints/opencodeReviewCore.js",
  "apps/ai-gateway-service/src/entrypoints/opencodeDesktopStatus.js",
  "apps/ai-gateway-service/src/entrypoints/sendOpenCodeDesktopTask.js",
  "apps/ai-gateway-service/src/entrypoints/ingestOpenCodeDesktopResult.js",
  "apps/ai-gateway-service/src/entrypoints/reviewOpenCodeDesktopResult.js",
  "apps/ai-gateway-service/src/entrypoints/runOpenCodeDesktopLoop.js",
  "apps/ai-gateway-service/src/entrypoints/seedOpenCodeDesktopTask.js",
  "apps/ai-gateway-service/src/entrypoints/runOpenCodeDesktopInternalTests.js",
  "apps/ai-gateway-service/src/entrypoints/runOpenCodeDesktopAutomationAudit.js",
  "apps/ai-gateway-service/src/entrypoints/verifyPhase3990AOpenCodeControlledLoopBridge.js",
  "docs/phase3990a-opencode-controlled-loop-bridge.md",
];

async function main() {
  const issues = [];
  for (const relativePath of requiredFiles) {
    const file = await safeStat(resolveRepoPath(relativePath));
    if (!file.exists) {
      issues.push(`Missing required file: ${relativePath}`);
    }
  }

  const internalSummary = await readJsonIfPresent(`${openCodeLoopPaths.internalRunsDir}/internal-run-summary.json`);
  const status = await readOpenCodeDesktopStatus();
  if (!internalSummary?.allExpectationsMet) {
    issues.push("OpenCode internal runs did not meet all expectations.");
  }
  if (!status.outboxTaskExists) {
    issues.push("OpenCode outbox task is missing.");
  }

  const audit = {
    status: issues.length === 0 ? "passed" : "failed",
    checkedAt: new Date().toISOString(),
    issuesFound: issues,
    internalRuns: internalSummary || null,
    statusSnapshot: status,
    providerCalledByThisProcess: false,
    codexCliInvoked: false,
    codexExecInvoked: false,
    workflowRunnerEnabled: false,
    worktreeCreated: false,
    autoCommit: false,
    autoPush: false,
  };

  await mkdir(openCodeLoopPaths.runsDir, { recursive: true });
  await writeFile(
    `${openCodeLoopPaths.runsDir}/opencode-desktop-automation-audit.json`,
    `${JSON.stringify(audit, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    `${openCodeLoopPaths.runsDir}/opencode-desktop-automation-audit.md`,
    [
      "# OpenCode Desktop Automation Audit",
      "",
      `- status: ${audit.status}`,
      `- checkedAt: ${audit.checkedAt}`,
      `- issueCount: ${audit.issuesFound.length}`,
      "",
      "## Issues",
      ...(audit.issuesFound.length === 0 ? ["- none"] : audit.issuesFound.map((item) => `- ${item}`)),
      "",
    ].join("\n"),
    "utf8",
  );

  printJson({
    status: audit.status,
    auditJsonPath: ".opencode-handoff/runs/opencode-desktop-automation-audit.json",
    auditMarkdownPath: ".opencode-handoff/runs/opencode-desktop-automation-audit.md",
    unresolvedIssueCount: audit.issuesFound.length,
    providerCalledByThisProcess: false,
    codexCliInvoked: false,
    codexExecInvoked: false,
  });

  if (audit.status !== "passed") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
