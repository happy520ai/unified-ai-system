import test from "node:test";
import assert from "node:assert/strict";

import { buildOpenCodeNextRoundTask } from "./opencodeNextRoundTaskCore.js";

test("buildOpenCodeNextRoundTask turns review-required findings into a structured next-round task", () => {
  const result = buildOpenCodeNextRoundTask({
    previousTask: {
      taskId: "phase3990a-opencode-controlled-loop-bridge",
      title: "Phase3990A OpenCode Controlled Loop Bridge",
      projectRoot: "E:/AI-Data/AI网关系统/unified-ai-system/.opencode-handoff/outbox",
    },
    review: {
      goNoGo: "review-required",
      goalDirection: "insufficient-evidence",
      recommendedNextAction: "要求 OpenCode 补齐结构化结果。",
      verificationFindings: [
        { label: "包含执行命令列表", failed: true },
        { label: "包含修改文件列表", failed: true },
      ],
      evidenceFindings: [
        { label: "明确说明是否 completionVerified", failed: true },
      ],
      importedResult: {
        sessionId: "ses_real",
        modelProvider: "xiaomi",
        modelId: "mimo-v2.5-pro",
      },
    },
    feedbackMarkdown: "# 反馈给 OpenCode\n\n请补齐命令与 evidence。",
  });

  assert.equal(result.task.taskId, "phase3992a-opencode-feedback-driven-next-round");
  assert.equal(result.task.projectRoot, "E:/AI-Data/AI网关系统/unified-ai-system");
  assert.equal(result.task.sourceReviewDecision, "review-required");
  assert.match(result.task.markdown, /Commands Run/);
  assert.match(result.task.markdown, /Changed Files/);
  assert.match(result.task.markdown, /Evidence Paths/);
  assert.match(result.task.markdown, /completionVerified/);
  assert.match(result.task.markdown, /sessionId: ses_real/);
});

test("buildOpenCodeNextRoundTask blocks when the latest review is not review-required", () => {
  assert.throws(
    () => buildOpenCodeNextRoundTask({
      previousTask: { projectRoot: "E:/AI-Data/AI网关系统/unified-ai-system" },
      review: { goNoGo: "go" },
      feedbackMarkdown: "# feedback",
    }),
    /review-required/i,
  );
});
