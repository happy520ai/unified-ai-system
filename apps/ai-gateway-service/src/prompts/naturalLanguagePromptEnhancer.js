export const PROMPT_ENHANCER_VERSION = "prompt-enhancer-v1";
export const PROMPT_ENHANCER_ENGINE = "local-deterministic";
export const MAX_PROMPT_INPUT_LENGTH = 20_000;

export const PROMPT_ENHANCEMENT_PROFILES = Object.freeze([
  "auto",
  "general",
  "coding",
  "analysis",
  "writing",
  "research",
  "planning",
]);

export const PROMPT_ENHANCEMENT_LANGUAGES = Object.freeze([
  "auto",
  "zh-CN",
  "en",
]);

const PROFILE_PATTERNS = Object.freeze([
  {
    profile: "coding",
    patterns: [
      /\b(code|coding|program|programming|api|endpoint|website|web app|application|bug|debug|refactor|repository|typescript|javascript|python|java|golang|sql)\b/i,
      /(代码|编程|程序|接口|端点|网站|网页|应用|小程序|修复|调试|重构|仓库|数据库|前端|后端|测试)/,
    ],
  },
  {
    profile: "research",
    patterns: [
      /\b(research|investigate|sources?|citations?|literature|evidence|survey)\b/i,
      /(研究|调研|资料|来源|引用|文献|证据|考证)/,
    ],
  },
  {
    profile: "analysis",
    patterns: [
      /\b(analy[sz]e|analysis|compare|evaluate|trade-?offs?|diagnose|why|metrics?|data)\b/i,
      /(分析|对比|比较|评估|权衡|诊断|原因|指标|数据)/,
    ],
  },
  {
    profile: "writing",
    patterns: [
      /\b(write|rewrite|edit|copy|article|blog|readme|email|proposal|story|translate)\b/i,
      /(写作|撰写|改写|润色|文案|文章|博客|自述|邮件|方案书|故事|翻译)/,
    ],
  },
  {
    profile: "planning",
    patterns: [
      /\b(plan|roadmap|schedule|milestone|strategy|steps?|launch|rollout)\b/i,
      /(计划|规划|路线图|排期|里程碑|策略|步骤|上线|发布)/,
    ],
  },
]);

const SIGNAL_PATTERNS = Object.freeze({
  format: /\b(json|markdown|table|csv|yaml|xml|bullet|list|code block)\b|表格|列表|分点|代码块|格式|结构/i,
  constraints: /\b(must|must not|should|should not|never|at least|at most|within|without|only)\b|必须|不得|不要|不能|至少|最多|以内|仅|只允许/i,
  audience: /\b(audience|reader|customer|developer|executive|beginner|expert|user)\b|受众|读者|客户|开发者|管理层|新手|专家|用户/i,
  success: /\b(success|acceptance|done|pass|criteria|metric|target)\b|成功|验收|完成标准|通过|指标|目标值/i,
  evidence: /\b(source|citation|evidence|reference|link|date)\b|来源|引用|证据|参考|链接|日期/i,
  environment: /\b(node|browser|windows|linux|macos|docker|cloud|framework|version|runtime)\b|运行环境|框架|版本|浏览器|系统|容器/i,
});

export function enhanceNaturalLanguagePrompt(request) {
  const normalized = normalizeEnhancementRequest(request);
  const language = normalized.language === "auto"
    ? detectLanguage(normalized.input)
    : normalized.language;
  const profile = normalized.profile === "auto"
    ? detectProfile(normalized.input)
    : normalized.profile;
  const signals = detectSignals(normalized.input);
  const sections = createSections({
    input: normalized.input,
    language,
    profile,
    signals,
  });
  const clarifyingQuestions = createClarifyingQuestions({
    language,
    profile,
    signals,
  });
  const enhancedPrompt = renderEnhancedPrompt({
    input: normalized.input,
    language,
    profile,
    sections,
  });

  return {
    original: normalized.input,
    enhancedPrompt,
    requestedProfile: normalized.profile,
    profile,
    language,
    changed: enhancedPrompt !== normalized.input,
    sections,
    clarifyingQuestions,
    signals,
    metadata: {
      engine: PROMPT_ENHANCER_ENGINE,
      version: PROMPT_ENHANCER_VERSION,
      providerCalled: false,
      credentialRequired: false,
      originalPreserved: enhancedPrompt.includes(normalized.input),
      deterministic: true,
    },
  };
}

export function summarizePromptEnhancement(result) {
  return {
    applied: true,
    profile: result.profile,
    language: result.language,
    engine: result.metadata.engine,
    version: result.metadata.version,
    providerCalled: false,
    originalPreserved: result.metadata.originalPreserved,
  };
}

