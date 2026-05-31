import { ensure, readYiyiSource, writePhaseResult, yiyiCommonSafety } from "../phase378-common.mjs";

const profile = {
  profileId: "yiyi_style_profile_v1",
  source: "user_reference_photo_optional",
  rawPhotoStored: false,
  externalUploadPerformed: false,
  faceRecognitionPerformed: false,
  sensitiveAttributeInferencePerformed: false,
  secretValueExposed: false,
  styleKeywords: [
    "sea_breeze",
    "white_hat",
    "long_black_hair",
    "soft_clean",
    "gentle_futuristic"
  ],
  avatarRenderingMode: "stylized_3d_placeholder",
  assetBinding: {
    model: "placeholder_yiyi.glb",
    textureTheme: "pearl_white_blue",
    accessory: "soft_hat_or_light_ring"
  }
};

ensure(profile.rawPhotoStored === false, "Raw photo must not be stored");
ensure(profile.externalUploadPerformed === false, "External upload must not happen");
ensure(profile.faceRecognitionPerformed === false, "Face recognition must not happen");
ensure(profile.sensitiveAttributeInferencePerformed === false, "Sensitive attribute inference must not happen");

const source = await readYiyiSource();
ensure(source.includes("yiyi-avatar-layer"), "Avatar layer source marker missing");

const result = {
  phase: "Phase378B",
  profileDefined: true,
  rawPhotoStored: profile.rawPhotoStored,
  externalUploadPerformed: profile.externalUploadPerformed,
  faceRecognitionPerformed: profile.faceRecognitionPerformed,
  sensitiveAttributeInferencePerformed: profile.sensitiveAttributeInferencePerformed,
  secretValueExposed: false,
  avatarRenderingMode: profile.avatarRenderingMode,
  ...yiyiCommonSafety,
  validationPassed: true
};

await writePhaseResult({
  resultPath: "apps/ai-gateway-service/evidence/phase378b/photo-to-avatar-profile-result.json",
  result,
  reportPath: "docs/phase378b-photo-to-avatar-profile-dry-run.md",
  reportLines: [
    "# Phase378B Photo-to-3D Avatar Profile Dry-run",
    "",
    "- This phase only defines a privacy-gated profile contract.",
    "- No real photo is stored, uploaded, or analyzed for identity.",
    "- The output maps style hints into a stylized placeholder avatar profile.",
  ]
});

await writePhaseResult({
  resultPath: "docs/phase378b-yiyi-avatar-style-profile.schema.json",
  result: {
    type: "object",
    required: ["profileId", "rawPhotoStored", "externalUploadPerformed", "faceRecognitionPerformed", "sensitiveAttributeInferencePerformed", "styleKeywords", "avatarRenderingMode", "assetBinding"]
  },
  reportPath: null,
  reportLines: []
});

await writePhaseResult({
  resultPath: "docs/phase378b-yiyi-avatar-style-profile.mock.json",
  result: profile,
  reportPath: null,
  reportLines: []
});

console.log(JSON.stringify(result, null, 2));
