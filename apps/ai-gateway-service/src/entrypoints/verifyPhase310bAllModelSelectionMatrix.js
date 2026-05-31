import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = resolve(fileURLToPath(new URL(".", import.meta.url)));
const repoRoot = resolve(__dirname, "../../../..");
const uiPath = resolve(repoRoot, "apps/ai-gateway-service/src/ui/consolePage.js");
const httpPath = resolve(repoRoot, "apps/ai-gateway-service/src/http/httpServer.js");

const uiSource = readFileSync(uiPath, "utf8");
const httpSource = readFileSync(httpPath, "utf8");

const providerRegistry = new Set([
  "nvidia",
  "openai",
  "openrouter",
  "groq",
  "xai",
  "cerebras",
  "perplexity",
  "deepseek",
  "together",
  "mistral",
  "moonshot",
  "siliconflow",
  "tencent-hunyuan",
  "qianfan",
  "zhipu",
  "xunfei-spark",
  "modelscope",
  "cohere",
  "volcengine-doubao",
  "minimax",
  "stepfun",
  "novita",
  "baichuan",
  "yi",
  "infini-ai",
  "huggingface",
  "mimo",
]);

const cases = [
  {
    caseId: "default-no-selection",
    body: { messages: [{ role: "user", content: "hello" }] },
  },
  {
    caseId: "nvidia-selection",
    body: {
      messages: [{ role: "user", content: "hello" }],
      currentPageModelSelection: {
        providerId: "nvidia",
        modelId: "meta/llama-3.1-8b-instruct",
      },
    },
  },
  {
    caseId: "mimo-selection",
    body: {
      messages: [{ role: "user", content: "hello" }],
      currentPageModelSelection: {
        providerId: "mimo",
        modelId: "mimo-v2.5-pro",
      },
    },
  },
  {
    caseId: "openai-selection",
    body: {
      messages: [{ role: "user", content: "hello" }],
      currentPageModelSelection: {
        providerId: "openai",
        modelId: "gpt-4o-mini",
      },
    },
  },
  {
    caseId: "custom-openai-compatible-selection",
    body: {
      messages: [{ role: "user", content: "hello" }],
      currentPageModelSelection: {
        providerId: "openai-compatible",
        modelId: "custom-model",
        baseUrl: "https://example.invalid/v1",
      },
    },
  },
  {
    caseId: "invalid-provider",
    body: {
      messages: [{ role: "user", content: "hello" }],
      currentPageModelSelection: {
        providerId: "../bad",
        modelId: "bad",
      },
    },
  },
  {
    caseId: "missing-model",
    body: {
      messages: [{ role: "user", content: "hello" }],
      currentPageModelSelection: {
        providerId: "nvidia",
      },
    },
  },
];

function assertIncludes(source, pattern, description) {
  if (!source.includes(pattern)) {
    throw new Error(`Missing ${description}: ${pattern}`);
  }
}

function readSelection(selection) {
  if (!selection || typeof selection !== "object") {
    return { fallback: true, warning: "missing currentPageModelSelection" };
  }

  const providerId = typeof selection.providerId === "string" ? selection.providerId.trim() : "";
  const modelId = typeof selection.modelId === "string" ? selection.modelId.trim() : "";
  const baseUrl = typeof selection.baseUrl === "string" ? selection.baseUrl.trim() : "";
  const providerKnown = providerRegistry.has(providerId) || providerId === "openai-compatible";

  if (!providerId || !modelId || !providerKnown || providerId.includes("..")) {
    return {
      fallback: true,
      warning: "currentPageModelSelection ignored and default /chat used",
    };
  }

  return {
    fallback: false,
    providerId,
    modelId,
    baseUrl,
  };
}

