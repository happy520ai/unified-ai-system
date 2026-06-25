import { mkdir, readFile, writeFile } from "node:fs/promises";
import { writeEvidencePair } from "./entrypointUtils.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PHASE = "phase-43a-enterprise-acceptance-report";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-43a-enterprise-acceptance-report.json");
const evidenceMdPath = resolve(evidenceDir, "phase-43a-enterprise-acceptance-report.md");
const reportPath = resolve(repoRoot, "docs/ENTERPRISE_ACCEPTANCE_REPORT.md");

const requiredEvidence = [
  {
    label: "Service entry",
    path: "apps/ai-gateway-service/evidence/phase-7a-1-service-entry.json",
  },
  {
    label: "Console to service",
    path: "apps/agent-console/evidence/phase-7a-2-console-service-chain.json",
  },
  {
    label: "Knowledge entry",
    path: "apps/ai-gateway-service/evidence/phase-21a-knowledge-entry.json",
  },
  {
    label: "Knowledge source load",
    path: "apps/ai-gateway-service/evidence/phase-21b-knowledge-source-load.json",
  },
  {
    label: "Console knowledge chain",
    path: "apps/agent-console/evidence/phase-21c-console-knowledge-chain.json",
  },
  {
    label: "Knowledge quality and infra",
    path: "apps/ai-gateway-service/evidence/phase-22-knowledge-quality-infra.json",
  },
  {
    label: "Knowledge production readiness",
    path: "apps/ai-gateway-service/evidence/phase-23-knowledge-production-readiness.json",
  },
  {
    label: "Delivery knowledge sample",
    path: "apps/ai-gateway-service/evidence/phase-24-delivery-knowledge.json",
  },
  {
    label: "Web console",
    path: "apps/ai-gateway-service/evidence/phase-25a-web-console.json",
  },
  {
    label: "Chat-first Web console",
    path: "apps/ai-gateway-service/evidence/phase-26a-chat-first-web-console.json",
  },
  {
    label: "Knowledge persistence",
    path: "apps/ai-gateway-service/evidence/phase-27-knowledge-persistence.json",
  },
  {
    label: "Documented feature closure",
    path: "apps/ai-gateway-service/evidence/phase-28a-documented-feature-closure.json",
  },
  {
    label: "Service RAG chat",
    path: "apps/ai-gateway-service/evidence/phase-29a-service-rag-chat.json",
  },
  {
    label: "Local workflow automation",
    path: "apps/ai-gateway-service/evidence/phase-30a-local-workflow-automation.json",
  },
  {
    label: "Experience capabilities",
    path: "apps/ai-gateway-service/evidence/phase-31a-experience-capabilities.json",
  },
  {
    label: "Enterprise governance",
    path: "apps/ai-gateway-service/evidence/phase-32a-enterprise-governance.json",
  },
  {
    label: "Enterprise admin console",
    path: "apps/ai-gateway-service/evidence/phase-33a-enterprise-admin-console.json",
  },
  {
    label: "Enterprise security hardening",
    path: "apps/ai-gateway-service/evidence/phase-34a-enterprise-security-hardening.json",
  },
  {
    label: "Enterprise user lifecycle",
    path: "apps/ai-gateway-service/evidence/phase-35a-enterprise-user-lifecycle.json",
  },
  {
    label: "Enterprise audit export",
    path: "apps/ai-gateway-service/evidence/phase-36a-enterprise-audit-export.json",
  },
  {
    label: "Enterprise ops readiness",
    path: "apps/ai-gateway-service/evidence/phase-37a-enterprise-ops-readiness.json",
  },
  {
    label: "Enterprise startup readiness",
    path: "apps/ai-gateway-service/evidence/phase-38a-enterprise-startup-readiness.json",
  },
  {
    label: "Enterprise deployment preflight",
    path: "apps/ai-gateway-service/evidence/phase-40a-enterprise-deployment-preflight.json",
  },
  {
    label: "Enterprise config wizard",
    path: "apps/ai-gateway-service/evidence/phase-41a-enterprise-config-wizard.json",
  },
  {
    label: "Enterprise handoff manifest",
    path: "apps/ai-gateway-service/evidence/phase-42a-enterprise-handoff-manifest.json",
  },
];

