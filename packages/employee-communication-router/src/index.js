/**
 * Employee Communication Router
 *
 * Routes internal employee messages to external IM connectors (Feishu, WeCom)
 * and back. Bridges the internal communication bus with external messaging
 * platforms while enforcing safety boundaries.
 */

export const EMPLOYEE_COMMUNICATION_ROUTER_PHASE = "Phase588";
export const EMPLOYEE_COMMUNICATION_ROUTER_BOUNDARY = Object.freeze({
  phase: EMPLOYEE_COMMUNICATION_ROUTER_PHASE,
  internalToExternalEnabled: true,
  externalToInternalEnabled: true,
  dryRunDefault: true,
  maxConcurrentRoutings: 5,
  retryPolicy: { maxRetries: 2, backoffMs: 1000 },
  providerCallsMade: false,
  secretValueExposed: false,
});

/**
 * @typedef {Object} RoutingTarget
 * @property {string} connectorId - 'feishu' | 'wecom' | 'internal'
 * @property {string} targetId - External user/group/chat ID
 * @property {string} format - 'text' | 'markdown' | 'card'
 */

/**
 * @typedef {Object} RoutingResult
 * @property {boolean} routed
 * @property {string|null} connectorId
 * @property {string|null} targetId
 * @property {string} status - 'delivered' | 'dry-run' | 'failed' | 'blocked'
 * @property {string|null} blockedReason
 * @property {Object} metadata
 */

/**
 * Registry of available IM connectors.
 * Connectors register themselves via registerConnector().
 */
const connectorRegistry = new Map();

/**
 * Register an IM connector for routing.
 * @param {string} connectorId
 * @param {Object} connector - Must implement sendMessage(envelope, target)
 */
export function registerConnector(connectorId, connector) {
  if (!connectorId || typeof connectorId !== "string") {
    throw new Error("connectorId must be a non-empty string");
  }
  if (!connector || typeof connector.sendMessage !== "function") {
    throw new Error("connector must implement sendMessage()");
  }
  connectorRegistry.set(connectorId, {
    connectorId,
    connector,
    registeredAt: new Date().toISOString(),
    messageCount: 0,
    lastUsedAt: null,
  });
}

/**
 * Unregister an IM connector.
 * @param {string} connectorId
 */
export function unregisterConnector(connectorId) {
  connectorRegistry.delete(connectorId);
}

/**
 * List registered connectors.
 */
export function listRegisteredConnectors() {
  return Array.from(connectorRegistry.values()).map((entry) => ({
    connectorId: entry.connectorId,
    registeredAt: entry.registeredAt,
    messageCount: entry.messageCount,
    lastUsedAt: entry.lastUsedAt,
  }));
}

/**
 * Resolve routing targets for a message envelope.
 * Maps employee IDs to external IM targets using the provided mapping.
 *
 * @param {Object} envelope - Employee message envelope
 * @param {Object} employeeTargetMap - Map of employeeId -> RoutingTarget
 * @returns {Object} Routing plan
 */
export function resolveRoutingTargets(envelope, employeeTargetMap = {}) {
  if (!envelope || typeof envelope !== "object") {
    return { valid: false, error: "envelope must be an object", targets: [] };
  }

  const allRecipientIds = [
    ...(Array.isArray(envelope.toEmployeeIds) ? envelope.toEmployeeIds : []),
    ...(Array.isArray(envelope.ccEmployeeIds) ? envelope.ccEmployeeIds : []),
  ];

  const targets = [];
  const unmapped = [];

  for (const employeeId of allRecipientIds) {
    const mapping = employeeTargetMap[employeeId];
    if (mapping && mapping.connectorId && mapping.targetId) {
      targets.push({
        employeeId,
        connectorId: mapping.connectorId,
        targetId: mapping.targetId,
        format: mapping.format || "text",
      });
    } else {
      unmapped.push(employeeId);
    }
  }

  return {
    valid: targets.length > 0,
    targets,
    unmappedEmployees: unmapped,
    totalRecipients: allRecipientIds.length,
    mappedCount: targets.length,
    unmappedCount: unmapped.length,
  };
}

/**
 * Route a message envelope to external IM connectors.
 *
 * @param {Object} envelope - Employee message envelope
 * @param {Object} options
 * @param {Object} options.employeeTargetMap - employeeId -> RoutingTarget
 * @param {boolean} options.dryRun - If true, don't actually send
 * @returns {Promise<RoutingResult[]>}
 */
