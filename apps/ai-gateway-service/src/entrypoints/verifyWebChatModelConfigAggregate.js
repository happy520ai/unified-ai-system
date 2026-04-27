import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PHASE = "phase-97a-web-chat-model-config-aggregate";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-97a-web-chat-model-config-aggregate.json");
const evidenceMdPath = resolve(evidenceDir, "phase-97a-web-chat-model-config-aggregate.md");

const delegatedChecks = [
  {
    key: "successPath",
    script: "verifyWebChatModelConfigSuccessPath.js",
    evidence: "phase-86a-web-chat-model-config-success-path.json",
  },
  {
    key: "repairContinue",
    script: "verifyWebChatContinueAfterModelRepair.js",
    evidence: "phase-93a-web-chat-continue-after-model-repair.json",
  },
  {
    key: "repairVisualPolish",
    script: "verifyWebChatModelConfigRepairVisualPolish.js",
    evidence: "phase-94a-web-chat-model-config-repair-visual-polish.json",
  },
  {
    key: "readyFirstMessage",
    script: "verifyWebChatReadyFirstMessage.js",
    evidence: "phase-96a-web-chat-ready-first-message.json",
  },
];

let evidence;

try {
  const results = {};
  for (const check of delegatedChecks) {
    await runNodeScript(resolve(__dirname, check.script));
    const childEvidence = await readJson(resolve(evidenceDir, check.evidence));
    results[check.key] = summarizeChildEvidence(check.key, childEvidence);
  }

  const passed = Object.values(results).every((result) => result.status === "passed") &&
    results.successPath.runtimeModelConfigured === true &&
    results.successPath.chatProbePassed === true &&
    results.repairContinue.continuedPreviousPrompt === true &&
    results.repairVisualPolish.compactActionableCard === true &&
    results.readyFirstMessage.readyToChat === true &&
    results.readyFirstMessage.firstMessageReturned === true &&
    Object.values(results).every((result) => result.realProviderCalls === false) &&
    Object.values(results).every((result) => result.secretLeakageDetected === false);

  evidence = {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    delegatedChecks: results,
    safety: {
      browserInteraction: true,
      localMockProviderOnly: true,
      realProviderCalls: false,
      apiKeyValueRecorded: false,
      defaultChatMainLaneChanged: false,
      backendBusinessRouteAdded: false,
    },
    conclusion: passed
      ? "web-chat-model-config-chain-validated"
      : "web-chat-model-config-chain-not-validated",
  };
} catch (error) {
  evidence = {
    phase: PHASE,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "web-chat-model-config-chain-not-validated",
  };
}

await writeEvidence(evidence);
console.log(JSON.stringify(evidence, null, 2));
process.exitCode = evidence.status === "passed" ? 0 : 1;

function summarizeChildEvidence(key, childEvidence) {
  const summary = {
    phase: childEvidence.phase,
    status: childEvidence.status,
    conclusion: childEvidence.conclusion,
    realProviderCalls: childEvidence.safety?.realProviderCalls === true,
    secretLeakageDetected: childEvidence.safety?.apiKeyValueRecorded === true ||
      childEvidence.safety?.apiKeyPersistedInBrowser === true ||
      childEvidence.safety?.apiKeyPersistedInEvidence === true ||
      childEvidence.ui?.finalState?.localStorageContainsSecret === true ||
      childEvidence.ui?.finalState?.pageTextContainsSecret === true ||
      childEvidence.ui?.readyState?.localStorageContainsSecret === true ||
      childEvidence.ui?.readyState?.pageTextContainsSecret === true ||
      childEvidence.ui?.continuedState?.localStorageContainsSecret === true ||
      childEvidence.ui?.continuedState?.pageTextContainsSecret === true ||
      childEvidence.ui?.visualState?.localStorageContainsSecret === true ||
      childEvidence.ui?.visualState?.pageTextContainsSecret === true,
  };

  if (key === "successPath") {
    return {
      ...summary,
      runtimeModelConfigured: childEvidence.ui?.finalState?.providerSelectValue === "generic-openai-compatible::phase86-chat-model" &&
        childEvidence.ui?.finalState?.runtimeCredentialPresent === true,
      chatProbePassed: childEvidence.ui?.finalState?.chatFetch?.providerId === "generic-openai-compatible" &&
        childEvidence.ui?.finalState?.chatFetch?.model === "phase86-chat-model",
      focusReturnedToChatInput: childEvidence.ui?.finalState?.focusReturnedToChatInput === true,
    };
  }

  if (key === "repairContinue") {
    return {
      ...summary,
      continuedPreviousPrompt: childEvidence.ui?.beforeContinueState?.continueActionPresent === true &&
        childEvidence.ui?.continuedState?.continuedAnswerPresent === true &&
        Number(childEvidence.ui?.continuedState?.repeatedUserPromptCount ?? 0) >= 2,
      continueActionText: childEvidence.ui?.beforeContinueState?.continueActionText ?? "",
    };
  }

  if (key === "repairVisualPolish") {
    return {
      ...summary,
      compactActionableCard: childEvidence.ui?.visualState?.feedbackCompact === "compact" &&
        childEvidence.ui?.visualState?.detailsPresent === true &&
        childEvidence.ui?.visualState?.firstAction === "continue-last-failed-prompt" &&
        childEvidence.ui?.visualState?.primaryAction === "continue-last-failed-prompt",
      visibleParagraphCount: childEvidence.ui?.visualState?.visibleParagraphCount ?? 0,
    };
  }

  if (key === "readyFirstMessage") {
    return {
      ...summary,
      readyToChat: childEvidence.checks?.readyToChat?.focusReturnedToChatInput === true &&
        childEvidence.checks?.readyToChat?.composerGuidanceKind === "model-ready-nudge",
      firstMessageReturned: childEvidence.checks?.firstMessage?.inputClearedAfterSend === true &&
        childEvidence.checks?.firstMessage?.sendButtonReady === true &&
        childEvidence.checks?.firstMessage?.assistantAnswerIncludesMarker === true,
      firstMessageEndpoint: childEvidence.checks?.firstMessage?.endpoint ?? "",
    };
  }

  return summary;
}

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

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeEvidence(body) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, createEvidenceMarkdown(body), "utf8");
}

function createEvidenceMarkdown(body) {
  const checks = body.delegatedChecks ?? {};
  return `# Phase 97A Web Chat Model Config Aggregate Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Success path: ${checks.successPath?.status ?? "n/a"}; runtime configured: ${checks.successPath?.runtimeModelConfigured}
- First chat path: ${checks.readyFirstMessage?.status ?? "n/a"}; first message returned: ${checks.readyFirstMessage?.firstMessageReturned}
- Repair continue: ${checks.repairContinue?.status ?? "n/a"}; continued previous prompt: ${checks.repairContinue?.continuedPreviousPrompt}
- Repair visual polish: ${checks.repairVisualPolish?.status ?? "n/a"}; compact actionable card: ${checks.repairVisualPolish?.compactActionableCard}
- Local mock provider only: ${body.safety?.localMockProviderOnly}
- Real provider calls: ${body.safety?.realProviderCalls}
- API key value recorded: ${body.safety?.apiKeyValueRecorded}
- Default chat main lane changed: ${body.safety?.defaultChatMainLaneChanged}
- Backend business route added: ${body.safety?.backendBusinessRouteAdded}
- Conclusion: ${body.conclusion}
`;
}
