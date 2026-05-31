import { mkdir, readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase3101_3146/generate-forty-one-phase-assets.mjs";
const targetDir = "tools/phase3147_3193";
const targetPath = `${targetDir}/generate-forty-two-phase-assets.mjs`;

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
  phaseId: "Phase3147A-3193A-Controlled-Forty-Two-Tool-Mutation",
  docPath: "docs/phase3147-3193-controlled-forty-two-tool-mutation.md",
  approvalPath: "docs/phase3147-3193-controlled-forty-two-tool-mutation-approval.example.json",
  runnerPath: "tools/phase3147_3193/apply-controlled-forty-two-tool-mutation.mjs",
  verifierPath: "tools/phase3147_3193/validate-controlled-forty-two-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase3147-3193-controlled-forty-two-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase3147-3193-controlled-forty-two-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase3147-3193-controlled-forty-two-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase3147-3193-controlled-forty-two-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase3147-3193-controlled-forty-two-tool-mutation/forty-two-smoke.json",
  permissionMode: "controlled-forty-two-tool-source-mutation",
  label: "forty-two",
  runnerReadyField: "fortyTwoRunnerReady",
  appliedField: "fortyTwoMutationApplied",
  smokeField: "localFortyTwoSmokePassed",
  rollbackAction: "restore-previous-content-forty-two",
  verifyScript: "verify:phase3147-3193-controlled-forty-two-tool-mutation",
  applyScript: "apply:phase3147-3193-controlled-forty-two-tool-mutation",
  smokeScript: "smoke:phase3147-3193-controlled-forty-two-tool-mutation",
};`;
}

function previousPhaseMetaBlock() {
  return `const previousPhaseMeta = {
  phaseId: "Phase3101A-3146A-Controlled-Forty-One-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase3101-3146-controlled-forty-one-tool-mutation/result.json",
  sealCheckId: "phase3146_sealed",
  sealCheckField: "fortyOneMutationApplied",
  sealCheckBlocker: "phase3146_not_sealed",
};`;
}

function buildFortyTwoTargetsFunction(source) {
  const start = source.indexOf("function buildFortyOneTargets(previousTargets) {");
  const end = source.indexOf("\nconst phase2091Checks = [", start);
  if (start < 0 || end < 0) throw new Error("missing_forty_one_targets_function");
  let fn = source.slice(start, end).trim();
  fn = replaceAll(fn, "buildFortyOneTargets", "buildFortyTwoTargets");
  fn = replaceAll(fn, "FortyOne", "FortyTwo");
  fn = replaceAll(fn, "Forty-One", "Forty-Two");
  fn = replaceAll(fn, "FORTY_ONE", "FORTY_TWO");
  fn = replaceAll(fn, "fortyOne", "fortyTwo");
  fn = replaceAll(fn, "forty-one", "forty-two");
  fn = replaceOptional(fn, "Controlled-Forty-Two-Tool", "Controlled-Forty-Two-Tool");
  fn = replaceOnce(fn, "const phase = 3105 + idx;", "const phase = 3151 + idx;");
  fn = replaceOnce(fn, "const previousRuntimeTarget = previousTargets[39];", "const previousRuntimeTarget = previousTargets[40];");
  fn = replaceOnce(fn, "const fortyTwoPhase = 3146;", "const fortyTwoPhase = 3193;");
  fn = replaceOnce(
    fn,
    'const fortyTwoMarker = "PHASE3146_FORTY_TWO_TOOL_TARGET_FORTY_TWO_OK";',
    'const fortyTwoMarker = "PHASE3193_FORTY_TWO_TOOL_TARGET_FORTY_TWO_OK";',
  );
  fn = replaceOnce(fn, "idx: 41,", "idx: 42,");
  fn = replaceOnce(fn, "phase: fortyTwoPhase,", "phase: fortyTwoPhase,");
  fn = replaceOnce(fn, "path: sourceTargetPaths[40],", "path: sourceTargetPaths[41],");
  fn = replaceOnce(
    fn,
    'proposal: "docs/phase3146-forty-two-tool-mutation-target-forty-two.proposal.diff",',
    'proposal: "docs/phase3193-forty-two-tool-mutation-target-forty-two.proposal.diff",',
  );
  fn = replaceOnce(
    fn,
    'newExport: "buildPhase3146FortyTwoMutationRuntimeStatus",',
    'newExport: "buildPhase3193FortyTwoMutationRuntimeStatus",',
  );
  fn = replaceOnce(
    fn,
    'newPhaseId: "Phase3146A-Controlled-Forty-Two-Tool-Mutation-Target-Forty-Two",',
    'newPhaseId: "Phase3193A-Controlled-Forty-Two-Tool-Mutation-Target-Forty-Two",',
  );
  fn = replaceOnce(
    fn,
    'requiredExports: ["export function buildPhase3146FortyTwoMutationRuntimeStatus", "export function main"],',
    'requiredExports: ["export function buildPhase3193FortyTwoMutationRuntimeStatus", "export function main"],',
  );
  return fn;
}

function addAnchorMapEntries(text) {
  return replaceOnce(
    text,
    `      3107: "export function buildPhase3062FortyMutationTargetTwoStatus() {",
      3108: "export function buildPhase3063FortyMutationTargetThreeStatus() {",
      3109: "export function buildPhase3064FortyMutationTargetFourStatus() {",
      3110: "export function buildPhase3065FortyMutationTargetFiveStatus() {",`,
    `      3107: "export function buildPhase3062FortyMutationTargetTwoStatus() {",
      3108: "export function buildPhase3063FortyMutationTargetThreeStatus() {",
      3109: "export function buildPhase3064FortyMutationTargetFourStatus() {",
      3110: "export function buildPhase3065FortyMutationTargetFiveStatus() {",
      3153: "export function buildPhase3107FortyOneMutationTargetTwoStatus() {",
      3154: "export function buildPhase3108FortyOneMutationTargetThreeStatus() {",
      3155: "export function buildPhase3109FortyOneMutationTargetFourStatus() {",
      3156: "export function buildPhase3110FortyOneMutationTargetFiveStatus() {",`,
  );
}

function addPackageScriptUpdater(text) {
  const helper = `
