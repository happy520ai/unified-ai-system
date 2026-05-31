/**
 * Feishu (Lark) IM Connector
 *
 * Sends messages to Feishu/Lark via its Bot API.
 * Supports text and card message formats.
 *
 * Safety: Uses webhook URL from config, never stores secrets in code.
 */

export const FEISHU_CONNECTOR_PHASE = "Phase589";
export const FEISHU_CONNECTOR_ID = "feishu";

const FEISHU_MESSAGE_TYPES = Object.freeze({
  text: "text",
  markdown: "interactive",
  card: "interactive",
});

/**
 * @typedef {Object} FeishuConnectorConfig
 * @property {string} webhookUrl - Feishu bot webhook URL
 * @property {string} [appId] - Feishu app ID (for API mode)
 * @property {string} [appSecret] - Feishu app secret (for API mode)
 * @property {number} [timeoutMs=10000] - Request timeout
 * @property {boolean} [dryRun=true] - Default dry-run mode
 */

/**
 * Create a Feishu connector instance.
 * @param {FeishuConnectorConfig} config
 */
export function createFeishuConnector(config = {}) {
  const { webhookUrl, appId, appSecret, timeoutMs = 10000, dryRun = true } = config;

  /**
   * Send a message to Feishu.
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
          connectorId: FEISHU_CONNECTOR_ID,
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
        error: "feishu_webhook_not_configured",
        externalMessageId: null,
        metadata: { connectorId: FEISHU_CONNECTOR_ID },
      };
    }

    const payload = buildFeishuPayload(envelope, format, targetId);

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

      if (!response.ok || body.code !== 0) {
        return {
          delivered: false,
          dryRun: false,
          error: body.msg || `feishu_http_${response.status}`,
          externalMessageId: null,
          metadata: {
            connectorId: FEISHU_CONNECTOR_ID,
            httpStatus: response.status,
            feishuCode: body.code,
          },
        };
      }

      return {
        delivered: true,
        dryRun: false,
        externalMessageId: body.message_id || null,
        metadata: {
          connectorId: FEISHU_CONNECTOR_ID,
          targetId,
          format,
        },
      };
    } catch (error) {
      return {
        delivered: false,
        dryRun: false,
        error: error.name === "AbortError" ? "feishu_timeout" : (error.message || "feishu_network_error"),
        externalMessageId: null,
        metadata: {
          connectorId: FEISHU_CONNECTOR_ID,
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
      phase: FEISHU_CONNECTOR_PHASE,
      connectorId: FEISHU_CONNECTOR_ID,
      status: "ready",
      webhookConfigured: Boolean(webhookUrl),
      appIdConfigured: Boolean(appId),
      dryRun,
      supportedFormats: Object.keys(FEISHU_MESSAGE_TYPES),
    };
  }

  return { sendMessage, getHealth, connectorId: FEISHU_CONNECTOR_ID };
}

function buildFeishuPayload(envelope, format, targetId) {
  const title = envelope.title || "Message from AI Gateway";
  const body = envelope.body || "";

  if (format === "card") {
    return {
      msg_type: "interactive",
      card: {
        header: {
          title: { tag: "plain_text", content: title },
          template: envelope.riskLevel === "high" ? "red" : "blue",
        },
        elements: [
          {
            tag: "markdown",
            content: body,
          },
          ...(envelope.requiresResponse
            ? [{
                tag: "note",
                elements: [{
                  tag: "plain_text",
                  content: `Requires response by ${new Date(Date.now() + (envelope.responseDeadlineMs || 3600000)).toISOString()}`,
                }],
              }]
            : []),
        ],
      },
    };
  }

  return {
    msg_type: "text",
    content: {
      text: `[${title}]\n${body}`,
    },
  };
}

function truncate(text, max) {
  return typeof text === "string" && text.length > max ? text.slice(0, max) + "..." : text;
}
