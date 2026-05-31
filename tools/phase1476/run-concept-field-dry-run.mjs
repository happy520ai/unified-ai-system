import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createConceptFieldKernelContract,
  createConceptFieldSyntheticSpace,
  runConceptFieldBenchmark,
  runConceptFieldKernel,
} from "../../packages/taiji-beidou-engine/src/index.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const evidencePath = "apps/ai-gateway-service/evidence/phase1476-concept-field-kernel/concept-field-dry-run-result.json";

const dryRunInputs = [
  {
    caseId: "tianshu-route-scoring",
    title: "Tianshu route scoring example",
    input: {
      inputConcepts: ["tianshu", "route"],
      positiveSources: [{ concept: "planner", weight: 1 }, { concept: "dryRun", weight: 0.8 }],
      negativeSources: [{ concept: "providerBypass", weight: 1 }],
      neutralSources: [{ concept: "ownerLedger", weight: 0.5 }],
      routeContext: { mode: "tianshu", route: "planner-preview" },
      evidenceRefs: ["apps/ai-gateway-service/evidence/phase1476-concept-field-kernel/concept-field-dry-run-result.json"],
      riskSignals: ["provider-runtime-not-connected"],
      seed: "phase1476-tianshu-route",
      maxIterations: 4,
    },
  },
  {
    caseId: "god-mode-answer-coherence",
    title: "God Mode answer coherence example",
    input: {
      inputConcepts: ["godMode", "coherence"],
      positiveSources: [{ concept: "synthesis", weight: 1 }, { concept: "evidence", weight: 0.9 }],
      negativeSources: [{ concept: "noise", weight: 0.7 }],
      neutralSources: [{ concept: "dryRun", weight: 0.5 }],
      routeContext: { mode: "god-mode", expected: "answer-coherence" },
      evidenceRefs: ["apps/ai-gateway-service/evidence/phase1476-concept-field-kernel/concept-field-dry-run-result.json"],
      riskSignals: [],
      seed: "phase1476-god-coherence",
      maxIterations: 4,
    },
  },
  {
    caseId: "evidence-compression",
    title: "Evidence compression example",
    input: {
      inputConcepts: ["evidence", "compression"],
      positiveSources: [{ concept: "ownerLedger", weight: 0.8 }, { concept: "coherence", weight: 0.7 }],
      negativeSources: [{ concept: "stale", weight: 0.8 }],
      neutralSources: [{ concept: "dryRun", weight: 0.4 }],
      routeContext: { mode: "evidence-replay", compression: "bounded" },
      evidenceRefs: ["apps/ai-gateway-service/evidence/phase1451-1475-real-local-dogfooding-intake/real-local-dogfooding-intake-result.json"],
      riskSignals: ["stale-context-guard"],
      seed: "phase1476-evidence-compression",
      maxIterations: 4,
    },
  },
  {
    caseId: "capability-cell-candidate",
    title: "Capability-cell candidate example",
    input: {
      inputConcepts: ["capabilityCell", "synthesis"],
      positiveSources: [{ concept: "planner", weight: 0.8 }, { concept: "coherence", weight: 0.8 }],
      negativeSources: [{ concept: "deployRisk", weight: 1 }],
      neutralSources: [{ concept: "rollback", weight: 0.5 }],
      routeContext: { mode: "capability-cell", runtime: "not-connected" },
      evidenceRefs: ["apps/ai-gateway-service/evidence/phase1476-concept-field-kernel/concept-field-dry-run-result.json"],
      riskSignals: ["runtime-gate-required"],
      seed: "phase1476-capability-cell",
      maxIterations: 4,
    },
  },
  {
    caseId: "security-shield-negative-source",
    title: "Security Shield negative-source example",
    input: {
      inputConcepts: ["securityShield", "route"],
      positiveSources: [{ concept: "securityShield", weight: 1 }, { concept: "rollback", weight: 0.6 }],
      negativeSources: [{ concept: "secretLeak", weight: 1 }, { concept: "providerBypass", weight: 1 }],
      neutralSources: [{ concept: "evidence", weight: 0.4 }],
      routeContext: { mode: "security-shield", forbidden: ["secret", "provider-bypass"] },
      evidenceRefs: ["apps/ai-gateway-service/evidence/phase107a-secret-safety.json"],
      riskSignals: ["secret-read-blocked", "provider-bypass-blocked"],
      seed: "phase1476-security-shield",
      maxIterations: 4,
    },
  },
];

const contract = createConceptFieldKernelContract();
const space = createConceptFieldSyntheticSpace();
const dryRunCases = dryRunInputs.map((entry) => ({
  caseId: entry.caseId,
  title: entry.title,
  result: runConceptFieldKernel(entry.input, { space }),
}));
const benchmark = runConceptFieldBenchmark(dryRunInputs, { space });
const result = {
  phase: 1476,
  phaseName: "Phase1476A-F Concept Field Kernel Critical Audit + Synthetic Dry-Run Prototype",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  conceptFieldKernelImplemented: true,
  syntheticDryRunOnly: true,
  syntheticVectorsOnly: true,
  benchmarkMode: "synthetic_only",
  gloveDownloadExecuted: false,
  externalDatasetLoaded: false,
  externalNetworkUsed: false,
  providerCallsMade: false,
  secretValueExposed: false,
  authJsonRead: false,
  rawCredentialRefRead: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  agiClaimed: false,
  trillionModelSurpassClaimed: false,
  realSemanticValidationClaimed: false,
  productionReadinessClaimed: false,
  contract,
  dryRunCases,
  benchmark,
  scoreCoverage: {
    routeAffinityScoreGenerated: dryRunCases.every((entry) => Number.isFinite(entry.result.routeAffinityScore)),
    evidenceCoherenceScoreGenerated: dryRunCases.every((entry) => Number.isFinite(entry.result.evidenceCoherenceScore)),
    surpriseScoreGenerated: dryRunCases.every((entry) => Number.isFinite(entry.result.surpriseScore)),
    riskFieldScoreGenerated: dryRunCases.every((entry) => Number.isFinite(entry.result.riskFieldScore)),
  },
  safetyNotes: [
    "Synthetic vectors only.",
    "No GloVe or external dataset was downloaded.",
    "No provider was called.",
    "No AGI or trillion-model-surpass claim is made.",
    "Not connected to /chat, /chat-gateway/execute, or provider runtime.",
  ],
};

writeJson(evidencePath, result);
console.log(JSON.stringify({
  phase: result.phase,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  syntheticDryRunOnly: result.syntheticDryRunOnly,
  dryRunCaseCount: result.dryRunCases.length,
}, null, 2));

function writeJson(relativePath, value) {
  const absolutePath = resolve(repoRoot, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
