const MAX_RESPONSE_BYTES = 6 * 1024 * 1024;
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const SHA256 = /^[a-f0-9]{64}$/u;

function invalid() { throw new Error("Invalid or incomplete Forge media response"); }
function record(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Reflect.ownKeys(value).length !== keys.length) invalid();
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) invalid();
  }
  return value;
}
function identifier(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 512
    || /[\u0000-\u001f\u007f]/u.test(value)) invalid();
  return value;
}
function integer(value, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) invalid();
  return value;
}
async function digest(bytes) {
  if (!globalThis.crypto?.subtle) invalid();
  return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes)),
    byte => byte.toString(16).padStart(2, "0")).join("");
}

// Copy data properties before any asynchronous operation or caller-supplied key factory.
export function snapshotForgeOrchestrateRequest(request) {
  const seen = new Set();
  let nodes = 0;
  function copy(value, depth = 0) {
    if (++nodes > 8192 || depth > 20) invalid();
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "string") { if (value.length > MAX_RESPONSE_BYTES) invalid(); return value; }
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "object" || seen.has(value)) invalid();
    seen.add(value);
    const array = Array.isArray(value);
    if (!array && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid();
    const result = array ? [] : Object.create(null);
    for (const key of Reflect.ownKeys(value)) {
      if (array && key === "length") continue;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (typeof key !== "string" || !descriptor?.enumerable || !("value" in descriptor)) invalid();
      Object.defineProperty(result, key, { value: descriptor.value === undefined ? undefined : copy(descriptor.value, depth + 1), enumerable: true });
    }
    seen.delete(value);
    return result;
  }
  const snapshot = copy(request);
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) invalid();
  if (!Object.hasOwn(snapshot.options ?? {}, "mediaTask")) return snapshot;
  if (Array.isArray(snapshot.options)) invalid();
  if (typeof snapshot.goal !== "string" || !snapshot.goal.trim() || typeof snapshot.agentId !== "string") invalid();
  identifier(snapshot.agentId);
  const media = record(snapshot.options?.mediaTask, ["profileId", "text"]);
  const selection = record(snapshot.options?.modelSelection, ["providerId", "modelId"]);
  identifier(media.profileId); identifier(selection.providerId); identifier(selection.modelId);
  if (typeof media.text !== "string" || !media.text.trim()) invalid();
  return snapshot;
}

// Neither success nor HTTP-error responses may bypass the actual byte limit.
export async function readForgeMediaResponse(response, signal) {
  if (!response.body || typeof response.body.getReader !== "function") invalid();
  const reader = response.body.getReader();
  const bytes = new Uint8Array(MAX_RESPONSE_BYTES);
  let size = 0, complete = false;
  let onAbort;
  const aborted = signal ? new Promise((_, reject) => {
    onAbort = () => reject(new Error("Forge media response read aborted"));
    if (signal.aborted) onAbort(); else signal.addEventListener("abort", onAbort, { once: true });
  }) : null;
  aborted?.catch(() => {}); // Also handle abort if a nonconforming reader throws synchronously.
  try {
    for (;;) {
      const pending = reader.read();
      const { done, value } = await (aborted ? Promise.race([pending, aborted]) : pending);
      if (done) { complete = true; break; }
      if (!(value instanceof Uint8Array) || value.byteLength > MAX_RESPONSE_BYTES - size) invalid();
      bytes.set(value, size);
      size += value.byteLength;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, size)));
  } catch { invalid(); }
  finally {
    if (onAbort) signal.removeEventListener("abort", onAbort);
    if (!complete) {
      let timer;
      try {
        await Promise.race([Promise.resolve(reader.cancel()).catch(() => {}),
          new Promise(resolve => { timer = setTimeout(resolve, 100); })]);
      } catch { /* Original read failure is authoritative. */ }
      finally { if (timer !== undefined) clearTimeout(timer); }
    }
    try { reader.releaseLock(); } catch { /* No response data is exposed on failure. */ }
  }
}

export async function decodeForgeMediaArtifact(artifact) {
  const a = record(artifact, ["version", "format", "contentType", "sha256", "bytes", "sampleRate",
    "channels", "bitsPerSample", "frameCount", "durationMs", "audioBase64"]);
  if (a.version !== 1 || a.format !== "wav-pcm16" || a.contentType !== "audio/wav"
    || typeof a.sha256 !== "string" || !SHA256.test(a.sha256) || a.bitsPerSample !== 16) invalid();
  const size = integer(a.bytes, 46, MAX_AUDIO_BYTES);
  integer(a.sampleRate, 8000, 48000); integer(a.channels, 1, 2); integer(a.frameCount, 1, MAX_AUDIO_BYTES / 2);
  const duration = a.frameCount * 1000 / a.sampleRate;
  if (typeof a.durationMs !== "number" || !Number.isFinite(a.durationMs)
    || a.durationMs <= 0 || duration > 120000 || Math.abs(a.durationMs - duration) > 1e-6) invalid();
  if (typeof a.audioBase64 !== "string" || a.audioBase64.length !== Math.ceil(size / 3) * 4
    || !/^[A-Za-z0-9+/]*={0,2}$/u.test(a.audioBase64)) invalid();
  // Avoid a recursive regex on multi-megabyte payloads and preserve canonical pad bits.
  const encoded = a.audioBase64;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  if (encoded.endsWith("==") && (alphabet.indexOf(encoded.at(-3)) & 15) !== 0
    || encoded.endsWith("=") && !encoded.endsWith("==") && (alphabet.indexOf(encoded.at(-2)) & 3) !== 0) invalid();
  const binary = globalThis.atob(encoded);
  if (binary.length !== size) invalid();
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  validateWave(bytes, a);
  if (await digest(bytes) !== a.sha256) invalid();
  return bytes;
}

