/**
 * Governed WebSocket transport for real-time gateway chat.
 * RFC 6455 parsing is delegated to the maintained `ws` implementation. This
 * module owns gateway-specific authentication, tenancy, abuse, and lifecycle
 * policy only.
 */

import WebSocket, { WebSocketServer } from "ws";

const MAX_WS_CONNECTIONS = 100;
const DEFAULT_MAX_CONNECTIONS_PER_SUBJECT = 5;
const DEFAULT_MAX_PENDING_UPGRADES = 32;
const DEFAULT_MAX_WS_PAYLOAD = 256 * 1024;
const MAX_CONFIGURABLE_WS_PAYLOAD = 2 * 1024 * 1024;
const DEFAULT_MESSAGES_PER_WINDOW = 60;
const DEFAULT_MESSAGE_WINDOW_MS = 60_000;
const DEFAULT_MAX_IN_FLIGHT = 64;
const DEFAULT_MAX_IN_FLIGHT_PER_SUBJECT = 2;
const DEFAULT_AUTHENTICATION_TIMEOUT_MS = 3_000;
const DEFAULT_REAUTHORIZATION_INTERVAL_MS = 30_000;
const DEFAULT_MAX_CONNECTION_LIFETIME_MS = 15 * 60_000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000;
const DEFAULT_MAX_BUFFERED_AMOUNT_BYTES = 1024 * 1024;
const DEFAULT_SHUTDOWN_GRACE_MS = 1_000;
const DEFAULT_ALLOWED_ORIGINS = Object.freeze([
  "http://127.0.0.1:3100",
  "http://localhost:3100",
]);

/**
 * @typedef {{ userId?: string, tenantId?: string, role?: string }} GatewayIdentity
 * @typedef {{ allowed?: boolean, identity?: GatewayIdentity, statusCode?: number }} AuthenticationDecision
 * @typedef {{
 *   socket: WebSocket,
 *   identity: GatewayIdentity | null,
 *   send(data: unknown): boolean,
 *   close(code?: number, reason?: string): void,
 *   terminate(): void,
 * }} GatewayWebSocketConnection
 */

/**
 * Create a fail-closed WebSocket server for an existing HTTP server.
 *
 * @param {Object} [options]
 * @param {(request: import("node:http").IncomingMessage) => boolean | AuthenticationDecision | Promise<boolean | AuthenticationDecision>} [options.authenticate]
 * @param {string[]} [options.allowedOrigins]
 * @param {number|string} [options.maxConnections]
 * @param {number|string} [options.maxConnectionsPerSubject]
 * @param {number|string} [options.maxPendingUpgrades]
 * @param {number|string} [options.maxPayloadBytes]
 * @param {number|string} [options.maxMessagesPerWindow]
 * @param {number|string} [options.messageWindowMs]
 * @param {number|string} [options.maxInFlightMessages]
 * @param {number|string} [options.maxInFlightPerSubject]
 * @param {number|string} [options.authenticationTimeoutMs]
 * @param {number|string} [options.reauthorizationIntervalMs]
 * @param {number|string} [options.maxConnectionLifetimeMs]
 * @param {number|string} [options.heartbeatIntervalMs]
 * @param {number|string} [options.maxBufferedAmountBytes]
 * @param {number|string} [options.shutdownGraceMs]
 * @param {string} [options.environment]
 * @param {(subject: string) => unknown | Promise<unknown>} [options.consumeUpgradeQuota]
 * @param {(subject: string) => unknown | Promise<unknown>} [options.consumeMessageQuota]
 * @param {{acquire: (subject: string, limits: {maxConnections: number, maxConnectionsPerSubject: number}) => Promise<{acquired: boolean, retryAfterSeconds?: number, lease?: {isValid: () => boolean, start: (onLost: () => void) => void, release: () => Promise<void>}}>, close?: () => Promise<void>}} [options.connectionLeaseManager]
 * @param {{acquireExecution: (subject: string, limits: {maxInFlightMessages: number, maxInFlightPerSubject: number}) => Promise<{acquired: boolean, scope?: "global" | "subject", retryAfterSeconds?: number, lease?: {isValid: () => boolean, start: (onLost: () => void) => void, release: () => Promise<void>}}>}} [options.executionLeaseManager]
 * @param {(connection: GatewayWebSocketConnection) => void} [options.onConnection]
 * @param {(message: string, connection: GatewayWebSocketConnection) => unknown | Promise<unknown>} [options.onMessage]
 * @param {(connection: GatewayWebSocketConnection) => void} [options.onClose]
 * @param {(error: Error, context: Record<string, unknown>) => void} [options.onError]
 */
