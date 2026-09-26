#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gatewayImage } from "./release-metadata.mjs";

const repo = "happy520ai/unified-ai-system";
const repoUrl = "https://github.com/happy520ai/unified-ai-system";
const promptLabUrl = "https://happy520ai.github.io/unified-ai-system/#enhance";
const usageReportUrl =
  "https://github.com/happy520ai/unified-ai-system/issues/new?template=usage-verification-report.yml";
const demoCommand =
  `docker run --rm ${gatewayImage} pnpm gateway demo "Build a small API for my team" --enhance --profile coding --evidence`;
const pipeCommand =
  "cat request.txt | pnpm gateway enhance --profile auto --json";
const dockerPipeCommand =
  `printf '%s' "Plan a launch for a small API" | docker run --rm -i ${gatewayImage} pnpm --silent gateway demo --enhance --profile planning --language en --json`;
const defaultGrowthOutputDir = ".tmp/growth";
const defaultLatestSnapshotFile = `${defaultGrowthOutputDir}/star-growth-latest.md`;

function writeReport(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf8");
}

const externalPrs = [
  ["sickn33/agentic-awesome-skills", 1125],
  ["composio-community/awesome-codex-skills", 206],
  ["neon-solutions/add-mcp", 92],
  ["toolleeo/awesome-cli-apps-in-a-csv", 347],
  ["tensorchord/Awesome-LLMOps", 710],
  ["punkpeye/awesome-mcp-devtools", 257],
  ["WagnerAgent/awesome-mcp-servers-devops", 65],
  ["yzfly/Awesome-MCP-ZH", 442],
  ["punkpeye/awesome-mcp-servers", 11745],
  ["hashgraph-online/awesome-codex-plugins", 446],
  ["TensorBlock/awesome-mcp-servers", 2707],
  ["ai-boost/awesome-a2a", 177],
  ["mahseema/awesome-ai-tools", 1941],
  ["docker/mcp-registry", 4584],
  ["up-for-grabs/up-for-grabs.net", 5995],
  ["frechdi/awesome-self-hosted-ai", 7],
  ["agentskillexchange/skills", 34],
  ["toolsdk-ai/toolsdk-mcp-registry", 434],
  ["cuihuan/awesome-ai-gateway", 48],
  // Currently open doors, added 2026-09-25. The entries above are kept on purpose:
  // the report labels each by state, so merged/closed rows stay as funnel history.
  ["punkpeye/awesome-mcp-servers", 12218],
  ["e2b-dev/awesome-ai-agents", 1401],
  ["Hannibal046/Awesome-LLM", 786],
  ["mikeroyal/Self-Hosting-Guide", 385],
  ["up-for-grabs/up-for-grabs.net", 6176],
  ["toolsdk-ai/toolsdk-mcp-registry", 552],
  ["slavakurilyak/awesome-ai-agents", 583],
  ["caramaschiHG/awesome-ai-agents-2026", 612],
  ["ottosulin/awesome-ai-security", 482],
  ["rafska/awesome-local-llm", 235],
  ["scadastrangelove/awesome-ai-security-tools", 131],
  ["Jenqyang/Awesome-AI-Agents", 521],
];

// Submission doors that are ISSUES, not pull requests: directory sites that take a
// "submit your server" ticket and merge on your behalf. A pull-request-only denominator
// cannot see these, and one of them (chatmcp/mcpso#3394) carried a stale tool count in
// its own title for weeks because no arm read an issue body.
const externalIssues = [
  ["chatmcp/mcpso", 3394],
  ["521xueweihan/HelloGitHub", 3506],
  ["cline/mcp-marketplace", 2165],
  ["InftyAI/Awesome-LLMOps", 507],
  ["LuciferForge/mcp-directory", 38],
  ["cuihuan/awesome-ai-gateway", 102],
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

// Some of the biggest lists carry multi-megabyte READMEs: the Contents API answers
// them with metadata and no `content`, and execSync's 1 MB default buffer would
// swallow the raw media type. Both are read through here.
function runText(cmd) {
  return execSync(cmd, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 32 * 1024 * 1024,
  });
}

