// Ensures `git` is reachable, then runs the command it was given.
//
// The repository's tests require git: forge-core's worktree-security suite runs
// git init/commit, and without git those tests fail with ENOENT deep inside a
// test, which reads as a quality failure rather than an environment one. That is
// exactly what happened to the quality matrix on a host whose PATH had no git
// (ADR-016): twelve ENOENT failures, pnpm bailed, and the remaining thousand-odd
// tests never ran.
//
// A test suite that requires a tool should make the tool reachable or say so
// plainly. This is the first half. When git is already on PATH the wrapper is
// transparent: it spawns the same command with the same environment.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function gitWorks(env) {
  return spawnSync("git", ["--version"], { encoding: "utf8", env, windowsHide: true }).status === 0;
}

/** Directories that hold git.exe on a Windows install, most specific first. */
export function windowsGitCandidates(env) {
  const roots = [
    env["ProgramFiles"],
    env["ProgramW6432"],
    env["ProgramFiles(x86)"],
    env["LOCALAPPDATA"] && join(env["LOCALAPPDATA"], "Programs"),
    "C:\\Program Files",
  ].filter(Boolean);
  return [...new Set(roots.map((root) => join(root, "Git", "cmd")))];
}

export function findGitDir(env) {
  for (const dir of windowsGitCandidates(env)) {
    if (existsSync(join(dir, "git.exe"))) return dir;
  }
  return null;
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const separator = process.argv.indexOf("--");
  if (separator < 0 || separator === process.argv.length - 1) {
    process.stderr.write("usage: node tools/run-with-git.mjs -- <command> [args...]\n");
    process.exit(2);
  }
  const command = process.argv[separator + 1];
  const commandArgs = process.argv.slice(separator + 2);

  const env = { ...process.env };
  if (!gitWorks(env)) {
    const dir = findGitDir(env);
    if (!dir) {
      process.stderr.write(
        "git is required by this test suite but is not on PATH and was not found in a standard\n" +
        "install location. Install git or add it to PATH; a failure here is an environment problem,\n" +
        "not a test failure.\n",
      );
      process.exit(1);
    }
    env.PATH = [dir, env.PATH].filter(Boolean).join(";");
    process.stderr.write(`run-with-git: git not on PATH, using ${dir}\n`);
    if (!gitWorks(env)) {
      process.stderr.write(`run-with-git: git at ${dir} did not run\n`);
      process.exit(1);
    }
  }

  const result = spawnSync(command, commandArgs, { stdio: "inherit", env, windowsHide: true });
  if (result.error) {
    process.stderr.write(`run-with-git: could not start ${command}: ${result.error.message}\n`);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}
