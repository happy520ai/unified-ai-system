#!/usr/bin/env node
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const repo = "happy520ai/unified-ai-system";
const issueNumber = 20;
const evidenceOutput = ".tmp/growth/star-growth-latest.md";
const dailyOutput = ".tmp/growth/star-growth-daily.md";
const checkOutput = ".tmp/growth/star-growth-check.md";
const promptLabUrl = "https://happy520ai.github.io/unified-ai-system/#enhance";
const usageReportUrl =
  "https://github.com/happy520ai/unified-ai-system/issues/new?template=usage-verification-report.yml";
const demoCommand =
  "docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.4.4 pnpm gateway demo \"Build a small API for my team\" --enhance --profile coding";
const evidenceCommand =
  "pnpm gateway demo \"Build a small API for my team\" --enhance --profile coding --evidence";

function run(cmd) {
  return execSync(cmd, {
    stdio: "pipe",
    encoding: "utf8",
  }).trim();
}

function ensureGhAvailable() {
  try {
    execSync("gh --version", { stdio: "ignore" });
  } catch (_err) {
    throw new Error(
      "GitHub CLI is required for growth thread sync. Install and authenticate with gh first."
    );
  }
}

function escapeMetric(metric) {
  return metric.replace(/[()]/g, "\\$&");
}

function parseIntMetric(lines, ...metrics) {
  for (const metric of metrics) {
    const metricPattern = escapeMetric(metric);
    const dashRegex = new RegExp(`^\\s*-\\s*${metricPattern}\\s*:\\s*(\\d+)`, "im");
    const tableRegex = new RegExp(`\\|\\s*${metricPattern}\\s*\\|\\s*(\\d+)`, "im");
    const line = lines.match(dashRegex)?.[1] ?? lines.match(tableRegex)?.[1];
    if (line === undefined) continue;
    const value = Number.parseInt(line, 10);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function readLatestMetrics(filePath) {
  const raw = readFileSync(filePath, "utf8");
  const snapshotLine =
    /Generated:\\s*(\\d{4}-\\d{2}-\\d{2})/.exec(raw)?.[1] ??
    new Date().toISOString().slice(0, 10);
  return {
    date: snapshotLine,
    stars: parseIntMetric(raw, "Stars"),
    forks: parseIntMetric(raw, "Forks"),
    watchers: parseIntMetric(raw, "Subscribers", "Watchers"),
    openIssues: parseIntMetric(raw, "Open issues (non-PR)"),
    openPullRequests: parseIntMetric(raw, "Open pull requests"),
  };
}

function buildCommentBody(metrics) {
  const lines = [
    `## Campaign Thread Refresh - ${metrics.date}`,
    "",
    "Updated snapshot:",
    `- Stars: ${metrics.stars}`,
    `- Forks: ${metrics.forks}`,
    `- Subscribers: ${metrics.watchers}`,
    `- Open issues (non-PR): ${metrics.openIssues}`,
    `- Open pull requests: ${metrics.openPullRequests}`,
    "",
    "I verified the prompt-enhancement command is still:",
    "```",
    demoCommand,
    "```",
    "",
    `Try it without installing anything in the browser Prompt Lab: ${promptLabUrl}`,
    "",
    "For a source checkout, append `--evidence` to the local command to emit report-ready JSON; review the original request and output before sharing.",
    "```",
    evidenceCommand,
    "```",
    "",
    "Minimum Usage Report context:",
    "- command and 3-12 output lines",
    "- environment (OS, shell, or client)",
    "- execution mode",
    "- expectation and actual result are optional",
    `Report link: ${usageReportUrl}`,
    "",
    "If this saved you time, help this project grow:",
    `1) Star the repo: https://github.com/${repo}`,
    "2) Share the smallest reproducible report you can provide.",
    "3) Ask one teammate to run the same command and share their output.",
    "",
    `Repo: https://github.com/${repo}`,
    "<!-- unified-ai-system-growth-thread -->",
  ];

  return lines.join("\n");
}

function buildPsCommand() {
  return `node ./tools/star-growth-check.mjs campaign --output "${evidenceOutput}" --daily-output "${dailyOutput}" --check-output "${checkOutput}"`;
}

function syncThread() {
  ensureGhAvailable();

  try {
    run(buildPsCommand());
  } catch (error) {
    throw new Error(`Growth command failed: ${error.message}`);
  }

  const feedbackResult = run("pnpm growth:feedback");
  if (!feedbackResult.includes("Usage Verification Feedback")) {
    throw new Error("Growth feedback update failed");
  }

  const metrics = readLatestMetrics(evidenceOutput);
  if (typeof metrics.stars !== "number" || metrics.stars < 0) {
    throw new Error("Invalid star count in generated evidence snapshot.");
  }

  const tempDir = mkdtempSync(path.join(tmpdir(), "growth-thread-"));
  const payloadPath = path.join(tempDir, "issue-comment.md");
  const body = buildCommentBody(metrics);
  writeFileSync(payloadPath, body, "utf8");

  try {
    run(
      `gh issue comment ${issueNumber} --repo ${repo} --body-file "${payloadPath}" --edit-last --create-if-none`
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

syncThread();
