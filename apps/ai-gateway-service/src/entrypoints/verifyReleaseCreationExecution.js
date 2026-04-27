import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { findPlainSecretFindings } from "../security/secretSafety.js";

const execFileAsync = promisify(execFile);
const phase = "phase-134a-release-creation-execution";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const knownGhPath = "C:\\Program Files\\GitHub CLI\\gh.exe";
const repoFullName = "happy520ai/unified-ai-system";
const repoUrl = `https://github.com/${repoFullName}`;
const remoteUrl = `${repoUrl}.git`;
const executionDocPath = "docs/RELEASE_CREATION_EXECUTION.md";
const candidateVersion = "0.1.0";
const candidateTag = "v0.1.0-rc.1";
const candidateTitle = "unified-ai-system v0.1.0-rc.1";
const releaseTargetCommit = "bdba42b600d712acb77926774c75254b8c290ea6";

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
    preflightDoc,
    decisionDoc,
    confirmationDoc,
    executionDoc,
    workflow,
    phase133EvidenceText,
  ] = await Promise.all([
    readRequired("package.json"),
    readRequired("apps/ai-gateway-service/package.json"),
    readRequired("README.md"),
    readRequired("AGENTS.md"),
    readRequired("docs/USER_MANUAL.md"),
    readRequired("docs/REMOTE_RELEASE_STATUS.md"),
    readRequired("docs/RELEASE_PREFLIGHT.md"),
    readRequired("docs/RELEASE_DECISION_PACK.md"),
    readRequired("docs/RELEASE_CREATION_CONFIRMATION.md"),
    readRequired(executionDocPath),
    readRequired(".github/workflows/release-gate.yml"),
    readRequired("apps/ai-gateway-service/evidence/phase-133a-release-creation-confirmation.json"),
  ]);

  const rootPackage = parseJson(rootPackageText, "package.json");
  const servicePackage = parseJson(
    servicePackageText,
    "apps/ai-gateway-service/package.json",
  );
  const phase133Evidence = parseJson(
    phase133EvidenceText,
    "phase-133a-release-creation-confirmation.json",
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
    "20",
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
  const repo = parseJsonMaybe(repoView.stdout) ?? {};
  const runs = Array.isArray(parseJsonMaybe(runList.stdout)) ? parseJsonMaybe(runList.stdout) : [];
  const release = parseJsonMaybe(releaseView.stdout) ?? {};
  const releaseTargetGate = runs.find(
    (runItem) =>
      runItem.headSha === releaseTargetCommit &&
      runItem.workflowName === "Phase117A Release Gate" &&
      runItem.conclusion === "success",
  );
  const remoteConfigured = remoteLines.some((line) => line.includes(remoteUrl));
  const remoteHeadMatchesLocal = Boolean(localHead) && remoteHeadSha === localHead;
  const remoteCandidateTagLine = remoteCandidateTagLines[0] ?? "";
  const [remoteCandidateTagSha] = remoteCandidateTagLine.split(/\s+/);
  const localCandidateTagTarget = localTagTarget.stdout.trim();
  const executionDocFlat = normalizeWhitespace(executionDoc);
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
      preflightDoc,
      decisionDoc,
      confirmationDoc,
      executionDoc,
      workflow,
      phase133EvidenceText,
      gitRemote.stdout,
      repoView.stdout,
      repoView.stderr,
      runList.stdout,
      runList.stderr,
      releaseView.stdout,
      releaseView.stderr,
    ].join("\n\n"),
    "phase134a-release-creation-execution",
  );

  const checks = {
    rootScriptPresent:
      rootPackage.scripts?.["verify:phase134a-release-creation-execution"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase134a-release-creation-execution",
    serviceScriptPresent:
      servicePackage.scripts?.["verify:phase134a-release-creation-execution"] ===
      "node ./src/entrypoints/verifyReleaseCreationExecution.js",
    packageVersionMatchesCandidate: rootPackage.version === candidateVersion,
    phase133Closed:
      phase133Evidence.status === "passed" &&
      phase133Evidence.candidate?.tag === candidateTag &&
      phase133Evidence.safety?.githubReleaseCreated === false &&
      phase133Evidence.safety?.gitTagCreated === false,
    gitTopLevelIsProject: normalizePath(gitTopLevel.stdout) === normalizePath(repoRoot),
    localCommitPresent: gitHead.exitCode === 0,
    noStagedFiles: stagedFiles.length === 0,
    branchIsMaster: gitBranch.stdout.trim() === "master",
    remoteConfigured,
    upstreamTracksOriginMaster: upstream.stdout.trim() === "origin/master",
    remoteHeadMatchesLocal,
    repoExists: repoView.exitCode === 0 && repo.nameWithOwner === repoFullName,
    repoIsPrivate: repo.isPrivate === true && repo.visibility === "PRIVATE",
    releaseTargetGateSucceeded: Boolean(releaseTargetGate),
    localCandidateTagExists: tagLines.includes(candidateTag),
    localCandidateTagPointsToTarget: localCandidateTagTarget === releaseTargetCommit,
    remoteCandidateTagExists: remoteCandidateTagLines.length > 0,
    remoteCandidateTagPointsToTarget: remoteCandidateTagSha === releaseTargetCommit,
    releaseViewReadable: releaseView.exitCode === 0,
    releaseTagMatches: release.tagName === candidateTag,
    releaseTitleMatches: release.name === candidateTitle,
    releaseIsDraft: release.isDraft === true,
    releaseIsPrerelease: release.isPrerelease === true,
    releaseTargetsExpectedCommit: release.targetCommitish === releaseTargetCommit,
    releaseHasNoPublishedAt: release.publishedAt === null,
    releaseHasNoAssets: Array.isArray(release.assets) && release.assets.length === 0,
    workflowHasNoReleaseOrPublishSteps: workflowForbiddenHits.length === 0,
    executionDocPresent: existsSync(resolve(repoRoot, executionDocPath)),
    executionDocHasCandidate:
      executionDoc.includes(`Tag: \`${candidateTag}\``) &&
      executionDoc.includes(`Release title: \`${candidateTitle}\``) &&
      executionDoc.includes(`Release target commit: \`${releaseTargetCommit}\``),
    executionDocHasExecutedCommands:
      executionDoc.includes(`git tag ${candidateTag}`) &&
      executionDoc.includes(`git push origin ${candidateTag}`) &&
      executionDoc.includes("gh release create") &&
      executionDoc.includes("--draft --prerelease"),
    executionDocHasCreationState:
      executionDoc.includes("The local tag `v0.1.0-rc.1` exists") &&
      executionDoc.includes("The GitHub Release is a draft") &&
      executionDoc.includes("No release assets were uploaded"),
    executionDocHasBoundary:
      executionDocFlat.includes("creates only the candidate git tag and GitHub draft prerelease") &&
      executionDocFlat.includes("does not publish the draft release") &&
      executionDocFlat.includes("does not upload release assets") &&
      executionDocFlat.includes("does not deploy cloud infrastructure"),
    readmePhasePresent:
      readme.includes("Phase 134A") &&
      readme.includes("verify:phase134a-release-creation-execution"),
    agentsBoundaryPresent:
      agents.includes("Phase 134A Release Creation Execution Boundary") &&
      agents.includes("verify:phase134a-release-creation-execution"),
    userManualPresent:
      userManual.includes("verify:phase134a-release-creation-execution"),
    remoteStatusDocPresent:
      remoteStatusDoc.includes("Phase 134A") &&
      remoteStatusDoc.includes("RELEASE_CREATION_EXECUTION.md"),
    confirmationDocReferencesExecution:
      confirmationDoc.includes("Phase 134A") &&
      confirmationDoc.includes("RELEASE_CREATION_EXECUTION.md"),
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
      releaseUrl: release.url ?? "",
      releaseCreatedAt: release.createdAt ?? "",
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
      executionDoc: executionDocPath,
      confirmationPack: "docs/RELEASE_CREATION_CONFIRMATION.md",
      decisionPack: "docs/RELEASE_DECISION_PACK.md",
      preflightDoc: "docs/RELEASE_PREFLIGHT.md",
      remoteStatusDoc: "docs/REMOTE_RELEASE_STATUS.md",
      userManual: "docs/USER_MANUAL.md",
    },
    safety: {
      gitTagCreated: true,
      githubReleaseCreated: true,
      githubReleaseDraft: release.isDraft === true,
      githubReleasePrerelease: release.isPrerelease === true,
      releasePublished: false,
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
      "draft release is not published",
      "release assets are not uploaded",
      "packages are not published",
      "container images are not published",
      "cloud deployment is not complete",
      "global release is not complete",
    ],
    secretFindingCount: secretFindings.length,
    conclusion: passed
      ? "release-creation-execution-closed"
      : "release-creation-execution-not-closed",
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
  const gate = evidence.github.releaseTargetGate;
  return [
    "# Phase 134A Release Creation Execution Evidence",
    "",
    `- Phase: ${evidence.phase}`,
    `- Status: ${evidence.status}`,
    `- Generated at: ${evidence.generatedAt}`,
    `- Candidate version: ${evidence.candidate.version}`,
    `- Candidate tag: ${evidence.candidate.tag}`,
    `- Candidate title: ${evidence.candidate.title}`,
    `- Release target commit: ${evidence.candidate.releaseTargetCommit}`,
    `- Release URL: ${evidence.candidate.releaseUrl}`,
    `- Release created at: ${evidence.candidate.releaseCreatedAt}`,
    `- Local tag target: ${evidence.git.localCandidateTagTarget}`,
    `- Remote tag target: ${evidence.git.remoteCandidateTagSha}`,
    `- Release target gate: ${gate ? `${gate.workflowName} ${gate.status} ${gate.conclusion}`.trim() : "none"}`,
    `- Release target gate URL: ${gate?.url ?? "none"}`,
    `- Release draft: ${evidence.github.release.isDraft}`,
    `- Release prerelease: ${evidence.github.release.isPrerelease}`,
    `- Release asset count: ${evidence.github.release.assetCount}`,
    `- Git tag created: ${evidence.safety.gitTagCreated}`,
    `- GitHub Release created: ${evidence.safety.githubReleaseCreated}`,
    `- Release published: ${evidence.safety.releasePublished}`,
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
    "- This phase creates the candidate git tag and GitHub draft prerelease only.",
    "- It does not publish the draft release, upload artifacts, publish packages/images, deploy cloud infrastructure, or complete global release.",
    "",
  ].join("\n");
}

await main();
