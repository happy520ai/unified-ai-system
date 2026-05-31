import { mkdir, readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase3551_3605/generate-fifty-phase-assets.mjs";
const targetDir = "tools/phase3606_3661";
const targetPath = `${targetDir}/generate-fifty-one-phase-assets.mjs`;

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
  phaseId: "Phase3606A-3661A-Controlled-Fifty-One-Tool-Mutation",
  docPath: "docs/phase3606-3661-controlled-fifty-one-tool-mutation.md",
  approvalPath: "docs/phase3606-3661-controlled-fifty-one-tool-mutation-approval.example.json",
  runnerPath: "tools/phase3606_3661/apply-controlled-fifty-one-tool-mutation.mjs",
  smokeRunnerPath: "tools/phase3606_3661/smoke-controlled-fifty-one-tool-mutation.mjs",
  verifierPath: "tools/phase3606_3661/validate-controlled-fifty-one-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase3606-3661-controlled-fifty-one-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase3606-3661-controlled-fifty-one-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase3606-3661-controlled-fifty-one-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase3606-3661-controlled-fifty-one-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase3606-3661-controlled-fifty-one-tool-mutation/fifty-one-smoke.json",
  permissionMode: "controlled-fifty-one-tool-source-mutation",
  label: "fifty-one",
  runnerReadyField: "fiftyOneRunnerReady",
  appliedField: "fiftyOneMutationApplied",
  smokeField: "localFiftyOneSmokePassed",
  rollbackAction: "restore-previous-content-fifty-one",
  verifyScript: "verify:phase3606-3661-controlled-fifty-one-tool-mutation",
  applyScript: "apply:phase3606-3661-controlled-fifty-one-tool-mutation",
  smokeScript: "smoke:phase3606-3661-controlled-fifty-one-tool-mutation",
};`;
}

function previousPhaseMetaBlock() {
  return `const previousPhaseMeta = {
  phaseId: "Phase3551A-3605A-Controlled-Fifty-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase3551-3605-controlled-fifty-tool-mutation/result.json",
  sealCheckId: "phase3605_sealed",
  sealCheckField: "fiftyMutationApplied",
  sealCheckBlocker: "phase3605_not_sealed",
};`;
}

function buildFiftyOneTargetsFunction(source) {
  const start = source.indexOf("function buildFiftyTargets(previousTargets) {");
  const end = source.indexOf("\nconst phase2091Checks = [", start);
  if (start < 0 || end < 0) throw new Error("missing_fifty_targets_function");
  let fn = source.slice(start, end).trim();
  fn = replaceAll(fn, "buildFiftyTargets", "buildFiftyOneTargets");
  fn = replaceAll(fn, "FiftyMutation", "FiftyOneMutation");
  fn = replaceAll(fn, "Controlled-Fifty-Tool", "Controlled-Fifty-One-Tool");
  fn = replaceAll(fn, "FIFTY_TOOL", "FIFTY_ONE_TOOL");
  fn = replaceAll(fn, "fifty-tool", "fifty-one-tool");
  fn = replaceOnce(fn, "const phase = 3555 + idx;", "const phase = 3610 + idx;");
  fn = replaceOnce(fn, "const previousRuntimeTarget = previousTargets[48];", "const previousRuntimeTarget = previousTargets[49];");
  fn = replaceOnce(fn, "const fiftyPhase = 3605;", "const fiftyOnePhase = 3661;");
  fn = replaceAll(fn, "fiftyPhase", "fiftyOnePhase");
  fn = replaceOnce(
    fn,
    'const fiftyMarker = "PHASE3605_FIFTY_ONE_TOOL_TARGET_FIFTY_OK";',
    'const fiftyOneMarker = "PHASE3661_FIFTY_ONE_TOOL_TARGET_FIFTY_ONE_OK";',
  );
  fn = replaceAll(fn, "fiftyMarker", "fiftyOneMarker");
  fn = replaceOnce(fn, "idx: 50,", "idx: 51,");
  fn = replaceOnce(fn, 'word: "fifty",', 'word: "fifty-one",');
  fn = replaceOnce(fn, 'targetName: "target-fifty",', 'targetName: "target-fifty-one",');
  fn = replaceOnce(fn, "path: sourceTargetPaths[49],", "path: sourceTargetPaths[50],");
  fn = replaceOnce(
    fn,
    'proposal: "docs/phase3605-fifty-one-tool-mutation-target-fifty.proposal.diff",',
    'proposal: "docs/phase3661-fifty-one-tool-mutation-target-fifty-one.proposal.diff",',
  );
  fn = replaceOnce(
    fn,
    'newExport: "buildPhase3605FiftyOneMutationRuntimeStatus",',
    'newExport: "buildPhase3661FiftyOneMutationRuntimeStatus",',
  );
  fn = replaceOnce(
    fn,
    'newPhaseId: "Phase3605A-Controlled-Fifty-One-Tool-Mutation-Target-Fifty",',
    'newPhaseId: "Phase3661A-Controlled-Fifty-One-Tool-Mutation-Target-Fifty-One",',
  );
  fn = replaceOnce(
    fn,
    'requiredExports: ["export function buildPhase3605FiftyOneMutationRuntimeStatus", "export function main"],',
    'requiredExports: ["export function buildPhase3661FiftyOneMutationRuntimeStatus", "export function main"],',
  );
  return fn;
}

function addAnchorMapEntries(text) {
  return replaceOnce(
    text,
    `      3557: "export function buildPhase3503FortyNineMutationTargetTwoStatus() {",
      3558: "export function buildPhase3504FortyNineMutationTargetThreeStatus() {",
      3559: "export function buildPhase3505FortyNineMutationTargetFourStatus() {",
      3560: "export function buildPhase3506FortyNineMutationTargetFiveStatus() {",`,
    `      3557: "export function buildPhase3503FortyNineMutationTargetTwoStatus() {",
      3558: "export function buildPhase3504FortyNineMutationTargetThreeStatus() {",
      3559: "export function buildPhase3505FortyNineMutationTargetFourStatus() {",
      3560: "export function buildPhase3506FortyNineMutationTargetFiveStatus() {",
      3612: "export function buildPhase3557FiftyMutationTargetTwoStatus() {",
      3613: "export function buildPhase3558FiftyMutationTargetThreeStatus() {",
      3614: "export function buildPhase3559FiftyMutationTargetFourStatus() {",
      3615: "export function buildPhase3560FiftyMutationTargetFiveStatus() {",`,
  );
}

function updateTail(tail) {
  tail = replaceOptional(tail, "Phase3551A-3605A-Controlled-Fifty-Tool-Mutation", "Phase3606A-3661A-Controlled-Fifty-One-Tool-Mutation");
  tail = replaceOptional(tail, "Phase3551A-3605A", "Phase3606A-3661A");
  tail = replaceOptional(tail, "phase3551-3605", "phase3606-3661");
  tail = replaceOptional(tail, "tools/phase3551_3605/smoke-controlled-fifty-tool-mutation.mjs", "tools/phase3606_3661/smoke-controlled-fifty-one-tool-mutation.mjs");
  tail = replaceOptional(tail, "controlled-fifty-tool-mutation", "controlled-fifty-one-tool-mutation");
  tail = replaceOptional(tail, "Controlled Fifty Tool Mutation", "Controlled Fifty-One Tool Mutation");
  tail = replaceOptional(tail, "controlled fifty tool mutation", "controlled fifty-one tool mutation");
  tail = replaceOptional(tail, "fifty tool mutation", "fifty-one tool mutation");
  tail = replaceOptional(tail, "Fifty Tool", "Fifty-One Tool");
  tail = replaceOptional(tail, "fifty-smoke.json", "fifty-one-smoke.json");
  tail = replaceOptional(tail, "restore-previous-content-fifty", "restore-previous-content-fifty-one");
  tail = replaceOptional(tail, "controlled-fifty-tool-source-mutation", "controlled-fifty-one-tool-source-mutation");
  tail = replaceOptional(tail, "fifty_mutation_node_check_or_smoke_failed", "fifty_one_mutation_node_check_or_smoke_failed");
  tail = replaceOptional(tail, "fiftyRunnerReady", "fiftyOneRunnerReady");
  tail = replaceOptional(tail, "fiftyMutationApplied", "fiftyOneMutationApplied");
  tail = replaceOptional(tail, "localFiftySmokePassed", "localFiftyOneSmokePassed");
  tail = replaceOptional(tail, "docs_mentions_fifty", "docs_mentions_fifty_one");
  tail = replaceOptional(tail, "changed_file_count_fifty", "changed_file_count_fifty_one");
  tail = replaceOptional(tail, "fifty_mutation_applied", "fifty_one_mutation_applied");
  tail = replaceOptional(tail, "rollback_restore_fifty", "rollback_restore_fifty_one");
  tail = replaceOptional(tail, "rollback_fifty_entries", "rollback_fifty_one_entries");
  tail = replaceOptional(tail, "fiftyMutationReady", "fiftyOneMutationReady");
  tail = replaceOptional(tail, "fifty files", "fifty-one files");
  tail = replaceOptional(tail, "fifty-file", "fifty-one-file");
  tail = replaceOptional(tail, "from forty-nine files to fifty-one files", "from fifty files to fifty-one files");
  tail = replaceOptional(tail, "from forty-nine files to fifty files", "from fifty files to fifty-one files");
  tail = replaceOptional(tail, "Requires Phase3497A-3550A sealed evidence.", "Requires Phase3551A-3605A sealed evidence.");
  tail = replaceOptional(tail, "Phase3497A-3550A seal", "Phase3551A-3605A seal");
  tail = replaceOptional(tail, "phase3550_sealed", "phase3605_sealed");
  tail = replaceOptional(tail, "phase3550_not_sealed", "phase3605_not_sealed");
  tail = replaceOptional(tail, "phase3550Sealed", "phase3605Sealed");
  tail = replaceOptional(tail, "phase3550", "phase3605");
  tail = replaceOptional(tail, "result.changedFileCount === 50", "result.changedFileCount === 51");
  tail = replaceOptional(tail, "rollback.files.length === 50", "rollback.files.length === 51");
  tail = replaceOptional(tail, "changedFileCount: result?.changedFileCount ?? 50", "changedFileCount: result?.changedFileCount ?? 51");
  tail = replaceOptional(tail, "expectedOperationCount: 50", "expectedOperationCount: 51");
  tail = replaceOptional(tail, "expectedMaxChangedFiles: 50", "expectedMaxChangedFiles: 51");
  tail = replaceOptional(tail, "maxChangedFiles: 50", "maxChangedFiles: 51");
  tail = replaceOptional(tail, "changedFileCount === 50", "changedFileCount === 51");
  tail = replaceOptional(tail, "exactly fifty ", "exactly fifty-one ");
  tail = replaceOptional(tail, "local fifty smoke", "local fifty-one smoke");
  tail = replaceOptional(tail, "support fifty bounded local smoke commands", "support fifty-one bounded local smoke commands");
  tail = replaceOptional(tail, "JSON smoke helper to fifty commands", "JSON smoke helper to fifty-one commands");
  tail = replaceOptional(tail, "Phase3556 through Phase3605", "Phase3611 through Phase3661");
  tail = replaceOptional(tail, "target-fifty", "target-fifty-one");
  tail = replaceOptional(tail, "FiftyMutation", "FiftyOneMutation");
  tail = replaceOptional(tail, "fiftyMutation", "fiftyOneMutation");
  tail = replaceOptional(tail, "Fifty Tool Mutation Evidence", "Fifty-One Tool Mutation Evidence");
  tail = replaceOptional(tail, "The fifty mutation batch must prove", "The fifty-one mutation batch must prove");
  tail = replaceOptional(tail, "fifty target markers are not present", "fifty-one target markers are not present");
  tail = replaceOptional(tail, "rollback replay audit batch or a fifty-one-file bounded batch", "rollback replay audit batch or a fifty-two-file bounded batch");
  return tail;
}

async function main() {
  await mkdir(targetDir, { recursive: true });
  let text = await readFile(sourcePath, "utf8");

  text = text.replace(/const phaseMeta = \{[\s\S]*?\n\};/, phaseMetaBlock());
  text = text.replace(/const previousPhaseMeta = \{[\s\S]*?\n\};/, previousPhaseMetaBlock());
  text = replaceOnce(text, '  "Fifty",\n];', '  "Fifty",\n  "FiftyOne",\n];');
  text = replaceOnce(
    text,
    '  "tools/phase3497_3550/apply-controlled-forty-nine-tool-mutation.mjs",\n];',
    '  "tools/phase3497_3550/apply-controlled-forty-nine-tool-mutation.mjs",\n  "tools/phase3551_3605/apply-controlled-fifty-tool-mutation.mjs",\n];',
  );
  text = replaceOnce(
    text,
    "const fortyNineTargets = buildFortyNineTargets(fortyEightTargets);\nconst targets = buildFiftyTargets(fortyNineTargets);",
    "const fortyNineTargets = buildFortyNineTargets(fortyEightTargets);\nconst fiftyTargets = buildFiftyTargets(fortyNineTargets);\nconst targets = buildFiftyOneTargets(fiftyTargets);",
  );
  text = replaceOnce(text, "\nconst phase2091Checks = [", `\n${buildFiftyOneTargetsFunction(text)}\n\nconst phase2091Checks = [`);
  text = addAnchorMapEntries(text);
  text = replaceOnce(text, "const tempDir = resolve(\"tmp/phase3551-3605-proposals\");", "const tempDir = resolve(\"tmp/phase3606-3661-proposals\");");

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
