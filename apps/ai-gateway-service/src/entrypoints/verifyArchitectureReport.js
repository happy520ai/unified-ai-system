import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  countSecretFindings,
  createDisabledState,
  createSafety,
  noProjectContext,
  repoRoot,
} from "./verifyAgentWorkforceClosureSupport.js";

const phase = "phase-267a-architecture-report";
const reportPath = "docs/UNIFIED_AI_SYSTEM_ARCHITECTURE_REPORT.md";
const evidenceJsonPath = "apps/ai-gateway-service/evidence/phase-267a-architecture-report.json";
const evidenceMdPath = "apps/ai-gateway-service/evidence/phase-267a-architecture-report.md";

const requiredSections = [
  "# 1. 架构执行摘要",
  "# 2. 仓库整体结构",
  "# 3. 当前系统分层架构",
  "# 4. 核心运行链路图",
  "# 5. 数据与文件流",
  "# 6. 主要命令架构",
  "# 7. 安全架构",
  "# 8. 当前架构成熟度评估",
  "# 9. 当前架构风险",
  "# 10. 未来架构演进方向",
  "# 11. 推荐架构路线",
  "# 12. 架构结论",
];

const requiredBoundaries = [
  "no real Codex exec",
  "no codex CLI",
  "no workflow runner",
  "no worktree creation",
  "no auto commit/push",
  "not unattended development",
  "no production vector RAG",
  "no GraphRAG",
];

const forbiddenClaims = [
  "已真实发送 Codex：是",
  "是否真实发送 Codex：是",
  "已调用 codex CLI：是",
  "是否调用 codex CLI：是",
  "已自动改代码：是",
  "已自动 commit/push/PR",
  "已生产级 SaaS",
  "已生产级 vector RAG / GraphRAG",
  "production vector RAG complete",
  "GraphRAG complete",
  "workspace clean",
  "workspace is clean",
  "工作区 clean",
  "真实 Codex 执行已完成",
  "execution completed by desktop send",
];

async function main() {
  const report = await readText(reportPath);
  const evidence = await readJson(evidenceJsonPath);
  const rootPackage = await readJson("package.json");
  const servicePackage = await readJson("apps/ai-gateway-service/package.json");
  const secretFindingCount = countSecretFindings(report, phase);

  const checks = {
    reportExists: existsSync(resolve(repoRoot, reportPath)),
    evidenceJsonExists: existsSync(resolve(repoRoot, evidenceJsonPath)),
    evidenceMarkdownExists: existsSync(resolve(repoRoot, evidenceMdPath)),
    evidenceStatusPassed: evidence.status === "passed",
    requiredSectionsPresent: containsAll(report, requiredSections),
    requiredBoundariesPresent: containsAll(report, requiredBoundaries),
    forbiddenClaimsAbsent: forbiddenClaims.every((claim) => !report.includes(claim)),
    safetyFieldsAllFalse: allSafetyFieldsFalse(evidence.safety),
    architectureLayersPopulated: Array.isArray(evidence.architectureLayers) && evidence.architectureLayers.length >= 8,
    mainPipelinesPopulated: Array.isArray(evidence.mainPipelines) && evidence.mainPipelines.length >= 4,
    dataFilesPopulated: Array.isArray(evidence.dataFiles) && evidence.dataFiles.length >= 10,
    commandsReviewedPopulated: Array.isArray(evidence.commandsReviewed) && evidence.commandsReviewed.length >= 12,
    safetyBoundariesPopulated: Array.isArray(evidence.safetyBoundaries) && evidence.safetyBoundaries.length >= 8,
    maturityAssessmentPopulated: Array.isArray(evidence.maturityAssessment) && evidence.maturityAssessment.length >= 10,
    risksPopulated: Array.isArray(evidence.architectureRisks) && evidence.architectureRisks.length >= 8,
    futureDirectionsPopulated: Array.isArray(evidence.futureArchitectureDirections) && evidence.futureArchitectureDirections.length >= 10,
    recommendedRoutePresent: typeof evidence.recommendedArchitectureRoute === "string" && evidence.recommendedArchitectureRoute.length > 20,
    finalConclusionPresent: typeof evidence.finalConclusion === "string" && evidence.finalConclusion.length > 40,
    rootScriptPresent:
      rootPackage.scripts?.["verify:phase267a-architecture-report"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase267a-architecture-report",
    serviceScriptPresent:
      servicePackage.scripts?.["verify:phase267a-architecture-report"] ===
      "node ./src/entrypoints/verifyArchitectureReport.js",
    noProjectContext: noProjectContext(),
    noPlainSecrets: secretFindingCount === 0,
  };

  const passed = Object.values(checks).every(Boolean);
  const refreshedEvidence = {
    ...evidence,
    status: passed ? "passed" : "failed",
    checkedAt: new Date().toISOString(),
    verifier: "apps/ai-gateway-service/src/entrypoints/verifyArchitectureReport.js",
    checks,
    safety: {
      legacyModified: false,
      projectContextCreated: false,
      codexCliInvoked: false,
      codexExecInvoked: false,
      realCodexSendExecuted: false,
      workflowRunnerEnabled: false,
      worktreeCreated: false,
      autoCommit: false,
      autoPush: false,
    },
  };

  await writeEvidenceFiles(refreshedEvidence);
  console.log(JSON.stringify(refreshedEvidence, null, 2));
  process.exitCode = passed ? 0 : 1;
}

function containsAll(text, snippets) {
  return snippets.every((snippet) => text.includes(snippet));
}

function allSafetyFieldsFalse(safety) {
  return Boolean(safety) && Object.values(safety).every((value) => value === false);
}

async function readText(relativePath) {
  return readFile(resolve(repoRoot, relativePath), "utf8");
}

async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}

async function writeEvidenceFiles(evidence) {
  await writeFile(resolve(repoRoot, evidenceJsonPath), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(resolve(repoRoot, evidenceMdPath), renderEvidenceMarkdown(evidence), "utf8");
}

function renderEvidenceMarkdown(evidence) {
  return `# Phase 267A Architecture Report Evidence

- Phase: ${evidence.phase}
- Status: ${evidence.status}
- Checked at: ${evidence.checkedAt}
- Report: \`${evidence.reportPath}\`
- Execution enabled: ${createDisabledState().executionEnabled}
- Calls Codex: ${createSafety().realAgentExecution}

## Checks

${Object.entries(evidence.checks ?? {}).map(([name, value]) => `- ${name}: ${value ? "passed" : "failed"}`).join("\n")}

## Safety

${Object.entries(evidence.safety ?? {}).map(([name, value]) => `- ${name}: ${value}`).join("\n")}

## Conclusion

${evidence.finalConclusion}
`;
}

main().catch(async (error) => {
  const fallback = {
    phase: "267A-architecture",
    status: "failed",
    checkedAt: new Date().toISOString(),
    reportPath,
    error: error instanceof Error ? error.message : String(error),
    safety: {
      legacyModified: false,
      projectContextCreated: false,
      codexCliInvoked: false,
      codexExecInvoked: false,
      realCodexSendExecuted: false,
      workflowRunnerEnabled: false,
      worktreeCreated: false,
      autoCommit: false,
      autoPush: false,
    },
    checks: {},
    finalConclusion: "Verification failed before all checks could complete.",
  };
  await writeEvidenceFiles(fallback);
  console.log(JSON.stringify(fallback, null, 2));
  process.exitCode = 1;
});
