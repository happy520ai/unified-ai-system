/**
 * Phase 135A Release Publish Preflight — shared helpers.
 *
 * Extracted from verifyReleasePublishPreflight.js to keep the entrypoint
 * under the 500-line anti-entropy limit.
 */

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

export function markdown(evidence) {
  const headGate = evidence.github.latestHeadReleaseGate;
  const targetGate = evidence.github.releaseTargetGate;
  return [
    "# Phase 135A Release Publish Preflight Evidence",
    "",
    `- Phase: ${evidence.phase}`,
    `- Status: ${evidence.status}`,
    `- Generated at: ${evidence.generatedAt}`,
    `- Candidate version: ${evidence.candidate.version}`,
    `- Candidate tag: ${evidence.candidate.tag}`,
    `- Candidate title: ${evidence.candidate.title}`,
    `- Release target commit: ${evidence.candidate.releaseTargetCommit}`,
    `- Release URL: ${evidence.candidate.releaseUrl}`,
    `- Release draft: ${evidence.github.release.isDraft}`,
    `- Release prerelease: ${evidence.github.release.isPrerelease}`,
    `- Release published at: ${evidence.github.release.publishedAt ?? "none"}`,
    `- Release asset count: ${evidence.github.release.assetCount}`,
    `- Release published by later Phase136A: ${evidence.safety.releasePublishedByLaterPhase136}`,
    `- Current head: ${evidence.git.headSha}`,
    `- Current head Release Gate: ${headGate ? `${headGate.workflowName} ${headGate.status} ${headGate.conclusion}`.trim() : "none"}`,
    `- Current head Release Gate URL: ${headGate?.url ?? "none"}`,
    `- Release target gate: ${targetGate ? `${targetGate.workflowName} ${targetGate.status} ${targetGate.conclusion}`.trim() : "none"}`,
    `- Release target gate URL: ${targetGate?.url ?? "none"}`,
    `- Required publish phrase: ${evidence.candidate.requiredPublishPhrase}`,
    `- Required asset phrase: ${evidence.candidate.requiredAssetPhrase}`,
    `- Release published by this phase: ${evidence.safety.releasePublished}`,
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
    "## Next Manual Decisions",
    "",
    ...evidence.nextManualDecisions.map((decision) => `- ${decision}`),
    "",
    "## Boundary",
    "",
    "- This phase is a read-only publish and asset-upload preflight.",
    "- It does not publish the draft release, upload assets, publish packages/images, deploy cloud infrastructure, or complete global release.",
    "",
  ].join("\n");
}
