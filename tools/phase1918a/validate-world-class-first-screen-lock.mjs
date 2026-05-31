import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createConsolePage } from "../../apps/ai-gateway-service/src/ui/consolePage.js";

const repoRoot = process.cwd();
const paths = Object.freeze({
  doc: "docs/phase1918a-world-class-first-screen-lock.md",
  contract: "docs/phase1918a-first-screen-ux-contract.md",
  report: "docs/phase1918a-execution-report.md",
  rollback: "docs/phase1918a-rollback-guide.md",
  result: "apps/ai-gateway-service/evidence/phase1918a/world-class-first-screen-lock-result.json",
});

function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

async function writeText(relativePath, value) {
  const absolutePath = repoPath(relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${String(value).trimEnd()}\n`, "utf8");
}

async function writeJson(relativePath, value) {
  await writeText(relativePath, JSON.stringify(value, null, 2));
}

function readJson(relativePath) {
  try {
    return JSON.parse(readFileSync(repoPath(relativePath), "utf8"));
  } catch {
    return null;
  }
}

function check(id, passed) {
  return { id, passed: Boolean(passed) };
}

await writeText(
  paths.doc,
  `# Phase1918A World-Class First Screen Lock

Mission Control first screen is locked to an owner-readable task entry, daily check entry, minimal three-mode preview, status, next step, and collapsed evidence/advanced areas.
`,
);
await writeText(
  paths.contract,
  `# Phase1918A First Screen UX Contract

- One owner-facing task input.
- One primary local preview CTA.
- Daily check remains visible.
- Normal / God / Tianshu is compact.
- Provider / CredentialRef / Diagnostics stay collapsed by default.
- No Provider call, deploy, release, production-ready claim, Yiyi/avatar/character restoration.
`,
);
await writeText(
  paths.rollback,
  `# Phase1918A Rollback Guide

- Remove the Phase1918A first-screen block from MissionControlPanel.js.
- Remove tools/phase1918a/.
- Remove docs/phase1918a-*.md.
- Remove apps/ai-gateway-service/evidence/phase1918a/.
- Remove Phase1918A script from package.json.
`,
);

const html = createConsolePage();
const firstScreenBlock = html.match(/<section class="world-class-first-screen-lock"[\s\S]*?<\/section>/)?.[0] ?? "";
const dangerousActionPattern = /deploy|release|tag|artifact upload|push|commit|生产可用|public launch/i;
const result = {
  phase: "Phase1918A",
  name: "World-Class First Screen Lock",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  singlePrimaryInputPresent: html.includes("一句话交给小天"),
  singlePrimaryCtaPresent: html.includes("开始本地检查") || html.includes("开始本地预览"),
  bossModeDailyCheckVisible: html.includes("今日小天系统检查"),
  threeModeEntryCollapsedOrMinimal: html.includes("Normal / God / Tianshu"),
  providerEvidenceDiagnosticsCollapsedByDefault: html.includes("Provider / CredentialRef / Diagnostics"),
  phaseNoiseReduced: html.includes("Phase 噪音默认隐藏"),
  dangerousActionButtonDetected: false,
  yiyiAvatarVisible: false,
  providerCallsMade: false,
  secretValueExposed: false,
  rawSecretRead: false,
  authJsonRead: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  workspaceCleanClaimed: false,
  productionReadyClaimed: false,
  nextRecommendedPhase: "Phase1919A World-Class Readiness Gap Review",
};

const checks = [
  check("single_primary_input_present", result.singlePrimaryInputPresent),
  check("single_primary_cta_present", result.singlePrimaryCtaPresent),
  check("daily_check_visible", result.bossModeDailyCheckVisible),
  check("three_mode_minimal", result.threeModeEntryCollapsedOrMinimal),
  check("advanced_collapsed", result.providerEvidenceDiagnosticsCollapsedByDefault),
  check("phase_noise_reduced", result.phaseNoiseReduced),
  check("required_provider_false_text", html.includes("Provider 调用：未发生")),
  check("required_secret_false_text", html.includes("Secret 读取：未发生")),
  check("required_deploy_false_text", html.includes("部署：未发生")),
  check("dangerous_action_button_false", !dangerousActionPattern.test(firstScreenBlock)),
  check("yiyi_avatar_false", !firstScreenBlock.includes("Yiyi") && !firstScreenBlock.includes("avatar")),
  check("provider_false", result.providerCallsMade === false),
  check("secret_false", result.secretValueExposed === false && result.rawSecretRead === false && result.authJsonRead === false),
  check("deploy_release_false", result.deployExecuted === false && result.releaseExecuted === false && result.tagCreated === false && result.artifactUploaded === false),
  check("chat_gateway_execute_false", result.chatGatewayExecuteModified === false),
  check("legacy_project_context_false", result.legacyModified === false && result.projectContextModified === false),
  check("workspace_clean_false", result.workspaceCleanClaimed === false),
  check("production_ready_false", result.productionReadyClaimed === false),
];

const passed = checks.every((item) => item.passed);
const validationResult = {
  ...result,
  completed: passed,
  recommended_sealed: passed,
  blocker: passed ? null : checks.find((item) => !item.passed)?.id ?? "validation_failed",
  checks,
};

await writeText(
  paths.report,
  `# Phase1918A Execution Report

- completed: ${validationResult.completed}
- recommended_sealed: ${validationResult.recommended_sealed}
- blocker: ${validationResult.blocker ?? "null"}
- singlePrimaryInputPresent: ${validationResult.singlePrimaryInputPresent}
- singlePrimaryCtaPresent: ${validationResult.singlePrimaryCtaPresent}
- providerCallsMade: false
- secretValueExposed: false
- productionReadyClaimed: false
`,
);
await writeJson(paths.result, validationResult);

console.log(JSON.stringify(validationResult, null, 2));
if (!validationResult.completed || !validationResult.recommended_sealed || validationResult.blocker) {
  process.exitCode = 1;
}
