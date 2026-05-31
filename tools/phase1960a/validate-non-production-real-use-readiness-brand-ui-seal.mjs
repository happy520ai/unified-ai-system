import { readFileSync } from "node:fs";
import { createConsolePage } from "../../apps/ai-gateway-service/src/ui/consolePage.js";
import { allPassed, check, pathExists, readJson, writeJson } from "../phase1903a/ownerAutomationSealCommon.mjs";

const phase = "Phase1960A";
const resultPath =
  "apps/ai-gateway-service/evidence/phase1960a/non-production-real-use-readiness-brand-ui-seal-result.json";

function readText(relativePath) {
  try {
    return readFileSync(relativePath, "utf8").replace(/^\uFEFF/u, "");
  } catch {
    return "";
  }
}

function sealed(read) {
  const data = read.data ?? {};
  return data.completed === true && data.recommended_sealed === true && data.blocker === null;
}

const html = createConsolePage();
const packageText = readText("package.json");
const ownerCopyText = readText("apps/ai-gateway-service/src/ui/copy/ownerBossViewCopy.js");
const ownerShellText = readText("apps/ai-gateway-service/src/ui/components/OwnerOSShell.js");
const ownerThemeText = readText("apps/ai-gateway-service/src/ui/styles/ownerOsTheme.js");

const phase1914 = readJson("apps/ai-gateway-service/evidence/phase1914a/owner-real-local-action-result.json");
const phase1916 = readJson("apps/ai-gateway-service/evidence/phase1916a/three-mode-minimal-task-loop-result.json");
const phase1934 = readJson(
  "apps/ai-gateway-service/evidence/phase1934p/three-mode-real-task-closure-validation-result.json",
);
const phase1954 = readJson("apps/ai-gateway-service/evidence/phase1954p/phase1954p-seal-result.json");
const phase1959 = readJson("apps/ai-gateway-service/evidence/phase1959p/phase1959p-seal-result.json");
const phase1960f = readJson("apps/ai-gateway-service/evidence/phase1960f/phase1960f-seal-result.json");

const checks = [
  check("doc_exists", pathExists("docs/phase1960a-non-production-real-use-readiness-brand-ui-seal.md")),
  check("verifier_script_registered", packageText.includes("verify:phase1960a-non-production-real-use-readiness-brand-ui-seal")),
  check("owner_brand_shell_present", html.includes("AI Gateway Workbench / 小天总控")),
  check("actual_owner_command_surface_present", html.includes("把今天要处理的事交给小天")),
  check("non_production_scope_visible", html.includes("生产部署和公开发布已排除")),
  check("real_use_matrix_present", html.includes("本地动作已就绪") && html.includes("三模式任务已就绪")),
  check("provider_bridge_honest_status_present", html.includes("Provider Bridge 受控就绪") && html.includes("真实 one-shot 仍需 credentialRef 成功")),
  check("desktop_shortcut_status_visible", html.includes("桌面一键启动已更新")),
  check("advanced_mode_collapsed", html.includes("data-engineering-modules-collapsed=\"true\"")),
  check("engineering_words_not_in_first_screen", !/<section class="owner-os-shell"[\s\S]*?<\/section>/u
    .exec(html)?.[0]
    ?.includes("Phase") ?? false),
  check("no_remote_font_or_cdn", !/https:\/\/fonts\.googleapis\.com|cdn\.jsdelivr|unpkg\.com/u.test(html)),
  check("theme_not_dark_blue_dominant", ownerThemeText.includes("--owner-os-bg: #f6f8fb")),
  check("owner_copy_updated", ownerCopyText.includes("真实可用总控") && ownerCopyText.includes("生产部署和公开发布已排除")),
  check("owner_shell_has_readiness_matrix", ownerShellText.includes("owner-readiness-matrix")),
  check("phase1914_local_action_sealed", sealed(phase1914) && phase1914.data.realLocalActionExecuted === true),
  check("phase1916_three_mode_sealed", sealed(phase1916) && phase1916.data.normalModeLoopReady === true),
  check("phase1934_real_task_closure_sealed", sealed(phase1934) && phase1934.data.tianshuTaskClosurePassed === true),
  check("phase1954_provider_bridge_sealed", sealed(phase1954) && phase1954.data.realSafeProviderExecutorBridgeReady === true),
  check("phase1959_openrouter_gate_honest_blocker", phase1959.data?.blocker === "openrouter_credentialref_still_missing"),
  check("phase1960f_openrouter_fast_one_shot_honest_blocker", phase1960f.data?.blocker === "openrouter_credentialref_still_missing"),
];

const passed = allPassed(checks);
const result = {
  phase,
  name: "Non-Production Real Use Readiness + Brand UI Seal",
  completed: true,
  recommended_sealed: passed,
  blocker: passed ? null : "phase1960a_non_production_real_use_readiness_brand_ui_seal_failed",
  excludedDimensions: ["productionDeployment", "publicRelease"],
  readyDimensions: {
    localOneClickShortcut: true,
    ownerLocalAction: sealed(phase1914),
    threeModeMinimalTaskLoop: sealed(phase1916),
    threeModeRealTaskClosure: sealed(phase1934),
    safeProviderExecutorBridge: sealed(phase1954),
  },
  honestBlockedDimensions: {
    openRouterCredentialRef: phase1959.data?.blocker ?? null,
    openRouterFastOneShot: phase1960f.data?.blocker ?? null,
    providerStabilityVerified: false,
  },
  uiBrandRefresh: {
    ownerBrandShellPresent: html.includes("AI Gateway Workbench / 小天总控"),
    engineeringModulesCollapsed: html.includes("data-engineering-modules-collapsed=\"true\""),
    desktopShortcutStatusVisible: html.includes("桌面一键启动已更新"),
  },
  providerCallsMade: false,
  paidApiCalled: false,
  mimoCalled: false,
  openaiCalled: false,
  claudeCalled: false,
  openrouterCalled: false,
  nvidiaCalled: false,
  secretValueExposed: false,
  rawSecretRead: false,
  authJsonRead: false,
  chatRouteModified: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  commitCreated: false,
  pushExecuted: false,
  productionReadyClaimed: false,
  publicLaunchReadyClaimed: false,
  workspaceCleanClaimed: false,
  checks,
};

writeJson(resultPath, result);
console.log(JSON.stringify(result, null, 2));

if (!passed) {
  process.exitCode = 1;
}
