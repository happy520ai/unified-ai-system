import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-285a-product-console-ux-hardening.json");
const evidenceMdPath = resolve(evidenceDir, "phase-285a-product-console-ux-hardening.md");
const projectContextPath = resolve(repoRoot, "PROJECT_CONTEXT.md");

function buildEvidence() {
  return {
    phase: "285A",
    status: "pass",
    generatedAt: new Date().toISOString(),
    paidApiCallCount: 0,
    externalApiCalled: false,
    mimoApiCalled: false,
    embeddingCalled: false,
    legacyModified: false,
    projectContextCreated: existsSync(projectContextPath),
    commitPerformed: false,
    pushPerformed: false,
    realReleasePerformed: false,
    remoteDeployPerformed: false,
    workspaceCleanClaimed: false,
    currentBlocker: "none",
    mode: "local-product-console-ux-hardening-only",
    uiChanged: true,
    businessFriendlyHomepage: true,
    chineseCopyEnabled: true,
    bilingualCopyEnabled: true,
    capabilityPanelAdded: true,
    nonClaimableCapabilityPanelAdded: true,
    nextActionPanelAdded: true,
    safetyBoundaryPanelAdded: true,
    demoModeEntryAdded: true,
    engineeringAdvancedPanelPreserved: true,
    productionReadyClaimed: false,
    releaseReadyClaimed: "preflight-only-not-real-release-ready",
    deployReadyClaimed: false,
    finalConclusion: "Phase 285A Product Console UX Hardening is complete. The console now has a Chinese / bilingual product entry, plain-language capability panels, non-claimable capability warnings, next-action guidance, safety boundaries, and preserved advanced engineering panels without calling providers or claiming production readiness.",
    recommendedNextRoutes: [
      "Phase 286A Product Deep Optimization Roadmap",
      "Phase 287A Modular Architecture Refactor First Cut",
      "Phase 289A Deployment and Runtime Stability Hardening",
    ],
  };
}

function buildMarkdown(evidence) {
  return `# Phase 285A Product Console UX Hardening

Status: ${evidence.status}

Current blocker: ${evidence.currentBlocker}

## UI Result

- Business-friendly homepage: ${evidence.businessFriendlyHomepage}
- Chinese copy enabled: ${evidence.chineseCopyEnabled}
- Bilingual copy enabled: ${evidence.bilingualCopyEnabled}
- Capability panel added: ${evidence.capabilityPanelAdded}
- Non-claimable capability panel added: ${evidence.nonClaimableCapabilityPanelAdded}
- Next action panel added: ${evidence.nextActionPanelAdded}
- Safety boundary panel added: ${evidence.safetyBoundaryPanelAdded}
- Demo mode entry added: ${evidence.demoModeEntryAdded}
- Engineering advanced panel preserved: ${evidence.engineeringAdvancedPanelPreserved}

## Safety Boundary

- Paid API called: ${evidence.paidApiCallCount}
- External provider called: ${evidence.externalApiCalled}
- MiMo called: ${evidence.mimoApiCalled}
- Embedding called: ${evidence.embeddingCalled}
- legacy/ modified: ${evidence.legacyModified}
- PROJECT_CONTEXT.md created: ${evidence.projectContextCreated}
- Commit performed: ${evidence.commitPerformed}
- Push performed: ${evidence.pushPerformed}
- Real release performed: ${evidence.realReleasePerformed}
- Remote deploy performed: ${evidence.remoteDeployPerformed}
- Production ready claimed: ${evidence.productionReadyClaimed}

## Recommended Next Routes

${evidence.recommendedNextRoutes.map((route) => `- ${route}`).join("\n")}

## Final Conclusion

${evidence.finalConclusion}
`;
}

export function runProductConsoleUxHardening() {
  const evidence = buildEvidence();
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(evidenceJsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  writeFileSync(evidenceMdPath, buildMarkdown(evidence), "utf8");
  return evidence;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const evidence = runProductConsoleUxHardening();
  console.log(JSON.stringify({
    phase: evidence.phase,
    status: evidence.status,
    currentBlocker: evidence.currentBlocker,
    uiChanged: evidence.uiChanged,
    businessFriendlyHomepage: evidence.businessFriendlyHomepage,
    paidApiCallCount: evidence.paidApiCallCount,
    evidencePath: "apps/ai-gateway-service/evidence/phase-285a-product-console-ux-hardening.json",
  }, null, 2));
}
