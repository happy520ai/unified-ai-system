#!/usr/bin/env node
// =============================================================================
// anti-entropy-audit.js — 逆熵元法则自动化审计
//
// 按七条铁律扫描代码库，输出违规清单。
// 用法: node tools/anti-entropy-audit.js [--fix]
// =============================================================================

import { readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { readdirSync, existsSync } from "node:fs";

const ROOT = resolve(import.meta.dirname ?? new URL(".", import.meta.url).pathname, "..");
const isWindows = process.platform === "win32";
const rootPath = isWindows ? ROOT.replace(/^\/([A-Z]):/, (_, d) => `${d.toUpperCase()}:`) : ROOT;

const MAX_FILE_LINES = 500;
const SCAN_DIRS = [
  "apps/ai-gateway-service/src",
  "apps/agent-console/src",
  "packages",
];
const SKIP_DIRS = new Set(["node_modules", ".git", "legacy", "evidence", "dist", ".data"]);
const SKIP_FILES = new Set(["entrypointUtils.js"]); // 共享工具本身不审计

// ── 结果收集 ─────────────────────────────────────────────────────────────────

const violations = {
  lineLimit: [],       // 分层律: 文件超过 500 行
  emptyCatch: [],      // 闭环律: 空 catch 块
  duplicateFn: [],     // 剃刀律: 重复函数定义
  deepImport: [],      // 边界律: 深路径穿透 packages/
  errorFormat: [],     // 边界律: 非标准错误格式
  todoFixme: [],       // 耗散律: TODO/FIXME 标记
};

// ── 工具函数 ─────────────────────────────────────────────────────────────────

function walk(dir, depth = 0) {
  if (depth > 8) return [];
  const results = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const name = typeof entry === "string" ? entry : entry.name;
    const isDir = typeof entry === "object" ? entry.isDirectory() : false;
    const full = join(dir, name);
    if (isDir) {
      if (SKIP_DIRS.has(name) || name.startsWith(".")) continue;
      results.push(...walk(full, depth + 1));
    } else if (name.endsWith(".js") || name.endsWith(".mjs")) {
      results.push(full);
    }
  }
  return results;
}

function countLines(filePath) {
  try {
    const content = readFileSync(filePath, "utf8");
    return content.split("\n").length;
  } catch {
    return 0;
  }
}

function relPath(filePath) {
  return filePath.replace(rootPath, "").replace(/^[\\/]+/, "");
}

// ── 分层律: 文件行数 ─────────────────────────────────────────────────────────

function auditLineLimit(files) {
  for (const f of files) {
    const lines = countLines(f);
    if (lines > MAX_FILE_LINES) {
      violations.lineLimit.push({
        file: relPath(f),
        lines,
        excess: lines - MAX_FILE_LINES,
      });
    }
  }
}

// ── 闭环律: 空 catch ─────────────────────────────────────────────────────────

