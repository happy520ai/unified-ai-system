import { describe, expect, it } from "vitest";
import {
  createFileReadTool,
  createFileWriteTool,
  validateFilePath,
} from "../claude-code-patterns/builtInCoreTools.js";
import { createGlobTool } from "../tools/globTool.js";
import { createGrepTool } from "../tools/grepTool.js";

describe("Agent runtime governance data isolation", () => {
  it("blocks direct read and write access to runtime .data state", async () => {
    expect((validateFilePath as any)(".data/agent-governance/secret.key", {
      workingDirectory: process.cwd(),
    })).toMatchObject({ safe: false });
    expect(await (createFileReadTool(process.cwd()) as any).execute({
      file_path: ".data/agent-governance/secret.key",
    })).toMatchObject({ status: "error" });
    expect(await (createFileWriteTool(process.cwd()) as any).execute({
      file_path: ".data/agent-governance/effective-policy.json",
      content: "{}",
    })).toMatchObject({ status: "error" });
  });

  it("blocks grep and glob from targeting runtime .data state", async () => {
    expect(await (createGrepTool() as any).execute({
      pattern: "secret",
      path: ".data/agent-governance",
      max_results: 1,
    })).toMatchObject({ status: "error", code: "SENSITIVE_RUNTIME_DATA_BLOCKED" });
    expect(await (createGlobTool() as any).execute({
      pattern: "**/*",
      path: ".data/agent-governance",
      max_results: 1,
    })).toMatchObject({ status: "error", code: "SENSITIVE_RUNTIME_DATA_BLOCKED" });
  });
});