const requiredDocs = [
  "README.md",
  "AGENTS.md",
  "docs/DELIVERY_GUIDE.md",
  "docs/OPERATION_MANUAL.md",
  "docs/ENTERPRISE_DEPLOYMENT_RUNBOOK.md",
  "docs/ENTERPRISE_HANDOFF_MANIFEST.md",
  ".env.enterprise.example",
];

let evidence;

try {
  const rootPackage = JSON.parse(await readFile(resolve(repoRoot, "package.json"), "utf8"));
  const evidenceSummary = await readEvidenceSummary();
  const docsSummary = await readDocsSummary();
  const commandSummary = checkCommands(rootPackage);
  const boundarySummary = checkBoundaries(docsSummary.combinedText);
  const report = createReport({
    generatedAt: new Date().toISOString(),
    evidenceSummary,
    docsSummary,
    commandSummary,
    boundarySummary,
  });

  await writeFile(reportPath, report, "utf8");

  const passed =
    evidenceSummary.missing.length === 0 &&
    evidenceSummary.failed.length === 0 &&
    docsSummary.missing.length === 0 &&
    commandSummary.status === "passed" &&
    boundarySummary.status === "passed";

  evidence = createEvidence({
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    reportPath: "docs/ENTERPRISE_ACCEPTANCE_REPORT.md",
    evidenceSummary,
    docsSummary,
    commandSummary,
    boundarySummary,
    conclusion: passed ? "enterprise-acceptance-report-ready" : "enterprise-acceptance-report-not-ready",
  });
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  evidence = createEvidence({
    status: "failed",
    generatedAt: new Date().toISOString(),
    reportPath: "docs/ENTERPRISE_ACCEPTANCE_REPORT.md",
    evidenceSummary: { items: [], missing: [], failed: [] },
    docsSummary: { present: [], missing: [] },
    commandSummary: { status: "failed" },
    boundarySummary: { status: "failed" },
    error: error instanceof Error ? error.message : String(error),
    conclusion: "enterprise-acceptance-report-not-ready",
  });
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
}

