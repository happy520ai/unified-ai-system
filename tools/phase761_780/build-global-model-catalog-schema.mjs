import { buildGlobalModelCatalogSchema } from "../../packages/global-model-library/src/index.js";
import { baseSafety, phaseDoc, writeJson, writeText } from "./phase761-780-common.mjs";

const schema = buildGlobalModelCatalogSchema();

writeJson("apps/ai-gateway-service/evidence/phase761_780/global-model-catalog-schema-result.json", {
  phase: "Phase763",
  completed: true,
  globalCatalogSchemaReady: true,
  schema,
  ...baseSafety(),
});

writeText("docs/phase763-global-model-catalog-schema.md", phaseDoc({
  phase: "Phase763",
  title: "Global Model Catalog Schema",
  goal: "建立 Global Model Catalog Schema，支持 credentialPolicy、capabilities、limits、pricing、risk、evidence 和 selectableGate。",
  facts: schema.requiredFields.map((field) => `required field: ${field}`),
  boundaries: Object.entries(schema.constraints).map(([key, value]) => `${key}=${value}`),
  outputs: ["apps/ai-gateway-service/evidence/phase761_780/global-model-catalog-schema-result.json"],
}));

console.log(JSON.stringify({ phase: "Phase763", globalCatalogSchemaReady: true, ...baseSafety() }, null, 2));
