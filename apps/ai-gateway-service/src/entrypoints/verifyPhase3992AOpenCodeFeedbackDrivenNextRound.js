import { readFile } from "node:fs/promises";

import {
  openCodeLoopPaths,
  printJson,
  readJsonIfPresent,
  resolveRepoPath,
  safeStat,
} from "./opencodeLoopShared.js";

const rootScripts = [
  "opencode:desktop:next-round",
  "verify:phase3992a-opencode-feedback-driven-next-round",
];

const serviceScripts = [...rootScripts];

function phaseDocHasMarkers(phaseDoc) {
  return [
    "review-required",
    "Commands Run",
    "Changed Files",
    "Evidence Paths",
    "completionVerified",
    "/chat",
    "/chat-gateway/execute",
    "auth.json",
  ].every((marker) => phaseDoc.includes(marker));
}

async function main() {
  const rootPackage = JSON.parse(await readFile(resolveRepoPath("package.json"), "utf8"));
  const servicePackage = JSON.parse(
    await readFile(resolveRepoPath("apps/ai-gateway-service/package.json"), "utf8"),
  );
  const phaseDoc = await readFile(openCodeLoopPaths.phase3992DocPath, "utf8");
  const latestTask = await readJsonIfPresent(openCodeLoopPaths.outboxJsonPath);
  const taskRecord = await readJsonIfPresent(openCodeLoopPaths.phase3992EvidenceJsonPath);

  const checks = {
    phaseDocExists: (await safeStat(openCodeLoopPaths.phase3992DocPath)).exists,
    generatedTaskExists: (await safeStat(openCodeLoopPaths.nextRoundTaskJsonPath)).exists,
    generatedEvidenceExists: (await safeStat(openCodeLoopPaths.phase3992EvidenceJsonPath)).exists,
    rootScriptsPresent: rootScripts.every((script) => Object.hasOwn(rootPackage.scripts || {}, script)),
    serviceScriptsPresent: serviceScripts.every((script) => Object.hasOwn(servicePackage.scripts || {}, script)),
    phaseDocMentionsBoundaries: phaseDocHasMarkers(phaseDoc),
    latestTaskIsPhase3992A: latestTask?.taskId === "phase3992a-opencode-feedback-driven-next-round",
    sourceReviewDecisionPresent: latestTask?.sourceReviewDecision === "review-required",
    sourceSessionIdPresent: Boolean(latestTask?.sourceSessionId),
    requiredFixesPresent: Array.isArray(latestTask?.requiredFixes) && latestTask.requiredFixes.length > 0,
    autoCommitFalse: latestTask?.autoCommit === false,
    autoPushFalse: latestTask?.autoPush === false,
    markdownHasStructuredRepairRequirements:
      typeof latestTask?.markdown === "string"
      && latestTask.markdown.includes("Commands Run")
      && latestTask.markdown.includes("Changed Files")
      && latestTask.markdown.includes("Evidence Paths")
      && latestTask.markdown.includes("completionVerified"),
    evidenceMatchesLatestTask: taskRecord?.taskId === latestTask?.taskId && taskRecord?.sourceSessionId === latestTask?.sourceSessionId,
    noProviderCallClaim: latestTask?.providerCalledByThisPhase === false,
    noCodexExecClaim: latestTask?.codexExecInvoked === false,
  };

  const passed = Object.values(checks).every(Boolean);
  printJson({
    status: passed ? "passed" : "failed",
    checks,
    taskId: latestTask?.taskId || null,
    sourceSessionId: latestTask?.sourceSessionId || null,
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
