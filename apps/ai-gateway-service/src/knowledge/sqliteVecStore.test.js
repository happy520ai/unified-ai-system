import { describe, it, expect, afterEach } from "vitest";
import { createSqliteVecStore, safeParseMetadata } from "./sqliteVecStore.js";

const opened = [];
function createStore(options) { const store = createSqliteVecStore(options); opened.push(store); return store; }
afterEach(() => { for (const store of opened.splice(0)) store.close(); });
describe("sqlite-vec-store", () => {
  it("creates store instance", () => {
    const store = createStore({ dbPath: ":memory:" });
    expect(store).toBeDefined();
    expect(store.isAvailable).toBeInstanceOf(Function);
    expect(store.upsertDocument).toBeInstanceOf(Function);
    expect(store.query).toBeInstanceOf(Function);
  });

  it("reports readiness", () => {
    const store = createStore({ dbPath: ":memory:" });
    const readiness = store.getReadiness();
    expect(readiness.id).toBe("sqlite-vec");
    expect(readiness.status).toBeDefined();
  });

  it("returns 0 documents when empty", () => {
    const store = createStore({ dbPath: ":memory:" });
    expect(store.isAvailable()).toBe(true);
    const count = store.getDocumentCount();
    expect(count).toBe(0);
  });

  it("has correct interface methods", () => {
    const store = createStore({ dbPath: ":memory:" });
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
