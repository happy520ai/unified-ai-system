import { buildProviderRuntimeBridgeDryRun } from "../../packages/taiji-beidou-engine/src/index.js";
import { phaseBoundary, readJsonIfExists, writeJson } from "./phase675_682_common.mjs";

const intake = await readJsonIfExists("apps/ai-gateway-service/evidence/phase675_682/real-provider-runtime-approval-intake-result.json", {});
const bridge = buildProviderRuntimeBridgeDryRun({
  providerId: intake.providerId || "nvidia",
  modelId: intake.modelId || "nvidia/llama-3.3-nemotron-super-49b-v1",
  maxRequests: 1,
});

const evidence = phaseBoundary({
  phase: "Phase677",
  completed: true,
  providerRuntimeBridgeDryRunAvailable: true,
  ...bridge,
  providerCallsMade: false,
});

await writeJson("apps/ai-gateway-service/evidence/phase675_682/provider-runtime-bridge-dry-run-result.json", evidence);
console.log(JSON.stringify(evidence, null, 2));
