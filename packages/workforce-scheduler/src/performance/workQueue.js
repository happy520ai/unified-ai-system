export const workQueuePolicy = Object.freeze({
  queueMaxDepth: 20,
  maxConcurrentWorkforceTasks: 2,
  fallbackOnOverload: true,
  evidenceRequired: true,
});

export function evaluateQueueAdmission(queueDepth, policy = workQueuePolicy) {
  return {
    accepted: queueDepth < policy.queueMaxDepth,
    queueDepth,
    queueMaxDepth: policy.queueMaxDepth,
  };
}

