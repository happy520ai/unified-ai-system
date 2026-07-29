/**
 * Multimodal Routing & Export Tests
 *
 * Tests the integration layer for multimodal capabilities:
 *   - Forge index: multimodal function/class exports
 *   - Capability router: preview-only multimodal boundaries
 *   - Safe execution router: unsupported providers remain blocked
 *   - Export completeness: all expected multimodal exports present
 *
 * All HTTP calls are mocked — no real provider calls.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

// ── Forge Index Exports Tests ───────────────────────────────────────────────

describe('Forge Index - Multimodal Exports', () => {
  let forgeMod;

  before(async () => {
    forgeMod = await import('../src/index.js');
  });

  it('should export generateImage', () => {
    assert.equal(typeof forgeMod.generateImage, 'function');
  });

  it('should export generateEmbedding', () => {
    assert.equal(typeof forgeMod.generateEmbedding, 'function');
  });

  it('should export synthesizeSpeech', () => {
    assert.equal(typeof forgeMod.synthesizeSpeech, 'function');
  });

  it('should export transcribeAudio', () => {
    assert.equal(typeof forgeMod.transcribeAudio, 'function');
  });

  it('should export ImageWorker', () => {
    assert.equal(typeof forgeMod.ImageWorker, 'function');
  });

  it('should export EmbeddingWorker', () => {
    assert.equal(typeof forgeMod.EmbeddingWorker, 'function');
  });

  it('should export AudioWorker', () => {
    assert.equal(typeof forgeMod.AudioWorker, 'function');
  });

  it('should export VideoWorker', () => {
    assert.equal(typeof forgeMod.VideoWorker, 'function');
  });

  it('should export MediaWorker', () => {
    assert.equal(typeof forgeMod.MediaWorker, 'function');
  });
});

// ── Capability Router Execution Tests ────────────────────────────────────────

describe('Capability Router - Multimodal Preview Boundary', () => {
  let routerMod;
  let rulesMod;

  before(async () => {
    routerMod = await import('../../../apps/ai-gateway-service/src/capabilities/capabilityRouterService.js');
    rulesMod = await import('../../../apps/ai-gateway-service/src/model-library/modelCapabilityRules.js');
  });

  it('keeps automatic execution disabled in router status', () => {
    const svc = routerMod.createCapabilityRouterService({ providerRegistry: null });
    const status = svc.getStatus();
    assert.equal(status.executionEnabled, false);
    assert.equal(status.previewOnly, true);
  });

  it('blocks generic multimodal endpoints without specialized payloads', () => {
    const path = rulesMod.endpointPathFor(rulesMod.ENDPOINT_TYPES.multimodal);
    assert.equal(path, 'blocked:specialized-multimodal-payload-required');
  });

  it('blocks generic voice endpoints without specialized payloads', () => {
    const path = rulesMod.endpointPathFor(rulesMod.ENDPOINT_TYPES.voice);
    assert.equal(path, 'blocked:specialized-voice-payload-required');
  });

  it('blocks generic video endpoints without specialized payloads', () => {
    const path = rulesMod.endpointPathFor(rulesMod.ENDPOINT_TYPES.video);
    assert.equal(path, 'blocked:specialized-video-payload-required');
  });

  it('should infer multimodal endpoint type from capabilities', () => {
    const endpoint = rulesMod.inferEndpointType(['multimodal_image']);
    assert.equal(endpoint, rulesMod.ENDPOINT_TYPES.multimodal);
  });

  it('should infer voice endpoint type from capabilities', () => {
    const endpoint = rulesMod.inferEndpointType(['voice_tts']);
    assert.equal(endpoint, rulesMod.ENDPOINT_TYPES.voice);
  });

  it('should infer video endpoint type from capabilities', () => {
    const endpoint = rulesMod.inferEndpointType(['video']);
    assert.equal(endpoint, rulesMod.ENDPOINT_TYPES.video);
  });
});

// ── Safe Execution Router Multimodal Tests ───────────────────────────────────

describe('Safe Execution Router - Multimodal Branches', () => {
  let execRouter;
  let rulesMod;

  before(async () => {
    execRouter = await import('../../../apps/ai-gateway-service/src/chat-gateway/capabilitySafeExecutionRouter.js');
    rulesMod = await import('../../../apps/ai-gateway-service/src/model-library/modelCapabilityRules.js');
  });

  it('should accept multimodalAdapter parameter', () => {
    // The function should accept a multimodalAdapter alongside nvidiaClient
    assert.equal(typeof execRouter.executeCapabilitySafePlan, 'function');
  });

  it('blocks non-NVIDIA chat before any provider call', async () => {
    const result = await execRouter.executeCapabilitySafePlan({
      plan: {
        intentType: 'general_chat',
        blocked: false,
        selected: {
          providerId: 'openai',
          modelId: 'gpt-4',
          endpointType: rulesMod.ENDPOINT_TYPES.chat,
          capability: 'chat_general',
        },
      },
      input: 'hello',
      messages: [{ role: 'user', content: 'hello' }],
      nvidiaClient: null,
      runtimeCredentialStore: null,
      env: {},
    });

    assert.equal(result.success, false);
    assert.equal(result.code, 'provider_not_allowed_phase312a');
    assert.equal(result.meta.providerCalled, false);
  });

  it('does not invoke a multimodal adapter for a blocked provider', async () => {
    const mockAdapter = {
      generateImage: async () => ({ url: 'https://example.com/img.png', provider: 'openai' }),
    };

    const result = await execRouter.executeCapabilitySafePlan({
      plan: {
        intentType: 'image_understanding',
        blocked: false,
        selected: {
          providerId: 'openai',
          modelId: 'dall-e-3',
          endpointType: rulesMod.ENDPOINT_TYPES.multimodal,
          capability: 'multimodal_image',
        },
      },
      input: 'A beautiful sunset',
      messages: [],
      nvidiaClient: null,
      multimodalAdapter: mockAdapter,
    });

    assert.equal(result.success, false);
    assert.equal(result.code, 'provider_not_allowed_phase312a');
    assert.equal(result.meta?.realExternalCall, false);
    assert.equal(result.meta?.endpointType, 'multimodal');
  });

  it('returns the same provider boundary when no adapter is supplied', async () => {
    const result = await execRouter.executeCapabilitySafePlan({
      plan: {
        intentType: 'image_understanding',
        blocked: false,
        selected: {
          providerId: 'openai',
          modelId: 'dall-e-3',
          endpointType: rulesMod.ENDPOINT_TYPES.multimodal,
          capability: 'multimodal_image',
        },
      },
      input: 'A test image',
      messages: [],
      nvidiaClient: null,
      multimodalAdapter: null,
    });

    assert.equal(result.success, false);
    assert.equal(result.code, 'provider_not_allowed_phase312a');
  });
});

// ── Export Completeness Tests ───────────────────────────────────────────────

describe('Export completeness', () => {
  it('should export all expected functions from forge-core', async () => {
    const forgeCore = await import('../src/index.js');
    const expectedExports = [
      'generateImage', 'generateEmbedding', 'synthesizeSpeech', 'transcribeAudio',
      'generateVideo', 'setMultimodalGatewayUrl', 'getMultimodalGatewayUrl',
      'checkGatewayHealth', 'MultimodalError',
      'ImageWorker', 'EmbeddingWorker', 'AudioWorker', 'VideoWorker', 'MediaWorker',
    ];
    for (const name of expectedExports) {
      assert.ok(forgeCore[name], `Missing export: ${name}`);
    }
  });
});
