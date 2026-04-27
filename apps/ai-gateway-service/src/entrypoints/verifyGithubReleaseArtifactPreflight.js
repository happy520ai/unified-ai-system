import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { findPlainSecretFindings } from "../security/secretSafety.js";

const execFileAsync = promisify(execFile);
const phase = "phase-131a-release-artifact-preflight";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const knownGhPath = "C:\\Program Files\\GitHub CLI\\gh.exe";
const repoFullName = "happy520ai/unified-ai-system";
const repoUrl = `https://github.com/${repoFullName}`;
const remoteUrl = `${repoUrl}.git`;
const preflightDocPath = "docs/RELEASE_PREFLIGHT.md";

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
    workflow,
    phase129EvidenceText,
    phase130EvidenceText,
  ] = await Promise.all([
    readRequired("package.json"),
    readRequired("apps/ai-gateway-service/package.json"),
    readRequired("README.md"),
    readRequired("AGENTS.md"),
    readRequired("docs/USER_MANUAL.md"),
    readRequired("docs/REMOTE_RELEASE_STATUS.md"),
    readRequired(preflightDocPath),
    readRequired(".github/workflows/release-gate.yml"),
    readRequired("apps/ai-gateway-service/evidence/phase-129a-remote-release-status.json"),
    readRequired("apps/ai-gateway-service/evidence/phase-130a-actions-node24-warning-cleanup.json"),
  ]);

  const rootPackage = parseJson(rootPackageText, "package.json");
  const servicePackage = parseJson(
    servicePackageText,
    "apps/ai-gateway-service/package.json",
  );
  const phase129Evidence = parseJson(
    phase129EvidenceText,
    "phase-129a-remote-release-status.json",
  );
  const phase130Evidence = parseJson(
    phase130EvidenceText,
    "phase-130a-actions-node24-warning-cleanup.json",
  );

  const gitTopLevel = await runGit(["rev-parse", "--show-toplevel"]);
  const gitHead = await runGit(["rev-parse", "--verify", "HEAD"]);
  const gitHeadSubject = await runGit(["log", "-1", "--pretty=%s"]);
  const gitBranch = await runGit(["branch", "--show-current"]);
  const gitStatus = await runGit(["status", "--short"]);
  const gitStaged = await runGit(["diff", "--cached", "--name-only"]);
  const gitTags = await runGit(["tag", "--list"]);
  const gitRemote = await runGit(["remote", "-v"]);
  const upstream = await runGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
  const remoteHeads = await runGit(["ls-remote", "--heads", "origin", "master"]);
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
    "5",
    "--json",
    "databaseId,headBranch,headSha,status,conclusion,workflowName,createdAt,url",
  ]);
  const releaseList = await run(knownGhPath, [
    "api",
    `repos/${repoFullName}/releases`,
  ]);

  const localHead = gitHead.stdout.trim();
  const statusLines = parseLines(gitStatus.stdout);
  const stagedFiles = parseLines(gitStaged.stdout);
  const tagLines = parseLines(gitTags.stdout);
  const remoteLines = parseLines(gitRemote.stdout);
  const remoteHeadLine = parseLines(remoteHeads.stdout)[0] ?? "";
  const [remoteHeadSha] = remoteHeadLine.split(/\s+/);
  const repo = parseJsonMaybe(repoView.stdout) ?? {};
  const runs = Array.isArray(parseJsonMaybe(runList.stdout)) ? parseJsonMaybe(runList.stdout) : [];
  const releases = Array.isArray(parseJsonMaybe(releaseList.stdout))
    ? parseJsonMaybe(releaseList.stdout)
    : [];
  const latestRun = runs[0] ?? null;
  const latestRunSucceeded = latestRun?.conclusion === "success";
  const remoteConfigured = remoteLines.some((line) => line.includes(remoteUrl));
  const remoteHeadMatchesLocal = Boolean(localHead) && remoteHeadSha === localHead;
  const preflightDocFlat = normalizeWhitespace(preflightDoc);
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
      workflow,
      phase129EvidenceText,
      phase130EvidenceText,
      gitRemote.stdout,
      repoView.stdout,
      repoView.stderr,
      runList.stdout,
      runList.stderr,
      releaseList.stdout,
      releaseList.stderr,
    ].join("\n\n"),
    "phase131a-release-artifact-preflight",
  );

  const checks = {
    rootScriptPresent:
      rootPackage.scripts?.["verify:phase131a-release-artifact-preflight"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase131a-release-artifact-preflight",
    serviceScriptPresent:
      servicePackage.scripts?.["verify:phase131a-release-artifact-preflight"] ===
      "node ./src/entrypoints/verifyGithubReleaseArtifactPreflight.js",
    phase129Closed:
      phase129Evidence.status === "passed" &&
      phase129Evidence.safety?.remoteReleaseGatePassed === true,
    phase130Closed: phase130Evidence.status === "passed",
    gitTopLevelIsProject: normalizePath(gitTopLevel.stdout) === normalizePath(repoRoot),
    localCommitPresent: gitHead.exitCode === 0,
    noStagedFiles: stagedFiles.length === 0,
    branchIsMaster: gitBranch.stdout.trim() === "master",
    remoteConfigured,
    upstreamTracksOriginMaster: upstream.stdout.trim() === "origin/master",
    remoteHeadMatchesLocal,
    repoExists: repoView.exitCode === 0 && repo.nameWithOwner === repoFullName,
    repoIsPrivate: repo.isPrivate === true && repo.visibility === "PRIVATE",
    latestReleaseGateRecorded: Boolean(latestRun),
    latestReleaseGateSucceeded: latestRunSucceeded,
    releaseListReadable: releaseList.exitCode === 0,
    noGithubReleaseExists: releases.length === 0,
    noLocalReleaseTags: tagLines.length === 0,
    workflowHasNoReleaseOrPublishSteps: workflowForbiddenHits.length === 0,
    releasePreflightDocPresent: existsSync(resolve(repoRoot, preflightDocPath)),
    releasePreflightDocHasScope:
      preflightDoc.includes(repoFullName) &&
      preflightDoc.includes("verify:phase131a-release-artifact-preflight"),
    releasePreflightDocHasReadOnlyBoundary:
      preflightDocFlat.includes("read-only preflight") &&
      preflightDocFlat.includes("does not create a git tag") &&
      preflightDocFlat.includes("does not create a GitHub Release") &&
      preflightDocFlat.includes("does not deploy cloud infrastructure"),
    releasePreflightDocHasManualDecisions:
      preflightDoc.includes("Choose the release version and tag name") &&
      preflightDoc.includes("Write release notes") &&
      preflightDoc.includes("Re-run the remote Release Gate"),
    readmePhasePresent:
      readme.includes("Phase 131A") &&
      readme.includes("verify:phase131a-release-artifact-preflight"),
    agentsBoundaryPresent:
      agents.includes("Phase 131A Release Artifact Preflight Boundary") &&
      agents.includes("verify:phase131a-release-artifact-preflight"),
    userManualPresent:
      userManual.includes("verify:phase131a-release-artifact-preflight"),
    remoteStatusDocPresent:
      remoteStatusDoc.includes("Phase 131A") &&
      remoteStatusDoc.includes("RELEASE_PREFLIGHT.md"),
    noPlainSecrets: secretFindings.length === 0,
    projectContextNotCreated: !existsSync(resolve(repoRoot, "PROJECT_CONTEXT.md")),
  };
  const passed = Object.values(checks).every(Boolean);
  const evidence = {
    phase,
    status: passed ? "passed" : "failed",
    generatedAt,
    checks,
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
      localReleaseTags: tagLines,
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
      latestReleaseGate: latestRun
        ? {
            databaseId: latestRun.databaseId,
            workflowName: latestRun.workflowName,
            headBranch: latestRun.headBranch,
            headSha: latestRun.headSha,
            status: latestRun.status,
            conclusion: latestRun.conclusion || "",
            createdAt: latestRun.createdAt,
            url: latestRun.url,
          }
        : null,
      releaseCount: releases.length,
      releases: releases.slice(0, 20).map((release) => ({
        id: release.id,
        tagName: release.tag_name,
        name: release.name,
        draft: release.draft,
        prerelease: release.prerelease,
        url: release.html_url,
      })),
    },
    workflow: {
      path: ".github/workflows/release-gate.yml",
      forbiddenReleaseOrPublishHits: workflowForbiddenHits,
    },
    docs: {
      preflightDoc: preflightDocPath,
      remoteStatusDoc: "docs/REMOTE_RELEASE_STATUS.md",
      userManual: "docs/USER_MANUAL.md",
    },
    safety: {
      readOnlyPreflight: true,
      gitTagCreated: false,
      githubReleaseCreated: false,
      releaseArtifactUploaded: false,
      packagePublished: false,
      dockerImagePublished: false,
      cloudDeploymentComplete: false,
      publicProductionDeploymentComplete: false,
      globalReleaseComplete: false,
      realAgentExecutionEnabled: false,
      plaintextApiKeyRecorded: false,
    },
    nextManualDecisions: [
      "choose release version and tag name",
      "decide draft versus prerelease status",
      "write release notes from verified evidence",
      "decide release assets",
      "decide whether package or image publishing belongs in a later phase",
      "rerun the remote Release Gate on the exact release commit",
    ],
    secretFindingCount: secretFindings.length,
    conclusion: passed
      ? "release-artifact-preflight-closed"
      : "release-artifact-preflight-not-closed",
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
  const run = evidence.github.latestReleaseGate;
  return [
    "# Phase 131A Release Artifact Preflight Evidence",
    "",
    `- Phase: ${evidence.phase}`,
    `- Status: ${evidence.status}`,
    `- Generated at: ${evidence.generatedAt}`,
    `- Repository: ${evidence.github.repoFullName}`,
    `- Repository URL: ${evidence.github.repoUrl}`,
    `- Branch: ${evidence.git.branch}`,
    `- Local head: ${evidence.git.headSha}`,
    `- Remote head: ${evidence.git.remoteHeadSha}`,
    `- Remote head matches local: ${evidence.git.remoteHeadMatchesLocal}`,
    `- Latest Release Gate: ${run ? `${run.workflowName} ${run.status} ${run.conclusion}`.trim() : "none"}`,
    `- Latest Release Gate URL: ${run?.url ?? "none"}`,
    `- GitHub release count: ${evidence.github.releaseCount}`,
    `- Local release tag count: ${evidence.git.localReleaseTagCount}`,
    `- Release/publish workflow hits: ${evidence.workflow.forbiddenReleaseOrPublishHits.length}`,
    `- GitHub Release created: ${evidence.safety.githubReleaseCreated}`,
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
    "## Next Manual Decisions",
    "",
    ...evidence.nextManualDecisions.map((decision) => `- ${decision}`),
    "",
    "## Boundary",
    "",
    "- This phase is a read-only GitHub Release and artifact preflight.",
    "- It does not create tags, create releases, upload artifacts, publish packages/images, deploy cloud infrastructure, or complete global release.",
    "",
  ].join("\n");
}

await main();
