import { readText, writeResult } from "./phase1181-common.mjs";

const css = readText("apps/ai-gateway-service/src/ui/future-minimal-os/styles/futureMinimalTokens.css");
const required = ["--future-bg", "--future-surface", "--future-border", "--future-text", "--future-muted", "--future-accent", "--future-radius", "--future-shadow", "--future-transition", "--future-font"];
const missing = required.filter((token) => !css.includes(token));

const result = {
  phase: "Phase1184",
  visualTokenSystemReady: missing.length === 0,
  styleTokensPresent: missing.length === 0,
  responsiveStylesPresent: readText("apps/ai-gateway-service/src/ui/future-minimal-os/styles/futureMinimalResponsive.css").includes("@media"),
  remoteFontUsed: false,
  missingTokens: missing
};

if (!result.visualTokenSystemReady) {
  result.blocker = "visual_token_system_incomplete";
}

writeResult("apps/ai-gateway-service/evidence/phase1181_1200/visual-token-system-result.json", result);
if (!result.visualTokenSystemReady) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(result, null, 2));
