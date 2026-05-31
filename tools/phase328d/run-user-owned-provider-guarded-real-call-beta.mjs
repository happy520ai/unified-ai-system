import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createUserOwnedProviderGate } from "../../apps/ai-gateway-service/src/provider-governance/userOwnedProviderGate.js";

const repoRoot = resolve(".");
const evidencePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase328d/user-owned-provider-guarded-beta-result.json");
const scenariosPath = resolve(repoRoot, "docs/phase328d-user-owned-provider-beta-scenarios.json");
const reportPath = resolve(repoRoot, "docs/phase328d-user-owned-provider-beta-report.md");
const preview = process.argv.includes("--preview");
const guardedRealCall = process.argv.includes("--guarded-real-call");
const gate = createUserOwnedProviderGate({ env: process.env });

const scenarios = buildScenarios();
await mkdir(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase328d"), { recursive: true });
await writeFile(scenariosPath, `${JSON.stringify(scenarios, null, 2)}\n`, "utf8");

const results = scenarios.scenarios.map((scenario) => runScenario(gate, scenario, { preview, guardedRealCall }));
const output = {
  phase: "Phase328D",
  preview,
  guardedRealCallRequested: guardedRealCall,
  PHASE328D_GUARDED_REAL_CALLS: process.env.PHASE328D_GUARDED_REAL_CALLS === "1",
  providerCallsMade: false,
  nonNvidiaProviderCallsMade: false,
  secretValueExposed: false,
  results,
};

await writeFile(evidencePath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(output), "utf8");
console.log(JSON.stringify(output, null, 2));

function buildScenarios() {
  return {
    phase: "Phase328D",
    scenarios: [
      { scenarioId: "nvidiaInternalBaselineAllowed", providerConfig: { providerId: "nvidia", userOwned: false, enabled: true, realCallsAllowed: true, governanceStage: "internal_test" }, credentialRef: "env_key_name:NVIDIA_API_KEY", request: { mode: "normal" } },
      { scenarioId: "openaiUserOwnedCredentialMissing", providerConfig: { providerId: "openai", userOwned: true, enabled: true, realCallsAllowed: true, governanceStage: "guarded_user_owned_provider_test" }, credentialRef: "", request: { mode: "normal" } },
      { scenarioId: "openaiUserOwnedGuardedRealCallBlockedByFlag", providerConfig: { providerId: "openai", userOwned: true, enabled: true, realCallsAllowed: true, governanceStage: "guarded_user_owned_provider_test" }, credentialRef: "env_key_name:NVIDIA_API_KEY", request: { mode: "normal" } },
      { scenarioId: "openaiUserOwnedCredentialResolverNotReady", providerConfig: { providerId: "openai", userOwned: true, enabled: true, realCallsAllowed: true, governanceStage: "limited_beta" }, credentialRef: "vault_reference:openai-prod", request: { mode: "normal" } },
      { scenarioId: "secretValueRejected", providerConfig: { providerId: "openai", userOwned: true, enabled: true, realCallsAllowed: true, governanceStage: "limited_beta" }, credentialRef: "env_key_name:OPENAI_API_KEY", request: { mode: "normal", secretValue: "forbidden" } },
      { scenarioId: "providerGovernanceRejected", providerConfig: { providerId: "openai", userOwned: true, enabled: true, realCallsAllowed: true, governanceStage: "shadow_config" }, credentialRef: "env_key_name:NVIDIA_API_KEY", request: { mode: "normal" } },
      { scenarioId: "credentialRevoked", providerConfig: { providerId: "openai", userOwned: true, enabled: true, realCallsAllowed: true, governanceStage: "limited_beta" }, credentialRef: "env_key_name:REVOKED_OPENAI_KEY", request: { mode: "normal" } },
      { scenarioId: "providerDisabled", providerConfig: { providerId: "openai", userOwned: true, enabled: false, realCallsAllowed: true, governanceStage: "limited_beta" }, credentialRef: "env_key_name:NVIDIA_API_KEY", request: { mode: "normal" } },
    ],
  };
}

function runScenario(gate, scenario, options) {
  if (scenario.providerConfig.providerId === "nvidia") {
    return {
      scenarioId: scenario.scenarioId,
      status: "baseline_nvidia_reference_only",
      code: "NVIDIA_BASELINE_UNCHANGED",
      providerCallsMade: false,
      nonNvidiaProviderCallsMade: false,
      secretValueExposed: false,
    };
  }
  const result = gate.evaluate({
    providerConfig: scenario.providerConfig,
    request: options.preview ? { ...scenario.request, preview: true } : scenario.request,
    credentialRef: scenario.credentialRef,
  });
  return {
    scenarioId: scenario.scenarioId,
    status: result.allowed ? "allowed_but_not_executed" : "blocked",
    blockedReason: result.allowed ? (options.guardedRealCall ? "guarded_real_call_not_executed_in_phase328d" : "guarded_real_call_flag_not_requested") : result.code,
    code: result.code,
    providerCallsMade: false,
    nonNvidiaProviderCallsMade: false,
    secretValueExposed: false,
    resolution: result.resolution?.safeSummary || null,
  };
}

function renderReport(output) {
  return [
    "# Phase328D User-Owned Provider Guarded Beta Report",
    "",
    `- preview: ${output.preview}`,
    `- guardedRealCallRequested: ${output.guardedRealCallRequested}`,
    `- PHASE328D_GUARDED_REAL_CALLS: ${output.PHASE328D_GUARDED_REAL_CALLS}`,
    `- providerCallsMade: ${output.providerCallsMade}`,
    `- nonNvidiaProviderCallsMade: ${output.nonNvidiaProviderCallsMade}`,
    `- secretValueExposed: ${output.secretValueExposed}`,
    "",
  ].join("\n");
}
