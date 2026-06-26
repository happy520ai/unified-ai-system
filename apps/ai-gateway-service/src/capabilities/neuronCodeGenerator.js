// =============================================================================
// 神经元代码生成器 (Neuron Code Generator)
//
// 根据 CapabilitySpec 调用 AI 生成实际的 JavaScript 适配器代码
//
// 生成的代码必须遵循严格的约束：
// - ESM (import/export) 语法
// - 纯函数，无全局副作用
// - 导出一个 create{CapabilityId}Neuron(options) 工厂函数
// - 工厂函数返回 { execute(input, context) => output } 接口
// - 不得调用外部网络
// - 不得读取文件系统（除非 spec 明确允许）
// - 不得访问 process.env（除非 spec 明确允许）
// - 执行时间不超过 spec.runtime.ttlSeconds
//
// 拆分为三个文件（遵循 <500 行约束）：
// - neuronCodeGenerator.js        : 主协调器（本文件）
// - neuronCodeGenerator-utils.js  : 纯函数工具与提示词构建
// - neuronCodeGenerator-templates.js : 代码模板、测试夹具、验证器脚本
// =============================================================================

import http from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  toFactoryFunctionName,
  extractCodeFromResponse,
  buildCodeGenPrompt,
} from "./neuronCodeGenerator-utils.js";

import {
  generateFallbackCode,
  generateTestFixture,
  generateVerifierScript,
} from "./neuronCodeGenerator-templates.js";

// 重新导出所有公开 API，保持向后兼容
export {
  toFactoryFunctionName,
  extractCodeFromResponse,
  buildCodeGenPrompt,
  generateFallbackCode,
  generateTestFixture,
  generateVerifierScript,
};

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// 常量配置
// ---------------------------------------------------------------------------

/** 网关 AI 端点地址 */
const GATEWAY_AI_ENDPOINT = "http://127.0.0.1:5191/chat/auto";

/** AI 调用超时时间（毫秒） */
const AI_CALL_TIMEOUT_MS = 30_000;

/** 当前文件所在目录 */
const __dirname = dirname(fileURLToPath(import.meta.url));

/** 生成代码的输出根目录 */
const GENERATED_DIR = join(__dirname, "_generated");

// ---------------------------------------------------------------------------
// 代码安全扫描
// ---------------------------------------------------------------------------

/**
 * 扫描生成的代码，检查是否包含被禁止的操作
 *
 * 默认禁止列表：
 * - CommonJS require()
 * - process.env 环境变量访问（除非 spec 允许）
 * - child_process 子进程
 * - fetch() 网络请求（除非 spec 允许）
 * - http/https 请求
 * - eval() 动态代码执行
 * - Function() 动态函数构造
 * - import() 动态导入（只允许静态 import）
 *
 * @param {string} code - 待扫描的代码字符串
 * @param {object} [specOverrides={}] - spec 中的安全覆盖配置
 * @param {boolean} [specOverrides.allowEnvAccess=false] - 是否允许 process.env
 * @param {boolean} [specOverrides.allowNetworkCalls=false] - 是否允许网络请求
 * @param {boolean} [specOverrides.allowFileSystem=false] - 是否允许文件系统访问
 * @returns {{ safe: boolean, violations: string[] }} 扫描结果
 */
