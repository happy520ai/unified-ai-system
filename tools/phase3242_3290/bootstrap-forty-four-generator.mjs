import { mkdir, readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase3194_3241/generate-forty-three-phase-assets.mjs";
const targetDir = "tools/phase3242_3290";
const targetPath = `${targetDir}/generate-forty-four-phase-assets.mjs`;

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
  phaseId: "Phase3242A-3290A-Controlled-Forty-Four-Tool-Mutation",
  docPath: "docs/phase3242-3290-controlled-forty-four-tool-mutation.md",
  approvalPath: "docs/phase3242-3290-controlled-forty-four-tool-mutation-approval.example.json",
  runnerPath: "tools/phase3242_3290/apply-controlled-forty-four-tool-mutation.mjs",
  verifierPath: "tools/phase3242_3290/validate-controlled-forty-four-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase3242-3290-controlled-forty-four-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase3242-3290-controlled-forty-four-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase3242-3290-controlled-forty-four-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase3242-3290-controlled-forty-four-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase3242-3290-controlled-forty-four-tool-mutation/forty-four-smoke.json",
  permissionMode: "controlled-forty-four-tool-source-mutation",
  label: "forty-four",
  runnerReadyField: "fortyFourRunnerReady",
  appliedField: "fortyFourMutationApplied",
  smokeField: "localFortyFourSmokePassed",
  rollbackAction: "restore-previous-content-forty-four",
  verifyScript: "verify:phase3242-3290-controlled-forty-four-tool-mutation",
  applyScript: "apply:phase3242-3290-controlled-forty-four-tool-mutation",
  smokeScript: "smoke:phase3242-3290-controlled-forty-four-tool-mutation",
};`;
}

function previousPhaseMetaBlock() {
  return `const previousPhaseMeta = {
  phaseId: "Phase3194A-3241A-Controlled-Forty-Three-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase3194-3241-controlled-forty-three-tool-mutation/result.json",
  sealCheckId: "phase3241_sealed",
  sealCheckField: "fortyThreeMutationApplied",
  sealCheckBlocker: "phase3241_not_sealed",
};`;
}

function buildFortyFourTargetsFunction(source) {
  const start = source.indexOf("function buildFortyThreeTargets(previousTargets) {");
  const end = source.indexOf("\nconst phase2091Checks = [", start);
  if (start < 0 || end < 0) throw new Error("missing_forty_three_targets_function");
  let fn = source.slice(start, end).trim();
  fn = replaceAll(fn, "buildFortyThreeTargets", "buildFortyFourTargets");
  fn = replaceAll(fn, "FortyThree", "FortyFour");
  fn = replaceAll(fn, "Forty-Three", "Forty-Four");
  fn = replaceAll(fn, "FORTY_THREE", "FORTY_FOUR");
  fn = replaceAll(fn, "fortyThree", "fortyFour");
  fn = replaceAll(fn, "forty-three", "forty-four");
  fn = replaceOnce(fn, "const phase = 3198 + idx;", "const phase = 3246 + idx;");
  fn = replaceOnce(fn, "const previousRuntimeTarget = previousTargets[41];", "const previousRuntimeTarget = previousTargets[42];");
  fn = replaceOnce(fn, "const fortyFourPhase = 3241;", "const fortyFourPhase = 3290;");
  fn = replaceOnce(
    fn,
    'const fortyFourMarker = "PHASE3241_FORTY_FOUR_TOOL_TARGET_FORTY_FOUR_OK";',
    'const fortyFourMarker = "PHASE3290_FORTY_FOUR_TOOL_TARGET_FORTY_FOUR_OK";',
  );
  fn = replaceOnce(fn, "idx: 43,", "idx: 44,");
  fn = replaceOnce(fn, "path: sourceTargetPaths[42],", "path: sourceTargetPaths[43],");
  fn = replaceOnce(
    fn,
    'proposal: "docs/phase3241-forty-four-tool-mutation-target-forty-four.proposal.diff",',
    'proposal: "docs/phase3290-forty-four-tool-mutation-target-forty-four.proposal.diff",',
  );
  fn = replaceOnce(
    fn,
    'newExport: "buildPhase3241FortyFourMutationRuntimeStatus",',
    'newExport: "buildPhase3290FortyFourMutationRuntimeStatus",',
  );
  fn = replaceOnce(
    fn,
    'newPhaseId: "Phase3241A-Controlled-Forty-Four-Tool-Mutation-Target-Forty-Four",',
    'newPhaseId: "Phase3290A-Controlled-Forty-Four-Tool-Mutation-Target-Forty-Four",',
  );
  fn = replaceOnce(
    fn,
    'requiredExports: ["export function buildPhase3241FortyFourMutationRuntimeStatus", "export function main"],',
    'requiredExports: ["export function buildPhase3290FortyFourMutationRuntimeStatus", "export function main"],',
  );
  return fn;
}

function addAnchorMapEntries(text) {
  return replaceOnce(
    text,
    `      3200: "export function buildPhase3153FortyTwoMutationTargetTwoStatus() {",
      3201: "export function buildPhase3154FortyTwoMutationTargetThreeStatus() {",
      3202: "export function buildPhase3155FortyTwoMutationTargetFourStatus() {",
      3203: "export function buildPhase3156FortyTwoMutationTargetFiveStatus() {",`,
    `      3200: "export function buildPhase3153FortyTwoMutationTargetTwoStatus() {",
      3201: "export function buildPhase3154FortyTwoMutationTargetThreeStatus() {",
      3202: "export function buildPhase3155FortyTwoMutationTargetFourStatus() {",
      3203: "export function buildPhase3156FortyTwoMutationTargetFiveStatus() {",
      3248: "export function buildPhase3200FortyThreeMutationTargetTwoStatus() {",
      3249: "export function buildPhase3201FortyThreeMutationTargetThreeStatus() {",
      3250: "export function buildPhase3202FortyThreeMutationTargetFourStatus() {",
      3251: "export function buildPhase3203FortyThreeMutationTargetFiveStatus() {",`,
  );
}

function updateTail(tail) {
  tail = replaceOptional(tail, "Phase3194A-3241A-Controlled-Forty-Three-Tool-Mutation", "Phase3242A-3290A-Controlled-Forty-Four-Tool-Mutation");
  tail = replaceOptional(tail, "Phase3194A-3241A", "Phase3242A-3290A");
  tail = replaceOptional(tail, "phase3194-3241", "phase3242-3290");
  tail = replaceOptional(tail, "controlled-forty-three-tool-mutation", "controlled-forty-four-tool-mutation");
  tail = replaceOptional(tail, "Controlled Forty-Three Tool Mutation", "Controlled Forty-Four Tool Mutation");
  tail = replaceOptional(tail, "controlled forty-three tool mutation", "controlled forty-four tool mutation");
  tail = replaceOptional(tail, "forty-three tool mutation", "forty-four tool mutation");
  tail = replaceOptional(tail, "Forty-Three Tool", "Forty-Four Tool");
  tail = replaceOptional(tail, "forty-three-smoke.json", "forty-four-smoke.json");
  tail = replaceOptional(tail, "restore-previous-content-forty-three", "restore-previous-content-forty-four");
  tail = replaceOptional(tail, "controlled-forty-three-tool-source-mutation", "controlled-forty-four-tool-source-mutation");
  tail = replaceOptional(tail, "forty_three_mutation_node_check_or_smoke_failed", "forty_four_mutation_node_check_or_smoke_failed");
  tail = replaceOptional(tail, "fortyThreeRunnerReady", "fortyFourRunnerReady");
  tail = replaceOptional(tail, "fortyThreeMutationApplied", "fortyFourMutationApplied");
  tail = replaceOptional(tail, "localFortyThreeSmokePassed", "localFortyFourSmokePassed");
  tail = replaceOptional(tail, "docs_mentions_forty_three", "docs_mentions_forty_four");
  tail = replaceOptional(tail, "changed_file_count_forty_three", "changed_file_count_forty_four");
  tail = replaceOptional(tail, "forty_three_mutation_applied", "forty_four_mutation_applied");
  tail = replaceOptional(tail, "rollback_restore_forty_three", "rollback_restore_forty_four");
  tail = replaceOptional(tail, "rollback_forty_three_entries", "rollback_forty_four_entries");
  tail = replaceOptional(tail, "fortyThreeMutationReady", "fortyFourMutationReady");
  tail = replaceOptional(tail, "forty-three files", "forty-four files");
  tail = replaceOptional(tail, "forty-three-file", "forty-four-file");
  tail = replaceOptional(tail, "from forty-two files to forty-four files", "from forty-three files to forty-four files");
  tail = replaceOptional(tail, "from forty-two files to forty-three files", "from forty-three files to forty-four files");
  tail = replaceOptional(tail, "Requires Phase3147A-3193A sealed evidence.", "Requires Phase3194A-3241A sealed evidence.");
  tail = replaceOptional(tail, "Phase3147A-3193A seal", "Phase3194A-3241A seal");
  tail = replaceOptional(tail, "phase3193_sealed", "phase3241_sealed");
  tail = replaceOptional(tail, "phase3193_not_sealed", "phase3241_not_sealed");
  tail = replaceOptional(tail, "phase3193Sealed", "phase3241Sealed");
  tail = replaceOptional(tail, "phase3193", "phase3241");
  tail = replaceOptional(tail, "result.changedFileCount === 43", "result.changedFileCount === 44");
  tail = replaceOptional(tail, "rollback.files.length === 43", "rollback.files.length === 44");
  tail = replaceOptional(tail, "changedFileCount: result?.changedFileCount ?? 43", "changedFileCount: result?.changedFileCount ?? 44");
  tail = replaceOptional(tail, "expectedOperationCount: 43", "expectedOperationCount: 44");
  tail = replaceOptional(tail, "expectedMaxChangedFiles: 43", "expectedMaxChangedFiles: 44");
  tail = replaceOptional(tail, "maxChangedFiles: 43", "maxChangedFiles: 44");
  tail = replaceOptional(tail, "changedFileCount === 43", "changedFileCount === 44");
  tail = replaceOptional(tail, "exactly forty-three ", "exactly forty-four ");
  tail = replaceOptional(tail, "local forty-three smoke", "local forty-four smoke");
  tail = replaceOptional(tail, "support forty-three bounded local smoke commands", "support forty-four bounded local smoke commands");
  tail = replaceOptional(tail, "JSON smoke helper to forty-three commands", "JSON smoke helper to forty-four commands");
  tail = replaceOptional(tail, "Phase3199 through Phase3241", "Phase3247 through Phase3290");
  tail = replaceOptional(tail, "target-forty-three", "target-forty-four");
  tail = replaceOptional(tail, "FortyThreeMutation", "FortyFourMutation");
  tail = replaceOptional(tail, "fortyThreeMutation", "fortyFourMutation");
  tail = replaceOptional(tail, "Forty-Three Tool Mutation Evidence", "Forty-Four Tool Mutation Evidence");
  tail = replaceOptional(tail, "The forty-three mutation batch must prove", "The forty-four mutation batch must prove");
  tail = replaceOptional(tail, "forty-three target markers are not present", "forty-four target markers are not present");
  tail = replaceOptional(tail, "rollback replay audit batch or a forty-four-file bounded batch", "rollback replay audit batch or a forty-five-file bounded batch");
  return tail;
}

async function main() {
  await mkdir(targetDir, { recursive: true });
  let text = await readFile(sourcePath, "utf8");

  text = text.replace(/const phaseMeta = \{[\s\S]*?\n\};/, phaseMetaBlock());
  text = text.replace(/const previousPhaseMeta = \{[\s\S]*?\n\};/, previousPhaseMetaBlock());
  text = replaceOnce(text, '  "FortyThree",\n];', '  "FortyThree",\n  "FortyFour",\n];');
  text = replaceOnce(
    text,
    '  "tools/phase3147_3193/apply-controlled-forty-two-tool-mutation.mjs",\n];',
    '  "tools/phase3147_3193/apply-controlled-forty-two-tool-mutation.mjs",\n  "tools/phase3194_3241/apply-controlled-forty-three-tool-mutation.mjs",\n];',
  );
  text = replaceOnce(
    text,
    "const fortyTwoTargets = buildFortyTwoTargets(fortyOneTargets);\nconst targets = buildFortyThreeTargets(fortyTwoTargets);",
    "const fortyTwoTargets = buildFortyTwoTargets(fortyOneTargets);\nconst fortyThreeTargets = buildFortyThreeTargets(fortyTwoTargets);\nconst targets = buildFortyFourTargets(fortyThreeTargets);",
  );
  text = replaceOnce(text, "\nconst phase2091Checks = [", `\n${buildFortyFourTargetsFunction(text)}\n\nconst phase2091Checks = [`);
  text = addAnchorMapEntries(text);
  text = replaceOnce(text, "const tempDir = resolve(\"tmp/phase3194-3241-proposals\");", "const tempDir = resolve(\"tmp/phase3242-3290-proposals\");");

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
