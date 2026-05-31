import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const finalPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase901_910/provider-call-authenticity-final-result.json");

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const requiredFiles = [
  "packages/model-routing-engine/src/providerCallAuthenticityContract.js",
  "packages/model-routing-engine/src/providerEvidenceSourceClassifier.js",
  "packages/model-routing-engine/src/networkAttemptEvidenceSchema.js",
  "packages/model-routing-engine/src/mockSimulatedDryRunDetector.js",
  "packages/model-routing-engine/src/externalProviderResponseProofGate.js",
  "packages/model-routing-engine/src/routeEvidenceReaudit.js",
  "packages/model-routing-engine/src/authenticityCorrectionLedger.js",
  "tools/phase901_910/build-provider-call-authenticity-contract.mjs",
  "tools/phase901_910/run-provider-evidence-source-classifier.mjs",
  "tools/phase901_910/build-network-attempt-evidence-schema.mjs",
  "tools/phase901_910/run-mock-simulated-dryrun-detector.mjs",
  "tools/phase901_910/run-external-provider-response-proof-gate.mjs",
  "tools/phase901_910/run-phase821-900-route-evidence-reaudit.mjs",
  "tools/phase901_910/build-authenticity-correction-ledger.mjs",
  "apps/ai-gateway-service/src/ui/components/ProviderCallAuthenticityPanel.js",
  "apps/ai-gateway-service/src/ui/copy/providerCallAuthenticityCopy.js",
  "docs/phase901-provider-call-authenticity-contract.md",
  "docs/phase910-provider-call-authenticity-final-seal.md",
];
for (const file of requiredFiles) {
  assert(existsSync(resolve(repoRoot, file)), `missing required file: ${file}`);
}
assert(existsSync(finalPath), "missing final result");
const result = JSON.parse(readFileSync(finalPath, "utf8"));
assert(result.phaseRange === "Phase901-910", "phaseRange mismatch");
assert(result.completed === true, "completed must be true");
assert(result.recommended_sealed === true, "recommended_sealed must be true");
assert(result.blocker === null, "blocker must be null");
assert(result.providerCallAuthenticityVerifierReady === true, "verifier must be ready");
assert(result.phase821900Reaudited === true, "Phase821-900 must be reaudited");
assert(typeof result.authenticityClassification === "string" && result.authenticityClassification.length > 0, "classification required");
assert(result.correctionLedgerGenerated === true, "correction ledger required");
assert(result.routeEvidenceStillUsefulForLocalExecutor === true, "local executor evidence usefulness required");
assert(result.rawSecretRead === false, "rawSecretRead must be false");
assert(result.secretValueExposed === false, "secretValueExposed must be false");
assert(result.authJsonRead === false, "authJsonRead must be false");
assert(result.chatBehaviorChangedByDefault === false, "chat default must be unchanged");
assert(result.chatGatewayExecuteBehaviorChangedByDefault === false, "execute default must be unchanged");
assert(result.deployExecuted === false, "deploy must be false");
assert(result.releaseExecuted === false, "release must be false");
assert(result.tagCreated === false, "tag must be false");
assert(result.artifactUploaded === false, "artifact must be false");
assert(result.unsupportedClaimCount === 0, "unsupported claims must be zero");
assert(result.hallucinatedFactCount === 0, "hallucinated facts must be zero");

console.log(JSON.stringify({
  phaseRange: result.phaseRange,
  passed: true,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  authenticityClassification: result.authenticityClassification,
  externalProviderApiCallConfirmed: result.externalProviderApiCallConfirmed,
  correctionRequired: result.correctionRequired,
}, null, 2));
