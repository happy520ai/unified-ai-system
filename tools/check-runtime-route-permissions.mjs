import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePermission } from "../apps/ai-gateway-service/src/http/utils/enterpriseUtils.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const httpDir = path.join(rootDir, "apps", "ai-gateway-service", "src", "http");
const routeFiles = Array.from({ length: 6 }, (_, index) => path.join(httpDir, `httpServerRoutes0${index + 1}.js`));
const manualDynamicProbes = [
  { method: "POST", pathname: "/approvals/runtime-probe/approve", source: "dynamic approval route" },
  { method: "POST", pathname: "/approvals/runtime-probe/reject", source: "dynamic approval route" },
  { method: "GET", pathname: "/chat-gateway/evidence/runtime-probe", source: "dynamic evidence route" },
];

function readIfCondition(source, startIndex) {
  const openIndex = source.indexOf("(", startIndex);
  if (openIndex < 0) return null;
  let depth = 1;
  let quote = "";
  let escaped = false;

  for (let index = openIndex + 1; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = "";
      }
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (depth === 0) return source.slice(openIndex + 1, index);
  }
  return null;
}

function extractStaticRoutes(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const routes = [];
  const ifPattern = /\bif\s*\(/g;
  let match;
  while ((match = ifPattern.exec(source)) !== null) {
    const condition = readIfCondition(source, match.index);
    if (!condition) continue;
    const methods = [...condition.matchAll(/request\.method\s*===\s*["']([A-Z]+)["']/g)].map((item) => item[1]);
    const exactPaths = [...condition.matchAll(/url\.pathname\s*===\s*["'](\/[^"']*)["']/g)].map((item) => item[1]);
    const prefixes = [...condition.matchAll(/url\.pathname\.startsWith\(\s*["'](\/[^"']*)["']\s*\)/g)]
      .map((item) => `${item[1]}runtime-permission-probe`);
    for (const method of new Set(methods)) {
      for (const pathname of new Set([...exactPaths, ...prefixes])) {
        routes.push({ method, pathname, source: path.relative(rootDir, filePath) });
      }
    }
  }
  return routes;
}

const discovered = routeFiles.flatMap(extractStaticRoutes);
const routesByKey = new Map();
for (const route of [...discovered, ...manualDynamicProbes]) {
  routesByKey.set(`${route.method} ${route.pathname}`, route);
}

if (routesByKey.size < 90) {
  console.error(`Runtime route parser discovered only ${routesByKey.size} routes; expected at least 90.`);
  process.exit(1);
}

const failures = [];
for (const route of routesByKey.values()) {
  const permission = resolvePermission(route.method, route.pathname);
  if (permission === "route:unknown") {
    failures.push(`${route.method} ${route.pathname} (${route.source})`);
  }
}

const serverSource = fs.readFileSync(path.join(httpDir, "httpServer.js"), "utf8");
if (!serverSource.includes("shouldRejectUnmappedRoute({")) {
  failures.push("httpServer.js does not enforce the fail-closed unknown-route boundary");
}

if (failures.length > 0) {
  console.error("Runtime route permission coverage failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Runtime route permission coverage passed: ${routesByKey.size} routes across ${routeFiles.length} active dispatchers.`);
