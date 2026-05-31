import { buildTaskConceptSourceSchema, createSyntheticTaskConceptExamples } from "../../packages/taiji-beidou-engine/src/index.js";
import {
  docsPathFor,
  phaseBoundary,
  phaseConfigs,
  readJsonIfExists,
  resultPathFor,
  validationPathFor,
  writeJson,
  writeText,
} from "./phase1203-1210-common.mjs";

export function buildSourceSchemas() {
  return createSyntheticTaskConceptExamples().map((example) => buildTaskConceptSourceSchema({
    taskId: example.scenarioId,
    rawTask: example.rawTask,
  }));
}

export async function readPhaseResult(key) {
  return readJsonIfExists(resultPathFor(key), null);
}

export async function readPhaseValidation(key) {
  return readJsonIfExists(validationPathFor(key), null);
}

export async function writePhaseResult(key, payload) {
  const config = phaseConfigs[key];
  const result = {
    phase: config.phase,
    title: config.title,
    completed: true,
    recommended_sealed: true,
    blocker: null,
    [config.generatedFlag]: true,
    ...payload,
    ...phaseBoundary(),
  };
  await writeJson(resultPathFor(key), result);
  await writeText(docsPathFor(key), buildPhaseDoc(config, result));
  console.log(JSON.stringify({
    phase: result.phase,
    completed: result.completed,
    recommended_sealed: result.recommended_sealed,
    blocker: result.blocker,
  }, null, 2));
  return result;
}

export function requirePhaseResult(key, result) {
  if (!result) {
    throw new Error(`${key}_result_missing_run_previous_phase_first`);
  }
  return result;
}

function buildPhaseDoc(config, result) {
  const fieldList = config.requiredFields.map((field) => `- ${field}: ${summarize(result[field])}`).join("\n");
  return `# ${config.phase} ${config.title}

## Goal

This phase builds a synthetic dry-run artifact for ${config.title}. It does not execute runtime scheduling, provider calls, or main-chain integration.

## Outputs

${fieldList}

## Boundary

- providerCallsMade=false
- secretRead=false
- secretValueExposed=false
- authJsonRead=false
- gloveDownloaded=false
- chatModified=false
- chatRuntimeModified=false
- chatGatewayExecuteModified=false
- chatGatewayExecuteRuntimeModified=false
- mainChainIntegrationExecuted=false
- mainChainDefaultEnabled=false
- providerRuntimeDefaultEnabled=false
- deployExecuted=false
- releaseExecuted=false
- tagCreated=false
- artifactUploaded=false
- commitCreated=false
- pushExecuted=false
- workspaceCleanClaimed=false
- legacyModified=false
- projectContextModified=false
- realSemanticValidationClaimed=false
- syntheticOnly=true

## Evidence

- ${config.evidenceDir}/${config.resultFile}
- ${config.evidenceDir}/${config.validationFile}

## Verification

- ${config.runCommand}
- ${config.validateCommand}
`;
}

function summarize(value) {
  if (Array.isArray(value)) return `${value.length} item(s)`;
  if (value && typeof value === "object") return `${Object.keys(value).length} key(s)`;
  return String(Boolean(value));
}
