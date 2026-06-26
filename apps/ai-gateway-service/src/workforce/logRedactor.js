/**
 * logRedactor.js
 *
 * 日志脱敏模块
 *
 * 功能：
 * - 自动检测并脱敏日志中的敏感信息
 * - 检测模式：
 *   - API Keys（sk-*, nvapi-*, AIza* 等常见前缀）
 *   - Bearer tokens
 *   - 邮箱地址
 *   - IP 地址
 *   - 路径中的用户名（C:\Users\xxx 或 /home/xxx）
 *   - 16位以上的十六进制字符串
 * - 脱敏方式：保留前3后3，中间用 **** 替换
 * - 提供 redactString(text) 和 redactObject(obj) 方法
 */

// 敏感信息检测正则表达式列表
const REDACTION_PATTERNS = [
  {
    name: "OpenAI API Key",
    pattern: /sk-[A-Za-z0-9_-]{8,}/g,
    type: "api_key",
  },
  {
    name: "NVIDIA API Key",
    pattern: /nvapi-[A-Za-z0-9_-]{8,}/g,
    type: "api_key",
  },
  {
    name: "Google API Key",
    pattern: /AIza[A-Za-z0-9_-]{12,}/g,
    type: "api_key",
  },
  {
    name: "Anthropic API Key",
    pattern: /sk-ant-[A-Za-z0-9_-]{8,}/g,
    type: "api_key",
  },
  {
    name: "通用 API Key 赋值",
    pattern: /((?:api[_-]?key|apikey|token|secret|password|authorization|auth)[\s]*[:=][\s]*["']?)([A-Za-z0-9_\-./+]{8,})/gi,
    type: "key_value",
    keepPrefix: true,
  },
  {
    name: "Bearer Token",
    pattern: /(Bearer\s+)([A-Za-z0-9_\-./+]{8,})/gi,
    type: "bearer",
    keepPrefix: true,
  },
  {
    name: "邮箱地址",
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    type: "email",
  },
  {
    name: "IPv4 地址",
    pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    type: "ip",
  },
  {
    name: "Windows 用户路径",
    pattern: /(C:\\Users\\)([^\\]+)/gi,
    type: "path_user",
    keepPrefix: true,
  },
  {
    name: "Unix 用户路径",
    pattern: /(\/home\/)([^/]+)/gi,
    type: "path_user",
    keepPrefix: true,
  },
  {
    name: "长十六进制字符串",
    pattern: /\b[0-9a-fA-F]{16,}\b/g,
    type: "hex",
    minLength: 16,
  },
  {
    name: "GitHub Token",
    pattern: /gh[pousr]_[A-Za-z0-9_]{8,}/g,
    type: "api_key",
  },
  {
    name: "AWS Access Key",
    pattern: /AKIA[A-Z0-9]{12,}/g,
    type: "api_key",
  },
  {
    name: "JWT Token",
    pattern: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    type: "jwt",
  },
];

/**
 * 创建日志脱敏器
 * @param {object} [options] - 配置选项
 * @param {boolean} [options.redactEmails] - 是否脱敏邮箱（默认 true）
 * @param {boolean} [options.redactIPs] - 是否脱敏 IP（默认 true）
 * @param {boolean} [options.redactPaths] - 是否脱敏路径用户名（默认 true）
 * @param {boolean} [options.redactHex] - 是否脱敏长十六进制字符串（默认 true）
 * @param {string} [options.replacement] - 脱敏替换字符（默认 "****"）
 * @returns {object} 日志脱敏器实例
 */
export function createLogRedactor(options = {}) {
  const redactEmails = options.redactEmails !== false;
  const redactIPs = options.redactIPs !== false;
  const redactPaths = options.redactPaths !== false;
  const redactHex = options.redactHex !== false;
  const replacement = options.replacement || "****";

  // 根据选项过滤模式
  function getActivePatterns() {
    return REDACTION_PATTERNS.filter((p) => {
      if (p.type === "email" && !redactEmails) return false;
      if (p.type === "ip" && !redactIPs) return false;
      if (p.type === "path_user" && !redactPaths) return false;
      if (p.type === "hex" && !redactHex) return false;
      return true;
    });
  }

  return {
    /**
     * 获取模块信息
     */
    getInfo() {
      return {
        module: "logRedactor",
        version: "1.0.0",
        redactEmails,
        redactIPs,
        redactPaths,
        redactHex,
        activePatterns: getActivePatterns().length,
        description: "日志脱敏模块：自动检测并脱敏敏感信息",
      };
    },

    /**
     * 脱敏字符串中的敏感信息
     * @param {string} text - 需要脱敏的文本
     * @returns {string} 脱敏后的文本
     */
    redactString(text) {
      if (typeof text !== "string" || !text) return text;

      let result = text;
      const patterns = getActivePatterns();

      for (const { pattern, type, keepPrefix } of patterns) {
        // 重置正则状态
        pattern.lastIndex = 0;

        result = result.replace(pattern, (match, ...args) => {
          if (keepPrefix && args.length > 1) {
            // 保留前缀（如 "Bearer ", "C:\Users\" 等）
            const prefix = args[0];
            const sensitive = args[1];
            return prefix + maskSensitive(sensitive, replacement);
          }
          return maskSensitive(match, replacement);
        });
      }

      return result;
    },

    /**
     * 脱敏对象中的敏感信息（递归处理）
     * @param {*} obj - 需要脱敏的对象
     * @param {number} [depth] - 当前递归深度（防止循环引用）
     * @returns {*} 脱敏后的对象
     */
    redactObject(obj, depth = 0) {
      // 防止过深递归
      if (depth > 20) return obj;

      if (typeof obj === "string") {
        return this.redactString(obj);
      }

      if (Array.isArray(obj)) {
        return obj.map((item) => this.redactObject(item, depth + 1));
      }

      if (obj && typeof obj === "object") {
        // 处理 Date 对象
        if (obj instanceof Date) return obj;

        // 处理 Buffer
        if (Buffer.isBuffer(obj)) return "[Buffer redacted]";

        const result = {};
        for (const [key, value] of Object.entries(obj)) {
          // 对敏感字段名特殊处理
          if (isSensitiveFieldName(key)) {
            if (typeof value === "string") {
              result[key] = maskSensitive(value, replacement);
            } else {
              result[key] = this.redactObject(value, depth + 1);
            }
          } else {
            result[key] = this.redactObject(value, depth + 1);
          }
        }
        return result;
      }

      return obj;
    },

    /**
     * 检测文本中是否包含敏感信息（不修改原文）
     * @param {string} text - 待检测文本
     * @returns {object} 检测结果
     */
    detect(text) {
      if (typeof text !== "string" || !text) {
        return { hasSensitive: false, detections: [] };
      }

      const detections = [];
      const patterns = getActivePatterns();

      for (const { name, pattern, type } of patterns) {
        pattern.lastIndex = 0;
        const matches = text.match(pattern);
        if (matches) {
          detections.push({
            name,
            type,
            count: matches.length,
            samples: matches.slice(0, 3).map((m) => maskSensitive(m, replacement)),
          });
        }
      }

      return {
        hasSensitive: detections.length > 0,
        detectionCount: detections.reduce((sum, d) => sum + d.count, 0),
        detections,
      };
    },
  };
}

// ---- 内部辅助函数 ----

/**
 * 脱敏处理：保留前3后3，中间用替换字符填充
 * @param {string} value - 敏感值
 * @param {string} replacement - 替换字符
 * @returns {string} 脱敏后的值
 */
function maskSensitive(value, replacement = "****") {
  if (!value || typeof value !== "string") return value;
  if (value.length <= 6) return replacement;

  const prefix = value.slice(0, 3);
  const suffix = value.slice(-3);
  return `${prefix}${replacement}${suffix}`;
}

/**
 * 判断字段名是否可能包含敏感信息
 */
function isSensitiveFieldName(key) {
  const sensitiveKeys = [
    "password", "secret", "token", "apikey", "api_key",
    "authorization", "auth", "credential", "private_key",
    "privateKey", "accessKey", "access_key", "secretKey",
    "secret_key", "apiKey", "accessToken", "refreshToken",
  ];
  const lowerKey = key.toLowerCase();
  return sensitiveKeys.some((sk) => lowerKey.includes(sk.toLowerCase()));
}
