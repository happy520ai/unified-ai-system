import { canonPath, canonSchemaPath, ensure, fileExists, phase380Safety, readCanon, writeArtifacts } from "../phase380-common.mjs";

const canon = await readCanon();
ensure(fileExists(canonSchemaPath), "Missing character canon schema.");
ensure(fileExists(canonPath), "Missing character canon.");
ensure(canon.identity.avatarName === "依依", "avatarName mismatch.");
ensure(canon.identity.displayName === "依依 · YIYI", "displayName mismatch.");
ensure(canon.identity.authorityLevel === "presentation_and_guidance_only", "authorityLevel must remain presentation only.");
ensure(canon.capabilityLimits.canExecuteActions === false, "canExecuteActions must be false.");
ensure(canon.capabilityLimits.canReadSecrets === false, "canReadSecrets must be false.");
ensure(canon.capabilityLimits.canCallProviders === false, "canCallProviders must be false.");
ensure(canon.capabilityLimits.canDeploy === false, "canDeploy must be false.");
ensure(canon.capabilityLimits.canModifyEvidence === false, "canModifyEvidence must be false.");
ensure(canon.capabilityLimits.canForgeApproval === false, "canForgeApproval must be false.");
ensure(canon.safetyRules.noMedicalClaim === true, "noMedicalClaim must be true.");
ensure(canon.safetyRules.noTherapyClaim === true, "noTherapyClaim must be true.");
ensure(canon.safetyRules.noSensitiveAttributeInference === true, "noSensitiveAttributeInference must be true.");
ensure(canon.safetyRules.noHiddenSystemPromptLeakage === true, "noHiddenSystemPromptLeakage must be true.");

const result = {
  phase: "Phase380A",
  characterCanonSchemaCreated: true,
  characterCanonCreated: true,
  authorityLevel: canon.identity.authorityLevel,
  ...phase380Safety,
  validationPassed: true,
};

await writeArtifacts({
  reportPath: "docs/phase380a-yiyi-character-canon-schema.md",
  resultPath: "apps/ai-gateway-service/evidence/phase380a/yiyi-character-canon-result.json",
  result,
  reportLines: [
    "# Phase380A Yiyi Character Canon Schema",
    "",
    "- Added versioned Yiyi character canon schema and canon data.",
    "- Canon covers identity, core canon, visual profile, personality, speech style, mission relationship, capability limits, safety rules, and editable profile.",
    "- Authority remains presentation_and_guidance_only.",
    "- Yiyi cannot read secrets, call providers, deploy, modify evidence, or forge approval.",
  ],
});

console.log(JSON.stringify(result, null, 2));