export function normalizeEnhancementRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw createEnhancementError(
      "PROMPT_ENHANCEMENT_INVALID_REQUEST",
      "Prompt enhancement request must be an object.",
    );
  }

  if (typeof request.input !== "string" || request.input.trim().length === 0) {
    throw createEnhancementError(
      "PROMPT_ENHANCEMENT_INPUT_REQUIRED",
      "Prompt enhancement requires a non-empty input string.",
    );
  }

  if (request.input.length > MAX_PROMPT_INPUT_LENGTH) {
    throw createEnhancementError(
      "PROMPT_ENHANCEMENT_INPUT_TOO_LONG",
      `Prompt enhancement input must not exceed ${MAX_PROMPT_INPUT_LENGTH} characters.`,
      { maximumLength: MAX_PROMPT_INPUT_LENGTH, actualLength: request.input.length },
    );
  }

  const profile = request.profile ?? "auto";
  if (!PROMPT_ENHANCEMENT_PROFILES.includes(profile)) {
    throw createEnhancementError(
      "PROMPT_ENHANCEMENT_PROFILE_UNSUPPORTED",
      `Unsupported prompt enhancement profile: ${profile}`,
      { supportedProfiles: PROMPT_ENHANCEMENT_PROFILES },
    );
  }

  const language = request.language ?? "auto";
  if (!PROMPT_ENHANCEMENT_LANGUAGES.includes(language)) {
    throw createEnhancementError(
      "PROMPT_ENHANCEMENT_LANGUAGE_UNSUPPORTED",
      `Unsupported prompt enhancement language: ${language}`,
      { supportedLanguages: PROMPT_ENHANCEMENT_LANGUAGES },
    );
  }

  return {
    input: request.input,
    profile,
    language,
  };
}

export function detectLanguage(input) {
  const cjkCount = (input.match(/[\u3400-\u9fff]/g) ?? []).length;
  const latinCount = (input.match(/[A-Za-z]/g) ?? []).length;
  return cjkCount > 0 && cjkCount >= latinCount * 0.2 ? "zh-CN" : "en";
}

export function detectProfile(input) {
  const ranked = PROFILE_PATTERNS
    .map(({ profile, patterns }, priority) => ({
      profile,
      priority,
      score: patterns.reduce((sum, pattern) => sum + (pattern.test(input) ? 1 : 0), 0),
    }))
    .sort((left, right) => right.score - left.score || left.priority - right.priority);

  return ranked[0]?.score > 0 ? ranked[0].profile : "general";
}

function detectSignals(input) {
  return Object.fromEntries(
    Object.entries(SIGNAL_PATTERNS).map(([name, pattern]) => [name, pattern.test(input)]),
  );
}

function createSections({ language, profile, signals }) {
  const localized = PROFILE_CONTENT[language];
  const profileContent = localized.profiles[profile] ?? localized.profiles.general;
  const signalContent = localized.signalItems;

  return [
    {
      id: "execution",
      title: localized.executionTitle,
      items: [
        ...localized.execution,
        ...profileContent.execution,
        ...selectSignalItems(signalContent.execution, signals),
      ],
    },
    {
      id: "output",
      title: localized.outputTitle,
      items: [
        ...localized.output,
        ...profileContent.output,
        ...selectSignalItems(signalContent.output, signals),
      ],
    },
    {
      id: "acceptance",
      title: localized.acceptanceTitle,
      items: [
        ...localized.acceptance,
        ...profileContent.acceptance,
        ...selectSignalItems(signalContent.acceptance, signals),
      ],
    },
  ];
}

function selectSignalItems(rules, signals) {
  return rules
    .filter(({ when }) => signals[when])
    .map(({ item }) => item);
}

function createClarifyingQuestions({ language, profile, signals }) {
  const questions = [];
  const zh = language === "zh-CN";

  if (!signals.format) {
    questions.push(zh ? "期望的输出格式和详细程度是什么？" : "What output format and level of detail do you want?");
  }
  if (profile === "coding" && !signals.environment) {
    questions.push(zh ? "目标技术栈、运行环境和版本限制是什么？" : "What stack, runtime, and version constraints apply?");
  }
  if (profile === "writing" && !signals.audience) {
    questions.push(zh ? "内容面向谁，期望什么语气？" : "Who is the audience, and what tone should the draft use?");
  }
  if (profile === "research" && !signals.evidence) {
    questions.push(zh ? "是否需要来源链接、时间范围或特定证据标准？" : "Do you need source links, a time range, or a specific evidence standard?");
  }
  if (!signals.success && questions.length < 3) {
    questions.push(zh ? "什么结果可以视为完成或成功？" : "What result should count as complete or successful?");
  }

  return questions.slice(0, 3);
}

