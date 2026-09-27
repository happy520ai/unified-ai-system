import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { evaluateQuestion } from "./mcp-measurement-guard.mjs";

const q = { id: "fixture", title: "Fixture question", script: "tools/fixture.mjs" };

describe("measurement dataset arithmetic guard", () => {
  it("accepts rows labelled verdict", () => {
    const { block, failure } = evaluateQuestion(q, {
      attempted: 2,
      tally: { ok: 1, refused: 1 },
      rows: [{ verdict: "ok" }, { verdict: "refused" }],
    });
    assert.equal(failure, undefined);
    assert.equal(block.row_label_field, "verdict");
    assert.deepEqual(block.verdicts, { ok: 1, refused: 1 });
  });

  it("accepts rows labelled outcome, which is what the pagination survey actually emits", () => {
    // Regression with a real cause: the builder first assumed one field name across all five scripts,
    // counted `undefined` for every row of the pagination survey, and refused a run that was fine.
    const { block, failure } = evaluateQuestion(q, {
      attempted: 2,
      tally: { auth_required: 2 },
      rows: [{ outcome: "auth_required", name: "a" }, { outcome: "auth_required", name: "b" }],
    });
    assert.equal(failure, undefined);
    assert.equal(block.row_label_field, "outcome");
    assert.equal(block.attempted, 2);
  });

  it("refuses a tally that claims one more answer than there are rows", () => {
    // The #180 numbers, as a fixture: a page once said 2/19 beside an 18-row tally.
    const { block, failure } = evaluateQuestion(q, {
      attempted: 19,
      tally: { supported: 14, rejected: 2, echoed: 2, unavailable: 1 },
      rows: [
        ...Array.from({ length: 14 }, () => ({ verdict: "supported" })),
        ...Array.from({ length: 2 }, () => ({ verdict: "rejected" })),
        ...Array.from({ length: 2 }, () => ({ verdict: "echoed" })),
      ],
    });
    assert.equal(block, undefined);
    assert.equal(failure.status, "arithmetic");
    assert.match(failure.stderr, /sum=19 rows=18/);
  });

  it("refuses a bucket no row carries, even when the totals match", () => {
    const { failure } = evaluateQuestion(q, {
      attempted: 2,
      tally: { x: 1, y: 1 },
      rows: [{ verdict: "x" }, { verdict: "x" }],
    });
    assert.equal(failure.status, "arithmetic");
    assert.match(failure.stderr, /tally_keys_unseen_in_rows=y/);
  });

  it("refuses rows it cannot label rather than counting nothing", () => {
    const { block, failure } = evaluateQuestion(q, {
      attempted: 1,
      tally: { ok: 1 },
      rows: [{ result: "ok" }],
    });
    assert.equal(block, undefined);
    assert.equal(failure.status, "no_label_field");
    assert.match(failure.stderr, /row keys: result/);
  });

  it("passes through a script that reports derived counters and no tally", () => {
    // The instructions survey prints computed fields instead of a verdict tally. Absence of a tally is
    // not a failure, and the guard must not invent one - but the rows still have to be labelable.
    const { block, failure } = evaluateQuestion(q, {
      attempted: 2,
      answered_initialize: 2,
      sent_instructions_on_initialize: 1,
      initialize_instruction_chars: [72, 406],
      rows: [{ verdict: "answered" }, { verdict: "auth_required" }],
    });
    assert.equal(failure, undefined);
    assert.deepEqual(block.verdicts, { answered_initialize: 2, sent_instructions_on_initialize: 1, initialize_instruction_chars: [72, 406] });
    assert.equal(block.row_label_field, "verdict");
  });

  it("refuses an empty sample instead of publishing a clean-looking nothing", () => {
    // If the registry is unreachable every survey would return zero rows and tally to nothing, and a
    // dataset written from that would read like "we looked and found none of these servers".
    const { block, failure } = evaluateQuestion(q, { attempted: 0, tally: {}, rows: [] });
    assert.equal(block, undefined);
    assert.equal(failure.status, "empty_sample");
  });
});
