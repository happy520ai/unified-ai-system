export const CAPABILITY_CANDIDATE_READOUT_SCHEMA_VERSION = "phase1203.capability-candidate-readout.v1";

export function buildCapabilityCandidateReadout(input = {}) {
  const sourceSchemas = normalizeSourceSchemas(input.sourceSchemas);
  const candidateCapabilities = dedupeById(sourceSchemas.flatMap(buildCapabilityCandidates));
  const candidateModules = candidateCapabilities.map((capability) => ({
    id: `${capability.id}_module`,
    capabilityId: capability.id,
    moduleType: capability.moduleType,
    runtimeEnabled: false,
    dryRunOnly: true,
  }));
  const candidatePhases = dedupeById([
    phaseCandidate("Phase1203", "capability candidate readout schema", "completed_by_this_phase"),
    ...sourceSchemas.flatMap((schema) => (schema.readoutTargets?.phaseCandidates || []).map((phase) => phaseCandidate(phase, "source_schema_readout_target", "phase1202"))),
  ]);
  const candidateExecutionPaths = dedupeById([
    {
      id: "schema_to_planner_to_evidence_preview",
      steps: ["source_schema", "candidate_readout", "tianshu_planner_alignment", "evidence_replay_preview"],
      dryRunOnly: true,
      runtimeDispatch: false,
    },
    {
      id: "safety_cost_gate_to_cell_generation",
      steps: ["safety_negative_sources", "cost_constraint_sources", "capability_cell_generation"],
      dryRunOnly: true,
      runtimeDispatch: false,
    },
  ]);
  const blockedCandidates = sourceSchemas.flatMap(buildBlockedCandidates);
  const approvalRequiredCandidates = sourceSchemas.flatMap(buildApprovalRequiredCandidates);

  return {
    schemaVersion: CAPABILITY_CANDIDATE_READOUT_SCHEMA_VERSION,
    phase: "Phase1203",
    verificationMode: "synthetic-dry-run",
    candidateCapabilities,
    candidateModules,
    candidatePhases,
    candidateExecutionPaths,
    blockedCandidates: dedupeById(blockedCandidates),
    approvalRequiredCandidates: dedupeById(approvalRequiredCandidates),
    trace: {
      sourceSchemaCount: sourceSchemas.length,
      syntheticOnly: true,
      evidenceRef: "apps/ai-gateway-service/evidence/phase1203-capability-candidate-readout/capability-candidate-readout-result.json",
    },
  };
}

export function validateCapabilityCandidateReadout(readout) {
  const errors = [];
  if (readout?.schemaVersion !== CAPABILITY_CANDIDATE_READOUT_SCHEMA_VERSION) errors.push("schemaVersion_invalid");
  if (readout?.phase !== "Phase1203") errors.push("phase_invalid");
  for (const field of ["candidateCapabilities", "candidateModules", "candidatePhases", "candidateExecutionPaths", "blockedCandidates", "approvalRequiredCandidates"]) {
    if (!Array.isArray(readout?.[field])) errors.push(`${field}_missing`);
  }
  if (readout?.verificationMode !== "synthetic-dry-run") errors.push("verificationMode_invalid");
  if (readout?.trace?.syntheticOnly !== true) errors.push("syntheticOnly_not_true");
  if (readout?.candidateCapabilities?.some((candidate) => candidate.runtimeEnabled !== false || candidate.dryRunOnly !== true)) {
    errors.push("candidate_runtime_boundary_invalid");
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function normalizeSourceSchemas(sourceSchemas) {
  if (Array.isArray(sourceSchemas) && sourceSchemas.length > 0) return sourceSchemas;
  return [
    {
      taskId: "phase1203-synthetic-default",
      readoutTargets: {
        capabilityCandidates: ["capability_candidate_readout_schema"],
        phaseCandidates: ["Phase1203"],
        executionPathCandidates: ["schema_then_dry_run_then_verifier"],
      },
      safetyClassification: {
        riskLevel: "low",
        blockedReasons: [],
        requiresHumanApproval: false,
      },
      boundary: {
        providerCallAllowed: false,
        secretReadAllowed: false,
        chatGatewayExecuteIntegrationAllowed: false,
        deploymentAllowed: false,
      },
    },
  ];
}

function buildCapabilityCandidates(schema) {
  const targets = schema.readoutTargets?.capabilityCandidates || ["capability_candidate_readout_schema"];
  return targets.map((target) => ({
    id: normalizeId(target),
    sourceTaskId: schema.taskId,
    title: titleize(target),
    moduleType: moduleTypeFor(target),
    capabilityBucket: bucketFor(target),
    dryRunOnly: true,
    runtimeEnabled: false,
    evidenceRequired: true,
    evidenceRef: "apps/ai-gateway-service/evidence/phase1203-capability-candidate-readout/capability-candidate-readout-result.json",
  }));
}

function buildBlockedCandidates(schema) {
  const blockedReasons = schema.safetyClassification?.blockedReasons || [];
  return blockedReasons.map((reason) => ({
    id: `blocked_${normalizeId(reason)}_${schema.taskId}`,
    sourceTaskId: schema.taskId,
    reason,
    blocked: true,
    runtimeDispatch: false,
  }));
}

function buildApprovalRequiredCandidates(schema) {
  if (schema.safetyClassification?.requiresHumanApproval !== true) return [];
  return [{
    id: `approval_required_${schema.taskId}`,
    sourceTaskId: schema.taskId,
    approvalReason: (schema.safetyClassification?.blockedReasons || ["manual_review_required"]).join(","),
    ownerApproved: false,
    runtimeDispatch: false,
  }];
}

function phaseCandidate(phase, reason, source) {
  return {
    id: String(phase).toLowerCase(),
    phase,
    reason,
    source,
    dryRunOnly: true,
  };
}

function moduleTypeFor(target) {
  if (/preview|panel/i.test(target)) return "readonly_ui_preview";
  if (/safety|boundary|guard/i.test(target)) return "safety_gate_schema";
  if (/planner|tianshu/i.test(target)) return "planner_alignment_schema";
  return "capability_schema";
}

function bucketFor(target) {
  if (/preview|panel/i.test(target)) return "operator_preview";
  if (/safety|boundary|guard/i.test(target)) return "safety";
  if (/planner|tianshu/i.test(target)) return "planning";
  return "candidate_generation";
}

function normalizeId(value) {
  return String(value || "candidate").normalize("NFKC").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function titleize(value) {
  return normalizeId(value).split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function dedupeById(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}