function safeGetText(cmd) {
  try {
    const text = runText(cmd);
    return { ok: true, data: typeof text === "string" ? text : "" };
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}

function parseDate(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}

function formatReportDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
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

// PR state alone under-counts success: a maintainer can accept an entry by hand and
// close the branch, which reads as a lost door. The upstream README is the second
// instrument. Three-valued on purpose - "could not read" must never be reported as
// "not listed".
const LISTING_PATTERN = /unified-ai-system|Unified AI System/i;

export function isListedInReadme(content) {
  if (typeof content !== "string" || content.trim().length === 0) return "unreadable";
  return LISTING_PATTERN.test(content) ? "listed" : "absent";
}

// The roster count is what an upstream row should agree with. Derived here rather
// than written down, because a number someone typed is exactly how "nine governed
// MCP tools" survived two listing rounds.
const ROSTER_SOURCE = "packages/mcp-server/src/server.js";
const ROSTER_MARKER = "MCP_TOOL_NAMES = Object.freeze([";

export function publishedToolCount(source) {
  const start = source.indexOf(ROSTER_MARKER);
  if (start < 0) return null;
  const open = source.indexOf("[", start);
  let depth = 0;
  for (let i = open; i >= 0 && i < source.length; i += 1) {
    if (source[i] === "[") depth += 1;
    else if (source[i] === "]") {
      depth -= 1;
      if (depth === 0) {
        return [...source.slice(open + 1, i).matchAll(/"([a-z0-9_]+)"/g)].length;
      }
    }
  }
  return null;
}

const COUNT_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20,
};

// Finds every "N tools" / "N governed MCP tools" claim in a row and returns the ones
// that disagree with the roster. A row with no count claim returns [] - most do not.
export function staleToolCounts(text, current) {
  if (typeof text !== "string" || typeof current !== "number" || current < 1) return [];
  const found = [];
  for (const match of text.matchAll(/\b(\d{1,3}|[a-z]+)\s+(?:governed\s+)?(?:MCP\s+)?tools?\b/gi)) {
    const token = match[1];
    const value = /^\d+$/.test(token) ? Number(token) : COUNT_WORDS[token.toLowerCase()];
    if (typeof value === "number" && value !== current) {
      found.push({ reported: value, expected: current, phrase: match[0] });
    }
  }
  return found;
}

function readRosterCount() {
  try {
    const sourcePath = resolve(dirname(fileURLToPath(import.meta.url)), "..", ROSTER_SOURCE);
    return publishedToolCount(readFileSync(sourcePath, "utf8"));
  } catch (_error) {
    return null;
  }
}

// Records, not instructions: these doors state an old tool count on purpose, and each
// entry says why. The report prints how many exclusions are in force so the list cannot
// quietly become the place stale numbers hide.
export const OUR_COPY_STALE_ALLOWED = [
  { door: "TensorBlock/awesome-mcp-servers#2707", phrase: "nine tools", reason: "PR title records the defect this branch fixed, past tense" },
  { door: "cuihuan/awesome-ai-gateway#102", phrase: "nine governed MCP tools", reason: "correction request quoting the maintainer's stale row verbatim" },
];

// A directory site republishes the title and body we hand it, so a stale number in our
// own submission copy becomes someone else's catalogue entry. chatmcp/mcpso#3394 carried
// "9 governed MCP tools" in its title for weeks and no arm looked at an issue body,
// because every door was assumed to be a pull request.
// Returns null when the roster is unreadable: a blind comparison must not print as clean.
export function staleOwnClaimLines(rows, rosterCount, allowed = OUR_COPY_STALE_ALLOWED) {
  if (rosterCount === null) return null;
  const out = [];
  for (const row of rows ?? []) {
    if (!row?.claimText) continue;
    const door = `${row.repo}#${row.pr}`;
    for (const claim of staleToolCounts(row.claimText, rosterCount)) {
      if ((allowed ?? []).some((item) => item.door === door && claim.phrase.includes(item.phrase))) continue;
      out.push(`${door} (${row.kind ?? "pr"}) says "${claim.phrase}" while the roster has ${claim.expected}`);
    }
  }
  return out;
}

// Lists that refuse us for a reason that changes: a stated numeric bar we have not
// reached yet. Recording the bar here means the report says "you may file now" when
// it flips, instead of relying on someone remembering the rule exists.
const deferredDoors = [
  {
    repo: "e2b-dev/awesome-mcp-gateways",
    requiresStars: 200,
    requiresHumanContributors: 2,
    note: "Open-source section requires 200 stars and 2 contributors; entries are one-line gateway descriptions.",
  },
];

export function deferredDoorStatus(deferred, stars, humanContributors) {
  return (deferred ?? []).map((door) => ({
    repo: door.repo,
    ready: stars >= door.requiresStars && humanContributors >= door.requiresHumanContributors,
    starsNeeded: Math.max(0, door.requiresStars - stars),
    contributorsNeeded: Math.max(0, door.requiresHumanContributors - humanContributors),
    note: door.note,
  }));
}

// Dependabot and other bots are listed as contributors by the API but are not the
// "2 contributors" a curator means, so they are excluded rather than counted.
export function countHumanContributors(contributors) {
  return (contributors ?? []).filter((entry) => entry?.type !== "Bot" && !String(entry?.login ?? "").endsWith("[bot]")).length;
}

// One classification per repository per run. Several lists appear twice in the door
// table (two PRs into the same list), and two independent probes of the same README
// can disagree, which produced a report where one row of a repo said "data file"
// and its sibling said "not found".
const listingProbeCache = new Map();

