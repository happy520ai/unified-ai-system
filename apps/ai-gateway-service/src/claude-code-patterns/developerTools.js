/**
 * developerTools.js — Phase D developer workflow tools and built-in tools aggregator.
 *
 * Split from agentToolRegistry.js for 分层律 compliance.
 */

import { buildTool, createInputSchema } from "./toolCore.js";
import { createFileEditTool, createFileInsertTool } from "../tools/fileEditTool.js";
import { createGlobTool } from "../tools/globTool.js";
import { createGrepTool } from "../tools/grepTool.js";
import { createImageAnalysisTool, createImageReadTool } from "../tools/imageAnalysisTool.js";
import { createWebSearchTool } from "../tools/webSearchTool.js";
import { createGitTools } from "../tools/gitTools.js";
import { createLspTools } from "../tools/lspTool.js";
import { createFileReadTool, createFileWriteTool, createShellExecTool } from "./builtInCoreTools.js";
import { webFetchTool, codeRunTool } from "./sandboxTools.js";
import { createSemanticSearchTool, createAstEditTool } from "./codeIntelligenceTools.js";

// ============================================================
// Phase D 新增工具 — code_format / generate_test / type_check
// ============================================================

export function createCodeFormatTool(workingDirectory = process.cwd()) {
  return buildTool({
    name: "code_format",
    description: "Format code in a file. Supports JavaScript/TypeScript with basic formatting: consistent indentation (2 spaces), trailing newline, remove trailing whitespace, normalize line endings. Does NOT require external tools like prettier.",
    inputSchema: createInputSchema({
      path: { type: "string", description: "File path to format" },
      indent_size: { type: "integer", description: "Indent size (default 2)", default: 2 },
    }, ["path"]),
    requiredPermissions: ["file:write"],
    isReadOnly: false,
    execute: async (params) => {
      const { readFileSync, writeFileSync } = await import("node:fs");
      const { resolve } = await import("node:path");
      const filePath = resolve(workingDirectory, params.path);
      // Security: validate file path before write operation
      const validation = validateFilePath(params.path, { allowWrite: true });
      if (!validation.safe) return { success: false, error: validation.reason };
      const content = readFileSync(filePath, "utf-8");
      const indentSize = params.indent_size || 2;
      const indent = " ".repeat(indentSize);

      // Basic formatting
      const lines = content.split(/\r?\n/);
      let formatted = [];
      let indentLevel = 0;

      for (const rawLine of lines) {
        const trimmed = rawLine.trim();
        if (!trimmed) { formatted.push(""); continue; }

        // Decrease indent for closing braces/brackets
        if (trimmed.startsWith("}") || trimmed.startsWith("]") || trimmed.startsWith(")")) {
          indentLevel = Math.max(0, indentLevel - 1);
        }

        formatted.push(indent.repeat(indentLevel) + trimmed.replace(/\s+$/, ""));

        // Increase indent for opening braces/brackets
        const openCount = (trimmed.match(/[{[(]/g) || []).length;
        const closeCount = (trimmed.match(/[}\])]/g) || []).length;
        indentLevel = Math.max(0, indentLevel + openCount - closeCount);
      }

      // Ensure trailing newline
      let result = formatted.join("\n");
      if (!result.endsWith("\n")) result += "\n";

      writeFileSync(filePath, result, "utf-8");
      return { status: "success", message: `Formatted ${params.path}`, linesProcessed: formatted.length };
    },
  });
}

