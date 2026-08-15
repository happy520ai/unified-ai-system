import { describe, expect, it } from "vitest";
import {
  LOCAL_UNAUTHENTICATED_PERMISSION,
  LOCAL_UNAUTHENTICATED_ROLE,
  authorizeLocalUnauthenticatedRequest,
  createLocalUnauthenticatedPreviewConfig,
} from "./localUnauthenticatedAccessPolicy.ts";

function decide(method: string, url: string, permission: string, previewEnabled = true) {
  return authorizeLocalUnauthenticatedRequest({
    request: { method, url },
    permission,
    previewEnabled,
  });
}

describe("local unauthenticated access policy", () => {
  it("uses a non-admin identity contract", () => {
    expect(LOCAL_UNAUTHENTICATED_ROLE).toBe("local_preview");
    expect(LOCAL_UNAUTHENTICATED_PERMISSION).toBe("local:preview");
  });

  it("enables preview only for an exclusively fake provider configuration", () => {
    expect(createLocalUnauthenticatedPreviewConfig({}).enabled).toBe(true);
    expect(createLocalUnauthenticatedPreviewConfig({
      AI_GATEWAY_PROVIDER_MODE: "fake",
      AI_GATEWAY_DEFAULT_PROVIDER: "local-fake-provider",
      AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider,backup-fake-provider",
    }).enabled).toBe(true);

    expect(createLocalUnauthenticatedPreviewConfig({
      AI_GATEWAY_PROVIDER_MODE: "auto",
    }).enabled).toBe(false);
    expect(createLocalUnauthenticatedPreviewConfig({
      AI_GATEWAY_PROVIDER_MODE: "real",
    }).enabled).toBe(false);
    expect(createLocalUnauthenticatedPreviewConfig({
      AI_GATEWAY_PROVIDER_MODE: "fake",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
    }).enabled).toBe(false);
    expect(createLocalUnauthenticatedPreviewConfig({
      AI_GATEWAY_PROVIDER_MODE: "fake",
      AI_GATEWAY_DEFAULT_PROVIDER: "openai",
    }).enabled).toBe(false);
    expect(createLocalUnauthenticatedPreviewConfig({
      AI_GATEWAY_PROVIDER_MODE: "fake",
      AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider,openai",
    }).enabled).toBe(false);
  });

  it.each([
    ["GET", "/v1/models", "provider:read"],
    ["GET", "/v1/models/local-fake-model?details=true", "provider:read"],
    ["GET", "/ws?transport=websocket", "chat:use"],
    ["POST", "/v1/chat/completions", "chat:use"],
    ["POST", "/v1/responses", "chat:use"],
    ["POST", "/v1/messages", "chat:use"],
    ["POST", "/a2a/jsonrpc", "chat:use"],
    ["POST", "/openai/deployments/demo/chat/completions?api-version=2024-10-21", "chat:use"],
  ])("allows explicit fake-preview protocol route %s %s", (method, url, permission) => {
    expect(decide(method, url, permission)).toEqual(expect.objectContaining({ allowed: true }));
  });

  it.each([
    ["POST", "/providers/runtime-credential", "provider:write"],
    ["POST", "/knowledge/load", "knowledge:write"],
    ["GET", "/enterprise/audit", "audit:read"],
    ["GET", "/metrics", "dashboard:read"],
    ["POST", "/workforce/run-local", "workflow:run"],
    ["POST", "/local-agent/local-operation", "workflow:run"],
    ["POST", "/chat/rag", "chat:use"],
    ["POST", "/v1/images/generations", "chat:use"],
    ["POST", "/v1/embeddings", "chat:use"],
    ["POST", "/unknown", "route:unknown"],
  ])("denies non-preview route %s %s even when its permission is known", (method, url, permission) => {
    expect(decide(method, url, permission)).toEqual({
      allowed: false,
      code: "enterprise_local_preview_forbidden",
      reason: "route_not_allowlisted",
    });
  });

  it("binds each allowlisted path to its expected permission", () => {
    expect(decide("POST", "/v1/chat/completions", "workflow:run").allowed).toBe(false);
    expect(decide("GET", "/v1/models", "chat:use").allowed).toBe(false);
  });

  it("denies protected routes when fake-only preview is disabled", () => {
    expect(decide("POST", "/v1/chat/completions", "chat:use", false)).toEqual({
      allowed: false,
      code: "enterprise_auth_required_for_non_fake_mode",
      reason: "local_preview_disabled",
    });
  });

  it("keeps public health permission available without granting protected access", () => {
    expect(decide("GET", "/health", "public:read", false).allowed).toBe(true);
    expect(authorizeLocalUnauthenticatedRequest({
      request: { method: "POST" },
      permission: "chat:use",
      previewEnabled: true,
    }).allowed).toBe(false);
  });
});
