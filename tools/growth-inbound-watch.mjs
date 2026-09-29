// Inbound watch on the outbound queue: for every pull request we opened in someone else's repository,
// say whether anyone there has spoken to us since we last did something about it.
//
// Why this exists: 31 doors are only worth what they convert to, and a door converts when a maintainer's
// question gets an answer while they still remember asking it. The presence probes answer "did a listing
// land"; nothing answered "did someone speak to us", so the answer was whatever a manual sweep happened to
// catch. The first sweep found four doors flagged and none of them were real: three were a bot re-editing
// its own summary, one was a maintainer editing their own comment. That is the shape of a watch that cries
// wolf, so the classification is the load-bearing part and it is pure and tested:
//
//   - speech is a comment or review being *created*; an edit of an old comment is not, and is counted
//     separately so nothing is dropped silently,
//   - a bot is a bot by account type or login shape, and a human is a human - the people whose doors we
//     can actually lose are people,
//   - a bot that states a requirement (a CLA, a rebase, a merge conflict) is an owner-gate, reported as
//     its own category rather than folded into "waiting",
//   - a door whose reads failed is `unreadable`, never absent, and an empty search is a read failure:
//     "zero doors" must never be reachable by a query that returned nothing.
//
//   node tools/growth-inbound-watch.mjs                     # one INBOUND_STATE line + the named doors
//   node tools/growth-inbound-watch.mjs --allow-unreadable  # exit 0, but the line says unreadable
//   node tools/growth-inbound-watch.mjs --selftest          # each arm fires on a planted fixture
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const ME = "happy520ai";
export const BOT_LOGIN = /(?:\[bot\]$|bot$|-bot)/u;

// A requirement stated on our behalf, not a question to answer in prose. Matched on purpose-built
// phrases rather than any sentence containing "sign", because a maintainer signing off is the opposite
// signal and must not be filed as a gate.
export const GATE_PHRASES = [
  [/contributor license agreement/iu, "CLA"],
  [/\bcla\b/iu, "CLA"],
  [/we require contributors/iu, "contributor agreement"],
  [/please (?:rebase|update this branch|resolve)/iu, "rebase or conflict"],
  [/merge conflict/iu, "merge conflict"],
];

export function isBotUser(user) {
  return String(user?.type ?? "") === "Bot" || BOT_LOGIN.test(String(user?.login ?? ""));
}

export function gateFromBot(body) {
  for (const [re, label] of GATE_PHRASES) if (re.test(String(body ?? ""))) return label;
  return null;
}

const stamps = (list, pick) => list.map(pick).filter((s) => typeof s === "string" && s.length > 0);

