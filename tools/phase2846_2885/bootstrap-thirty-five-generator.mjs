import { mkdir, readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase2807_2845/generate-thirty-four-phase-assets.mjs";
const targetDir = "tools/phase2846_2885";
const targetPath = `${targetDir}/generate-thirty-five-phase-assets.mjs`;

const from = {
  range: "2807-2845",
  phaseId: "Phase2807A-2845A-Controlled-Thirty-Four-Tool-Mutation",
  title: "Controlled Thirty-Four Tool Mutation",
  titleShort: "Thirty-Four",
  lowerTitle: "controlled thirty-four tool mutation",
  label: "thirty-four",
  labelCompact: "thirtyFour",
  labelSnake: "thirty_four",
  labelWords: "thirty four",
  count: 34,
  countWord: "thirty-four",
  countWordPrev: "thirty-three",
  sourceDir: "phase2807_2845",
  previousRange: "2769-2806",
  previousPhaseId: "Phase2769A-2806A-Controlled-Thirty-Three-Tool-Mutation",
  previousSealId: "phase2806_sealed",
  previousSealBlocker: "phase2806_not_sealed",
  previousSealVariable: "phase2806",
  previousAppliedField: "thirtyFourMutationApplied",
  previousEvidenceAppliedField: "thirtyFourMutationApplied",
  previousEvidencePath: "apps/ai-gateway-service/evidence/phase2807-2845-controlled-thirty-four-tool-mutation/result.json",
  previousSourcePath: "tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs",
  previousSourcePathLine: '  "tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs",',
  titleArrayEntry: '  "ThirtyFour",',
  targetsBuildLine: "const targets = buildThirtyFourTargets(thirtyThreeTargets);",
  tmpDir: "tmp/phase2807-2845-proposals",
  smokeFile: "thirty-four-smoke.json",
  rollbackAction: "restore-previous-content-thirty-four",
  permissionMode: "controlled-thirty-four-tool-source-mutation",
  nodeCheckBlocker: "thirty_four_mutation_node_check_or_smoke_failed",
  readyField: "thirtyFourRunnerReady",
  smokeField: "localThirtyFourSmokePassed",
  docsCheckId: "docs_mentions_thirty_four",
  changedCountCheckId: "changed_file_count_thirty_four",
  rollbackCheckId: "rollback_restore_thirty_four",
  rollbackEntriesCheckId: "rollback_thirty_four_entries",
  readySummaryField: "thirtyFourMutationReady",
  lastPhase: 2845,
  lastMarker: "PHASE2845_THIRTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK",
  lastExport: "buildPhase2845ThirtyFourMutationRuntimeStatus",
  lastSourceIndex: 33,
  lastWord: "thirty-four",
  lastTitleWord: "ThirtyFour",
};

const to = {
  range: "2846-2885",
  phaseId: "Phase2846A-2885A-Controlled-Thirty-Five-Tool-Mutation",
  title: "Controlled Thirty-Five Tool Mutation",
  titleShort: "Thirty-Five",
  lowerTitle: "controlled thirty-five tool mutation",
  label: "thirty-five",
  labelCompact: "thirtyFive",
  labelSnake: "thirty_five",
  labelWords: "thirty five",
  count: 35,
  countWord: "thirty-five",
  countWordPrev: "thirty-four",
  sourceDir: "phase2846_2885",
  previousRange: "2807-2845",
  previousPhaseId: "Phase2807A-2845A-Controlled-Thirty-Four-Tool-Mutation",
  previousSealId: "phase2845_sealed",
  previousSealBlocker: "phase2845_not_sealed",
  previousSealVariable: "phase2845",
  previousAppliedField: "thirtyFourMutationApplied",
  previousEvidenceAppliedField: "thirtyFourMutationApplied",
  previousEvidencePath: "apps/ai-gateway-service/evidence/phase2807-2845-controlled-thirty-four-tool-mutation/result.json",
  previousSourcePath: "tools/phase2807_2845/apply-controlled-thirty-four-tool-mutation.mjs",
  previousSourcePathLine: '  "tools/phase2807_2845/apply-controlled-thirty-four-tool-mutation.mjs",',
  titleArrayEntry: '  "ThirtyFive",',
  targetsBuildLine:
    "const thirtyFourTargets = buildThirtyFourTargets(thirtyThreeTargets);\nconst targets = buildThirtyFiveTargets(thirtyFourTargets);",
  tmpDir: "tmp/phase2846-2885-proposals",
  smokeFile: "thirty-five-smoke.json",
  rollbackAction: "restore-previous-content-thirty-five",
  permissionMode: "controlled-thirty-five-tool-source-mutation",
  nodeCheckBlocker: "thirty_five_mutation_node_check_or_smoke_failed",
  readyField: "thirtyFiveRunnerReady",
  appliedField: "thirtyFiveMutationApplied",
  smokeField: "localThirtyFiveSmokePassed",
  docsCheckId: "docs_mentions_thirty_five",
  changedCountCheckId: "changed_file_count_thirty_five",
  rollbackCheckId: "rollback_restore_thirty_five",
  rollbackEntriesCheckId: "rollback_thirty_five_entries",
  readySummaryField: "thirtyFiveMutationReady",
  startPhase: 2851,
  lastPhase: 2885,
  lastMarker: "PHASE2885_THIRTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK",
  lastExport: "buildPhase2885ThirtyFiveMutationRuntimeStatus",
  lastSourceIndex: 34,
  lastWord: "thirty-five",
  lastTitleWord: "ThirtyFive",
};

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
  phaseId: "${to.phaseId}",
  docPath: "docs/phase${to.range}-controlled-thirty-five-tool-mutation.md",
  approvalPath: "docs/phase${to.range}-controlled-thirty-five-tool-mutation-approval.example.json",
  runnerPath: "tools/${to.sourceDir}/apply-controlled-thirty-five-tool-mutation.mjs",
  verifierPath: "tools/${to.sourceDir}/validate-controlled-thirty-five-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase${to.range}-controlled-thirty-five-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase${to.range}-controlled-thirty-five-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase${to.range}-controlled-thirty-five-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase${to.range}-controlled-thirty-five-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase${to.range}-controlled-thirty-five-tool-mutation/${to.smokeFile}",
  permissionMode: "${to.permissionMode}",
  label: "${to.label}",
  runnerReadyField: "${to.readyField}",
  appliedField: "${to.appliedField}",
  smokeField: "${to.smokeField}",
  rollbackAction: "${to.rollbackAction}",
  verifyScript: "verify:phase${to.range}-controlled-thirty-five-tool-mutation",
  applyScript: "apply:phase${to.range}-controlled-thirty-five-tool-mutation",
  smokeScript: "smoke:phase${to.range}-controlled-thirty-five-tool-mutation",
};`;
}

function previousPhaseMetaBlock() {
  return `const previousPhaseMeta = {
  phaseId: "${to.previousPhaseId}",
  resultPath: "${to.previousEvidencePath}",
  sealCheckId: "${to.previousSealId}",
  sealCheckField: "${to.previousAppliedField}",
  sealCheckBlocker: "${to.previousSealBlocker}",
};`;
}

function buildThirtyFiveTargetsFunction() {
  return `function buildThirtyFiveTargets(previousTargets) {
  const upgraded = previousTargets.map((target) => {
    const idx = target.idx;
    const phase = ${to.startPhase - 1} + idx;
    const titleWord = titleWords[idx - 1];
    const word = wordNames[idx - 1];
    const marker = \`PHASE\${phase}_THIRTY_FIVE_TOOL_TARGET_\${word.replace(/-/g, "_").toUpperCase()}_OK\`;
    const previousMarkerField = \`phase\${target.phase}Marker\`;
    const next = {
      ...target,
      phase,
      word,
      targetName: \`target-\${word}\`,
      proposal: \`docs/phase\${phase}-thirty-five-tool-mutation-target-\${word}.proposal.diff\`,
      newExport: \`buildPhase\${phase}ThirtyFiveMutationTarget\${titleWord}Status\`,
      newPhaseId: \`Phase\${phase}A-Controlled-Thirty-Five-Tool-Mutation-Target-\${word.replace(/(^|-)([a-z])/g, (_, prefix, char) => \`\${prefix === "-" ? "-" : ""}\${char.toUpperCase()}\`)}\`,
      marker,
      referenceMarkers: [...target.referenceMarkers, target.marker],
      referenceFields: [...target.referenceFields, previousMarkerField],
      requiredExports:
        idx === 1
          ? [\`export function buildPhase\${phase}ThirtyFiveMutationTarget\${titleWord}Status\`]
          : [
              \`export function buildPhase\${phase}ThirtyFiveMutationTarget\${titleWord}Status\`,
              "export function main",
            ],
      requiredMarkers: [...new Set([...target.requiredMarkers, target.marker, marker])],
      runnerReady: false,
    };

    if (next.addMode === "phase2091-main") {
      next.mainProperty = \`phase\${phase}\`;
      next.runtimeBaseProperty = \`phase\${target.phase}\`;
      next.runtimeBaseExport = target.newExport;
    }

    if (next.addMode === "runtime-plus-export") {
      next.runtimeInsertAfterField = \`phase\${target.phase}Marker\`;
      next.runtimeInsertAfterMarker = target.marker;
      next.runtimeMarkerField = \`phase\${phase}Marker\`;
    }

    return next;
  });

  const previousRuntimeTarget = previousTargets[${from.count - 1}];
  const thirtyFivePhase = ${to.lastPhase};
  const thirtyFiveMarker = "${to.lastMarker}";
  upgraded.push({
    idx: ${to.count},
    phase: thirtyFivePhase,
    word: "${to.lastWord}",
    targetName: "target-${to.lastWord}",
    path: sourceTargetPaths[${to.lastSourceIndex}],
    proposal: "docs/phase${to.lastPhase}-thirty-five-tool-mutation-target-${to.lastWord}.proposal.diff",
    addMode: "append-export",
    newExport: "${to.lastExport}",
    newPhaseId: "Phase${to.lastPhase}A-Controlled-Thirty-Five-Tool-Mutation-Target-Thirty-Five",
    marker: thirtyFiveMarker,
    referenceMarkers: [...previousRuntimeTarget.referenceMarkers, previousRuntimeTarget.marker],
    referenceFields: [...previousRuntimeTarget.referenceFields, \`phase\${previousRuntimeTarget.phase}Marker\`],
    requiredExports: ["export function ${to.lastExport}", "export function main"],
    requiredMarkers: [...new Set([...previousRuntimeTarget.requiredMarkers, previousRuntimeTarget.marker, thirtyFiveMarker])],
    runnerReady: true,
  });

  return upgraded;
}`;
}

async function main() {
  await mkdir(targetDir, { recursive: true });
  let text = await readFile(sourcePath, "utf8");

  text = text.replace(/const phaseMeta = \{[\s\S]*?\n\};/, phaseMetaBlock());
  text = text.replace(/const previousPhaseMeta = \{[\s\S]*?\n\};/, previousPhaseMetaBlock());
  text = replaceOnce(text, `${from.titleArrayEntry}\n];`, `${from.titleArrayEntry}\n${to.titleArrayEntry}\n];`);
  text = replaceOnce(text, `${from.previousSourcePathLine}\n];`, `${from.previousSourcePathLine}\n${to.previousSourcePathLine}\n];`);
  text = replaceOnce(text, from.targetsBuildLine, to.targetsBuildLine);
  text = replaceOnce(text, "\nconst phase2091Checks = [", `\n${buildThirtyFiveTargetsFunction()}\n\nconst phase2091Checks = [`);

  text = replaceOnce(
    text,
    `      2813: "export function buildPhase2775ThirtyThreeMutationTargetTwoStatus() {",
      2814: "export function buildPhase2776ThirtyThreeMutationTargetThreeStatus() {",
      2815: "export function buildPhase2777ThirtyThreeMutationTargetFourStatus() {",
      2816: "export function buildPhase2778ThirtyThreeMutationTargetFiveStatus() {",
    };`,
    `      2813: "export function buildPhase2775ThirtyThreeMutationTargetTwoStatus() {",
      2814: "export function buildPhase2776ThirtyThreeMutationTargetThreeStatus() {",
      2815: "export function buildPhase2777ThirtyThreeMutationTargetFourStatus() {",
      2816: "export function buildPhase2778ThirtyThreeMutationTargetFiveStatus() {",
      2852: "export function buildPhase2813ThirtyFourMutationTargetTwoStatus() {",
      2853: "export function buildPhase2814ThirtyFourMutationTargetThreeStatus() {",
      2854: "export function buildPhase2815ThirtyFourMutationTargetFourStatus() {",
      2855: "export function buildPhase2816ThirtyFourMutationTargetFiveStatus() {",
    };`,
  );

  text = replaceOptional(text, from.tmpDir, to.tmpDir);

  const tailAnchor = "function buildDoc() {";
  const tailIndex = text.indexOf(tailAnchor);
  if (tailIndex < 0) throw new Error(`missing_tail_anchor:${tailAnchor}`);
  const head = text.slice(0, tailIndex);
  let tail = text.slice(tailIndex);

  tail = replaceOptional(tail, from.phaseId, to.phaseId);
  tail = replaceOptional(tail, `Phase${from.range}`, `Phase${to.range}`);
  tail = replaceAll(tail, `phase${from.range}`, `phase${to.range}`);
  tail = replaceAll(tail, from.title, to.title);
  tail = replaceOptional(tail, from.titleShort, to.titleShort);
  tail = replaceAll(tail, from.lowerTitle, to.lowerTitle);
  tail = replaceOptional(tail, from.smokeFile, to.smokeFile);
  tail = replaceOptional(tail, from.rollbackAction, to.rollbackAction);
  tail = replaceOptional(tail, from.permissionMode, to.permissionMode);
  tail = replaceOptional(tail, from.nodeCheckBlocker, to.nodeCheckBlocker);
  tail = replaceOptional(tail, from.readyField, to.readyField);
  tail = replaceOptional(tail, from.previousAppliedField, to.appliedField);
  tail = replaceOptional(tail, from.smokeField, to.smokeField);
  tail = replaceOptional(tail, from.docsCheckId, to.docsCheckId);
  tail = replaceOptional(tail, from.changedCountCheckId, to.changedCountCheckId);
  tail = replaceOptional(tail, from.rollbackCheckId, to.rollbackCheckId);
  tail = replaceOptional(tail, from.rollbackEntriesCheckId, to.rollbackEntriesCheckId);
  tail = replaceOptional(tail, from.readySummaryField, to.readySummaryField);
  tail = replaceOptional(tail, from.label, to.label);
  tail = replaceOptional(tail, "ThirtyFour", "ThirtyFive");
  tail = replaceOptional(tail, "THIRTY_FOUR", "THIRTY_FIVE");
  tail = replaceOptional(tail, "thirtyFour", "thirtyFive");
  tail = replaceOptional(tail, "thirty_four", "thirty_five");
  tail = replaceOptional(tail, "thirty four", "thirty five");
  tail = replaceOptional(tail, "from thirty-three files to thirty-five files", "from thirty-four files to thirty-five files");
  tail = replaceOptional(tail, "support thirty-five bounded local smoke commands", "support thirty-five bounded local smoke commands");
  tail = replaceOptional(tail, "The thirty-five mutation batch must prove:", "The thirty-five mutation batch must prove:");
  tail = replaceOptional(tail, "the thirty-five target markers are not present", "the thirty-five target markers are not present");
  tail = replaceOptional(tail, "Applies exactly thirty-five existing source-file mutations.", "Applies exactly thirty-five existing source-file mutations.");
  tail = replaceOptional(tail, "thirty-five-file bounded batch", "thirty-six-file bounded batch");
  tail = replaceOptional(tail, "Requires Phase2769A-2806A sealed evidence.", "Requires Phase2807A-2845A sealed evidence.");
  tail = replaceOptional(tail, "phase2806", to.previousSealVariable);
  tail = replaceOptional(tail, "phase2806_sealed", to.previousSealId);
  tail = replaceOptional(tail, "phase2806_not_sealed", to.previousSealBlocker);
  tail = replaceOptional(tail, "Phase2769A-2806A", "Phase2807A-2845A");
  tail = replaceOptional(tail, "phase2769-2806-controlled-thirty-three-tool-mutation", "phase2807-2845-controlled-thirty-four-tool-mutation");
  tail = replaceOptional(tail, "result.changedFileCount === 34", "result.changedFileCount === 35");
  tail = replaceOptional(tail, "rollback.files.length === 34", "rollback.files.length === 35");
  tail = replaceOptional(tail, "changedFileCount: result?.changedFileCount ?? 34", "changedFileCount: result?.changedFileCount ?? 35");
  tail = replaceOptional(tail, "expectedOperationCount: 34", "expectedOperationCount: 35");
  tail = replaceOptional(tail, "expectedMaxChangedFiles: 34", "expectedMaxChangedFiles: 35");
  tail = replaceOptional(tail, "maxChangedFiles: 34,", "maxChangedFiles: 35,");
  tail = replaceOptional(
    tail,
    "# Phase2807A-2845A Controlled Thirty-Five Tool Mutation",
    "# Phase2846A-2885A Controlled Thirty-Five Tool Mutation",
  );
  tail = replaceOptional(
    tail,
    "Phase2807A-2845A extends the controlled local mutation line",
    "Phase2846A-2885A extends the controlled local mutation line",
  );
  tail = replaceOptional(
    tail,
    "# Phase2807A-2845A Controlled Thirty-Five Tool Mutation Evidence",
    "# Phase2846A-2885A Controlled Thirty-Five Tool Mutation Evidence",
  );

  text = head + tail;

  text = text.replace(/const phaseMeta = \{[\s\S]*?\n\};/, phaseMetaBlock());
  text = text.replace(/const previousPhaseMeta = \{[\s\S]*?\n\};/, previousPhaseMetaBlock());

  await writeFile(targetPath, text, "utf8");
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
