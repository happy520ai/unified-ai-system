import {
  buildTaijiBeidouDryRunStabilization,
} from "../../packages/taiji-beidou-engine/src/dryRunStabilization.js";
import {
  docsPath,
  executionReportPath,
  phaseDocsPath,
  phaseEvidence,
  phaseKeys,
  phaseResultPath,
  phaseValidationPath,
  readJsonIfExists,
  repoRoot,
  resultPath,
  validationPath,
  writeJson,
  writeText,
} from "./phase1211-1215-common.mjs";

const upstreamClosurePath = `${repoRoot}/apps/ai-gateway-service/evidence/phase1203-1210-taiji-beidou-dry-run-closure/taiji-beidou-dry-run-closure-result.json`;
const upstreamClosure = await readJsonIfExists(upstreamClosurePath, null);
const stabilization = buildTaijiBeidouDryRunStabilization({ upstreamClosure });

const phaseEvidenceRefs = {};
const phaseDocsRefs = {};

for (const key of phaseKeys) {
  const phaseResult = stabilization[key];
  const phaseConfig = phaseEvidence[key];
  const resultRef = `${phaseConfig.evidenceDir}/${phaseConfig.resultFile}`;
  const validationRef = `${phaseConfig.evidenceDir}/${phaseConfig.validationFile}`;
  const docsRef = phaseConfig.docsFile;
  phaseEvidenceRefs[key] = {
    result: resultRef,
    validation: validationRef,
  };
  phaseDocsRefs[key] = docsRef;

  const validation = {
    phase: phaseResult.phase,
    completed: phaseResult.completed === true,
    recommended_sealed: phaseResult.recommended_sealed === true,
    blocker: phaseResult.blocker ?? null,
    checks: buildPhaseChecks(key, phaseResult),
  };

  await writeJson(phaseResultPath(key), {
    ...phaseResult,
    evidenceRef: resultRef,
    validationRef,
    docsRef,
  });
  await writeJson(phaseValidationPath(key), validation);
  await writeText(phaseDocsPath(key), renderPhaseDoc(key, phaseResult, validation));
}

const result = {
  ...stabilization,
  phaseEvidenceRefs,
  phaseDocsRefs,
  upstreamEvidenceRef: "apps/ai-gateway-service/evidence/phase1203-1210-taiji-beidou-dry-run-closure/taiji-beidou-dry-run-closure-result.json",
  docsRef: "docs/phase1211-1215-taiji-beidou-dry-run-stabilization.md",
  executionReportRef: "docs/phase1211-1215-execution-report.md",
  validationRef: "apps/ai-gateway-service/evidence/phase1211-1215-taiji-beidou-dry-run-stabilization/taiji-beidou-dry-run-stabilization-validation-result.json",
};

await writeJson(resultPath, result);
await writeText(docsPath, renderClosureDoc(result));
await writeText(executionReportPath, renderExecutionReport(result));

const validation = {
  phase: result.phase,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  note: "Initial runner validation summary. The dedicated validator rewrites this file with full checks.",
};
await writeJson(validationPath, validation);

console.log(JSON.stringify({
  phase: result.phase,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
}, null, 2));

if (!result.completed) process.exitCode = 1;

