import { describe, expect, it } from "vitest";
import { resolvePermission } from "./utils/enterpriseUtils.js";
import { isPublicRoute } from "./routeAccessPolicy.js";

describe("route access policy", () => {
  it.each([
    "/health/check",
    "/livez",
    "/healthz",
    "/ready",
    "/setup/readiness",
    "/auth/status",
  ])("keeps bootstrap read route public: %s", (pathname) => {
    expect(isPublicRoute(pathname)).toBe(true);
  });

  it.each([
    "/ui",
    "/console",
    "/approvals/create",
    "/local-operation/apply-approved",
    "/agent-runner/local-operation",
    "/provider-config/save",
    "/provider-config/test",
    "/model-library/test-model",
    "/real-capabilities/activate-five",
    "/chat-gateway/execute",
    "/three-mode/execute",
  ])("requires authorization for mutation route: %s", (pathname) => {
    expect(isPublicRoute(pathname)).toBe(false);
  });

  it("governs prompt enhancement with the existing chat permission", () => {
    expect(isPublicRoute("/prompts/enhance")).toBe(false);
    expect(resolvePermission("POST", "/prompts/enhance")).toBe("chat:use");
  });

  it("keeps A2A discovery public while governing task execution", () => {
    expect(isPublicRoute("/.well-known/agent-card.json")).toBe(true);
    expect(isPublicRoute("/a2a/jsonrpc")).toBe(false);
    expect(resolvePermission("POST", "/a2a/jsonrpc")).toBe("chat:use");
  });

  it("governs both OpenAI-compatible generation routes", () => {
    expect(resolvePermission("POST", "/v1/chat/completions")).toBe("chat:use");
    expect(resolvePermission("POST", "/v1/completions")).toBe("chat:use");
    expect(resolvePermission("POST", "/v1/responses")).toBe("chat:use");
    expect(resolvePermission("POST", "/v1/messages")).toBe("chat:use");
  });

  it("governs multimodal-compatible routes with chat execution permission", () => {
    expect(resolvePermission("POST", "/v1/images/generations")).toBe("chat:use");
    expect(resolvePermission("POST", "/v1/embeddings")).toBe("chat:use");
    expect(resolvePermission("POST", "/v1/audio/speech")).toBe("chat:use");
    expect(resolvePermission("POST", "/v1/audio/transcriptions")).toBe("chat:use");
    expect(resolvePermission("POST", "/audio/speech")).toBe("chat:use");
    expect(resolvePermission("POST", "/embeddings")).toBe("chat:use");
  });

  it("supports non-prefixed OpenAI-compatible aliases", () => {
    expect(resolvePermission("POST", "/chat/completions")).toBe("chat:use");
    expect(resolvePermission("POST", "/completions")).toBe("chat:use");
    expect(resolvePermission("POST", "/responses")).toBe("chat:use");
    expect(resolvePermission("GET", "/models")).toBe("provider:read");
    expect(resolvePermission("GET", "/engines")).toBe("provider:read");
    expect(resolvePermission("GET", "/v1/engines")).toBe("provider:read");
    expect(resolvePermission("POST", "/chat/completions/")).toBe("chat:use");
    expect(resolvePermission("POST", "/responses/")).toBe("chat:use");
    expect(resolvePermission("GET", "/models/")).toBe("provider:read");
    expect(resolvePermission("GET", "/models/local-fake-model")).toBe("provider:read");
    expect(resolvePermission("GET", "/engines/local-fake-model")).toBe("provider:read");
    expect(resolvePermission("GET", "/v1/models/local-fake-model")).toBe("provider:read");
    expect(resolvePermission("GET", "/v1/engines/local-fake-model")).toBe("provider:read");
  });

  it("governs Azure deployment-style OpenAI routes", () => {
    expect(resolvePermission("POST", "/openai/deployments/local-fake-model/chat/completions")).toBe("chat:use");
    expect(resolvePermission("POST", "/openai/deployments/local-fake-model/completions")).toBe("chat:use");
    expect(resolvePermission("POST", "/openai/deployments/local-fake-model/responses")).toBe("chat:use");
  });

  it("supports legacy OpenAI engine routes", () => {
    expect(resolvePermission("POST", "/v1/engines/local-fake-model/chat/completions")).toBe("chat:use");
    expect(resolvePermission("POST", "/v1/engines/local-fake-model/completions")).toBe("chat:use");
    expect(resolvePermission("POST", "/v1/engines/local-fake-model/chat/completions/")).toBe("chat:use");
  });
});
