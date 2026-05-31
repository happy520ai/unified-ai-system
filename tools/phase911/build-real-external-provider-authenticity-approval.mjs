import { buildPhase911Approval } from "../../packages/model-routing-engine/src/index.js";
import { approvalPath, ensurePhase911Dirs, phaseDoc, writeJson, writeText } from "./phase911-common.mjs";

ensurePhase911Dirs();

const approval = buildPhase911Approval();
writeJson(approvalPath, approval);
writeJson("apps/ai-gateway-service/evidence/phase911/real-external-provider-authenticity-approval-result.json", {
  phase: "Phase911",
  completed: true,
  approvalWritten: true,
  approvalPath,
  providerId: approval.providerId,
  credentialRefOnly: approval.credentialRefOnly,
  maxRequests: approval.maxRequests,
  maxRetries: approval.maxRetries,
  maxEstimatedCostUsd: approval.maxEstimatedCostUsd,
  allowProviderCall: approval.allowProviderCall,
  rawSecretIncluded: false,
  rawSecretRead: false,
  authJsonRead: false,
});

writeText("docs/phase911/phase911-real-external-provider-one-shot-authenticity-approval.md", phaseDoc({
  title: "Phase911 Real External Provider One-shot Authenticity Approval",
  goal: "Record a non-secret approval packet for exactly one NVIDIA external Provider authenticity call.",
  facts: [
    "providerId=nvidia",
    "credentialRef=credentialRef:nvidia:default",
    "maxRequests=1",
    "maxRetries=0",
  ],
  boundaries: [
    "No API key or raw endpoint value is written.",
    "No default /chat or /chat-gateway/execute mutation is allowed.",
    "No deploy, release, tag, commit, or push is allowed.",
  ],
  outputs: [approvalPath],
}));

console.log(JSON.stringify({ completed: true, approvalPath }, null, 2));
