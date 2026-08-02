import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseKnowledgeFile } from "./documentParsers.js";

describe("spreadsheet document parsing", () => {
  it.each([
    ["status.xlsx", "xlsx"],
    ["status.xls", "biff8"],
  ])("parses generated %s workbooks", async (fileName, bookType) => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["name", "status"],
      ["gateway", "ready"],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Status");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType });

    const parsed = await parseKnowledgeFile({
      fileName,
      base64: buffer.toString("base64"),
    });

    expect(parsed.metadata.parser).toBe("xlsx");
    expect(parsed.metadata.sheetNames).toEqual(["Status"]);
    expect(parsed.content).toContain("gateway,ready");
  });
});
