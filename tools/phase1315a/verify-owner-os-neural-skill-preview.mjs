import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const phase = "Phase1315A";
const phaseKey = "phase1315a";
const packageJsonPath = resolve(repoRoot, "package.json");
const docsPath = resolve(repoRoot, "docs/phase1315a-owner-os-neural-skill-preview.md");
const componentPath = resolve(repoRoot, "apps/ai-gateway-service/src/ui/components/OwnerNeuralSkillPreviewPanel.js");
const ownerShellPath = resolve(repoRoot, "apps/ai-gateway-service/src/ui/components/OwnerOSShell.js");
const ownerThemePath = resolve(repoRoot, "apps/ai-gateway-service/src/ui/styles/ownerOsTheme.js");
const evidencePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1315a/owner-os-neural-skill-preview-result.json");

const result = await buildResult();
await writeJson(evidencePath, result);

console.log(JSON.stringify({
  phase: result.phase,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  checksFailed: result.checks.filter((check) => check.passed !== true).length,
}, null, 2));

if (!result.recommended_sealed) {
  process.exitCode = 1;
}

async function buildResult() {
  const packageJson = await readJson(packageJsonPath, {});
  const docsText = await readText(docsPath, "");
  const componentText = await readText(componentPath, "");
  const ownerShellText = await readText(ownerShellPath, "");
  const ownerThemeText = await readText(ownerThemePath, "");

  const requiredOwnerCopy = [
    "当前没有真实训练",
    "当前没有接主链",
    "当前仅 dry-run / inference-only preview",
  ];

  const forbiddenUiEntrypoints = [
    /<button\b/iu,
    /\brequestJson\s*\(/u,
    /\bfetch\s*\(/u,
    /\baddEventListener\s*\(/u,
    /开始训练/u,
    /真实运行/u,
    /运行按钮/u,
    /训练按钮/u,
  ];

  const checks = [
    check("package_script_exists", packageJson.scripts?.["verify:phase1315a-owner-os-neural-skill-preview"] === "node tools/phase1315a/verify-owner-os-neural-skill-preview.mjs"),
    check("docs_exists", await exists(docsPath)),
    check("component_exists", await exists(componentPath)),
    check("owner_shell_exists", await exists(ownerShellPath)),
    check("owner_theme_exists", await exists(ownerThemePath)),
    check("component_has_owner_os_marker", componentText.includes('data-owner-os-neural-skill-preview="true"')),
    check("component_has_readonly_marker", componentText.includes('data-neural-skill-preview-readonly="true"')),
    check("component_has_required_owner_copy", requiredOwnerCopy.every((item) => componentText.includes(item))),
    check("component_has_boundary_flags", [
      "realTrainingEnabled=false",
      "mainChainIntegrated=false",
      "providerCallsMade=false",
      "secretRead=false",
    ].every((item) => componentText.includes(item))),
    check("component_has_registry_preview_language", componentText.includes("mock skill registry") && componentText.includes("只读预览")),
    check("component_has_no_interactive_entrypoint", forbiddenUiEntrypoints.every((pattern) => !pattern.test(componentText))),
    check("owner_shell_imports_preview", ownerShellText.includes("renderOwnerNeuralSkillPreviewPanel")),
    check("owner_shell_renders_preview", ownerShellText.includes("${renderOwnerNeuralSkillPreviewPanel()}")),
    check("owner_theme_styles_preview", ownerThemeText.includes(".owner-neural-skill-preview")),
    check("docs_records_owner_boundary", requiredOwnerCopy.every((item) => docsText.includes(item))),
    check("docs_records_forbidden_boundaries", [
      "不加真实训练按钮",
      "不接 Provider",
      "不改 `/chat`",
      "不改 `/chat-gateway/execute`",
      "不读取 secret",
    ].every((item) => docsText.includes(item))),
  ];

  const blocker = checks.find((item) => item.passed !== true)?.id ?? null;

  return {
    phase,
    phaseKey,
    name: "Owner OS Neural Skill Preview",
    completed: blocker === null,
    recommended_sealed: blocker === null,
    blocker,
    docs: "docs/phase1315a-owner-os-neural-skill-preview.md",
    files: [
      "apps/ai-gateway-service/src/ui/components/OwnerNeuralSkillPreviewPanel.js",
      "apps/ai-gateway-service/src/ui/components/OwnerOSShell.js",
      "apps/ai-gateway-service/src/ui/styles/ownerOsTheme.js",
    ],
    verifier: "tools/phase1315a/verify-owner-os-neural-skill-preview.mjs",
    evidenceJson: "apps/ai-gateway-service/evidence/phase1315a/owner-os-neural-skill-preview-result.json",
    ui: {
      ownerOsPreviewVisible: blocker === null,
      readOnlyPanel: true,
      ownerFacingCopy: requiredOwnerCopy,
      realRunButtonEnabled: false,
      trainingButtonEnabled: false,
    },
    safety: {
      realTrainingEnabled: false,
      mainChainIntegrated: false,
      dryRunInferenceOnlyPreview: true,
      providerCallsMade: false,
      secretRead: false,
      secretValueExposed: false,
      chatModified: false,
      chatGatewayExecuteModified: false,
      legacyModified: false,
      projectContextCreated: false,
      commitPushDeployRelease: false,
      workspaceCleanClaimed: false,
    },
    checks,
  };
}

function check(id, passed) {
  return { id, passed: passed === true };
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readText(path, fallback) {
  try {
    return String(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function readJson(path, fallback) {
  const text = await readText(path, "");
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
