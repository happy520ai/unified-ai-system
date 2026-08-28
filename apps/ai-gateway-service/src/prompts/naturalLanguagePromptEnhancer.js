export const PROMPT_ENHANCER_VERSION = "prompt-enhancer-v3";
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

export const PROMPT_ENHANCEMENT_TARGETS = Object.freeze(["model", "agent"]);

export const PROMPT_ENHANCEMENT_INTENTS = Object.freeze([
  "translate",
  "summarize",
  "plan",
  "investigate",
  "evaluate",
  "explain",
  "modify",
  "operate",
  "create",
  "assist",
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
  constraints: /\b(must|must not|should|should not|never|at least|at most|within|without|only)\b|必须|不得|不要|不能|至少|最多|以内|天内|小时内|分钟内|仅|只允许/i,
  audience: /\b(audience|reader|customer|developer|executive|beginner|expert|user)\b|受众|读者|客户|开发者|管理层|新手|专家|用户/i,
  success: /\b(success|acceptance|done|pass|criteria|metric|target)\b|成功|验收|完成标准|通过|指标|目标值/i,
  evidence: /\b(source|citation|evidence|reference|link|date)\b|来源|引用|证据|参考|链接|日期/i,
  environment: /\b(node|browser|windows|linux|macos|docker|cloud|framework|version|runtime)\b|运行环境|框架|版本|浏览器|系统|容器/i,
});

const REQUESTED_LANGUAGE_PATTERNS = Object.freeze([
  {
    language: "zh-CN",
    patterns: [
      /\b(?:answer|reply|respond|write|output|return|provide|produce|render|translate)(?:\s+\w+){0,3}\s+(?:in|into)\s+(?:simplified\s+|traditional\s+)?chinese\b(?=\s*(?:[,.!?;:]|$|\b(?:with|and|using|while|but)\b))/i,
      /\b(?:use|using)\s+(?:simplified\s+|traditional\s+)?chinese\b(?=\s*(?:[,.!?;:]|$))/i,
      /(?:请|请你)?(?:用|使用|以)(?:简体中文|繁体中文|中文)(?:回答|回复|输出|撰写|说明|作答)?(?=\s*(?:[，,。.!！?？；;：:]|$))/,
      /(?:翻译|改写)(?:成|为)(?:简体中文|繁体中文|中文)(?=\s*(?:[，,。.!！?？；;：:]|$))/,
    ],
  },
  {
    language: "en",
    patterns: [
      /\b(?:answer|reply|respond|write|output|return|provide|produce|render|translate)(?:\s+\w+){0,3}\s+(?:in|into)\s+english\b(?=\s*(?:[,.!?;:]|$|\b(?:with|and|using|while|but)\b))/i,
      /\b(?:use|using)\s+english\b(?=\s*(?:[,.!?;:]|$))/i,
      /(?:请|请你)?(?:用|使用|以)(?:英语|英文)(?:回答|回复|输出|撰写|说明|作答)?(?=\s*(?:[，,。.!！?？；;：:]|$))/,
      /(?:翻译|改写)(?:成|为)(?:英语|英文)(?=\s*(?:[，,。.!！?？；;：:]|$))/,
    ],
  },
]);

