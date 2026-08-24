import { describe, expect, it } from "vitest";

// @ts-expect-error -- existing JS runtime module remains inside the tracked migration boundary.
import { createPhase319LocalOperationService } from "./phase319LocalOperationService.js";

describe("phase319LocalOperationService path confidentiality", () => {
  it("rejects traversal before reading or returning file content", async () => {
    const service = createPhase319LocalOperationService();
    const result = await service.createPatchProposal({
      input: "prepare a no-op proposal",
      allowedFiles: ["../unified-ai-system/package.json"],
    });

    expect(result.status).toBe("proposal-blocked");
    expect(result.patchProposal.forbiddenPathCheck.ok).toBe(false);
    expect(result.patchProposal.proposedChanges).toEqual([]);
    expect(result.patchProposal.blockers).toContain("forbidden-paths-blocked");
  });

  it("rejects forbidden environment paths without returning content", async () => {
    const service = createPhase319LocalOperationService();
    const result = await service.createPatchProposal({
      input: "prepare a no-op proposal",
      allowedFiles: [".env.example"],
    });

    expect(result.status).toBe("proposal-blocked");
    expect(result.patchProposal.proposedChanges).toEqual([]);
    expect(result.patchProposal.blockers).toContain("forbidden-paths-blocked");
  });
});
