import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const phase393Title = "Yiyi Demo Localization Copy QA + Terminology Lock";

export const phase393Safety = {
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

export const phase393Terminology = [
  {
    term: "Mission Companion",
    zh: "任务陪伴者",
    usage: "Use for Yiyi's role in the guided commercial demo.",
  },
  {
    term: "Agent-managed AI Mission Control",
    zh: "Agent 管理式 AI 任务总控台",
    usage: "Use for the product category; do not reduce it to a normal chatbot.",
  },
  {
    term: "Guided Showcase",
    zh: "引导式演示",
    usage: "Use for demo flow; do not call it production execution.",
  },
  {
    term: "dry-run",
    zh: "本地预演 / dry-run",
    usage: "Use when describing mock, preview, and no-provider-call states.",
  },
  {
    term: "Evidence Replay",
    zh: "证据回放",
    usage: "Use for trust-building local evidence review.",
  },
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

export function makePhase393Result(extra = {}) {
  return {
    phase: "Phase393",
    title: phase393Title,
    completed: true,
    recommended_sealed: true,
    blocker: null,
    validationsPassed: true,
    phaseType: "commercial_demo_localization_copy_qa",
    riskLevel: "low",
    ...phase393Safety,
    safety: { ...phase393Safety },
    remainingRisks: [
      "manual_localization_review_still_recommended",
      "real_provider_test_not_executed",
      "production_deploy_not_executed",
    ],
    nextRecommendedPhases: [
      {
        phase: "Phase394",
        title: "Yiyi Demo Stakeholder Review Packet + Signoff Checklist",
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
      "Remove Phase393 docs/evidence/tools if terminology changes.",
      "No provider runtime, chat gateway, deployment, or credential state was changed.",
    ],
    ...extra,
  };
}