function validateWave(bytes, metadata) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = offset => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE" || view.getUint32(4, true) !== bytes.length - 8) invalid();
  let offset = 12, chunks = 0, format = null, dataSize = null;
  while (offset < bytes.length) {
    if (++chunks > 64 || offset + 8 > bytes.length) invalid();
    const name = tag(offset), length = view.getUint32(offset + 4, true), start = offset + 8;
    const end = start + length;
    if (end > bytes.length || end + (length & 1) > bytes.length) invalid();
    if (name === "fmt ") {
      if (format || dataSize !== null || ![16, 18].includes(length) || view.getUint16(start, true) !== 1
        || length === 18 && view.getUint16(start + 16, true) !== 0) invalid();
      format = { channels: view.getUint16(start + 2, true), rate: view.getUint32(start + 4, true),
        byteRate: view.getUint32(start + 8, true), align: view.getUint16(start + 12, true), bits: view.getUint16(start + 14, true) };
    } else if (name === "data") {
      if (dataSize !== null || !format) invalid();
      dataSize = length;
    } else if (name === "LIST") {
      if (length < 4 || tag(start) !== "INFO") invalid();
      let info = start + 4;
      while (info < end) {
        if (++chunks > 64 || info + 8 > end) invalid();
        const infoSize = view.getUint32(info + 4, true);
        info += 8 + infoSize + (infoSize & 1);
        if (info > end) invalid();
      }
    } else if (name !== "JUNK") invalid();
    offset = end + (length & 1);
  }
  if (!format || dataSize === null || format.bits !== 16 || format.channels !== metadata.channels
    || format.rate !== metadata.sampleRate || format.align !== format.channels * 2
    || format.byteRate !== format.rate * format.align || dataSize !== metadata.frameCount * format.align) invalid();
}

export async function validateForgeMediaResponse(envelope, request) {
  if (!envelope || typeof envelope !== "object" || envelope.status !== "ok" || !envelope.data) invalid();
  const data = envelope.data;
  if (data.outcome === "approval_required") {
    if (data.agentId !== request.agentId || data.toolName !== "forge_orchestrate") invalid();
    identifier(data.approvalId); identifier(data.code);
    return envelope;
  }
  if (data.ok !== true) invalid();
  identifier(data.runId);
  const result = data.result;
  if (!result || result.status !== "completed") invalid();
  identifier(result.goalId);
  const media = record(result.media, ["version", "kind", "success", "outcomeUnknown", "synthetic", "request", "usage", "artifacts"]);
  if (media.version !== 1 || media.kind !== "tts" || media.success !== true || media.outcomeUnknown !== false
    || typeof media.synthetic !== "boolean") invalid();
  const binding = record(media.request, ["taskId", "goalId", "goalDigest", "agentId", "tenantId", "userId",
    "profileId", "profileHash", "providerId", "modelId", "voice", "textSha256", "textBytes"]);
  const text = request.options.mediaTask.text, encoder = new TextEncoder(), textBytes = encoder.encode(text);
  if (binding.taskId !== "media-tts" || binding.goalId !== result.goalId || binding.agentId !== request.agentId
    || binding.profileId !== request.options.mediaTask.profileId || binding.providerId !== request.options.modelSelection.providerId
    || binding.modelId !== request.options.modelSelection.modelId || binding.textBytes !== textBytes.byteLength
    || binding.textSha256 !== await digest(textBytes) || binding.goalDigest !== await digest(encoder.encode(request.goal))
    || typeof binding.profileHash !== "string" || !SHA256.test(binding.profileHash)) invalid();
  identifier(binding.tenantId); identifier(binding.userId); identifier(binding.voice);
  const usage = record(media.usage, ["source", "reported", "inputCharacters", "providerCalls"]);
  if (usage.source !== (media.synthetic ? "synthetic" : "not-reported") || usage.reported !== null
    || usage.inputCharacters !== Array.from(text).length || usage.providerCalls !== 1) invalid();
  if (!Array.isArray(media.artifacts) || media.artifacts.length !== 1 || Reflect.ownKeys(media.artifacts).length !== 2) invalid();
  await decodeForgeMediaArtifact(media.artifacts[0]);
  return envelope;
}
