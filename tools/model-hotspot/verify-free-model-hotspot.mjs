import { existsSync, readFileSync } from "node:fs";

const evidencePath = "apps/ai-gateway-service/evidence/model-hotspot/free-model-hotspot.json";

function verify() {
  if (!existsSync(evidencePath)) {
    console.error("[FAIL] Hotspot evidence not found. Run `pnpm run:model-hotspot-fetch` first.");
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(evidencePath, "utf-8"));

  const checks = [
    ["hotspot_fetched", data.phase === "FreeModelHotspotTracker"],
    ["has_free_models", data.summary.totalDeduped > 0],
    ["has_chat_models", data.summary.chatCapable > 0],
    ["has_chinese_models", data.summary.chineseOptimized > 0],
    ["has_top_chat_list", Array.isArray(data.topChatModels) && data.topChatModels.length > 0],
    ["has_top_chinese_list", Array.isArray(data.topChineseModels) && data.topChineseModels.length > 0],
    ["has_provider_mapping", typeof data.providerFamilyMapping === "object"],
    ["no_secrets_leaked", data.safety.secretRead === false],
    ["no_provider_calls", data.safety.providerCallsMade === false],
  ];

  let allPassed = true;
  for (const [name, passed] of checks) {
    const status = passed ? "PASS" : "FAIL";
    console.log(`  ${status}: ${name}`);
    if (!passed) allPassed = false;
  }

  console.log("");
  console.log(`[RESULT] ${allPassed ? "PASS" : "FAIL"}`);
  console.log(`  Free models: ${data.summary.totalDeduped}`);
  console.log(`  Chat capable: ${data.summary.chatCapable}`);
  console.log(`  Chinese optimized: ${data.summary.chineseOptimized}`);
  console.log(`  Sources: ${data.sourceResults.map(s => `${s.sourceName}(${s.status})`).join(", ")}`);

  process.exit(allPassed ? 0 : 1);
}

verify();
