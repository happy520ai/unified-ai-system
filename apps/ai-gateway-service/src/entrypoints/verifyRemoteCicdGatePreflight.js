import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { findPlainSecretFindings } from "../security/secretSafety.js";

const execFileAsync = promisify(execFile);
const phase = "phase-118a-remote-cicd-gate-preflight";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const workflowPath = ".github/workflows/release-gate.yml";

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

function normalizePath(value) {
  return String(value ?? "").trim().replace(/\\/g, "/").replace(/\/$/, "");
}

async function runGit(args) {
  return run("git", ["-c", `safe.directory=${normalizePath(repoRoot)}`, ...args]);
}

function tailLines(text, count = 30) {
  return String(text ?? "").trim().split(/\r?\n/).filter(Boolean).slice(-count);
}

async function main() {
  const generatedAt = new Date().toISOString();
  const [
    rootPackageText,
    servicePackageText,
    workflow,
    readme,
    agents,
    phase117EvidenceText,
  ] = await Promise.all([
    readRequired("package.json"),
    readRequired("apps/ai-gateway-service/package.json"),
    readRequired(workflowPath),
    readRequired("README.md"),
    readRequired("AGENTS.md"),
    readRequired("apps/ai-gateway-service/evidence/phase-117a-cicd-release-gate.json"),
  ]);

  const rootPackage = parseJson(rootPackageText, "package.json");
  const servicePackage = parseJson(
    servicePackageText,
    "apps/ai-gateway-service/package.json",
  );
  const phase117Evidence = parseJson(
    phase117EvidenceText,
    "phase-117a-cicd-release-gate.json",
  );

  const gitTopLevel = await runGit(["rev-parse", "--show-toplevel"]);
  const gitStatus = await runGit(["status", "--short"]);
  const gitBranch = await runGit(["branch", "--show-current"]);
  const gitRemote = await runGit(["remote", "-v"]);
  const gitHead = await runGit(["rev-parse", "--verify", "HEAD"]);
  const ghVersion = await run("gh", ["--version"]);
  const ghAuthStatus = ghVersion.exitCode === 0
    ? await run("gh", ["auth", "status"])
    : {
        command: "gh auth status",
        exitCode: 1,
        durationMs: 0,
        stdout: "",
        stderr: "gh CLI is not available",
      };

  const normalizedGitRoot = normalizePath(gitTopLevel.stdout);
  const normalizedRepoRoot = normalizePath(repoRoot);
  const remoteLines = gitRemote.stdout.trim().split(/\r?\n/).filter(Boolean);
  const projectStatusLine = gitStatus.stdout
    .split(/\r?\n/)
    .find((line) => /^\?\?\s+\.\/?$/.test(line.trim()) ||
      line.includes("unified-ai-system/"));
  const blockers = [];
  if (normalizedGitRoot !== normalizedRepoRoot) {
    blockers.push("project directory is not the git top-level checkout");
  }
  if (remoteLines.length === 0) {
    blockers.push("no git remote is configured");
  }
  if (gitHead.exitCode !== 0) {
    blockers.push("initial commit has not been created");
  }
  if (ghVersion.exitCode !== 0) {
    blockers.push("GitHub CLI is not installed or not in PATH");
  }
  if (ghVersion.exitCode === 0 && ghAuthStatus.exitCode !== 0) {
    blockers.push("GitHub CLI is not authenticated");
  }
  if (projectStatusLine?.startsWith("??")) {
    blockers.push("unified-ai-system appears untracked from the current git root");
  }

  const secretFindings = findPlainSecretFindings(
    [
      rootPackageText,
      servicePackageText,
      workflow,
      readme,
      agents,
      phase117EvidenceText,
      gitRemote.stdout,
    ].join("\n\n"),
    "phase118a-remote-cicd-gate-preflight",
  );

  const checks = {
    rootScriptPresent:
      rootPackage.scripts?.["verify:phase118a-remote-cicd-gate-preflight"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase118a-remote-cicd-gate-preflight",
    serviceScriptPresent:
      servicePackage.scripts?.["verify:phase118a-remote-cicd-gate-preflight"] ===
      "node ./src/entrypoints/verifyRemoteCicdGatePreflight.js",
    workflowPresent: existsSync(resolve(repoRoot, workflowPath)),
    phase117GateClosed: phase117Evidence.status === "passed",
    localWorkflowReady:
      workflow.includes("Phase117A Release Gate") &&
      workflow.includes("pnpm verify:phase115a-docker-runtime-recheck") &&
      workflow.includes("pnpm verify:phase116a-docker-compose-runtime"),
    remoteExecutionNotClaimed: true,
    blockersRecorded: blockers.length > 0,
    readmePhasePresent:
      readme.includes("Phase 118A") &&
      readme.includes("verify:phase118a-remote-cicd-gate-preflight"),
    agentsBoundaryPresent:
      agents.includes("Phase 118A Remote CI/CD Gate Preflight Boundary") &&
      agents.includes("verify:phase118a-remote-cicd-gate-preflight"),
    noPlainSecrets: secretFindings.length === 0,
    projectContextNotCreated: !existsSync(resolve(repoRoot, "PROJECT_CONTEXT.md")),
  };
  const passed = Object.values(checks).every(Boolean);
  const evidence = {
    phase,
    status: passed ? "passed" : "failed",
    generatedAt,
    checks,
    remoteGate: {
      workflowPath,
      remoteExecutionAttempted: false,
      remoteRunPassed: false,
      blockers,
      gitTopLevel: gitTopLevel.stdout.trim(),
      expectedProjectRoot: repoRoot,
      currentBranch: gitBranch.stdout.trim(),
      remoteCount: remoteLines.length,
      initialCommitPresent: gitHead.exitCode === 0,
      projectStatusLine: projectStatusLine ?? "",
      ghAvailable: ghVersion.exitCode === 0,
      ghAuthenticated: ghAuthStatus.exitCode === 0,
      ghVersionTail: tailLines(ghVersion.stdout || ghVersion.stderr, 5),
      ghAuthTail: tailLines(ghAuthStatus.stdout || ghAuthStatus.stderr, 8),
    },
    safety: {
      pushedToRemote: false,
      openedPullRequest: false,
      triggeredRemoteWorkflow: false,
      remoteActionsPassed: false,
      deploysInfrastructure: false,
      publishesRelease: false,
      pushesImage: false,
      plaintextApiKeyRecorded: false,
      globalReleaseComplete: false,
    },
    secretFindingCount: secretFindings.length,
    conclusion: passed
      ? "remote-cicd-gate-preflight-blocked-recorded"
      : "remote-cicd-gate-preflight-not-closed",
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
    "# Phase 118A Remote CI/CD Gate Preflight Evidence",
    "",
    `- Phase: ${evidence.phase}`,
    `- Status: ${evidence.status}`,
    `- Generated at: ${evidence.generatedAt}`,
    `- Workflow: ${evidence.remoteGate.workflowPath}`,
    `- Remote execution attempted: ${evidence.remoteGate.remoteExecutionAttempted}`,
    `- Remote run passed: ${evidence.remoteGate.remoteRunPassed}`,
    `- Blockers: ${evidence.remoteGate.blockers.join("; ") || "none"}`,
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
    "- This phase records remote GitHub Actions execution readiness only.",
    "- It does not push, open a PR, trigger a remote workflow, deploy, publish, or complete global release.",
    "- A real remote pass requires a tracked GitHub repository, configured remote, and authenticated GitHub CLI or equivalent connector.",
    "",
  ].join("\n");
}

await main();
