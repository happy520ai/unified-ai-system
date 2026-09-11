import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSystemdUnit } from "./installer-systemd.js";

const options = { command: "/usr/bin/node", args: ["/opt/uai/packages/mcp-service/bin/start-service.js", "--daemon"], workingDir: "/opt/uai" };

test("MCP user units use the user target and journal without requiring /var/log write access", () => {
  const unit = buildSystemdUnit(options);
  assert.match(unit, /WantedBy=default.target/);
  assert.match(unit, /StandardOutput=journal/);
  assert.match(unit, /StandardError=journal/);
  assert.doesNotMatch(unit, /\/var\/log|multi-user.target/);
  assert.match(unit, /packages\/mcp-service\/bin\/start-service.js --daemon/);
  assert.doesNotMatch(unit, /ai-gateway-service\/src\/index.js/);
});

test("MCP system units retain the system target and reject unsupported scope", () => {
  assert.match(buildSystemdUnit({ ...options, scope: "system" }), /WantedBy=multi-user.target/);
  assert.throws(() => buildSystemdUnit({ ...options, scope: "other" }), /scope must be/);
});
