import { mkdir, readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase2846_2885/generate-thirty-five-phase-assets.mjs";
const targetDir = "tools/phase2886_2926";
const targetPath = `${targetDir}/generate-thirty-six-phase-assets.mjs`;

const from = {
  range: "2846-2885",
  phaseId: "Phase2846A-2885A-Controlled-Thirty-Five-Tool-Mutation",
  title: "Controlled Thirty-Five Tool Mutation",
  lowerTitle: "controlled thirty-five tool mutation",
  label: "thirty-five",
  labelCompact: "thirtyFive",
  labelSnake: "thirty_five",
  labelWords: "thirty five",
  sourceDir: "phase2846_2885",
  previousPhaseId: "Phase2807A-2845A-Controlled-Thirty-Four-Tool-Mutation",
  previousEvidencePath: "apps/ai-gateway-service/evidence/phase2807-2845-controlled-thirty-four-tool-mutation/result.json",
  previousSealId: "phase2845_sealed",
  previousSealBlocker: "phase2845_not_sealed",
  previousSealVariable: "phase2845",
  previousAppliedField: "thirtyFourMutationApplied",
  previousSourcePathLine: '  "tools/phase2807_2845/apply-controlled-thirty-four-tool-mutation.mjs",',
  titleArrayEntry: '  "ThirtyFive",',
  targetsBuildLine:
    "const thirtyFourTargets = buildThirtyFourTargets(thirtyThreeTargets);\nconst targets = buildThirtyFiveTargets(thirtyFourTargets);",
  tmpDir: "tmp/phase2846-2885-proposals",
  smokeFile: "thirty-five-smoke.json",
  rollbackAction: "restore-previous-content-thirty-five",
  permissionMode: "controlled-thirty-five-tool-source-mutation",
  nodeCheckBlocker: "thirty_five_mutation_node_check_or_smoke_failed",
  readyField: "thirtyFiveRunnerReady",
  appliedField: "thirtyFiveMutationApplied",
  smokeField: "localThirtyFiveSmokePassed",
  docsCheckId: "docs_mentions_thirty_five",
  changedCountCheckId: "changed_file_count_thirty_five",
  rollbackCheckId: "rollback_restore_thirty_five",
  rollbackEntriesCheckId: "rollback_thirty_five_entries",
  readySummaryField: "thirtyFiveMutationReady",
};

const to = {
  range: "2886-2926",
  phaseId: "Phase2886A-2926A-Controlled-Thirty-Six-Tool-Mutation",
  title: "Controlled Thirty-Six Tool Mutation",
  lowerTitle: "controlled thirty-six tool mutation",
  label: "thirty-six",
  labelCompact: "thirtySix",
  labelSnake: "thirty_six",
  labelWords: "thirty six",
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
    "const thirtyFourTargets = buildThirtyFourTargets(thirtyThreeTargets);\nconst thirtyFiveTargets = buildThirtyFiveTargets(thirtyFourTargets);\nconst targets = buildThirtySixTargets(thirtyFiveTargets);",
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
  docPath: "docs/phase${to.range}-controlled-thirty-six-tool-mutation.md",
  approvalPath: "docs/phase${to.range}-controlled-thirty-six-tool-mutation-approval.example.json",
  runnerPath: "tools/${to.sourceDir}/apply-controlled-thirty-six-tool-mutation.mjs",
  verifierPath: "tools/${to.sourceDir}/validate-controlled-thirty-six-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase${to.range}-controlled-thirty-six-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase${to.range}-controlled-thirty-six-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase${to.range}-controlled-thirty-six-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase${to.range}-controlled-thirty-six-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase${to.range}-controlled-thirty-six-tool-mutation/${to.smokeFile}",
  permissionMode: "${to.permissionMode}",
  label: "${to.label}",
  runnerReadyField: "${to.readyField}",
  appliedField: "${to.appliedField}",
  smokeField: "${to.smokeField}",
  rollbackAction: "${to.rollbackAction}",
  verifyScript: "verify:phase${to.range}-controlled-thirty-six-tool-mutation",
  applyScript: "apply:phase${to.range}-controlled-thirty-six-tool-mutation",
  smokeScript: "smoke:phase${to.range}-controlled-thirty-six-tool-mutation",
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

function buildThirtySixTargetsFunction(source) {
  const start = source.indexOf("function buildThirtyFiveTargets(previousTargets) {");
  const end = source.indexOf("\nconst phase2091Checks = [", start);
  if (start < 0 || end < 0) throw new Error("missing_thirty_five_targets_function");
  let fn = source.slice(start, end).trim();
  fn = replaceAll(fn, "buildThirtyFiveTargets", "buildThirtySixTargets");
  fn = replaceAll(fn, "Thirty-Five", "Thirty-Six");
  fn = replaceAll(fn, "ThirtyFive", "ThirtySix");
  fn = replaceAll(fn, "THIRTY_FIVE", "THIRTY_SIX");
  fn = replaceAll(fn, "thirtyFive", "thirtySix");
  fn = replaceAll(fn, "thirty-five", "thirty-six");
  fn = replaceOnce(fn, "const phase = 2850 + idx;", "const phase = 2890 + idx;");
  fn = replaceOnce(fn, "const previousRuntimeTarget = previousTargets[33];", "const previousRuntimeTarget = previousTargets[34];");
  fn = replaceOnce(fn, "const thirtySixPhase = 2885;", "const thirtySixPhase = 2926;");
  fn = replaceOnce(
    fn,
    'const thirtySixMarker = "PHASE2885_THIRTY_SIX_TOOL_TARGET_THIRTY_SIX_OK";',
    'const thirtySixMarker = "PHASE2926_THIRTY_SIX_TOOL_TARGET_THIRTY_SIX_OK";',
  );
  fn = replaceOnce(fn, "idx: 35,", "idx: 36,");
  fn = replaceOnce(fn, "path: sourceTargetPaths[34],", "path: sourceTargetPaths[35],");
  fn = replaceOnce(
    fn,
    'proposal: "docs/phase2885-thirty-six-tool-mutation-target-thirty-six.proposal.diff",',
    'proposal: "docs/phase2926-thirty-six-tool-mutation-target-thirty-six.proposal.diff",',
  );
  fn = replaceOnce(
    fn,
    'newExport: "buildPhase2885ThirtySixMutationRuntimeStatus",',
    'newExport: "buildPhase2926ThirtySixMutationRuntimeStatus",',
  );
  fn = replaceOnce(
    fn,
    'newPhaseId: "Phase2885A-Controlled-Thirty-Six-Tool-Mutation-Target-Thirty-Six",',
    'newPhaseId: "Phase2926A-Controlled-Thirty-Six-Tool-Mutation-Target-Thirty-Six",',
  );
  fn = replaceOnce(
    fn,
    'requiredExports: ["export function buildPhase2885ThirtySixMutationRuntimeStatus", "export function main"],',
    'requiredExports: ["export function buildPhase2926ThirtySixMutationRuntimeStatus", "export function main"],',
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
  text = replaceOnce(text, "\nconst phase2091Checks = [", `\n${buildThirtySixTargetsFunction(text)}\n\nconst phase2091Checks = [`);
  text = replaceOnce(
    text,
    `      2852: "export function buildPhase2813ThirtyFourMutationTargetTwoStatus() {",
      2853: "export function buildPhase2814ThirtyFourMutationTargetThreeStatus() {",
      2854: "export function buildPhase2815ThirtyFourMutationTargetFourStatus() {",
      2855: "export function buildPhase2816ThirtyFourMutationTargetFiveStatus() {",
    };`,
    `      2852: "export function buildPhase2813ThirtyFourMutationTargetTwoStatus() {",
      2853: "export function buildPhase2814ThirtyFourMutationTargetThreeStatus() {",
      2854: "export function buildPhase2815ThirtyFourMutationTargetFourStatus() {",
      2855: "export function buildPhase2816ThirtyFourMutationTargetFiveStatus() {",
      2892: "export function buildPhase2852ThirtyFiveMutationTargetTwoStatus() {",
      2893: "export function buildPhase2853ThirtyFiveMutationTargetThreeStatus() {",
      2894: "export function buildPhase2854ThirtyFiveMutationTargetFourStatus() {",
      2895: "export function buildPhase2855ThirtyFiveMutationTargetFiveStatus() {",
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
  tail = replaceOptional(tail, "Thirty-Five", "Thirty-Six");
  tail = replaceAll(tail, from.lowerTitle, to.lowerTitle);
  tail = replaceOptional(tail, "ThirtyFive", "ThirtySix");
  tail = replaceOptional(tail, "THIRTY_FIVE", "THIRTY_SIX");
  tail = replaceOptional(tail, "thirtyFive", "thirtySix");
  tail = replaceOptional(tail, "thirty_five", "thirty_six");
  tail = replaceOptional(tail, "thirty five", "thirty six");
  tail = replaceOptional(tail, "thirty-five", "thirty-six");
  tail = replaceOptional(tail, "from thirty-four files to thirty-six files", "from thirty-five files to thirty-six files");
  tail = replaceOptional(tail, "Phase2807A-2845A", "Phase2846A-2885A");
  tail = replaceOptional(
    tail,
    "phase2807-2845-controlled-thirty-four-tool-mutation",
    "phase2846-2885-controlled-thirty-five-tool-mutation",
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
  tail = replaceOptional(tail, "result.changedFileCount === 35", "result.changedFileCount === 36");
  tail = replaceOptional(tail, "rollback.files.length === 35", "rollback.files.length === 36");
  tail = replaceOptional(tail, "changedFileCount: result?.changedFileCount ?? 35", "changedFileCount: result?.changedFileCount ?? 36");
  tail = replaceOptional(tail, "expectedOperationCount: 35", "expectedOperationCount: 36");
  tail = replaceOptional(tail, "expectedMaxChangedFiles: 35", "expectedMaxChangedFiles: 36");
  tail = replaceOptional(tail, "maxChangedFiles: 35,", "maxChangedFiles: 36,");
  tail = replaceOptional(tail, "thirty-six-file bounded batch", "thirty-seven-file bounded batch");
  tail = replaceOptional(
    tail,
    "# Phase2846A-2885A Controlled Thirty-Six Tool Mutation",
    "# Phase2886A-2926A Controlled Thirty-Six Tool Mutation",
  );
  tail = replaceOptional(
    tail,
    "Phase2846A-2885A extends the controlled local mutation line",
    "Phase2886A-2926A extends the controlled local mutation line",
  );
  tail = replaceOptional(
    tail,
    "# Phase2846A-2885A Controlled Thirty-Six Tool Mutation Evidence",
    "# Phase2886A-2926A Controlled Thirty-Six Tool Mutation Evidence",
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
