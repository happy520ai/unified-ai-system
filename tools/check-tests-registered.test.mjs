// Every test file under tools/ must actually run in CI, or it is documentation, not a defense.
//
// Why this exists: `test:verification-tools` is an explicit list of file names, not a glob, so a test added
// to the repository and not added to that list never executes - and its author usually believes the opposite,
// because the file is green when they run it by hand. That is how two separate instruments in this repository
// came to be unwired. The fix is not to remember: it is to make forgetting a build failure.
//
// The exception list is an equality-checked set with a required reason per entry, because the cheap way to
// silence this guard is to add the missing file to the exceptions - which is the same act of forgetting,
// written down where it looks deliberate.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const SCRIPT = "test:verification-tools";

// Files that exist, are not in the list, and why - each one is a debt, not a decision to leave behind.
export const EXCEPTIONS = {
  "tools/local-client-native-pop-replay.test.mjs":
    "its target is the windows-native local-client authority CLI; it passes on Windows and has never been " +
    "read on the Linux runner this suite uses, so registering it would be a guess about a platform we have not " +
    "measured. Debt: take that reading, then move it into the list and delete this entry.",
};

export function registeredTests() {
  return new Set(String(pkg.scripts[SCRIPT] ?? "").match(/tools\/[\w.-]+\.test\.mjs/gu) ?? []);
}

export function testsOnDisk() {
  return readdirSync(join(ROOT, "tools")).filter((f) => f.endsWith(".test.mjs")).map((f) => "tools/" + f).sort();
}

export function unregistered({ onDisk, listed, exceptions }) {
  return onDisk.filter((f) => !listed.has(f) && !(f in exceptions));
}

test("nothing on disk is outside the CI list", () => {
  const missing = unregistered({ onDisk: testsOnDisk(), listed: registeredTests(), exceptions: EXCEPTIONS });
  assert.deepEqual(missing, [], "test files that never run in CI: " + missing.join(", "));
});

test("the exceptions are declared with a reason and a repair, not a shrug", () => {
  for (const [file, reason] of Object.entries(EXCEPTIONS)) {
    assert.ok(existsSync(join(ROOT, file)), file + " is excepted but does not exist - delete the stale entry");
    assert.ok(reason.length >= 60, file + " needs a reason long enough to be checkable, saw " + reason.length);
    assert.match(reason, /Debt:|debt:/u, file + " must name the repair, not only the excuse");
  }
  // The set itself is pinned by equality: the cheap way to silence this guard is to add the missing file to
  // the exception map, and that has to show up here as a deliberate edit rather than as a passing run.
  assert.deepEqual(Object.keys(EXCEPTIONS).sort(), ["tools/local-client-native-pop-replay.test.mjs"]);
  // A planted unregistered file must be reported by the guard rather than absorbed by the exception map.
  const withNew = unregistered({
    onDisk: [...testsOnDisk(), "tools/brand-new-guard.test.mjs"],
    listed: registeredTests(),
    exceptions: EXCEPTIONS,
  });
  assert.deepEqual(withNew, ["tools/brand-new-guard.test.mjs"]);
});

test("the list plus the exceptions is exactly the directory", () => {
  // Partition identity, not a one-way subset test: a file registered but deleted, or on disk but registered
  // nowhere, breaks this without either side being able to shrink to match the other.
  const expected = [...testsOnDisk()].sort();
  const actual = [...[...registeredTests()].sort(), ...Object.keys(EXCEPTIONS).sort()].sort();
  assert.deepEqual(actual, expected, "registered tests plus exceptions must equal the files on disk");
});

test("the list does not name files that are gone", () => {
  // node --test fails loudly on a missing argument, so this is about the quieter half: a renamed test whose
  // old name still sits in the list, which makes the count look stable while coverage is not.
  const ghosts = [...registeredTests()].filter((f) => !existsSync(join(ROOT, f)));
  assert.deepEqual(ghosts, [], "names in the CI list with no file behind them: " + ghosts.join(", "));
});

test("the suite is a floor, not a coincidence", () => {
  const count = registeredTests().size;
  // Pinned as a number: removing a file from the list and deleting it from disk passes every arm above.
  assert.ok(count >= 44, "expected at least 44 registered tool tests, saw " + count);
  assert.ok(testsOnDisk().length >= count, "the directory must hold at least as many tests as the list runs");
});
