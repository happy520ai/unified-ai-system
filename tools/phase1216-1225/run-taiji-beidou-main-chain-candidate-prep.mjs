import {
  buildTaijiBeidouMainChainCandidatePrep,
} from "../../packages/taiji-beidou-engine/src/mainChainCandidateGate.js";
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
} from "./phase1216-1225-common.mjs";

const upstreamClosurePath = `${repoRoot}/apps/ai-gateway-service/evidence/phase1211-1215-taiji-beidou-dry-run-stabilization/taiji-beidou-dry-run-stabilization-result.json`;
const upstreamClosure = await readJsonIfExists(upstreamClosurePath, null);
const prep = buildTaijiBeidouMainChainCandidatePrep({ upstreamClosure });

const phaseEvidenceRefs = {};
const phaseDocsRefs = {};

for (const key of phaseKeys) {
  const phaseResult = prep[key];
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
    expectedBlocker: phaseResult.blocker === "expected_authorization_gate" ? "expected_authorization_gate" : null,
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
  ...prep,
  phaseEvidenceRefs,
  phaseDocsRefs,
  upstreamEvidenceRef: "apps/ai-gateway-service/evidence/phase1211-1215-taiji-beidou-dry-run-stabilization/taiji-beidou-dry-run-stabilization-result.json",
  docsRef: "docs/phase1216-1225-taiji-beidou-main-chain-candidate-prep.md",
  executionReportRef: "docs/phase1216-1225-execution-report.md",
  validationRef: "apps/ai-gateway-service/evidence/phase1216-1225-taiji-beidou-main-chain-candidate-prep/taiji-beidou-main-chain-candidate-prep-validation-result.json",
};

await writeJson(resultPath, result);
await writeText(docsPath, renderClosureDoc(result));
await writeText(executionReportPath, renderExecutionReport(result));
await writeJson(validationPath, {
  phase: result.phase,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  expectedBlocker: result.phase1225.authorizationMissing === true ? "expected_authorization_gate" : null,
  note: "Initial runner validation summary. The dedicated validator rewrites this file with full checks.",
});

console.log(JSON.stringify({
  phase: result.phase,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  expectedBlocker: result.phase1225.authorizationMissing === true ? "expected_authorization_gate" : null,
}, null, 2));

if (!result.completed) process.exitCode = 1;

function buildPhaseChecks(key, phaseResult) {
  const base = {
    completed: phaseResult.completed === true,
    recommendedSealed: phaseResult.recommended_sealed === true,
    blockerAccepted: phaseResult.blocker === null || phaseResult.blocker === "expected_authorization_gate",
  };
  if (key === "phase1216") {
    return {
      ...base,
      contractDefined: phaseResult.taijiBeidouMainChainCandidateContractDefined === true,
      mainChainCandidateContractReady: phaseResult.mainChainCandidateContractReady === true,
    };
  }
  if (key === "phase1217") {
    return {
      ...base,
      noFlagRegressionBaselineGenerated: phaseResult.noFlagRegressionBaselineGenerated === true,
      noFlagRegressionBaselinePassed: phaseResult.noFlagRegressionBaselinePassed === true,
      requiredFlagsDefaultFalse: phaseResult.requiredFlags?.TAIJI_BEIDOU_SHADOW_ENABLED === false
        && phaseResult.requiredFlags?.TAIJI_BEIDOU_MAIN_CHAIN_CANDIDATE_ENABLED === false,
    };
  }
  if (key === "phase1218") {
    return {
      ...base,
      shadowAdapterDesigned: phaseResult.shadowAdapterDesigned === true,
      shadowAdapterReady: phaseResult.shadowAdapterReady === true,
      defaultEnabledFalse: phaseResult.adapterDesign?.defaultEnabled === false,
    };
  }
  if (key === "phase1219") {
    return {
      ...base,
      shadowAdapterImplemented: phaseResult.shadowAdapterImplemented === true,
      shadowAdapterDefaultEnabledFalse: phaseResult.shadowAdapterDefaultEnabled === false,
      flagGated: phaseResult.flagGated === true,
      blockedProbeDidNotExecute: phaseResult.blockedProbe?.testExecuted === false,
    };
  }
  if (key === "phase1220") {
    return {
      ...base,
      rollbackVerifierGenerated: phaseResult.rollbackVerifierGenerated === true,
      rollbackPlanExists: phaseResult.rollbackPlanExists === true,
      disableSwitchExists: phaseResult.disableSwitchExists === true,
      rollbackReady: phaseResult.rollbackReady === true,
    };
  }
  if (key === "phase1221") {
    return {
      ...base,
      approvalGateGenerated: phaseResult.approvalGateGenerated === true,
      ownerApprovedFalse: phaseResult.ownerApproved === false,
      mainChainIntegrationAllowedFalse: phaseResult.mainChainIntegrationAllowed === false,
      providerCallAllowedFalse: phaseResult.providerCallAllowed === false,
      chatModificationAllowedFalse: phaseResult.chatModificationAllowed === false,
      chatGatewayExecuteModificationAllowedFalse: phaseResult.chatGatewayExecuteModificationAllowed === false,
      deploymentAllowedFalse: phaseResult.deploymentAllowed === false,
    };
  }
  if (key === "phase1222") {
    return {
      ...base,
      chatCandidateGateDesignReady: phaseResult.chatCandidateGateDesignReady === true,
      chatDefaultChangedFalse: phaseResult.chatDefaultChanged === false,
      designOnly: phaseResult.designOnly === true,
    };
  }
  if (key === "phase1223") {
    return {
      ...base,
      chatGatewayExecuteCandidateGateDesignReady: phaseResult.chatGatewayExecuteCandidateGateDesignReady === true,
      chatGatewayExecuteDefaultChangedFalse: phaseResult.chatGatewayExecuteDefaultChanged === false,
      designOnly: phaseResult.designOnly === true,
    };
  }
  if (key === "phase1224") {
    return {
      ...base,
      testPlanGenerated: phaseResult.testPlanGenerated === true,
      testCommandPreviewGenerated: phaseResult.testCommandPreviewGenerated === true,
      rollbackCommandPreviewGenerated: phaseResult.rollbackCommandPreviewGenerated === true,
      testExecutedFalse: phaseResult.testExecuted === false,
    };
  }
  return {
    ...base,
    expectedAuthorizationGate: phaseResult.blocker === "expected_authorization_gate",
    authorizationMissing: phaseResult.authorizationMissing === true,
    ownerApprovedFalse: phaseResult.ownerApproved === false,
    testExecutedFalse: phaseResult.testExecuted === false,
    mainChainIntegrationExecutedFalse: phaseResult.mainChainIntegrationExecuted === false,
    providerCallsMadeFalse: phaseResult.providerCallsMade === false,
  };
}

