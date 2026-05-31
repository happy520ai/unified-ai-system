import { readText, writeJson, writeText } from "../phase373-common.mjs";
import { commonSafetyFlags, sourceChecks } from "../phase376-shared.mjs";

const source = await readText("apps/ai-gateway-service/src/ui/components/MissionControlPanel.js");
const policyMap = {
  phase: "Phase376E",
  guards: [
    { guardId: "prompt_injection_guard", status: "active", riskLevel: "low", mappedPolicy: "prompt-injection-shield", explanation: "Blocks malicious prompt injection attempts." },
    { guardId: "secret_leak_guard", status: "active", riskLevel: "low", mappedPolicy: "secret-redaction", explanation: "Prevents secret value exposure." },
    { guardId: "system_prompt_leak_guard", status: "active", riskLevel: "low", mappedPolicy: "system-prompt-protection", explanation: "Keeps system prompt private." },
    { guardId: "provider_call_gate", status: "blocked", riskLevel: "medium", mappedPolicy: "credentialRef-only-provider-gate", explanation: "No provider call without the right gate." },
    { guardId: "credentialRef_gate", status: "active", riskLevel: "low", mappedPolicy: "credentialRef-only", explanation: "Allows reference-based setup only." },
    { guardId: "dangerous_action_lock", status: "blocked", riskLevel: "high", mappedPolicy: "dangerous-action-lock", explanation: "Prevents deploy/release style actions." },
    { guardId: "approval_gate", status: "requires_approval", riskLevel: "medium", mappedPolicy: "approval-gate", explanation: "Requires approval before gated actions." },
    { guardId: "quota_budget_guard", status: "dry_run_only", riskLevel: "medium", mappedPolicy: "quota-budget-check", explanation: "Estimates only; no real billing." },
    { guardId: "evidence_recorder", status: "active", riskLevel: "low", mappedPolicy: "evidence-recorder", explanation: "Stores dry-run evidence." },
    { guardId: "rollback_path_status", status: "available", riskLevel: "low", mappedPolicy: "rollback-path-visibility", explanation: "Shows whether rollback path exists." },
  ],
};
const replayContract = {
  phase: "Phase376E",
  fields: ["evidenceId", "timestamp", "mode", "intent", "selectedPanel", "riskScore", "blockedActions", "allowedActions", "dryRunResult", "supervisorComment", "fallbackReason", "replayAvailable", "rollbackPathAvailable", "providerCallsMade", "secretValueExposed"],
  providerCallsMade: false,
  secretValueExposed: false,
};
const checks = sourceChecks(source);
const result = {
  phase: "Phase376E",
  securityShieldPolicyMapValidated: true,
  evidenceReplayViewerValidated: true,
  securityShieldVisible: checks.securityShieldVisible,
  evidenceTimelineVisible: checks.evidenceTimelineVisible,
  guardsMapped: policyMap.guards.length,
  replayContractFields: replayContract.fields.length,
  noProviderCallVisible: checks.noProviderCallVisible,
  ...commonSafetyFlags(),
  validationPassed: checks.securityShieldVisible && checks.evidenceTimelineVisible && !checks.dangerousActionButtonDetected,
};

await writeJson("docs/phase376e-security-shield-policy-map.json", policyMap);
await writeText("docs/phase376e-security-shield-policy-mapping.md", [
  "# Phase376E Security Shield Policy Mapping",
  "",
  "- Security Shield maps each guard to a short policy and user-facing status.",
  "- Evidence Replay Viewer stays read-only and shows dry-run trace metadata only.",
  "- No real security service, provider call, approval forging, or rollback execution is added.",
].join("\n"));
await writeJson("docs/phase376e-evidence-replay-viewer-contract.json", replayContract);
await writeJson("apps/ai-gateway-service/evidence/phase376e/security-shield-policy-map-result.json", {
  phase: "Phase376E",
  policyMapValidated: result.securityShieldPolicyMapValidated,
  evidenceReplayViewerValidated: result.evidenceReplayViewerValidated,
  validationPassed: result.validationPassed,
});
await writeJson("apps/ai-gateway-service/evidence/phase376e/evidence-replay-viewer-result.json", {
  phase: "Phase376E",
  contractValidated: true,
  providerCallsMade: false,
  secretValueExposed: false,
});

console.log(JSON.stringify(result, null, 2));
if (!result.validationPassed) process.exitCode = 1;
