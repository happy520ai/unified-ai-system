export const TASK_CONCEPT_SOURCE_SCHEMA_VERSION = "phase1202.task-concept-source.v1";

const sourceRules = [
  {
    id: "add_readonly_preview_panel",
    group: "positiveSources",
    patterns: [/只读.*预览面板/i, /只读.*preview.*面板/i, /Task Source Preview/i, /readonly.*preview.*panel/i, /增加.*预览/i],
  },
  {
    id: "improve_operator_visibility",
    group: "positiveSources",
    patterns: [/Mission Control/i, /operator.*visibility/i, /可见/i],
  },
  {
    id: "compare_provider_answers",
    group: "positiveSources",
    patterns: [/比较答案/i, /compare.*answer/i],
  },
  {
    id: "test_model",
    group: "positiveSources",
    patterns: [/测试模型/i, /test.*model/i],
  },
  {
    id: "extend_field_prototype",
    group: "positiveSources",
    patterns: [/field prototype/i, /field.*reasoning/i, /minimal field/i, /扩展/i],
  },
  {
    id: "task_source_parser",
    group: "positiveSources",
    patterns: [/任务拆/i, /task source/i, /source schema/i],
  },
  {
    id: "no_provider_call",
    group: "negativeSources",
    patterns: [/不调用\s*Provider/i, /不真实调用/i, /no provider/i],
  },
  {
    id: "provider_call",
    group: "negativeSources",
    patterns: [/直接调用\s*OpenAI/i, /Claude/i, /OpenRouter/i, /MiMo/i, /NVIDIA/i, /Volcengine/i, /真实 Provider/i],
  },
  {
    id: "no_secret_read",
    group: "negativeSources",
    patterns: [/不读\s*secret/i, /不读取.*API key/i, /no secret/i],
  },
  {
    id: "secret_read_requested",
    group: "negativeSources",
    patterns: [/读取.*API key/i, /读取.*secret/i, /auth\.json/i, /token/i],
  },
  {
    id: "no_chat_modification",
    group: "negativeSources",
    patterns: [/不改\s*\/chat/i, /不接\s*\/chat/i],
  },
  {
    id: "chat_gateway_execute_integration_requested",
    group: "negativeSources",
    patterns: [/接入\s*\/chat-gateway\/execute/i, /\/chat-gateway\/execute/i],
  },
  {
    id: "dry_run_only",
    group: "constraintSources",
    patterns: [/dry-run/i, /dry run/i, /只做.*dry/i],
  },
  {
    id: "no_deploy",
    group: "constraintSources",
    patterns: [/不能\s*deploy/i, /不\s*deploy/i, /no deploy/i],
  },
  {
    id: "synthetic_validation_only",
    group: "constraintSources",
    patterns: [/synthetic/i, /合成/i, /不声明真实语义/i],
  },
  {
    id: "approval_required",
    group: "constraintSources",
    patterns: [/审批/i, /approval/i, /应要求审批/i],
  },
  {
    id: "phase1201_minimal_field_prototype",
    group: "contextSources",
    patterns: [/Phase1201/i, /minimal field prototype/i, /field prototype/i],
  },
  {
    id: "synthetic_vector_field",
    group: "contextSources",
    patterns: [/synthetic vector/i, /synthetic.*field/i, /物理场/i, /场/i],
  },
  {
    id: "mission_control",
    group: "contextSources",
    patterns: [/Mission Control/i],
  },
];

export function buildTaskConceptSourceSchema(input = {}) {
  const rawTask = typeof input === "string" ? input : String(input.rawTask || input.task || "");
  const taskId = typeof input === "object" && input.taskId ? input.taskId : createTaskId(rawTask);
  const normalizedTask = normalizeTask(rawTask);
  const sources = classifySources(rawTask);
  const readoutTargets = buildReadoutTargets(rawTask, sources);
  const boundary = classifyBoundary(rawTask, sources);
  const safetyClassification = classifySafety(boundary, sources);

  return {
    schemaVersion: TASK_CONCEPT_SOURCE_SCHEMA_VERSION,
    phase: "Phase1202",
    taskId,
    rawTask,
    normalizedTask,
    sources,
    readoutTargets,
    boundary,
    safetyClassification,
    trace: {
      generatedAt: "synthetic-dry-run-fixed-timestamp",
      evidenceRef: "apps/ai-gateway-service/evidence/phase1202-task-concept-source-schema/task-concept-source-schema-result.json",
      syntheticOnly: true,
    },
  };
}

