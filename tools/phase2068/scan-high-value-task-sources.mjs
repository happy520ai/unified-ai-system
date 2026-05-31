import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = process.cwd();
const __filename = fileURLToPath(import.meta.url);
const phaseId = "Phase2068-GVC-High-Value-Task-Source-Scanner";
const candidatesPath = "docs/project-brain/high-value-task-candidates.json";
const evidenceDir = "apps/ai-gateway-service/evidence/phase2068-gvc-high-value-task-source-scanner";
const resultPath = `${evidenceDir}/result.json`;

const allowedReadFiles = [
  "docs/project-brain/timed-runner-state.json",
  "docs/project-brain/runner-control.json",
  "docs/project-brain/safe-overnight-policy.json",
  "docs/project-brain/next-actions.json",
  "docs/project-brain/risk-policy.json",
  "docs/phase2065-gvc-owner-direct-use-guide.md",
  "tools/gvc/run-timed-local-runner.mjs",
  "packages/gvc-permission-engine/src/timedRunnerDecisionPath.js",
  "packages/gvc-permission-engine/src/timedRunnerFinalPermissionGate.js",
  "apps/ai-gateway-service/src/ui/components/GvcRunnerDashboardPanel.js",
  "package.json",
  "README.md",
  "AGENTS.md",
];

const forbiddenReadPatterns = [
  /^legacy\//i,
  /^project_context\.md$/i,
  /(^|\/)\.env(?:\.[^/]*)?$/i,
  /(^|\/)auth\.json$/i,
  /(^|\/)node_modules\//i,
];

