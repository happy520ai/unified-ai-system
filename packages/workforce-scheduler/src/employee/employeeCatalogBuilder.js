import { importOfficialOnetOccupations, sourceBackedExpandedSeed } from "../../../position-library/src/index.js";
import { createPreviewBrainBinding } from "../../../employee-brain-adapter/src/index.js";
import { createEmployeeTemplate } from "./employeeTemplateGenerator.js";
import { shouldGenerateDomainChief, buildDomainChiefTitle } from "../pyramid/domainChiefPolicy.js";

export function buildEmployeeCatalog(positions = sourceBackedExpandedSeed) {
  const baseEmployees = positions.map((position) => createEmployeeTemplate(position));
  const chiefs = [];
  const chiefDomains = new Set();
  for (const position of positions) {
    if (!shouldGenerateDomainChief(position) || chiefDomains.has(position.industryDomain)) continue;
    chiefDomains.add(position.industryDomain);
    chiefs.push(createEmployeeTemplate(position, {
      employeeId: `emp-domain-chief-${position.industryDomain.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      displayName: buildDomainChiefTitle(position.industryDomain),
      title: buildDomainChiefTitle(position.industryDomain),
      pyramidLevel: "L2",
      seniority: "principal",
    }));
  }
  return [...chiefs, ...baseEmployees];
}

// Explicit source exploration only; it neither changes the default seed nor
// assigns professional abilities, hierarchy or executable work from job titles.
export function buildOfficialEmployeeCatalog() {
  return importOfficialOnetOccupations().imported.map((position) => Object.freeze({
    employeeId: `emp-${position.positionId.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
    positionId: position.positionId, sourcePositionId: position.positionId,
    displayName: position.canonicalTitle, title: position.canonicalTitle,
    sourceCode: position.sourceCode, sourceDescription: position.sourceDescription,
    sourceRef: position.sourceRef, sourceMetadata: position.sourceMetadata,
    domain: "unassessed", pyramidLevel: null, seniority: null, riskLevel: "unassessed",
    capabilities: Object.freeze([]), allowedTaskTypes: Object.freeze([]),
    brainBinding: Object.freeze(createPreviewBrainBinding({ mode: "dry_run", maxRequestsPerTask: 0, maxEstimatedCostUsd: 0 })),
    maxConcurrency: 0, maxTokens: 0, timeoutMs: 0, requiresApproval: true,
    evidencePolicy: "required", status: "occupation_candidate", employeeIsVirtualRole: true,
  }));
}
