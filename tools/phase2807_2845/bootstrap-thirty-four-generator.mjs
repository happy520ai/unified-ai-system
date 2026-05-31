import { mkdir, readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase2769_2806/generate-thirty-three-phase-assets.mjs";
const targetPath = "tools/phase2807_2845/generate-thirty-four-phase-assets.mjs";

function replaceOne(text, search, replacement) {
  if (!text.includes(search)) throw new Error(`missing_replace_target:${search}`);
  return text.replace(search, replacement);
}

function replaceRegex(text, regex, replacement, label) {
  if (!regex.test(text)) throw new Error(`missing_regex_target:${label}`);
  return text.replace(regex, replacement);
}

function replaceAll(text, search, replacement) {
  if (!text.includes(search)) throw new Error(`missing_replace_all_target:${search}`);
  return text.split(search).join(replacement);
}

function replaceAllIfPresent(text, search, replacement) {
  return text.includes(search) ? text.split(search).join(replacement) : text;
}

function phaseMetaBlock() {
  return `const phaseMeta = {
  phaseId: "Phase2807A-2845A-Controlled-Thirty-Four-Tool-Mutation",
  docPath: "docs/phase2807-2845-controlled-thirty-four-tool-mutation.md",
  approvalPath: "docs/phase2807-2845-controlled-thirty-four-tool-mutation-approval.example.json",
  runnerPath: "tools/phase2807_2845/apply-controlled-thirty-four-tool-mutation.mjs",
  verifierPath: "tools/phase2807_2845/validate-controlled-thirty-four-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase2807-2845-controlled-thirty-four-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2807-2845-controlled-thirty-four-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase2807-2845-controlled-thirty-four-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase2807-2845-controlled-thirty-four-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase2807-2845-controlled-thirty-four-tool-mutation/thirty-four-smoke.json",
  permissionMode: "controlled-thirty-four-tool-source-mutation",
  label: "thirty-four",
  runnerReadyField: "thirtyFourRunnerReady",
  appliedField: "thirtyFourMutationApplied",
  smokeField: "localThirtyFourSmokePassed",
  rollbackAction: "restore-previous-content-thirty-four",
  verifyScript: "verify:phase2807-2845-controlled-thirty-four-tool-mutation",
  applyScript: "apply:phase2807-2845-controlled-thirty-four-tool-mutation",
  smokeScript: "smoke:phase2807-2845-controlled-thirty-four-tool-mutation",
};`;
}

function previousPhaseMetaBlock() {
  return `const previousPhaseMeta = {
  phaseId: "Phase2769A-2806A-Controlled-Thirty-Three-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2769-2806-controlled-thirty-three-tool-mutation/result.json",
  sealCheckId: "phase2806_sealed",
  sealCheckField: "thirtyThreeMutationApplied",
  sealCheckBlocker: "phase2806_not_sealed",
};`;
}

function buildThirtyFourTargetsFunction() {
  return `function buildThirtyFourTargets(previousTargets) {
  const upgraded = previousTargets.map((target) => {
    const idx = target.idx;
    const phase = 2811 + idx;
    const titleWord = titleWords[idx - 1];
    const word = wordNames[idx - 1];
    const marker = \`PHASE\${phase}_THIRTY_FOUR_TOOL_TARGET_\${word.replace(/-/g, "_").toUpperCase()}_OK\`;
    const previousMarkerField = \`phase\${target.phase}Marker\`;
    const next = {
      ...target,
      phase,
      word,
      targetName: \`target-\${word}\`,
      proposal: \`docs/phase\${phase}-thirty-four-tool-mutation-target-\${word}.proposal.diff\`,
      newExport: \`buildPhase\${phase}ThirtyFourMutationTarget\${titleWord}Status\`,
      newPhaseId: \`Phase\${phase}A-Controlled-Thirty-Four-Tool-Mutation-Target-\${word.replace(/(^|-)([a-z])/g, (_, prefix, char) => \`\${prefix === "-" ? "-" : ""}\${char.toUpperCase()}\`)}\`,
      marker,
      referenceMarkers: [...target.referenceMarkers, target.marker],
      referenceFields: [...target.referenceFields, previousMarkerField],
      requiredExports:
        idx === 1
          ? [\`export function buildPhase\${phase}ThirtyFourMutationTarget\${titleWord}Status\`]
          : [
              \`export function buildPhase\${phase}ThirtyFourMutationTarget\${titleWord}Status\`,
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

  const previousRuntimeTarget = previousTargets[32];
  const thirtyFourPhase = 2845;
  const thirtyFourMarker = "PHASE2845_THIRTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK";
  upgraded.push({
    idx: 34,
    phase: thirtyFourPhase,
    word: "thirty-four",
    targetName: "target-thirty-four",
    path: sourceTargetPaths[33],
    proposal: "docs/phase2845-thirty-four-tool-mutation-target-thirty-four.proposal.diff",
    addMode: "append-export",
    newExport: "buildPhase2845ThirtyFourMutationRuntimeStatus",
    newPhaseId: "Phase2845A-Controlled-Thirty-Four-Tool-Mutation-Target-Thirty-Four",
    marker: thirtyFourMarker,
    referenceMarkers: [...previousRuntimeTarget.referenceMarkers, previousRuntimeTarget.marker],
    referenceFields: [...previousRuntimeTarget.referenceFields, \`phase\${previousRuntimeTarget.phase}Marker\`],
    requiredExports: ["export function buildPhase2845ThirtyFourMutationRuntimeStatus", "export function main"],
    requiredMarkers: [...new Set([...previousRuntimeTarget.requiredMarkers, previousRuntimeTarget.marker, thirtyFourMarker])],
    runnerReady: true,
  });

  return upgraded;
}`;
}

async function main() {
  await mkdir("tools/phase2807_2845", { recursive: true });
  let text = await readFile(sourcePath, "utf8");

  text = replaceRegex(text, /const phaseMeta = \{[\s\S]*?\n\};/, phaseMetaBlock(), "phaseMeta");
  text = replaceRegex(text, /const previousPhaseMeta = \{[\s\S]*?\n\};/, previousPhaseMetaBlock(), "previousPhaseMeta");

  text = replaceOne(text, `  "ThirtyThree",
];`, `  "ThirtyThree",
  "ThirtyFour",
];`);

  text = replaceOne(
    text,
    `  "tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs",
];`,
    `  "tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs",
  "tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs",
];`,
  );

  text = replaceOne(
    text,
    `const thirtyOneTargets = buildThirtyOneTargets(thirtyTargets);
const thirtyTwoTargets = buildThirtyTwoTargets(thirtyOneTargets);
const targets = buildThirtyThreeTargets(thirtyTwoTargets);
`,
    `const thirtyOneTargets = buildThirtyOneTargets(thirtyTargets);
const thirtyTwoTargets = buildThirtyTwoTargets(thirtyOneTargets);
const thirtyThreeTargets = buildThirtyThreeTargets(thirtyTwoTargets);
const targets = buildThirtyFourTargets(thirtyThreeTargets);
`,
  );

  text = replaceOne(text, `\nconst phase2091Checks = [`, `\n${buildThirtyFourTargetsFunction()}\n\nconst phase2091Checks = [`);

  text = replaceOne(
    text,
    `      2775: "export function buildPhase2738ThirtyTwoMutationTargetTwoStatus() {",
      2776: "export function buildPhase2739ThirtyTwoMutationTargetThreeStatus() {",
      2777: "export function buildPhase2740ThirtyTwoMutationTargetFourStatus() {",
      2778: "export function buildPhase2741ThirtyTwoMutationTargetFiveStatus() {",
    };`,
    `      2775: "export function buildPhase2738ThirtyTwoMutationTargetTwoStatus() {",
      2776: "export function buildPhase2739ThirtyTwoMutationTargetThreeStatus() {",
      2777: "export function buildPhase2740ThirtyTwoMutationTargetFourStatus() {",
      2778: "export function buildPhase2741ThirtyTwoMutationTargetFiveStatus() {",
      2813: "export function buildPhase2775ThirtyThreeMutationTargetTwoStatus() {",
      2814: "export function buildPhase2776ThirtyThreeMutationTargetThreeStatus() {",
      2815: "export function buildPhase2777ThirtyThreeMutationTargetFourStatus() {",
      2816: "export function buildPhase2778ThirtyThreeMutationTargetFiveStatus() {",
    };`,
  );

  text = replaceAll(text, "tmp/phase2769-2806-proposals", "tmp/phase2807-2845-proposals");
  text = replaceAllIfPresent(
    text,
    "Phase2769A-2806A Controlled Thirty-Three Tool Mutation Evidence",
    "Phase2807A-2845A Controlled Thirty-Four Tool Mutation Evidence",
  );
  text = replaceAll(text, "Phase2769A-2806A Controlled Thirty-Three Tool Mutation", "Phase2807A-2845A Controlled Thirty-Four Tool Mutation");
  text = replaceAll(text, "phase2769-2806-controlled-thirty-three-tool-mutation", "phase2807-2845-controlled-thirty-four-tool-mutation");
  text = replaceAllIfPresent(text, "verify:phase2769-2806-controlled-thirty-three-tool-mutation", "verify:phase2807-2845-controlled-thirty-four-tool-mutation");
  text = replaceAllIfPresent(text, "apply:phase2769-2806-controlled-thirty-three-tool-mutation", "apply:phase2807-2845-controlled-thirty-four-tool-mutation");
  text = replaceAllIfPresent(text, "smoke:phase2769-2806-controlled-thirty-three-tool-mutation", "smoke:phase2807-2845-controlled-thirty-four-tool-mutation");

  text = replaceAllIfPresent(
    text,
    "Phase2769A-2806A extends the controlled local mutation line from thirty-two files to thirty-three files",
    "Phase2807A-2845A extends the controlled local mutation line from thirty-three files to thirty-four files",
  );
  text = replaceAllIfPresent(text, "from thirty-two files to thirty-three files", "from thirty-three files to thirty-four files");
  text = replaceAll(text, "support thirty-three bounded local smoke commands", "support thirty-four bounded local smoke commands");
  text = replaceAll(text, "The thirty-three mutation batch must prove:", "The thirty-four mutation batch must prove:");
  text = replaceAll(text, "the thirty-three target markers are not present", "the thirty-four target markers are not present");
  text = replaceAllIfPresent(text, "- Applies exactly thirty-three existing source-file mutations.", "- Applies exactly thirty-four existing source-file mutations.");
  text = replaceAllIfPresent(text, "current **controlled thirty-three tool mutation** batch", "current **controlled thirty-four tool mutation** batch");
  text = replaceAllIfPresent(text, "runs local thirty-three smoke", "runs local thirty-four smoke");
  text = replaceAllIfPresent(text, "local thirty-three smoke", "local thirty-four smoke");
  text = replaceAllIfPresent(text, "thirty-four-file bounded batch", "thirty-five-file bounded batch");

  text = replaceAllIfPresent(text, "thirtyThreeMutationApplied", "thirtyFourMutationApplied");
  text = replaceAllIfPresent(text, "localThirtyThreeSmokePassed", "localThirtyFourSmokePassed");
  text = replaceAllIfPresent(text, "thirtyThreeRunnerReady", "thirtyFourRunnerReady");
  text = replaceAllIfPresent(text, "restore-previous-content-thirty-three", "restore-previous-content-thirty-four");
  text = replaceAllIfPresent(text, "thirty-three-smoke.json", "thirty-four-smoke.json");
  text = replaceAllIfPresent(text, "controlled-thirty-three-tool-source-mutation", "controlled-thirty-four-tool-source-mutation");
  text = replaceAllIfPresent(text, "changed_file_count_thirty_three", "changed_file_count_thirty_four");
  text = replaceAllIfPresent(text, "rollback_restore_thirty_three", "rollback_restore_thirty_four");
  text = replaceAllIfPresent(text, "rollback_thirty_three_entries", "rollback_thirty_four_entries");
  text = replaceAllIfPresent(text, "docs_mentions_thirty_three", "docs_mentions_thirty_four");
  text = replaceAllIfPresent(text, "thirty_three_mutation_applied", "thirty_four_mutation_applied");
  text = replaceAllIfPresent(text, "thirtyThreeMutationReady", "thirtyFourMutationReady");
  text = replaceAllIfPresent(text, 'docs.includes("controlled thirty-three tool mutation")', 'docs.includes("controlled thirty-four tool mutation")');
  text = replaceAllIfPresent(text, '"thirty_three_mutation_node_check_or_smoke_failed"', '"thirty_four_mutation_node_check_or_smoke_failed"');

  text = replaceAllIfPresent(text, "result.changedFileCount === 33", "result.changedFileCount === 34");
  text = replaceAllIfPresent(text, "rollback.files.length === 33", "rollback.files.length === 34");
  text = replaceAllIfPresent(text, "changedFileCount: result?.changedFileCount ?? 33", "changedFileCount: result?.changedFileCount ?? 34");
  text = replaceAllIfPresent(text, "expectedOperationCount: 33", "expectedOperationCount: 34");
  text = replaceAllIfPresent(text, "expectedMaxChangedFiles: 33", "expectedMaxChangedFiles: 34");
  text = replaceAllIfPresent(text, "maxChangedFiles: 33,", "maxChangedFiles: 34,");

  text = replaceAllIfPresent(text, "const phase2768 = readJson(\"${previousPhaseMeta.resultPath}\") || {};", "const phase2806 = readJson(\"${previousPhaseMeta.resultPath}\") || {};");
  text = replaceAllIfPresent(text, "phase2768.recommendedSealed", "phase2806.recommendedSealed");
  text = replaceAllIfPresent(text, "phase2768.${previousPhaseMeta.sealCheckField}", "phase2806.${previousPhaseMeta.sealCheckField}");
  text = replaceAllIfPresent(text, "phase2768Sealed", "phase2806Sealed");
  text = replaceAllIfPresent(text, "phase2768_sealed", "phase2806_sealed");
  text = replaceAllIfPresent(text, "phase2768_not_sealed", "phase2806_not_sealed");
  text = replaceAllIfPresent(text, "- Requires Phase2732A-2768A sealed evidence.", "- Requires Phase2769A-2806A sealed evidence.");

  text = replaceRegex(text, /const phaseMeta = \{[\s\S]*?\n\};/, phaseMetaBlock(), "phaseMeta-final");
  text = replaceRegex(text, /const previousPhaseMeta = \{[\s\S]*?\n\};/, previousPhaseMetaBlock(), "previousPhaseMeta-final");

  await writeFile(targetPath, text, "utf8");
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
