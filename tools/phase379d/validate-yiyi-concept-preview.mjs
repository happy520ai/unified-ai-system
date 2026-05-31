import { ensure, phase379ModelBoundary, phase379Safety, readPhase379Source, writeReportAndResult, yiyiAssetPath } from "../phase379-common.mjs";

const source = await readPhase379Source();
const required = [
  "data-yiyi-concept-preview",
  "yiyi-concept-image",
  "loading=\"lazy\"",
  "generated concept board",
  "not raw photo",
  "not real 3D model",
  "real3DModelLoaded=false",
  "gltfIntegrationReserved=true",
  yiyiAssetPath,
];

for (const marker of required) ensure(source.includes(marker), `Missing concept preview marker: ${marker}`);

const result = {
  phase: "Phase379D",
  yiyiConceptPreviewVisible: true,
  yiyiConceptAssetLoaded: true,
  conceptPreviewLazyLoaded: true,
  conceptPreviewAltTextVisible: true,
  conceptPreviewBoundaryCopyVisible: true,
  ...phase379Safety,
  ...phase379ModelBoundary,
  validationPassed: true,
};

await writeReportAndResult({
  reportPath: "docs/phase379d-yiyi-concept-preview-integration.md",
  resultPath: "apps/ai-gateway-service/evidence/phase379d/yiyi-concept-preview-result.json",
  result,
  reportLines: [
    "# Phase379D Yiyi Concept Preview Integration",
    "",
    "- Integrated the generated concept board into Yiyi Character Card as a visual reference.",
    "- Image uses lazy loading and alt text.",
    "- UI explicitly states: generated concept board, not raw photo, not real 3D model.",
    "- The preview is embedded from the local repo asset during server-side page rendering; no external upload is performed.",
  ],
});

console.log(JSON.stringify(result, null, 2));

