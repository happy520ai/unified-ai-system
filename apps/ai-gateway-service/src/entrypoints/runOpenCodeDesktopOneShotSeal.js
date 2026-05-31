import { mkdir } from "node:fs/promises";

import {
  openCodeLoopPaths,
  printJson,
  readJsonIfPresent,
  relativeFromRoot,
  safeStat,
  writeJson,
  writeText,
} from "./opencodeLoopShared.js";
import {
  buildOpenCodeOneShotSeal,
  renderOpenCodeOneShotSealMarkdown,
} from "./opencodeOneShotSealCore.js";

async function main() {
  const importedResult = await readJsonIfPresent(openCodeLoopPaths.inboxJsonPath);
  const review = await readJsonIfPresent(openCodeLoopPaths.reviewJsonPath);
  const feedbackFile = await safeStat(openCodeLoopPaths.feedbackMarkdownPath);
  const seal = buildOpenCodeOneShotSeal({
    importedResult,
    review,
    feedbackExists: feedbackFile.exists,
  });

  await mkdir(openCodeLoopPaths.runsDir, { recursive: true });
  await mkdir(openCodeLoopPaths.phase3991EvidenceDir, { recursive: true });

  const markdown = renderOpenCodeOneShotSealMarkdown(seal);
  await writeJson(openCodeLoopPaths.oneShotSealJsonPath, seal);
  await writeText(openCodeLoopPaths.oneShotSealMarkdownPath, markdown);
  await writeJson(openCodeLoopPaths.phase3991EvidenceJsonPath, seal);
  await writeText(openCodeLoopPaths.phase3991EvidenceMarkdownPath, markdown);

  printJson({
    status: seal.status,
    blocker: seal.blocker,
    intakeCaptured: seal.intakeCaptured,
    reviewGenerated: seal.reviewGenerated,
    feedbackGenerated: seal.feedbackGenerated,
    sessionId: seal.sessionId,
    reviewDecision: seal.reviewDecision,
    sealJsonPath: relativeFromRoot(openCodeLoopPaths.oneShotSealJsonPath),
    sealMarkdownPath: relativeFromRoot(openCodeLoopPaths.oneShotSealMarkdownPath),
    evidenceJsonPath: relativeFromRoot(openCodeLoopPaths.phase3991EvidenceJsonPath),
    evidenceMarkdownPath: relativeFromRoot(openCodeLoopPaths.phase3991EvidenceMarkdownPath),
    providerCalledByThisProcess: false,
    codexCliInvoked: false,
    codexExecInvoked: false,
  });

  if (seal.status !== "passed") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
