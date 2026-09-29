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
const DEFAULT_CARRIERS = "tools/check-carrier-presence.mjs";
const DEFAULT_INBOUND = "tools/growth-inbound-watch.mjs";

// Pure over the two tools' stdout, so the parsing is testable without touching the network.
export function parseDoorText({ presence, topic, carriers, inbound, presenceStatus, topicStatus, carriersStatus, inboundStatus }) {
  const text = (s) => (typeof s === "string" ? s : "");
  const out = { legs: {}, github: null, directories: null, stars: null, slots: null, topicRanked: null, winnable: null, carriers: null, inbound: null };
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
  // "merged" and "in front of a visitor" are different facts, so the carrier leg is reported separately from
  // the directory leg and never folded into it.
  const car = /CARRIER_SUMMARY listed=(\d+) watchlisted=(\d+) absent=(\d+) unreadable=(\d+)/.exec(text(carriers));
  if (car) out.carriers = { listed: Number(car[1]), watchlisted: Number(car[2]), absent: Number(car[3]), unreadable: Number(car[4]) };
  // The inbound leg keeps its fields as strings, because "unreadable" is one of its legitimate values and
  // Number("unreadable") would turn a blind read into a NaN that looks like a zero. Parsed by field name
  // rather than by position: the watch emits new categories as it learns (inline review comments arrived as
  // one), and a positional regex makes adding a field look like the leg going blind.
  const inbLine = /^INBOUND_STATE .*$/mu.exec(text(inbound));
  const inbField = (name) => {
    if (!inbLine) return null;
    const one = new RegExp(name + "=(\\S+)").exec(inbLine[0]);
    return one ? one[1] : null;
  };
  if (inbLine && inbField("doors")) {
    out.inbound = { doors: inbField("doors"), replyDue: inbField("reply_due"), ownerGate: inbField("owner_gate"),
      waiting: inbField("waiting"), privateReview: inbField("private_review"), inlineNewer: inbField("inline_newer"),
      changeRequested: inbField("change_requested"), conflicts: inbField("conflicts"),
      unreadable: inbField("unreadable") };
    for (const [key, value2] of Object.entries(out.inbound)) if (value2 === null) out.inbound[key] = "unreadable";
  }
  out.legs.presence = { status: presenceStatus, parsed: Boolean(out.directories && out.github) };
  out.legs.topic = { status: topicStatus, parsed: Boolean(out.stars !== null && out.topicRanked !== null && out.winnable !== null) };
  out.legs.carriers = { status: carriersStatus, parsed: Boolean(out.carriers) };
  out.legs.inbound = { status: inboundStatus, parsed: Boolean(out.inbound) && out.inbound?.doors !== "unreadable" };
  return out;
}

function value(v) {
  return v === null || v === undefined ? "unreadable" : String(v);
}

export function doorLine(parsed) {
  const d = parsed.directories;
  const c = parsed.carriers;
  const i = parsed.inbound;
  return "DOOR_STATE stars=" + value(parsed.stars) +
    " topic_slots=" + value(parsed.slots) +
    " topic_pages_ranked=" + value(parsed.topicRanked) +
    " directories_listed=" + (d ? d.listed : "unreadable") +
    " directories_not_found=" + (d ? d.not_found : "unreadable") +
    " directories_undecidable=" + (d ? d.undecidable : "unreadable") +
    " carriers_listed=" + (c ? c.listed : "unreadable") +
    " carriers_watchlisted=" + (c ? c.watchlisted : "unreadable") +
    " carriers_absent=" + (c ? c.absent : "unreadable") +
    " carriers_unreadable=" + (c ? c.unreadable : "unreadable") +
    " inbound_doors=" + (i ? i.doors : "unreadable") +
    " inbound_reply_due=" + (i ? i.replyDue : "unreadable") +
    " inbound_owner_gate=" + (i ? i.ownerGate : "unreadable") +
    " inbound_inline_newer=" + (i ? i.inlineNewer : "unreadable") +
    " inbound_change_requested=" + (i && i.changeRequested != null ? i.changeRequested : "unreadable") +
    " inbound_conflicts=" + (i && i.conflicts != null ? i.conflicts : "unreadable") +
    " inbound_unreadable=" + (i ? i.unreadable : "unreadable") +
    " github_mcp=" + value(parsed.github) +
    " page_one_within_reach=" + (parsed.winnable === null ? "unreadable" : JSON.stringify(parsed.winnable || "none"));
}

