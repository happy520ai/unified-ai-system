import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PHASE = "phase-90a-web-chat-model-config-restart-status";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const upstreamJsonPath = resolve(evidenceDir, "phase-89a-web-chat-model-config-restart-persistence.json");
const evidenceJsonPath = resolve(evidenceDir, "phase-90a-web-chat-model-config-restart-status.json");
const evidenceMdPath = resolve(evidenceDir, "phase-90a-web-chat-model-config-restart-status.md");

let evidence;

try {
  const upstream = await runPhase89AndReadEvidence();
  const reloadState = upstream.ui?.reloadState ?? {};
  const restartState = upstream.ui?.restartState ?? {};
  const combinedText = [
    reloadState.composerModelGuideText,
    reloadState.composerModelProbeText,
    reloadState.composerModelPreferenceText,
    restartState.composerModelGuideText,
    restartState.composerModelProbeText,
    restartState.composerModelPreferenceText,
  ].join("\n");

  const checks = {
    upstreamPassed: upstream.status === "passed",
    reloadShowsRestoredDataset: reloadState.composerModelRestoredFromLocal === "true",
    restartShowsRestoredDataset: restartState.composerModelRestoredFromLocal === "true",
    reloadShowsLocalFileStorage: reloadState.composerModelCredentialStorage === "local-user-file",
    restartShowsLocalFileStorage: restartState.composerModelCredentialStorage === "local-user-file",
    guideExplainsLocalRestore: combinedText.includes("已从本机用户配置恢复"),
    guideExplainsRestartUsable: combinedText.includes("服务重启后仍可用"),
    guideExplainsCanSendDirectly: combinedText.includes("可以直接发送"),
    probeTextReadable: combinedText.includes("本机配置已恢复"),
    preferenceTextReadable: combinedText.includes("已恢复"),
    firstChatStillWorksAfterRestart: restartState.assistantAnswerIncludesExpectedMarker === true,
    noSecretInEvidence: !JSON.stringify(upstream).includes("phase89-persistable-api-key-not-for-evidence"),
    defaultChatMainLaneChanged: upstream.safety?.defaultChatMainLaneChanged === true,
  };
  const passed = Object.entries(checks)
    .filter(([name]) => name !== "defaultChatMainLaneChanged")
    .every(([, value]) => value === true) &&
    checks.defaultChatMainLaneChanged === false;

  evidence = {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    upstreamPhase: upstream.phase,
    upstreamStatus: upstream.status,
    ui: {
      reload: {
        providerSelectValue: reloadState.providerSelectValue,
        composerModelRestoredFromLocal: reloadState.composerModelRestoredFromLocal,
        composerModelCredentialStorage: reloadState.composerModelCredentialStorage,
        composerModelGuideText: reloadState.composerModelGuideText,
        composerModelProbeText: reloadState.composerModelProbeText,
        composerModelPreferenceText: reloadState.composerModelPreferenceText,
      },
      restart: {
        providerSelectValue: restartState.providerSelectValue,
        composerModelRestoredFromLocal: restartState.composerModelRestoredFromLocal,
        composerModelCredentialStorage: restartState.composerModelCredentialStorage,
        composerModelGuideText: restartState.composerModelGuideText,
        composerModelProbeText: restartState.composerModelProbeText,
        composerModelPreferenceText: restartState.composerModelPreferenceText,
      },
    },
    checks,
    safety: {
      localMockProviderOnly: upstream.safety?.localMockProviderOnly === true,
      realProviderCalls: upstream.safety?.realProviderCalls === true,
      apiKeyPersistedInEvidence: upstream.safety?.apiKeyPersistedInEvidence === true,
      defaultChatMainLaneChanged: upstream.safety?.defaultChatMainLaneChanged === true,
      backendBusinessRouteAdded: upstream.safety?.backendBusinessRouteAdded === true,
    },
    conclusion: passed ? "web-chat-model-config-restart-status-readable" : "web-chat-model-config-restart-status-not-readable",
  };

  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  evidence = {
    phase: PHASE,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "web-chat-model-config-restart-status-not-readable",
  };
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
}

async function runPhase89AndReadEvidence() {
  await runNodeScript("./src/entrypoints/verifyWebChatModelConfigRestartPersistence.js");
  return JSON.parse(await readFile(upstreamJsonPath, "utf8"));
}

function runNodeScript(scriptPath) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: resolve(repoRoot, "apps/ai-gateway-service"),
      stdio: "inherit",
    });
    child.once("error", rejectRun);
    child.once("exit", (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${scriptPath} exited with code ${code}`));
    });
  });
}

async function writeEvidence(body) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, createEvidenceMarkdown(body), "utf8");
}

function createEvidenceMarkdown(body) {
  return `# Phase 90A Web Chat Model Config Restart Status Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Upstream phase: ${body.upstreamPhase ?? "n/a"}
- Upstream status: ${body.upstreamStatus ?? "n/a"}
- Reload restored from local: ${body.ui?.reload?.composerModelRestoredFromLocal ?? "n/a"}
- Reload storage: ${body.ui?.reload?.composerModelCredentialStorage ?? "n/a"}
- Reload guide: ${body.ui?.reload?.composerModelGuideText ?? "n/a"}
- Restart restored from local: ${body.ui?.restart?.composerModelRestoredFromLocal ?? "n/a"}
- Restart storage: ${body.ui?.restart?.composerModelCredentialStorage ?? "n/a"}
- Restart guide: ${body.ui?.restart?.composerModelGuideText ?? "n/a"}
- Guide explains local restore: ${body.checks?.guideExplainsLocalRestore}
- Guide explains restart usable: ${body.checks?.guideExplainsRestartUsable}
- Guide explains direct send: ${body.checks?.guideExplainsCanSendDirectly}
- Probe text readable: ${body.checks?.probeTextReadable}
- Preference text readable: ${body.checks?.preferenceTextReadable}
- First chat still works after restart: ${body.checks?.firstChatStillWorksAfterRestart}
- No secret in evidence: ${body.checks?.noSecretInEvidence}
- Real provider calls: ${body.safety?.realProviderCalls}
- Default chat main lane changed: ${body.safety?.defaultChatMainLaneChanged}
- Conclusion: ${body.conclusion}
`;
}
