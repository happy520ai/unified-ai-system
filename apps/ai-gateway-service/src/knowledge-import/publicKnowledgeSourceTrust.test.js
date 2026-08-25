import { describe, it, expect } from "vitest";
import { scorePublicKnowledgeSource, compareProjectEvidenceWithPublicKnowledge } from "./publicKnowledgeSourceTrust.js";

describe("public-knowledge-source-trust", () => {
  it("scores official_docs with high trust", () => {
    const result = scorePublicKnowledgeSource({ family: "official_docs" });
    expect(result.trustScore).toBe(0.85);
    expect(result.importAllowedByDefault).toBe(true);
    expect(result.lowTrustRejectedByDefault).toBe(false);
  });

  it("scores phase_evidence with highest trust", () => {
    const result = scorePublicKnowledgeSource({ family: "phase_evidence" });
    expect(result.trustScore).toBe(0.95);
    expect(result.trustTier).toBe("project-authoritative");
  });

  it("scores unknown_source with low trust", () => {
    const result = scorePublicKnowledgeSource({ family: "unknown_source" });
    expect(result.trustScore).toBe(0.30);
    expect(result.importAllowedByDefault).toBe(false);
    expect(result.lowTrustRejectedByDefault).toBe(true);
  });

  it("scores low_trust_web with lowest trust", () => {
    const result = scorePublicKnowledgeSource({ family: "low_trust_web" });
    expect(result.trustScore).toBe(0.20);
    expect(result.importAllowedByDefault).toBe(false);
  });

  it("defaults to unknown_source for unrecognized family", () => {
    const result = scorePublicKnowledgeSource({ family: "some_random_source" });
    expect(result.trustScore).toBe(0.30);
    expect(result.family).toBe("some_random_source");
  });

  it("infers trust tier from score", () => {
    expect(scorePublicKnowledgeSource({ family: "phase_evidence" }).trustTier).toBe("project-authoritative");
    expect(scorePublicKnowledgeSource({ family: "official_docs" }).trustTier).toBe("public-structured-reference");
    expect(scorePublicKnowledgeSource({ family: "project-gutenberg" }).trustTier).toBe("public-reference");
    expect(scorePublicKnowledgeSource({ family: "unknown_source" }).trustTier).toBe("unknown-or-low-trust");
  });

  it("accepts sourceFamily as alternative to family", () => {
    const result = scorePublicKnowledgeSource({ sourceFamily: "wikipedia_snapshot" });
    expect(result.trustScore).toBe(0.75);
  });

  it("project evidence never overrides public knowledge", () => {
    const result = scorePublicKnowledgeSource({ family: "official_docs" });
    expect(result.allowedToOverrideProjectEvidence).toBe(false);
    expect(result.publicKnowledgeUsedAsBackground).toBe(true);
  });

  it("compareProjectEvidenceWithPublicKnowledge shows project evidence wins", () => {
    const comparison = compareProjectEvidenceWithPublicKnowledge("wikipedia_snapshot");
    expect(comparison.projectEvidenceTrustScore).toBe(0.95);
    expect(comparison.publicSourceTrustScore).toBe(0.75);
    expect(comparison.projectEvidenceOverridesPublicKnowledge).toBe(true);
  });
});