function probeListing(repoName) {
  if (listingProbeCache.has(repoName)) return listingProbeCache.get(repoName);

  const readmeResult = safeGetText(
    `gh api -H "Accept: application/vnd.github.raw+json" repos/${repoName}/readme`
  );
  const readmeState = readmeResult.ok
    ? isListedInReadme(readmeResult.data)
    : "unreadable";
  const rows = readmeResult.ok
    ? String(readmeResult.data)
      .split(/\r?\n/)
      .filter((line) => /unified-ai-system|Unified AI System/i.test(line))
      .join(" | ")
    : "";
  const result = {
    inReadme: readmeState,
    listing: readmeState === "listed" ? "readme" : readmeState,
    rowText: rows,
  };
  listingProbeCache.set(repoName, result);
  return result;
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
        kind: "pr",
        state: "unknown",
        mergeState: "FETCH_FAILED",
        updated: "N/A",
        comments: "N/A",
        inReadme: "unreadable",
        listing: "unreadable",
      });
      continue;
    }

    const listing = probeListing(repoName);
    rows.push({
      repo: repoName,
      pr: prNumber,
      kind: "pr",
      title: pullResult.data.title ?? "Untitled pull request",
      state: pullResult.data.merged_at ? "merged" : pullResult.data.state,
      mergeState:
        pullResult.data.merged_at
          ? "MERGED"
          : mergeStateMap[pullResult.data.mergeable_state] ?? "UNKNOWN",
      updated: parseDate(pullResult.data.updated_at),
      comments: pullResult.data.comments ?? 0,
      inReadme: listing.inReadme,
      listing: listing.listing,
      rowText: listing.rowText,
      claimText: String(pullResult.data.title ?? ""),
    });
  }
  return rows;
}

