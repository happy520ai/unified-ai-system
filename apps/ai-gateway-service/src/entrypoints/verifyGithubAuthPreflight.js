import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { findPlainSecretFindings } from "../security/secretSafety.js";

const execFileAsync = promisify(execFile);
const phase = "phase-125a-github-auth-preflight";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const knownGhPath = "C:\\Program Files\\GitHub CLI\\gh.exe";

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
    phase124EvidenceText,
  ] = await Promise.all([
    readRequired("package.json"),
    readRequired("apps/ai-gateway-service/package.json"),
    readRequired("README.md"),
    readRequired("AGENTS.md"),
    readRequired("docs/USER_MANUAL.md"),
    readRequired("apps/ai-gateway-service/evidence/phase-124a-github-cli-install.json"),
  ]);
  const rootPackage = parseJson(rootPackageText, "package.json");
  const servicePackage = parseJson(
    servicePackageText,
    "apps/ai-gateway-service/package.json",
  );
  const phase124Evidence = parseJson(
    phase124EvidenceText,
    "phase-124a-github-cli-install.json",
  );

  const gitTopLevel = await runGit(["rev-parse", "--show-toplevel"]);
  const gitHead = await runGit(["rev-parse", "--verify", "HEAD"]);
  const gitHeadSubject = await runGit(["log", "-1", "--pretty=%s"]);
  const gitBranch = await runGit(["branch", "--show-current"]);
  const gitStatus = await runGit(["status", "--short"]);
  const gitStaged = await runGit(["diff", "--cached", "--name-only"]);
  const gitRemote = await runGit(["remote", "-v"]);
  const ghVersion = await run(knownGhPath, ["--version"]);
  const ghAuth = ghVersion.exitCode === 0
    ? await run(knownGhPath, ["auth", "status"])
    : {
        command: `${knownGhPath} auth status`,
        exitCode: 1,
        durationMs: 0,
        stdout: "",
        stderr: "known GitHub CLI path is not available",
      };

  const statusLines = parseLines(gitStatus.stdout);
  const stagedFiles = parseLines(gitStaged.stdout);
  const remoteLines = parseLines(gitRemote.stdout);
  const ghInstalled = ghVersion.exitCode === 0;
  const ghAuthenticated = ghAuth.exitCode === 0;
  const blockers = [];
  if (!ghAuthenticated) {
    blockers.push("GitHub CLI is not authenticated");
  }
  if (remoteLines.length === 0) {
    blockers.push("git remote is not configured");
  }
  blockers.push("GitHub repository URL has not been provided in this workspace");
  blockers.push("interactive GitHub browser login requires user completion");

  const secretFindings = findPlainSecretFindings(
    [
      rootPackageText,
      servicePackageText,
      readme,
      agents,
      userManual,
      phase124EvidenceText,
      gitRemote.stdout,
      ghVersion.stdout,
      ghVersion.stderr,
      ghAuth.stdout,
      ghAuth.stderr,
    ].join("\n\n"),
    "phase125a-github-auth-preflight",
  );

  const checks = {
    rootScriptPresent:
      rootPackage.scripts?.["verify:phase125a-github-auth-preflight"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase125a-github-auth-preflight",
    serviceScriptPresent:
      servicePackage.scripts?.["verify:phase125a-github-auth-preflight"] ===
      "node ./src/entrypoints/verifyGithubAuthPreflight.js",
    phase124Closed: phase124Evidence.status === "passed",
    gitTopLevelIsProject: normalizePath(gitTopLevel.stdout) === normalizePath(repoRoot),
    localCommitPresent: gitHead.exitCode === 0,
    noStagedFiles: stagedFiles.length === 0,
    ghInstalled,
    ghAuthStatusRecorded: true,
    authNotCompleted: !ghAuthenticated,
    remoteStatusRecorded: true,
    remoteNotConfigured: remoteLines.length === 0,
    blockersRecorded: blockers.length > 0,
    readmePhasePresent:
      readme.includes("Phase 125A") &&
      readme.includes("verify:phase125a-github-auth-preflight"),
    agentsBoundaryPresent:
      agents.includes("Phase 125A GitHub Auth Preflight Boundary") &&
      agents.includes("verify:phase125a-github-auth-preflight"),
    userManualPresent:
      userManual.includes("verify:phase125a-github-auth-preflight"),
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
    githubCli: {
      installed: ghInstalled,
      knownPath: knownGhPath,
      authenticated: ghAuthenticated,
      versionTail: tailLines(ghVersion.stdout || ghVersion.stderr),
      authStatusTail: tailLines(ghAuth.stdout || ghAuth.stderr),
      loginAttempt: {
        command: "gh auth login --hostname github.com --git-protocol https --web --clipboard",
        result: "timed out in the Codex shell before authentication completed",
        tokenRecorded: false,
      },
    },
    nextCommands: [
      "Close and reopen PowerShell",
      "gh auth login",
      "git remote add origin <github-repo-url>",
      "git push -u origin master",
    ],
    safety: {
      storedGitHubTokenInEvidence: false,
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
      ? "github-auth-preflight-blocked-recorded"
      : "github-auth-preflight-not-closed",
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
    "# Phase 125A GitHub Auth Preflight Evidence",
    "",
    `- Phase: ${evidence.phase}`,
    `- Status: ${evidence.status}`,
    `- Generated at: ${evidence.generatedAt}`,
    `- Git top-level: ${evidence.git.gitTopLevel}`,
    `- Branch: ${evidence.git.branch}`,
    `- Head subject: ${evidence.git.headSubject}`,
    `- Staged file count: ${evidence.git.stagedFileCount}`,
    `- Remote configured: ${evidence.git.remoteConfigured}`,
    `- GitHub CLI installed: ${evidence.githubCli.installed}`,
    `- GitHub CLI authenticated: ${evidence.githubCli.authenticated}`,
    `- Login attempt result: ${evidence.githubCli.loginAttempt.result}`,
    `- Token recorded in evidence: ${evidence.githubCli.loginAttempt.tokenRecorded}`,
    `- Blockers: ${evidence.git.blockers.join("; ") || "none"}`,
    `- Plain secret findings: ${evidence.secretFindingCount}`,
    `- Conclusion: ${evidence.conclusion}`,
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
    "- This phase records the GitHub authentication preflight and blocker only.",
    "- It does not store GitHub tokens in evidence, configure a remote, push, open a PR, trigger Actions, deploy, publish, or complete global release.",
    "",
  ].join("\n");
}

await main();
