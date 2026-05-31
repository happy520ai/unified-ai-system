import { mkdir, writeFile } from "node:fs/promises";

import { openCodeLoopPaths, printJson, writeJson } from "./opencodeLoopShared.js";
import {
  buildOpenCodeReview,
  renderOpenCodeFeedbackMarkdown,
  renderOpenCodeReviewMarkdown,
} from "./opencodeReviewCore.js";
import { createOpenCodeSeedTask } from "./seedOpenCodeDesktopTask.js";

const rounds = [
  {
    id: "round-1",
    title: "结构完整的合规结果",
    expected: "go",
    markdown: [
      "# OpenCode Result",
      "",
      "A. 前置条件检查结论：通过",
      "B. 修改文件列表：apps/ai-gateway-service/src/entrypoints/opencodeDesktopStatus.js",
      "C. 每个文件最小改动：补充只读状态聚合",
      "D. 新增能力说明：支持 OpenCode DB 自动回传结果摄取",
      "G. Evidence 文件：apps/ai-gateway-service/evidence/phase3990a-opencode-controlled-loop-bridge/latest-summary.json",
      "I. Package scripts：新增 opencode:desktop:status / send / ingest / review / loop",
      "Commands Run:",
      "- node --check apps/ai-gateway-service/src/entrypoints/opencodeDesktopStatus.js",
      "Changed Files:",
      "- apps/ai-gateway-service/src/entrypoints/opencodeDesktopStatus.js",
      "Evidence Paths:",
      "- apps/ai-gateway-service/evidence/phase3990a-opencode-controlled-loop-bridge/latest-summary.json",
      "Known Issues: none",
      "completionVerified: true",
      "M. 是否调用 paid API：否",
      "W. 验证命令和结果：通过",
    ].join("\n"),
    metadata: {
      importedAt: new Date().toISOString(),
      source: "internal-mock",
      sessionId: "ses_round1",
      modelProvider: "nvidia",
      modelId: "nvidia/llama-3.1-nemotron-nano-8b-v1",
      contentLength: 0,
    },
    check(review) {
      return review.goNoGo === "go"
        && review.boundaryViolationCount === 0
        && review.verificationGapCount === 0
        && review.completionVerified === true;
    },
  },
  {
    id: "round-2",
    title: "结果不够完整，需要补充证据",
    expected: "review-required",
    markdown: [
      "# OpenCode Result",
      "",
      "A. 前置条件检查结论：部分完成",
      "我看了几个文件，应该差不多。",
      "后面可以继续。",
    ].join("\n"),
    metadata: {
      importedAt: new Date().toISOString(),
      source: "internal-mock",
      sessionId: "ses_round2",
      modelProvider: "nvidia",
      modelId: "nvidia/llama-3.1-nemotron-nano-8b-v1",
      contentLength: 0,
    },
    check(review) {
      return review.goNoGo === "review-required"
        && review.completionVerified === false
        && (review.verificationGapCount > 0 || review.evidenceGapCount > 0);
    },
  },
  {
    id: "round-3",
    title: "边界违规结果",
    expected: "no-go",
    markdown: [
      "# OpenCode Result",
      "",
      "A. 前置条件检查结论：失败",
      "Changed Files:",
      "- legacy/example.js",
      "Commands Run:",
      "- git commit -m \"unsafe\"",
      "Known Issues: legacy/ was modified",
      "completionVerified: false",
      "W. 验证命令和结果：失败",
    ].join("\n"),
    metadata: {
      importedAt: new Date().toISOString(),
      source: "internal-mock",
      sessionId: "ses_round3",
      modelProvider: "nvidia",
      modelId: "nvidia/llama-3.1-nemotron-nano-8b-v1",
      contentLength: 0,
    },
    check(review) {
      return review.goNoGo === "no-go"
        && review.boundaryViolationCount > 0
        && review.goalDirection === "off-track";
    },
  },
];

