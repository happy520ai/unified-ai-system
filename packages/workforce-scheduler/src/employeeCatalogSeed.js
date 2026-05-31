import { DEFAULT_BRAIN_BINDING } from "../../workforce-contracts/src/index.js";

const common = {
  brainBinding: DEFAULT_BRAIN_BINDING,
  maxConcurrency: 1,
  maxTokens: 1200,
  timeoutMs: 8000,
  requiresApproval: true,
  evidencePolicy: "required",
  status: "preview_ready",
};

export const employeeCatalogSeed = Object.freeze([
  employee("emp-system-governor", "System Governor", "phase576b-sample-system-governor", "System Governor", "Governance", "L0", "executive", ["governance", "safety-boundary"], ["governance_review"], "high"),
  employee("emp-product-chief", "Product Chief", "phase576b-sample-product-manager", "Product Manager", "Product", "L2", "principal", ["roadmap", "trial-feedback"], ["ux_refinement_plan"], "medium"),
  employee("emp-security-chief", "Security Chief", "phase576b-sample-security-architect", "Security Architect", "Security", "L2", "principal", ["secret-safety", "provider-boundary"], ["risk_review"], "high"),
  employee("emp-ux-researcher", "UX Researcher", "phase576b-sample-ux-researcher", "UX Researcher", "Design", "L3", "senior", ["usability", "friction-classification"], ["ux_feedback_analysis"], "medium"),
  employee("emp-ai-gateway-engineer", "AI Gateway Engineer", "phase576b-sample-ai-gateway-engineer", "AI Gateway Engineer", "Engineering", "L3", "senior", ["gateway-boundary", "dry-run-design"], ["architecture_review"], "medium"),
  employee("emp-qa-engineer", "QA Engineer", "phase576b-sample-quality-assurance-engineer", "Quality Assurance Engineer", "Quality", "L4", "senior", ["verification", "regression"], ["test_plan"], "medium"),
  employee("emp-compliance-officer", "Compliance Officer", "phase576b-sample-compliance-officer", "Compliance Officer", "Compliance", "L4", "senior", ["audit", "policy"], ["compliance_review"], "medium"),
]);

function employee(employeeId, displayName, positionId, title, domain, pyramidLevel, seniority, capabilities, allowedTaskTypes, riskLevel) {
  return {
    ...common,
    employeeId,
    displayName,
    positionId,
    title,
    domain,
    pyramidLevel,
    seniority,
    capabilities,
    allowedTaskTypes,
    riskLevel,
  };
}
