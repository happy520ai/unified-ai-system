const PHASE = "phase-266a-capability-router-preview";

const ROUTER_MANAGER_BOUNDARY = {
  mode: "heuristic-preview",
  managerModelInvoked: false,
  analysisModelRequiredForAutoMode: true,
  executionEnabled: false,
  autoInvokeSpecializedModels: false,
  defaultChatLaneChanged: false,
  note: "A capable analysis model should manage future automatic routing; this preview only produces an advisory route.",
};

const ROUTER_BOUNDARIES = {
  previewOnly: true,
  executionEnabled: false,
  autoInvokeSpecializedModels: false,
  providerCalls: false,
  defaultChatLaneChanged: false,
  noCodexExec: true,
  noWorkflowRunner: true,
  noWorktreeCreation: true,
  noAutoCommitPushPr: true,
};

const CAPABILITY_ALIASES = new Map([
  ["native-chat", "chat"],
  ["completion", "chat"],
  ["summary", "chat"],
  ["image", "image-generation"],
  ["image-generation", "image-generation"],
  ["text-to-image", "image-generation"],
  ["video", "video-generation"],
  ["video-generation", "video-generation"],
  ["text-to-video", "video-generation"],
  ["rag", "rag"],
  ["knowledge", "rag"],
  ["knowledge-rag", "rag"],
]);

const TASK_RULES = [
  {
    taskType: "video-generation",
    capabilities: ["video-generation"],
    patterns: [
      /视频|短片|动画|分镜|镜头|剪辑|片头|片尾|mp4|mov/i,
      /\b(video|text-to-video|animation|storyboard|shot list|clip)\b/i,
    ],
  },
  {
    taskType: "image-generation",
    capabilities: ["image-generation"],
    patterns: [
      /生图|画一张|生成图片|海报|插画|头像|logo|图像生成/i,
      /\b(image generation|text-to-image|poster|illustration|logo|generate an image)\b/i,
    ],
  },
  {
    taskType: "vision",
    capabilities: ["vision"],
    patterns: [
      /看图|截图|图片理解|视觉|识别图片|ocr|图中/i,
      /\b(vision|screenshot|image input|ocr|look at this image)\b/i,
    ],
  },
  {
    taskType: "coding",
    capabilities: ["coding", "reasoning"],
    patterns: [
      /代码|编程|修复|bug|测试|仓库|接口|函数|脚本|重构/i,
      /\b(code|coding|bug|test|repo|api|refactor|javascript|typescript|python)\b/i,
    ],
  },
  {
    taskType: "knowledge-rag",
    capabilities: ["rag", "chat"],
    patterns: [
      /知识库|引用|evidence|文档查询|项目状态|资料|检索/i,
      /\b(rag|knowledge|citation|evidence|docs|retrieve|source)\b/i,
    ],
  },
  {
    taskType: "reasoning",
    capabilities: ["reasoning", "chat"],
    patterns: [
      /推理|规划|方案|架构|比较|决策|分析|调度/i,
      /\b(reasoning|plan|architecture|compare|decision|analyze|router)\b/i,
    ],
  },
];

export function createCapabilityRouterService({ providerRegistry, config } = {}) {
  return new CapabilityRouterService({ providerRegistry, config });
}

class CapabilityRouterService {
  constructor({ providerRegistry, config } = {}) {
    this.providerRegistry = providerRegistry;
    this.config = config;
  }

  getStatus() {
    const inventory = this.#createInventory();
    return {
      phase: PHASE,
      status: "preview-ready",
      previewOnly: true,
      executionEnabled: false,
      codexExecInvoked: false,
      autoInvokeSpecializedModels: false,
      defaultChatLaneChanged: false,
      routerManager: {
        ...ROUTER_MANAGER_BOUNDARY,
        recommendedManager: selectManagerCandidate(inventory.models),
      },
      inventory: summarizeInventory(inventory.models),
      capabilitySummary: inventory.capabilitySummary,
      boundaries: { ...ROUTER_BOUNDARIES },
      endpoints: {
        status: "GET /models/capability-router/status",
        preview: "POST /models/capability-router/preview",
      },
      nextActions: [
        "Use /models/import/preview and /models/import/confirm to import real provider model lists.",
        "Tag imported models with capabilities such as coding, vision, image-generation, video-generation, reasoning, embedding, or rerank.",
        "Keep routing advisory until a human explicitly enables a future execution path.",
      ],
    };
  }

