import { mkdir, readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase3056_3100/generate-forty-phase-assets.mjs";
const targetDir = "tools/phase3101_3146";
const targetPath = `${targetDir}/generate-forty-one-phase-assets.mjs`;

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
  phaseId: "Phase3101A-3146A-Controlled-Forty-One-Tool-Mutation",
  docPath: "docs/phase3101-3146-controlled-forty-one-tool-mutation.md",
  approvalPath: "docs/phase3101-3146-controlled-forty-one-tool-mutation-approval.example.json",
  runnerPath: "tools/phase3101_3146/apply-controlled-forty-one-tool-mutation.mjs",
  verifierPath: "tools/phase3101_3146/validate-controlled-forty-one-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase3101-3146-controlled-forty-one-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase3101-3146-controlled-forty-one-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase3101-3146-controlled-forty-one-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase3101-3146-controlled-forty-one-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase3101-3146-controlled-forty-one-tool-mutation/forty-one-smoke.json",
  permissionMode: "controlled-forty-one-tool-source-mutation",
  label: "forty-one",
  runnerReadyField: "fortyOneRunnerReady",
  appliedField: "fortyOneMutationApplied",
  smokeField: "localFortyOneSmokePassed",
  rollbackAction: "restore-previous-content-forty-one",
  verifyScript: "verify:phase3101-3146-controlled-forty-one-tool-mutation",
  applyScript: "apply:phase3101-3146-controlled-forty-one-tool-mutation",
  smokeScript: "smoke:phase3101-3146-controlled-forty-one-tool-mutation",
};`;
}

function previousPhaseMetaBlock() {
  return `const previousPhaseMeta = {
  phaseId: "Phase3056A-3100A-Controlled-Forty-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase3056-3100-controlled-forty-tool-mutation/result.json",
  sealCheckId: "phase3100_sealed",
  sealCheckField: "fortyMutationApplied",
  sealCheckBlocker: "phase3100_not_sealed",
};`;
}

function buildFortyOneTargetsFunction(source) {
  const start = source.indexOf("function buildFortyTargets(previousTargets) {");
  const end = source.indexOf("\nconst phase2091Checks = [", start);
  if (start < 0 || end < 0) throw new Error("missing_forty_targets_function");
  let fn = source.slice(start, end).trim();
  fn = replaceAll(fn, "buildFortyTargets", "buildFortyOneTargets");
  fn = replaceAll(fn, "Forty", "FortyOne");
  fn = replaceAll(fn, "FORTY", "FORTY_ONE");
  fn = replaceAll(fn, "forty", "fortyOne");
  fn = replaceAll(fn, "fortyOne-tool", "forty-one-tool");
  fn = replaceAll(fn, "fortyOneMarker", "fortyOneMarker");
  fn = replaceOptional(fn, "buildFortyOneOneTargets", "buildFortyOneTargets");
  fn = replaceOptional(fn, "Controlled-FortyOne-Tool", "Controlled-Forty-One-Tool");
  fn = replaceOnce(fn, "const phase = 3060 + idx;", "const phase = 3105 + idx;");
  fn = replaceOnce(fn, "const previousRuntimeTarget = previousTargets[38];", "const previousRuntimeTarget = previousTargets[39];");
  fn = replaceOnce(fn, "const fortyOnePhase = 3100;", "const fortyOnePhase = 3146;");
  fn = replaceOnce(
    fn,
    'const fortyOneMarker = "PHASE3100_FORTY_ONE_TOOL_TARGET_FORTY_ONE_OK";',
    'const fortyOneMarker = "PHASE3146_FORTY_ONE_TOOL_TARGET_FORTY_ONE_OK";',
  );
  fn = replaceOnce(fn, "idx: 40,", "idx: 41,");
  fn = replaceOnce(fn, 'word: "fortyOne",', 'word: "forty-one",');
  fn = replaceOnce(fn, 'targetName: "target-fortyOne",', 'targetName: "target-forty-one",');
  fn = replaceOnce(fn, "path: sourceTargetPaths[39],", "path: sourceTargetPaths[40],");
  fn = replaceOnce(
    fn,
    'proposal: "docs/phase3100-forty-one-tool-mutation-target-fortyOne.proposal.diff",',
    'proposal: "docs/phase3146-forty-one-tool-mutation-target-forty-one.proposal.diff",',
  );
  fn = replaceOnce(
    fn,
    'newExport: "buildPhase3100FortyOneMutationRuntimeStatus",',
    'newExport: "buildPhase3146FortyOneMutationRuntimeStatus",',
  );
  fn = replaceOnce(
    fn,
    'newPhaseId: "Phase3100A-Controlled-Forty-One-Tool-Mutation-Target-FortyOne",',
    'newPhaseId: "Phase3146A-Controlled-Forty-One-Tool-Mutation-Target-Forty-One",',
  );
  fn = replaceOnce(
    fn,
    'requiredExports: ["export function buildPhase3100FortyOneMutationRuntimeStatus", "export function main"],',
    'requiredExports: ["export function buildPhase3146FortyOneMutationRuntimeStatus", "export function main"],',
  );
  return fn;
}

function addAnchorMapEntries(text) {
  return replaceOnce(
    text,
    `      3062: "export function buildPhase3018ThirtyNineMutationTargetTwoStatus() {",
      3063: "export function buildPhase3019ThirtyNineMutationTargetThreeStatus() {",
      3064: "export function buildPhase3020ThirtyNineMutationTargetFourStatus() {",
      3065: "export function buildPhase3021ThirtyNineMutationTargetFiveStatus() {",`,
    `      3062: "export function buildPhase3018ThirtyNineMutationTargetTwoStatus() {",
      3063: "export function buildPhase3019ThirtyNineMutationTargetThreeStatus() {",
      3064: "export function buildPhase3020ThirtyNineMutationTargetFourStatus() {",
      3065: "export function buildPhase3021ThirtyNineMutationTargetFiveStatus() {",
      3107: "export function buildPhase3062FortyMutationTargetTwoStatus() {",
      3108: "export function buildPhase3063FortyMutationTargetThreeStatus() {",
      3109: "export function buildPhase3064FortyMutationTargetFourStatus() {",
      3110: "export function buildPhase3065FortyMutationTargetFiveStatus() {",`,
  );
}

function updateTail(tail) {
  tail = replaceOptional(tail, "Phase3056A-3100A-Controlled-Forty-Tool-Mutation", "Phase3101A-3146A-Controlled-Forty-One-Tool-Mutation");
  tail = replaceOptional(tail, "Phase3056A-3100A", "Phase3101A-3146A");
  tail = replaceOptional(tail, "phase3056-3100", "phase3101-3146");
  tail = replaceOptional(tail, "phase3101-3146-controlled-forty-tool-mutation", "phase3101-3146-controlled-forty-one-tool-mutation");
  tail = replaceOptional(tail, "Controlled Forty Tool Mutation", "Controlled Forty-One Tool Mutation");
  tail = replaceOptional(tail, "controlled forty tool mutation", "controlled forty-one tool mutation");
  tail = replaceOptional(tail, "forty tool mutation", "forty-one tool mutation");
  tail = replaceOptional(tail, "Forty Tool", "Forty-One Tool");
  tail = replaceOptional(tail, "forty-smoke.json", "forty-one-smoke.json");
  tail = replaceOptional(tail, "restore-previous-content-forty", "restore-previous-content-forty-one");
  tail = replaceOptional(tail, "controlled-forty-tool-source-mutation", "controlled-forty-one-tool-source-mutation");
  tail = replaceOptional(tail, "forty_mutation_node_check_or_smoke_failed", "forty_one_mutation_node_check_or_smoke_failed");
  tail = replaceOptional(tail, "fortyRunnerReady", "fortyOneRunnerReady");
  tail = replaceOptional(tail, "fortyMutationApplied", "fortyOneMutationApplied");
  tail = replaceOptional(tail, "localFortySmokePassed", "localFortyOneSmokePassed");
  tail = replaceOptional(tail, "docs_mentions_forty", "docs_mentions_forty_one");
  tail = replaceOptional(tail, "changed_file_count_forty", "changed_file_count_forty_one");
  tail = replaceOptional(tail, "rollback_restore_forty", "rollback_restore_forty_one");
  tail = replaceOptional(tail, "rollback_forty_entries", "rollback_forty_one_entries");
  tail = replaceOptional(tail, "fortyMutationReady", "fortyOneMutationReady");
  tail = replaceOptional(tail, "forty files", "forty-one files");
  tail = replaceOptional(tail, "forty-file", "forty-one-file");
  tail = replaceOptional(tail, "from thirty-nine files to forty-one files", "from forty files to forty-one files");
  tail = replaceOptional(tail, "Requires Phase3012A-3055A sealed evidence.", "Requires Phase3056A-3100A sealed evidence.");
  tail = replaceOptional(tail, "Phase3012A-3055A seal", "Phase3056A-3100A seal");
  tail = replaceOptional(tail, "phase3055_sealed", "phase3100_sealed");
  tail = replaceOptional(tail, "phase3055_not_sealed", "phase3100_not_sealed");
  tail = replaceOptional(tail, "phase3055", "phase3100");
  tail = replaceOptional(tail, "phase3055Sealed", "phase3100Sealed");
  tail = replaceOptional(tail, "thirtyNineMutationApplied", "fortyMutationApplied");
  tail = replaceOptional(tail, "result.changedFileCount === 40", "result.changedFileCount === 41");
  tail = replaceOptional(tail, "rollback.files.length === 40", "rollback.files.length === 41");
  tail = replaceOptional(tail, "changedFileCount: result?.changedFileCount ?? 40", "changedFileCount: result?.changedFileCount ?? 41");
  tail = replaceOptional(tail, "expectedOperationCount: 40", "expectedOperationCount: 41");
  tail = replaceOptional(tail, "expectedMaxChangedFiles: 40", "expectedMaxChangedFiles: 41");
  tail = replaceOptional(tail, "maxChangedFiles: 40", "maxChangedFiles: 41");
  tail = replaceOptional(tail, "maxChangedFiles: 41,", "maxChangedFiles: 41,");
  tail = replaceOptional(tail, "changedFileCount === 40", "changedFileCount === 41");
  tail = replaceOptional(tail, "exactly forty ", "exactly forty-one ");
  tail = replaceOptional(tail, "local forty smoke", "local forty-one smoke");
  tail = replaceOptional(tail, "JSON smoke helper to forty commands", "JSON smoke helper to forty-one commands");
  tail = replaceOptional(tail, "Phase3061 through Phase3100", "Phase3106 through Phase3146");
  tail = replaceOptional(tail, "target-forty", "target-forty-one");
  tail = replaceOptional(tail, "FortyMutation", "FortyOneMutation");
  tail = replaceOptional(tail, "fortyMutation", "fortyOneMutation");
  tail = replaceOptional(tail, "Forty Tool Mutation Evidence", "Forty-One Tool Mutation Evidence");
  tail = replaceOptional(tail, "fortyMutationApplied", "fortyOneMutationApplied");
  tail = replaceOptional(tail, "localFortySmokePassed", "localFortyOneSmokePassed");
  return tail;
}

async function main() {
  await mkdir(targetDir, { recursive: true });
  let text = await readFile(sourcePath, "utf8");

  text = text.replace(/const phaseMeta = \{[\s\S]*?\n\};/, phaseMetaBlock());
  text = text.replace(/const previousPhaseMeta = \{[\s\S]*?\n\};/, previousPhaseMetaBlock());
  text = replaceOnce(text, '  "Forty",\n];', '  "Forty",\n  "FortyOne",\n];');
  text = replaceOnce(
    text,
    '  "tools/phase3012_3055/apply-controlled-thirty-nine-tool-mutation.mjs",\n];',
    '  "tools/phase3012_3055/apply-controlled-thirty-nine-tool-mutation.mjs",\n  "tools/phase3056_3100/apply-controlled-forty-tool-mutation.mjs",\n];',
  );
  text = replaceOnce(
    text,
    "const thirtyNineTargets = buildThirtyNineTargets(thirtyEightTargets);\nconst targets = buildFortyTargets(thirtyNineTargets);",
    "const thirtyNineTargets = buildThirtyNineTargets(thirtyEightTargets);\nconst fortyTargets = buildFortyTargets(thirtyNineTargets);\nconst targets = buildFortyOneTargets(fortyTargets);",
  );
  text = replaceOnce(text, "\nconst phase2091Checks = [", `\n${buildFortyOneTargetsFunction(text)}\n\nconst phase2091Checks = [`);
  text = addAnchorMapEntries(text);
  text = replaceOnce(text, "const tempDir = resolve(\"tmp/phase3056-3100-proposals\");", "const tempDir = resolve(\"tmp/phase3101-3146-proposals\");");

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
