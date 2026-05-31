import { mkdir, readFile } from "node:fs/promises";

import {
  openCodeLoopPaths,
  printJson,
  readJsonIfPresent,
  relativeFromRoot,
  writeJson,
  writeText,
} from "./opencodeLoopShared.js";
import { buildOpenCodeNextRoundTask } from "./opencodeNextRoundTaskCore.js";

async function main() {
  const previousTask = await readJsonIfPresent(openCodeLoopPaths.outboxJsonPath);
  const review = await readJsonIfPresent(openCodeLoopPaths.reviewJsonPath);
  const feedbackMarkdown = await readFile(openCodeLoopPaths.feedbackMarkdownPath, "utf8");

  const generated = buildOpenCodeNextRoundTask({
    previousTask,
    review,
    feedbackMarkdown,
  });

  await mkdir(openCodeLoopPaths.outboxDir, { recursive: true });
  await mkdir(openCodeLoopPaths.runsDir, { recursive: true });
  await mkdir(openCodeLoopPaths.phase3992EvidenceDir, { recursive: true });

  await writeText(openCodeLoopPaths.outboxMarkdownPath, generated.task.markdown);
  await writeJson(openCodeLoopPaths.outboxJsonPath, generated.task);
  await writeJson(openCodeLoopPaths.nextRoundTaskJsonPath, generated.task);
  await writeText(openCodeLoopPaths.nextRoundTaskMarkdownPath, generated.task.markdown);
  await writeJson(openCodeLoopPaths.phase3992EvidenceJsonPath, generated.task);
  await writeText(openCodeLoopPaths.phase3992EvidenceMarkdownPath, generated.task.markdown);

  printJson({
    status: "generated",
    taskId: generated.task.taskId,
    title: generated.task.title,
    sourceReviewDecision: generated.task.sourceReviewDecision,
    sourceSessionId: generated.task.sourceSessionId,
    requiredFixCount: generated.task.requiredFixes.length,
    outboxJsonPath: relativeFromRoot(openCodeLoopPaths.outboxJsonPath),
    outboxMarkdownPath: relativeFromRoot(openCodeLoopPaths.outboxMarkdownPath),
    taskRecordJsonPath: relativeFromRoot(openCodeLoopPaths.nextRoundTaskJsonPath),
    evidenceJsonPath: relativeFromRoot(openCodeLoopPaths.phase3992EvidenceJsonPath),
    providerCalledByThisProcess: false,
    codexCliInvoked: false,
    codexExecInvoked: false,
  });
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
