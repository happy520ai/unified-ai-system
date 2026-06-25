#!/usr/bin/env node
/**
 * Forge Server Launcher — boots the full Forge stack with API Server + Web Console.
 */

import { resolve } from 'node:path';
import { Forge, AgentPoolManager, GoalTransfer, KnowledgeBase, GatewayBridge, UserManager, ForgeServer } from './src/index.js';

const projectRoot = resolve(
  process.env.FORGE_PROJECT_ROOT ||
  'E:\\AI-Data\\AI\u7F51\u5173\u7CFB\u7EDF\\unified-ai-system\\packages\\forge-core\\test-project-v2'
);
const port = parseInt(process.env.FORGE_API_PORT) || 4500;

// Ensure LLM API keys are set
if (!process.env.MIMO_API_KEY) {
  console.warn('[forge] Warning: MIMO_API_KEY not set. Please set it in your environment.');
  process.exit(1);
}

console.log(`\n[forge] Project: ${projectRoot}`);
console.log(`[forge] Starting server on port ${port}...\n`);

// 1. Forge core (TaskStore + Goal Compiler + Orchestrator)
const forge = new Forge({ projectRoot });

// 2. Phase 4 modules + Phase 5 pool configuration
const userMgr = new UserManager(forge.store.db);
const agentPool = new AgentPoolManager({
  store: forge.store,
  projectRoot,
  maxConcurrent: parseInt(process.env.FORGE_MAX_CONCURRENT) || 4,
  maxGoals: parseInt(process.env.FORGE_MAX_GOALS) || 3,
  budget: {
    maxTokens: parseInt(process.env.FORGE_MAX_TOKENS) || 2_000_000,
    maxCost: parseFloat(process.env.FORGE_MAX_COST) || 50,
    maxMinutes: parseInt(process.env.FORGE_MAX_MINUTES) || 120,
  },
  enableCodeIntel: process.env.FORGE_CODE_INTEL !== 'false',
  enableVerification: true,
});
const knowledge = new KnowledgeBase(forge.store);
const transfer = new GoalTransfer(forge.store);
const gateway = new GatewayBridge();

// Attach pool to Forge for multi-goal pool-based execution
forge.attachPool(agentPool);
console.log(`[forge] Pool attached: maxConcurrent=${agentPool.getStatus().maxConcurrent}, maxGoals=${agentPool.getStatus().maxGoals}`);

// Create a default admin user if no users exist
const users = userMgr.listUsers();
if (users.length === 0) {
  const admin = userMgr.createUser({ username: 'admin', displayName: 'Admin', role: 'admin' });
  console.log(`[forge] Created default admin user — API Key: ${admin.api_key}`);
}

// 3. Start API Server
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

// 4. Recover interrupted goals from previous session
setTimeout(async () => {
  try {
    const recovered = await forge.recoverGoals();
    if (recovered.length > 0) {
      console.log(`[forge] Recovered ${recovered.length} interrupted goal(s): ${recovered.join(', ')}`);
    }
  } catch (err) {
    console.error(`[forge] Goal recovery failed: ${err.message}`);
  }
}, 2000); // Wait 2s for server to fully start

// Graceful shutdown — preserves interrupted goals for recovery
process.on('SIGINT', async () => {
  console.log('\n[forge] Shutting down...');
  await agentPool.shutdown({ timeoutMs: 15_000 });
  server.stop();
  forge.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await agentPool.shutdown({ timeoutMs: 15_000 });
  server.stop();
  forge.close();
  process.exit(0);
});
