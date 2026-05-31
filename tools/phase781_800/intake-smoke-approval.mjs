import { validateSmokeApproval } from "../../packages/global-model-library/src/index.js";
import { baseSafety, exists, readJsonIfPresent, writeJson } from "./phase781-800-common.mjs";

const approvalPath = "provider-expansion/approvals/phase781_800-smoke-approval.input.json";
const packet = readJsonIfPresent(approvalPath);
const validation = packet ? validateSmokeApproval(packet) : { valid: false, failures: ["approval_missing"] };
const result = {
  phase: "Phase787",
  approvalPath,
  approvalInputPresent: exists(approvalPath),
  approved: validation.valid,
  blocker: validation.valid ? null : "smoke_approval_missing_or_invalid",
  validation,
  realSmokeAllowed: validation.valid,
  allowSecretRead: false,
  allowDeploy: false,
  allowChatMutation: false,
  allowChatGatewayExecuteMutation: false,
  ...baseSafety(),
};
writeJson("provider-expansion/smoke/smoke-approval-intake-result.json", result);
writeJson("apps/ai-gateway-service/evidence/phase781_800/smoke-approval-intake-result.json", result);
console.log(JSON.stringify(result, null, 2));
