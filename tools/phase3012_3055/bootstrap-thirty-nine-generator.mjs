import { mkdir, readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase2969_3011/generate-thirty-eight-phase-assets.mjs";
const targetDir = "tools/phase3012_3055";
const targetPath = `${targetDir}/generate-thirty-nine-phase-assets.mjs`;

const from = {
  range: "2969-3011",
  phaseId: "Phase2969A-3011A-Controlled-Thirty-Eight-Tool-Mutation",
  title: "Controlled Thirty-Eight Tool Mutation",
  lowerTitle: "controlled thirty-eight tool mutation",
  label: "thirty-eight",
  sourceDir: "phase2969_3011",
  previousPhaseId: "Phase2927A-2968A-Controlled-Thirty-Seven-Tool-Mutation",
  previousEvidencePath: "apps/ai-gateway-service/evidence/phase2927-2968-controlled-thirty-seven-tool-mutation/result.json",
  previousSealId: "phase2968_sealed",
  previousSealBlocker: "phase2968_not_sealed",
  previousSealVariable: "phase2968",
  previousAppliedField: "thirtySevenMutationApplied",
  previousSourcePathLine: '  "tools/phase2927_2968/apply-controlled-thirty-seven-tool-mutation.mjs",',
  titleArrayEntry: '  "ThirtyEight",',
  targetsBuildLine:
    "const thirtyFiveTargets = buildThirtyFiveTargets(thirtyFourTargets);\nconst thirtySixTargets = buildThirtySixTargets(thirtyFiveTargets);\nconst thirtySevenTargets = buildThirtySevenTargets(thirtySixTargets);\nconst targets = buildThirtyEightTargets(thirtySevenTargets);",
  tmpDir: "tmp/phase2969-3011-proposals",
  smokeFile: "thirty-eight-smoke.json",
  rollbackAction: "restore-previous-content-thirty-eight",
  permissionMode: "controlled-thirty-eight-tool-source-mutation",
  nodeCheckBlocker: "thirty_eight_mutation_node_check_or_smoke_failed",
  readyField: "thirtyEightRunnerReady",
  appliedField: "thirtyEightMutationApplied",
  smokeField: "localThirtyEightSmokePassed",
  docsCheckId: "docs_mentions_thirty_eight",
  changedCountCheckId: "changed_file_count_thirty_eight",
  rollbackCheckId: "rollback_restore_thirty_eight",
  rollbackEntriesCheckId: "rollback_thirty_eight_entries",
  readySummaryField: "thirtyEightMutationReady",
};

const to = {
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
  docPath: "docs/phase${to.range}-controlled-thirty-nine-tool-mutation.md",
  approvalPath: "docs/phase${to.range}-controlled-thirty-nine-tool-mutation-approval.example.json",
  runnerPath: "tools/${to.sourceDir}/apply-controlled-thirty-nine-tool-mutation.mjs",
  verifierPath: "tools/${to.sourceDir}/validate-controlled-thirty-nine-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase${to.range}-controlled-thirty-nine-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase${to.range}-controlled-thirty-nine-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase${to.range}-controlled-thirty-nine-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase${to.range}-controlled-thirty-nine-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase${to.range}-controlled-thirty-nine-tool-mutation/${to.smokeFile}",
  permissionMode: "${to.permissionMode}",
  label: "${to.label}",
  runnerReadyField: "${to.readyField}",
  appliedField: "${to.appliedField}",
  smokeField: "${to.smokeField}",
  rollbackAction: "${to.rollbackAction}",
  verifyScript: "verify:phase${to.range}-controlled-thirty-nine-tool-mutation",
  applyScript: "apply:phase${to.range}-controlled-thirty-nine-tool-mutation",
  smokeScript: "smoke:phase${to.range}-controlled-thirty-nine-tool-mutation",
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

function buildThirtyNineTargetsFunction(source) {
  const start = source.indexOf("function buildThirtyEightTargets(previousTargets) {");
  const end = source.indexOf("\nconst phase2091Checks = [", start);
  if (start < 0 || end < 0) throw new Error("missing_thirty_eight_targets_function");
  let fn = source.slice(start, end).trim();
  fn = replaceAll(fn, "buildThirtyEightTargets", "buildThirtyNineTargets");
  fn = replaceAll(fn, "Thirty-Eight", "Thirty-Nine");
  fn = replaceAll(fn, "ThirtyEight", "ThirtyNine");
  fn = replaceAll(fn, "THIRTY_EIGHT", "THIRTY_NINE");
  fn = replaceAll(fn, "thirtyEight", "thirtyNine");
  fn = replaceAll(fn, "thirty-eight", "thirty-nine");
  fn = replaceOnce(fn, "const phase = 2973 + idx;", "const phase = 3016 + idx;");
  fn = replaceOnce(fn, "const previousRuntimeTarget = previousTargets[36];", "const previousRuntimeTarget = previousTargets[37];");
  fn = replaceOnce(fn, "const thirtyNinePhase = 3011;", "const thirtyNinePhase = 3055;");
  fn = replaceOnce(
    fn,
    'const thirtyNineMarker = "PHASE3011_THIRTY_NINE_TOOL_TARGET_THIRTY_NINE_OK";',
    'const thirtyNineMarker = "PHASE3055_THIRTY_NINE_TOOL_TARGET_THIRTY_NINE_OK";',
  );
  fn = replaceOnce(fn, "idx: 38,", "idx: 39,");
  fn = replaceOnce(fn, "path: sourceTargetPaths[37],", "path: sourceTargetPaths[38],");
  fn = replaceOnce(
    fn,
    'proposal: "docs/phase3011-thirty-nine-tool-mutation-target-thirty-nine.proposal.diff",',
    'proposal: "docs/phase3055-thirty-nine-tool-mutation-target-thirty-nine.proposal.diff",',
  );
  fn = replaceOnce(
    fn,
    'newExport: "buildPhase3011ThirtyNineMutationRuntimeStatus",',
    'newExport: "buildPhase3055ThirtyNineMutationRuntimeStatus",',
  );
  fn = replaceOnce(
    fn,
    'newPhaseId: "Phase3011A-Controlled-Thirty-Nine-Tool-Mutation-Target-Thirty-Nine",',
    'newPhaseId: "Phase3055A-Controlled-Thirty-Nine-Tool-Mutation-Target-Thirty-Nine",',
  );
  fn = replaceOnce(
    fn,
    'requiredExports: ["export function buildPhase3011ThirtyNineMutationRuntimeStatus", "export function main"],',
    'requiredExports: ["export function buildPhase3055ThirtyNineMutationRuntimeStatus", "export function main"],',
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
  text = replaceOnce(text, "\nconst phase2091Checks = [", `\n${buildThirtyNineTargetsFunction(text)}\n\nconst phase2091Checks = [`);

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
  tail = replaceOptional(tail, "Thirty-Eight", "Thirty-Nine");
  tail = replaceAll(tail, from.lowerTitle, to.lowerTitle);
  tail = replaceOptional(tail, "ThirtyEight", "ThirtyNine");
  tail = replaceOptional(tail, "THIRTY_EIGHT", "THIRTY_NINE");
  tail = replaceOptional(tail, "thirtyEight", "thirtyNine");
  tail = replaceOptional(tail, "thirty_eight", "thirty_nine");
  tail = replaceOptional(tail, "thirty eight", "thirty nine");
  tail = replaceOptional(tail, "thirty-eight", "thirty-nine");
  tail = replaceOptional(tail, "from thirty-seven files to thirty-nine files", "from thirty-eight files to thirty-nine files");
  tail = replaceOptional(tail, "from thirty-seven files to thirty-eight files", "from thirty-eight files to thirty-nine files");
  tail = replaceOptional(tail, "Phase2927A-2968A", "Phase2969A-3011A");
  tail = replaceOptional(
    tail,
    "phase2927-2968-controlled-thirty-seven-tool-mutation",
    "phase2969-3011-controlled-thirty-eight-tool-mutation",
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
  tail = replaceOptional(tail, "result.changedFileCount === 38", "result.changedFileCount === 39");
  tail = replaceOptional(tail, "rollback.files.length === 38", "rollback.files.length === 39");
  tail = replaceOptional(tail, "changedFileCount: result?.changedFileCount ?? 38", "changedFileCount: result?.changedFileCount ?? 39");
  tail = replaceOptional(tail, "expectedOperationCount: 38", "expectedOperationCount: 39");
  tail = replaceOptional(tail, "expectedMaxChangedFiles: 38", "expectedMaxChangedFiles: 39");
  tail = replaceOptional(tail, "maxChangedFiles: 38,", "maxChangedFiles: 39,");
  tail = replaceOptional(tail, "thirty-eight-file bounded batch", "thirty-nine-file bounded batch");
  tail = replaceOptional(
    tail,
    "# Phase2969A-3011A Controlled Thirty-Nine Tool Mutation",
    "# Phase3012A-3055A Controlled Thirty-Nine Tool Mutation",
  );
  tail = replaceOptional(
    tail,
    "Phase2969A-3011A extends the controlled local mutation line",
    "Phase3012A-3055A extends the controlled local mutation line",
  );
  tail = replaceOptional(
    tail,
    "# Phase2969A-3011A Controlled Thirty-Nine Tool Mutation Evidence",
    "# Phase3012A-3055A Controlled Thirty-Nine Tool Mutation Evidence",
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
