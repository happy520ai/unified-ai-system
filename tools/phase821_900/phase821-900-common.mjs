import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildModelCapabilityIndex,
} from "../../packages/model-routing-engine/src/index.js";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

export function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

export function ensurePhaseDirs() {
  for (const dir of [
    "tools/phase821_900",
    "docs/phase821-900",
    "apps/ai-gateway-service/evidence/phase821_840",
    "apps/ai-gateway-service/evidence/phase841_860",
    "apps/ai-gateway-service/evidence/phase861_880",
    "apps/ai-gateway-service/evidence/phase881_900",
    "apps/ai-gateway-service/evidence/phase821_900",
    "model-routing/runtime",
    "model-routing/evidence",
    "model-routing/quality",
    "model-routing/learning",
    "model-routing/approvals",
  ]) {
    mkdirSync(repoPath(dir), { recursive: true });
  }
}

export function readJson(relativePath) {
  return JSON.parse(readFileSync(repoPath(relativePath), "utf8"));
}

export function readJsonIfPresent(relativePath) {
  const path = repoPath(relativePath);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

export function writeJson(relativePath, value) {
  const path = repoPath(relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

export function writeText(relativePath, value) {
  const path = repoPath(relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${value.trim()}\n`, "utf8");
  return path;
}

export function baseSafety() {
  return {
    secretRead: false,
    rawSecretRead: false,
    authJsonRead: false,
    secretValueExposed: false,
    credentialRefOnly: true,
    chatBehaviorChangedByDefault: false,
    chatGatewayExecuteBehaviorChangedByDefault: false,
    chatDefaultEnabled: false,
    chatGatewayExecuteDefaultEnabled: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    pushExecuted: false,
    commitCreated: false,
    workspaceCleanClaimed: false,
  };
}

export function loadPriorEvidence() {
  return {
    phase761: readJson("apps/ai-gateway-service/evidence/phase761_780/global-model-library-expansion-final-result.json"),
    phase781: readJson("apps/ai-gateway-service/evidence/phase781_800/user-owned-provider-expansion-final-result.json"),
    phase801: readJson("apps/ai-gateway-service/evidence/phase801_820/task-pressure-mode-routing-final-result.json"),
    usabilityMatrix: readJsonIfPresent("apps/ai-gateway-service/evidence/phase-313a-model-usability-matrix.json") || {},
    verificationState: readJsonIfPresent("apps/ai-gateway-service/evidence/phase-313a-model-verification-state.json") || {},
    globalSeed: readJsonIfPresent("apps/ai-gateway-service/evidence/model-library/global-catalog-seed.json") || {},
  };
}

export function loadCapabilityIndex() {
  const evidence = loadPriorEvidence();
  return buildModelCapabilityIndex({
    usabilityMatrix: evidence.usabilityMatrix,
    verificationState: evidence.verificationState,
    globalSeed: evidence.globalSeed,
  });
}

export function loadCredentialState() {
  const readiness = readJsonIfPresent("apps/ai-gateway-service/evidence/phase781_800/provider-credential-readiness-gate-result.json");
  const phase821900Approval = readJsonIfPresent("model-routing/approvals/phase821_900-real-route-execution.input.json");
  if (phase821900Approval?.credentialRef && phase821900Approval?.credentialRefOnly === true) {
    return {
      credentialReady: true,
      credentialRef: phase821900Approval.credentialRef,
      credentialRefPresent: true,
      readinessStatus: "credential_ready",
      failures: [],
    };
  }
  return {
    credentialReady: readiness?.credentialReady === true,
    credentialRef: readiness?.credentialRef || null,
    credentialRefPresent: readiness?.credentialRefPresent === true,
    readinessStatus: readiness?.readinessStatus || "credential_missing",
    failures: readiness?.failures || ["credential_ref_missing"],
  };
}

export function loadRouteAuthorization() {
  const approval = readJsonIfPresent("model-routing/approvals/phase821_900-real-route-execution.input.json")
    || readJsonIfPresent("model-routing/approvals/phase821_840-real-route-execution.input.json");
  return approval || {
    allowGuardedRealProviderRoute: true,
    allowProviderCall: true,
    allowCodexSurrogateTesting: true,
    allowHumanTestSimulation: false,
    allowForgeHumanFeedback: false,
    allowDeploy: false,
    allowRelease: false,
    allowTag: false,
    allowArtifactUpload: false,
    allowPushCommit: false,
    allowRawSecretRead: false,
    allowAuthJsonRead: false,
    allowCodexConfigMutation: false,
    allowChatDefaultEnable: false,
    allowChatGatewayExecuteDefaultEnable: false,
    maxTotalProviderRequests: 30,
    maxRequestsPerMode: 4,
    maxRequestsPerModel: 3,
    maxRetriesPerRequest: 0,
    maxEstimatedCostUsdTotal: 1,
    maxRuntimeMinutes: 60,
    allowedRuntimeMode: "guarded_self_use_only",
  };
}

export function phaseDoc({ phase, title, goal, facts = [], boundaries = [], outputs = [] }) {
  return `# ${phase} ${title}

## Goal

${goal}

## Verified facts

${facts.map((item) => `- ${item}`).join("\n")}

## Boundaries

${boundaries.map((item) => `- ${item}`).join("\n")}

## Outputs

${outputs.map((item) => `- ${item}`).join("\n")}

## Non-claims

- Codex surrogate testing is not human testing.
- Accelerated surrogate soak is not seven-day or thirty-day production soak.
- Route dry-run is not a Provider call.
- Real Provider route execution is blocked unless CredentialRef-only and budget gates pass.
- This phase does not change default /chat or /chat-gateway/execute behavior.
`;
}

export function writePhaseDoc(name, body) {
  return writeText(`docs/phase821-900/${name}`, body);
}