  preview(input = {}) {
    const taskText = String(input.task ?? input.prompt ?? input.query ?? "").trim();
    const explicitCapabilities = normalizeRequestedCapabilities(input.requiredCapabilities);
    const analysis = analyzeTask({
      taskText,
      taskType: input.taskType,
      requiredCapabilities: explicitCapabilities,
    });
    const inventory = this.#createInventory();
    const scored = scoreCandidates(inventory.models, analysis.requiredCapabilities);
    const selected = scored.find((candidate) => candidate.missingCapabilities.length === 0) ?? null;
    const missing = selected ? [] : analysis.requiredCapabilities.filter((capability) => {
      return !inventory.capabilitySummary.byCapability[capability];
    });
    const recommendation = createRecommendation({
      analysis,
      selected,
      scored,
      missing,
    });

    return {
      phase: PHASE,
      status: recommendation.status,
      previewOnly: true,
      executionEnabled: false,
      codexExecInvoked: false,
      autoInvokeSpecializedModels: false,
      defaultChatLaneChanged: false,
      task: {
        textPreview: taskText.slice(0, 500),
        detectedTaskType: analysis.taskType,
        requiredCapabilities: analysis.requiredCapabilities,
        signals: analysis.signals,
      },
      routerManager: {
        ...ROUTER_MANAGER_BOUNDARY,
        recommendedManager: selectManagerCandidate(inventory.models),
        managerInstruction: "Use a strong reasoning model as the future routing manager before any automatic dispatch is allowed.",
      },
      recommendation,
      alternatives: scored.slice(0, 5).map(toCandidatePreview),
      inventory: summarizeInventory(inventory.models),
      capabilitySummary: inventory.capabilitySummary,
      boundaries: { ...ROUTER_BOUNDARIES },
      nextActions: createNextActions({ recommendation, analysis, missing }),
    };
  }

  #createInventory() {
    const descriptors = typeof this.providerRegistry?.listDescriptors === "function"
      ? this.providerRegistry.listDescriptors()
      : [];
    const models = [];

    for (const provider of descriptors) {
      for (const model of provider.models ?? []) {
        if (model?.enabled === false) continue;
        models.push(normalizeCandidateModel(provider, model));
      }
    }

    return {
      models,
      capabilitySummary: summarizeCapabilities(models),
    };
  }
}

function normalizeCandidateModel(provider, model) {
  const capabilities = createCanonicalCapabilities(model);
  return {
    providerId: provider.id,
    providerDisplayName: provider.displayName ?? provider.id,
    modelId: model.id,
    modelDisplayName: model.displayName ?? model.id,
    capabilities,
    rawCapabilities: Array.isArray(model.capabilities) ? [...model.capabilities] : [],
    modalities: model.metadata?.modalities ?? model.modalities ?? null,
    providerPriority: provider.priority ?? 100,
    modelPriority: model.priority ?? provider.priority ?? 100,
    runtimeDiscovered: model.metadata?.runtimeDiscovered === true,
    source: model.metadata?.source ?? provider.metadata?.source ?? "configured-provider",
  };
}

function createCanonicalCapabilities(model) {
  const values = new Set();
  for (const capability of model.capabilities ?? []) {
    const normalized = normalizeCapability(capability);
    if (normalized) values.add(normalized);
  }

  const modalities = model.metadata?.modalities ?? model.modalities ?? {};
  for (const input of modalities.input ?? []) {
    const normalized = String(input || "").toLowerCase();
    if (normalized.includes("image")) values.add("vision");
    if (normalized.includes("audio")) values.add("audio");
    if (normalized.includes("video")) values.add("video-generation");
  }
  for (const output of modalities.output ?? []) {
    const normalized = String(output || "").toLowerCase();
    if (normalized.includes("image")) values.add("image-generation");
    if (normalized.includes("video")) values.add("video-generation");
    if (normalized.includes("embedding")) values.add("embedding");
  }

  if (values.has("vision") || values.has("coding") || values.has("reasoning")) {
    values.add("chat");
  }
  return Array.from(values).sort();
}