function buildPhaseChecks(key, phaseResult) {
  if (key === "phase1211") {
    return {
      completed: phaseResult.completed === true,
      scenarioMatrixGenerated: phaseResult.scenarioMatrixGenerated === true,
      scenarioCountAtLeastTen: Number(phaseResult.scenarioCount) >= 10,
      coversProviderRisk: phaseResult.coversProviderRisk === true,
      coversSecretRisk: phaseResult.coversSecretRisk === true,
      coversChatRequest: phaseResult.coversChatRequest === true,
      coversChatGatewayExecuteRequest: phaseResult.coversChatGatewayExecuteRequest === true,
      coversDeployRequest: phaseResult.coversDeployRequest === true,
      coversCostConstraint: phaseResult.coversCostConstraint === true,
      coversCapabilityCandidateTask: phaseResult.coversCapabilityCandidateTask === true,
    };
  }
  if (key === "phase1212") {
    return {
      completed: phaseResult.completed === true,
      boundaryHardeningVerifierGenerated: phaseResult.boundaryHardeningVerifierGenerated === true,
      providerBoundaryAsserted: phaseResult.providerBoundaryAsserted === true,
      secretBoundaryAsserted: phaseResult.secretBoundaryAsserted === true,
      chatBoundaryAsserted: phaseResult.chatBoundaryAsserted === true,
      chatGatewayExecuteBoundaryAsserted: phaseResult.chatGatewayExecuteBoundaryAsserted === true,
      deployBoundaryAsserted: phaseResult.deployBoundaryAsserted === true,
      semanticClaimBoundaryAsserted: phaseResult.semanticClaimBoundaryAsserted === true,
    };
  }
  if (key === "phase1213") {
    return {
      completed: phaseResult.completed === true,
      operatorUxCopyPolished: phaseResult.operatorUxCopyPolished === true,
      dryRunMeaningClear: phaseResult.dryRunMeaningClear === true,
      candidateMeaningClear: phaseResult.candidateMeaningClear === true,
      notMainChainClear: phaseResult.notMainChainClear === true,
      notProviderCallClear: phaseResult.notProviderCallClear === true,
      notRealSemanticValidationClear: phaseResult.notRealSemanticValidationClear === true,
    };
  }
  if (key === "phase1214") {
    return {
      completed: phaseResult.completed === true,
      internalTrialPackGenerated: phaseResult.internalTrialPackGenerated === true,
      feedbackFormGenerated: phaseResult.feedbackFormGenerated === true,
      comprehensionChecklistGenerated: phaseResult.comprehensionChecklistGenerated === true,
      operatorNotesTemplateGenerated: phaseResult.operatorNotesTemplateGenerated === true,
      realHumanFeedbackCollectedFalse: phaseResult.realHumanFeedbackCollected === false,
      codexSelfTestCountedAsHumanFeedbackFalse: phaseResult.codexSelfTestCountedAsHumanFeedback === false,
    };
  }
  return {
    completed: phaseResult.completed === true,
    dryRunDemonstrationClosureGenerated: phaseResult.dryRunDemonstrationClosureGenerated === true,
    phase1201To1215TraceMapGenerated: phaseResult.phase1201To1215TraceMapGenerated === true,
    demoNarrativeGenerated: phaseResult.demoNarrativeGenerated === true,
    knownLimitsDocumented: phaseResult.knownLimitsDocumented === true,
  };
}

function renderPhaseDoc(key, phaseResult, validation) {
  return `# ${phaseResult.phase} ${phaseTitle(key)}

## Status

- completed=${phaseResult.completed}
- recommended_sealed=${phaseResult.recommended_sealed}
- blocker=${phaseResult.blocker ?? "null"}

## Outputs

${renderPhaseOutputs(key, phaseResult)}

## Validation

${Object.entries(validation.checks).map(([name, passed]) => `- ${name}=${passed}`).join("\n")}

## Boundary

- providerCallsMade=false
- secretRead=false
- authJsonRead=false
- gloveDownloaded=false
- chatModified=false
- chatGatewayExecuteModified=false
- deployExecuted=false
- realSemanticValidationClaimed=false
- syntheticOnly=true
`;
}

