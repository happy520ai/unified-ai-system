/**
 * WeCom (Enterprise WeChat) IM Connector
 *
 * Sends messages to WeCom via its Bot Webhook API.
 * Supports text and markdown message formats.
 *
 * Safety: Uses webhook URL from config, never stores secrets in code.
 */

import { createHash } from "node:crypto";

export const WECOM_CONNECTOR_PHASE = "Phase590";
export const WECOM_CONNECTOR_ID = "wecom";

/**
 * @typedef {Object} WeComConnectorConfig
 * @property {string} webhookUrl - WeCom bot webhook URL
 * @property {number} [timeoutMs=10000] - Request timeout
 * @property {boolean} [dryRun=true] - Default dry-run mode
 * @property {{reserveAndCommit(input: Object): Promise<void>}} [externalEffectGuard]
 * @property {(url: string, init: RequestInit) => Promise<Response>} [transport]
 */

/**
 * Create a WeCom connector instance.
 * @param {WeComConnectorConfig} config
 */
export function createWeComConnector(config = {}) {
  const { webhookUrl, timeoutMs = 10000, dryRun = true } = config;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw new Error("Invalid WeCom connector timeout.");
  const transport = config.transport ?? ((url, init) => fetch(url, init));
  if (typeof transport !== "function") throw new Error("Invalid WeCom connector transport.");
  const lifetime = new AbortController(), pending = new Set();
  let closed = false;
  async function send(envelope, target = {}, options = {}) {
    const format = target.format ?? "text";
    let messageAttempted = false, httpStatus, providerCode;
    const result = (status, error, externalMessageId = null) => ({
      delivered: status === "accepted", dryRun, externalMessageId, status, messageAttempted,
      outcomeUnknown: status === "outcome_unknown", ...(error ? { error } : {}),
      metadata: { connectorId: WECOM_CONNECTOR_ID, mode: "webhook", format, targetBoundToWebhook: true,
        ...(httpStatus === undefined ? {} : { httpStatus }), ...(providerCode === undefined ? {} : { wecomErrcode: providerCode }) },
    });
    const signal = AbortSignal.any([lifetime.signal, AbortSignal.timeout(timeoutMs), ...(options.signal ? [options.signal] : [])]);
    try {
      if (closed) return result("not_sent", "wecom_connector_closed");
      signal.throwIfAborted();
      if (!envelope || typeof envelope !== "object" || !["text", "markdown"].includes(format)
        || (envelope.title !== undefined && typeof envelope.title !== "string")
        || (envelope.body !== undefined && typeof envelope.body !== "string")
        || Buffer.byteLength(envelope.title ?? "", "utf8") > 512
        || Buffer.byteLength(envelope.body ?? "", "utf8") > 16384) return result("not_sent", "wecom_message_invalid");
      const payload = buildWeComPayload(envelope, format), body = JSON.stringify(payload);
      if (Buffer.byteLength(body, "utf8") > 30000) return result("not_sent", "wecom_message_too_large");
      if (dryRun) return { ...result("dry_run"), metadata: { ...result("dry_run").metadata,
        targetId: target.targetId, messagePreview: truncate(envelope.body ?? "", 200) } };
      if (!webhookUrl) return result("not_sent", "wecom_webhook_not_configured");
      const effect = await waitForStep(() => commitExternalEffect({ connectorId: WECOM_CONNECTOR_ID,
        externalEffectGuard: options.externalEffectGuard ?? config.externalEffectGuard,
        externalEffectKey: target.externalEffectKey, webhookUrl, payload }), signal);
      if (!effect.ok) return result("not_sent", effect.error);
      signal.throwIfAborted();
      const response = await waitForStep(() => {
        messageAttempted = true;
        return transport(webhookUrl, { method: "POST", headers: { "content-type": "application/json" }, body, signal, redirect: "error" });
      },
        signal, response => { void response.body?.cancel().catch(() => {}); });
      httpStatus = response.status;
      const data = await readResponse(response, signal);
      providerCode = Number.isSafeInteger(data.errcode) && Math.abs(data.errcode) <= 2147483647 ? data.errcode : undefined;
      signal.throwIfAborted();
      if (response.ok && providerCode === 0) {
        const id = typeof data.msgid === "string" && /^[A-Za-z0-9_.:-]{1,256}$/u.test(data.msgid) ? data.msgid : null;
        return result("accepted", undefined, id);
      }
      return result(providerCode !== undefined && providerCode !== 0 && response.status < 500 ? "rejected" : "outcome_unknown", "wecom_send_rejected");
    } catch {
      return result(messageAttempted ? "outcome_unknown" : "not_sent", signal.aborted ? "wecom_send_interrupted" : "wecom_request_failed");
    }
  }
  function getHealth() {
    return { phase: WECOM_CONNECTOR_PHASE, connectorId: WECOM_CONNECTOR_ID, mode: "webhook",
      status: closed ? "closed" : dryRun || webhookUrl ? "ready" : "not-configured", webhookConfigured: Boolean(webhookUrl), dryRun,
      externalEffectGuardConfigured: typeof config.externalEffectGuard?.reserveAndCommit === "function", supportedFormats: ["text", "markdown"] };
  }
  return Object.freeze({ sendMessage(envelope, target, options) {
    const operation = send(envelope, target, options); pending.add(operation);
    return operation.finally(() => pending.delete(operation));
  }, getHealth, connectorId: WECOM_CONNECTOR_ID, async close() {
    closed = true; lifetime.abort(); await Promise.allSettled([...pending]);
  } });
}

