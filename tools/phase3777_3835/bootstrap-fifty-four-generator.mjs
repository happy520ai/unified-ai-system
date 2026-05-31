import { mkdir, readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase3719_3776/generate-fifty-three-phase-assets.mjs";
const targetDir = "tools/phase3777_3835";
const targetPath = `${targetDir}/generate-fifty-four-phase-assets.mjs`;

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
  phaseId: "Phase3777A-3835A-Controlled-Fifty-Four-Tool-Mutation",
  docPath: "docs/phase3777-3835-controlled-fifty-four-tool-mutation.md",
  approvalPath: "docs/phase3777-3835-controlled-fifty-four-tool-mutation-approval.example.json",
  runnerPath: "tools/phase3777_3835/apply-controlled-fifty-four-tool-mutation.mjs",
  smokeRunnerPath: "tools/phase3777_3835/smoke-controlled-fifty-four-tool-mutation.mjs",
  verifierPath: "tools/phase3777_3835/validate-controlled-fifty-four-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase3777-3835-controlled-fifty-four-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase3777-3835-controlled-fifty-four-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase3777-3835-controlled-fifty-four-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase3777-3835-controlled-fifty-four-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase3777-3835-controlled-fifty-four-tool-mutation/fifty-four-smoke.json",
  permissionMode: "controlled-fifty-four-tool-source-mutation",
  label: "fifty-four",
  runnerReadyField: "fiftyFourRunnerReady",
  appliedField: "fiftyFourMutationApplied",
  smokeField: "localFiftyFourSmokePassed",
  rollbackAction: "restore-previous-content-fifty-four",
  verifyScript: "verify:phase3777-3835-controlled-fifty-four-tool-mutation",
  applyScript: "apply:phase3777-3835-controlled-fifty-four-tool-mutation",
  smokeScript: "smoke:phase3777-3835-controlled-fifty-four-tool-mutation",
};`;
}

function previousPhaseMetaBlock() {
  return `const previousPhaseMeta = {
  phaseId: "Phase3719A-3776A-Controlled-Fifty-Three-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase3719-3776-controlled-fifty-three-tool-mutation/result.json",
  sealCheckId: "phase3776_sealed",
  sealCheckField: "fiftyThreeMutationApplied",
  sealCheckBlocker: "phase3776_not_sealed",
};`;
}

function buildFiftyFourTargetsFunction(source) {
  const start = source.indexOf("function buildFiftyThreeTargets(previousTargets) {");
  const end = source.indexOf("\nconst phase2091Checks = [", start);
  if (start < 0 || end < 0) throw new Error("missing_fifty_three_targets_function");
  let fn = source.slice(start, end).trim();
  fn = replaceAll(fn, "buildFiftyThreeTargets", "buildFiftyFourTargets");
  fn = replaceAll(fn, "FiftyThreeMutation", "FiftyFourMutation");
  fn = replaceAll(fn, "Controlled-Fifty-Three-Tool", "Controlled-Fifty-Four-Tool");
  fn = replaceAll(fn, "FIFTY_THREE_TOOL", "FIFTY_FOUR_TOOL");
  fn = replaceAll(fn, "fifty-three-tool", "fifty-four-tool");
  fn = replaceOnce(fn, "const phase = 3723 + idx;", "const phase = 3781 + idx;");
  fn = replaceOnce(fn, "const previousRuntimeTarget = previousTargets[51];", "const previousRuntimeTarget = previousTargets[52];");
  fn = replaceOnce(fn, "const fiftyThreePhase = 3776;", "const fiftyFourPhase = 3835;");
  fn = replaceAll(fn, "fiftyThreePhase", "fiftyFourPhase");
  fn = replaceOnce(
    fn,
    'const fiftyThreeMarker = "PHASE3776_FIFTY_FOUR_TOOL_TARGET_FIFTY_THREE_OK";',
    'const fiftyFourMarker = "PHASE3835_FIFTY_FOUR_TOOL_TARGET_FIFTY_FOUR_OK";',
  );
  fn = replaceAll(fn, "fiftyThreeMarker", "fiftyFourMarker");
  fn = replaceOnce(fn, "idx: 53,", "idx: 54,");
  fn = replaceOnce(fn, 'word: "fifty-three",', 'word: "fifty-four",');
  fn = replaceOnce(fn, 'targetName: "target-fifty-three",', 'targetName: "target-fifty-four",');
  fn = replaceOnce(fn, "path: sourceTargetPaths[52],", "path: sourceTargetPaths[53],");
  fn = replaceOnce(
    fn,
    'proposal: "docs/phase3776-fifty-four-tool-mutation-target-fifty-three.proposal.diff",',
    'proposal: "docs/phase3835-fifty-four-tool-mutation-target-fifty-four.proposal.diff",',
  );
  fn = replaceOnce(
    fn,
    'newExport: "buildPhase3776FiftyFourMutationRuntimeStatus",',
    'newExport: "buildPhase3835FiftyFourMutationRuntimeStatus",',
  );
  fn = replaceOnce(
    fn,
    'newPhaseId: "Phase3776A-Controlled-Fifty-Four-Tool-Mutation-Target-Fifty-Three",',
    'newPhaseId: "Phase3835A-Controlled-Fifty-Four-Tool-Mutation-Target-Fifty-Four",',
  );
  fn = replaceOnce(
    fn,
    'requiredExports: ["export function buildPhase3776FiftyFourMutationRuntimeStatus", "export function main"],',
    'requiredExports: ["export function buildPhase3835FiftyFourMutationRuntimeStatus", "export function main"],',
  );
  return fn;
}

function addAnchorMapEntries(text) {
  return replaceOnce(
    text,
    `      3725: "export function buildPhase3668FiftyTwoMutationTargetTwoStatus() {",
      3726: "export function buildPhase3669FiftyTwoMutationTargetThreeStatus() {",
      3727: "export function buildPhase3670FiftyTwoMutationTargetFourStatus() {",
      3728: "export function buildPhase3671FiftyTwoMutationTargetFiveStatus() {",`,
    `      3725: "export function buildPhase3668FiftyTwoMutationTargetTwoStatus() {",
      3726: "export function buildPhase3669FiftyTwoMutationTargetThreeStatus() {",
      3727: "export function buildPhase3670FiftyTwoMutationTargetFourStatus() {",
      3728: "export function buildPhase3671FiftyTwoMutationTargetFiveStatus() {",
      3783: "export function buildPhase3725FiftyThreeMutationTargetTwoStatus() {",
      3784: "export function buildPhase3726FiftyThreeMutationTargetThreeStatus() {",
      3785: "export function buildPhase3727FiftyThreeMutationTargetFourStatus() {",
      3786: "export function buildPhase3728FiftyThreeMutationTargetFiveStatus() {",`,
  );
}

function updateTail(tail) {
  tail = replaceOptional(tail, "Phase3719A-3776A-Controlled-Fifty-Three-Tool-Mutation", "Phase3777A-3835A-Controlled-Fifty-Four-Tool-Mutation");
  tail = replaceOptional(tail, "Phase3719A-3776A", "Phase3777A-3835A");
  tail = replaceOptional(tail, "phase3719-3776", "phase3777-3835");
  tail = replaceOptional(tail, "tools/phase3719_3776/smoke-controlled-fifty-three-tool-mutation.mjs", "tools/phase3777_3835/smoke-controlled-fifty-four-tool-mutation.mjs");
  tail = replaceOptional(tail, "controlled-fifty-three-tool-mutation", "controlled-fifty-four-tool-mutation");
  tail = replaceOptional(tail, "Controlled Fifty-Three Tool Mutation", "Controlled Fifty-Four Tool Mutation");
  tail = replaceOptional(tail, "controlled fifty-three tool mutation", "controlled fifty-four tool mutation");
  tail = replaceOptional(tail, "fifty-three tool mutation", "fifty-four tool mutation");
  tail = replaceOptional(tail, "Fifty-Three Tool", "Fifty-Four Tool");
  tail = replaceOptional(tail, "fifty-three-smoke.json", "fifty-four-smoke.json");
  tail = replaceOptional(tail, "restore-previous-content-fifty-three", "restore-previous-content-fifty-four");
  tail = replaceOptional(tail, "controlled-fifty-three-tool-source-mutation", "controlled-fifty-four-tool-source-mutation");
  tail = replaceOptional(tail, "fifty_three_mutation_node_check_or_smoke_failed", "fifty_four_mutation_node_check_or_smoke_failed");
  tail = replaceOptional(tail, "fiftyThreeRunnerReady", "fiftyFourRunnerReady");
  tail = replaceOptional(tail, "fiftyThreeMutationApplied", "fiftyFourMutationApplied");
  tail = replaceOptional(tail, "localFiftyThreeSmokePassed", "localFiftyFourSmokePassed");
  tail = replaceOptional(tail, "docs_mentions_fifty_three", "docs_mentions_fifty_four");
  tail = replaceOptional(tail, "changed_file_count_fifty_three", "changed_file_count_fifty_four");
  tail = replaceOptional(tail, "fifty_three_mutation_applied", "fifty_four_mutation_applied");
  tail = replaceOptional(tail, "rollback_restore_fifty_three", "rollback_restore_fifty_four");
  tail = replaceOptional(tail, "rollback_fifty_three_entries", "rollback_fifty_four_entries");
  tail = replaceOptional(tail, "fiftyThreeMutationReady", "fiftyFourMutationReady");
  tail = replaceOptional(tail, "fifty-three files", "fifty-four files");
  tail = replaceOptional(tail, "fifty-three-file", "fifty-four-file");
  tail = replaceOptional(tail, "from fifty-two files to fifty-four files", "from fifty-three files to fifty-four files");
  tail = replaceOptional(tail, "from fifty-two files to fifty-three files", "from fifty-three files to fifty-four files");
  tail = replaceOptional(tail, "Requires Phase3662A-3718A sealed evidence.", "Requires Phase3719A-3776A sealed evidence.");
  tail = replaceOptional(tail, "Phase3662A-3718A seal", "Phase3719A-3776A seal");
  tail = replaceOptional(tail, "phase3718_sealed", "phase3776_sealed");
  tail = replaceOptional(tail, "phase3718_not_sealed", "phase3776_not_sealed");
  tail = replaceOptional(tail, "phase3718Sealed", "phase3776Sealed");
  tail = replaceOptional(tail, "phase3718", "phase3776");
  tail = replaceOptional(tail, "result.changedFileCount === 53", "result.changedFileCount === 54");
  tail = replaceOptional(tail, "rollback.files.length === 53", "rollback.files.length === 54");
  tail = replaceOptional(tail, "changedFileCount: result?.changedFileCount ?? 53", "changedFileCount: result?.changedFileCount ?? 54");
  tail = replaceOptional(tail, "expectedOperationCount: 53", "expectedOperationCount: 54");
  tail = replaceOptional(tail, "expectedMaxChangedFiles: 53", "expectedMaxChangedFiles: 54");
  tail = replaceOptional(tail, "maxChangedFiles: 53", "maxChangedFiles: 54");
  tail = replaceOptional(tail, "changedFileCount === 53", "changedFileCount === 54");
  tail = replaceOptional(tail, "exactly fifty-three ", "exactly fifty-four ");
  tail = replaceOptional(tail, "local fifty-three smoke", "local fifty-four smoke");
  tail = replaceOptional(tail, "support fifty-three bounded local smoke commands", "support fifty-four bounded local smoke commands");
  tail = replaceOptional(tail, "JSON smoke helper to fifty-three commands", "JSON smoke helper to fifty-four commands");
  tail = replaceOptional(tail, "Phase3724 through Phase3776", "Phase3782 through Phase3835");
  tail = replaceOptional(tail, "target-fifty-three", "target-fifty-four");
  tail = replaceOptional(tail, "FiftyThreeMutation", "FiftyFourMutation");
  tail = replaceOptional(tail, "fiftyThreeMutation", "fiftyFourMutation");
  tail = replaceOptional(tail, "Fifty-Three Tool Mutation Evidence", "Fifty-Four Tool Mutation Evidence");
  tail = replaceOptional(tail, "The fifty-three mutation batch must prove", "The fifty-four mutation batch must prove");
  tail = replaceOptional(tail, "fifty-three target markers are not present", "fifty-four target markers are not present");
  tail = replaceOptional(tail, "rollback replay audit batch or a fifty-four-file bounded batch", "rollback replay audit batch or a fifty-five-file bounded batch");
  return tail;
}

async function main() {
  await mkdir(targetDir, { recursive: true });
  let text = await readFile(sourcePath, "utf8");

  text = text.replace(/const phaseMeta = \{[\s\S]*?\n\};/, phaseMetaBlock());
  text = text.replace(/const previousPhaseMeta = \{[\s\S]*?\n\};/, previousPhaseMetaBlock());
  text = replaceOnce(text, '  "FiftyThree",\n];', '  "FiftyThree",\n  "FiftyFour",\n];');
  text = replaceOnce(
    text,
    '  "tools/phase3662_3718/apply-controlled-fifty-two-tool-mutation.mjs",\n];',
    '  "tools/phase3662_3718/apply-controlled-fifty-two-tool-mutation.mjs",\n  "tools/phase3719_3776/apply-controlled-fifty-three-tool-mutation.mjs",\n];',
  );
  text = replaceOnce(
    text,
    "const fiftyTwoTargets = buildFiftyTwoTargets(fiftyOneTargets);\nconst targets = buildFiftyThreeTargets(fiftyTwoTargets);",
    "const fiftyTwoTargets = buildFiftyTwoTargets(fiftyOneTargets);\nconst fiftyThreeTargets = buildFiftyThreeTargets(fiftyTwoTargets);\nconst targets = buildFiftyFourTargets(fiftyThreeTargets);",
  );
  text = replaceOnce(text, "\nconst phase2091Checks = [", `\n${buildFiftyFourTargetsFunction(text)}\n\nconst phase2091Checks = [`);
  text = addAnchorMapEntries(text);
  text = replaceOnce(text, "const tempDir = resolve(\"tmp/phase3719-3776-proposals\");", "const tempDir = resolve(\"tmp/phase3777-3835-proposals\");");

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
