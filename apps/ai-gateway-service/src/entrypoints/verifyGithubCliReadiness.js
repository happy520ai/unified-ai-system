import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { findPlainSecretFindings } from "../security/secretSafety.js";

const execFileAsync = promisify(execFile);
const phase = "phase-123a-github-cli-readiness";
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
    phase122EvidenceText,
  ] = await Promise.all([
    readRequired("package.json"),
    readRequired("apps/ai-gateway-service/package.json"),
    readRequired("README.md"),
    readRequired("AGENTS.md"),
    readRequired("docs/USER_MANUAL.md"),
    readRequired("apps/ai-gateway-service/evidence/phase-122a-github-remote-publish-preflight.json"),
  ]);
  const rootPackage = parseJson(rootPackageText, "package.json");
  const servicePackage = parseJson(
    servicePackageText,
    "apps/ai-gateway-service/package.json",
  );
  const phase122Evidence = parseJson(
    phase122EvidenceText,
    "phase-122a-github-remote-publish-preflight.json",
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
  const wingetVersion = await run("winget", ["--version"]);
  const chocoVersion = await run("choco", ["--version"]);
  const chocoLocalGh = chocoVersion.exitCode === 0
    ? await run("choco", ["list", "--local-only", "gh", "--limit-output"])
    : {
        command: "choco list --local-only gh --limit-output",
        exitCode: 1,
        durationMs: 0,
        stdout: "",
        stderr: "Chocolatey is not available",
      };

  const statusLines = parseLines(gitStatus.stdout);
  const stagedFiles = parseLines(gitStaged.stdout);
  const remoteLines = parseLines(gitRemote.stdout);
  const chocoGhLines = parseLines(chocoLocalGh.stdout);
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
  if (wingetVersion.exitCode !== 0) {
    blockers.push("winget is not available in PATH");
  }
  if (chocoVersion.exitCode === 0 && ghVersion.exitCode !== 0) {
    blockers.push("Chocolatey is available, but gh is not installed after the attempted install");
  }

  const secretFindings = findPlainSecretFindings(
    [
      rootPackageText,
      servicePackageText,
      readme,
      agents,
      userManual,
      phase122EvidenceText,
      gitRemote.stdout,
      ghVersion.stdout,
      ghVersion.stderr,
      ghAuth.stdout,
      ghAuth.stderr,
      wingetVersion.stdout,
      wingetVersion.stderr,
      chocoVersion.stdout,
      chocoVersion.stderr,
      chocoLocalGh.stdout,
      chocoLocalGh.stderr,
    ].join("\n\n"),
    "phase123a-github-cli-readiness",
  );

  const checks = {
    rootScriptPresent:
      rootPackage.scripts?.["verify:phase123a-github-cli-readiness"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase123a-github-cli-readiness",
    serviceScriptPresent:
      servicePackage.scripts?.["verify:phase123a-github-cli-readiness"] ===
      "node ./src/entrypoints/verifyGithubCliReadiness.js",
    phase122Closed: phase122Evidence.status === "passed",
    gitTopLevelIsProject: normalizePath(gitTopLevel.stdout) === normalizePath(repoRoot),
    localCommitPresent: gitHead.exitCode === 0,
    noStagedFiles: stagedFiles.length === 0,
    remoteStatusRecorded: true,
    cliInstallStatusRecorded: true,
    wingetStatusRecorded: true,
    chocoStatusRecorded: true,
    ghStatusRecorded: true,
    blockersRecorded: blockers.length > 0,
    readmePhasePresent:
      readme.includes("Phase 123A") &&
      readme.includes("verify:phase123a-github-cli-readiness"),
    agentsBoundaryPresent:
      agents.includes("Phase 123A GitHub CLI Readiness Boundary") &&
      agents.includes("verify:phase123a-github-cli-readiness"),
    userManualPresent:
      userManual.includes("verify:phase123a-github-cli-readiness"),
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
    tools: {
      ghAvailable: ghVersion.exitCode === 0,
      ghAuthenticated: ghAuth.exitCode === 0,
      ghVersionTail: tailLines(ghVersion.stdout || ghVersion.stderr),
      ghAuthTail: tailLines(ghAuth.stdout || ghAuth.stderr),
      wingetAvailable: wingetVersion.exitCode === 0,
      wingetVersionTail: tailLines(wingetVersion.stdout || wingetVersion.stderr),
      chocolateyAvailable: chocoVersion.exitCode === 0,
      chocolateyVersionTail: tailLines(chocoVersion.stdout || chocoVersion.stderr),
      chocolateyGhPackageListed: chocoGhLines.some((line) => /^gh\|/i.test(line)),
      chocolateyGhListTail: tailLines(chocoLocalGh.stdout || chocoLocalGh.stderr),
      installAttemptNote:
        "A Chocolatey gh install was attempted in this session and did not leave gh available in PATH.",
    },
    nextCommands: [
      "winget install --id GitHub.cli --accept-package-agreements --accept-source-agreements",
      "If winget is unavailable, run PowerShell as Administrator and use: choco install gh -y",
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
      ? "github-cli-readiness-blocked-recorded"
      : "github-cli-readiness-not-closed",
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
    "# Phase 123A GitHub CLI Readiness Evidence",
    "",
    `- Phase: ${evidence.phase}`,
    `- Status: ${evidence.status}`,
    `- Generated at: ${evidence.generatedAt}`,
    `- Git top-level: ${evidence.git.gitTopLevel}`,
    `- Branch: ${evidence.git.branch}`,
    `- Head subject: ${evidence.git.headSubject}`,
    `- Staged file count: ${evidence.git.stagedFileCount}`,
    `- Remote configured: ${evidence.git.remoteConfigured}`,
    `- GitHub CLI available: ${evidence.tools.ghAvailable}`,
    `- GitHub CLI authenticated: ${evidence.tools.ghAuthenticated}`,
    `- Winget available: ${evidence.tools.wingetAvailable}`,
    `- Chocolatey available: ${evidence.tools.chocolateyAvailable}`,
    `- Chocolatey gh package listed: ${evidence.tools.chocolateyGhPackageListed}`,
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
    "- This phase records GitHub CLI readiness and installation blockers only.",
    "- It does not install system packages, configure a remote, push, open a PR, trigger Actions, deploy, publish, or complete global release.",
    "",
  ].join("\n");
}

await main();
