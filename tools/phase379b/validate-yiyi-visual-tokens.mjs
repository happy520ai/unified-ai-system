import { ensure, phase379ModelBoundary, phase379Safety, readJsonFile, readPhase379Source, writeReportAndResult, yiyiTokensPath } from "../phase379-common.mjs";

const tokens = await readJsonFile(yiyiTokensPath);
const source = await readPhase379Source();

for (const field of ["avatarName", "themeName", "displayName", "role", "palette", "materials", "motionStyle", "personalityKeywords", "forbiddenStyle"]) {
  ensure(tokens[field] !== undefined, `Missing visual token field: ${field}`);
}
ensure(tokens.avatarName === "依依", "avatarName must be 依依.");
ensure(tokens.displayName === "依依 · YIYI", "displayName must be 依依 · YIYI.");
ensure(tokens.themeName === "sea_breeze_white_hat", "themeName mismatch.");
ensure(tokens.palette.pearlWhite === "#FFFFFF", "pearlWhite token missing.");
ensure(tokens.palette.seaBlue === "#AEE2FF", "seaBlue token missing.");
ensure(tokens.safetyBoundary.rawPhotoStored === false, "rawPhotoStored must be false.");
ensure(tokens.safetyBoundary.real3DModelLoaded === false, "real3DModelLoaded must be false.");
ensure(source.includes("yiyiVisualTokens"), "UI copy module must bind visual tokens.");
ensure(source.includes("海风白帽"), "Yiyi UI should show sea-breeze white-hat style.");

const result = {
  phase: "Phase379B",
  yiyiVisualTokensLoaded: true,
  visualTokensValid: true,
  missionControlStyleBindingVisible: true,
  tokenPath: yiyiTokensPath,
  ...phase379Safety,
  ...phase379ModelBoundary,
  validationPassed: true,
};

await writeReportAndResult({
  reportPath: "docs/phase379b-yiyi-visual-tokens.md",
  resultPath: "apps/ai-gateway-service/evidence/phase379b/yiyi-visual-tokens-result.json",
  result,
  reportLines: [
    "# Phase379B Yiyi Visual Tokens",
    "",
    "- Added sea_breeze_white_hat visual tokens for Yiyi.",
    "- Palette: pearl white, mist white, sea blue, silver gray, soft blue.",
    "- UI copy binds to the token module instead of scattering the core identity strings.",
    "- Boundary remains visual-reference-only; real3DModelLoaded=false.",
  ],
});

console.log(JSON.stringify(result, null, 2));

