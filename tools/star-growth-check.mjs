#!/usr/bin/env node
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { existsSync, readFileSync } from "node:fs";

const repo = "happy520ai/unified-ai-system";
const repoUrl = "https://github.com/happy520ai/unified-ai-system";
const promptLabUrl = "https://happy520ai.github.io/unified-ai-system/#enhance";
const usageReportUrl =
  "https://github.com/happy520ai/unified-ai-system/issues/new?template=usage-verification-report.yml";
const demoCommand =
  "docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.4.3 pnpm gateway demo \"Build a small API for my team\" --enhance --profile coding";

const externalPrs = [
  ["sickn33/agentic-awesome-skills", 1073],
  ["composio-community/awesome-codex-skills", 206],
  ["toolleeo/awesome-cli-apps-in-a-csv", 347],
  ["tensorchord/Awesome-LLMOps", 710],
  ["punkpeye/awesome-mcp-devtools", 257],
  ["WagnerAgent/awesome-mcp-servers-devops", 65],
  ["yzfly/Awesome-MCP-ZH", 422],
  ["punkpeye/awesome-mcp-servers", 11745],
  ["TensorBlock/awesome-mcp-servers", 1616],
  ["mahseema/awesome-ai-tools", 1941],
  ["docker/mcp-registry", 4584],
  ["up-for-grabs/up-for-grabs.net", 5995],
];

const mergeStateMap = {
  clean: "CLEAN",
  dirty: "DIRTY",
  unknown: "UNKNOWN",
  unstable: "UNSTABLE",
  behind: "BEHIND",
  blocked: "BLOCKED",
};

const usage = `Usage:
  node tools/star-growth-check.mjs check [--output FILE]
  node tools/star-growth-check.mjs daily [--output FILE]
  node tools/star-growth-check.mjs evidence [--output FILE]
  node tools/star-growth-check.mjs summary [--output FILE]
  node tools/star-growth-check.mjs campaign --output FILE [--daily-output FILE] [--check-output FILE]`;

function parseArgs() {
  const args = process.argv.slice(2);
  const action = args.find((arg) => !arg.startsWith("-")) || "check";
  return {
    action,
    output:
      args.includes("--output") ? args[args.indexOf("--output") + 1] : null,
    checkOutput:
      args.includes("--check-output")
        ? args[args.indexOf("--check-output") + 1]
        : null,
    dailyOutput:
      args.includes("--daily-output")
        ? args[args.indexOf("--daily-output") + 1]
        : null,
    help: args.includes("-h") || args.includes("--help"),
  };
}

function ensureGhAvailable() {
  try {
    execSync("gh --version", { stdio: "ignore" });
  } catch (_err) {
    throw new Error(
      "GitHub CLI (gh) is required. Install and authenticate with gh before running growth commands."
    );
  }
}

function runJson(cmd) {
  const raw = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return JSON.parse(raw);
}

