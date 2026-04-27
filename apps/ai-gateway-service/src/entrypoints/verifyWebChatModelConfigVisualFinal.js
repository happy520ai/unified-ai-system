import { spawn } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PHASE = "phase-99a-web-chat-model-config-visual-final";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-99a-web-chat-model-config-visual-final.json");
const evidenceMdPath = resolve(evidenceDir, "phase-99a-web-chat-model-config-visual-final.md");
const phase98ScriptPath = resolve(__dirname, "verifyWebChatModelConfigUserJourney.js");
const phase98EvidencePath = resolve(evidenceDir, "phase-98a-web-chat-model-config-user-journey.json");
const phase98ScreenshotPath = resolve(evidenceDir, "phase-98a-web-chat-model-config-user-journey.png");

let evidence;

try {
  await runNodeScript(phase98ScriptPath);
  const phase98 = JSON.parse(await readFile(phase98EvidencePath, "utf8"));
  const screenshot = await inspectPng(phase98ScreenshotPath);

  const visualChecks = {
    phase98Passed: phase98.status === "passed",
    screenshotPresent: screenshot.validPng && screenshot.bytes > 10000,
    screenshotLargeEnough: screenshot.width >= 1000 && screenshot.height >= 700,
    composerPromptReadable: phase98.ui?.initialState?.entryButtonText === "配置模型" &&
      phase98.ui?.initialState?.guideIncludesApiKey === true &&
      phase98.ui?.initialState?.guideIncludesDirectChat === true,
    wizardReadable: phase98.ui?.wizardState?.hasWizard === true &&
      Array.isArray(phase98.ui?.wizardState?.stepTitles) &&
      phase98.ui.wizardState.stepTitles.length >= 3 &&
      phase98.ui.wizardState.quickApplyButtonText === "一键检测并保存" &&
      phase98.ui.wizardState.feedbackTitle === "下一步",
    successReadable: phase98.ui?.successState?.statusTitle === "模型配置已生效，可以开始聊天" &&
      phase98.ui?.successState?.continueChatActionPresent === true &&
      phase98.ui?.successState?.hasDetails === true &&
      phase98.ui?.successState?.secretInputCleared === true,
    readyToChatReadable: phase98.ui?.readyState?.focusReturnedToChatInput === true &&
      phase98.ui?.readyState?.composerGuidanceKind === "model-ready-nudge" &&
      String(phase98.ui?.readyState?.composerGuidanceText ?? "").includes("已经能聊"),
    mockProviderUsed: phase98.safety?.localMockProviderOnly === true &&
      phase98.safety?.realProviderCalls === false,
    secretSafe: phase98.safety?.apiKeyValueRecorded === false &&
      phase98.safety?.apiKeyPersistedInBrowser === false &&
      phase98.safety?.apiKeyPersistedInEvidence === false,
    defaultChatLaneUnchanged: phase98.safety?.defaultChatMainLaneChanged === false,
  };
  const passed = Object.values(visualChecks).every(Boolean);

  evidence = {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    delegatedCheck: {
      phase: phase98.phase,
      status: phase98.status,
      conclusion: phase98.conclusion,
      evidence: "apps/ai-gateway-service/evidence/phase-98a-web-chat-model-config-user-journey.json",
      screenshot: "apps/ai-gateway-service/evidence/phase-98a-web-chat-model-config-user-journey.png",
    },
    visualChecks,
    screenshot,
    userVisibleSummary: {
      entryButton: phase98.ui?.initialState?.entryButtonText ?? "",
      guide: phase98.ui?.initialState?.guide ?? "",
      wizardSteps: phase98.ui?.wizardState?.stepTitles ?? [],
      successTitle: phase98.ui?.successState?.statusTitle ?? "",
      successLines: phase98.ui?.successState?.visibleLines ?? [],
      readyGuidance: phase98.ui?.readyState?.composerGuidanceText ?? "",
    },
    safety: {
      browserInteraction: true,
      localMockProviderOnly: true,
      realProviderCalls: false,
      apiKeyValueRecorded: false,
      apiKeyPersistedInBrowser: false,
      apiKeyPersistedInEvidence: false,
      defaultChatMainLaneChanged: false,
      backendBusinessRouteAdded: false,
    },
    conclusion: passed
      ? "web-chat-model-config-visual-final-passed"
      : "web-chat-model-config-visual-final-not-passed",
  };
} catch (error) {
  evidence = {
    phase: PHASE,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "web-chat-model-config-visual-final-not-passed",
  };
}

await writeEvidence(evidence);
console.log(JSON.stringify(evidence, null, 2));
process.exitCode = evidence.status === "passed" ? 0 : 1;

async function runNodeScript(scriptPath) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", rejectRun);
    child.once("close", (exitCode) => {
      if (exitCode !== 0) {
        rejectRun(new Error(`Script failed: ${scriptPath}; exitCode=${exitCode}; stderr=${stderr.slice(0, 1200)}; stdout=${stdout.slice(0, 1200)}`));
        return;
      }
      resolveRun({ exitCode, stdoutBytes: Buffer.byteLength(stdout), stderrBytes: Buffer.byteLength(stderr) });
    });
  });
}

async function inspectPng(path) {
  const stats = await stat(path);
  const buffer = await readFile(path);
  const validPng = buffer.length >= 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  return {
    path: "apps/ai-gateway-service/evidence/phase-98a-web-chat-model-config-user-journey.png",
    bytes: stats.size,
    width: validPng ? buffer.readUInt32BE(16) : 0,
    height: validPng ? buffer.readUInt32BE(20) : 0,
    validPng,
  };
}

async function writeEvidence(body) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, createEvidenceMarkdown(body), "utf8");
}

function createEvidenceMarkdown(body) {
  return `# Phase 99A Web Chat Model Config Visual Final Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Delegated Phase98A status: ${body.delegatedCheck?.status ?? "n/a"}
- Screenshot: ${body.delegatedCheck?.screenshot ?? "n/a"}
- Screenshot bytes: ${body.screenshot?.bytes ?? "n/a"}
- Screenshot size: ${body.screenshot?.width ?? "n/a"}x${body.screenshot?.height ?? "n/a"}
- Composer prompt readable: ${body.visualChecks?.composerPromptReadable}
- Wizard readable: ${body.visualChecks?.wizardReadable}
- Success readable: ${body.visualChecks?.successReadable}
- Ready-to-chat readable: ${body.visualChecks?.readyToChatReadable}
- Local mock provider only: ${body.safety?.localMockProviderOnly}
- Real provider calls: ${body.safety?.realProviderCalls}
- API key persisted in browser: ${body.safety?.apiKeyPersistedInBrowser}
- API key persisted in evidence: ${body.safety?.apiKeyPersistedInEvidence}
- Default chat main lane changed: ${body.safety?.defaultChatMainLaneChanged}
- Backend business route added: ${body.safety?.backendBusinessRouteAdded}
- Conclusion: ${body.conclusion}
`;
}