function normalizeCapability(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return "";
  return CAPABILITY_ALIASES.get(normalized) ?? normalized;
}

function normalizeRequestedCapabilities(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(normalizeCapability).filter(Boolean)));
}

function analyzeTask({ taskText, taskType, requiredCapabilities }) {
  const text = String(taskText ?? "");
  const normalizedTaskType = normalizeCapability(taskType) || String(taskType ?? "").trim().toLowerCase();
  const capabilitySet = new Set(requiredCapabilities);
  const signals = [];
  let detectedTaskType = normalizedTaskType || "chat";

  for (const rule of TASK_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text)) || normalizedTaskType === rule.taskType) {
      detectedTaskType = selectHigherPriorityTaskType(detectedTaskType, rule.taskType);
      for (const capability of rule.capabilities) capabilitySet.add(capability);
      signals.push(rule.taskType);
    }
  }

  if (!capabilitySet.size) {
    capabilitySet.add("chat");
  }

  if (capabilitySet.has("image-generation") || capabilitySet.has("video-generation")) {
    capabilitySet.delete("chat");
  }

  if (capabilitySet.has("rag")) {
    capabilitySet.add("chat");
  }

  return {
    taskType: detectedTaskType,
    requiredCapabilities: Array.from(capabilitySet).sort(sortCapabilities),
    signals: Array.from(new Set(signals)),
  };
}

function selectHigherPriorityTaskType(current, next) {
  const priority = [
    "video-generation",
    "image-generation",
    "vision",
    "coding",
    "knowledge-rag",
    "reasoning",
    "chat",
  ];
  const currentIndex = priority.indexOf(current);
  const nextIndex = priority.indexOf(next);
  if (currentIndex < 0) return next;
  if (nextIndex < 0) return current;
  return nextIndex < currentIndex ? next : current;
}

function sortCapabilities(a, b) {
  const priority = ["video-generation", "image-generation", "vision", "coding", "reasoning", "rag", "chat"];
  const ai = priority.indexOf(a);
  const bi = priority.indexOf(b);
  if (ai !== bi) return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
  return a.localeCompare(b);
}

function scoreCandidates(models, requiredCapabilities) {
  return models
    .map((model) => {
      const capabilitySet = new Set(model.capabilities);
      const missingCapabilities = requiredCapabilities.filter((capability) => !capabilitySet.has(capability));
      const matchedCapabilities = requiredCapabilities.filter((capability) => capabilitySet.has(capability));
      const score = matchedCapabilities.length * 40 -
        missingCapabilities.length * 50 +
        (capabilitySet.has("reasoning") ? 8 : 0) +
        (capabilitySet.has("coding") ? 4 : 0) +
        (model.runtimeDiscovered ? 5 : 0) -
        Number(model.providerPriority ?? 100) / 100 -
        Number(model.modelPriority ?? 100) / 200;
      return {
        ...model,
        score: Math.round(score * 100) / 100,
        matchedCapabilities,
        missingCapabilities,
        reasons: createCandidateReasons({ model, matchedCapabilities, missingCapabilities }),
      };
    })
    .sort((a, b) => b.score - a.score);
}

function createCandidateReasons({ model, matchedCapabilities, missingCapabilities }) {
  const reasons = [];
  if (matchedCapabilities.length) {
    reasons.push(`Matches required capabilities: ${matchedCapabilities.join(", ")}`);
  }
  if (missingCapabilities.length) {
    reasons.push(`Missing capabilities: ${missingCapabilities.join(", ")}`);
  }
  if (model.runtimeDiscovered) {
    reasons.push("Discovered from a provider models/list import.");
  }
  if (model.capabilities.includes("reasoning")) {
    reasons.push("Can serve as an analysis-oriented routing manager candidate.");
  }
  return reasons;
}

