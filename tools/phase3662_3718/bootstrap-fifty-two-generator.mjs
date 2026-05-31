import { mkdir, readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase3606_3661/generate-fifty-one-phase-assets.mjs";
const targetDir = "tools/phase3662_3718";
const targetPath = `${targetDir}/generate-fifty-two-phase-assets.mjs`;

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
  phaseId: "Phase3662A-3718A-Controlled-Fifty-Two-Tool-Mutation",
  docPath: "docs/phase3662-3718-controlled-fifty-two-tool-mutation.md",
  approvalPath: "docs/phase3662-3718-controlled-fifty-two-tool-mutation-approval.example.json",
  runnerPath: "tools/phase3662_3718/apply-controlled-fifty-two-tool-mutation.mjs",
  smokeRunnerPath: "tools/phase3662_3718/smoke-controlled-fifty-two-tool-mutation.mjs",
  verifierPath: "tools/phase3662_3718/validate-controlled-fifty-two-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase3662-3718-controlled-fifty-two-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase3662-3718-controlled-fifty-two-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase3662-3718-controlled-fifty-two-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase3662-3718-controlled-fifty-two-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase3662-3718-controlled-fifty-two-tool-mutation/fifty-two-smoke.json",
  permissionMode: "controlled-fifty-two-tool-source-mutation",
  label: "fifty-two",
  runnerReadyField: "fiftyTwoRunnerReady",
  appliedField: "fiftyTwoMutationApplied",
  smokeField: "localFiftyTwoSmokePassed",
  rollbackAction: "restore-previous-content-fifty-two",
  verifyScript: "verify:phase3662-3718-controlled-fifty-two-tool-mutation",
  applyScript: "apply:phase3662-3718-controlled-fifty-two-tool-mutation",
  smokeScript: "smoke:phase3662-3718-controlled-fifty-two-tool-mutation",
};`;
}

function previousPhaseMetaBlock() {
  return `const previousPhaseMeta = {
  phaseId: "Phase3606A-3661A-Controlled-Fifty-One-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase3606-3661-controlled-fifty-one-tool-mutation/result.json",
  sealCheckId: "phase3661_sealed",
  sealCheckField: "fiftyOneMutationApplied",
  sealCheckBlocker: "phase3661_not_sealed",
};`;
}

function buildFiftyTwoTargetsFunction(source) {
  const start = source.indexOf("function buildFiftyOneTargets(previousTargets) {");
  const end = source.indexOf("\nconst phase2091Checks = [", start);
  if (start < 0 || end < 0) throw new Error("missing_fifty_one_targets_function");
  let fn = source.slice(start, end).trim();
  fn = replaceAll(fn, "buildFiftyOneTargets", "buildFiftyTwoTargets");
  fn = replaceAll(fn, "FiftyOneMutation", "FiftyTwoMutation");
  fn = replaceAll(fn, "Controlled-Fifty-One-Tool", "Controlled-Fifty-Two-Tool");
  fn = replaceAll(fn, "FIFTY_ONE_TOOL", "FIFTY_TWO_TOOL");
  fn = replaceAll(fn, "fifty-one-tool", "fifty-two-tool");
  fn = replaceOnce(fn, "const phase = 3610 + idx;", "const phase = 3666 + idx;");
  fn = replaceOnce(fn, "const previousRuntimeTarget = previousTargets[49];", "const previousRuntimeTarget = previousTargets[50];");
  fn = replaceOnce(fn, "const fiftyOnePhase = 3661;", "const fiftyTwoPhase = 3718;");
  fn = replaceAll(fn, "fiftyOnePhase", "fiftyTwoPhase");
  fn = replaceOnce(
    fn,
    'const fiftyOneMarker = "PHASE3661_FIFTY_TWO_TOOL_TARGET_FIFTY_ONE_OK";',
    'const fiftyTwoMarker = "PHASE3718_FIFTY_TWO_TOOL_TARGET_FIFTY_TWO_OK";',
  );
  fn = replaceAll(fn, "fiftyOneMarker", "fiftyTwoMarker");
  fn = replaceOnce(fn, "idx: 51,", "idx: 52,");
  fn = replaceOnce(fn, 'word: "fifty-one",', 'word: "fifty-two",');
  fn = replaceOnce(fn, 'targetName: "target-fifty-one",', 'targetName: "target-fifty-two",');
  fn = replaceOnce(fn, "path: sourceTargetPaths[50],", "path: sourceTargetPaths[51],");
  fn = replaceOnce(
    fn,
    'proposal: "docs/phase3661-fifty-two-tool-mutation-target-fifty-one.proposal.diff",',
    'proposal: "docs/phase3718-fifty-two-tool-mutation-target-fifty-two.proposal.diff",',
  );
  fn = replaceOnce(
    fn,
    'newExport: "buildPhase3661FiftyTwoMutationRuntimeStatus",',
    'newExport: "buildPhase3718FiftyTwoMutationRuntimeStatus",',
  );
  fn = replaceOnce(
    fn,
    'newPhaseId: "Phase3661A-Controlled-Fifty-Two-Tool-Mutation-Target-Fifty-One",',
    'newPhaseId: "Phase3718A-Controlled-Fifty-Two-Tool-Mutation-Target-Fifty-Two",',
  );
  fn = replaceOnce(
    fn,
    'requiredExports: ["export function buildPhase3661FiftyTwoMutationRuntimeStatus", "export function main"],',
    'requiredExports: ["export function buildPhase3718FiftyTwoMutationRuntimeStatus", "export function main"],',
  );
  return fn;
}

function addAnchorMapEntries(text) {
  return replaceOnce(
    text,
    `      3612: "export function buildPhase3557FiftyMutationTargetTwoStatus() {",
      3613: "export function buildPhase3558FiftyMutationTargetThreeStatus() {",
      3614: "export function buildPhase3559FiftyMutationTargetFourStatus() {",
      3615: "export function buildPhase3560FiftyMutationTargetFiveStatus() {",`,
    `      3612: "export function buildPhase3557FiftyMutationTargetTwoStatus() {",
      3613: "export function buildPhase3558FiftyMutationTargetThreeStatus() {",
      3614: "export function buildPhase3559FiftyMutationTargetFourStatus() {",
      3615: "export function buildPhase3560FiftyMutationTargetFiveStatus() {",
      3668: "export function buildPhase3612FiftyOneMutationTargetTwoStatus() {",
      3669: "export function buildPhase3613FiftyOneMutationTargetThreeStatus() {",
      3670: "export function buildPhase3614FiftyOneMutationTargetFourStatus() {",
      3671: "export function buildPhase3615FiftyOneMutationTargetFiveStatus() {",`,
  );
}

function updateTail(tail) {
  tail = replaceOptional(tail, "Phase3606A-3661A-Controlled-Fifty-One-Tool-Mutation", "Phase3662A-3718A-Controlled-Fifty-Two-Tool-Mutation");
  tail = replaceOptional(tail, "Phase3606A-3661A", "Phase3662A-3718A");
  tail = replaceOptional(tail, "phase3606-3661", "phase3662-3718");
  tail = replaceOptional(tail, "tools/phase3606_3661/smoke-controlled-fifty-one-tool-mutation.mjs", "tools/phase3662_3718/smoke-controlled-fifty-two-tool-mutation.mjs");
  tail = replaceOptional(tail, "controlled-fifty-one-tool-mutation", "controlled-fifty-two-tool-mutation");
  tail = replaceOptional(tail, "Controlled Fifty-One Tool Mutation", "Controlled Fifty-Two Tool Mutation");
  tail = replaceOptional(tail, "controlled fifty-one tool mutation", "controlled fifty-two tool mutation");
  tail = replaceOptional(tail, "fifty-one tool mutation", "fifty-two tool mutation");
  tail = replaceOptional(tail, "Fifty-One Tool", "Fifty-Two Tool");
  tail = replaceOptional(tail, "fifty-one-smoke.json", "fifty-two-smoke.json");
  tail = replaceOptional(tail, "restore-previous-content-fifty-one", "restore-previous-content-fifty-two");
  tail = replaceOptional(tail, "controlled-fifty-one-tool-source-mutation", "controlled-fifty-two-tool-source-mutation");
  tail = replaceOptional(tail, "fifty_one_mutation_node_check_or_smoke_failed", "fifty_two_mutation_node_check_or_smoke_failed");
  tail = replaceOptional(tail, "fiftyOneRunnerReady", "fiftyTwoRunnerReady");
  tail = replaceOptional(tail, "fiftyOneMutationApplied", "fiftyTwoMutationApplied");
  tail = replaceOptional(tail, "localFiftyOneSmokePassed", "localFiftyTwoSmokePassed");
  tail = replaceOptional(tail, "docs_mentions_fifty_one", "docs_mentions_fifty_two");
  tail = replaceOptional(tail, "changed_file_count_fifty_one", "changed_file_count_fifty_two");
  tail = replaceOptional(tail, "fifty_one_mutation_applied", "fifty_two_mutation_applied");
  tail = replaceOptional(tail, "rollback_restore_fifty_one", "rollback_restore_fifty_two");
  tail = replaceOptional(tail, "rollback_fifty_one_entries", "rollback_fifty_two_entries");
  tail = replaceOptional(tail, "fiftyOneMutationReady", "fiftyTwoMutationReady");
  tail = replaceOptional(tail, "fifty-one files", "fifty-two files");
  tail = replaceOptional(tail, "fifty-one-file", "fifty-two-file");
  tail = replaceOptional(tail, "from fifty files to fifty-two files", "from fifty-one files to fifty-two files");
  tail = replaceOptional(tail, "from fifty files to fifty-one files", "from fifty-one files to fifty-two files");
  tail = replaceOptional(tail, "Requires Phase3551A-3605A sealed evidence.", "Requires Phase3606A-3661A sealed evidence.");
  tail = replaceOptional(tail, "Phase3551A-3605A seal", "Phase3606A-3661A seal");
  tail = replaceOptional(tail, "phase3605_sealed", "phase3661_sealed");
  tail = replaceOptional(tail, "phase3605_not_sealed", "phase3661_not_sealed");
  tail = replaceOptional(tail, "phase3605Sealed", "phase3661Sealed");
  tail = replaceOptional(tail, "phase3605", "phase3661");
  tail = replaceOptional(tail, "result.changedFileCount === 51", "result.changedFileCount === 52");
  tail = replaceOptional(tail, "rollback.files.length === 51", "rollback.files.length === 52");
  tail = replaceOptional(tail, "changedFileCount: result?.changedFileCount ?? 51", "changedFileCount: result?.changedFileCount ?? 52");
  tail = replaceOptional(tail, "expectedOperationCount: 51", "expectedOperationCount: 52");
  tail = replaceOptional(tail, "expectedMaxChangedFiles: 51", "expectedMaxChangedFiles: 52");
  tail = replaceOptional(tail, "maxChangedFiles: 51", "maxChangedFiles: 52");
  tail = replaceOptional(tail, "changedFileCount === 51", "changedFileCount === 52");
  tail = replaceOptional(tail, "exactly fifty-one ", "exactly fifty-two ");
  tail = replaceOptional(tail, "local fifty-one smoke", "local fifty-two smoke");
  tail = replaceOptional(tail, "support fifty-one bounded local smoke commands", "support fifty-two bounded local smoke commands");
  tail = replaceOptional(tail, "JSON smoke helper to fifty-one commands", "JSON smoke helper to fifty-two commands");
  tail = replaceOptional(tail, "Phase3611 through Phase3661", "Phase3667 through Phase3718");
  tail = replaceOptional(tail, "target-fifty-one", "target-fifty-two");
  tail = replaceOptional(tail, "FiftyOneMutation", "FiftyTwoMutation");
  tail = replaceOptional(tail, "fiftyOneMutation", "fiftyTwoMutation");
  tail = replaceOptional(tail, "Fifty-One Tool Mutation Evidence", "Fifty-Two Tool Mutation Evidence");
  tail = replaceOptional(tail, "The fifty-one mutation batch must prove", "The fifty-two mutation batch must prove");
  tail = replaceOptional(tail, "fifty-one target markers are not present", "fifty-two target markers are not present");
  tail = replaceOptional(tail, "rollback replay audit batch or a fifty-two-file bounded batch", "rollback replay audit batch or a fifty-three-file bounded batch");
  return tail;
}

async function main() {
  await mkdir(targetDir, { recursive: true });
  let text = await readFile(sourcePath, "utf8");

  text = text.replace(/const phaseMeta = \{[\s\S]*?\n\};/, phaseMetaBlock());
  text = text.replace(/const previousPhaseMeta = \{[\s\S]*?\n\};/, previousPhaseMetaBlock());
  text = replaceOnce(text, '  "FiftyOne",\n];', '  "FiftyOne",\n  "FiftyTwo",\n];');
  text = replaceOnce(
    text,
    '  "tools/phase3551_3605/apply-controlled-fifty-tool-mutation.mjs",\n];',
    '  "tools/phase3551_3605/apply-controlled-fifty-tool-mutation.mjs",\n  "tools/phase3606_3661/apply-controlled-fifty-one-tool-mutation.mjs",\n];',
  );
  text = replaceOnce(
    text,
    "const fiftyTargets = buildFiftyTargets(fortyNineTargets);\nconst targets = buildFiftyOneTargets(fiftyTargets);",
    "const fiftyTargets = buildFiftyTargets(fortyNineTargets);\nconst fiftyOneTargets = buildFiftyOneTargets(fiftyTargets);\nconst targets = buildFiftyTwoTargets(fiftyOneTargets);",
  );
  text = replaceOnce(text, "\nconst phase2091Checks = [", `\n${buildFiftyTwoTargetsFunction(text)}\n\nconst phase2091Checks = [`);
  text = addAnchorMapEntries(text);
  text = replaceOnce(text, "const tempDir = resolve(\"tmp/phase3606-3661-proposals\");", "const tempDir = resolve(\"tmp/phase3662-3718-proposals\");");

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