// Pure over the payloads GitHub returns, so every branch is testable without a network.
export function doorVerdict({ detail, issue, comments = [], reviews = [], inline = [], readFailures = [], repo = "" }) {
  // A GitHub security-advisory review lives in a private repository whose comment endpoints answer 404 to
  // any token, including this one. That is not an instrument failure and not a door awaiting anything, so
  // it gets its own named category - the alternative is a permanent `unreadable` that trains the reader to
  // ignore the word when a real read breaks.
  if (/[-/]ghsa-/u.test(repo)) {
    return { verdict: "private-review", why: "advisory review, its comments are not readable with this token", botEvents: 0, edits: 0, state: "private" };
  }
  if (readFailures.length > 0 || !detail) {
    return { verdict: "unreadable", why: readFailures.join(",") || "pull details unreadable", botEvents: 0, edits: 0, state: "?" };
  }
  const mine = (u) => String(u?.login ?? "") === ME;
  const foreign = [];
  const own = [];
  let botEvents = 0;
  let edits = 0;
  for (const c of comments) {
    if (mine(c.user)) { own.push(c.created_at); continue; }
    if (isBotUser(c.user)) {
      botEvents += 1;
      const gate = gateFromBot(c.body);
      if (gate) foreign.push({ at: c.created_at, kind: "gate", detail: gate });
      continue;
    }
    foreign.push({ at: c.created_at, kind: "speech" });
    // An edit is the maintainer changing their own words; it may matter but it is not a reply owed.
    if (typeof c.updated_at === "string" && typeof c.created_at === "string" && c.updated_at > c.created_at) edits += 1;
  }
  for (const r of reviews) {
    if (mine(r.user)) { own.push(r.submitted_at); continue; }
    if (isBotUser(r.user)) { botEvents += 1; continue; }
    foreign.push({ at: r.submitted_at, kind: "review " + String(r.state ?? "?").toLowerCase() });
  }
  // Inline review comments are the third stream, and often where a reviewer asks for a change to one line.
  // They are kept out of the reply-due reading on purpose: REST reports the comment but not whether its thread
  // was resolved - only GraphQL carries isResolved - so treating every inline comment as unanswered would
  // produce false alarms that get this watch muted, while ignoring the stream was the blind spot closing it.
  let newestInline = null;
  for (const c of inline) {
    if (mine(c.user) || isBotUser(c.user)) continue;
    if (!newestInline || String(c.created_at) > String(newestInline)) newestInline = c.created_at;
  }
  // A push answers a requested change without any prose, so it counts as our most recent action too.
  if (typeof issue?.pushed_at === "string") own.push(issue.pushed_at);
  const newest = (list) => list.slice().sort().pop() || null;
  const newestForeign = newest(foreign.map((f) => f.at));
  const newestMine = newest(own);
  const gate = foreign.filter((f) => f.kind === "gate").sort((a, b) => String(b.at).localeCompare(String(a.at)))[0] || null;
  const speech = foreign.filter((f) => f.kind !== "gate");
  const newestSpeech = newest(speech.map((f) => f.at));
  const replyDue = Boolean(newestSpeech && (!newestMine || newestSpeech > newestMine));
  // A stated requirement is standing until a person says otherwise. Prose from us does not sign a CLA or
  // clear a conflict, so the gate must not be outranked by our own comment - which is the ordering bug
  // that made this arm unreachable on every door where we had already replied.
  const gateStanding = Boolean(gate && (!newestSpeech || String(newestSpeech) < String(gate.at)));
  // Newer than anything we did, so it may be an open question - or an answered one whose thread this endpoint
  // cannot see. Named as its own category rather than folded into reply-due for that reason.
  const inlineNewer = Boolean(newestInline && (!newestMine || String(newestInline) > String(newestMine)));
  return {
    verdict: replyDue ? "reply-due" : gateStanding ? "owner-gate" : inlineNewer ? "inline-newer" : "waiting-on-them",
    why: replyDue ? "a person spoke at " + newestSpeech
      : gateStanding ? "gate: " + gate.detail
      : inlineNewer ? "a person reviewed a line at " + newestInline + "; thread state is not readable over REST"
      : "nothing newer on our side",
    newestForeign,
    newestMine,
    newestSpeech,
    newestInline,
    inlineNewer,
    botEvents,
    edits,
    state: String(detail.mergeable_state ?? detail.state ?? "?"),
    decision: String(detail.review_decision ?? "?"),
  };
}

export function stateLine(rows, searchReadable = true) {
  const count = (v) => rows.filter((r) => r.verdict === v).length;
  const unreadable = count("unreadable");
  const botEvents = rows.reduce((s, r) => s + (r.botEvents || 0), 0);
  const edits = rows.reduce((s, r) => s + (r.edits || 0), 0);
  // An empty set is a broken read, never "no doors". A directory listing that returns nothing and a
  // directory that has none are different statements and only the second one is news.
  if (!searchReadable || rows.length === 0) {
    return "INBOUND_STATE doors=unreadable reply_due=unreadable owner_gate=unreadable waiting=unreadable " +
      "private_review=unreadable inline_newer=unreadable unreadable=" + unreadable + " bot_events_excluded=" + botEvents +
      " foreign_edits_seen=" + edits + " verdict=SEARCH-UNREADABLE";
  }
  return "INBOUND_STATE doors=" + rows.length +
    " reply_due=" + count("reply-due") +
    " owner_gate=" + count("owner-gate") +
    " waiting=" + count("waiting-on-them") +
    " private_review=" + count("private-review") +
    " inline_newer=" + count("inline-newer") +
    " unreadable=" + unreadable +
    " bot_events_excluded=" + botEvents +
    " foreign_edits_seen=" + edits +
    " verdict=" + (unreadable > 0 ? "PARTIAL-SWEEP" : "SWEEP-COMPLETE");
}

const gh = (path) => {
  const r = spawnSync("gh", ["api", path], { encoding: "utf8", maxBuffer: 1 << 26, timeout: 60_000 });
  if (r.error || r.status !== 0) {
    return { data: null, why: String(r.error?.message ?? (r.stderr || "").trim().slice(0, 80) ?? "gh api failed").replace(/\s+/gu, " ") };
  }
  try {
    return { data: JSON.parse(r.stdout), why: null };
  } catch {
    return { data: null, why: "unparseable response" };
  }
};

