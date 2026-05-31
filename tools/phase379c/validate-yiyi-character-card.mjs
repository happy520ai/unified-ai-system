import { ensure, phase379ModelBoundary, phase379Safety, readPhase379Source, writeReportAndResult } from "../phase379-common.mjs";

const source = await readPhase379Source();
const required = [
  "data-yiyi-character-card",
  "依依 · YIYI",
  "AI Mission Companion",
  "你的智能体陪伴伙伴",
  "可视化智能体伴生体",
  "pseudo-3D prototype",
  "real 3D model / glTF / animation clips",
  "不读取 secret",
  "不调用 provider",
  "不执行 deploy",
  "不修改 evidence",
  "不伪造 approval",
];

for (const marker of required) ensure(source.includes(marker), `Missing character card marker: ${marker}`);

const result = {
  phase: "Phase379C",
  yiyiCharacterCardVisible: true,
  characterCardSafetyBoundaryVisible: true,
  characterCardVersionVisible: true,
  characterCardFuture3DReservedVisible: true,
  ...phase379Safety,
  ...phase379ModelBoundary,
  validationPassed: true,
};

await writeReportAndResult({
  reportPath: "docs/phase379c-yiyi-character-card.md",
  resultPath: "apps/ai-gateway-service/evidence/phase379c/yiyi-character-card-result.json",
  result,
  reportLines: [
    "# Phase379C Yiyi Character Card",
    "",
    "- Added Yiyi Character Card inside the avatar layer.",
    "- Card states who Yiyi is, what she can do, and what she cannot do.",
    "- Current implementation is clearly marked as pseudo-3D prototype.",
    "- Future glTF/GLB and animation clips are reserved, not claimed as complete.",
  ],
});

console.log(JSON.stringify(result, null, 2));

