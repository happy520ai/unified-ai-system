import { validateEmployeeMessageEnvelope } from "./employeeMessageEnvelopeTypes.js";
import { validateEmployeeThread } from "./employeeThreadTypes.js";
import { validateEmployeeRoom } from "./employeeRoomTypes.js";
import { validateEmployeeMention } from "./employeeMentionTypes.js";
import { validateEmployeeHandoff } from "./employeeHandoffTypes.js";
import { validateEmployeeCollaborationDecision } from "./employeeCollaborationDecisionTypes.js";

export function mergeEmployeeCommunicationValidation(results) {
  const errors = results.flatMap((result) => result.errors || []);
  return { valid: errors.length === 0, errors };
}

export function validateEmployeeCommunicationBundle(bundle) {
  return mergeEmployeeCommunicationValidation([
    validateEmployeeMessageEnvelope(bundle.message),
    validateEmployeeThread(bundle.thread),
    validateEmployeeRoom(bundle.room),
    validateEmployeeMention(bundle.mention),
    validateEmployeeHandoff(bundle.handoff),
    validateEmployeeCollaborationDecision(bundle.decision),
  ]);
}
