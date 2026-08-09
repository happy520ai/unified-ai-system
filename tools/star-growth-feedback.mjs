#!/usr/bin/env node
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const repo = "happy520ai/unified-ai-system";
const reportLabel = "community-feedback";
const maintainerLogins = new Set(["happy520ai"]);
const issuesCommand = `gh issue list --repo ${repo} --label ${reportLabel} --state all --json number,title,state,url,createdAt,body,author,closedAt`;
const today = new Date().toISOString().slice(0, 10);

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    help: args.includes("-h") || args.includes("--help"),
    output: args.includes("--output")
      ? args[args.indexOf("--output") + 1]
      : ".tmp/growth/star-growth-feedback.md",
    top: (() => {
      const index = args.indexOf("--top");
      if (index < 0) {
        return 10;
      }
      const value = Number.parseInt(args[index + 1], 10);
      return Number.isFinite(value) ? value : 10;
    })(),
  };
}

function ensureGhAvailable() {
  try {
    execSync("gh --version", { stdio: "ignore" });
  } catch (_err) {
    throw new Error(
      "GitHub CLI (gh) is required. Install and authenticate with gh before running growth feedback commands."
    );
  }
}

function runJson(command) {
  const output = execSync(command, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(output);
}

function safeGetJson(command) {
  try {
    return { ok: true, data: runJson(command) };
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error) };
  }
}

function escapeForMarkdown(value) {
  return String(value ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|")
    .slice(0, 160);
}

function extractField(text, label) {
  if (!text) {
    return "";
  }
  const pattern = new RegExp(
    `###\\s*${label}\\s*\\r?\\n([\\s\\S]*?)(?=\\r?\\n###\\s+|\\r?\\n\\*\\*\\*|\\r?\\n##\\s+|$)`,
    "i"
  );
  const match = text.match(pattern);
  if (!match) {
    return "";
  }
  return match[1]
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 220);
}

function normalizeBoolean(value) {
  return value === undefined || value === null ? "N/A" : String(value);
}

function loadIssueSummary(issue) {
  const body = issue.body ?? "";
  return {
    environment: extractField(body, "Environment"),
    mode: extractField(body, "Execution mode"),
    commandPreview: normalizeBoolean(extractField(body, "Command run")),
  };
}

async function run() {
  const options = parseArgs();
  if (options.help) {
    console.log(
      "Usage: node tools/star-growth-feedback.mjs --output <file> [--top N]"
    );
    return;
  }

  ensureGhAvailable();

  const result = safeGetJson(issuesCommand);
  if (!result.ok) {
    throw new Error(`Failed to fetch feedback issues: ${result.error}`);
  }

  const issues = Array.isArray(result.data) ? result.data : [];
  const maintainerIssues = issues.filter((issue) =>
    maintainerLogins.has(issue.author?.login)
  );
  const communityIssues = issues.filter(
    (issue) => !maintainerLogins.has(issue.author?.login)
  );
  const openCount = issues.filter((issue) => issue.state === "open").length;
  const closedCount = issues.filter((issue) => issue.state === "closed").length;
  const sortedIssues = [...issues].sort((a, b) => {
    const left = new Date(a.createdAt || 0).getTime();
    const right = new Date(b.createdAt || 0).getTime();
    return right - left;
  });
  const topIssues = sortedIssues.slice(0, options.top);
  const lines = [];

  lines.push(`# Usage Verification Feedback (${today})`);
  lines.push("");
  lines.push("## Report Snapshot");
  lines.push(`- Total submitted reports: ${issues.length}`);
  lines.push(`- Community reports: ${communityIssues.length}`);
  lines.push(`- Maintainer verification reports: ${maintainerIssues.length}`);
  lines.push(`- Open: ${openCount}`);
  lines.push(`- Closed: ${closedCount}`);
  lines.push(
    "- Community counts exclude reports submitted by the repository maintainer."
  );
  lines.push("");

  if (topIssues.length === 0) {
    lines.push("No usage verification reports found yet.");
    lines.push("Share this template link to collect public evidence:");
    lines.push(
      "- https://github.com/happy520ai/unified-ai-system/issues/new?template=usage-verification-report.yml"
    );
  } else {
    lines.push("## Latest Reports");
    lines.push("");
    lines.push(
      "| Date | Source | Reporter | Mode | Command | Environment | Issue |"
    );
    lines.push("| --- | --- | --- | --- | --- | --- | --- |");
    for (const issue of topIssues) {
      const summary = loadIssueSummary(issue);
      const issueDate = issue.createdAt?.slice(0, 10) ?? "N/A";
      const reporter = issue.author?.login ?? "unknown";
      const source = maintainerLogins.has(reporter)
        ? "maintainer"
        : "community";
      const command = escapeForMarkdown(
        summary.commandPreview || "command not provided"
      );
      const environment = escapeForMarkdown(
        summary.environment || "environment not provided"
      );
      lines.push(
        `| ${issueDate} | ${source} | @${reporter} | ${escapeForMarkdown(summary.mode || "N/A")} | ${command} | ${environment} | [#${issue.number}](${issue.url}) |`
      );
    }
    lines.push("");
    lines.push(
      `Latest source: ${topIssues.length} recent reports shown from the latest data pull.`
    );
  }

  lines.push("");
  lines.push(
    "Update frequency: run `pnpm growth:feedback` or `pnpm growth:campaign` after collecting community replies."
  );

  const markdown = `${lines.join("\n")}\n`;
  mkdirSync(dirname(options.output), { recursive: true });
  writeFileSync(options.output, markdown, "utf8");
  console.log(markdown);
}

run().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
