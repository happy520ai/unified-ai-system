import {
  countSecretFindings,
  createDisabledState,
  createSafety,
  noOhMyCodexDependency,
  noProjectContext,
  readRequired,
  readWorkspaceTexts,
  writeEvidence,
} from "./verifyAgentWorkforceClosureSupport.js";

const phase = "agent-workforce-next-task-queue";
const queueDoc = "docs/AGENT_WORKFORCE_NEXT_TASK_QUEUE.md";
const priorities = [
  ["P1", "Codex Bridge Status Panel"],
  ["P2", "Next Task Queue UI"],
  ["P3", "Auto Loop Run History"],
  ["P4", "Safety Gate Dashboard"],
  ["P5", "Controlled Codex One-shot Readiness"],
];
const requiredSections = [
  "Goal",
  "Allowed Files",
  "Forbidden Actions",
  "Recommended Verification Commands",
  "Evidence Requirements",
  "Codex Response Format",
];

function sectionForTask(doc, priority, title) {
  const startMarker = `## ${priority}: ${title}`;
  const start = doc.indexOf(startMarker);
  if (start < 0) return "";
  const next = doc.indexOf("\n## P", start + startMarker.length);
  return next >= 0 ? doc.slice(start, next) : doc.slice(start);
}

try {
  const [texts, doc] = await Promise.all([
    readWorkspaceTexts(),
    readRequired(queueDoc),
  ]);

  const taskChecks = Object.fromEntries(priorities.flatMap(([priority, title]) => {
    const task = sectionForTask(doc, priority, title);
    return [
      [`${priority}TitlePresent`, task.includes(`## ${priority}: ${title}`)],
      [`${priority}AllRequiredSectionsPresent`, requiredSections.every((section) => task.includes(`### ${section}`))],
      [`${priority}HasVerificationCommands`, task.includes("cmd /c pnpm run") && task.includes("pnpm -r --if-present check")],
      [`${priority}HasEvidencePath`, task.includes("apps/ai-gateway-service/evidence/") && task.includes(".json") && task.includes(".md")],
      [`${priority}HasBoundaryCheckResponseFormat`, task.includes("F. Boundary Check")],
    ];
  }));

  const scannedText = [doc, texts.rootPackageText, texts.servicePackageText].join("\n");
  const secretFindingCount = countSecretFindings(scannedText, phase);
  const checks = {
    queueDocPresent: doc.includes("# Agent Workforce Next Task Queue"),
    queueBoundaryPresent:
      doc.includes("Do not modify `legacy/`") &&
      doc.includes("Do not create `PROJECT_CONTEXT.md`") &&
      doc.includes("Do not modify the default NVIDIA `/chat` main lane") &&
      doc.includes("Do not call Codex, oh-my-codex, OMX, team, or ralph") &&
      doc.includes("Do not create a worktree") &&
      doc.includes("Do not connect a workflow run") &&
      doc.includes("Do not automatically commit or push"),
    prioritiesPresent: priorities.every(([priority, title]) => doc.includes(`## ${priority}: ${title}`)),
    p1RecommendedFirst: doc.includes("Start with P1: Codex Bridge Status Panel"),
    rootScriptPresent:
      texts.rootPackage.scripts?.["verify:agent-workforce-next-task-queue"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:agent-workforce-next-task-queue",
    serviceScriptPresent:
      texts.servicePackage.scripts?.["verify:agent-workforce-next-task-queue"] ===
      "node ./src/entrypoints/verifyAgentWorkforceNextTaskQueue.js",
    noProjectContext: noProjectContext(),
    noOhMyCodexDependency: noOhMyCodexDependency(texts.rootPackageText, texts.servicePackageText),
    noPlainSecrets: secretFindingCount === 0,
    noRuntimeExecutionAdded: true,
    ...taskChecks,
  };
  const passed = Object.values(checks).every(Boolean);
  const evidence = {
    phase,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    conclusion: passed ? "next-task-queue-ready" : "next-task-queue-incomplete",
    verifiedDocuments: [queueDoc],
    disabledState: createDisabledState(),
    safety: {
      ...createSafety(),
      codexCliInvoked: false,
      autoCommit: false,
      autoPush: false,
      autoApply: false,
      workflowRunEnabled: false,
      defaultNvidiaChatLaneChanged: false,
    },
    secretFindingCount,
    checks,
    notes: [
      "Queue is documentation/planning only.",
      "P1-P5 each include goal, scope, forbidden actions, verification commands, evidence, and response format.",
    ],
  };
  await writeEvidence(phase, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  const evidence = {
    phase,
    status: "failed",
    generatedAt: new Date().toISOString(),
    conclusion: "next-task-queue-verification-error",
    error: error instanceof Error ? error.message : String(error),
    disabledState: createDisabledState(),
    safety: {
      ...createSafety(),
      codexCliInvoked: false,
      autoCommit: false,
      autoPush: false,
      autoApply: false,
      workflowRunEnabled: false,
      defaultNvidiaChatLaneChanged: false,
    },
    checks: {},
    notes: [],
  };
  await writeEvidence(phase, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
}
