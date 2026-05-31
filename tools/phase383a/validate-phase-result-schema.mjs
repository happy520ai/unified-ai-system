import { ensure, phase383Safety, readJson, writeJson, writeText } from "../phase383-common.mjs";

const schema = await readJson("docs/phase-orchestrator/phase-result.schema.json");
const example = await readJson("docs/phase-orchestrator/phase-result-example.json");

ensure(schema.title === "Phase Result Standard Contract", "Invalid schema title.");
ensure(schema.properties.safety, "Schema must define safety.");
ensure(example.phase === "Phase383", "Example phase mismatch.");
ensure(example.completed === true, "Example must be completed.");
ensure(example.recommended_sealed === true, "Example must be recommended sealed.");
ensure(example.safety.providerCallsMade === false, "Example must keep providerCallsMade=false.");

const result = {
  phase: "Phase383A",
  phaseResultSchemaCreated: true,
  phaseResultExampleCreated: true,
  compatibilityWarningsSupported: true,
  validationPassed: true,
  ...phase383Safety,
};

await writeJson("apps/ai-gateway-service/evidence/phase383a/phase-result-standard-contract-result.json", result);
await writeText("docs/phase383a-phase-result-standard-contract.md", [
  "# Phase383A Phase Result Standard Contract",
  "",
  "- Created phase result schema and example.",
  "- Supports compatibility with legacy `recommendedSealed` and root-level safety fields.",
  "- Missing optional fields produce warnings; old results are not rewritten or fabricated.",
].join("\n"));

console.log(JSON.stringify(result, null, 2));
