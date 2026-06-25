// =============================================================================
// 神经元代码生成器 — 代码模板与测试夹具
//
// 从 neuronCodeGenerator.js 拆分的模板模块。
// 包含 fallback 代码生成、测试夹具生成、验证器脚本生成。
// =============================================================================

import { toFactoryFunctionName } from "./neuronCodeGenerator-utils.js";

// ---------------------------------------------------------------------------
// 代码生成模板（当 AI 调用失败时的 fallback）
// ---------------------------------------------------------------------------

/**
 * 生成一个基础的 pass-through 神经元代码（AI 调用失败时的回退方案）
 *
 * @param {object} capabilitySpec - CapabilitySpec
 * @returns {string} JavaScript 代码
 */
export function generateFallbackCode(capabilitySpec) {
  const factoryName = toFactoryFunctionName(capabilitySpec.capabilityId);

  // 构建输入参数名列表
  const inputNames = Object.keys(capabilitySpec.inputs || {});
  const requiredInputs = inputNames.filter(
    (name) => capabilitySpec.inputs[name]?.required !== false
  );

  const requiredChecks = requiredInputs
    .map(
      (name) =>
        `    if (input.${name} === undefined || input.${name} === null) {
      throw new Error("缺少必需参数: ${name}");
    }`
    )
    .join("\n");

  return `/**
 * ${capabilitySpec.displayName}
 * ${capabilitySpec.description}
 *
 * [注意] 此代码由 fallback 生成器自动生成，仅包含基础框架。
 * 请使用 AI 代码生成器获取完整实现。
 *
 * @module ${capabilitySpec.capabilityId}
 */

/**
 * 创建 ${capabilitySpec.displayName} 神经元实例
 * @param {object} [options={}] - 初始化配置
 * @returns {{ execute: (input: object, context?: object) => Promise<object> }}
 */
export function ${factoryName}(options = {}) {
  return {
    /**
     * 执行能力神经元
     * @param {object} input - 输入参数
     * @param {object} [context={}] - 运行上下文
     * @returns {Promise<object>} 执行结果
     */
    async execute(input, context = {}) {
      // 输入验证
      if (!input || typeof input !== "object") {
        throw new Error("input 必须是一个对象");
      }
${requiredChecks}

      // 核心处理逻辑（待实现）
      const result = {
        status: "pass_through",
        capabilityId: "${capabilitySpec.capabilityId}",
        inputReceived: input,
        processedAt: new Date().toISOString(),
        note: "此为 fallback 骨架代码，请使用 AI 生成完整实现",
      };

      return result;
    },
  };
}
`;
}

// ---------------------------------------------------------------------------
// 测试夹具生成
// ---------------------------------------------------------------------------

/**
 * 根据 CapabilitySpec 生成测试夹具 (fixture) 数据
 *
 * @param {object} capabilitySpec - 完整的 CapabilitySpec
 * @returns {object} 测试夹具 JSON 对象
 */