export function createWebSocketServer(options = {}) {
  const connections = new Set();
  const connectionState = new WeakMap();
  const connectionLeases = new WeakMap();
  const subjectConnections = new Map();
  const subjectInFlight = new Map();
  const subjectMessageWindows = new Map();
  const counters = {
    accepted: 0,
    authenticationRejected: 0,
    authenticationTimedOut: 0,
    reauthorizationRejected: 0,
    reauthorizationTimedOut: 0,
    identityDriftRejected: 0,
    sessionLifetimeRejected: 0,
    upgradeQuotaRejected: 0,
    quotaStoreUnavailable: 0,
    connectionLeaseRejected: 0,
    connectionLeaseUnavailable: 0,
    connectionLeaseLost: 0,
    executionLeaseRejected: 0,
    executionLeaseUnavailable: 0,
    executionLeaseLost: 0,
    originRejected: 0,
    capacityRejected: 0,
    subjectConnectionRejected: 0,
    rateLimitRejected: 0,
    concurrencyRejected: 0,
    binaryRejected: 0,
    backpressureRejected: 0,
    protocolRejected: 0,
    heartbeatTerminated: 0,
  };

  const maxConnections = boundedPositiveInteger(options.maxConnections, MAX_WS_CONNECTIONS, MAX_WS_CONNECTIONS);
  const maxConnectionsPerSubject = boundedPositiveInteger(
    options.maxConnectionsPerSubject,
    DEFAULT_MAX_CONNECTIONS_PER_SUBJECT,
    maxConnections,
  );
  const maxPendingUpgrades = boundedPositiveInteger(
    options.maxPendingUpgrades,
    DEFAULT_MAX_PENDING_UPGRADES,
    MAX_WS_CONNECTIONS,
  );
  const maxPayloadBytes = boundedPositiveInteger(
    options.maxPayloadBytes,
    DEFAULT_MAX_WS_PAYLOAD,
    MAX_CONFIGURABLE_WS_PAYLOAD,
  );
  const maxMessagesPerWindow = boundedPositiveInteger(
    options.maxMessagesPerWindow,
    DEFAULT_MESSAGES_PER_WINDOW,
    10_000,
  );
  const messageWindowMs = boundedPositiveInteger(
    options.messageWindowMs,
    DEFAULT_MESSAGE_WINDOW_MS,
    3_600_000,
  );
  const maxInFlightMessages = boundedPositiveInteger(
    options.maxInFlightMessages,
    DEFAULT_MAX_IN_FLIGHT,
    10_000,
  );
  const maxInFlightPerSubject = boundedPositiveInteger(
    options.maxInFlightPerSubject,
    DEFAULT_MAX_IN_FLIGHT_PER_SUBJECT,
    maxInFlightMessages,
  );
  const authenticationTimeoutMs = boundedPositiveInteger(
    options.authenticationTimeoutMs,
    DEFAULT_AUTHENTICATION_TIMEOUT_MS,
    30_000,
  );
  const maxConnectionLifetimeMs = boundedPositiveInteger(
    options.maxConnectionLifetimeMs,
    DEFAULT_MAX_CONNECTION_LIFETIME_MS,
    24 * 60 * 60_000,
  );
  const reauthorizationIntervalMs = Math.min(
    boundedPositiveInteger(
      options.reauthorizationIntervalMs,
      DEFAULT_REAUTHORIZATION_INTERVAL_MS,
      60 * 60_000,
    ),
    maxConnectionLifetimeMs,
  );
  const heartbeatIntervalMs = boundedPositiveInteger(
    options.heartbeatIntervalMs,
    DEFAULT_HEARTBEAT_INTERVAL_MS,
    300_000,
  );
  const maxBufferedAmountBytes = boundedPositiveInteger(
    options.maxBufferedAmountBytes,
    DEFAULT_MAX_BUFFERED_AMOUNT_BYTES,
    16 * 1024 * 1024,
  );
  const shutdownGraceMs = boundedPositiveInteger(
    options.shutdownGraceMs,
    DEFAULT_SHUTDOWN_GRACE_MS,
    10_000,
  );
  const allowedOrigins = normalizeAllowedOrigins(options.allowedOrigins);
  const production = (options.environment ?? process.env.NODE_ENV) === "production";
  if (production && allowedOrigins.includes("*")) {
    throw new Error("Wildcard WebSocket origins are forbidden in production.");
  }

  const protocolServer = new WebSocketServer({
    noServer: true,
    clientTracking: false,
    maxPayload: maxPayloadBytes,
    perMessageDeflate: false,
  });
  let attachedServer = null;
  let upgradeListener = null;
  let heartbeatTimer = null;
  let shutdownTimer = null;
  let pendingUpgrades = 0;
  let globalInFlight = 0;
  let closed = false;

  protocolServer.on("wsClientError", (error, socket, request) => {
    counters.protocolRejected += 1;
    reportError(error, { event: "ws_handshake_rejected", path: request?.url });
    rejectUpgrade(socket, "400 Bad Request");
  });
  protocolServer.on("error", (error) => {
    reportError(error, { event: "ws_server_error" });
  });

  function attach(httpServer) {
    if (attachedServer) {
      throw new Error("WebSocket server is already attached.");
    }
    if (!httpServer || typeof httpServer.on !== "function") {
      throw new TypeError("A valid HTTP server is required.");
    }
    attachedServer = httpServer;
    upgradeListener = (request, socket, head) => {
      void handleUpgrade(request, socket, head).catch((error) => {
        reportError(error, { event: "ws_upgrade_failed", path: request?.url });
        rejectUpgrade(socket, "500 Internal Server Error");
      });
    };
    httpServer.on("upgrade", upgradeListener);
    startHeartbeat();
  }

  async function handleUpgrade(request, socket, head) {
    const pathname = readPathname(request?.url);
    if (pathname !== "/ws") {
      socket.destroy();
      return;
    }
    if (closed) {
      rejectUpgrade(socket, "503 Service Unavailable", { "Retry-After": "5" });
      return;
    }

    const origin = typeof request.headers.origin === "string" ? request.headers.origin.trim() : "";
    const wildcardAllowed = allowedOrigins.includes("*") && !production;
    if (origin && !wildcardAllowed && !allowedOrigins.includes(origin)) {
      counters.originRejected += 1;
      rejectUpgrade(socket, "403 Forbidden");
      return;
    }

    if (connections.size >= maxConnections || pendingUpgrades >= maxPendingUpgrades) {
      counters.capacityRejected += 1;
      rejectUpgrade(socket, "503 Service Unavailable", { "Retry-After": "5" });
      reportError(new Error("WebSocket connection capacity reached."), {
        event: "ws_connection_limit",
        maxConnections,
        maxPendingUpgrades,
      });
      return;
    }

    if (typeof options.authenticate !== "function") {
      counters.authenticationRejected += 1;
      rejectUpgrade(socket, "401 Unauthorized", { "WWW-Authenticate": "Bearer" });
      return;
    }

    pendingUpgrades += 1;
    try {
      let authResult;
      try {
        authResult = await withTimeout(
          () => options.authenticate(request),
          authenticationTimeoutMs,
          "WebSocket authentication timed out.",
        );
      } catch (error) {
        counters.authenticationRejected += 1;
        if (error?.code === "WS_AUTH_TIMEOUT") counters.authenticationTimedOut += 1;
        reportError(error, { event: "ws_authentication_failed" });
        rejectUpgrade(socket, "401 Unauthorized", { "WWW-Authenticate": "Bearer" });
        return;
      }

      const auth = normalizeAuthenticationDecision(authResult);
      if (!auth.allowed) {
        counters.authenticationRejected += 1;
        const forbidden = auth.statusCode === 403;
        rejectUpgrade(
          socket,
          forbidden ? "403 Forbidden" : "401 Unauthorized",
          forbidden ? {} : { "WWW-Authenticate": "Bearer" },
        );
        return;
      }

      const subjectKey = createSubjectKey(auth.identity, request.socket?.remoteAddress);
      const upgradeQuota = await consumeExternalQuota(options.consumeUpgradeQuota, subjectKey);
      if (!upgradeQuota.allowed) {
        counters.upgradeQuotaRejected += 1;
        const unavailable = (upgradeQuota.statusCode ?? 429) >= 500;
        if (unavailable) counters.quotaStoreUnavailable += 1;
        reportError(new Error(unavailable
          ? "WebSocket shared upgrade quota is unavailable."
          : "WebSocket shared upgrade quota was exceeded."), {
          event: unavailable ? "ws_upgrade_quota_unavailable" : "ws_upgrade_quota_rejected",
          code: upgradeQuota.code,
          statusCode: upgradeQuota.statusCode,
        });
        rejectUpgrade(
          socket,
          unavailable ? "503 Service Unavailable" : "429 Too Many Requests",
          { "Retry-After": String(Math.max(1, Math.ceil((upgradeQuota.retryAfterMs ?? 1_000) / 1_000))) },
        );
        return;
      }
      const activeForSubject = subjectConnections.get(subjectKey) ?? 0;
      if (activeForSubject >= maxConnectionsPerSubject) {
        counters.subjectConnectionRejected += 1;
        rejectUpgrade(socket, "429 Too Many Requests", { "Retry-After": "5" });
        reportError(new Error("WebSocket subject connection limit reached."), {
          event: "ws_subject_connection_limit",
          maxConnectionsPerSubject,
        });
        return;
      }

      let connectionLease = null;
      if (options.connectionLeaseManager) {
        try {
          const decision = await options.connectionLeaseManager.acquire(subjectKey, {
            maxConnections,
            maxConnectionsPerSubject,
          });
          if (decision?.acquired === false) {
            counters.connectionLeaseRejected += 1;
            reportError(new Error("The distributed WebSocket connection limit was reached."), {
              event: "ws_connection_lease_rejected",
              scope: decision.scope,
            });
            rejectUpgrade(socket, "429 Too Many Requests", {
              "Retry-After": String(Math.max(1, Number(decision.retryAfterSeconds) || 1)),
            });
            return;
          }
          if (
            decision?.acquired !== true
            || typeof decision.lease?.isValid !== "function"
            || typeof decision.lease?.start !== "function"
            || typeof decision.lease?.release !== "function"
          ) {
            throw new Error("The WebSocket connection lease manager returned an invalid decision.");
          }
          connectionLease = decision.lease;
        } catch (error) {
          counters.connectionLeaseUnavailable += 1;
          reportError(error, { event: "ws_connection_lease_unavailable" });
          rejectUpgrade(socket, "503 Service Unavailable", { "Retry-After": "1" });
          return;
        }
      }

      try {
        protocolServer.handleUpgrade(request, socket, head, (rawSocket) => {
          if (connectionLease) {
            connectionLeases.set(rawSocket, connectionLease);
            try {
              connectionLease.start(() => {
                counters.connectionLeaseLost += 1;
                reportError(new Error("The durable WebSocket connection lease was lost."), {
                  event: "ws_connection_lease_lost",
                });
                if (rawSocket.readyState === WebSocket.OPEN || rawSocket.readyState === WebSocket.CONNECTING) {
                  rawSocket.close(1013, "Connection lease unavailable");
                } else {
                  rawSocket.terminate();
                }
              });
              rawSocket.once("close", () => {
                connectionLeases.delete(rawSocket);
                void connectionLease.release();
              });
            } catch (error) {
              counters.connectionLeaseUnavailable += 1;
              connectionLeases.delete(rawSocket);
              void connectionLease.release();
              reportError(error, { event: "ws_connection_lease_start_failed" });
              rawSocket.close(1013, "Connection lease unavailable");
              return;
            }
          }
          establishConnection(
            rawSocket,
            auth.identity,
            subjectKey,
            createReauthorizationRequest(request),
          );
        });
      } catch (error) {
        if (connectionLease) void connectionLease.release();
        counters.protocolRejected += 1;
        reportError(error, { event: "ws_handshake_rejected" });
        rejectUpgrade(socket, "400 Bad Request");
      }
    } finally {
      pendingUpgrades = Math.max(0, pendingUpgrades - 1);
    }
  }

  function establishConnection(rawSocket, identity, subjectKey, authorizationRequest) {
    const connection = createGatewayConnection(rawSocket, identity, subjectKey);
    connections.add(connection);
    const authenticatedAt = Date.now();
    connectionState.set(connection, {
      alive: true,
      cleaned: false,
      authenticatedAt,
      lastAuthorizedAt: authenticatedAt,
      authorizationPromise: null,
      authorizationRequest,
      subjectKey,
    });
    subjectConnections.set(subjectKey, (subjectConnections.get(subjectKey) ?? 0) + 1);
    counters.accepted += 1;

    rawSocket.on("pong", () => {
      const state = connectionState.get(connection);
      if (state) state.alive = true;
    });
    rawSocket.on("message", (data, isBinary) => {
      const state = connectionState.get(connection);
      if (state) state.alive = true;
      void handleMessage(data, isBinary, connection, subjectKey);
    });
    rawSocket.on("error", (error) => {
      reportError(error, { event: "ws_transport_error" });
      rawSocket.terminate();
    });
    rawSocket.once("close", () => cleanupConnection(connection, subjectKey));

    try {
      options.onConnection?.(connection);
    } catch (error) {
      reportError(error, { event: "ws_connection_handler_failed" });
      connection.close(1011, "Connection initialization failed");
    }
  }

  async function handleMessage(data, isBinary, connection, subjectKey) {
    const rawSocket = connection.socket;
    if (isBinary) {
      counters.binaryRejected += 1;
      reportError(new Error("Binary WebSocket messages are not supported."), { event: "ws_binary_rejected" });
      rawSocket.close(1003, "Binary messages are not supported");
      return;
    }

    const connectionLease = connectionLeases.get(rawSocket);
    if (connectionLease && !connectionLease.isValid()) {
      rawSocket.close(1013, "Connection lease unavailable");
      return;
    }

    const now = Date.now();
    const messageQuota = await consumeMessageQuota(subjectKey, now);
    if (!messageQuota.allowed) {
      counters.rateLimitRejected += 1;
      const unavailable = (messageQuota.statusCode ?? 429) >= 500;
      if (unavailable) counters.quotaStoreUnavailable += 1;
      reportError(new Error(unavailable
        ? "WebSocket shared message quota is unavailable."
        : "WebSocket message rate limit reached."), {
        event: unavailable ? "ws_message_quota_unavailable" : "ws_message_rate_limit",
        code: messageQuota.code,
        statusCode: messageQuota.statusCode,
        maxMessagesPerWindow,
        messageWindowMs,
      });
      rawSocket.close(
        unavailable ? 1013 : 1008,
        unavailable ? "Message quota unavailable" : "Message rate limit exceeded",
      );
      return;
    }

    if (!await reauthorizeConnection(connection, "message")) return;

    const subjectActive = subjectInFlight.get(subjectKey) ?? 0;
    if (globalInFlight >= maxInFlightMessages || subjectActive >= maxInFlightPerSubject) {
      counters.concurrencyRejected += 1;
      reportError(new Error("WebSocket message concurrency limit reached."), {
        event: "ws_message_concurrency_limit",
        maxInFlightMessages,
        maxInFlightPerSubject,
      });
      rawSocket.close(1013, "Too many in-flight messages");
      return;
    }

    let executionLease = null;
    if (options.executionLeaseManager) {
      try {
        if (typeof options.executionLeaseManager.acquireExecution !== "function") {
          throw new Error("The WebSocket execution lease manager is invalid.");
        }
        const decision = await options.executionLeaseManager.acquireExecution(subjectKey, {
          maxInFlightMessages,
          maxInFlightPerSubject,
        });
        if (decision?.acquired === false) {
          counters.concurrencyRejected += 1;
          counters.executionLeaseRejected += 1;
          reportError(new Error("The distributed WebSocket execution limit was reached."), {
            event: "ws_execution_lease_rejected",
            scope: decision.scope,
            retryAfterSeconds: Math.max(1, Number(decision.retryAfterSeconds) || 1),
          });
          rawSocket.close(1013, "Too many in-flight messages");
          return;
        }
        if (
          decision?.acquired !== true
          || typeof decision.lease?.isValid !== "function"
          || typeof decision.lease?.start !== "function"
          || typeof decision.lease?.release !== "function"
        ) {
          throw new Error("The WebSocket execution lease manager returned an invalid decision.");
        }
        executionLease = decision.lease;
        executionLease.start(() => {
          counters.executionLeaseLost += 1;
          reportError(new Error("The durable WebSocket execution lease was lost."), {
            event: "ws_execution_lease_lost",
          });
          if (rawSocket.readyState === WebSocket.OPEN || rawSocket.readyState === WebSocket.CONNECTING) {
            rawSocket.close(1013, "Execution lease unavailable");
          } else {
            rawSocket.terminate();
          }
        });
      } catch (error) {
        counters.executionLeaseUnavailable += 1;
        if (executionLease) void executionLease.release();
        reportError(error, { event: "ws_execution_lease_unavailable" });
        rawSocket.close(1013, "Execution lease unavailable");
        return;
      }
    }

    globalInFlight += 1;
    subjectInFlight.set(subjectKey, subjectActive + 1);
    try {
      if (connectionLease && !connectionLease.isValid()) {
        rawSocket.close(1013, "Connection lease unavailable");
        return;
      }
      if (executionLease && !executionLease.isValid()) {
        rawSocket.close(1013, "Execution lease unavailable");
        return;
      }
      await options.onMessage?.(data.toString("utf8"), connection);
    } catch (error) {
      reportError(error, { event: "ws_message_rejected" });
      if (rawSocket.readyState === WebSocket.OPEN) {
        rawSocket.close(1011, "Message processing failed");
      }
    } finally {
      releaseInFlight(subjectKey);
      if (executionLease) {
        try {
          await executionLease.release();
        } catch (error) {
          counters.executionLeaseUnavailable += 1;
          reportError(error, { event: "ws_execution_lease_release_failed" });
          if (rawSocket.readyState === WebSocket.OPEN) {
            rawSocket.close(1013, "Execution lease unavailable");
          }
        }
      }
    }
  }

  function createGatewayConnection(rawSocket, identity, subjectKey) {
    const connection = {
      socket: rawSocket,
      identity,
      send(data) {
        if (rawSocket.readyState !== WebSocket.OPEN) return false;
        const payload = normalizeOutgoingPayload(data);
        const payloadBytes = typeof payload === "string" ? Buffer.byteLength(payload) : payload.byteLength;
        if (rawSocket.bufferedAmount + payloadBytes > maxBufferedAmountBytes) {
          counters.backpressureRejected += 1;
          reportError(new Error("WebSocket outbound buffer limit reached."), {
            event: "ws_backpressure_limit",
            maxBufferedAmountBytes,
          });
          rawSocket.close(1013, "Outbound buffer limit exceeded");
          return false;
        }
        rawSocket.send(payload, (error) => {
          if (error) reportError(error, { event: "ws_send_failed" });
        });
        return true;
      },
      close(code = 1000, reason = "") {
        if (rawSocket.readyState === WebSocket.OPEN || rawSocket.readyState === WebSocket.CONNECTING) {
          rawSocket.close(code, reason);
        }
      },
      terminate() {
        rawSocket.terminate();
      },
    };
    Object.defineProperty(connection, "subjectKey", {
      enumerable: false,
      configurable: false,
      writable: false,
      value: subjectKey,
    });
    return connection;
  }

  function cleanupConnection(connection, subjectKey) {
    const state = connectionState.get(connection);
    if (!state || state.cleaned) return;
    state.cleaned = true;
    connections.delete(connection);
    const remaining = Math.max(0, (subjectConnections.get(subjectKey) ?? 1) - 1);
    if (remaining === 0) subjectConnections.delete(subjectKey);
    else subjectConnections.set(subjectKey, remaining);
    try {
      options.onClose?.(connection);
    } catch (error) {
      reportError(error, { event: "ws_close_handler_failed" });
    }
  }

  async function consumeMessageQuota(subjectKey, now) {
    if (typeof options.consumeMessageQuota === "function") {
      return consumeExternalQuota(options.consumeMessageQuota, subjectKey);
    }
    const cutoff = now - messageWindowMs;
    const previous = subjectMessageWindows.get(subjectKey) ?? [];
    const active = previous.filter((timestamp) => timestamp > cutoff);
    if (active.length >= maxMessagesPerWindow) {
      subjectMessageWindows.set(subjectKey, active);
      return { allowed: false, statusCode: 429, code: "WEBSOCKET_MESSAGE_RATE_LIMITED" };
    }
    active.push(now);
    subjectMessageWindows.set(subjectKey, active);
    return { allowed: true };
  }

  function releaseInFlight(subjectKey) {
    globalInFlight = Math.max(0, globalInFlight - 1);
    const remaining = Math.max(0, (subjectInFlight.get(subjectKey) ?? 1) - 1);
    if (remaining === 0) subjectInFlight.delete(subjectKey);
    else subjectInFlight.set(subjectKey, remaining);
  }

  async function reauthorizeConnection(connection, phase) {
    const state = connectionState.get(connection);
    if (!state || state.cleaned || connection.socket.readyState !== WebSocket.OPEN) return false;
    const now = Date.now();
    if (now - state.authenticatedAt >= maxConnectionLifetimeMs) {
      counters.sessionLifetimeRejected += 1;
      reportError(new Error("WebSocket maximum session lifetime reached."), {
        event: "ws_session_lifetime_limit",
        phase,
        maxConnectionLifetimeMs,
      });
      connection.close(1008, "Session reauthentication required");
      return false;
    }
    if (state.authorizationPromise) return state.authorizationPromise;

    const authorizationPromise = (async () => {
      let authResult;
      try {
        authResult = await withTimeout(
          () => options.authenticate(state.authorizationRequest),
          authenticationTimeoutMs,
          "WebSocket reauthorization timed out.",
        );
      } catch (error) {
        counters.reauthorizationRejected += 1;
        if (error?.code === "WS_AUTH_TIMEOUT") counters.reauthorizationTimedOut += 1;
        reportError(error, { event: "ws_reauthorization_failed", phase });
        connection.close(1008, "Authorization expired");
        return false;
      }

      const auth = normalizeAuthenticationDecision(authResult);
      if (!auth.allowed) {
        counters.reauthorizationRejected += 1;
        reportError(new Error("WebSocket authorization is no longer valid."), {
          event: "ws_reauthorization_rejected",
          phase,
          statusCode: auth.statusCode,
        });
        connection.close(1008, "Authorization expired");
        return false;
      }

      const refreshedSubjectKey = createSubjectKey(
        auth.identity,
        state.authorizationRequest.socket?.remoteAddress,
      );
      if (refreshedSubjectKey !== state.subjectKey) {
        counters.identityDriftRejected += 1;
        reportError(new Error("WebSocket authenticated subject changed during the session."), {
          event: "ws_identity_drift_rejected",
          phase,
        });
        connection.close(1008, "Authenticated identity changed");
        return false;
      }

      connection.identity = auth.identity;
      state.lastAuthorizedAt = Date.now();
      return true;
    })();
    state.authorizationPromise = authorizationPromise;
    try {
      return await authorizationPromise;
    } finally {
      if (state.authorizationPromise === authorizationPromise) {
        state.authorizationPromise = null;
      }
    }
  }

  function startHeartbeat() {
    if (heartbeatTimer) return;
    heartbeatTimer = setInterval(() => {
      const now = Date.now();
      for (const connection of connections) {
        const state = connectionState.get(connection);
        if (!state || state.cleaned) continue;
        if (now - state.authenticatedAt >= maxConnectionLifetimeMs) {
          void reauthorizeConnection(connection, "session-lifetime");
          continue;
        }
        if (now - state.lastAuthorizedAt >= reauthorizationIntervalMs) {
          void reauthorizeConnection(connection, "periodic");
        }
        if (!state.alive) {
          counters.heartbeatTerminated += 1;
          connection.terminate();
          continue;
        }
        state.alive = false;
        try {
          connection.socket.ping();
        } catch (error) {
          reportError(error, { event: "ws_heartbeat_failed" });
          connection.terminate();
        }
      }
      for (const [subjectKey, timestamps] of subjectMessageWindows) {
        const active = timestamps.filter((timestamp) => timestamp > now - messageWindowMs);
        if (active.length === 0 && !subjectConnections.has(subjectKey) && !subjectInFlight.has(subjectKey)) {
          subjectMessageWindows.delete(subjectKey);
        } else {
          subjectMessageWindows.set(subjectKey, active);
        }
      }
    }, heartbeatIntervalMs);
    heartbeatTimer.unref?.();
  }

  function close(code = 1001, reason = "Gateway shutting down") {
    if (closed) return;
    closed = true;
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    if (attachedServer && upgradeListener) attachedServer.off("upgrade", upgradeListener);
    for (const connection of connections) connection.close(code, reason);
    shutdownTimer = setTimeout(() => {
      for (const connection of connections) connection.terminate();
    }, shutdownGraceMs);
    shutdownTimer.unref?.();
  }

  function broadcast(message) {
    for (const connection of connections) connection.send(message);
  }

  function getConnectionCount() {
    return connections.size;
  }

  function getConnections() {
    return new Set(connections);
  }

  function getSecuritySnapshot() {
    return Object.freeze({
      ...counters,
      activeConnections: connections.size,
      activeSubjects: subjectConnections.size,
      pendingUpgrades,
      inFlightMessages: globalInFlight,
      maxConnections,
      maxConnectionsPerSubject,
      maxPayloadBytes,
      maxMessagesPerWindow,
      messageWindowMs,
      maxInFlightMessages,
      maxInFlightPerSubject,
      reauthorizationIntervalMs,
      maxConnectionLifetimeMs,
    });
  }

  function reportError(error, context) {
    options.onError?.(error instanceof Error ? error : new Error(String(error)), context);
  }

  return {
    attach,
    broadcast,
    close,
    getConnectionCount,
    getConnections,
    getSecuritySnapshot,
  };
}

