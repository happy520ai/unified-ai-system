import { sha256Hex } from "./hash.js";

export function createTaskCapsule({ selectedTask, riskDecision, mutationPlan, verifierResult, rollbackStatus, nextActionReason } = {}) {
  const capsule = {
    selectedTask: selectedTask || {},
    riskDecision: riskDecision || {},
    mutationPlan: mutationPlan || { mutations: [] },
    verifierResult: verifierResult || {},
    rollbackStatus: rollbackStatus || {},
    nextActionReason: String(nextActionReason || ""),
    providerCallsMade: false,
    secretRead: false,
  };
  return {
    ...capsule,
    capsuleHash: sha256Hex(capsule).slice(0, 32),
  };
}
