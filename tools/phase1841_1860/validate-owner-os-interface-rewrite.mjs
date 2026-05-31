import { createConsolePage } from "../../apps/ai-gateway-service/src/ui/consolePage.js";
import {
  boundary,
  containsForbiddenOwnerJargon,
  countMatches,
  evidencePaths,
  isDirectRun,
  knowledgeRequiredPaths,
  noRemoteAssetReference,
  phaseRange,
  readJson,
  readKnowledgePack,
  readText,
  sourcePaths,
  summarizeChecks,
  writeJson,
} from "./phase1860-common.mjs";

function extractOwnerOs(html) {
  const markerIndex = html.indexOf('data-owner-os-shell="true"');
  const sectionStart = html.lastIndexOf("<section", markerIndex);
  const automationResultIndex = html.indexOf('data-owner-automation-result-card="true"', markerIndex);
  const advancedIndex = html.indexOf('id="owner-advanced-system-details"', markerIndex);
  const endCandidates = [automationResultIndex, advancedIndex].filter((index) => index > markerIndex);
  const endIndex = endCandidates.length > 0 ? Math.min(...endCandidates) : undefined;
  if (markerIndex < 0) return "";
  return html.slice(sectionStart >= 0 ? sectionStart : markerIndex, endIndex);
}

export async function validateOwnerOsInterfaceRewrite() {
  const html = createConsolePage();
  const ownerOs = extractOwnerOs(html);
  const sourceTexts = await Promise.all(Object.values(sourcePaths).map((path) => readText(path)));
  const combinedSource = [html, ...sourceTexts].join("\n");
  const knowledgeEntries = await readKnowledgePack();
  const phase1840 = await readJson("apps/ai-gateway-service/evidence/phase1821_1840/phase1840-codex-design-knowledge-pack-seal.json", {});

  const checks = {
    phase1840PreconditionPassed: phase1840.completed === true &&
      phase1840.recommended_sealed === true &&
      phase1840.blocker === null &&
      phase1840.checks?.codexDesignKnowledgePackReady === true,
    codexDesignKnowledgeRead: knowledgeEntries.every((entry) => knowledgeRequiredPaths.includes(entry.path) && entry.text.trim().length > 0),
    ownerOsShellImplemented: ownerOs.includes('data-owner-os-shell="true"') &&
      /AI Gateway Workbench \/ 小天总控|小天总控 OS|灏忓ぉ鎬绘帶 OS/.test(ownerOs),
    ownerHeroCommandVisible: /把今天要处理的事交给小天|今天让小天帮你处理什么？|浠婂ぉ璁╁皬澶╁府浣犲鐞嗕粈涔堬紵/.test(ownerOs) &&
      ownerOs.includes('data-owner-hero-command="true"'),
    primaryCtaCount: countMatches(ownerOs, /data-owner-boss-action=/g) === 1 &&
      countMatches(ownerOs, /owner-primary-cta/g) === 1,
    todayCompletedCardVisible: ownerOs.includes('data-owner-summary-card="today-completed"') &&
      /本地动作已就绪|今天完成了什么|浠婂ぉ瀹屾垚浜嗕粈涔?/.test(ownerOs),
    problemSignalCardVisible: ownerOs.includes('data-owner-summary-card="problems-found"') &&
      /三模式任务已就绪|发现了什么问题|鍙戠幇浜嗕粈涔堥棶棰?/.test(ownerOs),
    nextActionCardVisible: ownerOs.includes('data-owner-summary-card="next-action"') &&
      /Provider Bridge 受控就绪|下一步我该点哪里|涓嬩竴姝ユ垜璇ョ偣鍝噷/.test(ownerOs),
    advancedModeCollapsedByDefault: html.includes('id="owner-advanced-system-details"') &&
      html.includes('data-engineering-modules-collapsed="true"') &&
      !/<details[^>]+id="owner-advanced-system-details"[^>]*open/i.test(html),
    engineeringJargonHiddenFromOwner: !containsForbiddenOwnerJargon(ownerOs),
    phaseJargonHiddenFromOwner: !/Phase\d+/i.test(ownerOs),
    buttonFeedbackStatesVisible: [
      /待命|未开始|鏈紑濮?/,
      /本地动作|小天正在检查|灏忓ぉ姝ｅ湪妫€鏌?/,
      /三模式|检查完成|妫€鏌ュ畬鎴?/,
      /Provider Bridge|发现问题|鍙戠幇闂/,
      /下一步|涓嬩竴姝?/,
    ].every((pattern) => pattern.test(ownerOs)),
    ownerDailyReportSurfaceVisible: ownerOs.includes('data-owner-daily-report-surface="true"') &&
      /真实可用状态|老板日报|鑰佹澘鏃ユ姤/.test(ownerOs),
    oldBackendFeelingReduced: ownerOs.includes("owner-os-ambient") &&
      !ownerOs.includes("Mission Control"),
    visualNoiseReduced: !/(showcase|radar-grid|tour-step|arena-strip|mission-card-grid)/i.test(ownerOs),
    buttonWallRemoved: countMatches(ownerOs, /data-owner-boss-action=/g) === 1,
    moduleWallRemoved: !/(Mission Control|Evidence Replay|Context Gateway|Concept Field|Token Saving|Phase Evidence)/i.test(ownerOs),
    plainChineseCopy: [
      /把今天要处理的事交给小天|今天让小天帮你处理什么？|浠婂ぉ璁╁皬澶╁府浣犲鐞嗕粈涔堬紵/,
      /启动总控检查|让小天自动检查今天系统状态|璁╁皬澶╄嚜鍔ㄦ鏌ヤ粖澶╃郴缁熺姸鎬?/,
      /本地动作已就绪|今天完成了什么|浠婂ぉ瀹屾垚浜嗕粈涔?/,
      /三模式任务已就绪|发现了什么问题|鍙戠幇浜嗕粈涔堥棶棰?/,
      /Provider Bridge 受控就绪|下一步我该点哪里|涓嬩竴姝ユ垜璇ョ偣鍝噷/,
    ].every((pattern) => pattern.test(ownerOs)),
    noRemoteFontUsed: noRemoteAssetReference(combinedSource),
    noCdnImportUsed: noRemoteAssetReference(combinedSource),
    noExternalImageHotlinkUsed: noRemoteAssetReference(combinedSource),
  };

  const summary = summarizeChecks(checks);
  const result = {
    phase: "Phase1857",
    phaseRange,
    ...summary,
    ...boundary,
    codexDesignKnowledgeRead: checks.codexDesignKnowledgeRead,
    ownerOsShellImplemented: checks.ownerOsShellImplemented,
    ownerHeroCommandVisible: checks.ownerHeroCommandVisible,
    primaryCtaCount: checks.primaryCtaCount ? 1 : countMatches(ownerOs, /data-owner-boss-action=/g),
    todayCompletedCardVisible: checks.todayCompletedCardVisible,
    problemSignalCardVisible: checks.problemSignalCardVisible,
    nextActionCardVisible: checks.nextActionCardVisible,
    advancedModeCollapsedByDefault: checks.advancedModeCollapsedByDefault,
    engineeringJargonHiddenFromOwner: checks.engineeringJargonHiddenFromOwner,
    phaseJargonHiddenFromOwner: checks.phaseJargonHiddenFromOwner,
    buttonFeedbackStatesVisible: checks.buttonFeedbackStatesVisible,
    ownerDailyReportSurfaceVisible: checks.ownerDailyReportSurfaceVisible,
    oldBackendFeelingReduced: checks.oldBackendFeelingReduced,
    visualNoiseReduced: checks.visualNoiseReduced,
    buttonWallRemoved: checks.buttonWallRemoved,
    moduleWallRemoved: checks.moduleWallRemoved,
    plainChineseCopy: checks.plainChineseCopy,
    noRemoteFontUsed: checks.noRemoteFontUsed,
    noCdnImportUsed: checks.noCdnImportUsed,
    noExternalImageHotlinkUsed: checks.noExternalImageHotlinkUsed,
    checks,
  };

  await writeJson(evidencePaths.validation, result);
  return result;
}

if (isDirectRun(import.meta.url)) {
  const result = await validateOwnerOsInterfaceRewrite();
  console.log(JSON.stringify(result, null, 2));
  if (result.blocker) process.exitCode = 1;
}
