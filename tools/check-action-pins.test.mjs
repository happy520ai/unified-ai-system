// Guards the action-pin check against the shapes it will meet in the wild: a
// sub-action reference, a version tag standing where a SHA should be, a local
// docker action, and the same action pinned differently in two files.
import test from "node:test";
import assert from "node:assert/strict";
import { extractActionPins } from "./check-action-pins.mjs";

const WORKFLOW = `
name: Example
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
      - uses: github/codeql-action/init@1190a975f95ce23525efb6a3fc21ea29567c1b52 # v3
      - uses: docker/build-push-action@v6
      - uses: ./.github/actions/local-thing
      - run: echo "no uses here"
`;

test("extracts a pinned action and a tag reference, and skips a local action", () => {
  const pins = extractActionPins({ "ci.yml": WORKFLOW });
  const byAction = new Map(pins.map((pin) => [pin.action, pin]));

  assert.equal(byAction.get("actions/checkout").shaPinned, true);
  assert.equal(byAction.get("github/codeql-action/init").shaPinned, true);
  assert.equal(byAction.get("docker/build-push-action").shaPinned, false, "a tag is not a SHA pin");
  // A local action resolves inside this repository: there is no upstream commit
  // to verify, and it carries no @ref, so it is not an action pin at all.
  assert.equal(byAction.has(".github/actions/local-thing"), false);
  assert.equal(pins.length, 3);
});

test("records every file that uses the same pin, so a fix can be checked once", () => {
  const pins = extractActionPins({
    "a.yml": "      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1\n",
    "b.yml": "      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1\n",
  });
  assert.equal(pins.length, 1);
  assert.deepEqual(pins[0].files.sort(), ["a.yml", "b.yml"]);
});

test("the same action pinned two different ways stays two entries", () => {
  const pins = extractActionPins({
    "a.yml": "      - uses: pnpm/action-setup@0977fd99725f1db4007ccb2928dbb4e90d06cc86\n",
    "b.yml": "      - uses: pnpm/action-setup@0ebf47130e4866e96fce0953f49152a61190b271\n",
  });
  assert.equal(pins.length, 2);
  assert.ok(pins.every((pin) => pin.shaPinned));
});

test("a comment after the pin does not become part of the reference", () => {
  const pins = extractActionPins({
    "a.yml": "      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v4\n",
  });
  assert.equal(pins[0].ref, "820762786026740c76f36085b0efc47a31fe5020");
});

test("a short or truncated sha is not accepted as a pin", () => {
  const pins = extractActionPins({ "a.yml": "      - uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a\n" });
  assert.equal(pins[0].shaPinned, false);
});
