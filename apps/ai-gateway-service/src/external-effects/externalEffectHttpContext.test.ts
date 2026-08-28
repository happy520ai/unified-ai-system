import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { readExternalEffectKeyContext } from "./externalEffectHttpContext.ts";

function request(headers: Record<string, string | string[]>) {
  return { headers } as any;
}

describe("external-effect HTTP key context", () => {
  it.each(["idempotency-key", "external-effect-key"])(
    "hashes %s immediately without retaining the raw key",
    (header) => {
      const context = readExternalEffectKeyContext(request({ [header]: "effect-operation-1" }));
      expect(context).toEqual({
        effectKeyHash: createHash("sha256").update("effect-operation-1").digest("hex"),
      });
      expect(JSON.stringify(context)).not.toContain("effect-operation-1");
    },
  );

  it("rejects ambiguous or malformed keys", () => {
    expect(readExternalEffectKeyContext(request({
      "idempotency-key": "standard-key",
      "external-effect-key": "effect-key",
    }))).toEqual({ effectKeyInvalid: true });
    expect(readExternalEffectKeyContext(request({
      "external-effect-key": ["one", "two"],
    }))).toEqual({ effectKeyInvalid: true });
    expect(readExternalEffectKeyContext(request({
      "external-effect-key": "contains space",
    }))).toEqual({ effectKeyInvalid: true });
  });
});