export function scanGeneratedCode(code, specOverrides = {}) {
  // 基础禁止模式列表
  const forbidden = [
    { pattern: /require\s*\(/, label: "禁止 CommonJS require" },
    { pattern: /child_process/, label: "禁止子进程模块" },
    { pattern: /eval\s*\(/, label: "禁止 eval()" },
    { pattern: /Function\s*\(/, label: "禁止动态 Function 构造" },
    { pattern: /import\s*\(/, label: "禁止动态 import()" },
    { pattern: /globalThis\s*\[/, label: "禁止通过 globalThis 动态访问" },
    { pattern: /global\s*\[/, label: "禁止通过 global 动态访问" },
  ];

  // 条件禁止模式（根据 spec 决定是否启用）
  if (!specOverrides.allowEnvAccess) {
    forbidden.push({ pattern: /process\.env/, label: "禁止环境变量访问 (process.env)" });
  }

  if (!specOverrides.allowNetworkCalls) {
    forbidden.push(
      { pattern: /fetch\s*\(/, label: "禁止 fetch() 网络请求" },
      { pattern: /https?\.request/, label: "禁止 http/https 请求" },
      { pattern: /https?\.get/, label: "禁止 http/https GET" },
      { pattern: /net\.connect/, label: "禁止 TCP 连接" },
      { pattern: /dgram\./, label: "禁止 UDP 操作" }
    );
  }

  if (!specOverrides.allowFileSystem) {
    forbidden.push(
      { pattern: /fs\.read/, label: "禁止文件系统读取" },
      { pattern: /fs\.write/, label: "禁止文件系统写入" },
      { pattern: /readFileSync/, label: "禁止 readFileSync" },
      { pattern: /writeFileSync/, label: "禁止 writeFileSync" },
      { pattern: /readFile\s*\(/, label: "禁止 readFile" },
      { pattern: /writeFile\s*\(/, label: "禁止 writeFile" }
    );
  }

  const violations = [];
  for (const { pattern, label } of forbidden) {
    if (pattern.test(code)) {
      violations.push(`${label} (匹配: ${pattern.source})`);
    }
  }

  return {
    safe: violations.length === 0,
    violations,
  };
}

// ---------------------------------------------------------------------------
// AI 调用辅助函数
// ---------------------------------------------------------------------------

/**
 * 通过网关的 /chat/auto 端点调用 AI 模型
 *
 * @param {string} message - 发送给 AI 的消息
 * @param {string} [mode="standard"] - 运行模式
 * @returns {Promise<{success: boolean, content?: string, error?: string}>}
 */
function callGatewayAI(message, mode = "standard") {
  return new Promise((resolve) => {
    const requestBody = JSON.stringify({ message, mode });

    const reqOptions = {
      hostname: "127.0.0.1",
      port: 5191,
      path: "/chat/auto",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(requestBody),
      },
      timeout: AI_CALL_TIMEOUT_MS,
    };

    const req = http.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.success !== false && (parsed.content || parsed.text || parsed.choices)) {
            const content =
              parsed.content ||
              parsed.text ||
              parsed.choices?.[0]?.message?.content ||
              parsed.choices?.[0]?.text ||
              "";
            resolve({ success: true, content });
          } else {
            resolve({
              success: false,
              error: parsed.error || "AI 返回了空响应",
            });
          }
        } catch (parseErr) {
          resolve({
            success: false,
            error: `解析 AI 响应失败: ${parseErr.message}`,
          });
        }
      });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({
        success: false,
        error: `AI 调用超时（${AI_CALL_TIMEOUT_MS / 1000}秒）`,
      });
    });

    req.on("error", (err) => {
      resolve({
        success: false,
        error: `AI 调用失败: ${err.message}`,
      });
    });

    req.write(requestBody);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// 语法验证
// ---------------------------------------------------------------------------

/**
 * 使用 node --check 验证代码语法是否正确
 *
 * @param {string} code - 待验证的代码
 * @param {string} filePath - 代码文件路径（用于 --check）
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
async function validateSyntax(code, filePath) {
  // 先写入临时文件，再用 node --check 验证
  const tmpPath = `${filePath  }.syntax-check.mjs`;
  try {
    await writeFile(tmpPath, code, "utf-8");
    await execFileAsync("node", ["--check", tmpPath], { timeout: 10_000 });
    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      error: err.stderr || err.message || "语法验证失败",
    };
  } finally {
    // 清理临时文件（忽略错误）
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(tmpPath);
    } catch {
      // 忽略清理失败
    }
  }
}

// ---------------------------------------------------------------------------
// 核心代码生成函数
// ---------------------------------------------------------------------------

/**
 * 根据 CapabilitySpec 生成神经元 JavaScript 代码
 *
 * 完整流程：
 * 1. 构建代码生成 Prompt（包含 spec 信息、代码模板、约束）
 * 2. 调用 AI 生成代码（通过网关 /chat/auto）
 * 3. 后处理：提取代码块、语法验证、安全扫描
 * 4. 写入文件：capabilities/_generated/{capabilityId}/neuron.js
 * 5. 同时生成 fixture.json 和 verifier.mjs
 *
 * @param {object} capabilitySpec - compileWithAI() 返回的 CapabilitySpec
 * @param {object} [options={}] - 生成选项
 * @param {boolean} [options.skipAI=false] - 跳过 AI，直接使用 fallback 模板
 * @param {boolean} [options.skipWrite=false] - 跳过文件写入（仅返回代码）
 * @param {string} [options.outputDir] - 自定义输出目录（默认为 _generated/{capabilityId}）
 * @returns {Promise<{code: string, filePath: string, fixturePath: string, verifierPath: string, syntaxValid: boolean, safetyValid: boolean, safetyViolations: string[], usedFallback: boolean}>}
 */
export async function generateNeuronCode(capabilitySpec, options = {}) {
  if (!capabilitySpec || !capabilitySpec.capabilityId) {
    throw new Error("generateNeuronCode: capabilitySpec 必须包含 capabilityId");
  }

  const capabilityId = capabilitySpec.capabilityId;
  const outputDir = options.outputDir || join(GENERATED_DIR, capabilityId);

  // 安全扫描的覆盖选项（从 spec 的安全约束推断）
  const safetyOverrides = {
    allowEnvAccess: false,
    allowNetworkCalls: false,
    allowFileSystem: false,
  };

  // 检查安全约束是否允许特定操作
  const constraints = capabilitySpec.safetyConstraints || [];
  for (const constraint of constraints) {
    const lower = constraint.toLowerCase();
    if (lower.includes("允许") || lower.includes("allow")) {
      if (lower.includes("env") || lower.includes("环境")) safetyOverrides.allowEnvAccess = true;
      if (lower.includes("网络") || lower.includes("api") || lower.includes("network")) {
        safetyOverrides.allowNetworkCalls = true;
      }
      if (lower.includes("文件") || lower.includes("file")) safetyOverrides.allowFileSystem = true;
    }
  }

  // ── Step 1 & 2: 生成代码（AI 或 fallback）──
  let code = null;
  let usedFallback = false;

  if (!options.skipAI) {
    const prompt = buildCodeGenPrompt(capabilitySpec);
    const aiResponse = await callGatewayAI(prompt, "standard");

    if (aiResponse.success && aiResponse.content) {
      code = extractCodeFromResponse(aiResponse.content);
    }
  }

  // AI 失败时使用 fallback
  if (!code) {
    code = generateFallbackCode(capabilitySpec);
    usedFallback = true;
  }

  // ── Step 3: 后处理 ──

  // 3a. 语法验证
  let syntaxValid = false;
  if (!options.skipWrite) {
    const tmpCheckPath = join(outputDir, "neuron.js");
    const syntaxResult = await validateSyntax(code, tmpCheckPath);
    syntaxValid = syntaxResult.valid;

    // 语法验证失败时使用 fallback 代码
    if (!syntaxValid && !usedFallback) {
      code = generateFallbackCode(capabilitySpec);
      usedFallback = true;
      const retryResult = await validateSyntax(code, tmpCheckPath);
      syntaxValid = retryResult.valid;
    }
  } else {
    // 跳过写入时，假设语法正确（由调用方自行验证）
    syntaxValid = true;
  }

  // 3b. 安全扫描
  const safetyResult = scanGeneratedCode(code, safetyOverrides);
  const safetyValid = safetyResult.safe;

  // ── Step 4: 写入文件 ──
  let filePath = "";
  let fixturePath = "";
  let verifierPath = "";

  if (!options.skipWrite) {
    // 创建目录
    await mkdir(outputDir, { recursive: true });

    // 写入 neuron.js
    filePath = join(outputDir, "neuron.js");
    await writeFile(filePath, code, "utf-8");

    // 写入 fixture.json
    const fixture = generateTestFixture(capabilitySpec);
    fixturePath = join(outputDir, "fixture.json");
    await writeFile(fixturePath, JSON.stringify(fixture, null, 2), "utf-8");

    // 写入 verifier.mjs
    const verifierCode = generateVerifierScript(capabilityId, capabilitySpec);
    verifierPath = join(outputDir, "verifier.mjs");
    await writeFile(verifierPath, verifierCode, "utf-8");
  }

  // ── Step 5: 返回结果 ──
  return {
    code,
    filePath,
    fixturePath,
    verifierPath,
    syntaxValid,
    safetyValid,
    safetyViolations: safetyResult.violations,
    usedFallback,
    capabilityId,
    factoryFunctionName: toFactoryFunctionName(capabilityId),
    outputDir,
  };
}
