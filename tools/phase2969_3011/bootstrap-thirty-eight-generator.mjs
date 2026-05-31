import { mkdir, readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase2927_2968/generate-thirty-seven-phase-assets.mjs";
const targetDir = "tools/phase2969_3011";
const targetPath = `${targetDir}/generate-thirty-eight-phase-assets.mjs`;

const from = {
  range: "2927-2968",
  phaseId: "Phase2927A-2968A-Controlled-Thirty-Seven-Tool-Mutation",
  title: "Controlled Thirty-Seven Tool Mutation",
  lowerTitle: "controlled thirty-seven tool mutation",
  label: "thirty-seven",
  sourceDir: "phase2927_2968",
  previousPhaseId: "Phase2886A-2926A-Controlled-Thirty-Six-Tool-Mutation",
  previousEvidencePath: "apps/ai-gateway-service/evidence/phase2886-2926-controlled-thirty-six-tool-mutation/result.json",
  previousSealId: "phase2926_sealed",
  previousSealBlocker: "phase2926_not_sealed",
  previousSealVariable: "phase2926",
  previousAppliedField: "thirtySixMutationApplied",
  previousSourcePathLine: '  "tools/phase2886_2926/apply-controlled-thirty-six-tool-mutation.mjs",',
  titleArrayEntry: '  "ThirtySeven",',
  targetsBuildLine:
    "const thirtyFiveTargets = buildThirtyFiveTargets(thirtyFourTargets);\nconst thirtySixTargets = buildThirtySixTargets(thirtyFiveTargets);\nconst targets = buildThirtySevenTargets(thirtySixTargets);",
  tmpDir: "tmp/phase2927-2968-proposals",
  smokeFile: "thirty-seven-smoke.json",
  rollbackAction: "restore-previous-content-thirty-seven",
  permissionMode: "controlled-thirty-seven-tool-source-mutation",
  nodeCheckBlocker: "thirty_seven_mutation_node_check_or_smoke_failed",
  readyField: "thirtySevenRunnerReady",
  appliedField: "thirtySevenMutationApplied",
  smokeField: "localThirtySevenSmokePassed",
  docsCheckId: "docs_mentions_thirty_seven",
  changedCountCheckId: "changed_file_count_thirty_seven",
  rollbackCheckId: "rollback_restore_thirty_seven",
  rollbackEntriesCheckId: "rollback_thirty_seven_entries",
  readySummaryField: "thirtySevenMutationReady",
};

const to = {
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
  docPath: "docs/phase${to.range}-controlled-thirty-eight-tool-mutation.md",
  approvalPath: "docs/phase${to.range}-controlled-thirty-eight-tool-mutation-approval.example.json",
  runnerPath: "tools/${to.sourceDir}/apply-controlled-thirty-eight-tool-mutation.mjs",
  verifierPath: "tools/${to.sourceDir}/validate-controlled-thirty-eight-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase${to.range}-controlled-thirty-eight-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase${to.range}-controlled-thirty-eight-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase${to.range}-controlled-thirty-eight-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase${to.range}-controlled-thirty-eight-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase${to.range}-controlled-thirty-eight-tool-mutation/${to.smokeFile}",
  permissionMode: "${to.permissionMode}",
  label: "${to.label}",
  runnerReadyField: "${to.readyField}",
  appliedField: "${to.appliedField}",
  smokeField: "${to.smokeField}",
  rollbackAction: "${to.rollbackAction}",
  verifyScript: "verify:phase${to.range}-controlled-thirty-eight-tool-mutation",
  applyScript: "apply:phase${to.range}-controlled-thirty-eight-tool-mutation",
  smokeScript: "smoke:phase${to.range}-controlled-thirty-eight-tool-mutation",
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

function buildThirtyEightTargetsFunction(source) {
  const start = source.indexOf("function buildThirtySevenTargets(previousTargets) {");
  const end = source.indexOf("\nconst phase2091Checks = [", start);
  if (start < 0 || end < 0) throw new Error("missing_thirty_seven_targets_function");
  let fn = source.slice(start, end).trim();
  fn = replaceAll(fn, "buildThirtySevenTargets", "buildThirtyEightTargets");
  fn = replaceAll(fn, "Thirty-Seven", "Thirty-Eight");
  fn = replaceAll(fn, "ThirtySeven", "ThirtyEight");
  fn = replaceAll(fn, "THIRTY_SEVEN", "THIRTY_EIGHT");
  fn = replaceAll(fn, "thirtySeven", "thirtyEight");
  fn = replaceAll(fn, "thirty-seven", "thirty-eight");
  fn = replaceOnce(fn, "const phase = 2931 + idx;", "const phase = 2973 + idx;");
  fn = replaceOnce(fn, "const previousRuntimeTarget = previousTargets[35];", "const previousRuntimeTarget = previousTargets[36];");
  fn = replaceOnce(fn, "const thirtyEightPhase = 2968;", "const thirtyEightPhase = 3011;");
  fn = replaceOnce(
    fn,
    'const thirtyEightMarker = "PHASE2968_THIRTY_EIGHT_TOOL_TARGET_THIRTY_EIGHT_OK";',
    'const thirtyEightMarker = "PHASE3011_THIRTY_EIGHT_TOOL_TARGET_THIRTY_EIGHT_OK";',
  );
  fn = replaceOnce(fn, "idx: 37,", "idx: 38,");
  fn = replaceOnce(fn, "path: sourceTargetPaths[36],", "path: sourceTargetPaths[37],");
  fn = replaceOnce(
    fn,
    'proposal: "docs/phase2968-thirty-eight-tool-mutation-target-thirty-eight.proposal.diff",',
    'proposal: "docs/phase3011-thirty-eight-tool-mutation-target-thirty-eight.proposal.diff",',
  );
  fn = replaceOnce(
    fn,
    'newExport: "buildPhase2968ThirtyEightMutationRuntimeStatus",',
    'newExport: "buildPhase3011ThirtyEightMutationRuntimeStatus",',
  );
  fn = replaceOnce(
    fn,
    'newPhaseId: "Phase2968A-Controlled-Thirty-Eight-Tool-Mutation-Target-Thirty-Eight",',
    'newPhaseId: "Phase3011A-Controlled-Thirty-Eight-Tool-Mutation-Target-Thirty-Eight",',
  );
  fn = replaceOnce(
    fn,
    'requiredExports: ["export function buildPhase2968ThirtyEightMutationRuntimeStatus", "export function main"],',
    'requiredExports: ["export function buildPhase3011ThirtyEightMutationRuntimeStatus", "export function main"],',
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
  text = replaceOnce(text, "\nconst phase2091Checks = [", `\n${buildThirtyEightTargetsFunction(text)}\n\nconst phase2091Checks = [`);

  text = replaceOnce(
    text,
    `      2933: "export function buildPhase2892ThirtySixMutationTargetTwoStatus() {",
      2934: "export function buildPhase2893ThirtySixMutationTargetThreeStatus() {",
      2935: "export function buildPhase2894ThirtySixMutationTargetFourStatus() {",
      2936: "export function buildPhase2895ThirtySixMutationTargetFiveStatus() {",
    };`,
    `      2933: "export function buildPhase2892ThirtySixMutationTargetTwoStatus() {",
      2934: "export function buildPhase2893ThirtySixMutationTargetThreeStatus() {",
      2935: "export function buildPhase2894ThirtySixMutationTargetFourStatus() {",
      2936: "export function buildPhase2895ThirtySixMutationTargetFiveStatus() {",
      2975: "export function buildPhase2933ThirtySevenMutationTargetTwoStatus() {",
      2976: "export function buildPhase2934ThirtySevenMutationTargetThreeStatus() {",
      2977: "export function buildPhase2935ThirtySevenMutationTargetFourStatus() {",
      2978: "export function buildPhase2936ThirtySevenMutationTargetFiveStatus() {",
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
  tail = replaceOptional(tail, "Thirty-Seven", "Thirty-Eight");
  tail = replaceAll(tail, from.lowerTitle, to.lowerTitle);
  tail = replaceOptional(tail, "ThirtySeven", "ThirtyEight");
  tail = replaceOptional(tail, "THIRTY_SEVEN", "THIRTY_EIGHT");
  tail = replaceOptional(tail, "thirtySeven", "thirtyEight");
  tail = replaceOptional(tail, "thirty_seven", "thirty_eight");
  tail = replaceOptional(tail, "thirty seven", "thirty eight");
  tail = replaceOptional(tail, "thirty-seven", "thirty-eight");
  tail = replaceOptional(tail, "from thirty-six files to thirty-eight files", "from thirty-seven files to thirty-eight files");
  tail = replaceOptional(tail, "from thirty-six files to thirty-seven files", "from thirty-seven files to thirty-eight files");
  tail = replaceOptional(tail, "Phase2886A-2926A", "Phase2927A-2968A");
  tail = replaceOptional(
    tail,
    "phase2886-2926-controlled-thirty-six-tool-mutation",
    "phase2927-2968-controlled-thirty-seven-tool-mutation",
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
  tail = replaceOptional(tail, "result.changedFileCount === 37", "result.changedFileCount === 38");
  tail = replaceOptional(tail, "rollback.files.length === 37", "rollback.files.length === 38");
  tail = replaceOptional(tail, "changedFileCount: result?.changedFileCount ?? 37", "changedFileCount: result?.changedFileCount ?? 38");
  tail = replaceOptional(tail, "expectedOperationCount: 37", "expectedOperationCount: 38");
  tail = replaceOptional(tail, "expectedMaxChangedFiles: 37", "expectedMaxChangedFiles: 38");
  tail = replaceOptional(tail, "maxChangedFiles: 37,", "maxChangedFiles: 38,");
  tail = replaceOptional(tail, "thirty-seven-file bounded batch", "thirty-eight-file bounded batch");
  tail = replaceOptional(
    tail,
    "# Phase2927A-2968A Controlled Thirty-Eight Tool Mutation",
    "# Phase2969A-3011A Controlled Thirty-Eight Tool Mutation",
  );
  tail = replaceOptional(
    tail,
    "Phase2927A-2968A extends the controlled local mutation line",
    "Phase2969A-3011A extends the controlled local mutation line",
  );
  tail = replaceOptional(
    tail,
    "# Phase2927A-2968A Controlled Thirty-Eight Tool Mutation Evidence",
    "# Phase2969A-3011A Controlled Thirty-Eight Tool Mutation Evidence",
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
