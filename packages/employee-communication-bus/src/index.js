export * from "./internalInbox.js";
export * from "./internalOutbox.js";
export * from "./threadStore.preview.js";
export * from "./roomRegistry.preview.js";
export * from "./messageRouter.js";
export * from "./mentionRouter.js";
export * from "./handoffRouter.js";
export * from "./replyRouter.js";
export * from "./collaborationEvidenceBuilder.js";
export * from "./dryRunInternalCommunicationBus.js";

export const EMPLOYEE_COMMUNICATION_BUS_BOUNDARY = Object.freeze({
  phase: "Phase587",
  internalOnly: true,
  externalImConnectorUsed: false,
  noAllEmployeeBroadcast: true,
  schedulerControlsFanout: true,
  maxCandidateEmployees: 5,
  maxActiveEmployees: 3,
  maxBrainCalls: 0,
  dryRunOnly: true,
  providerCallsMade: false,
  rawSecretAccessed: false,
  secretValueExposed: false,
  realFeishuMessageSent: false,
  realWeComMessageSent: false,
});
