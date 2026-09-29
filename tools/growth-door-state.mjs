// One machine-readable line describing the growth doors, for the daily snapshot workflow.
//
// Why this exists: the two instruments that answer "did a listing land, are we closer to a topic page" run
// by hand, so a merged PR stayed invisible until someone thought to sweep. This wraps them in one call whose
// output is greppable in retained run logs, which is the same trick that turned the star series into data
// without asking for any new write permission.
//
//   node tools/growth-door-state.mjs [--output .tmp/growth/door-state.md]
//   node tools/growth-door-state.mjs --allow-unreadable   # exit 0 with the word "unreadable" printed
//   node tools/growth-door-state.mjs --presence <cmd> --topic <cmd>   # stubs, used by the test
//
// The rule it has to keep: a leg it could not read is reported as `unreadable`, never dropped. An omitted
// field would look like a smaller number of doors, which is how a blind probe gets mistaken for an absence.
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i > 0 && typeof process.argv[i + 1] === "string" ? process.argv[i + 1] : dflt;
};

const DEFAULT_PRESENCE = "tools/check-directory-presence.mjs";
const DEFAULT_TOPIC = "tools/check-topic-rank.mjs";

// Pure over the two tools' stdout, so the parsing is testable without touching the network.
export function parseDoorText({ presence, topic, presenceStatus, topicStatus }) {
  const text = (s) => (typeof s === "string" ? s : "");
  const out = { legs: {}, github: null, directories: null, stars: null, slots: null, topicRanked: null, winnable: null };
  const sum = /SUMMARY listed=(\d+) not_found=(\d+) undecidable=(\d+)/.exec(text(presence));
  if (sum) out.directories = { listed: Number(sum[1]), not_found: Number(sum[2]), undecidable: Number(sum[3]) };
  const gh = /"site": "https:\/\/github\.com\/mcp",\s*"verdict": "([A-Z_]+)"/.exec(text(presence));
  if (gh) out.github = gh[1];
  const header = /\n?(\S+) - (\d+) stars, (\d+)\/(\d+) topic slots used/.exec(text(topic));
  if (header) {
    out.stars = Number(header[2]);
    out.slots = header[3] + "/" + header[4];
  }
  const ranked = text(topic).split("\n").filter((line) => /\sranked\s+\d/.test(line)).length;
  if (text(topic).includes("state")) out.topicRanked = ranked;
  const win = /Page one within reach \(rank-30 needs <=100 stars\): ([^\n]*)/.exec(text(topic));
  if (win) out.winnable = win[1].trim();
  out.legs.presence = { status: presenceStatus, parsed: Boolean(out.directories && out.github) };
  out.legs.topic = { status: topicStatus, parsed: Boolean(out.stars !== null && out.topicRanked !== null && out.winnable !== null) };
  return out;
}

function value(v) {
  return v === null || v === undefined ? "unreadable" : String(v);
}

export function doorLine(parsed) {
  const d = parsed.directories;
  return "DOOR_STATE stars=" + value(parsed.stars) +
    " topic_slots=" + value(parsed.slots) +
    " topic_pages_ranked=" + value(parsed.topicRanked) +
    " directories_listed=" + (d ? d.listed : "unreadable") +
    " directories_not_found=" + (d ? d.not_found : "unreadable") +
    " directories_undecidable=" + (d ? d.undecidable : "unreadable") +
    " github_mcp=" + value(parsed.github) +
    " page_one_within_reach=" + (parsed.winnable === null ? "unreadable" : JSON.stringify(parsed.winnable || "none"));
}

function markdown(parsed, line) {
  const d = parsed.directories;
  return [
    "# Door state",
    "",
    "Read by `tools/growth-door-state.mjs`, which shells out to `tools/check-directory-presence.mjs --github-mcp`",
    "and `tools/check-topic-rank.mjs` and parses their stdout. Anything it could not read says `unreadable`",
    "rather than being left out, because a missing field would read as a smaller number of doors.",
    "",
    "```",
    line,
    "```",
    "",
    "- GitHub's own MCP directory entry: **" + value(parsed.github) + "** (absence here is measured against two controls; see the census page).",
    "- Directory listings found by the sitemap probes: " + (d ? "**" + d.listed + " listed**, " + d.not_found + " not found, " + d.undecidable + " undecidable" : "unreadable") + ".",
    "- Topic pages we appear on at all: " + value(parsed.topicRanked) + ". Stars needed for page one: " + (parsed.winnable === null ? "unreadable" : "`" + (parsed.winnable || "none") + "`") + ".",
    "",
  ].join("\n");
}

function run(cmd, args) {
  const r = spawnSync(process.execPath, [cmd, ...args], { encoding: "utf8", timeout: 10 * 60 * 1000 });
  // A null status means the child was killed (timeout), which must not be mistaken for a clean exit.
  const status = typeof r.status === "number" ? r.status : 124;
  return { stdout: typeof r.stdout === "string" ? r.stdout : "", status };
}

function main() {
  const presence = run(arg("--presence", DEFAULT_PRESENCE), ["--github-mcp"]);
  const topic = run(arg("--topic", DEFAULT_TOPIC), []);
  const parsed = parseDoorText({ presence: presence.stdout, topic: topic.stdout, presenceStatus: presence.status, topicStatus: topic.status });
  const line = doorLine(parsed);
  console.log(line);
  const unreadable = !parsed.legs.presence.parsed || !parsed.legs.topic.parsed;
  const out = arg("--output", null);
  if (out) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, markdown(parsed, line), "utf8");
    console.log("WROTE " + out);
  }
  if (unreadable) {
    console.error("NOTE: at least one leg was unreadable (presence exit " + presence.status + ", topic exit " + topic.status + "). Nothing is being claimed about those doors.");
    if (!process.argv.includes("--allow-unreadable")) return 5;
  }
  return 0;
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) process.exit(main());
export { DEFAULT_PRESENCE, DEFAULT_TOPIC };
