import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const phase389Title = "Yiyi Mobile Demo Adaptation + Presenter Notes";

export const phase389Safety = {
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

export const phase389MobileReviewTargets = [
  {
    viewport: "390x844",
    label: "iPhone compact portrait",
    reviewFocus: "Guided showcase remains readable, stepper controls stay reachable, and Yiyi does not cover the safety bar.",
  },
  {
    viewport: "430x932",
    label: "large phone portrait",
    reviewFocus: "Mission Control overview keeps the first-step narrative visible without implying production execution.",
  },
  {
    viewport: "768x1024",
    label: "tablet portrait",
    reviewFocus: "Presenter can scan mode summary, Security Shield, Evidence Replay, and Yiyi Brain status in one recording pass.",
  },
];

export const phase389PresenterSections = [
  "opening",
  "normal_mode",
  "god_mode",
  "tianshu_mode",
  "security_shield",
  "red_team",
  "evidence_replay",
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

export function makePhase389Result(extra = {}) {
  return {
    phase: "Phase389",
    title: phase389Title,
    completed: true,
    recommended_sealed: true,
    blocker: null,
    validationsPassed: true,
    phaseType: "mobile_demo_adaptation_presenter_notes",
    riskLevel: "low",
    ...phase389Safety,
    safety: { ...phase389Safety },
    remainingRisks: [
      "manual_mobile_browser_review_still_required",
      "real_provider_test_not_executed",
      "sales_delivery_rehearsal_still_recommended",
    ],
    nextRecommendedPhases: [
      {
        phase: "Phase390",
        title: "Yiyi Commercial Demo Final QA Index + Sales Handoff Pack",
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
      "Remove Phase389 docs/evidence/tools if mobile demo notes need to be redesigned.",
      "No provider runtime, chat gateway, deployment, or credential state was changed.",
    ],
    ...extra,
  };
}
