import { validateEmployeeMessageEnvelope } from "../../employee-communication-contracts/src/index.js";

export function createInternalOutbox() {
  const messages = [];
  return {
    send(message) {
      const validation = validateEmployeeMessageEnvelope(message);
      if (!validation.valid) return { sent: false, message, validation };
      messages.push(message);
      return { sent: true, message, validation, count: messages.length };
    },
    list() {
      return [...messages];
    },
  };
}
