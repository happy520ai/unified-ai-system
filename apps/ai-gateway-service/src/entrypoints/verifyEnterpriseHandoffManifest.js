import { mkdir, readFile, writeFile } from "node:fs/promises";
import { writeEvidencePair } from "./entrypointUtils.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PHASE = "phase-42a-enterprise-handoff-manifest";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-42a-enterprise-handoff-manifest.json");
const evidenceMdPath = resolve(evidenceDir, "phase-42a-enterprise-handoff-manifest.md");

const requiredHandoffFiles = [
  "README.md",
  "AGENTS.md",
  "docs/DELIVERY_GUIDE.md",
  "docs/OPERATION_MANUAL.md",
  "docs/ENTERPRISE_DEPLOYMENT_RUNBOOK.md",
  "docs/ENTERPRISE_HANDOFF_MANIFEST.md",
  ".env.enterprise.example",
];

const enterpriseVerifyCommands = [
  "verify:phase32a",
  "verify:phase33a",
  "verify:phase34a",
  "verify:phase35a",
  "verify:phase36a",
  "verify:phase37a",
  "verify:phase38a",
  "verify:phase40a",
  "verify:phase41a",
  "verify:phase42a",
];

const requiredEnvTemplateKeys = [
  "AI_GATEWAY_PROVIDER_MODE",
  "AI_GATEWAY_REAL_PROVIDER_ENABLED",
  "AI_GATEWAY_ROUTE_MODE",
  "AI_GATEWAY_DEFAULT_PROVIDER",
  "AI_GATEWAY_ENABLED_PROVIDERS",
  "NVIDIA_MODEL",
  "NVIDIA_API_KEY",
  "KNOWLEDGE_STORAGE_MODE",
  "KNOWLEDGE_PERSISTENCE_DIR",
  "KNOWLEDGE_INFRA_MODE",
  "KNOWLEDGE_EMBEDDING_PROVIDER",
  "KNOWLEDGE_EMBEDDING_MODEL",
  "KNOWLEDGE_EMBEDDING_API_KEY",
  "KNOWLEDGE_VECTOR_STORE",
  "PGVECTOR_CONNECTION_STRING",
  "PGVECTOR_TABLE",
  "KNOWLEDGE_VECTOR_NAMESPACE",
  "PME_ENTERPRISE_AUTH_ENABLED",
  "PME_AUTH_TOKEN",
  "PME_AUTH_USER_ID",
  "PME_AUTH_TENANT_ID",
  "PME_AUTH_ROLE",
  "PME_AUTH_EXPIRES_AT",
  "PME_ENTERPRISE_USER_STORE_PATH",
  "PME_AUDIT_LOG_PATH",
  "PME_ENTERPRISE_BACKUP_DIR",
];

const requiredDocMarkers = [
  "cmd /c pnpm verify:enterprise",
  "cmd /c pnpm verify:phase41a",
  "cmd /c pnpm verify:phase42a",
  "docs/ENTERPRISE_DEPLOYMENT_RUNBOOK.md",
  "docs/ENTERPRISE_HANDOFF_MANIFEST.md",
  ".env.enterprise.example",
  "local-keyword",
  "NVIDIA",
];

let evidence;

try {
  const files = await readRequiredFiles();
  const rootPackage = JSON.parse(files["package.json"]);
  const servicePackage = JSON.parse(files["apps/ai-gateway-service/package.json"]);

  const result = {
    files: checkFiles(files),
    scripts: checkScripts(rootPackage, servicePackage),
    docs: checkDocs(files),
    envTemplate: checkEnvTemplate(files[".env.enterprise.example"]),
    ui: checkUi(files["apps/ai-gateway-service/src/ui/consolePage.js"]),
    boundaries: checkBoundaries(files),
  };
  const passed = Object.values(result).every((item) => item.status === "passed");

  evidence = createEvidence({
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    result,
    conclusion: passed ? "enterprise-handoff-manifest-ready" : "enterprise-handoff-manifest-not-ready",
  });
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  evidence = createEvidence({
    status: "failed",
    generatedAt: new Date().toISOString(),
    result: {},
    error: error instanceof Error ? error.message : String(error),
    conclusion: "enterprise-handoff-manifest-not-ready",
  });
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
}

async function readRequiredFiles() {
  const paths = [
    "package.json",
    "apps/ai-gateway-service/package.json",
    "apps/ai-gateway-service/src/ui/consolePage.js",
    ...requiredHandoffFiles,
  ];
  const entries = await Promise.all(
    paths.map(async (path) => [path, await readFile(resolve(repoRoot, path), "utf8")])
  );
  return Object.fromEntries(entries);
}

function checkFiles(files) {
  const present = requiredHandoffFiles.filter((path) => typeof files[path] === "string" && files[path].length > 0);
  const missing = requiredHandoffFiles.filter((path) => !present.includes(path));
  return {
    status: missing.length === 0 ? "passed" : "failed",
    requiredCount: requiredHandoffFiles.length,
    present,
    missing,
  };
}

