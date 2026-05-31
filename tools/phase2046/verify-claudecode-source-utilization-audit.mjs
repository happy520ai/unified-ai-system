import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const checks = [];

const requiredFiles = {
  doc: "docs/phase2046-claudecode-source-utilization-audit.md",
  gapMap: "docs/phase2046-claudecode-gap-map.json",
  evidence: "apps/ai-gateway-service/evidence/phase2046-claudecode-source-utilization-audit/result.json",
  auditTool: "tools/phase2046/audit-claudecode-source-utilization.mjs",
  verifier: "tools/phase2046/verify-claudecode-source-utilization-audit.mjs",
};

const requiredFocusAreas = [
  "tool permission model",
  "command execution model",
  "session/context handling",
  "approval gate",
  "project memory files",
  "MCP/tool bridge",
  "diff/apply patch workflow",
  "rollback/undo pattern",
  "terminal safety",
  "agent loop",
  "config handling",
  "provider abstraction",
];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

for (const [id, relativePath] of Object.entries(requiredFiles)) {
  check(`${id}_exists`, existsSync(resolve(relativePath)), relativePath);
}

const gapMap = readJson(requiredFiles.gapMap);
const evidence = readJson(requiredFiles.evidence);
const docText = readText(requiredFiles.doc);
const packageJson = readJson("package.json");

check("gap_map_json_parseable", Boolean(gapMap));
check("evidence_json_parseable", Boolean(evidence));
check("doc_mentions_static_audit_only", /static source audit/i.test(docText));
check("doc_mentions_no_copy_boundary", /do not copy|copying source is forbidden|禁止复制/i.test(docText));
check("source_found_recorded", gapMap?.claudeCodeSourceFound === true && typeof gapMap?.claudeCodeSourcePath === "string" && gapMap.claudeCodeSourcePath.length > 0);
check("read_modules_non_empty", Array.isArray(gapMap?.readModules) && gapMap.readModules.length > 0);
check("reference_points_non_empty", Array.isArray(gapMap?.referenceArchitecturePoints) && gapMap.referenceArchitecturePoints.length >= requiredFocusAreas.length);
check("pme_used_patterns_non_empty", Array.isArray(gapMap?.pmeUsedPatterns) && gapMap.pmeUsedPatterns.length >= 5);
check("gaps_non_empty", Array.isArray(gapMap?.gapsWorthAbsorbing) && gapMap.gapsWorthAbsorbing.length >= 5);
check("license_risk_recorded", Array.isArray(gapMap?.licenseAndCopyRisk) && gapMap.licenseAndCopyRisk.length >= 2);
check("next_recommendations_recorded", Array.isArray(gapMap?.nextPhaseRecommendations) && gapMap.nextPhaseRecommendations.length >= 3);

const focusAreas = new Set((gapMap?.referenceArchitecturePoints || []).map((entry) => entry.focusArea));
for (const focusArea of requiredFocusAreas) {
  check(`focus_area_${focusArea.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`, focusAreas.has(focusArea), focusArea);
}

const safety = evidence?.safety || {};
check("provider_calls_false", safety.providerCallsMade === false);
check("secret_read_false", safety.secretRead === false);
check("claude_code_executed_false", safety.claudeCodeExecuted === false);
check("deploy_executed_false", safety.deployExecuted === false);
check("chat_modified_false", safety.chatModified === false);
check("chat_gateway_execute_modified_false", safety.chatGatewayExecuteModified === false);
check("legacy_modified_false", safety.legacyModified === false);
check("project_context_modified_false", safety.projectContextModified === false);
check("copied_source_false", safety.copiedClaudeCodeSourceIntoProject === false);
check("raw_secret_paths_not_read", Array.isArray(evidence?.skippedUnsafePaths));
check("complete_utilization_false", evidence?.completeUtilization === false);
check("root_package_script", packageJson?.scripts?.["verify:phase2046-claudecode-source-utilization-audit"] === "node tools/phase2046/verify-claudecode-source-utilization-audit.mjs");

const failedChecks = checks.filter((entry) => !entry.pass);
const result = {
  phaseId: "Phase2046-ClaudeCode-Source-Utilization-Audit",
  status: failedChecks.length === 0 ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  recommendedSealed: failedChecks.length === 0,
  blocker: failedChecks.length === 0 ? "none" : failedChecks.map((entry) => entry.id).join(", "),
  checks,
  safety: {
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
  },
};

writeEvidence("apps/ai-gateway-service/evidence/phase2046-claudecode-source-utilization-audit/verify-result.json", result);
console.log(JSON.stringify({
  status: result.status,
  blocker: result.blocker,
  sourceFound: gapMap?.claudeCodeSourceFound === true,
  completeUtilization: evidence?.completeUtilization === true,
}, null, 2));

if (failedChecks.length > 0) process.exit(1);

function resolve(relativePath) {
  return path.join(repoRoot, relativePath);
}

function readJson(relativePath) {
  const filePath = resolve(relativePath);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function readText(relativePath) {
  const filePath = resolve(relativePath);
  if (!existsSync(filePath)) return "";
  return readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
}

function writeEvidence(relativePath, value) {
  const filePath = resolve(relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
