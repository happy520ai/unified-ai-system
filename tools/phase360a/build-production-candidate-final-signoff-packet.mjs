import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(
  repoRoot,
  "apps/ai-gateway-service/evidence/phase359a/production-readiness-final-no-deploy-gate-result.json",
);
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase360a");
const resultPath = resolve(evidenceDir, "production-candidate-final-signoff-result.json");
const packetPath = resolve(repoRoot, "docs/phase360a-production-candidate-final-signoff-packet.md");
const boundaryPath = resolve(repoRoot, "docs/phase360a-deploy-not-authorized-boundary.json");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const blockers = Array.isArray(source.blockers) ? source.blockers : [];
const result = {
  phase: "Phase360A",
  sourcePhase: source.phase,
  productionCandidateSignoffPacketGenerated: true,
  deployAuthorized: false,
  releaseAuthorized: false,
  productionGaAuthorized: false,
  humanApprovalRequiredBeforeDeploy: true,
  blockerCount: blockers.length,
  blockers,
  deployNotAuthorizedBoundary: true,
  unauthorizedProviderCalled: false,
  secretValueExposed: false,
  realBillingConnected: false,
  legalInvoiceGenerated: false,
  workspaceCleanClaimed: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(
  boundaryPath,
  `${JSON.stringify(
    {
      phase: "Phase360A",
      boundaryName: "deploy-not-authorized",
      productionCandidateOnly: true,
      deployAuthorized: false,
      releaseAuthorized: false,
      productionGaAuthorized: false,
      humanApprovalRequiredBeforeDeploy: true,
      secretValueExposed: false,
      unauthorizedProviderCalled: false,
      realBillingConnected: false,
      legalInvoiceGenerated: false,
      workspaceCleanClaimed: false,
      blockers,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
await writeFile(
  packetPath,
  [
    "# Phase360A Production Candidate Final Signoff Packet",
    "",
    "- productionCandidateSignoffPacketGenerated: true",
    "- deployAuthorized: false",
    "- releaseAuthorized: false",
    "- productionGaAuthorized: false",
    "- humanApprovalRequiredBeforeDeploy: true",
    `- blockerCount: ${blockers.length}`,
    `- blockers: ${blockers.join(", ") || "none"}`,
    "- deployNotAuthorizedBoundary: true",
  ].join("\n"),
  "utf8",
);

console.log(JSON.stringify(result, null, 2));
