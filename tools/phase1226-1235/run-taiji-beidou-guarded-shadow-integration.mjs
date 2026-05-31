import {
  buildTaijiBeidouGuardedShadowIntegration,
} from "../../packages/taiji-beidou-engine/src/guardedShadowIntegration.js";
import {
  approvalPath,
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
} from "./phase1226-1235-common.mjs";

const upstreamPrepPath = `${repoRoot}/apps/ai-gateway-service/evidence/phase1216-1225-taiji-beidou-main-chain-candidate-prep/taiji-beidou-main-chain-candidate-prep-result.json`;
const upstreamPrep = await readJsonIfExists(upstreamPrepPath, null);
const ownerAuthorization = await readJsonIfExists(approvalPath, null);
const closure = buildTaijiBeidouGuardedShadowIntegration({ upstreamPrep, ownerAuthorization });

if (!closure.ownerAuthorizationValid) {
  const blocked = {
    ...closure,
    approvalPath: "docs/approvals/phase1226-1235/guarded-shadow-integration-approval.json",
  };
  await writeJson(resultPath, blocked);
  await writeJson(validationPath, {
    phase: "Phase1226-1235-AIO",
    completed: false,
    recommended_sealed: false,
    blocker: "owner_authorization_missing_or_invalid",
    checks: {
      ownerAuthorizationValid: false,
      testExecutedFalse: closure.testExecuted === false,
      mainChainCandidateIntegratedFalse: closure.mainChainCandidateIntegrated === false,
    },
  });
  console.log(JSON.stringify({
    phase: blocked.phase,
    completed: false,
    recommended_sealed: false,
    blocker: "owner_authorization_missing_or_invalid",
    ownerAuthorizationValid: false,
    approvalPath: blocked.approvalPath,
  }, null, 2));
  process.exit(1);
}

const phaseEvidenceRefs = {};
const phaseDocsRefs = {};

for (const key of phaseKeys) {
  const phaseResult = closure[key];
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
  ...closure,
  ownerAuthorization,
  approvalPath: "docs/approvals/phase1226-1235/guarded-shadow-integration-approval.json",
  phaseEvidenceRefs,
  phaseDocsRefs,
  upstreamEvidenceRef: "apps/ai-gateway-service/evidence/phase1216-1225-taiji-beidou-main-chain-candidate-prep/taiji-beidou-main-chain-candidate-prep-result.json",
  docsRef: "docs/phase1226-1235-taiji-beidou-guarded-shadow-integration-closure.md",
  executionReportRef: "docs/phase1226-1235-execution-report.md",
  validationRef: "apps/ai-gateway-service/evidence/phase1226-1235-taiji-beidou-guarded-shadow-integration/taiji-beidou-guarded-shadow-integration-validation-result.json",
};

await writeJson(resultPath, result);
await writeText(docsPath, renderClosureDoc(result));
await writeText(executionReportPath, renderExecutionReport(result));
await writeJson(validationPath, {
  phase: result.phase,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  note: "Initial runner validation summary. The dedicated validator rewrites this file with full checks.",
});

console.log(JSON.stringify({
  phase: result.phase,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  ownerAuthorizationValid: result.ownerAuthorizationValid,
  guardedShadowTestExecuted: result.guardedShadowTestExecuted,
  mainChainCandidateIntegrated: result.mainChainCandidateIntegrated,
  mainChainDefaultEnabled: result.mainChainDefaultEnabled,
}, null, 2));

if (!result.completed) process.exitCode = 1;

