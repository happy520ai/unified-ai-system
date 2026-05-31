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

const phase = "phase-267a-project-readthrough-future-report";
const reportPath = "docs/UNIFIED_AI_SYSTEM_PROJECT_READTHROUGH_AND_FUTURE_REPORT.md";
const evidenceJsonPath = "apps/ai-gateway-service/evidence/phase-267a-project-readthrough-future-report.json";
const evidenceMdPath = "apps/ai-gateway-service/evidence/phase-267a-project-readthrough-future-report.md";

const requiredSections = [
  "# 1. 执行摘要",
  "# 2. 项目总体定位",
  "# 3. 已完成能力全景图",
  "# 4. 当前实际使用方式",
  "# 5. 当前自动化程度评估",
  "# 6. 受控 Codex Desktop 自动化现状",
  "# 7. 三轮内部测试结果",
  "# 8. 当前 evidence / verifier 体系",
  "# 9. 当前风险和限制",
  "# 10. 未来还可以做到的方向",
  "# 11. 下一步推荐路线",
  "# 12. 结论",
];

const requiredBoundaries = [
  "preview-only",
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
  "是否真实发送过 Codex：是",
  "已调用 codex CLI：是",
  "是否调用 codex CLI：是",
  "已自动改代码：是",
  "已自动 commit/push/PR",
  "已自动 commit/push/PR：是",
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
    sourcesReadPopulated: Array.isArray(evidence.sourcesRead) && evidence.sourcesRead.length >= 20,
    evidenceReadPopulated: Array.isArray(evidence.evidenceRead) && evidence.evidenceRead.length >= 8,
    handoffFilesReadPopulated: Array.isArray(evidence.handoffFilesRead) && evidence.handoffFilesRead.length >= 8,
    commandsCheckedPopulated: Array.isArray(evidence.commandsChecked) && evidence.commandsChecked.length >= 4,
    currentCapabilitiesPopulated: Array.isArray(evidence.currentCapabilities) && evidence.currentCapabilities.length >= 6,
    currentLimitationsPopulated: Array.isArray(evidence.currentLimitations) && evidence.currentLimitations.length >= 8,
    futureDirectionsPopulated: Array.isArray(evidence.futureDirections) && evidence.futureDirections.length >= 8,
    recommendedRoutePresent: typeof evidence.recommendedNextRoute === "string" && evidence.recommendedNextRoute.length > 20,
    finalConclusionPresent: typeof evidence.finalConclusion === "string" && evidence.finalConclusion.includes("not reached production SaaS") || evidence.finalConclusion?.includes("has not reached production SaaS"),
    rootScriptPresent:
      rootPackage.scripts?.["verify:phase267a-project-readthrough-future-report"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase267a-project-readthrough-future-report",
    serviceScriptPresent:
      servicePackage.scripts?.["verify:phase267a-project-readthrough-future-report"] ===
      "node ./src/entrypoints/verifyProjectReadthroughFutureReport.js",
    noProjectContext: noProjectContext(),
    noPlainSecrets: secretFindingCount === 0,
  };

  const passed = Object.values(checks).every(Boolean);
  const refreshedEvidence = {
    ...evidence,
    status: passed ? "passed" : "failed",
    checkedAt: new Date().toISOString(),
    verifier: "apps/ai-gateway-service/src/entrypoints/verifyProjectReadthroughFutureReport.js",
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
  return `# Phase 267A Project Readthrough And Future Report Evidence

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
    phase: "267A",
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
