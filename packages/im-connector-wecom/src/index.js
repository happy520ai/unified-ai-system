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
 */

/**
 * Create a WeCom connector instance.
 * @param {WeComConnectorConfig} config
 */
export function createWeComConnector(config = {}) {
  const { webhookUrl, timeoutMs = 10000, dryRun = true, externalEffectGuard } = config;

  /**
   * Send a message to WeCom.
   * @param {Object} envelope - Internal message envelope
   * @param {Object} target - { targetId, format }
   * @returns {Promise<Object>} Send result
   */
  async function sendMessage(envelope, target = {}) {
    const { targetId, format = "text" } = target;

    if (dryRun) {
      return {
        delivered: false,
        dryRun: true,
        externalMessageId: null,
        metadata: {
          connectorId: WECOM_CONNECTOR_ID,
          targetId,
          format,
          messagePreview: truncate(envelope.body || "", 200),
        },
      };
    }

    if (!webhookUrl) {
      return {
        delivered: false,
        dryRun: false,
        error: "wecom_webhook_not_configured",
        externalMessageId: null,
        metadata: { connectorId: WECOM_CONNECTOR_ID },
      };
    }

    const payload = buildWeComPayload(envelope, format);
    const effect = await commitExternalEffect({
      connectorId: WECOM_CONNECTOR_ID,
      externalEffectGuard,
      externalEffectKey: target.externalEffectKey,
      webhookUrl,
      payload,
    });
    if (!effect.ok) {
      return {
        delivered: false,
        dryRun: false,
        error: effect.error,
        externalMessageId: null,
        metadata: { connectorId: WECOM_CONNECTOR_ID },
      };
    }

    let timeoutId;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok || body.errcode !== 0) {
        return {
          delivered: false,
          dryRun: false,
          error: body.errmsg || `wecom_http_${response.status}`,
          externalMessageId: null,
          metadata: {
            connectorId: WECOM_CONNECTOR_ID,
            httpStatus: response.status,
            wecomErrcode: body.errcode,
          },
        };
      }

      return {
        delivered: true,
        dryRun: false,
        externalMessageId: body.msgid || null,
        metadata: {
          connectorId: WECOM_CONNECTOR_ID,
          targetId,
          format,
        },
      };
    } catch (error) {
      return {
        delivered: false,
        dryRun: false,
        error: error.name === "AbortError" ? "wecom_timeout" : (error.message || "wecom_network_error"),
        externalMessageId: null,
        metadata: {
          connectorId: WECOM_CONNECTOR_ID,
          errorCode: error.code || "UNKNOWN",
        },
      };
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  /**
   * Get connector health/status.
   */
  function getHealth() {
    return {
      phase: WECOM_CONNECTOR_PHASE,
      connectorId: WECOM_CONNECTOR_ID,
      status: "ready",
      webhookConfigured: Boolean(webhookUrl),
      dryRun,
      externalEffectGuardConfigured: Boolean(
        externalEffectGuard && typeof externalEffectGuard.reserveAndCommit === "function",
      ),
      supportedFormats: ["text", "markdown"],
    };
  }

  return { sendMessage, getHealth, connectorId: WECOM_CONNECTOR_ID };
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
