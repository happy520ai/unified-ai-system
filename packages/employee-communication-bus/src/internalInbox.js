import { validateEmployeeMessageEnvelope } from "../../employee-communication-contracts/src/index.js";

export function createInternalInbox() {
  const messages = [];
  return {
    receive(message) {
      const validation = validateEmployeeMessageEnvelope(message);
      if (!validation.valid) return { accepted: false, message, validation };
      messages.push(message);
      return { accepted: true, message, validation, count: messages.length };
    },
    list() {
      return [...messages];
    },
  };
}
