import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createWorkforceWorkflowHandoffReview, readWorkforceWorkflowHandoffReview,
  readWorkforceWorkflowHandoffSelector } from "./workforceWorkflowHandoffProfile.ts";

const ROOT_HASH = "a".repeat(64);
const PLAN = { goal: "Prepare a local release report", selectedRoles: ["qa-engineer"], taskBreakdown: [{ roleId: "qa-engineer" }] };
const INVALID = { code: "WORKFORCE_WORKFLOW_HANDOFF_INVALID", statusCode: 400 };
const create = (selector: unknown = { roleId: "qa-engineer" }, plan = PLAN, outputRootHash = ROOT_HASH) =>
  createWorkforceWorkflowHandoffReview({ input: { workflowHandoff: selector }, plan, outputRootHash })!;

describe("Workforce local workflow handoff review", () => {
  it("leaves the existing path unchanged when no selector is present", () => {
    expect(readWorkforceWorkflowHandoffSelector({ goal: "Existing task" })).toBeUndefined();
    expect(createWorkforceWorkflowHandoffReview({ input: {}, plan: {}, outputRootHash: "" })).toBeUndefined();
  });

  it("normalizes valid sources without sorting or deduplication and freezes a reproducible full review", () => {
    const selector = { roleId: "qa-engineer", query: "  Release evidence  ", sourceIds: [" beta ", "alpha", "beta"], topK: 5 };
    const review = create(selector);
    expect(review).toMatchObject({ version: 1, kind: "local-knowledge-report", goal: PLAN.goal,
      query: "Release evidence", sourceIds: ["beta", "alpha", "beta"], topK: 5, outputRootHash: ROOT_HASH });
    expect(Object.isFrozen(review)).toBe(true); expect(Object.isFrozen(review.sourceIds)).toBe(true);
    expect(selector.sourceIds).toEqual([" beta ", "alpha", "beta"]);
    const { reviewHash, ...fields } = review;
    const canonical = Object.fromEntries(Object.keys(fields).sort().map(key => [key, fields[key as keyof typeof fields]]));
    expect(reviewHash).toBe(`sha256:${createHash("sha256").update(JSON.stringify(canonical)).digest("hex")}`);
    const restored = readWorkforceWorkflowHandoffReview(JSON.parse(JSON.stringify(review)));
    expect(restored).toEqual(review); expect(Object.isFrozen(restored.sourceIds)).toBe(true);
    expect(create({ topK: 5, sourceIds: ["beta", "alpha", "beta"], query: "Release evidence", roleId: "qa-engineer" })).toEqual(review);
  });

  it("binds goal to the plan and applies only absent-field defaults", () => {
    const review = createWorkforceWorkflowHandoffReview({ input: { goal: "Unreviewed goal", workflowHandoff: { roleId: "qa-engineer" } },
      plan: PLAN, outputRootHash: ROOT_HASH });
    expect(review).toMatchObject({ goal: PLAN.goal, query: PLAN.goal, topK: 3, sourceIds: [] });
    expect(create({ roleId: "qa-engineer", sourceIds: [] })).toEqual(review);
    expect(() => create({ roleId: "qa-engineer", goal: "Override" })).toThrowError(expect.objectContaining(INVALID));
    expect(create({ roleId: "qa-engineer", query: "Changed query" }).reviewHash).not.toBe(review!.reviewHash);
    expect(create({ roleId: "qa-engineer", topK: 4 }).reviewHash).not.toBe(review!.reviewHash);
    expect(create(undefined, PLAN, "b".repeat(64)).reviewHash).not.toBe(review!.reviewHash);
  });

  it("requires the selected role in both the plan selection and its task breakdown", () => {
    expect(() => create({ roleId: "backend-engineer" })).toThrowError(expect.objectContaining(INVALID));
    expect(() => create(undefined, { ...PLAN, selectedRoles: [] })).toThrow();
    expect(() => create(undefined, { ...PLAN, taskBreakdown: [] })).toThrow();
  });

  it("rejects runtime fields, prototype pollution and accessors without invoking them", () => {
    for (const key of ["agentId", "workflowId", "artifactName", "outputRootHash", "reviewHash", "__proto__", "constructor", "prototype"]) {
      const selector = JSON.parse(`{"roleId":"qa-engineer","${key}":"forged"}`);
      expect(() => create(selector)).toThrowError(expect.objectContaining(INVALID));
    }
    const getter = vi.fn(() => "qa-engineer");
    expect(() => create(Object.defineProperty({}, "roleId", { enumerable: true, get: getter }))).toThrow();
    expect(() => readWorkforceWorkflowHandoffSelector(Object.create({ workflowHandoff: { roleId: "qa-engineer" } }))).toThrow();
    expect(() => readWorkforceWorkflowHandoffSelector(Object.defineProperty({}, "workflowHandoff", { enumerable: true, get: getter }))).toThrow();
    expect(getter).not.toHaveBeenCalled();
  });

  it("rejects malformed or unsafe selector fields and enforces numeric and size bounds", () => {
    for (const selector of [null, [], { roleId: "qa-engineer", topK: "3" }, { roleId: "qa-engineer", topK: 0 },
      { roleId: "qa-engineer", topK: 6 }, { roleId: "qa-engineer", topK: 1.5 }, { roleId: "qa-engineer", query: " " },
      { roleId: "qa-engineer", query: "q".repeat(1001) }, { roleId: "qa-engineer", query: "password=synthetic-password" },
      { roleId: "qa-engineer", query: "unsafe\u001btext" }, { roleId: "qa-engineer", sourceIds: [" "] },
      { roleId: "qa-engineer", sourceIds: [4] }, { roleId: "qa-engineer", sourceIds: ["s".repeat(257)] },
      { roleId: "qa-engineer", sourceIds: Array(33).fill("source") }, { roleId: "qa-engineer", sourceIds: Array(1) }]) {
      expect(() => create(selector)).toThrowError(expect.objectContaining(INVALID));
    }
    expect(create({ roleId: "qa-engineer", topK: 1, query: "q".repeat(1000), sourceIds: Array(32).fill("s".repeat(256)) }).sourceIds).toHaveLength(32);
    for (const hash of [ROOT_HASH.toUpperCase(), `sha256:${ROOT_HASH}`, "a".repeat(63)]) expect(() => create(undefined, PLAN, hash)).toThrow();
  });

  it("validates the complete durable structure even when a digest was supplied", () => {
    const review = create();
    for (const value of [{ reviewHash: review.reviewHash }, { ...review, query: "Changed" }, { ...review, topK: "3" },
      { ...review, reviewHash: "sha256:" + "b".repeat(64) }, { ...review, kind: "arbitrary-command" },
      { ...review, query: " " + review.query }, { ...review, agentId: "agt_forged" },
      JSON.parse(JSON.stringify(review).slice(0, -1) + ',"__proto__":{}}')]) {
      expect(() => readWorkforceWorkflowHandoffReview(value)).toThrowError(expect.objectContaining(INVALID));
    }
  });
});