async function updatePackageScripts() {
  const packageText = await readText("package.json");
  const packageJson = JSON.parse(packageText);
  packageJson.scripts = packageJson.scripts || {};
  const smokeScript = smokeSpec
    .map((entry) => {
      if (entry.command === "node" && entry.args[0] === "-e") {
        return \`node -e "\${entry.args[1].replace(/"/g, '\\\\"')}"\`;
      }
      return [entry.command, ...entry.args].join(" ");
    })
    .join(" && ");
  packageJson.scripts[phaseMeta.applyScript] = \`node \${phaseMeta.runnerPath} --plan \${phaseMeta.approvalPath}\`;
  packageJson.scripts[phaseMeta.smokeScript] = smokeScript;
  packageJson.scripts[phaseMeta.verifyScript] = \`node \${phaseMeta.verifierPath}\`;
  await writeText("package.json", \`\${JSON.stringify(packageJson, null, 2)}\\n\`);
}
`;
  return replaceOnce(text, "\nasync function main() {", `${helper}\nasync function main() {`);
}

function updateTail(tail) {
  tail = replaceOptional(tail, "Phase3101A-3146A-Controlled-Forty-One-Tool-Mutation", "Phase3147A-3193A-Controlled-Forty-Two-Tool-Mutation");
  tail = replaceOptional(tail, "Phase3101A-3146A", "Phase3147A-3193A");
  tail = replaceOptional(tail, "phase3101-3146", "phase3147-3193");
  tail = replaceOptional(tail, "controlled-forty-one-tool-mutation", "controlled-forty-two-tool-mutation");
  tail = replaceOptional(tail, "Controlled Forty-One Tool Mutation", "Controlled Forty-Two Tool Mutation");
  tail = replaceOptional(tail, "controlled forty-one tool mutation", "controlled forty-two tool mutation");
  tail = replaceOptional(tail, "forty-one tool mutation", "forty-two tool mutation");
  tail = replaceOptional(tail, "Forty-One Tool", "Forty-Two Tool");
  tail = replaceOptional(tail, "forty-one-smoke.json", "forty-two-smoke.json");
  tail = replaceOptional(tail, "restore-previous-content-forty-one", "restore-previous-content-forty-two");
  tail = replaceOptional(tail, "controlled-forty-one-tool-source-mutation", "controlled-forty-two-tool-source-mutation");
  tail = replaceOptional(tail, "forty_one_mutation_node_check_or_smoke_failed", "forty_two_mutation_node_check_or_smoke_failed");
  tail = replaceOptional(tail, "fortyOneRunnerReady", "fortyTwoRunnerReady");
  tail = replaceOptional(tail, "fortyOneMutationApplied", "fortyTwoMutationApplied");
  tail = replaceOptional(tail, "localFortyOneSmokePassed", "localFortyTwoSmokePassed");
  tail = replaceOptional(tail, "docs_mentions_forty_one", "docs_mentions_forty_two");
  tail = replaceOptional(tail, "changed_file_count_forty_one", "changed_file_count_forty_two");
  tail = replaceOptional(tail, "forty_mutation_applied", "forty_two_mutation_applied");
  tail = replaceOptional(tail, "rollback_restore_forty_one", "rollback_restore_forty_two");
  tail = replaceOptional(tail, "rollback_forty_one_entries", "rollback_forty_two_entries");
  tail = replaceOptional(tail, "fortyOneMutationReady", "fortyTwoMutationReady");
  tail = replaceOptional(tail, "forty-one files", "forty-two files");
  tail = replaceOptional(tail, "forty-one-file", "forty-two-file");
  tail = replaceOptional(tail, "from forty files to forty-two files", "from forty-one files to forty-two files");
  tail = replaceOptional(tail, "from forty files to forty-one files", "from forty-one files to forty-two files");
  tail = replaceOptional(tail, "Requires Phase3056A-3100A sealed evidence.", "Requires Phase3101A-3146A sealed evidence.");
  tail = replaceOptional(tail, "Phase3056A-3100A seal", "Phase3101A-3146A seal");
  tail = replaceOptional(tail, "phase3100_sealed", "phase3146_sealed");
  tail = replaceOptional(tail, "phase3100_not_sealed", "phase3146_not_sealed");
  tail = replaceOptional(tail, "phase3100Sealed", "phase3146Sealed");
  tail = replaceOptional(tail, "phase3100", "phase3146");
  tail = replaceOptional(tail, "fortyMutationApplied", "fortyOneMutationApplied");
  tail = replaceOptional(tail, "result.changedFileCount === 41", "result.changedFileCount === 42");
  tail = replaceOptional(tail, "rollback.files.length === 41", "rollback.files.length === 42");
  tail = replaceOptional(tail, "changedFileCount: result?.changedFileCount ?? 41", "changedFileCount: result?.changedFileCount ?? 42");
  tail = replaceOptional(tail, "expectedOperationCount: 41", "expectedOperationCount: 42");
  tail = replaceOptional(tail, "expectedMaxChangedFiles: 41", "expectedMaxChangedFiles: 42");
  tail = replaceOptional(tail, "maxChangedFiles: 41", "maxChangedFiles: 42");
  tail = replaceOptional(tail, "changedFileCount === 41", "changedFileCount === 42");
  tail = replaceOptional(tail, "rollback.files.length === 41", "rollback.files.length === 42");
  tail = replaceOptional(tail, "rollback.files.length === 42", "rollback.files.length === 42");
  tail = replaceOptional(tail, "exactly forty-one ", "exactly forty-two ");
  tail = replaceOptional(tail, "local forty-one smoke", "local forty-two smoke");
  tail = replaceOptional(tail, "support forty bounded local smoke commands", "support forty-two bounded local smoke commands");
  tail = replaceOptional(tail, "JSON smoke helper to forty-one commands", "JSON smoke helper to forty-two commands");
  tail = replaceOptional(tail, "Phase3106 through Phase3146", "Phase3152 through Phase3193");
  tail = replaceOptional(tail, "target-forty-one", "target-forty-two");
  tail = replaceOptional(tail, "FortyOneMutation", "FortyTwoMutation");
  tail = replaceOptional(tail, "fortyOneMutation", "fortyTwoMutation");
  tail = replaceOptional(tail, "Forty-One Tool Mutation Evidence", "Forty-Two Tool Mutation Evidence");
  tail = replaceOptional(tail, "The forty mutation batch must prove", "The forty-two mutation batch must prove");
  tail = replaceOptional(tail, "forty target markers are not present", "forty-two target markers are not present");
  tail = replaceOptional(tail, "rollback replay audit batch or a forty-two-file bounded batch", "rollback replay audit batch or a forty-three-file bounded batch");
  return tail;
}

async function main() {
  await mkdir(targetDir, { recursive: true });
  let text = await readFile(sourcePath, "utf8");

  text = text.replace(/const phaseMeta = \{[\s\S]*?\n\};/, phaseMetaBlock());
  text = text.replace(/const previousPhaseMeta = \{[\s\S]*?\n\};/, previousPhaseMetaBlock());
  text = replaceOnce(text, '  "FortyOne",\n];', '  "FortyOne",\n  "FortyTwo",\n];');
  text = replaceOnce(
    text,
    '  "tools/phase3056_3100/apply-controlled-forty-tool-mutation.mjs",\n];',
    '  "tools/phase3056_3100/apply-controlled-forty-tool-mutation.mjs",\n  "tools/phase3101_3146/apply-controlled-forty-one-tool-mutation.mjs",\n];',
  );
  text = replaceOnce(
    text,
    "const fortyTargets = buildFortyTargets(thirtyNineTargets);\nconst targets = buildFortyOneTargets(fortyTargets);",
    "const fortyTargets = buildFortyTargets(thirtyNineTargets);\nconst fortyOneTargets = buildFortyOneTargets(fortyTargets);\nconst targets = buildFortyTwoTargets(fortyOneTargets);",
  );
  text = replaceOnce(text, "\nconst phase2091Checks = [", `\n${buildFortyTwoTargetsFunction(text)}\n\nconst phase2091Checks = [`);
  text = addAnchorMapEntries(text);
  text = replaceOnce(text, "const tempDir = resolve(\"tmp/phase3101-3146-proposals\");", "const tempDir = resolve(\"tmp/phase3147-3193-proposals\");");

  const tailAnchor = "function buildDoc() {";
  const tailIndex = text.indexOf(tailAnchor);
  if (tailIndex < 0) throw new Error(`missing_tail_anchor:${tailAnchor}`);
  const head = text.slice(0, tailIndex);
  const tail = updateTail(text.slice(tailIndex));
  text = head + tail;
  text = addPackageScriptUpdater(text);
  text = replaceOnce(
    text,
    "  await writeText(phaseMeta.verifierPath, buildVerifierTemplate());\n",
    "  await writeText(phaseMeta.verifierPath, buildVerifierTemplate());\n  await updatePackageScripts();\n",
  );
  text = text.replace(/const phaseMeta = \{[\s\S]*?\n\};/, phaseMetaBlock());
  text = text.replace(/const previousPhaseMeta = \{[\s\S]*?\n\};/, previousPhaseMetaBlock());

  await writeFile(targetPath, text, "utf8");
  console.log(JSON.stringify({ status: "pass", targetPath }, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
