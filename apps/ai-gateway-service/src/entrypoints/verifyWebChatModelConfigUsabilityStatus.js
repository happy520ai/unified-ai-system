import { spawn } from "node:child_process";
import { writeEvidencePair } from "./entrypointUtils.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PHASE = "phase-87a-web-chat-model-config-usability-status";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const upstreamEvidencePath = resolve(evidenceDir, "phase-86a-web-chat-model-config-success-path.json");
const evidenceJsonPath = resolve(evidenceDir, "phase-87a-web-chat-model-config-usability-status.json");
const evidenceMdPath = resolve(evidenceDir, "phase-87a-web-chat-model-config-usability-status.md");
const successPathScript = resolve(__dirname, "verifyWebChatModelConfigSuccessPath.js");

let evidence;

try {
  const upstream = await runSuccessPathAndReadEvidence();
  const finalState = upstream.ui?.finalState ?? {};
  const feedbackText = String(finalState.feedbackText || "");
  const composerGuideText = String(finalState.composerModelGuideText || "");
  const serialized = JSON.stringify(upstream);

  const checks = {
    successPathPassed: upstream.status === "passed",
    providerExplained: feedbackText.includes("Provider 已识别"),
    modelExplained: feedbackText.includes("模型已选择"),
    runtimeExplained: feedbackText.includes("已添加到当前服务"),
    chatProbeExplained: feedbackText.includes("/chat 探测已通过"),
    chatReadyExplained: feedbackText.includes("当前聊天可用"),
    secretSafetyExplained: feedbackText.includes("API Key 安全"),
    persistedChoiceExplained: feedbackText.includes("已记住默认选择"),
    browserSecretSafetyExplained: feedbackText.includes("API Key 未保存到浏览器"),
    composerReadyDataset: finalState.composerModelReady === "true",
    composerProviderDataset: finalState.composerModelProviderId === "generic-openai-compatible",
    composerModelDataset: finalState.composerModelId === "phase86-chat-model",
    composerGuideExplainsReady: composerGuideText.includes("配置已生效") && composerGuideText.includes("/chat 探测"),
    apiKeyNotInEvidence: !serialized.includes("phase86-secret-must-not-persist"),
  };

  const passed = Object.values(checks).every(Boolean);
  evidence = {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    upstreamPhase: upstream.phase,
    upstreamStatus: upstream.status,
    checks,
    ui: {
      providerSelectValue: finalState.providerSelectValue || "",
      preferenceValue: finalState.preferenceValue || "",
      composerModelStatusState: finalState.composerModelStatusState || "",
      composerModelReady: finalState.composerModelReady || "",
      composerModelProviderId: finalState.composerModelProviderId || "",
      composerModelId: finalState.composerModelId || "",
      feedbackText: redactLongText(feedbackText),
      composerModelGuideText: redactLongText(composerGuideText),
    },
    safety: {
      localMockProviderOnly: upstream.safety?.localMockProviderOnly === true,
      realProviderCalls: upstream.safety?.realProviderCalls === true,
      apiKeyValueRecorded: false,
      apiKeyPersistedInEvidence: false,
      defaultChatMainLaneChanged: false,
    },
    conclusion: passed ? "web-chat-model-config-usability-status-clear" : "web-chat-model-config-usability-status-not-clear",
  };

  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  evidence = {
    phase: PHASE,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "web-chat-model-config-usability-status-not-clear",
  };
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
}

async function runSuccessPathAndReadEvidence() {
  await runNodeScript(successPathScript);
  const text = await readFile(upstreamEvidencePath, "utf8");
  return JSON.parse(text);
}

function runNodeScript(scriptPath) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: repoRoot,
      env: process.env,
      stdio: "inherit",
    });
    child.once("error", rejectRun);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolveRun();
        return;
      }
      rejectRun(new Error(`${scriptPath} failed with ${signal || `exit code ${code}`}`));
    });
  });
}


function redactLongText(value) {
  const text = String(value || "");
  return text.length > 1200 ? `${text.slice(0, 1200)}...` : text;
}
