const TRUST_SCORES = {
  user_project_private_evidence: 0.95,
  phase_evidence: 0.95,
  official_docs: 0.85,
  official_public_source: 0.85,
  academic_or_standard: 0.88,
  government_or_public_institution: 0.86,
  recognized_reference: 0.80,
  "kiwix-zim": 0.75,
  wikipedia_snapshot: 0.75,
  "project-gutenberg": 0.70,
  "wikidata-json": 0.80,
  unknown_source: 0.30,
  low_trust_web: 0.20,
};

export function scorePublicKnowledgeSource(input = {}) {
  const family = input.family ?? input.sourceFamily ?? "unknown_source";
  const trustScore = TRUST_SCORES[family] ?? TRUST_SCORES.unknown_source;
  return {
    family,
    trustScore,
    trustScoreVersion: "phase277a-v1",
    trustTier: input.trustTier ?? inferTrustTier(trustScore),
    allowedToOverrideProjectEvidence: false,
    projectEvidencePriorityScore: TRUST_SCORES.phase_evidence,
    publicKnowledgeUsedAsBackground: true,
    importAllowedByDefault: trustScore >= 0.70 && family !== "unknown_source",
    lowTrustRejectedByDefault: trustScore < 0.70 || family === "unknown_source",
  };
}

export function compareProjectEvidenceWithPublicKnowledge(publicFamily) {
  const projectEvidenceTrustScore = TRUST_SCORES.phase_evidence;
  const publicSourceTrustScore = scorePublicKnowledgeSource({ family: publicFamily }).trustScore;
  return {
    projectEvidenceTrustScore,
    publicSourceTrustScore,
    projectEvidenceOverridesPublicKnowledge: projectEvidenceTrustScore > publicSourceTrustScore,
    publicKnowledgeAllowedForCurrentProjectState: false,
  };
}

function inferTrustTier(score) {
  if (score >= 0.9) return "project-authoritative";
  if (score >= 0.8) return "public-structured-reference";
  if (score >= 0.7) return "public-reference";
  return "unknown-or-low-trust";
}