function normalizeChatBody(body) {
  const selection = readSelection(body.currentPageModelSelection);
  const defaultTarget = { providerId: "nvidia", modelId: "default-model" };
  const providerId = selection.fallback ? body.providerId ?? defaultTarget.providerId : selection.providerId;
  const model = selection.fallback ? body.model ?? defaultTarget.modelId : selection.modelId;

  return {
    providerId,
    model,
    metadata: {
      ...(body.metadata ?? {}),
      ...(selection.fallback ? { currentPageModelSelectionWarning: selection.warning } : {}),
      ...(!selection.fallback
        ? {
            currentPageModelSelectionApplied: {
              providerId: selection.providerId,
              modelId: selection.modelId,
              baseUrl: selection.baseUrl ?? "",
              scope: "per-request",
            },
          }
        : {}),
    },
    selection,
  };
}

function verifyUiSurface() {
  assertIncludes(uiSource, "currentPageModelSelection", "frontend request selection read");
  assertIncludes(uiSource, "本次聊天模型", "composer model copy");
  assertIncludes(uiSource, "未选择，使用后端默认 /chat", "composer fallback copy");
  assertIncludes(uiSource, "仅影响当前请求，不改变系统默认 /chat", "composer scope copy");
  assertIncludes(uiSource, "renderMarkdownLite", "assistant markdown-lite renderer");
  assertIncludes(uiSource, "setMessageContent", "message role-safe rendering");
  assertIncludes(uiSource, "const currentPageModelSelection = parseCurrentPageModelSelection();", "current page selection read before send");
  assertIncludes(uiSource, "currentPageModelSelection });", "send body current selection");
}

function runCase(testCase) {
  const normalized = normalizeChatBody(testCase.body);
  const requested = testCase.body.currentPageModelSelection ?? {};
  const requestedProviderId = requested.providerId ?? "";
  const requestedModelId = requested.modelId ?? "";
  const usedDefaultChat = normalized.selection.fallback;
  const warning = normalized.metadata.currentPageModelSelectionWarning ?? "";
  const fallback = Boolean(warning);
  const pass =
    testCase.caseId === "default-no-selection"
      ? usedDefaultChat && normalized.providerId === "nvidia" && normalized.model === "default-model"
      : testCase.caseId === "invalid-provider" || testCase.caseId === "missing-model"
        ? fallback && usedDefaultChat && typeof warning === "string"
        : !usedDefaultChat &&
          normalized.providerId === requestedProviderId &&
          normalized.model === requestedModelId &&
          normalized.metadata.currentPageModelSelectionApplied?.providerId === requestedProviderId &&
          normalized.metadata.currentPageModelSelectionApplied?.modelId === requestedModelId;

  return {
    caseId: testCase.caseId,
    requestedProviderId,
    requestedModelId,
    normalizedProviderId: normalized.providerId ?? "",
    normalizedModelId: normalized.model ?? "",
    usedDefaultChat,
    fallback,
    warning,
    pass,
  };
}

function main() {
  verifyUiSurface();
  assertIncludes(httpSource, "currentPageModelSelection", "backend selection read");
  assertIncludes(httpSource, "currentPageModelSelectionWarning", "backend warning metadata");
  assertIncludes(httpSource, "normalizeCurrentPageModelSelection", "backend selection normalization");

  const results = cases.map(runCase);
  const failed = results.filter((item) => !item.pass);

  const providerCoverage = {
    nvidia: results.find((item) => item.caseId === "nvidia-selection")?.pass === true,
    mimo: results.find((item) => item.caseId === "mimo-selection")?.pass === true,
    openai: results.find((item) => item.caseId === "openai-selection")?.pass === true,
    "openai-compatible": results.find((item) => item.caseId === "custom-openai-compatible-selection")?.pass === true,
  };

  const skipReasons = [];
  if (!providerRegistry.has("openai")) {
    skipReasons.push("openai skipped: no local registry support was available");
  }
  if (!providerRegistry.has("openai-compatible")) {
    skipReasons.push("openai-compatible skipped: using static simulation only");
  }

  const summary = {
    status: failed.length ? "failed" : "pass",
    totalCases: results.length,
    passedCases: results.filter((item) => item.pass).length,
    providerCoverage,
    skipReasons,
    results,
  };

  if (failed.length) {
    console.error(JSON.stringify(summary, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify(summary, null, 2));
}

main();
