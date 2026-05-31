import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findPlainSecretFindings } from "../security/secretSafety.js";

const phase = "phase-138a-agent-workforce-omx-benchmark";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const benchmarkDocPath = "docs/AGENT_WORKFORCE_OMX_BENCHMARK.md";

async function main() {
  const generatedAt = new Date().toISOString();
  const [
    rootPackageText,
    servicePackageText,
    readme,
    agents,
    userManual,
    benchmarkDoc,
  ] = await Promise.all([
    readRequired("package.json"),
    readRequired("apps/ai-gateway-service/package.json"),
    readRequired("README.md"),
    readRequired("AGENTS.md"),
    readRequired("docs/USER_MANUAL.md"),
    readRequired(benchmarkDocPath),
  ]);

  const rootPackage = JSON.parse(rootPackageText);
  const servicePackage = JSON.parse(servicePackageText);
  const benchmarkFlat = normalizeWhitespace(benchmarkDoc);
  const allText = [
    rootPackageText,
    servicePackageText,
    readme,
    agents,
    userManual,
    benchmarkDoc,
  ].join("\n\n");
  const secretFindings = findPlainSecretFindings(
    allText,
    "phase138a-agent-workforce-omx-benchmark",
  );

  const checks = {
    rootScriptPresent:
      rootPackage.scripts?.["verify:phase138a-agent-workforce-omx-benchmark"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase138a-agent-workforce-omx-benchmark",
    serviceScriptPresent:
      servicePackage.scripts?.["verify:phase138a-agent-workforce-omx-benchmark"] ===
      "node ./src/entrypoints/verifyAgentWorkforceOmxBenchmark.js",
    benchmarkDocPresent: existsSync(resolve(repoRoot, benchmarkDocPath)),
    benchmarkSourcesPresent:
      benchmarkDoc.includes("https://oh-my-codex.dev/") &&
      benchmarkDoc.includes("https://oh-my-codex.dev/docs.html") &&
      benchmarkDoc.includes("https://github.com/Yeachan-Heo/oh-my-codex"),
    omxFactsCaptured:
      benchmarkDoc.includes("v0.14.2") &&
      benchmarkDoc.includes("33 prompts") &&
      benchmarkDoc.includes("36 skills") &&
      benchmarkDoc.includes("5 MCP servers") &&
      benchmarkDoc.includes("isolated git worktrees") &&
      benchmarkDoc.includes("hooks") &&
      benchmarkDoc.includes("HUD") &&
      benchmarkDoc.includes("workflow run"),
    capabilityComparisonPresent:
      benchmarkDoc.includes("Core Capability Comparison") &&
      benchmarkDoc.includes("Multi-agent roles") &&
      benchmarkDoc.includes("State records") &&
      benchmarkDoc.includes("Suggested direction"),
    featureExtractionPresent:
      benchmarkDoc.includes("Feature Extraction For Unified AI System") &&
      benchmarkDoc.includes("Multi Agent role system") &&
      benchmarkDoc.includes("plan.created") &&
      benchmarkDoc.includes("workflowRunHandoff"),
    workforceGapMapPresent:
      benchmarkDoc.includes("Clarification step before plan generation") &&
      benchmarkDoc.includes("Planner/architect/critic consensus lane") &&
      benchmarkDoc.includes("Task DAG with claim-safe task statuses") &&
      benchmarkDoc.includes("Verification evidence model per task"),
    nextMainlinePresent:
      benchmarkFlat.includes("Phase 139A Agent Workforce Clarify And Consensus Preview") &&
      benchmarkDoc.includes("clarificationQuestions") &&
      benchmarkDoc.includes("consensusReview") &&
      benchmarkDoc.includes("executionReadiness"),
    safetyBoundaryPresent:
      benchmarkFlat.includes("does not install OMX") &&
      benchmarkFlat.includes("Do not move into real execution until a later explicit mainline") &&
      benchmarkFlat.includes("Do not start real workers") &&
      benchmarkFlat.includes("Do not run commands") &&
      benchmarkFlat.includes("Do not create worktrees") &&
      benchmarkFlat.includes("Do not modify user project files") &&
      benchmarkFlat.includes("Keep disconnected for now") &&
      benchmarkFlat.includes("No 144-worker mode"),
    readmePhasePresent:
      readme.includes("Phase 138A") &&
      readme.includes("verify:phase138a-agent-workforce-omx-benchmark") &&
      readme.includes("AGENT_WORKFORCE_OMX_BENCHMARK.md"),
    agentsBoundaryPresent:
      agents.includes("Phase 138A Agent Workforce OMX Benchmark Boundary") &&
      agents.includes("verify:phase138a-agent-workforce-omx-benchmark"),
    userManualPresent:
      userManual.includes("verify:phase138a-agent-workforce-omx-benchmark") &&
      userManual.includes("Agent Workforce OMX benchmark"),
    noPlainSecrets: secretFindings.length === 0,
    projectContextNotCreated: !existsSync(resolve(repoRoot, "PROJECT_CONTEXT.md")),
  };
  const passed = Object.values(checks).every(Boolean);
  const evidence = {
    phase,
    status: passed ? "passed" : "failed",
    generatedAt,
    checks,
    benchmark: {
      document: benchmarkDocPath,
      sourceSnapshotDate: "2026-04-28",
      upstream: {
        name: "oh-my-codex",
        versionObserved: "v0.14.2",
        officialSite: "https://oh-my-codex.dev/",
        officialDocs: "https://oh-my-codex.dev/docs.html",
        githubRepo: "https://github.com/Yeachan-Heo/oh-my-codex",
      },
      recommendedNextMainline:
        "Phase 139A Agent Workforce Clarify And Consensus Preview",
    },
    safety: {
      designOnly: true,
      installsOhMyCodex: false,
      runsOhMyCodex: false,
      startsRealWorkers: false,
      createsWorktrees: false,
      runsCommands: false,
      mutatesUserProjectFiles: false,
      enablesRealAgentExecution: false,
      enables144Workers: false,
      changesDefaultNvidiaChatLane: false,
      plaintextApiKeyRecorded: false,
    },
    secretFindingCount: secretFindings.length,
    conclusion: passed
      ? "agent-workforce-omx-benchmark-closed"
      : "agent-workforce-omx-benchmark-not-closed",
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

async function readRequired(relativePath) {
  return readFile(resolve(repoRoot, relativePath), "utf8");
}

function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function markdown(evidence) {
  return [
    "# Phase 138A Agent Workforce OMX Benchmark Evidence",
    "",
    `- Phase: ${evidence.phase}`,
    `- Status: ${evidence.status}`,
    `- Generated at: ${evidence.generatedAt}`,
    `- Benchmark document: ${evidence.benchmark.document}`,
    `- Upstream: ${evidence.benchmark.upstream.name} ${evidence.benchmark.upstream.versionObserved}`,
    `- Official site: ${evidence.benchmark.upstream.officialSite}`,
    `- Official docs: ${evidence.benchmark.upstream.officialDocs}`,
    `- GitHub repo: ${evidence.benchmark.upstream.githubRepo}`,
    `- Recommended next mainline: ${evidence.benchmark.recommendedNextMainline}`,
    `- Design only: ${evidence.safety.designOnly}`,
    `- Runs oh-my-codex: ${evidence.safety.runsOhMyCodex}`,
    `- Starts real workers: ${evidence.safety.startsRealWorkers}`,
    `- Creates worktrees: ${evidence.safety.createsWorktrees}`,
    `- Runs commands: ${evidence.safety.runsCommands}`,
    `- Mutates user project files: ${evidence.safety.mutatesUserProjectFiles}`,
    `- Enables real agent execution: ${evidence.safety.enablesRealAgentExecution}`,
    `- Enables 144 workers: ${evidence.safety.enables144Workers}`,
    `- Plain secret findings: ${evidence.secretFindingCount}`,
    `- Conclusion: ${evidence.conclusion}`,
    "",
    "## Checks",
    "",
    ...Object.entries(evidence.checks).map(
      ([name, value]) => `- ${name}: ${value ? "passed" : "failed"}`,
    ),
    "",
  ].join("\n");
}

await main();
