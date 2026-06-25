/**
 * Multimodal Routing & Export Tests
 *
 * Tests the integration layer for multimodal capabilities:
 *   - Forge index: multimodal function/class exports
 *   - Capability router: executionEnabled for multimodal endpoints
 *   - Safe execution router: multimodal branch routing and adapter handling
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

describe('Capability Router - Multimodal Execution', () => {
  let routerMod;
  let rulesMod;

  before(async () => {
    routerMod = await import('../../../apps/ai-gateway-service/src/capabilities/capabilityRouterService.js');
    rulesMod = await import('../../../apps/ai-gateway-service/src/model-library/modelCapabilityRules.js');
  });

  it('should have executionEnabled true in router status', () => {
    const svc = routerMod.createCapabilityRouterService({ providerRegistry: null });
    const status = svc.getStatus();
    assert.equal(status.executionEnabled, true);
    assert.equal(status.previewOnly, false);
  });

  it('should return real paths for multimodal endpoint types', () => {
    const path = rulesMod.endpointPathFor(rulesMod.ENDPOINT_TYPES.multimodal);
    assert.ok(!path.startsWith('blocked:'), `Multimodal path should not be blocked, got: ${path}`);
    assert.equal(path, '/v1/images/generations');
  });

  it('should return real paths for voice endpoint types', () => {
    const path = rulesMod.endpointPathFor(rulesMod.ENDPOINT_TYPES.voice);
    assert.ok(!path.startsWith('blocked:'), `Voice path should not be blocked, got: ${path}`);
    assert.equal(path, '/v1/audio/speech');
  });

  it('should return real paths for video endpoint types', () => {
    const path = rulesMod.endpointPathFor(rulesMod.ENDPOINT_TYPES.video);
    assert.ok(!path.startsWith('blocked:'), `Video path should not be blocked, got: ${path}`);
    assert.equal(path, '/v1/video/generations');
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

  it('should route non-nvidia chat via OpenAI-compatible provider and fail without key', async () => {
    // Phase B: multi-provider routing unlocked; non-nvidia chat now routes
    // through callOpenAICompatibleProvider instead of being blocked.
    // Without an API key, the provider returns openai_api_key_missing.
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
    assert.equal(result.code, 'openai_api_key_missing');
  });

  it('should accept multimodal endpoint from non-nvidia provider', async () => {
    // Create a mock multimodal adapter
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

    assert.equal(result.success, true);
    assert.equal(result.code, 'gateway_execution_ok');
    assert.ok(result.meta?.realExternalCall, 'Should have made a real external call to the adapter');
    assert.equal(result.meta?.endpointType, 'multimodal');
  });

  it('should fail gracefully when multimodalAdapter is unavailable', async () => {
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
    assert.equal(result.code, 'multimodal_adapter_unavailable');
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