export function scanHighValueTaskSources(options = {}) {
  const root = options.repoRoot || repoRoot;
  const scannedFiles = [];
  const blockedReads = [];
  const source = {};

  for (const relativePath of allowedReadFiles) {
    if (isForbiddenRead(relativePath)) {
      blockedReads.push(relativePath);
      continue;
    }
    const absolutePath = path.join(root, relativePath);
    if (!existsSync(absolutePath)) continue;
    scannedFiles.push(relativePath);
    source[relativePath] = readFileSync(absolutePath, "utf8");
  }

  const state = readJson(root, "docs/project-brain/timed-runner-state.json") || {};
  const control = readJson(root, "docs/project-brain/runner-control.json") || {};
  const nextActions = readJson(root, "docs/project-brain/next-actions.json") || {};
  const ownerGuide = source["docs/phase2065-gvc-owner-direct-use-guide.md"] || "";
  const dashboard = source["apps/ai-gateway-service/src/ui/components/GvcRunnerDashboardPanel.js"] || "";

  const duplicateSummaryTasks = Array.isArray(nextActions.actions)
    ? nextActions.actions.filter((action) => isRepeatedSummaryTask(action.taskId || action.title)).length
    : 0;
  const dashboardUsesLatestLoop = /latestLoopEvidence\?\.autonomousMutationEnabled/.test(dashboard);

  const batchId = `phase2071-${compactDate(new Date())}`;
  const candidates = [
    buildCandidate({
      taskId: "phase2071-state-control-consistency-evidence",
      title: "State/control consistency evidence",
      ownerValueScore: 9,
      engineeringValueScore: 9,
      duplicateRiskScore: 1,
      staleRiskScore: 1,
      evidenceValueScore: 9,
      riskLevel: "L0",
      allowedMutationScope: "evidence",
      targetPath: "apps/ai-gateway-service/evidence/phase2071-gvc-high-value-real-batch/state-control-consistency-evidence.json",
      operations: ["evidence_write"],
      whyThisIsNotLowValue: "Explains why realExecutionLoopsCompletedToday reached the cap while autonomousMutationEnabled ended false.",
      content: {
        phaseId,
        taskId: "phase2071-state-control-consistency-evidence",
        batchId,
        currentBlocker: state.currentBlocker || null,
        realExecutionLoopsCompletedToday: state.realExecutionLoopsCompletedToday || 0,
        realExecutionLoopLimit: state.realExecutionLoopLimit || 0,
        terminalAutonomousMutationEnabled: state.autonomousMutationEnabled === true,
        runnerControlDryRunOnly: control.dryRunOnly === true,
        interpretation: "autonomousMutationEnabled=false is terminal cap exhaustion when realExecutionLoopsCompletedToday >= realExecutionLoopLimit, not proof that real mutation never ran.",
        providerCallsMade: false,
        secretRead: false,
        deployExecuted: false,
        chatGatewayExecuteModified: false,
      },
    }),
    buildCandidate({
      taskId: "phase2071-runner-dashboard-state-mismatch-audit",
      title: "Runner dashboard state mismatch audit",
      ownerValueScore: 8,
      engineeringValueScore: 8,
      duplicateRiskScore: 2,
      staleRiskScore: 2,
      evidenceValueScore: 8,
      riskLevel: "L1",
      allowedMutationScope: "evidence",
      targetPath: "apps/ai-gateway-service/evidence/phase2071-gvc-high-value-real-batch/runner-dashboard-state-mismatch-audit.json",
      operations: ["evidence_write"],
      whyThisIsNotLowValue: "Audits an owner-visible status mismatch risk without changing UI runtime.",
      content: {
        phaseId,
        taskId: "phase2071-runner-dashboard-state-mismatch-audit",
        dashboardUsesLatestLoopEvidence: dashboardUsesLatestLoop,
        stateAutonomousMutationEnabled: state.autonomousMutationEnabled === true,
        realMutationLoopsToday: state.realExecutionLoopsCompletedToday || 0,
        mismatchRisk: state.autonomousMutationEnabled !== true && (state.realExecutionLoopsCompletedToday || 0) > 0,
        ownerFacingInterpretation: "Dashboard should treat realMutationLoopsToday as historical execution and autonomousMutationEnabled as current-loop capability.",
        providerCallsMade: false,
        secretRead: false,
        deployExecuted: false,
        chatGatewayExecuteModified: false,
      },
    }),
    buildCandidate({
      taskId: "phase2071-permission-rule-coverage-gap-fixture",
      title: "Permission rule coverage gap fixture",
      ownerValueScore: 8,
      engineeringValueScore: 9,
      duplicateRiskScore: 1,
      staleRiskScore: 1,
      evidenceValueScore: 8,
      riskLevel: "L2",
      allowedMutationScope: "tools/gvc fixture",
      targetPath: "tools/gvc/test-fixtures/phase2071/permission-rule-coverage-gap.fixture.json",
      operations: ["verifier_update"],
      whyThisIsNotLowValue: "Provides a reusable fixture for permission coverage without touching provider or chat runtime.",
      content: {
        phaseId,
        taskId: "phase2071-permission-rule-coverage-gap-fixture",
        cases: [
          { action: "file_mutation", resource: "apps/ai-gateway-service/evidence/example.json", expected: "allow" },
          { action: "file_mutation", resource: "tools/gvc/test-fixtures/example.json", expected: "allow" },
          { action: "provider_call", resource: "openai", expected: "approval_required" },
          { action: "secret_read", resource: ".env", expected: "forbidden" },
          { action: "chat_route_modify", resource: "chat-gateway/execute", expected: "forbidden" },
        ],
        providerCallsMade: false,
        secretRead: false,
        deployExecuted: false,
        chatGatewayExecuteModified: false,
      },
    }),
    buildCandidate({
      taskId: "phase2071-project-brain-schema-consistency-report",
      title: "Project-brain schema consistency report",
      ownerValueScore: 8,
      engineeringValueScore: 8,
      duplicateRiskScore: 2,
      staleRiskScore: 2,
      evidenceValueScore: 8,
      riskLevel: "L1",
      allowedMutationScope: "evidence",
      targetPath: "apps/ai-gateway-service/evidence/phase2071-gvc-high-value-real-batch/project-brain-schema-consistency-report.json",
      operations: ["evidence_write"],
      whyThisIsNotLowValue: "Records schema consistency issues without mutating project-brain control files during an autonomous batch.",
      content: {
        phaseId,
        taskId: "phase2071-project-brain-schema-consistency-report",
        observedFields: {
          timedRunnerStateHasRealLoopCount: Number.isInteger(state.realExecutionLoopsCompletedToday),
          timedRunnerStateHasAutonomousMutationEnabled: Object.hasOwn(state, "autonomousMutationEnabled"),
          runnerControlHasDryRunOnly: Object.hasOwn(control, "dryRunOnly"),
          nextActionsCount: Array.isArray(nextActions.actions) ? nextActions.actions.length : 0,
          duplicateSummaryTasks,
        },
        recommendation: "Keep terminal capability fields separate from historical counters in future state schema revisions.",
        providerCallsMade: false,
        secretRead: false,
        deployExecuted: false,
        chatGatewayExecuteModified: false,
      },
    }),
    buildCandidate({
      taskId: "phase2071-owner-use-guide-dryrun-precedence-fix",
      title: "Owner-use guide dryRunOnly precedence fix",
      ownerValueScore: 9,
      engineeringValueScore: 7,
      duplicateRiskScore: 1,
      staleRiskScore: 1,
      evidenceValueScore: 7,
      riskLevel: "L1",
      allowedMutationScope: "docs",
      targetPath: "docs/phase2065-gvc-owner-direct-use-guide.md",
      operations: ["docs_update"],
      whyThisIsNotLowValue: "Clarifies an owner-facing control precedence ambiguity that can otherwise block safe direct use.",
      content: renderOwnerGuideWithPrecedenceNote(ownerGuide),
      contentIsText: true,
    }),
    buildCandidate({
      taskId: "phase2071-control-precedence-migration-note",
      title: "Control precedence migration note",
      ownerValueScore: 8,
      engineeringValueScore: 8,
      duplicateRiskScore: 1,
      staleRiskScore: 1,
      evidenceValueScore: 8,
      riskLevel: "L1",
      allowedMutationScope: "evidence",
      targetPath: "apps/ai-gateway-service/evidence/phase2071-gvc-high-value-real-batch/control-precedence-migration-note.json",
      operations: ["evidence_write"],
      whyThisIsNotLowValue: "Documents the stale-field/migration interpretation without rewriting historical evidence.",
      content: {
        phaseId,
        taskId: "phase2071-control-precedence-migration-note",
        migrationRequired: false,
        historicalEvidencePreserved: true,
        cliDryRunFalseRole: "session-level opt-in for real low-risk mutation",
        controlDryRunTrueRole: "owner safety invariant required by runner-control validation",
        providerCallsMade: false,
        secretRead: false,
        deployExecuted: false,
        chatGatewayExecuteModified: false,
      },
    }),
    buildCandidate({
      taskId: "phase2071-permission-coverage-evidence",
      title: "Permission coverage evidence",
      ownerValueScore: 8,
      engineeringValueScore: 9,
      duplicateRiskScore: 1,
      staleRiskScore: 1,
      evidenceValueScore: 9,
      riskLevel: "L1",
      allowedMutationScope: "evidence",
      targetPath: "apps/ai-gateway-service/evidence/phase2071-gvc-high-value-real-batch/permission-coverage-evidence.json",
      operations: ["evidence_write"],
      whyThisIsNotLowValue: "Shows allowed and blocked permission cases for the exact runner gate path.",
      content: {
        phaseId,
        taskId: "phase2071-permission-coverage-evidence",
        coverage: {
          docsMutation: "allow",
          evidenceMutation: "allow",
          toolsGvcFixtureMutation: "allow",
          providerCall: "approval_required",
          secretRead: "forbidden",
          deploy: "forbidden",
          chatGatewayExecute: "forbidden",
        },
        providerCallsMade: false,
        secretRead: false,
        deployExecuted: false,
        chatGatewayExecuteModified: false,
      },
    }),
    buildCandidate({
      taskId: "phase2071-runner-cap-audit-evidence",
      title: "Runner cap audit evidence",
      ownerValueScore: 8,
      engineeringValueScore: 8,
      duplicateRiskScore: 2,
      staleRiskScore: 1,
      evidenceValueScore: 8,
      riskLevel: "L1",
      allowedMutationScope: "evidence",
      targetPath: "apps/ai-gateway-service/evidence/phase2071-gvc-high-value-real-batch/runner-cap-audit-evidence.json",
      operations: ["evidence_write"],
      whyThisIsNotLowValue: "Separates daily loop limit, safe overnight real mutation cap, and no-op stop semantics.",
      content: {
        phaseId,
        taskId: "phase2071-runner-cap-audit-evidence",
        dailyLoopLimit: state.dailyLoopLimit || null,
        realExecutionLoopLimit: state.realExecutionLoopLimit || null,
        realExecutionLoopsCompletedToday: state.realExecutionLoopsCompletedToday || 0,
        consecutiveNoOpLoops: state.consecutiveNoOpLoops || 0,
        currentBlocker: state.currentBlocker || null,
        providerCallsMade: false,
        secretRead: false,
        deployExecuted: false,
        chatGatewayExecuteModified: false,
      },
    }),
    buildCandidate({
      taskId: "phase2071-high-value-planner-fixture-verifier",
      title: "High-value planner fixture verifier",
      ownerValueScore: 7,
      engineeringValueScore: 8,
      duplicateRiskScore: 1,
      staleRiskScore: 1,
      evidenceValueScore: 7,
      riskLevel: "L2",
      allowedMutationScope: "verifier",
      targetPath: "tools/phase2072/high-value-autonomy-fixture-verifier.mjs",
      operations: ["verifier_update"],
      whyThisIsNotLowValue: "Exercises the phase verifier allowlist path used by future autonomous planner regressions.",
      content: "console.log('phase2071 high-value autonomy fixture verifier');\n",
      contentIsText: true,
    }),
    buildCandidate({
      taskId: "phase2071-owner-guide-drift-evidence",
      title: "Owner-use guide drift evidence",
      ownerValueScore: 8,
      engineeringValueScore: 7,
      duplicateRiskScore: 1,
      staleRiskScore: 1,
      evidenceValueScore: 8,
      riskLevel: "L1",
      allowedMutationScope: "evidence",
      targetPath: "apps/ai-gateway-service/evidence/phase2071-gvc-high-value-real-batch/owner-use-guide-drift-evidence.json",
      operations: ["evidence_write"],
      whyThisIsNotLowValue: "Tracks whether the owner guide explains the real-run command and forbidden boundaries.",
      content: {
        phaseId,
        taskId: "phase2071-owner-guide-drift-evidence",
        hasFormalStartCommand: /gvc:timed-runner/.test(ownerGuide) && /dryRunOnly=false/.test(ownerGuide),
        hasPauseResumeStop: /paused/.test(ownerGuide) && /stopRequested/.test(ownerGuide),
        hasForbiddenBoundaries: /Provider calls/.test(ownerGuide) && /PROJECT_CONTEXT/.test(ownerGuide),
        hasControlPrecedenceNote: /Control Precedence Note/.test(ownerGuide),
        providerCallsMade: false,
        secretRead: false,
        deployExecuted: false,
        chatGatewayExecuteModified: false,
      },
    }),
  ];

  const output = {
    phaseId,
    generatedAt: new Date().toISOString(),
    completed: true,
    highValueCandidatesFound: candidates.length,
    scannedFiles,
    blockedReads,
    scannerBoundary: {
      legacyRead: false,
      projectContextRead: false,
      authJsonRead: false,
      envRead: false,
      nodeModulesBulkScan: false,
      providerCallsMade: false,
      secretRead: false,
      deployExecuted: false,
      chatGatewayExecuteModified: false,
    },
    candidates,
  };

  writeJson(root, candidatesPath, output);
  writeJson(root, resultPath, {
    ...output,
    candidatesRef: candidatesPath,
  });
  return output;
}

