/**
 * Image Analysis Tool — 图片/截图分析
 *
 * 对标 Claude Code 的截图分析能力:
 * - 读取本地图片文件
 * - 将图片转为 base64 编码
 * - 发送给支持视觉的 LLM 进行分析
 * - 返回结构化分析结果
 *
 * @module imageAnalysisTool
 */

import { readFileSync, existsSync, statSync, realpathSync } from "node:fs";
import { extname, basename, resolve } from "node:path";
import { buildTool, createInputSchema } from "../claude-code-patterns/toolCore.js";

const SUPPORTED_FORMATS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg",
]);

const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20MB

const MIME_MAP = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
};

/**
 * 验证路径安全性 — 防止路径遍历和符号链接逃逸。
 *
 * @param {string} filePath - 用户提供的文件路径
 * @returns {{ safe: boolean, error?: string }}
 */
function validatePathSecurity(filePath) {
  if (!filePath || typeof filePath !== "string") {
    return { safe: false, error: "file_path must be a non-empty string." };
  }

  const workDir = resolve(process.cwd());
  const resolvedPath = resolve(filePath);

  if (!resolvedPath.startsWith(workDir)) {
    return { safe: false, error: "Path traversal detected. File path must not escape the working directory." };
  }

  // Resolve symlinks to catch indirect escapes
  if (existsSync(resolvedPath)) {
    try {
      const realPath = realpathSync(resolvedPath);
      if (!realPath.startsWith(workDir)) {
        return { safe: false, error: "Path traversal detected via symlink. Real path escapes the working directory." };
      }
    } catch {
      // realpathSync may fail on some platforms; proceed with resolved check
    }
  }

  return { safe: true };
}

/**
 * 读取图片文件并返回 base64 数据。
 */
function readImageAsBase64(filePath) {
  // Path security check
  const pathCheck = validatePathSecurity(filePath);
  if (!pathCheck.safe) {
    return { error: pathCheck.error, code: "PATH_TRAVERSAL_BLOCKED" };
  }

  const ext = extname(filePath).toLowerCase();
  if (!SUPPORTED_FORMATS.has(ext)) {
    return { error: `Unsupported image format: ${ext}. Supported: ${[...SUPPORTED_FORMATS].join(", ")}` };
  }

  if (!existsSync(filePath)) {
    return { error: `File not found: ${filePath}` };
  }

  const stat = statSync(filePath);
  if (stat.size > MAX_IMAGE_BYTES) {
    return { error: `File too large: ${(stat.size / 1024 / 1024).toFixed(1)}MB. Max is 20MB.` };
  }

  const buffer = readFileSync(filePath);
  const base64 = buffer.toString("base64");
  const mimeType = MIME_MAP[ext] || "image/png";

  return {
    base64,
    mimeType,
    size: stat.size,
    dataUri: `data:${mimeType};base64,${base64}`,
  };
}

/**
 * 创建 image_analyze 工具。
 */
export function createImageAnalysisTool() {
  return buildTool({
    name: "image_analyze",
    description: `Analyze an image file (screenshot, diagram, UI mockup, etc.).
Reads the image and provides it as visual context for analysis.
The image is sent to the LLM as a base64-encoded attachment.

Supported formats: PNG, JPG, JPEG, GIF, WebP, BMP, SVG.
Max file size: 20MB.

Use this when:
- The user shares a screenshot and asks "what's wrong with this UI?"
- You need to analyze a diagram or flowchart
- You need to read text from an image (OCR-like)
- You need to compare a UI mockup with the actual implementation`,
    inputSchema: createInputSchema(
      {
        file_path: {
          type: "string",
          description: "Absolute path to the image file",
        },
        question: {
          type: "string",
          description: "Specific question about the image (e.g. 'What UI elements are visible?', 'Is there a bug in this screenshot?')",
        },
      },
      ["file_path"]
    ),
    requiredPermissions: ["file:read"],
    isReadOnly: true,

    async execute(params) {
      const { file_path, question } = params;

      const imageData = readImageAsBase64(file_path);
      if (imageData.error) {
        return {
          status: "error",
          error: imageData.error,
          code: imageData.code || "IMAGE_READ_ERROR",
        };
      }

      return {
        status: "success",
        file_path,
        fileName: basename(file_path),
        mimeType: imageData.mimeType,
        sizeBytes: imageData.size,
        base64: imageData.base64,
        question: question || "Describe what you see in this image.",
        // Note: The actual vision analysis happens at the LLM level.
        // This tool provides the image data; the agentic loop sends it
        // as a multimodal message to the provider.
        _imageAttachment: {
          type: "image",
          mimeType: imageData.mimeType,
          base64: imageData.base64,
          dataUri: imageData.dataUri,
        },
      };
    },
  });
}

/**
 * 创建 image_read 工具 (简化版 — 只返回图片元数据 + base64)。
 * 用于让 LLM 直接"看到"图片。
 */
export function createImageReadTool() {
  return buildTool({
    name: "image_read",
    description: "Read an image file and return it as visual context. The image will be included in the response for visual analysis.",
    inputSchema: createInputSchema(
      {
        file_path: {
          type: "string",
          description: "Absolute path to the image file",
        },
      },
      ["file_path"]
    ),
    requiredPermissions: ["file:read"],
    isReadOnly: true,

    async execute(params) {
      const imageData = readImageAsBase64(params.file_path);
      if (imageData.error) {
        return { status: "error", error: imageData.error, code: imageData.code || "IMAGE_READ_ERROR" };
      }

      return {
        status: "success",
        file_path: params.file_path,
        mimeType: imageData.mimeType,
        sizeBytes: imageData.size,
        _imageAttachment: {
          type: "image",
          mimeType: imageData.mimeType,
          base64: imageData.base64,
          dataUri: imageData.dataUri,
        },
      };
    },
  });
}
