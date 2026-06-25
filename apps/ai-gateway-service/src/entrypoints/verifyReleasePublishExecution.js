import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { findPlainSecretFindings } from "../security/secretSafety.js";
import {
  normalizePath,
  parseJson,
  parseJsonMaybe,
  parseLines,
  normalizeWhitespace,
  readRequired,
  readOptional,
  redactRemoteLine,
  markdown,
} from "./verifyReleasePublishExecutionHelpers.js";

const execFileAsync = promisify(execFile);
const phase = "phase-136a-release-publish-execution";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const knownGhPath = "C:\\Program Files\\GitHub CLI\\gh.exe";
const repoFullName = "happy520ai/unified-ai-system";
const repoUrl = `https://github.com/${repoFullName}`;
const remoteUrl = `${repoUrl}.git`;
const executionDocPath = "docs/RELEASE_PUBLISH_EXECUTION.md";
const phase137EvidencePath =
  "apps/ai-gateway-service/evidence/phase-137a-release-draft-rollback.json";
const candidateVersion = "0.1.0";
const candidateTag = "v0.1.0-rc.1";
const candidateTitle = "unified-ai-system v0.1.0-rc.1";
const releaseTargetCommit = "bdba42b600d712acb77926774c75254b8c290ea6";
const requiredPublishPhrase = "发布 GitHub Release v0.1.0-rc.1";

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

