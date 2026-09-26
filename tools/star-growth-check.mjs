#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gatewayImage } from "./release-metadata.mjs";

const repo = "happy520ai/unified-ai-system";
const repoUrl = "https://github.com/happy520ai/unified-ai-system";
const ownerLogin = repo.split("/")[0];
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
  ["BehiSecc/awesome-claude-skills", 777],
  ["ai-for-developers/awesome-ai-coding-tools", 775],
  // Not authored by us, so the completeness arm does not require it - but their agent
  // opened this pull request out of our submission issue #507 and re-syncs it whenever
  // that body changes. It is the surface that actually merges, so a later session must
  // not open a second one.
  ["InftyAI/Awesome-LLMOps", 508],
  // Found with a different search shape (topic:awesome-list) on 2026-09-26. Their
  // CONTRIBUTING states there is no star minimum, the queue merged 29 of the 30 most
  // recently closed pull requests, and their own validator was run on the edit before
  // filing: 0 errors.
  ["alvinreal/awesome-opensource-ai", 779],
  // Same search shape: 12.7k stars, 10 of the last 30 closed pulls merged, newest
  // 2026-09-24. Their inclusion bar is "1,000 followers OR interesting to the maintainer",
  // and the stated outcome for a small-but-sound project is the Discoveries list rather
  // than rejection - which is how this one was filed.
  ["steven2358/awesome-generative-ai", 1451],
  // Not a new listing: we found ourselves already listed here with a 0.4.x-era sentence.
  // Their queue merges 30 of 30 recent closures, and their README is the source the JSON
  // artifacts regenerate from, so the correction is one line in one file.
  ["hashgraph-online/awesome-ai-plugins", 479],
  // A copy of our own skill file, vendored by a 46.9k-star list with the nine-tool
  // era's setup instructions still in it. Found by widening the carrier matcher, not by
  // looking for doors: a reader who registered successfully and saw fifteen tools was told by
  // this file that something was wrong.
  ["sickn33/agentic-awesome-skills", 1616],
  ["agentskillexchange/skills", 82],
  // 75.6k stars, found by scanning curated lists for ones whose README does not mention
  // us rather than by searching for "awesome mcp". Their CONTRIBUTING asks for exactly
  // this shape of entry and does not bar agents.
  //
  // Trap recorded the hard way: our fork of THIS list is `happy520ai/awesome-claude-skills-1`,
  // because `happy520ai/awesome-claude-skills` is the fork of BehiSecc's list that carries
  // door #777 above. Same repo name, same branch name, two different upstreams - a submit
  // script that builds fork paths from "<owner>/<upstream-name>" writes into the other
  // door's head branch. That is why the filing script now fetches the branch's README and
  // refuses unless it is byte-identical to the upstream head it was cut from.
  ["ComposioHQ/awesome-claude-skills", 2001],
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
  node tools/star-growth-check.mjs queues
  node tools/star-growth-check.mjs coverage
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
const COUNT_CLAIM_RE = new RegExp(
  '\\b(\\d{1,3}|' + Object.keys(COUNT_WORDS).join('|') + ')((?:\\s+[a-z]+){0,3})\\s+tools?\\b',
  'gi',
);

