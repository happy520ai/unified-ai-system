import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const phase392Title = "Yiyi Demo FAQ Pack + Objection Handling Cards";

export const phase392Safety = {
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

export const phase392FaqTopics = [
  "what_is_yiyi",
  "why_not普通_chatbot",
  "normal_god_tianshu_difference",
  "security_shield_value",
  "red_team_playground_value",
  "evidence_replay_value",
  "why_model_brain_disabled",
  "when_real_provider_test",
  "is_this_production_ga",
  "what_still_needs_review",
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

export function makePhase392Result(extra = {}) {
  return {
    phase: "Phase392",
    title: phase392Title,
    completed: true,
    recommended_sealed: true,
    blocker: null,
    validationsPassed: true,
    phaseType: "commercial_demo_faq_objection_pack",
    riskLevel: "low",
    ...phase392Safety,
    safety: { ...phase392Safety },
    remainingRisks: [
      "manual_sales_rehearsal_still_recommended",
      "real_provider_test_not_executed",
      "production_deploy_not_executed",
    ],
    nextRecommendedPhases: [
      {
        phase: "Phase393",
        title: "Yiyi Demo Localization Copy QA + Terminology Lock",
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
      "Remove Phase392 docs/evidence/tools if the FAQ pack needs to be rewritten.",
      "No provider runtime, chat gateway, deployment, or credential state was changed.",
    ],
    ...extra,
  };
}