export function validateTaskConceptSourceSchema(schema) {
  const errors = [];
  if (schema?.schemaVersion !== TASK_CONCEPT_SOURCE_SCHEMA_VERSION) errors.push("schemaVersion_invalid");
  if (schema?.phase !== "Phase1202") errors.push("phase_invalid");
  if (!schema?.taskId) errors.push("taskId_missing");
  if (!schema?.rawTask) errors.push("rawTask_missing");
  for (const group of ["positiveSources", "negativeSources", "constraintSources", "contextSources"]) {
    if (!Array.isArray(schema?.sources?.[group])) errors.push(`${group}_missing`);
  }
  for (const group of ["capabilityCandidates", "phaseCandidates", "executionPathCandidates"]) {
    if (!Array.isArray(schema?.readoutTargets?.[group])) errors.push(`${group}_missing`);
  }
  for (const key of [
    "providerCallAllowed",
    "secretReadAllowed",
    "chatIntegrationAllowed",
    "chatGatewayExecuteIntegrationAllowed",
    "deploymentAllowed",
    "realSemanticValidationClaimed",
  ]) {
    if (typeof schema?.boundary?.[key] !== "boolean") errors.push(`${key}_missing`);
  }
  if (!["low", "medium", "high"].includes(schema?.safetyClassification?.riskLevel)) errors.push("riskLevel_invalid");
  if (!Array.isArray(schema?.safetyClassification?.blockedReasons)) errors.push("blockedReasons_missing");
  if (typeof schema?.safetyClassification?.requiresHumanApproval !== "boolean") errors.push("requiresHumanApproval_missing");
  if (schema?.trace?.syntheticOnly !== true) errors.push("syntheticOnly_not_true");
  return {
    valid: errors.length === 0,
    errors,
  };
}

export function createSyntheticTaskConceptExamples() {
  return [
    {
      scenarioId: "scenario-1-ui-preview",
      title: "低风险 UI 预览任务",
      rawTask: "为 Mission Control 增加一个只读 Task Source Preview 面板，不调用 Provider，不读 secret，只做 dry-run。",
      expected: {
        riskLevel: "low",
        requiresHumanApproval: false,
        positiveSources: ["add_readonly_preview_panel", "improve_operator_visibility"],
        negativeSources: ["no_provider_call", "no_secret_read"],
      },
    },
    {
      scenarioId: "scenario-2-provider-block",
      title: "真实 Provider 任务，应阻断",
      rawTask: "直接调用 OpenAI 和 Claude 比较答案。",
      expected: {
        riskLevel: "high",
        requiresHumanApproval: true,
        blockedReasons: ["unauthorized_provider_call"],
      },
    },
    {
      scenarioId: "scenario-3-secret-block",
      title: "secret 读取任务，应阻断",
      rawTask: "读取本地 API key 并测试模型。",
      expected: {
        riskLevel: "high",
        requiresHumanApproval: true,
        blockedReasons: ["secret_read_requested"],
      },
    },
    {
      scenarioId: "scenario-4-phase-candidate",
      title: "Phase 候选生成任务",
      rawTask: "把 Phase1201 的 field prototype 扩展为 capability candidate readout schema。",
      expected: {
        riskLevel: "low",
        phaseCandidates: ["Phase1203"],
        capabilityCandidates: ["capability_candidate_readout_schema"],
      },
    },
    {
      scenarioId: "scenario-5-chat-gateway-approval",
      title: "主链接入任务，应要求审批",
      rawTask: "把 Taiji / Beidou field reasoning 接入 /chat-gateway/execute。",
      expected: {
        riskLevel: "high",
        requiresHumanApproval: true,
        blockedReasons: ["chat_gateway_execute_integration_requested"],
      },
    },
  ];
}

export function classifyTaskConceptSourceBoundaries(schema) {
  return {
    providerCallBlocked: schema.boundary.providerCallAllowed === false,
    secretReadBlocked: schema.boundary.secretReadAllowed === false,
    chatIntegrationBlocked: schema.boundary.chatIntegrationAllowed === false,
    chatGatewayExecuteIntegrationBlocked: schema.boundary.chatGatewayExecuteIntegrationAllowed === false,
    deploymentBlocked: schema.boundary.deploymentAllowed === false,
    syntheticOnly: schema.trace.syntheticOnly === true,
    requiresHumanApproval: schema.safetyClassification.requiresHumanApproval,
    blockedReasons: schema.safetyClassification.blockedReasons,
  };
}

