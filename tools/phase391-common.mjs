import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const phase391Title = "Yiyi Commercial Demo Rehearsal Runbook + Operator Checklist";

export const phase391Safety = {
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

export const phase391RunbookSections = [
  "preflight",
  "operator_roles",
  "three_minute_flow",
  "eight_minute_flow",
  "fallback_language",
  "red_team_recovery",
  "closing_language",
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

export function makePhase391Result(extra = {}) {
  return {
    phase: "Phase391",
    title: phase391Title,
    completed: true,
    recommended_sealed: true,
    blocker: null,
    validationsPassed: true,
    phaseType: "commercial_demo_rehearsal_operator_checklist",
    riskLevel: "low",
    ...phase391Safety,
    safety: { ...phase391Safety },
    remainingRisks: [
      "manual_rehearsal_still_required",
      "real_provider_test_not_executed",
      "cross_browser_manual_confirmation_still_recommended",
    ],
    nextRecommendedPhases: [
      {
        phase: "Phase392",
        title: "Yiyi Demo FAQ Pack + Objection Handling Cards",
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
      "Remove Phase391 docs/evidence/tools if the rehearsal process is redesigned.",
      "No provider runtime, chat gateway, deployment, or credential state was changed.",
    ],
    ...extra,
  };
}
