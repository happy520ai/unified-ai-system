import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildReview,
  defaultReviewPaths,
  renderFeedbackMarkdown,
  renderReviewMarkdown,
  writeReviewOutputs,
} from "./codexDesktopReviewCore.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const taskMarkdownPath = resolve(repoRoot, ".codex-handoff/outbox/latest-codex-task.md");
const taskJsonPath = resolve(repoRoot, ".codex-handoff/outbox/latest-codex-task.json");
const latestInboxMarkdownPath = resolve(repoRoot, ".codex-handoff/inbox/latest-codex-result.md");
const latestInboxJsonPath = resolve(repoRoot, ".codex-handoff/inbox/latest-codex-result.json");
const internalRoot = resolve(repoRoot, ".codex-handoff/internal-runs");

const rounds = [
  {
    id: "round-1",
    label: "Round 1",
    title: "正常合规结果",
    expected: "go",
    mock: renderRound1Mock,
    expectation: (review) => review.goNoGo === "go"
      && review.boundaryViolationCount === 0
      && review.verificationGapCount === 0
      && review.evidenceGapCount === 0,
  },
  {
    id: "round-2",
    label: "Round 2",
    title: "缺少验证/evidence",
    expected: "review-required",
    mock: renderRound2Mock,
    expectation: (review) => ["review-required", "human-review-required"].includes(review.goNoGo)
      && (review.verificationGapCount > 0 || review.evidenceGapCount > 0),
  },
  {
    id: "round-3",
    label: "Round 3",
    title: "边界违规",
    expected: "no-go",
    mock: renderRound3Mock,
    expectation: (review) => review.goNoGo === "no-go"
      && review.boundaryViolationCount > 0
      && /stop|reject|boundary violation|停止|修复/i.test(review.recommendedNextAction),
  },
];