function renderPhaseOutputs(key, phaseResult) {
  if (key === "phase1211") {
    return [
      `- scenarioMatrixGenerated=${phaseResult.scenarioMatrixGenerated}`,
      `- scenarioCount=${phaseResult.scenarioCount}`,
      `- coversProviderRisk=${phaseResult.coversProviderRisk}`,
      `- coversSecretRisk=${phaseResult.coversSecretRisk}`,
      `- coversChatRequest=${phaseResult.coversChatRequest}`,
      `- coversChatGatewayExecuteRequest=${phaseResult.coversChatGatewayExecuteRequest}`,
      `- coversDeployRequest=${phaseResult.coversDeployRequest}`,
      `- coversCostConstraint=${phaseResult.coversCostConstraint}`,
      `- coversCapabilityCandidateTask=${phaseResult.coversCapabilityCandidateTask}`,
    ].join("\n");
  }
  if (key === "phase1212") {
    return [
      `- boundaryHardeningVerifierGenerated=${phaseResult.boundaryHardeningVerifierGenerated}`,
      `- providerBoundaryAsserted=${phaseResult.providerBoundaryAsserted}`,
      `- secretBoundaryAsserted=${phaseResult.secretBoundaryAsserted}`,
      `- chatBoundaryAsserted=${phaseResult.chatBoundaryAsserted}`,
      `- chatGatewayExecuteBoundaryAsserted=${phaseResult.chatGatewayExecuteBoundaryAsserted}`,
      `- deployBoundaryAsserted=${phaseResult.deployBoundaryAsserted}`,
      `- semanticClaimBoundaryAsserted=${phaseResult.semanticClaimBoundaryAsserted}`,
    ].join("\n");
  }
  if (key === "phase1213") {
    return [
      `- operatorUxCopyPolished=${phaseResult.operatorUxCopyPolished}`,
      `- dryRunMeaningClear=${phaseResult.dryRunMeaningClear}`,
      `- candidateMeaningClear=${phaseResult.candidateMeaningClear}`,
      `- notMainChainClear=${phaseResult.notMainChainClear}`,
      `- notProviderCallClear=${phaseResult.notProviderCallClear}`,
      `- notRealSemanticValidationClear=${phaseResult.notRealSemanticValidationClear}`,
    ].join("\n");
  }
  if (key === "phase1214") {
    return [
      `- internalTrialPackGenerated=${phaseResult.internalTrialPackGenerated}`,
      `- feedbackFormGenerated=${phaseResult.feedbackFormGenerated}`,
      `- comprehensionChecklistGenerated=${phaseResult.comprehensionChecklistGenerated}`,
      `- operatorNotesTemplateGenerated=${phaseResult.operatorNotesTemplateGenerated}`,
      `- realHumanFeedbackCollected=${phaseResult.realHumanFeedbackCollected}`,
      `- codexSelfTestCountedAsHumanFeedback=${phaseResult.codexSelfTestCountedAsHumanFeedback}`,
    ].join("\n");
  }
  return [
    `- dryRunDemonstrationClosureGenerated=${phaseResult.dryRunDemonstrationClosureGenerated}`,
    `- phase1201To1215TraceMapGenerated=${phaseResult.phase1201To1215TraceMapGenerated}`,
    `- demoNarrativeGenerated=${phaseResult.demoNarrativeGenerated}`,
    `- knownLimitsDocumented=${phaseResult.knownLimitsDocumented}`,
  ].join("\n");
}

