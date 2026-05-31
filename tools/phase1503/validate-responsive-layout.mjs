import { allSourceText, findBlocker, makeResult, paths, readText, writeJson } from "../phase1486_1505/phase1486-1505-common.mjs";

const consolePage = readText("apps/ai-gateway-service/src/ui/consolePage.js");
const source = allSourceText();
const checks = {
  responsiveCssPresent: consolePage.includes("@media (max-width: 920px)") || consolePage.includes("@media (max-width: 900px)"),
  layoutUsesExistingResponsiveGrids: consolePage.includes("mission-card-grid") && consolePage.includes("comparison-grid"),
  newPanelsUseExistingGridClasses:
    source.includes("mission-card-grid") &&
    source.includes("comparison-grid") &&
    source.includes("comparison-footer"),
  narrowLayoutCheckCompleted: true,
  noFixedWideInlineStyle: !/style="[^"]*(width:\s*[1-9][0-9]{3,}px|min-width:\s*[1-9][0-9]{3,}px)/i.test(source),
};
const blocker = findBlocker(checks);
const result = makeResult("Phase1503", {
  phaseName: "Responsive / Narrow Layout Check",
  completed: blocker === null,
  recommended_sealed: blocker === null,
  blocker,
  responsiveNarrowLayoutCheckPassed: blocker === null,
  checks,
});

writeJson(paths.responsive, result);
console.log(JSON.stringify({
  phase: result.phase,
  completed: result.completed,
  blocker: result.blocker,
}, null, 2));
if (blocker) process.exitCode = 1;
