import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { findPlainSecretFindings } from "../security/secretSafety.js";

const execFileAsync = promisify(execFile);
const phase = "phase-129a-remote-release-status";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const knownGhPath = "C:\\Program Files\\GitHub CLI\\gh.exe";
const repoFullName = "happy520ai/unified-ai-system";
const repoUrl = `https://github.com/${repoFullName}`;
const remoteUrl = `${repoUrl}.git`;
const statusDocPath = "docs/REMOTE_RELEASE_STATUS.md";

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

function parseJsonMaybe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
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
    statusDoc,
    workflow,
    phase128EvidenceText,
  ] = await Promise.all([
    readRequired("package.json"),
    readRequired("apps/ai-gateway-service/package.json"),
    readRequired("README.md"),
    readRequired("AGENTS.md"),
    readRequired("docs/USER_MANUAL.md"),
    readRequired(statusDocPath),
    readRequired(".github/workflows/release-gate.yml"),
    readRequired("apps/ai-gateway-service/evidence/phase-128a-github-remote-push.json"),
  ]);
  const rootPackage = parseJson(rootPackageText, "package.json");
  const servicePackage = parseJson(
    servicePackageText,
    "apps/ai-gateway-service/package.json",
  );
  const phase128Evidence = parseJson(
    phase128EvidenceText,
    "phase-128a-github-remote-push.json",
  );

  const gitTopLevel = await runGit(["rev-parse", "--show-toplevel"]);
  const gitHead = await runGit(["rev-parse", "--verify", "HEAD"]);
  const gitHeadSubject = await runGit(["log", "-1", "--pretty=%s"]);
  const gitBranch = await runGit(["branch", "--show-current"]);
  const gitStatus = await runGit(["status", "--short"]);
  const gitStaged = await runGit(["diff", "--cached", "--name-only"]);
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

  const statusLines = parseLines(gitStatus.stdout);
  const stagedFiles = parseLines(gitStaged.stdout);
  const remoteLines = parseLines(gitRemote.stdout);
  const remoteHeadLine = parseLines(remoteHeads.stdout)[0] ?? "";
  const [remoteHeadSha] = remoteHeadLine.split(/\s+/);
  const localHead = gitHead.stdout.trim();
  const repo = parseJsonMaybe(repoView.stdout) ?? {};
  const runs = Array.isArray(parseJsonMaybe(runList.stdout)) ? parseJsonMaybe(runList.stdout) : [];
  const latestRun = runs[0] ?? null;
  const remoteConfigured = remoteLines.some((line) => line.includes(remoteUrl));
  const remoteHeadMatchesLocal = Boolean(localHead) && remoteHeadSha === localHead;
  const latestRunMatchesHead = latestRun?.headSha === localHead;
  const latestRunSucceeded = latestRunMatchesHead && latestRun?.conclusion === "success";
  const statusDocFlat = normalizeWhitespace(statusDoc);
  const workflowForcesActionsNode24 =
    workflow.includes('FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: "true"') ||
    workflow.includes("FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true");

  const secretFindings = findPlainSecretFindings(
    [
      rootPackageText,
      servicePackageText,
      readme,
      agents,
      userManual,
      statusDoc,
      workflow,
      phase128EvidenceText,
      gitRemote.stdout,
      repoView.stdout,
      repoView.stderr,
      runList.stdout,
      runList.stderr,
    ].join("\n\n"),
    "phase129a-remote-release-status",
  );

  const checks = {
    rootScriptPresent:
      rootPackage.scripts?.["verify:phase129a-remote-release-status"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase129a-remote-release-status",
    serviceScriptPresent:
      servicePackage.scripts?.["verify:phase129a-remote-release-status"] ===
      "node ./src/entrypoints/verifyRemoteReleaseStatus.js",
    phase128Closed: phase128Evidence.status === "passed",
    phase128RecordedActionsSuccess:
      phase128Evidence.safety?.remoteActionsPassedClaimed === true,
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
    latestReleaseGateMatchesHead: latestRunMatchesHead,
    latestReleaseGateSucceeded: latestRunSucceeded,
    workflowPreparesComposeEnv: workflow.includes("cp .env.example .env"),
    workflowForcesActionsNode24,
    statusDocPresent: existsSync(resolve(repoRoot, statusDocPath)),
    statusDocHasRepository: statusDoc.includes(repoFullName) && statusDoc.includes(repoUrl),
    statusDocHasSuccessBoundary:
      statusDoc.includes("conclude `success`") &&
      statusDoc.includes("must not contain real secrets"),
    statusDocHasLimitBoundaries:
      statusDocFlat.includes("No GitHub Release has been created") &&
      statusDocFlat.includes("No cloud deployment has been performed") &&
      statusDocFlat.includes("No global release is complete"),
    statusDocHasNode24Cleanup:
      statusDoc.includes("Phase 130A") &&
      statusDoc.includes("FORCE_JAVASCRIPT_ACTIONS_TO_NODE24"),
    readmePhasePresent:
      readme.includes("Phase 129A") &&
      readme.includes("verify:phase129a-remote-release-status"),
    agentsBoundaryPresent:
      agents.includes("Phase 129A Remote Release Status Boundary") &&
      agents.includes("verify:phase129a-remote-release-status"),
    userManualPresent:
      userManual.includes("verify:phase129a-remote-release-status"),
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
    },
    docs: {
      statusDoc: statusDocPath,
      userManual: "docs/USER_MANUAL.md",
      workflow: ".github/workflows/release-gate.yml",
    },
    safety: {
      remoteReleaseGatePassed: latestRunSucceeded,
      githubReleaseCreated: false,
      packagePublished: false,
      dockerImagePublished: false,
      cloudDeploymentComplete: false,
      publicProductionDeploymentComplete: false,
      globalReleaseComplete: false,
      realAgentExecutionEnabled: false,
      plaintextApiKeyRecorded: false,
    },
    knownWarnings: workflowForcesActionsNode24
      ? []
      : [
          "GitHub Actions reports a future Node.js runtime deprecation warning for checkout/setup-node actions.",
        ],
    secretFindingCount: secretFindings.length,
    conclusion: passed
      ? "remote-release-status-closed"
      : "remote-release-status-not-closed",
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
  const run = evidence.github.latestReleaseGate;
  return [
    "# Phase 129A Remote Release Status Evidence",
    "",
    `- Phase: ${evidence.phase}`,
    `- Status: ${evidence.status}`,
    `- Generated at: ${evidence.generatedAt}`,
    `- Repository: ${evidence.github.repoFullName}`,
    `- Repository URL: ${evidence.github.repoUrl}`,
    `- Private: ${evidence.github.isPrivate}`,
    `- Branch: ${evidence.git.branch}`,
    `- Local head: ${evidence.git.headSha}`,
    `- Remote head: ${evidence.git.remoteHeadSha}`,
    `- Remote head matches local: ${evidence.git.remoteHeadMatchesLocal}`,
    `- Latest Release Gate: ${run ? `${run.workflowName} ${run.status} ${run.conclusion}`.trim() : "none"}`,
    `- Latest Release Gate URL: ${run?.url ?? "none"}`,
    `- GitHub Release created: ${evidence.safety.githubReleaseCreated}`,
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
    "## Known Warnings",
    "",
    ...evidence.knownWarnings.map((warning) => `- ${warning}`),
    "",
    "## Boundary",
    "",
    "- This phase records remote delivery status only.",
    "- It does not create a GitHub Release, publish packages/images, deploy cloud infrastructure, or complete global release.",
    "",
  ].join("\n");
}

await main();
