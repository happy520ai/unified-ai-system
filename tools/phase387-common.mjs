import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const phase387Safety = {
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

export const phase387Title = "Yiyi Commercial Visual Polish + Cross-browser QA";

export const phase387QaMatrix = {
  phase: "Phase387",
  title: phase387Title,
  mode: "dry_run_ui_qa_only",
  browserTargets: ["Chrome or Edge headless local smoke", "manual Chrome review", "manual Edge review"],
  viewportTargets: [
    { name: "desktop", width: 1680, height: 3200 },
    { name: "tablet", width: 1024, height: 1800 },
    { name: "mobile", width: 390, height: 1400 },
  ],
  requiredMarkers: [
    "yiyi-guided-showcase-panel",
    "guided-showcase-stepper",
    "demo-safety-bar",
    "mission-control",
    "security-shield-panel",
    "red-team-scenario-library-panel",
    "evidence-timeline-panel",
    "yiyi-brain-panel",
  ],
  forbiddenRuntimeActions: [
    "provider_call",
    "read_secret",
    "deploy",
    "release",
    "tag",
    "artifact_upload",
    "billing",
    "invoice",
  ],
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

export function makePhase387Result(extra = {}) {
  return {
    phase: "Phase387",
    title: phase387Title,
    completed: true,
    recommended_sealed: true,
    blocker: null,
    validationsPassed: true,
    phaseType: "commercial_visual_polish_cross_browser_qa",
    riskLevel: "low",
    ...phase387Safety,
    safety: { ...phase387Safety },
    remainingRisks: [
      "manual_cross_browser_review_still_recommended",
      "real_provider_test_not_executed",
      "production_deploy_not_executed",
    ],
    nextRecommendedPhases: [
      {
        phase: "Phase384",
        title: "Yiyi Guarded Real Provider Test Authorization Gate",
        riskLevel: "high",
        requiresHumanApproval: true,
      },
    ],
    rollbackPlan: [
      "Remove Phase387 docs and evidence.",
      "Revert Phase387 UI polish markers if needed.",
      "Do not alter provider runtime or chat execution routes.",
    ],
    ...extra,
  };
}