function safeGetJson(cmd) {
  try {
    return { ok: true, data: runJson(cmd) };
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}

function parseDate(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}

function formatLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function safeParseMetric(lines, ...metricNames) {
  if (!lines) {
    return null;
  }
  for (const metricName of metricNames) {
    const dashRegex = new RegExp(
      `-\\s*${metricName}\\s*:\\s*(\\d+)(?:\\s*\\([^)]*\\))?`,
      "i"
    );
    const tableRegex = new RegExp(
      `\\|\\s*${metricName}\\s*\\|\\s*(\\d+)(?:\\s*\\([^)]*\\))?\\s*\\|`,
      "i"
    );
    const dashMatch = lines.match(dashRegex);
    if (dashMatch) {
      return Number.parseInt(dashMatch[1], 10);
    }
    const tableMatch = lines.match(tableRegex);
    if (tableMatch) {
      return Number.parseInt(tableMatch[1], 10);
    }
  }
  return null;
}

function readSnapshotMetrics(path) {
  try {
    if (!existsSync(path)) return null;
    const raw = readFileSync(path, "utf8");
    return {
      stars: safeParseMetric(raw, "Stars"),
      forks: safeParseMetric(raw, "Forks"),
      watchers: safeParseMetric(raw, "Subscribers", "Watchers"),
      openIssues: safeParseMetric(raw, "Open issues"),
      openPullRequests: safeParseMetric(raw, "Open pull requests"),
    };
  } catch (_error) {
    return null;
  }
}

function formatDelta(current, previous) {
  if (typeof previous !== "number" || Number.isNaN(previous)) return "";
  const delta = current - previous;
  const prefix = delta > 0 ? "+" : "";
  return ` (${prefix}${delta})`;
}

function addDeltaLine(prefix, label, value, previousValue) {
  return `${prefix} ${label}: ${value}${formatDelta(value, previousValue)}`;
}

function trafficSummary(result, entryKey) {
  if (!result.ok || !result.data || !Number.isFinite(result.data.count)) {
    return null;
  }
  const entries = Array.isArray(result.data[entryKey])
    ? result.data[entryKey]
    : [];
  const dates = entries
    .map((entry) => entry?.timestamp)
    .filter((timestamp) => typeof timestamp === "string")
    .sort();
  return {
    count: result.data.count,
    uniques: Number.isFinite(result.data.uniques) ? result.data.uniques : null,
    through: dates.at(-1)?.slice(0, 10) ?? null,
  };
}

async function getRepoStats() {
  const result = safeGetJson(`gh api repos/${repo}`);
  if (!result.ok) {
    throw new Error(`Failed to fetch repo stats for ${repo}: ${result.error}`);
  }

  const issueCountResult = safeGetJson(
    `gh api "repos/${repo}/issues?state=open&per_page=100"`
  );
  const openItems = issueCountResult.ok ? issueCountResult.data : null;
  const hasOpenItems = Array.isArray(openItems);
  const openPullRequests = hasOpenItems
    ? openItems.filter((item) => item?.pull_request).length
    : null;
  const openIssues = hasOpenItems
    ? openItems.length - (openPullRequests ?? 0)
    : null;
  const views = trafficSummary(
    safeGetJson(`gh api repos/${repo}/traffic/views`),
    "views"
  );
  const clones = trafficSummary(
    safeGetJson(`gh api repos/${repo}/traffic/clones`),
    "clones"
  );

  return {
    stars: result.data.stargazers_count,
    forks: result.data.forks_count,
    watchers: result.data.subscribers_count,
    openIssues:
      openIssues === null ? result.data.open_issues_count : openIssues,
    openPullRequests:
      openPullRequests === null
        ? null
        : openPullRequests,
    updated: parseDate(result.data.updated_at),
    traffic: {
      views,
      clones,
      available: Boolean(views || clones),
    },
  };
}

async function getExternalPrRows() {
  const rows = [];
  for (const [repoName, prNumber] of externalPrs) {
    const pullResult = safeGetJson(
      `gh api repos/${repoName}/pulls/${prNumber}`
    );
    if (!pullResult.ok) {
      rows.push({
        repo: repoName,
        pr: prNumber,
        state: "unknown",
        mergeState: "FETCH_FAILED",
        updated: "N/A",
        comments: "N/A",
      });
      continue;
    }

    rows.push({
      repo: repoName,
      pr: prNumber,
      state: pullResult.data.state,
      mergeState:
        mergeStateMap[pullResult.data.mergeable_state] ?? "UNKNOWN",
      updated: parseDate(pullResult.data.updated_at),
      comments: pullResult.data.comments ?? 0,
    });
  }
  return rows;
}

function renderRepoSection(repoStats, date, prefix, previousStats = null) {
  const lines = [];
  lines.push(addDeltaLine(prefix, "Stars", repoStats.stars, previousStats?.stars));
  lines.push(
    addDeltaLine(
      prefix,
      "Forks",
      repoStats.forks,
      previousStats?.forks
    )
  );
  lines.push(
    addDeltaLine(
      prefix,
      "Subscribers",
      repoStats.watchers,
      previousStats?.watchers
    )
  );
  lines.push(
    addDeltaLine(
      prefix,
      "Open issues (non-PR)",
      repoStats.openIssues,
      previousStats?.openIssues
    )
  );
  if (typeof repoStats.openPullRequests === "number") {
    lines.push(
      addDeltaLine(
        prefix,
        "Open pull requests",
        repoStats.openPullRequests,
        previousStats?.openPullRequests
      )
    );
  }
  const traffic = repoStats.traffic;
  if (traffic?.available) {
    const through = traffic.views?.through ?? traffic.clones?.through ?? "N/A";
    const views = traffic.views
      ? `${traffic.views.count} views / ${traffic.views.uniques ?? "N/A"} uniques`
      : "views unavailable";
    const clones = traffic.clones
      ? `${traffic.clones.count} clones / ${traffic.clones.uniques ?? "N/A"} uniques`
      : "clones unavailable";
    lines.push(
      `${prefix} GitHub traffic snapshot through ${through}: ${views}; ${clones}.`
    );
  }
  lines.push(`${prefix} Last updated: ${repoStats.updated}`);
  lines.push("");
  return lines;
}

function renderPrRowsTable(rows) {
  const lines = [];
  lines.push("| Repository | PR | State | Merge State | Updated | Comments |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const row of rows) {
    const url = `https://github.com/${row.repo}/pull/${row.pr}`;
    lines.push(
      `| [${row.repo}](${url}) | [#${row.pr}](${url}) | ${row.state} | ${row.mergeState} | ${row.updated} | ${row.comments} |`
    );
  }
  return lines;
}

function generateCheckReport(repoStats, rows, date, previousStats = null) {
  const lines = [];
  lines.push(`# Star Growth Check (${date})`);
  lines.push("");
  lines.push("## Repository");
  lines.push(...renderRepoSection(repoStats, date, "-", previousStats));
  lines.push("## External PR Funnel");
  lines.push(...renderPrRowsTable(rows));
  return `${lines.join("\n")}\n`;
}

function generateDailyReport(repoStats, rows, date, previousStats = null) {
  const lines = [];
  lines.push(`# Daily Growth Pack (${date})`);
  lines.push("");
  lines.push("## Public metrics snapshot");
  lines.push("");
  lines.push(...renderRepoSection(repoStats, date, "-", previousStats));
  lines.push("## Post text to publish today");
  lines.push("");
  lines.push("### English");
  lines.push(`Today (${date}):`);
  lines.push("");
  lines.push("I verified Unified AI System in 60 seconds:");
  lines.push("");
  lines.push(demoCommand);
  lines.push("");
  lines.push("No API key is needed for the local enhancement preview.");
  lines.push(`Try the browser Prompt Lab (no install): ${promptLabUrl}`);
  lines.push(`Repo: ${repoUrl}`);
  lines.push(`Share one output line + OS: ${usageReportUrl}`);
  lines.push("");
  lines.push("### 24h Action");
  lines.push("- Ask at least one reviewer to run the command and paste output.");
  lines.push(
    "- Reply to every technical comment in thread within 24 hours."
  );
  lines.push("- Update docs/star-growth-checklist.md after publishing.");
  lines.push("");
  lines.push("## External PR funnel snapshot");
  lines.push(...renderPrRowsTable(rows));
  return `${lines.join("\n")}\n`;
}

function countMergeState(rows, state) {
  return rows.filter((row) => row.mergeState === state).length;
}

function generateSummaryReport(repoStats, rows, date) {
  const clean = countMergeState(rows, "CLEAN");
  const blocked = countMergeState(rows, "BLOCKED");
  const dirty = countMergeState(rows, "DIRTY");
  const unknown = countMergeState(rows, "UNKNOWN");

  const lines = [];
  lines.push(`# Weekly Growth Summary (${date})`);
  lines.push("");
  lines.push("## Repo Metrics");
  lines.push("");
  lines.push(`- Stars: ${repoStats.stars}`);
  lines.push(`- Forks: ${repoStats.forks}`);
  lines.push(`- Subscribers: ${repoStats.watchers}`);
  lines.push(`- Open issues (non-PR): ${repoStats.openIssues}`);
  if (typeof repoStats.openPullRequests === "number") {
    lines.push(`- Open pull requests: ${repoStats.openPullRequests}`);
  }
  if (repoStats.traffic?.available) {
    const through =
      repoStats.traffic.views?.through ?? repoStats.traffic.clones?.through ?? "N/A";
    lines.push(
      `- GitHub traffic snapshot through ${through}: ${repoStats.traffic.views?.count ?? "N/A"} views / ${repoStats.traffic.views?.uniques ?? "N/A"} uniques; ${repoStats.traffic.clones?.count ?? "N/A"} clones / ${repoStats.traffic.clones?.uniques ?? "N/A"} uniques.`
    );
  }
  lines.push("");
  lines.push("## PR Funnel Signals");
  lines.push(`- CLEAN: ${clean}`);
  lines.push(`- BLOCKED: ${blocked}`);
  lines.push(`- DIRTY: ${dirty}`);
  lines.push(`- UNKNOWN: ${unknown}`);
  lines.push(`- Total tracked PRs: ${rows.length}`);
  lines.push("");
  lines.push("## Suggested community post");
  lines.push("");
  lines.push("### English");
  lines.push(
    `Current status: ${repoStats.stars} stars, ${repoStats.forks} forks, ${repoStats.watchers} subscribers.`
  );
  lines.push("I refreshed the growth snapshot and published one reproducible command:");
  lines.push("");
  lines.push("```text");
  lines.push(demoCommand);
  lines.push("");
  lines.push(`Prompt Lab: ${promptLabUrl}`);
  lines.push(`Repo: ${repoUrl}`);
  lines.push(`Usage report: ${usageReportUrl}`);
  lines.push("```");
  return `${lines.join("\n")}\n`;
}

function generateEvidenceReport(repoStats, rows, date, previousStats = null) {
  const lines = [];
  lines.push("# Star Growth Check Report");
  lines.push("");
  lines.push(`Generated: ${date}`);
  const previous = previousStats;
  lines.push("");
  lines.push("## Repository");
  lines.push("| Metric | Value |");
  lines.push("| --- | --- |");
  lines.push(`| Stars | ${repoStats.stars}${formatDelta(repoStats.stars, previous?.stars)} |`);
  lines.push(`| Forks | ${repoStats.forks}${formatDelta(repoStats.forks, previous?.forks)} |`);
  lines.push(`| Subscribers | ${repoStats.watchers}${formatDelta(repoStats.watchers, previous?.watchers)} |`);
  lines.push(`| Open issues (non-PR) | ${repoStats.openIssues}${formatDelta(repoStats.openIssues, previous?.openIssues)} |`);
  if (typeof repoStats.openPullRequests === "number") {
    lines.push(`| Open pull requests | ${repoStats.openPullRequests}${formatDelta(repoStats.openPullRequests, previous?.openPullRequests)} |`);
  }
  if (repoStats.traffic?.available) {
    const through =
      repoStats.traffic.views?.through ?? repoStats.traffic.clones?.through ?? "N/A";
    lines.push(`| GitHub traffic snapshot through | ${through} |`);
    lines.push(
      `| Views / unique viewers | ${repoStats.traffic.views?.count ?? "N/A"} / ${repoStats.traffic.views?.uniques ?? "N/A"} |`
    );
    lines.push(
      `| Clones / unique cloners | ${repoStats.traffic.clones?.count ?? "N/A"} / ${repoStats.traffic.clones?.uniques ?? "N/A"} |`
    );
  }
  lines.push(`| Last updated | ${repoStats.updated} |`);
  lines.push("");
  lines.push("## External PR Funnel");
  lines.push(...renderPrRowsTable(rows));
  return `${lines.join("\n")}\n`;
}

async function run() {
  const options = parseArgs();
  if (options.help) {
    console.log(usage);
    return;
  }

  const action =
    options.action === "status" ? "check" : options.action;
  const date = formatLocalDate();

  if (!["check", "daily", "evidence", "summary", "campaign"].includes(action)) {
    console.error(`Unsupported growth action: ${action}`);
    console.error(usage);
    process.exit(1);
  }

  ensureGhAvailable();
  const repoStats = await getRepoStats();
  const rows = await getExternalPrRows();

  const previous = readSnapshotMetrics("docs/star-growth-latest.md");

  if (action === "check") {
    const report = generateCheckReport(repoStats, rows, date, previous);
    if (options.output) writeFileSync(options.output, report, "utf8");
    console.log(report);
    return;
  }

  if (action === "daily") {
    if (!options.output) throw new Error("daily action requires --output path");
    const report = generateDailyReport(repoStats, rows, date, previous);
    writeFileSync(options.output, report, "utf8");
    console.log(report);
    return;
  }

  if (action === "evidence") {
    if (!options.output) throw new Error("evidence action requires --output path");
    const report = generateEvidenceReport(repoStats, rows, date, previous);
    writeFileSync(options.output, report, "utf8");
    console.log(report);
    return;
  }

  if (action === "summary") {
    const report = generateSummaryReport(repoStats, rows, date);
    if (options.output) writeFileSync(options.output, report, "utf8");
    console.log(report);
    return;
  }

  const evidenceOutput = options.output ?? "docs/star-growth-latest.md";
  const dailyOutput = options.dailyOutput ?? "docs/star-growth-daily.md";
  const checkOutput = options.checkOutput ?? null;

  writeFileSync(evidenceOutput, generateEvidenceReport(repoStats, rows, date, previous), "utf8");
  writeFileSync(dailyOutput, generateDailyReport(repoStats, rows, date, previous), "utf8");
  if (checkOutput) {
    writeFileSync(checkOutput, generateCheckReport(repoStats, rows, date, previous), "utf8");
  }

  const updatedFiles = [
    evidenceOutput,
    dailyOutput,
    checkOutput ?? "stdout",
  ];
  console.log(`Growth campaign completed. Updated: ${updatedFiles.join(", ")}`);
  console.log(generateDailyReport(repoStats, rows, date, previous));
}

run().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
