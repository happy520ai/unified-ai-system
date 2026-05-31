import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const neuralOpSchemaPath = resolve(packageRoot, "specs/neural-op.schema.json");
const weightAtomSchemaPath = resolve(packageRoot, "specs/weight-atom.schema.json");
const capabilityPolicySchemaPath = resolve(packageRoot, "specs/capability-policy.schema.json");
const indexPath = resolve(packageRoot, "src/index.js");
const canonicalizePath = resolve(packageRoot, "src/canonicalize.js");
const contentAddressPath = resolve(packageRoot, "src/contentAddress.js");
const neuralOpDryRunPath = resolve(packageRoot, "src/neuralOpDryRun.js");
const atomContentAddressDryRunPath = resolve(packageRoot, "src/atomContentAddressDryRun.js");
const routerDryRunPath = resolve(packageRoot, "src/routerDryRun.js");
const revocationLedgerPath = resolve(packageRoot, "src/revocationLedgerDryRun.js");
const workerIsolationPath = resolve(packageRoot, "src/workerIsolationDryRun.js");
const skillRegistryPath = resolve(packageRoot, "src/skillRegistry.js");
const revocationDryRunCheckPath = resolve(packageRoot, "tools/check-revocation-ledger-dry-run.mjs");
const workerIsolationDryRunCheckPath = resolve(packageRoot, "tools/check-worker-isolation-dry-run.mjs");
const skillRegistryCheckPath = resolve(packageRoot, "tools/check-skill-registry.mjs");

const neuralOpSchema = await readJson(neuralOpSchemaPath);
const weightAtomSchema = await readJson(weightAtomSchemaPath);
const capabilityPolicySchema = await readJson(capabilityPolicySchemaPath);
const runtime = await import("../src/index.js");

const sampleManifestA = {
  kind: "neural-op",
  id: "phase1303.sample",
  nested: {
    z: 2,
    a: 1,
  },
  list: [
    {
      b: true,
      a: false,
    },
  ],
};
const sampleManifestB = {
  list: [
    {
      a: false,
      b: true,
    },
  ],
  nested: {
    a: 1,
    z: 2,
  },
  id: "phase1303.sample",
  kind: "neural-op",
};
const canonicalA = runtime.canonicalize(sampleManifestA);
const canonicalB = runtime.canonicalize(sampleManifestB);
const addressA = runtime.contentAddress(sampleManifestA);
const addressB = runtime.contentAddress(sampleManifestB);
const loaded = runtime.loadManifest(sampleManifestA);
const neuralOpDryRun = runtime.runNeuralOpDryRun();
const atomContentAddressDryRun = runtime.runAtomContentAddressDryRun();
const routerDryRun = runtime.runWorkforceRouterDryRun();

