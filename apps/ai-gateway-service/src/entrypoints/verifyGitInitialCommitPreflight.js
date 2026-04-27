import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { findPlainSecretFindings } from "../security/secretSafety.js";

const execFileAsync = promisify(execFile);
const phase = "phase-120a-git-initial-commit-preflight";
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

async function describeStrayRootArtifact() {
  const absolute = resolve(repoRoot, strayRootArtifactName);
  if (!existsSync(absolute)) {
    return {
      name: strayRootArtifactName,
      exists: false,
      sizeBytes: 0,
      decisionRequired: false,
    };
  }
  const fileStat = await stat(absolute);
  return {
    name: strayRootArtifactName,
    exists: true,
    sizeBytes: fileStat.size,
    decisionRequired: true,
  };
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
    phase119EvidenceText,
    phase118EvidenceText,
  ] = await Promise.all([
    readRequired("package.json"),
    readRequired("apps/ai-gateway-service/package.json"),
    readRequired("README.md"),
    readRequired("AGENTS.md"),
    readRequired("docs/USER_MANUAL.md"),
    readRequired(".gitignore"),
    readRequired(".env.example"),
    readRequired(".env.enterprise.example"),
    readRequired("apps/ai-gateway-service/evidence/phase-119a-git-repo-readiness.json"),
    readRequired("apps/ai-gateway-service/evidence/phase-118a-remote-cicd-gate-preflight.json"),
  ]);
  const rootPackage = parseJson(rootPackageText, "package.json");
  const servicePackage = parseJson(
    servicePackageText,
    "apps/ai-gateway-service/package.json",
  );
  const phase119Evidence = parseJson(
    phase119EvidenceText,
    "phase-119a-git-repo-readiness.json",
  );
  const phase118Evidence = parseJson(
    phase118EvidenceText,
    "phase-118a-remote-cicd-gate-preflight.json",
  );

  const gitTopLevel = await runGit(["rev-parse", "--show-toplevel"]);
  const gitStatus = await runGit(["status", "--short"]);
  const gitRemote = await runGit(["remote", "-v"]);
  const gitHead = await runGit(["rev-parse", "--verify", "HEAD"]);
  const gitBranch = await runGit(["branch", "--show-current"]);
  const gitStaged = await runGit(["diff", "--cached", "--name-only"]);
  const gitTrackedFiles = await runGit(["ls-files"]);
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
  const strayRootArtifact = await describeStrayRootArtifact();

  const statusLines = parseLines(gitStatus.stdout);
  const remoteLines = parseLines(gitRemote.stdout);
  const stagedFiles = parseLines(gitStaged.stdout);
  const trackedFiles = parseLines(gitTrackedFiles.stdout);
  const legacyStatusLines = statusLines.filter((line) => line.includes("legacy/"));
  const envEnterpriseStatusLines = statusLines.filter((line) =>
    line.includes(".env.enterprise.example")
  );
  const blockers = [];
  if (gitHead.exitCode !== 0) {
    blockers.push("initial commit has not been created");
  }
  if (remoteLines.length === 0) {
    blockers.push("git remote is not configured");
  }
  if (ghVersion.exitCode !== 0) {
    blockers.push("GitHub CLI is not installed or not in PATH");
  }
  if (ghVersion.exitCode === 0 && ghAuth.exitCode !== 0) {
    blockers.push("GitHub CLI is not authenticated");
  }
  if (strayRootArtifact.decisionRequired) {
    blockers.push(`root artifact requires keep/delete decision: ${strayRootArtifact.name}`);
  }
  if (legacyStatusLines.length > 0) {
    blockers.push("legacy read-only reference tracking decision is still required");
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
      phase119EvidenceText,
      phase118EvidenceText,
    ].join("\n\n"),
    "phase120a-git-initial-commit-preflight",
  );

  const checks = {
    rootScriptPresent:
      rootPackage.scripts?.["verify:phase120a-git-initial-commit-preflight"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase120a-git-initial-commit-preflight",
    serviceScriptPresent:
      servicePackage.scripts?.["verify:phase120a-git-initial-commit-preflight"] ===
      "node ./src/entrypoints/verifyGitInitialCommitPreflight.js",
    phase119Closed: phase119Evidence.status === "passed",
    phase118Closed: phase118Evidence.status === "passed",
    gitTopLevelIsProject: normalizePath(gitTopLevel.stdout) === normalizePath(repoRoot),
    noStagedFiles: stagedFiles.length === 0,
    initialCommitStatusRecorded: true,
    remoteStatusRecorded: true,
    ghStatusRecorded: true,
    manualDecisionsRecorded: true,
    envEnterpriseExampleTrackable:
      gitignore.includes("!.env.enterprise.example") &&
      (
        envEnterpriseStatusLines.some((line) => line.includes(".env.enterprise.example")) ||
        trackedFiles.includes(".env.enterprise.example")
      ),
    readmePhasePresent:
      readme.includes("Phase 120A") &&
      readme.includes("verify:phase120a-git-initial-commit-preflight"),
    agentsBoundaryPresent:
      agents.includes("Phase 120A Git Initial Commit Preflight Boundary") &&
      agents.includes("verify:phase120a-git-initial-commit-preflight"),
    userManualPresent:
      userManual.includes("verify:phase120a-git-initial-commit-preflight"),
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
      initialCommitPresent: gitHead.exitCode === 0,
      remoteConfigured: remoteLines.length > 0,
      remoteCount: remoteLines.length,
      stagedFileCount: stagedFiles.length,
      stagedFiles,
      trackedFileCount: trackedFiles.length,
      statusLineCount: statusLines.length,
      statusPreview: statusLines.slice(0, 50),
      legacyStatusLines,
      envEnterpriseStatusLines,
      blockers,
    },
    github: {
      ghAvailable: ghVersion.exitCode === 0,
      ghAuthenticated: ghAuth.exitCode === 0,
      ghVersionTail: tailLines(ghVersion.stdout || ghVersion.stderr),
      ghAuthTail: tailLines(ghAuth.stdout || ghAuth.stderr),
    },
    manualDecisions: {
      strayRootArtifact,
      legacyReadOnlyReference: {
        appearsInGitStatus: legacyStatusLines.length > 0,
        decisionRequired: legacyStatusLines.length > 0,
        boundary: "do not modify legacy contents; decide only whether to track or ignore it before the first commit",
      },
    },
    safety: {
      stagedFiles: stagedFiles.length > 0,
      createdCommit: false,
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
      ? "git-initial-commit-preflight-recorded"
      : "git-initial-commit-preflight-not-closed",
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
    "# Phase 120A Git Initial Commit Preflight Evidence",
    "",
    `- Phase: ${evidence.phase}`,
    `- Status: ${evidence.status}`,
    `- Generated at: ${evidence.generatedAt}`,
    `- Git top-level: ${evidence.git.gitTopLevel}`,
    `- Initial commit present: ${evidence.git.initialCommitPresent}`,
    `- Remote configured: ${evidence.git.remoteConfigured}`,
    `- Staged file count: ${evidence.git.stagedFileCount}`,
    `- GitHub CLI available: ${evidence.github.ghAvailable}`,
    `- GitHub CLI authenticated: ${evidence.github.ghAuthenticated}`,
    `- Stray root artifact exists: ${evidence.manualDecisions.strayRootArtifact.exists}`,
    `- Legacy tracking decision required: ${evidence.manualDecisions.legacyReadOnlyReference.decisionRequired}`,
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
    "- This phase prepares and records the initial-commit preflight only.",
    "- It does not stage files, create commits, configure remotes, push, open a PR, trigger Actions, publish, or deploy.",
    "",
  ].join("\n");
}

await main();
