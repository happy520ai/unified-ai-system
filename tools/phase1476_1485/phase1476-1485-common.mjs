import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const phaseRange = "Phase1476-1485AIO";
export const routeChoice = "local_self_use_only";
export const evidenceDir = "apps/ai-gateway-service/evidence/phase1476_1485";

export const paths = Object.freeze({
  phase1476: `${evidenceDir}/phase1476-concept-field-critical-audit.json`,
  phase1477: `${evidenceDir}/phase1477-field-snapshot-vs-token-replay-benchmark.json`,
  phase1478: `${evidenceDir}/phase1478-tianshu-route-affinity-dry-run.json`,
  phase1479: `${evidenceDir}/phase1479-god-mode-field-arbitration-dry-run.json`,
  phase1480: `${evidenceDir}/phase1480-security-risk-field-dry-run.json`,
  phase1481: `${evidenceDir}/phase1481-evidence-memory-field-snapshot-integration.json`,
  phase1482: `${evidenceDir}/phase1482-context-gateway-token-reduction-benchmark.json`,
  phase1483: `${evidenceDir}/phase1483-sleep-consolidation-candidate-dry-run.json`,
  phase1484: `${evidenceDir}/phase1484-failure-drift-hallucination-audit.json`,
  phase1485: `${evidenceDir}/phase1485-concept-field-experimental-seal.json`,
  validation: `${evidenceDir}/phase1476-1485-validation-result.json`,
});

export const boundary = Object.freeze({
  syntheticVectorsOnly: true,
  gloveDownloadExecuted: false,
  externalDatasetLoaded: false,
  externalNetworkUsed: false,
  providerCallsMade: false,
  paidProviderCalled: false,
  openAiCalled: false,
  claudeCalled: false,
  openRouterCalled: false,
  mimoCalled: false,
  rawSecretRead: false,
  secretValueExposed: false,
  tokenValueExposed: false,
  webhookValueExposed: false,
  rawCredentialRefRead: false,
  authJsonRead: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  realSemanticValidationClaimed: false,
  productionReadyClaimed: false,
  agiClaimed: false,
  llmReplacementClaimed: false,
  trillionModelSurpassClaimed: false,
  manualHumanTestClaimed: false,
  workspaceCleanClaimed: false,
});

export const cases = Object.freeze([
  {
    caseId: "tianshu-route-scoring",
    title: "Tianshu route scoring example",
    input: {
      inputConcepts: ["tianshu", "route"],
      positiveSources: [{ concept: "planner", weight: 1 }, { concept: "dryRun", weight: 0.8 }],
      negativeSources: [{ concept: "providerBypass", weight: 1 }],
      neutralSources: [{ concept: "ownerLedger", weight: 0.5 }],
      routeContext: { mode: "tianshu", route: "planner-preview", localSelfUseOnly: true },
      evidenceRefs: [paths.phase1477],
      riskSignals: ["provider-runtime-not-connected"],
      seed: "phase1476-1485-tianshu-route",
      maxIterations: 4,
    },
  },
  {
    caseId: "god-mode-arbitration",
    title: "God Mode field arbitration example",
    input: {
      inputConcepts: ["godMode", "coherence"],
      positiveSources: [{ concept: "synthesis", weight: 1 }, { concept: "evidence", weight: 0.9 }],
      negativeSources: [{ concept: "noise", weight: 0.7 }, { concept: "deployRisk", weight: 0.5 }],
      neutralSources: [{ concept: "dryRun", weight: 0.5 }],
      routeContext: { mode: "god-mode", arbitration: "synthetic-only" },
      evidenceRefs: [paths.phase1479],
      riskSignals: ["runtime-gate-required"],
      seed: "phase1476-1485-god-arbitration",
      maxIterations: 4,
    },
  },
  {
    caseId: "security-risk-field",
    title: "Security Shield risk field example",
    input: {
      inputConcepts: ["securityShield", "route"],
      positiveSources: [{ concept: "securityShield", weight: 1 }, { concept: "rollback", weight: 0.6 }],
      negativeSources: [{ concept: "secretLeak", weight: 1 }, { concept: "providerBypass", weight: 1 }],
      neutralSources: [{ concept: "evidence", weight: 0.4 }],
      routeContext: { mode: "security-shield", forbidden: ["secret", "provider-bypass"] },
      evidenceRefs: ["apps/ai-gateway-service/evidence/phase-107a-secret-safety.json"],
      riskSignals: ["secret-read-blocked", "provider-bypass-blocked"],
      seed: "phase1476-1485-security-risk",
      maxIterations: 4,
    },
  },
  {
    caseId: "evidence-memory-snapshot",
    title: "Evidence memory field snapshot example",
    input: {
      inputConcepts: ["evidence", "compression"],
      positiveSources: [{ concept: "ownerLedger", weight: 0.8 }, { concept: "coherence", weight: 0.7 }],
      negativeSources: [{ concept: "stale", weight: 0.8 }],
      neutralSources: [{ concept: "dryRun", weight: 0.4 }],
      routeContext: { mode: "evidence-replay", compression: "bounded" },
      evidenceRefs: [paths.phase1481, paths.phase1482],
      riskSignals: ["stale-context-guard"],
      seed: "phase1476-1485-evidence-memory",
      maxIterations: 4,
    },
  },
]);

export function benchmarkCases() {
  return cases.map((entry) => ({ caseId: entry.caseId, input: entry.input }));
}

export function readJson(relativePath, fallback = null) {
  try {
    return JSON.parse(readFileSync(resolve(repoRoot, relativePath), "utf8"));
  } catch {
    return fallback;
  }
}

export function readText(relativePath, fallback = "") {
  try {
    return readFileSync(resolve(repoRoot, relativePath), "utf8");
  } catch {
    return fallback;
  }
}

export function writeJson(relativePath, value) {
  const absolutePath = resolve(repoRoot, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function writeText(relativePath, value) {
  const absolutePath = resolve(repoRoot, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, value, "utf8");
}

export function phaseResult(phase, payload = {}) {
  return {
    phase,
    phaseRange,
    routeChoice,
    completed: true,
    recommended_sealed: true,
    blocker: null,
    ...boundary,
    ...payload,
  };
}

export function findBlocker(checks) {
  return Object.entries(checks).find(([, passed]) => passed !== true)?.[0] ?? null;
}
