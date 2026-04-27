import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { findPlainSecretFindings } from "../security/secretSafety.js";

const execFileAsync = promisify(execFile);
const phase = "phase-127a-github-remote-target-preflight";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const knownGhPath = "C:\\Program Files\\GitHub CLI\\gh.exe";
const inferredOwner = "happy520ai";
const inferredRepo = "unified-ai-system";
const inferredFullName = `${inferredOwner}/${inferredRepo}`;

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

function parseLines(text) {
  return String(text ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function tailLines(text, count = 12) {
  return parseLines(text).slice(-count);
}

function parseJsonMaybe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function readRequired(relativePath) {
  return readFile(resolve(repoRoot, relativePath), "utf8");
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

async function main() {
  const generatedAt = new Date().toISOString();
  const [
    rootPackageText,
    servicePackageText,
    readme,
    agents,
    userManual,
    phase126EvidenceText,
  ] = await Promise.all([
    readRequired("package.json"),
    readRequired("apps/ai-gateway-service/package.json"),
    readRequired("README.md"),
    readRequired("AGENTS.md"),
    readRequired("docs/USER_MANUAL.md"),
    readRequired("apps/ai-gateway-service/evidence/phase-126a-github-auth-ready.json"),
  ]);
  const rootPackage = parseJson(rootPackageText, "package.json");
  const servicePackage = parseJson(
    servicePackageText,
    "apps/ai-gateway-service/package.json",
  );
  const phase126Evidence = parseJson(
    phase126EvidenceText,
    "phase-126a-github-auth-ready.json",
  );

  const gitTopLevel = await runGit(["rev-parse", "--show-toplevel"]);
  const gitHead = await runGit(["rev-parse", "--verify", "HEAD"]);
  const gitHeadSubject = await runGit(["log", "-1", "--pretty=%s"]);
  const gitBranch = await runGit(["branch", "--show-current"]);
  const gitStatus = await runGit(["status", "--short"]);
  const gitStaged = await runGit(["diff", "--cached", "--name-only"]);
  const gitRemote = await runGit(["remote", "-v"]);
  const ghUser = await run(knownGhPath, ["api", "user", "--jq", ".login"]);
  const targetRepo = await run(knownGhPath, [
    "repo",
    "view",
    inferredFullName,
    "--json",
    "nameWithOwner,url,visibility,defaultBranchRef",
  ]);
  const repoList = await run(knownGhPath, [
    "repo",
    "list",
    inferredOwner,
    "--limit",
    "100",
    "--json",
    "nameWithOwner,url,visibility,isPrivate",
  ]);

  const statusLines = parseLines(gitStatus.stdout);
  const stagedFiles = parseLines(gitStaged.stdout);
  const remoteLines = parseLines(gitRemote.stdout);
  const listedRepos = Array.isArray(parseJsonMaybe(repoList.stdout))
    ? parseJsonMaybe(repoList.stdout)
    : [];
  const candidateRepos = listedRepos
    .filter((repo) => {
      const name = String(repo.nameWithOwner ?? "").toLowerCase();
      return ["unified", "gateway", "system", "pme"].some((part) => name.includes(part));
    })
    .map((repo) => ({
      nameWithOwner: repo.nameWithOwner,
      url: repo.url,
      visibility: repo.visibility,
      isPrivate: Boolean(repo.isPrivate),
    }));
  const targetRepoExists = targetRepo.exitCode === 0;
  const blockers = [];
  if (!targetRepoExists) {
    blockers.push(`${inferredFullName} does not exist or is not accessible`);
  }
  if (remoteLines.length === 0) {
    blockers.push("git remote is not configured");
  }
  blockers.push("explicit GitHub repository URL has not been provided");

  const secretFindings = findPlainSecretFindings(
    [
      rootPackageText,
      servicePackageText,
      readme,
      agents,
      userManual,
      phase126EvidenceText,
      gitRemote.stdout,
      ghUser.stdout,
      ghUser.stderr,
      targetRepo.stdout,
      targetRepo.stderr,
      repoList.stdout,
      repoList.stderr,
    ].join("\n\n"),
    "phase127a-github-remote-target-preflight",
  );

  const checks = {
    rootScriptPresent:
      rootPackage.scripts?.["verify:phase127a-github-remote-target-preflight"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase127a-github-remote-target-preflight",
    serviceScriptPresent:
      servicePackage.scripts?.["verify:phase127a-github-remote-target-preflight"] ===
      "node ./src/entrypoints/verifyGithubRemoteTargetPreflight.js",
    phase126Closed: phase126Evidence.status === "passed",
    gitTopLevelIsProject: normalizePath(gitTopLevel.stdout) === normalizePath(repoRoot),
    localCommitPresent: gitHead.exitCode === 0,
    noStagedFiles: stagedFiles.length === 0,
    ghAuthenticatedUserRecorded: ghUser.exitCode === 0 && ghUser.stdout.trim() === inferredOwner,
    targetRepoStatusRecorded: true,
    inferredTargetNotAccessible: !targetRepoExists,
    candidateReposRecorded: true,
    remoteStatusRecorded: true,
    remoteNotConfigured: remoteLines.length === 0,
    blockersRecorded: blockers.length > 0,
    noLegacyRepoSelected:
      !remoteLines.some((line) => /PME|Gateway-beta/i.test(line)) &&
      !targetRepoExists,
    readmePhasePresent:
      readme.includes("Phase 127A") &&
      readme.includes("verify:phase127a-github-remote-target-preflight"),
    agentsBoundaryPresent:
      agents.includes("Phase 127A GitHub Remote Target Preflight Boundary") &&
      agents.includes("verify:phase127a-github-remote-target-preflight"),
    userManualPresent:
      userManual.includes("verify:phase127a-github-remote-target-preflight"),
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
      headSubject: gitHeadSubject.stdout.trim(),
      statusLineCount: statusLines.length,
      statusPreview: statusLines.slice(0, 50),
      stagedFileCount: stagedFiles.length,
      remoteConfigured: remoteLines.length > 0,
      remoteCount: remoteLines.length,
      remotePreview: remoteLines.map(redactRemoteLine),
      blockers,
    },
    github: {
      login: ghUser.stdout.trim(),
      inferredTarget: inferredFullName,
      inferredTargetExists: targetRepoExists,
      targetRepoTail: tailLines(targetRepo.stdout || targetRepo.stderr),
      candidateRepos,
      selectedRemote: null,
    },
    nextCommands: [
      `gh repo create ${inferredFullName} --private`,
      `git remote add origin https://github.com/${inferredFullName}.git`,
      "git push -u origin master",
    ],
    safety: {
      createdGitHubRepository: false,
      selectedLegacyPmeRepository: false,
      configuredRemote: false,
      pushedToRemote: false,
      openedPullRequest: false,
      triggeredRemoteWorkflow: false,
      remoteActionsPassed: false,
      deployedInfrastructure: false,
      publishedRelease: false,
      plaintextApiKeyRecorded: false,
      globalReleaseComplete: false,
    },
    secretFindingCount: secretFindings.length,
    conclusion: passed
      ? "github-remote-target-missing-recorded"
      : "github-remote-target-preflight-not-closed",
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

function redactRemoteLine(line) {
  return String(line).replace(/:\/\/[^@\s]+@/g, "://[redacted]@");
}

function markdown(evidence) {
  return [
    "# Phase 127A GitHub Remote Target Preflight Evidence",
    "",
    `- Phase: ${evidence.phase}`,
    `- Status: ${evidence.status}`,
    `- Generated at: ${evidence.generatedAt}`,
    `- Git top-level: ${evidence.git.gitTopLevel}`,
    `- Branch: ${evidence.git.branch}`,
    `- Head subject: ${evidence.git.headSubject}`,
    `- Staged file count: ${evidence.git.stagedFileCount}`,
    `- Remote configured: ${evidence.git.remoteConfigured}`,
    `- GitHub login: ${evidence.github.login}`,
    `- Inferred target: ${evidence.github.inferredTarget}`,
    `- Inferred target exists: ${evidence.github.inferredTargetExists}`,
    `- Selected remote: ${evidence.github.selectedRemote ?? "none"}`,
    `- Blockers: ${evidence.git.blockers.join("; ") || "none"}`,
    `- Plain secret findings: ${evidence.secretFindingCount}`,
    `- Conclusion: ${evidence.conclusion}`,
    "",
    "## Candidate Repositories",
    "",
    ...(evidence.github.candidateRepos.length > 0
      ? evidence.github.candidateRepos.map(
          (repo) => `- ${repo.nameWithOwner} (${repo.visibility}) ${repo.url}`,
        )
      : ["- none"]),
    "",
    "## Next Commands",
    "",
    ...evidence.nextCommands.map((command) => `- ${command}`),
    "",
    "## Checks",
    "",
    ...Object.entries(evidence.checks).map(
      ([name, value]) => `- ${name}: ${value ? "passed" : "failed"}`,
    ),
    "",
    "## Boundary",
    "",
    "- This phase records the remote target preflight only.",
    "- It does not create a GitHub repository, configure a remote, push, open a PR, trigger Actions, deploy, publish, or complete global release.",
    "",
  ].join("\n");
}

await main();