const CONSTRAINT_PATTERNS = Object.freeze([
  /\b(must|must not|should|should not|cannot|can't|at least|at most|within|only|no more|not more|not less|never|avoid)\b/i,
  /(?:必须|必须要|不得|不要|不能|不能超过|至少|最多|仅|只允许|禁止|避免|排除|天内|小时内|分钟内)/,
]);

const INTENT_PATTERNS = Object.freeze([
  { intent: "translate", patterns: [/\btranslate\b|\blocali[sz]e\b/i, /翻译|译成|转成英文|转成中文/] },
  { intent: "summarize", patterns: [/\bsummarize\b|\btldr\b|\brecap\b/i, /总结|归纳|摘要|概括|提炼/] },
  { intent: "plan", patterns: [/\bplan\b|\broadmap\b|\bschedule\b|\bmilestone/i, /制定计划|做计划|规划|排期|路线图|里程碑|分阶段/] },
  { intent: "investigate", patterns: [/\bresearch\b|\binvestigate\b|\blook into\b|\bsurvey\b/i, /调研|研究|查证|考证|调查|摸底/] },
  { intent: "evaluate", patterns: [/\bcompare\b|\bevaluate\b|\bassess\b|\banaly[sz]e\b|\breview\b|\btrade-?offs?\b/i, /对比|比较|评估|分析|权衡|评审|打分|排序/] },
  { intent: "explain", patterns: [/\bexplain\b|\bteach\b|\bwhat is\b|\bwhy\b|\bhow (?:do|does|to|can)\b/i, /解释|讲解|说明一下|是什么|为什么|怎么回事|怎么用|如何工作|入门/] },
  { intent: "modify", patterns: [/\bfix\b|\bdebug\b|\brefactor\b|\boptimi[sz]e\b|\bmodify\b|\bupdate\b|\bimprove\b|\bmigrate\b|\bchange\b/i, /修复|改 bug|修改|重构|优化|调整|改造|迁移|升级|排错|调试/] },
  { intent: "operate", patterns: [/\bdeploy\b|\brelease\b|\broll out\b|\binstall\b|\bset up\b|\bconfigure\b|\bpublish\b/i, /部署|发布|上线|安装|配置|搭建环境|运维/] },
  { intent: "create", patterns: [/\bbuild\b|\bcreate\b|\bimplement\b|\bwrite\b|\bdevelop\b|\bgenerate\b|\badd\b|\bmake\b|\bdesign\b/i, /写一个|写个|做一个|做个|弄一个|弄个|搞一个|搞个|开发|实现|创建|构建|生成|新增|设计|起草|搭一个/] },
]);

const TECHNOLOGY_TERMS = Object.freeze([
  "node.js", "nodejs", "node", "deno", "bun", "typescript", "javascript",
  "python", "java", "golang", "rust", "php", "ruby", "kotlin", "swift",
  "react", "vue", "angular", "svelte", "next.js", "nuxt", "express",
  "fastify", "nestjs", "django", "flask", "fastapi", "spring", "laravel",
  "docker", "kubernetes", "k8s", "nginx", "postgres", "postgresql", "mysql",
  "mariadb", "sqlite", "mongodb", "redis", "memcached", "elasticsearch",
  "kafka", "rabbitmq", "nats", "grpc", "graphql", "restful", "websocket",
  "http", "https", "oauth", "jwt", "sso", "html", "css", "tailwind",
  "bootstrap", "vite", "webpack", "rollup", "esbuild", "jest", "vitest",
  "mocha", "pytest", "junit", "playwright", "selenium", "cypress",
  "git", "github", "gitlab", "ci/cd", "linux", "ubuntu", "debian", "centos",
  "windows", "macos", "ios", "android", "aws", "gcp", "azure", "vercel",
  "cloudflare", "nginx", "sqlite3", "prisma", "drizzle", "sequelize",
]);

const TECHNOLOGY_SPECIAL_PATTERNS = Object.freeze([
  { term: "C++", pattern: /(^|[^a-z0-9+])c\+\+/i },
  { term: "C#", pattern: /(^|[^a-z0-9#])c#(?![a-z0-9])/i },
  { term: ".NET", pattern: /(^|[^a-z0-9])\.net\b/i },
]);

const TECHNOLOGY_ZH_TERMS = Object.freeze([
  "数据库", "数据表", "缓存", "消息队列", "网关", "微服务", "中间件",
  "负载均衡", "容器", "镜像", "前端", "后端", "客户端", "服务端",
  "分布式", "单体应用", "数据仓库", "对象存储",
]);

const ARTIFACT_TERMS = Object.freeze({
  en: [
    { term: "API", pattern: /\bapi\b|\bapi interface\b/i },
    { term: "website", pattern: /\bweb ?site\b|\bweb page\b|\blanding page\b/i },
    { term: "app", pattern: /\b(?:web |mobile )?app(?:lication)?s?\b/i },
    { term: "report", pattern: /\breports?\b/i },
    { term: "document", pattern: /\bdocuments?\b|\bdocs\b/i },
    { term: "email", pattern: /\bemails?\b/i },
    { term: "article", pattern: /\barticles?\b|\bblog post\b/i },
    { term: "checklist", pattern: /\bchecklists?\b/i },
    { term: "dashboard", pattern: /\bdashboards?\b/i },
    { term: "form", pattern: /\bforms?\b/i },
    { term: "chart", pattern: /\bcharts?\b|\bgraphs?\b/i },
    { term: "presentation", pattern: /\bpresentations?\b|\bslides?\b/i },
    { term: "script", pattern: /\bscripts?\b/i },
    { term: "test suite", pattern: /\btests?\b|\btest suite\b/i },
    { term: "database", pattern: /\bdatabase\b/i },
  ],
  zh: [
    { term: "接口（API）", pattern: /接口|API/i },
    { term: "网站/网页", pattern: /网站|网页|落地页/i },
    { term: "应用", pattern: /应用|软件|系统|小程序|App/i },
    { term: "报告", pattern: /报告|汇报/i },
    { term: "文档", pattern: /文档|说明书/i },
    { term: "邮件", pattern: /邮件|信件/i },
    { term: "文章", pattern: /文章|博客|帖子/i },
    { term: "清单", pattern: /清单|列表/i },
    { term: "仪表盘", pattern: /仪表盘|看板/i },
    { term: "表单", pattern: /表单/i },
    { term: "图表", pattern: /图表/i },
    { term: "演示文稿", pattern: /演示|幻灯片|PPT/i },
    { term: "脚本", pattern: /脚本/i },
    { term: "测试", pattern: /测试|用例/i },
    { term: "数据库", pattern: /数据库/i },
  ],
});

const QUANTITY_PATTERN = /(\d+(?:\.\d+)?)\s*(个|条|篇|页|次|天|小时|分钟|秒|项|字|items?|pages?|days?|hours?|minutes?|seconds?|words?|records?|requests?|users?)/gi;

const TIME_PATTERNS = Object.freeze([
  /\d{4}-\d{1,2}-\d{1,2}/,
  /\d{1,2}\s*月\s*\d{1,2}\s*[日号]/,
  /\b(?:today|tomorrow|yesterday|next week|this week|next month|this month|next quarter|end of (?:the )?(?:day|week|month|quarter|year)|by (?:mon|tues|wednes|thurs|fri|satur|sun)day|weekend)\b/i,
  /今天|明天|后天|昨天|本周|下周|这周|本月|下月|月底|年底|季度末|工作日|周末|早上|上午|下午|傍晚|晚上/,
]);

const REFERENCE_PATTERNS = Object.freeze([
  /https?:\/\/[^\s，。；）)」"']+/,
  /\b[\w-]+\.(?:ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|json|ya?ml|md|sql|css|html|toml|ini|sh|ps1)\b/,
  /[\w.-]*[\\/][\w.-]+/,
]);

const AMBIGUITY_PATTERNS = Object.freeze([
  {
    kind: "reference",
    patterns: [
      { pattern: /(这个|那个|它|这份|这封|这块|这篇|这批|那批)/, span: 1 },
      { pattern: /\bit\b/i, span: 0 },
      { pattern: /\b(this|that)\b(?=\s+(?:is|was|needs?|should|looks?|seems?|works?|fails?|breaks?|keeps?)\b)/i, span: 0 },
    ],
  },
  {
    kind: "quality",
    patterns: [
      { pattern: /(好一点|好一些|更好|快一点|快一些|更优|更流畅|更漂亮|更好用|更简洁|优化一下|改进一下|提升一下|完善一下|弄好|搞好)/, span: 1 },
      { pattern: /\b(better|faster|nicer|cleaner|clearer|smoother|prettier|more user-friendly|improve it|optimize it|clean it up|polish it)\b/i, span: 0 },
    ],
  },
  {
    kind: "quantity",
    patterns: [
      { pattern: /(一些|几个|若干|有些|大概|差不多|适量|一批)/, span: 1 },
      { pattern: /\b(some|a few|several|a couple of|a bunch of)\b/i, span: 0 },
    ],
  },
]);

const AMBIGUITY_QUESTIONS = Object.freeze({
  "zh-CN": {
    reference: "「{span}」指代的具体对象是什么？请指明名称、文件或数据来源。",
    quality: "「{span}」期望改进到什么程度？请给出可判断的标准或参照（如指标、示例）。",
    quantity: "「{span}」的大致数量或范围是多少？",
  },
  en: {
    reference: "What does \"{span}\" refer to? Name the file, record, or item.",
    quality: "How much better is \"{span}\" in measurable terms? Give a target or reference point.",
    quantity: "Roughly how many does \"{span}\" mean?",
  },
});

const INTENT_LABELS = Object.freeze({
  "zh-CN": {
    translate: "翻译转换",
    summarize: "总结归纳",
    plan: "制定计划",
    investigate: "调研查证",
    evaluate: "评估与对比",
    explain: "解释说明",
    modify: "修改与修复",
    operate: "部署与操作",
    create: "创建与实现",
    assist: "通用协助",
  },
  en: {
    translate: "translate and convert",
    summarize: "summarize and distill",
    plan: "produce a plan",
    investigate: "research and verify",
    evaluate: "evaluate and compare",
    explain: "explain and teach",
    modify: "modify or fix",
    operate: "deploy or operate",
    create: "create and implement",
    assist: "general assistance",
  },
});

const DELIVERABLE_TEMPLATES = Object.freeze({
  "zh-CN": {
    coding: {
      create: "可运行的实现（代码与接口），附最小验证方法",
      modify: "修复或改造后的结果，逐点说明改动与回归验证",
      explain: "面向开发者的说明，指出关键代码、接口与原因",
      default: "工程结论或产物，附可复现的验证方式",
    },
    analysis: {
      default: "结论 + 关键依据 + 风险 + 建议的下一步",
    },
    writing: {
      create: "可直接使用的完整成稿",
      modify: "修改后的成稿与关键改动说明",
      default: "符合受众与语气的可用文本",
    },
    research: {
      default: "简明结论 + 可核查的来源与证据缺口说明",
    },
    planning: {
      default: "可执行计划：里程碑、依赖、风险与完成信号",
    },
    general: {
      create: "直接可用的产物与必要说明",
      default: "直接可用的答复：结果在前，说明在后",
    },
  },
  en: {
    coding: {
      create: "a runnable implementation (code and interfaces) with a minimal verification method",
      modify: "the fixed or reworked result with change points and regression checks",
      explain: "a developer-facing explanation pointing at the key code, interfaces, and causes",
      default: "an engineering conclusion or artifact with a reproducible verification path",
    },
    analysis: {
      default: "conclusion + key evidence + risks + recommended next step",
    },
    writing: {
      create: "a complete, directly usable draft",
      modify: "the revised draft with key edits explained",
      default: "usable text that fits the audience and tone",
    },
    research: {
      default: "a concise conclusion with verifiable sources and evidence gaps",
    },
    planning: {
      default: "an executable plan: milestones, dependencies, risks, and completion signals",
    },
    general: {
      create: "a directly usable artifact with only the explanation needed to use it",
      default: "a directly usable answer: result first, explanation after",
    },
  },
});

const STEP_TEMPLATES = Object.freeze({
  "zh-CN": {
    general: [
      "复述目标：用一句话确认要交付什么、以什么为界。",
      "将请求拆成有顺序的子任务，标出必须先解决的依赖。",
      "逐项执行，遇到缺失信息先声明最小假设再继续。",
      "对照原始需求逐项自检，确认没有遗漏或扩大范围。",
      "交付结果与必要说明，区分事实、推断与建议。",
    ],
    coding: [
      "确认输入、输出、边界与运行环境（语言、框架、版本）。",
      "定位相关代码、接口与既有约定，不臆测不存在的实现。",
      "实现最小可验证版本，再补齐错误路径与边界情况。",
      "对照原始需求与硬约束逐项核对，运行可用的检查或测试。",
      "交付代码或改动点，并附验证方法与结果。",
    ],
    analysis: [
      "明确比较维度与判断标准，先说清「以什么为优」。",
      "整理已知证据与数据缺口，缺失处显式标注。",
      "逐维度评估与权衡，给出来源或假设支撑。",
      "给出结论、风险与建议的下一步。",
    ],
    writing: [
      "确认受众、目的与语气，明确内容必须保留的事实与术语。",
      "列出内容要点与结构，先搭骨架再成文。",
      "撰写完整成稿，删除空泛套话。",
      "按受众与语气自检后交付成稿。",
    ],
    research: [
      "界定检索范围与时间边界，明确什么算可靠来源。",
      "检索并筛选来源，核对日期与适用范围。",
      "交叉验证关键事实，区分来源事实与自身推断。",
      "综合结论并标注证据与信息缺口。",
    ],
    planning: [
      "明确目标与完成信号：做到什么程度算完成。",
      "拆解里程碑与依赖，按优先级排序。",
      "识别风险、决策点与所需资源。",
      "给出近期下一步与可检查的退出条件。",
    ],
  },
  en: {
    general: [
      "Restate the goal: one sentence on what to deliver and where the boundary is.",
      "Break the request into ordered subtasks and mark blocking dependencies.",
      "Execute item by item; state minimal assumptions before continuing when information is missing.",
      "Self-check against the original request for omissions or scope creep.",
      "Deliver the result with only the explanation needed, separating facts, inferences, and suggestions.",
    ],
    coding: [
      "Confirm inputs, outputs, boundaries, and the runtime (language, framework, version).",
      "Locate the relevant code, interfaces, and existing conventions; never assume code that may not exist.",
      "Implement the minimal verifiable version, then cover error paths and edge cases.",
      "Check every requirement and hard constraint; run available checks or tests.",
      "Deliver the code or change points with the verification method and its result.",
    ],
    analysis: [
      "Define comparison dimensions and decision criteria: state what 'better' means first.",
      "Line up known evidence and data gaps; mark missing pieces explicitly.",
      "Assess and weigh each dimension, supported by sources or labeled assumptions.",
      "Deliver conclusion, risks, and the recommended next step.",
    ],
    writing: [
      "Confirm audience, purpose, and tone; list facts and terminology that must be preserved.",
      "Outline the key points and structure before drafting.",
      "Write the complete draft and remove generic filler.",
      "Self-check against audience and tone, then deliver the draft.",
    ],
    research: [
      "Define the search scope and time boundary, and what counts as a reliable source.",
      "Search and filter sources, checking dates and applicability.",
      "Cross-verify key facts, separating sourced facts from your own inference.",
      "Synthesize the conclusion with evidence and information gaps labeled.",
    ],
    planning: [
      "Define the goal and completion signals: what done looks like.",
      "Break the work into milestones and dependencies ordered by priority.",
      "Identify risks, decision points, and required resources.",
      "Deliver the immediate next step with inspectable exit conditions.",
    ],
  },
});

function dedupeArray(items) {
  return [...new Set(items.filter((item) => typeof item === "string" && item.trim().length > 0))];
}

function normalizeInputText(input) {
  return String(input)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function splitInputSentences(input) {
  return String(input)
    .split(/[\n。！？!?；;]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 6);
}

function extractConstraintCandidates(input) {
  return dedupeArray(
    splitInputSentences(input)
      .filter((sentence) =>
        CONSTRAINT_PATTERNS.some((pattern) => pattern.test(sentence))
      )
      .map((sentence) => sentence.trim()),
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchTechnologyTerms(input) {
  const matched = [];
  for (const term of TECHNOLOGY_TERMS) {
    const needsBoundary = /^[a-z0-9]/i.test(term) && /[a-z0-9]$/i.test(term);
    const pattern = new RegExp(
      `\\b${escapeRegExp(term)}${needsBoundary ? "\\b" : ""}`,
      "i",
    );
    if (pattern.test(input)) matched.push(term);
  }
  for (const { term, pattern } of TECHNOLOGY_SPECIAL_PATTERNS) {
    if (pattern.test(input)) matched.push(term);
  }
  for (const term of TECHNOLOGY_ZH_TERMS) {
    if (input.includes(term)) matched.push(term);
  }
  return dedupeArray(matched)
    .filter((term) => !matched.some((other) =>
      other !== term && other.toLowerCase().includes(term.toLowerCase())))
    .slice(0, 8);
}

function matchArtifactTerms(input, language) {
  const locale = language === "zh-CN" ? "zh" : "en";
  const matched = ARTIFACT_TERMS[locale]
    .filter(({ pattern }) => pattern.test(input))
    .map(({ term }) => term);
  return dedupeArray(matched).slice(0, 5);
}

function matchQuantities(input) {
  const matches = [...input.matchAll(QUANTITY_PATTERN)]
    .map((match) => match[0].replace(/\s+/g, ""))
    .filter((value) => value.length > 0);
  return dedupeArray(matches).slice(0, 5);
}

function matchTimeExpressions(input) {
  const matched = TIME_PATTERNS.filter((pattern) => pattern.test(input))
    .map((pattern) => {
      const match = input.match(pattern);
      return match ? match[0] : null;
    })
    .filter((value) => typeof value === "string" && value.length > 0);
  return dedupeArray(matched).slice(0, 3);
}

function matchAllWithGlobal(source, pattern) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  return [...source.matchAll(new RegExp(pattern.source, flags))];
}

function matchReferences(input) {
  const matched = [];
  for (const pattern of REFERENCE_PATTERNS) {
    for (const match of matchAllWithGlobal(input, pattern)) {
      matched.push(match[0]);
    }
  }
  return dedupeArray(matched).slice(0, 5);
}

export function detectIntent(input) {
  for (const { intent, patterns } of INTENT_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(input))) return intent;
  }
  return "assist";
}

export function extractEntities(input, language) {
  const technologies = matchTechnologyTerms(input);
  const technologyKeys = new Set(technologies.map((term) => term.toLowerCase()));
  return {
    technologies,
    artifacts: matchArtifactTerms(input, language),
    quantities: matchQuantities(input),
    timeExpressions: matchTimeExpressions(input),
    references: matchReferences(input)
      .filter((reference) => !technologyKeys.has(reference.toLowerCase())),
  };
}

export function detectAmbiguities(input, language) {
  const locale = language === "zh-CN" ? "zh-CN" : "en";
  const ambiguities = [];
  const seen = new Set();
  for (const { kind, patterns } of AMBIGUITY_PATTERNS) {
    for (const { pattern, span } of patterns) {
      for (const match of matchAllWithGlobal(input, pattern)) {
        const value = match[span] ?? match[0];
        const key = `${kind}:${value}`;
        if (seen.has(key)) continue;
        seen.add(key);
        ambiguities.push({
          span: value,
          kind,
          question: AMBIGUITY_QUESTIONS[locale][kind].replace("{span}", value),
        });
      }
    }
  }
  return ambiguities.slice(0, 4);
}

function buildDeliverableDescription({ profile, intent, entities, language }) {
  const templates = DELIVERABLE_TEMPLATES[language][profile] ?? DELIVERABLE_TEMPLATES[language].general;
  const template = templates[intent] ?? templates.default ?? DELIVERABLE_TEMPLATES[language].general.default;
  const artifacts = entities.artifacts;
  if (artifacts.length === 0) return template;
  const focus = artifacts.slice(0, 3).join(language === "zh-CN" ? "、" : ", ");
  return language === "zh-CN"
    ? `围绕${focus}，交付${template}`
    : `Focused on ${focus}: deliver ${template}`;
}

export function enhanceNaturalLanguagePrompt(request) {
  const normalized = normalizeEnhancementRequest(request);
  const language = normalized.language === "auto"
    ? detectLanguage(normalized.input)
    : normalized.language;
  const profile = normalized.profile === "auto"
    ? detectProfile(normalized.input)
    : normalized.profile;
  const target = normalized.target;
  const signals = detectSignals(normalized.input);
  const constraints = extractConstraintCandidates(normalized.input);
  const intent = detectIntent(normalized.input);
  const entities = extractEntities(normalized.input, language);
  const ambiguities = detectAmbiguities(normalized.input, language);
  const deliverable = buildDeliverableDescription({ profile, intent, entities, language });
  const steps = STEP_TEMPLATES[language][profile] ?? STEP_TEMPLATES[language].general;
  const assumptions = inferAssumptions({
    input: normalized.input,
    profile,
    language,
    signals,
    normalizedProfile: profile,
    constraintsDetected: constraints.length > 0,
  });
  const analysis = {
    intent: {
      kind: intent,
      label: INTENT_LABELS[language][intent],
    },
    entities,
    deliverable,
    steps,
    ambiguities,
  };
  const sections = createSections({
    language,
    profile,
    target,
    signals,
    constraints,
    assumptions,
    analysis,
  });
  const clarifyingQuestions = createClarifyingQuestions({
    language,
    profile,
    signals,
    ambiguities,
  });
  const enhancedPrompt = renderEnhancedPrompt({
    input: normalized.input,
    language,
    profile,
    target,
    sections,
    analysis,
    clarifyingQuestions,
  });

  return {
    original: normalized.input,
    enhancedPrompt,
    requestedProfile: normalized.profile,
    profile,
    language,
    target,
    changed: enhancedPrompt !== normalized.input,
    sections,
    analysis,
    constraints,
    assumptions,
    clarifyingQuestions,
    signals,
    quality: buildQualityProfile({
      profile,
      signals,
      clarifyingQuestions,
      constraints,
      assumptions,
      language,
      ambiguities,
      entities,
    }),
    metadata: {
      engine: PROMPT_ENHANCER_ENGINE,
      version: PROMPT_ENHANCER_VERSION,
      providerCalled: false,
      credentialRequired: false,
      originalPreserved: enhancedPrompt.includes(normalized.input),
      deterministic: true,
      target,
    },
  };
}

export function summarizePromptEnhancement(result) {
  return {
    applied: true,
    profile: result.profile,
    language: result.language,
    target: result.target,
    intent: result.analysis?.intent?.kind ?? null,
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

  const normalizedInput = normalizeInputText(request.input ?? "");
  if (typeof request.input !== "string" || normalizedInput.length === 0) {
    throw createEnhancementError(
      "PROMPT_ENHANCEMENT_INPUT_REQUIRED",
      "Prompt enhancement requires a non-empty input string.",
    );
  }

  if (normalizedInput.length > MAX_PROMPT_INPUT_LENGTH) {
    throw createEnhancementError(
      "PROMPT_ENHANCEMENT_INPUT_TOO_LONG",
      `Prompt enhancement input must not exceed ${MAX_PROMPT_INPUT_LENGTH} characters.`,
      { maximumLength: MAX_PROMPT_INPUT_LENGTH, actualLength: normalizedInput.length },
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

  const target = request.target ?? "model";
  if (!PROMPT_ENHANCEMENT_TARGETS.includes(target)) {
    throw createEnhancementError(
      "PROMPT_ENHANCEMENT_TARGET_UNSUPPORTED",
      `Unsupported prompt enhancement target: ${target}`,
      { supportedTargets: PROMPT_ENHANCEMENT_TARGETS },
    );
  }

  return {
    input: normalizedInput,
    profile,
    language,
    target,
  };
}

export function detectLanguage(input) {
  const requestedLanguage = REQUESTED_LANGUAGE_PATTERNS.find(({ patterns }) =>
    patterns.some((pattern) => pattern.test(input))
  )?.language;
  if (requestedLanguage) return requestedLanguage;

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

function collectEntitySpans(entities) {
  const spans = [];
  const seen = new Set();
  for (const value of [
    ...entities.technologies,
    ...entities.artifacts,
    ...entities.quantities,
    ...entities.timeExpressions,
    ...entities.references,
  ]) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    spans.push(value);
  }
  return spans.slice(0, 10);
}

function createSections({
  language,
  profile,
  target,
  signals,
  constraints,
  assumptions,
  analysis,
}) {
  const localized = PROFILE_CONTENT[language];
  const profileContent = localized.profiles[profile] ?? localized.profiles.general;
  const signalContent = localized.signalItems;

  const contextItems = [
    localized.labels.intentItem.replace("{value}", analysis.intent.label),
    localized.labels.deliverableItem.replace("{value}", analysis.deliverable),
  ];
  const entitySpans = collectEntitySpans(analysis.entities);
  if (entitySpans.length > 0) {
    contextItems.push(
      localized.labels.entityItem.replace("{value}", entitySpans.join(language === "zh-CN" ? "、" : ", ")),
    );
  } else {
    contextItems.push(localized.labels.noEntityItem);
  }
  if (analysis.ambiguities.length > 0) {
    contextItems.push(
      localized.labels.ambiguityItem.replace(
        "{value}",
        analysis.ambiguities.map((ambiguity) => ambiguity.span).join(language === "zh-CN" ? "、" : ", "),
      ),
    );
  }

  const execution = findOrCreateExecutionItems({
    localized,
    profileContent,
    signalContent,
    constraints,
    assumptions,
    signals,
    analysis,
    language,
  });

  const sections = [
    {
      id: "context",
      title: localized.contextTitle,
      items: contextItems,
    },
    {
      id: "execution",
      title: localized.executionTitle,
      items: execution,
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

  if (target === "agent") {
    sections.push({
      id: "agent",
      title: localized.agentTitle,
      items: [...localized.agentProtocol],
    });
  }

  return sections;
}

function findOrCreateExecutionItems({
  localized,
  profileContent,
  signalContent,
  constraints,
  assumptions,
  signals,
  analysis,
  language,
}) {
  const items = [
    ...localized.execution,
    ...profileContent.execution,
    ...constraints.map((item) =>
      localized.labels.constraintItem.replace("{value}", item)),
    ...selectSignalItems(signalContent.execution, signals),
    ...assumptions.map((item) =>
      localized.labels.assumptionItem.replace("{value}", item)),
  ];
  items.push(localized.labels.stepsIntro);
  for (const [index, step] of analysis.steps.entries()) {
    items.push(localized.labels.stepItem
      .replace("{index}", String(index + 1))
      .replace("{value}", step));
  }
  return items;
}

function inferAssumptions({
  profile,
  language,
  signals,
  constraintsDetected,
}) {
  const locale = language === "zh-CN" ? "zh" : "en";
  const base = ASSUMPTION_PATTERNS[profile]?.[locale] ?? ASSUMPTION_PATTERNS.general[locale];
  const fallback = ASSUMPTION_PATTERNS.general[locale];

  const inferred = [];
  if (!signals.environment) {
    inferred.push(base[0] ?? fallback[0]);
  }
  if (!constraintsDetected && !signals.constraints) {
    inferred.push(base[1] ?? fallback[1]);
  }
  return dedupeArray(inferred).slice(0, 2);
}

function buildQualityProfile({
  profile,
  signals,
  clarifyingQuestions,
  constraints,
  assumptions,
  language,
  ambiguities,
  entities,
}) {
  const totalSignals = Object.keys(signals).length;
  const detectedSignals = Object.values(signals).filter(Boolean).length;
  const signalCoverage = totalSignals > 0 ? Math.round((detectedSignals / totalSignals) * 100) : 0;
  const assumptionGap = assumptions.length === 0;
  const constraintGap = constraints.length === 0 && profile !== "general";
  const ambiguityCount = ambiguities.length;
  const entityCount = collectEntitySpans(entities).length;

  const qualityLevel = signalCoverage >= 83
    && assumptions.length <= 1
    && !constraintGap
    && ambiguityCount === 0
    ? "high"
    : signalCoverage >= 50 && clarifyingQuestions.length <= 3 && ambiguityCount <= 1
      ? "medium"
      : "needs-clarification";

  const recommendations = [];
  if (constraintGap) {
    recommendations.push(language === "zh-CN"
      ? "补充并明确硬约束（安全、合规、禁用项、范围边界）。"
      : "Add explicit hard constraints (scope, safety/compliance, and hard exclusions).");
  }
  if (!signals.success) {
    recommendations.push(language === "zh-CN"
      ? "补充可验收标准与目标值。"
      : "Provide explicit acceptance criteria and target metrics.");
  }
  if (ambiguityCount > 0) {
    recommendations.push(language === "zh-CN"
      ? `消除模糊表述（${ambiguities.map((item) => item.span).join("、")}），替换为可判断的标准或具体数量。`
      : `Replace vague phrasing (${ambiguities.map((item) => item.span).join(", ")}) with measurable criteria or concrete counts.`);
  }

  return {
    signalCoverage,
    clarificationsNeeded: clarifyingQuestions.length,
    constraintsDetected: constraints.length > 0,
    assumptionCount: assumptions.length,
    ambiguityCount,
    entityCount,
    qualityLevel,
    recommendations,
  };
}

function selectSignalItems(rules, signals) {
  return rules
    .filter(({ when }) => signals[when])
    .map(({ item }) => item);
}

function createClarifyingQuestions({ language, profile, signals, ambiguities }) {
  const questions = [];
  const zh = language === "zh-CN";

  for (const ambiguity of ambiguities) {
    questions.push(ambiguity.question);
  }

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
  if (profile === "analysis" && !signals.success) {
    questions.push(zh ? "你最关心的决策权重（成本/速度/可维护性/风险）顺序是什么？" : "What is the top-priority decision criterion order (cost, speed, maintainability, risk)?");
  }
  if (profile === "planning" && !signals.audience) {
    questions.push(zh ? "这个计划的主要受众是谁？（研发、运营、管理层）" : "Who is the primary audience for this plan? (engineering, operations, leadership)");
  }
  if (!signals.success && questions.length < 3) {
    questions.push(zh ? "什么结果可以视为完成或成功？" : "What result should count as complete or successful?");
  }
  if (!signals.format && questions.length < 3) {
    questions.push(zh ? "是否需要固定输出模板，例如表格、清单、里程碑格式？" : "Do you need a fixed output template such as table, checklist, or milestone format?");
  }

  return dedupeArray(questions).slice(0, 3);
}

function renderEnhancedPrompt({
  input,
  language,
  profile,
  target,
  sections,
  analysis,
  clarifyingQuestions,
}) {
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
    `${localized.intentLabel}: ${analysis.intent.label}`,
    `${localized.deliverableLabel}: ${analysis.deliverable}`,
    target === "agent" ? localized.agentModeNotice : null,
  ].filter((line) => line !== null);

  for (const section of sections) {
    lines.push("", section.title, ...section.items.map((item) => `- ${item}`));
  }

  if (clarifyingQuestions.length > 0) {
    lines.push(
      "",
      localized.clarificationTitle,
      ...clarifyingQuestions.map((question, index) =>
        localized.labels.clarificationItem
          .replace("{index}", String(index + 1))
          .replace("{value}", question)),
    );
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

const ASSUMPTION_PATTERNS = Object.freeze({
  coding: {
    zh: [
      "默认按 MVP 先交付核心闭环，再补齐边界特例与细节。",
      "默认在可回滚的验证环境先做最小可验收验证。",
    ],
    en: [
      "Default to an MVP first: deliver the minimal working loop before polishing edge cases.",
      "Default to validating in a safe rollback-capable environment first.",
    ],
  },
  planning: {
    zh: [
      "默认先输出可执行的里程碑版本，不先讨论完整理想状态。",
      "默认将风险、依赖与验收信号置于同等优先级。",
    ],
    en: [
      "Default to a practical execution roadmap with milestones before exhaustive optimization.",
      "Default to surfacing risks, dependencies, and exit conditions with equal priority.",
    ],
  },
  general: {
    zh: [
      "默认先输出可执行版本，再补齐非关键细节。",
      "默认补齐与原任务直接相关的约束与验收。",
    ],
    en: [
      "Default to an actionable first version, then refine secondary details.",
      "Default to constraints and acceptance criteria that are directly tied to the request.",
    ],
  },
});

const PROFILE_CONTENT = Object.freeze({
  "zh-CN": {
    taskTitle: "# 任务",
    taskIntro: "完成下面的用户需求。保持原始意图、专有名词、明确约束和语气，不擅自扩大任务范围。",
    profileLabel: "任务类型",
    intentLabel: "任务理解",
    deliverableLabel: "交付物",
    agentModeNotice: "执行模式: Agent 自主执行（见文末执行协议）。",
    contextTitle: "# 任务要素",
    executionTitle: "# 执行要求",
    outputTitle: "# 输出要求",
    acceptanceTitle: "# 完成标准",
    agentTitle: "# Agent 执行协议",
    clarificationTitle: "# 待澄清（仅当缺失信息会阻碍正确结果时才提问，最多 3 个）",
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
    labels: {
      constraintItem: "将以下约束视为硬性边界：{value}",
      assumptionItem: "默认前置：{value}",
      intentItem: "意图理解：{value}（若与原始请求冲突，以原始请求为准）。",
      deliverableItem: "交付物：{value}。",
      entityItem: "以下要素来自原始请求，按原意使用，不要替换、转写或重新定义：{value}。",
      noEntityItem: "未检测到显式技术栈、工具或实体要素；不要臆测原始请求未提及的工具、版本、数据或文件。",
      ambiguityItem: "以下表述存在歧义，按最保守合理的解释执行，并在结果中说明所采用的解释：{value}。",
      stepsIntro: "建议按以下顺序执行：",
      stepItem: "步骤 {index}：{value}",
      clarificationItem: "{index}. {value}",
    },
    agentProtocol: [
      "先输出简短执行计划（要做什么、依赖什么信息或工具、何时停止），确认后再执行。",
      "只使用完成任务所需的最小工具集；对每个关键输入先验证再使用，失败的工具调用不要无声重试超过一次。",
      "完成前运行可用的检查（测试、编译、比对、复核），未验证的能力不得声称已完成。",
      "汇报格式固定为：结果 → 证据或验证记录 → 剩余风险与下一步。",
      "遇到与原始需求冲突或超出授权范围的新信息时，先停下说明，不要自行扩大范围。",
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
    intentLabel: "Interpreted intent",
    deliverableLabel: "Deliverable",
    agentModeNotice: "Execution mode: autonomous agent (see the execution protocol at the end).",
    contextTitle: "# Task essentials",
    executionTitle: "# Execution requirements",
    outputTitle: "# Output requirements",
    acceptanceTitle: "# Completion criteria",
    agentTitle: "# Agent execution protocol",
    clarificationTitle: "# Clarify only if missing information blocks a correct result (max 3 questions)",
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
    labels: {
      constraintItem: "Treat this as a hard constraint: {value}",
      assumptionItem: "Assumption to proceed: {value}",
      intentItem: "Interpreted intent: {value} (the original request wins on any conflict).",
      deliverableItem: "Deliverable: {value}.",
      entityItem: "The following essentials come from the original request; use them as written without renaming or redefining: {value}.",
      noEntityItem: "No explicit stack, tooling, or entity essentials were detected; do not assume tools, versions, data, or files the request never mentioned.",
      ambiguityItem: "The following phrasing is ambiguous; use the most conservative reasonable reading and state it in the result: {value}.",
      stepsIntro: "Suggested execution order:",
      stepItem: "Step {index}: {value}",
      clarificationItem: "{index}. {value}",
    },
    agentProtocol: [
      "Emit a short execution plan first (what to do, which information or tools it depends on, when to stop); then execute.",
      "Use only the minimal tool set the task needs; validate key inputs before relying on them and never silently retry a failed tool call more than once.",
      "Run available checks (tests, builds, comparisons, review) before finishing; never claim unverified work as done.",
      "Report in a fixed shape: result → evidence or verification record → remaining risks and next steps.",
      "Stop and explain when new information conflicts with the original request or exceeds its scope; do not expand scope on your own.",
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
