import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { WORKFORCE_ROLES, listWorkforceRoles } from "./workforceRoles.js";

describe("workforce-roles", () => {
  it("has 7 roles", () => {
    assert.equal(WORKFORCE_ROLES.length, 7);
  });

  it("listWorkforceRoles returns copies", () => {
    const roles = listWorkforceRoles();
    assert.equal(roles.length, 7);
    assert.equal(roles[0].roleId, "ceo");
    assert.equal(roles[0].name, "CEO");
  });

  it("each role has required fields", () => {
    for (const role of WORKFORCE_ROLES) {
      assert.ok(role.roleId !== undefined);
      assert.ok(role.name !== undefined);
      assert.ok(role.title !== undefined);
      assert.ok(role.responsibility !== undefined);
    }
  });

  it("contains expected role ids", () => {
    const ids = WORKFORCE_ROLES.map((r) => r.roleId);
    assert.ok(ids.includes("ceo"));
    assert.ok(ids.includes("pm"));
    assert.ok(ids.includes("architect"));
    assert.ok(ids.includes("frontend-engineer"));
    assert.ok(ids.includes("backend-engineer"));
    assert.ok(ids.includes("qa"));
    assert.ok(ids.includes("reviewer"));
  });
});
