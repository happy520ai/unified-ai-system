import type { IncomingMessage } from "node:http";
import { createFeishuConnector, type ConnectorEffectInput } from "@unified-ai-system/im-connector-feishu";
import { createWeComConnector } from "@unified-ai-system/im-connector-wecom";
import { createCredentialResolver } from "../credentials/credentialResolver.js";
import { readExternalEffectKeyContext } from "../external-effects/externalEffectHttpContext.ts";
import type { ExternalEffectGate } from "../external-effects/externalEffectGate.ts";
import { safeOutboundFetch } from "../security/safeOutboundFetch.ts";

type Env = Record<string, string | undefined>;
type ConnectorId = "feishu" | "wecom";
type RequestIdentity = IncomingMessage & { enterpriseIdentity?: { tenantId?: string; tenant?: string; userId?: string } };
type ApiTarget = Readonly<{ tenantId: string; receiveIdType: string; targetId: string }>;
const RECEIVERS = new Set(["open_id", "user_id", "union_id", "email", "chat_id"]);
const FIELDS = new Set(["title", "body", "text", "format", "targetId", "receiveIdType", "riskLevel", "requiresResponse", "responseDeadlineMs"]);
function failure(code: string, statusCode: number, message: string, details?: unknown) {
  return Object.assign(new Error(message), { code, statusCode, category: statusCode < 500 ? "validation" : "runtime", ...(details ? { details } : {}) });
}
function configError() { return failure("IM_CONFIGURATION_INVALID", 503, "IM connector configuration is invalid."); }
function text(value: unknown, limit: number) {
  return typeof value === "string" && value.length > 0 && value.length <= limit && !/[\x00-\x20\x7f]/u.test(value);
}
export function readImConnectorConfiguration(env: Env) {
  const mode = env.FEISHU_CONNECTOR_MODE ?? "webhook";
  if (mode !== "api" && mode !== "webhook") throw configError();
  const targets: ApiTarget[] = [];
  let secretRef: Readonly<{ type: string; reference: string }> | null = null;
  if (mode === "api") {
    if (!text(env.FEISHU_APP_ID, 256) || !/^[A-Za-z0-9_-]+$/u.test(env.FEISHU_APP_ID!)) throw configError();
    const ref = env.FEISHU_APP_SECRET_REF;
    if (typeof ref !== "string" || ref.length > 1024) throw configError();
    const match = /^(env_key_name|file_key_path):(.+)$/u.exec(ref);
    if (!match || !text(match[2], 1000)) throw configError();
    secretRef = Object.freeze({ type: match[1], reference: match[2] });
    const raw = env.FEISHU_API_TARGETS_JSON;
    if (typeof raw !== "string" || Buffer.byteLength(raw, "utf8") > 32768) throw configError();
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { throw configError(); }
    if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 64) throw configError();
    const seen = new Set();
    for (const item of parsed) {
      if (!item || typeof item !== "object" || Object.keys(item).sort().join(",") !== "receiveIdType,targetId,tenantId"
        || !text(item.tenantId, 256) || !text(item.targetId, 256) || !RECEIVERS.has(item.receiveIdType)) throw configError();
      const key = JSON.stringify([item.tenantId, item.receiveIdType, item.targetId]);
      if (seen.has(key)) throw configError(); seen.add(key);
      targets.push(Object.freeze({ tenantId: item.tenantId, receiveIdType: item.receiveIdType, targetId: item.targetId }));
    }
  } else if (env.FEISHU_APP_SECRET_REF || env.FEISHU_API_TARGETS_JSON) {
    throw configError();
  }
  return Object.freeze({ mode, appId: env.FEISHU_APP_ID, secretRef, targets: Object.freeze(targets),
    feishuWebhook: env.FEISHU_WEBHOOK_URL || "", wecomWebhook: env.WECOM_WEBHOOK_URL || "" });
}

