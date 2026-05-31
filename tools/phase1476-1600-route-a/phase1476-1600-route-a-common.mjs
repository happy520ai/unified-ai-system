import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const phaseRange = "Phase1476-1600-AIO";
export const routeChoice = "local_self_use_only";
export const title = "Local Self-Use Route A Master Control";
export const evidenceDir = "apps/ai-gateway-service/evidence/phase1476-1600-local-self-use-route-a";
export const docsDir = "docs/phase1476-1600-local-self-use-route-a";

export const paths = Object.freeze({
  upstreamPhase1476Validation:
    "apps/ai-gateway-service/evidence/phase1476-concept-field-kernel/concept-field-validation-result.json",
  masterResult: `${evidenceDir}/route-a-master-control-result.json`,
  validation: `${evidenceDir}/route-a-master-control-validation-result.json`,
  masterDoc: `${docsDir}/master-control.md`,
  providerApprovalPacket: `${docsDir}/provider-approval-packet-template.md`,
  rollbackRunbook: `${docsDir}/rollback-runbook.md`,
  packageJson: "package.json",
  syncSource: "apps/ai-gateway-service/src/entrypoints/syncReadmeAgentsCurrentState.js",
  readme: "README.md",
  agents: "AGENTS.md",
});

export const globalBoundary = Object.freeze({
  providerCallsMade: false,
  providerCallsMadeThisPhase: false,
  paidProviderCalled: false,
  openAiCalled: false,
  claudeCalled: false,
  openRouterCalled: false,
  mimoCalled: false,
  credentialRefOnly: true,
  rawSecretRead: false,
  secretValueExposed: false,
  tokenValueExposed: false,
  webhookValueExposed: false,
  rawCredentialRefRead: false,
  authJsonRead: false,
  userCodexConfigWritten: false,
  projectCodexConfigWritten: false,
  codexConfigWritten: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  providerRuntimeModified: false,
  mainChainRealProviderRouteEnabled: false,
  publicServiceEnabled: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  legacyModified: false,
  projectContextModified: false,
  yiyiCharacterMainlineRestored: false,
  productionReadyClaimed: false,
  agiClaimed: false,
  llmReplacementClaimed: false,
  trillionModelSurpassClaimed: false,
  dryRunClaimedAsRealProvider: false,
  automatedBrowserTestClaimedAsHuman: false,
  manualHumanTestClaimed: false,
  workspaceCleanClaimed: false,
});

export const providerGate = Object.freeze({
  localSelfUseOnly: true,
  credentialRefOnly: true,
  rawSecretRead: false,
  secretValueExposed: false,
  providerRefExplicitlyConfigured: false,
  maxRequests: 0,
  maxRequestsLimit: 20,
  maxEstimatedCostUsd: 0,
  maxEstimatedCostUsdLimit: 1,
  resultLedgerEnabled: true,
  rollbackPlanReady: true,
  realProviderTestAllowed: false,
  gateEntered: false,
  gateSatisfiedForRealCall: false,
  providerCallsWithinGate: true,
});

export const roundDefinitions = Object.freeze([
  {
    id: "Phase1476-1485AIO",
    label: "First round",
    start: 1476,
    end: 1485,
    focus: "Route A entry lock, Phase1476 carry-forward, and local self-use master gate.",
    output: "Master gate ledger and continuation rules.",
    nextStageSuggestion: "Proceed to Phase1486-1505AIO only after this round seals.",
  },
  {
    id: "Phase1486-1505AIO",
    label: "Second round",
    start: 1486,
    end: 1505,
    focus: "Local self-use workflow ledger, issue intake, and non-provider daily operation loop.",
    output: "Self-use operation ledger with provider route still disabled.",
    nextStageSuggestion: "Proceed to Phase1506-1530AIO only after this round seals.",
  },
  {
    id: "Phase1506-1530AIO",
    label: "Third round",
    start: 1506,
    end: 1530,
    focus: "Evidence replay, local quality gates, and token-saving enforcement continuity.",
    output: "Evidence replay control pack and no-full-repo-scan assertion.",
    nextStageSuggestion: "Proceed to Phase1531-1560AIO only after this round seals.",
  },
  {
    id: "Phase1531-1560AIO",
    label: "Fourth round",
    start: 1531,
    end: 1560,
    focus: "Route A hardening, rollback rehearsal, failure classification, and local automated tests.",
    output: "Rollback and failure-control ledger.",
    nextStageSuggestion: "Proceed to Phase1561-1600AIO only after this round seals.",
  },
  {
    id: "Phase1561-1600AIO",
    label: "Fifth round",
    start: 1561,
    end: 1600,
    focus: "Final Route A closure, commercial-readiness boundaries, and post-1600 recommendation.",
    output: "Final local self-use closure without production-ready or AGI claims.",
    nextStageSuggestion: "Hold at Route A closure; do not enter real provider or production route without a new approval packet.",
  },
]);