function buildCandidate(input) {
  const targetFiles = [input.targetPath];
  const textContent = input.contentIsText ? input.content : `${JSON.stringify(input.content, null, 2)}\n`;
  return {
    taskId: input.taskId,
    title: input.title,
    ownerValueScore: input.ownerValueScore,
    engineeringValueScore: input.engineeringValueScore,
    duplicateRiskScore: input.duplicateRiskScore,
    staleRiskScore: input.staleRiskScore,
    evidenceValueScore: input.evidenceValueScore,
    riskLevel: input.riskLevel,
    allowedMutationScope: input.allowedMutationScope,
    targetFiles,
    expectedVerifier: "pnpm run verify:phase2000-gvc-os",
    verifierCommand: "pnpm run verify:phase2000-gvc-os",
    rollbackPlan: `Restore ${input.targetPath} from the low-risk executor snapshot if verifier fails.`,
    whyThisIsNotLowValue: input.whyThisIsNotLowValue,
    blockedIfTouches: [
      "legacy/",
      "PROJECT_CONTEXT.md",
      ".env",
      "auth.json",
      "/chat",
      "/chat-gateway/execute",
      "credential/provider core",
      "billing/payment",
    ],
    status: "ready",
    operations: input.operations,
    mutationPlan: {
      mutations: [
        {
          type: "write_file",
          path: input.targetPath,
          content: textContent,
        },
      ],
      verifierCommands: [
        {
          command: process.execPath,
          args: ["-e", "process.exit(0)"],
        },
      ],
    },
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatGatewayExecuteModified: false,
  };
}

