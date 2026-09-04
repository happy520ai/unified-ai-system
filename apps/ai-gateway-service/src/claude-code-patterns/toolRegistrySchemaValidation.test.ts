import { describe, expect, it, vi } from "vitest";
import { createAgentToolRegistry } from "./toolRegistryEngine.js";

function createRegistry() {
  return createAgentToolRegistry({
    permissionChecker: {
      async check() { return { allowed: true }; },
    },
  });
}

function registerProbe(registry: ReturnType<typeof createAgentToolRegistry>, options: {
  name: string;
  inputSchema: Record<string, unknown>;
  execute?: ReturnType<typeof vi.fn>;
}) {
  const execute = options.execute ?? vi.fn(async (params) => ({ status: "success", params }));
  expect(registry.registerTool({
    name: options.name,
    description: "schema validation probe",
    inputSchema: options.inputSchema,
    requiredPermissions: ["schema:test"],
    isReadOnly: true,
    readOnlyAttested: true,
    execute,
  })).toMatchObject({ status: "success" });
  return execute;
}

describe("Tool Registry bounded JSON Schema validation", () => {
  it("validates nested JSON types and constraints while coercing only safe top-level scalars", async () => {
    const registry = createRegistry();
    const execute = registerProbe(registry, {
      name: "schema_complete_probe",
      inputSchema: {
        type: "object",
        required: ["name", "mode", "count", "ratio", "flag", "nil", "tags", "nested", "metadata"],
        additionalProperties: false,
        properties: {
          name: { type: "string", minLength: 3, maxLength: 12, pattern: "^[a-z]+$" },
          mode: { type: "string", enum: ["fast", "safe"] },
          count: { type: "integer", minimum: 1, maximum: 10 },
          ratio: { type: "number", minimum: 0, maximum: 2 },
          flag: { type: "boolean" },
          nil: { type: "null" },
          tags: {
            type: "array",
            minItems: 1,
            maxItems: 3,
            items: { type: "string", minLength: 1 },
          },
          nested: {
            type: "object",
            required: ["score", "choice"],
            additionalProperties: false,
            properties: {
              score: { type: "integer", minimum: 0 },
              choice: { enum: [{ kind: "a" }, { kind: "b" }] },
            },
          },
          metadata: {
            type: "object",
            additionalProperties: { type: "integer", minimum: 0 },
          },
        },
      },
    });

    const result = await registry.executeTool("schema_complete_probe", {
      name: "valid",
      mode: "safe",
      count: "3",
      ratio: "1.5",
      flag: "true",
      nil: null,
      tags: ["one", "two"],
      nested: { score: 2, choice: { kind: "b" } },
      metadata: { retries: 2 },
    });

    expect(result).toMatchObject({ status: "success" });
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      count: 3,
      ratio: 1.5,
      flag: true,
      nested: { score: 2, choice: { kind: "b" } },
    }), expect.any(Object));
  });

  it("does not coerce nested values and rejects every supported constraint before execution", async () => {
    const registry = createRegistry();
    const execute = registerProbe(registry, {
      name: "schema_rejection_probe",
      inputSchema: {
        type: "object",
        required: ["nested", "items", "text", "bounded"],
        additionalProperties: false,
        properties: {
          nested: {
            type: "object",
            required: ["integer", "boolean"],
            additionalProperties: false,
            properties: {
              integer: { type: "integer" },
              boolean: { type: "boolean" },
            },
          },
          items: { type: "array", minItems: 2, maxItems: 2, items: { type: "number" } },
          text: { type: "string", minLength: 2, maxLength: 4, pattern: "^ok" },
          bounded: { type: "number", minimum: 5, maximum: 8 },
        },
      },
    });

    const result: any = await registry.executeTool("schema_rejection_probe", {
      nested: { integer: "7", boolean: "true", extra: 1 },
      items: [1],
      text: "invalid",
      bounded: 9,
      unknown: true,
    });

    expect(result).toMatchObject({
      status: "error",
      code: "TOOL_INPUT_VALIDATION_FAILED",
      error: "参数验证失败",
    });
    expect(result.details).toEqual(expect.arrayContaining([
      expect.stringContaining("expected integer"),
      expect.stringContaining("expected boolean"),
      expect.stringContaining("additional property is forbidden"),
      expect.stringContaining("fewer than minItems"),
      expect.stringContaining("longer than maxLength"),
      expect.stringContaining("does not match pattern"),
      expect.stringContaining("above maximum"),
    ]));
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects prototype keys, accessors, non-plain objects, and malformed schemas", async () => {
    const registry = createRegistry();
    const execute = registerProbe(registry, {
      name: "schema_prototype_probe",
      inputSchema: {
        type: "object",
        additionalProperties: true,
      },
    });
    const prototypeInput = JSON.parse('{"__proto__":{"polluted":true}}');
    expect(await registry.executeTool("schema_prototype_probe", prototypeInput)).toMatchObject({
      code: "TOOL_INPUT_VALIDATION_FAILED",
    });
    expect(await registry.executeTool(
      "schema_prototype_probe",
      JSON.parse('{"constructor":{"polluted":true}}'),
    )).toMatchObject({
      code: "TOOL_INPUT_VALIDATION_FAILED",
    });
    expect(await registry.executeTool("schema_prototype_probe", new Date())).toMatchObject({
      code: "TOOL_INPUT_VALIDATION_FAILED",
    });
    const getter = vi.fn(() => "must-not-run");
    const accessor = {};
    Object.defineProperty(accessor, "value", { enumerable: true, get: getter });
    expect(await registry.executeTool("schema_prototype_probe", accessor)).toMatchObject({
      code: "TOOL_INPUT_VALIDATION_FAILED",
    });
    expect(getter).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();

    const malformedExecute = registerProbe(registry, {
      name: "schema_malformed_probe",
      inputSchema: {
        type: "object",
        properties: { value: { type: "string", pattern: "[" } },
      },
    });
    expect(await registry.executeTool("schema_malformed_probe", { value: "x" })).toMatchObject({
      code: "TOOL_INPUT_SCHEMA_INVALID",
    });
    expect(malformedExecute).not.toHaveBeenCalled();
  });

  it("enforces schema depth, value nodes, and error-count hard limits", async () => {
    const registry = createRegistry();
    let deepSchema: Record<string, unknown> = { type: "string" };
    let deepValue: unknown = "leaf";
    for (let depth = 0; depth < 18; depth += 1) {
      deepSchema = {
        type: "object",
        required: ["next"],
        properties: { next: deepSchema },
      };
      deepValue = { next: deepValue };
    }
    const deepExecute = registerProbe(registry, {
      name: "schema_depth_probe",
      inputSchema: deepSchema,
    });
    expect(await registry.executeTool("schema_depth_probe", deepValue as any)).toMatchObject({
      code: "TOOL_INPUT_SCHEMA_INVALID",
    });
    expect(deepExecute).not.toHaveBeenCalled();

    const nodeExecute = registerProbe(registry, {
      name: "schema_node_probe",
      inputSchema: { type: "array", items: { type: "integer" } },
    });
    const nodeResult: any = await registry.executeTool(
      "schema_node_probe",
      Array.from({ length: 2_100 }, () => 1),
    );
    expect(nodeResult).toMatchObject({ code: "TOOL_INPUT_VALIDATION_FAILED" });
    expect(nodeResult.details).toEqual(expect.arrayContaining([
      expect.stringContaining("node limit exceeded"),
    ]));
    expect(nodeResult.details.length).toBeLessThanOrEqual(32);
    expect(nodeExecute).not.toHaveBeenCalled();
  });

  it("validates governed arguments before Tool Proxy enforcement or executor dispatch", async () => {
    const governanceToolProxy = {
      enforce: vi.fn(async () => ({ outcome: "deny", code: "must_not_reach_proxy" })),
    };
    const registry = createAgentToolRegistry({ governanceRequired: true, governanceToolProxy });
    const execute = registerProbe(registry, {
      name: "governed_schema_probe",
      inputSchema: {
        type: "object",
        required: ["count"],
        additionalProperties: false,
        properties: { count: { type: "integer", minimum: 1 } },
      },
    });

    const result = await registry.executeTool("governed_schema_probe", { count: "not-an-integer" }, {
      runAllowedTools: ["governed_schema_probe"],
      agentGovernance: { agentId: "agt_schema", tenantId: "tenant_a" },
    });

    expect(result).toMatchObject({ code: "TOOL_INPUT_VALIDATION_FAILED" });
    expect(governanceToolProxy.enforce).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });
});
