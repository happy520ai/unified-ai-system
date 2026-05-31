import { mkdir, readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase3341_3391/generate-forty-six-phase-assets.mjs";
const targetDir = "tools/phase3392_3443";
const targetPath = `${targetDir}/generate-forty-seven-phase-assets.mjs`;

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
  phaseId: "Phase3392A-3443A-Controlled-Forty-Seven-Tool-Mutation",
  docPath: "docs/phase3392-3443-controlled-forty-seven-tool-mutation.md",
  approvalPath: "docs/phase3392-3443-controlled-forty-seven-tool-mutation-approval.example.json",
  runnerPath: "tools/phase3392_3443/apply-controlled-forty-seven-tool-mutation.mjs",
  smokeRunnerPath: "tools/phase3392_3443/smoke-controlled-forty-seven-tool-mutation.mjs",
  verifierPath: "tools/phase3392_3443/validate-controlled-forty-seven-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase3392-3443-controlled-forty-seven-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase3392-3443-controlled-forty-seven-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase3392-3443-controlled-forty-seven-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase3392-3443-controlled-forty-seven-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase3392-3443-controlled-forty-seven-tool-mutation/forty-seven-smoke.json",
  permissionMode: "controlled-forty-seven-tool-source-mutation",
  label: "forty-seven",
  runnerReadyField: "fortySevenRunnerReady",
  appliedField: "fortySevenMutationApplied",
  smokeField: "localFortySevenSmokePassed",
  rollbackAction: "restore-previous-content-forty-seven",
  verifyScript: "verify:phase3392-3443-controlled-forty-seven-tool-mutation",
  applyScript: "apply:phase3392-3443-controlled-forty-seven-tool-mutation",
  smokeScript: "smoke:phase3392-3443-controlled-forty-seven-tool-mutation",
};`;
}

function previousPhaseMetaBlock() {
  return `const previousPhaseMeta = {
  phaseId: "Phase3341A-3391A-Controlled-Forty-Six-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase3341-3391-controlled-forty-six-tool-mutation/result.json",
  sealCheckId: "phase3391_sealed",
  sealCheckField: "fortySixMutationApplied",
  sealCheckBlocker: "phase3391_not_sealed",
};`;
}

function buildFortySevenTargetsFunction(source) {
  const start = source.indexOf("function buildFortySixTargets(previousTargets) {");
  const end = source.indexOf("\nconst phase2091Checks = [", start);
  if (start < 0 || end < 0) throw new Error("missing_forty_six_targets_function");
  let fn = source.slice(start, end).trim();
  fn = replaceAll(fn, "buildFortySixTargets", "buildFortySevenTargets");
  fn = replaceAll(fn, "FortySix", "FortySeven");
  fn = replaceAll(fn, "Forty-Six", "Forty-Seven");
  fn = replaceAll(fn, "FORTY_SIX", "FORTY_SEVEN");
  fn = replaceAll(fn, "fortySix", "fortySeven");
  fn = replaceAll(fn, "forty-six", "forty-seven");
  fn = replaceOnce(fn, "const phase = 3345 + idx;", "const phase = 3396 + idx;");
  fn = replaceOnce(fn, "const previousRuntimeTarget = previousTargets[44];", "const previousRuntimeTarget = previousTargets[45];");
  fn = replaceOnce(fn, "const fortySevenPhase = 3391;", "const fortySevenPhase = 3443;");
  fn = replaceOnce(
    fn,
    'const fortySevenMarker = "PHASE3391_FORTY_SEVEN_TOOL_TARGET_FORTY_SEVEN_OK";',
    'const fortySevenMarker = "PHASE3443_FORTY_SEVEN_TOOL_TARGET_FORTY_SEVEN_OK";',
  );
  fn = replaceOnce(fn, "idx: 46,", "idx: 47,");
  fn = replaceOnce(fn, "path: sourceTargetPaths[45],", "path: sourceTargetPaths[46],");
  fn = replaceOnce(
    fn,
    'proposal: "docs/phase3391-forty-seven-tool-mutation-target-forty-seven.proposal.diff",',
    'proposal: "docs/phase3443-forty-seven-tool-mutation-target-forty-seven.proposal.diff",',
  );
  fn = replaceOnce(
    fn,
    'newExport: "buildPhase3391FortySevenMutationRuntimeStatus",',
    'newExport: "buildPhase3443FortySevenMutationRuntimeStatus",',
  );
  fn = replaceOnce(
    fn,
    'newPhaseId: "Phase3391A-Controlled-Forty-Seven-Tool-Mutation-Target-Forty-Seven",',
    'newPhaseId: "Phase3443A-Controlled-Forty-Seven-Tool-Mutation-Target-Forty-Seven",',
  );
  fn = replaceOnce(
    fn,
    'requiredExports: ["export function buildPhase3391FortySevenMutationRuntimeStatus", "export function main"],',
    'requiredExports: ["export function buildPhase3443FortySevenMutationRuntimeStatus", "export function main"],',
  );
  return fn;
}

function addAnchorMapEntries(text) {
  return replaceOnce(
    text,
    `      3347: "export function buildPhase3297FortyFiveMutationTargetTwoStatus() {",
      3348: "export function buildPhase3298FortyFiveMutationTargetThreeStatus() {",
      3349: "export function buildPhase3299FortyFiveMutationTargetFourStatus() {",
      3350: "export function buildPhase3300FortyFiveMutationTargetFiveStatus() {",`,
    `      3347: "export function buildPhase3297FortyFiveMutationTargetTwoStatus() {",
      3348: "export function buildPhase3298FortyFiveMutationTargetThreeStatus() {",
      3349: "export function buildPhase3299FortyFiveMutationTargetFourStatus() {",
      3350: "export function buildPhase3300FortyFiveMutationTargetFiveStatus() {",
      3398: "export function buildPhase3347FortySixMutationTargetTwoStatus() {",
      3399: "export function buildPhase3348FortySixMutationTargetThreeStatus() {",
      3400: "export function buildPhase3349FortySixMutationTargetFourStatus() {",
      3401: "export function buildPhase3350FortySixMutationTargetFiveStatus() {",`,
  );
}

function updateTail(tail) {
  tail = replaceOptional(tail, "Phase3341A-3391A-Controlled-Forty-Six-Tool-Mutation", "Phase3392A-3443A-Controlled-Forty-Seven-Tool-Mutation");
  tail = replaceOptional(tail, "Phase3341A-3391A", "Phase3392A-3443A");
  tail = replaceOptional(tail, "phase3341-3391", "phase3392-3443");
  tail = replaceOptional(tail, "tools/phase3341_3391/smoke-controlled-forty-six-tool-mutation.mjs", "tools/phase3392_3443/smoke-controlled-forty-seven-tool-mutation.mjs");
  tail = replaceOptional(tail, "controlled-forty-six-tool-mutation", "controlled-forty-seven-tool-mutation");
  tail = replaceOptional(tail, "Controlled Forty-Six Tool Mutation", "Controlled Forty-Seven Tool Mutation");
  tail = replaceOptional(tail, "controlled forty-six tool mutation", "controlled forty-seven tool mutation");
  tail = replaceOptional(tail, "forty-six tool mutation", "forty-seven tool mutation");
  tail = replaceOptional(tail, "Forty-Six Tool", "Forty-Seven Tool");
  tail = replaceOptional(tail, "forty-six-smoke.json", "forty-seven-smoke.json");
  tail = replaceOptional(tail, "restore-previous-content-forty-six", "restore-previous-content-forty-seven");
  tail = replaceOptional(tail, "controlled-forty-six-tool-source-mutation", "controlled-forty-seven-tool-source-mutation");
  tail = replaceOptional(tail, "forty_six_mutation_node_check_or_smoke_failed", "forty_seven_mutation_node_check_or_smoke_failed");
  tail = replaceOptional(tail, "fortySixRunnerReady", "fortySevenRunnerReady");
  tail = replaceOptional(tail, "fortySixMutationApplied", "fortySevenMutationApplied");
  tail = replaceOptional(tail, "localFortySixSmokePassed", "localFortySevenSmokePassed");
  tail = replaceOptional(tail, "docs_mentions_forty_six", "docs_mentions_forty_seven");
  tail = replaceOptional(tail, "changed_file_count_forty_six", "changed_file_count_forty_seven");
  tail = replaceOptional(tail, "forty_six_mutation_applied", "forty_seven_mutation_applied");
  tail = replaceOptional(tail, "rollback_restore_forty_six", "rollback_restore_forty_seven");
  tail = replaceOptional(tail, "rollback_forty_six_entries", "rollback_forty_seven_entries");
  tail = replaceOptional(tail, "fortySixMutationReady", "fortySevenMutationReady");
  tail = replaceOptional(tail, "forty-six files", "forty-seven files");
  tail = replaceOptional(tail, "forty-six-file", "forty-seven-file");
  tail = replaceOptional(tail, "from forty-five files to forty-seven files", "from forty-six files to forty-seven files");
  tail = replaceOptional(tail, "from forty-five files to forty-six files", "from forty-six files to forty-seven files");
  tail = replaceOptional(tail, "Requires Phase3291A-3340A sealed evidence.", "Requires Phase3341A-3391A sealed evidence.");
  tail = replaceOptional(tail, "Phase3291A-3340A seal", "Phase3341A-3391A seal");
  tail = replaceOptional(tail, "phase3340_sealed", "phase3391_sealed");
  tail = replaceOptional(tail, "phase3340_not_sealed", "phase3391_not_sealed");
  tail = replaceOptional(tail, "phase3340Sealed", "phase3391Sealed");
  tail = replaceOptional(tail, "phase3340", "phase3391");
  tail = replaceOptional(tail, "result.changedFileCount === 46", "result.changedFileCount === 47");
  tail = replaceOptional(tail, "rollback.files.length === 46", "rollback.files.length === 47");
  tail = replaceOptional(tail, "changedFileCount: result?.changedFileCount ?? 46", "changedFileCount: result?.changedFileCount ?? 47");
  tail = replaceOptional(tail, "expectedOperationCount: 46", "expectedOperationCount: 47");
  tail = replaceOptional(tail, "expectedMaxChangedFiles: 46", "expectedMaxChangedFiles: 47");
  tail = replaceOptional(tail, "maxChangedFiles: 46", "maxChangedFiles: 47");
  tail = replaceOptional(tail, "changedFileCount === 46", "changedFileCount === 47");
  tail = replaceOptional(tail, "exactly forty-six ", "exactly forty-seven ");
  tail = replaceOptional(tail, "local forty-six smoke", "local forty-seven smoke");
  tail = replaceOptional(tail, "support forty-six bounded local smoke commands", "support forty-seven bounded local smoke commands");
  tail = replaceOptional(tail, "JSON smoke helper to forty-six commands", "JSON smoke helper to forty-seven commands");
  tail = replaceOptional(tail, "Phase3346 through Phase3391", "Phase3397 through Phase3443");
  tail = replaceOptional(tail, "target-forty-six", "target-forty-seven");
  tail = replaceOptional(tail, "FortySixMutation", "FortySevenMutation");
  tail = replaceOptional(tail, "fortySixMutation", "fortySevenMutation");
  tail = replaceOptional(tail, "Forty-Six Tool Mutation Evidence", "Forty-Seven Tool Mutation Evidence");
  tail = replaceOptional(tail, "The forty-six mutation batch must prove", "The forty-seven mutation batch must prove");
  tail = replaceOptional(tail, "forty-six target markers are not present", "forty-seven target markers are not present");
  tail = replaceOptional(tail, "rollback replay audit batch or a forty-seven-file bounded batch", "rollback replay audit batch or a forty-eight-file bounded batch");
  return tail;
}

async function main() {
  await mkdir(targetDir, { recursive: true });
  let text = await readFile(sourcePath, "utf8");

  text = text.replace(/const phaseMeta = \{[\s\S]*?\n\};/, phaseMetaBlock());
  text = text.replace(/const previousPhaseMeta = \{[\s\S]*?\n\};/, previousPhaseMetaBlock());
  text = replaceOnce(text, '  "FortySix",\n];', '  "FortySix",\n  "FortySeven",\n];');
  text = replaceOnce(
    text,
    '  "tools/phase3291_3340/apply-controlled-forty-five-tool-mutation.mjs",\n];',
    '  "tools/phase3291_3340/apply-controlled-forty-five-tool-mutation.mjs",\n  "tools/phase3341_3391/apply-controlled-forty-six-tool-mutation.mjs",\n];',
  );
  text = replaceOnce(
    text,
    "const fortyFiveTargets = buildFortyFiveTargets(fortyFourTargets);\nconst targets = buildFortySixTargets(fortyFiveTargets);",
    "const fortyFiveTargets = buildFortyFiveTargets(fortyFourTargets);\nconst fortySixTargets = buildFortySixTargets(fortyFiveTargets);\nconst targets = buildFortySevenTargets(fortySixTargets);",
  );
  text = replaceOnce(text, "\nconst phase2091Checks = [", `\n${buildFortySevenTargetsFunction(text)}\n\nconst phase2091Checks = [`);
  text = addAnchorMapEntries(text);
  text = replaceOnce(text, "const tempDir = resolve(\"tmp/phase3341-3391-proposals\");", "const tempDir = resolve(\"tmp/phase3392-3443-proposals\");");

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
