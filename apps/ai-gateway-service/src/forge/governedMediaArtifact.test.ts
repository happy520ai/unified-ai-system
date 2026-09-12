import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { inspectGovernedPcmWav } from "./governedMediaArtifact.ts";

const limits = { maxBytes: 4194304, maxDurationMs: 120000 };
function chunk(id: string, payload: Buffer) {
  const bytes = Buffer.alloc(8 + payload.length + payload.length % 2);
  bytes.write(id, 0, "latin1"); bytes.writeUInt32LE(payload.length, 4); payload.copy(bytes, 8);
  return bytes;
}
function format(size = 16) {
  const bytes = Buffer.alloc(size);
  bytes.writeUInt16LE(1); bytes.writeUInt16LE(1, 2); bytes.writeUInt32LE(8000, 4);
  bytes.writeUInt32LE(16000, 8); bytes.writeUInt16LE(2, 12); bytes.writeUInt16LE(16, 14);
  return bytes;
}
function container(chunks: Buffer[]) {
  const bytes = Buffer.concat([Buffer.alloc(12), ...chunks]);
  bytes.write("RIFF"); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write("WAVE", 8);
  return bytes;
}
function wav(frames = 8, fmt = format(), extra: Buffer[] = []) {
  return container([chunk("fmt ", fmt), ...extra, chunk("data", Buffer.alloc(frames * 2))]);
}

describe("independent governed PCM WAV inspection", () => {
  it.each([16, 18])("accepts PCM fmt size %s and reports the exact delivered hash", (size) => {
    const bytes = wav(8, format(size));
    const artifact = inspectGovernedPcmWav(bytes, { maxBytes: bytes.length, maxDurationMs: 1 });
    expect(artifact).toEqual({ version: 1, format: "wav-pcm16", contentType: "audio/wav",
      sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length,
      sampleRate: 8000, channels: 1, bitsPerSample: 16, frameCount: 8, durationMs: 1 });
    expect(Object.isFrozen(artifact)).toBe(true);
  });

  it("allows bounded padded JUNK and LIST INFO while hashing every original byte", () => {
    const info = chunk("LIST", Buffer.concat([Buffer.from("INFO"), chunk("INAM", Buffer.from("fixture"))]));
    const bytes = wav(8, format(18), [chunk("JUNK", Buffer.from([1, 2, 3])), info]);
    const artifact = inspectGovernedPcmWav(bytes, limits);
    expect(artifact.bytes).toBe(bytes.length);
    expect(artifact.frameCount).toBe(8);
    expect(artifact.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
  });

  it("rejects zero-length, truncated and dishonest RIFF containers", () => {
    for (const bytes of [Buffer.alloc(0), Buffer.alloc(45), wav().subarray(0, 47)]) {
      expect(() => inspectGovernedPcmWav(bytes, limits)).toThrow();
    }
    const bytes = wav(); bytes.writeUInt32LE(bytes.length, 4);
    expect(() => inspectGovernedPcmWav(bytes, limits)).toThrowError(expect.objectContaining({ code: "FORGE_MEDIA_WAV_CONTAINER_INVALID" }));
  });

  it("enforces actual byte and frame-duration limits independently", () => {
    const bytes = wav(9);
    expect(() => inspectGovernedPcmWav(bytes, { ...limits, maxBytes: bytes.length - 1 }))
      .toThrowError(expect.objectContaining({ code: "FORGE_MEDIA_WAV_BYTE_LIMIT" }));
    expect(() => inspectGovernedPcmWav(bytes, { ...limits, maxDurationMs: 1 }))
      .toThrowError(expect.objectContaining({ code: "FORGE_MEDIA_WAV_DURATION_LIMIT" }));
  });

  it.each(["duplicate-data", "duplicate-fmt", "data-before-fmt", "empty-data", "unaligned-data", "missing-data"])("rejects %s", (kind) => {
    const fmt = chunk("fmt ", format()), data = chunk("data", Buffer.alloc(4));
    const chunks = kind === "duplicate-data" ? [fmt, data, data] : kind === "duplicate-fmt" ? [fmt, fmt, data]
      : kind === "data-before-fmt" ? [data, fmt] : kind === "empty-data" ? [fmt, chunk("data", Buffer.alloc(0))]
        : kind === "unaligned-data" ? [fmt, chunk("data", Buffer.alloc(3))] : [fmt, chunk("JUNK", Buffer.alloc(4))];
    expect(() => inspectGovernedPcmWav(container(chunks), limits)).toThrowError(expect.objectContaining({ retryable: false }));
  });

  it.each(["float", "channels", "rate-low", "rate-high", "byte-rate", "align", "bits", "extension"])("rejects malformed PCM %s", (kind) => {
    const fmt = format(kind === "extension" ? 18 : 16);
    if (kind === "float") fmt.writeUInt16LE(3, 0);
    else if (kind === "channels") fmt.writeUInt16LE(3, 2);
    else if (kind === "rate-low") fmt.writeUInt32LE(7999, 4);
    else if (kind === "rate-high") fmt.writeUInt32LE(48001, 4);
    else if (kind === "byte-rate") fmt.writeUInt32LE(123, 8);
    else if (kind === "align") fmt.writeUInt16LE(4, 12);
    else if (kind === "bits") fmt.writeUInt16LE(8, 14);
    else fmt.writeUInt16LE(2, 16);
    expect(() => inspectGovernedPcmWav(wav(8, fmt), limits))
      .toThrowError(expect.objectContaining({ code: "FORGE_MEDIA_WAV_FORMAT_INVALID" }));
  });

  it("does not alias high-bit chunk identifiers to accepted ASCII names", () => {
    const bytes = wav(); bytes[12] |= 0x80;
    expect(() => inspectGovernedPcmWav(bytes, limits)).toThrowError(expect.objectContaining({ code: "FORGE_MEDIA_WAV_CHUNK_UNSUPPORTED" }));
  });

  it("rejects chunk arithmetic, malformed LIST metadata and excessive chunk counts", () => {
    const oversized = wav(); oversized.writeUInt32LE(0xffffffff, 16);
    const brokenInfo = chunk("LIST", Buffer.concat([Buffer.from("INFO"), Buffer.alloc(7)]));
    for (const bytes of [oversized, wav(8, format(), [brokenInfo]),
      wav(8, format(), [chunk("LIST", Buffer.from("ADTL"))]),
      wav(8, format(), Array.from({ length: 64 }, () => chunk("JUNK", Buffer.alloc(0))))]) {
      expect(() => inspectGovernedPcmWav(bytes, limits)).toThrow();
    }
  });

  it.each([{ maxBytes: 45 }, { maxBytes: 4194305 }, { maxDurationMs: 0 }, { maxDurationMs: 120001 }])("rejects invalid declared limits %j", (override) => {
    expect(() => inspectGovernedPcmWav(wav(), { ...limits, ...override }))
      .toThrowError(expect.objectContaining({ code: "FORGE_MEDIA_WAV_LIMIT_INVALID" }));
  });
});
