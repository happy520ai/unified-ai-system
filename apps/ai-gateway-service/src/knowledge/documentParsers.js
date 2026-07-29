import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import * as XLSX from "xlsx";

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
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const text = workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      return [`# Sheet: ${sheetName}`, csv].join("\n");
    }).join("\n\n");

    return createParsedDocument({
      fileName,
      parser: "xlsx",
      mimeType: file.mimeType,
      fileSize: buffer.length,
      text,
      metadata: {
        sheetNames: workbook.SheetNames,
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
