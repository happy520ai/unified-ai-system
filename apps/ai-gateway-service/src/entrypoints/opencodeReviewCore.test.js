import test from "node:test";
import assert from "node:assert/strict";

import { buildOpenCodeReview } from "./opencodeReviewCore.js";

test("buildOpenCodeReview returns go when boundaries are clean and evidence is present", () => {
  const review = buildOpenCodeReview({
    resultMarkdown: [
      "# OpenCode Result",
      "",
      "A. 前置条件检查结论：通过",
      "B. 修改文件列表：apps/ai-gateway-service/src/entrypoints/example.js",
      "Commands Run:",
      "- node --check apps/ai-gateway-service/src/entrypoints/example.js",
      "Changed Files:",
      "- apps/ai-gateway-service/src/entrypoints/example.js",
      "Evidence Paths:",
      "- apps/ai-gateway-service/evidence/phase3990a-opencode-controlled-loop-bridge/latest-summary.json",
      "Known Issues: none",
      "completionVerified: true",
      "M. 是否调用 paid API：否",
      "W. 验证命令和结果：通过",
    ].join("\n"),
    resultMetadata: {
      source: "db-latest",
      sessionId: "ses_safe",
      textPartCount: 1,
    },
    task: {
      taskId: "phase3990a-loop",
      title: "Phase3990A loop task",
    },
  });

  assert.equal(review.goNoGo, "go");
  assert.equal(review.goalDirection, "on-track");
  assert.equal(review.boundaryViolationCount, 0);
  assert.equal(review.completionVerified, true);
});

test("buildOpenCodeReview keeps no assistant text imports in review-required state", () => {
  const review = buildOpenCodeReview({
    resultMarkdown: [
      "# OpenCode Result",
      "",
      "No assistant text parts were captured from the latest repo session.",
    ].join("\n"),
    resultMetadata: {
      source: "db-latest",
      sessionId: "ses_empty",
      textPartCount: 0,
      toolPartCount: 1,
      toolErrorCount: 1,
    },
    task: {
      taskId: "phase3992a-loop",
      title: "Phase3992A loop task",
    },
  });

  assert.equal(review.goNoGo, "review-required");
  assert.equal(review.completionVerified, false);
  assert.equal(review.importedResult.textPartCount, 0);
  assert.ok(review.evidenceFindings.some((item) => item.id === "assistant_text_captured" && item.failed));
});

test("buildOpenCodeReview asks for more evidence when the output is not structured enough", () => {
  const review = buildOpenCodeReview({
    resultMarkdown: [
      "# OpenCode Result",
      "",
      "我看了几个文件，也许已经差不多了。",
      "后面可以继续试。",
    ].join("\n"),
    resultMetadata: {
      source: "db-latest",
      sessionId: "ses_partial",
    },
    task: {
      taskId: "phase3990a-loop",
      title: "Phase3990A loop task",
    },
  });

  assert.equal(review.goNoGo, "review-required");
  assert.equal(review.goalDirection, "insufficient-evidence");
  assert.equal(review.completionVerified, false);
  assert.ok(review.verificationGapCount > 0);
});

test("buildOpenCodeReview blocks boundary violations and marks the run off-track", () => {
  const review = buildOpenCodeReview({
    resultMarkdown: [
      "# OpenCode Result",
      "",
      "A. 前置条件检查结论：失败",
      "Changed Files:",
      "- legacy/example.js",
      "Commands Run:",
      "- git commit -m \"bad\"",
      "Known Issues: legacy/ was modified",
      "W. 验证命令和结果：失败",
    ].join("\n"),
    resultMetadata: {
      source: "db-latest",
      sessionId: "ses_bad",
    },
    task: {
      taskId: "phase3990a-loop",
      title: "Phase3990A loop task",
    },
  });

  assert.equal(review.goNoGo, "no-go");
  assert.equal(review.goalDirection, "off-track");
  assert.equal(review.completionVerified, false);
  assert.ok(review.boundaryViolationCount > 0);
});
