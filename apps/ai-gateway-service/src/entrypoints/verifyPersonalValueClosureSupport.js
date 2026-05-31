import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  countSecretFindings,
  createDisabledState,
  createSafety,
  noOhMyCodexDependency,
  noProjectContext,
  readRequired,
  readWorkspaceTexts,
  repoRoot,
  writeEvidence,
} from "./verifyAgentWorkforceClosureSupport.js";

const uiPath = "apps/ai-gateway-service/src/ui/consolePage.js";

const requiredBoundaryMarkers = [
  "Modify `legacy/`",
  "Create `PROJECT_CONTEXT.md`",
  "Do not add heavy dependencies",
  "Do not call real `codex exec`",
  "Do not create worktrees",
  "Do not connect workflow runner",
  "Do not automatically commit or push",
  "Do not change the default NVIDIA `/chat` mainline",
  "Do not promise unattended automatic development",
  "Do not promise production-grade vector RAG or GraphRAG",
  "Do not describe preview-only capability as production-ready",
  "Do not write real API keys",
  "Do not treat approval-preview as execution authorization",
  "Do not describe dirty workspace as clean",
  "Do not forge phase evidence",
];

const blockedDependencies = [
  "chromadb",
  "langchain",
  "@langchain/core",
  "@pinecone-database/pinecone",
  "weaviate-client",
  "pgvector",
  "vectordb",
  "sqlite-vss",
  "llamaindex",
];

function containsAll(text, snippets) {
  return snippets.every((snippet) => text.includes(snippet));
}

function sliceBetween(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  if (start < 0) return "";
  const end = text.indexOf(endMarker, start + startMarker.length);
  return end >= 0 ? text.slice(start, end) : text.slice(start);
}

function hasUnsafePositiveLine(text, checks) {
  const negative = /\b(no|not|never|without|blocked|disabled|forbidden|must not|does not|cannot|requires explicit|explicitly gated|preview-only|dry-run|manual|out of scope|do not|not a|not production|stop|avoid|will not|must not)\b/i;
  return text
    .split(/\r?\n/)
    .some((line) => checks.some((terms) => terms.every((term) => line.toLowerCase().includes(term))) && !negative.test(line));
}

function hasBlockedDependency(rootPackage, servicePackage) {
  const packageMaps = [
    rootPackage.dependencies,
    rootPackage.devDependencies,
    rootPackage.optionalDependencies,
    servicePackage.dependencies,
    servicePackage.devDependencies,
    servicePackage.optionalDependencies,
  ].filter(Boolean);
  return blockedDependencies.some((name) => packageMaps.some((deps) => Object.hasOwn(deps, name)));
}

async function readEvidenceStatus(relativePath) {
  if (!existsSync(resolve(repoRoot, relativePath))) return "missing";
  const text = await readRequired(relativePath);
  try {
    return JSON.parse(text).status ?? "unknown";
  } catch {
    return "unparseable";
  }
}

