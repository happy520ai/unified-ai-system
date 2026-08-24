import { Worker } from "node:worker_threads";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_BATCH_FILE_BYTES = 50 * 1024 * 1024;
const MAX_FILES_PER_REQUEST = 10;
const MAX_EXTRACTED_TEXT_BYTES = 5 * 1024 * 1024;
const MAX_PDF_PAGES = 200;
const MAX_WORKBOOK_SHEETS = 32;
const MAX_WORKBOOK_ROWS_PER_SHEET = 10_000;
const MAX_WORKBOOK_COLUMNS_PER_SHEET = 256;
const MAX_WORKBOOK_CELLS = 200_000;
const PARSER_TIMEOUT_MS = 15_000;
const MAX_ACTIVE_PARSER_WORKERS = 2;
const MAX_QUEUED_PARSER_JOBS = 4;
const MAX_FILE_NAME_CHARS = 256;
const TEXT_EXTENSIONS = new Set([".txt", ".md", ".markdown", ".json", ".csv", ".log", ".html", ".htm", ".xml", ".yaml", ".yml"]);
const PDF_EXTENSIONS = new Set([".pdf"]);
const WORD_EXTENSIONS = new Set([".docx"]);
const EXCEL_EXTENSIONS = new Set([".xlsx", ".xls"]);
const parserQueue = [];
let activeParserWorkers = 0;

export const DOCUMENT_PARSER_LIMITS = Object.freeze({
  maxFileBytes: MAX_FILE_BYTES,
  maxBatchFileBytes: MAX_BATCH_FILE_BYTES,
  maxFilesPerRequest: MAX_FILES_PER_REQUEST,
  maxExtractedTextBytes: MAX_EXTRACTED_TEXT_BYTES,
  maxPdfPages: MAX_PDF_PAGES,
  maxWorkbookSheets: MAX_WORKBOOK_SHEETS,
  maxWorkbookRowsPerSheet: MAX_WORKBOOK_ROWS_PER_SHEET,
  maxWorkbookColumnsPerSheet: MAX_WORKBOOK_COLUMNS_PER_SHEET,
  maxWorkbookCells: MAX_WORKBOOK_CELLS,
  parserTimeoutMs: PARSER_TIMEOUT_MS,
  maxActiveParserWorkers: MAX_ACTIVE_PARSER_WORKERS,
  maxQueuedParserJobs: MAX_QUEUED_PARSER_JOBS,
});

export function getSupportedKnowledgeFileTypes() {
  return {
    text: Array.from(TEXT_EXTENSIONS),
    pdf: Array.from(PDF_EXTENSIONS),
    word: Array.from(WORD_EXTENSIONS),
    excel: Array.from(EXCEL_EXTENSIONS),
    unsupported: [".doc"],
    maxFileBytes: MAX_FILE_BYTES,
    maxFileMegabytes: MAX_FILE_BYTES / 1024 / 1024,
    ...DOCUMENT_PARSER_LIMITS,
    parserIsolation: "bounded-worker-thread",
  };
}

export function assertKnowledgeFileBatch(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw createParserError("KNOWLEDGE_FILE_LOAD_FILES_REQUIRED", "Knowledge file load requires at least one file.");
  }
  if (files.length > MAX_FILES_PER_REQUEST) {
    throw createParserError(
      "KNOWLEDGE_FILE_BATCH_COUNT_EXCEEDED",
      `Knowledge file load accepts at most ${MAX_FILES_PER_REQUEST} files per request.`,
      { fileCount: files.length, maxFilesPerRequest: MAX_FILES_PER_REQUEST },
    );
  }
  const estimatedBytes = files.reduce((sum, file) => sum + estimateDecodedBase64Bytes(file?.base64 ?? file?.contentBase64), 0);
  if (estimatedBytes > MAX_BATCH_FILE_BYTES) {
    throw createParserError(
      "KNOWLEDGE_FILE_BATCH_TOO_LARGE",
      `Knowledge file batch exceeds the ${MAX_BATCH_FILE_BYTES}-byte limit.`,
      { estimatedBytes, maxBatchFileBytes: MAX_BATCH_FILE_BYTES },
    );
  }
}

