import { readJson, writeJson, writeText } from "./phase373-common.mjs";
import { yiyiCommonSafety, yiyiScreenshots } from "./phase378-common.mjs";

const phaseResults = {
  phase378a: await readJson("apps/ai-gateway-service/evidence/phase378a/yiyi-boundary-contract-result.json"),
  phase378b: await readJson("apps/ai-gateway-service/evidence/phase378b/photo-to-avatar-profile-result.json"),
  phase378c: await readJson("apps/ai-gateway-service/evidence/phase378c/yiyi-behavior-state-machine-result.json"),
  phase378d: await readJson("apps/ai-gateway-service/evidence/phase378d/yiyi-emotion-engine-result.json"),
  phase378e: await readJson("apps/ai-gateway-service/evidence/phase378e/yiyi-event-bridge-result.json"),
  phase378f: await readJson("apps/ai-gateway-service/evidence/phase378f/yiyi-avatar-browser-smoke-result.json")
};

const allValidationPassed = Object.values(phaseResults).every((result) => result.validationPassed === true);
const result = {
  phase: "Phase378",
  title: "Yiyi Mission Avatar + Emotion Management Module",
  completed: allValidationPassed,
  recommendedSealed: allValidationPassed,
  avatarConceptCompleted: phaseResults.phase378a.validationPassed,
  photoToAvatarProfileDryRunCompleted: phaseResults.phase378b.validationPassed,
  behaviorStateMachineCompleted: phaseResults.phase378c.validationPassed,
  emotionEngineCompleted: phaseResults.phase378d.validationPassed,
  eventBridgeCompleted: phaseResults.phase378e.validationPassed,
  uiPrototypeCompleted: phaseResults.phase378f.validationPassed,
  browserSmokeCompleted: phaseResults.phase378f.validationPassed,
  screenshots: yiyiScreenshots,
  real3DModelLoaded: false,
  pseudo3DPrototype: true,
  gltfIntegrationReserved: true,
  photoProcessingBoundary: {
    rawPhotoStored: false,
    externalUploadPerformed: false,
    faceRecognitionPerformed: false,
    sensitiveAttributeInferencePerformed: false,
    photoInEvidence: false
  },
  ...yiyiCommonSafety,
  remainingRisks: [
    "当前是 DOM/CSS/SVG pseudo-3D 原型，未加载真实 glTF/GLB。",
    "头像视觉已经可见，但后续仍需要设计师制作正式模型与动画 clip。",
    "移动端和跨浏览器还需要专项视觉复核。",
    "photo-to-3D 仍是 dry-run contract，未来接入任何生成服务前需要显式授权。"
  ],
  rollbackPlan: [
    "删除 YiyiAvatarLayer.js / YiyiEmotionPanel.js 引用即可移除头像层。",
    "回退 consolePage.js 中 yiyi CSS 与事件映射即可恢复 Phase377 UI。",
    "保留 docs/evidence 不影响 runtime。"
  ],
  nextRecommendedPhase: [
    "Phase379A: Yiyi real 3D model asset pipeline design",
    "Phase379B: Yiyi animation clip library",
    "Phase379C: Yiyi voice / speech bubble personality copy",
    "Phase379D: Yiyi onboarding companion journey",
    "Phase379E: Yiyi performance optimization and mobile fallback",
    "Phase379F: Commercial avatar visual refinement package"
  ]
};

await writeJson("apps/ai-gateway-service/evidence/phase378/yiyi-mission-avatar-closure-result.json", result);
await writeText("docs/phase378-yiyi-mission-avatar-closure.md", [
  "# Phase378 Yiyi Mission Avatar Closure",
  "",
  "## Completed Scope",
  "",
  "- Added Yiyi avatar concept, safety boundary contract, and photo-to-avatar dry-run profile.",
  "- Added behavior state machine, emotion engine, and Mission Control event bridge.",
  "- Added DOM/CSS pseudo-3D Yiyi Avatar Layer and Emotion Panel inside Mission Control.",
  "- Browser smoke captured Yiyi screenshots through Chrome against local Workbench UI.",
  "",
  "## Safety Boundary",
  "",
  "- rawPhotoStored=false",
  "- externalUploadPerformed=false",
  "- faceRecognitionPerformed=false",
  "- sensitiveAttributeInferencePerformed=false",
  "- providerCallsMade=false",
  "- secretValueExposed=false",
  "- deployExecuted=false",
  "- productionGaClaimed=false",
  "",
  "## 3D Status",
  "",
  "- real3DModelLoaded=false",
  "- pseudo3DPrototype=true",
  "- gltfIntegrationReserved=true",
  "",
  "## Browser Evidence",
  "",
  ...Object.entries(yiyiScreenshots).map(([id, path]) => `- ${id}: ${path}`),
  "",
  "## Remaining Risks",
  "",
  ...result.remainingRisks.map((risk) => `- ${risk}`),
  "",
  "## Rollback Plan",
  "",
  ...result.rollbackPlan.map((step) => `- ${step}`)
].join("\n"));

console.log(JSON.stringify(result, null, 2));
if (!result.recommendedSealed) process.exitCode = 1;
