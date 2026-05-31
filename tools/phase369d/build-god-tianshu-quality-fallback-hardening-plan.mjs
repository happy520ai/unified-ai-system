import { writeJson, writeText } from "../phase369-common.mjs";

const taxonomy = {
  phase: "Phase369D",
  failures: [
    "provider_unconfigured",
    "credential_missing",
    "credential_invalid",
    "model_unselectable",
    "quota_exceeded",
    "budget_blocked",
    "participant_selection_failed",
    "supervisor_synthesis_failed",
    "planner_no_candidate",
    "capability_index_missing",
    "timeout",
    "user_policy_blocked",
  ],
};

const result = {
  phase: "Phase369D",
  godModeQualityFallbackPlanGenerated: true,
  tianshuQualityFallbackPlanGenerated: true,
  failureTaxonomyGenerated: true,
  userFacingFallbackCopyGenerated: true,
  runtimeModified: false,
  providerCallMade: false,
  deployExecuted: false,
  secretValueExposed: false,
};

await writeText(
  "docs/phase369d-god-mode-quality-fallback-hardening.md",
  [
    "# Phase369D God Mode Quality Fallback Hardening",
    "",
    "- participant selection failure handling",
    "- model unavailable / credential missing / quota / budget interception",
    "- supervisor synthesis failure handling",
    "- latency-too-high fallback",
    "- fallback to Normal Mode with uncertainty / conflict summary",
  ].join("\n"),
);
await writeText(
  "docs/phase369d-tianshu-quality-fallback-hardening.md",
  [
    "# Phase369D Tianshu Mode Quality Fallback Hardening",
    "",
    "- planner no candidate handling",
    "- capability index missing handling",
    "- provider unconfigured handling",
    "- selected model unavailable handling",
    "- fallback to configuration guidance or Normal Mode",
    "- planner decision explanation to user",
  ].join("\n"),
);
await writeJson("docs/phase369d-three-mode-failure-taxonomy.json", taxonomy);
await writeText(
  "docs/phase369d-god-tianshu-user-facing-fallback-copy.md",
  [
    "# Phase369D God/Tianshu User-facing Fallback Copy",
    "",
    "- 当前模式无法继续完成，请先检查 provider 配置、credentialRef、quota 或 budget 状态。",
    "- 系统已保留当前任务上下文，建议先按引导完成配置，再重试。",
    "- 如果当前多模型协作不可用，系统应明确说明已回退到普通模式或推荐配置路径。",
  ].join("\n"),
);
await writeText(
  "docs/phase369d-execution-report.md",
  [
    "# Phase369D Execution Report",
    "",
    "- failure taxonomy generated",
    "- providerCallMade: false",
  ].join("\n"),
);
await writeJson(
  "apps/ai-gateway-service/evidence/phase369d/god-tianshu-quality-fallback-hardening-result.json",
  result,
);

console.log(JSON.stringify(result, null, 2));