async function readEvidenceSummary() {
  const items = [];
  const missing = [];
  const failed = [];
  for (const entry of requiredEvidence) {
    const fullPath = resolve(repoRoot, entry.path);
    try {
      const body = JSON.parse(await readFile(fullPath, "utf8"));
      const item = {
        label: entry.label,
        path: entry.path,
        phase: body.phase ?? null,
        status: body.status ?? null,
        generatedAt: body.generatedAt ?? null,
        conclusion: body.conclusion ?? null,
      };
      items.push(item);
      if (item.status !== "passed") {
        failed.push(item);
      }
    } catch (error) {
      missing.push({
        label: entry.label,
        path: entry.path,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return {
    requiredCount: requiredEvidence.length,
    passedCount: items.filter((item) => item.status === "passed").length,
    items,
    missing,
    failed,
  };
}

async function readDocsSummary() {
  const present = [];
  const missing = [];
  const texts = [];
  for (const path of requiredDocs) {
    try {
      const text = await readFile(resolve(repoRoot, path), "utf8");
      present.push(path);
      texts.push(text);
    } catch (error) {
      missing.push({
        path,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return {
    present,
    missing,
    combinedText: texts.join("\n"),
  };
}

function checkCommands(rootPackage) {
  const scripts = rootPackage.scripts ?? {};
  const requiredCommands = [
    "verify:enterprise",
    "verify:phase21",
    "verify:phase22",
    "verify:phase23",
    "verify:phase24",
    "verify:phase31a",
    "verify:phase37a",
    "verify:phase38a",
    "verify:phase40a",
    "verify:phase41a",
    "verify:phase42a",
    "verify:phase43a",
    "verify:phase44a",
  ];
  const missingCommands = requiredCommands.filter((command) => !scripts[command]);
  const enterpriseAggregate = scripts["verify:enterprise"] ?? "";
  const missingAggregateCommands = [
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
  ].filter((command) => !enterpriseAggregate.includes(command));
  return {
    status: missingCommands.length === 0 && missingAggregateCommands.length === 0 ? "passed" : "failed",
    missingCommands,
    missingAggregateCommands,
  };
}

function checkBoundaries(text) {
  const normalized = text.toLowerCase();
  const requiredBoundaryMarkers = [
    "nvidia",
    "local-keyword",
    "pgvector",
    "not release automation",
    "not infrastructure",
    "not full enterprise",
    "not full",
  ];
  const missingMarkers = requiredBoundaryMarkers.filter((marker) => !normalized.includes(marker));
  return {
    status: missingMarkers.length === 0 ? "passed" : "failed",
    missingMarkers,
  };
}

function createReport({ generatedAt, evidenceSummary, docsSummary, commandSummary, boundarySummary }) {
  const rows = evidenceSummary.items
    .map((item) => `| ${escapeCell(item.label)} | ${escapeCell(item.phase)} | ${escapeCell(item.status)} | ${escapeCell(item.conclusion)} |`)
    .join("\n");
  return `# Enterprise Acceptance Report

Generated at: ${generatedAt}

This report is a read-only summary of existing command, document, and evidence
artifacts. It does not provision infrastructure, create releases, mutate
runtime data, call providers, or record secret values.

## Acceptance Summary

- Evidence required: ${evidenceSummary.requiredCount}
- Evidence passed: ${evidenceSummary.passedCount}
- Evidence missing: ${evidenceSummary.missing.length}
- Evidence failed: ${evidenceSummary.failed.length}
- Required docs present: ${docsSummary.present.length}
- Required docs missing: ${docsSummary.missing.length}
- Command status: ${commandSummary.status}
- Boundary status: ${boundarySummary.status}

## Evidence Matrix

| Area | Phase | Status | Conclusion |
| --- | --- | --- | --- |
${rows}

## Required Documents

${docsSummary.present.map((path) => `- ${path}`).join("\n")}

## Official Boundary

- Default \`/chat\` remains NVIDIA single-provider unless explicitly configured.
- Knowledge default mode remains local-keyword; vector/pgvector is explicit.
- Enterprise checks are bounded verification loops, not full IAM/SSO/SIEM,
  governance automation, infrastructure provisioning, or release automation.
- Secrets must remain outside evidence, logs, docs, and committed templates.

## Handoff Commands

\`\`\`powershell
cmd /c pnpm help:phase14a
cmd /c pnpm verify:enterprise
cmd /c pnpm verify:phase21
cmd /c pnpm verify:phase22
cmd /c pnpm verify:phase23
cmd /c pnpm verify:phase24
cmd /c pnpm -r --if-present check
\`\`\`

## Conclusion

Phase43A acceptance summary is ready when all evidence, docs, scripts, and
boundary checks above pass.
`;
}

function escapeCell(value) {
  return String(value ?? "n/a").replace(/\|/g, "\\|");
}

function createEvidence({
  status,
  generatedAt,
  reportPath,
  evidenceSummary,
  docsSummary,
  commandSummary,
  boundarySummary,
  conclusion,
  error,
}) {
  return {
    phase: PHASE,
    status,
    generatedAt,
    reportPath,
    evidence: {
      requiredCount: evidenceSummary.requiredCount ?? 0,
      passedCount: evidenceSummary.passedCount ?? 0,
      missingCount: evidenceSummary.missing?.length ?? 0,
      failedCount: evidenceSummary.failed?.length ?? 0,
      items: evidenceSummary.items ?? [],
    },
    docs: {
      present: docsSummary.present ?? [],
      missing: docsSummary.missing ?? [],
    },
    commands: commandSummary,
    boundaries: boundarySummary,
    safety: {
      readOnlySummary: true,
      providerCalls: false,
      releaseAutomation: false,
      infrastructureProvisioning: false,
      secretValuesRecorded: false,
    },
    error: error ?? null,
    conclusion,
  };
}

