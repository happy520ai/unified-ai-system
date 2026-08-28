import { parentPort, workerData } from "node:worker_threads";

type ParserKind = "pdf" | "word" | "excel";

export interface ParserLimits {
  maxExtractedTextBytes: number;
  maxPdfPages: number;
  maxWorkbookSheets: number;
  maxWorkbookRowsPerSheet: number;
  maxWorkbookColumnsPerSheet: number;
  maxWorkbookCells: number;
}

export interface ParserWorkerInput {
  buffer: ArrayBuffer | Uint8Array;
  kind: ParserKind;
  limits: ParserLimits;
}

export interface ParserResult {
  parser: string;
  text: string;
  metadata?: Record<string, unknown>;
}

const workerPort = parentPort;
if (workerPort) {
  const input = workerData as ParserWorkerInput;
  void parseDocumentInIsolate(input)
    .then((result) => workerPort.postMessage({ ok: true, result }))
    .catch((error: unknown) => workerPort.postMessage({
      ok: false,
      error: serializeParserError(error),
    }));
}

export async function parseDocumentInIsolate(
  { buffer, kind, limits }: ParserWorkerInput,
): Promise<ParserResult> {
  const fileBuffer = Buffer.from(
    buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer,
  );

  if (kind === "pdf") return parsePdf(fileBuffer, limits);
  if (kind === "word") return parseWord(fileBuffer, limits);
  if (kind === "excel") return parseExcel(fileBuffer, limits);
  throw createWorkerError("KNOWLEDGE_FILE_TYPE_UNSUPPORTED", "Unsupported structured document type.");
}

async function parsePdf(buffer: Buffer, limits: ParserLimits): Promise<ParserResult> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const info = await parser.getInfo();
    if (info.total > limits.maxPdfPages) {
      throw createWorkerError(
        "KNOWLEDGE_PDF_PAGE_LIMIT_EXCEEDED",
        `PDF contains ${info.total} pages; the limit is ${limits.maxPdfPages}.`,
        { pageCount: info.total, maxPdfPages: limits.maxPdfPages },
      );
    }
    const result = await parser.getText({ first: limits.maxPdfPages });
    return {
      parser: "pdf-parse",
      text: assertExtractedText(result.text, limits),
      metadata: { pageCount: result.total },
    };
  } finally {
    await parser.destroy();
  }
}

async function parseWord(buffer: Buffer, limits: ParserLimits): Promise<ParserResult> {
  const { default: mammoth } = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return {
    parser: "mammoth",
    text: assertExtractedText(result.value, limits),
    metadata: { parserWarningCount: result.messages.length },
  };
}

async function parseExcel(buffer: Buffer, limits: ParserLimits): Promise<ParserResult> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    sheetRows: limits.maxWorkbookRowsPerSheet + 1,
    cellFormula: false,
    cellHTML: false,
    cellStyles: false,
  });
  const sheetNames = workbook.SheetNames;
  if (sheetNames.length > limits.maxWorkbookSheets) {
    throw createWorkerError(
      "KNOWLEDGE_WORKBOOK_SHEET_LIMIT_EXCEEDED",
      `Workbook contains ${sheetNames.length} sheets; the limit is ${limits.maxWorkbookSheets}.`,
      { sheetCount: sheetNames.length, maxWorkbookSheets: limits.maxWorkbookSheets },
    );
  }

  let totalCells = 0;
  let totalTextBytes = 0;
  const sections: string[] = [];
  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const reference = sheet["!fullref"] ?? sheet["!ref"];
    if (reference) {
      const range = XLSX.utils.decode_range(reference);
      const rowCount = range.e.r - range.s.r + 1;
      const columnCount = range.e.c - range.s.c + 1;
      if (rowCount > limits.maxWorkbookRowsPerSheet) {
        throw createWorkerError(
          "KNOWLEDGE_WORKBOOK_ROW_LIMIT_EXCEEDED",
          `Worksheet exceeds the ${limits.maxWorkbookRowsPerSheet}-row limit.`,
          { sheetName, rowCount, maxRows: limits.maxWorkbookRowsPerSheet },
        );
      }
      if (columnCount > limits.maxWorkbookColumnsPerSheet) {
        throw createWorkerError(
          "KNOWLEDGE_WORKBOOK_COLUMN_LIMIT_EXCEEDED",
          `Worksheet exceeds the ${limits.maxWorkbookColumnsPerSheet}-column limit.`,
          { sheetName, columnCount, maxColumns: limits.maxWorkbookColumnsPerSheet },
        );
      }
      totalCells += rowCount * columnCount;
      if (totalCells > limits.maxWorkbookCells) {
        throw createWorkerError(
          "KNOWLEDGE_WORKBOOK_CELL_LIMIT_EXCEEDED",
          `Workbook exceeds the ${limits.maxWorkbookCells}-cell limit.`,
          { totalCells, maxWorkbookCells: limits.maxWorkbookCells },
        );
      }
    }
    const section = [`# Sheet: ${sheetName}`, XLSX.utils.sheet_to_csv(sheet, { blankrows: false })].join("\n");
    totalTextBytes += Buffer.byteLength(section, "utf8") + (sections.length > 0 ? 2 : 0);
    if (totalTextBytes > limits.maxExtractedTextBytes) {
      throw createWorkerError(
        "KNOWLEDGE_EXTRACTED_TEXT_TOO_LARGE",
        `Extracted text exceeds the ${limits.maxExtractedTextBytes}-byte limit.`,
        { extractedTextBytes: totalTextBytes, maxExtractedTextBytes: limits.maxExtractedTextBytes },
      );
    }
    sections.push(section);
  }

  return {
    parser: "xlsx",
    text: assertExtractedText(sections.join("\n\n"), limits),
    metadata: { sheetNames, totalCells },
  };
}

function assertExtractedText(value: unknown, limits: ParserLimits): string {
  const text = String(value ?? "");
  const extractedTextBytes = Buffer.byteLength(text, "utf8");
  if (extractedTextBytes > limits.maxExtractedTextBytes) {
    throw createWorkerError(
      "KNOWLEDGE_EXTRACTED_TEXT_TOO_LARGE",
      `Extracted text exceeds the ${limits.maxExtractedTextBytes}-byte limit.`,
      { extractedTextBytes, maxExtractedTextBytes: limits.maxExtractedTextBytes },
    );
  }
  return text;
}

function createWorkerError(code: string, message: string, details?: Record<string, unknown>) {
  const error = new Error(message) as Error & { code: string; details?: Record<string, unknown> };
  error.code = code;
  error.details = details;
  return error;
}

export function serializeParserError(error: unknown) {
  const candidate = error as { code?: unknown; message?: unknown; details?: unknown };
  const code = typeof candidate?.code === "string" && candidate.code.startsWith("KNOWLEDGE_")
    ? candidate.code
    : "KNOWLEDGE_PARSER_WORKER_FAILED";
  return {
    code,
    message: code === "KNOWLEDGE_PARSER_WORKER_FAILED"
      ? "The isolated document parser failed."
      : String(candidate.message ?? "Document parsing failed."),
    details: candidate?.details && typeof candidate.details === "object" ? candidate.details : undefined,
  };
}