function auditEmptyCatch(files) {
  for (const f of files) {
    try {
      const content = readFileSync(f, "utf8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // 匹配 catch {} 或 catch(e) {} 或 catch { \n }
        if (/catch\s*(\(\s*\w*\s*\))?\s*\{\s*\}/.test(line)) {
          violations.emptyCatch.push({ file: relPath(f), line: i + 1, code: line });
        }
        // 多行空 catch: catch(err) {\n}
        if (/catch\s*(\(\s*\w*\s*\))?\s*\{\s*$/.test(line) && i + 1 < lines.length) {
          const next = lines[i + 1].trim();
          if (next === "}") {
            violations.emptyCatch.push({ file: relPath(f), line: i + 1, code: `${line} ${next}` });
          }
        }
      }
    } catch { /* skip unreadable */ }
  }
}

// ── 边界律: 深路径穿透 ───────────────────────────────────────────────────────

function auditDeepImports(files) {
  for (const f of files) {
    try {
      const content = readFileSync(f, "utf8");
      // 查找 import ... from "../../../../packages/xxx/src/..."
      const matches = content.matchAll(/from\s+["']([^"']*packages\/[^"']*\/src\/[^"']+)["']/g);
      for (const m of matches) {
        violations.deepImport.push({ file: relPath(f), import: m[1] });
      }
    } catch { /* skip */ }
  }
}

// ── 边界律: 非标准错误格式 ───────────────────────────────────────────────────

function auditErrorFormat(files) {
  for (const f of files) {
    try {
      const content = readFileSync(f, "utf8");
      // 只标记在 HTTP 响应上下文中使用 success: false 的文件
      // 内部函数返回 { success: false, reason: "..." } 不是边界律违规
      if (!/success\s*:\s*false/.test(content)) continue;

      // 检查是否在 HTTP 响应上下文中（必须是实际写入 HTTP 响应的代码）：
      // 1. writeJson(res/response, ...) — 直接写 HTTP 响应
      const writesHttpResponse = /writeJson\s*\(\s*\w*(res|response|reply)\b/i.test(content);
      // 2. response.end(JSON.stringify({...})) — 直接写 HTTP 响应
      const endsHttpResponse = /(?:res|response)\.end\s*\(\s*JSON\.stringify/i.test(content);
      // 3. 文件定义了错误信封函数 (createErrorEnvelope 等)
      const hasErrorEnvelope = /createError(Envelope|Response)/.test(content);

      if (writesHttpResponse || endsHttpResponse || hasErrorEnvelope) {
        violations.errorFormat.push({
          file: relPath(f),
          issue: "uses `success: false` instead of `status: \"error\"`",
        });
      }
    } catch { /* skip */ }
  }
}

// ── 耗散律: TODO/FIXME ──────────────────────────────────────────────────────

function isInsideStringLiteral(line, commentIndex) {
  const before = line.slice(0, commentIndex);
  for (const q of ["'", '"', "`"]) {
    let count = 0;
    for (let j = 0; j < before.length; j++) {
      if (before[j] === q && (j === 0 || before[j - 1] !== "\\")) count++;
    }
    if (count % 2 === 1) return true;
  }
  return false;
}

function auditTodoFixme(files) {
  for (const f of files) {
    try {
      const content = readFileSync(f, "utf8");
      const lines = content.split("\n");
      let backtickDepth = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const idx = line.indexOf("//");
        if (idx !== -1) {
          const m = line.slice(idx).match(/^\/\/\s*(TODO|FIXME|HACK|XXX)\b(.*)/);
          const inTemplate = backtickDepth % 2 === 1;
          if (m && !inTemplate && !isInsideStringLiteral(line, idx)) {
            violations.todoFixme.push({
              file: relPath(f),
              line: i + 1,
              type: m[1],
              note: m[2].trim(),
            });
          }
        }
        // Update template literal depth AFTER checking this line
        for (let j = 0; j < line.length; j++) {
          if (line[j] === "`" && (j === 0 || line[j - 1] !== "\\")) backtickDepth++;
        }
      }
    } catch { /* skip */ }
  }
}

// ── 剃刀律: 重复函数定义 ────────────────────────────────────────────────────

function auditDuplicateFunctions(files) {
  const fnMap = new Map(); // fnName -> [files]
  const TARGET_FNS = new Set([
    "sleep", "fetchJson", "fetchText", "postJson",
    "readJson", "readText", "readJsonSync",
    "writeEvidence", "createEvidenceMarkdown",
    "writeJson", "createOkEnvelope", "createErrorEnvelope",
    "listen",
    "findBrowserPath", "waitForHealth",
  ]);

  for (const f of files) {
    const basename = f.split(/[\\/]/).pop();
    if (SKIP_FILES.has(basename)) continue;
    try {
      const content = readFileSync(f, "utf8");
      // 匹配 function xxx( 和 export function xxx(
      const matches = content.matchAll(/(?:export\s+)?function\s+(\w+)\s*\(/g);
      const fileFns = new Set();
      for (const m of matches) {
        if (TARGET_FNS.has(m[1])) {
          fileFns.add(m[1]);
        }
      }
      for (const fn of fileFns) {
        if (!fnMap.has(fn)) fnMap.set(fn, []);
        fnMap.get(fn).push(relPath(f));
      }
    } catch { /* skip */ }
  }

  for (const [fn, fileList] of fnMap) {
    if (fileList.length >= 2) {
      violations.duplicateFn.push({
        function: fn,
        count: fileList.length,
        files: fileList.slice(0, 5), // 只展示前 5 个
        more: fileList.length > 5 ? fileList.length - 5 : 0,
      });
    }
  }
  // 按重复次数降序
  violations.duplicateFn.sort((a, b) => b.count - a.count);
}

// ── 主流程 ───────────────────────────────────────────────────────────────────

function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  逆熵元法则 · 自动化审计  v1.0               ║");
  console.log("║  ANTI-ENTROPY META-LAW AUDIT                ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log();
  console.log(`Root: ${rootPath}`);
  console.log();

  // 收集所有文件
  let allFiles = [];
  for (const dir of SCAN_DIRS) {
    const fullDir = join(rootPath, dir);
    if (existsSync(fullDir)) {
      allFiles.push(...walk(fullDir));
    }
  }
  console.log(`Scanning ${allFiles.length} files across ${SCAN_DIRS.length} directories...`);
  console.log();

  // 执行审计
  auditLineLimit(allFiles);
  auditEmptyCatch(allFiles);
  auditDeepImports(allFiles);
  auditErrorFormat(allFiles);
  auditTodoFixme(allFiles);
  auditDuplicateFunctions(allFiles);

  // 输出报告
  let totalViolations = 0;

  // 分层律
  console.log("━━━ 分层律: 文件行数上限 (" + MAX_FILE_LINES + " 行) ━━━");
  if (violations.lineLimit.length === 0) {
    console.log("  ✓ PASS — 所有文件均在限制内");
  } else {
    violations.lineLimit.sort((a, b) => b.lines - a.lines);
    for (const v of violations.lineLimit.slice(0, 20)) {
      console.log(`  ✗ ${v.file}: ${v.lines} 行 (超标 ${v.excess})`);
    }
    if (violations.lineLimit.length > 20) {
      console.log(`  ... 及其他 ${violations.lineLimit.length - 20} 个文件`);
    }
    totalViolations += violations.lineLimit.length;
  }
  console.log();

  // 闭环律
  console.log("━━━ 闭环律: 空 catch 块 ━━━");
  if (violations.emptyCatch.length === 0) {
    console.log("  ✓ PASS — 未发现空 catch 块");
  } else {
    for (const v of violations.emptyCatch.slice(0, 20)) {
      console.log(`  ✗ ${v.file}:${v.line}: ${v.code}`);
    }
    totalViolations += violations.emptyCatch.length;
  }
  console.log();

  // 边界律: 深路径
  console.log("━━━ 边界律: 深路径穿透 ━━━");
  if (violations.deepImport.length === 0) {
    console.log("  ✓ PASS — 未发现深路径穿透");
  } else {
    for (const v of violations.deepImport) {
      console.log(`  ✗ ${v.file}: ${v.import}`);
    }
    totalViolations += violations.deepImport.length;
  }
  console.log();

  // 边界律: 错误格式
  console.log("━━━ 边界律: 非标准错误格式 ━━━");
  if (violations.errorFormat.length === 0) {
    console.log("  ✓ PASS — 所有文件使用标准错误格式");
  } else {
    for (const v of violations.errorFormat) {
      console.log(`  ✗ ${v.file}: ${v.issue}`);
    }
    totalViolations += violations.errorFormat.length;
  }
  console.log();

  // 剃刀律: 重复函数
  console.log("━━━ 剃刀律: 重复函数定义 ━━━");
  if (violations.duplicateFn.length === 0) {
    console.log("  ✓ PASS — 未发现重复函数定义");
  } else {
    for (const v of violations.duplicateFn) {
      console.log(`  ✗ ${v.function}(): 重复 ${v.count} 次`);
      for (const f of v.files) console.log(`      ${f}`);
      if (v.more > 0) console.log(`      ... 及其他 ${v.more} 个文件`);
    }
    totalViolations += violations.duplicateFn.reduce((s, v) => s + v.count - 1, 0);
  }
  console.log();

  // 耗散律: TODO/FIXME
  console.log("━━━ 耗散律: TODO/FIXME 标记 ━━━");
  if (violations.todoFixme.length === 0) {
    console.log("  ✓ PASS — 无遗留 TODO/FIXME");
  } else {
    for (const v of violations.todoFixme.slice(0, 15)) {
      console.log(`  △ ${v.file}:${v.line} [${v.type}] ${v.note}`);
    }
    totalViolations += violations.todoFixme.length;
  }
  console.log();

  // 分类汇总
  const lineLimitCount = violations.lineLimit.length;
  const emptyCatchCount = violations.emptyCatch.length;
  const deepImportCount = violations.deepImport.length;
  const errorFormatCount = violations.errorFormat.length;
  const dupFnCount = violations.duplicateFn.reduce((s, v) => s + v.count - 1, 0);
  const todoCount = violations.todoFixme.length;

  console.log("━━━ 分类汇总 ━━━");
  console.log(`  分层律 (文件行数):   ${lineLimitCount}`);
  console.log(`  闭环律 (空 catch):   ${emptyCatchCount}`);
  console.log(`  边界律 (深路径穿透): ${deepImportCount}`);
  console.log(`  边界律 (错误格式):   ${errorFormatCount}`);
  console.log(`  剃刀律 (重复函数):   ${dupFnCount}`);
  console.log(`  耗散律 (TODO标记):   ${todoCount}`);
  console.log();

  // 汇总
  console.log("═══════════════════════════════════════════════");
  if (totalViolations === 0) {
    console.log("  审计通过 — 系统熵值处于健康水平");
  } else {
    console.log(`  发现 ${totalViolations} 处违规 — 需要注入负熵`);
  }
  console.log("═══════════════════════════════════════════════");

  // 返回退出码
  return totalViolations > 0 ? 1 : 0;
}

process.exitCode = main();
