import {
  boundary,
  evidencePaths,
  isDirectRun,
  noRemoteAssetReference,
  phaseRange,
  readText,
  sourcePaths,
  summarizeChecks,
  writeJson,
} from "../phase1821_1840/phase1840-common.mjs";

export async function validateOwnerReportDesignContract() {
  const reportGenerator = await readText(sourcePaths.reportGenerator);
  const reportMd = await readText(sourcePaths.reportMarkdown);
  const reportHtml = await readText(sourcePaths.reportHtml);
  const reportText = [reportGenerator, reportMd, reportHtml].join("\n");
  const acceptedChineseTitles = [
    "今日小天系统检查报告",
    "今日小天老板日报",
  ];

  const checks = {
    ownerReportDesignContractReady: reportGenerator.includes("buildOwnerDailyReport") &&
      reportGenerator.includes("generateOwnerDailyReport"),
    titleIsChinese: acceptedChineseTitles.some((title) => reportText.includes(title)),
    threeOwnerSectionsPresent: [
      /今天完成了什么|浠婂ぉ|浠婃棩|一、/,
      /发现了什么问题|鍙戠幇|二、/,
      /下一步|涓嬩竴|三、/,
    ].every((pattern) => pattern.test(reportText)),
    advancedInfoAtBottom: /高级信息|楂樼骇|四、/.test(reportText) &&
      /details|summary|## 鍥涖€侀珮绾т俊鎭|## 四/.test(reportText),
    nextStepSingleMainAction: reportGenerator.includes("ownerNextAction") &&
      reportGenerator.includes("nextItems = [") &&
      reportGenerator.includes("nextAction,"),
    noEvidencePathInFirstScreenRuleDocumented: reportText.includes("details") ||
      reportText.includes("高级信息") ||
      reportText.includes("楂樼骇淇℃伅"),
    noRemoteFontCdnOrHotlink: noRemoteAssetReference(reportText),
  };

  const summary = summarizeChecks(checks);
  const result = {
    phase: "Phase1832",
    phaseRange,
    ...summary,
    ...boundary,
    ownerReportDesignVerifierPassed: summary.completed,
    checks,
  };

  await writeJson(evidencePaths.ownerReport, result);
  return result;
}

if (isDirectRun(import.meta.url)) {
  const result = await validateOwnerReportDesignContract();
  console.log(JSON.stringify(result, null, 2));
  if (result.blocker) process.exitCode = 1;
}
