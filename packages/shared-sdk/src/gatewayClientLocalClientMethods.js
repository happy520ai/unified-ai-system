// Extracted verbatim from createGatewayClient's returned object so the
// local-client domain methods live beside the SDK entrypoint. The
// local-client-specific helpers move with the domain; the methods receive
// the shared request context and keep their exact bodies.
import { GatewayClientError, GATEWAY_CLIENT_ERROR_CODES } from "./gatewayClientPrimitives.js";

export function createGatewayLocalClientMethods(ctx) {
  const { baseUrl, headers, timeoutMs, requestJson, operatorPost, prepareRequiredIdempotencyHeaders, createProviderKeyConfigurationError, createGatewayProtocolError } = ctx;
  return {
    localClientsStatus() {
      return requestJson({
        baseUrl,
        path: "/local-clients/status",
        headers,
        timeoutMs,
      });
    },
    clearRuntimeProviderCredential(request) {
      if (!request || typeof request !== "object" || Array.isArray(request)
        || Object.keys(request).length !== 1 || typeof request.providerId !== "string"
        || !/^[a-z][a-z0-9._-]{0,127}$/.test(request.providerId)) {
        throw createGatewayProtocolError("Credential clearing requires exactly one canonical providerId.");
      }
      return requestJson({
        path: "/providers/runtime-credential", method: "DELETE", body: { providerId: request.providerId },
        redirect: "error",
      });
    },
    localClients(options = {}) {
      const query = new URLSearchParams();
      if (options.includeDisabled === true) query.set("includeDisabled", "true");
      if (Number.isInteger(options.limit)) query.set("limit", String(options.limit));
      if (Number.isInteger(options.offset)) query.set("offset", String(options.offset));
      if (Array.isArray(options.capabilities) && options.capabilities.length > 0) {
        query.set("capabilities", options.capabilities.join(","));
      }
      const suffix = query.size > 0 ? `?${query.toString()}` : "";
      return requestJson({
        baseUrl,
        path: `/local-clients/registry${suffix}`,
        headers,
        timeoutMs,
      });
    },
    discoverLocalClients(request = {}) {
      return requestJson({
        baseUrl,
        path: "/local-clients/discover/system",
        method: "POST",
        body: withSafeDryRunDefault(request),
        headers,
        timeoutMs,
      });
    },
    inspectLocalClient(clientId) {
      return inspectLocalClientFromRegistry({
        clientId,
        requestJson,
      });
    },
    registerLocalClient(request) {
      return requestJson({
        baseUrl,
        path: "/local-clients/register",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    disableLocalClient(request) {
      return requestJson({
        baseUrl,
        path: "/local-clients/disable",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    revokeLocalClient(request) {
      return requestJson({
        baseUrl,
        path: "/local-clients/revoke",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    smartManageLocalClients(request = {}) {
      return requestJson({
        baseUrl,
        path: "/local-clients/smart-manage",
        method: "POST",
        body: withSafeDryRunDefault(request),
        headers,
        timeoutMs,
      });
    },
    routeLocalClient(request) {
      return requestJson({
        baseUrl,
        path: "/local-clients/route",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    routeLocalClientProvider(request) {
      return requestJson({
        baseUrl,
        path: "/local-clients/provider-route",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    verifyLocalClient(request) {
      return requestJson({
        baseUrl,
        path: "/local-clients/verify",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    previewGovernedLocalClientExecution(request) {
      return requestJson({
        baseUrl,
        path: "/local-clients/executions/preview",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    approveGovernedLocalClientExecution(request) {
      return requestJson({
        baseUrl,
        path: "/local-clients/executions/approve",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    executeGovernedLocalClientExecution(request, executionOptions) {
      return requestJson({
        baseUrl,
        path: "/local-clients/executions/execute",
        method: "POST",
        body: request,
        headers: prepareRequiredIdempotencyHeaders(headers, executionOptions),
        timeoutMs,
      });
    },
    governedLocalClientExecutionStatus(executionId) {
      return requestJson({
        baseUrl,
        path: `/local-clients/executions/${encodeURIComponent(String(executionId ?? ""))}`,
        headers,
        timeoutMs,
      });
    },
    cancelGovernedLocalClientExecution(executionId, request = {}) {
      return requestJson({
        baseUrl,
        path: `/local-clients/executions/${encodeURIComponent(String(executionId ?? ""))}/cancel`,
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    localClientOnboardingProfiles() {
      return requestJson({
        baseUrl,
        path: "/local-clients/onboarding/profiles",
        headers,
        timeoutMs,
      });
    },
    localClientOnboardingProfile(profileId) {
      return requestJson({
        baseUrl,
        path: `/local-clients/onboarding/profiles/${encodeURIComponent(String(profileId ?? ""))}`,
        headers,
        timeoutMs,
      });
    },
    verifyLocalClientOnboardingProfile(profileId) {
      return requestJson({
        baseUrl,
        path: `/local-clients/onboarding/profiles/${encodeURIComponent(String(profileId ?? ""))}/verify`,
        headers,
        timeoutMs,
      });
    },
    planGovernedLocalClientOnboarding(request) {
      return requestJson({
        baseUrl,
        path: "/local-clients/onboarding/plans",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    approveGovernedLocalClientOnboarding(request, mutationOptions) {
      return requestJson({
        baseUrl,
        path: "/local-clients/onboarding/approve",
        method: "POST",
        body: request,
        headers: prepareRequiredIdempotencyHeaders(
          headers,
          mutationOptions,
          "Governed local-client onboarding",
        ),
        timeoutMs,
      });
    },
    applyGovernedLocalClientOnboarding(request, mutationOptions) {
      return requestJson({
        baseUrl,
        path: "/local-clients/onboarding/apply",
        method: "POST",
        body: request,
        headers: prepareRequiredIdempotencyHeaders(
          headers,
          mutationOptions,
          "Governed local-client onboarding",
        ),
        timeoutMs,
      });
    },
    rollbackGovernedLocalClientOnboarding(request, mutationOptions) {
      return requestJson({
        baseUrl,
        path: "/local-clients/onboarding/rollback",
        method: "POST",
        body: request,
        headers: prepareRequiredIdempotencyHeaders(
          headers,
          mutationOptions,
          "Governed local-client onboarding",
        ),
        timeoutMs,
      });
    },
    recoverGovernedLocalClientOnboarding(request, mutationOptions) {
      return requestJson({
        baseUrl,
        path: "/local-clients/onboarding/recover",
        method: "POST",
        body: request,
        headers: prepareRequiredIdempotencyHeaders(
          headers,
          mutationOptions,
          "Governed local-client onboarding",
        ),
        timeoutMs,
      });
    },
    previewLocalClientExecution(request) {
      return requestJson({
        baseUrl,
        path: "/local-clients/execute",
        method: "POST",
        body: { ...request, dryRun: true },
        headers,
        timeoutMs,
      });
    },
  };
}
function withSafeDryRunDefault(request) {
  const source = request && typeof request === "object" && !Array.isArray(request)
    ? request
    : {};
  return source.dryRun === undefined ? { ...source, dryRun: true } : source;
}

async function inspectLocalClientFromRegistry({
  clientId,
  requestJson,
}) {
  const normalizedClientId = normalizeInspectionClientId(clientId);
  const limit = 100;
  const maxPages = 100;
  let offset = 0;
  let pagesScanned = 0;

  while (pagesScanned < maxPages) {
    const envelope = await requestJson({
      path: `/local-clients/registry?includeDisabled=true&limit=${limit}&offset=${offset}`,
    });
    const registry = envelope?.data;
    if (
      !registry
      || typeof registry !== "object"
      || !Array.isArray(registry.clients)
      || !registry.pagination
      || typeof registry.pagination !== "object"
    ) {
      throw createGatewayProtocolError("Gateway returned an invalid local-client registry page.");
    }
    pagesScanned += 1;
    const client = registry.clients.find((candidate) => candidate?.clientId === normalizedClientId) ?? null;
    if (client) {
      return {
        ...envelope,
        data: {
          source: "registry-list",
          independentAuthority: false,
          clientId: normalizedClientId,
          found: true,
          pagesScanned,
          client,
        },
      };
    }

    const returned = Number.isSafeInteger(registry.pagination.returned)
      ? registry.pagination.returned
      : registry.clients.length;
    const total = Number.isSafeInteger(registry.total) ? registry.total : offset + returned;
    if (returned < 1 || offset + returned >= total) {
      return {
        ...envelope,
        data: {
          source: "registry-list",
          independentAuthority: false,
          clientId: normalizedClientId,
          found: false,
          pagesScanned,
          client: null,
        },
      };
    }
    offset += returned;
  }

  throw createGatewayProtocolError("Local-client inspection exceeded the bounded registry scan.");
}

function normalizeInspectionClientId(value) {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > 256
    || value !== value.trim()
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw createGatewayProtocolError("Local-client inspection requires one bounded clientId.");
  }
  return value;
}

export function createGatewayProtocolError(message) {
  return new GatewayClientError(message, {
    code: GATEWAY_CLIENT_ERROR_CODES.PROTOCOL,
    kind: "protocol",
    retryable: false,
  });
}