function normalizeAuthenticationDecision(value) {
  if (value === true) return { allowed: true, identity: null, statusCode: 200 };
  if (!value || typeof value !== "object" || value.allowed !== true) {
    return {
      allowed: false,
      identity: value && typeof value === "object" ? value.identity ?? null : null,
      statusCode: value && typeof value === "object" ? Number(value.statusCode) || 401 : 401,
    };
  }
  return {
    allowed: true,
    identity: value.identity && typeof value.identity === "object" ? value.identity : null,
    statusCode: Number(value.statusCode) || 200,
  };
}

function createSubjectKey(identity, remoteAddress) {
  const userId = typeof identity?.userId === "string" ? identity.userId.trim() : "";
  const tenantId = typeof identity?.tenantId === "string" ? identity.tenantId.trim() : "";
  if (userId) return `identity:${tenantId || "default"}:${userId}`;
  const network = typeof remoteAddress === "string" && remoteAddress.trim() ? remoteAddress.trim() : "unknown";
  return `network:${network}`;
}

async function consumeExternalQuota(consumer, subject) {
  if (typeof consumer !== "function") return { allowed: true };
  try {
    const result = await consumer(subject);
    if (!result || typeof result !== "object" || typeof result.allowed !== "boolean") {
      return {
        allowed: false,
        statusCode: 503,
        code: "RATE_LIMIT_STORE_UNAVAILABLE",
        retryAfterMs: 1_000,
      };
    }
    return {
      allowed: result.allowed,
      statusCode: Number(result.statusCode) || (result.allowed ? 200 : 429),
      code: typeof result.code === "string" ? result.code : (result.allowed ? null : "RATE_LIMITED"),
      retryAfterMs: Math.max(0, Number(result.retryAfterMs) || 0),
    };
  } catch {
    return {
      allowed: false,
      statusCode: 503,
      code: "RATE_LIMIT_STORE_UNAVAILABLE",
      retryAfterMs: 1_000,
    };
  }
}

