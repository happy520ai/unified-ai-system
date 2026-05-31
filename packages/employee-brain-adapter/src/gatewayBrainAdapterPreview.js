import { createPreviewBrainBinding } from "./modelBrainBindingPolicy.js";
import { assertCredentialRefBoundary } from "./credentialRefBoundary.js";
import { buildBrainCallEvidence } from "./brainCallEvidence.js";

export function buildGatewayBrainAdapterPreview({ employee, taskUnderstanding }) {
  const binding = createPreviewBrainBinding({
    ...(employee?.brainBinding || {}),
    mode: "gateway_adapter_preview",
  });
  const credentialBoundary = assertCredentialRefBoundary();
  return {
    mode: "gateway_adapter_preview",
    gatewayCopied: false,
    chatGatewayExecuteCalled: false,
    previewRoute: "Workforce Scheduler -> Employee Brain Adapter -> Existing Gateway Adapter Preview",
    providerRef: binding.providerRef,
    modelRef: binding.modelRef,
    credentialRef: binding.credentialRef,
    credentialBoundary,
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
    approvalRequiredForRealProviderCall: true,
    evidence: buildBrainCallEvidence({
      employeeId: employee.employeeId,
      title: employee.title,
      taskType: taskUnderstanding.taskType,
      binding,
    }),
  };
}
