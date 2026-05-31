import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const phase = "Phase1302A";
const phaseKey = "phase1302a";
const packageJsonPath = resolve(repoRoot, "package.json");
const neuralOpSchemaPath = resolve(repoRoot, "packages/neural-fabric-runtime/specs/neural-op.schema.json");
const weightAtomSchemaPath = resolve(repoRoot, "packages/neural-fabric-runtime/specs/weight-atom.schema.json");
const packageSpecPath = resolve(repoRoot, "packages/neural-fabric-runtime/package.json");
const docsPath = resolve(repoRoot, "docs/phase1302a-neural-op-weight-atom-spec.md");
const evidencePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1302a/neural-op-spec-result.json");

const result = await buildResult();
await writeJson(evidencePath, result);

console.log(JSON.stringify({
  phase: result.phase,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  checksFailed: result.checks.filter((check) => check.passed !== true).length,
}, null, 2));

if (!result.recommended_sealed) {
  process.exitCode = 1;
}

async function buildResult() {
  const packageJson = await readJson(packageJsonPath, {});
  const neuralOpSchema = await readJson(neuralOpSchemaPath, null);
  const weightAtomSchema = await readJson(weightAtomSchemaPath, null);
  const runtimePackage = await readJson(packageSpecPath, null);
  const docsText = await readText(docsPath, "");

  const checks = [
    check("package_script_exists", packageJson.scripts?.["verify:phase1302a-neural-op-spec"] === "node tools/phase1302a/verify-neural-op-spec.mjs"),
    check("neural_op_schema_exists", await exists(neuralOpSchemaPath)),
    check("weight_atom_schema_exists", await exists(weightAtomSchemaPath)),
    check("runtime_package_exists", await exists(packageSpecPath)),
    check("docs_exists", await exists(docsPath)),
    check("neural_op_schema_json_valid", neuralOpSchema !== null),
    check("weight_atom_schema_json_valid", weightAtomSchema !== null),
    check("runtime_package_check_script", runtimePackage?.scripts?.check === "node tools/check-specs.mjs"),
    check("neural_op_root_contract", neuralOpSchema?.title === "Phase1302A Neural-op Manifest Schema" && neuralOpSchema?.type === "object"),
    check("neural_op_required_fields", hasRequired(neuralOpSchema, ["schemaVersion", "kind", "id", "displayName", "opType", "capabilityBucket", "executionPolicy", "evidencePolicy", "safety"])),
    check("neural_op_kind_const", neuralOpSchema?.properties?.kind?.const === "neural-op"),
    check("neural_op_defs_adapter_atom", Boolean(neuralOpSchema?.$defs?.adapterAtom)),
    check("neural_op_defs_router_op", Boolean(neuralOpSchema?.$defs?.routerOp)),
    check("adapter_atom_required_fields", hasRequired(neuralOpSchema?.$defs?.adapterAtom, ["kind", "id", "adapterType", "inputContract", "outputContract", "runtimeBoundary"])),
    check("router_op_required_fields", hasRequired(neuralOpSchema?.$defs?.routerOp, ["kind", "id", "routingMode", "candidatePolicy", "selectionGate", "fallbackPolicy"])),
    check("weight_atom_root_contract", weightAtomSchema?.title === "Phase1302A Weight-atom Schema" && weightAtomSchema?.type === "object"),
    check("weight_atom_required_fields", hasRequired(weightAtomSchema, ["schemaVersion", "kind", "id", "source", "shape", "storage", "verification", "runtimePolicy", "safety"])),
    check("weight_atom_kind_const", weightAtomSchema?.properties?.kind?.const === "weight-atom"),
    check("schema_blocks_execution", neuralOpSchema?.properties?.executionPolicy?.properties?.modelExecutionAllowed?.const === false),
    check("schema_blocks_training", weightAtomSchema?.properties?.runtimePolicy?.properties?.trainingAllowed?.const === false),
    check("schema_blocks_download", weightAtomSchema?.properties?.runtimePolicy?.properties?.modelDownloadAllowed?.const === false),
    check("schema_blocks_main_chain", neuralOpSchema?.properties?.executionPolicy?.properties?.mainChainIntegrationAllowed?.const === false),
    check("schema_blocks_provider_calls", neuralOpSchema?.properties?.executionPolicy?.properties?.providerCallsAllowed?.const === false),
    check("schema_blocks_secret_reads", neuralOpSchema?.properties?.safety?.properties?.secretReadAllowed?.const === false),
    check("docs_define_all_four_terms", ["neural-op", "weight-atom", "adapter-atom", "router-op"].every((term) => docsText.includes(term))),
    check("docs_state_scope_only", [
      "schema/spec only",
      "不执行模型",
      "不训练",
      "不下载模型",
      "不接主链",
    ].every((marker) => docsText.includes(marker))),
    check("no_runtime_entrypoint_claimed", !docsText.includes("runtime enabled") && !docsText.includes("main chain enabled")),
  ];

  const blocker = checks.find((check) => check.passed !== true)?.id ?? null;
  return {
    phase,
    phaseKey,
    name: "Neural-op Manifest + Weight Atom Spec",
    completed: blocker === null,
    recommended_sealed: blocker === null,
    blocker,
    docs: [
      "docs/phase1302a-neural-op-weight-atom-spec.md",
    ],
    schemas: [
      "packages/neural-fabric-runtime/specs/neural-op.schema.json",
      "packages/neural-fabric-runtime/specs/weight-atom.schema.json",
    ],
    verifier: "tools/phase1302a/verify-neural-op-spec.mjs",
    evidenceJson: "apps/ai-gateway-service/evidence/phase1302a/neural-op-spec-result.json",
    scope: {
      schemaSpecOnly: true,
      modelExecuted: false,
      trainingExecuted: false,
      modelDownloaded: false,
      mainChainIntegrated: false,
    },
    safety: {
      providerCallsMade: false,
      secretRead: false,
      secretValueExposed: false,
      chatModified: false,
      chatGatewayExecuteModified: false,
      runtimeImplemented: false,
      workspaceCleanClaimed: false,
    },
    checks,
  };
}

function hasRequired(schema, fields) {
  return fields.every((field) => schema?.required?.includes(field));
}

function check(id, passed) {
  return { id, passed: passed === true };
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readText(path, fallback) {
  try {
    return String(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function readJson(path, fallback) {
  const text = await readText(path, "");
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
