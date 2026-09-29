// Guards the preflight's two behaviours: it refuses to run when a required tool
// is missing, and it says which tool and why rather than a generic failure.
// The check itself is exercised with a command that cannot exist.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const preflight = join(repoRoot, "tools", "preflight-quality-matrix.mjs");

function run(env) {
  const result = spawnSync(process.execPath, [preflight], { encoding: "utf8", env, windowsHide: true });
  return { status: result.status, stderr: result.stderr ?? "", stdout: result.stdout ?? "" };
}

test("a usable git and node let the preflight pass", () => {
  const outcome = run({ ...process.env });
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.match(outcome.stdout, /preflight passed/);
});

test("a PATH without git is refused, naming git and the consequence", () => {
  const withoutGit = { ...process.env };
  // Keep node reachable, drop every directory that could hold git.
  withoutGit.PATH = (process.env.PATH ?? "")
    .split(";")
    .filter((entry) => entry && !/git/i.test(entry))
    .join(";");
  const outcome = run(withoutGit);
  assert.equal(outcome.status, 1);
  assert.match(outcome.stderr, /git is not usable/);
  assert.match(outcome.stderr, /ENOENT/);
  // The message has to name the failure mode, not just the missing tool.
  assert.match(outcome.stderr, /worktree-security/);
  assert.match(outcome.stderr, /environment first/);
});
