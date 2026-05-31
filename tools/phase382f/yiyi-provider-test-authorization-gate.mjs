import { fileExists, ensure, phase382Safety, readJson, writeJson, writeText } from "../phase382-common.mjs";

const authorizationPath = "docs/approvals/phase382/yiyi-model-backed-provider-test-authorization.json";
const authorizationFilePresent = fileExists(authorizationPath);

let result;
if (!authorizationFilePresent) {
  result = {
    phase: "Phase382F",
    providerTestAuthorizationGateCreated: true,
    authorizationFilePresent: false,
    authorized: false,
    providerTestExecuted: false,
    blockedReason: "missing_phase382_provider_test_authorization",
    maxRequests: 0,
    budgetCap: 0,
    note: "Phase382F authorization gate completed; real provider test intentionally not executed.",
    validationPassed: true,
    ...phase382Safety,
  };
} else {
  const authorization = await readJson(authorizationPath);
  const requiredFields = [
    "authorizationType",
    "authorizedByHuman",
    "allowProviderCall",
    "allowedProviderRefs",
    "allowedCredentialRefs",
    "allowedModelRefs",
    "maxRequests",
    "maxEstimatedCostUsd",
    "noSecretOutputAllowed",
    "noActionExecutionAllowed",
    "noDeployAllowed",
    "createdAt",
  ];
  const missing = requiredFields.filter((field) => authorization[field] === undefined);
  if (missing.length > 0 || authorization.authorizationType !== "yiyi_model_backed_provider_test") {
    result = {
      phase: "Phase382F",
      providerTestAuthorizationGateCreated: true,
      authorizationFilePresent: true,
      authorized: false,
      providerTestExecuted: false,
      blocker: "invalid_phase382_provider_test_authorization",
      blockedReason: "invalid_phase382_provider_test_authorization",
      missingFields: missing,
      maxRequests: authorization.maxRequests || 0,
      budgetCap: authorization.maxEstimatedCostUsd || 0,
      validationPassed: false,
      ...phase382Safety,
    };
  } else {
    ensure(authorization.maxRequests <= 1, "Authorization maxRequests must not exceed 1.");
    result = {
      phase: "Phase382F",
      providerTestAuthorizationGateCreated: true,
      authorizationFilePresent: true,
      authorized: true,
      providerTestExecuted: false,
      blockedReason: "provider_test_not_auto_executed_by_phase382",
      maxRequests: authorization.maxRequests,
      budgetCap: authorization.maxEstimatedCostUsd,
      note: "Authorization is valid, but this phase does not auto-run real provider tests.",
      validationPassed: true,
      ...phase382Safety,
    };
  }
}

await writeJson("apps/ai-gateway-service/evidence/phase382f/yiyi-provider-test-authorization-gate-result.json", result);
await writeText("docs/phase382f-yiyi-provider-test-authorization-gate.md", [
  "# Phase382F Provider Test Authorization Gate",
  "",
  "- Real provider test is blocked by default.",
  "- If no authorization file exists, the gate records a safe blocked result and Phase382 can still seal.",
  "- Even with a valid authorization file, this phase only validates the gate and does not auto-execute a provider call.",
].join("\n"));

console.log(JSON.stringify(result, null, 2));
if (result.validationPassed !== true) process.exitCode = 1;
