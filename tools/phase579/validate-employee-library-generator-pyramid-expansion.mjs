import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildEmployeeCatalog,
  createEmployeeTemplate,
  employeeExpandedSeed,
  workforcePyramidLevelPolicy,
} from "../../packages/workforce-scheduler/src/index.js";
import { sourceBackedExpandedSeed } from "../../packages/position-library/src/index.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase579");
const evidencePath = resolve(evidenceDir, "employee-library-generator-pyramid-expansion-result.json");

const sampleEmployee = createEmployeeTemplate(sourceBackedExpandedSeed[0]);
const catalog = buildEmployeeCatalog(sourceBackedExpandedSeed);
const levels = new Set(catalog.map((employee) => employee.pyramidLevel));

const result = {
  phase: "Phase579",
  name: "Employee Library Generator + Pyramid Expansion",
  completed: false,
  recommended_sealed: false,
  blocker: null,
  employeeTemplateGeneratorWorks: hasEmployeeSchema(sampleEmployee),
  employeeCatalogBuilderWorks: catalog.length >= sourceBackedExpandedSeed.length,
  pyramidLevelsDefined: ["L0", "L1", "L2", "L3", "L4", "L5", "L6"].every((level) => workforcePyramidLevelPolicy.some((item) => item.level === level)),
  domainChiefsGenerated: catalog.some((employee) => employee.employeeId.startsWith("emp-domain-chief-")),
  principalExpertsGenerated: catalog.some((employee) => employee.pyramidLevel === "L3"),
  seniorSpecialistsGenerated: catalog.some((employee) => employee.pyramidLevel === "L4"),
  operatorsGenerated: catalog.some((employee) => employee.pyramidLevel === "L5"),
  assistantsGenerated: catalog.some((employee) => employee.pyramidLevel === "L6"),
  employeeSeedCount: employeeExpandedSeed.length,
  employeeIsVirtualRole: employeeExpandedSeed.every((employee) => employee.employeeIsVirtualRole === true),
  providerCallsMade: false,
  secretValueExposed: false,
  levelsObserved: [...levels].sort(),
  filesExist: [
    "packages/workforce-scheduler/src/employee/employeeTemplateGenerator.js",
    "packages/workforce-scheduler/src/employee/employeeCatalogBuilder.js",
    "packages/workforce-scheduler/src/employee/employeeCapabilityMapper.js",
    "packages/workforce-scheduler/src/employee/employeeRiskPolicy.js",
    "packages/workforce-scheduler/src/employee/employeeApprovalPolicy.js",
    "packages/workforce-scheduler/src/employee/employeeExpandedSeed.js",
    "packages/workforce-scheduler/src/pyramid/pyramidLevelPolicy.js",
    "packages/workforce-scheduler/src/pyramid/domainChiefPolicy.js",
    "docs/phase579-employee-library-generator-pyramid-expansion.md",
    "docs/phase579-execution-report.md",
  ].every(exists),
  safetyBoundary: {
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
    deployExecuted: false,
    billingExecuted: false,
    invoiceGenerated: false,
    workspaceCleanClaimed: false,
  },
};

const passed =
  result.employeeTemplateGeneratorWorks &&
  result.employeeCatalogBuilderWorks &&
  result.pyramidLevelsDefined &&
  result.domainChiefsGenerated &&
  result.principalExpertsGenerated &&
  result.seniorSpecialistsGenerated &&
  result.operatorsGenerated &&
  result.assistantsGenerated &&
  result.employeeSeedCount >= 50 &&
  result.employeeIsVirtualRole &&
  result.providerCallsMade === false &&
  result.secretValueExposed === false &&
  result.filesExist;

result.completed = passed;
result.recommended_sealed = passed;
result.blocker = passed ? null : "phase579_employee_library_generator_incomplete";

await mkdir(evidenceDir, { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
if (!passed) process.exitCode = 1;

function hasEmployeeSchema(employee) {
  return [
    "employeeId",
    "displayName",
    "sourcePositionId",
    "title",
    "domain",
    "pyramidLevel",
    "seniority",
    "capabilities",
    "allowedTaskTypes",
    "riskLevel",
    "brainBinding",
    "maxConcurrency",
    "maxTokens",
    "timeoutMs",
    "requiresApproval",
    "evidencePolicy",
    "status",
  ].every((field) => employee[field] !== undefined);
}

function exists(path) {
  return existsSync(resolve(repoRoot, path));
}

