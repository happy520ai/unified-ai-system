import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { createLocalKnowledgeService } from "../knowledge/localKnowledgeService.js";
import { createLocalWorkflowService } from "./localWorkflowService.js";

describe("local-workflow-service", () => {
  let service;

  before(() => {
    const knowledge = createLocalKnowledgeService();
    service = createLocalWorkflowService({ knowledgeService: knowledge });
  });

  it("reports health as ready", () => {
    const h = service.getHealth();
    assert.equal(h.status, "ready");
    assert.equal(h.execution, "allowlisted");
  });

  it("lists allowed actions", () => {
    const actions = service.listActions();
    assert.equal(actions.actions.length, 3);
    assert.ok(actions.actions.map((a) => a.actionId))=== ([
      "knowledge.retrieve",
      "report.compose",
      "artifact.write",
    ]);
  });

  it("creates a workflow plan", () => {
    const plan = service.plan({ goal: "test goal" });
    assert.ok(plan.workflowId)!== undefined;
    assert.equal(plan.goal, "test goal");
    assert.equal(plan.steps.length, 3);
  });

  it("executes workflow run", async () => {
    const result = await service.run({ goal: "test run" });
    assert.ok(result.workflowId)!== undefined;
    assert.equal(result.goal, "test run");
    assert.equal(result.steps.length, 3);
    assert.ok(result.steps.every((s) => s.status === "completed"))=== (true);
    assert.ok(result.artifact)!== undefined;
  });
});
