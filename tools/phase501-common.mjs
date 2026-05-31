import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const phaseTitle = "Yiyi Demo Controlled Commercial Notes";
export const phaseNumber = 501;
export const phaseName = "Phase501";
export const phaseSlug = "controlled-commercial-notes";
export const phaseType = "commercial_demo_controlled_commercial_notes";
export const phaseDeliverables = [
  "controlledCommercialNotesCreated",
  "commercialNotesChecklistCreated"
];
export const phaseSafety = {
  "providerCallsMade": false,
  "nonNvidiaProviderCallsMade": false,
  "secretValueExposed": false,
  "rawSecretAccessed": false,
  "deployExecuted": false,
  "releaseExecuted": false,
  "tagCreated": false,
  "artifactUploaded": false,
  "approvalForged": false,
  "billingExecuted": false,
  "invoiceGenerated": false,
  "productionGaClaimed": false,
  "workspaceCleanClaimed": false
};

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

export function makeResult(extra = {}) {
  return {
    phase: phaseName,
    title: phaseTitle,
    completed: true,
    recommended_sealed: true,
    blocker: null,
    validationsPassed: true,
    phaseType,
    riskLevel: "low",
    ...phaseSafety,
    safety: { ...phaseSafety },
    remainingRisks: [
      "manual_review_still_recommended",
      "real_provider_test_not_executed",
      "production_deploy_not_executed"
    ],
    nextRecommendedPhases: [
      {
        phase: "Phase502",
        title: "Yiyi Demo Low-risk Continuation Index",
        riskLevel: "low",
        requiresHumanApproval: false
      },
      {
        phase: "Phase384",
        title: "Yiyi Guarded Real Provider Test Authorization Gate",
        riskLevel: "high",
        requiresHumanApproval: true
      }
    ],
    rollbackPlan: [
      `Remove ${phaseName} docs/evidence/tools if this low-risk package needs to be regenerated.`,
      "No provider runtime, chat gateway, deployment, billing, or credential state was changed."
    ],
    ...extra
  };
}
