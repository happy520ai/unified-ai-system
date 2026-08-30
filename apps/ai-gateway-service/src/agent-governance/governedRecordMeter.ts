/**
 * Trusted result-record metering for governed tool calls.
 *
 * The descriptor must come from a server-controlled tool definition/catalog.
 * Never construct it from agent arguments or from fields in the tool result.
 */

export type GovernedRecordDescriptor =
  | {
      kind: "zero-records";
    }
  | {
      kind: "record-array";
      /** Exact own-property path to the one authoritative record array. */
      selector: readonly string[];
      /** Whether a result over the supplied limit may be safely truncated. */
      onLimitExceeded: "truncate" | "replace";
      /** Optional item-shape assertion supplied by the trusted tool contract. */
      itemKind?: "object" | "scalar" | "any";
    };

export type GovernedRecordMeterCode =
  | "RECORDS_WITHIN_LIMIT"
  | "ZERO_RECORD_RESULT"
  | "RECORD_LIMIT_TRUNCATED"
  | "RECORD_LIMIT_REPLACED"
  | "RECORD_METER_DESCRIPTOR_REQUIRED"
  | "RECORD_METER_DESCRIPTOR_INVALID"
  | "RECORD_RESULT_CONTRACT_MISMATCH"
  | "RECORD_LIMIT_INVALID";

export interface GovernedRecordMeterVerdict {
  verdict: "allow" | "truncate" | "replace";
  code: GovernedRecordMeterCode;
  /** Count in the original, trusted selector before any truncation. */
  recordCount: number | null;
  /** Count in the result that is safe to return to the model. */
  deliveredRecordCount: number;
  /** Original result when allowed, otherwise a truncated or closed replacement. */
  result: unknown;
  selector?: readonly string[];
}

export interface MeterGovernedToolResultInput {
  result: unknown;
  /** Server-authored descriptor. Absence is closed when maxRecords is configured. */
  descriptor?: GovernedRecordDescriptor | null;
  /** Per-call ceiling, or the remaining cumulative allowance supplied by the caller. */
  maxRecords?: number;
}

const FORBIDDEN_PATH_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);
const MAX_ZERO_RECORD_NODES = 100_000;

export function meterGovernedToolResult(input: MeterGovernedToolResultInput): GovernedRecordMeterVerdict {
  const { result, descriptor, maxRecords } = input;

  if (maxRecords !== undefined && (!Number.isSafeInteger(maxRecords) || maxRecords < 0)) {
    return closed("RECORD_LIMIT_INVALID", "The governed record limit is invalid.");
  }

  if (!descriptor) {
    if (maxRecords === undefined) {
      return {
        verdict: "allow",
        code: "RECORDS_WITHIN_LIMIT",
        recordCount: null,
        deliveredRecordCount: 0,
        result,
      };
    }
    return closed(
      "RECORD_METER_DESCRIPTOR_REQUIRED",
      "The tool has no trusted result-record descriptor, so its limited result cannot be returned.",
    );
  }

  if (!isValidDescriptor(descriptor)) {
    return closed("RECORD_METER_DESCRIPTOR_INVALID", "The tool result-record descriptor is invalid.");
  }

  if (descriptor.kind === "zero-records") {
    if (!isArrayFreeData(result)) {
      return closed(
        "RECORD_RESULT_CONTRACT_MISMATCH",
        "A zero-record tool returned an array-bearing or non-data result.",
      );
    }
    return {
      verdict: "allow",
      code: "ZERO_RECORD_RESULT",
      recordCount: 0,
      deliveredRecordCount: 0,
      result,
    };
  }

  const selected = readOwnPath(result, descriptor.selector);
  if (!selected.found || !Array.isArray(selected.value)) {
    return closed(
      "RECORD_RESULT_CONTRACT_MISMATCH",
      "The tool result does not contain the declared record array.",
      descriptor.selector,
    );
  }

  if (!selected.value.every((item) => itemMatchesKind(item, descriptor.itemKind ?? "any"))) {
    return closed(
      "RECORD_RESULT_CONTRACT_MISMATCH",
      "The declared record array contains an item outside its trusted shape.",
      descriptor.selector,
    );
  }

  const recordCount = selected.value.length;
  if (maxRecords === undefined || recordCount <= maxRecords) {
    return {
      verdict: "allow",
      code: "RECORDS_WITHIN_LIMIT",
      recordCount,
      deliveredRecordCount: recordCount,
      result,
      selector: descriptor.selector,
    };
  }

  if (descriptor.onLimitExceeded === "truncate") {
    const truncated = replaceOwnPath(result, descriptor.selector, selected.value.slice(0, maxRecords));
    if (!truncated.ok) {
      return closed(
        "RECORD_RESULT_CONTRACT_MISMATCH",
        "The declared record array could not be safely truncated.",
        descriptor.selector,
      );
    }
    return {
      verdict: "truncate",
      code: "RECORD_LIMIT_TRUNCATED",
      recordCount,
      deliveredRecordCount: maxRecords,
      result: truncated.value,
      selector: descriptor.selector,
    };
  }

  return closed(
    "RECORD_LIMIT_REPLACED",
    `The tool returned ${recordCount} records, exceeding the governed limit of ${maxRecords}.`,
    descriptor.selector,
    recordCount,
  );
}

