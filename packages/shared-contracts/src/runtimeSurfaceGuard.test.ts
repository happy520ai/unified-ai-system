import { describe, expect, it } from "vitest";
import * as contractSurface from "./index.js";
import * as runtimeSurface from "./runtime.js";

// T-097 guard. `exports["."]` maps `types` to src/index.ts and `default` to src/runtime.ts,
// while tsconfig `paths` resolves the bare specifier to src/index.ts for type-checking only.
// That asymmetry is silent-breakage bait: a value exported through the contracts tree but not
// mirrored into runtime.ts type-checks green here yet fails under Node/release resolution with
// "does not provide an export named X". This test pins the only dangerous direction.
const omitDefault = (ns: Record<string, unknown>) =>
  Object.keys(ns).filter((name) => name !== "default").sort();

const contractValues = omitDefault(contractSurface as Record<string, unknown>);
const runtimeValues = new Set(omitDefault(runtimeSurface as Record<string, unknown>));

describe("shared-contracts runtime surface guard (T-097)", () => {
  it("every value re-exported by the contracts entry is also exported by runtime.ts", () => {
    const missing = contractValues.filter((name) => !runtimeValues.has(name));
    expect(missing).toEqual([]);
  });

  it("the two entry points agree on the shared value names and their values", () => {
    const shared = contractValues.filter((name) => runtimeValues.has(name));
    expect(shared.length).toBeGreaterThan(0);
    for (const name of shared) {
      expect((runtimeSurface as Record<string, unknown>)[name])
        .toEqual((contractSurface as Record<string, unknown>)[name]);
    }
  });

  it("runtime.ts keeps the value names that consumers import in value position", () => {
    // Measured blast radius (2026-09-20): these are the only names the repository imports
    // from the bare specifier in a value position; they must stay on the runtime entry.
    for (const name of [
      "CONTRACT_VERSION",
      "LOCAL_CLIENT_DISPATCH_INTENT_VERSION",
      "LOCAL_CLIENT_RECONCILIATION_QUERY_VERSION",
      "LOCAL_CLIENT_DURABLE_RECEIPT_VERSION",
      "LOCAL_CLIENT_RECONCILIATION_RESPONSE_VERSION",
      "LOCAL_CLIENT_RECEIPT_RECONCILIATION_HMAC_DOMAIN",
      "LOCAL_CLIENT_RECEIPT_RECONCILIATION_KEY_DERIVATION_DOMAIN",
      "AGENT_TOOL_DECISION_STRICTNESS",
      "AGENT_GOVERNANCE_REDACTED_FIELDS",
    ]) {
      expect(runtimeValues.has(name)).toBe(true);
    }
  });
});
