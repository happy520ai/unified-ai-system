import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { findPlainSecretFindings } from "../security/secretSafety.js";

const execFileAsync = promisify(execFile);
const phase = "phase-137a-release-draft-rollback";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const knownGhPath = "C:\\Program Files\\GitHub CLI\\gh.exe";
const repoFullName = "happy520ai/unified-ai-system";
const repoUrl = `https://github.com/${repoFullName}`;
const remoteUrl = `${repoUrl}.git`;
const rollbackDocPath = "docs/RELEASE_DRAFT_ROLLBACK.md";
const candidateVersion = "0.1.0";
const candidateTag = "v0.1.0-rc.1";
const candidateTitle = "unified-ai-system v0.1.0-rc.1";
const releaseTargetCommit = "bdba42b600d712acb77926774c75254b8c290ea6";
const requiredRollbackPhrase = "撤回 GitHub Release v0.1.0-rc.1 为 draft";

async function run(command, args, options = {}) {
  const startedAt = Date.now();
  try {
    const result = await execFileAsync(command, args, {
      cwd: repoRoot,
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
      ...options,
    });
    return {
      command: [command, ...args].join(" "),
      exitCode: 0,
      durationMs: Date.now() - startedAt,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    return {
      command: [command, ...args].join(" "),
      exitCode: typeof error.code === "number" ? error.code : 1,
      durationMs: Date.now() - startedAt,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? error.message,
    };
  }
}

function normalizePath(value) {
  return String(value ?? "").trim().replace(/\\/g, "/").replace(/\/$/, "");
}

async function runGit(args) {
  return run("git", ["-c", `safe.directory=${normalizePath(repoRoot)}`, ...args]);
}

function parseJsonMaybe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function parseLines(text) {
  return String(text ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

async function readRequired(relativePath) {
  return readFile(resolve(repoRoot, relativePath), "utf8");
}

function redactRemoteLine(line) {
  return String(line).replace(/:\/\/[^@\s]+@/g, "://[redacted]@");
}

async function main() {
  const generatedAt = new Date().toISOString();
  const [
    rootPackageText,
    servicePackageText,
    readme,
    agents,
    userManual,
    remoteStatusDoc,
    publishExecutionDoc,
    rollbackDoc,
    workflow,
    phase136EvidenceText,
  ] = await Promise.all([
    readRequired("package.json"),
    readRequired("apps/ai-gateway-service/package.json"),
    readRequired("README.md"),
    readRequired("AGENTS.md"),
    readRequired("docs/USER_MANUAL.md"),
    readRequired("docs/REMOTE_RELEASE_STATUS.md"),
    readRequired("docs/RELEASE_PUBLISH_EXECUTION.md"),
    readRequired(rollbackDocPath),
    readRequired(".github/workflows/release-gate.yml"),
    readRequired("apps/ai-gateway-service/evidence/phase-136a-release-publish-execution.json"),
  ]);

  const rootPackage = parseJson(rootPackageText, "package.json");
  const servicePackage = parseJson(
    servicePackageText,
    "apps/ai-gateway-service/package.json",
  );
  const phase136Evidence = parseJson(
    phase136EvidenceText,
    "phase-136a-release-publish-execution.json",
  );

  const gitTopLevel = await runGit(["rev-parse", "--show-toplevel"]);
  const gitHead = await runGit(["rev-parse", "--verify", "HEAD"]);
  const gitHeadSubject = await runGit(["log", "-1", "--pretty=%s"]);
  const gitBranch = await runGit(["branch", "--show-current"]);
  const gitStatus = await runGit(["status", "--short"]);
  const gitStaged = await runGit(["diff", "--cached", "--name-only"]);
  const gitTags = await runGit(["tag", "--list"]);
  const localTagTarget = await runGit(["rev-list", "-n", "1", candidateTag]);
  const gitRemote = await runGit(["remote", "-v"]);
  const upstream = await runGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
  const remoteHeads = await runGit(["ls-remote", "--heads", "origin", "master"]);
  const remoteCandidateTags = await runGit(["ls-remote", "--tags", "origin", candidateTag]);
  const repoView = await run(knownGhPath, [
    "repo",
    "view",
    repoFullName,
    "--json",
    "nameWithOwner,url,visibility,isPrivate,defaultBranchRef",
  ]);
  const runList = await run(knownGhPath, [
    "run",
    "list",
    "--repo",
    repoFullName,
    "--limit",
    "30",
    "--json",
    "databaseId,headBranch,headSha,status,conclusion,workflowName,createdAt,url",
  ]);
  const releaseView = await run(knownGhPath, [
    "release",
    "view",
    candidateTag,
    "--repo",
    repoFullName,
    "--json",
    "tagName,name,isDraft,isPrerelease,url,targetCommitish,createdAt,publishedAt,assets",
  ]);

  const localHead = gitHead.stdout.trim();
  const statusLines = parseLines(gitStatus.stdout);
  const stagedFiles = parseLines(gitStaged.stdout);
  const tagLines = parseLines(gitTags.stdout);
  const remoteCandidateTagLines = parseLines(remoteCandidateTags.stdout);
  const remoteLines = parseLines(gitRemote.stdout);
  const remoteHeadLine = parseLines(remoteHeads.stdout)[0] ?? "";
  const [remoteHeadSha] = remoteHeadLine.split(/\s+/);
  const remoteCandidateTagLine = remoteCandidateTagLines[0] ?? "";
  const [remoteCandidateTagSha] = remoteCandidateTagLine.split(/\s+/);
  const repo = parseJsonMaybe(repoView.stdout) ?? {};
  const runs = Array.isArray(parseJsonMaybe(runList.stdout)) ? parseJsonMaybe(runList.stdout) : [];
  const release = parseJsonMaybe(releaseView.stdout) ?? {};
  const latestHeadGate = runs.find(
    (runItem) =>
      runItem.headSha === localHead &&
      runItem.workflowName === "Phase117A Release Gate" &&
      runItem.conclusion === "success",
  );
  const releaseTargetGate = runs.find(
    (runItem) =>
      runItem.headSha === releaseTargetCommit &&
      runItem.workflowName === "Phase117A Release Gate" &&
      runItem.conclusion === "success",
  );
  const remoteConfigured = remoteLines.some((line) => line.includes(remoteUrl));
  const remoteHeadMatchesLocal = Boolean(localHead) && remoteHeadSha === localHead;
  const localCandidateTagTarget = localTagTarget.stdout.trim();
  const rollbackDocFlat = normalizeWhitespace(rollbackDoc);
  const forbiddenWorkflowMarkers = [
    "gh release",
    "actions/create-release",
    "softprops/action-gh-release",
    "actions/upload-artifact",
    "docker push",
    "npm publish",
    "pnpm publish",
    "ghcr.io",
    "azure/login",
    "aws-actions/configure-aws-credentials",
    "google-github-actions/auth",
    "kubectl",
    "helm upgrade",
  ];
  const workflowForbiddenHits = forbiddenWorkflowMarkers.filter((marker) =>
    workflow.toLowerCase().includes(marker.toLowerCase()),
  );

  const secretFindings = findPlainSecretFindings(
    [
      rootPackageText,
      servicePackageText,
      readme,
      agents,
      userManual,
      remoteStatusDoc,
      publishExecutionDoc,
      rollbackDoc,
      workflow,
      phase136EvidenceText,
      gitRemote.stdout,
      repoView.stdout,
      repoView.stderr,
      runList.stdout,
      runList.stderr,
      releaseView.stdout,
      releaseView.stderr,
    ].join("\n\n"),
    "phase137a-release-draft-rollback",
  );

  const checks = {
    rootScriptPresent:
      rootPackage.scripts?.["verify:phase137a-release-draft-rollback"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase137a-release-draft-rollback",
    serviceScriptPresent:
      servicePackage.scripts?.["verify:phase137a-release-draft-rollback"] ===
      "node ./src/entrypoints/verifyReleaseDraftRollback.js",
    packageVersionMatchesCandidate: rootPackage.version === candidateVersion,
    phase136Closed:
      phase136Evidence.status === "passed" &&
      phase136Evidence.candidate?.tag === candidateTag &&
      phase136Evidence.safety?.releasePublished === true &&
      phase136Evidence.safety?.releaseArtifactUploaded === false,
    gitTopLevelIsProject: normalizePath(gitTopLevel.stdout) === normalizePath(repoRoot),
    localCommitPresent: gitHead.exitCode === 0,
    noStagedFiles: stagedFiles.length === 0,
    branchIsMaster: gitBranch.stdout.trim() === "master",
    remoteConfigured,
    upstreamTracksOriginMaster: upstream.stdout.trim() === "origin/master",
    remoteHeadMatchesLocal,
    repoExists: repoView.exitCode === 0 && repo.nameWithOwner === repoFullName,
    repoIsPrivate: repo.isPrivate === true && repo.visibility === "PRIVATE",
    latestHeadReleaseGateSucceeded: Boolean(latestHeadGate),
    releaseTargetGateSucceeded: Boolean(releaseTargetGate),
    localCandidateTagExists: tagLines.includes(candidateTag),
    localCandidateTagPointsToTarget: localCandidateTagTarget === releaseTargetCommit,
    remoteCandidateTagExists: remoteCandidateTagLines.length > 0,
    remoteCandidateTagPointsToTarget: remoteCandidateTagSha === releaseTargetCommit,
    releaseViewReadable: releaseView.exitCode === 0,
    releaseTagMatches: release.tagName === candidateTag,
    releaseTitleMatches: release.name === candidateTitle,
    releaseIsDraftAgain: release.isDraft === true,
    releaseRemainsPrerelease: release.isPrerelease === true,
    releaseTargetsExpectedCommit: release.targetCommitish === releaseTargetCommit,
    releasePublishedAtRetained: typeof release.publishedAt === "string" && release.publishedAt.length > 0,
    releaseHasNoAssets: Array.isArray(release.assets) && release.assets.length === 0,
    workflowHasNoReleaseOrPublishSteps: workflowForbiddenHits.length === 0,
    rollbackDocPresent: existsSync(resolve(repoRoot, rollbackDocPath)),
    rollbackDocHasCandidate:
      rollbackDoc.includes(`Tag: \`${candidateTag}\``) &&
      rollbackDoc.includes(`Release title: \`${candidateTitle}\``) &&
      rollbackDoc.includes(`Release target commit: \`${releaseTargetCommit}\``),
    rollbackDocHasExecutedCommand:
      rollbackDoc.includes("gh release edit") &&
      rollbackDoc.includes("--draft") &&
      rollbackDoc.includes("--prerelease") &&
      rollbackDoc.includes("--latest=false"),
    rollbackDocHasRollbackState:
      rollbackDoc.includes("draft again") &&
      rollbackDoc.includes("remains a prerelease") &&
      rollbackDoc.includes("No release assets were uploaded") &&
      rollbackDoc.includes("isDraft=true"),
    rollbackDocHasBoundary:
      rollbackDocFlat.includes("only changes the existing GitHub Release back to draft state") &&
      rollbackDocFlat.includes("does not delete the GitHub Release") &&
      rollbackDocFlat.includes("does not delete the git tag") &&
      rollbackDocFlat.includes("does not deploy cloud infrastructure"),
    readmePhasePresent:
      readme.includes("Phase 137A") &&
      readme.includes("verify:phase137a-release-draft-rollback"),
    agentsBoundaryPresent:
      agents.includes("Phase 137A Release Draft Rollback Boundary") &&
      agents.includes("verify:phase137a-release-draft-rollback"),
    userManualPresent:
      userManual.includes("verify:phase137a-release-draft-rollback"),
    remoteStatusDocPresent:
      remoteStatusDoc.includes("Phase 137A") &&
      remoteStatusDoc.includes("RELEASE_DRAFT_ROLLBACK.md"),
    noPlainSecrets: secretFindings.length === 0,
    projectContextNotCreated: !existsSync(resolve(repoRoot, "PROJECT_CONTEXT.md")),
  };
  const passed = Object.values(checks).every(Boolean);
  const evidence = {
    phase,
    status: passed ? "passed" : "failed",
    generatedAt,
    checks,
    candidate: {
      version: candidateVersion,
      tag: candidateTag,
      title: candidateTitle,
      releaseTargetCommit,
      requiredRollbackPhrase,
      releaseUrl: release.url ?? "",
      releaseCreatedAt: release.createdAt ?? "",
      retainedPublishedAt: release.publishedAt ?? "",
    },
    git: {
      repoRoot,
      gitTopLevel: gitTopLevel.stdout.trim(),
      branch: gitBranch.stdout.trim(),
      headSha: localHead,
      headSubject: gitHeadSubject.stdout.trim(),
      statusLineCount: statusLines.length,
      statusPreview: statusLines.slice(0, 50),
      stagedFileCount: stagedFiles.length,
      localReleaseTagCount: tagLines.length,
      localCandidateTagTarget,
      remoteCandidateTagSha,
      remoteConfigured,
      remoteLines: remoteLines.map(redactRemoteLine),
      upstream: upstream.stdout.trim(),
      remoteHeadSha,
      remoteHeadMatchesLocal,
    },
    github: {
      repoFullName,
      repoUrl,
      isPrivate: repo.isPrivate === true,
      visibility: repo.visibility ?? "",
      defaultBranch: repo.defaultBranchRef?.name ?? "",
      latestHeadReleaseGate: latestHeadGate
        ? {
            databaseId: latestHeadGate.databaseId,
            workflowName: latestHeadGate.workflowName,
            headBranch: latestHeadGate.headBranch,
            headSha: latestHeadGate.headSha,
            status: latestHeadGate.status,
            conclusion: latestHeadGate.conclusion || "",
            createdAt: latestHeadGate.createdAt,
            url: latestHeadGate.url,
          }
        : null,
      releaseTargetGate: releaseTargetGate
        ? {
            databaseId: releaseTargetGate.databaseId,
            workflowName: releaseTargetGate.workflowName,
            headBranch: releaseTargetGate.headBranch,
            headSha: releaseTargetGate.headSha,
            status: releaseTargetGate.status,
            conclusion: releaseTargetGate.conclusion || "",
            createdAt: releaseTargetGate.createdAt,
            url: releaseTargetGate.url,
          }
        : null,
      release: {
        tagName: release.tagName ?? "",
        name: release.name ?? "",
        isDraft: release.isDraft === true,
        isPrerelease: release.isPrerelease === true,
        targetCommitish: release.targetCommitish ?? "",
        url: release.url ?? "",
        createdAt: release.createdAt ?? "",
        publishedAt: release.publishedAt ?? null,
        assetCount: Array.isArray(release.assets) ? release.assets.length : null,
      },
    },
    workflow: {
      path: ".github/workflows/release-gate.yml",
      forbiddenReleaseOrPublishHits: workflowForbiddenHits,
    },
    docs: {
      rollbackDoc: rollbackDocPath,
      publishExecutionDoc: "docs/RELEASE_PUBLISH_EXECUTION.md",
      remoteStatusDoc: "docs/REMOTE_RELEASE_STATUS.md",
      userManual: "docs/USER_MANUAL.md",
    },
    safety: {
      releaseRolledBackToDraft: release.isDraft === true,
      releaseDeleted: false,
      gitTagDeleted: false,
      releaseArtifactUploaded: false,
      packagePublished: false,
      dockerImagePublished: false,
      cloudDeploymentComplete: false,
      publicProductionDeploymentComplete: false,
      globalReleaseComplete: false,
      realAgentExecutionEnabled: false,
      plaintextApiKeyRecorded: false,
    },
    remainingLimits: [
      "release is back in draft state",
      "release assets are not uploaded",
      "packages are not published",
      "container images are not published",
      "cloud deployment is not complete",
      "public production deployment is not complete",
      "global release is not complete",
    ],
    secretFindingCount: secretFindings.length,
    conclusion: passed
      ? "release-draft-rollback-closed"
      : "release-draft-rollback-not-closed",
  };

  await mkdir(evidenceDir, { recursive: true });
  await writeFile(
    resolve(evidenceDir, `${phase}.json`),
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8",
  );
  await writeFile(resolve(evidenceDir, `${phase}.md`), markdown(evidence), "utf8");

  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
}

function markdown(evidence) {
  const headGate = evidence.github.latestHeadReleaseGate;
  const targetGate = evidence.github.releaseTargetGate;
  return [
    "# Phase 137A Release Draft Rollback Evidence",
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
    `- Retained publishedAt: ${evidence.candidate.retainedPublishedAt || "none"}`,
    `- Release asset count: ${evidence.github.release.assetCount}`,
    `- Current head Release Gate: ${headGate ? `${headGate.workflowName} ${headGate.status} ${headGate.conclusion}`.trim() : "none"}`,
    `- Current head Release Gate URL: ${headGate?.url ?? "none"}`,
    `- Release target gate: ${targetGate ? `${targetGate.workflowName} ${targetGate.status} ${targetGate.conclusion}`.trim() : "none"}`,
    `- Release target gate URL: ${targetGate?.url ?? "none"}`,
    `- Release rolled back to draft: ${evidence.safety.releaseRolledBackToDraft}`,
    `- Release deleted: ${evidence.safety.releaseDeleted}`,
    `- Git tag deleted: ${evidence.safety.gitTagDeleted}`,
    `- Release artifact uploaded: ${evidence.safety.releaseArtifactUploaded}`,
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
    "- This phase changes the existing GitHub Release back to draft state only.",
    "- It does not delete the release, delete the tag, upload assets, publish packages/images, deploy cloud infrastructure, or complete global release.",
    "",
  ].join("\n");
}

await main();
