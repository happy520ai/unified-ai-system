import { readJson, writeJson, writeText } from "../phase370-common.mjs";

const taxonomy = await readJson("docs/phase369d-three-mode-failure-taxonomy.json");

const uiContract = {
  mode: "god",
  status: "dry_run",
  participants: [
    {
      modelRef: "nvidia/llama-3.3-nemotron-super-49b-v1",
      status: "ready",
      critiqueSummary: "候选参与者可审阅答案，但当前仅为 mock/dry-run 展示。",
    },
    {
      modelRef: "nvidia/llama-3.1-nemotron-nano-8b-v1",
      status: "partial",
      unavailableReason: "participant_selection_failed",
      critiqueSummary: "参与者选择结果可展示，但不代表真实多 provider 已启用。",
    },
  ],
  conflictSummary: {
    hasConflict: true,
    conflictLevel: "medium",
    summary: "两个参与者在答案细节完整度和风险提示强度上存在分歧。",
    disagreementPoints: [
      "是否需要更强的风险提示",
      "是否需要回退到更保守的回复策略",
    ],
  },
  supervisorTransparency: {
    supervisorModelRef: "supervisor/dry-run",
    synthesisStatus: "completed",
    decisionBasis: [
      "reviewer critique summary",
      "participant availability state",
      "fallback policy boundary",
    ],
    uncertainty: "当前结果为 dry-run/mock，不代表真实多 provider 共识已经执行。",
    fallbackUsed: true,
    fallbackReason: "participant_selection_failed",
  },
  warnings: taxonomy.failures.filter((item) =>
    [
      "participant_selection_failed",
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
  phase: "Phase370D",
  godModeTransparencyUiCandidateGenerated: true,
  conflictSummaryCovered: true,
  supervisorTransparencyCovered: true,
  fallbackReasonCovered: true,
  providerCallsMade: false,
  runtimeModified: false,
  chatGatewayModified: false,
  deployExecuted: false,
  secretValueExposed: false,
};

await writeJson("docs/phase370d-god-mode-conflict-summary-ui-contract.json", uiContract);
await writeText(
  "docs/phase370d-god-mode-supervisor-transparency-ui-candidate.md",
  [
    "# Phase370D God Mode Supervisor Transparency UI Candidate",
    "",
    "- 显示 God Mode 当前状态与 dry-run/mock 提示",
    "- 显示 participant selection summary 与 unavailable reason",
    "- 显示 reviewer vote / critique summary",
    "- 显示 conflict summary、consensus/disagreement 标签",
    "- 显示 supervisor synthesis status、decision basis、uncertainty、fallback reason",
    "- 显示 unsafe / blocked / quota / credentialRef warning",
    "",
    "当前为 dry-run/mock/candidate，不代表真实多 Provider 已启用。",
  ].join("\n"),
);
await writeText(
  "docs/phase370d-god-mode-ui-acceptance-checklist.md",
  [
    "# Phase370D God Mode UI Acceptance Checklist",
    "",
    "- God Mode current status visible",
    "- participant selection summary visible",
    "- participant unavailable reason visible",
    "- reviewer critique summary visible",
    "- conflict summary visible",
    "- consensus / disagreement label visible",
    "- supervisor synthesis status visible",
    "- supervisor final answer explanation visible",
    "- fallback reason visible",
    "- unsafe / blocked / quota / credentialRef warning visible",
    "- dry-run/mock/candidate safety notice visible",
  ].join("\n"),
);
await writeText(
  "docs/phase370d-god-mode-ui-gap-closure-report.md",
  [
    "# Phase370D God Mode UI Gap Closure Report",
    "",
    "- Closed by contract/candidate: conflict summary, supervisor transparency, fallback reason, safety notice.",
    "- Deferred to later UI implementation pass: real component integration and manual visual acceptance.",
  ].join("\n"),
);
await writeText(
  "docs/phase370d-execution-report.md",
  [
    "# Phase370D Execution Report",
    "",
    "- ui candidate generated",
    "- providerCallsMade: false",
    "- runtimeModified: false",
  ].join("\n"),
);
await writeJson(
  "apps/agent-console/evidence/phase370d/god-mode-transparency-ui-candidate-result.json",
  result,
);

console.log(JSON.stringify(result, null, 2));
