import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  CREDENTIAL_NAME_RE,
  childEnv,
  parseCommandLine,
  parseRpcLine,
} from "./mcp-startup-profile-lib.mjs";

const TOOL = fileURLToPath(new URL("./mcp-startup-profile.mjs", import.meta.url));

test("startup profiler arguments keep safe defaults and reject unusable ones", () => {
  assert.deepEqual(parseCommandLine([]).argv, { repeat: 2, timeoutMs: 45000, json: false, keepEnv: false });
  assert.deepEqual(parseCommandLine(["--repeat", "5", "--json"]).argv.repeat, 5);
  assert.equal(parseCommandLine(["--repeat", "5", "--json"]).argv.json, true);
  const passthrough = parseCommandLine(["--", "node", "./server.js"]);
  assert.deepEqual(passthrough.rest, ["node", "./server.js"]);

  // An unbounded repeat or timeout would let one invocation occupy a CI leg indefinitely.
  for (const bad of [["--repeat", "0"], ["--repeat", "21"], ["--repeat", "abc"], ["--timeout-ms", "500"]]) {
    assert.throws(() => parseCommandLine(bad), /must be/, `${bad.join(" ")} should be rejected`);
  }
});

test("a response line counts only when it carries an integer id", () => {
  const answered = parseRpcLine('{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18"}}');
  assert.equal(answered.id, 1);

  // Every one of these is something a real server writes on stdout or stderr-shaped log noise;
  // reading any of them as an answer is how a connect timeout becomes an invisible success.
  assert.equal(parseRpcLine('{"jsonrpc":"2.0","method":"notifications/message"}'), null);
  assert.equal(parseRpcLine('{"jsonrpc":"2.0","id":"2","result":{}}'), null);
  assert.equal(parseRpcLine("server listening on stdio"), null);
  assert.equal(parseRpcLine('{"jsonrpc":"2.0","id":2,"res'), null);
  assert.equal(parseRpcLine("[1,2,3]"), null);
  assert.equal(parseRpcLine(""), null);
});

test("the credential guard reads name segments, not substrings", () => {
  for (const name of ["OPENAI_API_KEY", "MCP_AUTH_TOKEN", "AWS_SECRET_ACCESS_KEY", "DB_PASSWORD", "CREDENTIAL_FILE"]) {
    assert.match(name, CREDENTIAL_NAME_RE, `${name} must be treated as a credential`);
  }
  // A guard that also fires on AUTHOR would be switched off by its first false refusal.
  for (const name of ["PATH", "NODE_ENV", "HOME", "AUTHOR", "PUBLISHER", "KEYMAP"]) {
    assert.doesNotMatch(name, CREDENTIAL_NAME_RE, `${name} must not block a run`);
  }
});

test("the child environment carries only the names asked for", () => {
  const built = childEnv(["PATH", "NODE_ENV", "UAI_DEFINITELY_NOT_SET"]);
  assert.deepEqual(Object.keys(built).sort(), ["NODE_ENV", "PATH"]);
  assert.equal(built.NODE_ENV, "production", "an unset NODE_ENV must not leak a dev default");
});

test("the harness refuses a credential-carrying child environment and never answers", () => {
  const poisoned = { ...process.env, UAI_TEST_ACCESS_TOKEN: "not-a-real-secret" };

  const refused = spawnSync(process.execPath, [TOOL, "--keep-env", "--repeat", "1"], {
    env: poisoned,
    encoding: "utf8",
  });
  assert.equal(refused.status, 2, "an explicit --keep-env with a credential name must be refused");
  assert.match(refused.stderr, /UAI_TEST_ACCESS_TOKEN/, "the refusal must name the offending variable");
  assert.doesNotMatch(refused.stderr, /not-a-real-secret/, "the refusal must not echo the value");

  // Boundary arm for the same guard: without --keep-env the child gets PATH/NODE_ENV only, so the
  // poisoned variable is simply absent rather than causing a refusal. That is what makes the
  // page's "no provider key reaches the process" claim true by construction.
  const timedOut = spawnSync(
    process.execPath,
    [TOOL, "--json", "--repeat", "1", "--timeout-ms", "1500", "--", process.execPath, "-e", "setInterval(() => {}, 1000)"],
    { env: poisoned, encoding: "utf8" },
  );
  assert.equal(timedOut.status, 1, "a server that never answers must exit non-zero");
  const parsed = JSON.parse(timedOut.stdout);
  assert.equal(parsed.runs[0].verdict, "timed_out");
  assert.equal(parsed.summary.verdict, "never_answered");
});
