#!/usr/bin/env node
/**
 * Forge Integration E2E Test
 * 
 * Starts Forge standalone server with NVIDIA provider,
 * tests API endpoints, submits a challenging goal, and monitors execution.
 */

import { resolve } from 'node:path';
import { Forge, AgentPoolManager, GoalTransfer, KnowledgeBase, GatewayBridge, UserManager, ForgeServer } from './src/index.js';

// ---- Configuration ----
const projectRoot = resolve('E:\\AI-Data\\AI网关系统\\unified-ai-system\\packages\\forge-core\\test-projects\\integration-challenge');
const port = 4500;

// Use NVIDIA API key from environment
if (!process.env.NVIDIA_API_KEY) {
  console.error('[test] NVIDIA_API_KEY not set!');
  process.exit(1);
}

// Force NVIDIA provider
process.env.FORGE_LLM_PROVIDER = 'nvidia';
process.env.FORGE_LLM_MODEL = 'nvidia/llama-3.3-nemotron-super-49b-v1';
process.env.FORGE_LLM_TIMEOUT = '120000';

console.log(`\n${'═'.repeat(60)}`);
console.log(`  FORGE INTEGRATION E2E TEST`);
console.log(`${'═'.repeat(60)}`);
console.log(`[test] Project: ${projectRoot}`);
console.log(`[test] Provider: NVIDIA (${process.env.FORGE_LLM_MODEL})`);
console.log(`[test] Port: ${port}\n`);

// ---- Bootstrap ----
const forge = new Forge({ projectRoot });
const userMgr = new UserManager(forge.store.db);
const agentPool = new AgentPoolManager({
  store: forge.store,
  projectRoot,
  maxConcurrent: 2,
  maxGoals: 1,
  budget: { maxTokens: 500000, maxCost: 5, maxMinutes: 30 },
  enableCodeIntel: true,
  enableVerification: true,
});
const knowledge = new KnowledgeBase(forge.store);
const transfer = new GoalTransfer(forge.store);
const gateway = new GatewayBridge();

forge.attachPool(agentPool);

// Create admin user
const users = userMgr.listUsers();
let adminKey;
if (users.length === 0) {
  const admin = userMgr.createUser({ username: 'admin', displayName: 'Admin', role: 'admin' });
  adminKey = admin.api_key;
  console.log(`[test] Admin created — Key: ${adminKey}`);
} else {
  adminKey = users[0].api_key || 'test-key';
}

// ---- Start Server ----
const server = new ForgeServer({
  forge,
  userMgr,
  agentPool,
  knowledge,
  transfer,
  gateway,
  port,
});

const httpServer = server.start();

// Wait for server to be ready
await new Promise(resolve => setTimeout(resolve, 2000));

// ---- E2E Tests ----
const BASE = `http://127.0.0.1:${port}`;
const headers = {
  'Content-Type': 'application/json',
  'X-Api-Key': adminKey,
};

async function apiGet(path) {
  const res = await fetch(`${BASE}${path}`, { headers });
  return { status: res.status, body: await res.json() };
}

