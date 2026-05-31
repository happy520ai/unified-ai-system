import {
  createDryRunInternalCommunicationBus,
  EMPLOYEE_COMMUNICATION_BUS_BOUNDARY,
} from "../../employee-communication-bus/src/index.js";

export function createInternalEmployeeBusBridge(envelope) {
  const bus = createDryRunInternalCommunicationBus();
  const productReview = bus.runScenarioProductUxReview();
  const securityObjection = bus.runScenarioSecurityObjection();
  const councilSummary = bus.runScenarioCouncilSummary();
  return {
    bridgeId: "phase578-internal-bus-bridge",
    envelopeId: envelope.envelopeId,
    internalOnly: true,
    dryRunOnly: true,
    busBoundary: {
      ...EMPLOYEE_COMMUNICATION_BUS_BOUNDARY,
      phase: "Phase578B",
    },
    threads: [productReview.thread],
    messages: [
      ...productReview.messages,
      securityObjection.objectionMessage,
      councilSummary.summary,
      councilSummary.finalRecommendation,
    ],
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
    realFeishuMessageSent: false,
    realWeComMessageSent: false,
  };
}

export function validateInternalEmployeeBusBridge(bridge) {
  const messageCount = Array.isArray(bridge?.messages) ? bridge.messages.length : 0;
  return {
    valid:
      bridge?.internalOnly === true &&
      bridge?.dryRunOnly === true &&
      bridge?.busBoundary?.maxActiveEmployees <= 3 &&
      bridge?.busBoundary?.maxBrainCalls === 0 &&
      messageCount >= 4 &&
      bridge?.providerCallsMade === false &&
      bridge?.rawSecretAccessed === false &&
      bridge?.secretValueExposed === false &&
      bridge?.realFeishuMessageSent === false &&
      bridge?.realWeComMessageSent === false,
    messageCount,
  };
}