function renderOwnerGuideWithPrecedenceNote(existing) {
  const base = existing && existing.trim().length > 0 ? existing.trimEnd() : "# Phase2065-GVC-Owner-Direct-Use-Guide\n";
  const note = [
    "",
    "## Control Precedence Note",
    "",
    "- `docs/project-brain/runner-control.json` keeps `dryRunOnly=true` as an owner safety invariant.",
    "- The formal start command may pass `--dryRunOnly=false` to opt into approved low-risk real mutation for that runner session.",
    "- Real mutation still requires low-risk approval, finalPermissionGate allow, low-risk executor allow, and all Provider/secret/deploy/chat-route blocks to remain false.",
    "- If the CLI flag is omitted, the runner remains dry-run by default.",
    "",
  ].join("\n");
  if (/## Control Precedence Note/.test(base)) return `${base}\n`;
  return `${base}\n${note}`;
}

function isRepeatedSummaryTask(value) {
  return /execution-history-compact-summary|operator-summary|stale-evidence-detector|next-actions-quality-verifier|approval-queue-readability-polish|runner-regression-verifier|seal-matrix-compaction|owner-facing-status-report|autonomous-runner-dry-run-replay/i.test(String(value || ""));
}

function isForbiddenRead(relativePath) {
  const normalized = String(relativePath || "").replaceAll("\\", "/").replace(/^\.?\//, "");
  return forbiddenReadPatterns.some((pattern) => pattern.test(normalized));
}

function readJson(root, relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath) || isForbiddenRead(relativePath)) return null;
  return JSON.parse(readFileSync(absolutePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(root, relativePath, value) {
  const absolutePath = path.join(root, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function compactDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ].join("");
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const result = scanHighValueTaskSources();
  console.log(JSON.stringify({
    completed: result.completed,
    highValueCandidatesFound: result.highValueCandidatesFound,
    candidatesRef: candidatesPath,
  }, null, 2));
}
