import { describe, expect, it } from "vitest";
import { getProvider } from "./providerOnboardingQueries.js";

describe("provider onboarding queries", () => {
  it("returns provider details without credential fields", () => {
    const providers = new Map([
      ["provider-1", {
        id: "provider-1",
        name: "Provider One",
        apiKey: "api-secret",
        secretKey: "secondary-secret",
        _rawConfig: { apiKey: "nested-secret" },
        active: true,
      }],
    ]);

    const result = getProvider(providers, new Map(), new Map(), "provider-1");

    expect(result).toMatchObject({
      id: "provider-1",
      name: "Provider One",
      active: true,
    });
    expect(result).not.toHaveProperty("apiKey");
    expect(result).not.toHaveProperty("secretKey");
    expect(result).not.toHaveProperty("_rawConfig");
    expect(JSON.stringify(result)).not.toContain("secret");
  });
});