export async function routeToExternal(envelope, options = {}) {
  const dryRun = options.dryRun !== false; // default true
  const routingPlan = resolveRoutingTargets(envelope, options.employeeTargetMap);

  if (!routingPlan.valid) {
    return [{
      routed: false,
      connectorId: null,
      targetId: null,
      status: "blocked",
      blockedReason: routingPlan.unmappedCount > 0
        ? "no_connector_mapping_found"
        : "no_recipients",
      metadata: { routingPlan },
    }];
  }

  const results = [];

  for (const target of routingPlan.targets) {
    const entry = connectorRegistry.get(target.connectorId);

    if (!entry) {
      results.push({
        routed: false,
        connectorId: target.connectorId,
        targetId: target.targetId,
        status: "blocked",
        blockedReason: "connector_not_registered",
        metadata: { employeeId: target.employeeId },
      });
      continue;
    }

    if (dryRun) {
      results.push({
        routed: true,
        connectorId: target.connectorId,
        targetId: target.targetId,
        status: "dry-run",
        blockedReason: null,
        metadata: {
          employeeId: target.employeeId,
          format: target.format,
          dryRun: true,
          messagePreview: truncateText(envelope.body || "", 100),
        },
      });
      continue;
    }

    try {
      const sendResult = await entry.connector.sendMessage(envelope, {
        targetId: target.targetId,
        format: target.format,
      });

      entry.messageCount++;
      entry.lastUsedAt = new Date().toISOString();

      results.push({
        routed: true,
        connectorId: target.connectorId,
        targetId: target.targetId,
        status: sendResult.delivered ? "delivered" : "failed",
        blockedReason: sendResult.delivered ? null : (sendResult.error || "delivery_failed"),
        metadata: {
          employeeId: target.employeeId,
          format: target.format,
          externalMessageId: sendResult.externalMessageId || null,
          ...sendResult.metadata,
        },
      });
    } catch (error) {
      results.push({
        routed: false,
        connectorId: target.connectorId,
        targetId: target.targetId,
        status: "failed",
        blockedReason: error.message || "connector_error",
        metadata: {
          employeeId: target.employeeId,
          errorCode: error.code || "UNKNOWN",
        },
      });
    }
  }

  return results;
}

/**
 * Route an incoming external message to the internal bus.
 *
 * @param {Object} externalMessage - Message from external IM
 * @param {string} externalMessage.connectorId - Source connector
 * @param {string} externalMessage.externalUserId - External sender ID
 * @param {string} externalMessage.text - Message text
 * @param {Object} employeeTargetMap - externalUserId -> employeeId mapping
 * @returns {Object} Internal message envelope or rejection
 */
export function routeFromExternal(externalMessage, employeeTargetMap = {}) {
  if (!externalMessage || typeof externalMessage !== "object") {
    return { accepted: false, error: "externalMessage must be an object" };
  }

  const { connectorId, externalUserId, text } = externalMessage;

  if (!connectorId || !externalUserId) {
    return { accepted: false, error: "connectorId and externalUserId are required" };
  }

  const mapping = employeeTargetMap[externalUserId];
  if (!mapping || !mapping.employeeId) {
    return {
      accepted: false,
      error: "no_internal_employee_mapping",
      connectorId,
      externalUserId,
    };
  }

  return {
    accepted: true,
    envelope: {
      messageId: `ext-${connectorId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      threadId: `ext-thread-${connectorId}-${externalUserId}`,
      fromEmployeeId: mapping.employeeId,
      toEmployeeIds: mapping.routeTo || [],
      ccEmployeeIds: [],
      messageType: "tell",
      intent: "external_incoming",
      title: `External message from ${connectorId}`,
      body: text || "",
      taskRef: null,
      evidenceRef: null,
      requiresResponse: false,
      responseDeadlineMs: null,
      riskLevel: "low",
      dryRunOnly: true,
      createdAt: new Date().toISOString(),
      source: {
        connectorId,
        externalUserId,
        incomingRoute: true,
      },
    },
  };
}

/**
 * Get router health/status.
 */
export function getRouterHealth() {
  return {
    phase: EMPLOYEE_COMMUNICATION_ROUTER_PHASE,
    status: "ready",
    connectorCount: connectorRegistry.size,
    connectors: listRegisteredConnectors(),
    boundary: EMPLOYEE_COMMUNICATION_ROUTER_BOUNDARY,
  };
}

function truncateText(text, maxLen) {
  if (typeof text !== "string") return "";
  return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
}
