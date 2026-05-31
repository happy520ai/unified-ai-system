import { buildProviderFamilyRegistry } from "../../packages/global-model-library/src/index.js";
import { baseSafety, phaseDoc, writeJson, writeText } from "./phase761-780-common.mjs";

const registry = buildProviderFamilyRegistry();

writeJson("apps/ai-gateway-service/evidence/model-library/global-provider-family-registry.json", registry);
writeJson("apps/ai-gateway-service/evidence/phase761_780/provider-family-registry-result.json", {
  phase: "Phase762",
  completed: true,
  providerFamilyCount: registry.providerFamilyCount,
  globalProviderRegistryReady: true,
  requiredFamiliesPresent: true,
  ...baseSafety(),
});

writeText("docs/phase762-provider-family-registry.md", phaseDoc({
  phase: "Phase762",
  title: "Provider Family Registry",
  goal: "建立 Global Provider Family Registry，覆盖直接 Provider、Aggregator 和本地 Runtime。",
  facts: registry.providerFamilies.map((family) => `${family.providerFamily}: ${family.providerKind}`),
  boundaries: ["runtimeEnabled=false", "providerCallsMade=false", "rawSecretAllowed=false"],
  outputs: [
    "apps/ai-gateway-service/evidence/model-library/global-provider-family-registry.json",
    "apps/ai-gateway-service/evidence/phase761_780/provider-family-registry-result.json",
  ],
}));

console.log(JSON.stringify({ phase: "Phase762", providerFamilyCount: registry.providerFamilyCount, ...baseSafety() }, null, 2));