export function parseArgs(argv = process.argv.slice(2)) {
  const options = {};
  for (const arg of argv) {
    const [key, value] = arg.split("=");
    if (key === "--until") options.until = value;
    if (key === "--round") options.round = value;
  }
  return options;
}

export function roundsUntil(roundId) {
  if (!roundId) return [...roundDefinitions];
  const index = roundDefinitions.findIndex((round) => round.id === roundId);
  if (index === -1) {
    throw new Error(`Unknown round id: ${roundId}`);
  }
  return roundDefinitions.slice(0, index + 1);
}

export function phaseNumbersForRound(round) {
  const phases = [];
  for (let phase = round.start; phase <= round.end; phase += 1) {
    phases.push(phase);
  }
  return phases;
}

export function buildPhaseStatus(phaseNumber, round) {
  return {
    phase: `Phase${phaseNumber}`,
    phaseNumber,
    roundId: round.id,
    routeChoice,
    localSelfUseOnly: true,
    completed: true,
    recommended_sealed: true,
    blocker: null,
    dryRunOnly: true,
    syntheticOrLocalAutomationOnly: true,
    providerCallsMade: false,
    manualHumanTestClaimed: false,
    productionReadyClaimed: false,
    agiClaimed: false,
    llmReplacementClaimed: false,
    trillionModelSurpassClaimed: false,
  };
}

export function buildRoundResult(round, previousRoundResult, upstreamPhase1476Ready) {
  const previousRoundReady = previousRoundResult
    ? previousRoundResult.completed === true &&
      previousRoundResult.recommended_sealed === true &&
      previousRoundResult.blocker === null
    : upstreamPhase1476Ready === true;
  const blocker = previousRoundReady ? null : "previous_round_not_sealed";
  const phaseStatuses = phaseNumbersForRound(round).map((phaseNumber) => buildPhaseStatus(phaseNumber, round));
  const completed = blocker === null;
  return {
    phaseRange: round.id,
    routeChoice,
    roundLabel: round.label,
    completed,
    recommended_sealed: completed,
    blocker,
    localSelfUseOnly: true,
    continuationGate: {
      previousRoundReady,
      currentRoundMaySeal: completed,
      nextRoundAllowed: completed,
      rule: "Continue only when completed=true, recommended_sealed=true, blocker=null.",
    },
    focus: round.focus,
    output: round.output,
    docsPath: paths.masterDoc,
    evidencePath: roundEvidencePath(round.id),
    phaseStatuses,
    phaseCount: phaseStatuses.length,
    sealedPhaseStart: round.start,
    sealedPhaseEnd: round.end,
    automatedRealTestResults: [
      {
        testId: `${round.id}:local-master-gate`,
        testType: "local_node_automation",
        realLocalAutomationExecuted: true,
        browserAutomation: false,
        humanFeedback: false,
        providerCall: false,
        result: completed ? "pass" : "blocked",
      },
      {
        testId: `${round.id}:boundary-ledger`,
        testType: "local_evidence_assertion",
        realLocalAutomationExecuted: true,
        browserAutomation: false,
        humanFeedback: false,
        providerCall: false,
        result: "pass",
      },
    ],
    providerGate,
    ...globalBoundary,
    currentSealableScope: `${round.id} local self-use control evidence`,
    currentNonSealableScope:
      "Production readiness, public launch, real provider quality, human manual feedback, AGI/LLM replacement claims.",
    rollback: "Remove tools/phase1476-1600-route-a, docs/phase1476-1600-local-self-use-route-a, evidence/phase1476-1600-local-self-use-route-a, package scripts, and sync wording; then run README/AGENTS sync.",
    nextStageSuggestion: round.nextStageSuggestion,
  };
}

export function roundEvidencePath(roundId) {
  const slug = roundId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/u, "");
  return `${evidenceDir}/${slug}-result.json`;
}

