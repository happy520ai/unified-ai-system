// The wrapper's contract: when git is reachable it is invisible, and when git is
// nowhere it says so instead of letting twelve ENOENTs read as a quality failure.
// The two environments differ in where git lives, so each arm measures the thing
// it can measure the same way on both.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { windowsGitCandidates, findGitDir, gitWorks } from "./run-with-git.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WRAPPER = join(repoRoot, "tools", "run-with-git.mjs");

function run(env) {
  // The child is invoked by absolute path so that the PATH under test decides
  // only one thing: whether git resolves. (A symlinked node in a temp directory
  // would decide the same thing but needs elevation on Windows.)
  const result = spawnSync(process.execPath, [WRAPPER, "--", process.execPath, "-e", "process.stdout.write('child-ok')"], {
    encoding: "utf8",
    env,
    windowsHide: true,
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

// The host this runs on may have no git on PATH - the quality-matrix host is exactly
// that. Construct a reachable environment rather than assuming one, so the arm
// asserts the contract on every host.
function withGitReachable() {
  const env = { ...process.env };
  if (!gitWorks(env)) {
    const dir = findGitDir(env);
    if (dir) env.PATH = [dir, env.PATH].filter(Boolean).join(";");
  }
  return env;
}

test("with git reachable the wrapper is transparent", () => {
  const outcome = run(withGitReachable());
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.match(outcome.stdout, /child-ok/);
  assert.doesNotMatch(outcome.stderr, /run-with-git:/, "a reachable git must not announce itself");
});

test("the standard install locations are searched in a fixed order", () => {
  const candidates = windowsGitCandidates({
    ProgramFiles: "C:\\Program Files",
    "ProgramFiles(x86)": "C:\\Program Files (x86)",
    LOCALAPPDATA: "C:\\Users\\someone\\AppData\\Local",
  });
  assert.deepEqual(candidates, [
    "C:\\Program Files\\Git\\cmd",
    "C:\\Program Files (x86)\\Git\\cmd",
    "C:\\Users\\someone\\AppData\\Local\\Programs\\Git\\cmd",
  ]);
});

test("a PATH that holds node but not git either recovers or refuses, and says which", () => {
  // An empty directory on PATH: git cannot be resolved from it on either
  // platform. What happens next is platform-shaped, so the arm measures what the
  // platform can actually do rather than asserting one branch blindly.
  const dir = mkdtempSync(join(tmpdir(), "run-with-git-nogit-"));
  try {
    const outcome = run({ ...process.env, PATH: dir });
    const installed = existsSync(join(process.env.ProgramFiles ?? "", "Git", "cmd", "git.exe"));
    if (process.platform === "win32" && installed) {
      // git is installed but not on this PATH: the wrapper must find it and say so.
      assert.equal(outcome.status, 0, outcome.stderr);
      assert.match(outcome.stdout, /child-ok/);
      assert.match(outcome.stderr, /run-with-git: git not on PATH, using /);
    } else {
      // No git to find: the environment is the problem, and it must be named as such.
      assert.equal(outcome.status, 1);
      assert.match(outcome.stderr, /git is required by this test suite/);
      assert.match(outcome.stderr, /environment problem/);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a missing command after -- fails loudly instead of silently succeeding", () => {
  const result = spawnSync(process.execPath, [WRAPPER], { encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /usage:/);
});