export function generateTestFixture(capabilitySpec) {
  const inputs = capabilitySpec.inputs || {};
  const fixtureInput = {};

  // 根据输入参数规格自动生成测试数据
  for (const [paramName, paramDef] of Object.entries(inputs)) {
    const type = paramDef?.type || "string";

    // 如果有示例用法，优先使用示例数据
    if (capabilitySpec.exampleUsage?.input?.[paramName] !== undefined) {
      fixtureInput[paramName] = capabilitySpec.exampleUsage.input[paramName];
      continue;
    }

    // 根据类型生成默认测试值
    switch (type) {
      case "string":
        fixtureInput[paramName] = `test-${paramName}-value`;
        break;
      case "number":
        fixtureInput[paramName] = 42;
        break;
      case "boolean":
        fixtureInput[paramName] = true;
        break;
      case "object":
        fixtureInput[paramName] = { testKey: "testValue" };
        break;
      case "array":
        fixtureInput[paramName] = ["item1", "item2"];
        break;
      default:
        fixtureInput[paramName] = null;
    }
  }

  // 构建期望输出（如果有示例）
  const expectedOutput = capabilitySpec.exampleUsage?.expectedOutput || {
    status: "pass_through",
    capabilityId: capabilitySpec.capabilityId,
  };

  return {
    fixtureVersion: "neuron-test-fixture-v1",
    capabilityId: capabilitySpec.capabilityId,
    createdAt: new Date().toISOString(),
    testCases: [
      {
        name: "正常执行",
        input: fixtureInput,
        expectedOutputKeys: Object.keys(expectedOutput),
        shouldSucceed: true,
      },
      {
        name: "空输入验证",
        input: {},
        shouldSucceed: false,
        expectedError: "缺少必需参数",
      },
      {
        name: "无效输入类型",
        input: null,
        shouldSucceed: false,
        expectedError: "input 必须是一个对象",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// 验证器脚本生成
// ---------------------------------------------------------------------------

/**
 * 生成一个 .mjs 验证器脚本
 * 该脚本加载 neuron.js，用 fixture 数据调用 execute()，
 * 验证输出格式、执行时间、错误处理
 *
 * @param {string} capabilityId - 能力ID
 * @param {object} spec - CapabilitySpec
 * @returns {string} 验证器脚本代码
 */
export function generateVerifierScript(capabilityId, spec) {
  const factoryName = toFactoryFunctionName(capabilityId);
  const ttlSeconds = spec.runtime?.ttlSeconds || 300;

  return `/**
 * ${spec.displayName} - 验证器脚本
 *
 * 自动测试生成的神经元代码：
 * 1. 加载 neuron.js 并实例化
 * 2. 使用 fixture 数据执行测试用例
 * 3. 验证输出格式、执行时间、错误处理
 *
 * 用法: node verifier.mjs
 *
 * @module ${capabilityId}/verifier
 */

import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------

const CAPABILITY_ID = "${capabilityId}";
const FACTORY_NAME = "${factoryName}";
const TTL_SECONDS = ${ttlSeconds};
const NEURON_PATH = join(__dirname, "neuron.js");
const FIXTURE_PATH = join(__dirname, "fixture.json");

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

/** 简单的断言函数 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(\`[ASSERT FAILED] \${message}\`);
  }
}

/** 带超时控制的执行 */
async function executeWithTimeout(fn, timeoutMs) {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(\`执行超时 (\${timeoutMs / 1000}秒)\`)), timeoutMs)
    ),
  ]);
}

/** 格式化测试结果 */
function formatResult(name, passed, details = "") {
  const icon = passed ? "PASS" : "FAIL";
  return \`[\${icon}] \${name}\${details ? " - " + details : ""}\`;
}

// ---------------------------------------------------------------------------
// 测试执行
// ---------------------------------------------------------------------------

async function main() {
  console.log(\`\\n=== 神经元验证器: \${CAPABILITY_ID} ===\\n\`);

  let totalTests = 0;
  let passedTests = 0;
  const results = [];

  // ── Step 1: 加载 fixture ──
  let fixture;
  try {
    const fixtureRaw = await readFile(FIXTURE_PATH, "utf-8");
    fixture = JSON.parse(fixtureRaw);
    console.log(formatResult("加载 fixture", true, \`\${fixture.testCases.length} 个测试用例\`));
    passedTests++;
  } catch (err) {
    console.log(formatResult("加载 fixture", false, err.message));
    console.log("\\n[FATAL] 无法加载 fixture.json，终止测试。");
    process.exit(1);
  }
  totalTests++;

  // ── Step 2: 加载 neuron.js ──
  let neuronModule;
  try {
    neuronModule = await import(NEURON_PATH);
    console.log(formatResult("加载 neuron.js", true));
    passedTests++;
  } catch (err) {
    console.log(formatResult("加载 neuron.js", false, err.message));
    console.log("\\n[FATAL] 无法加载 neuron.js，终止测试。");
    process.exit(1);
  }
  totalTests++;

  // ── Step 3: 检查工厂函数 ──
  const factoryFn = neuronModule[FACTORY_NAME];
  totalTests++;
  if (typeof factoryFn === "function") {
    console.log(formatResult(\`工厂函数 \${FACTORY_NAME}\`, true, "已找到"));
    passedTests++;
  } else {
    console.log(formatResult(\`工厂函数 \${FACTORY_NAME}\`, false, "未找到或不是函数"));
    console.log(\`  导出的成员: \${Object.keys(neuronModule).join(", ")}\`);
    console.log("\\n[FATAL] 工厂函数缺失，终止测试。");
    process.exit(1);
  }

  // ── Step 4: 实例化神经元 ──
  let neuron;
  totalTests++;
  try {
    neuron = factoryFn({});
    assert(neuron && typeof neuron.execute === "function", "execute 方法不存在");
    console.log(formatResult("实例化神经元", true, "execute() 可用"));
    passedTests++;
  } catch (err) {
    console.log(formatResult("实例化神经元", false, err.message));
    console.log("\\n[FATAL] 实例化失败，终止测试。");
    process.exit(1);
  }

  // ── Step 5: 执行测试用例 ──
  for (const testCase of fixture.testCases) {
    totalTests++;
    const startTime = Date.now();

    try {
      const output = await executeWithTimeout(
        () => neuron.execute(testCase.input, { testMode: true }),
        TTL_SECONDS * 1000
      );
      const elapsed = Date.now() - startTime;

      if (testCase.shouldSucceed) {
        // 验证输出是对象
        assert(output !== null && typeof output === "object", "输出必须是对象");
        // 验证期望的键是否存在
        if (testCase.expectedOutputKeys?.length > 0) {
          for (const key of testCase.expectedOutputKeys) {
            assert(key in output, \`输出缺少键: \${key}\`);
          }
        }
        console.log(formatResult(testCase.name, true, \`\${elapsed}ms\`));
        passedTests++;
      } else {
        // 应该抛出错误但没有抛出
        console.log(formatResult(testCase.name, false, "预期抛出错误但执行成功了"));
      }
    } catch (err) {
      const elapsed = Date.now() - startTime;

      if (!testCase.shouldSucceed) {
        // 预期内的错误
        if (testCase.expectedError && !err.message.includes(testCase.expectedError)) {
          console.log(
            formatResult(
              testCase.name,
              false,
              \`错误消息不匹配: 期望包含 "\${testCase.expectedError}", 实际 "\${err.message}"\`
            )
          );
        } else {
          console.log(formatResult(testCase.name, true, \`预期错误: \${err.message} (\${elapsed}ms)\`));
          passedTests++;
        }
      } else {
        console.log(formatResult(testCase.name, false, \`意外错误: \${err.message} (\${elapsed}ms)\`));
      }
    }
  }

  // ── 总结 ──
  console.log(\`\\n=== 测试结果: \${passedTests}/\${totalTests} 通过 ===\\n\`);

  if (passedTests === totalTests) {
    console.log("[SUCCESS] 所有测试通过！神经元代码验证成功。");
    process.exit(0);
  } else {
    console.log(\`[WARNING] \${totalTests - passedTests} 个测试失败，请检查代码。\`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[FATAL] 验证器执行异常:", err);
  process.exit(1);
});
`;
}
