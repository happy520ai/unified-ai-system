import ts from "typescript";
import { existsSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const CRITICAL_JS_FILES = Object.freeze([
  "apps/ai-gateway-service/src/index.js",
  "apps/ai-gateway-service/src/claude-code-patterns/sandboxTools.js",
  "apps/ai-gateway-service/src/claude-code-patterns/developerTools.js",
  "apps/ai-gateway-service/src/claude-code-patterns/toolRegistryEngine.js",
  "apps/ai-gateway-service/src/core/gatewayService.js",
  "apps/ai-gateway-service/src/http/httpServer.js",
  "apps/ai-gateway-service/src/workforce/workflowRunHandoff.js",
  "apps/ai-gateway-service/src/workforce/workforcePlanner-previews.js",
  "apps/ai-gateway-service/src/workforce/workforcePlanStore-utils.js",
  "apps/ai-gateway-service/src/workforce/workforcePlanStore.js",
  "packages/mcp-service/src/health-server.js",
  "packages/mcp-service/src/daemon.js",
  "packages/mcp-service/src/child-environment.js",
  "packages/mcp-server/src/runtime.js",
  "packages/forge-core/src/sandbox-executor/container-backend.js",
]);

// Deliberately scoped binding checks, not a claim of complete JS type safety.
// TS2304/2552: unresolved names; TS18004: unbound shorthand;
// TS2305/2724: missing named exports; TS2307: unresolved imports.
export const BINDING_DIAGNOSTIC_CODES = Object.freeze([2304, 2552, 18004, 2305, 2724, 2307]);

export function checkCriticalJs(files = CRITICAL_JS_FILES, root = REPO_ROOT) {
  if (!files.length) throw new Error("Critical JS scope must not be empty.");
  const paths = files.map(file => resolve(root, file));
  for (const file of paths) {
    if (!/\.m?js$/.test(file) || !existsSync(file)) throw new Error("A required critical JS source is missing or invalid.");
  }
  const program = ts.createProgram(paths, {
    allowJs: true, checkJs: true, noEmit: true, skipLibCheck: true,
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    types: ["node"], typeRoots: [resolve(REPO_ROOT, "node_modules/@types")],
    lib: ["lib.es2022.d.ts"], allowImportingTsExtensions: true,
  });
  const diagnostics = [...program.getOptionsDiagnostics(), ...program.getGlobalDiagnostics()]
    .filter(item => item.category === ts.DiagnosticCategory.Error)
    .map(item => ({ file: null, line: null, column: null, code: item.code,
      message: ts.flattenDiagnosticMessageText(item.messageText, " ") }));
  for (const path of paths) {
    const source = program.getSourceFile(path);
    if (!source) throw new Error("A required critical JS source was not loaded by the compiler.");
    const selected = [...program.getSyntacticDiagnostics(source),
      ...program.getSemanticDiagnostics(source).filter(item => BINDING_DIAGNOSTIC_CODES.includes(item.code))];
    for (const item of selected) {
      const position = source.getLineAndCharacterOfPosition(item.start ?? 0);
      diagnostics.push({ file: relative(root, path).replaceAll("\\", "/"),
        line: position.line + 1, column: position.character + 1, code: item.code,
        message: ts.flattenDiagnosticMessageText(item.messageText, " ") });
    }
  }
  return { schemaVersion: 1, status: diagnostics.length ? "failed" : "passed",
    coverage: "selected Node.js syntax, identifier binding and import/export resolution",
    ruleCodes: BINDING_DIAGNOSTIC_CODES, checkedFiles: files, diagnostics };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = checkCriticalJs();
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = report.status === "passed" ? 0 : 1;
  } catch {
    process.stderr.write("Critical JS binding check could not complete.\n");
    process.exitCode = 1;
  }
}
