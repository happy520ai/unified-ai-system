import {
  ensure,
  phase383Safety,
  readJson,
  readText,
  writeJson,
  writeText,
} from "../phase383-common.mjs";

const state = await readJson("docs/phase-orchestrator/current-phase-state.json");
const registry = await readJson("docs/phase-orchestrator/phase-registry.json");
const policy = await readJson("docs/phase-orchestrator/phase-risk-policy.json");
let overrides = { overrides: [] };
try {
  overrides = await readJson("docs/phase-orchestrator/phase-next-resolution-overrides.json");
} catch {
  overrides = { overrides: [] };
}

function registryPhase(phase) {
  return registry.phases.find((item) => item.phase === phase);
}

function validateRegistryUniquePhaseIds() {
  const seen = new Map();
  const mismatches = [];
  for (const item of registry.phases || []) {
    const previousTitle = seen.get(item.phase);
    if (previousTitle !== undefined && previousTitle !== item.title) {
      mismatches.push({ phase: item.phase, previousTitle, title: item.title });
    }
    seen.set(item.phase, item.title);
  }
  return mismatches;
}

function applyNextPhaseOverride(item) {
  if (!item || typeof item === "string") return item;
  const title = String(item.title || "");
  const matched = (overrides.overrides || []).find((override) =>
    override.sourcePhase === state.latestPhase &&
    override.oldNextPhase === item.phase &&
    title.toLowerCase().includes(String(override.oldTitleContains || "").toLowerCase()),
  );
  if (!matched) return item;
  return {
    ...item,
    phase: matched.newNextPhase,
    title: matched.newTitle,
    riskLevel: matched.riskLevel,
    requiresHumanApproval: matched.requiresHumanApproval,
    autoContinueAllowed: matched.autoContinueAllowed,
    overrideApplied: true,
    overrideReason: matched.reason,
    originalPhase: item.phase,
    originalTitle: item.title,
  };
}

function selectNextPhase() {
  const recommended = Array.isArray(state.nextRecommendedPhases) ? state.nextRecommendedPhases : [];
  for (const item of recommended) {
    const resolved = applyNextPhaseOverride(item);
    const phase = typeof resolved === "string" ? resolved : resolved.phase;
    const registered = registryPhase(phase);
    if (registered) {
      return {
        ...registered,
        recommendation: typeof resolved === "string" ? { phase: resolved } : resolved,
      };
    }
  }
  for (const phase of registry.selectionOrder || []) {
    const registered = registryPhase(phase);
    if (registered?.futurePhase === true) return registered;
  }
  return null;
}

const selected = selectNextPhase();
ensure(selected, "No registered next phase could be selected.");

const blockedReasons = [];
const safety = state.safety || {};
const registryMismatches = validateRegistryUniquePhaseIds();
if (registryMismatches.length > 0) blockedReasons.push("phase_registry_title_mismatch");

if (state.completed !== true) blockedReasons.push("latest_phase_not_completed");
if (state.recommended_sealed !== true) blockedReasons.push("latest_phase_not_recommended_sealed");
if (state.blocker !== null && state.blocker !== undefined) blockedReasons.push(`latest_phase_blocker_${state.blocker}`);
if (state.validationsPassed !== true) blockedReasons.push("latest_phase_validations_not_passed");

const safetyBrakeKeys = [
  "nonNvidiaProviderCallsMade",
  "secretValueExposed",
  "rawSecretAccessed",
  "deployExecuted",
  "releaseExecuted",
  "tagCreated",
  "artifactUploaded",
  "approvalForged",
  "billingExecuted",
  "invoiceGenerated",
  "productionGaClaimed",
  "dangerousActionButtonDetected",
  "workspaceCleanClaimed",
];

for (const key of safetyBrakeKeys) {
  if (safety[key] === true) blockedReasons.push(`${key}_true`);
}

if (safety.providerCallsMade === true && state.providerCallExplicitlyAllowed !== true) {
  blockedReasons.push("provider_call_without_phase_authorization");
}
if (safety.evidenceModified === true && state.latestPhase !== "Phase383") {
  blockedReasons.push("unexpected_evidence_modified_flag");
}

const riskLevel = selected.riskLevel || "high";
const riskPolicy = policy.riskLevels?.[riskLevel] || policy.riskLevels?.high;
const forbiddenActions = Array.isArray(selected.forbiddenActions) ? selected.forbiddenActions : [];
const touchesHighRisk = forbiddenActions.some((action) =>
  [
    "real_provider_call",
    "provider_call",
    "read_secret",
    "deploy",
    "release",
    "billing",
    "invoice",
    "modify_provider_runtime",
    "modify_chat_gateway_execute",
  ].includes(action),
);

let humanApprovalRequired = selected.requiresHumanApproval === true || riskPolicy?.humanApprovalRequired === true;
if (riskLevel === "high") {
  humanApprovalRequired = true;
  blockedReasons.push("high_risk_phase_requires_human_approval");
}
if (touchesHighRisk && riskLevel === "high") {
  humanApprovalRequired = true;
  blockedReasons.push("next_phase_touches_high_risk_scope");
}
if (selected.phase === "Phase384") {
  humanApprovalRequired = true;
  blockedReasons.push("real_provider_test_requires_explicit_authorization");
}

