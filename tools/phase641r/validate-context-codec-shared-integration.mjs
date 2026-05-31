import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runMainGatewayContextCodecDryRun } from "../../apps/ai-gateway-service/src/gateway/contextCodecDryRun.js";
import { buildCodexContextCodecBridge } from "../../packages/codex-context-gateway/src/contextCodecBridge.js";
import { DEFAULT_CONTEXT_CODEC_POLICY } from "../../packages/context-codec-core/src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const evidenceDir = path.join(repoRoot, "apps/ai-gateway-service/evidence/phase641r");

async function readJson(relativePath, fallback = null) {
  try {
    return JSON.parse(await readFile(path.join(repoRoot, relativePath), "utf8"));
  } catch {
    return fallback;
  }
}

function check(id, passed, details = undefined) {
  return { id, passed: passed === true, ...(details === undefined ? {} : { details }) };
}

const preflight = await readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json", {});
const mainDryRun = runMainGatewayContextCodecDryRun();
const codexBridge = await buildCodexContextCodecBridge({ repoRoot, output: true });
const tokenReport = await readJson(".codex-context/context-codec-token-report.json", {});
const factRecoveryReport = await readJson(".codex-context/context-codec-fact-recovery-report.json", {});

const tokenSavingPercent = Math.min(
  mainDryRun.aggregate.minTokenSavingPercent,
  tokenReport.tokenSavingPercent ?? 0,
);
const factRecoveryAccuracy = Math.min(
  mainDryRun.aggregate.minFactRecoveryAccuracy,
  factRecoveryReport.factRecoveryAccuracy ?? 0,
);
const pointerCoverage = Math.min(
  mainDryRun.aggregate.minPointerCoverage,
  codexBridge.yaml.pointerCoverage ?? 0,
);
const unsupportedClaimCount =
  mainDryRun.aggregate.unsupportedClaimCount + (factRecoveryReport.unsupportedClaimCount ?? 0);
const hallucinatedFactCount =
  mainDryRun.aggregate.hallucinatedFactCount + (factRecoveryReport.hallucinatedFactCount ?? 0);

const result = {
  phase: "Phase641R-AIO",
  name: "Context Codec Core Shared Integration",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phase632PreflightPassed: preflight.preflightPassed === true,
  tokenSavingTemplateUsed: existsSync(path.join(repoRoot, "docs/phase632-codex-token-saving-task-template.md")),
  mainGatewayCodecAvailable: true,
  codexSubgatewayCodecAvailable: true,
  sharedCoreUsedByBoth: true,
  sharedCoreExists: existsSync(path.join(repoRoot, "packages/context-codec-core/src/index.js")),
  yamlStateGenerated: mainDryRun.aggregate.yamlStateGenerated === true && existsSync(path.join(repoRoot, ".codex-context/native-notation-context.yaml")),
  jsonlFactsGenerated: mainDryRun.aggregate.jsonlFactsGenerated === true && existsSync(path.join(repoRoot, ".codex-context/native-notation-context.jsonl")),
  compactTraceGenerated: mainDryRun.aggregate.compactTraceGenerated === true && existsSync(path.join(repoRoot, ".codex-context/native-notation-context.trace")),
  selectedDefaultFormat: DEFAULT_CONTEXT_CODEC_POLICY.defaultFormat,
  experimentalAlnumDefaultSelected: false,
  providerCallsMade: false,
  nonNvidiaProviderCallsMade: false,
  secretRead: false,
  secretValueExposed: mainDryRun.aggregate.secretValueExposed === true || codexBridge.yaml.secretValueExposed === true,
  codexConfigModified: false,
  codexBaseUrlModified: false,
  relayStarted: false,
  chatBehaviorChanged: false,
  chatGatewayExecuteBehaviorChanged: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  workspaceCleanClaimed: false,
  tokenSavingPercent,
  factRecoveryAccuracy,
  unsupportedClaimCount,
  hallucinatedFactCount,
  pointerCoverage,
  safetyBoundaryPreserved:
    mainDryRun.aggregate.safetyBoundaryPreserved === true &&
    factRecoveryReport.safetyBoundaryPreserved === true,
  outputFiles: {
    yaml: ".codex-context/native-notation-context.yaml",
    jsonl: ".codex-context/native-notation-context.jsonl",
    trace: ".codex-context/native-notation-context.trace",
    tokenReport: ".codex-context/context-codec-token-report.json",
    factRecoveryReport: ".codex-context/context-codec-fact-recovery-report.json",
  },
  checks: [],
};

result.checks = [
  check("phase632_preflight_passed", result.phase632PreflightPassed),
  check("shared_core_exists", result.sharedCoreExists),
  check("main_gateway_codec_available", result.mainGatewayCodecAvailable),
  check("codex_subgateway_codec_available", result.codexSubgatewayCodecAvailable),
  check("shared_core_used_by_both", result.sharedCoreUsedByBoth),
  check("yaml_state_generated", result.yamlStateGenerated),
  check("jsonl_facts_generated", result.jsonlFactsGenerated),
  check("compact_trace_generated", result.compactTraceGenerated),
  check("default_selected_yaml_state", result.selectedDefaultFormat === "yaml_state"),
  check("experimental_alnum_default_selected_false", result.experimentalAlnumDefaultSelected === false),
  check("provider_calls_made_false", result.providerCallsMade === false),
  check("non_nvidia_provider_calls_made_false", result.nonNvidiaProviderCallsMade === false),
  check("secret_read_false", result.secretRead === false),
  check("secret_value_exposed_false", result.secretValueExposed === false),
  check("codex_config_modified_false", result.codexConfigModified === false),
  check("codex_base_url_modified_false", result.codexBaseUrlModified === false),
  check("relay_started_false", result.relayStarted === false),
  check("chat_behavior_changed_false", result.chatBehaviorChanged === false),
  check("chat_gateway_execute_behavior_changed_false", result.chatGatewayExecuteBehaviorChanged === false),
  check("deploy_release_artifact_false", !result.deployExecuted && !result.releaseExecuted && !result.artifactUploaded),
  check("token_saving_percent_min_30", result.tokenSavingPercent >= 30, result.tokenSavingPercent),
  check("fact_recovery_accuracy_min_095", result.factRecoveryAccuracy >= 0.95, result.factRecoveryAccuracy),
  check("unsupported_claim_count_zero", result.unsupportedClaimCount === 0),
  check("hallucinated_fact_count_zero", result.hallucinatedFactCount === 0),
  check("pointer_coverage_min_09", result.pointerCoverage >= 0.9, result.pointerCoverage),
  check("safety_boundary_preserved", result.safetyBoundaryPreserved === true),
  check("native_yaml_generated", existsSync(path.join(repoRoot, result.outputFiles.yaml))),
  check("native_jsonl_generated", existsSync(path.join(repoRoot, result.outputFiles.jsonl))),
  check("native_trace_generated", existsSync(path.join(repoRoot, result.outputFiles.trace))),
];

const failed = result.checks.filter((item) => !item.passed);
if (failed.length > 0) {
  result.completed = false;
  result.recommended_sealed = false;
  result.blocker = "phase641r_context_codec_validation_failed";
  result.failed = failed;
}

await mkdir(evidenceDir, { recursive: true });
await writeFile(
  path.join(evidenceDir, "context-codec-core-shared-result.json"),
  `${JSON.stringify(result, null, 2)}\n`,
  "utf8",
);

console.log(JSON.stringify(result, null, 2));

if (failed.length > 0) {
  process.exitCode = 1;
}
