import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const phase = "Phase1314A";
const phaseKey = "phase1314a";
const packageJsonPath = resolve(repoRoot, "package.json");
const docsPath = resolve(repoRoot, "docs/phase1314a-local-neural-skill-registry-v1.md");
const srcPath = resolve(repoRoot, "packages/neural-fabric-runtime/src/skillRegistry.js");
const indexPath = resolve(repoRoot, "packages/neural-fabric-runtime/src/index.js");
const packageCheckPath = resolve(repoRoot, "packages/neural-fabric-runtime/tools/check-specs.mjs");
const registryCheckPath = resolve(repoRoot, "packages/neural-fabric-runtime/tools/check-skill-registry.mjs");
const evidencePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1314a/local-skill-registry-result.json");

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
  const docsText = await readText(docsPath, "");
  const srcText = await readText(srcPath, "");
  const indexText = await readText(indexPath, "");
  const packageCheckText = await readText(packageCheckPath, "");
  const registryCheckText = await readText(registryCheckPath, "");
  const runtime = await import("../..//packages/neural-fabric-runtime/src/index.js");
  const dryRun = runtime.runLocalSkillRegistryDryRun();
  const registry = runtime.createLocalSkillRegistry();
  const entries = runtime.listLocalSkillRegistryEntries(registry);
  const requiredFields = ["skillId", "atomId", "capability", "backend", "status", "riskLevel", "revoked", "evidenceRef"];

  const checks = [
    check("package_script_exists", packageJson.scripts?.["verify:phase1314a-local-skill-registry"] === "node tools/phase1314a/verify-local-skill-registry.mjs"),
    check("docs_exists", await exists(docsPath)),
    check("src_exists", await exists(srcPath)),
    check("registry_check_exists", await exists(registryCheckPath)),
    check("exports_registry_api", ["createLocalSkillRegistry", "listLocalSkillRegistryEntries", "getLocalSkillRegistryEntry", "runLocalSkillRegistryDryRun"].every((name) => indexText.includes(name) && typeof runtime[name] === "function")),
    check("package_check_runs_registry_check", packageCheckText.includes("check-skill-registry.mjs")),
    check("registry_has_entries", entries.length >= 2),
    check("required_fields_present", dryRun.requiredFieldsPresent === true && entries.every((entry) => requiredFields.every((field) => Object.hasOwn(entry, field)))),
    check("mock_only", dryRun.mockOnly === true && entries.every((entry) => entry.skillId.startsWith("mock.") && entry.status === "mock-only" && entry.backend === "mock-local")),
    check("revoked_fixture_present", entries.some((entry) => entry.revoked === true && entry.skillId === "mock.revoked.fixture")),
    check("active_fixture_present", entries.some((entry) => entry.revoked === false && entry.skillId === "mock.summarize.preview")),
    check("evidence_refs_present", entries.every((entry) => entry.evidenceRef.includes("phase1314a/local-skill-registry-result.json"))),
    check("registry_content_addressed", dryRun.registryAddress?.algorithm === "sha256" && /^sha256:[a-f0-9]{64}$/.test(dryRun.registryAddress?.uri ?? "")),
    check("no_real_external_model_registered", dryRun.realExternalModelRegistered === false),
    check("provider_not_connected", dryRun.providerConnected === false),
    check("provider_not_called", dryRun.providerCallsMade === false),
    check("secret_not_read", dryRun.secretRead === false),
    check("secret_value_not_exposed", dryRun.secretValueExposed === false),
    check("network_not_used", dryRun.networkUsed === false),
    check("chat_not_modified", dryRun.chatModified === false),
    check("chat_gateway_execute_not_modified", dryRun.chatGatewayExecuteModified === false),
    check("docs_records_fields", requiredFields.every((field) => docsText.includes(`\`${field}\``))),
    check("docs_records_forbidden_boundaries", ["No real external model registration", "No Provider integration", "No Provider calls", "No `/chat` or `/chat-gateway/execute` integration"].every((marker) => docsText.includes(marker))),
    check("src_has_no_network_or_provider_runtime", !/(node:https|node:http|fetch\s*\(|XMLHttpRequest|WebSocket|connectProvider|callProvider|executeProvider)/u.test(srcText)),
    check("src_has_no_secret_reads", !/process\.env|\.env|auth\.json|API_KEY|SECRET|TOKEN/u.test(srcText)),
    check("src_has_no_chat_routes", !/\/chat|\/chat-gateway\/execute/u.test(srcText)),
    check("registry_check_asserts_contract", ["skillId", "atomId", "capability", "backend", "status", "riskLevel", "revoked", "evidenceRef", "realExternalModelRegistered", "providerConnected"].every((marker) => registryCheckText.includes(marker))),
  ];

  const blocker = checks.find((item) => item.passed !== true)?.id ?? null;
  return {
    phase,
    phaseKey,
    name: "Local Neural Skill Registry v1",
    completed: blocker === null,
    recommended_sealed: blocker === null,
    blocker,
    docs: "docs/phase1314a-local-neural-skill-registry-v1.md",
    files: [
      "packages/neural-fabric-runtime/src/skillRegistry.js",
      "packages/neural-fabric-runtime/src/index.js",
      "packages/neural-fabric-runtime/tools/check-skill-registry.mjs",
      "packages/neural-fabric-runtime/tools/check-specs.mjs",
    ],
    verifier: "tools/phase1314a/verify-local-skill-registry.mjs",
    evidenceJson: "apps/ai-gateway-service/evidence/phase1314a/local-skill-registry-result.json",
    registry: {
      schemaVersion: dryRun.registrySchemaVersion,
      registryAddress: dryRun.registryAddress.uri,
      registryEntryCount: dryRun.registryEntryCount,
      activeSkillCount: dryRun.activeSkillCount,
      revokedSkillCount: dryRun.revokedSkillCount,
      entries: dryRun.entries,
    },
    safety: {
      realExternalModelRegistered: dryRun.realExternalModelRegistered,
      providerConnected: dryRun.providerConnected,
      providerCallsMade: dryRun.providerCallsMade,
      secretRead: dryRun.secretRead,
      secretValueExposed: dryRun.secretValueExposed,
      networkUsed: dryRun.networkUsed,
      chatModified: dryRun.chatModified,
      chatGatewayExecuteModified: dryRun.chatGatewayExecuteModified,
      workspaceCleanClaimed: false,
    },
    checks,
  };
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