function checkScripts(rootPackage, servicePackage) {
  const rootScripts = rootPackage.scripts ?? {};
  const serviceScripts = servicePackage.scripts ?? {};
  const aggregate = rootScripts["verify:enterprise"] ?? "";
  const missingEnterpriseCommands = enterpriseVerifyCommands.filter((command) => !aggregate.includes(command));
  const phase42RootScriptPresent = rootScripts["verify:phase42a"] ===
    "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase42a";
  const phase42ServiceScriptPresent = serviceScripts["verify:phase42a"] ===
    "node ./src/entrypoints/verifyEnterpriseHandoffManifest.js";
  const phase42CheckIncluded = Boolean(serviceScripts.check?.includes("verifyEnterpriseHandoffManifest.js"));
  const helpIncluded = Boolean(rootScripts["help:phase14a"]?.includes("verify:phase42a"));

  return {
    status:
      missingEnterpriseCommands.length === 0 &&
      phase42RootScriptPresent &&
      phase42ServiceScriptPresent &&
      phase42CheckIncluded &&
      helpIncluded
        ? "passed"
        : "failed",
    phase42RootScriptPresent,
    phase42ServiceScriptPresent,
    phase42CheckIncluded,
    helpIncluded,
    missingEnterpriseCommands,
  };
}

function checkDocs(files) {
  const combined = [
    files["README.md"],
    files["AGENTS.md"],
    files["docs/DELIVERY_GUIDE.md"],
    files["docs/ENTERPRISE_DEPLOYMENT_RUNBOOK.md"],
    files["docs/ENTERPRISE_HANDOFF_MANIFEST.md"],
  ].join("\n");
  const missingMarkers = requiredDocMarkers.filter((marker) => !combined.includes(marker));
  return {
    status: missingMarkers.length === 0 ? "passed" : "failed",
    missingMarkers,
  };
}

function checkEnvTemplate(text) {
  const missingKeys = requiredEnvTemplateKeys.filter((key) => !text.includes(key));
  const secretPlaceholderKeys = ["NVIDIA_API_KEY", "KNOWLEDGE_EMBEDDING_API_KEY", "PME_AUTH_TOKEN"];
  const missingSecretPlaceholders = secretPlaceholderKeys.filter((key) => {
    const line = findTemplateLine(text, key);
    return !line || !line.includes("<set-in-local-secret-store>");
  });
  const pgvectorLine = findTemplateLine(text, "PGVECTOR_CONNECTION_STRING");
  const pgvectorUsesPlaceholder = Boolean(pgvectorLine?.includes("<password>"));
  const directHostWarningPresent = text.includes("db.<project>.supabase.co:5432");
  const defaultModeLocalKeyword = text.includes("KNOWLEDGE_INFRA_MODE=local-keyword");
  return {
    status:
      missingKeys.length === 0 &&
      missingSecretPlaceholders.length === 0 &&
      pgvectorUsesPlaceholder &&
      directHostWarningPresent &&
      defaultModeLocalKeyword
        ? "passed"
        : "failed",
    missingKeys,
    missingSecretPlaceholders,
    pgvectorUsesPlaceholder,
    directHostWarningPresent,
    defaultModeLocalKeyword,
  };
}

function checkUi(text) {
  const requiredMarkers = [
    "phase40a-enterprise-deployment-preflight",
    "phase41a-enterprise-config-wizard",
    "enterprise-config-input",
    "enterprise-config-check",
    "uploaded: false",
    "valuesEchoed: false",
  ];
  const missingMarkers = requiredMarkers.filter((marker) => !text.includes(marker));
  return {
    status: missingMarkers.length === 0 ? "passed" : "failed",
    missingMarkers,
  };
}

function checkBoundaries(files) {
  const combined = Object.values(files).join("\n");
  const requiredMarkers = [
    "not release automation",
    "not infrastructure",
    "not a secret manager",
    "not upload",
    "not full enterprise",
  ];
  const missingMarkers = requiredMarkers.filter((marker) => !combined.toLowerCase().includes(marker));
  return {
    status: missingMarkers.length === 0 ? "passed" : "failed",
    missingMarkers,
  };
}

function findTemplateLine(text, key) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.includes(key) && line.includes("="));
}

function createEvidence({ status, generatedAt, result, conclusion, error }) {
  return {
    phase: PHASE,
    status,
    generatedAt,
    handoff: {
      manifestPath: "docs/ENTERPRISE_HANDOFF_MANIFEST.md",
      envTemplatePath: ".env.enterprise.example",
      releaseAutomation: false,
      infrastructureProvisioning: false,
      secretValuesRecorded: false,
    },
    result,
    error: error ?? null,
    conclusion,
  };
}

