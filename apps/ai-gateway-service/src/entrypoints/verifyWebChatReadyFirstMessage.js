import { spawn } from "node:child_process";
import { writeEvidencePair } from "./entrypointUtils.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson } from "./entrypointUtils.js"

const PHASE = "phase-96a-web-chat-ready-first-message";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-96a-web-chat-ready-first-message.json");
const evidenceMdPath = resolve(evidenceDir, "phase-96a-web-chat-ready-first-message.md");

const readyScript = resolve(__dirname, "verifyWebChatModelConfigReadyToChat.js");
const firstChatScript = resolve(__dirname, "verifyWebChatModelConfigFirstChat.js");
const readyEvidencePath = resolve(evidenceDir, "phase-95a-web-chat-model-config-ready-to-chat.json");
const firstChatEvidencePath = resolve(evidenceDir, "phase-88a-web-chat-model-config-first-chat.json");

let evidence;

try {
  const readyRun = await runNodeScript(readyScript);
  const firstChatRun = await runNodeScript(firstChatScript);
  const readyEvidence = await readJson(readyEvidencePath);
  const firstChatEvidence = await readJson(firstChatEvidencePath);

  const readyState = readyEvidence.ui?.readyState ?? {};
  const firstChatState = firstChatEvidence.ui?.finalState ?? {};
  const passed = readyRun.exitCode === 0 &&
    firstChatRun.exitCode === 0 &&
    readyEvidence.status === "passed" &&
    firstChatEvidence.status === "passed" &&
    readyState.focusReturnedToChatInput === true &&
    readyState.composerGuidanceKind === "model-ready-nudge" &&
    readyState.sendButtonDisabled === true &&
    firstChatState.inputClearedAfterSend === true &&
    firstChatState.sendButtonReady === true &&
    firstChatState.focusReturnedToChatInput === true &&
    firstChatState.assistantAnswerIncludesMarker === true &&
    firstChatState.assistantStatusDone === true &&
    firstChatState.chatStreamFetch?.path === "/chat/stream" &&
    firstChatState.localStorageContainsSecret === false &&
    firstChatState.pageTextContainsSecret === false &&
    readyEvidence.safety?.realProviderCalls === false &&
    firstChatEvidence.safety?.realProviderCalls === false;

  evidence = {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    checks: {
      readyToChat: {
        delegatedPhase: readyEvidence.phase,
        status: readyEvidence.status,
        focusReturnedToChatInput: readyState.focusReturnedToChatInput,
        composerGuidanceKind: readyState.composerGuidanceKind,
        sendButtonDisabledUntilText: readyState.sendButtonDisabled,
        screenshot: readyEvidence.screenshot?.path ?? "",
      },
      firstMessage: {
        delegatedPhase: firstChatEvidence.phase,
        status: firstChatEvidence.status,
        endpoint: firstChatState.chatStreamFetch?.path ?? "",
        providerId: firstChatState.chatStreamFetch?.providerId ?? "",
        model: firstChatState.chatStreamFetch?.model ?? "",
        inputClearedAfterSend: firstChatState.inputClearedAfterSend,
        sendButtonReady: firstChatState.sendButtonReady,
        focusReturnedToChatInput: firstChatState.focusReturnedToChatInput,
        assistantAnswerIncludesMarker: firstChatState.assistantAnswerIncludesMarker,
        screenshot: firstChatEvidence.screenshot?.path ?? "",
      },
    },
    safety: {
      browserInteraction: true,
      localMockProviderOnly: true,
      realProviderCalls: false,
      apiKeyValueRecorded: false,
      defaultChatMainLaneChanged: false,
      backendBusinessRouteAdded: false,
    },
    conclusion: passed
      ? "web-chat-ready-first-message-flow-connected"
      : "web-chat-ready-first-message-flow-not-connected",
  };
} catch (error) {
  evidence = {
    phase: PHASE,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "web-chat-ready-first-message-flow-not-connected",
  };
}

await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
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

