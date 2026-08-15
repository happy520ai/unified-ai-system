import { describe, expect, it } from "vitest";
import { createGrepTool } from "./grepTool.js";
// Security regression: user-supplied patterns with catastrophic-backtracking
// shapes must be rejected before any file is scanned.
describe("grep tool regex safety", () => {
  const tool = createGrepTool();

  it("rejects nested-quantifier and quantified-alternation patterns", async () => {
    const searchPath = "apps/ai-gateway-service/src/tools";
    for (const pattern of ["(a+)+$", "(a|a)*$", "(.*)*$"]) {
      const result = await tool.execute({ pattern, path: searchPath, max_results: 5 });
      expect(result.status).toBe("error");
      expect(result.code).toBe("UNSAFE_REGEX");
    }
    const ok = await tool.execute({ pattern: "^import", path: searchPath, max_results: 5 });
    expect(ok.status).not.toBe("error");
  });

  it("rejects oversized patterns", async () => {
    const result = await tool.execute({ pattern: "a".repeat(300), path: ".", max_results: 1 });
    expect(result.status).toBe("error");
    expect(result.code).toBe("UNSAFE_REGEX");
  });
});