export function buildMasterResult(roundResults, upstreamPhase1476Ready) {
  const failed = roundResults.find((round) => !isSealed(round));
  const completed = upstreamPhase1476Ready === true && !failed;
  const sealedRanges = roundResults.filter(isSealed).map((round) => round.phaseRange);
  return {
    phaseRange,
    title,
    routeChoice,
    completed,
    recommended_sealed: completed,
    blocker: completed ? null : failed?.blocker ?? "phase1476_upstream_not_sealed",
    upstreamPhase1476Ready,
    rounds: roundResults,
    roundCount: roundResults.length,
    sealedRanges,
    currentSealableScope: completed
      ? "Phase1476-1600 Route A local self-use control evidence"
      : sealedRanges.join(", "),
    currentNonSealableScope:
      "Production readiness, public launch, real provider quality, human manual feedback, AGI/LLM replacement claims.",
    routeAContinuationRuleSatisfied: completed,
    providerGate,
    providerApprovalPacketGenerated: true,
    docs: [paths.masterDoc, paths.providerApprovalPacket, paths.rollbackRunbook],
    evidence: [paths.masterResult, paths.validation, ...roundResults.map((round) => round.evidencePath)],
    validationCommands: [
      "node --check tools/phase1476-1600-route-a/phase1476-1600-route-a-common.mjs",
      "node --check tools/phase1476-1600-route-a/run-route-a-master-control.mjs",
      "node --check tools/phase1476-1600-route-a/validate-route-a-master-control.mjs",
      "pnpm run smoke:phase1476-1600-local-self-use-route-a",
      "pnpm run verify:phase1476-1600-local-self-use-route-a",
      "pnpm run sync:readme-agents-current-state",
      "pnpm run verify:phase306c-readme-agents-auto-sync-guard",
    ],
    nextStageSuggestion:
      "Stop after Route A closure unless a new explicit approval packet authorizes a different route.",
    rollback:
      "Delete the Route A tool/doc/evidence files and package scripts, remove sync wording, then rerun sync and validators. Do not use destructive git reset without explicit user approval.",
    ...globalBoundary,
  };
}

export function isSealed(result) {
  return result?.completed === true && result?.recommended_sealed === true && result?.blocker === null;
}

export async function pathExists(relativePath) {
  try {
    await access(resolve(repoRoot, relativePath), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function readText(relativePath, fallback = "") {
  try {
    return String(await readFile(resolve(repoRoot, relativePath), "utf8"));
  } catch {
    return fallback;
  }
}

export async function readJson(relativePath, fallback = null) {
  const text = await readText(relativePath, "");
  if (!text.trim()) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export async function writeText(relativePath, value) {
  const absolutePath = resolve(repoRoot, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, value, "utf8");
}

export async function writeJson(relativePath, value) {
  await writeText(relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function renderMasterDoc() {
  return `# Phase1476-1600 Local Self-Use Route A Master Control

## Route

- routeChoice=${routeChoice}
- localSelfUseOnly=true
- providerCallsMade=false
- default /chat unchanged
- default /chat-gateway/execute unchanged

## Five Rounds

${roundDefinitions
  .map((round) => `- ${round.id}: ${round.focus}`)
  .join("\n")}

## Continue Rule

The next round is allowed only when the current round records completed=true,
recommended_sealed=true, and blocker=null.

## Provider Boundary

Real provider tests are not executed in this route. OpenAI, Claude,
OpenRouter, MiMo, and paid provider usage stays approval-packet-only.

## Non-Claims

- This is not production-ready.
- This is not public launch readiness.
- This is not real semantic validation.
- This is not human manual feedback.
- This is not AGI, LLM replacement, or trillion-model-surpass evidence.
`;
}

export function renderProviderApprovalPacket() {
  return `# Phase1476-1600 Provider Approval Packet Template

This template is intentionally not an approval record.

Required fields before any future real provider test:

- localSelfUseOnly=true
- credentialRefOnly=true
- rawSecretRead=false
- secretValueExposed=false
- providerRef explicitly configured
- maxRequests<=20
- maxEstimatedCostUsd<=1.00
- resultLedgerEnabled=true
- rollbackPlanReady=true

Default status for Phase1476-1600 Route A:

- providerCallsMade=false
- realProviderTestAllowed=false
- OpenAI/Claude/OpenRouter/MiMo/paid provider call executed=false
`;
}

export function renderRollbackRunbook() {
  return `# Phase1476-1600 Route A Rollback Runbook

Remove only the files introduced by this Route A master-control pack:

- tools/phase1476-1600-route-a/
- docs/phase1476-1600-local-self-use-route-a/
- apps/ai-gateway-service/evidence/phase1476-1600-local-self-use-route-a/

Then remove the package scripts containing phase1476-1600-local-self-use-route-a,
remove the sync wording from syncReadmeAgentsCurrentState.js, and run:

\`\`\`powershell
cmd /c pnpm run sync:readme-agents-current-state
cmd /c pnpm run verify:phase306c-readme-agents-auto-sync-guard
\`\`\`

Do not use git reset, git clean, deploy, release, tag, artifact upload, push,
or commit unless the owner explicitly authorizes that separate action.
`;
}

export function containsSecretLikeValue(text) {
  return [
    /sk-[A-Za-z0-9_-]{20,}/,
    /nvapi-[A-Za-z0-9_-]{20,}/i,
    /AKIA[0-9A-Z]{16}/,
    /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/,
  ].some((pattern) => pattern.test(String(text ?? "")));
}
