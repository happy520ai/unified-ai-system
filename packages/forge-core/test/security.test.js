import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

let HttpRateLimiter, applySecurityHeaders, AuditLogger, guardPath,
    sanitizeError, sanitizeValue, hashApiKey, verifyApiKey;

before(async () => {
  const mod = await import('../src/security/index.js');
  HttpRateLimiter = mod.HttpRateLimiter;
  applySecurityHeaders = mod.applySecurityHeaders;
  AuditLogger = mod.AuditLogger;
  guardPath = mod.guardPath;
  sanitizeError = mod.sanitizeError;
  sanitizeValue = mod.sanitizeValue;
  hashApiKey = mod.hashApiKey;
  verifyApiKey = mod.verifyApiKey;
});

describe('Security', { concurrency: 1 }, () => {

  // ── HttpRateLimiter ───────────────────────────────────────────────────

  describe('HttpRateLimiter', () => {
    it('should export HttpRateLimiter class', () => {
      assert.ok(HttpRateLimiter);
    });

    it('should allow requests within the bucket capacity', () => {
      const rl = new HttpRateLimiter({ maxTokens: 5, refillPerSecond: 1 });
      for (let i = 0; i < 5; i++) {
        const result = rl.check('ip-1');
        assert.ok(result.allowed, `request ${i + 1} should be allowed`);
      }
    });

    it('should deny requests when bucket is empty', () => {
      const rl = new HttpRateLimiter({ maxTokens: 3, refillPerSecond: 1 });
      rl.check('ip-2');
      rl.check('ip-2');
      rl.check('ip-2');
      const result = rl.check('ip-2');
      assert.ok(!result.allowed);
      assert.ok(result.retryAfterMs > 0);
      assert.strictEqual(result.remaining, 0);
    });

    it('should refill tokens over time', async () => {
      const rl = new HttpRateLimiter({ maxTokens: 2, refillPerSecond: 100 });
      rl.check('ip-3');
      rl.check('ip-3');
      assert.ok(!rl.check('ip-3').allowed);

      // Wait for refill
      await new Promise(r => setTimeout(r, 30));
      const result = rl.check('ip-3');
      assert.ok(result.allowed);
    });

    it('should maintain separate buckets per key', () => {
      const rl = new HttpRateLimiter({ maxTokens: 1, refillPerSecond: 0 });
      assert.ok(rl.check('a').allowed);
      assert.ok(!rl.check('a').allowed);
      assert.ok(rl.check('b').allowed); // different key, still allowed
    });

    it('should reset a specific bucket', () => {
      const rl = new HttpRateLimiter({ maxTokens: 1, refillPerSecond: 0 });
      rl.check('x');
      assert.ok(!rl.check('x').allowed);
      rl.reset('x');
      assert.ok(rl.check('x').allowed);
    });

    it('should clear all buckets', () => {
      const rl = new HttpRateLimiter({ maxTokens: 1, refillPerSecond: 0 });
      rl.check('a');
      rl.check('b');
      rl.clear();
      const status = rl.getStatus();
      assert.strictEqual(status.totalBuckets, 0);
    });

    it('should return status summary', () => {
      const rl = new HttpRateLimiter({ maxTokens: 50, refillPerSecond: 20 });
      rl.check('test');
      const status = rl.getStatus();
      assert.strictEqual(status.maxTokens, 50);
      assert.strictEqual(status.refillPerSecond, 20);
      assert.strictEqual(status.totalBuckets, 1);
    });

    it('should start and stop cleanup timer', () => {
      const rl = new HttpRateLimiter();
      rl.startCleanup();
      rl.stopCleanup(); // should not throw
    });
  });

  // ── Security Headers ──────────────────────────────────────────────────

  describe('applySecurityHeaders', () => {
    it('should be a function', () => {
      assert.strictEqual(typeof applySecurityHeaders, 'function');
    });

    it('should apply default security headers', () => {
      const headers = {};
      const mockRes = { setHeader(k, v) { headers[k] = v; } };
      applySecurityHeaders(mockRes);

      assert.strictEqual(headers['X-Content-Type-Options'], 'nosniff');
      assert.strictEqual(headers['X-Frame-Options'], 'DENY');
      assert.ok(headers['Content-Security-Policy']);
      assert.strictEqual(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
      assert.strictEqual(headers['Cache-Control'], 'no-store');
    });

    it('should allow overriding headers', () => {
      const headers = {};
      const mockRes = { setHeader(k, v) { headers[k] = v; } };
      applySecurityHeaders(mockRes, { 'X-Frame-Options': 'SAMEORIGIN' });
      assert.strictEqual(headers['X-Frame-Options'], 'SAMEORIGIN');
    });

    it('should allow removing a header with null', () => {
      const headers = {};
      const mockRes = { setHeader(k, v) { headers[k] = v; } };
      applySecurityHeaders(mockRes, { 'X-Frame-Options': null });
      assert.strictEqual(headers['X-Frame-Options'], undefined);
    });
  });

  // ── Audit Logger ──────────────────────────────────────────────────────

  describe('AuditLogger', () => {
    it('should export AuditLogger class', () => {
      assert.ok(AuditLogger);
    });

    it('should create an empty instance', () => {
      const al = new AuditLogger();
      const status = al.getStatus();
      assert.strictEqual(status.totalEvents, 0);
    });

    it('should log an audit event', () => {
      const al = new AuditLogger();
      const record = al.log({ action: 'auth.success', userId: 'u1', ip: '127.0.0.1' });
      assert.strictEqual(record.action, 'auth.success');
      assert.strictEqual(record.userId, 'u1');
      assert.strictEqual(record.ip, '127.0.0.1');
      assert.ok(record.timestamp);
    });

    it('should emit audit events', (_, done) => {
      const al = new AuditLogger();
      al.on('audit', (record) => {
        assert.strictEqual(record.action, 'test.action');
        done();
      });
      al.log({ action: 'test.action' });
    });

    it('should query events by action', () => {
      const al = new AuditLogger();
      al.log({ action: 'auth.success' });
      al.log({ action: 'auth.failure' });
      al.log({ action: 'auth.success' });

      const successes = al.query({ action: 'auth.success' });
      assert.strictEqual(successes.length, 2);
    });

    it('should query events by userId', () => {
      const al = new AuditLogger();
      al.log({ action: 'a', userId: 'u1' });
      al.log({ action: 'b', userId: 'u2' });
      al.log({ action: 'c', userId: 'u1' });

      const u1Events = al.query({ userId: 'u1' });
      assert.strictEqual(u1Events.length, 2);
    });

    it('should query events by outcome', () => {
      const al = new AuditLogger();
      al.log({ action: 'a', outcome: 'success' });
      al.log({ action: 'b', outcome: 'failure' });
      al.log({ action: 'c', outcome: 'denied' });

      const failures = al.query({ outcome: 'failure' });
      assert.strictEqual(failures.length, 1);
    });

    it('should enforce maxEvents ring buffer', () => {
      const al = new AuditLogger({ maxEvents: 5 });
      for (let i = 0; i < 10; i++) {
        al.log({ action: `event-${i}` });
      }
      assert.strictEqual(al.getEvents().length, 5);
    });

    it('should produce correct status summary', () => {
      const al = new AuditLogger();
      al.log({ action: 'auth.success', outcome: 'success' });
      al.log({ action: 'auth.failure', outcome: 'failure' });
      al.log({ action: 'auth.success', outcome: 'success' });

      const status = al.getStatus();
      assert.strictEqual(status.totalEvents, 3);
      assert.strictEqual(status.actions['auth.success'], 2);
      assert.strictEqual(status.actions['auth.failure'], 1);
      assert.strictEqual(status.outcomes.success, 2);
      assert.strictEqual(status.outcomes.failure, 1);
    });

    it('should clear all events', () => {
      const al = new AuditLogger();
      al.log({ action: 'a' });
      al.log({ action: 'b' });
      al.clear();
      assert.strictEqual(al.getEvents().length, 0);
    });
  });

  // ── Path Guard ────────────────────────────────────────────────────────

  describe('guardPath', () => {
    it('should be a function', () => {
      assert.strictEqual(typeof guardPath, 'function');
    });

    it('should allow paths within base directory', () => {
      const result = guardPath('/home/user/project', 'src/index.js');
      assert.ok(result.safe);
      assert.ok(result.resolved.includes('src'));
    });

    it('should allow base directory itself', () => {
      const result = guardPath('/home/user/project', '');
      assert.ok(result.safe);
    });

    it('should block path traversal with ../', () => {
      const result = guardPath('/home/user/project', '../../etc/passwd');
      assert.ok(!result.safe);
    });

    it('should block path traversal with encoded patterns', () => {
      const result = guardPath('/home/user/project', '../../../etc/shadow');
      assert.ok(!result.safe);
    });

    it('should handle nested safe paths', () => {
      const result = guardPath('/home/user/project', 'src/components/Button.jsx');
      assert.ok(result.safe);
    });

    it('should handle absolute paths outside base', () => {
      const result = guardPath('/home/user/project', '/etc/passwd');
      assert.ok(!result.safe);
    });
  });

  // ── Error Sanitizer ───────────────────────────────────────────────────

  describe('sanitizeError', () => {
    it('should sanitize auth errors in production', () => {
      const result = sanitizeError(new Error('Authentication failed for user admin'));
      assert.strictEqual(result.error, 'Authentication required');
    });

    it('should sanitize 403 errors', () => {
      const err = new Error('Forbidden');
      err.status = 403;
      const result = sanitizeError(err);
      assert.strictEqual(result.error, 'Access denied');
    });

    it('should sanitize 404 errors', () => {
      const err = new Error('Not Found');
      err.status = 404;
      const result = sanitizeError(err);
      assert.strictEqual(result.error, 'Not found');
    });

    it('should sanitize 413 errors', () => {
      const err = new Error('Body too large');
      err.status = 413;
      const result = sanitizeError(err);
      assert.strictEqual(result.error, 'Request too large');
    });

    it('should sanitize 429 errors', () => {
      const err = new Error('Too many requests');
      err.status = 429;
      const result = sanitizeError(err);
      assert.strictEqual(result.error, 'Too many requests');
    });

    it('should return generic message for unknown errors in production', () => {
      const err = new Error('SQL syntax error near line 42 in /app/db.js');
      const result = sanitizeError(err);
      assert.strictEqual(result.error, 'Internal server error');
    });

    it('should include message in development mode', () => {
      const err = new Error('Detailed error info');
      const result = sanitizeError(err, false);
      assert.strictEqual(result.error, 'Detailed error info');
    });

    it('should handle null/undefined', () => {
      assert.strictEqual(sanitizeError(null).error, 'Unknown error');
      assert.strictEqual(sanitizeError(undefined).error, 'Unknown error');
    });
  });

  // ── Value Sanitizer ───────────────────────────────────────────────────

  describe('sanitizeValue', () => {
    it('should mask API keys', () => {
      const result = sanitizeValue('api_key', 'sk-1234567890abcdef');
      assert.ok(result.startsWith('sk-1'));
      assert.ok(result.endsWith('****'));
      assert.ok(!result.includes('567890'));
    });

    it('should mask passwords', () => {
      const result = sanitizeValue('password', 'super_secret_password');
      assert.ok(result.includes('****'));
    });

    it('should mask tokens', () => {
      const result = sanitizeValue('auth_token', 'bearer_xyz123456789');
      assert.ok(result.includes('****'));
    });

    it('should NOT mask regular values', () => {
      assert.strictEqual(sanitizeValue('port', 3000), '3000');
      assert.strictEqual(sanitizeValue('host', 'localhost'), 'localhost');
    });

    it('should handle null/undefined', () => {
      assert.strictEqual(sanitizeValue('key', null), '--');
      assert.strictEqual(sanitizeValue('key', undefined), '--');
    });

    it('should not mask short sensitive values', () => {
      const result = sanitizeValue('api_key', 'ab');
      assert.strictEqual(result, 'ab'); // too short to mask
    });
  });

  // ── API Key Hashing ───────────────────────────────────────────────────

  describe('API Key Hashing', () => {
    it('should hash an API key deterministically', () => {
      const hash1 = hashApiKey('fk-test-key-123');
      const hash2 = hashApiKey('fk-test-key-123');
      assert.strictEqual(hash1, hash2);
    });

    it('should produce different hashes for different keys', () => {
      const hash1 = hashApiKey('key-a');
      const hash2 = hashApiKey('key-b');
      assert.notStrictEqual(hash1, hash2);
    });

    it('should produce hex string of length 64', () => {
      const hash = hashApiKey('some-key');
      assert.strictEqual(hash.length, 64);
      assert.ok(/^[0-9a-f]+$/.test(hash));
    });

    it('should verify correct key against hash', () => {
      const key = 'fk-production-key-xyz789';
      const hash = hashApiKey(key);
      assert.ok(verifyApiKey(key, hash));
    });

    it('should reject incorrect key', () => {
      const hash = hashApiKey('correct-key');
      assert.ok(!verifyApiKey('wrong-key', hash));
    });

    it('should handle empty strings', () => {
      const hash = hashApiKey('');
      assert.ok(verifyApiKey('', hash));
      assert.ok(!verifyApiKey('nonempty', hash));
    });
  });
});
