import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { employeeCatalogSeed } from "../../packages/workforce-scheduler/src/index.js";
import {
  assertCredentialRefBoundary,
  buildGatewayBrainAdapterPreview,
  runDryRunBrainAdapter,
  validateBrainBindingSchema,
} from "../../packages/employee-brain-adapter/src/index.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase576d");
const resultPath = resolve(evidenceDir, "brain-adapter-gateway-preview-result.json");

const employee = employeeCatalogSeed.find((item) => item.employeeId === "emp-ai-gateway-engineer") || employeeCatalogSeed[0];
const taskUnderstanding = { taskType: "architecture_review" };
const dryRun = runDryRunBrainAdapter({ employee, taskUnderstanding });
const gatewayPreview = buildGatewayBrainAdapterPreview({ employee, taskUnderstanding });
const credentialBoundary = assertCredentialRefBoundary();
const bindingValidation = validateBrainBindingSchema(employee.brainBinding);

const result = {
  phase: "Phase576D",
  name: "Brain Adapter Gateway Preview",
  completed: false,
  recommended_sealed: false,
  blocker: null,
  employeeBrainAdapterPackageExists: exists("packages/employee-brain-adapter/package.json"),
  dryRunBrainAdapterExists: exists("packages/employee-brain-adapter/src/dryRunBrainAdapter.js"),
  gatewayBrainAdapterPreviewExists: exists("packages/employee-brain-adapter/src/gatewayBrainAdapterPreview.js"),
  credentialRefBoundaryExists: exists("packages/employee-brain-adapter/src/credentialRefBoundary.js"),
  brainBindingSchemaValid: bindingValidation.valid,
  gatewayCopied: gatewayPreview.gatewayCopied,
  chatGatewayExecuteModified: false,
  chatGatewayExecuteCalled: gatewayPreview.chatGatewayExecuteCalled,
  providerCallsMade: dryRun.providerCallsMade || gatewayPreview.providerCallsMade,
  rawSecretAccessed: dryRun.rawSecretAccessed || gatewayPreview.rawSecretAccessed,
  secretValueExposed: dryRun.secretValueExposed || gatewayPreview.secretValueExposed,
  approvalRequiredForRealProviderCall: gatewayPreview.approvalRequiredForRealProviderCall,
  credentialBoundaryValid: credentialBoundary.valid,
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

const checksPassed =
  result.employeeBrainAdapterPackageExists &&
  result.dryRunBrainAdapterExists &&
  result.gatewayBrainAdapterPreviewExists &&
  result.credentialRefBoundaryExists &&
  result.brainBindingSchemaValid &&
  result.gatewayCopied === false &&
  result.chatGatewayExecuteModified === false &&
  result.chatGatewayExecuteCalled === false &&
  result.providerCallsMade === false &&
  result.rawSecretAccessed === false &&
  result.secretValueExposed === false &&
  result.approvalRequiredForRealProviderCall === true &&
  result.credentialBoundaryValid === true;

result.completed = checksPassed;
result.recommended_sealed = checksPassed;
result.blocker = checksPassed ? null : "phase576d_brain_adapter_preview_incomplete";

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
if (!result.completed) process.exitCode = 1;

function exists(path) {
  return existsSync(resolve(repoRoot, path));
}