async function runGit(args) {
  return run("git", ["-c", `safe.directory=${normalizePath(repoRoot)}`, ...args]);
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
    publishPreflightDoc,
    publishExecutionDoc,
    workflow,
    phase135EvidenceText,
    phase137EvidenceText,
  ] = await Promise.all([
    readRequired("package.json"),
    readRequired("apps/ai-gateway-service/package.json"),
    readRequired("README.md"),
    readRequired("AGENTS.md"),
    readRequired("docs/USER_MANUAL.md"),
    readRequired("docs/REMOTE_RELEASE_STATUS.md"),
    readRequired("docs/RELEASE_PUBLISH_PREFLIGHT.md"),
    readRequired(executionDocPath),
    readRequired(".github/workflows/release-gate.yml"),
    readRequired("apps/ai-gateway-service/evidence/phase-135a-release-publish-preflight.json"),
    readOptional(phase137EvidencePath),
  ]);

  const rootPackage = parseJson(rootPackageText, "package.json");
  const servicePackage = parseJson(
    servicePackageText,
    "apps/ai-gateway-service/package.json",
  );
  const phase135Evidence = parseJson(
    phase135EvidenceText,
    "phase-135a-release-publish-preflight.json",
  );
  const phase137Evidence = phase137EvidenceText
    ? parseJson(phase137EvidenceText, "phase-137a-release-draft-rollback.json")
    : null;

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
  const laterPhase137Closed =
    phase137Evidence?.status === "passed" &&
    phase137Evidence?.candidate?.tag === candidateTag &&
    phase137Evidence?.safety?.releaseRolledBackToDraft === true &&
    phase137Evidence?.safety?.releaseArtifactUploaded === false;
  const executionDocFlat = normalizeWhitespace(publishExecutionDoc);
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
      publishPreflightDoc,
      publishExecutionDoc,
      workflow,
      phase135EvidenceText,
      phase137EvidenceText,
      gitRemote.stdout,
      repoView.stdout,
      repoView.stderr,
      runList.stdout,
      runList.stderr,
      releaseView.stdout,
      releaseView.stderr,
    ].join("\n\n"),
    "phase136a-release-publish-execution",
  );

  const checks = {
    rootScriptPresent:
      rootPackage.scripts?.["verify:phase136a-release-publish-execution"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase136a-release-publish-execution",
    serviceScriptPresent:
      servicePackage.scripts?.["verify:phase136a-release-publish-execution"] ===
      "node ./src/entrypoints/verifyReleasePublishExecution.js",
    packageVersionMatchesCandidate: rootPackage.version === candidateVersion,
    phase135Closed:
      phase135Evidence.status === "passed" &&
      phase135Evidence.candidate?.tag === candidateTag &&
      phase135Evidence.safety?.releasePublished === false &&
      phase135Evidence.safety?.releaseArtifactUploaded === false,
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
    releaseIsPublishedOrLaterPhase137Closed: release.isDraft === false || laterPhase137Closed,
    releaseRemainsPrerelease: release.isPrerelease === true,
    releaseTargetsExpectedCommit: release.targetCommitish === releaseTargetCommit,
    releasePublishedAtPresent: typeof release.publishedAt === "string" && release.publishedAt.length > 0,
    releaseHasNoAssets: Array.isArray(release.assets) && release.assets.length === 0,
    laterPhase137ExecutionConsistent: !phase137EvidenceText || laterPhase137Closed,
    workflowHasNoReleaseOrPublishSteps: workflowForbiddenHits.length === 0,
    executionDocPresent: existsSync(resolve(repoRoot, executionDocPath)),
    executionDocHasCandidate:
      publishExecutionDoc.includes(`Tag: \`${candidateTag}\``) &&
      publishExecutionDoc.includes(`Release title: \`${candidateTitle}\``) &&
      publishExecutionDoc.includes(`Release target commit: \`${releaseTargetCommit}\``),
    executionDocHasExecutedCommand:
      publishExecutionDoc.includes("gh release edit") &&
      publishExecutionDoc.includes("--draft=false") &&
      publishExecutionDoc.includes("--prerelease") &&
      publishExecutionDoc.includes("--latest=false"),
    executionDocHasPublicationState:
      publishExecutionDoc.includes("no longer a draft") &&
      publishExecutionDoc.includes("remains a prerelease") &&
      publishExecutionDoc.includes("No release assets were uploaded"),
    executionDocHasBoundary:
      executionDocFlat.includes("publishes only the existing GitHub prerelease") &&
      executionDocFlat.includes("does not upload release assets") &&
      executionDocFlat.includes("does not publish packages") &&
      executionDocFlat.includes("does not deploy cloud infrastructure"),
    readmePhasePresent:
      readme.includes("Phase 136A") &&
      readme.includes("verify:phase136a-release-publish-execution"),
    agentsBoundaryPresent:
      agents.includes("Phase 136A Release Publish Execution Boundary") &&
      agents.includes("verify:phase136a-release-publish-execution"),
    userManualPresent:
      userManual.includes("verify:phase136a-release-publish-execution"),
    remoteStatusDocPresent:
      remoteStatusDoc.includes("Phase 136A") &&
      remoteStatusDoc.includes("RELEASE_PUBLISH_EXECUTION.md"),
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
      requiredPublishPhrase,
      releaseUrl: release.url ?? "",
      releaseCreatedAt: release.createdAt ?? "",
      releasePublishedAt: release.publishedAt ?? "",
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
      laterPhase137ExecutionClosed: laterPhase137Closed,
    },
    workflow: {
      path: ".github/workflows/release-gate.yml",
      forbiddenReleaseOrPublishHits: workflowForbiddenHits,
    },
    docs: {
      executionDoc: executionDocPath,
      publishPreflightDoc: "docs/RELEASE_PUBLISH_PREFLIGHT.md",
      releaseDraftRollbackEvidence: phase137EvidenceText ? phase137EvidencePath : "",
      remoteStatusDoc: "docs/REMOTE_RELEASE_STATUS.md",
      userManual: "docs/USER_MANUAL.md",
    },
    safety: {
      releasePublished: true,
      releasePublishedByThisPhase: true,
      releaseCurrentlyDraftByLaterPhase137: laterPhase137Closed,
      releaseRolledBackByLaterPhase137: laterPhase137Closed,
      releasePrerelease: release.isPrerelease === true,
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
      ...(laterPhase137Closed ? ["release is back in draft state after Phase137A rollback"] : []),
      "release assets are not uploaded",
      "packages are not published",
      "container images are not published",
      "cloud deployment is not complete",
      "public production deployment is not complete",
      "global release is not complete",
    ],
    secretFindingCount: secretFindings.length,
    conclusion: passed
      ? "release-publish-execution-closed"
      : "release-publish-execution-not-closed",
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

await main();
