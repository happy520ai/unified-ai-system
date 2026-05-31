import { mkdir, readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase3291_3340/generate-forty-five-phase-assets.mjs";
const targetDir = "tools/phase3341_3391";
const targetPath = `${targetDir}/generate-forty-six-phase-assets.mjs`;

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
  phaseId: "Phase3341A-3391A-Controlled-Forty-Six-Tool-Mutation",
  docPath: "docs/phase3341-3391-controlled-forty-six-tool-mutation.md",
  approvalPath: "docs/phase3341-3391-controlled-forty-six-tool-mutation-approval.example.json",
  runnerPath: "tools/phase3341_3391/apply-controlled-forty-six-tool-mutation.mjs",
  verifierPath: "tools/phase3341_3391/validate-controlled-forty-six-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase3341-3391-controlled-forty-six-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase3341-3391-controlled-forty-six-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase3341-3391-controlled-forty-six-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase3341-3391-controlled-forty-six-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase3341-3391-controlled-forty-six-tool-mutation/forty-six-smoke.json",
  permissionMode: "controlled-forty-six-tool-source-mutation",
  label: "forty-six",
  runnerReadyField: "fortySixRunnerReady",
  appliedField: "fortySixMutationApplied",
  smokeField: "localFortySixSmokePassed",
  rollbackAction: "restore-previous-content-forty-six",
  verifyScript: "verify:phase3341-3391-controlled-forty-six-tool-mutation",
  applyScript: "apply:phase3341-3391-controlled-forty-six-tool-mutation",
  smokeScript: "smoke:phase3341-3391-controlled-forty-six-tool-mutation",
};`;
}

function previousPhaseMetaBlock() {
  return `const previousPhaseMeta = {
  phaseId: "Phase3291A-3340A-Controlled-Forty-Five-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase3291-3340-controlled-forty-five-tool-mutation/result.json",
  sealCheckId: "phase3340_sealed",
  sealCheckField: "fortyFiveMutationApplied",
  sealCheckBlocker: "phase3340_not_sealed",
};`;
}

function buildFortySixTargetsFunction(source) {
  const start = source.indexOf("function buildFortyFiveTargets(previousTargets) {");
  const end = source.indexOf("\nconst phase2091Checks = [", start);
  if (start < 0 || end < 0) throw new Error("missing_forty_five_targets_function");
  let fn = source.slice(start, end).trim();
  fn = replaceAll(fn, "buildFortyFiveTargets", "buildFortySixTargets");
  fn = replaceAll(fn, "FortyFive", "FortySix");
  fn = replaceAll(fn, "Forty-Five", "Forty-Six");
  fn = replaceAll(fn, "FORTY_FIVE", "FORTY_SIX");
  fn = replaceAll(fn, "fortyFive", "fortySix");
  fn = replaceAll(fn, "forty-five", "forty-six");
  fn = replaceOnce(fn, "const phase = 3295 + idx;", "const phase = 3345 + idx;");
  fn = replaceOnce(fn, "const previousRuntimeTarget = previousTargets[43];", "const previousRuntimeTarget = previousTargets[44];");
  fn = replaceOnce(fn, "const fortySixPhase = 3340;", "const fortySixPhase = 3391;");
  fn = replaceOnce(
    fn,
    'const fortySixMarker = "PHASE3340_FORTY_SIX_TOOL_TARGET_FORTY_SIX_OK";',
    'const fortySixMarker = "PHASE3391_FORTY_SIX_TOOL_TARGET_FORTY_SIX_OK";',
  );
  fn = replaceOnce(fn, "idx: 45,", "idx: 46,");
  fn = replaceOnce(fn, "path: sourceTargetPaths[44],", "path: sourceTargetPaths[45],");
  fn = replaceOnce(
    fn,
    'proposal: "docs/phase3340-forty-six-tool-mutation-target-forty-six.proposal.diff",',
    'proposal: "docs/phase3391-forty-six-tool-mutation-target-forty-six.proposal.diff",',
  );
  fn = replaceOnce(
    fn,
    'newExport: "buildPhase3340FortySixMutationRuntimeStatus",',
    'newExport: "buildPhase3391FortySixMutationRuntimeStatus",',
  );
  fn = replaceOnce(
    fn,
    'newPhaseId: "Phase3340A-Controlled-Forty-Six-Tool-Mutation-Target-Forty-Six",',
    'newPhaseId: "Phase3391A-Controlled-Forty-Six-Tool-Mutation-Target-Forty-Six",',
  );
  fn = replaceOnce(
    fn,
    'requiredExports: ["export function buildPhase3340FortySixMutationRuntimeStatus", "export function main"],',
    'requiredExports: ["export function buildPhase3391FortySixMutationRuntimeStatus", "export function main"],',
  );
  return fn;
}

function addAnchorMapEntries(text) {
  return replaceOnce(
    text,
    `      3297: "export function buildPhase3248FortyFourMutationTargetTwoStatus() {",
      3298: "export function buildPhase3249FortyFourMutationTargetThreeStatus() {",
      3299: "export function buildPhase3250FortyFourMutationTargetFourStatus() {",
      3300: "export function buildPhase3251FortyFourMutationTargetFiveStatus() {",`,
    `      3297: "export function buildPhase3248FortyFourMutationTargetTwoStatus() {",
      3298: "export function buildPhase3249FortyFourMutationTargetThreeStatus() {",
      3299: "export function buildPhase3250FortyFourMutationTargetFourStatus() {",
      3300: "export function buildPhase3251FortyFourMutationTargetFiveStatus() {",
      3347: "export function buildPhase3297FortyFiveMutationTargetTwoStatus() {",
      3348: "export function buildPhase3298FortyFiveMutationTargetThreeStatus() {",
      3349: "export function buildPhase3299FortyFiveMutationTargetFourStatus() {",
      3350: "export function buildPhase3300FortyFiveMutationTargetFiveStatus() {",`,
  );
}

function updateTail(tail) {
  tail = replaceOptional(tail, "Phase3291A-3340A-Controlled-Forty-Five-Tool-Mutation", "Phase3341A-3391A-Controlled-Forty-Six-Tool-Mutation");
  tail = replaceOptional(tail, "Phase3291A-3340A", "Phase3341A-3391A");
  tail = replaceOptional(tail, "phase3291-3340", "phase3341-3391");
  tail = replaceOptional(tail, "controlled-forty-five-tool-mutation", "controlled-forty-six-tool-mutation");
  tail = replaceOptional(tail, "Controlled Forty-Five Tool Mutation", "Controlled Forty-Six Tool Mutation");
  tail = replaceOptional(tail, "controlled forty-five tool mutation", "controlled forty-six tool mutation");
  tail = replaceOptional(tail, "forty-five tool mutation", "forty-six tool mutation");
  tail = replaceOptional(tail, "Forty-Five Tool", "Forty-Six Tool");
  tail = replaceOptional(tail, "forty-five-smoke.json", "forty-six-smoke.json");
  tail = replaceOptional(tail, "restore-previous-content-forty-five", "restore-previous-content-forty-six");
  tail = replaceOptional(tail, "controlled-forty-five-tool-source-mutation", "controlled-forty-six-tool-source-mutation");
  tail = replaceOptional(tail, "forty_five_mutation_node_check_or_smoke_failed", "forty_six_mutation_node_check_or_smoke_failed");
  tail = replaceOptional(tail, "fortyFiveRunnerReady", "fortySixRunnerReady");
  tail = replaceOptional(tail, "fortyFiveMutationApplied", "fortySixMutationApplied");
  tail = replaceOptional(tail, "localFortyFiveSmokePassed", "localFortySixSmokePassed");
  tail = replaceOptional(tail, "docs_mentions_forty_five", "docs_mentions_forty_six");
  tail = replaceOptional(tail, "changed_file_count_forty_five", "changed_file_count_forty_six");
  tail = replaceOptional(tail, "forty_five_mutation_applied", "forty_six_mutation_applied");
  tail = replaceOptional(tail, "rollback_restore_forty_five", "rollback_restore_forty_six");
  tail = replaceOptional(tail, "rollback_forty_five_entries", "rollback_forty_six_entries");
  tail = replaceOptional(tail, "fortyFiveMutationReady", "fortySixMutationReady");
  tail = replaceOptional(tail, "forty-five files", "forty-six files");
  tail = replaceOptional(tail, "forty-five-file", "forty-six-file");
  tail = replaceOptional(tail, "from forty-four files to forty-six files", "from forty-five files to forty-six files");
  tail = replaceOptional(tail, "from forty-four files to forty-five files", "from forty-five files to forty-six files");
  tail = replaceOptional(tail, "Requires Phase3242A-3290A sealed evidence.", "Requires Phase3291A-3340A sealed evidence.");
  tail = replaceOptional(tail, "Phase3242A-3290A seal", "Phase3291A-3340A seal");
  tail = replaceOptional(tail, "phase3290_sealed", "phase3340_sealed");
  tail = replaceOptional(tail, "phase3290_not_sealed", "phase3340_not_sealed");
  tail = replaceOptional(tail, "phase3290Sealed", "phase3340Sealed");
  tail = replaceOptional(tail, "phase3290", "phase3340");
  tail = replaceOptional(tail, "result.changedFileCount === 45", "result.changedFileCount === 46");
  tail = replaceOptional(tail, "rollback.files.length === 45", "rollback.files.length === 46");
  tail = replaceOptional(tail, "changedFileCount: result?.changedFileCount ?? 45", "changedFileCount: result?.changedFileCount ?? 46");
  tail = replaceOptional(tail, "expectedOperationCount: 45", "expectedOperationCount: 46");
  tail = replaceOptional(tail, "expectedMaxChangedFiles: 45", "expectedMaxChangedFiles: 46");
  tail = replaceOptional(tail, "maxChangedFiles: 45", "maxChangedFiles: 46");
  tail = replaceOptional(tail, "changedFileCount === 45", "changedFileCount === 46");
  tail = replaceOptional(tail, "exactly forty-five ", "exactly forty-six ");
  tail = replaceOptional(tail, "local forty-five smoke", "local forty-six smoke");
  tail = replaceOptional(tail, "support forty-five bounded local smoke commands", "support forty-six bounded local smoke commands");
  tail = replaceOptional(tail, "JSON smoke helper to forty-five commands", "JSON smoke helper to forty-six commands");
  tail = replaceOptional(tail, "Phase3296 through Phase3340", "Phase3346 through Phase3391");
  tail = replaceOptional(tail, "target-forty-five", "target-forty-six");
  tail = replaceOptional(tail, "FortyFiveMutation", "FortySixMutation");
  tail = replaceOptional(tail, "fortyFiveMutation", "fortySixMutation");
  tail = replaceOptional(tail, "Forty-Five Tool Mutation Evidence", "Forty-Six Tool Mutation Evidence");
  tail = replaceOptional(tail, "The forty-five mutation batch must prove", "The forty-six mutation batch must prove");
  tail = replaceOptional(tail, "forty-five target markers are not present", "forty-six target markers are not present");
  tail = replaceOptional(tail, "rollback replay audit batch or a forty-six-file bounded batch", "rollback replay audit batch or a forty-seven-file bounded batch");
  return tail;
}

async function main() {
  await mkdir(targetDir, { recursive: true });
  let text = await readFile(sourcePath, "utf8");

  text = text.replace(/const phaseMeta = \{[\s\S]*?\n\};/, phaseMetaBlock());
  text = text.replace(/const previousPhaseMeta = \{[\s\S]*?\n\};/, previousPhaseMetaBlock());
  text = replaceOnce(text, '  "FortyFive",\n];', '  "FortyFive",\n  "FortySix",\n];');
  text = replaceOnce(
    text,
    '  "tools/phase3242_3290/apply-controlled-forty-four-tool-mutation.mjs",\n];',
    '  "tools/phase3242_3290/apply-controlled-forty-four-tool-mutation.mjs",\n  "tools/phase3291_3340/apply-controlled-forty-five-tool-mutation.mjs",\n];',
  );
  text = replaceOnce(
    text,
    "const fortyThreeTargets = buildFortyThreeTargets(fortyTwoTargets);\nconst fortyFourTargets = buildFortyFourTargets(fortyThreeTargets);\nconst targets = buildFortyFiveTargets(fortyFourTargets);",
    "const fortyThreeTargets = buildFortyThreeTargets(fortyTwoTargets);\nconst fortyFourTargets = buildFortyFourTargets(fortyThreeTargets);\nconst fortyFiveTargets = buildFortyFiveTargets(fortyFourTargets);\nconst targets = buildFortySixTargets(fortyFiveTargets);",
  );
  text = replaceOnce(text, "\nconst phase2091Checks = [", `\n${buildFortySixTargetsFunction(text)}\n\nconst phase2091Checks = [`);
  text = addAnchorMapEntries(text);
  text = replaceOnce(text, "const tempDir = resolve(\"tmp/phase3291-3340-proposals\");", "const tempDir = resolve(\"tmp/phase3341-3391-proposals\");");

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
