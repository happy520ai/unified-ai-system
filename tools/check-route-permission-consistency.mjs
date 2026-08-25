import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const httpRoot = join(repoRoot, "apps", "ai-gateway-service", "src", "http");
const MIN_EXPECTED_DECLARATIONS = 80;

const { resolvePermission } = await import(
  pathToFileURL(join(httpRoot, "utils", "enterpriseUtils.js")).href
);

const routeFiles = collectRouteFiles(httpRoot);
const declarations = routeFiles.flatMap((file) => extractDeclarations(file));
const issues = [];

if (declarations.length < MIN_EXPECTED_DECLARATIONS) {
  issues.push({
    code: "route_declaration_scan_incomplete",
    expectedAtLeast: MIN_EXPECTED_DECLARATIONS,
    actual: declarations.length,
  });
}

for (const declaration of declarations) {
  const resolved = resolvePermission(declaration.method, declaration.path);
  const expected = declaration.public === true
    ? "public:read"
    : declaration.permission || "MISSING_PERMISSION";
  if (expected !== resolved) {
    issues.push({
      code: "route_permission_mismatch",
      ...declaration,
      expected,
      resolved,
    });
  }
}

if (issues.length > 0) {
  console.error(JSON.stringify({
    ok: false,
    filesScanned: routeFiles.length,
    declarationsChecked: declarations.length,
    issues,
  }, null, 2));
  process.exitCode = 1;
} else {
  console.log(`Route permission consistency passed: ${declarations.length} declarations across ${routeFiles.length} files.`);
}

function collectRouteFiles(root) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectRouteFiles(path));
    } else if (/Routes\.(?:js|ts)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
      files.push(path);
    }
  }
  return files.sort();
}

function extractDeclarations(file) {
  const source = readFileSync(file, "utf8");
  const declarations = [];
  const mapEntryPattern = /\[\s*["'](GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+([^"']+)["']\s*,\s*\{([\s\S]{0,1200}?)\}\s*\]/g;
  const setEntryPattern = /handlers\.set\(\s*["'](GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+([^"']+)["']\s*,\s*\{([\s\S]*?)\n\s*\}\s*\);/g;

  for (const pattern of [mapEntryPattern, setEntryPattern]) {
    for (const match of source.matchAll(pattern)) {
      const metadata = readMetadata(match[3]);
      if (!metadata.declared) continue;
      declarations.push({
        file: relative(repoRoot, file).replaceAll("\\", "/"),
        method: match[1],
        path: match[2],
        public: metadata.public,
        permission: metadata.permission,
      });
    }
  }
  return declarations;
}

function readMetadata(source) {
  const publicMatch = source.match(/\bpublic\s*:\s*(true|false)/);
  const permission = source.match(/\bpermission\s*:\s*["']([^"']+)["']/)?.[1] ?? null;
  return {
    declared: Boolean(publicMatch || permission),
    public: publicMatch?.[1] === "true",
    permission,
  };
}
