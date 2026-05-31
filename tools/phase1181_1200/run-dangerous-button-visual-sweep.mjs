import { renderFutureMinimalOsApp } from "../../apps/ai-gateway-service/src/ui/future-minimal-os/FutureMinimalOsApp.js";
import { listUiSourceFiles, readText, scanDangerousButtonsFromHtml, writeResult } from "./phase1181-common.mjs";

const html = renderFutureMinimalOsApp();
const dangerousButtons = scanDangerousButtonsFromHtml(html);
const sourceText = listUiSourceFiles().map((file) => readText(file)).join("\n").toLowerCase();
const characterModuleVisible = /yiyi|avatar|companion|character/.test(html.toLowerCase());
const misleadingProductionCopyDetected = /(已上线|已经上线|生产启用成功|production enabled|production is enabled)/i.test(html);

const result = {
  phase: "Phase1196",
  dangerousActionButtonDetected: dangerousButtons.length > 0,
  dangerousButtonTexts: dangerousButtons,
  misleadingProductionCopyDetected,
  characterModuleVisible,
  sourceMentionsDangerOnlyAsBoundary: sourceText.includes("不部署") || sourceText.includes("不会部署")
};

writeResult("apps/ai-gateway-service/evidence/phase1181_1200/dangerous-button-visual-sweep-result.json", result);
if (result.dangerousActionButtonDetected || result.misleadingProductionCopyDetected || result.characterModuleVisible) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(result, null, 2));
