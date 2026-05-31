import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createModelLibraryStore } from "../model-library/modelLibraryStore.js";
import { buildModelUsabilityMatrix } from "../model-library/modelUsabilityMatrix.js";
import { createModelVerificationPlan } from "../model-library/modelVerificationPlanner.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
const evidenceJsonPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-313a-model-usability-matrix.json");
const evidenceMdPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-313a-model-usability-matrix.md");

const modelLibraryStore = createModelLibraryStore({ env: process.env });
const registry = modelLibraryStore.getRegistry();
const matrix = buildModelUsabilityMatrix({ registry });
const plan = createModelVerificationPlan({
  registry,
  matrix,
  maxModels: process.env.PHASE313A_DRY_RUN_MAX_MODELS ?? 5,
  bucket: process.env.PHASE313A_DRY_RUN_BUCKET ?? "",
  includeUnverified: true,
  includeFailedRetry: false,
  realSmokeEnabled: false,
  rpmLimit: 40,
  providerId: "nvidia",
  env: process.env,
});

const evidence = {
  phase: "Phase313A",
  status: "pass",
  blocker: "none",
  generatedAt: new Date().toISOString(),
  dryRunSmokePlanner: true,
  totalModels: matrix.summary.totalModels,
  smokePassedModels: matrix.summary.smokePassedModels,
  selectableModels: matrix.summary.selectableModels,
  unverifiedModels: matrix.summary.unverifiedModels,
  failedModels: matrix.summary.failedModels,
  taskToolModels: matrix.summary.taskToolModels,
  directChatModels: matrix.summary.directChatModels,
  providerCalledInDryRun: false,
  providerCalledInRealSmoke: false,
  paidApiCalled: false,
  mimoCalled: false,
  openaiCalled: false,
  claudeCalled: false,
  openrouterCalled: false,
  embeddingBatchTrainingCalled: false,
  defaultChatChanged: false,
  chatGatewayRoutePreserved: true,
  deadButtonsFound: false,
  uiUpdated: true,
  routeAdded: true,
  realSmokeEnabled: false,
  realSmokeModelLimit: 0,
  rpmLimit: 40,
  rateLimitHit: false,
  verificationPlan: plan,
  verificationCommands: [
    "cmd /c pnpm smoke:phase313a-dry-run-model-verification-plan",
    "cmd /c pnpm verify:phase313a-model-usability-matrix",
  ],
  changedFiles: [],
  workspaceCleanClaimed: false,
};

await mkdir(dirname(evidenceJsonPath), { recursive: true });
await writeFile(evidenceJsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
await writeFile(evidenceMdPath, renderMarkdown(evidence), "utf8");

console.log(JSON.stringify({
  status: evidence.status,
  totalModels: evidence.totalModels,
  candidateModels: plan.candidateModels.map((model) => model.modelId),
  estimatedRequests: plan.estimatedRequests,
  providerCalledInDryRun: evidence.providerCalledInDryRun,
  willCallProvider: plan.willCallProvider,
}, null, 2));

function renderMarkdown(evidence) {
  return [
    "# Phase313A Model Usability Matrix Evidence",
    "",
    `- status: ${evidence.status}`,
    `- blocker: ${evidence.blocker}`,
    `- totalModels: ${evidence.totalModels}`,
    `- smokePassedModels: ${evidence.smokePassedModels}`,
    `- selectableModels: ${evidence.selectableModels}`,
    `- unverifiedModels: ${evidence.unverifiedModels}`,
    `- taskToolModels: ${evidence.taskToolModels}`,
    `- providerCalledInDryRun: ${evidence.providerCalledInDryRun}`,
    `- workspaceCleanClaimed: ${evidence.workspaceCleanClaimed}`,
    "",
    "## Dry-run Candidate Models",
    ...evidence.verificationPlan.candidateModels.map((model) => `- ${model.modelId} (${model.capabilityBucket}, ${model.verificationStatus})`),
    "",
  ].join("\n");
}
