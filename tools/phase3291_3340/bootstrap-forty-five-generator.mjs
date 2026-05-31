import { mkdir, readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase3242_3290/generate-forty-four-phase-assets.mjs";
const targetDir = "tools/phase3291_3340";
const targetPath = `${targetDir}/generate-forty-five-phase-assets.mjs`;

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
  phaseId: "Phase3291A-3340A-Controlled-Forty-Five-Tool-Mutation",
  docPath: "docs/phase3291-3340-controlled-forty-five-tool-mutation.md",
  approvalPath: "docs/phase3291-3340-controlled-forty-five-tool-mutation-approval.example.json",
  runnerPath: "tools/phase3291_3340/apply-controlled-forty-five-tool-mutation.mjs",
  verifierPath: "tools/phase3291_3340/validate-controlled-forty-five-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase3291-3340-controlled-forty-five-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase3291-3340-controlled-forty-five-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase3291-3340-controlled-forty-five-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase3291-3340-controlled-forty-five-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase3291-3340-controlled-forty-five-tool-mutation/forty-five-smoke.json",
  permissionMode: "controlled-forty-five-tool-source-mutation",
  label: "forty-five",
  runnerReadyField: "fortyFiveRunnerReady",
  appliedField: "fortyFiveMutationApplied",
  smokeField: "localFortyFiveSmokePassed",
  rollbackAction: "restore-previous-content-forty-five",
  verifyScript: "verify:phase3291-3340-controlled-forty-five-tool-mutation",
  applyScript: "apply:phase3291-3340-controlled-forty-five-tool-mutation",
  smokeScript: "smoke:phase3291-3340-controlled-forty-five-tool-mutation",
};`;
}

function previousPhaseMetaBlock() {
  return `const previousPhaseMeta = {
  phaseId: "Phase3242A-3290A-Controlled-Forty-Four-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase3242-3290-controlled-forty-four-tool-mutation/result.json",
  sealCheckId: "phase3290_sealed",
  sealCheckField: "fortyFourMutationApplied",
  sealCheckBlocker: "phase3290_not_sealed",
};`;
}

function buildFortyFiveTargetsFunction(source) {
  const start = source.indexOf("function buildFortyFourTargets(previousTargets) {");
  const end = source.indexOf("\nconst phase2091Checks = [", start);
  if (start < 0 || end < 0) throw new Error("missing_forty_four_targets_function");
  let fn = source.slice(start, end).trim();
  fn = replaceAll(fn, "buildFortyFourTargets", "buildFortyFiveTargets");
  fn = replaceAll(fn, "FortyFour", "FortyFive");
  fn = replaceAll(fn, "Forty-Four", "Forty-Five");
  fn = replaceAll(fn, "FORTY_FOUR", "FORTY_FIVE");
  fn = replaceAll(fn, "fortyFour", "fortyFive");
  fn = replaceAll(fn, "forty-four", "forty-five");
  fn = replaceOnce(fn, "const phase = 3246 + idx;", "const phase = 3295 + idx;");
  fn = replaceOnce(fn, "const previousRuntimeTarget = previousTargets[42];", "const previousRuntimeTarget = previousTargets[43];");
  fn = replaceOnce(fn, "const fortyFivePhase = 3290;", "const fortyFivePhase = 3340;");
  fn = replaceOnce(
    fn,
    'const fortyFiveMarker = "PHASE3290_FORTY_FIVE_TOOL_TARGET_FORTY_FIVE_OK";',
    'const fortyFiveMarker = "PHASE3340_FORTY_FIVE_TOOL_TARGET_FORTY_FIVE_OK";',
  );
  fn = replaceOnce(fn, "idx: 44,", "idx: 45,");
  fn = replaceOnce(fn, "path: sourceTargetPaths[43],", "path: sourceTargetPaths[44],");
  fn = replaceOnce(
    fn,
    'proposal: "docs/phase3290-forty-five-tool-mutation-target-forty-five.proposal.diff",',
    'proposal: "docs/phase3340-forty-five-tool-mutation-target-forty-five.proposal.diff",',
  );
  fn = replaceOnce(
    fn,
    'newExport: "buildPhase3290FortyFiveMutationRuntimeStatus",',
    'newExport: "buildPhase3340FortyFiveMutationRuntimeStatus",',
  );
  fn = replaceOnce(
    fn,
    'newPhaseId: "Phase3290A-Controlled-Forty-Five-Tool-Mutation-Target-Forty-Five",',
    'newPhaseId: "Phase3340A-Controlled-Forty-Five-Tool-Mutation-Target-Forty-Five",',
  );
  fn = replaceOnce(
    fn,
    'requiredExports: ["export function buildPhase3290FortyFiveMutationRuntimeStatus", "export function main"],',
    'requiredExports: ["export function buildPhase3340FortyFiveMutationRuntimeStatus", "export function main"],',
  );
  return fn;
}

function addAnchorMapEntries(text) {
  return replaceOnce(
    text,
    `      3248: "export function buildPhase3200FortyThreeMutationTargetTwoStatus() {",
      3249: "export function buildPhase3201FortyThreeMutationTargetThreeStatus() {",
      3250: "export function buildPhase3202FortyThreeMutationTargetFourStatus() {",
      3251: "export function buildPhase3203FortyThreeMutationTargetFiveStatus() {",`,
    `      3248: "export function buildPhase3200FortyThreeMutationTargetTwoStatus() {",
      3249: "export function buildPhase3201FortyThreeMutationTargetThreeStatus() {",
      3250: "export function buildPhase3202FortyThreeMutationTargetFourStatus() {",
      3251: "export function buildPhase3203FortyThreeMutationTargetFiveStatus() {",
      3297: "export function buildPhase3248FortyFourMutationTargetTwoStatus() {",
      3298: "export function buildPhase3249FortyFourMutationTargetThreeStatus() {",
      3299: "export function buildPhase3250FortyFourMutationTargetFourStatus() {",
      3300: "export function buildPhase3251FortyFourMutationTargetFiveStatus() {",`,
  );
}

function updateTail(tail) {
  tail = replaceOptional(tail, "Phase3242A-3290A-Controlled-Forty-Four-Tool-Mutation", "Phase3291A-3340A-Controlled-Forty-Five-Tool-Mutation");
  tail = replaceOptional(tail, "Phase3242A-3290A", "Phase3291A-3340A");
  tail = replaceOptional(tail, "phase3242-3290", "phase3291-3340");
  tail = replaceOptional(tail, "controlled-forty-four-tool-mutation", "controlled-forty-five-tool-mutation");
  tail = replaceOptional(tail, "Controlled Forty-Four Tool Mutation", "Controlled Forty-Five Tool Mutation");
  tail = replaceOptional(tail, "controlled forty-four tool mutation", "controlled forty-five tool mutation");
  tail = replaceOptional(tail, "forty-four tool mutation", "forty-five tool mutation");
  tail = replaceOptional(tail, "Forty-Four Tool", "Forty-Five Tool");
  tail = replaceOptional(tail, "forty-four-smoke.json", "forty-five-smoke.json");
  tail = replaceOptional(tail, "restore-previous-content-forty-four", "restore-previous-content-forty-five");
  tail = replaceOptional(tail, "controlled-forty-four-tool-source-mutation", "controlled-forty-five-tool-source-mutation");
  tail = replaceOptional(tail, "forty_four_mutation_node_check_or_smoke_failed", "forty_five_mutation_node_check_or_smoke_failed");
  tail = replaceOptional(tail, "fortyFourRunnerReady", "fortyFiveRunnerReady");
  tail = replaceOptional(tail, "fortyFourMutationApplied", "fortyFiveMutationApplied");
  tail = replaceOptional(tail, "localFortyFourSmokePassed", "localFortyFiveSmokePassed");
  tail = replaceOptional(tail, "docs_mentions_forty_four", "docs_mentions_forty_five");
  tail = replaceOptional(tail, "changed_file_count_forty_four", "changed_file_count_forty_five");
  tail = replaceOptional(tail, "forty_four_mutation_applied", "forty_five_mutation_applied");
  tail = replaceOptional(tail, "rollback_restore_forty_four", "rollback_restore_forty_five");
  tail = replaceOptional(tail, "rollback_forty_four_entries", "rollback_forty_five_entries");
  tail = replaceOptional(tail, "fortyFourMutationReady", "fortyFiveMutationReady");
  tail = replaceOptional(tail, "forty-four files", "forty-five files");
  tail = replaceOptional(tail, "forty-four-file", "forty-five-file");
  tail = replaceOptional(tail, "from forty-three files to forty-five files", "from forty-four files to forty-five files");
  tail = replaceOptional(tail, "from forty-three files to forty-four files", "from forty-four files to forty-five files");
  tail = replaceOptional(tail, "Requires Phase3194A-3241A sealed evidence.", "Requires Phase3242A-3290A sealed evidence.");
  tail = replaceOptional(tail, "Phase3194A-3241A seal", "Phase3242A-3290A seal");
  tail = replaceOptional(tail, "phase3241_sealed", "phase3290_sealed");
  tail = replaceOptional(tail, "phase3241_not_sealed", "phase3290_not_sealed");
  tail = replaceOptional(tail, "phase3241Sealed", "phase3290Sealed");
  tail = replaceOptional(tail, "phase3241", "phase3290");
  tail = replaceOptional(tail, "result.changedFileCount === 44", "result.changedFileCount === 45");
  tail = replaceOptional(tail, "rollback.files.length === 44", "rollback.files.length === 45");
  tail = replaceOptional(tail, "changedFileCount: result?.changedFileCount ?? 44", "changedFileCount: result?.changedFileCount ?? 45");
  tail = replaceOptional(tail, "expectedOperationCount: 44", "expectedOperationCount: 45");
  tail = replaceOptional(tail, "expectedMaxChangedFiles: 44", "expectedMaxChangedFiles: 45");
  tail = replaceOptional(tail, "maxChangedFiles: 44", "maxChangedFiles: 45");
  tail = replaceOptional(tail, "changedFileCount === 44", "changedFileCount === 45");
  tail = replaceOptional(tail, "exactly forty-four ", "exactly forty-five ");
  tail = replaceOptional(tail, "local forty-four smoke", "local forty-five smoke");
  tail = replaceOptional(tail, "support forty-four bounded local smoke commands", "support forty-five bounded local smoke commands");
  tail = replaceOptional(tail, "JSON smoke helper to forty-four commands", "JSON smoke helper to forty-five commands");
  tail = replaceOptional(tail, "Phase3247 through Phase3290", "Phase3296 through Phase3340");
  tail = replaceOptional(tail, "target-forty-four", "target-forty-five");
  tail = replaceOptional(tail, "FortyFourMutation", "FortyFiveMutation");
  tail = replaceOptional(tail, "fortyFourMutation", "fortyFiveMutation");
  tail = replaceOptional(tail, "Forty-Four Tool Mutation Evidence", "Forty-Five Tool Mutation Evidence");
  tail = replaceOptional(tail, "The forty-four mutation batch must prove", "The forty-five mutation batch must prove");
  tail = replaceOptional(tail, "forty-four target markers are not present", "forty-five target markers are not present");
  tail = replaceOptional(tail, "rollback replay audit batch or a forty-five-file bounded batch", "rollback replay audit batch or a forty-six-file bounded batch");
  return tail;
}

async function main() {
  await mkdir(targetDir, { recursive: true });
  let text = await readFile(sourcePath, "utf8");

  text = text.replace(/const phaseMeta = \{[\s\S]*?\n\};/, phaseMetaBlock());
  text = text.replace(/const previousPhaseMeta = \{[\s\S]*?\n\};/, previousPhaseMetaBlock());
  text = replaceOnce(text, '  "FortyFour",\n];', '  "FortyFour",\n  "FortyFive",\n];');
  text = replaceOnce(
    text,
    '  "tools/phase3194_3241/apply-controlled-forty-three-tool-mutation.mjs",\n];',
    '  "tools/phase3194_3241/apply-controlled-forty-three-tool-mutation.mjs",\n  "tools/phase3242_3290/apply-controlled-forty-four-tool-mutation.mjs",\n];',
  );
  text = replaceOnce(
    text,
    "const fortyThreeTargets = buildFortyThreeTargets(fortyTwoTargets);\nconst targets = buildFortyFourTargets(fortyThreeTargets);",
    "const fortyThreeTargets = buildFortyThreeTargets(fortyTwoTargets);\nconst fortyFourTargets = buildFortyFourTargets(fortyThreeTargets);\nconst targets = buildFortyFiveTargets(fortyFourTargets);",
  );
  text = replaceOnce(text, "\nconst phase2091Checks = [", `\n${buildFortyFiveTargetsFunction(text)}\n\nconst phase2091Checks = [`);
  text = addAnchorMapEntries(text);
  text = replaceOnce(text, "const tempDir = resolve(\"tmp/phase3242-3290-proposals\");", "const tempDir = resolve(\"tmp/phase3291-3340-proposals\");");

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
