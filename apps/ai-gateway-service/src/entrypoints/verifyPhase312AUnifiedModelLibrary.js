import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createModelLibraryStore } from "../model-library/modelLibraryStore.js";
import { validateModelRecord, DIRECT_CHAT_CAPABILITIES } from "../model-library/modelCapabilityRules.js";
import { listDirectChatModels, listTaskToolModels } from "../model-library/unifiedModelRegistry.js";
import { createNvidiaUnifiedClient } from "../providers/nvidia/nvidiaUnifiedClient.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
const evidenceJsonPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-312a-unified-model-library.json");
const evidenceMdPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-312a-unified-model-library.md");

const checks = [];
function expect(condition, id, detail = "") {
  checks.push({ id, pass: Boolean(condition), detail });
}

const env = {
  ...process.env,
  PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory",
};
const modelLibraryStore = createModelLibraryStore({ env });
const registry = await modelLibraryStore.refreshCatalog({ allowLiveDiscovery: true });
const nvidiaModels = registry.models.filter((model) => model.providerId === "nvidia");
const invalidCall = await createNvidiaUnifiedClient({ env, modelLibraryStore }).chatCompletion({
  modelId: "nvidia/not-a-real-phase312a-model",
  prompt: "This must be blocked before provider call.",
});

expect(Boolean(registry), "unifiedModelRegistry-exists");
expect(nvidiaModels.length > 0, "nvidia-model-library-non-empty", String(nvidiaModels.length));
for (const model of registry.models) {
  const validation = validateModelRecord(model);
  expect(validation.valid, `model-record-valid:${model.providerId}:${model.modelId}`, JSON.stringify({ missing: validation.missing, violations: validation.violations }));
  expect(Array.isArray(model.capabilities) && model.capabilities.length > 0, `model-has-capability:${model.modelId}`);
  expect(Boolean(model.endpointType), `model-has-endpointType:${model.modelId}`);
  expect(Boolean(model.uiGroup), `model-has-uiGroup:${model.modelId}`);
  expect(!model.state?.selectable || model.state.smoke_passed === true, `selectable-requires-smoke:${model.modelId}`);
  expect(!model.directChat || model.capabilities.some((capability) => DIRECT_CHAT_CAPABILITIES.includes(capability)), `non-chat-not-direct:${model.modelId}`);
  expect(!(model.deprecatedSoon && model.state?.default_candidate), `deprecated-not-default:${model.modelId}`);
  expect(!(model.commercialSafe === false && model.commercialDefault), `commercial-default-safe:${model.modelId}`);
  expect(!(model.downloadableOnly && model.state?.selectable), `downloadable-only-not-selectable:${model.modelId}`);
}
expect(invalidCall.success === false, "unknown-model-call-blocked");
expect(invalidCall.meta?.providerCalled === false, "unknown-model-provider-not-called");
expect(invalidCall.meta?.invalidProviderCalled === false, "unknown-model-invalidProviderCalled-false");

const evidence = {
  phase: "312A",
  name: "Unified Model Library Static Registry Verification",
  status: checks.every((check) => check.pass) ? "pass" : "fail",
  sealed: false,
  sealedReason: "Static registry verification does not seal Phase312A; real NVIDIA smoke and UI/backend checks are separate.",
  generatedAt: new Date().toISOString(),
  summary: registry.summary,
  providerCount: registry.providers.length,
  modelCount: registry.models.length,
  nvidiaModelCount: nvidiaModels.length,
  smokePassedModelCount: registry.summary.smokePassedModelCount,
  selectableModelCount: registry.summary.selectableModelCount,
  unverifiedModelCount: registry.summary.unverifiedModelCount,
  directChatModels: listDirectChatModels(registry).map((model) => model.modelId),
  taskToolModels: listTaskToolModels(registry).map((model) => model.modelId),
  blockers: registry.summary.blockers,
  invalidModelCall: {
    success: invalidCall.success,
    code: invalidCall.code,
    providerCalled: invalidCall.meta?.providerCalled === true,
    invalidProviderCalled: invalidCall.meta?.invalidProviderCalled === true,
  },
  checks,
};

await mkdir(dirname(evidenceJsonPath), { recursive: true });
await writeFile(evidenceJsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
await writeFile(evidenceMdPath, renderMarkdown(evidence), "utf8");

if (evidence.status !== "pass") {
  console.error(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    status: evidence.status,
    modelCount: evidence.modelCount,
    nvidiaModelCount: evidence.nvidiaModelCount,
    smokePassedModelCount: evidence.smokePassedModelCount,
    selectableModelCount: evidence.selectableModelCount,
    unverifiedModelCount: evidence.unverifiedModelCount,
    blockers: evidence.blockers,
  }, null, 2));
}

function renderMarkdown(evidence) {
  return [
    "# Phase312A Unified Model Library",
    "",
    `- status: ${evidence.status}`,
    `- sealed: ${evidence.sealed}`,
    `- modelCount: ${evidence.modelCount}`,
    `- nvidiaModelCount: ${evidence.nvidiaModelCount}`,
    `- smokePassedModelCount: ${evidence.smokePassedModelCount}`,
    `- selectableModelCount: ${evidence.selectableModelCount}`,
    `- unverifiedModelCount: ${evidence.unverifiedModelCount}`,
    `- blockers: ${evidence.blockers.length ? evidence.blockers.join(", ") : "none"}`,
    "",
    "## Direct Chat Models",
    ...evidence.directChatModels.map((modelId) => `- ${modelId}`),
    "",
    "## Task Tool Models",
    ...evidence.taskToolModels.map((modelId) => `- ${modelId}`),
    "",
    "## Checks",
    ...evidence.checks.map((check) => `- ${check.pass ? "pass" : "fail"}: ${check.id}${check.detail ? ` (${check.detail})` : ""}`),
    "",
  ].join("\n");
}
