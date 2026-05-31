import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { ensure, phase379ModelBoundary, phase379Safety, readJsonFile, writeMarkdown, writeReportAndResult } from "../phase379-common.mjs";
import { readText } from "../phase373-common.mjs";

const briefPath = "docs/phase379e-yiyi-future-3d-model-brief.md";
const clipPlanPath = "docs/phase379e-yiyi-animation-clip-plan.json";

if (!existsSync(resolve(briefPath))) {
  await writeMarkdown(briefPath, [
    "# Phase379E Yiyi Future 3D Model Brief",
    "",
    "## Character",
    "",
    "- Name: 依依 / YIYI",
    "- Visual tone: sea-breeze white hat, white lightweight tech outfit, long black hair, soft blue and silver-gray accents, gentle and approachable.",
    "",
    "## Modeling Direction",
    "",
    "- Stylized 3D, semi-realistic, not a hyper-real person clone.",
    "- Low-poly / mid-poly web optimized asset.",
    "- Target format: glTF / GLB.",
    "- Transparent materials should be used carefully for browser performance.",
    "- Hair should be simplified for web rendering and mobile fallback.",
    "",
    "## Costume And Props",
    "",
    "- Straw-hat or soft-hat silhouette.",
    "- White lightweight tech jacket with translucent edges.",
    "- Soft blue UI light lines.",
    "- Small translucent shield prop for Security Shield reactions.",
    "- Star-map path prop for Tianshu planning reactions.",
    "",
    "## Animation Clips",
    "",
    "- idle, roam, mouse_attention, wave, point, thinking, guard, blocked, happy, worried, fallback_sorry, compact_resting.",
    "",
    "## Performance",
    "",
    "- Lazy load the 3D asset.",
    "- Keep 2D / pseudo-3D fallback.",
    "- Support reduced motion.",
    "- Provide a simplified mobile version.",
    "",
    "## Forbidden",
    "",
    "- Do not clone a real face.",
    "- Do not perform identity recognition.",
    "- Do not upload user photos.",
    "- Do not include raw photos.",
    "- Do not bind sensitive identity attributes.",
  ]);
}

const brief = await readText(briefPath);
const clipPlan = await readJsonFile(clipPlanPath);
for (const marker of ["依依 / YIYI", "glTF / GLB", "not a hyper-real person clone", "Do not upload user photos", "reduced motion"]) {
  ensure(brief.includes(marker), `Missing 3D brief marker: ${marker}`);
}
ensure(Array.isArray(clipPlan.clips) && clipPlan.clips.length >= 12, "Animation clip plan must include at least 12 clips.");
ensure(clipPlan.real3DModelLoaded === false, "real3DModelLoaded must be false.");

const result = {
  phase: "Phase379E",
  future3DModelBriefCreated: true,
  animationClipPlanValid: true,
  clipCount: clipPlan.clips.length,
  ...phase379Safety,
  ...phase379ModelBoundary,
  validationPassed: true,
};

await writeReportAndResult({
  reportPath: briefPath,
  resultPath: "apps/ai-gateway-service/evidence/phase379e/yiyi-3d-model-brief-result.json",
  result,
  reportLines: brief.split(/\r?\n/),
});

console.log(JSON.stringify(result, null, 2));
