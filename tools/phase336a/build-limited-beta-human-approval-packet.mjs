import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase336a");
const resultPath = resolve(evidenceDir, "limited-beta-human-approval-packet-result.json");
const reportPath = resolve(repoRoot, "docs/phase336a-execution-report.md");
const packetPath = resolve(repoRoot, "docs/phase336a-human-approval-packet.md");
const simulationPath = resolve(repoRoot, "docs/phase336a-no-release-approval-simulation.json");

const phase335a = JSON.parse(
  await readFile(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase335a/limited-beta-final-evidence-freeze-result.json"), "utf8"),
);
const phase334a = JSON.parse(
  await readFile(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase334a/limited-beta-rc-final-dry-run-result.json"), "utf8"),
);

const result = {
  phase: "Phase336A",
  noReleaseSimulation: true,
  releaseExecuted: false,
  deployExecuted: false,
  humanApprovalPacketGenerated: true,
  humanApprovalRequired: true,
  secretValueExposed: false,
  upstreamEvidenceFreezeCompleted: phase335a.evidenceFreezeCompleted === true,
  finalRcDryRunPassed: phase334a.finalRcDryRunPassed === true,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(simulationPath, `${JSON.stringify(buildSimulation(result), null, 2)}\n`, "utf8");
await writeFile(packetPath, renderPacket(result), "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function buildSimulation(current) {
  return {
    phase: "Phase336A",
    simulationName: "limited-beta-human-approval-no-release-simulation",
    noReleaseSimulation: true,
    releaseExecuted: false,
    deployExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    humanApprovalRequired: true,
    limitedBetaDryRunOnly: true,
    upstreamEvidenceFreezeCompleted: current.upstreamEvidenceFreezeCompleted,
  };
}

function renderPacket(current) {
  return [
    "# Phase336A Limited Beta Human Approval Packet",
    "",
    "- Scope: limited beta dry-run closure only",
    "- releaseExecuted: false",
    "- deployExecuted: false",
    "- humanApprovalRequired: true",
    `- finalRcDryRunPassed: ${current.finalRcDryRunPassed}`,
    `- upstreamEvidenceFreezeCompleted: ${current.upstreamEvidenceFreezeCompleted}`,
    "",
    "## Reviewer prompts",
    "",
    "- Confirm no release, deploy, tag, or artifact upload occurred.",
    "- Confirm only dry-run evidence is included.",
    "- Confirm a real deploy still requires a separate human signoff.",
    "",
  ].join("\n");
}

function renderReport(current) {
  return [
    "# Phase336A Execution Report",
    "",
    `- noReleaseSimulation: ${current.noReleaseSimulation}`,
    `- humanApprovalPacketGenerated: ${current.humanApprovalPacketGenerated}`,
    `- releaseExecuted: ${current.releaseExecuted}`,
    `- deployExecuted: ${current.deployExecuted}`,
    "",
  ].join("\n");
}