export function staleToolCounts(text, current) {
  if (typeof text !== "string" || typeof current !== "number" || current < 1) return [];
  const found = [];
  // Any technical qualifier may sit between the number and the noun. The narrow form that used
  // to live here matched "nine governed MCP tools" but not "nine stdio MCP tools", and the
  // sentence it missed was inside machine-readable install config, so the guard printed ok on
  // the most harmful case it owns. Quantifier prose stays out: "one more tool" is not a claim
  // about a roster, and swallowing it would make the sweep cry wolf until someone widened it back.
  const PROSE_QUANTIFIERS = new Set([
    'more', 'other', 'others', 'additional', 'extra', 'new', 'remaining', 'left', 'same',
    'these', 'those', 'both', 'few', 'several', 'many', 'various', 'own',
  ]);
  // Group 1 is anchored to the known count words rather than [a-z]+: an open word class let a
  // preceding word swallow the match ("with nine governed MCP tools" started at "with", which is
  // not a number, and the real claim was consumed) - so the widened pattern briefly detected
  // LESS than the narrow one it replaced.
  for (const match of text.matchAll(COUNT_CLAIM_RE)) {
    if ((match[2] ?? "").split(/\s+/).filter(Boolean).some((w) => PROSE_QUANTIFIERS.has(w.toLowerCase()))) continue;
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
  { door: "cuihuan/awesome-ai-gateway#48", phrase: "nine governed MCP tools", reason: "closed door the maintainer applied by hand; the live README row is being fixed by #102, so this body is history and re-carrying it would re-open a burned door" },
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
  {
    repo: "bestofjs/bestofjs",
    requiresStars: 101,
    requiresHumanContributors: 0,
    note: "Their own add-a-project template asks the submitter to check \"project has more than 100 stars on GitHub\", and the maintainer told a September suggestion to wait for that threshold. Queue is alive: seven merges in the fortnight to 2026-09-23.",
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

// A candidate list looks alive when its newest PR is from yesterday. That signal is wrong:
// travisvn/awesome-claude-skills had PRs opened 2026-09-24/25, a default branch untouched
// since 2026-04-28, 794 open PRs and no merge in its last 20 closed ones. Filing there adds
// to a queue with no consumer. Only merges prove someone reads the queue.
export function queueHealth(closedPulls, { today, windowDays = 60, minSample = 5 } = {}) {
  if (!Array.isArray(closedPulls)) return { verdict: "UNKNOWN", reason: "the closed-PR read failed" };
  const closed = closedPulls.filter((pr) => pr?.state === "closed");
  if (closed.length < minSample) {
    return {
      verdict: "UNKNOWN",
      reason: `only ${closed.length} closed pull request(s) in the sample, fewer than ${minSample}`,
      closed: closed.length,
      merged: 0,
    };
  }
  const mergedDates = closed
    .map((pr) => pr?.merged_at)
    .filter((value) => typeof value === "string" && value.length > 0)
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a);
  const base = Date.parse(today ?? new Date().toISOString());
  if (!Number.isFinite(base)) return { verdict: "UNKNOWN", reason: "no reference date", closed: closed.length, merged: mergedDates.length };
  const summary = { closed: closed.length, merged: mergedDates.length };
  if (mergedDates.length === 0) {
    return {
      verdict: "DEAD_QUEUE",
      reason: `0 of ${closed.length} most recently updated closed pull requests were merged`,
      lastMergedAt: null,
      ...summary,
    };
  }
  const ageDays = Math.round((base - mergedDates[0]) / 86_400_000);
  return {
    verdict: ageDays <= windowDays ? "ALIVE" : "STALE",
    reason: `last merge ${ageDays} day(s) ago (window ${windowDays}), ${mergedDates.length}/${closed.length} recent closed merged`,
    lastMergedAt: new Date(mergedDates[0]).toISOString().slice(0, 10),
    ...summary,
  };
}

// One closed-sample read per repository. Shared by the standalone `queues` action and the
// daily check, so a door's chance of ever merging is computed the same way in both.
async function assessQueues(repoNames) {
  const out = [];
  for (const repoName of [...new Set(repoNames)]) {
    const result = safeGetJson(
      `gh api "repos/${repoName}/pulls?state=closed&sort=updated&direction=desc&per_page=30"`
    );
    out.push({ repo: repoName, ...queueHealth(result.ok ? result.data : null, { today: new Date().toISOString() }) });
  }
  return out;
}

function renderQueueLines(assessments, { heading }) {
  const lines = [heading, ""];
  const counts = {};
  for (const item of assessments) {
    counts[item.verdict] = (counts[item.verdict] ?? 0) + 1;
    lines.push(`- ${item.verdict.padEnd(12)} ${item.repo} - ${item.reason}`);
  }
  lines.push("");
  lines.push(`Tallied: ${Object.entries(counts).map(([key, value]) => `${key}=${value}`).join(", ")} across ${assessments.length} repositories.`);
  lines.push("`ALIVE` means a merge landed within 60 days. `DEAD_QUEUE` means the most recently updated closed sample (>=5 pull requests) contains no merge at all; a submission there is invisible, not pending. `UNKNOWN` means the sample was too small to say - it is not a claim of health or of death.");
  return lines;
}

async function reportQueues() {
  return renderQueueLines(await assessQueues(externalPrs.map(([repoName]) => repoName)), {
    heading: "### Whether each door's queue can actually merge",
  });
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
  // Found by reading a sister list, not by opening a door: this one already carried our entry
  // with a 0.4.x-era sentence. Line-scoped because it is a markdown README. Correction filed as
  // hashgraph-online/awesome-ai-plugins#479, so this carrier going from finding to clean is the
  // measurement that says the merge landed - nobody has to ask.
  { repo: "hashgraph-online/awesome-ai-plugins", path: "README.md", checksVersion: false, anchor: "happy520ai/unified-ai-system", scope: "line" },
  // Two more found by censusing the places that already carry us, not by opening doors. Both
  // say "nine" and both already have a clean, in-review correction from us - the point of
  // watching them is that this report goes green by itself when those merges land.
  // This one is machine-readable install config, so it is worse than prose: binArgs pinned
  // mcp-server:0.4.8, i.e. a reader following the directory gets a five-month-old image.
  { repo: "toolsdk-ai/toolsdk-mcp-registry", path: "packages/aggregators/unified-ai-system.json", checksVersion: true },
  // Whole file is our entry, so no anchor is needed; their stats: block is bot-maintained and
  // is deliberately outside anything we would edit.
  { repo: "up-for-grabs/up-for-grabs.net", path: "_data/projects/unified-ai-system.yml", checksVersion: false },
  // Two more from enumerating the files our merged pull requests actually changed, which is the
  // precise way to find carriers: a listing that vendors our skill file is writing setup
  // instructions for us, so a stale count in it is a user-facing defect, not a branding nit.
  { repo: "agentskillexchange/skills", path: "skills/unified-ai-gateway/SKILL.md", checksVersion: true },
  { repo: "yzfly/Awesome-MCP-ZH", path: "README.md", checksVersion: false, anchor: "happy520ai/unified-ai-system", scope: "line" },
  // The 46.9k-star vendor. Both of these are wrong right now and both are fixed by #1616,
  // so the line going from STALE to ok is the confirmation that it merged - nobody has to ask.
  { repo: "sickn33/agentic-awesome-skills", path: "skills/unified-ai-gateway/SKILL.md", checksVersion: true },
  { repo: "sickn33/agentic-awesome-skills", path: "README.md", checksVersion: false, anchor: "happy520ai/unified-ai-system", scope: "line" },
];

// A markdown list needs the opposite scoping from a JSON index: our entry is one line, and
// the file holds hundreds of other projects' counts. Brace matching would return some
// unrelated earlier object and read those numbers as ours, which is the false positive this
// guard already had to be fixed for once. Absence of the anchor is null, never an empty
// list, so "not listed" cannot be printed as "listed and correct".
export function carrierLines(text, anchor) {
  if (!anchor) return text;
  const kept = String(text ?? "")
    .split("\n")
    .filter((line) => line.includes(anchor));
  return kept.length > 0 ? kept.join("\n") : null;
}

// Pure: given carrier text, what does it assert that is no longer true?
export function carrierFindings(text, rosterCount, version) {
  const findings = [];
  for (const claim of staleToolCounts(text, rosterCount)) {
    findings.push(`states "${claim.phrase}" while the roster has ${claim.expected}`);
  }
  if (version) {
    const pins = [
      ...text.matchAll(/"?version"?\s*[:=]\s*"?(\d+\.\d+\.\d+)/g),
      // An image tag is a version pin with no word in front of it, and it is how a directory
      // tells a reader what to run, so it is the pin that matters most.
      ...text.matchAll(/(?:mcp-server|ai-gateway-service):(\d+\.\d+\.\d+)/g),
    ];
    const seen = new Set();
    for (const match of pins) {
      if (match[1] === version || seen.has(match[1])) continue;
      seen.add(match[1]);
      findings.push(`pins version ${match[1]}, published release is ${version}`);
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
    const region = text === null
      ? null
      : (carrier.scope === "line" ? carrierLines(text, carrier.anchor) : carrierRegion(text, carrier.anchor));
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

// Comments, not bodies: an owner's update note is where a superseded command survives, and
// a comment containing `docker run ...:0.7.0` is advice a visitor copies, not history.
// Records are still records, so they are excluded by comment id with the reason stated, and
// the count is printed rather than hidden.
const COMMENT_CLAIM_ALLOWED = [
  { id: 5407452399, reason: "2026-08-25 audit record of which surfaces were aligned to v0.5.0 / twelve tools at that date" },
  { id: 5235971711, reason: "as-of log of a client verification run that listed the then-nine tools" },
  { id: 5406922621, reason: "PR #115 changelog: records that the copy was corrected from 9 to 12 at that time" },
  { id: 5404483693, reason: "PR #115 evidence summary of one verify:public-clone run that discovered 12" },
  { id: 5228155280, reason: "2026-08-08 log line: the public-clone verification of that day confirmed 9" },
];

export function commentClaimFindings(comments, rosterCount, allowed = COMMENT_CLAIM_ALLOWED) {
  if (rosterCount === null) return null;
  const offenders = [];
  const kept = [];
  let scanned = 0;
  for (const comment of comments ?? []) {
    const body = String(comment?.body ?? "");
    if (body.length === 0) continue;
    scanned += 1;
    const claims = staleToolCounts(body, rosterCount);
    if (claims.length === 0) continue;
    // Comment URLs come in two shapes: /issues/20#issuecomment-N and /pull/115#issuecomment-N.
    const ref = String(comment.html_url ?? "").match(/\/(?:issues|pull)\/(\d+)/)?.[1] ?? "?";
    const label = `comment ${comment.id} on #${ref}`;
    const rule = (allowed ?? []).find((item) => item.id === comment.id);
    if (rule) {
      kept.push(`${label} - ${rule.reason}`);
    } else {
      offenders.push(`${label} says "${claims.map((claim) => claim.phrase).join('", "')}" while the roster has ${rosterCount}`);
    }
  }
  return { scanned, offenders, kept };
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
  // Comment bodies use the roster-derived matcher rather than the literal pattern list,
  // because the patterns were written for "twelve tools" copy and a nine-tool run log
  // needs comparing against the live roster to mean anything.
  let comments = null;
  try {
    comments = runJson(`gh api "repos/${repo}/issues/comments?per_page=100&sort=created&direction=desc"`);
  } catch {
    error = error ?? "comment read failed; the comment sweep is inconclusive";
  }
  const commentSweep = commentClaimFindings(comments, readRosterCount());
  if (commentSweep === null) {
    return { scanned, offenders, error, commentScanned: 0, commentKept: 0, commentNote: "roster unreadable, so no comment was judged" };
  }
  offenders.push(...commentSweep.offenders);
  return {
    scanned,
    offenders,
    error,
    commentScanned: commentSweep.scanned,
    commentKept: commentSweep.kept.length,
    commentNote: comments === null
      ? "the comment read failed - this sweep did not look at comments"
      : `most recent ${commentSweep.scanned} comments read; older ones were not`,
  };
}

// A door whose most recent human comment is not ours is a question, and a question we never
// answer is how a submission dies quietly. A comment count cannot show this, and the door set
// grows faster than anyone can keep a hand list of it. Bot replies are excluded on purpose: a
// review bot's summary is not a human ask, and replying to one is the noise that makes a
// maintainer close the real thread.
const BOT_OR_SYSTEM_RE = /\[bot\]$|bot$|agent$|^dependabot|^github-actions|^coderabbit|^socket|^greenbot|^snyk-/i;
// Login shape, not user.type: shiftbot - the up-for-grabs checker that posts "this should be ready to
// merge!" - reports type User, so the API field cannot tell a bot from a person. Trade-off is
// deliberate: a human whose login ends in "bot" gets skipped, and one missed question is better
// than an arm that cries wolf until it is ignored.

export function replyRequestFrom(comments, ownerLogin) {
  const rows = (comments ?? []).filter((c) => c && typeof c === 'object');
  if (rows.length === 0) return null;
  const stamp = (c) => String(c.created_at ?? c.updated_at ?? '');
  const human = rows.filter((c) => {
    const login = c.user?.login ?? '';
    return login !== '' && login !== ownerLogin && c.user?.type !== 'Bot' && !BOT_OR_SYSTEM_RE.test(login);
  });
  if (human.length === 0) return null;
  const ours = rows.filter((c) => c.user?.login === ownerLogin).map(stamp).sort();
  const newest = human.slice().sort((a, b) => stamp(b).localeCompare(stamp(a)))[0];
  if (ours.length > 0 && stamp(newest) <= ours[ours.length - 1]) return null;
  return {
    author: newest.user.login,
    at: stamp(newest).slice(0, 10),
    excerpt: String(newest.body ?? '').replace(/\s+/g, ' ').trim().slice(0, 140),
  };
}

async function collectReplyRequests(rows, ownerLogin) {
  const asks = [];
  let scanned = 0;
  let unreadable = 0;
  for (const row of rows ?? []) {
    if (row.state !== 'open') continue;
    scanned += 1;
    let data;
    try {
      data = runJson(`gh api "repos/${row.repo}/issues/${row.pr}/comments?per_page=100&sort=created&direction=desc"`);
    } catch {
      unreadable += 1;
      continue;
    }
    if (!Array.isArray(data)) { unreadable += 1; continue; }
    const ask = replyRequestFrom(data, ownerLogin);
    if (ask) asks.push({ repo: row.repo, pr: row.pr, kind: row.kind ?? 'pr', ...ask });
  }
  return { asks, scanned, unreadable };
}

function renderReplySection(reply) {
  const lines = ['### Whether a human has asked us something', ''];
  if (reply == null) {
    lines.push('Not evaluated in this mode.');
    return lines;
  }
  if (reply.asks.length === 0) {
    lines.push(`No open door has an unanswered human comment. Read ${reply.scanned} open doors, newest 100 comments each`
      + `, ${reply.unreadable} unreadable. This says nobody asked anything - it does not say nobody replied.`);
  }
  for (const ask of reply.asks) {
    lines.push(`- REPLY DUE ${ask.repo}#${ask.pr} (${ask.kind}) - ${ask.author} on ${ask.at}: ${ask.excerpt}`);
  }
  if (reply.asks.length > 0) {
    lines.push(`Scope: ${reply.scanned} open doors read, newest 100 comments each, ${reply.unreadable} unreadable.`);
  }
  return lines;
}

function generateCheckReport(repoStats, rows, date, previousStats = null, claimSweep = null, remoteSweep = null, deferred = null, untracked = null, denominatorTruncated = false, carriers = null, queues = null, reply = null) {
  const lines = [];
  lines.push(`# Star Growth Check (${date})`);
  lines.push("");
  lines.push("## Repository");
  lines.push(...renderReplySection(reply));
  lines.push("");
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
  lines.push("### Can each open pull-request door still merge?");
  if (queues === null) {
    lines.push("Not evaluated in this mode. Run `node tools/star-growth-check.mjs queues` for every tracked repository.");
  } else {
    const blocked = queues.filter((item) => item.verdict !== "ALIVE");
    const counts = queues.reduce((acc, item) => {
      acc[item.verdict] = (acc[item.verdict] ?? 0) + 1;
      return acc;
    }, {});
    lines.push(
      `Assessed ${queues.length} repositories with an open pull request of ours: `
      + `${Object.entries(counts).map(([key, value]) => `${key}=${value}`).join(", ")}. `
      + "A door in a queue with no recent merges is invisible, not pending - count it as zero expected listings and do not spend another submission on that repository."
    );
    for (const item of blocked) {
      const doors = (rows ?? [])
        .filter((row) => row.repo === item.repo && row.state === "open" && row.kind !== "issue")
        .map((row) => `#${row.pr}`)
        .join(" ");
      lines.push(`- ${item.verdict.padEnd(12)} ${item.repo} ${doors} - ${item.reason}`);
    }
    if (blocked.length === 0) {
      lines.push("None: every open pull-request door sits in a repository that merged something within 60 days.");
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
  lines.push(
    `| Comment bodies scanned | ${remoteSweep?.commentScanned !== undefined
      ? `${remoteSweep.commentScanned} (records kept by rule: ${remoteSweep.commentKept})`
      : "not run"} |`
  );
  lines.push("");
  if (claimSweep?.error) lines.push(`- Inconclusive file sweep: ${claimSweep.error}`);
  if (remoteSweep?.error) lines.push(`- Inconclusive remote sweep: ${remoteSweep.error}`);
  for (const offender of claimSweep?.offenders ?? []) lines.push(`- STALE: ${offender}`);
  for (const offender of remoteSweep?.offenders ?? []) lines.push(`- STALE: ${offender}`);
  if (!claimSweep?.error && !remoteSweep?.error
    && (claimSweep?.offenders.length ?? 0) === 0 && (remoteSweep?.offenders.length ?? 0) === 0) {
    lines.push("No public copy asks a reader to verify a tool count the published surface no longer has.");
    if (remoteSweep?.commentNote) lines.push(`- Coverage limit: ${remoteSweep.commentNote}.`);
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

// Search coverage. The docs site is the only promotion channel that needs nobody's
// permission, and until now this instrument could not say whether any of it is findable.
// The probe is DuckDuckGo's HTML endpoint: Bing answers a scripted site: query with a block
// page, and a block page is not a reading. Zero results is reported as a blind probe, never
// as "not indexed", because the two look identical from here and only one of them is false.
export const SITE_HOST = "happy520ai.github.io";

// A search engine that suspects you are a bot answers with a challenge page, and that page
// arrives under a success-looking status: the lite endpoint returned HTTP 202 with "select
// all squares containing a duck" while a browser session on the same query still worked.
// Naming the reason matters, because "the probe found nothing" and "the probe was stopped"
// produce the same empty list and only one of them is worth acting on.
export function classifyProbeResponse(status, html) {
  const body = String(html ?? '');
  if (/select all squares|made by a human|complete the following challenge/i.test(body)) {
    return { kind: 'CHALLENGE', error: `HTTP ${status}: bot challenge page served instead of results` };
  }
  if (status !== 200) {
    return { kind: 'UNEXPECTED_STATUS', error: `probe answered HTTP ${status}` };
  }
  return { kind: 'RESULTS', error: null };
}


export function indexedSiteUrls(html, host = SITE_HOST) {
  const found = new Set();
  const accept = (candidate) => {
    let url;
    try {
      url = new URL(candidate);
    } catch {
      return;
    }
    if (url.hostname !== host) return;
    // Query strings and fragments are how the probe echoes its own input back at us; they
    // are not pages, and counting them once made this report claim coverage it did not read.
    if (url.search || url.hash) return;
    found.add(url.href);
  };
  for (const match of String(html ?? "").matchAll(/href="([^"]*)"/g)) {
    const href = match[1].replace(/&amp;/g, '&');
    // A result link is not a plain href: DuckDuckGo routes it through its own redirect and
    // puts the destination in an encoded parameter. Reading only bare hrefs produced a
    // confident "0 of 13 indexed" for a site that had six pages in that very index.
    const redirect = href.match(/[?&](?:uddg|rut)=([^&]*)/);
    if (redirect) {
      try {
        accept(decodeURIComponent(redirect[1]));
      } catch {
        /* an undecodable parameter is not a page */
      }
      continue;
    }
    accept(href);
  }
  return [...found].sort();
}

export function searchCoverageLines(sitemapUrls, indexed, { error = null } = {}) {
  const lines = ["### Whether a search engine can find the pages we published", ""];
  if (error) {
    lines.push(`Inconclusive: the index probe failed (${error}). Absence here is not evidence of absence.`);
    return lines;
  }
  if (indexed.length === 0) {
    lines.push(
      `BLIND_PROBE: the probe surfaced none of the ${sitemapUrls.length} published URLs, which is exactly how a blocked`
      + " probe looks. No coverage claim is made either way.",
    );
    return lines;
  }
  const seen = new Set(indexed);
  const missing = sitemapUrls.filter((u) => !seen.has(u));
  const label = (u) => (u === `https://${SITE_HOST}/` ? "/ (site home)" : u.replace(`https://${SITE_HOST}/`, ""));
  lines.push(`- Published URLs in docs/sitemap.xml: ${sitemapUrls.length}; found in the index: ${sitemapUrls.filter((u) => seen.has(u)).length}; not visible: ${missing.length}.`);
  if (missing.length > 0) lines.push(`- Not visible to this probe (may simply be un-crawled yet): ${missing.map(label).join(", ")}`);
  lines.push(`- Probe: lite.duckduckgo.com for \`site:${SITE_HOST}\`. Two instruments read falsely here: `
    + "a scripted Bing site: query returns 200 containing only our own search string, and a plain bing.com "
    + "site: query in a Chinese locale ignores the operator and shows other sites. The reading that works is a "
    + "browser on bing.com/search with mkt=en-US, which is a parameter and not a preference.");
  return lines;
}

function readSitemapUrls() {
  const candidates = [
    "docs/sitemap.xml",
    resolve(dirname(fileURLToPath(import.meta.url)), "..", "docs", "sitemap.xml"),
  ];
  for (const path of candidates) {
    try {
      const xml = readFileSync(path, "utf8");
      return { urls: [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]), error: null };
    } catch {
      // try the next shape; a total miss is reported as an error, not as an empty list.
    }
  }
  return { urls: [], error: "docs/sitemap.xml could not be read" };
}

async function assessSearchCoverage() {
  const sitemap = readSitemapUrls();
  if (sitemap.error) return { ...sitemap, indexed: [] };
  try {
    const response = await fetch(
      `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(`site:${SITE_HOST}`)}`,
      {
        headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        signal: AbortSignal.timeout(30_000),
      },
    );
    const body = await response.text();
    const verdict = classifyProbeResponse(response.status, body);
    if (verdict.kind !== 'RESULTS') return { urls: sitemap.urls, indexed: [], error: verdict.error };
    return { urls: sitemap.urls, indexed: indexedSiteUrls(body), error: null };
  } catch (error) {
    return { urls: sitemap.urls, indexed: [], error: String(error?.message ?? error).slice(0, 80) };
  }
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

  if (!["check", "daily", "evidence", "summary", "campaign", "queues", "coverage"].includes(action)) {
    console.error(`Unsupported growth action: ${action}`);
    console.error(usage);
    process.exit(1);
  }

  ensureGhAvailable();
  if (action === "coverage") {
    const coverage = await assessSearchCoverage();
    console.log(`${searchCoverageLines(coverage.urls, coverage.indexed, { error: coverage.error }).join("\n")}\n`);
    return;
  }

  if (action === "queues") {
    const lines = await reportQueues();
    const nl = String.fromCharCode(10);
    const report = lines.join(nl);
    if (options.output) writeReport(options.output, report + nl);
    console.log(report);
    return;
  }
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
    const openPrDoorRepos = rows.filter((row) => row.state === "open" && row.kind !== "issue").map((row) => row.repo);
    const queues = await assessQueues(openPrDoorRepos);
    const reply = await collectReplyRequests(rows, ownerLogin);
    let report = generateCheckReport(repoStats, rows, date, previous, claimSweep, remoteSweep, deferred, untracked, denominatorTruncated, carriers, queues, reply);
    const coverage = await assessSearchCoverage();
    report += `\n${searchCoverageLines(coverage.urls, coverage.indexed, { error: coverage.error }).join("\n")}\n`;
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
