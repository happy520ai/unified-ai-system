import { sha256Hex } from "./hash.js";

export function createToolRegistry() {
  const registry = {
    tools: [],
    ledger: [],
    registerTool(tool) {
      const entry = {
        toolName: String(tool.toolName || ""),
        riskLevel: String(tool.riskLevel || "L1"),
        approvalStatus: String(tool.approvalStatus || "approval_required"),
        description: String(tool.description || ""),
      };
      this.tools.push(entry);
      return entry;
    },
  };
  return registry;
}

export function recordToolResult(registry, input) {
  const sanitizedInput = sanitizeForHash(input.input || {});
  const entry = {
    toolName: String(input.toolName || ""),
    inputHash: sha256Hex(sanitizedInput),
    riskLevel: String(input.riskLevel || "L1"),
    approvalStatus: String(input.approvalStatus || "approval_required"),
    resultSummary: String(input.resultSummary || "").slice(0, 500),
    evidencePath: String(input.evidencePath || ""),
    rawSecretStored: false,
    fullProviderResponseStored: false,
    providerCallsMade: false,
    secretRead: false,
  };
  registry.ledger.push(entry);
  return entry;
}

function sanitizeForHash(value) {
  if (Array.isArray(value)) return value.map(sanitizeForHash);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !/secret|token|api[_-]?key|authorization|raw/i.test(key))
        .map(([key, child]) => [key, sanitizeForHash(child)]),
    );
  }
  return value;
}
