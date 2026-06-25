import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");

export function normalizePath(value) {
  return String(value ?? "").trim().replace(/\\/g, "/").replace(/\/$/, "");
}

export function parseJsonMaybe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

export function parseLines(text) {
  return String(text ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

export function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export async function readRequired(relativePath) {
  return readFile(resolve(repoRoot, relativePath), "utf8");
}

export async function readOptional(relativePath) {
  if (!existsSync(resolve(repoRoot, relativePath))) {
    return "";
  }

  return readFile(resolve(repoRoot, relativePath), "utf8");
}

export function redactRemoteLine(line) {
  return String(line).replace(/:\/\/[^@\s]+@/g, "://[redacted]@");
}

export function markdown(evidence) {
  const headGate = evidence.github.latestHeadReleaseGate;
  const targetGate = evidence.github.releaseTargetGate;
  return [
    "# Phase 136A Release Publish Execution Evidence",
    "",
    `- Phase: ${evidence.phase}`,
    `- Status: ${evidence.status}`,
    `- Generated at: ${evidence.generatedAt}`,
    `- Candidate version: ${evidence.candidate.version}`,
    `- Candidate tag: ${evidence.candidate.tag}`,
    `- Candidate title: ${evidence.candidate.title}`,
    `- Release target commit: ${evidence.candidate.releaseTargetCommit}`,
    `- Release URL: ${evidence.candidate.releaseUrl}`,
    `- Release published at: ${evidence.candidate.releasePublishedAt}`,
    `- Release draft: ${evidence.github.release.isDraft}`,
    `- Release prerelease: ${evidence.github.release.isPrerelease}`,
    `- Release asset count: ${evidence.github.release.assetCount}`,
    `- Current head Release Gate: ${headGate ? `${headGate.workflowName} ${headGate.status} ${headGate.conclusion}`.trim() : "none"}`,
    `- Current head Release Gate URL: ${headGate?.url ?? "none"}`,
    `- Release target gate: ${targetGate ? `${targetGate.workflowName} ${targetGate.status} ${targetGate.conclusion}`.trim() : "none"}`,
    `- Release target gate URL: ${targetGate?.url ?? "none"}`,
    `- Release published by this phase: ${evidence.safety.releasePublished}`,
    `- Release currently draft by later Phase137A: ${evidence.safety.releaseCurrentlyDraftByLaterPhase137}`,
    `- Release rolled back by later Phase137A: ${evidence.safety.releaseRolledBackByLaterPhase137}`,
    `- Release artifact uploaded by this phase: ${evidence.safety.releaseArtifactUploaded}`,
    `- Package published: ${evidence.safety.packagePublished}`,
    `- Docker image published: ${evidence.safety.dockerImagePublished}`,
    `- Cloud deployment complete: ${evidence.safety.cloudDeploymentComplete}`,
    `- Global release complete: ${evidence.safety.globalReleaseComplete}`,
    `- Plain secret findings: ${evidence.secretFindingCount}`,
    `- Conclusion: ${evidence.conclusion}`,
    "",
    "## Checks",
    "",
    ...Object.entries(evidence.checks).map(
      ([name, value]) => `- ${name}: ${value ? "passed" : "failed"}`,
    ),
    "",
    "## Remaining Limits",
    "",
    ...evidence.remainingLimits.map((limit) => `- ${limit}`),
    "",
    "## Boundary",
    "",
    "- This phase publishes the existing GitHub prerelease only.",
    "- It does not upload assets, publish packages/images, deploy cloud infrastructure, or complete global release.",
    "",
  ].join("\n");
}
