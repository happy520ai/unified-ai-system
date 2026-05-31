import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const phase384Safety = {
  providerCallsMade: false,
  nonNvidiaProviderCallsMade: false,
  secretValueExposed: false,
  rawSecretAccessed: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  approvalForged: false,
  billingExecuted: false,
  invoiceGenerated: false,
  productionGaClaimed: false,
  workspaceCleanClaimed: false,
};

export const phase384Title = "Yiyi Guarded Real Provider Test Authorization Gate";

export function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

export async function readText(path) {
  return readFile(resolve(path), "utf8");
}

export async function writeText(path, value) {
  const target = resolve(path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, value.endsWith("\n") ? value : `${value}\n`, "utf8");
}

export async function writeJson(path, value) {
  await writeText(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function makePhase384Result(extra = {}) {
  return {
    phase: "Phase384",
    title: phase384Title,
    phaseType: "guarded_real_provider_test_authorization_gate",
    riskLevel: "high",
    completed: false,
    recommended_sealed: false,
    validationsPassed: true,
    blocker: "specific_provider_test_authorization_required",
    humanAuthorizationToEnterRecorded: true,
    realProviderTestExecuted: false,
    modelBrainEnabledByDefault: false,
    safety: { ...phase384Safety },
    ...phase384Safety,
    remainingRisks: [
      "specific_provider_ref_not_authorized",
      "specific_credential_ref_not_authorized",
      "specific_model_ref_not_authorized",
      "max_requests_not_authorized",
      "cost_limit_not_authorized",
      "real_provider_test_not_executed",
    ],
    nextRecommendedPhases: [
      {
        phase: "Phase388",
        title: "Yiyi Demo Recording Asset Pack + Manual Browser Review Closure",
        riskLevel: "low",
        requiresHumanApproval: false,
      },
    ],
    rollbackPlan: [
      "Remove Phase384 authorization gate docs/evidence if the user withdraws authorization.",
      "No provider runtime state was changed.",
      "No credential or raw secret was read.",
    ],
    ...extra,
  };
}
