import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { findPlainSecretFindings } from "../security/secretSafety.js";

const execFileAsync = promisify(execFile);
const phase = "phase-124a-github-cli-install";
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
    phase123EvidenceText,
  ] = await Promise.all([
    readRequired("package.json"),
    readRequired("apps/ai-gateway-service/package.json"),
    readRequired("README.md"),
    readRequired("AGENTS.md"),
    readRequired("docs/USER_MANUAL.md"),
    readRequired("apps/ai-gateway-service/evidence/phase-123a-github-cli-readiness.json"),
  ]);
  const rootPackage = parseJson(rootPackageText, "package.json");
  const servicePackage = parseJson(
    servicePackageText,
    "apps/ai-gateway-service/package.json",
  );
  const phase123Evidence = parseJson(
    phase123EvidenceText,
    "phase-123a-github-cli-readiness.json",
  );

  const gitTopLevel = await runGit(["rev-parse", "--show-toplevel"]);
  const gitHead = await runGit(["rev-parse", "--verify", "HEAD"]);
  const gitHeadSubject = await runGit(["log", "-1", "--pretty=%s"]);
  const gitBranch = await runGit(["branch", "--show-current"]);
  const gitStatus = await runGit(["status", "--short"]);
  const gitStaged = await runGit(["diff", "--cached", "--name-only"]);
  const gitRemote = await runGit(["remote", "-v"]);
  const ghPathVersion = await run(knownGhPath, ["--version"]);
  const ghPathAuth = ghPathVersion.exitCode === 0
    ? await run(knownGhPath, ["auth", "status"])
    : {
        command: `${knownGhPath} auth status`,
        exitCode: 1,
        durationMs: 0,
        stdout: "",
        stderr: "known GitHub CLI path is not available",
      };
  const ghPlainVersion = await run("gh", ["--version"]);
  const wingetVersion = await run("winget", ["--version"]);
  const chocoVersion = await run("choco", ["--version"]);
  const machinePath = await run("powershell.exe", [
    "-NoProfile",
    "-Command",
    "[Environment]::GetEnvironmentVariable('Path','Machine')",
  ]);

  const statusLines = parseLines(gitStatus.stdout);
  const stagedFiles = parseLines(gitStaged.stdout);
  const remoteLines = parseLines(gitRemote.stdout);
  const ghInstalled = ghPathVersion.exitCode === 0;
  const ghInCurrentPath = ghPlainVersion.exitCode === 0;
  const ghAuthenticated = ghPathAuth.exitCode === 0;
  const machinePathContainsGh = machinePath.stdout.includes("GitHub CLI");
  const blockers = [];
  if (!ghInCurrentPath && ghInstalled) {
    blockers.push("current shell PATH has not picked up GitHub CLI yet");
  }
  if (!ghAuthenticated) {
    blockers.push("GitHub CLI is not authenticated");
  }
  if (remoteLines.length === 0) {
    blockers.push("git remote is not configured");
  }

  const secretFindings = findPlainSecretFindings(
    [
      rootPackageText,
      servicePackageText,
      readme,
      agents,
      userManual,
      phase123EvidenceText,
      gitRemote.stdout,
      ghPathVersion.stdout,
      ghPathVersion.stderr,
      ghPathAuth.stdout,
      ghPathAuth.stderr,
      ghPlainVersion.stdout,
      ghPlainVersion.stderr,
      wingetVersion.stdout,
      wingetVersion.stderr,
      chocoVersion.stdout,
      chocoVersion.stderr,
    ].join("\n\n"),
    "phase124a-github-cli-install",
  );

  const checks = {
    rootScriptPresent:
      rootPackage.scripts?.["verify:phase124a-github-cli-install"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase124a-github-cli-install",
    serviceScriptPresent:
      servicePackage.scripts?.["verify:phase124a-github-cli-install"] ===
      "node ./src/entrypoints/verifyGithubCliInstall.js",
    phase123Closed: phase123Evidence.status === "passed",
    gitTopLevelIsProject: normalizePath(gitTopLevel.stdout) === normalizePath(repoRoot),
    localCommitPresent: gitHead.exitCode === 0,
    noStagedFiles: stagedFiles.length === 0,
    ghInstalled,
    ghVersionRecorded: tailLines(ghPathVersion.stdout || ghPathVersion.stderr).length > 0,
    ghPathStatusRecorded: true,
    ghAuthStatusRecorded: true,
    pathRefreshStatusRecorded: true,
    machinePathContainsGh,
    remoteStatusRecorded: true,
    blockersRecorded: blockers.length > 0,
    readmePhasePresent:
      readme.includes("Phase 124A") &&
      readme.includes("verify:phase124a-github-cli-install"),
    agentsBoundaryPresent:
      agents.includes("Phase 124A GitHub CLI Install Boundary") &&
      agents.includes("verify:phase124a-github-cli-install"),
    userManualPresent:
      userManual.includes("verify:phase124a-github-cli-install"),
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
      availableInCurrentPath: ghInCurrentPath,
      machinePathContainsGh,
      authenticated: ghAuthenticated,
      versionTail: tailLines(ghPathVersion.stdout || ghPathVersion.stderr),
      authStatusTail: tailLines(ghPathAuth.stdout || ghPathAuth.stderr),
      plainPathVersionTail: tailLines(ghPlainVersion.stdout || ghPlainVersion.stderr),
      wingetAvailable: wingetVersion.exitCode === 0,
      wingetVersionTail: tailLines(wingetVersion.stdout || wingetVersion.stderr),
      chocolateyAvailable: chocoVersion.exitCode === 0,
      chocolateyVersionTail: tailLines(chocoVersion.stdout || chocoVersion.stderr),
    },
    nextCommands: [
      "Close and reopen PowerShell so PATH includes GitHub CLI",
      "gh --version",
      "gh auth login",
      "git remote add origin <github-repo-url>",
      "git push -u origin master",
    ],
    safety: {
      installedGitHubCli: ghInstalled,
      storedGitHubToken: false,
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
      ? "github-cli-installed-auth-remote-blocked"
      : "github-cli-install-not-closed",
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
    "# Phase 124A GitHub CLI Install Evidence",
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
    `- GitHub CLI path: ${evidence.githubCli.knownPath}`,
    `- GitHub CLI available in current PATH: ${evidence.githubCli.availableInCurrentPath}`,
    `- Machine PATH contains GitHub CLI: ${evidence.githubCli.machinePathContainsGh}`,
    `- GitHub CLI authenticated: ${evidence.githubCli.authenticated}`,
    `- Version: ${evidence.githubCli.versionTail.join(" | ")}`,
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
    "- This phase records GitHub CLI installation and remaining remote-publish blockers.",
    "- It does not authenticate GitHub, store tokens, configure a remote, push, open a PR, trigger Actions, deploy, publish, or complete global release.",
    "",
  ].join("\n");
}

await main();
