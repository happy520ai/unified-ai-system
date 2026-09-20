import assert from "node:assert/strict";
import test from "node:test";
import { CliUsageError, parseCliArgs } from "./cli-core.js";

const ADMIN_ENV = { AGENT_CONSOLE_ADMIN_KEY: "uai-test-key" };

function usageMessage(argv, env = ADMIN_ENV) {
  try {
    parseCliArgs(argv, env);
  } catch (error) {
    assert.ok(error instanceof CliUsageError, `expected CliUsageError, got ${error.name}: ${error.message}`);
    assert.equal(error.exitCode, 2);
    return error.message;
  }
  return null;
}

test("workflow and provider validation accepts canonical operations", () => {
  assert.equal(usageMessage(["workflow", "list"]), null);
  assert.equal(usageMessage([
    "workflow", "run",
    "--workflow-id", "wf-1",
    "--goal", "write the report",
    "--agent-id", "agt_abc123",
    "--artifact-name", "report.md",
  ]), null);
  assert.equal(usageMessage(["providers", "clear-credential", "--provider-id", "local-fake"], ADMIN_ENV), null);
});

test("workflow and provider validation requires a scoped gateway key", () => {
  assert.equal(
    usageMessage(["workflow", "run", "--workflow-id", "wf-1"], {}),
    "A scoped gateway key is required; use AGENT_CONSOLE_ADMIN_KEY or --admin-key.",
  );
});

test("workflow and provider validation rejects ambiguous operand arity", () => {
  assert.equal(
    usageMessage(["workflow", "run", "extra", "--workflow-id", "wf-1"]),
    "Provide exactly one workflow/provider operation.",
  );
  assert.equal(
    usageMessage(["providers", "clear-credential", "extra", "--provider-id", "ok1"]),
    "Provide exactly one workflow/provider operation.",
  );
});

test("providers clear-credential requires one canonical provider id", () => {
  assert.equal(
    usageMessage(["providers", "clear-credential"]),
    "providers clear-credential requires one canonical --provider-id.",
  );
  assert.equal(
    usageMessage(["providers", "clear-credential", "--provider-id", "Not A Slug"]),
    "providers clear-credential requires one canonical --provider-id.",
  );
});

test("workflow operation allowlist is closed", () => {
  assert.equal(
    usageMessage(["workflow", "bogus", "--workflow-id", "wf-1"]),
    "workflow supports run, list, status, and recover.",
  );
});

test("workflow id is required for every non-list operation", () => {
  const expected = "A stable --workflow-id (1–160 portable characters) is required; retries must retain it.";
  assert.equal(usageMessage(["workflow", "status"]), expected);
  assert.equal(usageMessage(["workflow", "recover"]), expected);
  assert.equal(usageMessage(["workflow", "run", "--goal", "g"]), expected);
  assert.equal(
    usageMessage(["workflow", "list", "--workflow-id", "wf-1"]),
    "workflow list does not accept --workflow-id.",
  );
});

test("workflow run requires goal and server-issued agent id", () => {
  const expected = "workflow run requires --goal and a server-issued --agent-id with file_write authorization.";
  assert.equal(usageMessage(["workflow", "run", "--workflow-id", "wf-1"]), expected);
  assert.equal(usageMessage(["workflow", "run", "--workflow-id", "wf-1", "--goal", "g"]), expected);
  assert.equal(
    usageMessage(["workflow", "run", "--workflow-id", "wf-1", "--goal", "g", "--agent-id", "not-prefixed"]),
    expected,
  );
});

test("workflow run rejects path-shaped artifact names", () => {
  const argv = [
    "workflow", "run",
    "--workflow-id", "wf-1",
    "--goal", "g",
    "--agent-id", "agt_abc123",
    "--artifact-name", "../escape.md",
  ];
  assert.equal(usageMessage(argv), "--artifact-name must be a bounded filename, not a path.");
});

test("workflow flags are confined to the operations that accept them", () => {
  assert.equal(
    usageMessage(["workflow", "run", "--workflow-id", "wf-1", "--limit", "5"]),
    "--limit is only valid with workflow list.",
  );
  assert.equal(
    usageMessage(["workflow", "status", "--workflow-id", "wf-1", "--goal", "g"]),
    "--goal, --agent-id and --artifact-name are only valid with workflow run.",
  );
});

test("agent governance validation keeps mutations behind --yes", () => {
  assert.equal(usageMessage(["agents", "status"]), null);
  assert.equal(
    usageMessage(["agents", "bogus"]),
    "Unsupported agents operation: bogus",
  );
  assert.equal(
    usageMessage(["agents", "run"]),
    "run requires explicit --yes confirmation.",
  );
  assert.equal(
    usageMessage(["agents", "list", "--yes"]),
    "--yes is only valid with generate, run, revoke, approve, or reject.",
  );
});

test("agent governance validation binds identifiers to operations", () => {
  assert.equal(
    usageMessage(["agents", "run", "--yes"]),
    "run requires a valid server-issued --agent-id.",
  );
  assert.equal(
    usageMessage(["agents", "show", "--agent-id", "bad"]),
    "show requires a valid server-issued --agent-id.",
  );
  assert.equal(
    usageMessage(["agents", "approve", "--yes"]),
    "approve requires a valid server-issued --approval-id.",
  );
});

test("agent governance validation requires a scoped key per operation", () => {
  assert.equal(
    usageMessage(["agents", "status"], {}),
    "status requires a scoped Agent Governance key.",
  );
});

test("gateway URL validation rejects non-http schemes", () => {
  assert.equal(
    usageMessage(["control-center", "--url", "ftp://gateway.invalid/"]),
    "Gateway URL must use http or https.",
  );
  assert.equal(
    usageMessage(["status", "--url", "not a url"]),
    "Invalid gateway URL: not a url",
  );
});

test("gateway URL validation rejects userinfo credentials", () => {
  assert.equal(
    usageMessage(["control-center", "--url", "http://user:pw@gateway.invalid/"]),
    "The control-center gateway URL must not contain userinfo credentials.",
  );
  assert.equal(
    usageMessage(["control-center", "--url", "http://gateway.invalid/"]),
    null,
  );
  assert.equal(
    usageMessage(["providers", "clear-credential", "--provider-id", "ok1", "--url", "http://u:pw@gateway.invalid/"]),
    "The gateway URL must not contain userinfo credentials.",
  );
});

test("clients lifecycle validation rejects unknown operations", () => {
  assert.equal(
    usageMessage(["clients", "bogus"]),
    "Unsupported clients operation: bogus",
  );
  assert.equal(
    usageMessage(["clients", "disable", "--client-id", "ok1"]),
    "disable requires explicit --yes confirmation.",
  );
});
