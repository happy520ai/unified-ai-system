import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createOkEnvelope,
  createErrorEnvelope,
  createMessageContentFingerprint,
  createRequestId,
  extractMessageText,
  getMessageImageStats,
  inspectInlineImageDataUrl,
  replaceMessageTextContent,
} from "./index.js";

const ONE_PIXEL_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

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

  describe("inline image content", () => {
    it("validates, counts, and fingerprints inline images without retaining their payload", () => {
      const content = [
        { type: "text", text: "Describe this image" },
        { type: "image_url", image_url: { url: ONE_PIXEL_PNG, detail: "low" } },
      ];
      const inspected = inspectInlineImageDataUrl(ONE_PIXEL_PNG);
      const stats = getMessageImageStats([{ role: "user", content }]);
      const fingerprint = createMessageContentFingerprint(content);

      assert.equal(inspected.mediaType, "image/png");
      assert.ok(inspected.byteLength > 0);
      assert.deepEqual(stats, { imageCount: 1, totalBytes: inspected.byteLength });
      assert.equal(extractMessageText(content), "Describe this image");
      assert.match(fingerprint, /\[inline-image:[a-f0-9]{24}:\d+\]/);
      assert.equal(fingerprint.includes("iVBOR"), false);
    });

    it("rejects remote URLs and malformed base64", () => {
      assert.throws(() => inspectInlineImageDataUrl("https://example.com/image.png"), {
        code: "INLINE_IMAGE_REMOTE_URL_UNSUPPORTED",
      });
      assert.throws(() => inspectInlineImageDataUrl("data:image/png;base64,%%%"), {
        code: "INLINE_IMAGE_DATA_URL_INVALID",
      });
    });

    it("replaces text while preserving image blocks", () => {
      const replaced = replaceMessageTextContent([
        { type: "image_url", image_url: { url: ONE_PIXEL_PNG } },
        { type: "text", text: "old" },
      ], "enhanced");
      assert.equal(replaced[0].type, "image_url");
      assert.deepEqual(replaced[1], { type: "text", text: "enhanced" });
    });
  });
});
