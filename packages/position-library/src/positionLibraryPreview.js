import { buildPositionId, normalizePosition } from "./positionNormalizer.js";

const base = {
  source: "PHASE576B_SAMPLE",
  sourceRef: "phase576b-source-backed-preview",
  importStatus: "seeded",
  confidence: 0.74,
  version: "phase576b-preview",
};

export const samplePositions = Object.freeze([
  make("15-1299", "Software Architect", "Engineering", ["architecture", "systems", "code-review"], ["software design"], ["design technical plan"]),
  make("15-1299-AIGW", "AI Gateway Engineer", "Engineering", ["ai-gateway", "provider-routing", "model-library"], ["gateway boundary"], ["wire provider preview"]),
  make("15-1212-SEC", "Security Architect", "Security", ["threat-model", "secret-safety", "approval-gate"], ["security controls"], ["review risk boundary"]),
  make("15-2051", "Data Scientist", "Data", ["analytics", "experiment-design", "model-evaluation"], ["statistics"], ["analyze evidence"]),
  make("11-2021-PM", "Product Manager", "Product", ["roadmap", "user-feedback", "prioritization"], ["product strategy"], ["shape user story"]),
  make("19-3099-UXR", "UX Researcher", "Design", ["usability", "trial-feedback", "journey-map"], ["human factors"], ["classify friction"]),
  make("23-1011", "Legal Counsel", "Legal", ["contract-review", "policy", "risk"], ["legal compliance"], ["flag legal risk"]),
  make("13-2051", "Financial Analyst", "Finance", ["forecasting", "budget", "cost-control"], ["financial planning"], ["estimate budget"]),
  make("29-1229", "Medical Advisor", "Healthcare", ["clinical-review", "risk-language", "compliance"], ["medical guidance"], ["review health risk"]),
  make("17-2112", "Manufacturing Engineer", "Manufacturing", ["process-design", "quality", "operations"], ["manufacturing systems"], ["review production process"]),
  make("11-3071", "Supply Chain Manager", "Operations", ["logistics", "vendor", "risk"], ["supply chain"], ["plan supply flow"]),
  make("41-3091", "Sales Strategist", "Sales", ["positioning", "pipeline", "enterprise-sales"], ["sales operations"], ["shape sales plan"]),
  make("11-2021-MKT", "Marketing Strategist", "Marketing", ["messaging", "campaign", "segmentation"], ["market strategy"], ["draft campaign"]),
  make("43-4051", "Customer Support Specialist", "Support", ["triage", "customer-communication", "kb"], ["support operations"], ["handle support case"]),
  make("13-1071", "HR Specialist", "People", ["hiring", "policy", "role-design"], ["human resources"], ["draft role profile"]),
  make("11-1021", "Operations Manager", "Operations", ["process", "execution", "coordination"], ["operations management"], ["coordinate workflow"]),
  make("15-1253-QA", "Quality Assurance Engineer", "Quality", ["test-plan", "regression", "acceptance"], ["software quality"], ["verify acceptance"]),
  make("13-1041", "Compliance Officer", "Compliance", ["audit", "controls", "regulatory"], ["compliance"], ["classify compliance issue"]),
  make("25-3099", "Teacher / Educator", "Education", ["instruction", "curriculum", "assessment"], ["education"], ["explain concept"]),
  make("19-1042", "Research Scientist", "Research", ["literature-review", "hypothesis", "evidence"], ["research methods"], ["build research plan"]),
]);

export function buildPositionLibraryPreview() {
  return {
    sourceBackedPositionLibrary: true,
    allWorldJobsClaimed: false,
    samplePositions,
    samplePositionsCount: samplePositions.length,
  };
}

function make(sourceCode, title, occupationGroup, skillTags, knowledgeTags, taskTags) {
  return normalizePosition({
    ...base,
    positionId: buildPositionId(base.source, sourceCode, title),
    sourceCode,
    sourceTitle: title,
    canonicalTitle: title,
    aliases: [title.toLowerCase()],
    occupationGroup,
    industryDomain: occupationGroup,
    skillLevel: "professional",
    skillTags,
    knowledgeTags,
    taskTags,
    seniorityApplicability: ["mid", "senior", "principal"],
  });
}