function markdown(parsed, line) {
  const d = parsed.directories;
  return [
    "# Door state",
    "",
    "Read by `tools/growth-door-state.mjs`, which shells out to `tools/check-directory-presence.mjs --github-mcp --smithery`,",
    "`tools/check-topic-rank.mjs`, `tools/check-carrier-presence.mjs` and `tools/growth-inbound-watch.mjs`, and",
    "parses their stdout. Anything it could not read says `unreadable` rather than being left out, because a",
    "missing field would read as a smaller number of doors.",
    "",
    "```",
    line,
    "```",
    "",
    "- GitHub's own MCP directory entry: **" + value(parsed.github) + "** (absence here is measured against two controls; see the census page).",
    "- Directory listings found by the sitemap probes: " + (d ? "**" + d.listed + " listed**, " + d.not_found + " not found, " + d.undecidable + " undecidable" : "unreadable") + ".",
    "- Topic pages we appear on at all: " + value(parsed.topicRanked) + ". Stars needed for page one: " + (parsed.winnable === null ? "unreadable" : "`" + (parsed.winnable || "none") + "`") + ".",
    "- Carriers that merged us and still show it: " + (parsed.carriers
      ? "**" + parsed.carriers.listed + " in a catalogue**, " + parsed.carriers.watchlisted + " only in a staging file, " + parsed.carriers.absent + " absent, " + parsed.carriers.unreadable + " unreadable"
      : "unreadable") + ".",
    // A door someone has spoken to us about is a different kind of news than a door that is merely waiting,
    // so it is its own sentence and is never folded into the directory counts above.
    "- Open pull requests in other people's repositories: " + (parsed.inbound
      ? "**" + parsed.inbound.replyDue + " awaiting a reply from us**, " + parsed.inbound.waiting + " waiting on the other side, " + parsed.inbound.ownerGate + " blocked on something only the account owner can do, " + parsed.inbound.inlineNewer + " with a reviewer's line comment newer than anything we did" + (parsed.inbound.changeRequested === "unreadable" ? "" : ", " + parsed.inbound.changeRequested + " whose most recent human review still asks for changes") + ", " + parsed.inbound.privateReview + " private security review, " + (parsed.inbound.conflicts === "unreadable" ? "conflict count unreadable, " : parsed.inbound.conflicts + " carrying a merge conflict, ") + parsed.inbound.unreadable + " unreadable"
      : "unreadable") + ".",
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
  const presence = run(arg("--presence", DEFAULT_PRESENCE), ["--github-mcp", "--smithery"]);
  const topic = run(arg("--topic", DEFAULT_TOPIC), []);
  const carriers = run(arg("--carriers", DEFAULT_CARRIERS), []);
  // The child runs with its own partial tolerance: one door whose comments this token cannot read is not a
  // failed night, but the number still reaches the line, so the blindness is on the record.
  const inbound = run(arg("--inbound", DEFAULT_INBOUND), ["--allow-unreadable"]);
  const parsed = parseDoorText({ presence: presence.stdout, topic: topic.stdout, carriers: carriers.stdout, inbound: inbound.stdout, presenceStatus: presence.status, topicStatus: topic.status, carriersStatus: carriers.status, inboundStatus: inbound.status });
  const line = doorLine(parsed);
  console.log(line);
  if (parsed.inbound && parsed.inbound.replyDue !== "0") {
    console.log("INBOUND: " + parsed.inbound.replyDue + " door(s) have a person speaking to us that we have not answered. " +
      "That is the one growth number that decays if nobody acts on it.");
  }
  const unreadable = !parsed.legs.presence.parsed || !parsed.legs.topic.parsed || !parsed.legs.carriers.parsed || !parsed.legs.inbound.parsed;
  const out = arg("--output", null);
  if (out) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, markdown(parsed, line), "utf8");
    console.log("WROTE " + out);
  }
  if (unreadable) {
    console.error("NOTE: at least one leg was unreadable (presence exit " + presence.status + ", topic exit " + topic.status +
      ", carriers exit " + carriers.status + ", inbound exit " + inbound.status + "). Nothing is being claimed about those doors.");
    if (!process.argv.includes("--allow-unreadable")) return 5;
  }
  return 0;
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) process.exit(main());
export { DEFAULT_PRESENCE, DEFAULT_TOPIC };
