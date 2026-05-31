export const EMPLOYEE_INTERNAL_MESSAGE_TYPES = Object.freeze([
  "ask",
  "reply",
  "review_request",
  "review_result",
  "handoff",
  "clarification",
  "objection",
  "approval_request",
  "approval_result",
  "reject",
  "summary",
  "final_recommendation",
]);

export const EMPLOYEE_THREAD_STATUSES = Object.freeze([
  "open",
  "waiting_for_reply",
  "under_review",
  "blocked",
  "completed",
  "rejected",
]);

export const EMPLOYEE_ROOM_TYPES = Object.freeze([
  "domain_room",
  "task_room",
  "review_room",
  "approval_room",
  "incident_room",
]);

export const EMPLOYEE_COLLABORATION_MODES = Object.freeze([
  "solo",
  "pair_review",
  "council_review",
  "domain_handoff",
  "governor_review",
]);

export const PHASE587_FANOUT_LIMITS = Object.freeze({
  maxCandidateEmployees: 5,
  maxActiveEmployees: 3,
  maxBrainCalls: 0,
  requireEvidence: true,
  requireApprovalForProviderCall: true,
});
