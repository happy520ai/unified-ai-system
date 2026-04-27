import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { findPlainSecretFindings } from "../security/secretSafety.js";

const execFileAsync = promisify(execFile);
const phase = "phase-122a-github-remote-publish-preflight";
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
    workflow,
    phase121EvidenceText,
  ] = await Promise.all([
    readRequired("package.json"),
    readRequired("apps/ai-gateway-service/package.json"),
    readRequired("README.md"),
    readRequired("AGENTS.md"),
    readRequired("docs/USER_MANUAL.md"),
    readRequired(".github/workflows/release-gate.yml"),
    readRequired("apps/ai-gateway-service/evidence/phase-121a-git-initial-commit-execution.json"),
  ]);
  const rootPackage = parseJson(rootPackageText, "package.json");
  const servicePackage = parseJson(
    servicePackageText,
    "apps/ai-gateway-service/package.json",
  );
  const phase121Evidence = parseJson(
    phase121EvidenceText,
    "phase-121a-git-initial-commit-execution.json",
  );

  const gitTopLevel = await runGit(["rev-parse", "--show-toplevel"]);
  const gitHead = await runGit(["rev-parse", "--verify", "HEAD"]);
  const gitHeadSubject = await runGit(["log", "-1", "--pretty=%s"]);
  const gitBranch = await runGit(["branch", "--show-current"]);
  const gitStatus = await runGit(["status", "--short"]);
  const gitStaged = await runGit(["diff", "--cached", "--name-only"]);
  const gitRemote = await runGit(["remote", "-v"]);
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
      workflow,
      phase121EvidenceText,
      gitRemote.stdout,
    ].join("\n\n"),
    "phase122a-github-remote-publish-preflight",
  );

  const checks = {
    rootScriptPresent:
      rootPackage.scripts?.["verify:phase122a-github-remote-publish-preflight"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase122a-github-remote-publish-preflight",
    serviceScriptPresent:
      servicePackage.scripts?.["verify:phase122a-github-remote-publish-preflight"] ===
      "node ./src/entrypoints/verifyGithubRemotePublishPreflight.js",
    phase121Closed: phase121Evidence.status === "passed",
    gitTopLevelIsProject: normalizePath(gitTopLevel.stdout) === normalizePath(repoRoot),
    initialCommitPresent: gitHead.exitCode === 0,
    localHeadRecorded: Boolean(gitHead.stdout.trim()),
    noStagedFiles: stagedFiles.length === 0,
    workflowPresent: workflow.includes("Phase117A Release Gate"),
    remoteStatusRecorded: true,
    ghStatusRecorded: true,
    blockersRecorded: blockers.length > 0,
    readmePhasePresent:
      readme.includes("Phase 122A") &&
      readme.includes("verify:phase122a-github-remote-publish-preflight"),
    agentsBoundaryPresent:
      agents.includes("Phase 122A GitHub Remote Publish Preflight Boundary") &&
      agents.includes("verify:phase122a-github-remote-publish-preflight"),
    userManualPresent:
      userManual.includes("verify:phase122a-github-remote-publish-preflight"),
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
      ghAvailable: ghVersion.exitCode === 0,
      ghAuthenticated: ghAuth.exitCode === 0,
      ghVersionTail: tailLines(ghVersion.stdout || ghVersion.stderr),
      ghAuthTail: tailLines(ghAuth.stdout || ghAuth.stderr),
    },
    nextCommands: [
      "winget install --id GitHub.cli",
      "gh auth login",
      "git remote add origin <github-repo-url>",
      "git push -u origin master",
    ],
    safety: {
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
      ? "github-remote-publish-preflight-blocked-recorded"
      : "github-remote-publish-preflight-not-closed",
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
    "# Phase 122A GitHub Remote Publish Preflight Evidence",
    "",
    `- Phase: ${evidence.phase}`,
    `- Status: ${evidence.status}`,
    `- Generated at: ${evidence.generatedAt}`,
    `- Git top-level: ${evidence.git.gitTopLevel}`,
    `- Branch: ${evidence.git.branch}`,
    `- Head subject: ${evidence.git.headSubject}`,
    `- Staged file count: ${evidence.git.stagedFileCount}`,
    `- Remote configured: ${evidence.git.remoteConfigured}`,
    `- GitHub CLI available: ${evidence.github.ghAvailable}`,
    `- GitHub CLI authenticated: ${evidence.github.ghAuthenticated}`,
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
    "- This phase records remote publish readiness only.",
    "- It does not configure a remote, push, open a PR, trigger Actions, deploy, publish, or complete global release.",
    "",
  ].join("\n");
}

await main();
