export const DRY_RUN_STABILIZATION_SCHEMA_VERSION = "phase1211-1215.taiji-beidou-dry-run-stabilization.v1";

export function buildTaijiBeidouDryRunStabilization(input = {}) {
  const upstreamClosure = input.upstreamClosure || {};
  const upstreamReady = upstreamClosure.completed === true
    && upstreamClosure.recommended_sealed === true
    && upstreamClosure.blocker === null;

  const scenarioMatrix = buildScenarioMatrix();
  const phase1211 = buildScenarioMatrixExpansion(scenarioMatrix);
  const phase1212 = buildBoundaryHardening();
  const phase1213 = buildOperatorUxCopyPolish();
  const phase1214 = buildInternalTrialPack();
  const phase1215 = buildDryRunDemonstrationClosure({ upstreamReady });

  const phaseSummaries = {
    phase1211,
    phase1212,
    phase1213,
    phase1214,
    phase1215,
  };
  const allCompleted = Object.values(phaseSummaries).every((phase) => phase.completed === true);
  const allRecommendedSealed = Object.values(phaseSummaries).every((phase) => phase.recommended_sealed === true);
  const allBlockersNull = Object.values(phaseSummaries).every((phase) => phase.blocker === null);
  const completed = upstreamReady && allCompleted && allRecommendedSealed && allBlockersNull;

  return {
    schemaVersion: DRY_RUN_STABILIZATION_SCHEMA_VERSION,
    phase: "Phase1211-1215-AIO",
    completed,
    recommended_sealed: completed,
    blocker: completed ? null : "phase1203_1210_closure_missing_or_not_sealed",
    phase1203To1210ClosureVerified: upstreamReady,
    phase1211,
    phase1212,
    phase1213,
    phase1214,
    phase1215,
    allRecommendedSealed,
    allBlockersNull,
    dryRunLoopStable: completed,
    demonstrationClosureReady: completed,
    realHumanFeedbackCollected: false,
    providerCallsMade: false,
    secretRead: false,
    secretValueExposed: false,
    authJsonRead: false,
    gloveDownloaded: false,
    chatModified: false,
    chatRuntimeModified: false,
    chatGatewayExecuteModified: false,
    chatGatewayExecuteRuntimeModified: false,
    mainChainIntegrationExecuted: false,
    mainChainDefaultEnabled: false,
    providerRuntimeDefaultEnabled: false,
    providerRuntimeEnabled: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    commitCreated: false,
    pushExecuted: false,
    workspaceCleanClaimed: false,
    legacyModified: false,
    projectContextModified: false,
    realSemanticValidationClaimed: false,
    syntheticOnly: true,
  };
}

export function buildScenarioMatrix() {
  return [
    scenario("capability_candidate_normal_task", ["capability_candidate_task"], "allow_preview", false),
    scenario("unauthorized_provider_call_request", ["provider_risk"], "block_unauthorized_provider_call", true),
    scenario("secret_read_requested", ["secret_risk"], "block_secret_read_requested", true),
    scenario("chat_request_as_preview_only", ["chat_request"], "allow_readonly_preview_without_chat_modification", false),
    scenario("chat_gateway_execute_integration_requested", ["chat_gateway_execute_request"], "block_chat_gateway_execute_integration", true),
    scenario("deploy_requested", ["deploy_request"], "block_deploy_request", true),
    scenario("cost_constraint_over_budget", ["cost_constraint"], "reweight_or_prune_candidate", false),
    scenario("real_semantic_claim_requested", ["semantic_claim_risk"], "block_real_semantic_claim", true),
    scenario("approval_packet_missing_owner_decision", ["main_chain_approval"], "keep_approval_packet_only", true),
    scenario("evidence_replay_preview_request", ["evidence_preview"], "allow_synthetic_evidence_preview", false),
    scenario("operator_copy_comprehension_review", ["operator_ux"], "allow_copy_preview", false),
    scenario("internal_trial_feedback_form_request", ["trial_pack"], "generate_form_without_human_feedback_claim", false),
  ];
}

export function buildBoundaryHardening() {
  const negativeControls = [
    "unauthorized_provider_call",
    "secret_read_requested",
    "chat_runtime_integration_requested",
    "chat_gateway_execute_integration_requested",
    "deploy_requested",
    "real_semantic_claim_requested",
  ];
  return {
    phase: "Phase1212",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    boundaryHardeningVerifierGenerated: true,
    providerBoundaryAsserted: true,
    secretBoundaryAsserted: true,
    chatBoundaryAsserted: true,
    chatGatewayExecuteBoundaryAsserted: true,
    deployBoundaryAsserted: true,
    semanticClaimBoundaryAsserted: true,
    negativeControls,
    verifierIntent: "Assert dry-run boundaries before any demonstration closure is considered sealed.",
  };
}

export function buildOperatorUxCopyPolish() {
  return {
    phase: "Phase1213",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    operatorUxCopyPolished: true,
    dryRunMeaningClear: true,
    candidateMeaningClear: true,
    notMainChainClear: true,
    notProviderCallClear: true,
    notRealSemanticValidationClear: true,
    copyBlocks: [
      "Dry-run means this preview generates synthetic evidence only; it does not execute a provider, worker, chat route, or deployment.",
      "Candidate means a reviewable capability proposal. It is not enabled, routed, or selectable until a later human-approved phase.",
      "This preview is not main-chain integration and does not modify /chat or /chat-gateway/execute.",
      "Semantic validation is not claimed here. The demo only shows traceable synthetic reasoning data.",
    ],
  };
}

