import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";

export const FEISHU_CONNECTOR_PHASE = "Phase589";
export const FEISHU_CONNECTOR_ID = "feishu";
const API_ORIGIN = "https://open.feishu.cn";
const RECEIVE_TYPES = new Set(["open_id", "user_id", "union_id", "email", "chat_id"]);
const FORMATS = new Set(["text", "markdown", "card"]);
const RESPONSE_LIMIT = 64 * 1024;
export type FeishuEnvelope = { title?: string; body?: string; riskLevel?: string; requiresResponse?: boolean; responseDeadlineMs?: number };
export type FeishuTarget = { targetId?: string; receiveIdType?: string; format?: string; externalEffectKey?: string };
export type ConnectorEffectInput = { effectType: string; effectKeyHash: string; targetFingerprint: string; payloadFingerprint: string };
export type ConnectorEffectGuard = { reserveAndCommit(input: ConnectorEffectInput): Promise<void> };
export type FeishuSendOptions = { signal?: AbortSignal; externalEffectGuard?: ConnectorEffectGuard };
export type FeishuConnectorConfig = {
  mode?: "webhook" | "api"; webhookUrl?: string; appId?: string; appSecret?: string;
  getAppSecret?: () => string | null | Promise<string | null>;
  timeoutMs?: number; dryRun?: boolean; externalEffectGuard?: ConnectorEffectGuard;
  transport?: (url: string, init: RequestInit) => Promise<Response>;
};
export type FeishuSendResult = {
  delivered: boolean; dryRun: boolean; externalMessageId: string | null;
  status: "dry_run" | "not_sent" | "accepted" | "rejected" | "outcome_unknown";
  messageAttempted: boolean; outcomeUnknown: boolean; error?: string;
  metadata: Record<string, unknown>;
};
class FeishuFailure extends Error {
  httpStatus?: number;
  providerCode?: number;
  constructor(code: string, httpStatus?: number, providerCode?: number) {
    super(code); this.httpStatus = httpStatus; this.providerCode = providerCode;
  }
}
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`).join(",")}}`;
}
function boundedString(value: unknown, fallback: string, maxBytes: number): string {
  if (value === undefined || value === "") return fallback;
  if (typeof value !== "string" || Buffer.byteLength(value, "utf8") > maxBytes || /[\x00-\x08\x0b\x0c\x0e-\x1f]/u.test(value)) throw new FeishuFailure("feishu_message_invalid");
  return value;
}
function buildPayload(envelope: FeishuEnvelope, format: string) {
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope) || !FORMATS.has(format)) throw new FeishuFailure("feishu_message_invalid");
  const title = boundedString(envelope.title, "Message from AI Gateway", 512), body = boundedString(envelope.body, "", 16384);
  if (envelope.requiresResponse !== undefined && typeof envelope.requiresResponse !== "boolean") throw new FeishuFailure("feishu_message_invalid");
  const delay = envelope.responseDeadlineMs ?? 3600000;
  if (!Number.isSafeInteger(delay) || delay < 1 || delay > 86400000) throw new FeishuFailure("feishu_message_invalid");
  const card = { header: { title: { tag: "plain_text", content: title }, template: envelope.riskLevel === "high" ? "red" : "blue" },
    elements: [{ tag: "markdown", content: body }, ...(envelope.requiresResponse ? [{ tag: "note", elements: [
      { tag: "plain_text", content: `Requires response by ${new Date(Date.now() + delay).toISOString()}` },
    ] }] : [])] };
  return format === "text" ? { msg_type: "text", content: { text: `[${title}]\n${body}` } } : { msg_type: "interactive", card };
}
function safeCode(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && Math.abs(value) <= 2147483647 ? value : undefined;
}
function waitForStep<T>(operation: () => Promise<T> | T, signal: AbortSignal, lateResult?: (value: T) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const abort = () => { if (!settled) { settled = true; signal.removeEventListener("abort", abort); reject(signal.reason); } };
    const finish = () => { settled = true; signal.removeEventListener("abort", abort); };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) { abort(); return; }
    Promise.resolve().then(() => { signal.throwIfAborted(); return operation(); }).then(value => {
      if (settled) { try { lateResult?.(value); } catch { /* The caller already received an interrupted outcome. */ } return; }
      finish(); resolve(value);
    }, error => { if (!settled) { finish(); reject(error); } });
  });
}
function cancelLateResponse(response: Response) { void response.body?.cancel().catch(() => {}); }
async function readResponse(response: Response, signal: AbortSignal): Promise<Record<string, unknown>> {
  if (!response.body || typeof response.body.getReader !== "function") throw new FeishuFailure("feishu_response_invalid");
  const reader = response.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    signal.throwIfAborted();
    for (;;) {
      const next = await waitForStep(() => reader.read(), signal); signal.throwIfAborted();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > RESPONSE_LIMIT) { cancel(); throw new FeishuFailure("feishu_response_too_large"); }
      chunks.push(next.value);
    }
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new FeishuFailure("feishu_response_invalid");
    return parsed as Record<string, unknown>;
  } finally { signal.removeEventListener("abort", cancel); reader.releaseLock(); }
}

