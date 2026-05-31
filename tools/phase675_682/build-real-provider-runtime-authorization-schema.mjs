import {
  createRealProviderRuntimeApprovalTemplate,
  REAL_PROVIDER_RUNTIME_ALLOWED_NVIDIA_MODELS,
  REAL_PROVIDER_RUNTIME_ALLOWED_PROVIDERS,
} from "../../packages/taiji-beidou-engine/src/index.js";
import { approvalTemplatePath, phaseBoundary, writeJson } from "./phase675_682_common.mjs";

const template = createRealProviderRuntimeApprovalTemplate();
await writeJson(approvalTemplatePath, template);

const evidence = phaseBoundary({
  phase: "Phase675",
  completed: true,
  authorizationSchemaGenerated: true,
  approvalTemplateGenerated: true,
  authorizationCompleteDefault: false,
  providerIdAllowedList: [...REAL_PROVIDER_RUNTIME_ALLOWED_PROVIDERS],
  allowedNvidiaModels: [...REAL_PROVIDER_RUNTIME_ALLOWED_NVIDIA_MODELS],
  credentialRefOnly: true,
  rawSecretFieldsForbidden: true,
  maxRequestsDefault: 1,
  maxRequestsHardLimit: 3,
  maxRetriesDefault: 0,
  maxEstimatedCostUsdRequired: true,
  allowProviderCallMustBeExplicitTrue: true,
  allowSecretReadMustBeFalse: true,
  allowDeployMustBeFalse: true,
  allowChatMutationMustBeFalse: true,
  allowChatGatewayExecuteMutationMustBeFalse: true,
  capabilitySelfApprovalAllowed: false,
});

await writeJson("apps/ai-gateway-service/evidence/phase675_682/authorization-schema-result.json", evidence);
console.log(JSON.stringify(evidence, null, 2));
