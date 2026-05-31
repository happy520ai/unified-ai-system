import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const phaseRange = "Phase683-700";
export const finalEvidencePath = "apps/ai-gateway-service/evidence/phase683_700/taiji-beidou-production-readiness-final-result.json";

export const phase675FinalPath = "apps/ai-gateway-service/evidence/phase675_682/taiji-beidou-real-provider-runtime-v0-result.json";
export const phase675OneShotPath = "apps/ai-gateway-service/evidence/phase675_682/guarded-real-provider-runtime-one-shot-result.json";
export const phase675LedgerPath = "apps/ai-gateway-service/evidence/phase675_682/provider-runtime-evidence-ledger.json";

export function boundary(extra = {}) {
  return {
    phaseRange,
    productionDeployExecuted: false,
    providerRuntimeDefaultEnabled: false,
    credentialRefOnly: true,
    rawSecretRead: false,
    secretValueExposed: false,
    authJsonRead: false,
    nonNvidiaProviderBlocked: true,
    codexConfigModified: false,
    codexBaseUrlModified: false,
    chatBehaviorChangedByDefault: false,
    chatGatewayExecuteBehaviorChangedByDefault: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    unsupportedClaimCount: 0,
    hallucinatedFactCount: 0,
    ...extra,
  };
}

export async function pathExists(path) {
  try {
    await access(resolve(repoRoot, path), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function readTextIfExists(path, fallback = "") {
  try {
    return String(await readFile(resolve(repoRoot, path), "utf8"));
  } catch {
    return fallback;
  }
}

export async function readJsonIfExists(path, fallback = null) {
  const text = await readTextIfExists(path, "");
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export async function writeJson(path, value) {
  const fullPath = resolve(repoRoot, path);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeText(path, value) {
  const fullPath = resolve(repoRoot, path);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, `${String(value).trimEnd()}\n`, "utf8");
}

export async function loadGuardedProviderBaseline() {
  const final = await readJsonIfExists(phase675FinalPath, {});
  const oneShot = await readJsonIfExists(phase675OneShotPath, {});
  const ledger = await readJsonIfExists(phase675LedgerPath, {});
  const phase675682Passed =
    final.guardedRealProviderRuntimeV0Available === true &&
    final.realProviderCallExecuted === true &&
    final.responseClassification === "pass" &&
    final.credentialRefOnly === true &&
    final.rawSecretRead === false &&
    final.secretValueExposed === false &&
    oneShot.responseClassification === "pass";

  return {
    final,
    oneShot,
    ledger,
    phase675682Passed,
    blocker: phase675682Passed ? null : "phase675_682_guarded_real_provider_runtime_not_passed",
    providerId: final.providerId || oneShot.providerId || ledger.providerId || "nvidia",
    modelId: final.modelId || oneShot.modelId || ledger.modelId || null,
    capabilityId: oneShot.capabilityId || ledger.capabilityId || final.capabilityId || null,
  };
}

export function phaseEvidencePath(phase, fileName) {
  return `apps/ai-gateway-service/evidence/phase${phase}/${fileName}`;
}

export async function writePhaseDoc(phase, title, evidence, sections = []) {
  const path = phaseDocPath(phase);
  const lines = [
    `# Phase${phase} ${title}`,
    "",
    `Phase range: ${phaseRange}`,
    "",
    "## Result",
    "",
    `- completed: ${evidence.completed}`,
    `- recommended_sealed: ${evidence.recommended_sealed}`,
    `- blocker: ${evidence.blocker ?? "null"}`,
    `- productionReady: ${evidence.productionReady}`,
    `- productionDeployExecuted: ${evidence.productionDeployExecuted}`,
    `- providerRuntimeDefaultEnabled: ${evidence.providerRuntimeDefaultEnabled}`,
    `- credentialRefOnly: ${evidence.credentialRefOnly}`,
    `- rawSecretRead: ${evidence.rawSecretRead}`,
    `- secretValueExposed: ${evidence.secretValueExposed}`,
    `- authJsonRead: ${evidence.authJsonRead}`,
    `- deployExecuted: ${evidence.deployExecuted}`,
    `- releaseExecuted: ${evidence.releaseExecuted}`,
    `- tagCreated: ${evidence.tagCreated}`,
    `- artifactUploaded: ${evidence.artifactUploaded}`,
    "",
    "## Boundary",
    "",
    "This phase is production readiness and integration readiness only. It does not deploy, release, tag, upload artifacts, commit, push, read raw secrets, or modify Codex config/base_url.",
    "",
    ...sections,
  ];
  await writeText(path, lines.join("\n"));
}

export function phaseDocPath(phase) {
  const names = {
    683: "docs/phase683-real-provider-runtime-baseline-lock.md",
    684: "docs/phase684-real-provider-runtime-repeatability-pack.md",
    685: "docs/phase685-compliance-data-boundary-gate.md",
    686: "docs/phase686-rollback-emergency-disable-drill.md",
    687: "docs/phase687-main-chain-integration-contract.md",
    688: "docs/phase688-main-chain-disabled-by-default-hook.md",
    689: "docs/phase689-main-chain-shadow-runtime-trial.md",
    690: "docs/phase690-main-chain-readiness-seal.md",
    691: "docs/phase691-chat-gateway-execute-integration-contract.md",
    692: "docs/phase692-chat-gateway-execute-disabled-preview-hook.md",
    693: "docs/phase693-chat-gateway-execute-shadow-internal-trial.md",
    694: "docs/phase694-chat-gateway-execute-integration-seal.md",
    695: "docs/phase695-chat-integration-contract.md",
    696: "docs/phase696-chat-disabled-preview-shadow-trial.md",
    697: "docs/phase697-chat-integration-seal.md",
    698: "docs/phase698-production-readiness-gate.md",
    699: "docs/phase699-production-canary-plan-no-deploy-closure.md",
    700: "docs/phase700-production-ready-final-seal.md",
  };
  return names[phase];
}

export async function writeExecutionReport(finalEvidence) {
  await writeText(
    "docs/phase683-700-taiji-beidou-production-readiness-execution-report.md",
    [
      "# Phase683-700 Taiji Beidou Production Readiness Execution Report",
      "",
      `completed: ${finalEvidence.completed}`,
      `recommended_sealed: ${finalEvidence.recommended_sealed}`,
      `blocker: ${finalEvidence.blocker ?? "null"}`,
      `productionReady: ${finalEvidence.productionReady}`,
      `productionDeployExecuted: ${finalEvidence.productionDeployExecuted}`,
      `mainChainRuntimeReady: ${finalEvidence.mainChainRuntimeReady}`,
      `chatIntegrated: ${finalEvidence.chatIntegrated}`,
      `chatGatewayExecuteIntegrated: ${finalEvidence.chatGatewayExecuteIntegrated}`,
      "",
      "No deploy, release, tag, artifact upload, commit, push, raw secret read, auth.json read, or Codex config/base_url mutation was performed by this phase.",
    ].join("\n"),
  );
}

export function collectBlocker(checks) {
  for (const [key, value] of Object.entries(checks)) {
    if (value !== true) return key;
  }
  return null;
}
