// Diagnostic: test Forge bootstrap from the same directory as forgeGatewayService.js
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Simulate being in src/application/ by going up one level from tools/
const serviceDir = resolve(__dirname, "../src/application");
console.log("Service dir (simulated):", serviceDir);
const projectRoot = resolve(serviceDir, "../../../../");
console.log("Project root:", projectRoot);

process.env.FORGE_ENABLED = "true";
process.env.FORGE_LLM_PROVIDER = "nvidia";

const forgeIndexPath = resolve(projectRoot, "packages/forge-core/src/index.js");
console.log("Forge index path:", forgeIndexPath);

// Check if the file exists
import { existsSync } from "node:fs";
console.log("File exists:", existsSync(forgeIndexPath));

// Try importing from the service's perspective
console.log("\nStep 1: Import from src/application/ perspective...");
try {
  // The import path used in forgeGatewayService.js: ../../../../packages/forge-core/src/index.js
  // From src/application/ that goes: application -> src -> ai-gateway-service -> apps -> unified-ai-system
  // Then packages/forge-core/src/index.js = unified-ai-system/packages/forge-core/src/index.js
  const forgeModule = await import("../../../../packages/forge-core/src/index.js");
  console.log("  OK - Module keys:", Object.keys(forgeModule).slice(0, 10).join(", "), "...");
} catch (e) {
  console.log("  FAIL:", e.message);
}

// Now try the actual diagnostic
console.log("\nStep 2: Try direct import from project root...");
try {
  const { Forge } = await import("../../../../packages/forge-core/src/index.js");
  console.log("  OK - Forge constructor available:", typeof Forge);

  console.log("\nStep 3: Create Forge instance...");
  const forge = new Forge({ projectRoot, gatewayUrl: "http://127.0.0.1:3100", enableCostTracking: true });
  console.log("  OK - Forge created, store:", forge.store ? "present" : "null");

  console.log("\nStep 4: Create AgentPoolManager...");
  const { AgentPoolManager } = await import("../../../../packages/forge-core/src/agent-pool/index.js");
  const agentPool = new AgentPoolManager({
    store: forge.store,
    projectRoot,
    maxConcurrent: 2,
    maxGoals: 1,
    budget: { maxTokens: 500000, maxCost: 10, maxMinutes: 30 },
  });
  console.log("  OK - Pool created");

  forge.attachPool(agentPool);
  console.log("  OK - Pool attached");

  const { KnowledgeBase } = await import("../../../../packages/forge-core/src/knowledge/index.js");
  const { GoalTransfer } = await import("../../../../packages/forge-core/src/export-import/index.js");
  const { GatewayBridge } = await import("../../../../packages/forge-core/src/gateway-bridge/index.js");
  const { ForgeConfig } = await import("../../../../packages/forge-core/src/config/index.js");
  const { createForgeRouteHandlers } = await import("../../../../packages/forge-core/src/integration/forge-routes.js");

  const handlers = createForgeRouteHandlers({
    forge, agentPool,
    knowledge: new KnowledgeBase(forge.store),
    transfer: new GoalTransfer(forge.store),
    gateway: new GatewayBridge(),
    config: new ForgeConfig(),
  });
  console.log("  OK - Handlers created:", Object.keys(handlers).length);

  console.log("\nBOOTSTRAP FULL SUCCESS");
  forge.close();
} catch (e) {
  console.log("  FAIL:", e.message);
  if (e.stack) console.log(e.stack.split("\n").slice(0, 8).join("\n"));
}

process.exit(0);
