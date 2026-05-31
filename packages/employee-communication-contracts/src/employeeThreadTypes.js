import { EMPLOYEE_THREAD_STATUSES } from "./messageTypeEnums.js";

export const EMPLOYEE_THREAD_REQUIRED_FIELDS = Object.freeze([
  "threadId",
  "taskRef",
  "title",
  "ownerEmployeeId",
  "participantEmployeeIds",
  "status",
  "riskLevel",
  "createdBy",
  "createdAt",
  "updatedAt",
  "evidenceTimeline",
  "dryRunOnly",
]);

export function createEmployeeThread(overrides = {}) {
  const createdAt = overrides.createdAt || new Date(0).toISOString();
  return {
    threadId: "thread.preview.onboarding-friction",
    taskRef: "taskRef.preview.onboarding-friction",
    title: "Sample dry-run onboarding friction review",
    ownerEmployeeId: "emp-product-chief",
    participantEmployeeIds: ["emp-product-chief", "emp-ux-researcher"],
    status: "waiting_for_reply",
    riskLevel: "medium",
    createdBy: "workforce-scheduler",
    createdAt,
    updatedAt: overrides.updatedAt || createdAt,
    evidenceTimeline: ["thread_created"],
    dryRunOnly: true,
    ...overrides,
  };
}

export function validateEmployeeThread(thread) {
  const errors = [];
  if (!thread || typeof thread !== "object") errors.push("thread must be an object");
  for (const field of EMPLOYEE_THREAD_REQUIRED_FIELDS) {
    if (thread?.[field] === undefined) errors.push(`missing field: ${field}`);
  }
  if (!EMPLOYEE_THREAD_STATUSES.includes(thread?.status)) errors.push("unsupported thread status");
  if (!Array.isArray(thread?.participantEmployeeIds) || thread.participantEmployeeIds.length < 1) errors.push("participants required");
  if (!Array.isArray(thread?.evidenceTimeline)) errors.push("evidenceTimeline must be an array");
  if (thread?.dryRunOnly !== true) errors.push("thread must be dryRunOnly");
  return { valid: errors.length === 0, errors };
}
