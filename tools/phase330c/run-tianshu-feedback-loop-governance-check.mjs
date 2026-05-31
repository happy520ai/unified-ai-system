import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { evaluateTianshuFeedbackEvent, feedbackGovernanceWorkflow } from "../../apps/ai-gateway-service/src/three-mode/tianshuFeedbackGovernance.js";
import { createTianshuFeedbackEventStore } from "../../apps/ai-gateway-service/src/three-mode/tianshuFeedbackEventStore.js";
import { createScoringPolicyReview } from "../../apps/ai-gateway-service/src/three-mode/tianshuScoringPolicyReview.js";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase330c");
const resultPath = resolve(evidenceDir, "tianshu-feedback-loop-governance-result.json");
const schemaPath = resolve(repoRoot, "docs/phase330c-feedback-event.schema.json");
const reviewPath = resolve(repoRoot, "docs/phase330c-scoring-policy-review-contract.json");
const reportPath = resolve(repoRoot, "docs/phase330c-feedback-loop-governance-report.md");

const event = {
  eventId: "phase330c-feedback-001",
  requestId: "phase330c-request-001",
  userIdRef: "user_anon",
  mode: "tianshu",
  taskType: "coding",
  selectedModels: ["meta/llama-3.2-1b-instruct"],
  plannerDecision: { executionMode: "single_model" },
  userFeedback: "helpful",
  outcomeSignal: "accepted",
  failureReason: "",
  fallbackUsed: false,
  costEstimate: 0.002,
  latencyMs: 1200,
  policyVersion: "phase329c-default",
  createdAt: new Date().toISOString(),
};
const governance = evaluateTianshuFeedbackEvent(event);
const store = createTianshuFeedbackEventStore();
await mkdir(evidenceDir, { recursive: true });
await store.append(event);
const review = createScoringPolicyReview({ feedbackEvents: [event], proposedWeightChanges: { capabilityMatch: 0.32 } });
const result = {
  phase: "Phase330C",
  governance,
  workflow: feedbackGovernanceWorkflow(),
  feedbackEventAccepted: governance.accepted,
  manualReviewQueue: true,
  trainingPerformed: false,
  embeddingBatchPerformed: false,
  autoApply: false,
  approvalRequired: true,
  review,
};
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(schemaPath, `${JSON.stringify(buildSchema(), null, 2)}\n`, "utf8");
await writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function buildSchema() {
  return {
    phase: "Phase330C",
    schemaName: "tianshu-feedback-event",
    required: ["eventId", "requestId", "userIdRef", "mode", "taskType", "selectedModels", "plannerDecision", "userFeedback", "outcomeSignal", "createdAt"],
    forbidden: ["promptSecret", "apiKey", "rawCredential", "sensitivePersonalData", "unredactedUserIdentifier"],
  };
}

function renderReport(result) {
  return [
    "# Phase330C Feedback Loop Governance Report",
    "",
    `- feedbackEventAccepted: ${result.feedbackEventAccepted}`,
    `- autoApply: ${result.autoApply}`,
    `- approvalRequired: ${result.approvalRequired}`,
    `- trainingPerformed: ${result.trainingPerformed}`,
    `- embeddingBatchPerformed: ${result.embeddingBatchPerformed}`,
    "",
  ].join("\n");
}