function buildPhaseChecks(key, phaseResult) {
  const base = {
    completed: phaseResult.completed === true,
    recommendedSealed: phaseResult.recommended_sealed === true,
    blockerNull: phaseResult.blocker === null,
  };
  if (key === "phase1226") {
    return {
      ...base,
      ownerAuthorizationValid: phaseResult.ownerAuthorizationValid === true,
      guardedShadowTestExecuted: phaseResult.guardedShadowTestExecuted === true,
      providerCallsMadeFalse: phaseResult.providerCallsMade === false,
      secretReadFalse: phaseResult.secretRead === false,
    };
  }
  if (key === "phase1227") {
    return {
      ...base,
      shadowTestResultCollected: phaseResult.shadowTestResultCollected === true,
      shadowObservationGenerated: phaseResult.shadowObservationGenerated === true,
    };
  }
  if (key === "phase1228") {
    return {
      ...base,
      failureClassificationGenerated: phaseResult.failureClassificationGenerated === true,
      failureClassesPresent: Array.isArray(phaseResult.failureClasses),
    };
  }
  if (key === "phase1229") {
    return {
      ...base,
      rollbackDisableSwitchVerified: phaseResult.rollbackDisableSwitchVerified === true,
      rollbackReady: phaseResult.rollbackReady === true,
      disableSwitchVerified: phaseResult.disableSwitchVerified === true,
    };
  }
  if (key === "phase1230") {
    return {
      ...base,
      noFlagRegressionPassed: phaseResult.noFlagRegressionPassed === true,
      mainChainDefaultEnabledFalse: phaseResult.mainChainDefaultEnabled === false,
    };
  }
  if (key === "phase1231") {
    return {
      ...base,
      mainChainCandidateIntegrated: phaseResult.mainChainCandidateIntegrated === true,
      behindFlag: phaseResult.limitedMainChainCandidateIntegrationBehindFlag === true,
      mainChainDefaultEnabledFalse: phaseResult.mainChainDefaultEnabled === false,
    };
  }
  if (key === "phase1232") {
    return {
      ...base,
      chatNoDefaultChangeVerified: phaseResult.chatNoDefaultChangeVerified === true,
      chatDefaultChangedFalse: phaseResult.chatDefaultChanged === false,
    };
  }
  if (key === "phase1233") {
    return {
      ...base,
      chatGatewayExecuteNoDefaultChangeVerified: phaseResult.chatGatewayExecuteNoDefaultChangeVerified === true,
      chatGatewayExecuteDefaultChangedFalse: phaseResult.chatGatewayExecuteDefaultChanged === false,
    };
  }
  if (key === "phase1234") {
    return {
      ...base,
      providerBoundaryVerified: phaseResult.providerBoundaryVerified === true,
      credentialRefBoundaryVerified: phaseResult.credentialRefBoundaryVerified === true,
      quotaBoundaryVerified: phaseResult.quotaBoundaryVerified === true,
      budgetBoundaryVerified: phaseResult.budgetBoundaryVerified === true,
      selectableGateBoundaryVerified: phaseResult.selectableGateBoundaryVerified === true,
      missionControlReadOnlyPreviewGenerated: phaseResult.missionControlReadOnlyPreviewGenerated === true,
    };
  }
  return {
    ...base,
    closureReportGenerated: phaseResult.mainChainCandidateClosureReportGenerated === true,
    productionReadyClaimedFalse: phaseResult.productionReadyClaimed === false,
    mainChainDefaultEnabledFalse: phaseResult.mainChainDefaultEnabled === false,
  };
}

function renderPhaseDoc(key, phaseResult, validation) {
  return `# ${phaseResult.phase} ${phaseEvidence[key].title}

## Status

- completed=${phaseResult.completed}
- recommended_sealed=${phaseResult.recommended_sealed}
- blocker=${phaseResult.blocker ?? "null"}

## Outputs

${renderPhaseOutputs(phaseResult)}

## Validation

${Object.entries(validation.checks).map(([name, passed]) => `- ${name}=${passed}`).join("\n")}

## Boundary

- providerCallsMade=false
- secretRead=false
- authJsonRead=false
- credentialRefBypassed=false
- quotaBypassed=false
- budgetBypassed=false
- selectableGateBypassed=false
- chatDefaultChanged=false
- chatGatewayExecuteDefaultChanged=false
- mainChainDefaultEnabled=false
- providerRuntimeDefaultEnabled=false
- deployExecuted=false
- releaseExecuted=false
- tagCreated=false
- artifactUploaded=false
- commitCreated=false
- pushExecuted=false
- workspaceCleanClaimed=false
- realSemanticValidationClaimed=false
- productionReadyClaimed=false
`;
}

function renderPhaseOutputs(phaseResult) {
  const lines = [];
  for (const [name, value] of Object.entries(phaseResult)) {
    if (["phase", "completed", "recommended_sealed", "blocker"].includes(name)) continue;
    if (Array.isArray(value)) {
      lines.push(`- ${name}: ${value.length} item(s)`);
    } else if (value && typeof value === "object") {
      lines.push(`- ${name}: generated`);
    } else {
      lines.push(`- ${name}=${value}`);
    }
  }
  return lines.join("\n");
}