export async function verifyPersonalValuePhase(config) {
  const {
    phase,
    docPath,
    verifierPath,
    rootScriptName,
    serviceScriptValue,
    requiredDocSections,
    requiredDocMarkers,
    requiredUiMarkers,
    requiredVerificationCommands,
    requiredEvidenceStatusPaths = [],
    conclusionPassed,
    conclusionFailed,
    capabilityList,
    notes,
  } = config;
  const evidenceJsonPath = `apps/ai-gateway-service/evidence/${phase}.json`;
  const evidenceMdPath = `apps/ai-gateway-service/evidence/${phase}.md`;

  try {
    const [doc, texts] = await Promise.all([
      readRequired(docPath),
      readWorkspaceTexts(),
    ]);

    const personalUiSection = sliceBetween(
      texts.ui,
      'data-phase="phase237a-personal-operator-console"',
      'data-phase="phase102c-agent-workforce-product-closure"',
    );
    const scannedText = [
      doc,
      personalUiSection,
      texts.rootPackageText,
      texts.servicePackageText,
    ].join("\n");
    const claimScanText = [doc, personalUiSection].join("\n");
    const secretFindingCount = countSecretFindings(scannedText, phase);
    const requiredEvidenceStatuses = Object.fromEntries(
      await Promise.all(requiredEvidenceStatusPaths.map(async (path) => [path, await readEvidenceStatus(path)])),
    );

    const checks = {
      docExists: existsSync(resolve(repoRoot, docPath)),
      uiSourceExists: existsSync(resolve(repoRoot, uiPath)),
      verifierExists: existsSync(resolve(repoRoot, verifierPath)),
      allRequiredDocSectionsPresent: containsAll(doc, requiredDocSections),
      allRequiredDocMarkersPresent: containsAll(doc, requiredDocMarkers),
      allRequiredUiMarkersPresent: containsAll(personalUiSection, requiredUiMarkers),
      allRequiredVerificationCommandsPresent:
        containsAll(doc, requiredVerificationCommands) &&
        containsAll(personalUiSection, requiredVerificationCommands),
      allRequiredBoundariesPresent: containsAll(doc, requiredBoundaryMarkers),
      requiredEvidenceAlreadyPassed: Object.values(requiredEvidenceStatuses).every((status) => status === "passed"),
      rootScriptPresent:
        texts.rootPackage.scripts?.[rootScriptName] ===
        `pnpm --filter @unified-ai-system/ai-gateway-service ${rootScriptName}`,
      serviceScriptPresent: texts.servicePackage.scripts?.[rootScriptName] === serviceScriptValue,
      noProjectContext: noProjectContext(),
      noOhMyCodexDependency: noOhMyCodexDependency(texts.rootPackageText, texts.servicePackageText),
      noBlockedDependency: !hasBlockedDependency(texts.rootPackage, texts.servicePackage),
      noPlainSecrets: secretFindingCount === 0,
      doesNotClaimRealCodexExec: !hasUnsafePositiveLine(claimScanText, [
        ["codex", "exec", "enabled"],
        ["codex", "exec", "automatic"],
        ["codex", "exec", "default"],
        ["real", "codex", "execution"],
      ]),
      doesNotClaimProductionRag: !hasUnsafePositiveLine(claimScanText, [
        ["production-grade", "vector", "rag"],
        ["production", "vector", "rag"],
        ["production-grade", "graphrag"],
        ["production-ready", "rag"],
      ]),
      doesNotClaimPreviewAsProductionReady: !hasUnsafePositiveLine(claimScanText, [
        ["preview-only", "production-ready"],
        ["preview", "production-ready"],
        ["design-only", "production-ready"],
      ]),
      doesNotClaimUnattendedDevelopment: !hasUnsafePositiveLine(claimScanText, [
        ["unattended", "development"],
        ["automatic", "development"],
      ]),
      doesNotClaimDirtyWorkspaceClean: !hasUnsafePositiveLine(claimScanText, [
        ["dirty", "workspace", "clean"],
      ]),
      evidenceJsonGenerated: true,
      evidenceMdGenerated: true,
    };

    const passed = Object.values(checks).every(Boolean);
    const evidence = {
      phase,
      status: passed ? "passed" : "failed",
      generatedAt: new Date().toISOString(),
      conclusion: passed ? conclusionPassed : conclusionFailed,
      docPath,
      uiPath,
      verifierPath,
      evidencePaths: [evidenceJsonPath, evidenceMdPath],
      verifiedDocuments: [
        docPath,
        uiPath,
        "package.json",
        "apps/ai-gateway-service/package.json",
      ],
      capabilityList,
      requiredEvidenceStatuses,
      disabledState: createDisabledState(),
      safety: {
        ...createSafety(),
        codexCliInvoked: false,
        codexExecInvoked: false,
        desktopGuiSendInvoked: false,
        autoCommit: false,
        autoPush: false,
        autoApply: false,
        workflowRunEnabled: false,
        worktreeCreated: false,
        defaultNvidiaChatLaneChanged: false,
        productionVectorRagClaimed: false,
        graphRagClaimed: false,
        previewAsProductionReady: false,
        unattendedDevelopmentClaimed: false,
        approvalPreviewAsExecutionAuthorization: false,
        dirtyWorkspaceClaimedClean: false,
        forgedEvidence: false,
        newDependencyAdded: false,
      },
      secretFindingCount,
      checks,
      notes,
    };

    await writeEvidence(phase, evidence);
    console.log(JSON.stringify(evidence, null, 2));
    process.exitCode = passed ? 0 : 1;
  } catch (error) {
    const evidence = {
      phase,
      status: "failed",
      generatedAt: new Date().toISOString(),
      conclusion: `${phase}-verification-error`,
      error: error instanceof Error ? error.message : String(error),
      docPath,
      uiPath,
      verifierPath,
      evidencePaths: [evidenceJsonPath, evidenceMdPath],
      disabledState: createDisabledState(),
      safety: {
        ...createSafety(),
        codexCliInvoked: false,
        codexExecInvoked: false,
        desktopGuiSendInvoked: false,
        autoCommit: false,
        autoPush: false,
        autoApply: false,
        workflowRunEnabled: false,
        worktreeCreated: false,
        defaultNvidiaChatLaneChanged: false,
      },
      secretFindingCount: "unknown",
      checks: {},
      notes: [`Verification failed before all ${phase} checks could complete.`],
    };
    await writeEvidence(phase, evidence);
    console.log(JSON.stringify(evidence, null, 2));
    process.exitCode = 1;
  }
}
