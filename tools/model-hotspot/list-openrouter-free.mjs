import { existsSync, readFileSync } from "node:fs";

const evidencePath = "apps/ai-gateway-service/evidence/model-hotspot/free-model-hotspot.json";
const openrouterKey = process.env.OPENROUTER_API_KEY;

if (!openrouterKey) {
  console.error("[ERROR] OPENROUTER_API_KEY environment variable not set.");
  console.error("Set it with: $env:OPENROUTER_API_KEY='your-key-here'");
  process.exit(1);
}

if (!existsSync(evidencePath)) {
  console.error("[ERROR] Hotspot data not found. Run `pnpm run:model-hotspot-fetch` first.");
  process.exit(1);
}

const hotspot = JSON.parse(readFileSync(evidencePath, "utf-8"));
const openrouterModels = hotspot.models.filter(m => m.sourceId === "openrouter-free");

console.log("[OpenRouter Free Models]");
console.log(`Total: ${openrouterModels.length} free models`);
console.log("");
console.log("Top Chat Models:");
openrouterModels
  .filter(m => m.capabilities.chat)
  .slice(0, 10)
  .forEach((m, i) => console.log(`  ${i + 1}. ${m.modelId}`));

console.log("");
console.log("Top Chinese Models:");
openrouterModels
  .filter(m => m.capabilities.chineseOptimized)
  .slice(0, 5)
  .forEach((m, i) => console.log(`  ${i + 1}. ${m.modelId}`));

console.log("");
console.log("[Configuration]");
console.log("To use OpenRouter, set these environment variables:");
console.log(`  $env:OPENROUTER_API_KEY="${openrouterKey.substring(0, 8)}..."`);
console.log(`  $env:OPENROUTER_BASE_URL="https://openrouter.ai/api/v1"`);
console.log("");
console.log("Then start the service with:");
console.log(`  $env:AI_GATEWAY_DEFAULT_PROVIDER="openrouter"`);
console.log(`  $env:AI_GATEWAY_ENABLED_PROVIDERS="openrouter"`);
console.log(`  pnpm dev:phase7b`);
