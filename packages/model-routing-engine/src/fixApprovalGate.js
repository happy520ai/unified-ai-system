export function buildFixApprovalGateSchema() {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "Fix approval gate input",
    type: "object",
    required: ["issueId", "approvedByOwner", "approvalScope"],
    properties: {
      issueId: { type: "string", minLength: 1 },
      approvedByOwner: { type: "boolean" },
      approvalScope: { type: "string" },
      allowLowRiskFix: { type: "boolean", default: false },
      allowUiFix: { type: "boolean", default: false },
      allowDocsFix: { type: "boolean", default: false },
      allowRouteFix: { type: "boolean", default: false },
      allowProviderFix: { type: "boolean", default: false },
      allowSecretFix: { type: "boolean", default: false },
      allowChatMutation: { type: "boolean", default: false },
      allowDeploy: { type: "boolean", default: false }
    }
  };
}

export function buildDefaultFixApprovalInput() {
  return {
    issueId: "",
    approvedByOwner: false,
    approvalScope: "docs-copy-dry-run-only",
    allowLowRiskFix: false,
    allowUiFix: false,
    allowDocsFix: true,
    allowRouteFix: false,
    allowProviderFix: false,
    allowSecretFix: false,
    allowChatMutation: false,
    allowDeploy: false
  };
}
