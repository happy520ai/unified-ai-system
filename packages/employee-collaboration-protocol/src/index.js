export * from "./collaborationPolicy.js";
export * from "./reviewProtocol.js";
export * from "./handoffProtocol.js";
export * from "./objectionProtocol.js";
export * from "./approvalRequestProtocol.js";
export * from "./summaryProtocol.js";
export * from "./finalRecommendationProtocol.js";

export const EMPLOYEE_COLLABORATION_PROTOCOL_BOUNDARY = Object.freeze({
  phase: "Phase587",
  internalOnly: true,
  externalImConnectorUsed: false,
  schedulerApprovalRequiredForNewParticipants: true,
  maxActiveEmployees: 3,
  maxBrainCalls: 0,
  dryRunOnly: true,
});
