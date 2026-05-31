import {
  buildTaskConceptSourceSchema,
  classifyTaskConceptSourceBoundaries,
  createSyntheticTaskConceptExamples,
  validateTaskConceptSourceSchema,
} from "../../packages/taiji-beidou-engine/src/index.js";
import {
  docsPath,
  examplesPath,
  phase1202Boundary,
  reportPath,
  resultEvidencePath,
  title,
  writeJson,
  writeText,
} from "./phase1202-common.mjs";

const examples = createSyntheticTaskConceptExamples();
const scenarioResults = examples.map((example) => {
  const schema = buildTaskConceptSourceSchema({
    taskId: example.scenarioId,
    rawTask: example.rawTask,
  });
  const validation = validateTaskConceptSourceSchema(schema);
  const boundaryClassification = classifyTaskConceptSourceBoundaries(schema);
  return {
    scenarioId: example.scenarioId,
    title: example.title,
    schema,
    validation,
    boundaryClassification,
    expected: example.expected,
    passed: validation.valid && matchesExpected(schema, example.expected),
  };
});

const allScenariosPassed = scenarioResults.every((scenario) => scenario.passed === true);
const boundary = phase1202Boundary();
const result = {
  phase: "Phase1202",
  title,
  completed: allScenariosPassed,
  recommended_sealed: allScenariosPassed,
  blocker: allScenariosPassed ? null : "synthetic_scenario_expectation_failed",
  schemaGenerated: true,
  syntheticExamplesGenerated: true,
  syntheticOnly: true,
  scenarioCount: scenarioResults.length,
  scenarioResults,
  ...boundary,
};

await writeJson(resultEvidencePath, result);
await writeJson(examplesPath, {
  phase: "Phase1202",
  title,
  examples: scenarioResults.map((scenario) => ({
    scenarioId: scenario.scenarioId,
    rawTask: scenario.schema.rawTask,
    sources: scenario.schema.sources,
    readoutTargets: scenario.schema.readoutTargets,
    boundary: scenario.schema.boundary,
    safetyClassification: scenario.schema.safetyClassification,
  })),
});

await writeText(docsPath, `# Phase1202 Taiji / Beidou Task Concept Source Schema

Phase1202 是 Phase1201 之后的 schema 层。

它把自然语言任务拆成四类太极 / 北斗场输入源：

- positive sources: 任务目标、期望结果、用户想要什么。
- negative sources: 禁止方向、风险、不能做什么。
- constraint sources: 成本、安全、范围、技术边界。
- context sources: 已有模块、已有 evidence、已有 Phase 结果。

它只产生 candidate readout targets，不真实执行。

## Boundary

- 不调用 Provider。
- 不读 secret。
- 不改 /chat。
- 不改 /chat-gateway/execute。
- 不下载 GloVe。
- 不声明真实语义智能。
- 只做 synthetic dry-run。

## Readout Targets

Phase1202 输出 capabilityCandidates、phaseCandidates、executionPathCandidates。
这些候选只用于后续阶段设计，不代表运行时能力已接入。

## Preparation

Phase1202 为以下阶段做准备：

- Phase1203 Capability Candidate Readout Schema
- Phase1204 Main Chain Approval Design
- Phase1205 Provider Boundary Review
`);

await writeText(reportPath, `# Phase1202 Execution Report

A. 是否完成：${result.completed ? "是" : "否"}
B. 是否推荐封板：${result.recommended_sealed ? "是" : "否"}
C. blocker：${result.blocker ?? "null"}
D. 修改文件：
- packages/taiji-beidou-engine/src/taskConceptSourceSchema.js
- tools/phase1202/run-task-concept-source-schema.mjs
- tools/phase1202/validate-task-concept-source-schema.mjs
- docs/phase1202-taiji-beidou-task-concept-source-schema.md
- docs/phase1202-task-concept-source-schema-examples.json
- docs/phase1202-execution-report.md
- apps/ai-gateway-service/evidence/phase1202-task-concept-source-schema/task-concept-source-schema-result.json
- apps/ai-gateway-service/evidence/phase1202-task-concept-source-schema/task-concept-source-schema-validation-result.json
E. Evidence：
- apps/ai-gateway-service/evidence/phase1202-task-concept-source-schema/task-concept-source-schema-result.json
- apps/ai-gateway-service/evidence/phase1202-task-concept-source-schema/task-concept-source-schema-validation-result.json
F. 验证命令：
- node --check packages/taiji-beidou-engine/src/taskConceptSourceSchema.js
- node --check tools/phase1202/run-task-concept-source-schema.mjs
- node --check tools/phase1202/validate-task-concept-source-schema.mjs
- pnpm run smoke:phase1202-taiji-beidou-task-concept-source-schema:dry-run
- pnpm run verify:phase1202-taiji-beidou-task-concept-source-schema
G. Provider 边界：providerCallsMade=false
H. Secret 边界：secretRead=false, secretValueExposed=false
I. /chat 边界：chatModified=false
J. /chat-gateway/execute 边界：chatGatewayExecuteModified=false
K. deploy/release/tag/artifact 边界：false
L. 是否真实语义验证：false，仅 synthetic dry-run
M. 下一步建议：Phase1203 Capability Candidate Readout Schema
`);

console.log(JSON.stringify({
  phase: result.phase,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  scenarioCount: result.scenarioCount,
}, null, 2));

if (!result.recommended_sealed) {
  process.exitCode = 1;
}

function matchesExpected(schema, expected) {
  if (expected.riskLevel && schema.safetyClassification.riskLevel !== expected.riskLevel) return false;
  if (typeof expected.requiresHumanApproval === "boolean" && schema.safetyClassification.requiresHumanApproval !== expected.requiresHumanApproval) return false;
  if (expected.positiveSources && !expected.positiveSources.every((source) => schema.sources.positiveSources.includes(source))) return false;
  if (expected.negativeSources && !expected.negativeSources.every((source) => schema.sources.negativeSources.includes(source))) return false;
  if (expected.blockedReasons && !expected.blockedReasons.every((reason) => schema.safetyClassification.blockedReasons.includes(reason))) return false;
  if (expected.phaseCandidates && !expected.phaseCandidates.every((phase) => schema.readoutTargets.phaseCandidates.includes(phase))) return false;
  if (expected.capabilityCandidates && !expected.capabilityCandidates.every((candidate) => schema.readoutTargets.capabilityCandidates.includes(candidate))) return false;
  return true;
}
