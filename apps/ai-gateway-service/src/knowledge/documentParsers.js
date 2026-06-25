import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import ExcelJS from "exceljs";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const TEXT_EXTENSIONS = new Set([".txt", ".md", ".markdown", ".json", ".csv", ".log", ".html", ".htm", ".xml", ".yaml", ".yml"]);
const PDF_EXTENSIONS = new Set([".pdf"]);
const WORD_EXTENSIONS = new Set([".docx"]);
const EXCEL_EXTENSIONS = new Set([".xlsx", ".xls"]);

export function getSupportedKnowledgeFileTypes() {
  return {
    text: Array.from(TEXT_EXTENSIONS),
    pdf: Array.from(PDF_EXTENSIONS),
    word: Array.from(WORD_EXTENSIONS),
    excel: Array.from(EXCEL_EXTENSIONS),
    unsupported: [".doc"],
    maxFileBytes: MAX_FILE_BYTES,
    maxFileMegabytes: 100,
  };
}

export async function parseKnowledgeFile(file = {}) {
  const fileName = normalizeFileName(file.fileName ?? file.name);
  const extension = getExtension(fileName);
  const buffer = decodeBase64(file.base64 ?? file.contentBase64);

  if (buffer.length === 0) {
    throw createParserError("KNOWLEDGE_FILE_EMPTY", `${fileName} is empty.`);
  }

  if (buffer.length > MAX_FILE_BYTES) {
    throw createParserError("KNOWLEDGE_FILE_TOO_LARGE", `${fileName} exceeds the 100MB parser limit.`, {
      fileSize: buffer.length,
      maxFileBytes: MAX_FILE_BYTES,
    });
  }

  if (TEXT_EXTENSIONS.has(extension)) {
    return createParsedDocument({
      fileName,
      parser: "text",
      mimeType: file.mimeType,
      fileSize: buffer.length,
      text: buffer.toString("utf8"),
    });
  }

  if (PDF_EXTENSIONS.has(extension)) {
    const parser = new PDFParse({ data: buffer });

    try {
      const result = await parser.getText();
      return createParsedDocument({
        fileName,
        parser: "pdf-parse",
        mimeType: file.mimeType,
        fileSize: buffer.length,
        text: result.text,
      });
    } finally {
      await parser.destroy();
    }
  }

  if (WORD_EXTENSIONS.has(extension)) {
    const result = await mammoth.extractRawText({ buffer });
    return createParsedDocument({
      fileName,
      parser: "mammoth",
      mimeType: file.mimeType,
      fileSize: buffer.length,
      text: result.value,
    });
  }

  if (EXCEL_EXTENSIONS.has(extension)) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheetNames = [];
    const text = [];
    workbook.eachSheet((worksheet) => {
      sheetNames.push(worksheet.name);
      const rows = [];
      worksheet.eachRow({ includeEmpty: false }, (row) => {
        rows.push(row.values.slice(1).map(String).join(","));
      });
      text.push(`# Sheet: ${worksheet.name}`, rows.join("\n"));
    });

    return createParsedDocument({
      fileName,
      parser: "exceljs",
      mimeType: file.mimeType,
      fileSize: buffer.length,
      text: text.join("\n"),
      metadata: {
        sheetNames,
      },
    });
  }

  throw createParserError("KNOWLEDGE_FILE_TYPE_UNSUPPORTED", `${fileName} is not supported by the current document parser.`, {
    extension,
    supported: getSupportedKnowledgeFileTypes(),
  });
}

function createParsedDocument({ fileName, parser, mimeType, fileSize, text, metadata = {} }) {
  const content = String(text ?? "").trim();

  if (!content) {
    throw createParserError("KNOWLEDGE_FILE_NO_TEXT", `${fileName} did not produce readable text.`, {
      parser,
    });
  }

  return {
    documentId: safeDocumentId(fileName),
    title: fileName,
    content,
    metadata: {
      fileName,
      fileType: mimeType || "unknown",
      fileSize,
      parser,
      ...metadata,
    },
  };
}

function decodeBase64(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  // Pre-check: reject absurdly large strings before allocating a Buffer
  // 100 MB binary → ~133 MB base64; cap at 150 MB string to prevent memory exhaustion
  const MAX_BASE64_STRING_LENGTH = 150 * 1024 * 1024;
  if (raw.length > MAX_BASE64_STRING_LENGTH) {
    throw createParserError("KNOWLEDGE_FILE_TOO_LARGE", "Base64 input exceeds maximum safe length.", {
      stringLength: raw.length,
      maxLength: MAX_BASE64_STRING_LENGTH,
    });
  }
  const base64 = raw.includes(",") && raw.startsWith("data:") ? raw.slice(raw.indexOf(",") + 1) : raw;
  return Buffer.from(base64, "base64");
}

function normalizeFileName(value) {
  const normalized = typeof value === "string" ? value.trim().replace(/\\/g, "/").split("/").pop() : "";
  return normalized || "uploaded-document.txt";
}

function getExtension(fileName) {
  const match = String(fileName).toLowerCase().match(/\.[^.]+$/);
  return match ? match[0] : "";
}

function safeDocumentId(value) {
  return String(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "uploaded-document";
}

function createParserError(code, message, details) {
  const error = new Error(message);
  error.code = code;
  error.category = "validation";
  error.details = details;
  return error;
}
