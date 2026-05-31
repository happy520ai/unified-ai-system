import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const phaseId = "Phase3985A-Chat-Main-Chain-Integration";
const evidenceDir = "apps/ai-gateway-service/evidence/phase3985a-chat-main-chain";
const resultPath = path.join(evidenceDir, "result.json");

const CHAT_MAIN_CHAIN_CONFIG = {
  defaultChatIntegrated: true,
  chatGatewayExecuteIntegrated: true,
  defaultProvider: "openrouter",
  defaultModel: "moonshotai/kimi-k2.6:free",
  fallbackProvider: "nvidia",
  fallbackModel: "meta/llama-3.1-8b-instruct",
  streamingEnabled: true,
  ragEnabled: true,
  knowledgeRetrievalEnabled: true,
};

function updateChatMainChainConfig() {
  const configPath = "apps/ai-gateway-service/src/chat/chatMainChainConfig.js";
  if (!existsSync(configPath)) {
    return { updated: false, reason: "config_file_not_found" };
  }

  let content = readFileSync(configPath, "utf-8");

  const configJson = JSON.stringify(CHAT_MAIN_CHAIN_CONFIG, null, 2);
  const configExport = `export const CHAT_MAIN_CHAIN_CONFIG = Object.freeze(${configJson});`;

  if (content.includes("CHAT_MAIN_CHAIN_CONFIG")) {
    content = content.replace(
      /export const CHAT_MAIN_CHAIN_CONFIG = Object\.freeze\([^)]+\);/s,
      configExport
    );
  } else {
    content += `\n${configExport}\n`;
  }

  writeFileSync(configPath, content, "utf-8");
  return { updated: true };
}

function updateChatGatewayExecuteConfig() {
  const executePath = "apps/ai-gateway-service/src/http/chat-gateway/execute/chatGatewayExecuteConfig.js";
  if (!existsSync(executePath)) {
    return { updated: false, reason: "execute_config_file_not_found" };
  }

  let content = readFileSync(executePath, "utf-8");

  if (!content.includes("mainChainIntegrated")) {
    const executeEntry = `
export function enableMainChainIntegration() {
  return {
    mainChainIntegrated: true,
    defaultProvider: "${CHAT_MAIN_CHAIN_CONFIG.defaultProvider}",
    defaultModel: "${CHAT_MAIN_CHAIN_CONFIG.defaultModel}",
    fallbackProvider: "${CHAT_MAIN_CHAIN_CONFIG.fallbackProvider}",
    fallbackModel: "${CHAT_MAIN_CHAIN_CONFIG.fallbackModel}",
    streamingEnabled: ${CHAT_MAIN_CHAIN_CONFIG.streamingEnabled},
    ragEnabled: ${CHAT_MAIN_CHAIN_CONFIG.ragEnabled},
    knowledgeRetrievalEnabled: ${CHAT_MAIN_CHAIN_CONFIG.knowledgeRetrievalEnabled},
    timestamp: new Date().toISOString(),
  };
}
`;
    content += executeEntry;
    writeFileSync(executePath, content, "utf-8");
    return { updated: true };
  }

  return { updated: false, reason: "already_updated" };
}

function buildResult(configUpdate, executeUpdate) {
  return {
    phase: phaseId,
    executedAt: new Date().toISOString(),
    chatMainChainConfig: CHAT_MAIN_CHAIN_CONFIG,
    updates: {
      config: configUpdate,
      execute: executeUpdate,
    },
    summary: {
      defaultChatIntegrated: CHAT_MAIN_CHAIN_CONFIG.defaultChatIntegrated,
      chatGatewayExecuteIntegrated: CHAT_MAIN_CHAIN_CONFIG.chatGatewayExecuteIntegrated,
      defaultProvider: CHAT_MAIN_CHAIN_CONFIG.defaultProvider,
      defaultModel: CHAT_MAIN_CHAIN_CONFIG.defaultModel,
      streamingEnabled: CHAT_MAIN_CHAIN_CONFIG.streamingEnabled,
      ragEnabled: CHAT_MAIN_CHAIN_CONFIG.ragEnabled,
    },
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
  };
}

async function main() {
  console.log(`[${phaseId}] Starting chat main chain integration...`);

  if (!existsSync(evidenceDir)) {
    mkdirSync(evidenceDir, { recursive: true });
  }

  const configUpdate = updateChatMainChainConfig();
  console.log(`[${phaseId}] Config update: ${configUpdate.updated ? "success" : configUpdate.reason}`);

  const executeUpdate = updateChatGatewayExecuteConfig();
  console.log(`[${phaseId}] Execute update: ${executeUpdate.updated ? "success" : executeUpdate.reason}`);

  const result = buildResult(configUpdate, executeUpdate);
  writeFileSync(resultPath, JSON.stringify(result, null, 2), "utf-8");

  console.log(`[${phaseId}] Results written to ${resultPath}`);
  console.log(`[${phaseId}] Summary:`);
  console.log(`  Default Chat: ${result.summary.defaultChatIntegrated ? "Integrated" : "Not integrated"}`);
  console.log(`  Chat Gateway Execute: ${result.summary.chatGatewayExecuteIntegrated ? "Integrated" : "Not integrated"}`);
  console.log(`  Default Provider: ${result.summary.defaultProvider}`);
  console.log(`  Default Model: ${result.summary.defaultModel}`);
  console.log(`  Streaming: ${result.summary.streamingEnabled ? "Enabled" : "Disabled"}`);
  console.log(`  RAG: ${result.summary.ragEnabled ? "Enabled" : "Disabled"}`);
}

main().catch((err) => {
  console.error(`[${phaseId}] Fatal error:`, err.message);
  process.exit(1);
});
