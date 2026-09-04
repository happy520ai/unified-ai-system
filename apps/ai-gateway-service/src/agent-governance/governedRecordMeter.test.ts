import { describe, expect, it } from "vitest";
import { buildTool, createInputSchema } from "../claude-code-patterns/toolCore.js";
import {
  meterGovernedToolResult,
  type GovernedRecordDescriptor,
} from "./governedRecordMeter.js";

const MATCH_RECORDS: GovernedRecordDescriptor = {
  kind: "record-array",
  selector: ["data", "matches"],
  onLimitExceeded: "truncate",
  itemKind: "object",
};

describe("meterGovernedToolResult", () => {
  it("counts only the exact trusted selector and ignores self-reported count fields", () => {
    const result = {
      recordCount: 0,
      matches: [{ fake: true }, { fake: true }],
      data: { matches: [{ id: 1 }, { id: 2 }, { id: 3 }] },
    };

    const verdict = meterGovernedToolResult({ result, descriptor: MATCH_RECORDS, maxRecords: 3 });

    expect(verdict).toMatchObject({
      verdict: "allow",
      code: "RECORDS_WITHIN_LIMIT",
      recordCount: 3,
      deliveredRecordCount: 3,
    });
    expect(verdict.result).toBe(result);
  });

  it("fails closed when a configured limit has no trusted descriptor", () => {
    const verdict = meterGovernedToolResult({
      result: { records: [{ id: 1 }] },
      maxRecords: 10,
    });

    expect(verdict).toMatchObject({
      verdict: "replace",
      code: "RECORD_METER_DESCRIPTOR_REQUIRED",
      recordCount: null,
      deliveredRecordCount: 0,
      result: { status: "denied", code: "RECORD_METER_DESCRIPTOR_REQUIRED" },
    });
  });

  it("truncates a declared record array without mutating the original result", () => {
    const result = { status: "success", data: { matches: [{ id: 1 }, { id: 2 }, { id: 3 }] } };

    const verdict = meterGovernedToolResult({ result, descriptor: MATCH_RECORDS, maxRecords: 2 });

    expect(verdict).toMatchObject({
      verdict: "truncate",
      code: "RECORD_LIMIT_TRUNCATED",
      recordCount: 3,
      deliveredRecordCount: 2,
      result: { data: { matches: [{ id: 1 }, { id: 2 }] } },
    });
    expect(result.data.matches).toHaveLength(3);
  });

  it("meters partial records even when the tool reports an error status", () => {
    const result = {
      status: "error",
      message: "partial upstream failure",
      data: { matches: [{ id: 1 }, { id: 2 }, { id: 3 }] },
    };
    const verdict = meterGovernedToolResult({ result, descriptor: MATCH_RECORDS, maxRecords: 1 });
    expect(verdict).toMatchObject({
      verdict: "truncate",
      recordCount: 3,
      deliveredRecordCount: 1,
      result: { status: "error", data: { matches: [{ id: 1 }] } },
    });
  });

  it("replaces the result when its trusted contract forbids truncation", () => {
    const verdict = meterGovernedToolResult({
      result: { rows: [1, 2] },
      descriptor: {
        kind: "record-array",
        selector: ["rows"],
        onLimitExceeded: "replace",
        itemKind: "scalar",
      },
      maxRecords: 1,
    });

    expect(verdict).toMatchObject({
      verdict: "replace",
      code: "RECORD_LIMIT_REPLACED",
      recordCount: 2,
      deliveredRecordCount: 0,
    });
  });

  it("rejects nested arrays that could collapse many records into one", () => {
    const verdict = meterGovernedToolResult({
      result: { data: { matches: [[{ id: 1 }, { id: 2 }]] } },
      descriptor: { ...MATCH_RECORDS, itemKind: "any" },
      maxRecords: 10,
    });

    expect(verdict).toMatchObject({
      verdict: "replace",
      code: "RECORD_RESULT_CONTRACT_MISMATCH",
      recordCount: null,
      deliveredRecordCount: 0,
    });
  });

  it("requires the exact selector to be an own data property", () => {
    const inherited = Object.create({ matches: [{ id: 1 }] }) as { matches: Array<{ id: number }> };
    const verdict = meterGovernedToolResult({
      result: { data: inherited },
      descriptor: MATCH_RECORDS,
      maxRecords: 10,
    });

    expect(verdict.code).toBe("RECORD_RESULT_CONTRACT_MISMATCH");
  });

  it("allows explicitly zero-record results but rejects hidden arrays", () => {
    expect(
      meterGovernedToolResult({
        result: { status: "success", receipt: { id: "r_1" } },
        descriptor: { kind: "zero-records" },
        maxRecords: 0,
      }),
    ).toMatchObject({ verdict: "allow", code: "ZERO_RECORD_RESULT", recordCount: 0 });

    expect(
      meterGovernedToolResult({
        result: { status: "success", payload: { records: [{ id: 1 }] } },
        descriptor: { kind: "zero-records" },
        maxRecords: 0,
      }),
    ).toMatchObject({ verdict: "replace", code: "RECORD_RESULT_CONTRACT_MISMATCH" });
  });

  it("rejects invalid paths and invalid limits", () => {
    expect(
      meterGovernedToolResult({
        result: { records: [] },
        descriptor: {
          kind: "record-array",
          selector: ["__proto__"],
          onLimitExceeded: "truncate",
        },
        maxRecords: 1,
      }).code,
    ).toBe("RECORD_METER_DESCRIPTOR_INVALID");

    expect(
      meterGovernedToolResult({
        result: { records: [] },
        descriptor: {
          kind: "record-array",
          selector: ["records"],
          onLimitExceeded: "truncate",
        },
        maxRecords: -1,
      }).code,
    ).toBe("RECORD_LIMIT_INVALID");
  });

  it("preserves the trusted descriptor on a built tool definition", () => {
    const tool = buildTool({
      name: "recorded_search",
      description: "test",
      inputSchema: createInputSchema({}),
      execute: async () => ({ data: { matches: [] } }),
      requiredPermissions: [],
      resultRecordDescriptor: MATCH_RECORDS,
    });

    expect((tool as { resultRecordDescriptor: unknown }).resultRecordDescriptor).toEqual(MATCH_RECORDS);
  });
});
