import { buildUserOwnedCredentialRefSetupContract } from "../../packages/global-model-library/src/index.js";
import { baseSafety, ensurePhaseDirs, phaseDoc, writeJson, writeText } from "./phase781-800-common.mjs";

ensurePhaseDirs();
const contract = buildUserOwnedCredentialRefSetupContract();
const result = {
  phase: "Phase781",
  completed: true,
  credentialRefSetupContractReady: true,
  credentialRefSetupGuideReady: true,
  validationSchemaReady: true,
  contract,
  ...baseSafety(),
};

writeJson("apps/ai-gateway-service/evidence/phase781_800/user-owned-credentialref-contract-result.json", result);
writeText("docs/phase781-800/phase781-user-owned-provider-credentialref-contract.md", phaseDoc({
  phase: "Phase781",
  title: "User-owned Provider CredentialRef Contract",
  goal: "建立用户自带 Provider API Key 的 CredentialRef-only 接入契约。",
  facts: [
    "credentialRefOnly=true",
    "rawSecretAllowed=false",
    `allowlistedProviderFamilies=${contract.allowedProviderFamilies.length}`,
  ],
  boundaries: contract.forbiddenInputs.map((field) => `forbidden input: ${field}`),
  outputs: ["apps/ai-gateway-service/evidence/phase781_800/user-owned-credentialref-contract-result.json"],
}));
writeText("docs/phase781-800/phase782-credentialref-setup-guide-validation-schema.md", phaseDoc({
  phase: "Phase782",
  title: "CredentialRef Setup Guide + Validation Schema",
  goal: "提供 CredentialRef 设置指南和引用形态校验，不读取 raw secret。",
  facts: contract.setupFlow,
  boundaries: ["credentialRef is an opaque reference only", "credential_ready does not mean smoke_passed or selectable"],
  outputs: ["credentialRef setup guide ready"],
}));
console.log(JSON.stringify(result, null, 2));
