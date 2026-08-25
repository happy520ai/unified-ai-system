import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSqliteUserStoreBackend } from "./enterpriseUserStore-sqlite.js";

function backend() {
  const dbPath = join(mkdtempSync(join(tmpdir(), "eus-sqlite-")), "users.db");
  return createSqliteUserStoreBackend(dbPath);
}

describe("enterpriseUserStore — sqlite backend", () => {
  it("round-trips users", () => {
    const store = backend();
    store.saveStoredUsers("ignored", [
      { userId: "alice", tokenHash: "hash1", role: "admin", permissions: ["*"] },
      { userId: "bob", tokenHash: "hash2", role: "viewer", permissions: ["dashboard:read"] },
    ]);

    const loaded = store.loadStoredUsers();
    expect(loaded.length).toBe(2);
    expect(loaded.find((u) => u.userId === "alice").role).toBe("admin");
    expect(loaded.find((u) => u.userId === "bob").permissions).toEqual(["dashboard:read"]);
  });

  it("starts empty and overwrites on save", () => {
    const store = backend();
    expect(store.loadStoredUsers()).toEqual([]);

    store.saveStoredUsers("ignored", [{ userId: "x", tokenHash: "h", role: "viewer" }]);
    store.saveStoredUsers("ignored", [{ userId: "y", tokenHash: "h2", role: "admin" }]);

    const loaded = store.loadStoredUsers();
    expect(loaded.length).toBe(1);
    expect(loaded[0].userId).toBe("y");
    expect(loaded[0].role).toBe("admin");
  });
});
