import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson } from "./entrypointUtils.js"

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const docsPath = resolve(repoRoot, "docs/PRODUCT_CONSOLE_UX_HARDENING.md");
const evidenceJsonPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-285a-product-console-ux-hardening.json");
const evidenceMdPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-285a-product-console-ux-hardening.md");
const runPath = resolve(repoRoot, "apps/ai-gateway-service/src/entrypoints/runProductConsoleUxHardening.js");
const rootPackagePath = resolve(repoRoot, "package.json");
const servicePackagePath = resolve(repoRoot, "apps/ai-gateway-service/package.json");
const consolePagePath = resolve(repoRoot, "apps/ai-gateway-service/src/ui/consolePage.js");


function assertCheck(condition, message, failures) {
  if (!condition) {
    failures.push(message);
  }
}

function packageScriptExists(filePath, scriptName) {
  if (!existsSync(filePath)) {
    return false;
  }
  return Boolean(readJson(filePath).scripts?.[scriptName]);
}

export function verifyProductConsoleUxHardening() {
  const failures = [];
  const requiredFiles = [docsPath, evidenceJsonPath, evidenceMdPath, runPath];

  for (const filePath of requiredFiles) {
    assertCheck(existsSync(filePath), `missing required file: ${filePath}`, failures);
  }

  if (failures.length > 0) {
    return { ok: false, failures };
  }

  const evidence = readJson(evidenceJsonPath);
  const docsText = readFileSync(docsPath, "utf8");
  const consoleText = existsSync(consolePagePath) ? readFileSync(consolePagePath, "utf8") : "";

  assertCheck(evidence.phase === "285A", "phase must be 285A", failures);
  assertCheck(evidence.status === "pass", "status must be pass", failures);
  assertCheck(evidence.currentBlocker === "none", "currentBlocker must be none", failures);
  assertCheck(evidence.paidApiCallCount === 0, "paidApiCallCount must be 0", failures);
  assertCheck(evidence.externalApiCalled === false, "externalApiCalled must be false", failures);
  assertCheck(evidence.mimoApiCalled === false, "mimoApiCalled must be false", failures);
  assertCheck(evidence.embeddingCalled === false, "embeddingCalled must be false", failures);
  assertCheck(evidence.legacyModified === false, "legacyModified must be false", failures);
  assertCheck(evidence.projectContextCreated === false, "projectContextCreated must be false", failures);
  assertCheck(evidence.commitPerformed === false, "commitPerformed must be false", failures);
  assertCheck(evidence.pushPerformed === false, "pushPerformed must be false", failures);
  assertCheck(evidence.realReleasePerformed === false, "realReleasePerformed must be false", failures);
  assertCheck(evidence.remoteDeployPerformed === false, "remoteDeployPerformed must be false", failures);
  assertCheck(evidence.workspaceCleanClaimed === false, "workspaceCleanClaimed must be false", failures);
  assertCheck(evidence.productionReadyClaimed === false, "productionReadyClaimed must be false", failures);
  assertCheck(evidence.releaseReadyClaimed !== true, "releaseReadyClaimed must not be true", failures);
  assertCheck(evidence.deployReadyClaimed === false, "deployReadyClaimed must be false", failures);
  assertCheck(evidence.businessFriendlyHomepage === true, "businessFriendlyHomepage must be true", failures);
  assertCheck(evidence.chineseCopyEnabled === true || evidence.bilingualCopyEnabled === true, "Chinese or bilingual copy must be enabled", failures);
  assertCheck(evidence.capabilityPanelAdded === true, "capabilityPanelAdded must be true", failures);
  assertCheck(evidence.nonClaimableCapabilityPanelAdded === true, "nonClaimableCapabilityPanelAdded must be true", failures);
  assertCheck(evidence.nextActionPanelAdded === true, "nextActionPanelAdded must be true", failures);
  assertCheck(evidence.safetyBoundaryPanelAdded === true, "safetyBoundaryPanelAdded must be true", failures);
  assertCheck(evidence.demoModeEntryAdded === true, "demoModeEntryAdded must be true", failures);
  assertCheck(evidence.engineeringAdvancedPanelPreserved === true, "engineeringAdvancedPanelPreserved must be true", failures);

  const requiredDocsMarkers = [
    "Executive Summary",
    "Product Console Goal",
    "User-Facing UX Principles",
    "Chinese / Bilingual Copy Strategy",
    "Homepage Information Architecture",
    "Business-Friendly Capability Explanation",
    "What The System Can Do",
    "What The System Cannot Claim Yet",
    "Safety Boundary Presentation",
    "Next Action Guidance",
    "Demo Mode / Sales Mode Guidance",
    "Engineering Advanced Panel Boundary",
    "No Production-Ready Claim Boundary",
    "Final Phase 285A Conclusion",
    "does not call any model",
    "does not change the default provider route",
    "does not automatically enter any next phase",
  ];

  for (const marker of requiredDocsMarkers) {
    assertCheck(docsText.includes(marker), `docs missing marker: ${marker}`, failures);
  }

  const requiredUiMarkers = [
    "AI 总控台 / Unified AI Gateway Console",
    "当前系统能做什么",
    "当前系统还不能承诺什么",
    "下一步建议",
    "风险与边界提示",
    "商业演示模式 / 产品说明入口",
    "高级工程信息 / 开发者视图",
  ];

  for (const marker of requiredUiMarkers) {
    assertCheck(consoleText.includes(marker), `UI missing marker: ${marker}`, failures);
  }

  assertCheck(packageScriptExists(rootPackagePath, "run:phase285a-product-console-ux-hardening"), "root run script missing", failures);
  assertCheck(packageScriptExists(rootPackagePath, "verify:phase285a-product-console-ux-hardening"), "root verify script missing", failures);
  assertCheck(packageScriptExists(servicePackagePath, "run:phase285a-product-console-ux-hardening"), "service run script missing", failures);
  assertCheck(packageScriptExists(servicePackagePath, "verify:phase285a-product-console-ux-hardening"), "service verify script missing", failures);

  return { ok: failures.length === 0, failures };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const result = verifyProductConsoleUxHardening();
  if (!result.ok) {
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({
    status: "passed",
    phase: "285A",
    verifier: "verifyProductConsoleUxHardening",
  }, null, 2));
}
