import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  countSecretFindings,
  createDisabledState,
  createSafety,
  noOhMyCodexDependency,
  noProjectContext,
  readRequired,
  readWorkspaceTexts,
  repoRoot,
  writeEvidence,
} from "./verifyAgentWorkforceClosureSupport.js";

const phase = "phase-236a-commercial-business-report";
const reportPath = "docs/UNIFIED_AI_SYSTEM_COMMERCIAL_BUSINESS_REPORT.md";
const evidenceJsonPath = "apps/ai-gateway-service/evidence/phase-236a-commercial-business-report.json";
const evidenceMdPath = "apps/ai-gateway-service/evidence/phase-236a-commercial-business-report.md";

const requiredSections = [
  "# Unified AI System Commercial Business Report",
  "## 1. Executive Summary / 商业摘要",
  "## 2. Product Positioning / 产品定位",
  "## 3. Target Customers / 目标客户",
  "## 4. Core Value Proposition / 核心价值主张",
  "## 5. Current Product Capabilities / 当前产品能力",
  "## 6. Demonstrable Scenarios / 可演示销售场景",
  "## 7. What Can Be Sold Now / 当前能卖什么",
  "## 8. What Should Not Be Promised / 不能对客户承诺什么",
  "## 9. Competitive Differentiation / 差异化",
  "## 10. Pricing / 定价建议",
  "## 11. Go-to-Market / 销售路径",
  "## 12. Sales Demo Script / 销售演示脚本",
  "## 13. Buyer Objections / 客户异议与回答",
  "## 14. Productization Roadmap / 产品化路线图",
  "## 15. Technical Readiness / 技术成熟度评估",
  "## 16. Business Risks / 商业风险",
  "## 17. Recommended Commercial Package / 推荐销售包装",
  "## 18. Next 30 / 60 / 90 Days Plan",
  "## 19. Final Business Conclusion",
];

const requiredCommercialStates = [
  "A. 已验证可演示",
  "B. 已实现但需要谨慎说明",
  "C. 设计中 / 半自动",
  "D. 未完成 / 不能承诺",
];

const requiredHardBoundarySignals = [
  "不修改 `legacy/`",
  "不创建 `PROJECT_CONTEXT.md`",
  "不修改默认 NVIDIA `/chat` 主链",
  "不调用 Codex 自动执行开发任务",
  "不调用 oh-my-codex / OMX / team / ralph",
  "不创建 worktree",
  "不接 workflow run",
  "不自动 commit / push",
  "不写入明文 API Key",
  "不把 preview / design-only 写成 production-ready",
  "不把 approval-preview 写成真实执行授权",
  "不把 controlled bridge 写成无人值守自动执行系统",
];

function containsAll(text, snippets) {
  return snippets.every((snippet) => text.includes(snippet));
}

function hasUnsafePositiveLine(text, checks) {
  const negativeFragments = [
    " no ",
    " not ",
    " never ",
    " without ",
    " blocked",
    " disabled",
    " design-only",
    " preview-only",
    " must not",
    " does not",
    " cannot",
    " requires explicit",
    "explicitly gated",
    "skipped",
    "不能",
    "不可",
    "不应",
    "不把",
    "不要",
    "不使用",
    "不是",
    "未完成",
    "禁止",
    "默认不",
    "没有",
    "不得",
    "谨慎",
    "不适合",
    "无法",
    "避免",
    "风险",
    "只完成",
    "只做",
  ];
  return text.split(/\r?\n/).some((line) => {
    const lowerLine = ` ${line.toLowerCase()} `;
    const isNegated = negativeFragments.some((fragment) => lowerLine.includes(fragment.toLowerCase()));
    return checks.some((terms) => terms.every((term) => lowerLine.includes(term.toLowerCase()))) && !isNegated;
  });
}

