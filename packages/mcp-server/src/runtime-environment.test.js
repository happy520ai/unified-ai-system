import assert from "node:assert/strict";
import test from "node:test";

import {
  createManagedGatewayEnvironment,
  redactManagedGatewayOutput,
} from "./runtime-environment.js";

test("managed Gateway child inherits only runtime essentials and explicit values", () => {
  const childEnv = createManagedGatewayEnvironment({
    PATH: "runtime-path",
    SystemRoot: "C:\\Windows",
    TEMP: "C:\\Temp",
    NODE_ENV: "test",
    OPENAI_API_KEY: "provider-secret",
    ANTHROPIC_API_KEY: "provider-secret",
    GH_TOKEN: "github-secret",
    DATABASE_URL: "postgres://secret",
    AWS_SECRET_ACCESS_KEY: "cloud-secret",
    AI_GATEWAY_MCP_AUTH_TOKEN: "host-mcp-secret",
  }, {
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    PME_ENTERPRISE_USERS_JSON: "generated-ephemeral-auth",
  });

  assert.equal(childEnv.PATH, "runtime-path");
  assert.equal(childEnv.SystemRoot, "C:\\Windows");
  assert.equal(childEnv.TEMP, "C:\\Temp");
  assert.equal(childEnv.NODE_ENV, "test");
  assert.equal(childEnv.AI_GATEWAY_PROVIDER_MODE, "fake");
  assert.equal(childEnv.AI_GATEWAY_REAL_PROVIDER_ENABLED, "false");
  assert.equal(childEnv.PME_ENTERPRISE_USERS_JSON, "generated-ephemeral-auth");

  for (const forbidden of [
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GH_TOKEN",
    "DATABASE_URL",
    "AWS_SECRET_ACCESS_KEY",
    "AI_GATEWAY_MCP_AUTH_TOKEN",
  ]) {
    assert.equal(childEnv[forbidden], undefined, `${forbidden} must not be inherited`);
  }
});

test("managed Gateway output redacts the generated child authorization value", () => {
  const redacted = redactManagedGatewayOutput('{"token":"runtime-output-canary"}');
  assert.doesNotMatch(redacted, /runtime-output-canary/);
  assert.match(redacted, /REDACTED/);
});
