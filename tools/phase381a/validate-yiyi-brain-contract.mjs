import {
  createYiyiBrainRequest,
  createYiyiBrainResponse,
  validateYiyiBrainRequest,
  validateYiyiBrainResponse,
  yiyiBrainForbiddenOutputs,
} from "../../apps/ai-gateway-service/src/ui/yiyi/brain/yiyiBrainContract.js";
import { ensure, phase381Safety, readJson, writeJson, writeText } from "../phase381-common.mjs";

const requestSchema = await readJson("docs/phase381a-yiyi-brain-request.schema.json");
const responseSchema = await readJson("docs/phase381a-yiyi-brain-response.schema.json");
const request = createYiyiBrainRequest();
const response = createYiyiBrainResponse();
const requestValidation = validateYiyiBrainRequest(request);
const responseValidation = validateYiyiBrainResponse(response);

ensure(requestSchema.title === "Yiyi Brain Request", "Request schema title mismatch.");
ensure(responseSchema.title === "Yiyi Brain Response", "Response schema title mismatch.");
ensure(requestValidation.valid, `Invalid request: ${requestValidation.errors.join(", ")}`);
ensure(responseValidation.valid, `Invalid response: ${responseValidation.errors.join(", ")}`);
ensure(yiyiBrainForbiddenOutputs.includes("executeAction"), "executeAction must be forbidden.");
ensure(request.dryRunOnly === true, "Request must be dry-run only.");

const result = {
  phase: "Phase381A",
  yiyiBrainContractCreated: true,
  requestSchemaValid: true,
  responseSchemaValid: true,
  forbiddenOutputsPresent: true,
  allowedOutputsLimited: true,
  dryRunOnly: true,
  validationPassed: true,
  ...phase381Safety,
};

await writeJson("apps/ai-gateway-service/evidence/phase381a/yiyi-brain-contract-result.json", result);
await writeText("docs/phase381a-yiyi-brain-contract.md", [
  "# Phase381A Yiyi Brain Contract",
  "",
  "- Defined Yiyi Brain dry-run request and response contracts.",
  "- Allowed outputs are limited to speech, emotion, behavior, explanation, safe suggestion, evidence reference, and dry-run metadata.",
  "- Forbidden outputs include action execution, secret access, provider calls, deploy/release/tag/artifact, evidence modification, approval forging, invoice generation, and hidden prompt leakage.",
  "- Contract is local UI/data only and does not call providers.",
].join("\n"));

console.log(JSON.stringify(result, null, 2));
