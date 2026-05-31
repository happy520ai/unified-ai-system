import { mkdir, readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase3392_3443/generate-forty-seven-phase-assets.mjs";
const targetDir = "tools/phase3444_3496";
const targetPath = `${targetDir}/generate-forty-eight-phase-assets.mjs`;

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
  phaseId: "Phase3444A-3496A-Controlled-Forty-Eight-Tool-Mutation",
  docPath: "docs/phase3444-3496-controlled-forty-eight-tool-mutation.md",
  approvalPath: "docs/phase3444-3496-controlled-forty-eight-tool-mutation-approval.example.json",
  runnerPath: "tools/phase3444_3496/apply-controlled-forty-eight-tool-mutation.mjs",
  smokeRunnerPath: "tools/phase3444_3496/smoke-controlled-forty-eight-tool-mutation.mjs",
  verifierPath: "tools/phase3444_3496/validate-controlled-forty-eight-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase3444-3496-controlled-forty-eight-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase3444-3496-controlled-forty-eight-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase3444-3496-controlled-forty-eight-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase3444-3496-controlled-forty-eight-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase3444-3496-controlled-forty-eight-tool-mutation/forty-eight-smoke.json",
  permissionMode: "controlled-forty-eight-tool-source-mutation",
  label: "forty-eight",
  runnerReadyField: "fortyEightRunnerReady",
  appliedField: "fortyEightMutationApplied",
  smokeField: "localFortyEightSmokePassed",
  rollbackAction: "restore-previous-content-forty-eight",
  verifyScript: "verify:phase3444-3496-controlled-forty-eight-tool-mutation",
  applyScript: "apply:phase3444-3496-controlled-forty-eight-tool-mutation",
  smokeScript: "smoke:phase3444-3496-controlled-forty-eight-tool-mutation",
};`;
}

function previousPhaseMetaBlock() {
  return `const previousPhaseMeta = {
  phaseId: "Phase3392A-3443A-Controlled-Forty-Seven-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase3392-3443-controlled-forty-seven-tool-mutation/result.json",
  sealCheckId: "phase3443_sealed",
  sealCheckField: "fortySevenMutationApplied",
  sealCheckBlocker: "phase3443_not_sealed",
};`;
}

function buildFortyEightTargetsFunction(source) {
  const start = source.indexOf("function buildFortySevenTargets(previousTargets) {");
  const end = source.indexOf("\nconst phase2091Checks = [", start);
  if (start < 0 || end < 0) throw new Error("missing_forty_seven_targets_function");
  let fn = source.slice(start, end).trim();
  fn = replaceAll(fn, "buildFortySevenTargets", "buildFortyEightTargets");
  fn = replaceAll(fn, "FortySeven", "FortyEight");
  fn = replaceAll(fn, "Forty-Seven", "Forty-Eight");
  fn = replaceAll(fn, "FORTY_SEVEN", "FORTY_EIGHT");
  fn = replaceAll(fn, "fortySeven", "fortyEight");
  fn = replaceAll(fn, "forty-seven", "forty-eight");
  fn = replaceOnce(fn, "const phase = 3396 + idx;", "const phase = 3448 + idx;");
  fn = replaceOnce(fn, "const previousRuntimeTarget = previousTargets[45];", "const previousRuntimeTarget = previousTargets[46];");
  fn = replaceOnce(fn, "const fortyEightPhase = 3443;", "const fortyEightPhase = 3496;");
  fn = replaceOnce(
    fn,
    'const fortyEightMarker = "PHASE3443_FORTY_EIGHT_TOOL_TARGET_FORTY_EIGHT_OK";',
    'const fortyEightMarker = "PHASE3496_FORTY_EIGHT_TOOL_TARGET_FORTY_EIGHT_OK";',
  );
  fn = replaceOnce(fn, "idx: 47,", "idx: 48,");
  fn = replaceOnce(fn, "path: sourceTargetPaths[46],", "path: sourceTargetPaths[47],");
  fn = replaceOnce(
    fn,
    'proposal: "docs/phase3443-forty-eight-tool-mutation-target-forty-eight.proposal.diff",',
    'proposal: "docs/phase3496-forty-eight-tool-mutation-target-forty-eight.proposal.diff",',
  );
  fn = replaceOnce(
    fn,
    'newExport: "buildPhase3443FortyEightMutationRuntimeStatus",',
    'newExport: "buildPhase3496FortyEightMutationRuntimeStatus",',
  );
  fn = replaceOnce(
    fn,
    'newPhaseId: "Phase3443A-Controlled-Forty-Eight-Tool-Mutation-Target-Forty-Eight",',
    'newPhaseId: "Phase3496A-Controlled-Forty-Eight-Tool-Mutation-Target-Forty-Eight",',
  );
  fn = replaceOnce(
    fn,
    'requiredExports: ["export function buildPhase3443FortyEightMutationRuntimeStatus", "export function main"],',
    'requiredExports: ["export function buildPhase3496FortyEightMutationRuntimeStatus", "export function main"],',
  );
  return fn;
}

function addAnchorMapEntries(text) {
  return replaceOnce(
    text,
    `      3398: "export function buildPhase3347FortySixMutationTargetTwoStatus() {",
      3399: "export function buildPhase3348FortySixMutationTargetThreeStatus() {",
      3400: "export function buildPhase3349FortySixMutationTargetFourStatus() {",
      3401: "export function buildPhase3350FortySixMutationTargetFiveStatus() {",`,
    `      3398: "export function buildPhase3347FortySixMutationTargetTwoStatus() {",
      3399: "export function buildPhase3348FortySixMutationTargetThreeStatus() {",
      3400: "export function buildPhase3349FortySixMutationTargetFourStatus() {",
      3401: "export function buildPhase3350FortySixMutationTargetFiveStatus() {",
      3450: "export function buildPhase3398FortySevenMutationTargetTwoStatus() {",
      3451: "export function buildPhase3399FortySevenMutationTargetThreeStatus() {",
      3452: "export function buildPhase3400FortySevenMutationTargetFourStatus() {",
      3453: "export function buildPhase3401FortySevenMutationTargetFiveStatus() {",`,
  );
}

function updateTail(tail) {
  tail = replaceOptional(tail, "Phase3392A-3443A-Controlled-Forty-Seven-Tool-Mutation", "Phase3444A-3496A-Controlled-Forty-Eight-Tool-Mutation");
  tail = replaceOptional(tail, "Phase3392A-3443A", "Phase3444A-3496A");
  tail = replaceOptional(tail, "phase3392-3443", "phase3444-3496");
  tail = replaceOptional(tail, "tools/phase3392_3443/smoke-controlled-forty-seven-tool-mutation.mjs", "tools/phase3444_3496/smoke-controlled-forty-eight-tool-mutation.mjs");
  tail = replaceOptional(tail, "controlled-forty-seven-tool-mutation", "controlled-forty-eight-tool-mutation");
  tail = replaceOptional(tail, "Controlled Forty-Seven Tool Mutation", "Controlled Forty-Eight Tool Mutation");
  tail = replaceOptional(tail, "controlled forty-seven tool mutation", "controlled forty-eight tool mutation");
  tail = replaceOptional(tail, "forty-seven tool mutation", "forty-eight tool mutation");
  tail = replaceOptional(tail, "Forty-Seven Tool", "Forty-Eight Tool");
  tail = replaceOptional(tail, "forty-seven-smoke.json", "forty-eight-smoke.json");
  tail = replaceOptional(tail, "restore-previous-content-forty-seven", "restore-previous-content-forty-eight");
  tail = replaceOptional(tail, "controlled-forty-seven-tool-source-mutation", "controlled-forty-eight-tool-source-mutation");
  tail = replaceOptional(tail, "forty_seven_mutation_node_check_or_smoke_failed", "forty_eight_mutation_node_check_or_smoke_failed");
  tail = replaceOptional(tail, "fortySevenRunnerReady", "fortyEightRunnerReady");
  tail = replaceOptional(tail, "fortySevenMutationApplied", "fortyEightMutationApplied");
  tail = replaceOptional(tail, "localFortySevenSmokePassed", "localFortyEightSmokePassed");
  tail = replaceOptional(tail, "docs_mentions_forty_seven", "docs_mentions_forty_eight");
  tail = replaceOptional(tail, "changed_file_count_forty_seven", "changed_file_count_forty_eight");
  tail = replaceOptional(tail, "forty_seven_mutation_applied", "forty_eight_mutation_applied");
  tail = replaceOptional(tail, "rollback_restore_forty_seven", "rollback_restore_forty_eight");
  tail = replaceOptional(tail, "rollback_forty_seven_entries", "rollback_forty_eight_entries");
  tail = replaceOptional(tail, "fortySevenMutationReady", "fortyEightMutationReady");
  tail = replaceOptional(tail, "forty-seven files", "forty-eight files");
  tail = replaceOptional(tail, "forty-seven-file", "forty-eight-file");
  tail = replaceOptional(tail, "from forty-six files to forty-seven files", "from forty-seven files to forty-eight files");
  tail = replaceOptional(tail, "from forty-six files to forty-eight files", "from forty-seven files to forty-eight files");
  tail = replaceOptional(tail, "Requires Phase3341A-3391A sealed evidence.", "Requires Phase3392A-3443A sealed evidence.");
  tail = replaceOptional(tail, "Phase3341A-3391A seal", "Phase3392A-3443A seal");
  tail = replaceOptional(tail, "phase3391_sealed", "phase3443_sealed");
  tail = replaceOptional(tail, "phase3391_not_sealed", "phase3443_not_sealed");
  tail = replaceOptional(tail, "phase3391Sealed", "phase3443Sealed");
  tail = replaceOptional(tail, "phase3391", "phase3443");
  tail = replaceOptional(tail, "result.changedFileCount === 47", "result.changedFileCount === 48");
  tail = replaceOptional(tail, "rollback.files.length === 47", "rollback.files.length === 48");
  tail = replaceOptional(tail, "changedFileCount: result?.changedFileCount ?? 47", "changedFileCount: result?.changedFileCount ?? 48");
  tail = replaceOptional(tail, "expectedOperationCount: 47", "expectedOperationCount: 48");
  tail = replaceOptional(tail, "expectedMaxChangedFiles: 47", "expectedMaxChangedFiles: 48");
  tail = replaceOptional(tail, "maxChangedFiles: 47", "maxChangedFiles: 48");
  tail = replaceOptional(tail, "changedFileCount === 47", "changedFileCount === 48");
  tail = replaceOptional(tail, "exactly forty-seven ", "exactly forty-eight ");
  tail = replaceOptional(tail, "local forty-seven smoke", "local forty-eight smoke");
  tail = replaceOptional(tail, "support forty-seven bounded local smoke commands", "support forty-eight bounded local smoke commands");
  tail = replaceOptional(tail, "JSON smoke helper to forty-seven commands", "JSON smoke helper to forty-eight commands");
  tail = replaceOptional(tail, "Phase3397 through Phase3443", "Phase3449 through Phase3496");
  tail = replaceOptional(tail, "target-forty-seven", "target-forty-eight");
  tail = replaceOptional(tail, "FortySevenMutation", "FortyEightMutation");
  tail = replaceOptional(tail, "fortySevenMutation", "fortyEightMutation");
  tail = replaceOptional(tail, "Forty-Seven Tool Mutation Evidence", "Forty-Eight Tool Mutation Evidence");
  tail = replaceOptional(tail, "The forty-seven mutation batch must prove", "The forty-eight mutation batch must prove");
  tail = replaceOptional(tail, "forty-seven target markers are not present", "forty-eight target markers are not present");
  tail = replaceOptional(tail, "rollback replay audit batch or a forty-eight-file bounded batch", "rollback replay audit batch or a forty-nine-file bounded batch");
  return tail;
}

async function main() {
  await mkdir(targetDir, { recursive: true });
  let text = await readFile(sourcePath, "utf8");

  text = text.replace(/const phaseMeta = \{[\s\S]*?\n\};/, phaseMetaBlock());
  text = text.replace(/const previousPhaseMeta = \{[\s\S]*?\n\};/, previousPhaseMetaBlock());
  text = replaceOnce(text, '  "FortySeven",\n];', '  "FortySeven",\n  "FortyEight",\n];');
  text = replaceOnce(
    text,
    '  "tools/phase3341_3391/apply-controlled-forty-six-tool-mutation.mjs",\n];',
    '  "tools/phase3341_3391/apply-controlled-forty-six-tool-mutation.mjs",\n  "tools/phase3392_3443/apply-controlled-forty-seven-tool-mutation.mjs",\n];',
  );
  text = replaceOnce(
    text,
    "const fortySixTargets = buildFortySixTargets(fortyFiveTargets);\nconst targets = buildFortySevenTargets(fortySixTargets);",
    "const fortySixTargets = buildFortySixTargets(fortyFiveTargets);\nconst fortySevenTargets = buildFortySevenTargets(fortySixTargets);\nconst targets = buildFortyEightTargets(fortySevenTargets);",
  );
  text = replaceOnce(text, "\nconst phase2091Checks = [", `\n${buildFortyEightTargetsFunction(text)}\n\nconst phase2091Checks = [`);
  text = addAnchorMapEntries(text);
  text = replaceOnce(text, "const tempDir = resolve(\"tmp/phase3392-3443-proposals\");", "const tempDir = resolve(\"tmp/phase3444-3496-proposals\");");

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