function waitForStep(operation, signal, lateResult) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const abort = () => { if (!settled) { settled = true; signal.removeEventListener("abort", abort); reject(signal.reason); } };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) { abort(); return; }
    Promise.resolve().then(() => { signal.throwIfAborted(); return operation(); }).then(value => {
      if (settled) { try { lateResult?.(value); } catch { /* Interrupted outcome already reported. */ } return; }
      settled = true; signal.removeEventListener("abort", abort); resolve(value);
    }, error => { if (!settled) { settled = true; signal.removeEventListener("abort", abort); reject(error); } });
  });
}
async function readResponse(response, signal) {
  if (!response.body || typeof response.body.getReader !== "function") throw new Error("Invalid WeCom response.");
  const reader = response.body.getReader(), chunks = []; let length = 0;
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    signal.throwIfAborted();
    for (;;) {
      const next = await waitForStep(() => reader.read(), signal); signal.throwIfAborted();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > 65536) { cancel(); throw new Error("WeCom response too large."); }
      chunks.push(next.value);
    }
    const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid WeCom response.");
    return data;
  } finally { signal.removeEventListener("abort", cancel); reader.releaseLock(); }
}

async function commitExternalEffect({ connectorId, externalEffectGuard, externalEffectKey, webhookUrl, payload }) {
  if (!externalEffectGuard || typeof externalEffectGuard.reserveAndCommit !== "function") {
    return { ok: false, error: `${connectorId}_external_effect_guard_required` };
  }
  if (
    typeof externalEffectKey !== "string"
    || externalEffectKey.length < 1
    || externalEffectKey.length > 255
    || !/^[\x21-\x7e]+$/u.test(externalEffectKey)
  ) {
    return { ok: false, error: `${connectorId}_external_effect_key_required` };
  }
  try {
    const targetFingerprint = createHash("sha256").update(String(webhookUrl)).digest("hex");
    await externalEffectGuard.reserveAndCommit({
      effectType: `webhook:${connectorId}`,
      effectKeyHash: createHash("sha256").update(externalEffectKey).digest("hex"),
      targetFingerprint,
      payloadFingerprint: createHash("sha256")
        .update(stableStringify({ targetFingerprint, payload }))
        .digest("hex"),
    });
    return { ok: true };
  } catch {
    return { ok: false, error: `${connectorId}_external_effect_rejected` };
  }
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function buildWeComPayload(envelope, format) {
  const title = envelope.title || "Message from AI Gateway";
  const body = envelope.body || "";
  const header = `[${title}]\n`;

  if (format === "markdown") {
    return {
      msgtype: "markdown",
      markdown: {
        content: `## ${title}\n\n${body}${envelope.requiresResponse ? "\n\n> ⏰ Requires response" : ""}`,
      },
    };
  }

  return {
    msgtype: "text",
    text: {
      content: header + body,
    },
  };
}

function truncate(text, max) {
  return typeof text === "string" && text.length > max ? text.slice(0, max) + "..." : text;
}
