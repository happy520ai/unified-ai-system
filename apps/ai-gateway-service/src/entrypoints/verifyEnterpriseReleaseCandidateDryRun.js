import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PHASE = "phase-45a-enterprise-release-candidate-dry-run";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-45a-enterprise-release-candidate-dry-run.json");
const evidenceMdPath = resolve(evidenceDir, "phase-45a-enterprise-release-candidate-dry-run.md");

const requiredDocs = [
  "README.md",
  "AGENTS.md",
  "docs/DELIVERY_GUIDE.md",
  "docs/OPERATION_MANUAL.md",
  "docs/ENTERPRISE_DEPLOYMENT_RUNBOOK.md",
  "docs/ENTERPRISE_HANDOFF_MANIFEST.md",
  "docs/ENTERPRISE_ACCEPTANCE_REPORT.md",
  ".env.enterprise.example",
];

const requiredEvidence = [
  "apps/ai-gateway-service/evidence/phase-7a-1-service-entry.json",
  "apps/agent-console/evidence/phase-7a-2-console-service-chain.json",
  "apps/ai-gateway-service/evidence/phase-21a-knowledge-entry.json",
  "apps/ai-gateway-service/evidence/phase-21b-knowledge-source-load.json",
  "apps/agent-console/evidence/phase-21c-console-knowledge-chain.json",
  "apps/ai-gateway-service/evidence/phase-22-knowledge-quality-infra.json",
  "apps/ai-gateway-service/evidence/phase-23-knowledge-production-readiness.json",
  "apps/ai-gateway-service/evidence/phase-24-delivery-knowledge.json",
  "apps/ai-gateway-service/evidence/phase-25a-web-console.json",
  "apps/ai-gateway-service/evidence/phase-26a-chat-first-web-console.json",
  "apps/ai-gateway-service/evidence/phase-27-knowledge-persistence.json",
  "apps/ai-gateway-service/evidence/phase-28a-documented-feature-closure.json",
  "apps/ai-gateway-service/evidence/phase-29a-service-rag-chat.json",
  "apps/ai-gateway-service/evidence/phase-30a-local-workflow-automation.json",
  "apps/ai-gateway-service/evidence/phase-31a-experience-capabilities.json",
  "apps/ai-gateway-service/evidence/phase-32a-enterprise-governance.json",
  "apps/ai-gateway-service/evidence/phase-33a-enterprise-admin-console.json",
  "apps/ai-gateway-service/evidence/phase-34a-enterprise-security-hardening.json",
  "apps/ai-gateway-service/evidence/phase-35a-enterprise-user-lifecycle.json",
  "apps/ai-gateway-service/evidence/phase-36a-enterprise-audit-export.json",
  "apps/ai-gateway-service/evidence/phase-37a-enterprise-ops-readiness.json",
  "apps/ai-gateway-service/evidence/phase-38a-enterprise-startup-readiness.json",
  "apps/ai-gateway-service/evidence/phase-40a-enterprise-deployment-preflight.json",
  "apps/ai-gateway-service/evidence/phase-41a-enterprise-config-wizard.json",
  "apps/ai-gateway-service/evidence/phase-42a-enterprise-handoff-manifest.json",
  "apps/ai-gateway-service/evidence/phase-43a-enterprise-acceptance-report.json",
  "apps/ai-gateway-service/evidence/phase-44a-enterprise-acceptance-ui.json",
];

const rootScriptsRequired = [
  "help:phase14a",
  "dev:phase7b",
  "status:phase10a",
  "logs:phase16a",
  "idle:phase15a",
  "stop:phase9c",
  "verify:phase21",
  "verify:phase22",
  "verify:phase23",
  "verify:phase24",
  "verify:phase25a",
  "verify:phase26a",
  "verify:phase27",
  "verify:phase28a",
  "verify:phase29a",
  "verify:phase30a",
  "verify:phase31a",
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
  "verify:phase43a",
  "verify:phase44a",
  "verify:phase45a",
  "verify:phase46a",
  "verify:phase47a",
  "verify:enterprise",
];

const enterpriseAggregateRequired = [
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
  "verify:phase43a",
  "verify:phase44a",
  "verify:phase45a",
  "verify:phase46a",
  "verify:phase47a",
];

const serviceScriptsRequired = [
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
  "verify:phase43a",
  "verify:phase44a",
  "verify:phase45a",
  "verify:phase46a",
  "verify:phase47a",
];

const requiredUiMarkers = [
  "phase40a-enterprise-deployment-preflight",
  "phase41a-enterprise-config-wizard",
  "phase44a-enterprise-acceptance-ui",
  "phase46a-enterprise-release-candidate-ui",
  "phase47a-enterprise-overview-ui",
  "/enterprise/acceptance/report",
  "/enterprise/release-candidate/dry-run",
  "/enterprise/overview",
  "/enterprise/deployment/readiness",
  "/enterprise/security/readiness",
  "/enterprise/startup/readiness",
];

const requiredBoundaryMarkers = [
  "nvidia",
  "local-keyword",
  "pgvector",
  "not release automation",
  "not infrastructure",
  "not full enterprise",
  "not full",
  "not a secret manager",
];

