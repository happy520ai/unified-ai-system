import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("./utils/healthUtils.js", () => ({
  createHealth: vi.fn(() => ({ status: "ready" })),
}));
vi.mock("../model-library/modelUsabilityMatrix.js", () => ({
  buildModelUsabilityMatrix: vi.fn(() => ({ records: [] })),
}));

import { parseCliArgs } from "../../../agent-console/src/cli-core.js";
import { createHttpServerCapabilityRoutes } from "./httpServerCapabilityRoutes.js";

describe("Workbench diagnostics doctor guidance", () => {
  it("recommends the maintained CLI doctor without claiming it ran", async () => {
    const routes = createHttpServerCapabilityRoutes({
      application: {},
      approvalStore: {},
      capabilityRouterService: {},
      connectorFeishuDryRun: true,
      connectorWeComDryRun: true,
      fileContextStore: {},
      modelLibraryStore: { getRegistry: () => ({}) },
      phase319LocalOperation: {},
      providerConfigRoutes: { status: () => ({ configured: false }) },
    });
    let body = "";
    let statusCode = 0;
    const response = {
      writeHead(code: number) { statusCode = code; },
      end(value: string) { body = value; },
    };
    const handler = routes.handlers.get("GET /workbench/diagnostics/status");
    await handler({}, response, { startedAt: Date.now() });
    const payload = JSON.parse(body);
    expect(statusCode).toBe(200);
    expect(payload.data.doctor).toMatchObject({
      command: "pnpm gateway doctor --json",
      executed: false,
      status: "not_run",
    });
    const [, script, ...args] = payload.data.doctor.command.split(" ");
    const rootPackage = JSON.parse(readFileSync(new URL("../../../../package.json", import.meta.url), "utf8"));
    expect(rootPackage.scripts[script]).toBe("node ./apps/agent-console/src/cli.js");
    expect(parseCliArgs(args, {})).toMatchObject({ command: "doctor", json: true });
  });
});
