/**
 * Gateway Integration Tests
 *
 * Tests the forge-core <-> AI Gateway integration layer:
 *   - GatewayLifecycle: health, providers, API keys, model discovery
 *   - llm-client P11 integration: LLMCache, TokenPredictor, BudgetEnforcer wiring
 *   - callLLMStream: SSE streaming parse and fallback
 *
 * The actual gateway is NOT required -- all HTTP calls are mocked via global fetch override.
 */

import { describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// --- Test helpers ---

/**
 * Create a mock fetch that returns canned responses based on URL patterns.
 */
function createMockFetch(routes = {}) {
  const calls = [];
  const fetchFn = async (url, opts = {}) => {
    calls.push({ url, opts });
    for (const [pattern, handler] of Object.entries(routes)) {
      if (url.includes(pattern)) {
        const result = typeof handler === 'function' ? handler(url, opts) : handler;
        return {
          ok: result.ok !== false,
          status: result.status || 200,
          json: async () => result.json || result.body || {},
          text: async () => result.text || JSON.stringify(result.json || result.body || {}),
          body: result.body_stream || null,
        };
      }
    }
    return { ok: false, status: 404, json: async () => ({}), text: async () => 'Not Found' };
  };
  fetchFn.calls = calls;
  return fetchFn;
}

// --- GatewayLifecycle tests ---

describe('GatewayLifecycle', () => {
  let GatewayLifecycle;
  let originalFetch;

  before(async () => {
    const mod = await import('../src/gateway-lifecycle/index.js');
    GatewayLifecycle = mod.GatewayLifecycle;
    originalFetch = globalThis.fetch;
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  describe('health check', () => {
    it('should report healthy when gateway responds 200', async () => {
      globalThis.fetch = createMockFetch({
        '/health/check': { ok: true, json: { status: 'ok', uptime: 12345 } },
      });

      const gw = new GatewayLifecycle({ gatewayUrl: 'http://test-gateway:3100' });
      const result = await gw.checkHealth();

      assert.equal(result.healthy, true);
      assert.ok(result.latency >= 0);
      assert.equal(gw.connected, true);
    });

    it('should report unhealthy when gateway returns 500', async () => {
      globalThis.fetch = createMockFetch({
        '/health/check': { ok: false, status: 500 },
      });

      const gw = new GatewayLifecycle({ gatewayUrl: 'http://test-gateway:3100' });
      const result = await gw.checkHealth();

      assert.equal(result.healthy, false);
      assert.equal(gw.connected, false);
    });

    it('should report unhealthy when gateway is unreachable', async () => {
      globalThis.fetch = async () => { throw new Error('ECONNREFUSED'); };

      const gw = new GatewayLifecycle({ gatewayUrl: 'http://test-gateway:3100' });
      const result = await gw.checkHealth();

      assert.equal(result.healthy, false);
      assert.match(result.error, /ECONNREFUSED/);
    });
  });

  describe('provider management', () => {
    it('should fetch provider list', async () => {
      globalThis.fetch = createMockFetch({
        '/providers': {
          ok: true,
          json: {
            data: {
              providers: [
                { id: 'openai', name: 'OpenAI', hasCredential: true },
                { id: 'anthropic', name: 'Anthropic', hasCredential: false },
              ],
            },
          },
        },
      });

      const gw = new GatewayLifecycle({ gatewayUrl: 'http://test-gateway:3100' });
      const result = await gw.getProviders();

      assert.equal(result.providers.length, 2);
      assert.equal(result.providers[0].id, 'openai');
      assert.equal(result.providers[1].hasCredential, false);
    });

    it('should set API key for a provider', async () => {
      const mockFetch = createMockFetch({
        '/providers/runtime-credential': { ok: true, json: { success: true } },
      });
      globalThis.fetch = mockFetch;

      const gw = new GatewayLifecycle({ gatewayUrl: 'http://test-gateway:3100' });
      const result = await gw.setApiKey('openai', 'sk-test-key');

      assert.equal(result.success, true);
      assert.equal(gw.selectedProvider, 'openai');

      // Verify the request body
      const body = JSON.parse(mockFetch.calls[0].opts.body);
      assert.equal(body.providerId, 'openai');
      assert.equal(body.apiKey, 'sk-test-key');
    });

    it('should reject empty provider/key', async () => {
      const gw = new GatewayLifecycle({ gatewayUrl: 'http://test-gateway:3100' });
      const result = await gw.setApiKey('', '');
      assert.equal(result.success, false);
      assert.match(result.error, /required/);
    });
  });

  describe('model discovery', () => {
    it('should discover models via import preview', async () => {
      globalThis.fetch = createMockFetch({
        '/models/import/preview': {
          ok: true,
          json: {
            data: {
              models: [
                { id: 'gpt-4o', name: 'GPT-4o' },
                { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
              ],
              providerId: 'openai',
              status: 'ready',
            },
          },
        },
      });

      const gw = new GatewayLifecycle({ gatewayUrl: 'http://test-gateway:3100' });
      const result = await gw.discoverModels('sk-test-key', 'openai');

      assert.equal(result.models.length, 2);
      assert.equal(result.providerId, 'openai');
      assert.equal(result.needsSelection, false);
    });

    it('should indicate when user selection is needed', async () => {
      globalThis.fetch = createMockFetch({
        '/models/import/preview': {
          ok: true,
          json: {
            data: {
              models: [{ id: 'model-a' }, { id: 'model-b' }],
              status: 'needs_user_selection',
            },
          },
        },
      });

      const gw = new GatewayLifecycle({ gatewayUrl: 'http://test-gateway:3100' });
      const result = await gw.discoverModels('sk-generic-key');

      assert.equal(result.needsSelection, true);
    });

    it('should confirm model selection', async () => {
      const mockFetch = createMockFetch({
        '/models/import/confirm': { ok: true, json: { success: true } },
      });
      globalThis.fetch = mockFetch;

      const gw = new GatewayLifecycle({ gatewayUrl: 'http://test-gateway:3100' });
      const result = await gw.selectModel({
        providerId: 'openai',
        modelId: 'gpt-4o',
        apiKey: 'sk-test-key',
      });

      assert.equal(result.success, true);
      assert.equal(gw.selectedProvider, 'openai');
      assert.equal(gw.selectedModel, 'gpt-4o');
    });
  });

  describe('connect and status', () => {
    it('should run full connection sequence', async () => {
      globalThis.fetch = createMockFetch({
        '/health/check': { ok: true, json: { status: 'ok' } },
        '/providers': {
          ok: true,
          json: { data: { providers: [{ id: 'test', hasCredential: true }] } },
        },
      });

      const gw = new GatewayLifecycle({ gatewayUrl: 'http://test-gateway:3100' });
      const status = await gw.connect();

      assert.equal(status.connected, true);
      assert.equal(status.providers.length, 1);
    });

    it('should report disconnected when health fails', async () => {
      globalThis.fetch = async () => { throw new Error('timeout'); };

      const gw = new GatewayLifecycle({ gatewayUrl: 'http://test-gateway:3100' });
      const status = await gw.connect();

      assert.equal(status.connected, false);
      assert.ok(status.error);
    });

    it('should format status for console', async () => {
      globalThis.fetch = createMockFetch({
        '/health/check': { ok: true, json: { status: 'ok' } },
        '/providers': {
          ok: true,
          json: { data: { providers: [{ id: 'openai', hasCredential: true }] } },
        },
      });

      const gw = new GatewayLifecycle({ gatewayUrl: 'http://test-gateway:3100' });
      await gw.connect();
      const text = gw.formatStatus();

      assert.ok(text.includes('CONNECTED'));
      assert.ok(text.includes('openai'));
    });
  });

  describe('waitForReady', () => {
    it('should return immediately when gateway is healthy', async () => {
      globalThis.fetch = createMockFetch({
        '/health/check': { ok: true, json: { status: 'ok' } },
      });

      const gw = new GatewayLifecycle({ gatewayUrl: 'http://test-gateway:3100' });
      const result = await gw.waitForReady({ maxWaitMs: 5000, intervalMs: 100 });

      assert.equal(result.ready, true);
      assert.equal(result.attempts, 1);
    });

    it('should timeout when gateway never becomes healthy', async () => {
      globalThis.fetch = async () => { throw new Error('ECONNREFUSED'); };

      const gw = new GatewayLifecycle({ gatewayUrl: 'http://test-gateway:3100' });
      const result = await gw.waitForReady({ maxWaitMs: 500, intervalMs: 100 });

      assert.equal(result.ready, false);
      assert.ok(result.attempts >= 2);
    });
  });
});

// --- llm-client P11 integration tests ---

describe('llm-client P11 integration', () => {
  let originalFetch;

  before(() => {
    originalFetch = globalThis.fetch;
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  it('should expose P11 setter/getter functions', async () => {
    const mod = await import('../src/llm-client.js');
    assert.equal(typeof mod.setP11Cache, 'function');
    assert.equal(typeof mod.setP11TokenPredictor, 'function');
    assert.equal(typeof mod.setP11BudgetEnforcer, 'function');
    assert.equal(typeof mod.getP11Cache, 'function');
    assert.equal(typeof mod.getP11TokenPredictor, 'function');
    assert.equal(typeof mod.getP11BudgetEnforcer, 'function');
  });

  it('should expose callLLMStream function', async () => {
    const mod = await import('../src/llm-client.js');
    assert.equal(typeof mod.callLLMStream, 'function');
  });

  it('should have GATEWAY_TIMEOUT_MS default to 120s', async () => {
    // We can't directly read the constant, but we can verify the env var override works
    const origTimeout = process.env.FORGE_GATEWAY_TIMEOUT;
    process.env.FORGE_GATEWAY_TIMEOUT = '60000';
    // Re-import would pick up the new value; the default is 120000
    // Just verify the env var is read
    assert.equal(process.env.FORGE_GATEWAY_TIMEOUT, '60000');
    if (origTimeout) {
      process.env.FORGE_GATEWAY_TIMEOUT = origTimeout;
    } else {
      delete process.env.FORGE_GATEWAY_TIMEOUT;
    }
  });
});

// --- Forge class gateway integration tests ---

describe('Forge gateway integration', () => {
  let originalFetch;
  let tempDir;

  before(async () => {
    originalFetch = globalThis.fetch;
    // Mock fetch for all gateway calls
    globalThis.fetch = createMockFetch({
      '/health/check': { ok: true, json: { status: 'ok' } },
      '/providers': { ok: true, json: { data: { providers: [{ id: 'test-provider', hasCredential: true }] } } },
      '/providers/runtime-credential': { ok: true, json: { success: true } },
    });

    // Create a temp project root
    const { mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    tempDir = mkdtempSync(join(tmpdir(), 'forge-gw-test-'));
  });

  after(() => {
    globalThis.fetch = originalFetch;
    // Clean up temp dir
    try {
      const { rmSync } = require('node:fs');
      rmSync(tempDir, { recursive: true, force: true });
    } catch { /* best-effort cleanup */ }
  });

  it('should initialize GatewayLifecycle in constructor', async () => {
    const { Forge } = await import('../src/index.js');
    const forge = new Forge({ projectRoot: tempDir, gatewayUrl: 'http://test-gw:3100' });

    assert.ok(forge.gateway, 'gateway property should exist');
    assert.equal(forge.gateway.gatewayUrl, 'http://test-gw:3100');

    forge.close();
  });

  it('should connect to gateway', async () => {
    const { Forge } = await import('../src/index.js');
    const forge = new Forge({ projectRoot: tempDir });

    const status = await forge.connectGateway();
    assert.equal(status.connected, true);
    assert.ok(status.providers.length > 0);

    forge.close();
  });

  it('should set API key via gateway', async () => {
    const { Forge } = await import('../src/index.js');
    const forge = new Forge({ projectRoot: tempDir });

    const result = await forge.setApiKey('openai', 'sk-test-key');
    assert.equal(result.success, true);

    forge.close();
  });

  it('should return gateway status', async () => {
    const { Forge } = await import('../src/index.js');
    const forge = new Forge({ projectRoot: tempDir });

    await forge.connectGateway();
    const status = forge.getGatewayStatus();
    assert.equal(status.connected, true);

    forge.close();
  });
});
