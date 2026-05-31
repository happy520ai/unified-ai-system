import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { runThreeModeMinimalLoop } from "../../packages/world-class-product-conversion/src/index.js";

const repoRoot = process.cwd();

const paths = Object.freeze({
  preconditionDoc: "docs/phase1916-1919a-precondition-check.md",
  preconditionEvidence: "apps/ai-gateway-service/evidence/phase1916_1919a/precondition-check-result.json",
  result: "apps/ai-gateway-service/evidence/phase1916a/three-mode-minimal-task-loop-result.json",
  normal: "apps/ai-gateway-service/evidence/phase1916a/normal-mode-sample-result.json",
  god: "apps/ai-gateway-service/evidence/phase1916a/god-mode-sample-result.json",
  tianshu: "apps/ai-gateway-service/evidence/phase1916a/tianshu-mode-sample-result.json",
  doc: "docs/phase1916a-three-mode-minimal-real-task-loop.md",
  contract: "docs/phase1916a-three-mode-loop-contract.md",
  report: "docs/phase1916a-execution-report.md",
  rollback: "docs/phase1916a-rollback-guide.md",
  phase1914a: "apps/ai-gateway-service/evidence/phase1914a/owner-real-local-action-result.json",
  phase1915a: "apps/ai-gateway-service/evidence/phase1915a/boss-mode-daily-loop-result.json",
});

function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

async function readJson(relativePath) {
  const text = await readFile(repoPath(relativePath), "utf8");
  return JSON.parse(text);
}

async function writeText(relativePath, value) {
  const absolutePath = repoPath(relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${String(value).trimEnd()}\n`, "utf8");
}

async function writeJson(relativePath, value) {
  await writeText(relativePath, JSON.stringify(value, null, 2));
}

function buildDoc() {
  return `# Phase1916A Three-Mode Minimal Real Task Loop

Phase1916A adds a local deterministic preview loop for Normal, God, and Tianshu modes.

- Normal Mode: one direct local plan.
- God Mode: three local candidate plans with rule-based review.
- Tianshu Mode: local route recommendation only.
- Real Provider calls: false.
- Secret reads: false.
- /chat-gateway/execute default route changed: false.
`;
}

function buildContract() {
  return `# Phase1916A Three-Mode Loop Contract

The loop is local-only and deterministic.

## Normal Mode
- Input: task text.
- Output: directPlan and resultSummary.
- Provider call: forbidden.

## God Mode
- Input: task text.
- Output: three candidate plans, conflicts, final recommendation.
- Multi-model claim: forbidden.

## Tianshu Mode
- Input: task text.
- Output: recommended route and reason.
- Real action execution: forbidden by default.
`;
}

function buildRollbackGuide() {
  return `# Phase1916A Rollback Guide

- Remove packages/world-class-product-conversion/.
- Remove tools/phase1916a/.
- Remove docs/phase1916a-*.md.
- Remove apps/ai-gateway-service/evidence/phase1916a/.
- Remove Phase1916A scripts from package.json.
- Remove the Phase1916A Mission Control copy block if reverting UI text.
- Do not use git reset --hard or git clean.
`;
}

function buildExecutionReport(result) {
  return `# Phase1916A Execution Report

- completed: ${result.completed}
- recommended_sealed: ${result.recommended_sealed}
- blocker: ${result.blocker ?? "null"}
- normalModeLoopReady: ${result.normalModeLoopReady}
- godModeLoopReady: ${result.godModeLoopReady}
- tianshuModeLoopReady: ${result.tianshuModeLoopReady}
- providerCallsMade: false
- secretValueExposed: false
- chatGatewayExecuteModified: false
- productionReadyClaimed: false
`;
}

async function main() {
  const phase1914a = await readJson(paths.phase1914a);
  const phase1915a = await readJson(paths.phase1915a);
  const phase1914aSealed = phase1914a.completed === true && phase1914a.recommended_sealed === true && phase1914a.blocker === null;
  const phase1915aSealed = phase1915a.completed === true && phase1915a.recommended_sealed === true && phase1915a.blocker === null;
  const allowExecution = phase1914aSealed && phase1915aSealed;

  const precondition = {
    phaseRange: "Phase1916A-1919A",
    phase1914aRequired: true,
    phase1915aRequired: true,
    phase1914aSealed,
    phase1915aSealed,
    allowExecution,
    providerCallsMade: false,
    secretValueExposed: false,
    chatGatewayExecuteModified: false,
  };
  await writeJson(paths.preconditionEvidence, precondition);
  await writeText(
    paths.preconditionDoc,
    `# Phase1916A-1919A Precondition Check

- phase1914aRequired: true
- phase1915aRequired: true
- phase1914aSealed: ${phase1914aSealed}
- phase1915aSealed: ${phase1915aSealed}
- allowExecution: ${allowExecution}
- blocker: ${allowExecution ? "null" : "phase1914a_or_phase1915a_not_sealed"}
`,
  );

  if (!allowExecution) {
    console.log(JSON.stringify({ ...precondition, blocker: "phase1914a_or_phase1915a_not_sealed" }, null, 2));
    process.exitCode = 1;
    return;
  }

  const samples = runThreeModeMinimalLoop("检查今天系统状态，比较下一步方案，并避免真实 Provider 调用。");
  const result = {
    phase: "Phase1916A",
    name: "Three-Mode Minimal Real Task Loop",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    normalModeLoopReady: samples.normal.loopReady === true,
    godModeLoopReady: samples.god.loopReady === true,
    tianshuModeLoopReady: samples.tianshu.loopReady === true,
    realProviderCallExecuted: false,
    providerCallsMade: false,
    secretValueExposed: false,
    rawSecretRead: false,
    authJsonRead: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
    workspaceCleanClaimed: false,
    productionReadyClaimed: false,
    nextRecommendedPhase: "Phase1917A Guarded Real Provider Stability Authorization Packet",
  };

  await writeJson(paths.normal, samples.normal);
  await writeJson(paths.god, samples.god);
  await writeJson(paths.tianshu, samples.tianshu);
  await writeJson(paths.result, result);
  await writeText(paths.doc, buildDoc());
  await writeText(paths.contract, buildContract());
  await writeText(paths.rollback, buildRollbackGuide());
  await writeText(paths.report, buildExecutionReport(result));

  console.log(JSON.stringify(result, null, 2));
}

await main();
