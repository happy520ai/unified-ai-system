import { mkdir, readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase2886_2926/generate-thirty-six-phase-assets.mjs";
const targetDir = "tools/phase2927_2968";
const targetPath = `${targetDir}/generate-thirty-seven-phase-assets.mjs`;

const from = {
  range: "2886-2926",
  phaseId: "Phase2886A-2926A-Controlled-Thirty-Six-Tool-Mutation",
  title: "Controlled Thirty-Six Tool Mutation",
  lowerTitle: "controlled thirty-six tool mutation",
  label: "thirty-six",
  sourceDir: "phase2886_2926",
  previousPhaseId: "Phase2846A-2885A-Controlled-Thirty-Five-Tool-Mutation",
  previousEvidencePath: "apps/ai-gateway-service/evidence/phase2846-2885-controlled-thirty-five-tool-mutation/result.json",
  previousSealId: "phase2885_sealed",
  previousSealBlocker: "phase2885_not_sealed",
  previousSealVariable: "phase2885",
  previousAppliedField: "thirtyFiveMutationApplied",
  previousSourcePathLine: '  "tools/phase2846_2885/apply-controlled-thirty-five-tool-mutation.mjs",',
  titleArrayEntry: '  "ThirtySix",',
  targetsBuildLine:
    "const thirtyFiveTargets = buildThirtyFiveTargets(thirtyFourTargets);\nconst targets = buildThirtySixTargets(thirtyFiveTargets);",
  tmpDir: "tmp/phase2886-2926-proposals",
  smokeFile: "thirty-six-smoke.json",
  rollbackAction: "restore-previous-content-thirty-six",
  permissionMode: "controlled-thirty-six-tool-source-mutation",
  nodeCheckBlocker: "thirty_six_mutation_node_check_or_smoke_failed",
  readyField: "thirtySixRunnerReady",
  appliedField: "thirtySixMutationApplied",
  smokeField: "localThirtySixSmokePassed",
  docsCheckId: "docs_mentions_thirty_six",
  changedCountCheckId: "changed_file_count_thirty_six",
  rollbackCheckId: "rollback_restore_thirty_six",
  rollbackEntriesCheckId: "rollback_thirty_six_entries",
  readySummaryField: "thirtySixMutationReady",
};

const to = {
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
  docPath: "docs/phase${to.range}-controlled-thirty-seven-tool-mutation.md",
  approvalPath: "docs/phase${to.range}-controlled-thirty-seven-tool-mutation-approval.example.json",
  runnerPath: "tools/${to.sourceDir}/apply-controlled-thirty-seven-tool-mutation.mjs",
  verifierPath: "tools/${to.sourceDir}/validate-controlled-thirty-seven-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase${to.range}-controlled-thirty-seven-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase${to.range}-controlled-thirty-seven-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase${to.range}-controlled-thirty-seven-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase${to.range}-controlled-thirty-seven-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase${to.range}-controlled-thirty-seven-tool-mutation/${to.smokeFile}",
  permissionMode: "${to.permissionMode}",
  label: "${to.label}",
  runnerReadyField: "${to.readyField}",
  appliedField: "${to.appliedField}",
  smokeField: "${to.smokeField}",
  rollbackAction: "${to.rollbackAction}",
  verifyScript: "verify:phase${to.range}-controlled-thirty-seven-tool-mutation",
  applyScript: "apply:phase${to.range}-controlled-thirty-seven-tool-mutation",
  smokeScript: "smoke:phase${to.range}-controlled-thirty-seven-tool-mutation",
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

function buildThirtySevenTargetsFunction(source) {
  const start = source.indexOf("function buildThirtySixTargets(previousTargets) {");
  const end = source.indexOf("\nconst phase2091Checks = [", start);
  if (start < 0 || end < 0) throw new Error("missing_thirty_six_targets_function");
  let fn = source.slice(start, end).trim();
  fn = replaceAll(fn, "buildThirtySixTargets", "buildThirtySevenTargets");
  fn = replaceAll(fn, "Thirty-Six", "Thirty-Seven");
  fn = replaceAll(fn, "ThirtySix", "ThirtySeven");
  fn = replaceAll(fn, "THIRTY_SIX", "THIRTY_SEVEN");
  fn = replaceAll(fn, "thirtySix", "thirtySeven");
  fn = replaceAll(fn, "thirty-six", "thirty-seven");
  fn = replaceOnce(fn, "const phase = 2890 + idx;", "const phase = 2931 + idx;");
  fn = replaceOnce(fn, "const previousRuntimeTarget = previousTargets[34];", "const previousRuntimeTarget = previousTargets[35];");
  fn = replaceOnce(fn, "const thirtySevenPhase = 2926;", "const thirtySevenPhase = 2968;");
  fn = replaceOnce(
    fn,
    'const thirtySevenMarker = "PHASE2926_THIRTY_SEVEN_TOOL_TARGET_THIRTY_SEVEN_OK";',
    'const thirtySevenMarker = "PHASE2968_THIRTY_SEVEN_TOOL_TARGET_THIRTY_SEVEN_OK";',
  );
  fn = replaceOnce(fn, "idx: 36,", "idx: 37,");
  fn = replaceOnce(fn, "path: sourceTargetPaths[35],", "path: sourceTargetPaths[36],");
  fn = replaceOnce(
    fn,
    'proposal: "docs/phase2926-thirty-seven-tool-mutation-target-thirty-seven.proposal.diff",',
    'proposal: "docs/phase2968-thirty-seven-tool-mutation-target-thirty-seven.proposal.diff",',
  );
  fn = replaceOnce(
    fn,
    'newExport: "buildPhase2926ThirtySevenMutationRuntimeStatus",',
    'newExport: "buildPhase2968ThirtySevenMutationRuntimeStatus",',
  );
  fn = replaceOnce(
    fn,
    'newPhaseId: "Phase2926A-Controlled-Thirty-Seven-Tool-Mutation-Target-Thirty-Seven",',
    'newPhaseId: "Phase2968A-Controlled-Thirty-Seven-Tool-Mutation-Target-Thirty-Seven",',
  );
  fn = replaceOnce(
    fn,
    'requiredExports: ["export function buildPhase2926ThirtySevenMutationRuntimeStatus", "export function main"],',
    'requiredExports: ["export function buildPhase2968ThirtySevenMutationRuntimeStatus", "export function main"],',
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
  text = replaceOnce(text, "\nconst phase2091Checks = [", `\n${buildThirtySevenTargetsFunction(text)}\n\nconst phase2091Checks = [`);
  text = replaceOnce(
    text,
    `      2892: "export function buildPhase2852ThirtyFiveMutationTargetTwoStatus() {",
      2893: "export function buildPhase2853ThirtyFiveMutationTargetThreeStatus() {",
      2894: "export function buildPhase2854ThirtyFiveMutationTargetFourStatus() {",
      2895: "export function buildPhase2855ThirtyFiveMutationTargetFiveStatus() {",
    };`,
    `      2892: "export function buildPhase2852ThirtyFiveMutationTargetTwoStatus() {",
      2893: "export function buildPhase2853ThirtyFiveMutationTargetThreeStatus() {",
      2894: "export function buildPhase2854ThirtyFiveMutationTargetFourStatus() {",
      2895: "export function buildPhase2855ThirtyFiveMutationTargetFiveStatus() {",
      2933: "export function buildPhase2892ThirtySixMutationTargetTwoStatus() {",
      2934: "export function buildPhase2893ThirtySixMutationTargetThreeStatus() {",
      2935: "export function buildPhase2894ThirtySixMutationTargetFourStatus() {",
      2936: "export function buildPhase2895ThirtySixMutationTargetFiveStatus() {",
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
  tail = replaceOptional(tail, "Thirty-Six", "Thirty-Seven");
  tail = replaceAll(tail, from.lowerTitle, to.lowerTitle);
  tail = replaceOptional(tail, "ThirtySix", "ThirtySeven");
  tail = replaceOptional(tail, "THIRTY_SIX", "THIRTY_SEVEN");
  tail = replaceOptional(tail, "thirtySix", "thirtySeven");
  tail = replaceOptional(tail, "thirty_six", "thirty_seven");
  tail = replaceOptional(tail, "thirty six", "thirty seven");
  tail = replaceOptional(tail, "thirty-six", "thirty-seven");
  tail = replaceOptional(tail, "from thirty-five files to thirty-seven files", "from thirty-six files to thirty-seven files");
  tail = replaceOptional(tail, "Phase2846A-2885A", "Phase2886A-2926A");
  tail = replaceOptional(
    tail,
    "phase2846-2885-controlled-thirty-five-tool-mutation",
    "phase2886-2926-controlled-thirty-six-tool-mutation",
  );
  tail = replaceOptional(tail, from.previousSealVariable, to.previousSealVariable);
  tail = replaceOptional(tail, from.previousSealId, to.previousSealId);
  tail = replaceOptional(tail, from.previousSealBlocker, to.previousSealBlocker);
  tail = replaceOptional(tail, from.previousAppliedField, to.appliedField);
  tail = replaceOptional(tail, from.smokeFile, to.smokeFile);
  tail = replaceOptional(tail, from.rollbackAction, to.rollbackAction);
  tail = replaceOptional(tail, from.permissionMode, to.permissionMode);
  tail = replaceOptional(tail, from.nodeCheckBlocker, to.nodeCheckBlocker);
  tail = replaceOptional(tail, from.readyField, to.readyField);
  tail = replaceOptional(tail, from.smokeField, to.smokeField);
  tail = replaceOptional(tail, from.docsCheckId, to.docsCheckId);
  tail = replaceOptional(tail, from.changedCountCheckId, to.changedCountCheckId);
  tail = replaceOptional(tail, from.rollbackCheckId, to.rollbackCheckId);
  tail = replaceOptional(tail, from.rollbackEntriesCheckId, to.rollbackEntriesCheckId);
  tail = replaceOptional(tail, from.readySummaryField, to.readySummaryField);
  tail = replaceOptional(tail, "result.changedFileCount === 36", "result.changedFileCount === 37");
  tail = replaceOptional(tail, "rollback.files.length === 36", "rollback.files.length === 37");
  tail = replaceOptional(tail, "changedFileCount: result?.changedFileCount ?? 36", "changedFileCount: result?.changedFileCount ?? 37");
  tail = replaceOptional(tail, "expectedOperationCount: 36", "expectedOperationCount: 37");
  tail = replaceOptional(tail, "expectedMaxChangedFiles: 36", "expectedMaxChangedFiles: 37");
  tail = replaceOptional(tail, "maxChangedFiles: 36,", "maxChangedFiles: 37,");
  tail = replaceOptional(tail, "thirty-seven-file bounded batch", "thirty-eight-file bounded batch");
  tail = replaceOptional(
    tail,
    "# Phase2886A-2926A Controlled Thirty-Seven Tool Mutation",
    "# Phase2927A-2968A Controlled Thirty-Seven Tool Mutation",
  );
  tail = replaceOptional(
    tail,
    "Phase2886A-2926A extends the controlled local mutation line",
    "Phase2927A-2968A extends the controlled local mutation line",
  );
  tail = replaceOptional(
    tail,
    "# Phase2886A-2926A Controlled Thirty-Seven Tool Mutation Evidence",
    "# Phase2927A-2968A Controlled Thirty-Seven Tool Mutation Evidence",
  );

  text = head + tail;
  text = text.replace(/const phaseMeta = \{[\s\S]*?\n\};/, phaseMetaBlock());
  text = text.replace(/const previousPhaseMeta = \{[\s\S]*?\n\};/, previousPhaseMetaBlock());

  await writeFile(targetPath, text, "utf8");
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
