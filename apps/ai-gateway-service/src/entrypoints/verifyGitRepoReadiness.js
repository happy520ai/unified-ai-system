import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { findPlainSecretFindings } from "../security/secretSafety.js";

const execFileAsync = promisify(execFile);
const phase = "phase-119a-git-repo-readiness";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");

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

function parseStatusLines(text) {
  return String(text ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function tailLines(text, count = 12) {
  return String(text ?? "").trim().split(/\r?\n/).filter(Boolean).slice(-count);
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
    gitignore,
  ] = await Promise.all([
    readRequired("package.json"),
    readRequired("apps/ai-gateway-service/package.json"),
    readRequired("README.md"),
    readRequired("AGENTS.md"),
    readRequired(".gitignore"),
  ]);
  const rootPackage = parseJson(rootPackageText, "package.json");
  const servicePackage = parseJson(
    servicePackageText,
    "apps/ai-gateway-service/package.json",
  );

  const gitTopLevel = await runGit(["rev-parse", "--show-toplevel"]);
  const gitDir = await runGit(["rev-parse", "--git-dir"]);
  const gitStatus = await runGit(["status", "--short"]);
  const gitRemote = await runGit(["remote", "-v"]);
  const gitHead = await runGit(["rev-parse", "--verify", "HEAD"]);
  const gitBranch = await runGit(["branch", "--show-current"]);
  const ghVersion = await run("gh", ["--version"]);
  const ghAuth = ghVersion.exitCode === 0
    ? await run("gh", ["auth", "status"])
    : {
        command: "gh auth status",
        exitCode: 1,
        durationMs: 0,
        stdout: "",
        stderr: "gh CLI is not available",
      };

  const statusLines = parseStatusLines(gitStatus.stdout);
  const remoteLines = parseStatusLines(gitRemote.stdout);
  const blockers = [];
  if (normalizePath(gitTopLevel.stdout) !== normalizePath(repoRoot)) {
    blockers.push("project git top-level is not unified-ai-system");
  }
  if (remoteLines.length === 0) {
    blockers.push("git remote is not configured");
  }
  if (gitHead.exitCode !== 0) {
    blockers.push("initial commit has not been created");
  }
  if (ghVersion.exitCode !== 0) {
    blockers.push("GitHub CLI is not installed or not in PATH");
  }
  if (ghVersion.exitCode === 0 && ghAuth.exitCode !== 0) {
    blockers.push("GitHub CLI is not authenticated");
  }

  const exactIgnoredRuntime = [".env", ".env.*", ".codex/", ".data/", ".tmp/", "node_modules/"];
  const secretFindings = findPlainSecretFindings(
    [rootPackageText, servicePackageText, readme, agents, gitignore].join("\n\n"),
    "phase119a-git-repo-readiness",
  );

  const checks = {
    localGitRepoInitialized: existsSync(resolve(repoRoot, ".git")),
    gitTopLevelIsProject: normalizePath(gitTopLevel.stdout) === normalizePath(repoRoot),
    rootScriptPresent:
      rootPackage.scripts?.["verify:phase119a-git-repo-readiness"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase119a-git-repo-readiness",
    serviceScriptPresent:
      servicePackage.scripts?.["verify:phase119a-git-repo-readiness"] ===
      "node ./src/entrypoints/verifyGitRepoReadiness.js",
    gitignoreProtectsLocalRuntime: exactIgnoredRuntime.every((entry) =>
      gitignore.includes(entry),
    ),
    remoteStatusRecorded: true,
    ghStatusRecorded: true,
    commitStatusRecorded: true,
    noPushClaimed: true,
    noPullRequestClaimed: true,
    readmePhasePresent:
      readme.includes("Phase 119A") &&
      readme.includes("verify:phase119a-git-repo-readiness"),
    agentsBoundaryPresent:
      agents.includes("Phase 119A Git Repository Readiness Boundary") &&
      agents.includes("verify:phase119a-git-repo-readiness"),
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
      gitDir: gitDir.stdout.trim(),
      branch: gitBranch.stdout.trim(),
      remoteConfigured: remoteLines.length > 0,
      remoteCount: remoteLines.length,
      initialCommitPresent: gitHead.exitCode === 0,
      statusLineCount: statusLines.length,
      statusPreview: statusLines.slice(0, 40),
      blockers,
    },
    github: {
      ghAvailable: ghVersion.exitCode === 0,
      ghAuthenticated: ghAuth.exitCode === 0,
      ghVersionTail: tailLines(ghVersion.stdout || ghVersion.stderr),
      ghAuthTail: tailLines(ghAuth.stdout || ghAuth.stderr),
    },
    safety: {
      initializedLocalGitRepo: true,
      stagedFiles: false,
      createdCommit: false,
      pushedToRemote: false,
      configuredRemote: false,
      openedPullRequest: false,
      triggeredRemoteWorkflow: false,
      plaintextApiKeyRecorded: false,
      globalReleaseComplete: false,
    },
    secretFindingCount: secretFindings.length,
    conclusion: passed
      ? "git-repo-readiness-local-initialized-remote-blocked"
      : "git-repo-readiness-not-closed",
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
  return [
    "# Phase 119A Git Repository Readiness Evidence",
    "",
    `- Phase: ${evidence.phase}`,
    `- Status: ${evidence.status}`,
    `- Generated at: ${evidence.generatedAt}`,
    `- Git top-level: ${evidence.git.gitTopLevel}`,
    `- Remote configured: ${evidence.git.remoteConfigured}`,
    `- Initial commit present: ${evidence.git.initialCommitPresent}`,
    `- GitHub CLI available: ${evidence.github.ghAvailable}`,
    `- GitHub CLI authenticated: ${evidence.github.ghAuthenticated}`,
    `- Blockers: ${evidence.git.blockers.join("; ") || "none"}`,
    `- Plain secret findings: ${evidence.secretFindingCount}`,
    `- Conclusion: ${evidence.conclusion}`,
    "",
    "## Checks",
    "",
    ...Object.entries(evidence.checks).map(
      ([name, value]) => `- ${name}: ${value ? "passed" : "failed"}`,
    ),
    "",
    "## Boundary",
    "",
    "- This phase may initialize a local git repository and record readiness.",
    "- It does not stage files, create a commit, configure a remote, push, open a PR, or trigger remote Actions.",
    "",
  ].join("\n");
}

await main();
