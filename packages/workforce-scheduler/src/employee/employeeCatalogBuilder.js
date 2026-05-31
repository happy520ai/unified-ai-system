import { sourceBackedExpandedSeed } from "../../../position-library/src/index.js";
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

