import { describe, it, expect, beforeAll } from "vitest";
import { createLocalKnowledgeService } from "../knowledge/localKnowledgeService.js";
import { createLocalWorkflowService } from "./localWorkflowService.js";

describe("local-workflow-service", () => {
  let service;

  beforeAll(() => {
    const knowledge = createLocalKnowledgeService();
    service = createLocalWorkflowService({ knowledgeService: knowledge });
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
    const result = await service.run({ goal: "test run" });
    expect(result.workflowId).toBeDefined();
    expect(result.goal).toBe("test run");
    expect(result.steps.length).toBe(3);
    expect(result.steps.every((s) => s.status === "completed")).toBe(true);
    expect(result.artifact).toBeDefined();
  });
});
