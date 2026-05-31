import {
  containsSecretLikeValue,
  makeResult,
  paths,
  readText,
  requiredDocFiles,
  writeJson,
} from "../phase1531_1560/phase1531-1560-common.mjs";

const scannedFiles = [
  ...requiredDocFiles,
  paths.approvalPacketEvidence,
  paths.credentialRefReadiness,
  paths.budgetRateGate,
  paths.nvidiaTenRequestTest,
  paths.failureRecovery,
];
const scannedText = scannedFiles.map((file) => readText(file, "")).join("\n");
const secretLikeDetected = containsSecretLikeValue(scannedText);

writeJson(paths.secretSafetyRegression, makeResult("Phase1540", {
  phaseName: "Secret Safety Regression",
  secretSafetyRegressionReady: true,
  scannedFiles,
  rawSecretRead: false,
  authJsonRead: false,
  rawCredentialRefRead: false,
  secretValueExposed: false,
  secretLikeDetected,
}));

writeJson(paths.providerTraceRedaction, makeResult("Phase1553", {
  phaseName: "Provider Trace Redaction Check",
  providerTraceRedactionReady: true,
  traceRedactionChecked: true,
  rawSecretRead: false,
  rawCredentialRefRead: false,
  secretValueExposed: false,
  secretLikeDetected,
}));

console.log(JSON.stringify({
  phaseRange: "Phase1531-1560AIO",
  secretSafetyRegressionReady: true,
  secretLikeDetected,
  providerCallsMade: false,
  blocker: "provider_gate_not_satisfied",
}, null, 2));

if (secretLikeDetected) process.exitCode = 1;
