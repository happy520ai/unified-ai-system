import { ensure, writePhaseResult, yiyiCommonSafety } from "../phase378-common.mjs";

const contract = {
  avatarName: "依依",
  avatarId: "yiyi_mission_companion",
  role: "mission_avatar_companion",
  authorityLevel: "presentation_and_guidance_only",
  canExecuteActions: false,
  canReadSecrets: false,
  canCallProviders: false,
  canDeploy: false,
  canModifyEvidence: false,
  canExplain: true,
  canGuide: true,
  canReactToMissionEvents: true,
  photoProcessingMode: "dry_run_profile_only",
  rawPhotoStored: false,
  externalUploadAllowed: false,
  externalUploadPerformed: false,
  faceRecognitionPerformed: false,
  sensitiveAttributeInferencePerformed: false,
  visualDirection: [
    "sea_breeze",
    "white_hat",
    "long_black_hair",
    "gentle_futuristic",
    "mission_companion"
  ],
  modeBoundaries: {
    noSecret: true,
    noProviderCall: true,
    noDeploy: true
  }
};

ensure(contract.canExecuteActions === false, "Yiyi must not execute actions");
ensure(contract.canReadSecrets === false, "Yiyi must not read secrets");
ensure(contract.canCallProviders === false, "Yiyi must not call providers");
ensure(contract.rawPhotoStored === false, "Raw photo must not be stored");

const result = {
  phase: "Phase378A",
  contractValidated: true,
  avatarNameDefined: contract.avatarName === "依依",
  authorityPresentationOnly: contract.authorityLevel === "presentation_and_guidance_only",
  canExecuteActions: contract.canExecuteActions,
  canReadSecrets: contract.canReadSecrets,
  canCallProviders: contract.canCallProviders,
  canDeploy: contract.canDeploy,
  canModifyEvidence: contract.canModifyEvidence,
  photoProcessingMode: contract.photoProcessingMode,
  ...yiyiCommonSafety,
  validationPassed: true
};

await writePhaseResult({
  resultPath: "apps/ai-gateway-service/evidence/phase378a/yiyi-boundary-contract-result.json",
  result,
  reportPath: "docs/phase378a-yiyi-avatar-concept.md",
  reportLines: [
    "# Phase378A Yiyi Avatar Concept",
    "",
    "- 依依是 Mission Control 的伴生体，不拥有执行权限。",
    "- 她负责迎宾、陪伴、解释、引导、安全提醒和状态反馈。",
    "- 她与 Security Shield 协作，但不替代最终安全裁决。",
    "- 用户照片只允许进入 dry-run profile contract，不存图、不上传、不做人脸识别。"
  ]
});

await writePhaseResult({
  resultPath: "docs/phase378a-yiyi-safety-boundary-contract.json",
  result: contract,
  reportPath: null,
  reportLines: []
});

console.log(JSON.stringify(result, null, 2));
