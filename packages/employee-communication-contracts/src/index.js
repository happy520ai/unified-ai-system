export * from "./messageTypeEnums.js";
export * from "./employeeMessageEnvelopeTypes.js";
export * from "./employeeThreadTypes.js";
export * from "./employeeRoomTypes.js";
export * from "./employeeMentionTypes.js";
export * from "./employeeHandoffTypes.js";
export * from "./employeeCollaborationDecisionTypes.js";
export * from "./employeeCommunicationValidation.js";

export const EMPLOYEE_INTERNAL_COMMUNICATION_CONTRACT_BOUNDARY = Object.freeze({
  phase: "Phase587",
  protocol: "unified_employee_message_protocol",
  internalBusOnly: true,
  externalImConnectorUsed: false,
  employeeCallsProviderDirectly: false,
  employeeCallsChatGatewayExecuteDirectly: false,
  schedulerControlsFanout: true,
  maxBrainCalls: 0,
  dryRunOnly: true,
  providerCallsMade: false,
  rawSecretAccessed: false,
  secretValueExposed: false,
  realFeishuMessageSent: false,
  realWeComMessageSent: false,
});