let nextPromptMismatch = false;
try {
  const existingMeta = await readJson("docs/phase-orchestrator/next-codex-prompt.meta.json");
  const existingPrompt = await readText("docs/phase-orchestrator/next-codex-prompt.md");
  const promptBelongsToCurrentLatestPhase =
    existingMeta.latestPhase === undefined || existingMeta.latestPhase === state.latestPhase;
  if (promptBelongsToCurrentLatestPhase) {
    const metaPhase = existingMeta.selectedNextPhase;
    const promptPhaseMatch = existingPrompt.match(/selectedNextPhase:\s*(Phase\d+)/);
    const promptTitleMatch = existingPrompt.match(/selectedNextPhaseTitle:\s*(.+)/);
    const promptPhase = promptPhaseMatch?.[1];
    const promptTitle = promptTitleMatch?.[1]?.trim();
    nextPromptMismatch =
      (metaPhase !== undefined && metaPhase !== selected.phase) ||
      (promptPhase !== undefined && promptPhase !== selected.phase) ||
      (promptTitle !== undefined && promptTitle !== selected.title);
  }
} catch {
  nextPromptMismatch = false;
}
if (nextPromptMismatch) blockedReasons.push("next_prompt_mismatch");

const previousStateOk = blockedReasons.length === 0;
const safetyBrakeEngaged = !previousStateOk || humanApprovalRequired;
const decision = safetyBrakeEngaged
  ? humanApprovalRequired
    ? "human_approval_required"
    : "blocked"
  : "ready_to_generate_next_prompt";

const output = {
  decision,
  autoContinueAllowed: decision === "ready_to_generate_next_prompt" && selected.autoContinueAllowed !== false,
  readyToExecute: decision === "ready_to_generate_next_prompt" && riskLevel === "low",
  executeNextPhaseAllowed: false,
  humanApprovalRequired,
  selectedNextPhase: selected.phase,
  selectedNextPhaseTitle: selected.title,
  selectedNextPhaseRiskLevel: riskLevel,
  selectedNextPhaseOverrideApplied: selected.recommendation?.overrideApplied === true,
  selectedNextPhaseOriginalPhase: selected.recommendation?.originalPhase,
  selectedNextPhaseOriginalTitle: selected.recommendation?.originalTitle,
  selectedNextPhaseOverrideReason: selected.recommendation?.overrideReason,
  allowedMode: selected.allowedExecutionMode,
  forbiddenActions,
  registryMismatches,
  promptMismatchDetected: nextPromptMismatch,
  blockedReasons,
  safetyBrakeEngaged,
  latestPhase: state.latestPhase,
  latestResultPath: state.latestResultPath,
  evaluatedAt: new Date().toISOString(),
  highRiskPhaseRequiresHumanApproval: true,
  providerCallRequiresHumanApproval: true,
  deployRequiresHumanApproval: true,
  secretAccessRequiresHumanApproval: true,
  billingRequiresHumanApproval: true,
  approvalModificationRequiresHumanApproval: true,
  safetyGateRelaxationBlocked: true,
  nextPhaseAutoExecutionBlocked: true,
  ...phase383Safety,
  autoExecutedNextPhase: false,
};

const evidence = {
  phase: "Phase383D",
  safetyBrakeEvaluatorCreated: true,
  safetyBrakeEvaluated: true,
  decision: output.decision,
  selectedNextPhase: output.selectedNextPhase,
  selectedNextPhaseTitle: output.selectedNextPhaseTitle,
  selectedNextPhaseRiskLevel: output.selectedNextPhaseRiskLevel,
  selectedNextPhaseOverrideApplied: output.selectedNextPhaseOverrideApplied,
  humanApprovalRequired: output.humanApprovalRequired,
  readyToExecute: output.readyToExecute,
  autoContinueAllowed: output.autoContinueAllowed,
  safetyBrakeEngaged: output.safetyBrakeEngaged,
  blockedReasons: output.blockedReasons,
  executeNextPhaseAllowed: false,
  validationPassed: true,
  ...phase383Safety,
  autoExecutedNextPhase: false,
};

await writeJson("docs/phase-orchestrator/safety-brake-decision.json", output);
await writeJson("apps/ai-gateway-service/evidence/phase383d/safety-brake-evaluator-result.json", evidence);
await writeText(
  "docs/phase383d-safety-brake-evaluator.md",
  [
    "# Phase383D Safety Brake Evaluator",
    "",
    `- Decision: ${output.decision}.`,
    `- Selected next phase: ${output.selectedNextPhase} (${output.selectedNextPhaseRiskLevel}).`,
    "- The evaluator never allows direct next-phase execution.",
    "- High-risk provider, secret, deployment, billing, approval, and safety-gate changes require a brake or human approval.",
  ].join("\n"),
);

console.log(JSON.stringify(evidence, null, 2));