function createReauthorizationRequest(request) {
  const headers = Object.create(null);
  for (const name of ["host", "origin", "user-agent"]) {
    const value = request?.headers?.[name];
    if (typeof value === "string") headers[name] = value;
  }
  Object.defineProperty(headers, "authorization", {
    enumerable: false,
    configurable: false,
    writable: false,
    value: typeof request?.headers?.authorization === "string"
      ? request.headers.authorization
      : undefined,
  });
  Object.freeze(headers);
  return Object.freeze({
    method: typeof request?.method === "string" ? request.method : "GET",
    url: typeof request?.url === "string" ? request.url : "/ws",
    headers,
    socket: Object.freeze({
      localAddress: request?.socket?.localAddress,
      remoteAddress: request?.socket?.remoteAddress,
    }),
  });
}

function normalizeAllowedOrigins(value) {
  const input = Array.isArray(value) && value.length > 0 ? value : DEFAULT_ALLOWED_ORIGINS;
  return Array.from(new Set(input.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean)));
}

function normalizeOutgoingPayload(data) {
  if (typeof data === "string" || Buffer.isBuffer(data) || data instanceof Uint8Array) return data;
  return JSON.stringify(data);
}

function boundedPositiveInteger(value, fallback, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maximum);
}

function readPathname(value) {
  if (typeof value !== "string") return null;
  try {
    return new URL(value, "http://gateway.invalid").pathname;
  } catch {
    return null;
  }
}

async function withTimeout(factory, timeoutMs, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(message);
      error.code = "WS_AUTH_TIMEOUT";
      reject(error);
    }, timeoutMs);
    timer.unref?.();
  });
  try {
    return await Promise.race([Promise.resolve().then(factory), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function rejectUpgrade(socket, status, headers = {}) {
  if (!socket || socket.destroyed) return;
  const lines = [
    `HTTP/1.1 ${status}`,
    "Connection: close",
    "Cache-Control: no-store",
    ...Object.entries(headers).map(([name, value]) => `${name}: ${value}`),
    "Content-Length: 0",
    "",
    "",
  ];
  try {
    socket.write(lines.join("\r\n"));
  } finally {
    socket.destroy();
  }
}
