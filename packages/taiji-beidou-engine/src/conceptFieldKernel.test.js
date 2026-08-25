import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runConceptFieldKernel } from "./conceptFieldKernel.js";

function validInput(overrides = {}) {
  return {
    inputConcepts: ["routing", "evidence"],
    positiveSources: [{ concept: "routing", weight: 1 }],
    negativeSources: [{ concept: "secretLeak", weight: 1 }],
    neutralSources: ["neutral"],
    routeContext: { mode: "tianshu" },
    evidenceRefs: ["ev-1", "ev-2"],
    riskSignals: ["risk-1"],
    maxIterations: 4,
    ...overrides,
  };
}

describe("conceptFieldKernel — input validation", () => {
  it("throws when inputConcepts is empty", () => {
    assert.throws(() => runConceptFieldKernel({}), /concept_field_kernel_input_invalid/);
  });

  it("throws when positiveSources is missing", () => {
    assert.throws(() => runConceptFieldKernel({ inputConcepts: ["x"] }), /positiveSources_required/);
  });
});

describe("conceptFieldKernel — deterministic dry-run execution", () => {
  it("returns a synthetic, provider-free result", () => {
    const result = runConceptFieldKernel(validInput());
    assert.equal(result.conceptFieldKernelImplemented, true);
    assert.equal(result.syntheticDryRunOnly, true);
    assert.equal(result.providerCallsMade, false);
    assert.equal(result.gloveDownloadExecuted, false);
  });

  it("produces scores bounded to [0, 1]", () => {
    const result = runConceptFieldKernel(validInput());
    for (const key of ["routeAffinityScore", "evidenceCoherenceScore", "surpriseScore", "riskFieldScore"]) {
      assert.ok(result.scores[key] >= 0);
      assert.ok(result.scores[key] <= 1);
    }
  });

  it("runs exactly maxIterations bounded iterations", () => {
    const result = runConceptFieldKernel(validInput({ maxIterations: 5 }));
    assert.equal(result.boundedIteration.actualIterations, 5);
    assert.equal(result.boundedIteration.iterations.length, 5);
  });

  it("is deterministic for identical input", () => {
    const first = runConceptFieldKernel(validInput());
    const second = runConceptFieldKernel(validInput());
    assert.deepEqual(second.scores, first.scores);
    assert.deepEqual(second.boundedIteration, first.boundedIteration);
  });

  it("surfaces activated/suppressed concept readouts", () => {
    const result = runConceptFieldKernel(validInput());
    assert.ok(result.topActivatedConcepts.length > 0);
    assert.deepEqual(result.readout.inputConcepts, ["routing", "evidence"]);
    assert.equal(result.readout.negativeSourceCount, 1);
  });
});
