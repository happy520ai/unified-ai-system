import { describe, it, expect } from "vitest";
import {
  WORKFORCE_ROLES,
  getRoleById,
  getRoleCapabilities,
  listWorkforceRoles,
} from "./workforceRoles.js";

describe("workforce-roles", () => {
  it("has 7 roles", () => {
    expect(WORKFORCE_ROLES.length).toBe(7);
  });

  it("listWorkforceRoles returns copies", () => {
    const roles = listWorkforceRoles();
    expect(roles.length).toBe(7);
    expect(roles[0].roleId).toBe("ceo");
    expect(roles[0].name).toBe("CEO");
  });

  it("each role has required fields", () => {
    for (const role of WORKFORCE_ROLES) {
      expect(role.roleId).toBeDefined();
      expect(role.name).toBeDefined();
      expect(role.title).toBeDefined();
      expect(role.responsibility).toBeDefined();
    }
  });

  it("contains expected role ids", () => {
    const ids = WORKFORCE_ROLES.map((r) => r.roleId);
    expect(ids).toContain("ceo");
    expect(ids).toContain("pm");
    expect(ids).toContain("architect");
    expect(ids).toContain("frontend-engineer");
    expect(ids).toContain("backend-engineer");
    expect(ids).toContain("qa");
    expect(ids).toContain("reviewer");
  });

  it("looks up roles without exposing the internal array", () => {
    expect(getRoleById(" CEO ")?.roleId).toBe("ceo");
    expect(getRoleById("missing")).toBeNull();
  });

  it("returns role capabilities as defensive copies", () => {
    const capabilities = getRoleCapabilities("qa");
    expect(capabilities).toContain("regression_coverage");
    capabilities.push("mutated");
    expect(getRoleCapabilities("qa")).not.toContain("mutated");
    expect(getRoleCapabilities("missing")).toEqual([]);
  });
});
