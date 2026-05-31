export const scenarioTrialCopy = {
  title: "Try a sample task",
  titleZh: "试用一个任务",
  subtitle:
    "Run one sample task through the Mission Control dry-run path: mode choice, Security Shield, Provider boundary, and Evidence Replay.",
  subtitleZh: "用一个 sample task 走完整条 Mission Control dry-run：模式判断、安全检查、Provider 边界和 Evidence Replay。",
  sampleTaskTitle: "Sample task",
  sampleTask:
    "Help me decide whether a complex request should use Normal, God, or Tianshu, and explain why.",
  dryRunNotice:
    "Local dry-run preview only: no-provider-call, no-secret, no-deploy, no-billing, no-invoice, no API Key required.",
  actions: {
    start: "Start sample dry-run",
    startZh: "开始 sample dry-run",
    modes: "View mode decision",
    modesZh: "查看三模式如何判断",
    shield: "View Security Shield",
    shieldZh: "查看安全盾",
    evidence: "View Evidence Replay",
    evidenceZh: "查看 Evidence Replay",
  },
  resultTitle: "Sample dry-run result",
  resultHiddenNotice: "Click Start sample dry-run to show the dry-run result chain.",
  boundaryBadges: [
    "dry-run",
    "preview",
    "sample task",
    "no-provider-call",
    "no-secret",
    "no-deploy",
    "no-billing",
    "no-invoice",
  ],
  steps: [
    {
      title: "Step 1: User task",
      body: "The user wants to know which mode should handle a complex request.",
    },
    {
      title: "Step 2: Mission Understanding",
      body: "Mission Control treats this as a route-planning question, not a real provider task.",
    },
    {
      title: "Step 3: Recommended Mode",
      body: "Recommended: Tianshu. The task needs planning, decomposition, model-combination advice, and an execution route.",
    },
    {
      title: "Step 4: Security Shield",
      body: "Decision: guarded. The sample does not call a provider, read secrets, deploy, bill, or generate invoices.",
    },
    {
      title: "Step 5: Provider / CredentialRef",
      body: "CredentialRef-only boundary. This sample does not need an API Key and does not pretend a real provider is connected.",
    },
    {
      title: "Step 6: Evidence Replay",
      body: "A local sample trace is shown: intent -> mode recommendation -> guard -> provider boundary -> replay.",
    },
    {
      title: "Step 7: Next Step",
      body: "Use Normal for simple tasks, God for multi-model review, and Tianshu for planning a route first.",
    },
  ],
  modeExplainers: {
    normal: "Normal: single-model direct response for simple, clear, low-risk tasks.",
    god: "God: multi-model review with reviewer, critic, and supervisor style checking.",
    tianshu: "Tianshu: task planning for decomposition, model-combination advice, and execution route selection.",
  },
  evidencePreview:
    "Evidence Replay preview: trace=sample-task -> mission-understanding -> tianshu-recommendation -> security-guarded -> provider-skipped; local only; no external upload.",
};