function sweep(ourRepo) {
  const found = gh("search/issues?q=is%3Apr+author%3A" + ME + "+is%3Aopen+-repo%3A" + encodeURIComponent(ourRepo) + "&per_page=100");
  if (!found.data || !Array.isArray(found.data.items)) {
    return { rows: [], readable: false, why: "search leg: " + (found.why ?? "no items array") };
  }
  const rows = found.data.items.map((item) => {
    const repo = item.repository_url.split("/repos/")[1];
    const number = item.number;
    const readFailures = [];
    const grab = (what, path) => {
      const got = gh(path);
      if (!got.data) readFailures.push(what);
      return got.data;
    };
    const detail = grab("pull details", "repos/" + repo + "/pulls/" + number);
    const issue = grab("issue (for pushed_at)", "repos/" + repo + "/issues/" + number);
    const comments = grab("comments", "repos/" + repo + "/issues/" + number + "/comments?per_page=100") ?? [];
    const reviews = grab("reviews", "repos/" + repo + "/pulls/" + number + "/reviews?per_page=100") ?? [];
    const inline = grab("review comments", "repos/" + repo + "/pulls/" + number + "/comments?per_page=100") ?? [];
    const capped = comments.length >= 100 || reviews.length >= 100 || inline.length >= 100;
    const v = doorVerdict({ detail, issue, comments, reviews, inline, readFailures, repo });
    if (capped && v.verdict !== "unreadable") v.why += " | comment page full, only the tail was read";
    return { ...v, door: repo + "#" + number, capped, title: String(item.title ?? "").slice(0, 70) };
  });
  return { rows, readable: found.data.items.length > 0, why: null };
}

