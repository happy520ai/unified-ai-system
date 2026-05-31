export const CHINESE_MODEL_ECOSYSTEM_FAMILIES = Object.freeze([
  "qwen",
  "deepseek",
  "moonshot-kimi",
  "zhipu-glm",
  "baidu-qianfan",
  "tencent-hunyuan",
  "minimax",
  "baichuan",
  "yi-01ai",
  "mimo",
  "siliconflow",
  "modelscope",
  "volcano-ark",
]);

export const CHINESE_MODEL_SEED_NAMES = Object.freeze({
  qwen: ["qwen3-max", "qwen3-plus", "qwen3-coder", "qwen2.5-72b-instruct", "qwen2.5-coder-32b-instruct", "qwq-32b"],
  deepseek: ["deepseek-chat", "deepseek-reasoner", "deepseek-v3.1", "deepseek-v3.2", "deepseek-r1", "deepseek-coder"],
  "moonshot-kimi": ["kimi-k2", "kimi-k2-thinking", "moonshot-v1-128k", "moonshot-v1-32k", "kimi-latest"],
  "zhipu-glm": ["glm-4.5", "glm-4-plus", "glm-4-air", "glm-4-flash", "glm-z1"],
  "baidu-qianfan": ["ernie-4.5", "ernie-x1", "ernie-4.0-turbo", "ernie-speed", "ernie-lite"],
  "tencent-hunyuan": ["hunyuan-turbos", "hunyuan-large", "hunyuan-standard", "hunyuan-lite", "hunyuan-code"],
  minimax: ["abab6.5s-chat", "abab6.5g-chat", "minimax-m1", "minimax-text-01", "minimax-m2.7"],
  baichuan: ["baichuan4", "baichuan3-turbo", "baichuan2-13b-chat", "baichuan2-7b-chat"],
  "yi-01ai": ["yi-large", "yi-medium", "yi-spark", "yi-lightning", "yi-vision"],
  mimo: ["mimo-chat-preview", "mimo-reasoner-preview", "mimo-coder-preview"],
  siliconflow: ["siliconflow-hosted-qwen", "siliconflow-hosted-deepseek", "siliconflow-hosted-kimi"],
  modelscope: ["modelscope-hosted-qwen", "modelscope-hosted-baichuan", "modelscope-hosted-yi"],
  "volcano-ark": ["doubao-pro", "doubao-lite", "volcano-ark-deepseek", "volcano-ark-seed"],
});

export function buildChineseModelEcosystemCatalogPack() {
  return {
    phase: "Phase773",
    name: "Chinese Model Ecosystem Catalog Pack",
    providerFamiliesCovered: CHINESE_MODEL_ECOSYSTEM_FAMILIES,
    familyCount: CHINESE_MODEL_ECOSYSTEM_FAMILIES.length,
    modelNameCount: Object.values(CHINESE_MODEL_SEED_NAMES).flat().length,
    runtimeEnabled: false,
    providerCallsMade: false,
    secretRead: false,
    selectableModified: false,
  };
}
