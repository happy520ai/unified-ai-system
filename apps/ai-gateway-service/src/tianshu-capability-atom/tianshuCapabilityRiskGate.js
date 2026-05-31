const FORBIDDEN_EFFECTS = new Set(["deploy", "release", "tag", "artifact", "write_file"]);

export function evaluateCapabilityRiskGate(atoms, options = {}) {
  const providerAuthorized = options.providerAuthorized === true;
  const ownerApprovalPresent = options.ownerApprovalPresent === true;
  const blockedCapabilities = [];
  const approvalRequiredCapabilities = [];
  const dryRunOnlyCapabilities = [];
  let dynamicCodeExecutionDetected = false;
  let networkFetchDetected = false;
  let chatGatewayExecuteModificationDetected = false;

  for (const atom of atoms) {
    const atomJson = JSON.stringify(atom);
    const dynamicCodePattern = new RegExp(String.raw`\b(eval\s*\(|${"new"} ${"Function"}|vm\.runIn|exec\s*\()`, "u");
    if (dynamicCodePattern.test(atomJson)) dynamicCodeExecutionDetected = true;
    if (/\b(fetch|http:\/\/|https:\/\/|p2p|npm|pypi)\b/iu.test(atomJson)) networkFetchDetected = true;
    if (/chat-gateway\/execute/u.test(atomJson) && atom.allowedEffects?.includes("write_file")) chatGatewayExecuteModificationDetected = true;

    const reasons = [];
    if (atom.requiresSecret === true) reasons.push("requires_secret_blocked");
    if (atom.requiresProvider === true && !providerAuthorized) reasons.push("requires_provider_without_authorization");
    if (atom.allowedEffects?.some((effect) => ["deploy", "release", "tag", "artifact"].includes(effect))) {
      reasons.push("release_effect_forbidden");
    }
    if (atom.allowedEffects?.includes("write_file") && !ownerApprovalPresent) reasons.push("write_file_requires_owner_approval");
    if (atom.allowedEffects?.some((effect) => FORBIDDEN_EFFECTS.has(effect))) reasons.push("forbidden_effect_detected");
    if (reasons.length > 0 || atom.riskLevel === "blocked") {
      blockedCapabilities.push({
        atomId: atom.atomId,
        title: atom.title,
        blocker: atom.blocker ?? reasons[0] ?? "capability_blocked",
        reasons,
      });
    }
    if (atom.requiresHumanApproval === true) approvalRequiredCapabilities.push(atom.title);
    if (atom.supportsDryRun === true) dryRunOnlyCapabilities.push(atom.title);
  }

  const forbiddenCapabilityBlocked = blockedCapabilities.length > 0
    && blockedCapabilities.some((item) => item.title === "provider_stability_check");
  return {
    riskGatePassed: !dynamicCodeExecutionDetected
      && !networkFetchDetected
      && !chatGatewayExecuteModificationDetected
      && forbiddenCapabilityBlocked,
    forbiddenCapabilityBlocked,
    blockedCapabilities,
    approvalRequiredCapabilities,
    dryRunOnlyCapabilities,
    dynamicCodeExecutionDetected,
    networkFetchDetected,
    chatGatewayExecuteModificationDetected,
    executionAllowed: false,
  };
}
