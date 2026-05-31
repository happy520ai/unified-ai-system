import test from "node:test";
import assert from "node:assert/strict";

import {
  buildInboxImportFromSession,
  parseModelDescriptor,
  pickCandidateSession,
} from "./opencodeDbSafeReader.js";

const repoRoot = "E:/AI-Data/AI网关系统/unified-ai-system";

test("pickCandidateSession prefers repo-matching sessions updated after send time", () => {
  const selected = pickCandidateSession({
    repoRoot,
    sentAfterMs: 2000,
    sessions: [
      {
        id: "ses_old_repo",
        path: repoRoot,
        directory: repoRoot,
        timeUpdatedMs: 1500,
      },
      {
        id: "ses_new_repo",
        path: repoRoot,
        directory: repoRoot,
        timeUpdatedMs: 2500,
      },
      {
        id: "ses_other_repo",
        path: "E:/other-project",
        directory: "E:/other-project",
        timeUpdatedMs: 4000,
      },
    ],
  });

  assert.equal(selected?.id, "ses_new_repo");
});

test("pickCandidateSession falls back to the newest repo session when no send-time match exists", () => {
  const selected = pickCandidateSession({
    repoRoot,
    sentAfterMs: 5000,
    sessions: [
      {
        id: "ses_1",
        path: repoRoot,
        directory: repoRoot,
        timeUpdatedMs: 1000,
      },
      {
        id: "ses_2",
        path: repoRoot,
        directory: repoRoot,
        timeUpdatedMs: 3000,
      },
      {
        id: "ses_3",
        path: "E:/other-project",
        directory: "E:/other-project",
        timeUpdatedMs: 9000,
      },
    ],
  });

  assert.equal(selected?.id, "ses_2");
});

test("buildInboxImportFromSession keeps public assistant text and excludes reasoning text", () => {
  const imported = buildInboxImportFromSession({
    importedAt: "2026-05-30T08:00:00.000Z",
    session: {
      id: "ses_safe",
      title: "Safe loop run",
      agent: "phase-orchestrator",
      path: repoRoot,
      directory: repoRoot,
      model: "{\"id\":\"nvidia/llama-3.1-nemotron-nano-8b-v1\",\"providerID\":\"nvidia\"}",
      timeUpdatedMs: 3000,
    },
    assistantMessage: {
      id: "msg_safe",
      timeUpdatedMs: 3000,
    },
    parts: [
      {
        type: "reasoning",
        text: "hidden chain of thought",
      },
      {
        type: "text",
        text: "A. 前置条件检查结论：通过",
      },
      {
        type: "text",
        text: "W. 验证命令和结果：node --check passed",
      },
      {
        type: "tool",
        state: {
          status: "error",
        },
      },
      {
        type: "patch",
      },
    ],
  });

  assert.equal(imported.metadata.sessionId, "ses_safe");
  assert.equal(imported.metadata.modelProvider, "nvidia");
  assert.equal(imported.metadata.modelId, "nvidia/llama-3.1-nemotron-nano-8b-v1");
  assert.equal(imported.metadata.reasoningPartCount, 1);
  assert.equal(imported.metadata.toolErrorCount, 1);
  assert.equal(imported.metadata.patchPartCount, 1);
  assert.match(imported.markdown, /A\. 前置条件检查结论：通过/);
  assert.match(imported.markdown, /W\. 验证命令和结果：node --check passed/);
  assert.doesNotMatch(imported.markdown, /hidden chain of thought/);
});

test("parseModelDescriptor safely handles invalid model json", () => {
  const parsed = parseModelDescriptor("{not-json");

  assert.equal(parsed.modelId, null);
  assert.equal(parsed.providerId, null);
});
