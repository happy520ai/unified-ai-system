import { readJson, writeJson, writeText } from "../phase370-common.mjs";

const taxonomy = await readJson("docs/phase369d-three-mode-failure-taxonomy.json");

const uiContract = {
  mode: "tianshu",
  taskSummary: "用户提交一个需要系统自动选择模型或模型组合的任务。",
  plannerStatus: "no_candidate",
  plannerExplanation: {
    decisionBasis: [
      "capability router summary",
      "model selectable status",
      "provider / credentialRef readiness",
      "quota / budget / user policy state",
    ],
    selectedModelRefs: [],
    rejectedCandidates: [
      {
        modelRef: "nvidia/llama-3.3-nemotron-super-49b-v1",
        reason: "credential_missing",
      },
      {
        modelRef: "nvidia/llama-3.1-nemotron-nano-8b-v1",
        reason: "quota_exceeded",
      },
    ],
    capabilityMatch: ["reasoning_chat", "planner_explanation", "fallback_guidance"],
    confidence: "low",
  },
  noCandidateFallback: {
    triggered: true,
    reason: "planner_no_candidate",
    recommendedActions: [
      "配置 provider",
      "切换到 Normal Mode",
      "降低任务复杂度",
      "重试 planner",
      "查看 Model Library",
    ],
  },
  warnings: taxonomy.failures.filter((item) =>
    [
      "planner_no_candidate",
      "provider_unconfigured",
      "credential_missing",
      "quota_exceeded",
      "budget_blocked",
      "user_policy_blocked",
    ].includes(item),
  ),
  safetyNotice: {
    providerCallsMade: false,
    secretValueExposed: false,
    dryRunOnly: true,
  },
};

const result = {
  phase: "Phase370E",
  tianshuPlannerExplanationUiCandidateGenerated: true,
  plannerExplanationCovered: true,
  noCandidateFallbackCovered: true,
  nextActionCovered: true,
  providerCallsMade: false,
  runtimeModified: false,
  chatGatewayModified: false,
  deployExecuted: false,
  secretValueExposed: false,
};

await writeJson("docs/phase370e-tianshu-planner-explanation-ui-contract.json", uiContract);
await writeText(
  "docs/phase370e-tianshu-no-candidate-fallback-ui-candidate.md",
  [
    "# Phase370E Tianshu Planner Explanation UI Candidate",
    "",
    "- 显示用户任务摘要",
    "- 显示 planner decision status",
    "- 显示 capability router summary",
    "- 显示 selected model / rejected candidate reason",
    "- 显示 no-candidate fallback 与 recommended actions",
    "- 显示 provider / credentialRef / quota / budget / policy block 提示",
    "",
    "当前为 dry-run/mock/candidate，不代表真实自动调度已生产启用。",
  ].join("\n"),
);
await writeText(
  "docs/phase370e-tianshu-ui-acceptance-checklist.md",
  [
    "# Phase370E Tianshu UI Acceptance Checklist",
    "",
    "- task summary visible",
    "- planner decision status visible",
    "- capability router summary visible",
    "- selected / rejected candidates visible",
    "- no-candidate fallback visible",
    "- next actions visible",
    "- provider / credentialRef / quota / budget / policy warnings visible",
    "- dry-run/mock/candidate safety notice visible",
  ].join("\n"),
);
await writeText(
  "docs/phase370e-tianshu-ui-gap-closure-report.md",
  [
    "# Phase370E Tianshu UI Gap Closure Report",
    "",
    "- Closed by contract/candidate: planner explanation, rejected candidate reason, no-candidate fallback, next action guidance.",
    "- Deferred to later UI implementation pass: real component integration and manual visual acceptance.",
  ].join("\n"),
);
await writeText(
  "docs/phase370e-execution-report.md",
  [
    "# Phase370E Execution Report",
    "",
    "- ui candidate generated",
    "- providerCallsMade: false",
    "- runtimeModified: false",
  ].join("\n"),
);
await writeJson(
  "apps/agent-console/evidence/phase370e/tianshu-planner-explanation-ui-candidate-result.json",
  result,
);

console.log(JSON.stringify(result, null, 2));
