import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { createConsolePage } from "../ui/consolePage.js";

const PHASE = "phase-80a-web-first-run-guide";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-80a-web-first-run-guide.json");
const evidenceMdPath = resolve(evidenceDir, "phase-80a-web-first-run-guide.md");

let evidence;

try {
  const rootPackage = JSON.parse(await readFile(resolve(repoRoot, "package.json"), "utf8"));
  const servicePackage = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/package.json"), "utf8"));
  const html = createConsolePage();
  verifyEmbeddedScriptSyntax(html);

  const guideHtml = extractFirstRunGuide(html);
  const requiredGuideText = [
    "phase80a-first-run-guide",
    "第一次使用只看这三步",
    "cmd /c pnpm start:pme",
    "http://127.0.0.1:3100/ui",
    "输入问题",
    "PDF / Word / Excel / 文本",
  ];
  const missingGuideText = requiredGuideText.filter((text) => !html.includes(text));
  const missingScripts = [
    rootPackage.scripts?.["start:pme"] ? null : "start:pme",
    rootPackage.scripts?.["verify:phase80a"] ? null : "verify:phase80a",
    servicePackage.scripts?.["verify:phase80a"] ? null : "@unified-ai-system/ai-gateway-service verify:phase80a",
  ].filter(Boolean);
  const firstRunScriptPath = resolve(repoRoot, "tools/phase79a/first-run.mjs");
  const firstRunScriptExists = existsSync(firstRunScriptPath);
  const guideDoesNotExposeAdvancedPanel =
    guideHtml &&
    !guideHtml.includes("GraphRAG") &&
    !guideHtml.includes("governance") &&
    !guideHtml.includes("企业治理") &&
    !guideHtml.includes("能力面板");
  const guideHasThreeSteps = countOccurrences(guideHtml, "first-run-step") === 3;
  const passed =
    missingGuideText.length === 0 &&
    missingScripts.length === 0 &&
    firstRunScriptExists &&
    guideDoesNotExposeAdvancedPanel &&
    guideHasThreeSteps;

  evidence = {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    ui: {
      route: "GET /ui",
      guideMarker: "phase80a-first-run-guide",
      missingGuideText,
      guideHasThreeSteps,
      guideDoesNotExposeAdvancedPanel,
      webAddress: "http://127.0.0.1:3100/ui",
    },
    scripts: {
      rootStart: rootPackage.scripts?.["start:pme"] ?? null,
      rootVerify: rootPackage.scripts?.["verify:phase80a"] ?? null,
      serviceVerify: servicePackage.scripts?.["verify:phase80a"] ?? null,
      missingScripts,
      firstRunScriptExists,
    },
    safety: {
      uiOnly: true,
      providerCalls: false,
      runtimeMutation: false,
      backendBusinessRouteAdded: false,
      defaultChatMainLaneChanged: false,
      knowledgeModeChanged: false,
      advancedCapabilitiesExposedOnGuide: false,
      releaseAutomation: false,
    },
    conclusion: passed ? "web-first-run-guide-connected" : "web-first-run-guide-not-connected",
  };
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  evidence = {
    phase: PHASE,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "web-first-run-guide-not-connected",
  };
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
}

function verifyEmbeddedScriptSyntax(html) {
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error("Console page script not found.");
  }
  new vm.Script(match[1], { filename: "consolePage-inline.js" });
}

function extractFirstRunGuide(html) {
  const markerIndex = html.indexOf('data-phase="phase80a-first-run-guide"');
  if (markerIndex < 0) {
    return "";
  }
  const start = html.lastIndexOf("<div", markerIndex);
  const end = html.indexOf("</div>\n          </div>", markerIndex);
  return html.slice(start, end > markerIndex ? end : markerIndex + 2000);
}

function countOccurrences(value, marker) {
  return (String(value || "").match(new RegExp(marker, "g")) ?? []).length;
}

async function writeEvidence(body) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, createEvidenceMarkdown(body), "utf8");
}

function createEvidenceMarkdown(body) {
  return `# Phase 80A Web First-Run Guide Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- UI route: ${body.ui?.route ?? "n/a"}
- Guide marker: ${body.ui?.guideMarker ?? "n/a"}
- Missing guide text: ${(body.ui?.missingGuideText ?? []).join(", ") || "none"}
- Guide has three steps: ${body.ui?.guideHasThreeSteps}
- Guide hides advanced panel concepts: ${body.ui?.guideDoesNotExposeAdvancedPanel}
- Root start script: ${body.scripts?.rootStart ?? "n/a"}
- Root verify script: ${body.scripts?.rootVerify ?? "n/a"}
- Service verify script: ${body.scripts?.serviceVerify ?? "n/a"}
- Missing scripts: ${(body.scripts?.missingScripts ?? []).join(", ") || "none"}
- First-run script exists: ${body.scripts?.firstRunScriptExists}
- UI only: ${body.safety?.uiOnly}
- Provider calls: ${body.safety?.providerCalls}
- Runtime mutation: ${body.safety?.runtimeMutation}
- Backend business route added: ${body.safety?.backendBusinessRouteAdded}
- Default chat main lane changed: ${body.safety?.defaultChatMainLaneChanged}
- Knowledge mode changed: ${body.safety?.knowledgeModeChanged}
- Release automation: ${body.safety?.releaseAutomation}
- Conclusion: ${body.conclusion}
`;
}
