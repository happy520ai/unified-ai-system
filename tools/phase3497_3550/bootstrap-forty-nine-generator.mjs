import { mkdir, readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase3444_3496/generate-forty-eight-phase-assets.mjs";
const targetDir = "tools/phase3497_3550";
const targetPath = `${targetDir}/generate-forty-nine-phase-assets.mjs`;

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
  phaseId: "Phase3497A-3550A-Controlled-Forty-Nine-Tool-Mutation",
  docPath: "docs/phase3497-3550-controlled-forty-nine-tool-mutation.md",
  approvalPath: "docs/phase3497-3550-controlled-forty-nine-tool-mutation-approval.example.json",
  runnerPath: "tools/phase3497_3550/apply-controlled-forty-nine-tool-mutation.mjs",
  smokeRunnerPath: "tools/phase3497_3550/smoke-controlled-forty-nine-tool-mutation.mjs",
  verifierPath: "tools/phase3497_3550/validate-controlled-forty-nine-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase3497-3550-controlled-forty-nine-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase3497-3550-controlled-forty-nine-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase3497-3550-controlled-forty-nine-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase3497-3550-controlled-forty-nine-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase3497-3550-controlled-forty-nine-tool-mutation/forty-nine-smoke.json",
  permissionMode: "controlled-forty-nine-tool-source-mutation",
  label: "forty-nine",
  runnerReadyField: "fortyNineRunnerReady",
  appliedField: "fortyNineMutationApplied",
  smokeField: "localFortyNineSmokePassed",
  rollbackAction: "restore-previous-content-forty-nine",
  verifyScript: "verify:phase3497-3550-controlled-forty-nine-tool-mutation",
  applyScript: "apply:phase3497-3550-controlled-forty-nine-tool-mutation",
  smokeScript: "smoke:phase3497-3550-controlled-forty-nine-tool-mutation",
};`;
}

function previousPhaseMetaBlock() {
  return `const previousPhaseMeta = {
  phaseId: "Phase3444A-3496A-Controlled-Forty-Eight-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase3444-3496-controlled-forty-eight-tool-mutation/result.json",
  sealCheckId: "phase3496_sealed",
  sealCheckField: "fortyEightMutationApplied",
  sealCheckBlocker: "phase3496_not_sealed",
};`;
}

function buildFortyNineTargetsFunction(source) {
  const start = source.indexOf("function buildFortyEightTargets(previousTargets) {");
  const end = source.indexOf("\nconst phase2091Checks = [", start);
  if (start < 0 || end < 0) throw new Error("missing_forty_eight_targets_function");
  let fn = source.slice(start, end).trim();
  fn = replaceAll(fn, "buildFortyEightTargets", "buildFortyNineTargets");
  fn = replaceAll(fn, "FortyEight", "FortyNine");
  fn = replaceAll(fn, "Forty-Eight", "Forty-Nine");
  fn = replaceAll(fn, "FORTY_EIGHT", "FORTY_NINE");
  fn = replaceAll(fn, "fortyEight", "fortyNine");
  fn = replaceAll(fn, "forty-eight", "forty-nine");
  fn = replaceOnce(fn, "const phase = 3448 + idx;", "const phase = 3501 + idx;");
  fn = replaceOnce(fn, "const previousRuntimeTarget = previousTargets[46];", "const previousRuntimeTarget = previousTargets[47];");
  fn = replaceOnce(fn, "const fortyNinePhase = 3496;", "const fortyNinePhase = 3550;");
  fn = replaceOnce(
    fn,
    'const fortyNineMarker = "PHASE3496_FORTY_NINE_TOOL_TARGET_FORTY_NINE_OK";',
    'const fortyNineMarker = "PHASE3550_FORTY_NINE_TOOL_TARGET_FORTY_NINE_OK";',
  );
  fn = replaceOnce(fn, "idx: 48,", "idx: 49,");
  fn = replaceOnce(fn, "path: sourceTargetPaths[47],", "path: sourceTargetPaths[48],");
  fn = replaceOnce(
    fn,
    'proposal: "docs/phase3496-forty-nine-tool-mutation-target-forty-nine.proposal.diff",',
    'proposal: "docs/phase3550-forty-nine-tool-mutation-target-forty-nine.proposal.diff",',
  );
  fn = replaceOnce(
    fn,
    'newExport: "buildPhase3496FortyNineMutationRuntimeStatus",',
    'newExport: "buildPhase3550FortyNineMutationRuntimeStatus",',
  );
  fn = replaceOnce(
    fn,
    'newPhaseId: "Phase3496A-Controlled-Forty-Nine-Tool-Mutation-Target-Forty-Nine",',
    'newPhaseId: "Phase3550A-Controlled-Forty-Nine-Tool-Mutation-Target-Forty-Nine",',
  );
  fn = replaceOnce(
    fn,
    'requiredExports: ["export function buildPhase3496FortyNineMutationRuntimeStatus", "export function main"],',
    'requiredExports: ["export function buildPhase3550FortyNineMutationRuntimeStatus", "export function main"],',
  );
  return fn;
}

function addAnchorMapEntries(text) {
  return replaceOnce(
    text,
    `      3450: "export function buildPhase3398FortySevenMutationTargetTwoStatus() {",
      3451: "export function buildPhase3399FortySevenMutationTargetThreeStatus() {",
      3452: "export function buildPhase3400FortySevenMutationTargetFourStatus() {",
      3453: "export function buildPhase3401FortySevenMutationTargetFiveStatus() {",`,
    `      3450: "export function buildPhase3398FortySevenMutationTargetTwoStatus() {",
      3451: "export function buildPhase3399FortySevenMutationTargetThreeStatus() {",
      3452: "export function buildPhase3400FortySevenMutationTargetFourStatus() {",
      3453: "export function buildPhase3401FortySevenMutationTargetFiveStatus() {",
      3503: "export function buildPhase3450FortyEightMutationTargetTwoStatus() {",
      3504: "export function buildPhase3451FortyEightMutationTargetThreeStatus() {",
      3505: "export function buildPhase3452FortyEightMutationTargetFourStatus() {",
      3506: "export function buildPhase3453FortyEightMutationTargetFiveStatus() {",`,
  );
}

function updateTail(tail) {
  tail = replaceOptional(tail, "Phase3444A-3496A-Controlled-Forty-Eight-Tool-Mutation", "Phase3497A-3550A-Controlled-Forty-Nine-Tool-Mutation");
  tail = replaceOptional(tail, "Phase3444A-3496A", "Phase3497A-3550A");
  tail = replaceOptional(tail, "phase3444-3496", "phase3497-3550");
  tail = replaceOptional(tail, "tools/phase3444_3496/smoke-controlled-forty-eight-tool-mutation.mjs", "tools/phase3497_3550/smoke-controlled-forty-nine-tool-mutation.mjs");
  tail = replaceOptional(tail, "controlled-forty-eight-tool-mutation", "controlled-forty-nine-tool-mutation");
  tail = replaceOptional(tail, "Controlled Forty-Eight Tool Mutation", "Controlled Forty-Nine Tool Mutation");
  tail = replaceOptional(tail, "controlled forty-eight tool mutation", "controlled forty-nine tool mutation");
  tail = replaceOptional(tail, "forty-eight tool mutation", "forty-nine tool mutation");
  tail = replaceOptional(tail, "Forty-Eight Tool", "Forty-Nine Tool");
  tail = replaceOptional(tail, "forty-eight-smoke.json", "forty-nine-smoke.json");
  tail = replaceOptional(tail, "restore-previous-content-forty-eight", "restore-previous-content-forty-nine");
  tail = replaceOptional(tail, "controlled-forty-eight-tool-source-mutation", "controlled-forty-nine-tool-source-mutation");
  tail = replaceOptional(tail, "forty_eight_mutation_node_check_or_smoke_failed", "forty_nine_mutation_node_check_or_smoke_failed");
  tail = replaceOptional(tail, "fortyEightRunnerReady", "fortyNineRunnerReady");
  tail = replaceOptional(tail, "fortyEightMutationApplied", "fortyNineMutationApplied");
  tail = replaceOptional(tail, "localFortyEightSmokePassed", "localFortyNineSmokePassed");
  tail = replaceOptional(tail, "docs_mentions_forty_eight", "docs_mentions_forty_nine");
  tail = replaceOptional(tail, "changed_file_count_forty_eight", "changed_file_count_forty_nine");
  tail = replaceOptional(tail, "forty_eight_mutation_applied", "forty_nine_mutation_applied");
  tail = replaceOptional(tail, "rollback_restore_forty_eight", "rollback_restore_forty_nine");
  tail = replaceOptional(tail, "rollback_forty_eight_entries", "rollback_forty_nine_entries");
  tail = replaceOptional(tail, "fortyEightMutationReady", "fortyNineMutationReady");
  tail = replaceOptional(tail, "forty-eight files", "forty-nine files");
  tail = replaceOptional(tail, "forty-eight-file", "forty-nine-file");
  tail = replaceOptional(tail, "from forty-seven files to forty-eight files", "from forty-eight files to forty-nine files");
  tail = replaceOptional(tail, "from forty-seven files to forty-nine files", "from forty-eight files to forty-nine files");
  tail = replaceOptional(tail, "Requires Phase3392A-3443A sealed evidence.", "Requires Phase3444A-3496A sealed evidence.");
  tail = replaceOptional(tail, "Phase3392A-3443A seal", "Phase3444A-3496A seal");
  tail = replaceOptional(tail, "phase3443_sealed", "phase3496_sealed");
  tail = replaceOptional(tail, "phase3443_not_sealed", "phase3496_not_sealed");
  tail = replaceOptional(tail, "phase3443Sealed", "phase3496Sealed");
  tail = replaceOptional(tail, "phase3443", "phase3496");
  tail = replaceOptional(tail, "result.changedFileCount === 48", "result.changedFileCount === 49");
  tail = replaceOptional(tail, "rollback.files.length === 48", "rollback.files.length === 49");
  tail = replaceOptional(tail, "changedFileCount: result?.changedFileCount ?? 48", "changedFileCount: result?.changedFileCount ?? 49");
  tail = replaceOptional(tail, "expectedOperationCount: 48", "expectedOperationCount: 49");
  tail = replaceOptional(tail, "expectedMaxChangedFiles: 48", "expectedMaxChangedFiles: 49");
  tail = replaceOptional(tail, "maxChangedFiles: 48", "maxChangedFiles: 49");
  tail = replaceOptional(tail, "changedFileCount === 48", "changedFileCount === 49");
  tail = replaceOptional(tail, "exactly forty-eight ", "exactly forty-nine ");
  tail = replaceOptional(tail, "local forty-eight smoke", "local forty-nine smoke");
  tail = replaceOptional(tail, "support forty-eight bounded local smoke commands", "support forty-nine bounded local smoke commands");
  tail = replaceOptional(tail, "JSON smoke helper to forty-eight commands", "JSON smoke helper to forty-nine commands");
  tail = replaceOptional(tail, "Phase3449 through Phase3496", "Phase3502 through Phase3550");
  tail = replaceOptional(tail, "target-forty-eight", "target-forty-nine");
  tail = replaceOptional(tail, "FortyEightMutation", "FortyNineMutation");
  tail = replaceOptional(tail, "fortyEightMutation", "fortyNineMutation");
  tail = replaceOptional(tail, "Forty-Eight Tool Mutation Evidence", "Forty-Nine Tool Mutation Evidence");
  tail = replaceOptional(tail, "The forty-eight mutation batch must prove", "The forty-nine mutation batch must prove");
  tail = replaceOptional(tail, "forty-eight target markers are not present", "forty-nine target markers are not present");
  tail = replaceOptional(tail, "rollback replay audit batch or a forty-nine-file bounded batch", "rollback replay audit batch or a fifty-file bounded batch");
  return tail;
}

async function main() {
  await mkdir(targetDir, { recursive: true });
  let text = await readFile(sourcePath, "utf8");

  text = text.replace(/const phaseMeta = \{[\s\S]*?\n\};/, phaseMetaBlock());
  text = text.replace(/const previousPhaseMeta = \{[\s\S]*?\n\};/, previousPhaseMetaBlock());
  text = replaceOnce(text, '  "FortyEight",\n];', '  "FortyEight",\n  "FortyNine",\n];');
  text = replaceOnce(
    text,
    '  "tools/phase3392_3443/apply-controlled-forty-seven-tool-mutation.mjs",\n];',
    '  "tools/phase3392_3443/apply-controlled-forty-seven-tool-mutation.mjs",\n  "tools/phase3444_3496/apply-controlled-forty-eight-tool-mutation.mjs",\n];',
  );
  text = replaceOnce(
    text,
    "const fortySevenTargets = buildFortySevenTargets(fortySixTargets);\nconst targets = buildFortyEightTargets(fortySevenTargets);",
    "const fortySevenTargets = buildFortySevenTargets(fortySixTargets);\nconst fortyEightTargets = buildFortyEightTargets(fortySevenTargets);\nconst targets = buildFortyNineTargets(fortyEightTargets);",
  );
  text = replaceOnce(text, "\nconst phase2091Checks = [", `\n${buildFortyNineTargetsFunction(text)}\n\nconst phase2091Checks = [`);
  text = addAnchorMapEntries(text);
  text = replaceOnce(text, "const tempDir = resolve(\"tmp/phase3444-3496-proposals\");", "const tempDir = resolve(\"tmp/phase3497-3550-proposals\");");

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
