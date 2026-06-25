import { createAgentToolRegistry } from "../claude-code-patterns/agentToolRegistry.js";
import { writeFileSync } from "node:fs";

const API_KEY = process.env.NVIDIA_API_KEY ?? "";
const BASE_URL = "https://token-plan-cn.xiaomimimo.com/v1";

// 1. Create registry with workingDirectory
const registry = createAgentToolRegistry({ workingDirectory: process.cwd() });

// 2. List tools
const tools = registry.listTools();
const output = [];
output.push(`Registered tools: ${tools.length}`);
for (const t of tools) {
  output.push(`  - ${t.name} (${t.source || "unknown"})`);
}

// 3. Convert to OpenAI format
function convertRegistryToOpenAITools(tools) {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description || "",
      parameters: t.inputSchema || { type: "object", properties: {} },
    },
  }));
}

const openaiTools = convertRegistryToOpenAITools(tools);
output.push(`\nOpenAI tools count: ${openaiTools.length}`);
output.push(`First tool: ${JSON.stringify(openaiTools[0], null, 2).slice(0, 200)}`);

// 4. Make a direct API call with tools
const messages = [
  { role: "system", content: "You are a helpful coding assistant with file tools." },
  { role: "user", content: "Read the file called test.txt in the current directory" },
];

const body = {
  model: "mimo-v2.5-pro",
  messages,
  tools: openaiTools,
  tool_choice: "auto",
  max_completion_tokens: 4096,
  thinking: { type: "disabled" },
};

output.push(`\nRequest body tools count: ${body.tools.length}`);
output.push(`Request body model: ${body.model}`);

try {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  output.push(`\nResponse status: ${response.status}`);
  
  if (data.error) {
    output.push(`Error: ${JSON.stringify(data.error)}`);
  } else {
    const choice = data.choices?.[0];
    output.push(`Finish reason: ${choice?.finish_reason}`);
    output.push(`Message role: ${choice?.message?.role}`);
    output.push(`Has tool_calls: ${!!choice?.message?.tool_calls}`);
    if (choice?.message?.tool_calls) {
      output.push(`Tool calls count: ${choice.message.tool_calls.length}`);
      output.push(`First tool call: ${JSON.stringify(choice.message.tool_calls[0], null, 2)}`);
    }
    output.push(`Content (first 200): ${(choice?.message?.content || "").slice(0, 200)}`);
    output.push(`Usage: ${JSON.stringify(data.usage)}`);
  }
} catch (err) {
  output.push(`Fetch error: ${err.message}`);
}

writeFileSync("C:/Users/Administrator/.qoderworkcn/workspace/mq5dbzk0dmve4xk4/tool_diag.txt", output.join("\n"), "utf-8");
console.log("Done. Output in tool_diag.txt");
