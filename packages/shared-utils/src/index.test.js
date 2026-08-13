import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createOkEnvelope,
  createErrorEnvelope,
  createRequestId,
} from "./index.js";

describe("shared-utils", () => {
  describe("createOkEnvelope", () => {
    it("wraps data in success envelope", () => {
      const env = createOkEnvelope({ foo: "bar" }, { startedAt: 1000 });
      assert.equal(env.status, "ok");
      assert.equal(env.data.foo, "bar");
      assert.ok(env.meta);
    });

    it("includes traceId when provided", () => {
      const env = createOkEnvelope({}, { traceId: "tr-1" });
      assert.equal(env.meta.traceId, "tr-1");
    });
  });

  describe("createErrorEnvelope", () => {
    it("wraps error in error envelope", () => {
      const env = createErrorEnvelope("TEST_ERROR", "Something failed", {
        startedAt: 1000,
      });
      assert.equal(env.status, "error");
      assert.equal(env.error.code, "TEST_ERROR");
      assert.equal(env.error.message, "Something failed");
    });
  });

  describe("createRequestId", () => {
    it("generates a string ID", () => {
      const id = createRequestId("test");
      assert.equal(typeof id, "string");
      assert.ok(id.length > 5);
    });

    it("generates unique IDs", () => {
      const a = createRequestId("test");
      const b = createRequestId("test");
      assert.notEqual(a, b);
    });
  });
});
