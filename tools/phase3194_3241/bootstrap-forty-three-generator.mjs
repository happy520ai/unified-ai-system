import { mkdir, readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase3147_3193/generate-forty-two-phase-assets.mjs";
const targetDir = "tools/phase3194_3241";
const targetPath = `${targetDir}/generate-forty-three-phase-assets.mjs`;

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
  phaseId: "Phase3194A-3241A-Controlled-Forty-Three-Tool-Mutation",
  docPath: "docs/phase3194-3241-controlled-forty-three-tool-mutation.md",
  approvalPath: "docs/phase3194-3241-controlled-forty-three-tool-mutation-approval.example.json",
  runnerPath: "tools/phase3194_3241/apply-controlled-forty-three-tool-mutation.mjs",
  verifierPath: "tools/phase3194_3241/validate-controlled-forty-three-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase3194-3241-controlled-forty-three-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase3194-3241-controlled-forty-three-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase3194-3241-controlled-forty-three-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase3194-3241-controlled-forty-three-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase3194-3241-controlled-forty-three-tool-mutation/forty-three-smoke.json",
  permissionMode: "controlled-forty-three-tool-source-mutation",
  label: "forty-three",
  runnerReadyField: "fortyThreeRunnerReady",
  appliedField: "fortyThreeMutationApplied",
  smokeField: "localFortyThreeSmokePassed",
  rollbackAction: "restore-previous-content-forty-three",
  verifyScript: "verify:phase3194-3241-controlled-forty-three-tool-mutation",
  applyScript: "apply:phase3194-3241-controlled-forty-three-tool-mutation",
  smokeScript: "smoke:phase3194-3241-controlled-forty-three-tool-mutation",
};`;
}

function previousPhaseMetaBlock() {
  return `const previousPhaseMeta = {
  phaseId: "Phase3147A-3193A-Controlled-Forty-Two-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase3147-3193-controlled-forty-two-tool-mutation/result.json",
  sealCheckId: "phase3193_sealed",
  sealCheckField: "fortyTwoMutationApplied",
  sealCheckBlocker: "phase3193_not_sealed",
};`;
}

function buildFortyThreeTargetsFunction(source) {
  const start = source.indexOf("function buildFortyTwoTargets(previousTargets) {");
  const end = source.indexOf("\nconst phase2091Checks = [", start);
  if (start < 0 || end < 0) throw new Error("missing_forty_two_targets_function");
  let fn = source.slice(start, end).trim();
  fn = replaceAll(fn, "buildFortyTwoTargets", "buildFortyThreeTargets");
  fn = replaceAll(fn, "FortyTwo", "FortyThree");
  fn = replaceAll(fn, "Forty-Two", "Forty-Three");
  fn = replaceAll(fn, "FORTY_TWO", "FORTY_THREE");
  fn = replaceAll(fn, "fortyTwo", "fortyThree");
  fn = replaceAll(fn, "forty-two", "forty-three");
  fn = replaceOnce(fn, "const phase = 3151 + idx;", "const phase = 3198 + idx;");
  fn = replaceOnce(fn, "const previousRuntimeTarget = previousTargets[40];", "const previousRuntimeTarget = previousTargets[41];");
  fn = replaceOnce(fn, "const fortyThreePhase = 3193;", "const fortyThreePhase = 3241;");
  fn = replaceOnce(
    fn,
    'const fortyThreeMarker = "PHASE3193_FORTY_THREE_TOOL_TARGET_FORTY_THREE_OK";',
    'const fortyThreeMarker = "PHASE3241_FORTY_THREE_TOOL_TARGET_FORTY_THREE_OK";',
  );
  fn = replaceOnce(fn, "idx: 42,", "idx: 43,");
  fn = replaceOnce(fn, "path: sourceTargetPaths[41],", "path: sourceTargetPaths[42],");
  fn = replaceOnce(
    fn,
    'proposal: "docs/phase3193-forty-three-tool-mutation-target-forty-three.proposal.diff",',
    'proposal: "docs/phase3241-forty-three-tool-mutation-target-forty-three.proposal.diff",',
  );
  fn = replaceOnce(
    fn,
    'newExport: "buildPhase3193FortyThreeMutationRuntimeStatus",',
    'newExport: "buildPhase3241FortyThreeMutationRuntimeStatus",',
  );
  fn = replaceOnce(
    fn,
    'newPhaseId: "Phase3193A-Controlled-Forty-Three-Tool-Mutation-Target-Forty-Three",',
    'newPhaseId: "Phase3241A-Controlled-Forty-Three-Tool-Mutation-Target-Forty-Three",',
  );
  fn = replaceOnce(
    fn,
    'requiredExports: ["export function buildPhase3193FortyThreeMutationRuntimeStatus", "export function main"],',
    'requiredExports: ["export function buildPhase3241FortyThreeMutationRuntimeStatus", "export function main"],',
  );
  return fn;
}

function addAnchorMapEntries(text) {
  return replaceOnce(
    text,
    `      3153: "export function buildPhase3107FortyOneMutationTargetTwoStatus() {",
      3154: "export function buildPhase3108FortyOneMutationTargetThreeStatus() {",
      3155: "export function buildPhase3109FortyOneMutationTargetFourStatus() {",
      3156: "export function buildPhase3110FortyOneMutationTargetFiveStatus() {",`,
    `      3153: "export function buildPhase3107FortyOneMutationTargetTwoStatus() {",
      3154: "export function buildPhase3108FortyOneMutationTargetThreeStatus() {",
      3155: "export function buildPhase3109FortyOneMutationTargetFourStatus() {",
      3156: "export function buildPhase3110FortyOneMutationTargetFiveStatus() {",
      3200: "export function buildPhase3153FortyTwoMutationTargetTwoStatus() {",
      3201: "export function buildPhase3154FortyTwoMutationTargetThreeStatus() {",
      3202: "export function buildPhase3155FortyTwoMutationTargetFourStatus() {",
      3203: "export function buildPhase3156FortyTwoMutationTargetFiveStatus() {",`,
  );
}

function updateTail(tail) {
  tail = replaceOptional(tail, "Phase3147A-3193A-Controlled-Forty-Two-Tool-Mutation", "Phase3194A-3241A-Controlled-Forty-Three-Tool-Mutation");
  tail = replaceOptional(tail, "Phase3147A-3193A", "Phase3194A-3241A");
  tail = replaceOptional(tail, "phase3147-3193", "phase3194-3241");
  tail = replaceOptional(tail, "controlled-forty-two-tool-mutation", "controlled-forty-three-tool-mutation");
  tail = replaceOptional(tail, "Controlled Forty-Two Tool Mutation", "Controlled Forty-Three Tool Mutation");
  tail = replaceOptional(tail, "controlled forty-two tool mutation", "controlled forty-three tool mutation");
  tail = replaceOptional(tail, "forty-two tool mutation", "forty-three tool mutation");
  tail = replaceOptional(tail, "Forty-Two Tool", "Forty-Three Tool");
  tail = replaceOptional(tail, "forty-two-smoke.json", "forty-three-smoke.json");
  tail = replaceOptional(tail, "restore-previous-content-forty-two", "restore-previous-content-forty-three");
  tail = replaceOptional(tail, "controlled-forty-two-tool-source-mutation", "controlled-forty-three-tool-source-mutation");
  tail = replaceOptional(tail, "forty_two_mutation_node_check_or_smoke_failed", "forty_three_mutation_node_check_or_smoke_failed");
  tail = replaceOptional(tail, "fortyTwoRunnerReady", "fortyThreeRunnerReady");
  tail = replaceOptional(tail, "fortyTwoMutationApplied", "fortyThreeMutationApplied");
  tail = replaceOptional(tail, "localFortyTwoSmokePassed", "localFortyThreeSmokePassed");
  tail = replaceOptional(tail, "docs_mentions_forty_two", "docs_mentions_forty_three");
  tail = replaceOptional(tail, "changed_file_count_forty_two", "changed_file_count_forty_three");
  tail = replaceOptional(tail, "forty_two_mutation_applied", "forty_three_mutation_applied");
  tail = replaceOptional(tail, "rollback_restore_forty_two", "rollback_restore_forty_three");
  tail = replaceOptional(tail, "rollback_forty_two_entries", "rollback_forty_three_entries");
  tail = replaceOptional(tail, "fortyTwoMutationReady", "fortyThreeMutationReady");
  tail = replaceOptional(tail, "forty-two files", "forty-three files");
  tail = replaceOptional(tail, "forty-two-file", "forty-three-file");
  tail = replaceOptional(tail, "from forty-one files to forty-three files", "from forty-two files to forty-three files");
  tail = replaceOptional(tail, "from forty-one files to forty-two files", "from forty-two files to forty-three files");
  tail = replaceOptional(tail, "Requires Phase3101A-3146A sealed evidence.", "Requires Phase3147A-3193A sealed evidence.");
  tail = replaceOptional(tail, "Phase3101A-3146A seal", "Phase3147A-3193A seal");
  tail = replaceOptional(tail, "phase3146_sealed", "phase3193_sealed");
  tail = replaceOptional(tail, "phase3146_not_sealed", "phase3193_not_sealed");
  tail = replaceOptional(tail, "phase3146Sealed", "phase3193Sealed");
  tail = replaceOptional(tail, "phase3146", "phase3193");
  tail = replaceOptional(tail, "result.changedFileCount === 42", "result.changedFileCount === 43");
  tail = replaceOptional(tail, "rollback.files.length === 42", "rollback.files.length === 43");
  tail = replaceOptional(tail, "changedFileCount: result?.changedFileCount ?? 42", "changedFileCount: result?.changedFileCount ?? 43");
  tail = replaceOptional(tail, "expectedOperationCount: 42", "expectedOperationCount: 43");
  tail = replaceOptional(tail, "expectedMaxChangedFiles: 42", "expectedMaxChangedFiles: 43");
  tail = replaceOptional(tail, "maxChangedFiles: 42", "maxChangedFiles: 43");
  tail = replaceOptional(tail, "changedFileCount === 42", "changedFileCount === 43");
  tail = replaceOptional(tail, "exactly forty-two ", "exactly forty-three ");
  tail = replaceOptional(tail, "local forty-two smoke", "local forty-three smoke");
  tail = replaceOptional(tail, "support forty-two bounded local smoke commands", "support forty-three bounded local smoke commands");
  tail = replaceOptional(tail, "JSON smoke helper to forty-two commands", "JSON smoke helper to forty-three commands");
  tail = replaceOptional(tail, "Phase3152 through Phase3193", "Phase3199 through Phase3241");
  tail = replaceOptional(tail, "target-forty-two", "target-forty-three");
  tail = replaceOptional(tail, "FortyTwoMutation", "FortyThreeMutation");
  tail = replaceOptional(tail, "fortyTwoMutation", "fortyThreeMutation");
  tail = replaceOptional(tail, "Forty-Two Tool Mutation Evidence", "Forty-Three Tool Mutation Evidence");
  tail = replaceOptional(tail, "The forty-two mutation batch must prove", "The forty-three mutation batch must prove");
  tail = replaceOptional(tail, "forty-two target markers are not present", "forty-three target markers are not present");
  tail = replaceOptional(tail, "rollback replay audit batch or a forty-three-file bounded batch", "rollback replay audit batch or a forty-four-file bounded batch");
  return tail;
}

async function main() {
  await mkdir(targetDir, { recursive: true });
  let text = await readFile(sourcePath, "utf8");

  text = text.replace(/const phaseMeta = \{[\s\S]*?\n\};/, phaseMetaBlock());
  text = text.replace(/const previousPhaseMeta = \{[\s\S]*?\n\};/, previousPhaseMetaBlock());
  text = replaceOnce(text, '  "FortyTwo",\n];', '  "FortyTwo",\n  "FortyThree",\n];');
  text = replaceOnce(
    text,
    '  "tools/phase3101_3146/apply-controlled-forty-one-tool-mutation.mjs",\n];',
    '  "tools/phase3101_3146/apply-controlled-forty-one-tool-mutation.mjs",\n  "tools/phase3147_3193/apply-controlled-forty-two-tool-mutation.mjs",\n];',
  );
  text = replaceOnce(
    text,
    "const fortyOneTargets = buildFortyOneTargets(fortyTargets);\nconst targets = buildFortyTwoTargets(fortyOneTargets);",
    "const fortyOneTargets = buildFortyOneTargets(fortyTargets);\nconst fortyTwoTargets = buildFortyTwoTargets(fortyOneTargets);\nconst targets = buildFortyThreeTargets(fortyTwoTargets);",
  );
  text = replaceOnce(text, "\nconst phase2091Checks = [", `\n${buildFortyThreeTargetsFunction(text)}\n\nconst phase2091Checks = [`);
  text = addAnchorMapEntries(text);
  text = replaceOnce(text, "const tempDir = resolve(\"tmp/phase3147-3193-proposals\");", "const tempDir = resolve(\"tmp/phase3194-3241-proposals\");");

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