function createRecommendation({ analysis, selected, scored, missing }) {
  if (selected) {
    return {
      status: "route-ready-preview",
      confidence: createConfidence(selected, analysis.requiredCapabilities),
      selected: toCandidatePreview(selected),
      requiredCapabilities: analysis.requiredCapabilities,
      missingCapabilities: [],
      reasons: [
        "A configured or imported model matches the requested capability set.",
        "This is an advisory selection only; no provider call is made by the router.",
      ],
    };
  }

  const best = scored[0] ?? null;
  return {
    status: missing.length ? "needs-specialized-model" : "needs-human-review",
    confidence: "low",
    selected: null,
    nearestCandidate: best ? toCandidatePreview(best) : null,
    requiredCapabilities: analysis.requiredCapabilities,
    missingCapabilities: missing.length ? missing : best?.missingCapabilities ?? analysis.requiredCapabilities,
    reasons: [
      "No available model covers every required capability.",
      "Add or import a specialized model before using this task for production-like work.",
      "A strong reasoning model can help manage routing later, but it cannot replace a missing video, image, vision, or coding capability.",
    ],
  };
}

function createConfidence(candidate, requiredCapabilities) {
  if (!candidate || candidate.missingCapabilities?.length) return "low";
  if (requiredCapabilities.length >= 2 && candidate.matchedCapabilities.length >= requiredCapabilities.length) return "high";
  return candidate.runtimeDiscovered ? "high" : "medium";
}

function toCandidatePreview(candidate) {
  return {
    providerId: candidate.providerId,
    providerDisplayName: candidate.providerDisplayName,
    modelId: candidate.modelId,
    modelDisplayName: candidate.modelDisplayName,
    capabilities: candidate.capabilities,
    score: candidate.score,
    matchedCapabilities: candidate.matchedCapabilities ?? [],
    missingCapabilities: candidate.missingCapabilities ?? [],
    reasons: candidate.reasons ?? [],
    runtimeDiscovered: candidate.runtimeDiscovered,
    source: candidate.source,
  };
}

function selectManagerCandidate(models) {
  const candidates = models
    .filter((model) => model.capabilities.includes("reasoning") || model.capabilities.includes("coding") || model.capabilities.includes("chat"))
    .map((model) => ({
      ...model,
      managerScore:
        (model.capabilities.includes("reasoning") ? 40 : 0) +
        (model.capabilities.includes("coding") ? 15 : 0) +
        (model.capabilities.includes("vision") ? 8 : 0) +
        (model.runtimeDiscovered ? 5 : 0) -
        Number(model.providerPriority ?? 100) / 100,
    }))
    .sort((a, b) => b.managerScore - a.managerScore);
  const selected = candidates[0];
  return selected ? {
    providerId: selected.providerId,
    modelId: selected.modelId,
    capabilities: selected.capabilities,
    managerScore: Math.round(selected.managerScore * 100) / 100,
  } : null;
}

function summarizeInventory(models) {
  return {
    totalModels: models.length,
    enabledModels: models.length,
    providers: Array.from(new Set(models.map((model) => model.providerId))).sort(),
    sampleModels: models.slice(0, 10).map((model) => ({
      providerId: model.providerId,
      modelId: model.modelId,
      capabilities: model.capabilities,
      runtimeDiscovered: model.runtimeDiscovered,
    })),
  };
}

function summarizeCapabilities(models) {
  const byCapability = {};
  const byProvider = {};
  for (const model of models) {
    byProvider[model.providerId] = (byProvider[model.providerId] ?? 0) + 1;
    for (const capability of model.capabilities) {
      byCapability[capability] = (byCapability[capability] ?? 0) + 1;
    }
  }
  return {
    byCapability,
    byProvider,
  };
}

function createNextActions({ recommendation, analysis, missing }) {
  const actions = [
    "Treat this result as advisory only.",
    "Keep the default NVIDIA /chat lane unchanged unless a human manually chooses another model.",
    "Use the model config wizard to import provider models/list for broader global model coverage.",
  ];
  const missingCapabilities = missing.length ? missing : recommendation.missingCapabilities ?? [];
  if (missingCapabilities.length) {
    actions.push(`Add a model with capability: ${missingCapabilities.join(", ")}.`);
  }
  if (analysis.requiredCapabilities.includes("video-generation")) {
    actions.push("Video tasks need a real video-capable model or provider integration before execution can be useful.");
  }
  if (analysis.requiredCapabilities.includes("image-generation")) {
    actions.push("Image generation tasks need an image-output capable model; chat-only models should not be selected.");
  }
  actions.push("Future automatic routing should require a strong analysis model manager, explicit human approval, and executionEnabled=true in a later phase.");
  return actions;
}
