/**
 * sandboxTools.js — Sandboxed web fetch and code execution tools.
 *
 * Split from agentToolRegistry.js for 分层律 compliance.
 */

import { buildTool, createInputSchema } from "./toolCore.js";

/**
 * Validate URL to prevent SSRF attacks.
 * Blocks requests to private/internal networks, localhost, and link-local addresses.
 * @param {string} urlStr - URL to validate
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateUrlForSsrf(urlStr) {
  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { valid: false, reason: "Invalid URL" };
  }

  // Only allow http/https protocols
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, reason: `Blocked protocol: ${parsed.protocol}` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost and common internal names
  const blockedHostnames = [
    "localhost", "localhost.localdomain",
    "0.0.0.0", "127.0.0.1", "::1",
    "metadata.google.internal", "metadata.google",
    "169.254.169.254", // AWS/GCP metadata
  ];
  if (blockedHostnames.includes(hostname)) {
    return { valid: false, reason: `Blocked hostname: ${hostname}` };
  }

  // Block private/reserved IP ranges
  const ipMatch = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipMatch) {
    const [, a, b, c, d] = ipMatch.map(Number);
    // 10.0.0.0/8
    if (a === 10) return { valid: false, reason: "Private IP range: 10.0.0.0/8" };
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return { valid: false, reason: "Private IP range: 172.16.0.0/12" };
    // 192.168.0.0/16
    if (a === 192 && b === 168) return { valid: false, reason: "Private IP range: 192.168.0.0/16" };
    // 127.0.0.0/8
    if (a === 127) return { valid: false, reason: "Loopback range: 127.0.0.0/8" };
    // 169.254.0.0/16 (link-local)
    if (a === 169 && b === 254) return { valid: false, reason: "Link-local range: 169.254.0.0/16" };
    // 0.0.0.0/8
    if (a === 0) return { valid: false, reason: "Unspecified range: 0.0.0.0/8" };
  }

  // Block .local, .internal, .corp TLDs
  if (hostname.endsWith(".local") || hostname.endsWith(".internal") || hostname.endsWith(".corp")) {
    return { valid: false, reason: `Blocked TLD for hostname: ${hostname}` };
  }

  return { valid: true };
}

export const webFetchTool = buildTool({
  name: "web_fetch",
  description: "获取 URL 的网页内容并提取文本。需要 network:fetch 权限。",
  inputSchema: createInputSchema(
    {
      url: {
        type: "string",
        description: "要获取的 URL",
      },
      timeout_ms: {
        type: "integer",
        description: "超时时间（毫秒），默认 15000",
      },
    },
    ["url"]
  ),
  requiredPermissions: ["network:fetch"],
  isReadOnly: true,
  async execute(params, _context) {
    const { url, timeout_ms = 15000 } = params;

    // SSRF protection: validate URL before fetching
    const ssrfCheck = validateUrlForSsrf(url);
    if (!ssrfCheck.valid) {
      return {
        status: "error",
        url,
        error: `SSRF protection: ${ssrfCheck.reason}`,
        blocked: true,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout_ms);
    const MAX_BODY_BYTES = 100_000 + 4_096; // 100KB content + 4KB lookahead for truncation detection
    try {
      const resp = await fetch(url, { signal: controller.signal });

      // Early size check via Content-Length header when available
      const contentLength = parseInt(resp.headers.get("content-length") || "0", 10);
      if (contentLength > MAX_BODY_BYTES * 10) {
        return {
          status: "error",
          url,
          statusCode: resp.status,
          error: `Response too large: Content-Length ${contentLength} exceeds ${MAX_BODY_BYTES * 10} byte safety limit`,
        };
      }

      // Stream body with byte cap instead of loading entire response into memory
      const reader = resp.body.getReader();
      const chunks = [];
      let totalBytes = 0;
      let truncated = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > MAX_BODY_BYTES) {
          // Keep only up to limit
          const excess = totalBytes - MAX_BODY_BYTES;
          chunks.push(value.slice(0, value.byteLength - excess));
          truncated = true;
          reader.cancel();
          break;
        }
        chunks.push(value);
      }

      const decoder = new TextDecoder();
      const text = chunks.map(c => decoder.decode(c, { stream: true })).join("") + decoder.decode();

      return {
        status: "success",
        url,
        statusCode: resp.status,
        contentLength: text.length,
        content: text.slice(0, 100_000),
        truncated: truncated || text.length > 100_000,
      };
    } catch (err) {
      return {
        status: "error",
        url,
        error: err.message,
      };
    } finally {
      clearTimeout(timer);
    }
  },
});

export const codeRunTool = buildTool({
  name: "code_run",
  description: "执行 JavaScript/Node.js 代码片段。需要 code:run 权限。在沙箱环境中执行。",
  inputSchema: createInputSchema(
    {
      code: {
        type: "string",
        description: "要执行的 JavaScript 代码",
      },
      timeout_ms: {
        type: "integer",
        description: "超时时间（毫秒），默认 10000",
      },
    },
    ["code"]
  ),
  requiredPermissions: ["code:run"],
  isReadOnly: false,
  async execute(params, _context) {
    const { code, timeout_ms = 30000 } = params;
    const ALLOWED_MODULES = [
      "node:crypto", "node:buffer", "node:util",
      "node:url", "node:path", "node:querystring",
    ];
    const BLOCKED_GLOBALS = [
      "process", "global", "globalThis", "root",
      "GLOBAL", "Buffer", "__dirname", "__filename",
    ];

    try {
      // ---- 1. Sandbox setup: allowlisted require + minimal safe globals ----
      const sandbox = Object.create(null);

      // Safe require: only allowlisted built-in modules, returns a Promise
      sandbox.require = function safeRequire(mod) {
        if (ALLOWED_MODULES.includes(mod)) {
          return import(mod);
        }
        throw new Error(`模块 ${mod} 不在允许列表中`);
      };

      // console with safe stubs (no access to underlying streams)
      const logs = [];
      sandbox.console = {
        log: (...a) => logs.push({ level: "log", args: a.map(String) }),
        warn: (...a) => logs.push({ level: "warn", args: a.map(String) }),
        error: (...a) => logs.push({ level: "error", args: a.map(String) }),
        info: (...a) => logs.push({ level: "info", args: a.map(String) }),
      };

      // Basic constructors only — no access to Function/eval/AsyncFunction
      sandbox.Object = Object;
      sandbox.Array = Array;
      sandbox.String = String;
      sandbox.Number = Number;
      sandbox.Boolean = Boolean;
      sandbox.RegExp = RegExp;
      sandbox.Date = Date;
      sandbox.Math = Math;
      sandbox.JSON = JSON;
      sandbox.Map = Map;
      sandbox.Set = Set;
      sandbox.WeakMap = WeakMap;
      sandbox.WeakSet = WeakSet;
      sandbox.Promise = Promise;
      sandbox.Error = Error;
      sandbox.TypeError = TypeError;
      sandbox.RangeError = RangeError;
      sandbox.SyntaxError = SyntaxError;
      sandbox.parseInt = parseInt;
      sandbox.parseFloat = parseFloat;
      sandbox.isNaN = isNaN;
      sandbox.isFinite = isFinite;
      sandbox.undefined = undefined;
      sandbox.NaN = NaN;
      sandbox.Infinity = Infinity;
      sandbox.setTimeout = setTimeout;
      sandbox.clearTimeout = clearTimeout;
      sandbox.URL = URL;
      sandbox.URLSearchParams = URLSearchParams;
      sandbox.TextEncoder = TextEncoder;
      sandbox.TextDecoder = TextDecoder;

      // ---- 2. Escape detection: throw if blocked globals are accessed ----
      for (const name of BLOCKED_GLOBALS) {
        Object.defineProperty(sandbox, name, {
          get() {
            throw new Error(`沙箱逃逸尝试: 访问了被禁止的全局变量 "${name}"`);
          },
          configurable: false,
        });
      }

      // ---- 3. Compile in sandboxed context ----
      const context = vm.createContext(sandbox, {
        codeGeneration: { strings: false, wasm: false },
      });

      const script = new vm.Script(
        `(async function() { ${code} })()`,
        { filename: "code_run_sandbox.js", timeout: timeout_ms },
      );

      // ---- 4. Execute with memory tracking ----
      const memBefore = process.memoryUsage();
      let rawResult;
      try {
        rawResult = script.runInContext(context, { timeout: timeout_ms });
      } catch (err) {
        // Re-throw escape/memory errors; wrap other compile/runtime errors
        if (err.message?.includes("沙箱逃逸")) throw err;
        throw new Error(`沙箱编译/执行错误: ${err.message}`);
      }

      // ---- 5. Handle async results with timeout race ----
      let result;
      if (rawResult && typeof rawResult.then === "function") {
        result = await Promise.race([
          rawResult,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("执行超时")), timeout_ms),
          ),
        ]);
      } else {
        result = rawResult;
      }

      const memAfter = process.memoryUsage();
      const heapDeltaBytes = memAfter.heapUsed - memBefore.heapUsed;

      return {
        status: "success",
        result: result !== undefined ? String(result) : "undefined",
        logs: logs.length > 0 ? logs : undefined,
        sandbox: "vm-context",
        memory: {
          heapDeltaBytes,
          heapUsedBytes: memAfter.heapUsed,
        },
      };
    } catch (err) {
      if (err.message?.includes("沙箱逃逸")) {
        return { status: "error", error: err.message, sandboxEscape: true };
      }
      if (err.message === "执行超时") {
        return { status: "error", error: `执行超时（${timeout_ms}ms）` };
      }
      return { status: "error", error: err.message };
    }
  },
});
