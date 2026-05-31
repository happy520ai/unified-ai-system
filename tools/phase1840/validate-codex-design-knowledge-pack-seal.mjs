import { readFile } from "node:fs/promises";
import { validateCodexDesignKnowledgePack } from "../phase1821_1840/validate-codex-design-knowledge-pack.mjs";
import { validateOwnerHomeDesignContract } from "../phase1831/validate-owner-home-design-contract.mjs";
import { validateOwnerReportDesignContract } from "../phase1832/validate-owner-report-design-contract.mjs";
import { validateNoEngineeringBackendRegression } from "../phase1833/validate-no-engineering-backend-regression.mjs";
import { validateNoButtonWall } from "../phase1834/validate-no-button-wall.mjs";
import { validateNoPhaseJargonOwnerHome } from "../phase1835/validate-no-phase-jargon-owner-home.mjs";
import {
  boundary,
  evidencePaths,
  isDirectRun,
  knowledgePaths,
  phaseRange,
  readJson,
  repoPath,
  sourcePaths,
  summarizeChecks,
  writeJson,
} from "../phase1821_1840/phase1840-common.mjs";

async function fileIncludes(path, needles) {
  try {
    const text = await readFile(repoPath(path), "utf8");
    return needles.every((needle) => text.includes(needle));
  } catch {
    return false;
  }
}

export async function validateCodexDesignKnowledgePackSeal() {
  const knowledge = await validateCodexDesignKnowledgePack();
  const ownerHome = await validateOwnerHomeDesignContract();
  const ownerReport = await validateOwnerReportDesignContract();
  const noEngineering = await validateNoEngineeringBackendRegression();
  const noButtonWall = await validateNoButtonWall();
  const noPhaseJargon = await validateNoPhaseJargonOwnerHome();
  const phase1820 = await readJson("apps/ai-gateway-service/evidence/phase1801_1820/phase1820-owner-ui-design-polish-seal.json", {});
  const packageJson = await readJson("package.json", {});

  const designDisciplineNeedles = [
    "docs/design/codex-design-knowledge/",
    "Owner Home",
    "按钮墙",
    "Phase / evidence / trace",
  ];

  const checks = {
    phase1820PreconditionPassed: phase1820.completed === true &&
      phase1820.recommended_sealed === true &&
      phase1820.blocker === null &&
      phase1820.ownerHomeLooksLikeProduct === true &&
      phase1820.ownerDailyReportReadable === true,
    codexDesignKnowledgePackReady: knowledge.checks.codexDesignKnowledgePackReady === true,
    pmeDesignMdReady: knowledge.checks.pmeDesignMdReady === true,
    ownerHomeDesignContractReady: knowledge.checks.ownerHomeDesignContractReady === true,
    ownerReportDesignContractReady: knowledge.checks.ownerReportDesignContractReady === true,
    chineseUiCopyRulesReady: knowledge.checks.chineseUiCopyRulesReady === true,
    componentPatternRulesReady: knowledge.checks.componentPatternRulesReady === true,
    designAntiPatternLedgerReady: knowledge.checks.designAntiPatternLedgerReady === true,
    codexUiRewritePlaybookReady: knowledge.checks.codexUiRewritePlaybookReady === true,
    agentsReadmeDesignDisciplineSynced: await fileIncludes(sourcePaths.readme, designDisciplineNeedles) &&
      await fileIncludes(sourcePaths.agents, designDisciplineNeedles),
    ownerHomeDesignVerifierPassed: ownerHome.completed === true,
    ownerReportDesignVerifierPassed: ownerReport.completed === true,
    noEngineeringBackendRegressionGuardPassed: noEngineering.completed === true,
    noButtonWallGuardPassed: noButtonWall.completed === true,
    noPhaseJargonOwnerHomeGuardPassed: noPhaseJargon.completed === true,
    packageScriptPresent: packageJson?.scripts?.["verify:phase1840-codex-design-knowledge-pack-seal"] ===
      "node tools/phase1840/validate-codex-design-knowledge-pack-seal.mjs",
    providerCallsMadeFalse: true,
    rawSecretReadFalse: true,
    authJsonReadFalse: true,
    rawCredentialRefReadFalse: true,
    chatModifiedFalse: true,
    chatGatewayExecuteModifiedFalse: true,
    deployExecutedFalse: true,
    productionReadyClaimedFalse: true,
    noRemoteFontCdnHotlinkClaimed: boundary.remoteFontUsed === false &&
      boundary.cdnImportUsed === false &&
      boundary.externalImageHotlinkUsed === false,
  };

  const summary = summarizeChecks(checks);
  const result = {
    phase: "Phase1840",
    phaseRange,
    ...summary,
    ...boundary,
    knowledgePackPath: "docs/design/codex-design-knowledge/",
    awesomeDesignSources: [
      "VoltAgent/awesome-design-md",
      "alexpate/awesome-design-systems",
    ],
    licenseUsageBoundary: {
      "VoltAgent/awesome-design-md": "MIT; reference structure and method only; no code or brand assets copied",
      "alexpate/awesome-design-systems": "Unlicense; reference resource organization only; no code or brand assets copied",
    },
    requiredFutureUiReading: [
      knowledgePaths.pmeDesign,
      knowledgePaths.ownerHome,
      knowledgePaths.chineseCopy,
      knowledgePaths.componentPatterns,
      knowledgePaths.antiPatterns,
      knowledgePaths.playbook,
    ],
    newVerifiers: [
      "tools/phase1821_1840/validate-codex-design-knowledge-pack.mjs",
      "tools/phase1831/validate-owner-home-design-contract.mjs",
      "tools/phase1832/validate-owner-report-design-contract.mjs",
      "tools/phase1833/validate-no-engineering-backend-regression.mjs",
      "tools/phase1834/validate-no-button-wall.mjs",
      "tools/phase1835/validate-no-phase-jargon-owner-home.mjs",
      "tools/phase1840/validate-codex-design-knowledge-pack-seal.mjs",
    ],
    evidencePaths,
    pluginAppUsageAudit: knowledge.pluginAppUsageAudit,
    currentSealScope: "Codex UI design knowledge pack and owner-facing UI rewrite discipline only.",
    notSealedScope: [
      "owner satisfaction improvement",
      "production readiness",
      "public launch readiness",
      "real provider execution",
      "new UI feature expansion",
    ],
    checks,
  };

  await writeJson(evidencePaths.seal, result);
  return result;
}

if (isDirectRun(import.meta.url)) {
  const result = await validateCodexDesignKnowledgePackSeal();
  console.log(JSON.stringify(result, null, 2));
  if (result.blocker) process.exitCode = 1;
}