async function main() {
  await mkdir(openCodeLoopPaths.internalRunsDir, { recursive: true });
  const task = createOpenCodeSeedTask();
  const taskJson = {
    taskId: task.taskId,
    title: task.title,
    mode: task.mode,
  };
  const results = [];

  for (const round of rounds) {
    const roundDir = `${openCodeLoopPaths.internalRunsDir}/${round.id}`;
    await mkdir(roundDir, { recursive: true });
    const review = buildOpenCodeReview({
      resultMarkdown: round.markdown,
      resultMetadata: round.metadata,
      task: taskJson,
    });
    const expectationMet = round.check(review);
    const summary = {
      round: round.id,
      title: round.title,
      expected: round.expected,
      goNoGo: review.goNoGo,
      goalDirection: review.goalDirection,
      expectationMet,
      boundaryViolationCount: review.boundaryViolationCount,
      verificationGapCount: review.verificationGapCount,
      evidenceGapCount: review.evidenceGapCount,
      completionVerified: review.completionVerified,
      recommendedNextAction: review.recommendedNextAction,
      providerCalledByThisProcess: false,
      codexCliInvoked: false,
      codexExecInvoked: false,
      workflowRunnerEnabled: false,
      worktreeCreated: false,
      autoCommit: false,
      autoPush: false,
    };

    await writeFile(`${roundDir}/input-task.md`, task.markdown, "utf8");
    await writeFile(`${roundDir}/mock-opencode-result.md`, round.markdown, "utf8");
    await writeJson(`${roundDir}/ingest-record.json`, round.metadata);
    await writeJson(`${roundDir}/review-result.json`, review);
    await writeFile(`${roundDir}/review-result.md`, renderOpenCodeReviewMarkdown(review), "utf8");
    await writeFile(`${roundDir}/feedback-to-opencode.md`, renderOpenCodeFeedbackMarkdown(review), "utf8");
    await writeJson(`${roundDir}/run-summary.json`, summary);
    await writeFile(
      `${roundDir}/run-summary.md`,
      [
        `# ${round.id} Internal Run Summary`,
        "",
        `- title: ${summary.title}`,
        `- expected: ${summary.expected}`,
        `- goNoGo: ${summary.goNoGo}`,
        `- goalDirection: ${summary.goalDirection}`,
        `- completionVerified: ${summary.completionVerified}`,
        `- expectationMet: ${summary.expectationMet}`,
        "",
      ].join("\n"),
      "utf8",
    );
    results.push(summary);
  }

  const internalSummary = {
    generatedAt: new Date().toISOString(),
    round1Status: results[0].goNoGo,
    round2Status: results[1].goNoGo,
    round3Status: results[2].goNoGo,
    round1Expected: rounds[0].expected,
    round2Expected: rounds[1].expected,
    round3Expected: rounds[2].expected,
    allExpectationsMet: results.every((item) => item.expectationMet),
    rounds: results,
    providerCalledByThisProcess: false,
    codexCliInvoked: false,
    codexExecInvoked: false,
    workflowRunnerEnabled: false,
    worktreeCreated: false,
    autoCommit: false,
    autoPush: false,
  };

  await writeJson(`${openCodeLoopPaths.internalRunsDir}/internal-run-summary.json`, internalSummary);
  await writeFile(
    `${openCodeLoopPaths.internalRunsDir}/internal-run-summary.md`,
    [
      "# OpenCode Desktop Internal Run Summary",
      "",
      `- round1Status: ${internalSummary.round1Status}`,
      `- round2Status: ${internalSummary.round2Status}`,
      `- round3Status: ${internalSummary.round3Status}`,
      `- allExpectationsMet: ${internalSummary.allExpectationsMet}`,
      "",
      "These are local mock tests only. They do not send to OpenCode Desktop and do not call any provider.",
      "",
    ].join("\n"),
    "utf8",
  );

  printJson({
    status: internalSummary.allExpectationsMet ? "passed" : "failed",
    summaryPath: ".opencode-handoff/internal-runs/internal-run-summary.json",
    markdownPath: ".opencode-handoff/internal-runs/internal-run-summary.md",
    round1Status: internalSummary.round1Status,
    round2Status: internalSummary.round2Status,
    round3Status: internalSummary.round3Status,
    allExpectationsMet: internalSummary.allExpectationsMet,
    providerCalledByThisProcess: false,
    codexCliInvoked: false,
    codexExecInvoked: false,
  });

  if (!internalSummary.allExpectationsMet) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
