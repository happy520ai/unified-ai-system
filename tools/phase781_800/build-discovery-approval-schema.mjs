import { buildDiscoveryApprovalSchema } from "../../packages/global-model-library/src/index.js";
import { baseSafety, phaseDoc, writeJson, writeText } from "./phase781-800-common.mjs";

const schema = buildDiscoveryApprovalSchema();
const result = {
  phase: "Phase784",
  completed: true,
  discoveryApprovalSchemaReady: true,
  schema,
  ...baseSafety(),
};
writeJson("provider-expansion/approvals/discovery-approval-schema.json", schema);
writeJson("apps/ai-gateway-service/evidence/phase781_800/discovery-approval-schema-result.json", result);
writeText("docs/phase781-800/phase784-discovery-approval-packet-schema.md", phaseDoc({
  phase: "Phase784",
  title: "Discovery Approval Packet Schema",
  goal: "定义 bounded provider discovery approval 输入格式。",
  facts: schema.requiredFields.map((field) => `required: ${field}`),
  boundaries: ["allowSecretRead=false", "maxDiscoveryRequests<=3", "maxEstimatedCostUsd=0"],
  outputs: ["provider-expansion/approvals/discovery-approval-schema.json"],
}));
console.log(JSON.stringify(result, null, 2));
