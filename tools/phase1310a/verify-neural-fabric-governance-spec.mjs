import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const phase = "Phase1310A";
const phaseKey = "phase1310a";
const packageJsonPath = resolve(repoRoot, "package.json");
const docsPath = resolve(repoRoot, "docs/phase1310a-neural-fabric-governance-spec.md");
const schemaPath = resolve(repoRoot, "packages/neural-fabric-runtime/specs/capability-policy.schema.json");
const checkSpecsPath = resolve(repoRoot, "packages/neural-fabric-runtime/tools/check-specs.mjs");
const evidencePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1310a/governance-spec-result.json");

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
  const schema = await readJson(schemaPath, null);
  const docsText = await readText(docsPath, "");
  const checkSpecsText = await readText(checkSpecsPath, "");

  const checks = [
    check("package_script_exists", packageJson.scripts?.["verify:phase1310a-neural-fabric-governance-spec"] === "node tools/phase1310a/verify-neural-fabric-governance-spec.mjs"),
    check("docs_exists", await exists(docsPath)),
    check("schema_exists", await exists(schemaPath)),
    check("schema_json_valid", schema !== null),
    check("schema_root_contract", schema?.title === "Phase1310A Neural Fabric Capability Policy Schema" && schema?.type === "object"),
    check("schema_required_fields", hasRequired(schema, ["schemaVersion", "kind", "id", "capability", "epoch", "revocation", "signaturePolicy", "safety"])),
    check("schema_kind_const", schema?.properties?.kind?.const === "capability-policy"),
    check("capability_required_fields", hasRequired(schema?.properties?.capability, ["capabilityId", "capabilityType", "scope", "allowedOps", "deniedOps", "evidenceRequired"])),
    check("epoch_required_fields", hasRequired(schema?.properties?.epoch, ["epochId", "sequence", "state", "activationPolicy", "rollbackPolicy"])),
    check("revocation_required_fields", hasRequired(schema?.properties?.revocation, ["revocationStatus", "revocationReasons", "revokedCapabilities", "emergencyDisableAllowed"])),
    check("signature_policy_required_fields", hasRequired(schema?.properties?.signaturePolicy, ["signatureRequired", "keyMaterialGenerated", "privateKeyGenerated", "secretReadAllowed", "algorithmPolicy", "verificationMode"])),
    check("signature_policy_no_key_generation", schema?.properties?.signaturePolicy?.properties?.keyMaterialGenerated?.const === false && schema?.properties?.signaturePolicy?.properties?.privateKeyGenerated?.const === false),
    check("signature_policy_no_secret_reads", schema?.properties?.signaturePolicy?.properties?.secretReadAllowed?.const === false),
    check("safety_required_fields", hasRequired(schema?.properties?.safety, ["providerCallsAllowed", "secretReadAllowed", "chatRouteMutationAllowed", "chatGatewayExecuteMutationAllowed", "trainingAllowed", "modelDownloadAllowed", "mainChainIntegrationAllowed"])),
    check("safety_blocks_provider_calls", schema?.properties?.safety?.properties?.providerCallsAllowed?.const === false),
    check("safety_blocks_secret_reads", schema?.properties?.safety?.properties?.secretReadAllowed?.const === false),
    check("safety_blocks_chat", schema?.properties?.safety?.properties?.chatRouteMutationAllowed?.const === false && schema?.properties?.safety?.properties?.chatGatewayExecuteMutationAllowed?.const === false),
    check("safety_blocks_training_download_main_chain", schema?.properties?.safety?.properties?.trainingAllowed?.const === false && schema?.properties?.safety?.properties?.modelDownloadAllowed?.const === false && schema?.properties?.safety?.properties?.mainChainIntegrationAllowed?.const === false),
    check("docs_define_governance_terms", ["capability", "epoch", "revocation", "signature policy"].every((term) => docsText.includes(term))),
    check("docs_state_spec_only_boundary", ["docs/spec/verifier", "不实现真实签名密钥", "不生成私钥", "不读取 secret"].every((marker) => docsText.includes(marker))),
    check("docs_state_no_runtime_claim", !/runtime enabled|main chain enabled|provider call enabled/i.test(docsText)),
    check("package_check_includes_capability_policy", checkSpecsText.includes("capability-policy.schema.json")),
  ];

  const blocker = checks.find((item) => item.passed !== true)?.id ?? null;
  return {
    phase,
    phaseKey,
    name: "Neural Fabric Governance Spec",
    completed: blocker === null,
    recommended_sealed: blocker === null,
    blocker,
    docs: "docs/phase1310a-neural-fabric-governance-spec.md",
    schemas: [
      "packages/neural-fabric-runtime/specs/capability-policy.schema.json",
    ],
    verifier: "tools/phase1310a/verify-neural-fabric-governance-spec.mjs",
    evidenceJson: "apps/ai-gateway-service/evidence/phase1310a/governance-spec-result.json",
    scope: {
      docsSpecVerifierOnly: true,
      realSigningKeyImplemented: false,
      privateKeyGenerated: false,
      secretRead: false,
      runtimeInferenceImplemented: false,
    },
    safety: {
      providerCallsMade: false,
      secretRead: false,
      secretValueExposed: false,
      chatModified: false,
      chatGatewayExecuteModified: false,
      trainingExecuted: false,
      modelDownloaded: false,
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
