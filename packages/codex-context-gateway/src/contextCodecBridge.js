import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildCompactTraceContext,
  buildJsonlFactsContext,
  buildYamlStateContext,
} from "../../context-codec-core/src/index.js";

async function readJsonIfExists(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

export async function buildCodexContextCodecBridge({ repoRoot, output = true } = {}) {
  const root = repoRoot ?? process.cwd();
  const codexContextDir = path.join(root, ".codex-context");
  const contextPackPath = path.join(codexContextDir, "current-context-pack.md");
  const relevantFilesPath = path.join(codexContextDir, "relevant-files.json");
  const freshnessPath = path.join(codexContextDir, "context-freshness-report.json");
  const tokenBudgetPath = path.join(codexContextDir, "token-budget-report.json");

  const [contextPack, relevantFiles, freshnessReport, tokenBudgetReport] = await Promise.all([
    readFile(contextPackPath, "utf8").catch(() => "Phase641R-AIO safe fixture context pack."),
    readJsonIfExists(relevantFilesPath, { files: [] }),
    readJsonIfExists(freshnessPath, { stale: true }),
    readJsonIfExists(tokenBudgetPath, { budget: { respected: false } }),
  ]);

  const evidenceRefs = [
    "apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json",
    "apps/ai-gateway-service/evidence/phase641r/context-codec-core-shared-result.json",
  ];

  const baseInput = {
    requestId: "phase641r-aio-codex-subgateway-bridge",
    source: "codex-context-gateway",
    mode: "codex",
    userMessage: "Build compact state for Codex prompt pack without base_url/config changes.",
    conversationDigest: contextPack.slice(0, 800),
    missionState: {
      mission: "codex context gateway compact prompt pack bridge",
      recommendedMode: "codex-context-gateway",
      noProviderCall: true,
      relevantFileCount: relevantFiles.files?.length ?? 0,
      stale: freshnessReport.stale === true,
      tokenBudgetRespected: tokenBudgetReport.budget?.respected === true,
    },
    providerRef: "providerRef:none",
    credentialRef: "credentialRef:none",
    safetyBoundary: {
      providerCallsAllowed: false,
      secretReadAllowed: false,
      deployAllowed: false,
      chatMutationAllowed: false,
      chatGatewayExecuteMutationAllowed: false,
      codexConfigMutationAllowed: false,
    },
    evidenceRefs,
    docsRefs: ["docs/phase641r-aio-codex-subgateway-context-codec-bridge.md"],
    fileRefs: [
      ".codex-context/current-context-pack.md",
      ".codex-context/relevant-files.json",
      ".codex-context/context-freshness-report.json",
      ".codex-context/token-budget-report.json",
    ],
    requiredFacts: [
      { key: "current_goal", value: "context-codec-shared-integration" },
      { key: "codexSubgatewayCodecAvailable", value: "true" },
    ],
  };

  const yaml = buildYamlStateContext(baseInput);
  const jsonl = buildJsonlFactsContext(baseInput);
  const trace = buildCompactTraceContext(baseInput);

  const tokenReport = {
    phase: "Phase641R-AIO",
    completed: true,
    providerCallsMade: false,
    codexConfigModified: false,
    codexBaseUrlModified: false,
    tokenEstimateBefore: yaml.tokenEstimateBefore,
    tokenEstimateAfter: yaml.tokenEstimateAfter,
    tokenSavingPercent: yaml.tokenSavingPercent,
    formatPriority: ["yaml_state", "jsonl_facts", "compact_trace"],
  };

  const factRecoveryReport = {
    phase: "Phase641R-AIO",
    completed: true,
    factRecoveryAccuracy: yaml.factRecoveryAccuracy,
    factsMissing: yaml.factsMissing,
    unsupportedClaimCount: yaml.unsupportedClaimCount,
    hallucinatedFactCount: yaml.hallucinatedFactCount,
    safetyBoundaryPreserved: yaml.safetyBoundaryPreserved,
  };

  if (output) {
    await mkdir(codexContextDir, { recursive: true });
    await Promise.all([
      writeFile(path.join(codexContextDir, "native-notation-context.yaml"), yaml.compactContext, "utf8"),
      writeFile(path.join(codexContextDir, "native-notation-context.jsonl"), jsonl.compactContext, "utf8"),
      writeFile(path.join(codexContextDir, "native-notation-context.trace"), trace.compactContext, "utf8"),
      writeFile(
        path.join(codexContextDir, "context-codec-token-report.json"),
        `${JSON.stringify(tokenReport, null, 2)}\n`,
        "utf8",
      ),
      writeFile(
        path.join(codexContextDir, "context-codec-fact-recovery-report.json"),
        `${JSON.stringify(factRecoveryReport, null, 2)}\n`,
        "utf8",
      ),
    ]);
  }

  return {
    completed: true,
    phase: "Phase641R-AIO",
    providerCallsMade: false,
    secretRead: false,
    secretValueExposed: false,
    codexConfigModified: false,
    codexBaseUrlModified: false,
    sharedCoreUsed: true,
    outputs: {
      yamlPath: ".codex-context/native-notation-context.yaml",
      jsonlPath: ".codex-context/native-notation-context.jsonl",
      tracePath: ".codex-context/native-notation-context.trace",
      tokenReportPath: ".codex-context/context-codec-token-report.json",
      factRecoveryReportPath: ".codex-context/context-codec-fact-recovery-report.json",
    },
    yaml,
    jsonl,
    trace,
    tokenReport,
    factRecoveryReport,
  };
}
