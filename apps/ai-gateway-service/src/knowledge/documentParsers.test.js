// @test-isolation process
import { describe, expect, it } from "vitest";
import {
  assertKnowledgeFileBatch,
  DOCUMENT_PARSER_LIMITS,
  getSupportedKnowledgeFileTypes,
  parseKnowledgeFile,
} from "./documentParsers.js";

describe("document parser resource boundaries", () => {
  it("publishes bounded parser limits", () => {
    expect(getSupportedKnowledgeFileTypes()).toEqual(expect.objectContaining({
      maxFileBytes: 25 * 1024 * 1024,
      maxExtractedTextBytes: 5 * 1024 * 1024,
      maxPdfPages: 200,
      maxFilesPerRequest: 10,
      parserIsolation: "bounded-worker-thread",
    }));
  });

  it("rejects malformed base64 before invoking a parser", async () => {
    await expect(parseKnowledgeFile({
      fileName: "bad.docx",
      base64: "not base64!",
    })).rejects.toMatchObject({ code: "KNOWLEDGE_FILE_BASE64_INVALID" });
  });

  it("rejects oversized extracted text", async () => {
    const content = Buffer.alloc(DOCUMENT_PARSER_LIMITS.maxExtractedTextBytes + 1, 0x61);
    await expect(parseKnowledgeFile({
      fileName: "too-large.txt",
      base64: content.toString("base64"),
    })).rejects.toMatchObject({ code: "KNOWLEDGE_EXTRACTED_TEXT_TOO_LARGE" });
  });

  it("caps files per request before parsing", () => {
    const files = Array.from(
      { length: DOCUMENT_PARSER_LIMITS.maxFilesPerRequest + 1 },
      (_, index) => ({ fileName: `${index}.txt`, base64: "YQ==" }),
    );
    expect(() => assertKnowledgeFileBatch(files)).toThrow(expect.objectContaining({
      code: "KNOWLEDGE_FILE_BATCH_COUNT_EXCEEDED",
    }));
  });
});

describe("spreadsheet document parsing", () => {
  it.each([
    ["status.xlsx", () => createMinimalXlsx()],
    ["status.xls", () => createSpreadsheetMlWorkbook()],
  ])("parses generated %s workbooks", async (fileName, createFixture) => {
    const buffer = createFixture();

    const parsed = await parseKnowledgeFile({
      fileName,
      base64: buffer.toString("base64"),
    });

    expect(parsed.metadata.parser).toBe("xlsx");
    expect(parsed.metadata.sheetNames).toEqual(["Status"]);
    expect(parsed.metadata.totalCells).toBe(4);
    expect(parsed.content).toContain("gateway,ready");
  });

  it("rejects workbooks with too many sheets inside the isolated worker", async () => {
    const buffer = createMinimalXlsx({
      sheetCount: DOCUMENT_PARSER_LIMITS.maxWorkbookSheets + 1,
    });

    await expect(parseKnowledgeFile({
      fileName: "too-many-sheets.xlsx",
      base64: buffer.toString("base64"),
    })).rejects.toMatchObject({ code: "KNOWLEDGE_WORKBOOK_SHEET_LIMIT_EXCEEDED" });
  });

  it("rejects worksheets wider than the column cap", async () => {
    const buffer = createMinimalXlsx({ wide: true });

    await expect(parseKnowledgeFile({
      fileName: "too-wide.xlsx",
      base64: buffer.toString("base64"),
    })).rejects.toMatchObject({ code: "KNOWLEDGE_WORKBOOK_COLUMN_LIMIT_EXCEEDED" });
  });
});

describe("isolated PDF and Word parsing", () => {
  it("parses a bounded PDF in the worker", async () => {
    const parsed = await parseKnowledgeFile({
      fileName: "sample.pdf",
      base64: createMinimalPdf("Hello bounded PDF").toString("base64"),
    });

    expect(parsed.metadata).toEqual(expect.objectContaining({
      parser: "pdf-parse",
      pageCount: 1,
    }));
    expect(parsed.content).toContain("Hello bounded PDF");
  });

  it("parses a bounded DOCX in the worker", async () => {
    const parsed = await parseKnowledgeFile({
      fileName: "sample.docx",
      base64: createMinimalDocx("Hello bounded Word").toString("base64"),
    });

    expect(parsed.metadata).toEqual(expect.objectContaining({
      parser: "mammoth",
      parserWarningCount: 0,
    }));
    expect(parsed.content).toBe("Hello bounded Word");
  });
});

function createMinimalDocx(text) {
  return createStoredZip({
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    "word/document.xml": `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`,
  });
}

function createMinimalXlsx({ sheetCount = 1, wide = false } = {}) {
  const sheetEntries = [];
  const relationships = [];
  const overrides = [];
  const files = {};
  for (let index = 1; index <= sheetCount; index += 1) {
    const sheetName = sheetCount === 1 ? (wide ? "Wide" : "Status") : `S${index - 1}`;
    sheetEntries.push(`<sheet name="${sheetName}" sheetId="${index}" r:id="rId${index}"/>`);
    relationships.push(`<Relationship Id="rId${index}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index}.xml"/>`);
    overrides.push(`<Override PartName="/xl/worksheets/sheet${index}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
    files[`xl/worksheets/sheet${index}.xml`] = wide
      ? `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:IW1"/><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>first</t></is></c><c r="IW1" t="inlineStr"><is><t>last</t></is></c></row></sheetData></worksheet>`
      : `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:B2"/><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>name</t></is></c><c r="B1" t="inlineStr"><is><t>status</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>gateway</t></is></c><c r="B2" t="inlineStr"><is><t>ready</t></is></c></row></sheetData></worksheet>`;
  }
  files["[Content_Types].xml"] = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides.join("")}</Types>`;
  files["_rels/.rels"] = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  files["xl/workbook.xml"] = `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetEntries.join("")}</sheets></workbook>`;
  files["xl/_rels/workbook.xml.rels"] = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships.join("")}</Relationships>`;
  return createStoredZip(files);
}

function createSpreadsheetMlWorkbook() {
  return Buffer.from(`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Status"><Table><Row><Cell><Data ss:Type="String">name</Data></Cell><Cell><Data ss:Type="String">status</Data></Cell></Row><Row><Cell><Data ss:Type="String">gateway</Data></Cell><Cell><Data ss:Type="String">ready</Data></Cell></Row></Table></Worksheet></Workbook>`);
}

function createStoredZip(files) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  for (const [name, value] of Object.entries(files)) {
    const nameBuffer = Buffer.from(name);
    const data = Buffer.isBuffer(value) ? value : Buffer.from(value);
    const checksum = crc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localParts.push(localHeader, nameBuffer, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralParts.push(centralHeader, nameBuffer);
    localOffset += localHeader.length + nameBuffer.length + data.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createMinimalPdf(text) {
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  const addObject = (id, body) => {
    offsets[id] = Buffer.byteLength(pdf, "ascii");
    pdf += `${id} 0 obj\n${body}\nendobj\n`;
  };
  addObject(1, "<< /Type /Catalog /Pages 2 0 R >>");
  addObject(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  addObject(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>");
  addObject(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  addObject(5, `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`);
  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += "xref\n0 6\n0000000000 65535 f \n";
  for (let id = 1; id <= 5; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "ascii");
}
