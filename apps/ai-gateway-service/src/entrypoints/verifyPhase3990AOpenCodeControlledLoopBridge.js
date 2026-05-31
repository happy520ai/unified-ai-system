import { readFile } from "node:fs/promises";

import {
  openCodeLoopPaths,
  printJson,
  readJsonIfPresent,
  resolveRepoPath,
  safeStat,
} from "./opencodeLoopShared.js";

const rootScripts = [
  "opencode:desktop:seed-task",
  "opencode:desktop:status",
  "opencode:desktop:send",
  "opencode:desktop:ingest",
  "opencode:desktop:review",
  "opencode:desktop:loop",
  "opencode:desktop:test:internal",
  "opencode:desktop:audit",
  "verify:phase3990a-opencode-controlled-loop-bridge",
];

const serviceScripts = [...rootScripts];

function phaseDocHasBoundaryMarkers(phaseDoc) {
  return [
    "auth.json",
    ".env",
    "/chat",
    "/chat-gateway/execute",
    "paid provider",
  ].every((marker) => phaseDoc.includes(marker));
}

async function main() {
  const rootPackage = JSON.parse(await readFile(resolveRepoPath("package.json"), "utf8"));
  const servicePackage = JSON.parse(
    await readFile(resolveRepoPath("apps/ai-gateway-service/package.json"), "utf8"),
  );
  const phaseDoc = await readFile(
    resolveRepoPath("docs/phase3990a-opencode-controlled-loop-bridge.md"),
    "utf8",
  );
  const internalSummary = await readJsonIfPresent(
    `${openCodeLoopPaths.internalRunsDir}/internal-run-summary.json`,
  );
  const audit = await readJsonIfPresent(
    `${openCodeLoopPaths.runsDir}/opencode-desktop-automation-audit.json`,
  );
  const outboxTask = await readJsonIfPresent(openCodeLoopPaths.outboxJsonPath);
  const phase3990TaskId = "phase3990a-opencode-controlled-loop-bridge";
  const auditSnapshotTaskId = audit?.statusSnapshot?.latestTask?.taskId || null;

  const checks = {
    phaseDocExists: (await safeStat(
      resolveRepoPath("docs/phase3990a-opencode-controlled-loop-bridge.md"),
    )).exists,
    internalSummaryExists: (await safeStat(
      `${openCodeLoopPaths.internalRunsDir}/internal-run-summary.json`,
    )).exists,
    auditExists: (await safeStat(
      `${openCodeLoopPaths.runsDir}/opencode-desktop-automation-audit.json`,
    )).exists,
    internalRunsPassed: internalSummary?.allExpectationsMet === true,
    auditPassed: audit?.status === "passed",
    outboxTaskExists: outboxTask?.taskId === phase3990TaskId || auditSnapshotTaskId === phase3990TaskId,
    rootScriptsPresent: rootScripts.every((script) => Object.hasOwn(rootPackage.scripts || {}, script)),
    serviceScriptsPresent: serviceScripts.every((script) => Object.hasOwn(servicePackage.scripts || {}, script)),
    phaseDocMentionsDbIngest: phaseDoc.includes("OpenCode DB") && phaseDoc.includes("自动回传"),
    phaseDocMentionsBoundaries: phaseDocHasBoundaryMarkers(phaseDoc),
    noProviderCallClaim:
      audit?.providerCalledByThisProcess === false
      && internalSummary?.providerCalledByThisProcess === false,
  };

  const passed = Object.values(checks).every(Boolean);
  printJson({
    status: passed ? "passed" : "failed",
    checks,
    providerCalledByThisProcess: false,
    codexCliInvoked: false,
    codexExecInvoked: false,
  });

  if (!passed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
