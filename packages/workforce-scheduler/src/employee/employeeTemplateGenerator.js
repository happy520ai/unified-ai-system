import { createPreviewBrainBinding } from "../../../employee-brain-adapter/src/index.js";
import { mapPositionToPyramidLevel } from "../pyramid/pyramidLevelPolicy.js";
import { mapAllowedTaskTypes, mapPositionCapabilities } from "./employeeCapabilityMapper.js";
import { classifyEmployeeRisk } from "./employeeRiskPolicy.js";
import { requiresEmployeeApproval } from "./employeeApprovalPolicy.js";

export function createEmployeeTemplate(position, overrides = {}) {
  const pyramidLevel = overrides.pyramidLevel || mapPositionToPyramidLevel(position);
  const riskLevel = overrides.riskLevel || classifyEmployeeRisk(position);
  const employee = {
    employeeId: overrides.employeeId || `emp-${position.positionId.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
    displayName: overrides.displayName || position.canonicalTitle,
    sourcePositionId: position.positionId,
    title: overrides.title || position.canonicalTitle,
    domain: overrides.domain || position.industryDomain,
    pyramidLevel,
    seniority: overrides.seniority || seniorityForLevel(pyramidLevel),
    capabilities: overrides.capabilities || mapPositionCapabilities(position),
    allowedTaskTypes: overrides.allowedTaskTypes || mapAllowedTaskTypes(position),
    riskLevel,
    brainBinding: createPreviewBrainBinding({ mode: "dry_run", maxRequestsPerTask: 0, maxEstimatedCostUsd: 0 }),
    maxConcurrency: 1,
    maxTokens: 1200,
    timeoutMs: 8000,
    requiresApproval: false,
    evidencePolicy: "required",
    status: "virtual_role_preview",
    employeeIsVirtualRole: true,
  };
  return { ...employee, requiresApproval: requiresEmployeeApproval(employee) };
}

function seniorityForLevel(level) {
  if (level === "L0") return "governor";
  if (level === "L1") return "executive";
  if (level === "L2" || level === "L3") return "principal";
  if (level === "L4") return "senior";
  if (level === "L5") return "operator";
  return "assistant";
}