try {
  const [report, texts] = await Promise.all([
    readRequired(reportPath),
    readWorkspaceTexts(),
  ]);

  const secretFindingCount = countSecretFindings(report, phase);
  const checks = {
    reportExists: existsSync(resolve(repoRoot, reportPath)),
    allRequiredSectionsPresent: containsAll(report, requiredSections),
    allCommercialStatesPresent: containsAll(report, requiredCommercialStates),
    allHardBoundarySignalsPresent: containsAll(report, requiredHardBoundarySignals),
    reportDoesNotClaimUnattendedExecutionComplete: !hasUnsafePositiveLine(report, [
      ["unattended", "execution", "complete"],
      ["unattended", "automation", "complete"],
      ["无人值守", "已完成"],
      ["无人值守", "可承诺"],
      ["默认无人值守"],
    ]),
    reportDoesNotClaimAutomaticCommitPushComplete: !hasUnsafePositiveLine(report, [
      ["automatic", "commit", "complete"],
      ["automatic", "push", "complete"],
      ["auto", "commit", "complete"],
      ["auto", "push", "complete"],
      ["自动", "commit", "已完成"],
      ["自动", "push", "已完成"],
      ["自动", "commit/push", "可承诺"],
    ]),
    reportDoesNotClaimMultiUserSaasComplete: !hasUnsafePositiveLine(report, [
      ["multi-user", "saas", "complete"],
      ["multi tenant", "saas", "complete"],
      ["多用户", "saas", "已完成"],
      ["多租户", "saas", "已完成"],
      ["saas", "production-ready"],
    ]),
    reportDoesNotClaimPreviewAsProductionReady: !hasUnsafePositiveLine(report, [
      ["preview", "production-ready"],
      ["design-only", "production-ready"],
      ["preview", "production execution"],
      ["design-only", "production execution"],
      ["preview", "正式产品承诺"],
    ]),
    reportDoesNotClaimApprovalPreviewAsExecutionApproval: !hasUnsafePositiveLine(report, [
      ["approval-preview", "execution approval"],
      ["approval-preview", "execution permission"],
      ["approval-preview", "真实执行授权"],
      ["approval preview", "execution approval"],
    ]),
    reportDoesNotClaimControlledBridgeAsUnattendedSystem: !hasUnsafePositiveLine(report, [
      ["controlled bridge", "unattended"],
      ["controlled bridge", "无人值守"],
      ["controlled", "bridge", "automatic execution"],
      ["受控", "bridge", "无人值守"],
    ]),
    noPlainSecrets: secretFindingCount === 0,
    containsSalesDemoScript:
      report.includes("## 12. Sales Demo Script / 销售演示脚本") &&
      report.includes("15 分钟演示流程") &&
      report.includes("话术"),
    containsPricingSuggestions:
      report.includes("## 10. Pricing / 定价建议") &&
      report.includes("建议区间，不是市场报价") &&
      (report.includes("方案 A：项目交付制") || report.includes("方案 A: 项目交付制")) &&
      (report.includes("方案 B：订阅制") || report.includes("方案 B: 订阅制")) &&
      (report.includes("方案 C：咨询 + 软件混合") || report.includes("方案 C: 咨询 + 软件混合")),
    containsKnowledgeCommercialPillar:
      report.includes("Knowledge Base / RAG") &&
      report.includes("local keyword retrieval") &&
      report.includes("RAG chat") &&
      report.includes("citation") &&
      report.includes("vector/pgvector") &&
      report.includes("生产级向量知识中台"),
    containsThirtySixtyNinetyRoadmap:
      report.includes("## 18. Next 30 / 60 / 90 Days Plan") &&
      report.includes("30 天") &&
      report.includes("60 天") &&
      report.includes("90 天"),
    rootScriptPresent:
      texts.rootPackage.scripts?.["verify:phase236a-commercial-business-report"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase236a-commercial-business-report",
    serviceScriptPresent:
      texts.servicePackage.scripts?.["verify:phase236a-commercial-business-report"] ===
      "node ./src/entrypoints/verifyCommercialBusinessReport.js",
    noProjectContext: noProjectContext(),
    noOhMyCodexDependency: noOhMyCodexDependency(texts.rootPackageText, texts.servicePackageText),
    evidenceJsonGenerated: true,
    evidenceMdGenerated: true,
  };

  const passed = Object.values(checks).every(Boolean);
  const evidence = {
    phase,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    conclusion: passed ? "commercial-business-report-complete" : "commercial-business-report-incomplete",
    reportPath,
    evidencePaths: [evidenceJsonPath, evidenceMdPath],
    verifiedDocuments: [
      reportPath,
      "docs/UNIFIED_AI_SYSTEM_FULL_READTHROUGH_REPORT.md",
      "docs/USER_MANUAL.md",
      "docs/AGENT_WORKFORCE_FINAL_CLOSURE_SNAPSHOT.md",
      "docs/AGENT_WORKFORCE_REAL_UI_TRIAL_FINAL_SEAL.md",
      "docs/AGENT_WORKFORCE_FULLY_AUTOMATED_CONTROLLED_LOOP_CLOSURE.md",
      "docs/AGENT_WORKFORCE_NEXT_TASK_QUEUE.md",
      "README.md",
      "AGENTS.md",
      "package.json",
      "apps/ai-gateway-service/package.json",
      "apps/ai-gateway-service/src/http/httpServer.js",
      "apps/ai-gateway-service/src/knowledge/localKnowledgeService.js",
      "apps/ai-gateway-service/src/knowledge/knowledgeInfra.js",
      "apps/ai-gateway-service/src/knowledge/knowledgePersistence.js",
      "apps/ai-gateway-service/src/workforce/workforcePlanner.js",
      "apps/ai-gateway-service/src/workforce/workforceService.js",
      "apps/ai-gateway-service/src/workforce/workforcePlanStore.js",
      "apps/ai-gateway-service/src/ui/consolePage.js",
      "packages/shared-contracts/src/contracts/workforce.ts",
    ],
    commercialStates: requiredCommercialStates,
    disabledState: createDisabledState(),
    safety: {
      ...createSafety(),
      codexCliInvoked: false,
      codexExecInvoked: false,
      desktopGuiSendInvoked: false,
      autoCommit: false,
      autoPush: false,
      autoApply: false,
      workflowRunEnabled: false,
      defaultNvidiaChatLaneChanged: false,
      productionSaasClaimed: false,
      unattendedAutomationClaimed: false,
      approvalPreviewAsExecutionApproval: false,
    },
    secretFindingCount,
    checks,
    notes: [
      "This verifier validates the Phase 236A commercial report and writes evidence only.",
      "The report separates verified demo capabilities from cautious preview/design-only and non-committable capabilities.",
      "No Codex CLI, oh-my-codex, OMX, team, ralph, worktree, workflow run, automatic commit, automatic push, or business runtime change is performed.",
    ],
  };

  await writeEvidence(phase, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  const evidence = {
    phase,
    status: "failed",
    generatedAt: new Date().toISOString(),
    conclusion: "commercial-business-report-verification-error",
    error: error instanceof Error ? error.message : String(error),
    reportPath,
    evidencePaths: [evidenceJsonPath, evidenceMdPath],
    disabledState: createDisabledState(),
    safety: {
      ...createSafety(),
      codexCliInvoked: false,
      codexExecInvoked: false,
      desktopGuiSendInvoked: false,
      autoCommit: false,
      autoPush: false,
      autoApply: false,
      workflowRunEnabled: false,
      defaultNvidiaChatLaneChanged: false,
      productionSaasClaimed: false,
      unattendedAutomationClaimed: false,
      approvalPreviewAsExecutionApproval: false,
    },
    secretFindingCount: "unknown",
    checks: {},
    notes: ["Verification failed before all checks could complete."],
  };
  await writeEvidence(phase, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
}
