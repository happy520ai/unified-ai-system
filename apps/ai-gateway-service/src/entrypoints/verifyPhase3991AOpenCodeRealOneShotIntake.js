import { readFile } from "node:fs/promises";

import {
  openCodeLoopPaths,
  printJson,
  readJsonIfPresent,
  resolveRepoPath,
  safeStat,
} from "./opencodeLoopShared.js";

const rootScripts = [
  "opencode:desktop:ingest",
  "opencode:desktop:review",
  "opencode:desktop:seal-one-shot",
  "verify:phase3991a-opencode-real-one-shot-intake",
];

const serviceScripts = [...rootScripts];

function phaseDocHasMarkers(phaseDoc) {
  return [
    "auth.json",
    ".env",
    "/chat",
    "/chat-gateway/execute",
    "paid provider",
    "OpenCode DB",
  ].every((marker) => phaseDoc.includes(marker));
}

async function main() {
  const rootPackage = JSON.parse(await readFile(resolveRepoPath("package.json"), "utf8"));
  const servicePackage = JSON.parse(
    await readFile(resolveRepoPath("apps/ai-gateway-service/package.json"), "utf8"),
  );
  const phaseDoc = await readFile(openCodeLoopPaths.phase3991DocPath, "utf8");
  const seal = await readJsonIfPresent(openCodeLoopPaths.phase3991EvidenceJsonPath);

  const checks = {
    phaseDocExists: (await safeStat(openCodeLoopPaths.phase3991DocPath)).exists,
    oneShotSealRunExists: (await safeStat(openCodeLoopPaths.oneShotSealJsonPath)).exists,
    phaseEvidenceExists: (await safeStat(openCodeLoopPaths.phase3991EvidenceJsonPath)).exists,
    rootScriptsPresent: rootScripts.every((script) => Object.hasOwn(rootPackage.scripts || {}, script)),
    serviceScriptsPresent: serviceScripts.every((script) => Object.hasOwn(servicePackage.scripts || {}, script)),
    phaseDocMentionsBoundaries: phaseDocHasMarkers(phaseDoc),
    sealStatusPassed: seal?.status === "passed",
    sessionIdOrExplicitBlocker: Boolean(seal?.sessionId) || ["manual_result_missing", "session_not_found"].includes(seal?.blocker),
    intakeCaptured: seal?.intakeCaptured === true,
    reviewGenerated: seal?.reviewGenerated === true,
    feedbackGenerated: seal?.feedbackGenerated === true,
    intakeSourceDbLatest: seal?.intakeSource === "db-latest",
    noProviderCallClaim: seal?.providerCalledByThisProcess === false,
    noCodexCliClaim: seal?.codexCliInvoked === false,
    noCodexExecClaim: seal?.codexExecInvoked === false,
  };

  const passed = Object.values(checks).every(Boolean);
  printJson({
    status: passed ? "passed" : "failed",
    checks,
    blocker: seal?.blocker || null,
    sessionId: seal?.sessionId || null,
    reviewDecision: seal?.reviewDecision || null,
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
