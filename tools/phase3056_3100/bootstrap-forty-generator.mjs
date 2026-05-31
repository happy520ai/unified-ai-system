import { mkdir, readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase3012_3055/generate-thirty-nine-phase-assets.mjs";
const targetDir = "tools/phase3056_3100";
const targetPath = `${targetDir}/generate-forty-phase-assets.mjs`;

const from = {
  range: "3012-3055",
  phaseId: "Phase3012A-3055A-Controlled-Thirty-Nine-Tool-Mutation",
  title: "Controlled Thirty-Nine Tool Mutation",
  lowerTitle: "controlled thirty-nine tool mutation",
  label: "thirty-nine",
  sourceDir: "phase3012_3055",
  previousPhaseId: "Phase2969A-3011A-Controlled-Thirty-Eight-Tool-Mutation",
  previousEvidencePath: "apps/ai-gateway-service/evidence/phase2969-3011-controlled-thirty-eight-tool-mutation/result.json",
  previousSealId: "phase3011_sealed",
  previousSealBlocker: "phase3011_not_sealed",
  previousSealVariable: "phase3011",
  previousAppliedField: "thirtyEightMutationApplied",
  previousSourcePathLine: '  "tools/phase2969_3011/apply-controlled-thirty-eight-tool-mutation.mjs",',
  titleArrayEntry: '  "ThirtyNine",',
  targetsBuildLine:
    "const thirtyFiveTargets = buildThirtyFiveTargets(thirtyFourTargets);\nconst thirtySixTargets = buildThirtySixTargets(thirtyFiveTargets);\nconst thirtySevenTargets = buildThirtySevenTargets(thirtySixTargets);\nconst thirtyEightTargets = buildThirtyEightTargets(thirtySevenTargets);\nconst targets = buildThirtyNineTargets(thirtyEightTargets);",
  tmpDir: "tmp/phase3012-3055-proposals",
  smokeFile: "thirty-nine-smoke.json",
  rollbackAction: "restore-previous-content-thirty-nine",
  permissionMode: "controlled-thirty-nine-tool-source-mutation",
  nodeCheckBlocker: "thirty_nine_mutation_node_check_or_smoke_failed",
  readyField: "thirtyNineRunnerReady",
  appliedField: "thirtyNineMutationApplied",
  smokeField: "localThirtyNineSmokePassed",
  docsCheckId: "docs_mentions_thirty_nine",
  changedCountCheckId: "changed_file_count_thirty_nine",
  rollbackCheckId: "rollback_restore_thirty_nine",
  rollbackEntriesCheckId: "rollback_thirty_nine_entries",
  readySummaryField: "thirtyNineMutationReady",
};

const to = {
  range: "3056-3100",
  phaseId: "Phase3056A-3100A-Controlled-Forty-Tool-Mutation",
  title: "Controlled Forty Tool Mutation",
  lowerTitle: "controlled forty tool mutation",
  label: "forty",
  sourceDir: "phase3056_3100",
  previousPhaseId: "Phase3012A-3055A-Controlled-Thirty-Nine-Tool-Mutation",
  previousEvidencePath: "apps/ai-gateway-service/evidence/phase3012-3055-controlled-thirty-nine-tool-mutation/result.json",
  previousSealId: "phase3055_sealed",
  previousSealBlocker: "phase3055_not_sealed",
  previousSealVariable: "phase3055",
  previousAppliedField: "thirtyNineMutationApplied",
  previousSourcePathLine: '  "tools/phase3012_3055/apply-controlled-thirty-nine-tool-mutation.mjs",',
  titleArrayEntry: '  "Forty",',
  targetsBuildLine:
    "const thirtyFiveTargets = buildThirtyFiveTargets(thirtyFourTargets);\nconst thirtySixTargets = buildThirtySixTargets(thirtyFiveTargets);\nconst thirtySevenTargets = buildThirtySevenTargets(thirtySixTargets);\nconst thirtyEightTargets = buildThirtyEightTargets(thirtySevenTargets);\nconst thirtyNineTargets = buildThirtyNineTargets(thirtyEightTargets);\nconst targets = buildFortyTargets(thirtyNineTargets);",
  tmpDir: "tmp/phase3056-3100-proposals",
  smokeFile: "forty-smoke.json",
  rollbackAction: "restore-previous-content-forty",
  permissionMode: "controlled-forty-tool-source-mutation",
  nodeCheckBlocker: "forty_mutation_node_check_or_smoke_failed",
  readyField: "fortyRunnerReady",
  appliedField: "fortyMutationApplied",
  smokeField: "localFortySmokePassed",
  docsCheckId: "docs_mentions_forty",
  changedCountCheckId: "changed_file_count_forty",
  rollbackCheckId: "rollback_restore_forty",
  rollbackEntriesCheckId: "rollback_forty_entries",
  readySummaryField: "fortyMutationReady",
};

function replaceAll(text, search, replacement) {
  if (!text.includes(search)) throw new Error(`missing_replace_all_target:${search}`);
  return text.split(search).join(replacement);
}

function replaceOptional(text, search, replacement) {
  return text.includes(search) ? text.split(search).join(replacement) : text;
}

function replaceOnce(text, search, replacement) {
  if (!text.includes(search)) throw new Error(`missing_replace_target:${search}`);
  return text.replace(search, replacement);
}

function phaseMetaBlock() {
  return `const phaseMeta = {
  phaseId: "${to.phaseId}",
  docPath: "docs/phase${to.range}-controlled-forty-tool-mutation.md",
  approvalPath: "docs/phase${to.range}-controlled-forty-tool-mutation-approval.example.json",
  runnerPath: "tools/${to.sourceDir}/apply-controlled-forty-tool-mutation.mjs",
  verifierPath: "tools/${to.sourceDir}/validate-controlled-forty-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase${to.range}-controlled-forty-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase${to.range}-controlled-forty-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase${to.range}-controlled-forty-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase${to.range}-controlled-forty-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase${to.range}-controlled-forty-tool-mutation/${to.smokeFile}",
  permissionMode: "${to.permissionMode}",
  label: "${to.label}",
  runnerReadyField: "${to.readyField}",
  appliedField: "${to.appliedField}",
  smokeField: "${to.smokeField}",
  rollbackAction: "${to.rollbackAction}",
  verifyScript: "verify:phase${to.range}-controlled-forty-tool-mutation",
  applyScript: "apply:phase${to.range}-controlled-forty-tool-mutation",
  smokeScript: "smoke:phase${to.range}-controlled-forty-tool-mutation",
};`;
}

function previousPhaseMetaBlock() {
  return `const previousPhaseMeta = {
  phaseId: "${to.previousPhaseId}",
  resultPath: "${to.previousEvidencePath}",
  sealCheckId: "${to.previousSealId}",
  sealCheckField: "${to.previousAppliedField}",
  sealCheckBlocker: "${to.previousSealBlocker}",
};`;
}

function buildFortyTargetsFunction(source) {
  const start = source.indexOf("function buildThirtyNineTargets(previousTargets) {");
  const end = source.indexOf("\nconst phase2091Checks = [", start);
  if (start < 0 || end < 0) throw new Error("missing_thirty_nine_targets_function");
  let fn = source.slice(start, end).trim();
  fn = replaceAll(fn, "buildThirtyNineTargets", "buildFortyTargets");
  fn = replaceAll(fn, "Thirty-Nine", "Forty");
  fn = replaceAll(fn, "ThirtyNine", "Forty");
  fn = replaceAll(fn, "THIRTY_NINE", "FORTY");
  fn = replaceAll(fn, "thirtyNine", "forty");
  fn = replaceAll(fn, "thirty-nine", "forty");
  fn = replaceOnce(fn, "const phase = 3016 + idx;", "const phase = 3060 + idx;");
  fn = replaceOnce(fn, "const previousRuntimeTarget = previousTargets[37];", "const previousRuntimeTarget = previousTargets[38];");
  fn = replaceOnce(fn, "const fortyPhase = 3055;", "const fortyPhase = 3100;");
  fn = replaceOnce(
    fn,
    'const fortyMarker = "PHASE3055_FORTY_TOOL_TARGET_FORTY_OK";',
    'const fortyMarker = "PHASE3100_FORTY_TOOL_TARGET_FORTY_OK";',
  );
  fn = replaceOnce(fn, "idx: 39,", "idx: 40,");
  fn = replaceOnce(fn, "path: sourceTargetPaths[38],", "path: sourceTargetPaths[39],");
  fn = replaceOnce(
    fn,
    'proposal: "docs/phase3055-forty-tool-mutation-target-forty.proposal.diff",',
    'proposal: "docs/phase3100-forty-tool-mutation-target-forty.proposal.diff",',
  );
  fn = replaceOnce(
    fn,
    'newExport: "buildPhase3055FortyMutationRuntimeStatus",',
    'newExport: "buildPhase3100FortyMutationRuntimeStatus",',
  );
  fn = replaceOnce(
    fn,
    'newPhaseId: "Phase3055A-Controlled-Forty-Tool-Mutation-Target-Forty",',
    'newPhaseId: "Phase3100A-Controlled-Forty-Tool-Mutation-Target-Forty",',
  );
  fn = replaceOnce(
    fn,
    'requiredExports: ["export function buildPhase3055FortyMutationRuntimeStatus", "export function main"],',
    'requiredExports: ["export function buildPhase3100FortyMutationRuntimeStatus", "export function main"],',
  );
  return fn;
}

async function main() {
  await mkdir(targetDir, { recursive: true });
  let text = await readFile(sourcePath, "utf8");

  text = text.replace(/const phaseMeta = \{[\s\S]*?\n\};/, phaseMetaBlock());
  text = text.replace(/const previousPhaseMeta = \{[\s\S]*?\n\};/, previousPhaseMetaBlock());
  text = replaceOnce(text, `${from.titleArrayEntry}\n];`, `${from.titleArrayEntry}\n${to.titleArrayEntry}\n];`);
  text = replaceOnce(text, `${from.previousSourcePathLine}\n];`, `${from.previousSourcePathLine}\n${to.previousSourcePathLine}\n];`);
  text = replaceOnce(text, from.targetsBuildLine, to.targetsBuildLine);
  text = replaceOnce(text, "\nconst phase2091Checks = [", `\n${buildFortyTargetsFunction(text)}\n\nconst phase2091Checks = [`);

  text = replaceOnce(
    text,
    `      2933: "export function buildPhase2892ThirtySixMutationTargetTwoStatus() {",
      2934: "export function buildPhase2893ThirtySixMutationTargetThreeStatus() {",
      2935: "export function buildPhase2894ThirtySixMutationTargetFourStatus() {",
      2936: "export function buildPhase2895ThirtySixMutationTargetFiveStatus() {",
      2975: "export function buildPhase2933ThirtySevenMutationTargetTwoStatus() {",
      2976: "export function buildPhase2934ThirtySevenMutationTargetThreeStatus() {",
      2977: "export function buildPhase2935ThirtySevenMutationTargetFourStatus() {",
      2978: "export function buildPhase2936ThirtySevenMutationTargetFiveStatus() {",
      3018: "export function buildPhase2975ThirtyEightMutationTargetTwoStatus() {",
      3019: "export function buildPhase2976ThirtyEightMutationTargetThreeStatus() {",
      3020: "export function buildPhase2977ThirtyEightMutationTargetFourStatus() {",
      3021: "export function buildPhase2978ThirtyEightMutationTargetFiveStatus() {",
    };`,
    `      2933: "export function buildPhase2892ThirtySixMutationTargetTwoStatus() {",
      2934: "export function buildPhase2893ThirtySixMutationTargetThreeStatus() {",
      2935: "export function buildPhase2894ThirtySixMutationTargetFourStatus() {",
      2936: "export function buildPhase2895ThirtySixMutationTargetFiveStatus() {",
      2975: "export function buildPhase2933ThirtySevenMutationTargetTwoStatus() {",
      2976: "export function buildPhase2934ThirtySevenMutationTargetThreeStatus() {",
      2977: "export function buildPhase2935ThirtySevenMutationTargetFourStatus() {",
      2978: "export function buildPhase2936ThirtySevenMutationTargetFiveStatus() {",
      3018: "export function buildPhase2975ThirtyEightMutationTargetTwoStatus() {",
      3019: "export function buildPhase2976ThirtyEightMutationTargetThreeStatus() {",
      3020: "export function buildPhase2977ThirtyEightMutationTargetFourStatus() {",
      3021: "export function buildPhase2978ThirtyEightMutationTargetFiveStatus() {",
      3062: "export function buildPhase3018ThirtyNineMutationTargetTwoStatus() {",
      3063: "export function buildPhase3019ThirtyNineMutationTargetThreeStatus() {",
      3064: "export function buildPhase3020ThirtyNineMutationTargetFourStatus() {",
      3065: "export function buildPhase3021ThirtyNineMutationTargetFiveStatus() {",
    };`,
  );

  text = replaceOptional(text, from.tmpDir, to.tmpDir);

  const tailAnchor = "function buildDoc() {";
  const tailIndex = text.indexOf(tailAnchor);
  if (tailIndex < 0) throw new Error(`missing_tail_anchor:${tailAnchor}`);
  const head = text.slice(0, tailIndex);
  let tail = text.slice(tailIndex);

  tail = replaceOptional(tail, from.phaseId, to.phaseId);
  tail = replaceOptional(tail, `Phase${from.range}`, `Phase${to.range}`);
  tail = replaceAll(tail, `phase${from.range}`, `phase${to.range}`);
  tail = replaceAll(tail, from.title, to.title);
  tail = replaceOptional(tail, "Thirty-Nine", "Forty");
  tail = replaceAll(tail, from.lowerTitle, to.lowerTitle);
  tail = replaceOptional(tail, "ThirtyNine", "Forty");
  tail = replaceOptional(tail, "THIRTY_NINE", "FORTY");
  tail = replaceOptional(tail, "thirtyNine", "forty");
  tail = replaceOptional(tail, "thirty_nine", "forty");
  tail = replaceOptional(tail, "thirty nine", "forty");
  tail = replaceOptional(tail, "thirty-nine", "forty");
  tail = replaceOptional(tail, "from thirty-eight files to forty files", "from thirty-nine files to forty files");
  tail = replaceOptional(tail, "from thirty-eight files to thirty-nine files", "from thirty-nine files to forty files");
  tail = replaceOptional(tail, "Phase2969A-3011A", "Phase3012A-3055A");
  tail = replaceOptional(
    tail,
    "phase2969-3011-controlled-thirty-eight-tool-mutation",
    "phase3012-3055-controlled-thirty-nine-tool-mutation",
  );
  tail = replaceOptional(tail, from.previousSealVariable, to.previousSealVariable);
  tail = replaceOptional(tail, from.previousSealId, to.previousSealId);
  tail = replaceOptional(tail, from.previousSealBlocker, to.previousSealBlocker);
  tail = replaceOptional(tail, from.previousAppliedField, to.previousAppliedField);
  tail = replaceOptional(tail, from.smokeFile, to.smokeFile);
  tail = replaceOptional(tail, from.rollbackAction, to.rollbackAction);
  tail = replaceOptional(tail, from.permissionMode, to.permissionMode);
  tail = replaceOptional(tail, from.nodeCheckBlocker, to.nodeCheckBlocker);
  tail = replaceOptional(tail, from.readyField, to.readyField);
  tail = replaceOptional(tail, from.appliedField, to.appliedField);
  tail = replaceOptional(tail, from.smokeField, to.smokeField);
  tail = replaceOptional(tail, from.docsCheckId, to.docsCheckId);
  tail = replaceOptional(tail, from.changedCountCheckId, to.changedCountCheckId);
  tail = replaceOptional(tail, from.rollbackCheckId, to.rollbackCheckId);
  tail = replaceOptional(tail, from.rollbackEntriesCheckId, to.rollbackEntriesCheckId);
  tail = replaceOptional(tail, from.readySummaryField, to.readySummaryField);
  tail = replaceOptional(tail, "result.changedFileCount === 39", "result.changedFileCount === 40");
  tail = replaceOptional(tail, "rollback.files.length === 39", "rollback.files.length === 40");
  tail = replaceOptional(tail, "changedFileCount: result?.changedFileCount ?? 39", "changedFileCount: result?.changedFileCount ?? 40");
  tail = replaceOptional(tail, "expectedOperationCount: 39", "expectedOperationCount: 40");
  tail = replaceOptional(tail, "expectedMaxChangedFiles: 39", "expectedMaxChangedFiles: 40");
  tail = replaceOptional(tail, "maxChangedFiles: 39,", "maxChangedFiles: 40,");
  tail = replaceOptional(tail, "thirty-nine-file bounded batch", "forty-file bounded batch");
  tail = replaceOptional(
    tail,
    "# Phase3012A-3055A Controlled Forty Tool Mutation",
    "# Phase3056A-3100A Controlled Forty Tool Mutation",
  );
  tail = replaceOptional(
    tail,
    "Phase3012A-3055A extends the controlled local mutation line",
    "Phase3056A-3100A extends the controlled local mutation line",
  );
  tail = replaceOptional(
    tail,
    "# Phase3012A-3055A Controlled Forty Tool Mutation Evidence",
    "# Phase3056A-3100A Controlled Forty Tool Mutation Evidence",
  );

  text = head + tail;
  text = text.replace(/const phaseMeta = \{[\s\S]*?\n\};/, phaseMetaBlock());
  text = text.replace(/const previousPhaseMeta = \{[\s\S]*?\n\};/, previousPhaseMetaBlock());

  await writeFile(targetPath, text, "utf8");
  console.log(JSON.stringify({ status: "pass", targetPath }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