async function apiPost(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}`);
    failed++;
  }
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`  Phase 1: API Integration Verification`);
console.log(`${'─'.repeat(60)}\n`);

// Test 1: Health endpoint
try {
  const { status, body } = await apiGet('/api/status');
  check('GET /api/status returns 200', status === 200);
  check('Status has version field', !!body.version);
  check('Status has uptime field', typeof body.uptime === 'number');
  check('Status has pool data', !!body.pool);
} catch (e) {
  check('GET /api/status reachable', false);
}

// Test 2: Pool status
try {
  const { status, body } = await apiGet('/api/pool/status');
  check('GET /api/pool/status returns 200', status === 200);
  check('Pool has maxConcurrent', body.maxConcurrent === 2);
  check('Pool has maxGoals', body.maxGoals === 1);
} catch (e) {
  check('GET /api/pool/status reachable', false);
}

// Test 3: Goals listing
try {
  const { status, body } = await apiGet('/api/goals');
  check('GET /api/goals returns 200', status === 200);
  check('Goals is an array', Array.isArray(body.goals));
} catch (e) {
  check('GET /api/goals reachable', false);
}

// Test 4: Config
try {
  const { status, body } = await apiGet('/api/config');
  check('GET /api/config returns 200', status === 200);
} catch (e) {
  check('GET /api/config reachable', false);
}

// Test 5: Resilience
try {
  const { status } = await apiGet('/api/resilience');
  check('GET /api/resilience returns 200', status === 200);
} catch (e) {
  check('GET /api/resilience reachable', false);
}

// Test 6: Tracing
try {
  const { status } = await apiGet('/api/tracing');
  check('GET /api/tracing returns 200', status === 200);
} catch (e) {
  check('GET /api/tracing reachable', false);
}

// Test 7: Plugins
try {
  const { status } = await apiGet('/api/plugins');
  check('GET /api/plugins returns 200', status === 200);
} catch (e) {
  check('GET /api/plugins reachable', false);
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`  Phase 2: Goal Submission & Execution`);
console.log(`${'─'.repeat(60)}\n`);

// Submit a challenging goal
const GOAL_TEXT = `Refactor the SimpleCache class in src/cache.js to add LRU eviction with a configurable max size. 
When the cache reaches its size limit, evict the least recently used entry. 
Also fix the bug where the size getter counts expired entries. 
Add a purgeExpired() method that removes all expired entries.
Write comprehensive tests in test/cache.test.js using node:test that cover:
- Basic set/get/delete operations
- TTL expiration behavior  
- LRU eviction when max size is reached
- The purgeExpired() method
- Edge cases (null values, duplicate keys, expired entry cleanup)`;

console.log(`[test] Submitting goal:\n  "${GOAL_TEXT.substring(0, 80)}..."\n`);

try {
  const { status, body } = await apiPost('/api/goals', { goal: GOAL_TEXT });
  check('POST /api/goals returns 202 (accepted)', status === 202);
  check('Response has goal text', !!body.goal);
  console.log(`  📋 Goal submitted: ${body.message || body.goal}`);
} catch (e) {
  check('POST /api/goals succeeds', false);
  console.error(`  Error: ${e.message}`);
}

// Monitor execution
console.log(`\n[test] Monitoring execution (polling every 10s, max 5 min)...\n`);

const MAX_WAIT = 480000; // 8 minutes
const POLL_INTERVAL = 10000;
const startTime = Date.now();
let goalCompleted = false;
let goalStatus = null;

while (Date.now() - startTime < MAX_WAIT) {
  try {
    const { body } = await apiGet('/api/goals');
    const goals = body.goals || [];
    
    if (goals.length > 0) {
      const latestGoal = goals[goals.length - 1];
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      
      console.log(`  [${elapsed}s] Goal ${latestGoal.id}: status=${latestGoal.status}, tasks=${latestGoal.completedTasks || 0}/${latestGoal.totalTasks || '?'}`);
      
      if (latestGoal.status === 'completed' || latestGoal.status === 'failed') {
        goalCompleted = true;
        goalStatus = latestGoal.status;
        
        // Get detailed status
        const { body: detail } = await apiGet(`/api/goals/${latestGoal.id}`);
        console.log(`\n  📊 Final Status: ${latestGoal.status}`);
        console.log(`  📊 Tasks: ${detail.tasks?.length || 0} total`);
        
        if (detail.tasks) {
          for (const t of detail.tasks) {
            console.log(`     - ${t.type}: ${t.status} (${t.title || t.description?.substring(0, 50) || 'unnamed'})`);
          }
        }
        
        // Check metrics
        const { body: metrics } = await apiGet('/api/metrics');
        console.log(`  📊 Metrics:`, JSON.stringify(metrics?.tasks || {}));
        
        // Check tracing
        const { body: tracing } = await apiGet('/api/tracing');
        console.log(`  📊 Traces: ${tracing.totalTraces || 0}, Spans: ${tracing.totalSpans || 0}`);
        
        break;
      }
    } else {
      console.log(`  [${((Date.now() - startTime) / 1000).toFixed(0)}s] No goals yet...`);
    }
  } catch (e) {
    console.log(`  [poll error] ${e.message}`);
  }
  
  await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
}

if (!goalCompleted) {
  console.log(`\n  ⏰ Timeout — goal still running after ${MAX_WAIT / 1000}s`);
  // Check current state
  try {
    const { body } = await apiGet('/api/goals');
    if (body.goals?.length > 0) {
      const g = body.goals[body.goals.length - 1];
      console.log(`  Current state: status=${g.status}, tasks=${g.completedTasks || 0}/${g.totalTasks || '?'}`);
    }
  } catch { /* best-effort cleanup */ }
}

// ---- Summary ----
console.log(`\n${'═'.repeat(60)}`);
console.log(`  E2E TEST SUMMARY`);
console.log(`${'═'.repeat(60)}`);
console.log(`  API Tests: ${passed} passed, ${failed} failed`);
console.log(`  Goal Execution: ${goalCompleted ? goalStatus : 'timeout'}`);
console.log(`  Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
console.log(`${'═'.repeat(60)}\n`);

// Cleanup
server.stop();
forge.close();
process.exit(failed > 0 ? 1 : 0);
