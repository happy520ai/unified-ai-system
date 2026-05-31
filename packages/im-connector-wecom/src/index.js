/**
 * WeCom (Enterprise WeChat) IM Connector
 *
 * Sends messages to WeCom via its Bot Webhook API.
 * Supports text and markdown message formats.
 *
 * Safety: Uses webhook URL from config, never stores secrets in code.
 */

export const WECOM_CONNECTOR_PHASE = "Phase590";
export const WECOM_CONNECTOR_ID = "wecom";

/**
 * @typedef {Object} WeComConnectorConfig
 * @property {string} webhookUrl - WeCom bot webhook URL
 * @property {number} [timeoutMs=10000] - Request timeout
 * @property {boolean} [dryRun=true] - Default dry-run mode
 */

/**
 * Create a WeCom connector instance.
 * @param {WeComConnectorConfig} config
 */
export function createWeComConnector(config = {}) {
  const { webhookUrl, timeoutMs = 10000, dryRun = true } = config;

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

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
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
      supportedFormats: ["text", "markdown"],
    };
  }

  return { sendMessage, getHealth, connectorId: WECOM_CONNECTOR_ID };
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
