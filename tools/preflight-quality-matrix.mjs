// Preflight for the quality matrix: the checks that must hold before
// run_quality_matrix can measure anything meaningful.
//
// Why this exists: the matrix runs its commands in the environment of whichever
// process hosts it. When that environment has no `git` on PATH, the forge-core
// worktree-security tests fail with ENOENT inside a minute, pnpm's recursive run
// bails at the first failing package, and the remaining thousand-odd tests never
// execute at all. The report that comes back looks like a twelve-test quality
// failure; it is really an environment failure, and it is indistinguishable from
// a real one unless somebody checks first. See ADR-016.
import { spawnSync } from "node:child_process";

const REQUIRED = [
  { command: "git", args: ["--version"], why: "forge-core's worktree-security tests run git init/commit; without it they fail with ENOENT and abort the recursive run" },
  { command: "node", args: ["--version"], why: "every test command is a node process" },
];

const problems = [];
for (const requirement of REQUIRED) {
  const result = spawnSync(requirement.command, requirement.args, { encoding: "utf8", windowsHide: true });
  if (result.error?.code === "ENOENT" || result.status !== 0) {
    problems.push({ ...requirement, detail: result.error?.code ?? `exited ${result.status}` });
  }
}

if (problems.length > 0) {
  for (const problem of problems) {
    process.stderr.write(`${problem.command} is not usable (${problem.detail})\n  ${problem.why}\n`);
  }
  process.stderr.write(
    "\nThe quality matrix would report these as test failures. Fix the environment first:\n" +
    "run this preflight from a shell whose PATH includes the missing tool, or add the tool's\n" +
    "directory to PATH and restart the host process (the matrix inherits its PATH from it).\n",
  );
  process.exit(1);
}
process.stdout.write(`Quality matrix preflight passed: ${REQUIRED.map((r) => r.command).join(", ")} all usable.\n`);