/** Standalone protocol client; the application owns identity, target authorization and safe transport. */
export function createFeishuConnector(config: FeishuConnectorConfig = {}) {
  const { mode = "webhook", webhookUrl, appId, appSecret, getAppSecret, timeoutMs = 10000, dryRun = true } = config;
  if (!["webhook", "api"].includes(mode) || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw new Error("Invalid Feishu connector configuration.");
  const transport = config.transport ?? ((url: string, init: RequestInit) => fetch(url, init));
  if (typeof transport !== "function") throw new Error("Invalid Feishu connector transport.");
  let token: { value: string; expires: number } | null = null;
  const lifetime = new AbortController();
  const pending = new Set<Promise<FeishuSendResult>>();
  let closed = false;
  async function sendMessage(envelope: FeishuEnvelope, target: FeishuTarget = {}, options: FeishuSendOptions = {}): Promise<FeishuSendResult> {
    const format = target.format ?? "text";
    let messageAttempted = false, phase = "prepare", httpStatus: number | undefined, providerCode: number | undefined;
    const metadata = () => ({ connectorId: FEISHU_CONNECTOR_ID, mode, format,
      ...(mode === "api" ? { targetId: target.targetId, receiveIdType: target.receiveIdType ?? "open_id" } : { targetBoundToWebhook: true }),
      ...(httpStatus === undefined ? {} : { httpStatus }), ...(providerCode === undefined ? {} : { feishuCode: providerCode }) });
    const result = (status: FeishuSendResult["status"], error?: string, messageId: string | null = null): FeishuSendResult => ({
      delivered: status === "accepted", dryRun, externalMessageId: messageId, status, messageAttempted,
      outcomeUnknown: status === "outcome_unknown", ...(error ? { error } : {}), metadata: metadata(),
    });
    const signal = AbortSignal.any([lifetime.signal, AbortSignal.timeout(timeoutMs), ...(options.signal ? [options.signal] : [])]);
    try {
      signal.throwIfAborted();
      if (closed) return result("not_sent", "feishu_connector_closed");
      const webhookPayload = buildPayload(envelope, format), receiveIdType = target.receiveIdType ?? "open_id";
      if (mode === "api" && (!RECEIVE_TYPES.has(receiveIdType) || typeof target.targetId !== "string" || !target.targetId.trim()
        || Buffer.byteLength(target.targetId, "utf8") > 256 || /[\x00-\x20\x7f]/u.test(target.targetId))) return result("not_sent", "feishu_target_invalid");
      if (dryRun) return { ...result("dry_run"), metadata: { ...metadata(), targetId: target.targetId, messagePreview: boundedString(envelope.body, "", 16384).slice(0, 200) } };
      if (mode === "webhook" && !webhookUrl) return result("not_sent", "feishu_webhook_not_configured");
      if (mode === "api" && (typeof appId !== "string" || !/^[A-Za-z0-9_-]{1,256}$/u.test(appId) || (!appSecret && !getAppSecret))) return result("not_sent", "feishu_api_not_configured");
      const endpoint = mode === "api" ? `${API_ORIGIN}/open-apis/im/v1/messages?receive_id_type=${receiveIdType}` : webhookUrl!;
      const payload = mode === "api" ? { receive_id: target.targetId, msg_type: webhookPayload.msg_type,
        content: JSON.stringify(webhookPayload.msg_type === "text" ? webhookPayload.content : webhookPayload.card) } : webhookPayload;
      const serialized = JSON.stringify(payload);
      if (Buffer.byteLength(serialized, "utf8") > 30000) return result("not_sent", "feishu_message_too_large");
      const guard = options.externalEffectGuard ?? config.externalEffectGuard;
      if (!guard || typeof guard.reserveAndCommit !== "function") return result("not_sent", "feishu_external_effect_guard_required");
      const key = target.externalEffectKey;
      if (typeof key !== "string" || key.length < 1 || key.length > 255 || !/^[\x21-\x7e]+$/u.test(key)) return result("not_sent", "feishu_external_effect_key_required");
      const targetFingerprint = mode === "api" ? hash(stableStringify({ mode, appId, receiveIdType, targetId: target.targetId })) : hash(String(webhookUrl));
      phase = "reserve";
      await waitForStep(() => guard.reserveAndCommit({ effectType: mode === "api" ? "api:feishu" : "webhook:feishu", effectKeyHash: hash(key),
        targetFingerprint, payloadFingerprint: hash(stableStringify({ targetFingerprint, payload })) }), signal);
      signal.throwIfAborted();
      if (closed) return result("not_sent", "feishu_connector_closed");
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (mode === "api") {
        phase = "auth";
        if (!token || token.expires <= performance.now()) {
          token = null;
          const secret = getAppSecret ? await waitForStep(getAppSecret, signal) : appSecret;
          signal.throwIfAborted();
          if (closed) return result("not_sent", "feishu_connector_closed");
          if (typeof secret !== "string" || !secret || secret.length > 4096) return result("not_sent", "feishu_credential_unavailable");
          const auth = await waitForStep(() => transport(`${API_ORIGIN}/open-apis/auth/v3/tenant_access_token/internal`, {
            method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ app_id: appId, app_secret: secret }), signal, redirect: "error",
          }), signal, cancelLateResponse);
          const data = await readResponse(auth, signal);
          if (!auth.ok || data.code !== 0 || typeof data.tenant_access_token !== "string" || !/^[\x21-\x7e]{1,4096}$/u.test(data.tenant_access_token)
            || !Number.isSafeInteger(data.expire) || Number(data.expire) < 1 || Number(data.expire) > 86400) throw new FeishuFailure("feishu_auth_failed", auth.status, safeCode(data.code));
          signal.throwIfAborted();
          if (closed) return result("not_sent", "feishu_connector_closed");
          token = { value: data.tenant_access_token, expires: performance.now() + Math.max(0, Number(data.expire) * 1000 - 30000) };
        }
        headers.authorization = `Bearer ${token.value}`;
      }
      signal.throwIfAborted();
      if (closed) return result("not_sent", "feishu_connector_closed");
      phase = "message";
      const response = await waitForStep(() => {
        messageAttempted = true;
        return transport(endpoint, { method: "POST", headers, body: serialized, signal, redirect: "error" });
      }, signal, cancelLateResponse);
      httpStatus = response.status;
      const data = await readResponse(response, signal); providerCode = safeCode(data.code);
      if (closed || signal.aborted) return result("outcome_unknown", "feishu_send_interrupted");
      if (response.ok && providerCode === 0) {
        const receipt = mode === "api" ? (data.data as Record<string, unknown> | undefined)?.message_id : data.message_id;
        const id = typeof receipt === "string" && /^[A-Za-z0-9_.:-]{1,256}$/u.test(receipt) ? receipt : null;
        if (mode === "api" && !id) return result("outcome_unknown", "feishu_receipt_missing");
        return result("accepted", undefined, id);
      }
      token = null;
      return result(providerCode !== undefined && providerCode !== 0 && response.status < 500 ? "rejected" : "outcome_unknown", "feishu_send_rejected");
    } catch (error) {
      const code = phase === "reserve" ? "feishu_external_effect_rejected" : signal.aborted ? "feishu_send_interrupted"
        : error instanceof FeishuFailure ? error.message : phase === "auth" ? "feishu_auth_failed" : "feishu_request_failed";
      if (error instanceof FeishuFailure) { httpStatus = error.httpStatus ?? httpStatus; providerCode = error.providerCode ?? providerCode; }
      return result(messageAttempted ? "outcome_unknown" : "not_sent", code);
    }
  }
  function getHealth() {
    return { phase: FEISHU_CONNECTOR_PHASE, connectorId: FEISHU_CONNECTOR_ID, mode,
      status: closed ? "closed" : dryRun || (mode === "api" ? appId && (appSecret || getAppSecret) : webhookUrl) ? "ready" : "not-configured",
      webhookConfigured: Boolean(webhookUrl), appIdConfigured: Boolean(appId), dryRun,
      externalEffectGuardConfigured: typeof config.externalEffectGuard?.reserveAndCommit === "function", supportedFormats: [...FORMATS] };
  }
  return Object.freeze({ sendMessage(envelope: FeishuEnvelope, target?: FeishuTarget, options?: FeishuSendOptions) {
    const operation = sendMessage(envelope, target, options); pending.add(operation);
    return operation.finally(() => pending.delete(operation));
  }, getHealth, connectorId: FEISHU_CONNECTOR_ID, async close() {
    closed = true; token = null; lifetime.abort(); await Promise.allSettled([...pending]);
  } });
}
