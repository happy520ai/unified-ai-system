import { describe, it, expect } from "vitest";
import {
  createOkEnvelope,
  createErrorEnvelope,
  createRequestId,
} from "./index.js";

describe("shared-utils", () => {
  describe("createOkEnvelope", () => {
    it("wraps data in success envelope", () => {
      const env = createOkEnvelope({ foo: "bar" }, { startedAt: 1000 });
      expect(env.status).toBe("ok");
      expect(env.data.foo).toBe("bar");
      expect(env.meta).toBeDefined();
    });

    it("includes traceId when provided", () => {
      const env = createOkEnvelope({}, { traceId: "tr-1" });
      expect(env.meta.traceId).toBe("tr-1");
    });
  });

  describe("createErrorEnvelope", () => {
    it("wraps error in error envelope", () => {
      const env = createErrorEnvelope("TEST_ERROR", "Something failed", {
        startedAt: 1000,
      });
      expect(env.status).toBe("error");
      expect(env.error.code).toBe("TEST_ERROR");
      expect(env.error.message).toBe("Something failed");
    });
  });

  describe("createRequestId", () => {
    it("generates a string ID", () => {
      const id = createRequestId("test");
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(5);
    });

    it("generates unique IDs", () => {
      const a = createRequestId("test");
      const b = createRequestId("test");
      expect(a).not.toBe(b);
    });
  });
});