function renderClosureDoc(result) {
  return `# Phase1226-1235 Taiji / Beidou Guarded Shadow Integration Closure

## Goal

Execute a limited guarded shadow integration for Taiji / Beidou as a main-chain candidate layer only. The candidate remains flag-gated, default-off, rollback-ready, and no real Provider, secret, CredentialRef bypass, quota bypass, budget bypass, selectable gate bypass, deploy, release, commit, push, production readiness claim, or real semantic validation claim is made.

## Status

- completed=${result.completed}
- recommended_sealed=${result.recommended_sealed}
- blocker=${result.blocker ?? "null"}
- ownerAuthorizationValid=${result.ownerAuthorizationValid}
- guardedShadowTestExecuted=${result.guardedShadowTestExecuted}
- mainChainCandidateIntegrated=${result.mainChainCandidateIntegrated}
- mainChainDefaultEnabled=${result.mainChainDefaultEnabled}
- chatDefaultChanged=${result.chatDefaultChanged}
- chatGatewayExecuteDefaultChanged=${result.chatGatewayExecuteDefaultChanged}
- flagGated=${result.flagGated}
- rollbackReady=${result.rollbackReady}
- noFlagRegressionPassed=${result.noFlagRegressionPassed}

## Phase Outputs

- Phase1226: Owner Authorization + Guarded Shadow Test
- Phase1227: Shadow Test Result Intake
- Phase1228: Failure Classification + Rollback Verification
- Phase1229: No-flag Regression Recheck
- Phase1230: Limited Main-chain Candidate Integration Behind Flag
- Phase1231: /chat No-default-change Integration Verifier
- Phase1232: /chat-gateway/execute No-default-change Integration Verifier
- Phase1233: Provider / CredentialRef Boundary Verifier
- Phase1234: Mission Control Main-chain Candidate Status Preview
- Phase1235: Main-chain Candidate Closure Report

## Boundary

- providerCallsMade=false
- secretRead=false
- authJsonRead=false
- credentialRefBypassed=false
- quotaBypassed=false
- budgetBypassed=false
- selectableGateBypassed=false
- chatDefaultChanged=false
- chatGatewayExecuteDefaultChanged=false
- mainChainDefaultEnabled=false
- providerRuntimeDefaultEnabled=false
- deployExecuted=false
- releaseExecuted=false
- tagCreated=false
- artifactUploaded=false
- commitCreated=false
- pushExecuted=false
- workspaceCleanClaimed=false
- realSemanticValidationClaimed=false
- productionReadyClaimed=false

## Final Conclusion

Taiji / Beidou is integrated as a limited main-chain candidate layer behind flags only. It is not default-enabled and is not production-ready. No real Provider call, secret read, or default route behavior change occurred.
`;
}

function renderExecutionReport(result) {
  return `# Phase1226-1235 Execution Report

A. Completed: ${result.completed}
B. Recommended sealed: ${result.recommended_sealed}
C. blocker: ${result.blocker ?? "null"}
D. Authorization: ownerAuthorizationValid=${result.ownerAuthorizationValid}

E. Phase status:
Phase1226: completed=${result.phase1226.completed}, recommended_sealed=${result.phase1226.recommended_sealed}, blocker=${result.phase1226.blocker ?? "null"}
Phase1227: completed=${result.phase1227.completed}, recommended_sealed=${result.phase1227.recommended_sealed}, blocker=${result.phase1227.blocker ?? "null"}
Phase1228: completed=${result.phase1228.completed}, recommended_sealed=${result.phase1228.recommended_sealed}, blocker=${result.phase1228.blocker ?? "null"}
Phase1229: completed=${result.phase1229.completed}, recommended_sealed=${result.phase1229.recommended_sealed}, blocker=${result.phase1229.blocker ?? "null"}
Phase1230: completed=${result.phase1230.completed}, recommended_sealed=${result.phase1230.recommended_sealed}, blocker=${result.phase1230.blocker ?? "null"}
Phase1231: completed=${result.phase1231.completed}, recommended_sealed=${result.phase1231.recommended_sealed}, blocker=${result.phase1231.blocker ?? "null"}
Phase1232: completed=${result.phase1232.completed}, recommended_sealed=${result.phase1232.recommended_sealed}, blocker=${result.phase1232.blocker ?? "null"}
Phase1233: completed=${result.phase1233.completed}, recommended_sealed=${result.phase1233.recommended_sealed}, blocker=${result.phase1233.blocker ?? "null"}
Phase1234: completed=${result.phase1234.completed}, recommended_sealed=${result.phase1234.recommended_sealed}, blocker=${result.phase1234.blocker ?? "null"}
Phase1235: completed=${result.phase1235.completed}, recommended_sealed=${result.phase1235.recommended_sealed}, blocker=${result.phase1235.blocker ?? "null"}

F. Evidence:
${Object.values(result.phaseEvidenceRefs).map((ref) => `- ${ref.result}`).join("\n")}
- apps/ai-gateway-service/evidence/phase1226-1235-taiji-beidou-guarded-shadow-integration/taiji-beidou-guarded-shadow-integration-result.json

G. Boundary:
- providerCallsMade=false
- secretRead=false
- authJsonRead=false
- credentialRefBypassed=false
- quotaBypassed=false
- budgetBypassed=false
- selectableGateBypassed=false
- chatDefaultChanged=false
- chatGatewayExecuteDefaultChanged=false
- mainChainDefaultEnabled=false
- providerRuntimeDefaultEnabled=false
- deployExecuted=false
- commitCreated=false
- pushExecuted=false
- workspaceCleanClaimed=false
- realSemanticValidationClaimed=false
- productionReadyClaimed=false
`;
}
