import assert from "node:assert/strict";
import test from "node:test";

import {
  createSupervisorChildEnvironment,
  redactChildStderr,
} from "./child-environment.js";

test("supervisor child inherits MCP connection settings but not ambient credentials", () => {
  const childEnv = createSupervisorChildEnvironment({
    PATH: "runtime-path",
    SystemRoot: "C:\\Windows",
    AI_GATEWAY_MCP_URL: "https://gateway.example.test",
    AI_GATEWAY_MCP_AUTH_TOKEN: "scoped-mcp-token",
    OPENAI_API_KEY: "provider-secret",
    GH_TOKEN: "github-secret",
    DATABASE_URL: "postgres://secret",
    AZURE_CLIENT_SECRET: "cloud-secret",
  }, {
    MCP_SUPERVISED: "1",
    MCP_SERVICE_LOG_FILE: "service.log",
  });

  assert.equal(childEnv.PATH, "runtime-path");
  assert.equal(childEnv.SystemRoot, "C:\\Windows");
  assert.equal(childEnv.AI_GATEWAY_MCP_URL, "https://gateway.example.test");
  assert.equal(childEnv.AI_GATEWAY_MCP_AUTH_TOKEN, "scoped-mcp-token");
  assert.equal(childEnv.MCP_SUPERVISED, "1");
  assert.equal(childEnv.MCP_SERVICE_LOG_FILE, "service.log");
  assert.equal(childEnv.OPENAI_API_KEY, undefined);
  assert.equal(childEnv.GH_TOKEN, undefined);
  assert.equal(childEnv.DATABASE_URL, undefined);
  assert.equal(childEnv.AZURE_CLIENT_SECRET, undefined);
});

test("supervisor stderr redaction covers labeled, bearer, URL, known-token, and private-key secrets", () => {
  const input = [
    "OPENAI_API_KEY=provider-canary-redaction-value",
    '"GH_TOKEN":"github_pat_examplegithubsecret123456"',
    "Authorization: Bearer bearer-secret-value",
    "DATABASE_URL=postgres://dbuser:dbpassword@db.example.test/gateway",
    "https://urluser:urlpassword@example.test/path",
    "-----BEGIN PRIVATE KEY-----\nprivate-material\n-----END PRIVATE KEY-----",
  ].join("\n");
  const output = redactChildStderr(input);

  for (const secret of [
    "provider-canary-redaction-value",
    "github_pat_examplegithubsecret123456",
    "bearer-secret-value",
    "dbpassword",
    "urlpassword",
    "private-material",
  ]) {
    assert.doesNotMatch(output, new RegExp(secret));
  }
  assert.match(output, /\[REDACTED/);
});
