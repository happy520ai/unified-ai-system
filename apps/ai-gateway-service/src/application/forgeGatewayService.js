/**
 * Forge Gateway Service — bootstraps Forge within the AI Gateway process.
 * Connects the Forge autonomous coding engine to the gateway's HTTP server,
 * provider registry, and enterprise governance layer.
 */

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Forge,
  AgentPoolManager,
  KnowledgeBase,
  GoalTransfer,
  GatewayBridge,
  ForgeConfig,
  createForgeRouteHandlers,
} from "@unified-ai-system/forge-core";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Create the Forge gateway service.
 * @param {Object} options
 * @param {Object} options.env - Process environment
 * @param {string} [options.projectRoot] - Target project root (default: env.FORGE_PROJECT_ROOT or gateway service dir)
 * @param {number} [options.port] - Gateway HTTP port
 * @returns {Object|null} Forge service with { forge, agentPool, handlers, shutdown } or null if disabled
 */
export function createForgeGatewayService({ env = process.env, projectRoot, port = 3100 } = {}) {
  if (env.FORGE_ENABLED === "false") {
    return null;
  }

  const resolvedProjectRoot = projectRoot
    ?? env.FORGE_PROJECT_ROOT
    ?? resolve(__dirname, "../../../../");

  const gatewayUrl = `http://127.0.0.1:${port}`;
  const maxConcurrent = Number(env.FORGE_MAX_CONCURRENT) || 4;
  const maxGoals = Number(env.FORGE_MAX_GOALS) || 3;

  let forge;
  let agentPool;
  let handlers;

  try {
    forge = new Forge({
      projectRoot: resolvedProjectRoot,
      gatewayUrl,
      enableCostTracking: true,
    });

    agentPool = new AgentPoolManager({
      store: forge.store,
      projectRoot: resolvedProjectRoot,
      maxConcurrent,
      maxGoals,
      budget: {
        maxTokens: Number(env.FORGE_MAX_TOKENS) || 2_000_000,
        maxCost: Number(env.FORGE_MAX_COST) || 50,
        maxMinutes: Number(env.FORGE_MAX_MINUTES) || 120,
      },
      enableCodeIntel: env.FORGE_CODE_INTEL !== "false",
      enableVerification: true,
    });

    forge.attachPool(agentPool);

    const knowledge = new KnowledgeBase(forge.store);
    const transfer = new GoalTransfer(forge.store);
    const gateway = new GatewayBridge();
    const config = new ForgeConfig();

    handlers = createForgeRouteHandlers({
      forge,
      agentPool,
      knowledge,
      transfer,
      gateway,
      config,
    });
  } catch (error) {
    console.error("[forge-gateway] Bootstrap failed:", error?.message || error);
    return null;
  }

  async function shutdown() {
    try {
      if (agentPool) {
        await agentPool.shutdown({ timeoutMs: 15_000 });
      }
    } catch (error) {
      console.error("[forge-gateway] Pool shutdown error:", error?.message || error);
    }
    try {
      if (forge) forge.close();
    } catch (error) {
      console.error("[forge-gateway] Forge close error:", error?.message || error);
    }
  }

  return {
    forge,
    agentPool,
    handlers,
    projectRoot: resolvedProjectRoot,
    shutdown,
  };
}
