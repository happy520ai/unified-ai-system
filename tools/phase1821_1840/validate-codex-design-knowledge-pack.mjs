import {
  boundary,
  containsSecretLikeValue,
  evidencePaths,
  hasAll,
  isDirectRun,
  knowledgePaths,
  phaseRange,
  readText,
  summarizeChecks,
  writeJson,
} from "./phase1840-common.mjs";

const requiredDocs = Object.values(knowledgePaths);

const requiredContent = {
  [knowledgePaths.pmeDesign]: [
    "productIdentity",
    "本地老板 AI 总控台",
    "designGoal",
    "零学习、少按钮、中文日报、结果优先",
    "visualStyle",
    "ownerModePrinciples",
    "operatorModePrinciples",
    "engineeringModePrinciples",
    "typographyRules",
    "spacingRules",
    "buttonRules",
    "cardRules",
    "statusRules",
    "reportRules",
    "accessibilityRules",
    "forbiddenPatterns",
  ],
  [knowledgePaths.ownerHome]: [
    "第一屏只允许一个 primary CTA",
    "必须展示三张结果卡",
    "工程模块默认折叠",
    "高级模式不能干扰 owner",
    "owner 不应看到 Phase / verifier / trace / raw evidence path",
    "今天完成了什么 / 发现了什么问题 / 下一步点哪里",
  ],
  [knowledgePaths.ownerReport]: [
    "报告比 UI 更重要",
    "标题必须中文",
    "正文只保留 owner 能理解的信息",
    "高级信息放底部",
    "下一步只能给一个主动作",
    "不把 evidence path 放在正文第一屏",
  ],
  [knowledgePaths.chineseCopy]: [
    "中文优先",
    "不使用 owner 不懂的工程词",
    "不写 \"验证器通过\" 给 owner，而写 \"系统检查通过\"",
    "不写 \"Provider Gate\"，而写 \"真实模型调用仍处于保护状态\"",
    "不写 \"evidence path\"，而写 \"详细记录已保存，可在高级模式查看\"",
  ],
  [knowledgePaths.componentPatterns]: [
    "OwnerPrimaryAction",
    "OwnerStatusCard",
    "OwnerDailyReport",
    "NextActionCard",
    "AdvancedModeDrawer",
    "FailureFriendlyMessage",
    "ButtonFeedbackState",
  ],
  [knowledgePaths.antiPatterns]: [
    "不做工程后台首页",
    "不做按钮墙",
    "不把模块平铺给 owner",
    "不让 owner 理解 Phase",
    "不把 evidence / trace / JSON 路径放到首页",
    "不做花哨 3D",
    "不恢复依依 / Character",
    "不使用远程字体 / CDN / 外链图片",
    "不把设计稿说成真实可用",
  ],
  [knowledgePaths.playbook]: [
    "读取 `PME_DESIGN.md`",
    "读取 `OWNER_HOME_DESIGN.md`",
    "读取 `CHINESE_UI_COPY_RULES.md`",
    "判断修改是否增加 owner 认知负担",
    "如果增加按钮数量，必须解释原因",
    "如果暴露工程词，必须放高级模式或加中文解释",
    "修改后运行 design verifier",
    "生成 screenshot evidence",
  ],
  [knowledgePaths.sourceAudit]: [
    "VoltAgent/awesome-design-md",
    "MIT",
    "alexpate/awesome-design-systems",
    "Unlicense",
    "Copied code: none",
    "Copied brand assets: none",
  ],
};

export async function validateCodexDesignKnowledgePack() {
  const docTexts = {};
  for (const path of requiredDocs) {
    docTexts[path] = await readText(path);
  }

  const checks = {
    codexDesignKnowledgePackReady: requiredDocs.every((path) => docTexts[path].trim().length > 0),
    pmeDesignMdReady: hasAll(docTexts[knowledgePaths.pmeDesign], requiredContent[knowledgePaths.pmeDesign]),
    ownerHomeDesignContractReady: hasAll(docTexts[knowledgePaths.ownerHome], requiredContent[knowledgePaths.ownerHome]),
    ownerReportDesignContractReady: hasAll(docTexts[knowledgePaths.ownerReport], requiredContent[knowledgePaths.ownerReport]),
    chineseUiCopyRulesReady: hasAll(docTexts[knowledgePaths.chineseCopy], requiredContent[knowledgePaths.chineseCopy]),
    componentPatternRulesReady: hasAll(docTexts[knowledgePaths.componentPatterns], requiredContent[knowledgePaths.componentPatterns]),
    designAntiPatternLedgerReady: hasAll(docTexts[knowledgePaths.antiPatterns], requiredContent[knowledgePaths.antiPatterns]),
    codexUiRewritePlaybookReady: hasAll(docTexts[knowledgePaths.playbook], requiredContent[knowledgePaths.playbook]),
    awesomeDesignSourceAuditReady: hasAll(docTexts[knowledgePaths.sourceAudit], requiredContent[knowledgePaths.sourceAudit]),
    noSecretLikeText: !containsSecretLikeValue(Object.values(docTexts).join("\n")),
  };

  const summary = summarizeChecks(checks);
  const result = {
    phase: "Phase1836",
    phaseRange,
    ...summary,
    ...boundary,
    knowledgePackPath: "docs/design/codex-design-knowledge/",
    requiredReading: [
      knowledgePaths.pmeDesign,
      knowledgePaths.ownerHome,
      knowledgePaths.chineseCopy,
      knowledgePaths.componentPatterns,
      knowledgePaths.antiPatterns,
      knowledgePaths.playbook,
    ],
    awesomeDesignSources: [
      {
        repo: "VoltAgent/awesome-design-md",
        license: "MIT",
        usage: "reference structure and method only",
      },
      {
        repo: "alexpate/awesome-design-systems",
        license: "Unlicense",
        usage: "reference resource organization only",
      },
    ],
    pluginAppUsageAudit: {
      pluginAppsUsed: true,
      pluginName: "web/GitHub",
      toolType: "web search / public GitHub metadata review",
      purpose: "license and design source audit",
      whyNeeded: "confirm source purpose and license boundary before writing local design discipline",
      userAuthorized: true,
      dataSentOut: false,
      repoDataSentOut: false,
      secretExposed: false,
      rawCredentialExposed: false,
      providerCalled: false,
      costRisk: "none",
      evidencePath: "apps/ai-gateway-service/evidence/phase1821_1840/",
      rollbackOrDisableMethod: "delete docs/design/codex-design-knowledge/, tools/phase1821_1840/, phase1831-1835 tools, phase1821_1840 evidence, and package script additions",
    },
    checks,
  };

  await writeJson(evidencePaths.knowledgePack, result);
  return result;
}

if (isDirectRun(import.meta.url)) {
  const result = await validateCodexDesignKnowledgePack();
  console.log(JSON.stringify(result, null, 2));
  if (result.blocker) process.exitCode = 1;
}
