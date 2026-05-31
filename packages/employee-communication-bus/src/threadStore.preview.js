import { createEmployeeThread, validateEmployeeThread } from "../../employee-communication-contracts/src/index.js";

export function createThreadStorePreview() {
  const threads = new Map();
  return {
    createThread(input = {}) {
      const thread = createEmployeeThread(input);
      const validation = validateEmployeeThread(thread);
      if (!validation.valid) return { created: false, thread, validation };
      threads.set(thread.threadId, thread);
      return { created: true, thread, validation };
    },
    appendEvidence(threadId, event) {
      const thread = threads.get(threadId);
      if (!thread) return false;
      thread.evidenceTimeline = [...thread.evidenceTimeline, event];
      thread.updatedAt = new Date(0).toISOString();
      return true;
    },
    get(threadId) {
      return threads.get(threadId) || null;
    },
    list() {
      return [...threads.values()];
    },
  };
}