const secretValuePatterns = [
  { id: "google-api-key", pattern: /AIza[0-9A-Za-z_-]{20,}/ },
  { id: "postgres-pooler-password", pattern: /postgresql:\/\/postgres\.[^:\s]+:[^<][^@\s]+@[^/\s]+\/postgres/i },
  { id: "nvidia-api-key", pattern: /nvapi-[0-9A-Za-z_-]{20,}/i },
];

let evidence;

try {
  const files = await readRequiredFiles();
  const rootPackage = JSON.parse(files["package.json"]);
  const servicePackage = JSON.parse(files["apps/ai-gateway-service/package.json"]);

  const result = {
    docs: checkDocs(files),
    scripts: checkScripts(rootPackage, servicePackage),
    evidence: await checkEvidence(),
    ui: checkUi(files["apps/ai-gateway-service/src/ui/consolePage.js"]),
    boundaries: checkBoundaries(files),
    envTemplate: checkEnvTemplate(files[".env.enterprise.example"]),
    secretScan: checkSecretLeak(files),
  };
  const passed = Object.values(result).every((item) => item.status === "passed");

  evidence = createEvidence({
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    result,
    conclusion: passed ? "enterprise-release-candidate-dry-run-ready" : "enterprise-release-candidate-dry-run-not-ready",
  });
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  evidence = createEvidence({
    status: "failed",
    generatedAt: new Date().toISOString(),
    result: {},
    error: error instanceof Error ? error.message : String(error),
    conclusion: "enterprise-release-candidate-dry-run-not-ready",
  });
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
}

async function readRequiredFiles() {
  const paths = [
    "package.json",
    "apps/ai-gateway-service/package.json",
    "apps/ai-gateway-service/src/ui/consolePage.js",
    ...requiredDocs,
  ];
  const entries = await Promise.all(
    paths.map(async (path) => [path, await readFile(resolve(repoRoot, path), "utf8")])
  );
  return Object.fromEntries(entries);
}

function checkDocs(files) {
  const present = requiredDocs.filter((path) => typeof files[path] === "string" && files[path].length > 0);
  const missing = requiredDocs.filter((path) => !present.includes(path));
  return {
    status: missing.length === 0 ? "passed" : "failed",
    requiredCount: requiredDocs.length,
    present,
    missing,
  };
}

function checkScripts(rootPackage, servicePackage) {
  const rootScripts = rootPackage.scripts ?? {};
  const serviceScripts = servicePackage.scripts ?? {};
  const enterpriseAggregate = rootScripts["verify:enterprise"] ?? "";
  const serviceCheck = serviceScripts.check ?? "";
  const missingRootScripts = rootScriptsRequired.filter((script) => !rootScripts[script]);
  const missingServiceScripts = serviceScriptsRequired.filter((script) => !serviceScripts[script]);
  const missingEnterpriseAggregate = enterpriseAggregateRequired.filter((script) => !enterpriseAggregate.includes(script));
  const serviceCheckIncludesPhase45 = serviceCheck.includes("verifyEnterpriseReleaseCandidateDryRun.js");
  const serviceCheckIncludesPhase46 = serviceCheck.includes("verifyEnterpriseReleaseCandidateUi.js");
  const serviceCheckIncludesPhase47 = serviceCheck.includes("verifyEnterpriseOverviewUi.js");
  const helpIncludesPhase45 = Boolean(rootScripts["help:phase14a"]?.includes("verify:phase45a"));
  const helpIncludesPhase46 = Boolean(rootScripts["help:phase14a"]?.includes("verify:phase46a"));
  const helpIncludesPhase47 = Boolean(rootScripts["help:phase14a"]?.includes("verify:phase47a"));
  return {
    status:
      missingRootScripts.length === 0 &&
      missingServiceScripts.length === 0 &&
      missingEnterpriseAggregate.length === 0 &&
      serviceCheckIncludesPhase45 &&
      serviceCheckIncludesPhase46 &&
      serviceCheckIncludesPhase47 &&
      helpIncludesPhase45 &&
      helpIncludesPhase46 &&
      helpIncludesPhase47
        ? "passed"
        : "failed",
    missingRootScripts,
    missingServiceScripts,
    missingEnterpriseAggregate,
    serviceCheckIncludesPhase45,
    serviceCheckIncludesPhase46,
    serviceCheckIncludesPhase47,
    helpIncludesPhase45,
    helpIncludesPhase46,
    helpIncludesPhase47,
  };
}