// Issue doors are read through the issues endpoint: the pulls endpoint 404s on them, and
// a 404 would have been reported as "FETCH_FAILED" rather than as what it is - a door of
// a kind this instrument did not model.
async function getExternalIssueRows() {
  const rows = [];
  for (const [repoName, issueNumber] of externalIssues) {
    const issueResult = safeGetJson(
      `gh api repos/${repoName}/issues/${issueNumber}`
    );
    if (!issueResult.ok) {
      rows.push({
        repo: repoName,
        pr: issueNumber,
        kind: "issue",
        state: "unknown",
        mergeState: "FETCH_FAILED",
        updated: "N/A",
        comments: "N/A",
        inReadme: "n/a",
        listing: "n/a",
        claimText: "",
      });
      continue;
    }
    const data = issueResult.data;
    rows.push({
      repo: repoName,
      pr: issueNumber,
      kind: "issue",
      title: data.title ?? "Untitled submission",
      state: data.state,
      // An issue has no merge state; the listing is decided by whoever runs the site.
      mergeState: data.state === "open" ? "AWAITING-HAND" : "CLOSED",
      updated: parseDate(data.updated_at),
      comments: data.comments ?? 0,
      inReadme: "n/a",
      listing: "n/a",
      // Our own submission copy: title plus body, because that is the text a directory
      // site republishes verbatim.
      claimText: `${String(data.title ?? "")}\n${String(data.body ?? "")}`,
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

// A door whose branch fell behind a fast-moving list stops being mergeable, and a
// maintainer skips it rather than resolving the conflict. Only OPEN doors need action:
// a closed DIRTY row is a dead door, and BLOCKED/UNSTABLE mean "a human is still needed",
// which is not something a re-carry fixes.
// "None of your doors needs a re-carry" is only worth reading if the door list is
// every door. Compare it against what GitHub actually has open, and name the gap.
// The denominator is every open thing we authored - pull requests AND submission
// issues - because directory sites that merge on our behalf open tickets, not PRs.
export function findUntrackedDoors(tracked, openItems, selfRepo) {
  const keys = new Set((tracked ?? []).map((row) => `${row?.repo}#${row?.pr}`));
  return (openItems ?? [])
    .filter((item) => {
      const repo = String(item?.repository_url ?? "").replace("https://api.github.com/repos/", "");
      // A private-vulnerability fork (owner/repo-ghsa-xxxx) is a security workflow
      // artifact, not a promotion door; listing one would put advisory traffic in a
      // growth report.
      return repo && repo !== selfRepo && !/-ghsa-/i.test(repo);
    })
    .map((item) => ({
      repo: String(item.repository_url).replace("https://api.github.com/repos/", ""),
      pr: item.number,
      kind: item.pull_request ? "pr" : "issue",
      title: String(item.title ?? "").slice(0, 60),
    }))
    .filter((door) => !keys.has(`${door.repo}#${door.pr}`));
}

export function needsRecarry(rows) {
  const actionable = new Set(["DIRTY", "BEHIND"]);
  const unreadable = new Set(["FETCH_FAILED"]);
  const out = [];
  for (const row of rows ?? []) {
    if (row?.state !== "open") continue;
    if (actionable.has(row.mergeState)) {
      out.push({ kind: "RE-CARRY", repo: row.repo, pr: row.pr, mergeState: row.mergeState });
    } else if (unreadable.has(row.mergeState)) {
      out.push({ kind: "UNREADABLE", repo: row.repo, pr: row.pr, mergeState: row.mergeState });
    }
  }
  return out;
}

function renderPrRowsTable(rows) {
  const lines = [];
  lines.push("| Repository | PR | Listing | State | Merge State | Listed in | Updated | Comments |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const row of rows) {
    const url = `https://github.com/${row.repo}/${row.kind === "issue" ? "issues" : "pull"}/${row.pr}`;
    const title = String(row.title ?? "Unavailable").replaceAll("|", "\\|");
    lines.push(
      `| [${row.repo}](${url}) | [#${row.pr}](${url}) | ${title} | ${row.state} | ${row.mergeState} | ${row.listing ?? "unreadable"} | ${row.updated} | ${row.comments} |`
    );
  }
  return lines;
}

// Three readings plus a fourth that must never be folded into blindness: a submission
// ticket has no upstream README to read, so "n/a" is not "we failed to look". Conflating
// them makes the blind count track how many issue doors we last added, which is a number
// about our own bookkeeping rather than about the world.
export function countListingKinds(rows) {
  const tally = { readme: 0, absent: 0, unreadable: 0, notApplicable: 0 };
  for (const row of rows ?? []) {
    if (row?.listing === "readme") tally.readme += 1;
    else if (row?.listing === "absent") tally.absent += 1;
    else if (row?.listing === "n/a") tally.notApplicable += 1;
    else tally.unreadable += 1;
  }
  return tally;
}

// Named, because an aggregate that cannot be pointed at cannot be diagnosed.
export function unreadableCarriers(rows) {
  return [...new Set(
    (rows ?? [])
      .filter((row) => row?.listing !== "readme" && row?.listing !== "absent" && row?.listing !== "n/a")
      .map((row) => row?.repo)
      .filter(Boolean)
  )];
}

// The reading that actually matters: a closed door whose list still shows us is a
// win, not a loss, and only the two facts together say so.
export function countHandAccepted(rows) {
  let count = 0;
  for (const row of rows ?? []) {
    if (row?.state === "closed" && row?.listing === "readme") count += 1;
  }
  return count;
}

// Standing check for the defect class fixed on 2026-09-25: public copy telling a reader to
// verify a tool count the published surface no longer has. Version numbers are deliberately
// NOT swept - "pinned by digest to the reviewed v0.4.9 image" is true, and a gate that cries
// wolf on honest history gets muted rather than fixed.
const STALE_CLAIM_PATTERNS = [
  { re: /\btwelve tools?\b/gi, label: "twelve tools" },
  { re: /\b12 tools\b/g, label: "12 tools" },
  { re: /\b12-tool\b/g, label: "12-tool" },
  { re: /12 个工具/g, label: "12 个工具" },
  { re: /\b12 MCP tools\b/gi, label: "12 MCP tools" },
];

// Records, not instructions. Each exclusion is reported by count so it cannot widen in
// silence, and every entry names the reason it is allowed to keep the old number.
const STALE_CLAIM_ALLOWED = [
  { path: /^docs\/mcp-client-compatibility(\.zh-CN)?\.md$/, reason: "as-of client certification rows record twelve-tool runs" },
  { path: /^docs\/protocol-client-compatibility\.md$/, reason: "acceptance criterion applied to recorded twelve-tool runs" },
  { path: /^docs\/protocol-client-compatibility\.zh-CN\.md$/, reason: "same recorded-protocol tables, translated" },
  { path: /^docs\/history\//, reason: "archived report" },
  { path: /^docs\/comprehensive-audit-/, reason: "dated audit snapshot" },
  { path: /^docs\/task-handoff-loop\.md$/, reason: "past-tense observation" },
  { path: /^docs\/assets\/(readme-hero|social-preview-source)\.html$/, reason: "number is baked into a PNG" },
  { path: /^docs\/security\/mcp-image-review-0\.4\.9\.md$/, reason: "versioned image review" },
  { path: /^CHANGELOG\.md$/, reason: "release history" },
];

function scanPublicClaims() {
  let tracked;
  try {
    tracked = execSync("git ls-files", { encoding: "utf8" })
      .split("\n")
      .filter((p) => /^(README([^/]*\.md)?|docs\/.*\.(md|html|txt))$/.test(p));
  } catch {
    return { error: "git ls-files failed; sweep inconclusive", scanned: 0, offenders: [], allowed: [] };
  }
  const offenders = [];
  const allowed = [];
  let readable = 0;
  for (const path of tracked) {
    let text;
    try {
      text = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    readable += 1;
    const rule = STALE_CLAIM_ALLOWED.find((entry) => entry.path.test(path));
    const labels = new Set();
    for (const pattern of STALE_CLAIM_PATTERNS) {
      pattern.re.lastIndex = 0;
      if (pattern.re.test(text)) labels.add(pattern.label);
    }
    if (labels.size === 0) continue;
    if (rule) {
      allowed.push(`${path} (${[...labels].join(", ")}) - ${rule.reason}`);
    } else {
      offenders.push(`${path} still says: ${[...labels].join(", ")}`);
    }
  }
  return { scanned: readable, offenders, allowed, unreadable: tracked.length - readable };
}

// Merged doors that put OUR numbers into a file that is not a README. The README arm above
// cannot see these, and on the next release they start mis-stating the project in a tree we
// do not control. Each entry is a carrier someone accepted, not an instruction to re-ping:
// the report names the file and the stale reading, and a correction is a fresh, factual PR.
const upstreamCarriers = [
  { repo: "hashgraph-online/awesome-codex-plugins", path: "plugins/happy520ai/unified-ai-system/.codex-plugin/plugin.json", checksVersion: true },
  { repo: "hashgraph-online/awesome-codex-plugins", path: "plugins/happy520ai/unified-ai-system/skills/unified-ai-gateway/SKILL.md", checksVersion: false },
  { repo: "hashgraph-online/awesome-codex-plugins", path: "plugins.json", checksVersion: false, anchor: "happy520ai/unified-ai-system" },
  // Checked by hand when #446 merged; guarded from here on so the next release cannot rot it
  // quietly. Same aggregate-index shape as plugins.json, hence the same anchor.
  { repo: "hashgraph-online/awesome-codex-plugins", path: ".agents/plugins/marketplace.json", checksVersion: false, anchor: "happy520ai/unified-ai-system" },
];

// Pure: given carrier text, what does it assert that is no longer true?
export function carrierFindings(text, rosterCount, version) {
  const findings = [];
  for (const claim of staleToolCounts(text, rosterCount)) {
    findings.push(`states "${claim.phrase}" while the roster has ${claim.expected}`);
  }
  if (version) {
    for (const match of text.matchAll(/"?version"?\s*[:=]\s*"?(\d+\.\d+\.\d+)"?/g)) {
      if (match[1] !== version) findings.push(`pins version ${match[1]}, published release is ${version}`);
    }
  }
  return findings;
}

function readPublishedVersion() {
  try {
    const sourcePath = resolve(dirname(fileURLToPath(import.meta.url)), "..", ROSTER_SOURCE);
    const match = readFileSync(sourcePath, "utf8").match(/MCP_SERVER_VERSION\s*=\s*"(\d+\.\d+\.\d+)"/);
    return match ? match[1] : null;
  } catch (_error) {
    return null;
  }
}

// Read-only fetch of a third-party file. null means "could not look", which is never
// reported as "carries nothing stale".
function fetchCarrierFile(repoName, filePath) {
  const result = safeGetText(
    `gh api -H "Accept: application/vnd.github.raw+json" "repos/${repoName}/contents/${filePath}"`
  );
  return result.ok ? String(result.data) : null;
}

// Aggregate catalogue files describe many products, so a count found anywhere in them is not
// a claim about us - the first live run of this arm reported other plugins' "16 MCP tools" and
// "23 MCP tools" as our staleness. Carriers that live in an index therefore name an anchor,
// and only the object enclosing that anchor is read.
export function carrierRegion(text, anchor) {
  if (!anchor) return text;
  const at = text.indexOf(anchor);
  if (at < 0) return null;
  const open = text.lastIndexOf("{", at);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(open, i + 1);
    }
  }
  return null;
}

function collectCarrierFindings() {
  const rosterCount = readRosterCount();
  const version = readPublishedVersion();
  const rows = [];
  for (const carrier of upstreamCarriers) {
    const text = fetchCarrierFile(carrier.repo, carrier.path);
    const region = text === null ? null : carrierRegion(text, carrier.anchor);
    if (text === null) {
      rows.push({ carrier, status: "unreadable", findings: [] });
    } else if (region === null) {
      rows.push({ carrier, status: "unscoped", findings: [] });
    } else if (rosterCount === null) {
      rows.push({ carrier, status: "roster-unknown", findings: [] });
    } else {
      rows.push({
        carrier,
        status: "read",
        findings: carrierFindings(region, rosterCount, carrier.checksVersion ? version : null),
      });
    }
  }
  return { rosterCount, version, rows };
}

async function scanRemotePublicClaims() {
  const offenders = [];
  let scanned = 0;
  let error = null;
  for (const endpoint of [`repos/${repo}/issues?state=open&per_page=50`, `repos/${repo}/pulls?state=open&per_page=50`]) {
    let items;
    try {
      items = runJson(`gh api "${endpoint}"`);
    } catch {
      error = "gh api failed; remote sweep inconclusive";
      continue;
    }
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      scanned += 1;
      const haystack = `${item.title ?? ""}\n${item.body ?? ""}`;
      const labels = new Set();
      for (const pattern of STALE_CLAIM_PATTERNS) {
        pattern.re.lastIndex = 0;
        if (pattern.re.test(haystack)) labels.add(pattern.label);
      }
      if (labels.size > 0) offenders.push(`#${item.number} says: ${[...labels].join(", ")}`);
    }
  }
  return { scanned, offenders, error };
}

function generateCheckReport(repoStats, rows, date, previousStats = null, claimSweep = null, remoteSweep = null, deferred = null, untracked = null, denominatorTruncated = false, carriers = null) {
  const lines = [];
  lines.push(`# Star Growth Check (${date})`);
  lines.push("");
  lines.push("## Repository");
  lines.push(...renderRepoSection(repoStats, date, "-", previousStats));
  lines.push("## External PR Funnel");
  lines.push(...renderPrRowsTable(rows));
  const kinds = countListingKinds(rows);
  lines.push("");
  lines.push(
    `### Listings carried by an upstream README: ${kinds.readme} listed / ${kinds.absent} not found / `
    + `${kinds.unreadable} unreadable / ${kinds.notApplicable} no README to read (submission tickets)`
  );
  const blind = unreadableCarriers(rows);
  if (blind.length > 0) {
    lines.push(`Unreadable carriers, named: ${blind.join(", ")}.`);
  }
  lines.push(
    `Doors the list closed but still carries our entry (accepted by hand): ${countHandAccepted(rows)}. `
    + "PR state alone under-counts these, which is why the README is read as well as the pull request."
  );
  lines.push(
    "`not found` is a reading of the README only: several lists keep entries in data files, so it is not proof of absence. "
    + "Repository code search was tried as a second carrier on 2026-09-25 and rejected - its index is partial and the same repo flipped between `found` and `not found` across consecutive runs."
  );
  const rosterCount = readRosterCount();
  const staleRows = [];
  for (const row of rows ?? []) {
    if (row?.listing !== "readme") continue;
    for (const claim of staleToolCounts(row.rowText ?? "", rosterCount ?? 0)) {
      staleRows.push(`${row.repo}#${row.pr} says "${claim.phrase}" while the roster has ${claim.expected}`);
    }
  }
  const staleOwnClaims = staleOwnClaimLines(rows, rosterCount);
  lines.push("");
  lines.push("### Upstream rows that state a tool count");
  if (rosterCount === null) {
    lines.push(`Not evaluated: the roster could not be read from ${ROSTER_SOURCE}.`);
  } else if (staleRows.length === 0) {
    lines.push(`None: every row that lists us either makes no count claim or agrees with the roster (${rosterCount}).`);
  } else {
    for (const item of staleRows) {
      lines.push(`- STALE ${item}`);
    }
  }

  lines.push("");
  lines.push("### Our own live submission copy that states a tool count");
  if (rosterCount === null) {
    lines.push(`Not evaluated: the roster could not be read from ${ROSTER_SOURCE}.`);
  } else if (staleOwnClaims.length === 0) {
    lines.push(`None: every open door we authored states no count, or states ${rosterCount}.`);
  } else {
    for (const item of staleOwnClaims) {
      lines.push(`- OURS-STALE ${item}`);
    }
  }
  lines.push(
    `Exclusions in force: ${OUR_COPY_STALE_ALLOWED.length} door/phrase pairs that state an older count on purpose `
    + "(recorded history or a verbatim quote of someone else's row). Each is named in OUR_COPY_STALE_ALLOWED with its reason."
  );
  lines.push("");
  lines.push("### Deferred doors (stated numeric bar not yet met)");
  if ((deferred ?? []).length === 0) {
    lines.push("None recorded.");
  } else {
    for (const door of deferred) {
      if (door.unreadable) {
        lines.push(`- UNKNOWN ${door.repo}: contributor list could not be read; do not conclude eligibility either way. ${door.note}`);
      } else if (door.ready) {
        lines.push(`- READY ${door.repo}: the stated bar is met now - file it. ${door.note}`);
      } else {
        lines.push(`- waiting ${door.repo}: needs ${door.starsNeeded} more stars, ${door.contributorsNeeded} more human contributors. ${door.note}`);
      }
    }
  }

  lines.push("");
  lines.push("### Door-list completeness");
  if (untracked === null) {
    lines.push("UNKNOWN: the open-item search failed, so this report cannot claim to cover every door.");
  } else {
    if (denominatorTruncated) {
      lines.push("- DENOMINATOR TRUNCATED: the search returned a full page, so doors beyond page 1 are invisible to this check. Raise the page size before trusting the lines below.");
    }
    const prTracked = (rows ?? []).filter((row) => row?.kind !== "issue").length;
    const issueTracked = (rows ?? []).filter((row) => row?.kind === "issue").length;
    if (untracked.length === 0) {
      lines.push(
        `Complete: every open pull request and submission issue authored by us is a row in this report `
        + `(${prTracked} pull-request doors, ${issueTracked} issue doors).`
      );
    } else {
      for (const door of untracked) {
        const list = door.kind === "issue" ? "externalIssues" : "externalPrs";
        lines.push(`- UNTRACKED ${door.kind} ${door.repo}#${door.pr} - "${door.title}" is open but not in ${list}, so no arm above can see it.`);
      }
    }
  }

  const carry = needsRecarry(rows);
  lines.push("");
  lines.push("### Merged upstream carriers that hold our numbers");
  if (carriers === null) {
    lines.push("Not evaluated in this mode: run the check action to read the third-party files that carry our tool count and version.");
  } else {
    lines.push(
      `Reference: roster ${carriers.rosterCount ?? "unreadable"}, published version ${carriers.version ?? "unreadable"}. `
      + "These are files in repositories we do not maintain, accepted by their owners; a stale line here is a fresh, factual correction PR, not a ping."
    );
    for (const row of carriers.rows) {
      const name = `${row.carrier.repo}/${row.carrier.path}`;
      if (row.status === "unreadable") {
        lines.push(`- UNREADABLE ${name}: the file could not be fetched, which is not a claim that it is clean.`);
      } else if (row.status === "unscoped") {
        lines.push(`- UNSCOPED ${name}: the anchor was not found, so no part of this index is attributed to us.`);
      } else if (row.status === "roster-unknown") {
        lines.push(`- NOT CHECKED ${name}: the local roster could not be read.`);
      } else if (row.findings.length === 0) {
        lines.push(`- ok ${name}`);
      } else {
        for (const finding of row.findings) {
          lines.push(`- STALE ${name} ${finding}`);
        }
      }
    }
  }

  lines.push("");
  lines.push("### Doors needing action");
  if (carry.length === 0) {
    lines.push("None: every open door is mergeable or waiting on a human review, which a re-carry does not change.");
  } else {
    for (const item of carry) {
      const guidance = item.kind === "RE-CARRY"
        ? "reset the branch onto upstream main, replay the single entry commit, push with --force-with-lease, then confirm the PR reports 0 removed lines."
        : "the door could not be read; re-run before concluding anything about it.";
      lines.push(`- ${item.kind} ${item.repo}#${item.pr} (${item.mergeState}) - ${guidance}`);
    }
  }
  lines.push("");
  lines.push("## Public Claim Sweep");
  lines.push("");
  lines.push("| Instrument | Value |");
  lines.push("| --- | --- |");
  lines.push(`| Repository files scanned | ${claimSweep ? claimSweep.scanned : "not run"} |`);
  lines.push(`| Files allowed to keep a historical number | ${claimSweep ? claimSweep.allowed.length : "not run"} |`);
  lines.push(`| Files with a stale instruction | ${claimSweep ? claimSweep.offenders.length : "not run"} |`);
  lines.push(`| Open issue and PR bodies scanned | ${remoteSweep ? remoteSweep.scanned : "not run"} |`);
  lines.push(`| Issues or PRs with a stale instruction | ${remoteSweep ? remoteSweep.offenders.length : "not run"} |`);
  lines.push("");
  if (claimSweep?.error) lines.push(`- Inconclusive file sweep: ${claimSweep.error}`);
  if (remoteSweep?.error) lines.push(`- Inconclusive remote sweep: ${remoteSweep.error}`);
  for (const offender of claimSweep?.offenders ?? []) lines.push(`- STALE: ${offender}`);
  for (const offender of remoteSweep?.offenders ?? []) lines.push(`- STALE: ${offender}`);
  if (!claimSweep?.error && !remoteSweep?.error
    && (claimSweep?.offenders.length ?? 0) === 0 && (remoteSweep?.offenders.length ?? 0) === 0) {
    lines.push("No public copy asks a reader to verify a tool count the published surface no longer has.");
  }
  if (claimSweep && claimSweep.allowed.length > 0) {
    lines.push("");
    lines.push("Excluded as records rather than instructions:");
    for (const entry of claimSweep.allowed) lines.push(`- ${entry}`);
  }
  if (claimSweep?.unreadable) {
    lines.push(`- ${claimSweep.unreadable} tracked path(s) could not be read this run.`);
  }
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
  lines.push("For a source checkout, pipe a request from a file after starting the gateway:");
  lines.push(pipeCommand);
  lines.push("");
  lines.push("For a no-clone Docker path, pipe a request into the published image:");
  lines.push(dockerPipeCommand);
  lines.push("");
  lines.push("### 24h Action");
  lines.push("- Ask one new user outside active PR threads to run the command and paste output.");
  lines.push(
    "- Reply to technical feedback with a concrete answer or change within 24 hours."
  );
  lines.push("- Do not post status-only pings on PRs that are waiting for maintainer review.");
  lines.push("- Keep generated snapshots under the ignored .tmp/growth/ directory.");
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
  const merged = rows.filter((row) => row.state === "merged").length;
  const closed = rows.filter((row) => row.state === "closed").length;
  const open = rows.filter((row) => row.state === "open").length;

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
  lines.push(`- Open: ${open}`);
  lines.push(`- Merged: ${merged}`);
  lines.push(`- Closed without merge: ${closed}`);
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
  const date = formatReportDate();

  if (!["check", "daily", "evidence", "summary", "campaign"].includes(action)) {
    console.error(`Unsupported growth action: ${action}`);
    console.error(usage);
    process.exit(1);
  }

  ensureGhAvailable();
  const repoStats = await getRepoStats();
  const prRows = await getExternalPrRows();
  const issueRows = await getExternalIssueRows();
  const rows = [...prRows, ...issueRows];
  const contributorsResult = safeGetJson(`gh api repos/${repo}/contributors?per_page=100`);
  const humanContributors = contributorsResult.ok
    ? countHumanContributors(contributorsResult.data)
    : null;
  const deferred = humanContributors === null
    ? deferredDoors.map((door) => ({ repo: door.repo, ready: false, starsNeeded: null, contributorsNeeded: null, note: door.note, unreadable: true }))
    : deferredDoorStatus(deferredDoors, repoStats.stars, humanContributors);

  // No type:pr filter - a door opened as an issue is still a door. total_count is read
  // alongside the page so a truncated denominator cannot masquerade as "nothing missing".
  const openItems = safeGetJson(`gh api "search/issues?q=author%3Ahappy520ai+is%3Aopen&per_page=100"`);
  const denominatorItems = openItems.ok ? (openItems.data?.items ?? []) : null;
  const denominatorTruncated = openItems.ok
    && Number(openItems.data?.total_count ?? 0) > denominatorItems.length;
  const untracked = denominatorItems === null
    ? null
    : findUntrackedDoors(rows, denominatorItems, repo);

  const previous = readSnapshotMetrics(defaultLatestSnapshotFile);

  if (action === "check") {
    const claimSweep = scanPublicClaims();
    const remoteSweep = await scanRemotePublicClaims();
    const carriers = collectCarrierFindings();
    const report = generateCheckReport(repoStats, rows, date, previous, claimSweep, remoteSweep, deferred, untracked, denominatorTruncated, carriers);
    if (options.output) writeReport(options.output, report);
    console.log(report);
    return;
  }

  if (action === "daily") {
    if (!options.output) throw new Error("daily action requires --output path");
    const report = generateDailyReport(repoStats, rows, date, previous);
    writeReport(options.output, report);
    console.log(report);
    return;
  }

  if (action === "evidence") {
    if (!options.output) throw new Error("evidence action requires --output path");
    const report = generateEvidenceReport(repoStats, rows, date, previous);
    writeReport(options.output, report);
    console.log(report);
    return;
  }

  if (action === "summary") {
    const report = generateSummaryReport(repoStats, rows, date);
    if (options.output) writeReport(options.output, report);
    console.log(report);
    return;
  }

  const evidenceOutput = options.output ?? `${defaultGrowthOutputDir}/star-growth-latest.md`;
  const dailyOutput = options.dailyOutput ?? `${defaultGrowthOutputDir}/star-growth-daily.md`;
  const checkOutput = options.checkOutput ?? null;

  writeReport(evidenceOutput, generateEvidenceReport(repoStats, rows, date, previous));
  writeReport(dailyOutput, generateDailyReport(repoStats, rows, date, previous));
  if (checkOutput) {
    writeReport(checkOutput, generateCheckReport(repoStats, rows, date, previous));
  }

  const updatedFiles = [
    evidenceOutput,
    dailyOutput,
    checkOutput ?? "stdout",
  ];
  console.log(`Growth campaign completed. Updated: ${updatedFiles.join(", ")}`);
  console.log(generateDailyReport(repoStats, rows, date, previous));
}

// Only run as a CLI; importing needsRecarry for calibration must not fire the report.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  run().catch((error) => {
    console.error(error.message || String(error));
    process.exit(1);
  });
}