function classifySources(rawTask) {
  const sources = {
    positiveSources: [],
    negativeSources: [],
    constraintSources: [],
    contextSources: [],
  };

  for (const rule of sourceRules) {
    if (rule.patterns.some((pattern) => pattern.test(rawTask))) {
      sources[rule.group].push(rule.id);
    }
  }

  if (sources.positiveSources.length === 0) sources.positiveSources.push("task_goal_unspecified");
  if (sources.negativeSources.length === 0) sources.negativeSources.push("no_unsafe_action_requested");
  if (sources.constraintSources.length === 0) sources.constraintSources.push("local_schema_only");
  if (sources.contextSources.length === 0) sources.contextSources.push("phase1202_task_source_schema");

  return dedupeSourceGroups(sources);
}

function buildReadoutTargets(rawTask, sources) {
  const capabilityCandidates = [];
  const phaseCandidates = [];
  const executionPathCandidates = ["schema_then_dry_run_then_verifier"];

  if (hasSource(sources, "add_readonly_preview_panel")) capabilityCandidates.push("task_source_preview_panel");
  if (hasSource(sources, "improve_operator_visibility")) capabilityCandidates.push("safety_boundary_mapper");
  if (hasSource(sources, "task_source_parser")) capabilityCandidates.push("task_source_parser");
  if (/capability candidate readout schema/i.test(rawTask)) capabilityCandidates.push("capability_candidate_readout_schema");
  if (/Phase1201/i.test(rawTask)) phaseCandidates.push("Phase1203");
  if (/\/chat-gateway\/execute/i.test(rawTask)) phaseCandidates.push("Phase1204");
  if (/Provider|OpenAI|Claude|NVIDIA|MiMo|OpenRouter|Volcengine/i.test(rawTask)) phaseCandidates.push("Phase1205");

  if (capabilityCandidates.length === 0) capabilityCandidates.push("task_source_parser");
  if (phaseCandidates.length === 0) phaseCandidates.push("Phase1203");

  return {
    capabilityCandidates: dedupe(capabilityCandidates),
    phaseCandidates: dedupe(phaseCandidates),
    executionPathCandidates,
  };
}

function classifyBoundary(rawTask, sources) {
  const providerRequested = hasSource(sources, "provider_call");
  const secretRequested = hasSource(sources, "secret_read_requested");
  const chatGatewayRequested = hasSource(sources, "chat_gateway_execute_integration_requested");
  const chatRequested = /接入\s*\/chat(?!-gateway)|修改\s*\/chat/i.test(rawTask);
  const deployRequested = /deploy|release|tag|artifact|部署|发布/i.test(rawTask);

  return {
    providerCallAllowed: false,
    secretReadAllowed: false,
    chatIntegrationAllowed: !chatRequested,
    chatGatewayExecuteIntegrationAllowed: false,
    deploymentAllowed: false,
    realSemanticValidationClaimed: false,
    requestedFlags: {
      providerRequested,
      secretRequested,
      chatRequested,
      chatGatewayRequested,
      deployRequested,
    },
  };
}

function classifySafety(boundary) {
  const blockedReasons = [];
  if (boundary.requestedFlags.providerRequested) blockedReasons.push("unauthorized_provider_call");
  if (boundary.requestedFlags.secretRequested) blockedReasons.push("secret_read_requested");
  if (boundary.requestedFlags.chatRequested) blockedReasons.push("chat_integration_requested");
  if (boundary.requestedFlags.chatGatewayRequested) blockedReasons.push("chat_gateway_execute_integration_requested");
  if (boundary.requestedFlags.deployRequested) blockedReasons.push("deployment_or_release_requested");

  const highRisk = blockedReasons.length > 0;
  return {
    riskLevel: highRisk ? "high" : "low",
    blockedReasons,
    requiresHumanApproval: highRisk,
  };
}

function normalizeTask(rawTask) {
  return rawTask.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

function createTaskId(rawTask) {
  const normalized = normalizeTask(rawTask);
  let hash = 0;
  for (const char of normalized) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return `task-${hash.toString(16).padStart(8, "0")}`;
}

function dedupeSourceGroups(sources) {
  return Object.fromEntries(Object.entries(sources).map(([key, value]) => [key, dedupe(value)]));
}

function dedupe(values) {
  return [...new Set(values)];
}

function hasSource(sources, source) {
  return Object.values(sources).some((group) => group.includes(source));
}
