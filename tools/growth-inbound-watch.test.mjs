import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import {
  BOT_LOGIN,
  doorVerdict,
  exitCodeFor,
  gateFromBot,
  isBotUser,
  stateLine,
} from "./growth-inbound-watch.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const ME = "happy520ai";
const human = { login: "MikeMcC399", type: "User" };
const botAccount = { login: "coderabbitai[bot]", type: "Bot" };
const claBot = { login: "cla-bot", type: "User" }; // an app whose login says bot but whose type may not

const clean = { detail: { mergeable_state: "clean" }, issue: { pushed_at: null } };

test("the selftest arms all fire, and the arm list cannot quietly shrink", () => {
  // Pinned as a number and not only as "SELFTEST_OK": an instrument that covers less still prints OK,
  // and a watch that silently stops watching is worse than one that fails.
  const r = spawnSync(process.execPath, ["tools/growth-inbound-watch.mjs", "--selftest"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /SELFTEST_OK/);
  const arms = r.stdout.split("\n").find((l) => l.startsWith("selftest ")).split(" ").slice(1);
  assert.ok(arms.length >= 17, "expected at least 17 calibration arms, saw " + arms.length + ": " + arms.join(" "));
  assert.ok(arms.every((a) => a.endsWith("=true")), "an arm printed false: " + arms.filter((a) => !a.endsWith("=true")).join(","));
});

test("speech is a comment being created, not the same comment edited", () => {
  // The false positives that started this instrument: three of four flagged doors were a bot re-editing
  // its own summary and one was a maintainer editing their own words hours after we had answered.
  const due = doorVerdict({ ...clean, comments: [
    { user: { login: ME }, created_at: "2026-01-01T00:00:00Z" },
    { user: human, created_at: "2026-01-03T00:00:00Z" },
  ] });
  assert.equal(due.verdict, "reply-due");
  const edited = doorVerdict({ ...clean, comments: [
    { user: { login: ME }, created_at: "2026-01-05T00:00:00Z" },
    { user: human, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-06T00:00:00Z" },
  ] });
  assert.equal(edited.verdict, "waiting-on-them");
  // Counted rather than dropped: an edit can add substance, and a reader must be able to see it happened.
  assert.equal(edited.edits, 1);
});

test("a bot is recognised by login shape as well as account type", () => {
  assert.equal(isBotUser(botAccount), true);
  assert.equal(isBotUser(claBot), true); // login ends in "-bot" even though type says User
  assert.equal(isBotUser(human), false);
  assert.equal(isBotUser({ login: ME }), false);
  assert.equal(isBotUser(undefined), false);
  assert.match(BOT_LOGIN.source, /bot/u);
  const bots = doorVerdict({ ...clean, comments: [
    { user: botAccount, created_at: "2026-01-09T00:00:00Z", updated_at: "2026-01-10T00:00:00Z", body: "No actionable comments were generated" },
  ] });
  assert.equal(bots.verdict, "waiting-on-them");
  assert.equal(bots.botEvents, 1);
  // An event whose author cannot be read is treated as speech from a person, because the alternative -
  // filing it under "bot" and moving on - is how a real maintainer question gets swallowed by a filter.
  const unattributed = doorVerdict({ ...clean, comments: [{ created_at: "2026-01-09T00:00:00Z", body: "can you rebase?" }] });
  assert.equal(unattributed.verdict, "reply-due");
});

test("a stated requirement outranks our own prose, and a person clears it", () => {
  // The ordering bug the live run caught: an owner-gate arm written as "gate and we have never spoken"
  // is unreachable on every door we have replied to, which is all of them.
  const gate = doorVerdict({ ...clean, comments: [
    { user: claBot, created_at: "2026-01-01T00:00:00Z", body: "We require contributors to sign our Contributor License Agreement" },
    { user: { login: ME }, created_at: "2026-01-05T00:00:00Z", body: "handing this to the account owner" },
  ] });
  assert.equal(gate.verdict, "owner-gate");
  assert.match(gate.why, /CLA/u);
  const cleared = doorVerdict({ ...clean, comments: [
    { user: claBot, created_at: "2026-01-01T00:00:00Z", body: "sign our CLA" },
    { user: { login: ME }, created_at: "2026-01-05T00:00:00Z", body: "done" },
    { user: human, created_at: "2026-01-03T00:00:00Z", body: "CLA waiver approved for this one" },
  ] });
  assert.equal(cleared.verdict, "waiting-on-them");
  // A maintainer signing off is the opposite signal and must not be filed as a requirement.
  assert.equal(gateFromBot("LGTM, signed off by the maintainer"), null);
  assert.equal(gateFromBot("This PR has a merge conflict."), "merge conflict");
});

test("a push answers a requested change without any prose", () => {
  const v = doorVerdict({
    detail: { mergeable_state: "clean" }, issue: { pushed_at: "2026-01-09T00:00:00Z" }, comments: [],
    reviews: [{ user: human, submitted_at: "2026-01-04T00:00:00Z", state: "CHANGES_REQUESTED" }],
  });
  assert.equal(v.verdict, "waiting-on-them");
  assert.equal(v.newestMine, "2026-01-09T00:00:00Z");
});

test("a reviewer's inline comment is surfaced, but not as a question we owe", () => {
  // The third stream GitHub exposes for a pull request is /pulls/N/comments - line-level review comments. The
  // watch read only the conversation and the reviews, so a maintainer asking for one line to change was
  // invisible and reply_due=0 was a reading of two of the three streams.
  const open = doorVerdict({
    detail: { mergeable_state: "clean" }, issue: { pushed_at: null }, comments: [], reviews: [],
    inline: [{ user: human, created_at: "2026-01-04T00:00:00Z", path: "docs/x.md", line: 12 }],
  });
  assert.equal(open.verdict, "inline-newer");
  assert.equal(open.newestInline, "2026-01-04T00:00:00Z");
  assert.match(open.why, /thread state is not readable over REST/u,
    "the category must say what it cannot know: an answered thread looks identical to this endpoint");
  // Answered by a push: the newest thing we did is newer than the comment, so nothing is outstanding.
  const answered = doorVerdict({
    detail: { mergeable_state: "clean" }, issue: { pushed_at: "2026-01-09T00:00:00Z" }, comments: [], reviews: [],
    inline: [{ user: human, created_at: "2026-01-04T00:00:00Z" }],
  });
  assert.equal(answered.verdict, "waiting-on-them");
  // A public comment still outranks an inline one, so the loud stream wins the category.
  const both = doorVerdict({
    detail: { mergeable_state: "clean" }, issue: { pushed_at: null },
    comments: [{ user: human, created_at: "2026-01-08T00:00:00Z" }], reviews: [],
    inline: [{ user: human, created_at: "2026-01-04T00:00:00Z" }],
  });
  assert.equal(both.verdict, "reply-due");
  // inlineNewer stays true here, and that is the honest reading: our side has done nothing since either
  // comment, so both are outstanding even though only the louder one names the category. An earlier
  // expectation of `false` assumed a reply we never made in this fixture.
  assert.equal(both.inlineNewer, true);
  assert.equal(both.newestInline, "2026-01-04T00:00:00Z");
});

test("an advisory review door is named, while an ordinary read failure is still unreadable", () => {
  // Boundary target for the unreadable arm: without it the private-review door would sit in that bucket
  // forever, and a permanent warning is how a real one gets ignored.
  const advisory = doorVerdict({ detail: null, issue: null, comments: [], reviews: [], readFailures: ["comments"],
    repo: "happy520ai/unified-ai-system-ghsa-rg4w-29r7-h4rh" });
  assert.equal(advisory.verdict, "private-review");
  const broken = doorVerdict({ detail: null, issue: null, comments: [], reviews: [], readFailures: ["comments"], repo: "pnpm/pnpm.io" });
  assert.equal(broken.verdict, "unreadable");
});

test("zero doors is a broken read, never an empty queue", () => {
  const empty = stateLine([], true);
  assert.match(empty, /SEARCH-UNREADABLE/u);
  assert.doesNotMatch(empty, /doors=0/u, "an instrument must not print a count it did not observe");
  const ok = stateLine([{ verdict: "waiting-on-them", botEvents: 1, edits: 0 }, { verdict: "reply-due", botEvents: 0, edits: 2 }], true);
  assert.match(ok, /doors=2 reply_due=1 owner_gate=0 waiting=1 private_review=0 inline_newer=0 change_requested=0 conflicts=0 edits_to_read=0 unreadable=0 bot_events_excluded=1 foreign_edits_seen=2 verdict=SWEEP-COMPLETE/u);
});

test("the exit codes separate a lost queue from a partial one", () => {
  assert.equal(exitCodeFor({ readable: false, rows: [], allowUnreadable: true }), 4);
  assert.equal(exitCodeFor({ readable: true, rows: [], allowUnreadable: true }), 4);
  const partial = [{ verdict: "unreadable" }, { verdict: "waiting-on-them" }];
  assert.equal(exitCodeFor({ readable: true, rows: partial, allowUnreadable: false }), 5);
  assert.equal(exitCodeFor({ readable: true, rows: partial, allowUnreadable: true }), 0);
  assert.equal(exitCodeFor({ readable: true, rows: [{ verdict: "reply-due" }], allowUnreadable: false }), 0,
    "a door someone may want to talk to us about is news, not a build break");
});
