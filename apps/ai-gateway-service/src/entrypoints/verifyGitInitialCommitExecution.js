import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { findPlainSecretFindings } from "../security/secretSafety.js";

const execFileAsync = promisify(execFile);
const phase = "phase-121a-git-initial-commit-execution";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const strayRootArtifactName = "{console.error(e.message)";

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
    gitignore,
    envExample,
    envEnterpriseExample,
    phase120EvidenceText,
  ] = await Promise.all([
    readRequired("package.json"),
    readRequired("apps/ai-gateway-service/package.json"),
    readRequired("README.md"),
    readRequired("AGENTS.md"),
    readRequired("docs/USER_MANUAL.md"),
    readRequired(".gitignore"),
    readRequired(".env.example"),
    readRequired(".env.enterprise.example"),
    readRequired("apps/ai-gateway-service/evidence/phase-120a-git-initial-commit-preflight.json"),
  ]);
  const rootPackage = parseJson(rootPackageText, "package.json");
  const servicePackage = parseJson(
    servicePackageText,
    "apps/ai-gateway-service/package.json",
  );
  const phase120Evidence = parseJson(
    phase120EvidenceText,
    "phase-120a-git-initial-commit-preflight.json",
  );

  const gitTopLevel = await runGit(["rev-parse", "--show-toplevel"]);
  const gitHead = await runGit(["rev-parse", "--verify", "HEAD"]);
  const gitHeadSubject = await runGit(["log", "-1", "--pretty=%s"]);
  const gitStatus = await runGit(["status", "--short"]);
  const gitStaged = await runGit(["diff", "--cached", "--name-only"]);
  const gitRemote = await runGit(["remote", "-v"]);
  const gitTrackedFiles = await runGit(["ls-files"]);
  const gitLegacyIgnored = await runGit(["check-ignore", "legacy/"]);
  const gitEnvIgnored = await runGit(["check-ignore", ".env"]);
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

  const statusLines = parseLines(gitStatus.stdout);
  const stagedFiles = parseLines(gitStaged.stdout);
  const remoteLines = parseLines(gitRemote.stdout);
  const trackedFiles = parseLines(gitTrackedFiles.stdout);
  const trackedLegacyFiles = trackedFiles.filter((file) => file.startsWith("legacy/"));
  const evidenceFilesTracked = trackedFiles.filter((file) =>
    file.startsWith("apps/ai-gateway-service/evidence/")
  );
  const blockers = [];
  if (remoteLines.length === 0) {
    blockers.push("git remote is not configured");
  }
  if (ghVersion.exitCode !== 0) {
    blockers.push("GitHub CLI is not installed or not in PATH");
  }
  if (ghVersion.exitCode === 0 && ghAuth.exitCode !== 0) {
    blockers.push("GitHub CLI is not authenticated");
  }

  const secretFindings = findPlainSecretFindings(
    [
      rootPackageText,
      servicePackageText,
      readme,
      agents,
      userManual,
      gitignore,
      envExample,
      envEnterpriseExample,
      phase120EvidenceText,
    ].join("\n\n"),
    "phase121a-git-initial-commit-execution",
  );

  const checks = {
    rootScriptPresent:
      rootPackage.scripts?.["verify:phase121a-git-initial-commit-execution"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase121a-git-initial-commit-execution",
    serviceScriptPresent:
      servicePackage.scripts?.["verify:phase121a-git-initial-commit-execution"] ===
      "node ./src/entrypoints/verifyGitInitialCommitExecution.js",
    phase120Closed: phase120Evidence.status === "passed",
    gitTopLevelIsProject: normalizePath(gitTopLevel.stdout) === normalizePath(repoRoot),
    initialCommitPresent: gitHead.exitCode === 0,
    initialCommitMessageRecorded: gitHeadSubject.stdout.includes("Phase121A"),
    noStagedFiles: stagedFiles.length === 0,
    strayRootArtifactRemoved: !existsSync(resolve(repoRoot, strayRootArtifactName)),
    legacyIgnored: gitLegacyIgnored.exitCode === 0 && gitLegacyIgnored.stdout.includes("legacy/"),
    legacyNotTracked: trackedLegacyFiles.length === 0,
    envFilesIgnored: gitEnvIgnored.exitCode === 0 && gitEnvIgnored.stdout.trim() === ".env",
    envTemplatesTracked:
      trackedFiles.includes(".env.example") &&
      trackedFiles.includes(".env.enterprise.example"),
    evidenceTracked: evidenceFilesTracked.length > 0,
    remoteStatusRecorded: true,
    ghStatusRecorded: true,
    readmePhasePresent:
      readme.includes("Phase 121A") &&
      readme.includes("verify:phase121a-git-initial-commit-execution"),
    agentsBoundaryPresent:
      agents.includes("Phase 121A Git Initial Commit Execution Boundary") &&
      agents.includes("verify:phase121a-git-initial-commit-execution"),
    userManualPresent:
      userManual.includes("verify:phase121a-git-initial-commit-execution"),
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
      headSubject: gitHeadSubject.stdout.trim(),
      statusLineCount: statusLines.length,
      statusPreview: statusLines.slice(0, 50),
      stagedFileCount: stagedFiles.length,
      trackedFileCount: trackedFiles.length,
      trackedLegacyFileCount: trackedLegacyFiles.length,
      evidenceFileCount: evidenceFilesTracked.length,
      remoteConfigured: remoteLines.length > 0,
      remoteCount: remoteLines.length,
      blockers,
    },
    github: {
      ghAvailable: ghVersion.exitCode === 0,
      ghAuthenticated: ghAuth.exitCode === 0,
      ghVersionTail: tailLines(ghVersion.stdout || ghVersion.stderr),
      ghAuthTail: tailLines(ghAuth.stdout || ghAuth.stderr),
    },
    cleanup: {
      strayRootArtifactRemoved: !existsSync(resolve(repoRoot, strayRootArtifactName)),
      legacyIgnored: checks.legacyIgnored,
      legacyNotTracked: checks.legacyNotTracked,
      envEnterpriseTemplateTracked: trackedFiles.includes(".env.enterprise.example"),
    },
    safety: {
      stagedFiles: stagedFiles.length > 0,
      createdCommit: gitHead.exitCode === 0,
      configuredRemote: false,
      pushedToRemote: false,
      openedPullRequest: false,
      triggeredRemoteWorkflow: false,
      remoteActionsPassed: false,
      publishedRelease: false,
      plaintextApiKeyRecorded: false,
      globalReleaseComplete: false,
    },
    secretFindingCount: secretFindings.length,
    conclusion: passed
      ? "git-initial-commit-execution-closed"
      : "git-initial-commit-execution-not-closed",
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
    "# Phase 121A Git Initial Commit Execution Evidence",
    "",
    `- Phase: ${evidence.phase}`,
    `- Status: ${evidence.status}`,
    `- Generated at: ${evidence.generatedAt}`,
    `- Git top-level: ${evidence.git.gitTopLevel}`,
    `- Head subject: ${evidence.git.headSubject}`,
    `- Staged file count: ${evidence.git.stagedFileCount}`,
    `- Tracked file count: ${evidence.git.trackedFileCount}`,
    `- Legacy tracked file count: ${evidence.git.trackedLegacyFileCount}`,
    `- Remote configured: ${evidence.git.remoteConfigured}`,
    `- GitHub CLI available: ${evidence.github.ghAvailable}`,
    `- Stray root artifact removed: ${evidence.cleanup.strayRootArtifactRemoved}`,
    `- Legacy ignored: ${evidence.cleanup.legacyIgnored}`,
    `- Enterprise env template tracked: ${evidence.cleanup.envEnterpriseTemplateTracked}`,
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
    "- This phase creates the local initial commit only.",
    "- It does not configure remotes, push, open a PR, trigger Actions, publish, deploy, or complete global release.",
    "",
  ].join("\n");
}

await main();
