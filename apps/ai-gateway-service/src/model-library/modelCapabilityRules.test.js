import { describe, it, expect } from "vitest";
import {
  normalizeCapabilities,
  inferCapabilitiesFromModel,
  inferEndpointType,
  endpointPathFor,
  primaryCapability,
  uiGroupFor,
  isDirectChatCapable,
  isTaskToolCapable,
  canBecomeSelectable,
  canBecomeDefaultCandidate,
  applySelectionRules,
  validateModelRecord,
  MODEL_CAPABILITIES,
  DIRECT_CHAT_CAPABILITIES,
  ENDPOINT_TYPES,
} from "./modelCapabilityRules.js";

describe("model-capability-rules", () => {
  it("MODEL_CAPABILITIES is frozen and non-empty", () => {
    expect(Object.isFrozen(MODEL_CAPABILITIES)).toBe(true);
    expect(MODEL_CAPABILITIES.length).toBeGreaterThan(10);
  });

  it("normalizeCapabilities filters unknown and dedupes", () => {
    expect(normalizeCapabilities(["chat_general", "chat_general", "unknown_cap"])).toEqual(["chat_general"]);
  });

  it("normalizeCapabilities returns specialized_hidden for empty input", () => {
    expect(normalizeCapabilities([])).toEqual(["specialized_hidden"]);
    expect(normalizeCapabilities(null)).toEqual(["specialized_hidden"]);
  });

  it("inferCapabilitiesFromModel detects coding models", () => {
    expect(inferCapabilitiesFromModel({ modelId: "codestral-22b" })).toContain("chat_coding");
  });

  it("inferCapabilitiesFromModel detects embedding models", () => {
    expect(inferCapabilitiesFromModel({ modelId: "text-embedding-nvidia" })).toContain("embedding_text");
  });

  it("inferCapabilitiesFromModel detects code embedding models", () => {
    expect(inferCapabilitiesFromModel({ modelId: "embed-code-v1" })).toContain("embedding_code");
  });

  it("inferCapabilitiesFromModel detects safety models", () => {
    expect(inferCapabilitiesFromModel({ modelId: "guard-safety-model" })).toEqual(["safety"]);
  });

  it("inferCapabilitiesFromModel detects vision models", () => {
    expect(inferCapabilitiesFromModel({ modelId: "vlm-vision-7b" })).toContain("multimodal_image");
  });

  it("inferCapabilitiesFromModel defaults to chat_general", () => {
    expect(inferCapabilitiesFromModel({ modelId: "some-unknown-model" })).toEqual(["chat_general"]);
  });

  it("inferEndpointType maps chat capabilities to chat endpoint", () => {
    expect(inferEndpointType(["chat_general"])).toBe(ENDPOINT_TYPES.chat);
  });

  it("inferEndpointType maps embedding to embeddings endpoint", () => {
    expect(inferEndpointType(["embedding_text"])).toBe(ENDPOINT_TYPES.embeddings);
  });

  it("inferEndpointType returns hostedSpecialized for unknown capabilities", () => {
    expect(inferEndpointType(["specialized_hidden"])).toBe(ENDPOINT_TYPES.hostedSpecialized);
  });

  it("inferEndpointType respects downloadableOnly flag", () => {
    expect(inferEndpointType(["chat_general"], { downloadableOnly: true })).toBe(ENDPOINT_TYPES.downloadableOnly);
  });

  it("endpointPathFor returns /chat/completions for chat", () => {
    expect(endpointPathFor(ENDPOINT_TYPES.chat)).toBe("/chat/completions");
    expect(endpointPathFor(ENDPOINT_TYPES.embeddings)).toBe("/embeddings");
  });

  it("endpointPathFor returns blocked: prefix for specialized endpoints", () => {
    expect(endpointPathFor(ENDPOINT_TYPES.multimodal)).toMatch(/^blocked:/);
    expect(endpointPathFor(ENDPOINT_TYPES.downloadableOnly)).toMatch(/^blocked:/);
  });

  it("primaryCapability returns first capability", () => {
    expect(primaryCapability(["chat_general", "embedding_text"])).toBe("chat_general");
  });

  it("uiGroupFor returns Direct Chat for chat capabilities", () => {
    expect(uiGroupFor(["chat_general"])).toBe("Direct Chat");
    expect(uiGroupFor(["embedding_text"])).toBe("Task Tools - Embedding");
  });

  it("isDirectChatCapable detects chat capabilities", () => {
    expect(isDirectChatCapable(["chat_general"])).toBe(true);
    expect(isDirectChatCapable(["embedding_text"])).toBe(false);
  });

  it("isTaskToolCapable detects task tool capabilities", () => {
    expect(isTaskToolCapable(["embedding_text"])).toBe(true);
    expect(isTaskToolCapable(["chat_general"])).toBe(false);
  });

  it("canBecomeSelectable requires smoke_passed", () => {
    expect(canBecomeSelectable({ state: { smoke_passed: true } })).toBe(true);
    expect(canBecomeSelectable({ state: { smoke_passed: false } })).toBe(false);
  });

  it("canBecomeSelectable rejects downloadableOnly", () => {
    expect(canBecomeSelectable({ state: { smoke_passed: true }, downloadableOnly: true })).toBe(false);
  });

  it("canBecomeDefaultCandidate requires direct chat capability", () => {
    expect(canBecomeDefaultCandidate({
      state: { smoke_passed: true },
      capabilities: ["chat_general"],
    })).toBe(true);
    expect(canBecomeDefaultCandidate({
      state: { smoke_passed: true },
      capabilities: ["embedding_text"],
    })).toBe(false);
  });

  it("applySelectionRules produces full state object", () => {
    const result = applySelectionRules({
      capabilities: ["chat_general"],
      testStatus: "smoke_passed",
    }, true);
    expect(result.state.configured).toBe(true);
    expect(result.state.smoke_passed).toBe(true);
    expect(result.state.selectable).toBe(true);
    expect(result.directChat).toBe(true);
  });

  it("validateModelRecord detects missing fields", () => {
    const result = validateModelRecord({});
    expect(result.valid).toBe(false);
    expect(result.missing.length).toBeGreaterThan(5);
  });

  it("validateModelRecord passes for complete record", () => {
    const result = validateModelRecord({
      providerId: "nvidia",
      providerName: "NVIDIA",
      modelId: "llama-3",
      displayName: "Llama 3",
      publisher: "Meta",
      source: "catalog",
      sourceUrlOrDiscoveryNote: "n/a",
      catalogStatus: "active",
      endpointType: "chat_completions",
      endpointPath: "/chat/completions",
      capabilities: ["chat_general"],
      primaryCapability: "chat_general",
      uiGroup: "Direct Chat",
      testStatus: "smoke_passed",
      notes: [],
    });
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
    expect(result.violations).toHaveLength(0);
  });

  it("validateModelRecord detects capability violations", () => {
    const result = validateModelRecord({
      providerId: "x",
      providerName: "x",
      modelId: "x",
      displayName: "x",
      publisher: "x",
      source: "x",
      sourceUrlOrDiscoveryNote: "x",
      catalogStatus: "x",
      endpointType: "chat_completions",
      endpointPath: "/chat/completions",
      capabilities: ["embedding_text"],
      primaryCapability: "embedding_text",
      uiGroup: "Task Tools",
      testStatus: "smoke_passed",
      notes: [],
      state: { selectable: true, smoke_passed: true },
      directChat: true,
    });
    expect(result.violations).toContain("non_chat_model_cannot_direct_chat");
  });
});
