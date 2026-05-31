import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const phase388Title = "Yiyi Demo Recording Asset Pack + Manual Browser Review Closure";

export const phase388Safety = {
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

export const phase388ShotPlan = [
  "overview",
  "welcome",
  "normal",
  "god",
  "tianshu",
  "security",
  "redteam",
  "evidence",
  "brain_status",
  "closing",
];

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

export function fileInfo(path) {
  const target = resolve(path);
  return {
    path,
    exists: existsSync(target),
    sizeBytes: existsSync(target) ? statSync(target).size : 0,
  };
}

export function makePhase388Result(extra = {}) {
  return {
    phase: "Phase388",
    title: phase388Title,
    completed: true,
    recommended_sealed: true,
    blocker: null,
    validationsPassed: true,
    phaseType: "demo_recording_asset_manual_browser_review",
    riskLevel: "low",
    ...phase388Safety,
    safety: { ...phase388Safety },
    remainingRisks: [
      "manual_recording_capture_still_required",
      "human_visual_review_still_recommended",
      "real_provider_test_not_executed",
    ],
    nextRecommendedPhases: [
      {
        phase: "Phase389",
        title: "Yiyi Mobile Demo Adaptation + Presenter Notes",
        riskLevel: "low",
        requiresHumanApproval: false,
      },
      {
        phase: "Phase384",
        title: "Yiyi Guarded Real Provider Test Authorization Gate",
        riskLevel: "high",
        requiresHumanApproval: true,
      },
    ],
    rollbackPlan: [
      "Remove Phase388 docs/evidence/tools if the recording package direction changes.",
      "No provider runtime, chat gateway, deployment, or credential state was changed.",
    ],
    ...extra,
  };
}
