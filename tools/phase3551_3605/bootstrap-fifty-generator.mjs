import { mkdir, readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase3497_3550/generate-forty-nine-phase-assets.mjs";
const targetDir = "tools/phase3551_3605";
const targetPath = `${targetDir}/generate-fifty-phase-assets.mjs`;

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
  phaseId: "Phase3551A-3605A-Controlled-Fifty-Tool-Mutation",
  docPath: "docs/phase3551-3605-controlled-fifty-tool-mutation.md",
  approvalPath: "docs/phase3551-3605-controlled-fifty-tool-mutation-approval.example.json",
  runnerPath: "tools/phase3551_3605/apply-controlled-fifty-tool-mutation.mjs",
  smokeRunnerPath: "tools/phase3551_3605/smoke-controlled-fifty-tool-mutation.mjs",
  verifierPath: "tools/phase3551_3605/validate-controlled-fifty-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase3551-3605-controlled-fifty-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase3551-3605-controlled-fifty-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase3551-3605-controlled-fifty-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase3551-3605-controlled-fifty-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase3551-3605-controlled-fifty-tool-mutation/fifty-smoke.json",
  permissionMode: "controlled-fifty-tool-source-mutation",
  label: "fifty",
  runnerReadyField: "fiftyRunnerReady",
  appliedField: "fiftyMutationApplied",
  smokeField: "localFiftySmokePassed",
  rollbackAction: "restore-previous-content-fifty",
  verifyScript: "verify:phase3551-3605-controlled-fifty-tool-mutation",
  applyScript: "apply:phase3551-3605-controlled-fifty-tool-mutation",
  smokeScript: "smoke:phase3551-3605-controlled-fifty-tool-mutation",
};`;
}

function previousPhaseMetaBlock() {
  return `const previousPhaseMeta = {
  phaseId: "Phase3497A-3550A-Controlled-Forty-Nine-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase3497-3550-controlled-forty-nine-tool-mutation/result.json",
  sealCheckId: "phase3550_sealed",
  sealCheckField: "fortyNineMutationApplied",
  sealCheckBlocker: "phase3550_not_sealed",
};`;
}

function buildFiftyTargetsFunction(source) {
  const start = source.indexOf("function buildFortyNineTargets(previousTargets) {");
  const end = source.indexOf("\nconst phase2091Checks = [", start);
  if (start < 0 || end < 0) throw new Error("missing_forty_nine_targets_function");
  let fn = source.slice(start, end).trim();
  fn = replaceAll(fn, "buildFortyNineTargets", "buildFiftyTargets");
  fn = replaceAll(fn, "FortyNine", "Fifty");
  fn = replaceAll(fn, "Forty-Nine", "Fifty");
  fn = replaceAll(fn, "FORTY_NINE", "FIFTY");
  fn = replaceAll(fn, "fortyNine", "fifty");
  fn = replaceAll(fn, "forty-nine", "fifty");
  fn = replaceOnce(fn, "const phase = 3501 + idx;", "const phase = 3555 + idx;");
  fn = replaceOnce(fn, "const previousRuntimeTarget = previousTargets[47];", "const previousRuntimeTarget = previousTargets[48];");
  fn = replaceOnce(fn, "const fiftyPhase = 3550;", "const fiftyPhase = 3605;");
  fn = replaceOnce(
    fn,
    'const fiftyMarker = "PHASE3550_FIFTY_TOOL_TARGET_FIFTY_OK";',
    'const fiftyMarker = "PHASE3605_FIFTY_TOOL_TARGET_FIFTY_OK";',
  );
  fn = replaceOnce(fn, "idx: 49,", "idx: 50,");
  fn = replaceOnce(fn, "path: sourceTargetPaths[48],", "path: sourceTargetPaths[49],");
  fn = replaceOnce(
    fn,
    'proposal: "docs/phase3550-fifty-tool-mutation-target-fifty.proposal.diff",',
    'proposal: "docs/phase3605-fifty-tool-mutation-target-fifty.proposal.diff",',
  );
  fn = replaceOnce(
    fn,
    'newExport: "buildPhase3550FiftyMutationRuntimeStatus",',
    'newExport: "buildPhase3605FiftyMutationRuntimeStatus",',
  );
  fn = replaceOnce(
    fn,
    'newPhaseId: "Phase3550A-Controlled-Fifty-Tool-Mutation-Target-Fifty",',
    'newPhaseId: "Phase3605A-Controlled-Fifty-Tool-Mutation-Target-Fifty",',
  );
  fn = replaceOnce(
    fn,
    'requiredExports: ["export function buildPhase3550FiftyMutationRuntimeStatus", "export function main"],',
    'requiredExports: ["export function buildPhase3605FiftyMutationRuntimeStatus", "export function main"],',
  );
  return fn;
}

function addAnchorMapEntries(text) {
  return replaceOnce(
    text,
    `      3503: "export function buildPhase3450FortyEightMutationTargetTwoStatus() {",
      3504: "export function buildPhase3451FortyEightMutationTargetThreeStatus() {",
      3505: "export function buildPhase3452FortyEightMutationTargetFourStatus() {",
      3506: "export function buildPhase3453FortyEightMutationTargetFiveStatus() {",`,
    `      3503: "export function buildPhase3450FortyEightMutationTargetTwoStatus() {",
      3504: "export function buildPhase3451FortyEightMutationTargetThreeStatus() {",
      3505: "export function buildPhase3452FortyEightMutationTargetFourStatus() {",
      3506: "export function buildPhase3453FortyEightMutationTargetFiveStatus() {",
      3557: "export function buildPhase3503FortyNineMutationTargetTwoStatus() {",
      3558: "export function buildPhase3504FortyNineMutationTargetThreeStatus() {",
      3559: "export function buildPhase3505FortyNineMutationTargetFourStatus() {",
      3560: "export function buildPhase3506FortyNineMutationTargetFiveStatus() {",`,
  );
}

function updateTail(tail) {
  tail = replaceOptional(tail, "Phase3497A-3550A-Controlled-Forty-Nine-Tool-Mutation", "Phase3551A-3605A-Controlled-Fifty-Tool-Mutation");
  tail = replaceOptional(tail, "Phase3497A-3550A", "Phase3551A-3605A");
  tail = replaceOptional(tail, "phase3497-3550", "phase3551-3605");
  tail = replaceOptional(tail, "tools/phase3497_3550/smoke-controlled-forty-nine-tool-mutation.mjs", "tools/phase3551_3605/smoke-controlled-fifty-tool-mutation.mjs");
  tail = replaceOptional(tail, "controlled-forty-nine-tool-mutation", "controlled-fifty-tool-mutation");
  tail = replaceOptional(tail, "Controlled Forty-Nine Tool Mutation", "Controlled Fifty Tool Mutation");
  tail = replaceOptional(tail, "controlled forty-nine tool mutation", "controlled fifty tool mutation");
  tail = replaceOptional(tail, "forty-nine tool mutation", "fifty tool mutation");
  tail = replaceOptional(tail, "Forty-Nine Tool", "Fifty Tool");
  tail = replaceOptional(tail, "forty-nine-smoke.json", "fifty-smoke.json");
  tail = replaceOptional(tail, "restore-previous-content-forty-nine", "restore-previous-content-fifty");
  tail = replaceOptional(tail, "controlled-forty-nine-tool-source-mutation", "controlled-fifty-tool-source-mutation");
  tail = replaceOptional(tail, "forty_nine_mutation_node_check_or_smoke_failed", "fifty_mutation_node_check_or_smoke_failed");
  tail = replaceOptional(tail, "fortyNineRunnerReady", "fiftyRunnerReady");
  tail = replaceOptional(tail, "fortyNineMutationApplied", "fiftyMutationApplied");
  tail = replaceOptional(tail, "localFortyNineSmokePassed", "localFiftySmokePassed");
  tail = replaceOptional(tail, "docs_mentions_forty_nine", "docs_mentions_fifty");
  tail = replaceOptional(tail, "changed_file_count_forty_nine", "changed_file_count_fifty");
  tail = replaceOptional(tail, "forty_nine_mutation_applied", "fifty_mutation_applied");
  tail = replaceOptional(tail, "rollback_restore_forty_nine", "rollback_restore_fifty");
  tail = replaceOptional(tail, "rollback_forty_nine_entries", "rollback_fifty_entries");
  tail = replaceOptional(tail, "fortyNineMutationReady", "fiftyMutationReady");
  tail = replaceOptional(tail, "forty-nine files", "fifty files");
  tail = replaceOptional(tail, "forty-nine-file", "fifty-file");
  tail = replaceOptional(tail, "from forty-eight files to forty-nine files", "from forty-nine files to fifty files");
  tail = replaceOptional(tail, "from forty-eight files to fifty files", "from forty-nine files to fifty files");
  tail = replaceOptional(tail, "Requires Phase3444A-3496A sealed evidence.", "Requires Phase3497A-3550A sealed evidence.");
  tail = replaceOptional(tail, "Phase3444A-3496A seal", "Phase3497A-3550A seal");
  tail = replaceOptional(tail, "phase3496_sealed", "phase3550_sealed");
  tail = replaceOptional(tail, "phase3496_not_sealed", "phase3550_not_sealed");
  tail = replaceOptional(tail, "phase3496Sealed", "phase3550Sealed");
  tail = replaceOptional(tail, "phase3496", "phase3550");
  tail = replaceOptional(tail, "result.changedFileCount === 49", "result.changedFileCount === 50");
  tail = replaceOptional(tail, "rollback.files.length === 49", "rollback.files.length === 50");
  tail = replaceOptional(tail, "changedFileCount: result?.changedFileCount ?? 49", "changedFileCount: result?.changedFileCount ?? 50");
  tail = replaceOptional(tail, "expectedOperationCount: 49", "expectedOperationCount: 50");
  tail = replaceOptional(tail, "expectedMaxChangedFiles: 49", "expectedMaxChangedFiles: 50");
  tail = replaceOptional(tail, "maxChangedFiles: 49", "maxChangedFiles: 50");
  tail = replaceOptional(tail, "changedFileCount === 49", "changedFileCount === 50");
  tail = replaceOptional(tail, "exactly forty-nine ", "exactly fifty ");
  tail = replaceOptional(tail, "local forty-nine smoke", "local fifty smoke");
  tail = replaceOptional(tail, "support forty-nine bounded local smoke commands", "support fifty bounded local smoke commands");
  tail = replaceOptional(tail, "JSON smoke helper to forty-nine commands", "JSON smoke helper to fifty commands");
  tail = replaceOptional(tail, "Phase3502 through Phase3550", "Phase3556 through Phase3605");
  tail = replaceOptional(tail, "target-forty-nine", "target-fifty");
  tail = replaceOptional(tail, "FortyNineMutation", "FiftyMutation");
  tail = replaceOptional(tail, "fortyNineMutation", "fiftyMutation");
  tail = replaceOptional(tail, "Forty-Nine Tool Mutation Evidence", "Fifty Tool Mutation Evidence");
  tail = replaceOptional(tail, "The forty-nine mutation batch must prove", "The fifty mutation batch must prove");
  tail = replaceOptional(tail, "forty-nine target markers are not present", "fifty target markers are not present");
  tail = replaceOptional(tail, "rollback replay audit batch or a fifty-file bounded batch", "rollback replay audit batch or a fifty-one-file bounded batch");
  return tail;
}

async function main() {
  await mkdir(targetDir, { recursive: true });
  let text = await readFile(sourcePath, "utf8");

  text = text.replace(/const phaseMeta = \{[\s\S]*?\n\};/, phaseMetaBlock());
  text = text.replace(/const previousPhaseMeta = \{[\s\S]*?\n\};/, previousPhaseMetaBlock());
  text = replaceOnce(text, '  "FortyNine",\n];', '  "FortyNine",\n  "Fifty",\n];');
  text = replaceOnce(
    text,
    '  "tools/phase3444_3496/apply-controlled-forty-eight-tool-mutation.mjs",\n];',
    '  "tools/phase3444_3496/apply-controlled-forty-eight-tool-mutation.mjs",\n  "tools/phase3497_3550/apply-controlled-forty-nine-tool-mutation.mjs",\n];',
  );
  text = replaceOnce(
    text,
    "const fortyEightTargets = buildFortyEightTargets(fortySevenTargets);\nconst targets = buildFortyNineTargets(fortyEightTargets);",
    "const fortyEightTargets = buildFortyEightTargets(fortySevenTargets);\nconst fortyNineTargets = buildFortyNineTargets(fortyEightTargets);\nconst targets = buildFiftyTargets(fortyNineTargets);",
  );
  text = replaceOnce(text, "\nconst phase2091Checks = [", `\n${buildFiftyTargetsFunction(text)}\n\nconst phase2091Checks = [`);
  text = addAnchorMapEntries(text);
  text = replaceOnce(text, "const tempDir = resolve(\"tmp/phase3497-3550-proposals\");", "const tempDir = resolve(\"tmp/phase3551-3605-proposals\");");

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