export function buildInternalTrialPack() {
  return {
    phase: "Phase1214",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    internalTrialPackGenerated: true,
    feedbackFormGenerated: true,
    comprehensionChecklistGenerated: true,
    operatorNotesTemplateGenerated: true,
    realHumanFeedbackCollected: false,
    codexSelfTestCountedAsHumanFeedback: false,
    feedbackForm: [
      "Can the operator explain what dry-run means?",
      "Can the operator identify blocked provider and secret requests?",
      "Can the operator tell that no main-chain integration happened?",
      "Which scenario should be expanded before a future approval gate?",
    ],
    comprehensionChecklist: [
      "No Provider call is made.",
      "No secret, token, auth.json, or CredentialRef value is read.",
      "No /chat or /chat-gateway/execute runtime is modified.",
      "No deploy, release, tag, artifact upload, commit, or push is performed.",
      "No real human feedback is counted until an owner supplies it later.",
    ],
    operatorNotesTemplate: {
      operatorName: "",
      trialDate: "",
      observedConfusion: "",
      requestedScenarioExpansion: "",
      approvalGateConcerns: "",
    },
  };
}

export function buildDryRunDemonstrationClosure(input = {}) {
  const upstreamReady = input.upstreamReady === true;
  return {
    phase: "Phase1215",
    completed: upstreamReady,
    recommended_sealed: upstreamReady,
    blocker: upstreamReady ? null : "phase1203_1210_closure_not_ready",
    dryRunDemonstrationClosureGenerated: upstreamReady,
    phase1201To1215TraceMapGenerated: upstreamReady,
    demoNarrativeGenerated: upstreamReady,
    knownLimitsDocumented: upstreamReady,
    traceMap: [
      trace("Phase1201", "Synthetic minimal field prototype", "Seeded dry-run field reasoning only."),
      trace("Phase1202", "Task concept source schema", "Normalized task concepts into source candidates."),
      trace("Phase1203", "Capability candidate readout", "Produced candidate capabilities, modules, phases, paths, and blockers."),
      trace("Phase1204", "Tianshu planner alignment", "Aligned candidates to planner input and route preview."),
      trace("Phase1205", "Evidence replay preview", "Generated source, field, candidate, blocked, approval, and readout traces."),
      trace("Phase1206", "Safety and cost sources", "Added negative sources for provider, secret, chat-gateway, deploy, and semantic-claim risks."),
      trace("Phase1207", "Capability cell generation", "Generated dry-run cells with dependencies, risks, outputs, and evidence refs."),
      trace("Phase1208", "Repair, prune, reweight", "Produced dry-run repair, prune, and weighting reasons."),
      trace("Phase1209", "Mission Control read-only preview", "Presented dry-run evidence as read-only preview data."),
      trace("Phase1210", "Main-chain approval packet", "Prepared approval packet only; no integration executed."),
      trace("Phase1211", "Scenario matrix expansion", "Expanded the demonstration matrix across risk and candidate scenarios."),
      trace("Phase1212", "Boundary hardening", "Hardened verifier assertions for blocked execution classes."),
      trace("Phase1213", "Operator UX copy polish", "Clarified dry-run, candidate, provider, main-chain, and semantic boundaries."),
      trace("Phase1214", "Internal trial pack", "Generated trial materials without counting real human feedback."),
      trace("Phase1215", "Dry-run demonstration closure", "Closed the demonstrable synthetic loop without entering runtime."),
    ],
    demoNarrative: [
      "Start with a synthetic task concept and read it out as a capability candidate.",
      "Route the candidate through planner alignment and evidence replay preview.",
      "Apply safety, forbidden capability, and cost sources before cell generation.",
      "Repair, prune, and reweight cells as dry-run reports only.",
      "Show the result as a read-only operator preview and approval packet.",
      "Use the Phase1211-1215 scenario and trial pack to demonstrate comprehension without runtime execution.",
    ],
    knownLimits: [
      "No real semantic intelligence is validated by this phase.",
      "No provider, main-chain, chat, chat-gateway execute, deploy, release, commit, or push path is enabled.",
      "Internal trial materials are ready, but real human feedback has not been collected.",
      "Future runtime approval still requires explicit owner authorization in a separate high-risk phase.",
    ],
  };
}

function buildScenarioMatrixExpansion(scenarioMatrix) {
  const coverage = new Set(scenarioMatrix.flatMap((item) => item.coverage));
  return {
    phase: "Phase1211",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    scenarioMatrixGenerated: true,
    scenarioCount: scenarioMatrix.length,
    coversProviderRisk: coverage.has("provider_risk"),
    coversSecretRisk: coverage.has("secret_risk"),
    coversChatRequest: coverage.has("chat_request"),
    coversChatGatewayExecuteRequest: coverage.has("chat_gateway_execute_request"),
    coversDeployRequest: coverage.has("deploy_request"),
    coversCostConstraint: coverage.has("cost_constraint"),
    coversCapabilityCandidateTask: coverage.has("capability_candidate_task"),
    scenarioMatrix,
  };
}

function scenario(id, coverage, expectedDecision, blocked) {
  return {
    id,
    title: titleize(id),
    coverage,
    expectedDecision,
    blocked,
    dryRunOnly: true,
    providerCallAllowed: false,
    secretReadAllowed: false,
    chatModificationAllowed: false,
    chatGatewayExecuteModificationAllowed: false,
    deploymentAllowed: false,
    realSemanticValidationClaimed: false,
  };
}

function trace(phase, capability, demonstrationValue) {
  return {
    phase,
    capability,
    demonstrationValue,
    runtimeExecuted: false,
  };
}

function titleize(value) {
  return String(value)
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
