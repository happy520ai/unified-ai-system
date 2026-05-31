import { mkdir, readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase3777_3835/generate-fifty-four-phase-assets.mjs";
const targetDir = "tools/phase3836_3895";
const targetPath = `${targetDir}/generate-fifty-five-phase-assets.mjs`;

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
  phaseId: "Phase3836A-3895A-Controlled-Fifty-Five-Tool-Mutation",
  docPath: "docs/phase3836-3895-controlled-fifty-five-tool-mutation.md",
  approvalPath: "docs/phase3836-3895-controlled-fifty-five-tool-mutation-approval.example.json",
  runnerPath: "tools/phase3836_3895/apply-controlled-fifty-five-tool-mutation.mjs",
  smokeRunnerPath: "tools/phase3836_3895/smoke-controlled-fifty-five-tool-mutation.mjs",
  verifierPath: "tools/phase3836_3895/validate-controlled-fifty-five-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase3836-3895-controlled-fifty-five-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase3836-3895-controlled-fifty-five-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase3836-3895-controlled-fifty-five-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase3836-3895-controlled-fifty-five-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase3836-3895-controlled-fifty-five-tool-mutation/fifty-five-smoke.json",
  permissionMode: "controlled-fifty-five-tool-source-mutation",
  label: "fifty-five",
  runnerReadyField: "fiftyFiveRunnerReady",
  appliedField: "fiftyFiveMutationApplied",
  smokeField: "localFiftyFiveSmokePassed",
  rollbackAction: "restore-previous-content-fifty-five",
  verifyScript: "verify:phase3836-3895-controlled-fifty-five-tool-mutation",
  applyScript: "apply:phase3836-3895-controlled-fifty-five-tool-mutation",
  smokeScript: "smoke:phase3836-3895-controlled-fifty-five-tool-mutation",
};`;
}

function previousPhaseMetaBlock() {
  return `const previousPhaseMeta = {
  phaseId: "Phase3777A-3835A-Controlled-Fifty-Four-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase3777-3835-controlled-fifty-four-tool-mutation/result.json",
  sealCheckId: "phase3835_sealed",
  sealCheckField: "fiftyFourMutationApplied",
  sealCheckBlocker: "phase3835_not_sealed",
};`;
}

function buildFiftyFiveTargetsFunction(source) {
  const start = source.indexOf("function buildFiftyFourTargets(previousTargets) {");
  const end = source.indexOf("\nconst phase2091Checks = [", start);
  if (start < 0 || end < 0) throw new Error("missing_fifty_four_targets_function");
  let fn = source.slice(start, end).trim();
  fn = replaceAll(fn, "buildFiftyFourTargets", "buildFiftyFiveTargets");
  fn = replaceAll(fn, "FiftyFourMutation", "FiftyFiveMutation");
  fn = replaceAll(fn, "Controlled-Fifty-Four-Tool", "Controlled-Fifty-Five-Tool");
  fn = replaceAll(fn, "FIFTY_FOUR_TOOL", "FIFTY_FIVE_TOOL");
  fn = replaceAll(fn, "fifty-four-tool", "fifty-five-tool");
  fn = replaceOnce(fn, "const phase = 3781 + idx;", "const phase = 3840 + idx;");
  fn = replaceOnce(fn, "const previousRuntimeTarget = previousTargets[52];", "const previousRuntimeTarget = previousTargets[53];");
  fn = replaceOnce(fn, "const fiftyFourPhase = 3835;", "const fiftyFivePhase = 3895;");
  fn = replaceAll(fn, "fiftyFourPhase", "fiftyFivePhase");
  fn = replaceOnce(
    fn,
    'const fiftyFourMarker = "PHASE3835_FIFTY_FIVE_TOOL_TARGET_FIFTY_FOUR_OK";',
    'const fiftyFiveMarker = "PHASE3895_FIFTY_FIVE_TOOL_TARGET_FIFTY_FIVE_OK";',
  );
  fn = replaceAll(fn, "fiftyFourMarker", "fiftyFiveMarker");
  fn = replaceOnce(fn, "idx: 54,", "idx: 55,");
  fn = replaceOnce(fn, 'word: "fifty-four",', 'word: "fifty-five",');
  fn = replaceOnce(fn, 'targetName: "target-fifty-four",', 'targetName: "target-fifty-five",');
  fn = replaceOnce(fn, "path: sourceTargetPaths[53],", "path: sourceTargetPaths[54],");
  fn = replaceOnce(
    fn,
    'proposal: "docs/phase3835-fifty-five-tool-mutation-target-fifty-four.proposal.diff",',
    'proposal: "docs/phase3895-fifty-five-tool-mutation-target-fifty-five.proposal.diff",',
  );
  fn = replaceOnce(
    fn,
    'newExport: "buildPhase3835FiftyFiveMutationRuntimeStatus",',
    'newExport: "buildPhase3895FiftyFiveMutationRuntimeStatus",',
  );
  fn = replaceOnce(
    fn,
    'newPhaseId: "Phase3835A-Controlled-Fifty-Five-Tool-Mutation-Target-Fifty-Four",',
    'newPhaseId: "Phase3895A-Controlled-Fifty-Five-Tool-Mutation-Target-Fifty-Five",',
  );
  fn = replaceOnce(
    fn,
    'requiredExports: ["export function buildPhase3835FiftyFiveMutationRuntimeStatus", "export function main"],',
    'requiredExports: ["export function buildPhase3895FiftyFiveMutationRuntimeStatus", "export function main"],',
  );
  return fn;
}

function addAnchorMapEntries(text) {
  return replaceOnce(
    text,
    `      3783: "export function buildPhase3725FiftyThreeMutationTargetTwoStatus() {",
      3784: "export function buildPhase3726FiftyThreeMutationTargetThreeStatus() {",
      3785: "export function buildPhase3727FiftyThreeMutationTargetFourStatus() {",
      3786: "export function buildPhase3728FiftyThreeMutationTargetFiveStatus() {",`,
    `      3783: "export function buildPhase3725FiftyThreeMutationTargetTwoStatus() {",
      3784: "export function buildPhase3726FiftyThreeMutationTargetThreeStatus() {",
      3785: "export function buildPhase3727FiftyThreeMutationTargetFourStatus() {",
      3786: "export function buildPhase3728FiftyThreeMutationTargetFiveStatus() {",
      3842: "export function buildPhase3783FiftyFourMutationTargetTwoStatus() {",
      3843: "export function buildPhase3784FiftyFourMutationTargetThreeStatus() {",
      3844: "export function buildPhase3785FiftyFourMutationTargetFourStatus() {",
      3845: "export function buildPhase3786FiftyFourMutationTargetFiveStatus() {",`,
  );
}

function updateTail(tail) {
  tail = replaceOptional(tail, "Phase3777A-3835A-Controlled-Fifty-Four-Tool-Mutation", "Phase3836A-3895A-Controlled-Fifty-Five-Tool-Mutation");
  tail = replaceOptional(tail, "Phase3777A-3835A", "Phase3836A-3895A");
  tail = replaceOptional(tail, "phase3777-3835", "phase3836-3895");
  tail = replaceOptional(tail, "tools/phase3777_3835/smoke-controlled-fifty-four-tool-mutation.mjs", "tools/phase3836_3895/smoke-controlled-fifty-five-tool-mutation.mjs");
  tail = replaceOptional(tail, "controlled-fifty-four-tool-mutation", "controlled-fifty-five-tool-mutation");
  tail = replaceOptional(tail, "Controlled Fifty-Four Tool Mutation", "Controlled Fifty-Five Tool Mutation");
  tail = replaceOptional(tail, "controlled fifty-four tool mutation", "controlled fifty-five tool mutation");
  tail = replaceOptional(tail, "fifty-four tool mutation", "fifty-five tool mutation");
  tail = replaceOptional(tail, "Fifty-Four Tool", "Fifty-Five Tool");
  tail = replaceOptional(tail, "fifty-four-smoke.json", "fifty-five-smoke.json");
  tail = replaceOptional(tail, "restore-previous-content-fifty-four", "restore-previous-content-fifty-five");
  tail = replaceOptional(tail, "controlled-fifty-four-tool-source-mutation", "controlled-fifty-five-tool-source-mutation");
  tail = replaceOptional(tail, "fifty_four_mutation_node_check_or_smoke_failed", "fifty_five_mutation_node_check_or_smoke_failed");
  tail = replaceOptional(tail, "fiftyFourRunnerReady", "fiftyFiveRunnerReady");
  tail = replaceOptional(tail, "fiftyFourMutationApplied", "fiftyFiveMutationApplied");
  tail = replaceOptional(tail, "localFiftyFourSmokePassed", "localFiftyFiveSmokePassed");
  tail = replaceOptional(tail, "docs_mentions_fifty_four", "docs_mentions_fifty_five");
  tail = replaceOptional(tail, "changed_file_count_fifty_four", "changed_file_count_fifty_five");
  tail = replaceOptional(tail, "fifty_four_mutation_applied", "fifty_five_mutation_applied");
  tail = replaceOptional(tail, "rollback_restore_fifty_four", "rollback_restore_fifty_five");
  tail = replaceOptional(tail, "rollback_fifty_four_entries", "rollback_fifty_five_entries");
  tail = replaceOptional(tail, "fiftyFourMutationReady", "fiftyFiveMutationReady");
  tail = replaceOptional(tail, "fifty-four files", "fifty-five files");
  tail = replaceOptional(tail, "fifty-four-file", "fifty-five-file");
  tail = replaceOptional(tail, "from fifty-three files to fifty-five files", "from fifty-four files to fifty-five files");
  tail = replaceOptional(tail, "from fifty-three files to fifty-four files", "from fifty-four files to fifty-five files");
  tail = replaceOptional(tail, "Requires Phase3719A-3776A sealed evidence.", "Requires Phase3777A-3835A sealed evidence.");
  tail = replaceOptional(tail, "Phase3719A-3776A seal", "Phase3777A-3835A seal");
  tail = replaceOptional(tail, "phase3776_sealed", "phase3835_sealed");
  tail = replaceOptional(tail, "phase3776_not_sealed", "phase3835_not_sealed");
  tail = replaceOptional(tail, "phase3776Sealed", "phase3835Sealed");
  tail = replaceOptional(tail, "phase3776", "phase3835");
  tail = replaceOptional(tail, "result.changedFileCount === 54", "result.changedFileCount === 55");
  tail = replaceOptional(tail, "rollback.files.length === 54", "rollback.files.length === 55");
  tail = replaceOptional(tail, "changedFileCount: result?.changedFileCount ?? 54", "changedFileCount: result?.changedFileCount ?? 55");
  tail = replaceOptional(tail, "expectedOperationCount: 54", "expectedOperationCount: 55");
  tail = replaceOptional(tail, "expectedMaxChangedFiles: 54", "expectedMaxChangedFiles: 55");
  tail = replaceOptional(tail, "maxChangedFiles: 54", "maxChangedFiles: 55");
  tail = replaceOptional(tail, "changedFileCount === 54", "changedFileCount === 55");
  tail = replaceOptional(tail, "exactly fifty-four ", "exactly fifty-five ");
  tail = replaceOptional(tail, "local fifty-four smoke", "local fifty-five smoke");
  tail = replaceOptional(tail, "support fifty-four bounded local smoke commands", "support fifty-five bounded local smoke commands");
  tail = replaceOptional(tail, "JSON smoke helper to fifty-four commands", "JSON smoke helper to fifty-five commands");
  tail = replaceOptional(tail, "Phase3782 through Phase3835", "Phase3841 through Phase3895");
  tail = replaceOptional(tail, "target-fifty-four", "target-fifty-five");
  tail = replaceOptional(tail, "FiftyFourMutation", "FiftyFiveMutation");
  tail = replaceOptional(tail, "fiftyFourMutation", "fiftyFiveMutation");
  tail = replaceOptional(tail, "Fifty-Four Tool Mutation Evidence", "Fifty-Five Tool Mutation Evidence");
  tail = replaceOptional(tail, "The fifty-four mutation batch must prove", "The fifty-five mutation batch must prove");
  tail = replaceOptional(tail, "fifty-four target markers are not present", "fifty-five target markers are not present");
  tail = replaceOptional(tail, "rollback replay audit batch or a fifty-five-file bounded batch", "rollback replay audit batch or a fifty-six-file bounded batch");
  return tail;
}

async function main() {
  await mkdir(targetDir, { recursive: true });
  let text = await readFile(sourcePath, "utf8");

  text = text.replace(/const phaseMeta = \{[\s\S]*?\n\};/, phaseMetaBlock());
  text = text.replace(/const previousPhaseMeta = \{[\s\S]*?\n\};/, previousPhaseMetaBlock());
  text = replaceOnce(text, '  "FiftyFour",\n];', '  "FiftyFour",\n  "FiftyFive",\n];');
  text = replaceOnce(
    text,
    '  "tools/phase3719_3776/apply-controlled-fifty-three-tool-mutation.mjs",\n];',
    '  "tools/phase3719_3776/apply-controlled-fifty-three-tool-mutation.mjs",\n  "tools/phase3777_3835/apply-controlled-fifty-four-tool-mutation.mjs",\n];',
  );
  text = replaceOnce(
    text,
    "const fiftyThreeTargets = buildFiftyThreeTargets(fiftyTwoTargets);\nconst targets = buildFiftyFourTargets(fiftyThreeTargets);",
    "const fiftyThreeTargets = buildFiftyThreeTargets(fiftyTwoTargets);\nconst fiftyFourTargets = buildFiftyFourTargets(fiftyThreeTargets);\nconst targets = buildFiftyFiveTargets(fiftyFourTargets);",
  );
  text = replaceOnce(text, "\nconst phase2091Checks = [", `\n${buildFiftyFiveTargetsFunction(text)}\n\nconst phase2091Checks = [`);
  text = addAnchorMapEntries(text);
  text = replaceOnce(text, "const tempDir = resolve(\"tmp/phase3777-3835-proposals\");", "const tempDir = resolve(\"tmp/phase3836-3895-proposals\");");

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