function renderClosureDoc(result) {
  return `# Phase1211-1215 Taiji / Beidou Dry-run Stabilization

## Goal

Stabilize the Phase1201-1210 Taiji / Beidou synthetic dry-run capability candidate loop into a demonstrable, read-only closure.

## Status

- completed=${result.completed}
- recommended_sealed=${result.recommended_sealed}
- blocker=${result.blocker ?? "null"}
- allRecommendedSealed=${result.allRecommendedSealed}
- allBlockersNull=${result.allBlockersNull}
- dryRunLoopStable=${result.dryRunLoopStable}
- demonstrationClosureReady=${result.demonstrationClosureReady}
- realHumanFeedbackCollected=${result.realHumanFeedbackCollected}

## Phase Outputs

- Phase1211 scenarioMatrixGenerated=${result.phase1211.scenarioMatrixGenerated}, scenarioCount=${result.phase1211.scenarioCount}
- Phase1212 boundaryHardeningVerifierGenerated=${result.phase1212.boundaryHardeningVerifierGenerated}
- Phase1213 operatorUxCopyPolished=${result.phase1213.operatorUxCopyPolished}
- Phase1214 internalTrialPackGenerated=${result.phase1214.internalTrialPackGenerated}
- Phase1215 dryRunDemonstrationClosureGenerated=${result.phase1215.dryRunDemonstrationClosureGenerated}

## Boundary

- providerCallsMade=false
- secretRead=false
- authJsonRead=false
- gloveDownloaded=false
- chatModified=false
- chatGatewayExecuteModified=false
- deployExecuted=false
- releaseExecuted=false
- tagCreated=false
- artifactUploaded=false
- commitCreated=false
- pushExecuted=false
- workspaceCleanClaimed=false
- realSemanticValidationClaimed=false
- syntheticOnly=true

## Conclusion

Phase1211-1215 is a synthetic dry-run stabilization and demonstration closure only. It does not enter the main chain, does not modify /chat or /chat-gateway/execute, does not call providers, does not read secrets, and does not claim real semantic validation.
`;
}

function renderExecutionReport(result) {
  return `# Phase1211-1215 Execution Report

A. Completed: ${result.completed}
B. Recommended sealed: ${result.recommended_sealed}
C. blocker: ${result.blocker ?? "null"}

D. Phase range: Phase1211-Phase1215-AIO

E. Phase status:
Phase1211: completed=${result.phase1211.completed}, recommended_sealed=${result.phase1211.recommended_sealed}, blocker=${result.phase1211.blocker ?? "null"}
Phase1212: completed=${result.phase1212.completed}, recommended_sealed=${result.phase1212.recommended_sealed}, blocker=${result.phase1212.blocker ?? "null"}
Phase1213: completed=${result.phase1213.completed}, recommended_sealed=${result.phase1213.recommended_sealed}, blocker=${result.phase1213.blocker ?? "null"}
Phase1214: completed=${result.phase1214.completed}, recommended_sealed=${result.phase1214.recommended_sealed}, blocker=${result.phase1214.blocker ?? "null"}
Phase1215: completed=${result.phase1215.completed}, recommended_sealed=${result.phase1215.recommended_sealed}, blocker=${result.phase1215.blocker ?? "null"}

F. Added capability:
1. Scenario Matrix Expansion
2. Regression + Boundary Hardening
3. Operator UX Copy Polish
4. Internal Trial Pack
5. Dry-run Demonstration Closure

G. Evidence:
- ${result.phaseEvidenceRefs.phase1211.result}
- ${result.phaseEvidenceRefs.phase1212.result}
- ${result.phaseEvidenceRefs.phase1213.result}
- ${result.phaseEvidenceRefs.phase1214.result}
- ${result.phaseEvidenceRefs.phase1215.result}
- apps/ai-gateway-service/evidence/phase1211-1215-taiji-beidou-dry-run-stabilization/taiji-beidou-dry-run-stabilization-result.json

H. Boundary:
- providerCallsMade=false
- secretRead=false
- authJsonRead=false
- gloveDownloaded=false
- chatModified=false
- chatGatewayExecuteModified=false
- deployExecuted=false
- realSemanticValidationClaimed=false
- realHumanFeedbackCollected=false
`;
}

function phaseTitle(key) {
  return {
    phase1211: "Taiji / Beidou Scenario Matrix Expansion",
    phase1212: "Taiji / Beidou Regression + Boundary Hardening",
    phase1213: "Taiji / Beidou Operator UX Copy Polish",
    phase1214: "Taiji / Beidou Internal Trial Pack",
    phase1215: "Taiji / Beidou Dry-run Demonstration Closure",
  }[key];
}
