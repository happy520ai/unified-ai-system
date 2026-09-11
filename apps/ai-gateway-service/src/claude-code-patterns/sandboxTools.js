/**
 * sandboxTools.js — Sandboxed web fetch and code execution tools.
 *
 * Split from agentToolRegistry.js for 分层律 compliance.
 */

import { buildTool, createInputSchema } from "./toolCore.js";
import { createIsolatedCodeRunner } from "./codeRunIsolation.ts";
import { safeOutboundFetch } from "../security/safeOutboundFetch.ts";

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
      const resp = await safeOutboundFetch(url, {
        signal: controller.signal,
        timeout: timeout_ms,
      });

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
        blocked: err?.code === "OUTBOUND_URL_BLOCKED",
      };
    } finally {
      clearTimeout(timer);
    }
  },
});

export function createCodeRunTool(options) {
  const execute = createIsolatedCodeRunner(options);
  return {
    ...buildTool({
      name: "code_run",
      description: "在显式配置的隔离容器中执行 JavaScript。需要 code:run 权限；未配置隔离后端时拒绝执行。无网络、无项目文件挂载，不在宿主进程运行代码。",
      inputSchema: createInputSchema({
        code: { type: "string", description: "JavaScript 函数体，最多 65536 UTF-8 字节" },
        timeout_ms: { type: "integer", description: "代码执行超时，1-30000 毫秒，默认 10000；另需等待有界容器准备与清理" },
      }, ["code"]),
      requiredPermissions: ["code:run"],
      isReadOnly: false,
      execute,
    }),
    execute,
    // Allow bounded engine attestation/create/kill/remove to finish before the
    // generic registry timeout; the snippet itself remains capped at 30s.
    executionTimeoutMs: 180000,
  };
}

export const codeRunTool = createCodeRunTool();
