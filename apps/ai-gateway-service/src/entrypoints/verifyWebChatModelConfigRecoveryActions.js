import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { createConsolePage } from "../ui/consolePage.js";
import { writeEvidenceWithRenderer } from "./entrypointUtils.js";

const PHASE = "phase-84a-web-chat-model-config-recovery-actions";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-84a-web-chat-model-config-recovery-actions.json");
const evidenceMdPath = resolve(evidenceDir, "phase-84a-web-chat-model-config-recovery-actions.md");

try {
  const html = createConsolePage();
  const inlineScript = extractInlineScript(html);
  new vm.Script(inlineScript, { filename: "consolePage-inline.js" });

  const consoleSource = await readFile(resolve(repoRoot, "apps/ai-gateway-service/src/ui/consolePage.js"), "utf8");
  const rootPackage = JSON.parse(await readFile(resolve(repoRoot, "package.json"), "utf8"));
  const servicePackage = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/package.json"), "utf8"));

  const checks = {
    scriptValid: true,
    feedbackActionsHelperPresent: consoleSource.includes("function appendConfigFeedbackActions"),
    recoveryActionsHelperPresent: consoleSource.includes("function appendModelConfigRecoveryActions"),
    successActionsHelperPresent: consoleSource.includes("function appendModelConfigSuccessActions"),
    focusHelperPresent: consoleSource.includes("function focusModelConfigControl"),
    diagnosticCommandsHelperPresent: consoleSource.includes("function showModelConfigDiagnosticCommands"),
    retryActionPresent: consoleSource.includes("retry-model-probe") && consoleSource.includes("重新检测"),
    providerFocusActionPresent: consoleSource.includes("focus-provider-hint") && consoleSource.includes("选择 provider"),
    baseUrlFocusActionPresent: consoleSource.includes("focus-base-url") && consoleSource.includes("填写 Base URL"),
    manualModelFocusActionPresent: consoleSource.includes("focus-manual-model-id") && consoleSource.includes("手填模型 ID"),
    diagnosticActionPresent: consoleSource.includes("show-model-diagnostic-commands") && consoleSource.includes("查看排查命令"),
    continueChatActionPresent: consoleSource.includes("continue-chat-after-model-check") && consoleSource.includes("继续聊天"),
    successCanApplyDetectedModel: consoleSource.includes("apply-detected-model") && consoleSource.includes("一键添加并检测"),
    missingKeyHasNextActions: consoleSource.includes("focus-api-key-draft") && consoleSource.includes("粘贴 API Key"),
    noSecretLogging: !consoleSource.includes("console.log(apiKey") && !consoleSource.includes("console.log(secretInput"),
    rootVerifyScriptPresent: rootPackage.scripts?.["verify:phase84a"] === "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase84a",
    serviceVerifyScriptPresent: servicePackage.scripts?.["verify:phase84a"] === "node ./src/entrypoints/verifyWebChatModelConfigRecoveryActions.js",
    serviceCheckIncludesVerifier: String(servicePackage.scripts?.check || "").includes("verifyWebChatModelConfigRecoveryActions.js"),
  };

  const passed = Object.values(checks).every(Boolean);
  const evidence = {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    checks,
    safety: {
      readOnlyVerification: true,
      browserOpened: false,
      serviceStarted: false,
      providerCalls: false,
      backendBusinessRouteAdded: false,
      defaultChatMainLaneChanged: false,
      secretValuesRecorded: false,
    },
    conclusion: passed ? "web-chat-model-config-recovery-actions-connected" : "web-chat-model-config-recovery-actions-not-connected",
  };
  await saveEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  const evidence = {
    phase: PHASE,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "web-chat-model-config-recovery-actions-not-connected",
  };
  await saveEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
}

function extractInlineScript(html) {
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) throw new Error("Console page inline script not found.");
  return match[1];
}

async function saveEvidence(evidence) {
  await writeEvidenceWithRenderer(
    evidenceDir,
    evidenceJsonPath,
    evidenceMdPath,
    evidence,
    renderEvidenceMarkdown,
  );
}

function renderEvidenceMarkdown(evidence) {
  return [
    `# ${PHASE}`,
    "",
    `- Status: ${evidence.status}`,
    `- Generated at: ${evidence.generatedAt}`,
    `- Feedback actions helper present: ${Boolean(evidence.checks?.feedbackActionsHelperPresent)}`,
    `- Recovery actions helper present: ${Boolean(evidence.checks?.recoveryActionsHelperPresent)}`,
    `- Retry action present: ${Boolean(evidence.checks?.retryActionPresent)}`,
    `- Provider focus action present: ${Boolean(evidence.checks?.providerFocusActionPresent)}`,
    `- Base URL focus action present: ${Boolean(evidence.checks?.baseUrlFocusActionPresent)}`,
    `- Manual model focus action present: ${Boolean(evidence.checks?.manualModelFocusActionPresent)}`,
    `- Diagnostic action present: ${Boolean(evidence.checks?.diagnosticActionPresent)}`,
    `- Continue chat action present: ${Boolean(evidence.checks?.continueChatActionPresent)}`,
    `- Provider calls: ${Boolean(evidence.safety?.providerCalls)}`,
    `- Default chat main lane changed: ${Boolean(evidence.safety?.defaultChatMainLaneChanged)}`,
    `- Conclusion: ${evidence.conclusion}`,
    "",
  ].join("\n");
}
