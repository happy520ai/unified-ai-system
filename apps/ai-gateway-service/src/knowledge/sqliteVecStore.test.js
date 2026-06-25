import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createSqliteVecStore } from "./sqliteVecStore.js";

describe("sqlite-vec-store", () => {
  it("creates store instance", () => {
    const store = createSqliteVecStore({ dbPath: ":memory:" });
    assert.ok(store !== undefined);
    assert.equal(typeof store.isAvailable, "function");
    assert.equal(typeof store.upsertDocument, "function");
    assert.equal(typeof store.query, "function");
  });

  it("reports readiness", () => {
    const store = createSqliteVecStore({ dbPath: ":memory:" });
    const readiness = store.getReadiness();
    assert.equal(readiness.id, "sqlite-vec");
    assert.ok(readiness.status !== undefined);
  });

  it("returns 0 documents when empty", () => {
    const store = createSqliteVecStore({ dbPath: ":memory:" });
    const count = store.getDocumentCount();
    assert.equal(count, 0);
  });

  it("has correct interface methods", () => {
    const store = createSqliteVecStore({ dbPath: ":memory:" });
    assert.equal(typeof store.upsertDocuments, "function");
    assert.equal(typeof store.deleteDocument, "function");
    assert.equal(typeof store.getDocumentCount, "function");
    assert.equal(typeof store.close, "function");
  });
});
