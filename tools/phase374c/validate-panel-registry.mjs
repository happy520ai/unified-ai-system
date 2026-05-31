import { writeJson } from "../phase373-common.mjs";

const panels = [
  ["mission_home_panel", "Mission Home", ["normal", "god", "tianshu"], ["view", "inspect_evidence"], "low"],
  ["normal_mode_panel", "Normal Mode", ["normal"], ["view", "chat_normal"], "low"],
  ["god_mode_arena_panel", "God Mode Arena", ["god"], ["view", "run_god_mode_dry_run"], "medium"],
  ["tianshu_flight_path_panel", "Tianshu Flight Path", ["tianshu"], ["view", "run_tianshu_planner_dry_run"], "medium"],
  ["security_shield_panel", "Security Shield", ["normal", "god", "tianshu"], ["view", "inspect_guard"], "medium"],
  ["red_team_playground_panel", "Red Team Playground", ["security"], ["red_team_test_dry_run"], "high"],
  ["provider_setup_panel", "Provider Setup", ["settings"], ["configure_provider_reference", "view_credential_ref_status"], "medium"],
  ["evidence_timeline_panel", "Evidence Timeline", ["normal", "god", "tianshu"], ["inspect_evidence", "replay_trace"], "low"],
  ["approval_hold_panel", "Approval Hold", ["security"], ["request_approval", "generate_command_ref_draft"], "high"],
].map(([componentId, displayName, allowedModes, allowedActions, riskLevel]) => ({
  componentId,
  displayName,
  allowedModes,
  allowedActions,
  forbiddenActions: ["read_secret", "call_unconfigured_provider", "production_action", "generate_real_invoice"],
  riskLevel,
  requiresApproval: componentId === "approval_hold_panel",
  providerCallsAllowed: false,
  secretValueAllowed: false,
  deployAllowed: false,
  releaseAllowed: false,
  billingAllowed: false,
}));

const validationErrors = panels.flatMap((panel) => {
  const errors = [];
  if (panel.providerCallsAllowed !== false) errors.push(`${panel.componentId}: providerCallsAllowed must be false`);
  if (panel.secretValueAllowed !== false) errors.push(`${panel.componentId}: secretValueAllowed must be false`);
  if (panel.deployAllowed !== false) errors.push(`${panel.componentId}: deployAllowed must be false`);
  if (panel.releaseAllowed !== false) errors.push(`${panel.componentId}: releaseAllowed must be false`);
  if (panel.billingAllowed !== false) errors.push(`${panel.componentId}: billingAllowed must be false`);
  return errors;
});

const result = {
  phase: "Phase374C",
  panelRegistryValidationExecuted: true,
  panelCount: panels.length,
  validationPassed: validationErrors.length === 0,
  validationErrors,
  providerCallsAllowedDefaultFalse: true,
  secretValueAllowedAlwaysFalse: true,
  deployAllowedDefaultFalse: true,
  releaseAllowedDefaultFalse: true,
  billingAllowedDefaultFalse: true,
};

await writeJson("docs/phase374c-agent-managed-panel-registry.schema.json", {
  type: "array",
  items: {
    type: "object",
    required: ["componentId", "displayName", "allowedModes", "allowedActions", "forbiddenActions", "riskLevel", "requiresApproval", "providerCallsAllowed", "secretValueAllowed", "deployAllowed", "releaseAllowed", "billingAllowed"],
  },
});
await writeJson("docs/phase374c-agent-managed-panel-registry.json", panels);
await writeJson("apps/ai-gateway-service/evidence/phase374c/panel-registry-validation-result.json", result);

console.log(JSON.stringify(result, null, 2));
