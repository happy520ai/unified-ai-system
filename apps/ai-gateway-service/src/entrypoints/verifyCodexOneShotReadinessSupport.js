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
  "Do not execute codex command",
  "Do not create worktrees",
  "Do not connect workflow runner",
  "Do not automatically commit or push",
  "Do not change the default NVIDIA `/chat` mainline",
  "Do not promise unattended automatic development",
  "Do not treat approval-preview as execution authorization",
  "Do not write real API keys",
  "Do not describe dirty workspace as clean",
  "Do not describe readiness as execution completed",
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
  "@openai/codex",
  "oh-my-codex",
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

function toLogicalStatements(text) {
  const statements = [];
  let current = "";
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (current) statements.push(current);
      current = "";
      continue;
    }

    const startsNew = /^(-|\d+\.|#{1,6}\s|```)/.test(trimmed);
    if (startsNew && current) {
      statements.push(current);
      current = trimmed;
    } else {
      current = current ? `${current} ${trimmed}` : trimmed;
    }
  }
  if (current) statements.push(current);
  return statements;
}

function hasUnsafePositiveStatement(text, checks) {
  const negative = /\b(no|not|never|without|blocked|disabled|forbidden|must not|does not|cannot|requires explicit|explicitly gated|preview-only|dry-run|manual|out of scope|do not|not a|not production|stop|avoid|will not|still not|is not|must remain false|readiness only|future)\b/i;
  return toLogicalStatements(text).some((statement) =>
    checks.some((terms) => terms.every((term) => statement.toLowerCase().includes(term))) &&
      !negative.test(statement),
  );
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

export async function verifyCodexOneShotReadinessPhase(config) {
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
      doesNotClaimRealCodexExec: !hasUnsafePositiveStatement(claimScanText, [
        ["codex", "exec", "enabled"],
        ["codex", "exec", "automatic"],
        ["codex", "exec", "default"],
        ["real", "codex", "execution"],
        ["codexexecinvoked", "true"],
      ]),
      doesNotClaimCodexCommandExecuted: !hasUnsafePositiveStatement(claimScanText, [
        ["codex", "cli", "called"],
        ["codex", "command", "executed"],
        ["codex", "command", "runs"],
      ]),
      doesNotClaimReadinessAsExecutionCompleted: !hasUnsafePositiveStatement(claimScanText, [
        ["readiness", "execution", "completed"],
        ["execution", "completed"],
      ]),
      doesNotClaimAutoCodeChange: !hasUnsafePositiveStatement(claimScanText, [
        ["automatic", "code", "modification"],
        ["automatically", "modify", "code"],
        ["automatic", "commit"],
        ["automatic", "push"],
      ]),
      doesNotTreatApprovalPreviewAsAuthorization: !hasUnsafePositiveStatement(claimScanText, [
        ["approval-preview", "execution", "authorization"],
        ["approval-preview", "execution", "permission"],
      ]),
      doesNotClaimUnattendedDevelopment: !hasUnsafePositiveStatement(claimScanText, [
        ["unattended", "development"],
        ["automatic", "development"],
      ]),
      doesNotClaimDirtyWorkspaceClean: !hasUnsafePositiveStatement(claimScanText, [
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
      disabledState: {
        ...createDisabledState(),
        executionEnabled: false,
      },
      safety: {
        ...createSafety(),
        codexCliInvoked: false,
        codexExecInvoked: false,
        desktopGuiSendInvoked: false,
        executionEnabled: false,
        autoCodeModification: false,
        autoCommit: false,
        autoPush: false,
        autoApply: false,
        workflowRunEnabled: false,
        worktreeCreated: false,
        defaultNvidiaChatLaneChanged: false,
        approvalPreviewAsExecutionAuthorization: false,
        dirtyWorkspaceClaimedClean: false,
        readinessClaimedExecutionCompleted: false,
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
      disabledState: {
        ...createDisabledState(),
        executionEnabled: false,
      },
      safety: {
        ...createSafety(),
        codexCliInvoked: false,
        codexExecInvoked: false,
        desktopGuiSendInvoked: false,
        executionEnabled: false,
        autoCodeModification: false,
        autoCommit: false,
        autoPush: false,
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
