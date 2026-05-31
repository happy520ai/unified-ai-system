import { buildSmokeApprovalSchema } from "../../packages/global-model-library/src/index.js";
import { baseSafety, phaseDoc, writeJson, writeText } from "./phase781-800-common.mjs";

const schema = buildSmokeApprovalSchema();
const result = {
  phase: "Phase787",
  completed: true,
  smokeApprovalSchemaReady: true,
  schema,
  ...baseSafety(),
};
writeJson("provider-expansion/approvals/smoke-approval-schema.json", schema);
writeJson("apps/ai-gateway-service/evidence/phase781_800/smoke-approval-schema-result.json", result);
writeText("docs/phase781-800/phase787-smoke-approval-packet-schema.md", phaseDoc({
  phase: "Phase787",
  title: "Smoke Approval Packet Schema",
  goal: "定义 bounded model smoke approval 输入格式。",
  facts: [`smokePrompt=${schema.smokePrompt}`, "maxSmokeRequests<=5", "maxRetries=0"],
  boundaries: ["allowSecretRead=false", "allowDeploy=false", "smoke does not mean production ready"],
  outputs: ["provider-expansion/approvals/smoke-approval-schema.json"],
}));
console.log(JSON.stringify(result, null, 2));
