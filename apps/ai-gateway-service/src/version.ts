import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Single source of truth for the version this gateway reports about itself:
// MCP upstream clientInfo and the A2A agent card both read this. The value
// comes from the workspace root package.json at first use, so a release bump
// cannot drift per call site — #179 recorded the gateway telling every
// upstream it was 0.5.0 while the product had moved to 0.8.0.
let cachedVersion: string | undefined;

export function gatewayReportedVersion(): string {
  if (cachedVersion === undefined) {
    try {
      const rootPackageJson = resolve(
        dirname(fileURLToPath(import.meta.url)),
        "../../../package.json",
      );
      const parsed: { version?: unknown } = JSON.parse(
        readFileSync(rootPackageJson, "utf8"),
      );
      cachedVersion = typeof parsed.version === "string" && parsed.version.length > 0
        ? parsed.version
        : "unknown";
    } catch {
      // A missing or unreadable manifest must not break version reporting.
      cachedVersion = "unknown";
    }
  }
  return cachedVersion;
}