function renderEnhancedPrompt({ input, language, profile, sections }) {
  const localized = PROFILE_CONTENT[language];
  const lines = [
    localized.taskTitle,
    localized.taskIntro,
    "",
    "--- BEGIN ORIGINAL REQUEST ---",
    input,
    "--- END ORIGINAL REQUEST ---",
    "",
    `${localized.profileLabel}: ${localized.profileNames[profile]}`,
  ];

  for (const section of sections) {
    lines.push("", section.title, ...section.items.map((item) => `- ${item}`));
  }

  lines.push("", localized.clarificationPolicy);
  return lines.join("\n");
}

function createEnhancementError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.category = "validation";
  error.retryable = false;
  error.details = details;
  return error;
}

const PROFILE_CONTENT = Object.freeze({
  "zh-CN": {
    taskTitle: "# 任务",
    taskIntro: "完成下面的用户需求。保持原始意图、专有名词、明确约束和语气，不擅自扩大任务范围。",
    profileLabel: "任务类型",
    executionTitle: "# 执行要求",
    outputTitle: "# 输出要求",
    acceptanceTitle: "# 完成标准",
    clarificationPolicy: "如果缺少信息但仍可可靠推进，请明确最小假设后继续；只有缺失信息会阻止正确结果时，才先提出最多 3 个具体问题。",
    signalItems: {
      execution: [
        { when: "constraints", item: "将原始请求中的明确约束视为硬边界，并逐项保留。" },
        { when: "audience", item: "根据原始请求中指定的受众调整术语、深度和解释方式。" },
        { when: "environment", item: "遵守原始请求中指定的运行环境、框架、系统和版本条件。" },
      ],
      output: [
        { when: "format", item: "严格使用原始请求指定的输出格式，不额外包裹无关内容。" },
        { when: "evidence", item: "按原始请求提供可核查的来源、引用、链接或日期信息。" },
      ],
      acceptance: [
        { when: "success", item: "把原始请求中的成功、验收、指标或目标值转化为可检查的完成标准。" },
      ],
    },
    profileNames: {
      general: "通用任务",
      coding: "软件工程",
      analysis: "分析与决策",
      writing: "写作与表达",
      research: "研究与查证",
      planning: "规划与执行",
    },
    execution: [
      "先识别最终目标、输入信息和应交付的结果，再开始作答。",
      "优先遵守原始需求中明确的语言、格式、范围、时间和禁止项。",
      "不要编造事实、来源、运行结果或已完成状态；清楚区分事实、推断与建议。",
    ],
    output: [
      "先给出可直接使用的结果，再补充必要说明。",
      "结构清晰、信息密度高，避免重复原始需求和无关铺垫。",
    ],
    acceptance: [
      "逐项覆盖原始需求中的明确要求与限制。",
      "结论、建议或产物能够被用户检查和继续执行。",
    ],
    profiles: {
      general: {
        execution: ["将复杂需求拆成有顺序的步骤，并保持答案可操作。"],
        output: ["使用最适合任务的结构，不为形式而增加内容。"],
        acceptance: ["答案与用户目标直接相关，没有遗漏关键动作。"],
      },
      coding: {
        execution: [
          "先理解现有代码、接口和约束，再提出或实施改动。",
          "保持兼容性和安全边界；说明必要假设，覆盖错误路径与边界情况。",
        ],
        output: ["给出可运行的代码或明确修改点，并附上必要的验证方法。"],
        acceptance: ["实现满足需求，相关测试或检查可复现，未声称未经验证的结果。"],
      },
      analysis: {
        execution: [
          "先定义比较维度和判断标准，再分析证据、替代方案与权衡。",
          "对不确定性、数据缺口和推断条件进行显式标注。",
        ],
        output: ["给出结论、关键依据、风险和下一步建议。"],
        acceptance: ["结论能追溯到已给证据或明确标注的假设。"],
      },
      writing: {
        execution: [
          "围绕受众、目的和语气组织内容，保留用户要求的事实与术语。",
          "删除空泛套话，使表达具体、自然且有节奏。",
        ],
        output: ["优先交付完整成稿；仅在必要时附上编辑说明。"],
        acceptance: ["成稿适合目标受众，结构连贯，并符合指定语气与格式。"],
      },
      research: {
        execution: [
          "优先使用可靠且尽可能新的来源，并核对日期与适用范围。",
          "区分来源事实、交叉验证结果和自己的推断。",
        ],
        output: ["给出简明结论，并在相关陈述附近提供可核查来源。"],
        acceptance: ["核心事实有来源支持，冲突证据和信息缺口得到说明。"],
      },
      planning: {
        execution: [
          "把目标拆成里程碑、依赖、风险、负责人或决策点。",
          "按优先级和先后关系组织步骤，避免不可验证的宏大描述。",
        ],
        output: ["给出可执行计划、近期下一步和明确的完成信号。"],
        acceptance: ["每个阶段都有产物、检查点或可判断的退出条件。"],
      },
    },
  },
  en: {
    taskTitle: "# Task",
    taskIntro: "Complete the user request below. Preserve its intent, named terms, explicit constraints, and tone without expanding the scope.",
    profileLabel: "Task profile",
    executionTitle: "# Execution requirements",
    outputTitle: "# Output requirements",
    acceptanceTitle: "# Completion criteria",
    clarificationPolicy: "If missing information does not prevent reliable progress, state the minimum assumptions and continue. Ask no more than three specific questions only when the missing information blocks a correct result.",
    signalItems: {
      execution: [
        { when: "constraints", item: "Treat explicit constraints in the original request as hard boundaries and preserve them one by one." },
        { when: "audience", item: "Adapt terminology, depth, and explanations to the audience named in the original request." },
        { when: "environment", item: "Honor the runtime, framework, operating system, and version conditions named in the original request." },
      ],
      output: [
        { when: "format", item: "Use the output format requested in the original request exactly; do not wrap it in irrelevant material." },
        { when: "evidence", item: "Provide the requested verifiable sources, citations, links, or dates near the relevant claims." },
      ],
      acceptance: [
        { when: "success", item: "Turn the requested success criteria, acceptance checks, metrics, or targets into inspectable completion conditions." },
      ],
    },
    profileNames: {
      general: "General task",
      coding: "Software engineering",
      analysis: "Analysis and decision support",
      writing: "Writing and communication",
      research: "Research and verification",
      planning: "Planning and execution",
    },
    execution: [
      "Identify the final objective, available inputs, and expected deliverable before answering.",
      "Honor every explicit language, format, scope, timing, and prohibition in the original request.",
      "Do not invent facts, sources, execution results, or completion status; distinguish facts, inferences, and recommendations.",
    ],
    output: [
      "Lead with a directly usable result, followed by only the explanation needed to use it.",
      "Keep the structure clear and information-dense; avoid repeating the request or adding irrelevant preamble.",
    ],
    acceptance: [
      "Cover every explicit requirement and constraint in the original request.",
      "Make the conclusion, recommendation, or artifact inspectable and actionable.",
    ],
    profiles: {
      general: {
        execution: ["Break complex work into ordered steps while keeping the response actionable."],
        output: ["Use the structure that best fits the task without adding ceremony."],
        acceptance: ["The response directly advances the user's goal and omits no critical action."],
      },
      coding: {
        execution: [
          "Understand the existing code, interfaces, and constraints before proposing or applying changes.",
          "Preserve compatibility and safety boundaries; state necessary assumptions and cover errors and edge cases.",
        ],
        output: ["Provide runnable code or precise change points with the necessary verification steps."],
        acceptance: ["The implementation meets the request, checks are reproducible, and no unverified result is claimed."],
      },
      analysis: {
        execution: [
          "Define comparison dimensions and decision criteria before assessing evidence, alternatives, and trade-offs.",
          "Make uncertainty, data gaps, and inference conditions explicit.",
        ],
        output: ["Provide the conclusion, key evidence, risks, and recommended next action."],
        acceptance: ["Each conclusion traces to supplied evidence or a clearly labeled assumption."],
      },
      writing: {
        execution: [
          "Organize around audience, purpose, and tone while preserving required facts and terminology.",
          "Remove generic filler and make the language concrete, natural, and well paced.",
        ],
        output: ["Deliver a complete draft first and include editorial notes only when needed."],
        acceptance: ["The draft fits its audience, reads coherently, and follows the requested tone and format."],
      },
      research: {
        execution: [
          "Prefer reliable and current sources, checking dates and scope of applicability.",
          "Separate sourced facts, cross-checked findings, and your own inferences.",
        ],
        output: ["Give a concise conclusion and place verifiable sources near the claims they support."],
        acceptance: ["Core facts are sourced, and conflicting evidence or information gaps are disclosed."],
      },
      planning: {
        execution: [
          "Break the goal into milestones, dependencies, risks, owners, or decision points.",
          "Order work by priority and dependency, avoiding grand claims that cannot be verified.",
        ],
        output: ["Provide an executable plan, the immediate next step, and clear completion signals."],
        acceptance: ["Every phase has a deliverable, checkpoint, or observable exit condition."],
      },
    },
  },
});