async function checkEvidence() {
  const items = [];
  const missing = [];
  const failed = [];
  for (const path of requiredEvidence) {
    try {
      const body = JSON.parse(await readFile(resolve(repoRoot, path), "utf8"));
      const item = {
        path,
        phase: body.phase ?? null,
        status: body.status ?? null,
        conclusion: body.conclusion ?? null,
        generatedAt: body.generatedAt ?? null,
      };
      items.push(item);
      if (item.status !== "passed") failed.push(item);
    } catch (error) {
      missing.push({
        path,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return {
    status: missing.length === 0 && failed.length === 0 ? "passed" : "failed",
    requiredCount: requiredEvidence.length,
    passedCount: items.filter((item) => item.status === "passed").length,
    missing,
    failed,
    items,
  };
}

function checkUi(text) {
  const missingMarkers = requiredUiMarkers.filter((marker) => !text.includes(marker));
  return {
    status: missingMarkers.length === 0 ? "passed" : "failed",
    missingMarkers,
  };
}

function checkBoundaries(files) {
  const combined = Object.entries(files)
    .filter(([path]) => path.endsWith(".md") || path === "README.md" || path === "AGENTS.md" || path === ".env.enterprise.example")
    .map(([, text]) => text)
    .join("\n")
    .toLowerCase();
  const missingMarkers = requiredBoundaryMarkers.filter((marker) => !combined.includes(marker));
  return {
    status: missingMarkers.length === 0 ? "passed" : "failed",
    missingMarkers,
  };
}

function checkEnvTemplate(text) {
  const requiredKeys = [
    "NVIDIA_API_KEY",
    "KNOWLEDGE_EMBEDDING_API_KEY",
    "PGVECTOR_CONNECTION_STRING",
    "PME_AUTH_TOKEN",
    "KNOWLEDGE_INFRA_MODE=local-keyword",
  ];
  const missingKeys = requiredKeys.filter((key) => !text.includes(key));
  const placeholderSafe =
    getTemplateLine(text, "NVIDIA_API_KEY")?.includes("<set-in-local-secret-store>") &&
    getTemplateLine(text, "KNOWLEDGE_EMBEDDING_API_KEY")?.includes("<set-in-local-secret-store>") &&
    getTemplateLine(text, "PME_AUTH_TOKEN")?.includes("<set-in-local-secret-store>") &&
    getTemplateLine(text, "PGVECTOR_CONNECTION_STRING")?.includes("<password>");
  return {
    status: missingKeys.length === 0 && placeholderSafe ? "passed" : "failed",
    missingKeys,
    placeholderSafe: Boolean(placeholderSafe),
  };
}

function getTemplateLine(text, key) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.includes(key) && line.includes("="));
}

function checkSecretLeak(files) {
  const scannedPaths = [
    "README.md",
    "AGENTS.md",
    "docs/DELIVERY_GUIDE.md",
    "docs/OPERATION_MANUAL.md",
    "docs/ENTERPRISE_DEPLOYMENT_RUNBOOK.md",
    "docs/ENTERPRISE_HANDOFF_MANIFEST.md",
    "docs/ENTERPRISE_ACCEPTANCE_REPORT.md",
    ".env.enterprise.example",
  ];
  const matches = [];
  for (const path of scannedPaths) {
    const text = files[path] ?? "";
    for (const { id, pattern } of secretValuePatterns) {
      if (pattern.test(text)) {
        matches.push({ path, pattern: id });
      }
    }
  }
  return {
    status: matches.length === 0 ? "passed" : "failed",
    scannedCount: scannedPaths.length,
    matches,
  };
}

function createEvidence({ status, generatedAt, result, conclusion, error }) {
  return {
    phase: PHASE,
    status,
    generatedAt,
    releaseCandidate: {
      mode: "read-only-dry-run",
      packageCreated: false,
      releaseCreated: false,
      artifactPublished: false,
    },
    result,
    safety: {
      readOnlyDryRun: true,
      providerCalls: false,
      runtimeMutation: false,
      releaseAutomation: false,
      infrastructureProvisioning: false,
      secretValuesRecorded: false,
    },
    error: error ?? null,
    conclusion,
  };
}

async function writeEvidence(body) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, createEvidenceMarkdown(body), "utf8");
}

function createEvidenceMarkdown(body) {
  return `# Phase 45A Enterprise Release Candidate Dry-run Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Mode: ${body.releaseCandidate?.mode}
- Package created: ${body.releaseCandidate?.packageCreated}
- Release created: ${body.releaseCandidate?.releaseCreated}
- Artifact published: ${body.releaseCandidate?.artifactPublished}
- Docs status: ${body.result?.docs?.status ?? "n/a"}
- Scripts status: ${body.result?.scripts?.status ?? "n/a"}
- Evidence status: ${body.result?.evidence?.status ?? "n/a"}
- Evidence required: ${body.result?.evidence?.requiredCount ?? "n/a"}
- Evidence passed: ${body.result?.evidence?.passedCount ?? "n/a"}
- UI marker status: ${body.result?.ui?.status ?? "n/a"}
- Boundary status: ${body.result?.boundaries?.status ?? "n/a"}
- Env template status: ${body.result?.envTemplate?.status ?? "n/a"}
- Secret scan status: ${body.result?.secretScan?.status ?? "n/a"}
- Read-only dry-run: ${body.safety?.readOnlyDryRun}
- Provider calls: ${body.safety?.providerCalls}
- Runtime mutation: ${body.safety?.runtimeMutation}
- Release automation: ${body.safety?.releaseAutomation}
- Infrastructure provisioning: ${body.safety?.infrastructureProvisioning}
- Secret values recorded: ${body.safety?.secretValuesRecorded}
- Conclusion: ${body.conclusion}
`;
}
