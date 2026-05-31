export function buildTianshuPolicyDryRunPanel(dryRunResult = {}) {
  return {
    dryRunPanelVisible: true,
    dryRunActionVisible: true,
    dryRunCompleted: dryRunResult.passed === true,
    policyActivated: false,
    activationAllowed: false,
    trainingPerformed: false,
    embeddingBatchPerformed: false,
  };
}