const checks = [
  ["neural_op_kind", neuralOpSchema.properties?.kind?.const === "neural-op"],
  ["neural_op_adapter_atom_def", Boolean(neuralOpSchema.$defs?.adapterAtom)],
  ["neural_op_router_op_def", Boolean(neuralOpSchema.$defs?.routerOp)],
  ["neural_op_blocks_model_execution", neuralOpSchema.properties?.executionPolicy?.properties?.modelExecutionAllowed?.const === false],
  ["neural_op_blocks_provider_calls", neuralOpSchema.properties?.executionPolicy?.properties?.providerCallsAllowed?.const === false],
  ["neural_op_blocks_main_chain", neuralOpSchema.properties?.executionPolicy?.properties?.mainChainIntegrationAllowed?.const === false],
  ["weight_atom_kind", weightAtomSchema.properties?.kind?.const === "weight-atom"],
  ["weight_atom_blocks_training", weightAtomSchema.properties?.runtimePolicy?.properties?.trainingAllowed?.const === false],
  ["weight_atom_blocks_download", weightAtomSchema.properties?.runtimePolicy?.properties?.modelDownloadAllowed?.const === false],
  ["capability_policy_kind", capabilityPolicySchema.properties?.kind?.const === "capability-policy"],
  ["capability_policy_required_terms", ["capability", "epoch", "revocation", "signaturePolicy"].every((field) => capabilityPolicySchema.required?.includes(field))],
  ["capability_policy_no_private_key_generation", capabilityPolicySchema.properties?.signaturePolicy?.properties?.privateKeyGenerated?.const === false],
  ["capability_policy_no_secret_reads", capabilityPolicySchema.properties?.signaturePolicy?.properties?.secretReadAllowed?.const === false],
  ["capability_policy_blocks_provider_calls", capabilityPolicySchema.properties?.safety?.properties?.providerCallsAllowed?.const === false],
  ["capability_policy_blocks_training", capabilityPolicySchema.properties?.safety?.properties?.trainingAllowed?.const === false],
  ["src_index_exists", await exists(indexPath)],
  ["src_canonicalize_exists", await exists(canonicalizePath)],
  ["src_content_address_exists", await exists(contentAddressPath)],
  ["src_neural_op_dry_run_exists", await exists(neuralOpDryRunPath)],
  ["src_atom_content_address_dry_run_exists", await exists(atomContentAddressDryRunPath)],
  ["src_router_dry_run_exists", await exists(routerDryRunPath)],
  ["src_revocation_ledger_exists", await exists(revocationLedgerPath)],
  ["src_worker_isolation_exists", await exists(workerIsolationPath)],
  ["src_skill_registry_exists", await exists(skillRegistryPath)],
  ["revocation_dry_run_check_exists", await exists(revocationDryRunCheckPath)],
  ["worker_isolation_dry_run_check_exists", await exists(workerIsolationDryRunCheckPath)],
  ["skill_registry_check_exists", await exists(skillRegistryCheckPath)],
  ["exports_load_manifest", typeof runtime.loadManifest === "function"],
  ["exports_canonicalize", typeof runtime.canonicalize === "function"],
  ["exports_content_address", typeof runtime.contentAddress === "function"],
  ["exports_neural_op_dry_run", typeof runtime.runNeuralOpDryRun === "function"],
  ["exports_atom_content_address_dry_run", typeof runtime.runAtomContentAddressDryRun === "function"],
  ["exports_workforce_router_dry_run", typeof runtime.runWorkforceRouterDryRun === "function"],
  ["exports_revocation_dry_run", typeof runtime.runRevocationLedgerDryRun === "function"],
  ["exports_worker_isolation_dry_run", typeof runtime.runWorkerIsolationDryRun === "function"],
  ["exports_local_skill_registry", typeof runtime.createLocalSkillRegistry === "function" && typeof runtime.runLocalSkillRegistryDryRun === "function"],
  ["canonicalize_is_deterministic", canonicalA === canonicalB],
  ["canonicalize_sorts_keys", canonicalA.includes('"a":1') && canonicalA.indexOf('"a":1') < canonicalA.indexOf('"z":2')],
  ["content_address_is_deterministic", addressA.hash === addressB.hash && addressA.uri === addressB.uri],
  ["content_address_is_sha256", addressA.algorithm === "sha256" && /^[a-f0-9]{64}$/.test(addressA.hash)],
  ["content_address_has_uri", addressA.uri === `sha256:${addressA.hash}`],
  ["load_manifest_returns_frozen_copy", loaded.manifest !== sampleManifestA && Object.isFrozen(loaded.manifest)],
  ["load_manifest_includes_content_address", loaded.contentAddress?.uri === addressA.uri],
  ["neural_op_dry_run_inference_only", neuralOpDryRun.inferenceOnly === true && neuralOpDryRun.realModelLoaded === false && neuralOpDryRun.trainingExecuted === false],
  ["atom_content_address_dry_run_flags", atomContentAddressDryRun.sameContentSameHash === true && atomContentAddressDryRun.differentContentDifferentHash === true && atomContentAddressDryRun.metadataCanonicalized === true],
  ["router_dry_run_selector_only", routerDryRun.routerOnly === true && routerDryRun.finalAnswerGenerated === false && routerDryRun.providerCallsMade === false],
  ["revocation_dry_run_passes", runNodeCheck(revocationDryRunCheckPath)],
  ["worker_isolation_dry_run_passes", runNodeCheck(workerIsolationDryRunCheckPath)],
  ["skill_registry_check_passes", runNodeCheck(skillRegistryCheckPath)],
  ["no_runtime_inference_exports", !("runInference" in runtime) && !("infer" in runtime) && !("executeModel" in runtime)],
];

const failed = checks.filter(([, passed]) => passed !== true);
if (failed.length > 0) {
  console.error(JSON.stringify({ status: "failed", failed: failed.map(([id]) => id) }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ status: "passed", checkedSchemas: 3 }, null, 2));
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function runNodeCheck(path) {
  const result = spawnSync(process.execPath, [path], {
    cwd: packageRoot,
    encoding: "utf8",
  });
  return result.status === 0;
}
