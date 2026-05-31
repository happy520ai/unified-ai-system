import test from "node:test";
import assert from "node:assert/strict";

import { buildOpenCodeOneShotSeal } from "./opencodeOneShotSealCore.js";

test("buildOpenCodeOneShotSeal passes when a real inbox result, review, and feedback are present", () => {
  const seal = buildOpenCodeOneShotSeal({
    importedResult: {
      importedAt: "2026-05-30T12:00:00.000Z",
      source: "db-latest",
      sessionId: "ses_real",
      assistantMessageId: "msg_real",
      modelProvider: "nvidia",
      modelId: "nvidia/llama-3.1-nemotron-nano-8b-v1",
      textPartCount: 2,
      contentLength: 512,
    },
    review: {
      reviewedAt: "2026-05-30T12:01:00.000Z",
      goNoGo: "review-required",
      goalDirection: "insufficient-evidence",
      completionVerified: false,
    },
    feedbackExists: true,
  });

  assert.equal(seal.status, "passed");
  assert.equal(seal.blocker, "none");
  assert.equal(seal.intakeCaptured, true);
  assert.equal(seal.reviewGenerated, true);
  assert.equal(seal.feedbackGenerated, true);
  assert.equal(seal.sessionId, "ses_real");
});

test("buildOpenCodeOneShotSeal blocks honestly when no imported result exists", () => {
  const seal = buildOpenCodeOneShotSeal({
    importedResult: null,
    review: null,
    feedbackExists: false,
  });

  assert.equal(seal.status, "blocked");
  assert.equal(seal.blocker, "manual_result_missing");
  assert.equal(seal.intakeCaptured, false);
  assert.equal(seal.reviewGenerated, false);
  assert.equal(seal.feedbackGenerated, false);
});

test("buildOpenCodeOneShotSeal blocks when the imported result lacks a session id", () => {
  const seal = buildOpenCodeOneShotSeal({
    importedResult: {
      importedAt: "2026-05-30T12:00:00.000Z",
      source: "db-latest",
      sessionId: null,
      assistantMessageId: null,
      textPartCount: 0,
      contentLength: 0,
    },
    review: null,
    feedbackExists: false,
  });

  assert.equal(seal.status, "blocked");
  assert.equal(seal.blocker, "session_not_found");
});
