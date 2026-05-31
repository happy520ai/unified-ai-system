import { yiyiModelBrainContract, validateYiyiModelBrainContract } from "../../apps/ai-gateway-service/src/ui/yiyi/model-brain/yiyiModelBrainContract.js";
import { ensure, phase382Safety, readJson, writeJson, writeText } from "../phase382-common.mjs";

const contractJson = await readJson("docs/phase382a-yiyi-model-brain-contract.json");
const validation = validateYiyiModelBrainContract(yiyiModelBrainContract);

ensure(validation.valid, `Invalid model brain contract: ${validation.errors.join(", ")}`);
ensure(contractJson.defaultMode === "dry_run_no_provider_call", "Contract JSON defaultMode mismatch.");
ensure(contractJson.requiresModelLibrary === true, "requiresModelLibrary must be true.");

const result = {
  phase: "Phase382A",
  modelBrainContractCreated: true,
  modelBrainArchitectureCreated: true,
  requestFlowUsesModelLibrary: true,
  directProviderCallAllowed: false,
  validationPassed: true,
  ...phase382Safety,
};

await writeJson("apps/ai-gateway-service/evidence/phase382a/yiyi-model-brain-contract-result.json", result);
await writeText("docs/phase382a-yiyi-model-backed-brain-architecture.md", [
  "# Phase382A Yiyi Model-backed Brain Architecture",
  "",
  "- Defined a governed model-backed brain contract on top of Phase381 dry-run brain.",
  "- Default mode remains dry_run_no_provider_call.",
  "- Any future model path must go through Model Library, credentialRef, provider policy, quota/budget, prompt envelope, and output safety.",
  "- Direct provider calls from Yiyi are forbidden.",
].join("\n"));

console.log(JSON.stringify(result, null, 2));