function renderPhaseDoc(key, phaseResult, validation) {
  return `# ${phaseResult.phase} ${phaseEvidence[key].title}

## Status

- completed=${phaseResult.completed}
- recommended_sealed=${phaseResult.recommended_sealed}
- blocker=${phaseResult.blocker ?? "null"}
- expectedBlocker=${validation.expectedBlocker ?? "null"}

## Outputs

${renderPhaseOutputs(phaseResult)}

## Validation

${Object.entries(validation.checks).map(([name, passed]) => `- ${name}=${passed}`).join("\n")}

## Boundary

- providerCallsMade=false
- secretRead=false
- authJsonRead=false
- gloveDownloaded=false
- chatModified=false
- chatDefaultChanged=false
- chatGatewayExecuteModified=false
- chatGatewayExecuteDefaultChanged=false
- mainChainIntegrationExecuted=false
- shadowAdapterDefaultEnabled=false
- testExecuted=false
- deployExecuted=false
- realSemanticValidationClaimed=false
- syntheticOnly=true
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
  return `# Phase1216-1225 Taiji / Beidou Main-chain Candidate Prep

## Goal

Define Taiji / Beidou as a main-chain candidate layer with a reviewable contract, no-flag regression baseline, default-off shadow adapter, flag gate, rollback plan, approval review, candidate gate designs for /chat and /chat-gateway/execute, shadow test preparation, and an authorization gate.

## Status

- completed=${result.completed}
- recommended_sealed=${result.recommended_sealed}
- blocker=${result.blocker ?? "null"}
- mainChainCandidateContractReady=${result.mainChainCandidateContractReady}
- shadowAdapterReady=${result.shadowAdapterReady}
- shadowAdapterDefaultEnabled=${result.shadowAdapterDefaultEnabled}
- flagGated=${result.flagGated}
- rollbackReady=${result.rollbackReady}
- approvalGateReady=${result.approvalGateReady}
- testExecuted=${result.testExecuted}

## Phase Outputs

- Phase1216: Main-chain Candidate Contract Design
- Phase1217: No-flag Regression Baseline
- Phase1218: Shadow Runtime Adapter Design
- Phase1219: Flag-gated Shadow Adapter Implementation
- Phase1220: Shadow Adapter Verifier + Rollback
- Phase1221: Main-chain Entry Approval Review
- Phase1222: /chat Candidate Gate Design
- Phase1223: /chat-gateway/execute Candidate Gate Design
- Phase1224: Guarded Main-chain Shadow Test Preparation
- Phase1225: Guarded Main-chain Shadow Test Authorization Gate

## Default Flags

- TAIJI_BEIDOU_SHADOW_ENABLED=false
- TAIJI_BEIDOU_MAIN_CHAIN_CANDIDATE_ENABLED=false

## Boundary

- providerCallsMade=false
- secretRead=false
- authJsonRead=false
- gloveDownloaded=false
- chatModified=false
- chatDefaultChanged=false
- chatGatewayExecuteModified=false
- chatGatewayExecuteDefaultChanged=false
- mainChainIntegrationExecuted=false
- mainChainDefaultEnabled=false
- providerRuntimeEnabled=false
- deployExecuted=false
- releaseExecuted=false
- tagCreated=false
- artifactUploaded=false
- commitCreated=false
- pushExecuted=false
- workspaceCleanClaimed=false
- realSemanticValidationClaimed=false
- syntheticOnly=true

## Phase1225 Authorization Gate Conclusion

Phase1225 stops at the authorization gate. authorizationMissing=true, ownerApproved=false, testExecuted=false, and realShadowTestExecuted=false. A future Phase1226-1235 requires explicit owner authorization before any real shadow test, provider call, secret access, main-chain integration, /chat default change, or /chat-gateway/execute default change.
`;
}

function renderExecutionReport(result) {
  return `# Phase1216-1225 Execution Report

A. Completed: ${result.completed}
B. Recommended sealed: ${result.recommended_sealed}
C. blocker: ${result.blocker ?? "null"}
D. expected authorization gate: ${result.phase1225.authorizationMissing === true ? "expected_authorization_gate" : "null"}

E. Phase status:
Phase1216: completed=${result.phase1216.completed}, recommended_sealed=${result.phase1216.recommended_sealed}, blocker=${result.phase1216.blocker ?? "null"}
Phase1217: completed=${result.phase1217.completed}, recommended_sealed=${result.phase1217.recommended_sealed}, blocker=${result.phase1217.blocker ?? "null"}
Phase1218: completed=${result.phase1218.completed}, recommended_sealed=${result.phase1218.recommended_sealed}, blocker=${result.phase1218.blocker ?? "null"}
Phase1219: completed=${result.phase1219.completed}, recommended_sealed=${result.phase1219.recommended_sealed}, blocker=${result.phase1219.blocker ?? "null"}
Phase1220: completed=${result.phase1220.completed}, recommended_sealed=${result.phase1220.recommended_sealed}, blocker=${result.phase1220.blocker ?? "null"}
Phase1221: completed=${result.phase1221.completed}, recommended_sealed=${result.phase1221.recommended_sealed}, blocker=${result.phase1221.blocker ?? "null"}
Phase1222: completed=${result.phase1222.completed}, recommended_sealed=${result.phase1222.recommended_sealed}, blocker=${result.phase1222.blocker ?? "null"}
Phase1223: completed=${result.phase1223.completed}, recommended_sealed=${result.phase1223.recommended_sealed}, blocker=${result.phase1223.blocker ?? "null"}
Phase1224: completed=${result.phase1224.completed}, recommended_sealed=${result.phase1224.recommended_sealed}, blocker=${result.phase1224.blocker ?? "null"}
Phase1225: completed=${result.phase1225.completed}, recommended_sealed=${result.phase1225.recommended_sealed}, blocker=${result.phase1225.blocker ?? "null"}

F. Evidence:
${Object.values(result.phaseEvidenceRefs).map((ref) => `- ${ref.result}`).join("\n")}
- apps/ai-gateway-service/evidence/phase1216-1225-taiji-beidou-main-chain-candidate-prep/taiji-beidou-main-chain-candidate-prep-result.json

G. Boundary:
- providerCallsMade=false
- secretRead=false
- authJsonRead=false
- chatDefaultChanged=false
- chatGatewayExecuteDefaultChanged=false
- mainChainIntegrationExecuted=false
- shadowAdapterDefaultEnabled=false
- testExecuted=false
- deployExecuted=false
- commitCreated=false
- pushExecuted=false
- workspaceCleanClaimed=false

H. Phase1225 authorization gate:
authorizationMissing=${result.phase1225.authorizationMissing}
ownerApproved=${result.phase1225.ownerApproved}
testExecuted=${result.phase1225.testExecuted}
mainChainIntegrationExecuted=${result.phase1225.mainChainIntegrationExecuted}
providerCallsMade=${result.phase1225.providerCallsMade}
`;
}
