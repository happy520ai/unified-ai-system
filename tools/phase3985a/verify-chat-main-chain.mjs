import { existsSync, readFileSync } from "node:fs";

const resultPath = "apps/ai-gateway-service/evidence/phase3985a-chat-main-chain/result.json";

function verify() {
  if (!existsSync(resultPath)) {
    console.error("[FAIL] Chat main chain integration evidence not found.");
    console.error("Run `pnpm run:phase3985a-chat-main-chain` first.");
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(resultPath, "utf-8"));

  const checks = [
    ["integration_executed", data.phase === "Phase3985A-Chat-Main-Chain-Integration"],
    ["config_updated_or_not_found", data.updates.config.updated === true || data.updates.config.reason === "config_file_not_found"],
    ["default_chat_integrated", data.chatMainChainConfig.defaultChatIntegrated === true],
    ["chat_gateway_execute_integrated", data.chatMainChainConfig.chatGatewayExecuteIntegrated === true],
    ["streaming_enabled", data.chatMainChainConfig.streamingEnabled === true],
    ["rag_enabled", data.chatMainChainConfig.ragEnabled === true],
    ["knowledge_retrieval_enabled", data.chatMainChainConfig.knowledgeRetrievalEnabled === true],
    ["no_raw_secret", data.secretRead === false],
    ["no_deploy", data.deployExecuted === false],
  ];

  let allPassed = true;
  for (const [name, passed] of checks) {
    const status = passed ? "PASS" : "FAIL";
    console.log(`  ${status}: ${name}`);
    if (!passed) allPassed = false;
  }

  console.log("");
  console.log(`[RESULT] ${allPassed ? "PASS" : "FAIL"}`);
  console.log(`  Default Chat: ${data.chatMainChainConfig.defaultChatIntegrated ? "Integrated" : "Not integrated"}`);
  console.log(`  Chat Gateway Execute: ${data.chatMainChainConfig.chatGatewayExecuteIntegrated ? "Integrated" : "Not integrated"}`);
  console.log(`  Default Provider: ${data.chatMainChainConfig.defaultProvider}`);
  console.log(`  Default Model: ${data.chatMainChainConfig.defaultModel}`);
  console.log(`  Streaming: ${data.chatMainChainConfig.streamingEnabled ? "Enabled" : "Disabled"}`);
  console.log(`  RAG: ${data.chatMainChainConfig.ragEnabled ? "Enabled" : "Disabled"}`);

  process.exit(allPassed ? 0 : 1);
}

verify();
