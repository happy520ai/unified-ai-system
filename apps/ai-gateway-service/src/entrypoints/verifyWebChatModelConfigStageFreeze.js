import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PHASE = "phase-100a-web-chat-model-config-stage-freeze";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-100a-web-chat-model-config-stage-freeze.json");
const evidenceMdPath = resolve(evidenceDir, "phase-100a-web-chat-model-config-stage-freeze.md");

const delegatedChecks = [
  {
    key: "providerModelImport",
    script: "verifyModelImportFlow.js",
    evidence: "phase-8a-model-import.json",
  },
  {
    key: "explicitModelListProbe",
    script: "verifyWebChatModelListProbe.js",
    evidence: "phase-76s-web-chat-model-list-probe.json",
  },
  {
    key: "modelConfigAggregate",
    script: "verifyWebChatModelConfigAggregate.js",
    evidence: "phase-97a-web-chat-model-config-aggregate.json",
  },
  {
    key: "visualFinal",
    script: "verifyWebChatModelConfigVisualFinal.js",
    evidence: "phase-99a-web-chat-model-config-visual-final.json",
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

  const chainChecks = {
    allDelegatesPassed: Object.values(results).every((result) => result.status === "passed"),
    modelsFromProviderApis: results.providerModelImport.modelsComeFromProviderModelsApi === true,
    ambiguousKeysDoNotAutoPickOpenAi: results.explicitModelListProbe.plainSkDoesNotDefaultToOpenAi === true,
    explicitDeepProbeWorks: results.explicitModelListProbe.dashscopeRecommendedAfterModelsApi === true,
    modelConfigRegressionPassed: results.modelConfigAggregate.chainValidated === true,
    visualJourneyPassed: results.visualFinal.visualFinalPassed === true,
    noRealProviderCalls: Object.values(results).every((result) => result.realProviderCalls === false),
    noSecretLeakage: Object.values(results).every((result) => result.secretLeakageDetected === false),
    defaultChatLaneUnchanged: Object.values(results).every((result) => result.defaultChatMainLaneChanged === false),
  };
  const passed = Object.values(chainChecks).every(Boolean);

  evidence = {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    delegatedChecks: results,
    chainChecks,
    frozenScope: {
      modelImportPreviewAndConfirm: true,
      boundedProviderModelsApiProbe: true,
      modelConfigSuccessAndRepairRegression: true,
      readyToChatAndFirstMessageRegression: true,
      finalVisualUserJourneyCheck: true,
      defaultChatMainLaneChanged: false,
      multiProviderRoutingEnabled: false,
      fallbackExecutionEnabled: false,
    },
    safety: {
      browserInteraction: true,
      localMockProviderOnly: true,
      realProviderCalls: false,
      apiKeyValueRecorded: false,
      secretLeakageDetected: false,
      defaultChatMainLaneChanged: false,
      backendBusinessRouteAdded: false,
    },
    conclusion: passed
      ? "web-chat-model-config-stage-freeze-passed"
      : "web-chat-model-config-stage-freeze-not-passed",
  };
} catch (error) {
  evidence = {
    phase: PHASE,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "web-chat-model-config-stage-freeze-not-passed",
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
    defaultChatMainLaneChanged: childEvidence.safety?.defaultChatMainLaneChanged === true,
    secretLeakageDetected: childEvidence.safety?.apiKeyValueRecorded === true ||
      childEvidence.safety?.evidenceContainsPlaintextKey === true ||
      childEvidence.safety?.apiKeyPersistedInBrowser === true ||
      childEvidence.safety?.apiKeyPersistedInEvidence === true ||
      childEvidence.safety?.secretLeakageDetected === true,
  };

  if (key === "providerModelImport") {
    return {
      ...summary,
      modelsComeFromProviderModelsApi: childEvidence.safety?.modelsComeFromProviderModelsApi === true,
      globalProviderHintProbeCoverage: childEvidence.safety?.globalProviderHintProbeCoverage === true,
      ambiguousMultiProviderRequiresUserSelection: childEvidence.safety?.ambiguousMultiProviderRequiresUserSelection === true,
      unknownKeyRequiresProviderSelection: childEvidence.safety?.unknownKeyRequiresProviderSelection === true,
      localUserModelPersistsAcrossRestart: childEvidence.safety?.localUserModelPersistsAcrossRestart === true,
    };
  }

  if (key === "explicitModelListProbe") {
    return {
      ...summary,
      explicitProbeEnabledOnlyByRequest: childEvidence.safety?.explicitProbeEnabledOnlyByRequest === true,
      plainSkDoesNotDefaultToOpenAi: childEvidence.safety?.plainSkDoesNotDefaultToOpenAi === true,
      dashscopeRecommendedAfterModelsApi: childEvidence.safety?.dashscopeRecommendedAfterAuthenticatedModelsApi === true,
      safeModeDoesNotProbeAmbiguousSk: childEvidence.safety?.safeModeDoesNotProbeAmbiguousSk === true,
    };
  }

  if (key === "modelConfigAggregate") {
    return {
      ...summary,
      chainValidated: childEvidence.conclusion === "web-chat-model-config-chain-validated",
      successPathPassed: childEvidence.delegatedChecks?.successPath?.status === "passed",
      repairContinuePassed: childEvidence.delegatedChecks?.repairContinue?.status === "passed",
      repairVisualPolishPassed: childEvidence.delegatedChecks?.repairVisualPolish?.status === "passed",
      readyFirstMessagePassed: childEvidence.delegatedChecks?.readyFirstMessage?.status === "passed",
    };
  }

  if (key === "visualFinal") {
    return {
      ...summary,
      visualFinalPassed: childEvidence.conclusion === "web-chat-model-config-visual-final-passed",
      screenshotValid: childEvidence.visualChecks?.screenshotPresent === true &&
        childEvidence.screenshot?.validPng === true,
      composerPromptReadable: childEvidence.visualChecks?.composerPromptReadable === true,
      wizardReadable: childEvidence.visualChecks?.wizardReadable === true,
      successReadable: childEvidence.visualChecks?.successReadable === true,
      readyToChatReadable: childEvidence.visualChecks?.readyToChatReadable === true,
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
  const checks = body.chainChecks ?? {};
  const delegates = body.delegatedChecks ?? {};
  return `# Phase 100A Web Chat Model Config Stage Freeze Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Provider model import: ${delegates.providerModelImport?.status ?? "n/a"}
- Explicit model list probe: ${delegates.explicitModelListProbe?.status ?? "n/a"}
- Model config aggregate: ${delegates.modelConfigAggregate?.status ?? "n/a"}
- Visual final: ${delegates.visualFinal?.status ?? "n/a"}
- Models from provider APIs: ${checks.modelsFromProviderApis}
- Ambiguous keys do not auto-pick OpenAI: ${checks.ambiguousKeysDoNotAutoPickOpenAi}
- Explicit deep probe works: ${checks.explicitDeepProbeWorks}
- Model config regression passed: ${checks.modelConfigRegressionPassed}
- Visual journey passed: ${checks.visualJourneyPassed}
- No real provider calls: ${checks.noRealProviderCalls}
- No secret leakage: ${checks.noSecretLeakage}
- Default chat lane unchanged: ${checks.defaultChatLaneUnchanged}
- Conclusion: ${body.conclusion}
`;
}
