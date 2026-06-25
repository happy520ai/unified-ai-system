/**
 * 精确诊断: 逐层测试 HttpLLMProviderAdapter → agentic loop
 *
 * Layer 1: 直接用 adapter.generate() + 最小 tools
 * Layer 2: 直接用 adapter.generate() + registry tools (5个内置工具)
 * Layer 3: 完整 agentic loop (简单文件任务)
 */

import { HttpLLMProviderAdapter } from "../providers/httpLlmProviderAdapter.js";
import { createAgenticLoop } from "../agentic/agenticCodingLoop.js";
import { createAgentToolRegistry } from "../claude-code-patterns/agentToolRegistry.js";
import { convertRegistryToOpenAITools } from "../providers/toolCallingAdapter.js";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const API_KEY = process.env.NVIDIA_API_KEY;
const MODEL = process.env.NVIDIA_MODEL || "meta/llama-3.1-8b-instruct";
const BASE_URL = "https://integrate.api.nvidia.com/v1";

if (!API_KEY) {
  console.error("FATAL: NVIDIA_API_KEY not set");
  process.exit(1);
}

const workDir = join(tmpdir(), `adapter-diag-${Date.now()}`);
mkdirSync(workDir, { recursive: true });
writeFileSync(join(workDir, "hello.txt"), "Hello from adapter diag test!");

console.log(`[diag] Model: ${MODEL}`);
console.log(`[diag] Endpoint: ${BASE_URL}`);
console.log(`[diag] WorkDir: ${workDir}`);
console.log();

// ============================================================
// Layer 1: HttpLLMProviderAdapter + minimal tools
// ============================================================

console.log("=".repeat(60));
console.log("LAYER 1: Adapter.generate() with MINIMAL tools");
console.log("=".repeat(60));

const adapter = new HttpLLMProviderAdapter(
  {
    providerId: "nvidia",
    modelId: MODEL,
    endpoint: BASE_URL,
    enabled: true,
    dryRun: false,
    apiKey: API_KEY,
  },
  { timeoutMs: 30_000 }
);

console.log(`[L1] dryRun: ${adapter.isDryRun}`);

const minimalTools = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read a file from disk",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path" },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
];

const l1Request = {
  request: {
    messages: [
      { role: "system", content: "You are a helpful assistant with file access tools." },
      { role: "user", content: `Read the file at ${join(workDir, "hello.txt")}` },
    ],
    tools: minimalTools,
    toolChoice: "auto",
    options: { maxOutputTokens: 200 },
  },
  target: { providerId: "nvidia", modelId: MODEL },
};

console.log("[L1] Sending request with 1 tool...");
console.log("[L1] Tools count:", l1Request.request.tools.length);

try {
  const l1Response = await adapter.generate(l1Request);
  console.log("[L1] Response received!");
  console.log("[L1] text:", JSON.stringify(l1Response.text?.slice(0, 200)));
  console.log("[L1] raw.finishReason:", l1Response.raw?.finishReason);
  console.log("[L1] toolCalls:", JSON.stringify(l1Response.toolCalls));
  console.log("[L1] message.tool_calls:", JSON.stringify(l1Response.message?.tool_calls));
  console.log("[L1] usage:", JSON.stringify(l1Response.usage));
  console.log("[L1] executionStatus:", l1Response.executionStatus);

  // Check hasToolCalls
  const { hasToolCalls, extractToolCalls } = await import("../providers/toolCallingAdapter.js");
  console.log("[L1] hasToolCalls():", hasToolCalls(l1Response));

  if (hasToolCalls(l1Response)) {
    const tcs = extractToolCalls(l1Response);
    console.log("[L1] extractToolCalls():", JSON.stringify(tcs, null, 2));
  }
} catch (err) {
  console.log("[L1] ERROR:", err.message);
  console.log("[L1] error.code:", err.code);
  console.log("[L1] error.category:", err.category);
}

// ============================================================
// Layer 2: Adapter + registry tools (full tool set)
// ============================================================

console.log();
console.log("=".repeat(60));
console.log("LAYER 2: Adapter.generate() with REGISTRY tools");
console.log("=".repeat(60));

const registry = createAgentToolRegistry({ workingDirectory: workDir });
const allTools = registry.listTools();
const openaiTools = convertRegistryToOpenAITools(allTools);

