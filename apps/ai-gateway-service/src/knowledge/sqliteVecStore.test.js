import { describe, it, expect } from "vitest";
import { createSqliteVecStore, safeParseMetadata } from "./sqliteVecStore.js";

describe("sqlite-vec-store", () => {
  it("creates store instance", () => {
    const store = createSqliteVecStore({ dbPath: ":memory:" });
    expect(store).toBeDefined();
    expect(store.isAvailable).toBeInstanceOf(Function);
    expect(store.upsertDocument).toBeInstanceOf(Function);
    expect(store.query).toBeInstanceOf(Function);
  });

  it("reports readiness", () => {
    const store = createSqliteVecStore({ dbPath: ":memory:" });
    const readiness = store.getReadiness();
    expect(readiness.id).toBe("sqlite-vec");
    expect(readiness.status).toBeDefined();
  });

  it("returns 0 documents when empty", ({ skip }) => {
    const store = createSqliteVecStore({ dbPath: ":memory:" });
    if (!store.isAvailable()) {
      // The better-sqlite3 native binding is built for the CI Node runtime;
      // skip instead of failing when another local Node cannot load it.
      skip("better-sqlite3 native binding unavailable under this Node runtime");
      return;
    }
    const count = store.getDocumentCount();
    expect(count).toBe(0);
  });

  it("has correct interface methods", () => {
    const store = createSqliteVecStore({ dbPath: ":memory:" });
    expect(store.upsertDocuments).toBeInstanceOf(Function);
    expect(store.deleteDocument).toBeInstanceOf(Function);
    expect(store.getDocumentCount).toBeInstanceOf(Function);
    expect(store.close).toBeInstanceOf(Function);
  });

  it("treats malformed or non-object metadata as empty", () => {
    expect(safeParseMetadata("{broken")).toEqual({});
    expect(safeParseMetadata("[]")).toEqual({});
    expect(safeParseMetadata('{"source":"test"}')).toEqual({ source: "test" });
  });
});
