import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadStoredUsers, parseUsers } from "./enterpriseUserStore.js";

describe("enterprise user store parsing", () => {
  it("ignores malformed and non-array environment configuration", () => {
    expect(parseUsers({
      PME_ENTERPRISE_USERS_JSON: "{invalid",
    }).size).toBe(0);
    expect(parseUsers({
      PME_ENTERPRISE_USERS_JSON: JSON.stringify({ token: "not-an-array" }),
    }).size).toBe(0);
  });

  it("returns no users when the persisted store contains invalid JSON", async () => {
    const root = await mkdtemp(join(tmpdir(), "enterprise-user-store-"));
    const path = join(root, "users.json");
    await writeFile(path, "{invalid", "utf8");

    try {
      expect(loadStoredUsers(path)).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
