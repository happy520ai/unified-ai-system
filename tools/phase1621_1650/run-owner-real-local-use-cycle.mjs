import {
  buildAllDocs,
  buildDailySummaryRecords,
  buildDailyUseEvidenceRecords,
  buildDailyUsePhaseSchemas,
  buildDailyUsePhaseTemplates,
  buildSealResult,
  buildValidationResult,
  paths,
  renderClosureReport,
  renderSealReport,
  requiredDocFiles,
  requiredEvidenceFiles,
  requiredSchemaFiles,
  requiredTemplateFiles,
  writeJson,
  writeText,
} from "./phase1621-1650-owner-daily-use-common.mjs";

const schemas = buildDailyUsePhaseSchemas();
const templates = buildDailyUsePhaseTemplates();
const summary = buildDailySummaryRecords();

writeJson(paths.ownerDailyLedgerSchema, schemas.ownerDailyLedger);
writeJson(paths.ownerRealTaskSchema, schemas.ownerRealTaskRecord);
writeJson(paths.dailyStartSchema, schemas.dailyStartRecord);
writeJson(paths.dailyEndReviewSchema, schemas.dailyEndReview);
writeJson(paths.weeklyOwnerReviewSchema, schemas.weeklyOwnerReview);

writeJson(paths.ownerDailyLedgerTemplate, templates.ownerDailyLedger);
writeJson(paths.ownerRealTaskTemplate, templates.ownerRealTaskRecord);
writeJson(paths.dailyStartTemplate, templates.dailyStartRecord);
writeJson(paths.dailyEndReviewTemplate, templates.dailyEndReview);
writeJson(paths.weeklyOwnerReviewTemplate, templates.weeklyOwnerReview);

for (const [docPath, docText] of Object.entries(buildAllDocs(summary))) {
  writeText(docPath, docText);
}

for (const [evidencePath, evidenceRecord] of Object.entries(buildDailyUseEvidenceRecords())) {
  writeJson(evidencePath, evidenceRecord);
}

let seal = buildSealResult({
  docs: requiredDocFiles,
  evidence: requiredEvidenceFiles,
  manualNotesCount: 0,
});
writeText(paths.closureReport, renderClosureReport(seal));
writeText(paths.sealReport, renderSealReport(seal));

seal = buildSealResult({
  docs: requiredDocFiles,
  evidence: requiredEvidenceFiles,
  reportText: renderSealReport(seal),
  manualNotesCount: 0,
});
writeJson(paths.seal, seal);

const validation = buildValidationResult();
writeJson(paths.validation, validation);
writeJson(paths.seal, validation.seal);

console.log(JSON.stringify({
  phaseRange: validation.phaseRange,
  routeChoice: validation.routeChoice,
  completed: validation.completed,
  recommended_sealed: validation.recommended_sealed,
  blocker: validation.blocker,
  ownerDailyUseLedgerActivated: validation.ownerDailyUseLedgerActivated,
  dailyStartFlowReady: validation.dailyStartFlowReady,
  dailyEndReviewFlowReady: validation.dailyEndReviewFlowReady,
  realTaskIntakeSchemaReady: validation.realTaskIntakeSchemaReady,
  ownerUseCycleFrameworkReady: validation.ownerUseCycleFrameworkReady,
  ownerUseCycleCompleted: validation.ownerUseCycleCompleted,
  realDailyLedgerCount: validation.realDailyLedgerCount,
  ownerManualNotesCount: validation.ownerManualNotesCount,
  docsCount: requiredDocFiles.length,
  schemasCount: requiredSchemaFiles.length,
  templatesCount: requiredTemplateFiles.length,
  evidenceCount: requiredEvidenceFiles.length,
}, null, 2));

if (!validation.completed) process.exitCode = 1;
