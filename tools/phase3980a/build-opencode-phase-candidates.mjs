import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(relativePath, value) {
  const filePath = path.join(repoRoot, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(relativePath, value) {
  const filePath = path.join(repoRoot, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${value}\n`, "utf8");
}

function buildAllowedFiles() {
  return [
    "docs/automation/opencode-autopilot-task-queue.json",
    "docs/project-brain/opencode-autopilot-policy.json",
    "docs/project-brain/opencode-autopilot-state.json",
    "docs/project-brain/opencode-autopilot-phase-candidates.json",
    "docs/phase3980a-opencode-phase-candidate-bridge.md",
    "tools/phase3980a/build-opencode-phase-candidates.mjs",
    "tools/phase3980a/verify-opencode-phase-candidates.mjs",
    "tools/phase3979a/run-opencode-autopilot-governor.mjs",
    "tools/phase3979a/read-opencode-autopilot-status.mjs",
    "tools/phase3979a/verify-opencode-autopilot-governor.mjs",
    "package.json",
    "opencode.jsonc"
  ];
}

function buildTask({ taskId, title, priority, executeCommands, reviewCommands, verifyCommands, requestBudget = 0, costBudgetUsd = 0, blocker = null }) {
  return {
    taskId,
    title,
    priority,
    status: blocker ? "blocked" : "pending",
    allowedFiles: buildAllowedFiles(),
    preflightCommands: [
      "node --check tools/phase3980a/build-opencode-phase-candidates.mjs",
      "node --check tools/phase3980a/verify-opencode-phase-candidates.mjs"
    ],
    diagnoseCommands: [
      "cmd /c pnpm run phase:auto-next:state",
      "cmd /c pnpm run phase:auto-next:safety"
    ],
    executeCommands,
    reviewCommands,
    verifyCommands,
    requestBudget,
    costBudgetUsd,
    blocker
  };
}

export function buildOpencodePhaseCandidates() {
  const state = readJson("docs/phase-orchestrator/current-phase-state.json");
  const decision = readJson("docs/phase-orchestrator/safety-brake-decision.json");
  const registry = readJson("docs/phase-orchestrator/phase-registry.json");
  const promptMeta = existsSync(path.join(repoRoot, "docs/phase-orchestrator/next-codex-prompt.meta.json"))
    ? readJson("docs/phase-orchestrator/next-codex-prompt.meta.json")
    : null;

  const selected = registry.phases.find((item) => item.phase === decision.selectedNextPhase) || null;
  const riskLevel = decision.selectedNextPhaseRiskLevel || selected?.riskLevel || "high";
  const highRisk = riskLevel === "high" || decision.humanApprovalRequired === true;
  const autoCandidateAllowed =
    highRisk !== true &&
    decision.readyToExecute === true &&
    decision.safetyBrakeEngaged !== true &&
    decision.executeNextPhaseAllowed === false;

  const candidates = [];

  candidates.push(
    buildTask({
      taskId: "phase3980a-phase-state-refresh",
      title: `Refresh latest phase state from ${state.latestPhase || "unknown"}`,
      priority: 100,
      executeCommands: [
        "cmd /c pnpm run phase:auto-next:state"
      ],
      reviewCommands: [
        "cmd /c pnpm run phase:auto-next:safety"
      ],
      verifyCommands: [
        "cmd /c pnpm run status:phase3979a-opencode-autopilot",
        "cmd /c pnpm run verify:phase3980a-opencode-phase-candidate-bridge"
      ]
    })
  );

  if (autoCandidateAllowed) {
    candidates.push(
      buildTask({
        taskId: `phase3980a-lowrisk-next-phase-${decision.selectedNextPhase.toLowerCase()}`,
        title: `Prepare low-risk next phase candidate ${decision.selectedNextPhase}`,
        priority: 95,
        executeCommands: [
          "cmd /c pnpm run phase:auto-next:prompt"
        ],
        reviewCommands: [
          "cmd /c pnpm run phase:auto-next:dry-run"
        ],
        verifyCommands: [
          "cmd /c pnpm run verify:phase3980a-opencode-phase-candidate-bridge"
        ]
      })
    );
  } else {
    candidates.push(
      buildTask({
        taskId: `phase3980a-authorization-packet-${decision.selectedNextPhase.toLowerCase()}`,
        title: `Generate authorization-only packet for ${decision.selectedNextPhase}`,
        priority: 95,
        executeCommands: [
          "cmd /c pnpm run phase:auto-next:prompt"
        ],
        reviewCommands: [
          "cmd /c pnpm run phase:auto-next:safety"
        ],
        verifyCommands: [
          "cmd /c pnpm run verify:phase3980a-opencode-phase-candidate-bridge"
        ],
        blocker: highRisk ? "human_approval_required_phase_candidate" : null
      })
    );
  }

  candidates.push(
    buildTask({
      taskId: "phase3980a-candidate-bridge-report",
      title: "Write real phase candidate bridge report",
      priority: 80,
      executeCommands: [
        "cmd /c pnpm run status:phase3979a-opencode-autopilot"
      ],
      reviewCommands: [
        "cmd /c pnpm run verify:phase3980a-opencode-phase-candidate-bridge"
      ],
      verifyCommands: [
        "cmd /c pnpm run verify:phase3980a-opencode-phase-candidate-bridge"
      ]
    })
  );

  const result = {
    phaseId: "Phase3980A-OpenCode-Phase-Candidate-Bridge",
    generatedAt: new Date().toISOString(),
    latestPhase: state.latestPhase || null,
    latestResultPath: state.latestResultPath || null,
    selectedNextPhase: decision.selectedNextPhase || null,
    selectedNextPhaseTitle: decision.selectedNextPhaseTitle || null,
    selectedNextPhaseRiskLevel: riskLevel,
    humanApprovalRequired: decision.humanApprovalRequired === true,
    safetyBrakeEngaged: decision.safetyBrakeEngaged === true,
    readyToExecute: decision.readyToExecute === true,
    autoContinueAllowed: decision.autoContinueAllowed === true,
    allowedExecutionMode: decision.allowedMode || selected?.allowedExecutionMode || null,
    promptMeta: promptMeta
      ? {
          selectedNextPhase: promptMeta.selectedNextPhase || null,
          selectedNextPhaseRiskLevel: promptMeta.selectedNextPhaseRiskLevel || null,
          readyToExecute: promptMeta.readyToExecute === true,
          autoContinueAllowed: promptMeta.autoContinueAllowed === true,
          blockedReasons: promptMeta.blockedReasons || []
        }
      : null,
    candidates
  };

  writeJson("docs/project-brain/opencode-autopilot-phase-candidates.json", result);
  writeText(
    "apps/ai-gateway-service/evidence/phase3980a-opencode-phase-candidate-bridge/latest-summary.md",
    [
      "# Phase3980A OpenCode Phase Candidate Bridge",
      "",
      `- latestPhase: ${result.latestPhase || "unknown"}`,
      `- selectedNextPhase: ${result.selectedNextPhase || "unknown"}`,
      `- selectedNextPhaseRiskLevel: ${result.selectedNextPhaseRiskLevel}`,
      `- humanApprovalRequired: ${result.humanApprovalRequired}`,
      `- safetyBrakeEngaged: ${result.safetyBrakeEngaged}`,
      `- readyToExecute: ${result.readyToExecute}`,
      `- allowedExecutionMode: ${result.allowedExecutionMode || "unknown"}`,
      `- candidateCount: ${result.candidates.length}`
    ].join("\n")
  );

  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  console.log(JSON.stringify(buildOpencodePhaseCandidates(), null, 2));
}
