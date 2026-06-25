#!/usr/bin/env node
/**
 * load-provider-keys.mjs — 从 providers-config.json 加载 API Key 到环境变量
 * 用法: source <(node tools/load-provider-keys.mjs)
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = resolve(__dirname, "..", "providers-config.json");

try {
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const envMap = {
    "openai": "OPENAI_API_KEY",
    "nvidia": "NVIDIA_API_KEY",
    "zhipu": "ZHIPU_API_KEY",
    "siliconflow": "SILICONFLOW_API_KEY",
    "xiaomi": "XIAOMI_API_KEY",
    "groq": "GROQ_API_KEY",
    "google": "GOOGLE_API_KEY",
    "deepseek": "DEEPSEEK_API_KEY",
    "moonshot": "MOONSHOT_API_KEY",
    "baichuan": "BAICHUAN_API_KEY",
    "qianfan": "QIANFAN_API_KEY",
    "tencent": "TENCENT_API_KEY",
    "alibaba": "ALIBABA_API_KEY",
    "modelscope": "MODELSCOPE_API_KEY",
    "openrouter": "OPENROUTER_API_KEY",
    "cloudflare": "CLOUDFLARE_API_KEY",
    "agnes": "AGNES_API_KEY",
    "bloom": "BLOOM_API_KEY",
    "volcengine": "VOLCENGINE_API_KEY",
    "minimax": "MINIMAX_API_KEY",
    "stepfun": "STEPFUN_API_KEY",
    "iflytek": "IFLYTEK_API_KEY",
    "zeroone": "YI_API_KEY",
    "publicwelfare": "PUBLICWELFARE_API_KEY",
  };

  const lines = [];
  for (const provider of config.providers) {
    const envKey = envMap[provider.id];
    if (envKey && provider.apiKey) {
      lines.push(`export ${envKey}="${provider.apiKey}"`);
    }
  }

  console.log(lines.join("\n"));
} catch (err) {
  console.error(`Error loading providers-config.json: ${err.message}`);
  process.exit(1);
}
