#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const repo = "happy520ai/unified-ai-system";
const latestFile = "docs/star-growth-latest.md";
const feedbackFile = "docs/star-growth-feedback.md";
const evidencePackFile = "docs/star-growth-evidence-pack.md";
const today = new Date().toISOString().slice(0, 10);

const issueCommand = `gh issue list --repo ${repo} --label community-feedback --state all --json number,state`;

function ensureGhAvailable() {
  try {
    execSync("gh --version", { stdio: "ignore" });
  } catch (_err) {
    throw new Error(
      "GitHub CLI (gh) is required. Install and authenticate with gh before running growth evidence pack."
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

function parseMetric(raw, metricName) {
  const re = new RegExp(
    `\\|\\s*${metricName.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\s*\\|\\s*(\\d+)`,
    "i"
  );
  const match = raw ? raw.match(re) : null;
  if (match) return Number.parseInt(match[1], 10);

  const dashRe = new RegExp(
    `-\\s*${metricName}\\s*:\\s*(\\d+)`,
    "i"
  );
  const dashMatch = raw ? raw.match(dashRe) : null;
  return dashMatch ? Number.parseInt(dashMatch[1], 10) : null;
}

function parseSnapshot(raw) {
  return {
    stars: parseMetric(raw, "Stars"),
    forks: parseMetric(raw, "Forks"),
    watchers: parseMetric(raw, "Watchers"),
    openIssues: parseMetric(raw, "Open issues (non-PR)"),
    openPullRequests: parseMetric(raw, "Open pull requests"),
  };
}

function parseFeedbackSummary(raw) {
  if (!raw) return { total: 0, open: 0, closed: 0 };
  const totalMatch = raw.match(/- Total feedback reports:\s*(\d+)/i);
  const openMatch = raw.match(/- Open:\s*(\d+)/i);
  const closedMatch = raw.match(/- Closed:\s*(\d+)/i);
  return {
    total: totalMatch ? Number.parseInt(totalMatch[1], 10) : 0,
    open: openMatch ? Number.parseInt(openMatch[1], 10) : 0,
    closed: closedMatch ? Number.parseInt(closedMatch[1], 10) : 0,
  };
}

function replaceSignalLines(lines, metrics) {
  const replacements = [
    `- Stars: ${metrics.stars}`,
    `- Forks: ${metrics.forks}`,
    `- Watchers: ${metrics.watchers}`,
    `- Open issues (non-PR): ${metrics.openIssues}`,
    `- Open pull requests: ${metrics.openPullRequests}`,
  ];

  return lines.map((line) => {
    if (line.startsWith("- Stars:")) return replacements[0];
    if (line.startsWith("- Forks:")) return replacements[1];
    if (line.startsWith("- Watchers:")) return replacements[2];
    if (line.startsWith("- Open issues (non-PR):")) return replacements[3];
    if (line.startsWith("- Open pull requests:")) return replacements[4];
    return line;
  });
}

function appendLogSection(lines, snapshot, feedbackSummary, issueSummary, prSummaryText) {
  const marker = "## Weekly Status Log";
  const markerIndex = lines.findIndex((line) => line === marker);
  if (markerIndex === -1) {
    return lines.join("\n") + `\n\n${buildSection(snapshot, feedbackSummary, issueSummary, prSummaryText)}`;
  }

  const existingDateEntry = lines.findIndex(
    (line) => line.trim() === `### ${today}`
  );
  if (existingDateEntry > markerIndex) {
    return lines.join("\n");
  }

  const section = [
    "",
    `### ${today}`,
    "",
    "- Repository: https://github.com/happy520ai/unified-ai-system",
    `- Snapshot: ${snapshot.stars} stars / ${snapshot.forks} forks / ${snapshot.watchers} watchers / ${snapshot.openIssues} open issues (non-PR) / ${snapshot.openPullRequests} open PRs`,
    `- Community reports: ${feedbackSummary.total} total, ${feedbackSummary.open} open, ${feedbackSummary.closed} closed`,
    `- Verified reports source: ${issueSummary.total} total + ${issueSummary.open} open + ${issueSummary.closed} closed`,
    "- Evidence action taken:",
    "  - Refreshed growth check, feedback, and daily draft files.",
    `- PR funnel state: ${prSummaryText}`,
  ].join("\n");

  const output = [
    ...lines,
    "",
    section,
  ].join("\n");
  return output;
}

function countPrStatesFromLatest(raw, state) {
  const escaped = state.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&");
  const re = new RegExp(`\\|[^|]*\\|[^|]*\\|[^|]*\\|\\s*${escaped}\\s*\\|`, "gi");
  const matches = raw ? raw.match(re) : null;
  return matches ? matches.length : 0;
}

function buildPrSummary(latestRaw) {
  if (!latestRaw) return "no data";
  const clean = countPrStatesFromLatest(latestRaw, "CLEAN");
  const blocked = countPrStatesFromLatest(latestRaw, "BLOCKED");
  const dirty = countPrStatesFromLatest(latestRaw, "DIRTY");
  const unknown = countPrStatesFromLatest(latestRaw, "UNKNOWN");
  return `CLEAN ${clean}, BLOCKED ${blocked}, DIRTY ${dirty}, UNKNOWN ${unknown}`;
}

function buildSection(snapshot, feedbackSummary, issueSummary, prSummaryText) {
  return [
    `### ${today}`,
    "",
    `- Repository: https://github.com/happy520ai/unified-ai-system`,
    `- Snapshot: ${snapshot.stars} stars / ${snapshot.forks} forks / ${snapshot.watchers} watchers / ${snapshot.openIssues} open issues (non-PR) / ${snapshot.openPullRequests} open PRs`,
    `- Community reports: ${feedbackSummary.total} total, ${feedbackSummary.open} open, ${feedbackSummary.closed} closed`,
    `- GitHub community-feedback label: ${issueSummary.total} total / ${issueSummary.open} open / ${issueSummary.closed} closed`,
    `- PR funnel state: ${prSummaryText}`,
    "- Next action: publish one short bilingual growth snippet and collect one response.",
  ].join("\n");
}

async function run() {
  ensureGhAvailable();

  let latestRaw = "";
  if (existsSync(latestFile)) {
    latestRaw = readFileSync(latestFile, "utf8");
  }

  let feedbackRaw = "";
  if (existsSync(feedbackFile)) {
    feedbackRaw = readFileSync(feedbackFile, "utf8");
  }

  const snapshot = parseSnapshot(latestRaw);
  const feedbackSummary = parseFeedbackSummary(feedbackRaw);
  const issueResult = safeGetJson(issueCommand);
  const issues = issueResult.ok ? issueResult.data : [];
  const issueSummary = {
    total: issues.length,
    open: issues.filter((issue) => issue?.state === "open").length,
    closed: issues.filter((issue) => issue?.state === "closed").length,
  };

  const prSummaryText = buildPrSummary(latestRaw);

  if (!existsSync(evidencePackFile)) {
    throw new Error(`Evidence pack not found: ${evidencePackFile}`);
  }

  const current = readFileSync(evidencePackFile, "utf8");
  const lines = current.split(/\r?\n/);
  const updatedSignalLines = replaceSignalLines(lines);

  // keep a single-source "Current Snapshot date"
  const snapshotDateLine = `- Snapshot date: ${today}`;
  const withDate = updatedSignalLines.map((line) => {
    if (line.startsWith("- Snapshot date:")) {
      return snapshotDateLine;
    }
    return line;
  });

  const withLog = appendLogSection(withDate, snapshot, feedbackSummary, issueSummary, prSummaryText);

  const finalDoc = `${withLog.replace(/\s+$/g, "")}\n`;
  writeFileSync(evidencePackFile, finalDoc, "utf8");
  console.log(`Updated evidence pack: ${evidencePackFile}`);
  console.log(`Date: ${today}`);
  console.log(
    `Snapshot: stars=${snapshot.stars}, forks=${snapshot.forks}, watchers=${snapshot.watchers}`
  );
}

run().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