export function createImConnectorRuntime({ env, gate, configuration = readImConnectorConfiguration(env) }: {
  env: Env; gate: ExternalEffectGate; configuration?: ReturnType<typeof readImConnectorConfiguration>;
}) {
  const resolver = createCredentialResolver({ env });
  let closed = false;
  const feishu = createFeishuConnector({ mode: configuration.mode, webhookUrl: configuration.feishuWebhook,
    appId: configuration.appId, dryRun: configuration.mode === "webhook" && !configuration.feishuWebhook,
    ...(configuration.secretRef ? { getAppSecret: () => {
      const material = resolver.materializeCredentialRef(configuration.secretRef);
      return material.materialized === true && typeof material.secret === "string" ? material.secret : null;
    } } : {}), transport: safeOutboundFetch });
  const wecom = createWeComConnector({ webhookUrl: configuration.wecomWebhook, dryRun: !configuration.wecomWebhook, transport: safeOutboundFetch });
  const connectors = { feishu, wecom };
  function getHealth(tenantId?: string) {
    return { connectors: [{ connectorId: "explicit-text", title: "Explicit Text Connector", mode: "manual-input",
      safety: "No crawling, no broad file scan, no background sync." }, ...Object.entries(connectors).map(([id, connector]) => {
      const health = connector.getHealth();
      return { connectorId: id, title: id === "feishu" ? "Feishu" : "WeCom / Enterprise WeChat", mode: health.mode,
        status: closed ? "closed" : health.dryRun ? "dry-run" : "configured-unverified", dryRun: health.dryRun,
        webhookConfigured: health.webhookConfigured, supportedFormats: health.supportedFormats,
        ...(id === "feishu" && configuration.mode === "api" ? { appIdConfigured: true,
          allowedTargets: configuration.targets.filter(target => target.tenantId === tenantId).length } : {}) };
    })] };
  }
  async function send(connectorId: ConnectorId, input: unknown, request: RequestIdentity, signal?: AbortSignal) {
    if (closed) throw failure("IM_RUNTIME_CLOSED", 503, "IM connector runtime is closed.");
    if (!Object.hasOwn(connectors, connectorId)) throw failure("IM_CONNECTOR_INVALID", 400, "Unsupported IM connector.");
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(key => !FIELDS.has(key))) {
      throw failure("IM_MESSAGE_INVALID", 400, "Unsupported IM message fields.");
    }
    const body = input as Record<string, unknown>;
    if (["title", "body", "text", "targetId", "receiveIdType"].some(key => body[key] !== undefined && typeof body[key] !== "string")
      || (body.requiresResponse !== undefined && typeof body.requiresResponse !== "boolean")
      || (body.riskLevel !== undefined && !["low", "medium", "high"].includes(body.riskLevel as string))
      || (body.responseDeadlineMs !== undefined && (!Number.isSafeInteger(body.responseDeadlineMs)
        || Number(body.responseDeadlineMs) < 1 || Number(body.responseDeadlineMs) > 86400000))) {
      throw failure("IM_MESSAGE_INVALID", 400, "Invalid IM message field types or limits.");
    }
    if (body.body !== undefined && body.text !== undefined && body.body !== body.text) throw failure("IM_MESSAGE_INVALID", 400, "Conflicting message text fields.");
    if (body.format !== undefined && typeof body.format !== "string") throw failure("IM_MESSAGE_INVALID", 400, "Invalid IM message format.");
    const format = body.format ?? "text";
    if (!(connectorId === "feishu" ? ["text", "card", "markdown"] : ["text", "markdown"]).includes(format as string)) {
      throw failure("IM_FORMAT_UNSUPPORTED", 400, "This connector does not support the requested format.");
    }
    const identity = request.enterpriseIdentity;
    const tenantId = identity?.tenantId ?? identity?.tenant ?? "default";
    const api = connectorId === "feishu" && configuration.mode === "api";
    let receiveIdType: string | undefined, targetId: string | undefined;
    if (api) {
      if (!text(identity?.userId, 256) || !text(identity?.tenantId, 256)) throw failure("IM_IDENTITY_REQUIRED", 401, "Feishu API messages require an authenticated tenant identity.");
      receiveIdType = typeof body.receiveIdType === "string" ? body.receiveIdType : "open_id";
      targetId = typeof body.targetId === "string" ? body.targetId : undefined;
      if (!configuration.targets.some(target => target.tenantId === tenantId && target.receiveIdType === receiveIdType && target.targetId === targetId)) {
        throw failure("IM_TARGET_FORBIDDEN", 403, "The recipient is not configured for this tenant.");
      }
    } else if (body.targetId !== undefined || body.receiveIdType !== undefined) {
      throw failure("IM_TARGET_UNSUPPORTED", 400, "A webhook sends only to its configured group; recipient overrides are unsupported.");
    }
    const assertActive = () => {
      if (closed || signal?.aborted || request.aborted || request.socket?.destroyed) throw failure("IM_REQUEST_INTERRUPTED", 409, "The IM request is no longer active.");
    };
    assertActive();
    const connector = connectors[connectorId], dryRun = connector.getHealth().dryRun;
    const key = readExternalEffectKeyContext(request);
    if (!dryRun) {
      if (key.effectKeyInvalid) throw failure("EXTERNAL_EFFECT_KEY_INVALID", 400, "External effects require exactly one valid operation key.");
      if (!key.effectKeyHash) throw failure("EXTERNAL_EFFECT_KEY_REQUIRED", 400, "An external-effect operation key is required.");
      if (gate?.status?.enabled !== true || gate.status.durable !== true || gate.getHealth().available !== true) {
        throw failure("EXTERNAL_EFFECT_STORE_UNAVAILABLE", 503, "A durable external-effect gate is required.");
      }
    }
    let admissionError: unknown;
    const guard = { async reserveAndCommit(input: ConnectorEffectInput) {
      try {
        assertActive();
        if (input.effectKeyHash !== key.effectKeyHash) throw failure("EXTERNAL_EFFECT_KEY_INVALID", 400, "The operation key changed.");
        const reservation = await gate.reserve({ ...key, route: `/connectors/${connectorId}/send`, tenantId,
          effectType: input.effectType, payloadFingerprint: input.payloadFingerprint, assertFence: assertActive });
        if (reservation.bypassed || !reservation.reserved) throw failure("EXTERNAL_EFFECT_STORE_UNAVAILABLE", 503, "The external effect was not reserved.");
        assertActive(); await reservation.commit(); assertActive();
      } catch (error) { admissionError = error; throw error; }
    } };
    const envelope = { title: body.title === undefined || body.title === "" ? "AI Gateway" : body.title, body: body.body ?? body.text ?? "", riskLevel: body.riskLevel,
      requiresResponse: body.requiresResponse, responseDeadlineMs: body.responseDeadlineMs };
    const operationKey = request.headers["external-effect-key"] ?? request.headers["idempotency-key"];
    const result = await connector.sendMessage(envelope as Parameters<typeof feishu.sendMessage>[0],
      { format: format as string, ...(api ? { targetId, receiveIdType } : {}), externalEffectKey: typeof operationKey === "string" ? operationKey : undefined },
      { signal, externalEffectGuard: guard });
    if (admissionError) throw admissionError;
    if (result.status === "not_sent" && !dryRun) {
      const invalid = /message_invalid|message_too_large|target_invalid/u.test(result.error ?? "");
      throw failure(result.error ?? "IM_NOT_SENT", invalid ? 400 : 502, "The IM message was not submitted.", {
        messageAttempted: false, outcomeUnknown: false, status: result.status });
    }
    if (result.status === "outcome_unknown") throw failure("IM_SEND_OUTCOME_UNKNOWN", 502,
      "The message outcome is unknown. Reconcile it before submitting another operation.", { messageAttempted: true, outcomeUnknown: true, status: result.status });
    if (result.status === "not_sent") throw failure(result.error ?? "IM_MESSAGE_INVALID", 400, "Invalid IM message.");
    return { route: `/connectors/${connectorId}/send`, ...result };
  }
  return Object.freeze({ send, getHealth, async close() { closed = true; await Promise.all([feishu.close(), wecom.close()]); } });
}
