import {
  linkSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createLocalKnowledgeService } from "../knowledge/localKnowledgeService.js";
import { createLocalWorkflowService } from "./localWorkflowService.js";

describe("local-workflow-service", () => {
  let service;
  let outputDir;

  beforeAll(() => {
    const knowledge = createLocalKnowledgeService();
    outputDir = mkdtempSync(join(tmpdir(), "local-workflow-service-"));
    service = createLocalWorkflowService({ knowledgeService: knowledge, outputDir });
  });

  afterAll(() => {
    rmSync(outputDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  it("reports health as ready", () => {
    const h = service.getHealth();
    expect(h.status).toBe("ready");
    expect(h.execution).toBe("allowlisted");
  });

  it("lists allowed actions", () => {
    const actions = service.listActions();
    expect(actions.actions.length).toBe(3);
    expect(actions.actions.map((a) => a.actionId)).toEqual([
      "knowledge.retrieve",
      "report.compose",
      "artifact.write",
    ]);
  });

  it("creates a workflow plan", () => {
    const plan = service.plan({ goal: "test goal" });
    expect(plan.workflowId).toBeDefined();
    expect(plan.goal).toBe("test goal");
    expect(plan.steps.length).toBe(3);
  });

  it("executes workflow run", async () => {
    const result = await service.run({ goal: "test run" }, { tenantId: "tenant-a" });
    expect(result.workflowId).toBeDefined();
    expect(result.goal).toBe("test run");
    expect(result.steps.length).toBe(3);
    expect(result.steps.every((s) => s.status === "completed")).toBe(true);
    expect(result.artifact).toBeDefined();
  });

  it("partitions artifacts by server-owned tenant and never overwrites an existing name", async () => {
    const first = await service.run(
      { goal: "tenant a report", artifactName: "shared.md" },
      { tenantId: "tenant-a" },
    );
    const second = await service.run(
      { goal: "tenant b report", artifactName: "shared.md" },
      { tenantId: "tenant-b" },
    );
    const versioned = await service.run(
      { goal: "tenant a second report", artifactName: "shared.md" },
      { tenantId: "tenant-a" },
    );

    expect(first.artifact.absolutePath).not.toBe(second.artifact.absolutePath);
    expect(versioned.artifact.fileName).toBe("shared-2.md");
    expect(readFileSync(first.artifact.absolutePath, "utf8")).toContain("tenant a report");
    expect(readFileSync(second.artifact.absolutePath, "utf8")).toContain("tenant b report");
  });

  it("does not follow a pre-existing hardlink outside the tenant artifact directory", async () => {
    const initial = await service.run(
      { goal: "establish tenant directory", artifactName: "seed.md" },
      { tenantId: "tenant-hardlink" },
    );
    const outsidePath = join(outputDir, "outside.txt");
    const linkedTarget = join(initial.artifact.absolutePath, "..", "escape.md");
    writeFileSync(outsidePath, "outside-original", "utf8");
    linkSync(outsidePath, linkedTarget);

    const result = await service.run(
      { goal: "must not overwrite outside", artifactName: "escape.md" },
      { tenantId: "tenant-hardlink" },
    );

    expect(result.artifact.fileName).toBe("escape-2.md");
    expect(readFileSync(outsidePath, "utf8")).toBe("outside-original");
  });

  it("rejects a pre-existing tenant symlink or Windows junction", async () => {
    const tenantId = "tenant-junction";
    const partition = `tenant-${createHash("sha256").update(tenantId, "utf8").digest("hex").slice(0, 24)}`;
    const outsideDir = join(outputDir, "junction-outside");
    mkdirSync(outsideDir, { recursive: true });
    symlinkSync(outsideDir, join(outputDir, partition), process.platform === "win32" ? "junction" : "dir");

    await expect(service.run(
      { goal: "must not escape through a tenant junction", artifactName: "report.md" },
      { tenantId },
    )).rejects.toMatchObject({
      code: "WORKFLOW_OUTPUT_PATH_UNSAFE",
      statusCode: 409,
    });
    expect(readdirSync(outsideDir)).toEqual([]);
  });

  it("fails closed without a server-owned tenant context", async () => {
    await expect(service.run({ goal: "missing tenant" })).rejects.toMatchObject({
      code: "WORKFLOW_TENANT_CONTEXT_REQUIRED",
      statusCode: 403,
    });
  });
});
