// =============================================================================
// 神经元代码生成器 — 纯函数工具与提示词构建
//
// 从 neuronCodeGenerator.js 拆分的辅助模块。
// 包含命名转换、代码块提取、AI 提示词构建等纯函数。
// =============================================================================

// ---------------------------------------------------------------------------
// 命名转换
// ---------------------------------------------------------------------------

/**
 * 将 PascalCase 或 kebab-case 的 capabilityId 转换为工厂函数名
 * 例如: "token-compressor" -> "createTokenCompressorNeuron"
 *
 * @param {string} capabilityId - 能力ID（kebab-case）
 * @returns {string} 工厂函数名
 */
export function toFactoryFunctionName(capabilityId) {
  const pascal = capabilityId
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  return `create${pascal}Neuron`;
}

// ---------------------------------------------------------------------------
// AI 响应代码提取
// ---------------------------------------------------------------------------

/**
 * 从 AI 返回的文本中提取 JavaScript 代码块
 *
 * @param {string} rawText - AI 返回的原始文本
 * @returns {string|null} 提取出的代码，或 null
 */
export function extractCodeFromResponse(rawText) {
  if (!rawText || typeof rawText !== "string") return null;

  // 策略 1: 提取 ```javascript ... ``` 代码块
  const jsBlockMatch = rawText.match(/```(?:javascript|js|mjs)\s*\n([\s\S]*?)\n\s*```/);
  if (jsBlockMatch) {
    return jsBlockMatch[1].trim();
  }

  // 策略 2: 提取任意 ``` ... ``` 代码块
  const anyBlockMatch = rawText.match(/```\s*\n([\s\S]*?)\n\s*```/);
  if (anyBlockMatch) {
    return anyBlockMatch[1].trim();
  }

  // 策略 3: 检查是否整段就是代码（以 import/export/function 开头）
  const trimmed = rawText.trim();
  if (/^(import |export |\/\*\*|\/\/|const |function )/m.test(trimmed)) {
    return trimmed;
  }

  return null;
}

// ---------------------------------------------------------------------------
// 代码生成提示词
// ---------------------------------------------------------------------------

/**
 * 构建代码生成提示词
 *
 * @param {object} capabilitySpec - 完整的 CapabilitySpec
 * @returns {string} 完整的提示词
 */
export function buildCodeGenPrompt(capabilitySpec) {
  const factoryName = toFactoryFunctionName(capabilitySpec.capabilityId);
  const inputsDesc = JSON.stringify(capabilitySpec.inputs, null, 2);
  const outputsDesc = JSON.stringify(capabilitySpec.outputs, null, 2);
  const exampleUsage = capabilitySpec.exampleUsage
    ? JSON.stringify(capabilitySpec.exampleUsage, null, 2)
    : "无示例";

  return `你是一个专业的 JavaScript 代码生成器。请根据以下能力神经元规格 (CapabilitySpec) 生成一个完整的、可运行的 ESM 模块。

## 能力规格 (CapabilitySpec)

- **能力ID**: ${capabilitySpec.capabilityId}
- **显示名称**: ${capabilitySpec.displayName}
- **功能描述**: ${capabilitySpec.description}
- **能力类型**: ${capabilitySpec.type}
- **复杂度**: ${capabilitySpec.estimatedComplexity || "simple"}

### 输入参数
${inputsDesc}

### 输出格式
${outputsDesc}

### 安全约束
${JSON.stringify(capabilitySpec.safetyConstraints || [], null, 2)}

### 示例用法
${exampleUsage}

## 代码生成约束（必须严格遵守）

1. **语法**: 使用 ESM (import/export) 语法
2. **纯函数**: 无全局副作用，不修改外部状态
3. **导出工厂函数**: 导出 \`${factoryName}(options)\` 工厂函数
4. **工厂函数返回接口**: \`{ execute(input, context) => output }\`
5. **禁止网络请求**: 不得调用 fetch、http.request 等
6. **禁止文件系统**: 不得读写文件（除非 spec 明确允许）
7. **禁止环境变量**: 不得访问 process.env
8. **禁止动态代码**: 不得使用 eval、new Function、动态 import
9. **禁止子进程**: 不得调用 child_process
10. **超时控制**: execute() 函数必须在 ${capabilitySpec.runtime?.ttlSeconds || 300} 秒内完成

## 代码模板（参考此结构）

\`\`\`javascript
/**
 * ${capabilitySpec.displayName}
 * ${capabilitySpec.description}
 *
 * @module ${capabilitySpec.capabilityId}
 */

/**
 * 创建 ${capabilitySpec.displayName} 神经元实例
 * @param {object} [options={}] - 初始化配置
 * @returns {{ execute: (input: object, context?: object) => Promise<object> }}
 */
export function ${factoryName}(options = {}) {
  // 初始化逻辑（解析 options，构建内部状态等）

  return {
    /**
     * 执行能力神经元
     * @param {object} input - 输入参数
     * @param {object} [context={}] - 运行上下文
     * @returns {Promise<object>} 执行结果
     */
    async execute(input, context = {}) {
      // 1. 输入验证
      // 2. 核心处理逻辑
      // 3. 构建输出
      // 4. 返回结果
    },
  };
}
\`\`\`

## 要求
- 生成完整的、可直接使用的代码
- 包含完整的 JSDoc 注释（中文）
- 包含输入验证逻辑
- 包含错误处理（抛出有意义的错误消息）
- 只输出 JavaScript 代码（用 \`\`\`javascript 包裹），不要包含其他说明文字`;
}