export async function parseKnowledgeFile(file = {}) {
  const fileName = normalizeFileName(file.fileName ?? file.name);
  const extension = getExtension(fileName);
  const buffer = decodeBase64(file.base64 ?? file.contentBase64);

  if (buffer.length === 0) {
    throw createParserError("KNOWLEDGE_FILE_EMPTY", `${fileName} is empty.`);
  }

  if (buffer.length > MAX_FILE_BYTES) {
    throw createParserError("KNOWLEDGE_FILE_TOO_LARGE", `${fileName} exceeds the ${MAX_FILE_BYTES}-byte parser limit.`, {
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

  const parserKind = PDF_EXTENSIONS.has(extension)
    ? "pdf"
    : WORD_EXTENSIONS.has(extension)
      ? "word"
      : EXCEL_EXTENSIONS.has(extension)
        ? "excel"
        : null;
  if (parserKind) {
    const result = await scheduleParserJob(() => runParserWorker({ buffer, kind: parserKind }));
    return createParsedDocument({
      fileName,
      parser: result.parser,
      mimeType: file.mimeType,
      fileSize: buffer.length,
      text: result.text,
      metadata: result.metadata,
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
  const extractedTextBytes = Buffer.byteLength(content, "utf8");
  if (extractedTextBytes > MAX_EXTRACTED_TEXT_BYTES) {
    throw createParserError("KNOWLEDGE_EXTRACTED_TEXT_TOO_LARGE", `${fileName} produced too much text.`, {
      parser,
      extractedTextBytes,
      maxExtractedTextBytes: MAX_EXTRACTED_TEXT_BYTES,
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
  if (!raw) return Buffer.alloc(0);
  let base64 = raw;
  if (raw.startsWith("data:")) {
    const commaIndex = raw.indexOf(",");
    const header = commaIndex >= 0 ? raw.slice(0, commaIndex) : raw;
    if (commaIndex < 0 || header.length > 1024 || !/;base64$/i.test(header)) {
      throw createParserError("KNOWLEDGE_FILE_BASE64_INVALID", "Knowledge file data URL must contain bounded base64 data.");
    }
    base64 = raw.slice(commaIndex + 1);
  }
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 === 1) {
    throw createParserError("KNOWLEDGE_FILE_BASE64_INVALID", "Knowledge file content must be valid base64.");
  }
  const normalized = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  if (estimateDecodedBase64Bytes(normalized) > MAX_FILE_BYTES) {
    throw createParserError("KNOWLEDGE_FILE_TOO_LARGE", "Knowledge file exceeds the parser input limit.", {
      maxFileBytes: MAX_FILE_BYTES,
    });
  }
  return Buffer.from(normalized, "base64");
}

function normalizeFileName(value) {
  const normalized = typeof value === "string" ? value.trim().replace(/\\/g, "/").split("/").pop() : "";
  return normalized?.slice(0, MAX_FILE_NAME_CHARS) || "uploaded-document.txt";
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

function estimateDecodedBase64Bytes(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  const base64 = raw.startsWith("data:") && raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor(base64.length / 4) * 3 - padding);
}

function scheduleParserJob(task) {
  return new Promise((resolve, reject) => {
    if (activeParserWorkers >= MAX_ACTIVE_PARSER_WORKERS && parserQueue.length >= MAX_QUEUED_PARSER_JOBS) {
      reject(createParserError(
        "KNOWLEDGE_PARSER_CAPACITY_EXCEEDED",
        "The isolated document parser is at capacity.",
        { maxActiveParserWorkers: MAX_ACTIVE_PARSER_WORKERS, maxQueuedParserJobs: MAX_QUEUED_PARSER_JOBS },
        { category: "availability", retryable: true },
      ));
      return;
    }
    const job = { task, resolve, reject };
    if (activeParserWorkers < MAX_ACTIVE_PARSER_WORKERS) executeParserJob(job);
    else parserQueue.push(job);
  });
}

function executeParserJob(job) {
  activeParserWorkers += 1;
  Promise.resolve()
    .then(job.task)
    .then(job.resolve, job.reject)
    .finally(() => {
      activeParserWorkers -= 1;
      const next = parserQueue.shift();
      if (next) executeParserJob(next);
    });
}

function runParserWorker({ buffer, kind }) {
  const transferable = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const worker = new Worker(new URL("./documentParserWorker.ts", import.meta.url), {
    // Do not inherit test-runner/debug/loader flags into the untrusted parser worker.
    execArgv: [],
    workerData: { buffer: transferable, kind, limits: DOCUMENT_PARSER_LIMITS },
    transferList: [transferable],
    resourceLimits: {
      maxOldGenerationSizeMb: 128,
      maxYoungGenerationSizeMb: 16,
      stackSizeMb: 4,
    },
  });

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate().catch(() => undefined).finally(() => callback(value));
    };
    const timer = setTimeout(() => finish(
      reject,
      createParserError("KNOWLEDGE_PARSER_TIMEOUT", "The isolated document parser exceeded its time limit.", {
        parserTimeoutMs: PARSER_TIMEOUT_MS,
      }),
    ), PARSER_TIMEOUT_MS);
    timer.unref?.();

    worker.once("message", (message) => {
      if (message?.ok === true && message.result) {
        finish(resolve, message.result);
        return;
      }
      finish(reject, createParserError(
        message?.error?.code ?? "KNOWLEDGE_PARSER_WORKER_FAILED",
        message?.error?.message ?? "The isolated document parser failed.",
        message?.error?.details,
      ));
    });
    worker.once("error", (error) => finish(
      reject,
      createParserError(
        error?.code === "ERR_WORKER_OUT_OF_MEMORY"
          ? "KNOWLEDGE_PARSER_RESOURCE_LIMIT_EXCEEDED"
          : "KNOWLEDGE_PARSER_WORKER_FAILED",
        "The isolated document parser failed within its resource boundary.",
      ),
    ));
    worker.once("exit", (code) => {
      if (!settled) {
        finish(reject, createParserError(
          "KNOWLEDGE_PARSER_WORKER_FAILED",
          "The isolated document parser exited before producing a result.",
          { exitCode: code },
        ));
      }
    });
  });
}

function createParserError(code, message, details, options = {}) {
  const error = new Error(message);
  error.code = code;
  error.category = options.category ?? "validation";
  error.retryable = options.retryable === true;
  error.details = details;
  return error;
}
