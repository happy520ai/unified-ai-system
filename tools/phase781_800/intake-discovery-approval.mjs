import { validateDiscoveryApproval } from "../../packages/global-model-library/src/index.js";
import { baseSafety, exists, readJsonIfPresent, writeJson } from "./phase781-800-common.mjs";

const approvalPath = "provider-expansion/approvals/phase781_800-discovery-approval.input.json";
const packet = readJsonIfPresent(approvalPath);
const validation = packet ? validateDiscoveryApproval(packet) : { valid: false, failures: ["approval_missing"] };
const result = {
  phase: "Phase784",
  approvalPath,
  approvalInputPresent: exists(approvalPath),
  approved: validation.valid,
  blocker: validation.valid ? null : "discovery_approval_missing_or_invalid",
  validation,
  realDiscoveryAllowed: validation.valid,
  allowSecretRead: false,
  allowDeploy: false,
  allowChatMutation: false,
  allowChatGatewayExecuteMutation: false,
  ...baseSafety(),
};
writeJson("provider-expansion/discovery/discovery-approval-intake-result.json", result);
writeJson("apps/ai-gateway-service/evidence/phase781_800/discovery-approval-intake-result.json", result);
console.log(JSON.stringify(result, null, 2));
