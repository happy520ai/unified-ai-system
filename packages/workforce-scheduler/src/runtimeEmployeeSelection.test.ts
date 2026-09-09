import test from "node:test";
import assert from "node:assert/strict";
import { createRuntimeEmployeeSelector } from "./runtimeEmployeeSelection.ts";
import { buildOfficialEmployeeCatalog } from "./employee/employeeCatalogBuilder.js";

function configuration(): any {
  const candidates = [
    { employeeId: "emp-a", roleIds: ["ceo", "pm"], priority: 0 },
    { employeeId: "emp-b", roleIds: ["ceo"], priority: 1 },
  ].map((candidate) => ({ ...candidate, status: "enabled", taskTypes: ["analysis"], providerId: "fixture", modelId: "fixture-model",
    limits: { maxRequests: 1, maxInputTokens: 4096, maxOutputTokens: 1024, timeoutMs: 5000 } }));
  return { version: 1, catalogId: "curated-fixture", catalogRevision: "r1", maxCandidates: 5, maxSelectedRoles: 3, maxConcurrentRoles: 2,
    maxTotalRequests: 3, candidates, qualifications: candidates.map((candidate) => ({ qualificationId: `qual-${candidate.employeeId}`,
      employeeId: candidate.employeeId, providerId: candidate.providerId, modelId: candidate.modelId, roleIds: candidate.roleIds,
      taskTypes: ["analysis"], status: "accepted", origin: "synthetic", executionMode: "fake", evidenceHash: `sha256:${"a".repeat(64)}`,
      validUntil: "2099-01-01T00:00:00.000Z" })) };
}
const task = { taskType: "analysis", roleIds: ["ceo", "pm"], executionMode: "fake" } as const;

test("runtime selection finds a complete bounded assignment rather than greedy title/order fallback", () => {
  const selected = createRuntimeEmployeeSelector(configuration()).select(task);
  assert.deepEqual(selected.assignments.map(({ binding }) => [binding.roleId, binding.employeeId]), [["ceo", "emp-b"], ["pm", "emp-a"]]);
  assert.equal(selected.maxTotalRequests, 2);
  assert.ok(Object.isFrozen(selected.assignments[0].qualification));
});

test("catalog order and caller mutations cannot change an existing selection snapshot", () => {
  const config = configuration(); const selector = createRuntimeEmployeeSelector(config); const first = selector.select(task);
  const reversed = { ...configuration(), candidates: [...configuration().candidates].reverse(), qualifications: [...configuration().qualifications].reverse() };
  assert.deepEqual(createRuntimeEmployeeSelector(reversed).select({ ...task, roleIds: [...task.roleIds].reverse() }), first);
  config.candidates[0].providerId = "changed"; config.qualifications[0].status = "revoked";
  assert.deepEqual(selector.select(task), first);
});

test("occupation/preview states, missing qualifications and title-only matches cannot activate employees", () => {
  const official = buildOfficialEmployeeCatalog()[0]; const before = JSON.stringify(official);
  for (const candidate of [official, ...["preview_ready", "virtual_role_preview", "disabled"].map((status) => ({ employeeId: "emp-preview", status, title: "CEO", confidence: 1 }))]) {
    const config = { ...configuration(), candidates: [candidate], qualifications: [] };
    assert.throws(() => createRuntimeEmployeeSelector(config).select({ ...task, roleIds: ["ceo"] }), { code: "WORKFORCE_SELECTION_INCOMPLETE" });
  }
  assert.equal(JSON.stringify(official), before);
  const config = configuration(); config.qualifications = [];
  assert.throws(() => createRuntimeEmployeeSelector(config).select(task), { code: "WORKFORCE_SELECTION_INCOMPLETE" });
  for (const field of ["maxRequests", "maxInputTokens", "maxOutputTokens"]) {
    const invalid = configuration(); invalid.candidates[0].limits[field] = 0;
    assert.throws(() => createRuntimeEmployeeSelector(invalid), { code: "WORKFORCE_SELECTION_CONFIG_INVALID" });
  }
});

test("synthetic evidence is fake-only and requests cannot supply targets or qualification authority", () => {
  const selector = createRuntimeEmployeeSelector(configuration());
  assert.throws(() => selector.select({ ...task, executionMode: "real" }), { code: "WORKFORCE_SELECTION_INCOMPLETE" });
  assert.throws(() => selector.select({ ...task, providerId: "other", qualification: { status: "accepted" } } as any), { code: "WORKFORCE_SELECTION_TASK_INVALID" });
  const invalid = configuration(); invalid.qualifications[0].executionMode = "real";
  assert.throws(() => createRuntimeEmployeeSelector(invalid), { code: "WORKFORCE_SELECTION_CONFIG_INVALID" });
});

test("accepted qualification metadata cannot use executable coercions to claim a real evaluation", () => {
  const invalid = configuration(); let coercions = 0;
  invalid.qualifications[0].origin = { toString() { coercions += 1; return "synthetic"; } };
  invalid.qualifications[0].executionMode = "real";
  assert.throws(() => createRuntimeEmployeeSelector(invalid), { code: "WORKFORCE_SELECTION_CONFIG_INVALID" });
  assert.equal(coercions, 0);
});

test("candidate arrays must contain dense own indices rather than holes balanced by extra properties", () => {
  const invalid = configuration(); const sparse: any[] = []; sparse.length = 1;
  Object.defineProperty(sparse, "extra", { enumerable: true, value: invalid.candidates[0] });
  invalid.candidates = sparse;
  assert.throws(() => createRuntimeEmployeeSelector(invalid), { code: "WORKFORCE_SELECTION_CONFIG_INVALID" });
});

test("missing coverage, role/candidate limits and insufficient total request budget fail closed", () => {
  const config = configuration(); config.candidates = [config.candidates[0]];
  assert.throws(() => createRuntimeEmployeeSelector(config).select(task), { code: "WORKFORCE_SELECTION_INCOMPLETE" });
  assert.throws(() => createRuntimeEmployeeSelector(configuration()).select({ ...task, roleIds: ["a", "b", "c", "d"] }), { code: "WORKFORCE_SELECTION_ROLE_LIMIT" });
  const over = configuration(); over.candidates = Array.from({ length: 6 }, (_, i) => ({ ...over.candidates[0], employeeId: `emp-${i}` }));
  assert.throws(() => createRuntimeEmployeeSelector(over), { code: "WORKFORCE_SELECTION_CONFIG_INVALID" });
  assert.throws(() => createRuntimeEmployeeSelector({ ...configuration(), maxTotalRequests: 1 }).select(task), { code: "WORKFORCE_SELECTION_REQUEST_LIMIT" });
});

test("catalog, qualification and budget revisions change the decision without inventing a quality score", () => {
  const baseline = createRuntimeEmployeeSelector(configuration()).select(task);
  for (const change of [(c: any) => { c.catalogRevision = "r2"; }, (c: any) => { c.qualifications[0].evidenceHash = `sha256:${"b".repeat(64)}`; },
    (c: any) => { c.candidates[0].limits.maxOutputTokens = 512; }]) {
    const config = configuration(); change(config);
    const revised = createRuntimeEmployeeSelector(config).select(task);
    assert.notEqual(revised.selectionHash, baseline.selectionHash); assert.notEqual(revised.catalogHash, baseline.catalogHash);
  }
  assert.equal("qualityScore" in baseline, false);
});