async function main() {
  const taskMarkdown = await readFile(taskMarkdownPath, "utf8");
  const taskJson = JSON.parse(await readFile(taskJsonPath, "utf8"));
  const results = [];

  await mkdir(internalRoot, { recursive: true });

  for (const round of rounds) {
    const result = await runRound({ round, taskMarkdown, taskJson });
    results.push(result);
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    round1Status: results[0].goNoGo,
    round2Status: results[1].goNoGo,
    round3Status: results[2].goNoGo,
    round1Expected: rounds[0].expected,
    round2Expected: rounds[1].expected,
    round3Expected: rounds[2].expected,
    allExpectationsMet: results.every((item) => item.expectationMet),
    rounds: results,
    codexCliInvoked: false,
    codexExecInvoked: false,
    workflowRunnerEnabled: false,
    worktreeCreated: false,
    autoCommit: false,
    autoPush: false,
    note: "Internal run tests use local mock results only. They do not send to Codex Desktop, call codex CLI, or execute codex exec.",
  };

  const summaryJsonPath = resolve(internalRoot, "internal-run-summary.json");
  const summaryMarkdownPath = resolve(internalRoot, "internal-run-summary.md");
  await writeFile(summaryJsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeFile(summaryMarkdownPath, renderInternalSummaryMarkdown(summary), "utf8");

  console.log(JSON.stringify({
    status: summary.allExpectationsMet ? "passed" : "failed",
    summaryPath: ".codex-handoff/internal-runs/internal-run-summary.json",
    markdownPath: ".codex-handoff/internal-runs/internal-run-summary.md",
    round1Status: summary.round1Status,
    round2Status: summary.round2Status,
    round3Status: summary.round3Status,
    allExpectationsMet: summary.allExpectationsMet,
    codexCliInvoked: false,
    codexExecInvoked: false,
    workflowRunnerEnabled: false,
    worktreeCreated: false,
    autoCommit: false,
    autoPush: false,
  }, null, 2));

  if (!summary.allExpectationsMet) {
    process.exitCode = 1;
  }
}

async function runRound({ round, taskMarkdown, taskJson }) {
  const roundDir = resolve(internalRoot, round.id);
  await mkdir(roundDir, { recursive: true });

  const mockResult = round.mock();
  const importedAt = new Date().toISOString();
  const ingestRecord = {
    importedAt,
    round: round.id,
    source: "internal-mock-result",
    inputTaskPath: `.codex-handoff/internal-runs/${round.id}/input-task.md`,
    resultPath: `.codex-handoff/internal-runs/${round.id}/mock-codex-result.md`,
    contentLength: mockResult.length,
    requiresReview: true,
    codexCliInvoked: false,
    codexExecInvoked: false,
    workflowRunnerEnabled: false,
    worktreeCreated: false,
    autoCommit: false,
    autoPush: false,
  };

  await writeFile(resolve(roundDir, "input-task.md"), taskMarkdown, "utf8");
  await writeFile(resolve(roundDir, "mock-codex-result.md"), mockResult, "utf8");
  await writeFile(resolve(roundDir, "ingest-record.json"), `${JSON.stringify(ingestRecord, null, 2)}\n`, "utf8");
  await writeFile(latestInboxMarkdownPath, mockResult, "utf8");
  await writeFile(latestInboxJsonPath, `${JSON.stringify({
    ...ingestRecord,
    source: `internal-run:${round.id}`,
    resultPath: ".codex-handoff/inbox/latest-codex-result.md",
    metadataPath: ".codex-handoff/inbox/latest-codex-result.json",
  }, null, 2)}\n`, "utf8");

  const review = buildReview({
    resultMarkdown: mockResult,
    resultMetadata: ingestRecord,
    task: taskJson,
  });

  await writeReviewOutputs({ review, paths: defaultReviewPaths });
  await writeFile(resolve(roundDir, "review-result.json"), `${JSON.stringify(review, null, 2)}\n`, "utf8");
  await writeFile(resolve(roundDir, "review-result.md"), renderReviewMarkdown(review), "utf8");
  await writeFile(resolve(roundDir, "feedback-to-codex.md"), renderFeedbackMarkdown(review), "utf8");

  const expectationMet = round.expectation(review);
  const runSummary = {
    round: round.id,
    title: round.title,
    expected: round.expected,
    goNoGo: review.goNoGo,
    expectationMet,
    boundaryViolationCount: review.boundaryViolationCount,
    verificationGapCount: review.verificationGapCount,
    evidenceGapCount: review.evidenceGapCount,
    recommendedNextAction: review.recommendedNextAction,
    codexCliInvoked: false,
    codexExecInvoked: false,
    workflowRunnerEnabled: false,
    worktreeCreated: false,
    autoCommit: false,
    autoPush: false,
  };

  await writeFile(resolve(roundDir, "run-summary.json"), `${JSON.stringify(runSummary, null, 2)}\n`, "utf8");
  await writeFile(resolve(roundDir, "run-summary.md"), renderRoundSummaryMarkdown(runSummary), "utf8");
  return runSummary;
}

function renderRound1Mock() {
  return [
    "# Round 1 Mock Codex Result",
    "",
    "A. 前置条件检查结论：通过，本轮为只读检查。",
    "B. 实际完成内容：检查 Personal Operator Console 的真实使用体验。",
    "C. 实际执行命令：",
    "- cmd /c pnpm run status:phase10a",
    "- cmd /c pnpm run health:phase12a",
    "- cmd /c pnpm run doctor:phase13a",
    "D. 实际修改文件：none",
    "E. 新增/刷新 evidence 路径：本轮只读检查，不刷新业务 evidence。",
    "F. 当前 blocker 是否为 none：none",
    "G. 是否修改 legacy/：否",
    "H. 是否创建 PROJECT_CONTEXT.md：否",
    "I. 是否 commit/push：否",
    "J. 是否调用 codex CLI：否；是否 codexExecInvoked：false",
    "K. 是否创建 worktree：否",
    "L. 是否接 workflow runner：否",
    "M. 验证结果：passed；边界保持 preview-only。",
    "",
  ].join("\n");
}

function renderRound2Mock() {
  return [
    "# Round 2 Mock Codex Result",
    "",
    "A. 前置条件检查结论：基本可读，但结果不完整。",
    "B. 实际完成内容：给出了一些 UI 观察。",
    "C. 操作记录：没有列出完整命令。",
    "D. 实际修改文件：none",
    "E. 产物说明：未提供。",
    "F. 当前 blocker 是否为 none：none",
    "G. 是否修改 legacy/：否",
    "H. 是否创建 PROJECT_CONTEXT.md：否",
    "I. 是否 commit/push：否",
    "J. 是否调用 codex CLI：否；是否 codexExecInvoked：false",
    "K. 是否创建 worktree：否",
    "L. 是否接 workflow runner：否",
    "M. 结论：需要补充。",
    "",
  ].join("\n");
}

function renderRound3Mock() {
  return [
    "# Round 3 Mock Codex Result",
    "",
    "A. 结论：no-go，模拟边界违规。",
    "B. 实际完成内容：声称修改了 legacy/ 下的历史文件。",
    "C. 实际执行命令：cmd /c pnpm run status:phase10a",
    "D. 实际修改文件：legacy/example.js",
    "E. 新增/刷新 evidence 路径：.codex-handoff/internal-runs/round-3/mock-codex-result.md",
    "F. 当前 blocker 是否为 none：boundary violation",
    "G. 是否修改 legacy/：是，模拟违规",
    "H. 是否创建 PROJECT_CONTEXT.md：否",
    "I. 是否 commit/push：否",
    "J. 是否调用 codex CLI：是，模拟违规；是否 codexExecInvoked：true",
    "K. 是否创建 worktree：否",
    "L. 是否接 workflow runner：否",
    "M. 验证结果：failed，必须停止。",
    "",
  ].join("\n");
}

function renderRoundSummaryMarkdown(summary) {
  return [
    `# ${summary.round} Internal Run Summary`,
    "",
    `- title: ${summary.title}`,
    `- expected: ${summary.expected}`,
    `- goNoGo: ${summary.goNoGo}`,
    `- expectationMet: ${summary.expectationMet}`,
    `- boundaryViolationCount: ${summary.boundaryViolationCount}`,
    `- verificationGapCount: ${summary.verificationGapCount}`,
    `- evidenceGapCount: ${summary.evidenceGapCount}`,
    `- recommendedNextAction: ${summary.recommendedNextAction}`,
    "- codexCliInvoked=false",
    "- codexExecInvoked=false",
    "- workflowRunnerEnabled=false",
    "- worktreeCreated=false",
    "- autoCommit=false",
    "- autoPush=false",
    "",
  ].join("\n");
}

function renderInternalSummaryMarkdown(summary) {
  return [
    "# Codex Desktop Internal Run Summary",
    "",
    `- round1Status: ${summary.round1Status}`,
    `- round2Status: ${summary.round2Status}`,
    `- round3Status: ${summary.round3Status}`,
    `- round1Expected: ${summary.round1Expected}`,
    `- round2Expected: ${summary.round2Expected}`,
    `- round3Expected: ${summary.round3Expected}`,
    `- allExpectationsMet: ${summary.allExpectationsMet}`,
    "- codexCliInvoked=false",
    "- codexExecInvoked=false",
    "- workflowRunnerEnabled=false",
    "- worktreeCreated=false",
    "- autoCommit=false",
    "- autoPush=false",
    "",
    "These are local mock tests only. They do not send to Codex Desktop and do not execute Codex.",
    "",
  ].join("\n");
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
