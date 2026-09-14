import { createHash } from "node:crypto";
import type { ForgeMediaArtifact } from "@unified-ai-system/shared-contracts";

function invalid(reason: string): never {
  throw Object.assign(new Error("The speech result does not satisfy the approved PCM WAV profile."), {
    code: "FORGE_MEDIA_WAV_" + reason, retryable: false,
  });
}
/** Inspect the exact private byte snapshot to deliver; this does not certify spoken content.
 * RIFF: https://learn.microsoft.com/en-us/windows/win32/xaudio2/resource-interchange-file-format--riff-
 * PCM: https://learn.microsoft.com/en-us/windows/win32/api/mmreg/ns-mmreg-waveformatex
 */
export function inspectGovernedPcmWav(bytes: Buffer, limits: {
  maxBytes: number; maxDurationMs: number;
}): Omit<ForgeMediaArtifact, "audioBase64"> {
  if (!Number.isSafeInteger(limits?.maxBytes) || limits.maxBytes < 46 || limits.maxBytes > 4194304
    || !Number.isSafeInteger(limits.maxDurationMs) || limits.maxDurationMs < 1 || limits.maxDurationMs > 120000) invalid("LIMIT_INVALID");
  if (!Buffer.isBuffer(bytes) || bytes.length < 46) invalid("EMPTY_OR_TRUNCATED");
  if (bytes.length > limits.maxBytes) invalid("BYTE_LIMIT");
  if (bytes.toString("latin1", 0, 4) !== "RIFF" || bytes.toString("latin1", 8, 12) !== "WAVE"
    || bytes.readUInt32LE(4) !== bytes.length - 8) invalid("CONTAINER_INVALID");
  let offset = 12, chunks = 0, dataBytes: number | null = null;
  let format: { sampleRate: number; channels: 1 | 2; blockAlign: number } | null = null;
  while (offset < bytes.length) {
    if (++chunks > 64 || bytes.length - offset < 8) invalid("CHUNK_INVALID");
    const id = bytes.toString("latin1", offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4), start = offset + 8, end = start + size;
    const next = end + (size % 2);
    if (next > bytes.length) invalid("CHUNK_INVALID");
    if (id === "fmt ") {
      if (format || dataBytes !== null || (size !== 16 && size !== 18)) invalid("FORMAT_INVALID");
      const tag = bytes.readUInt16LE(start), channels = bytes.readUInt16LE(start + 2);
      const sampleRate = bytes.readUInt32LE(start + 4), byteRate = bytes.readUInt32LE(start + 8);
      const blockAlign = bytes.readUInt16LE(start + 12), bits = bytes.readUInt16LE(start + 14);
      if (tag !== 1 || (channels !== 1 && channels !== 2) || bits !== 16
        || sampleRate < 8000 || sampleRate > 48000 || blockAlign !== channels * 2
        || byteRate !== sampleRate * blockAlign || (size === 18 && bytes.readUInt16LE(start + 16) !== 0)) invalid("FORMAT_INVALID");
      format = { sampleRate, channels, blockAlign };
    } else if (id === "data") {
      if (!format || dataBytes !== null || size === 0 || size % format.blockAlign !== 0) invalid("DATA_INVALID");
      dataBytes = size;
    } else if (id === "LIST") {
      if (size < 4 || bytes.toString("latin1", start, start + 4) !== "INFO") invalid("CHUNK_UNSUPPORTED");
      let info = start + 4;
      while (info < end) {
        if (++chunks > 64 || end - info < 8) invalid("CHUNK_INVALID");
        const infoSize = bytes.readUInt32LE(info + 4);
        info += 8 + infoSize + (infoSize % 2);
        if (info > end) invalid("CHUNK_INVALID");
      }
    } else if (id !== "JUNK") invalid("CHUNK_UNSUPPORTED");
    offset = next;
  }
  if (!format || dataBytes === null) invalid("DATA_MISSING");
  const frameCount = dataBytes / format.blockAlign;
  if (frameCount * 1000 > limits.maxDurationMs * format.sampleRate) invalid("DURATION_LIMIT");
  return Object.freeze({ version: 1, format: "wav-pcm16", contentType: "audio/wav",
    sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length,
    sampleRate: format.sampleRate, channels: format.channels, bitsPerSample: 16,
    frameCount, durationMs: frameCount * 1000 / format.sampleRate });
}
