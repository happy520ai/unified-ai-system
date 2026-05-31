import { mkdir, readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase3662_3718/generate-fifty-two-phase-assets.mjs";
const targetDir = "tools/phase3719_3776";
const targetPath = `${targetDir}/generate-fifty-three-phase-assets.mjs`;

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
  phaseId: "Phase3719A-3776A-Controlled-Fifty-Three-Tool-Mutation",
  docPath: "docs/phase3719-3776-controlled-fifty-three-tool-mutation.md",
  approvalPath: "docs/phase3719-3776-controlled-fifty-three-tool-mutation-approval.example.json",
  runnerPath: "tools/phase3719_3776/apply-controlled-fifty-three-tool-mutation.mjs",
  smokeRunnerPath: "tools/phase3719_3776/smoke-controlled-fifty-three-tool-mutation.mjs",
  verifierPath: "tools/phase3719_3776/validate-controlled-fifty-three-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase3719-3776-controlled-fifty-three-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase3719-3776-controlled-fifty-three-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase3719-3776-controlled-fifty-three-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase3719-3776-controlled-fifty-three-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase3719-3776-controlled-fifty-three-tool-mutation/fifty-three-smoke.json",
  permissionMode: "controlled-fifty-three-tool-source-mutation",
  label: "fifty-three",
  runnerReadyField: "fiftyThreeRunnerReady",
  appliedField: "fiftyThreeMutationApplied",
  smokeField: "localFiftyThreeSmokePassed",
  rollbackAction: "restore-previous-content-fifty-three",
  verifyScript: "verify:phase3719-3776-controlled-fifty-three-tool-mutation",
  applyScript: "apply:phase3719-3776-controlled-fifty-three-tool-mutation",
  smokeScript: "smoke:phase3719-3776-controlled-fifty-three-tool-mutation",
};`;
}

function previousPhaseMetaBlock() {
  return `const previousPhaseMeta = {
  phaseId: "Phase3662A-3718A-Controlled-Fifty-Two-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase3662-3718-controlled-fifty-two-tool-mutation/result.json",
  sealCheckId: "phase3718_sealed",
  sealCheckField: "fiftyTwoMutationApplied",
  sealCheckBlocker: "phase3718_not_sealed",
};`;
}

function buildFiftyThreeTargetsFunction(source) {
  const start = source.indexOf("function buildFiftyTwoTargets(previousTargets) {");
  const end = source.indexOf("\nconst phase2091Checks = [", start);
  if (start < 0 || end < 0) throw new Error("missing_fifty_two_targets_function");
  let fn = source.slice(start, end).trim();
  fn = replaceAll(fn, "buildFiftyTwoTargets", "buildFiftyThreeTargets");
  fn = replaceAll(fn, "FiftyTwoMutation", "FiftyThreeMutation");
  fn = replaceAll(fn, "Controlled-Fifty-Two-Tool", "Controlled-Fifty-Three-Tool");
  fn = replaceAll(fn, "FIFTY_TWO_TOOL", "FIFTY_THREE_TOOL");
  fn = replaceAll(fn, "fifty-two-tool", "fifty-three-tool");
  fn = replaceOnce(fn, "const phase = 3666 + idx;", "const phase = 3723 + idx;");
  fn = replaceOnce(fn, "const previousRuntimeTarget = previousTargets[50];", "const previousRuntimeTarget = previousTargets[51];");
  fn = replaceOnce(fn, "const fiftyTwoPhase = 3718;", "const fiftyThreePhase = 3776;");
  fn = replaceAll(fn, "fiftyTwoPhase", "fiftyThreePhase");
  fn = replaceOnce(
    fn,
    'const fiftyTwoMarker = "PHASE3718_FIFTY_THREE_TOOL_TARGET_FIFTY_TWO_OK";',
    'const fiftyThreeMarker = "PHASE3776_FIFTY_THREE_TOOL_TARGET_FIFTY_THREE_OK";',
  );
  fn = replaceAll(fn, "fiftyTwoMarker", "fiftyThreeMarker");
  fn = replaceOnce(fn, "idx: 52,", "idx: 53,");
  fn = replaceOnce(fn, 'word: "fifty-two",', 'word: "fifty-three",');
  fn = replaceOnce(fn, 'targetName: "target-fifty-two",', 'targetName: "target-fifty-three",');
  fn = replaceOnce(fn, "path: sourceTargetPaths[51],", "path: sourceTargetPaths[52],");
  fn = replaceOnce(
    fn,
    'proposal: "docs/phase3718-fifty-three-tool-mutation-target-fifty-two.proposal.diff",',
    'proposal: "docs/phase3776-fifty-three-tool-mutation-target-fifty-three.proposal.diff",',
  );
  fn = replaceOnce(
    fn,
    'newExport: "buildPhase3718FiftyThreeMutationRuntimeStatus",',
    'newExport: "buildPhase3776FiftyThreeMutationRuntimeStatus",',
  );
  fn = replaceOnce(
    fn,
    'newPhaseId: "Phase3718A-Controlled-Fifty-Three-Tool-Mutation-Target-Fifty-Two",',
    'newPhaseId: "Phase3776A-Controlled-Fifty-Three-Tool-Mutation-Target-Fifty-Three",',
  );
  fn = replaceOnce(
    fn,
    'requiredExports: ["export function buildPhase3718FiftyThreeMutationRuntimeStatus", "export function main"],',
    'requiredExports: ["export function buildPhase3776FiftyThreeMutationRuntimeStatus", "export function main"],',
  );
  return fn;
}

function addAnchorMapEntries(text) {
  return replaceOnce(
    text,
    `      3668: "export function buildPhase3612FiftyOneMutationTargetTwoStatus() {",
      3669: "export function buildPhase3613FiftyOneMutationTargetThreeStatus() {",
      3670: "export function buildPhase3614FiftyOneMutationTargetFourStatus() {",
      3671: "export function buildPhase3615FiftyOneMutationTargetFiveStatus() {",`,
    `      3668: "export function buildPhase3612FiftyOneMutationTargetTwoStatus() {",
      3669: "export function buildPhase3613FiftyOneMutationTargetThreeStatus() {",
      3670: "export function buildPhase3614FiftyOneMutationTargetFourStatus() {",
      3671: "export function buildPhase3615FiftyOneMutationTargetFiveStatus() {",
      3725: "export function buildPhase3668FiftyTwoMutationTargetTwoStatus() {",
      3726: "export function buildPhase3669FiftyTwoMutationTargetThreeStatus() {",
      3727: "export function buildPhase3670FiftyTwoMutationTargetFourStatus() {",
      3728: "export function buildPhase3671FiftyTwoMutationTargetFiveStatus() {",`,
  );
}

function updateTail(tail) {
  tail = replaceOptional(tail, "Phase3662A-3718A-Controlled-Fifty-Two-Tool-Mutation", "Phase3719A-3776A-Controlled-Fifty-Three-Tool-Mutation");
  tail = replaceOptional(tail, "Phase3662A-3718A", "Phase3719A-3776A");
  tail = replaceOptional(tail, "phase3662-3718", "phase3719-3776");
  tail = replaceOptional(tail, "tools/phase3662_3718/smoke-controlled-fifty-two-tool-mutation.mjs", "tools/phase3719_3776/smoke-controlled-fifty-three-tool-mutation.mjs");
  tail = replaceOptional(tail, "controlled-fifty-two-tool-mutation", "controlled-fifty-three-tool-mutation");
  tail = replaceOptional(tail, "Controlled Fifty-Two Tool Mutation", "Controlled Fifty-Three Tool Mutation");
  tail = replaceOptional(tail, "controlled fifty-two tool mutation", "controlled fifty-three tool mutation");
  tail = replaceOptional(tail, "fifty-two tool mutation", "fifty-three tool mutation");
  tail = replaceOptional(tail, "Fifty-Two Tool", "Fifty-Three Tool");
  tail = replaceOptional(tail, "fifty-two-smoke.json", "fifty-three-smoke.json");
  tail = replaceOptional(tail, "restore-previous-content-fifty-two", "restore-previous-content-fifty-three");
  tail = replaceOptional(tail, "controlled-fifty-two-tool-source-mutation", "controlled-fifty-three-tool-source-mutation");
  tail = replaceOptional(tail, "fifty_two_mutation_node_check_or_smoke_failed", "fifty_three_mutation_node_check_or_smoke_failed");
  tail = replaceOptional(tail, "fiftyTwoRunnerReady", "fiftyThreeRunnerReady");
  tail = replaceOptional(tail, "fiftyTwoMutationApplied", "fiftyThreeMutationApplied");
  tail = replaceOptional(tail, "localFiftyTwoSmokePassed", "localFiftyThreeSmokePassed");
  tail = replaceOptional(tail, "docs_mentions_fifty_two", "docs_mentions_fifty_three");
  tail = replaceOptional(tail, "changed_file_count_fifty_two", "changed_file_count_fifty_three");
  tail = replaceOptional(tail, "fifty_two_mutation_applied", "fifty_three_mutation_applied");
  tail = replaceOptional(tail, "rollback_restore_fifty_two", "rollback_restore_fifty_three");
  tail = replaceOptional(tail, "rollback_fifty_two_entries", "rollback_fifty_three_entries");
  tail = replaceOptional(tail, "fiftyTwoMutationReady", "fiftyThreeMutationReady");
  tail = replaceOptional(tail, "fifty-two files", "fifty-three files");
  tail = replaceOptional(tail, "fifty-two-file", "fifty-three-file");
  tail = replaceOptional(tail, "from fifty-one files to fifty-three files", "from fifty-two files to fifty-three files");
  tail = replaceOptional(tail, "from fifty-one files to fifty-two files", "from fifty-two files to fifty-three files");
  tail = replaceOptional(tail, "Requires Phase3606A-3661A sealed evidence.", "Requires Phase3662A-3718A sealed evidence.");
  tail = replaceOptional(tail, "Phase3606A-3661A seal", "Phase3662A-3718A seal");
  tail = replaceOptional(tail, "phase3661_sealed", "phase3718_sealed");
  tail = replaceOptional(tail, "phase3661_not_sealed", "phase3718_not_sealed");
  tail = replaceOptional(tail, "phase3661Sealed", "phase3718Sealed");
  tail = replaceOptional(tail, "phase3661", "phase3718");
  tail = replaceOptional(tail, "result.changedFileCount === 52", "result.changedFileCount === 53");
  tail = replaceOptional(tail, "rollback.files.length === 52", "rollback.files.length === 53");
  tail = replaceOptional(tail, "changedFileCount: result?.changedFileCount ?? 52", "changedFileCount: result?.changedFileCount ?? 53");
  tail = replaceOptional(tail, "expectedOperationCount: 52", "expectedOperationCount: 53");
  tail = replaceOptional(tail, "expectedMaxChangedFiles: 52", "expectedMaxChangedFiles: 53");
  tail = replaceOptional(tail, "maxChangedFiles: 52", "maxChangedFiles: 53");
  tail = replaceOptional(tail, "changedFileCount === 52", "changedFileCount === 53");
  tail = replaceOptional(tail, "exactly fifty-two ", "exactly fifty-three ");
  tail = replaceOptional(tail, "local fifty-two smoke", "local fifty-three smoke");
  tail = replaceOptional(tail, "support fifty-two bounded local smoke commands", "support fifty-three bounded local smoke commands");
  tail = replaceOptional(tail, "JSON smoke helper to fifty-two commands", "JSON smoke helper to fifty-three commands");
  tail = replaceOptional(tail, "Phase3667 through Phase3718", "Phase3724 through Phase3776");
  tail = replaceOptional(tail, "target-fifty-two", "target-fifty-three");
  tail = replaceOptional(tail, "FiftyTwoMutation", "FiftyThreeMutation");
  tail = replaceOptional(tail, "fiftyTwoMutation", "fiftyThreeMutation");
  tail = replaceOptional(tail, "Fifty-Two Tool Mutation Evidence", "Fifty-Three Tool Mutation Evidence");
  tail = replaceOptional(tail, "The fifty-two mutation batch must prove", "The fifty-three mutation batch must prove");
  tail = replaceOptional(tail, "fifty-two target markers are not present", "fifty-three target markers are not present");
  tail = replaceOptional(tail, "rollback replay audit batch or a fifty-three-file bounded batch", "rollback replay audit batch or a fifty-four-file bounded batch");
  return tail;
}

async function main() {
  await mkdir(targetDir, { recursive: true });
  let text = await readFile(sourcePath, "utf8");

  text = text.replace(/const phaseMeta = \{[\s\S]*?\n\};/, phaseMetaBlock());
  text = text.replace(/const previousPhaseMeta = \{[\s\S]*?\n\};/, previousPhaseMetaBlock());
  text = replaceOnce(text, '  "FiftyTwo",\n];', '  "FiftyTwo",\n  "FiftyThree",\n];');
  text = replaceOnce(
    text,
    '  "tools/phase3606_3661/apply-controlled-fifty-one-tool-mutation.mjs",\n];',
    '  "tools/phase3606_3661/apply-controlled-fifty-one-tool-mutation.mjs",\n  "tools/phase3662_3718/apply-controlled-fifty-two-tool-mutation.mjs",\n];',
  );
  text = replaceOnce(
    text,
    "const fiftyOneTargets = buildFiftyOneTargets(fiftyTargets);\nconst targets = buildFiftyTwoTargets(fiftyOneTargets);",
    "const fiftyOneTargets = buildFiftyOneTargets(fiftyTargets);\nconst fiftyTwoTargets = buildFiftyTwoTargets(fiftyOneTargets);\nconst targets = buildFiftyThreeTargets(fiftyTwoTargets);",
  );
  text = replaceOnce(text, "\nconst phase2091Checks = [", `\n${buildFiftyThreeTargetsFunction(text)}\n\nconst phase2091Checks = [`);
  text = addAnchorMapEntries(text);
  text = replaceOnce(text, "const tempDir = resolve(\"tmp/phase3662-3718-proposals\");", "const tempDir = resolve(\"tmp/phase3719-3776-proposals\");");

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