console.log(`[L2] Registry tool count: ${allTools.length}`);
console.log(`[L2] OpenAI tools count: ${openaiTools.length}`);
console.log(`[L2] Tool names: ${allTools.map((t) => t.name).join(", ")}`);

// Log first tool's schema to check format
if (openaiTools.length > 0) {
  console.log("[L2] Sample tool (file_read):", JSON.stringify(openaiTools.find((t) => t.function.name === "file_read"), null, 2));
}

const l2Request = {
  request: {
    messages: [
      { role: "system", content: "You are a coding assistant with file tools. Use them when asked." },
      { role: "user", content: `Please read the file hello.txt in the working directory.` },
    ],
    tools: openaiTools,
    toolChoice: "auto",
    options: { maxOutputTokens: 500 },
  },
  target: { providerId: "nvidia", modelId: MODEL },
};

console.log(`[L2] Sending request with ${openaiTools.length} tools...`);

// Also log the approximate request size
const l2Json = JSON.stringify(l2Request);
console.log(`[L2] Request JSON size: ${l2Json.length} bytes`);

try {
  const l2Response = await adapter.generate(l2Request);
  console.log("[L2] Response received!");
  console.log("[L2] text:", JSON.stringify(l2Response.text?.slice(0, 300)));
  console.log("[L2] raw.finishReason:", l2Response.raw?.finishReason);
  console.log("[L2] toolCalls:", JSON.stringify(l2Response.toolCalls));
  console.log("[L2] message.tool_calls present:", Array.isArray(l2Response.message?.tool_calls));
  console.log("[L2] usage:", JSON.stringify(l2Response.usage));
  console.log("[L2] executionStatus:", l2Response.executionStatus);

  const { hasToolCalls: htc2 } = await import("../providers/toolCallingAdapter.js");
  console.log("[L2] hasToolCalls():", htc2(l2Response));
} catch (err) {
  console.log("[L2] ERROR:", err.message);
  console.log("[L2] error.code:", err.code);
  console.log("[L2] error.category:", err.category);
  if (err.details) {
    console.log("[L2] error.details:", JSON.stringify(err.details).slice(0, 500));
  }
}

// ============================================================
// Layer 3: Full agentic loop (simple file read task)
// ============================================================

console.log();
console.log("=".repeat(60));
console.log("LAYER 3: Full agentic loop");
console.log("=".repeat(60));

const loop = createAgenticLoop({
  providerAdapter: adapter,
  workingDirectory: workDir,
  maxIterations: 5,
  maxTokensPerTurn: 500,
});

const loopInfo = loop.getInfo();
console.log(`[L3] Tool count: ${loopInfo.toolCount}`);
console.log(`[L3] Max iterations: ${loopInfo.maxIterations}`);

console.log("[L3] Running agentic loop with goal: 'Read the file hello.txt and tell me what it says'");

try {
  const result = await loop.execute({
    goal: "Read the file hello.txt and tell me what it says",
    providerId: "nvidia",
    modelId: MODEL,
    onIteration: (iter, data) => {
      console.log(`[L3] Iteration ${iter}: ${data.type}`);
      if (data.type === "tool_calls_executed") {
        for (const tc of data.toolCalls) {
          console.log(`[L3]   tool_call: ${tc.name}(${JSON.stringify(tc.arguments)})`);
        }
        for (const tr of data.toolResults) {
          console.log(`[L3]   result: ${tr._meta?.toolName} → ${tr.content?.slice(0, 100)}...`);
        }
      }
    },
  });

  console.log(`[L3] Status: ${result.status}`);
  console.log(`[L3] Iterations: ${result.iterations}`);
  console.log(`[L3] Final answer: ${result.finalAnswer?.slice(0, 300)}`);
  console.log(`[L3] Usage: ${JSON.stringify(result.usage)}`);
  console.log(`[L3] Tool usage: ${JSON.stringify(result.toolUsage)}`);
  console.log(`[L3] Duration: ${result.durationMs}ms`);

  // Log trace
  for (const t of result.trace) {
    console.log(`[L3] Trace: ${t.type}${t.type === "error" ? " - " + t.message : ""}`);
  }
} catch (err) {
  console.log("[L3] EXCEPTION:", err.message);
  console.log("[L3] Stack:", err.stack?.slice(0, 500));
}

// Cleanup
try {
  rmSync(workDir, { recursive: true, force: true });
} catch (err) { console.error("[runAdapterDiag]:", err?.message || err); }

console.log("\n[diag] Done.");
