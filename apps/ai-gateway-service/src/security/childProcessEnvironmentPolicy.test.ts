import { describe, expect, it } from "vitest";
import { createRestrictedChildEnvironment } from "./childProcessEnvironmentPolicy.ts";

describe("restricted child process environment", () => {
  it("inherits launch essentials but not gateway credentials", () => {
    const result = createRestrictedChildEnvironment({
      PATH: "/bin",
      HOME: "/srv/gateway",
      OPENAI_API_KEY: "must-not-leak",
      PME_AUTH_TOKEN: "must-not-leak",
      NODE_OPTIONS: "--require malicious.js",
    });
    expect(result).toEqual({ PATH: "/bin", HOME: "/srv/gateway" });
  });

  it("allows operator-explicit variables", () => {
    const result = createRestrictedChildEnvironment(
      { PATH: "/bin", OPENAI_API_KEY: "ambient" },
      { MCP_SCOPED_TOKEN: "explicit", NODE_OPTIONS: "--max-old-space-size=256" },
    );
    expect(result).toEqual({
      PATH: "/bin",
      MCP_SCOPED_TOKEN: "explicit",
      NODE_OPTIONS: "--max-old-space-size=256",
    });
  });
});
