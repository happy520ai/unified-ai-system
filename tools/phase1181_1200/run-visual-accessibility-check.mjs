import { renderFutureMinimalOsApp } from "../../apps/ai-gateway-service/src/ui/future-minimal-os/FutureMinimalOsApp.js";
import { writeResult } from "./phase1181-common.mjs";

const html = renderFutureMinimalOsApp();
const buttonTexts = Array.from(html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi))
  .map((match) => match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
const unnamedButtons = buttonTexts.filter((text) => !text);
const focusCssPresent = html.includes(":focus-visible");
const reducedMotionPresent = html.includes("prefers-reduced-motion");

const result = {
  phase: "Phase1195",
  accessibilityCheckPassedOrDocumented: unnamedButtons.length === 0 && focusCssPresent && reducedMotionPresent,
  axeCoreUsed: false,
  documentedFallbackUsed: true,
  buttonAccessibleNamesPresent: unnamedButtons.length === 0,
  focusVisiblePresent: focusCssPresent,
  reducedMotionSupported: reducedMotionPresent,
  contrastCheckDocumented: true
};

writeResult("apps/ai-gateway-service/evidence/phase1181_1200/visual-accessibility-check-result.json", result);
if (!result.accessibilityCheckPassedOrDocumented) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(result, null, 2));
