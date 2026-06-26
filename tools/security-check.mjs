#!/usr/bin/env node
/**
 * security-check.mjs — Automated security audit
 * Usage: node tools/security-check.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
let pass = 0, fail = 0, warn = 0;

function check(name, ok, msg) {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}: ${msg}`); }
}

function checkWarn(name, ok, msg) {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { warn++; console.log(`  WARN  ${name}: ${msg}`); }
}

console.log("\nSecurity Audit\n");

// 1. .env not committed
const gitignore = existsSync(resolve(ROOT, ".gitignore")) ? readFileSync(resolve(ROOT, ".gitignore"), "utf8") : "";
check(".gitignore blocks .env", gitignore.includes(".env"), ".env not in .gitignore");

// 2. No hardcoded secrets in source
const srcFiles = ["apps/ai-gateway-service/src/index.js", "apps/ai-gateway-service/src/http/httpServer.js"];
for (const f of srcFiles) {
  const content = existsSync(resolve(ROOT, f)) ? readFileSync(resolve(ROOT, f), "utf8") : "";
  check(`No hardcoded keys in ${f}`, !content.match(/sk-[a-zA-Z0-9]{20,}/), "Found potential API key");
}

// 3. Auth guard in production
const index = existsSync(resolve(ROOT, "apps/ai-gateway-service/src/index.js")) ? readFileSync(resolve(ROOT, "apps/ai-gateway-service/src/index.js"), "utf8") : "";
check("Production auth guard exists", index.includes("PME_ENTERPRISE_AUTH_ENABLED"), "Missing auth guard");

// 4. CORS no wildcard
const httpServer = existsSync(resolve(ROOT, "apps/ai-gateway-service/src/http/httpServer.js")) ? readFileSync(resolve(ROOT, "apps/ai-gateway-service/src/http/httpServer.js"), "utf8") : "";
check("No CORS wildcard *", !httpServer.includes('includes("*")'), "CORS wildcard found");

// 5. Redis password
const compose = existsSync(resolve(ROOT, "docker-compose.yml")) ? readFileSync(resolve(ROOT, "docker-compose.yml"), "utf8") : "";
check("Redis has password", compose.includes("requirepass"), "Redis no password");
check("Redis bound to localhost", compose.includes("127.0.0.1:6379"), "Redis exposed externally");

// 6. Docker security
check("Docker no-new-privileges", compose.includes("no-new-privileges"), "Missing security_opt");
check("Docker read_only", compose.includes("read_only: true"), "Not read-only");

// 7. Request size limit
const respUtils = existsSync(resolve(ROOT, "apps/ai-gateway-service/src/http/utils/responseUtils.js")) ? readFileSync(resolve(ROOT, "apps/ai-gateway-service/src/http/utils/responseUtils.js"), "utf8") : "";
check("Request body size limit", respUtils.includes("maxSize"), "No body size limit");

// 8. Error handler
check("Global error handler", index.includes("uncaughtException"), "Missing uncaughtException handler");

// 9. XSS protection
const inlineJs = existsSync(resolve(ROOT, "apps/ai-gateway-service/src/ui/scripts/consolePageInlineJs.js")) ? readFileSync(resolve(ROOT, "apps/ai-gateway-service/src/ui/scripts/consolePageInlineJs.js"), "utf8") : "";
const innerHtmlCount = (inlineJs.match(/innerHTML/g) || []).length;
const escapeHtmlCount = (inlineJs.match(/escapeHtml/g) || []).length;
checkWarn("innerHTML has escapeHtml", escapeHtmlCount >= innerHtmlCount, `${innerHtmlCount} innerHTML, ${escapeHtmlCount} escapeHtml`);

console.log(`\nResults: ${pass} passed, ${fail} failed, ${warn} warnings\n`);
process.exit(fail > 0 ? 1 : 0);