function isValidDescriptor(value: GovernedRecordDescriptor): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (value.kind === "zero-records") return true;
  if (value.kind !== "record-array") return false;
  if (value.onLimitExceeded !== "truncate" && value.onLimitExceeded !== "replace") return false;
  if (value.itemKind !== undefined && !["object", "scalar", "any"].includes(value.itemKind)) return false;
  return (
    Array.isArray(value.selector) &&
    value.selector.length > 0 &&
    value.selector.every(
      (segment) =>
        typeof segment === "string" &&
        segment.length > 0 &&
        segment.length <= 128 &&
        !FORBIDDEN_PATH_SEGMENTS.has(segment),
    )
  );
}

function itemMatchesKind(value: unknown, kind: "object" | "scalar" | "any"): boolean {
  // A nested array can collapse many records into one apparent record, so it is
  // never a valid direct item regardless of the declared item kind.
  if (Array.isArray(value)) return false;
  if (kind === "any") return true;
  if (kind === "object") return value !== null && typeof value === "object";
  return value === null || typeof value !== "object";
}

function readOwnPath(root: unknown, selector: readonly string[]): { found: boolean; value?: unknown } {
  let current: unknown = root;
  for (const segment of selector) {
    if (!isRecordObject(current)) return { found: false };
    const property = Object.getOwnPropertyDescriptor(current, segment);
    if (!property || !("value" in property)) return { found: false };
    current = property.value;
  }
  return { found: true, value: current };
}

function replaceOwnPath(
  root: unknown,
  selector: readonly string[],
  replacement: unknown,
): { ok: true; value: unknown } | { ok: false } {
  if (!isRecordObject(root)) return { ok: false };
  const chain: Array<{ object: Record<string, unknown>; segment: string }> = [];
  let current: unknown = root;
  for (const segment of selector) {
    if (!isRecordObject(current)) return { ok: false };
    const property = Object.getOwnPropertyDescriptor(current, segment);
    if (!property || !("value" in property)) return { ok: false };
    chain.push({ object: current, segment });
    current = property.value;
  }

  let value = replacement;
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const { object, segment } = chain[index];
    const clone = cloneDataObjectWithReplacement(object, segment, value);
    if (!clone.ok) return { ok: false };
    value = clone.value;
  }
  return { ok: true, value };
}

function cloneDataObjectWithReplacement(
  source: Record<string, unknown>,
  replacedKey: string,
  replacement: unknown,
): { ok: true; value: Record<string, unknown> } | { ok: false } {
  const clone: Record<string, unknown> = {};
  for (const key of Object.keys(source)) {
    const property = Object.getOwnPropertyDescriptor(source, key);
    if (!property || !("value" in property)) return { ok: false };
    clone[key] = key === replacedKey ? replacement : property.value;
  }
  if (!Object.prototype.propertyIsEnumerable.call(source, replacedKey)) {
    clone[replacedKey] = replacement;
  }
  return { ok: true, value: clone };
}

function isArrayFreeData(root: unknown): boolean {
  const pending: unknown[] = [root];
  const visited = new WeakSet<object>();
  let nodes = 0;

  while (pending.length > 0) {
    const value = pending.pop();
    if (value === null || typeof value !== "object") continue;
    if (Array.isArray(value)) return false;
    if (visited.has(value)) continue;
    visited.add(value);
    nodes += 1;
    if (nodes > MAX_ZERO_RECORD_NODES) return false;

    for (const key of Object.keys(value)) {
      const property = Object.getOwnPropertyDescriptor(value, key);
      if (!property || !("value" in property)) return false;
      pending.push(property.value);
    }
  }
  return true;
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function closed(
  code: Exclude<GovernedRecordMeterCode, "RECORDS_WITHIN_LIMIT" | "ZERO_RECORD_RESULT" | "RECORD_LIMIT_TRUNCATED">,
  message: string,
  selector?: readonly string[],
  recordCount: number | null = null,
): GovernedRecordMeterVerdict {
  return {
    verdict: "replace",
    code,
    recordCount,
    deliveredRecordCount: 0,
    result: {
      status: "denied",
      code,
      error: message,
    },
    ...(selector ? { selector } : {}),
  };
}
