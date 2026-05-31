import { mkdir, readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase3836_3895/generate-fifty-five-phase-assets.mjs";
const targetDir = "tools/phase3896_3956";
const targetPath = `${targetDir}/generate-fifty-six-phase-assets.mjs`;

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
  phaseId: "Phase3896A-3956A-Controlled-Fifty-Six-Tool-Mutation",
  docPath: "docs/phase3896-3956-controlled-fifty-six-tool-mutation.md",
  approvalPath: "docs/phase3896-3956-controlled-fifty-six-tool-mutation-approval.example.json",
  runnerPath: "tools/phase3896_3956/apply-controlled-fifty-six-tool-mutation.mjs",
  smokeRunnerPath: "tools/phase3896_3956/smoke-controlled-fifty-six-tool-mutation.mjs",
  verifierPath: "tools/phase3896_3956/validate-controlled-fifty-six-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase3896-3956-controlled-fifty-six-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase3896-3956-controlled-fifty-six-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase3896-3956-controlled-fifty-six-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase3896-3956-controlled-fifty-six-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase3896-3956-controlled-fifty-six-tool-mutation/fifty-six-smoke.json",
  permissionMode: "controlled-fifty-six-tool-source-mutation",
  label: "fifty-six",
  runnerReadyField: "fiftySixRunnerReady",
  appliedField: "fiftySixMutationApplied",
  smokeField: "localFiftySixSmokePassed",
  rollbackAction: "restore-previous-content-fifty-six",
  verifyScript: "verify:phase3896-3956-controlled-fifty-six-tool-mutation",
  applyScript: "apply:phase3896-3956-controlled-fifty-six-tool-mutation",
  smokeScript: "smoke:phase3896-3956-controlled-fifty-six-tool-mutation",
};`;
}

function previousPhaseMetaBlock() {
  return `const previousPhaseMeta = {
  phaseId: "Phase3836A-3895A-Controlled-Fifty-Five-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase3836-3895-controlled-fifty-five-tool-mutation/result.json",
  sealCheckId: "phase3895_sealed",
  sealCheckField: "fiftyFiveMutationApplied",
  sealCheckBlocker: "phase3895_not_sealed",
};`;
}

function buildFiftySixTargetsFunction(source) {
  const start = source.indexOf("function buildFiftyFiveTargets(previousTargets) {");
  const end = source.indexOf("\nconst phase2091Checks = [", start);
  if (start < 0 || end < 0) throw new Error("missing_fifty_five_targets_function");
  let fn = source.slice(start, end).trim();
  fn = replaceAll(fn, "buildFiftyFiveTargets", "buildFiftySixTargets");
  fn = replaceAll(fn, "FiftyFiveMutation", "FiftySixMutation");
  fn = replaceAll(fn, "Controlled-Fifty-Five-Tool", "Controlled-Fifty-Six-Tool");
  fn = replaceAll(fn, "FIFTY_FIVE_TOOL", "FIFTY_SIX_TOOL");
  fn = replaceAll(fn, "fifty-five-tool", "fifty-six-tool");
  fn = replaceOnce(fn, "const phase = 3840 + idx;", "const phase = 3900 + idx;");
  fn = replaceOnce(fn, "const previousRuntimeTarget = previousTargets[53];", "const previousRuntimeTarget = previousTargets[54];");
  fn = replaceOnce(fn, "const fiftyFivePhase = 3895;", "const fiftySixPhase = 3956;");
  fn = replaceAll(fn, "fiftyFivePhase", "fiftySixPhase");
  fn = replaceOnce(
    fn,
    'const fiftyFiveMarker = "PHASE3895_FIFTY_SIX_TOOL_TARGET_FIFTY_FIVE_OK";',
    'const fiftySixMarker = "PHASE3956_FIFTY_SIX_TOOL_TARGET_FIFTY_SIX_OK";',
  );
  fn = replaceAll(fn, "fiftyFiveMarker", "fiftySixMarker");
  fn = replaceOnce(fn, "idx: 55,", "idx: 56,");
  fn = replaceOnce(fn, 'word: "fifty-five",', 'word: "fifty-six",');
  fn = replaceOnce(fn, 'targetName: "target-fifty-five",', 'targetName: "target-fifty-six",');
  fn = replaceOnce(fn, "path: sourceTargetPaths[54],", "path: sourceTargetPaths[55],");
  fn = replaceOnce(
    fn,
    'proposal: "docs/phase3895-fifty-six-tool-mutation-target-fifty-five.proposal.diff",',
    'proposal: "docs/phase3956-fifty-six-tool-mutation-target-fifty-six.proposal.diff",',
  );
  fn = replaceOnce(
    fn,
    'newExport: "buildPhase3895FiftySixMutationRuntimeStatus",',
    'newExport: "buildPhase3956FiftySixMutationRuntimeStatus",',
  );
  fn = replaceOnce(
    fn,
    'newPhaseId: "Phase3895A-Controlled-Fifty-Six-Tool-Mutation-Target-Fifty-Five",',
    'newPhaseId: "Phase3956A-Controlled-Fifty-Six-Tool-Mutation-Target-Fifty-Six",',
  );
  fn = replaceOnce(
    fn,
    'requiredExports: ["export function buildPhase3895FiftySixMutationRuntimeStatus", "export function main"],',
    'requiredExports: ["export function buildPhase3956FiftySixMutationRuntimeStatus", "export function main"],',
  );
  return fn;
}

function addAnchorMapEntries(text) {
  return replaceOnce(
    text,
    `      3842: "export function buildPhase3783FiftyFourMutationTargetTwoStatus() {",
      3843: "export function buildPhase3784FiftyFourMutationTargetThreeStatus() {",
      3844: "export function buildPhase3785FiftyFourMutationTargetFourStatus() {",
      3845: "export function buildPhase3786FiftyFourMutationTargetFiveStatus() {",`,
    `      3842: "export function buildPhase3783FiftyFourMutationTargetTwoStatus() {",
      3843: "export function buildPhase3784FiftyFourMutationTargetThreeStatus() {",
      3844: "export function buildPhase3785FiftyFourMutationTargetFourStatus() {",
      3845: "export function buildPhase3786FiftyFourMutationTargetFiveStatus() {",
      3902: "export function buildPhase3842FiftyFiveMutationTargetTwoStatus() {",
      3903: "export function buildPhase3843FiftyFiveMutationTargetThreeStatus() {",
      3904: "export function buildPhase3844FiftyFiveMutationTargetFourStatus() {",
      3905: "export function buildPhase3845FiftyFiveMutationTargetFiveStatus() {",`,
  );
}

function updateTail(tail) {
  tail = replaceOptional(tail, "Phase3836A-3895A-Controlled-Fifty-Five-Tool-Mutation", "Phase3896A-3956A-Controlled-Fifty-Six-Tool-Mutation");
  tail = replaceOptional(tail, "Phase3836A-3895A", "Phase3896A-3956A");
  tail = replaceOptional(tail, "phase3836-3895", "phase3896-3956");
  tail = replaceOptional(tail, "tools/phase3836_3895/smoke-controlled-fifty-five-tool-mutation.mjs", "tools/phase3896_3956/smoke-controlled-fifty-six-tool-mutation.mjs");
  tail = replaceOptional(tail, "controlled-fifty-five-tool-mutation", "controlled-fifty-six-tool-mutation");
  tail = replaceOptional(tail, "Controlled Fifty-Five Tool Mutation", "Controlled Fifty-Six Tool Mutation");
  tail = replaceOptional(tail, "controlled fifty-five tool mutation", "controlled fifty-six tool mutation");
  tail = replaceOptional(tail, "fifty-five tool mutation", "fifty-six tool mutation");
  tail = replaceOptional(tail, "Fifty-Five Tool", "Fifty-Six Tool");
  tail = replaceOptional(tail, "fifty-five-smoke.json", "fifty-six-smoke.json");
  tail = replaceOptional(tail, "restore-previous-content-fifty-five", "restore-previous-content-fifty-six");
  tail = replaceOptional(tail, "controlled-fifty-five-tool-source-mutation", "controlled-fifty-six-tool-source-mutation");
  tail = replaceOptional(tail, "fifty_five_mutation_node_check_or_smoke_failed", "fifty_six_mutation_node_check_or_smoke_failed");
  tail = replaceOptional(tail, "fiftyFiveRunnerReady", "fiftySixRunnerReady");
  tail = replaceOptional(tail, "fiftyFiveMutationApplied", "fiftySixMutationApplied");
  tail = replaceOptional(tail, "localFiftyFiveSmokePassed", "localFiftySixSmokePassed");
  tail = replaceOptional(tail, "docs_mentions_fifty_five", "docs_mentions_fifty_six");
  tail = replaceOptional(tail, "changed_file_count_fifty_five", "changed_file_count_fifty_six");
  tail = replaceOptional(tail, "fifty_five_mutation_applied", "fifty_six_mutation_applied");
  tail = replaceOptional(tail, "rollback_restore_fifty_five", "rollback_restore_fifty_six");
  tail = replaceOptional(tail, "rollback_fifty_five_entries", "rollback_fifty_six_entries");
  tail = replaceOptional(tail, "fiftyFiveMutationReady", "fiftySixMutationReady");
  tail = replaceOptional(tail, "fifty-five files", "fifty-six files");
  tail = replaceOptional(tail, "fifty-five-file", "fifty-six-file");
  tail = replaceOptional(tail, "from fifty-four files to fifty-six files", "from fifty-five files to fifty-six files");
  tail = replaceOptional(tail, "from fifty-four files to fifty-five files", "from fifty-five files to fifty-six files");
  tail = replaceOptional(tail, "Requires Phase3777A-3835A sealed evidence.", "Requires Phase3836A-3895A sealed evidence.");
  tail = replaceOptional(tail, "Phase3777A-3835A seal", "Phase3836A-3895A seal");
  tail = replaceOptional(tail, "phase3835_sealed", "phase3895_sealed");
  tail = replaceOptional(tail, "phase3835_not_sealed", "phase3895_not_sealed");
  tail = replaceOptional(tail, "phase3835Sealed", "phase3895Sealed");
  tail = replaceOptional(tail, "phase3835", "phase3895");
  tail = replaceOptional(tail, "result.changedFileCount === 55", "result.changedFileCount === 56");
  tail = replaceOptional(tail, "rollback.files.length === 55", "rollback.files.length === 56");
  tail = replaceOptional(tail, "changedFileCount: result?.changedFileCount ?? 55", "changedFileCount: result?.changedFileCount ?? 56");
  tail = replaceOptional(tail, "expectedOperationCount: 55", "expectedOperationCount: 56");
  tail = replaceOptional(tail, "expectedMaxChangedFiles: 55", "expectedMaxChangedFiles: 56");
  tail = replaceOptional(tail, "maxChangedFiles: 55", "maxChangedFiles: 56");
  tail = replaceOptional(tail, "changedFileCount === 55", "changedFileCount === 56");
  tail = replaceOptional(tail, "exactly fifty-five ", "exactly fifty-six ");
  tail = replaceOptional(tail, "local fifty-five smoke", "local fifty-six smoke");
  tail = replaceOptional(tail, "support fifty-five bounded local smoke commands", "support fifty-six bounded local smoke commands");
  tail = replaceOptional(tail, "JSON smoke helper to fifty-five commands", "JSON smoke helper to fifty-six commands");
  tail = replaceOptional(tail, "Phase3841 through Phase3895", "Phase3901 through Phase3956");
  tail = replaceOptional(tail, "target-fifty-five", "target-fifty-six");
  tail = replaceOptional(tail, "FiftyFiveMutation", "FiftySixMutation");
  tail = replaceOptional(tail, "fiftyFiveMutation", "fiftySixMutation");
  tail = replaceOptional(tail, "Fifty-Five Tool Mutation Evidence", "Fifty-Six Tool Mutation Evidence");
  tail = replaceOptional(tail, "The fifty-five mutation batch must prove", "The fifty-six mutation batch must prove");
  tail = replaceOptional(tail, "fifty-five target markers are not present", "fifty-six target markers are not present");
  tail = replaceOptional(tail, "rollback replay audit batch or a fifty-six-file bounded batch", "rollback replay audit batch or a fifty-seven-file bounded batch");
  return tail;
}

async function main() {
  await mkdir(targetDir, { recursive: true });
  let text = await readFile(sourcePath, "utf8");

  text = text.replace(/const phaseMeta = \{[\s\S]*?\n\};/, phaseMetaBlock());
  text = text.replace(/const previousPhaseMeta = \{[\s\S]*?\n\};/, previousPhaseMetaBlock());
  text = replaceOnce(text, '  "FiftyFive",\n];', '  "FiftyFive",\n  "FiftySix",\n];');
  text = replaceOnce(
    text,
    '  "tools/phase3777_3835/apply-controlled-fifty-four-tool-mutation.mjs",\n];',
    '  "tools/phase3777_3835/apply-controlled-fifty-four-tool-mutation.mjs",\n  "tools/phase3836_3895/apply-controlled-fifty-five-tool-mutation.mjs",\n];',
  );
  text = replaceOnce(
    text,
    "const fiftyFourTargets = buildFiftyFourTargets(fiftyThreeTargets);\nconst targets = buildFiftyFiveTargets(fiftyFourTargets);",
    "const fiftyFourTargets = buildFiftyFourTargets(fiftyThreeTargets);\nconst fiftyFiveTargets = buildFiftyFiveTargets(fiftyFourTargets);\nconst targets = buildFiftySixTargets(fiftyFiveTargets);",
  );
  text = replaceOnce(text, "\nconst phase2091Checks = [", `\n${buildFiftySixTargetsFunction(text)}\n\nconst phase2091Checks = [`);
  text = addAnchorMapEntries(text);
  text = replaceOnce(text, "const tempDir = resolve(\"tmp/phase3836-3895-proposals\");", "const tempDir = resolve(\"tmp/phase3896-3956-proposals\");");

  const tailAnchor = "function buildDoc() {";
  const tailIndex = text.indexOf(tailAnchor);
  if (tailIndex < 0) throw new Error(`missing_tail_anchor:${tailAnchor}`);
  const head = text.slice(0, tailIndex);
  const tail = updateTail(text.slice(tailIndex));
  text = head + tail;
  text = text.replace(/const phaseMeta = \{[\s\S]*?\n\};/, phaseMetaBlock());
  text = text.replace(/const previousPhaseMeta = \{[\s\S]*?\n\};/, previousPhaseMetaBlock());

  await writeFile(targetPath, text, "utf8");
  console.log(JSON.stringify({ status: "pass", targetPath }, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