export function selftest() {
  // Each arm gets a fixture that makes it produce the opposite of what the shipped queue reports.
  const human = { login: "maintainer", type: "User" };
  const bot = { login: "cla-bot", type: "Bot" };
  const arms = {};
  arms.speech_after_me_is_reply_due = doorVerdict({
    detail: { mergeable_state: "clean" }, issue: { pushed_at: "2026-01-02T00:00:00Z" },
    comments: [{ user: { login: ME }, created_at: "2026-01-01T00:00:00Z" }, { user: human, created_at: "2026-01-03T00:00:00Z" }],
  }).verdict === "reply-due";
  // The false positive that started this: an edit is not a reply owed.
  arms.edit_alone_is_not_reply_due = doorVerdict({
    detail: { mergeable_state: "clean" }, issue: { pushed_at: null },
    comments: [{ user: { login: ME }, created_at: "2026-01-05T00:00:00Z" },
      { user: human, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-06T00:00:00Z" }],
  }).verdict === "waiting-on-them";
  arms.bot_summary_edit_is_excluded = doorVerdict({
    detail: { mergeable_state: "unstable" }, issue: { pushed_at: null },
    comments: [{ user: { login: "coderabbitai[bot]", type: "Bot" }, created_at: "2026-01-09T00:00:00Z", updated_at: "2026-01-10T00:00:00Z", body: "No actionable comments" }],
  }).verdict === "waiting-on-them";
  arms.cla_bot_is_an_owner_gate = doorVerdict({
    detail: { mergeable_state: "blocked" }, issue: { pushed_at: null },
    comments: [{ user: bot, created_at: "2026-01-01T00:00:00Z", body: "We require contributors to sign our Contributor License Agreement" }],
  }).verdict === "owner-gate";
  // The ordering bug this arm exists for: our own reply must not outrank a requirement we cannot satisfy
  // by writing prose. Without it the owner-gate category is unreachable on every door we have spoken on.
  arms.gate_stands_after_our_own_comment = doorVerdict({
    detail: { mergeable_state: "blocked" }, issue: { pushed_at: null },
    comments: [{ user: bot, created_at: "2026-01-01T00:00:00Z", body: "sign our CLA" },
      { user: { login: ME }, created_at: "2026-01-05T00:00:00Z", body: "understood, handing this to the account owner" }],
  }).verdict === "owner-gate";
  // Boundary target for the same arm: a person speaking after the requirement is what clears it.
  arms.human_after_the_gate_clears_it = doorVerdict({
    detail: { mergeable_state: "blocked" }, issue: { pushed_at: null },
    comments: [{ user: bot, created_at: "2026-01-01T00:00:00Z", body: "sign our CLA" },
      { user: { login: ME }, created_at: "2026-01-05T00:00:00Z", body: "done" },
      { user: human, created_at: "2026-01-03T00:00:00Z", body: "CLA waiver approved for this one" }],
  }).verdict === "waiting-on-them";
  arms.advisory_repo_is_named_not_blind = doorVerdict({
    detail: null, issue: null, comments: [], reviews: [], readFailures: ["comments"],
    repo: "happy520ai/unified-ai-system-ghsa-rg4w-29r7-h4rh",
  }).verdict === "private-review";
  arms.ordinary_repo_read_failure_still_unreadable = doorVerdict({
    detail: null, issue: null, comments: [], reviews: [], readFailures: ["comments"], repo: "pnpm/pnpm.io",
  }).verdict === "unreadable";
  arms.approved_human_is_not_a_gate = gateFromBot("LGTM, signed off by the maintainer") === null;
  arms.a_push_answers_a_review = doorVerdict({
    detail: { mergeable_state: "clean" }, issue: { pushed_at: "2026-01-09T00:00:00Z" },
    comments: [], reviews: [{ user: human, submitted_at: "2026-01-04T00:00:00Z", state: "CHANGES_REQUESTED" }],
  }).verdict === "waiting-on-them";
  arms.read_failure_is_unreadable = doorVerdict({
    detail: null, issue: null, comments: [], reviews: [], readFailures: ["comments"],
  }).verdict === "unreadable";
  arms.empty_search_is_not_zero_doors = stateLine([], false).includes("SEARCH-UNREADABLE") && stateLine([], true).includes("SEARCH-UNREADABLE");
  arms.unreadable_door_keeps_its_name = stateLine([{ verdict: "unreadable", botEvents: 0, edits: 0 }, { verdict: "waiting-on-them", botEvents: 2, edits: 1 }]).match(/doors=2 .*unreadable=1 .*bot_events_excluded=2 .*foreign_edits_seen=1/) !== null;
  // The inline leg: a reviewer's comment on one line is named as its own category, because the REST endpoint
  // reports the comment but not whether the thread was resolved. Folding it into reply-due would alarm on
  // answered questions; ignoring it was the blind spot.
  arms.inline_comment_is_named_not_alarming = doorVerdict({
    detail: { mergeable_state: "clean" }, issue: { pushed_at: null }, comments: [], reviews: [],
    inline: [{ user: human, created_at: "2026-01-04T00:00:00Z", path: "README.md" }],
  }).verdict === "inline-newer";
  arms.inline_answered_by_a_push_is_quiet = doorVerdict({
    detail: { mergeable_state: "clean" }, issue: { pushed_at: "2026-01-09T00:00:00Z" }, comments: [], reviews: [],
    inline: [{ user: human, created_at: "2026-01-04T00:00:00Z", path: "README.md" }],
  }).verdict === "waiting-on-them";
  arms.inline_from_a_bot_is_excluded = doorVerdict({
    detail: { mergeable_state: "clean" }, issue: { pushed_at: null }, comments: [], reviews: [],
    inline: [{ user: { login: "copilot-pull-request-reviewer[bot]", type: "Bot" }, created_at: "2026-01-04T00:00:00Z" }],
  }).verdict === "waiting-on-them";
  arms.reply_due_outranks_an_inline_comment = doorVerdict({
    detail: { mergeable_state: "clean" }, issue: { pushed_at: null },
    comments: [{ user: human, created_at: "2026-01-08T00:00:00Z" }], reviews: [],
    inline: [{ user: human, created_at: "2026-01-04T00:00:00Z" }],
  }).verdict === "reply-due";
  const failed = Object.entries(arms).filter(([, ok]) => !ok).map(([n]) => n);
  console.log("selftest " + Object.entries(arms).map(([n, ok]) => n + "=" + ok).join(" "));
  console.log(failed.length === 0 ? "SELFTEST_OK" : "SELFTEST_FAILED missing=" + failed.join(","));
  return failed.length === 0 ? 0 : 1;
}

// The refusal shapes, as a function, so a test can make each one happen without a network. 4 means the
// queue itself was not read, 5 means part of it was - neither is allowed to look like a count of doors.
export function exitCodeFor({ readable, rows, allowUnreadable }) {
  if (!readable || rows.length === 0) return 4;
  if (rows.some((r) => r.verdict === "unreadable")) return allowUnreadable ? 0 : 5;
  return 0;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--selftest")) return selftest();
  const ourRepo = arg("--repo", "happy520ai/unified-ai-system");
  const { rows, readable, why } = sweep(ourRepo);
  for (const r of rows) {
    if (r.verdict === "waiting-on-them") continue;
    console.log(r.verdict.toUpperCase().padEnd(14) + String(r.door).padEnd(46) + " " + String(r.state).padEnd(10) +
      " " + r.why + (r.title ? "  | " + r.title : ""));
  }
  const quiet = rows.filter((r) => r.verdict === "waiting-on-them").length;
  console.log("(not printed individually: " + quiet + " doors waiting on the other side)");
  console.log(stateLine(rows, readable));
  const code = exitCodeFor({ readable, rows, allowUnreadable: argv.includes("--allow-unreadable") });
  if (code === 4) console.error("REFUSED: " + (why ?? "the search leg returned nothing usable"));
  if (code === 5) console.error("NOTE: at least one door could not be read. Nothing is being claimed about it.");
  return code;
}

function arg(name, dflt) {
  const i = process.argv.indexOf(name);
  return i > 0 && typeof process.argv[i + 1] === "string" ? process.argv[i + 1] : dflt;
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) process.exit(main());
