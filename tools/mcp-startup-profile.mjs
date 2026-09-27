// Profile a stdio MCP server's connect path: how long from spawn to a completed
// `initialize`, then to `tools/list`, and how much of that is first-process cost.
//
// Why this exists: MCP clients impose a connect budget (OpenCode defaults to 30 s, and several
// clients do not let you raise it), so a server that is merely slow to import can be marked
// "failed" without ever being given a chance to answer. The distinguishing measurement is the
// cold/warm delta: a first-launch stall that disappears on the second run is module loading,
// not a network or provider call. Nothing here contacts a provider; the child environment is
// deliberately reduced so the run proves it.
//
//   node tools/mcp-startup-profile.mjs                    # our server, cold + warm
//   node tools/mcp-startup-profile.mjs --repeat 3
//   node tools/mcp-startup-profile.mjs --json
//   node tools/mcp-startup-profile.mjs -- node ./packages/mcp-server/src/index.js
import { spawn } from "node:child_process";
import { parseCommandLine, runProfile, CREDENTIAL_NAME_RE } from "./mcp-startup-profile-lib.mjs";

const { argv, rest } = parseCommandLine(process.argv.slice(2));
const command = rest.length > 0
  ? { file: rest[0], args: rest.slice(1) }
  : { file: process.execPath, args: ["./packages/mcp-server/src/index.js"] };

const envNames = argv.keepEnv
  ? Object.keys(process.env)
  : ["PATH", "NODE_ENV"];
const credentialNames = envNames.filter((name) => CREDENTIAL_NAME_RE.test(name));
if (credentialNames.length > 0) {
  console.error(`refusing to run: child environment carries credential-looking variables: ${credentialNames.join(", ")}`);
  process.exit(2);
}

const runs = [];
for (let i = 0; i < argv.repeat; i += 1) {
  const run = await runProfile({ command, envNames, timeoutMs: argv.timeoutMs });
  runs.push(run);
  if (!argv.json) {
    console.log(`run ${i + 1}  ${formatRun(run)}`);
  }
}

if (argv.json) {
  console.log(JSON.stringify({ command, runs, summary: summarize(runs) }, null, 2));
}
const failed = runs.filter((run) => run.verdict !== "answered").length;
process.exit(failed === 0 ? 0 : 1);

function formatRun(run) {
  if (run.verdict !== "answered") {
    const budget = run.timedOut ? ` after ${run.timeoutMs} ms budget` : "";
    return `${run.verdict.toUpperCase()}${budget} (${run.elapsedMs ?? "?"} ms elapsed${run.detail ? `, ${run.detail}` : ""})`;
  }
  const server = run.serverInfo ? ` ${run.serverInfo.name}/${run.serverInfo.protocolVersion}` : "";
  return [
    `initialize ${run.initializeMs} ms`,
    `tools/list ${run.toolsListMs} ms (+${run.toolsListMs - run.initializeMs} ms)`,
    `tools ${run.toolCount}${server}`,
  ].join("  |  ");
}

function summarize(rows) {
  const answered = rows.filter((row) => row.verdict === "answered");
  if (answered.length === 0) {
    return { verdict: "never_answered", answered: 0, attempted: rows.length };
  }
  const cold = answered[0];
  const fastest = Math.min(...answered.map((row) => row.initializeMs));
  return {
    verdict: answered.length === rows.length ? "answered" : "partially_answered",
    answered: answered.length,
    attempted: rows.length,
    coldInitializeMs: cold.initializeMs,
    fastestInitializeMs: fastest,
    coldOverWarmestMs: cold.initializeMs - fastest,
    toolCounts: [...new Set(answered.map((row) => row.toolCount))],
  };
}