export function createGenerateTestTool(workingDirectory = process.cwd()) {
  return buildTool({
    name: "generate_test",
    description: "Generate a basic test scaffold for a JavaScript/TypeScript source file. Analyzes the file for exported functions and creates a test file using node:test. The generated test imports the source and creates one test case per exported function.",
    inputSchema: createInputSchema({
      source_path: { type: "string", description: "Path to the source file to generate tests for" },
      test_path: { type: "string", description: "Optional output path for the test file (default: source_path.test.js)" },
      test_framework: { type: "string", description: "Test framework: 'node:test' (default) or 'describe'", default: "node:test" },
    }, ["source_path"]),
    requiredPermissions: ["file:write"],
    isReadOnly: false,
    execute: async (params) => {
      const { readFileSync, writeFileSync, existsSync } = await import("node:fs");
      const { resolve, basename, dirname, extname } = await import("node:path");

      // Security: validate file paths before write operation
      const sourceValidation = validateFilePath(params.source_path);
      if (!sourceValidation.safe) return { success: false, error: sourceValidation.reason };
      const sourcePath = resolve(workingDirectory, params.source_path);
      if (params.test_path) {
        const testValidation = validateFilePath(params.test_path, { allowWrite: true });
        if (!testValidation.safe) return { success: false, error: testValidation.reason };
      }
      const content = readFileSync(sourcePath, "utf-8");

      // Extract exported function/class names
      const exportPattern = /export\s+(?:function|class|const|let|var|async\s+function)\s+(\w+)/g;
      const exports = [];
      let match;
      while ((match = exportPattern.exec(content)) !== null) {
        exports.push(match[1]);
      }

      // Also check default exports
      const defaultMatch = content.match(/export\s+default\s+(?:function|class)?\s*(\w+)?/);
      if (defaultMatch && defaultMatch[1]) {
        exports.push(defaultMatch[1]);
      }

      if (exports.length === 0) {
        return { status: "warning", message: "No exported functions found in source file" };
      }

      const ext = extname(sourcePath);
      const baseName = basename(sourcePath, ext);
      const testPath = params.test_path
        ? resolve(workingDirectory, params.test_path)
        : resolve(dirname(sourcePath), `${baseName}.test${ext}`);

      // Generate test content
      const importPath = `./${baseName}${ext}`;
      const testFramework = params.test_framework || "node:test";

      let testContent;
      if (testFramework === "node:test") {
        testContent = `import { describe, it } from "node:test";\nimport assert from "node:assert/strict";\nimport { ${exports.join(", ")} } from "${importPath}";\n\n`;
        for (const fn of exports) {
          testContent += `describe("${fn}", () => {\n`;
          testContent += `  it("should be a function", () => {\n`;
          testContent += `    assert.strictEqual(typeof ${fn}, "function");\n`;
          testContent += `  });\n\n`;
          testContent += `  it("should handle basic input", () => {\n`;
          testContent += `    // TODO: Add meaningful test assertions\n`;
          testContent += `    const result = ${fn}();\n`;
          testContent += `    assert.ok(result !== undefined);\n`;
          testContent += `  });\n`;
          testContent += `});\n\n`;
        }
      } else {
        // describe style
        testContent = `import { ${exports.join(", ")} } from "${importPath}";\n\n`;
        for (const fn of exports) {
          testContent += `describe("${fn}", () => {\n`;
          testContent += `  it("should be defined", () => {\n`;
          testContent += `    expect(typeof ${fn}).toBe("function");\n`;
          testContent += `  });\n`;
          testContent += `});\n\n`;
        }
      }

      writeFileSync(testPath, testContent, "utf-8");
      return {
        status: "success",
        message: `Generated test file with ${exports.length} test suites`,
        testPath: params.test_path || `${baseName}.test${ext}`,
        exportsTested: exports,
      };
    },
  });
}

export function createTypeCheckTool(workingDirectory = process.cwd()) {
  return buildTool({
    name: "type_check",
    description: "Run TypeScript type checking on a file or project. Uses 'tsc --noEmit' for TypeScript files. Returns type errors if any, or success if types are valid.",
    inputSchema: createInputSchema({
      path: { type: "string", description: "File or directory path to type check" },
      tsconfig: { type: "string", description: "Optional path to tsconfig.json" },
      strict: { type: "boolean", description: "Enable strict mode (default false)" },
    }, ["path"]),
    requiredPermissions: ["shell:exec"],
    isReadOnly: true,
    execute: async (params) => {
      const { execFileSync } = await import("node:child_process");
      const { resolve, extname } = await import("node:path");
      const { existsSync } = await import("node:fs");

      const targetPath = resolve(workingDirectory, params.path);
      const isFile = extname(targetPath).match(/\.(ts|tsx|mts|cts)$/);

      // Build argument array instead of shell string to prevent command injection
      const args = ["tsc", "--noEmit"];
      if (params.tsconfig) {
        args.push("--project", resolve(workingDirectory, params.tsconfig));
      } else if (isFile) {
        args.push(targetPath);
      }
      if (params.strict) {
        args.push("--strict");
      }

      try {
        const output = execFileSync("npx", args, {
          cwd: workingDirectory,
          encoding: "utf-8",
          timeout: 30000,
          stdio: ["pipe", "pipe", "pipe"],
        });
        return { status: "success", message: "Type check passed \u2014 no errors found", output };
      } catch (error) {
        const stderr = error.stderr || "";
        const stdout = error.stdout || "";
        const combined = stdout + stderr;

        // Parse error count from tsc output
        const errorCountMatch = combined.match(/Found (\d+) error/);
        const errorCount = errorCountMatch ? parseInt(errorCountMatch[1]) : 0;

        return {
          status: "error",
          message: `Type check found ${errorCount} error(s)`,
          errors: combined.split("\n").filter(line => line.includes("error TS")).slice(0, 20),
          exitCode: error.status,
        };
      }
    },
  });
}

/** 创建内置工具集合 — 传入 workingDirectory 确保文件操作正确解析相对路径 */
export function createBuiltInTools(workingDirectory = process.cwd()) {
  return {
  file_read: createFileReadTool(workingDirectory),
  file_write: createFileWriteTool(workingDirectory),
  shell_exec: createShellExecTool(workingDirectory),
  web_fetch: webFetchTool,
  code_run: codeRunTool,
  // Phase B 新增工具 — 对标 Codex/Claude Code
  file_edit: createFileEditTool(),
  file_insert: createFileInsertTool(),
  glob: createGlobTool(),
  grep: createGrepTool(),
  web_search: createWebSearchTool(),
  image_analyze: createImageAnalysisTool(),
  image_read: createImageReadTool(),
  // Phase C 新增工具 — Semantic Search + AST-Aware Edit
  semantic_search: createSemanticSearchTool(workingDirectory),
  ast_edit: createAstEditTool(workingDirectory),
  // Phase D 新增工具 — code_format / generate_test / type_check
  code_format: createCodeFormatTool(workingDirectory),
  generate_test: createGenerateTestTool(workingDirectory),
  type_check: createTypeCheckTool(workingDirectory),
  };
}
