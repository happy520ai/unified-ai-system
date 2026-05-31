import { mkdir, readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase2732_2768/generate-thirty-two-phase-assets.mjs";
const targetPath = "tools/phase2769_2806/generate-thirty-three-phase-assets.mjs";

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
  phaseId: "Phase2769A-2806A-Controlled-Thirty-Three-Tool-Mutation",
  docPath: "docs/phase2769-2806-controlled-thirty-three-tool-mutation.md",
  approvalPath: "docs/phase2769-2806-controlled-thirty-three-tool-mutation-approval.example.json",
  runnerPath: "tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs",
  verifierPath: "tools/phase2769_2806/validate-controlled-thirty-three-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase2769-2806-controlled-thirty-three-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2769-2806-controlled-thirty-three-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase2769-2806-controlled-thirty-three-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase2769-2806-controlled-thirty-three-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase2769-2806-controlled-thirty-three-tool-mutation/thirty-three-smoke.json",
  permissionMode: "controlled-thirty-three-tool-source-mutation",
  label: "thirty-three",
  runnerReadyField: "thirtyThreeRunnerReady",
  appliedField: "thirtyThreeMutationApplied",
  smokeField: "localThirtyThreeSmokePassed",
  rollbackAction: "restore-previous-content-thirty-three",
  verifyScript: "verify:phase2769-2806-controlled-thirty-three-tool-mutation",
  applyScript: "apply:phase2769-2806-controlled-thirty-three-tool-mutation",
  smokeScript: "smoke:phase2769-2806-controlled-thirty-three-tool-mutation",
};`;
}

function previousPhaseMetaBlock() {
  return `const previousPhaseMeta = {
  phaseId: "Phase2732A-2768A-Controlled-Thirty-Two-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2732-2768-controlled-thirty-two-tool-mutation/result.json",
  sealCheckId: "phase2768_sealed",
  sealCheckField: "thirtyTwoMutationApplied",
  sealCheckBlocker: "phase2768_not_sealed",
};`;
}

function buildThirtyThreeTargetsFunction() {
  return `function buildThirtyThreeTargets(previousTargets) {
  const upgraded = previousTargets.map((target) => {
    const idx = target.idx;
    const phase = 2773 + idx;
    const titleWord = titleWords[idx - 1];
    const word = wordNames[idx - 1];
    const marker = \`PHASE\${phase}_THIRTY_THREE_TOOL_TARGET_\${word.replace(/-/g, "_").toUpperCase()}_OK\`;
    const previousMarkerField = \`phase\${target.phase}Marker\`;
    const next = {
      ...target,
      phase,
      word,
      targetName: \`target-\${word}\`,
      proposal: \`docs/phase\${phase}-thirty-three-tool-mutation-target-\${word}.proposal.diff\`,
      newExport: \`buildPhase\${phase}ThirtyThreeMutationTarget\${titleWord}Status\`,
      newPhaseId: \`Phase\${phase}A-Controlled-Thirty-Three-Tool-Mutation-Target-\${word.replace(/(^|-)([a-z])/g, (_, prefix, char) => \`\${prefix === "-" ? "-" : ""}\${char.toUpperCase()}\`)}\`,
      marker,
      referenceMarkers: [...target.referenceMarkers, target.marker],
      referenceFields: [...target.referenceFields, previousMarkerField],
      requiredExports:
        idx === 1
          ? [\`export function buildPhase\${phase}ThirtyThreeMutationTarget\${titleWord}Status\`]
          : [
              \`export function buildPhase\${phase}ThirtyThreeMutationTarget\${titleWord}Status\`,
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

  const previousRuntimeTarget = previousTargets[31];
  const thirtyThreePhase = 2806;
  const thirtyThreeMarker = "PHASE2806_THIRTY_THREE_TOOL_TARGET_THIRTY_THREE_OK";
  upgraded.push({
    idx: 33,
    phase: thirtyThreePhase,
    word: "thirty-three",
    targetName: "target-thirty-three",
    path: sourceTargetPaths[32],
    proposal: "docs/phase2806-thirty-three-tool-mutation-target-thirty-three.proposal.diff",
    addMode: "append-export",
    newExport: "buildPhase2806ThirtyThreeMutationRuntimeStatus",
    newPhaseId: "Phase2806A-Controlled-Thirty-Three-Tool-Mutation-Target-Thirty-Three",
    marker: thirtyThreeMarker,
    referenceMarkers: [...previousRuntimeTarget.referenceMarkers, previousRuntimeTarget.marker],
    referenceFields: [...previousRuntimeTarget.referenceFields, \`phase\${previousRuntimeTarget.phase}Marker\`],
    requiredExports: ["export function buildPhase2806ThirtyThreeMutationRuntimeStatus", "export function main"],
    requiredMarkers: [...new Set([...previousRuntimeTarget.requiredMarkers, previousRuntimeTarget.marker, thirtyThreeMarker])],
    runnerReady: true,
  });

  return upgraded;
}`;
}

async function main() {
  await mkdir("tools/phase2769_2806", { recursive: true });
  let text = await readFile(sourcePath, "utf8");

  text = replaceRegex(text, /const phaseMeta = \{[\s\S]*?\n\};/, phaseMetaBlock(), "phaseMeta");
  text = replaceRegex(text, /const previousPhaseMeta = \{[\s\S]*?\n\};/, previousPhaseMetaBlock(), "previousPhaseMeta");

  text = replaceOne(text, `  "ThirtyTwo",
];`, `  "ThirtyTwo",
  "ThirtyThree",
];`);

  text = replaceOne(
    text,
    `  "tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs",
];`,
    `  "tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs",
  "tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs",
];`,
  );

  text = replaceOne(
    text,
    `const thirtyTargets = buildThirtyTargets(twentyNineTargets);
const thirtyOneTargets = buildThirtyOneTargets(thirtyTargets);
const targets = buildThirtyTwoTargets(thirtyOneTargets);
`,
    `const thirtyTargets = buildThirtyTargets(twentyNineTargets);
const thirtyOneTargets = buildThirtyOneTargets(thirtyTargets);
const thirtyTwoTargets = buildThirtyTwoTargets(thirtyOneTargets);
const targets = buildThirtyThreeTargets(thirtyTwoTargets);
`,
  );

  text = replaceOne(text, `\nconst phase2091Checks = [`, `\n${buildThirtyThreeTargetsFunction()}\n\nconst phase2091Checks = [`);

  text = replaceOne(
    text,
    `      2738: "export function buildPhase2702ThirtyOneMutationTargetTwoStatus() {",
      2739: "export function buildPhase2703ThirtyOneMutationTargetThreeStatus() {",
      2740: "export function buildPhase2704ThirtyOneMutationTargetFourStatus() {",
      2741: "export function buildPhase2705ThirtyOneMutationTargetFiveStatus() {",
    };`,
    `      2738: "export function buildPhase2702ThirtyOneMutationTargetTwoStatus() {",
      2739: "export function buildPhase2703ThirtyOneMutationTargetThreeStatus() {",
      2740: "export function buildPhase2704ThirtyOneMutationTargetFourStatus() {",
      2741: "export function buildPhase2705ThirtyOneMutationTargetFiveStatus() {",
      2775: "export function buildPhase2738ThirtyTwoMutationTargetTwoStatus() {",
      2776: "export function buildPhase2739ThirtyTwoMutationTargetThreeStatus() {",
      2777: "export function buildPhase2740ThirtyTwoMutationTargetFourStatus() {",
      2778: "export function buildPhase2741ThirtyTwoMutationTargetFiveStatus() {",
    };`,
  );

  text = replaceAll(text, "tmp/phase2732-2768-proposals", "tmp/phase2769-2806-proposals");
  text = replaceAllIfPresent(
    text,
    "Phase2732A-2768A Controlled Thirty-Two Tool Mutation Evidence",
    "Phase2769A-2806A Controlled Thirty-Three Tool Mutation Evidence",
  );
  text = replaceAll(text, "Phase2732A-2768A Controlled Thirty-Two Tool Mutation", "Phase2769A-2806A Controlled Thirty-Three Tool Mutation");
  text = replaceAll(text, "phase2732-2768-controlled-thirty-two-tool-mutation", "phase2769-2806-controlled-thirty-three-tool-mutation");
  text = replaceAllIfPresent(text, "verify:phase2732-2768-controlled-thirty-two-tool-mutation", "verify:phase2769-2806-controlled-thirty-three-tool-mutation");
  text = replaceAllIfPresent(text, "apply:phase2732-2768-controlled-thirty-two-tool-mutation", "apply:phase2769-2806-controlled-thirty-three-tool-mutation");
  text = replaceAllIfPresent(text, "smoke:phase2732-2768-controlled-thirty-two-tool-mutation", "smoke:phase2769-2806-controlled-thirty-three-tool-mutation");

  text = replaceAllIfPresent(
    text,
    "Phase2732A-2768A extends the controlled local mutation line from thirty-one files to thirty-two files",
    "Phase2769A-2806A extends the controlled local mutation line from thirty-two files to thirty-three files",
  );
  text = replaceAllIfPresent(text, "from thirty-one files to thirty-two files", "from thirty-two files to thirty-three files");
  text = replaceAll(text, "support thirty-two bounded local smoke commands", "support thirty-three bounded local smoke commands");
  text = replaceAll(text, "The thirty-two mutation batch must prove:", "The thirty-three mutation batch must prove:");
  text = replaceAll(text, "the thirty-two target markers are not present", "the thirty-three target markers are not present");
  text = replaceAllIfPresent(text, "- Applies exactly thirty-two existing source-file mutations.", "- Applies exactly thirty-three existing source-file mutations.");
  text = replaceAllIfPresent(text, "current **controlled thirty-two tool mutation** batch", "current **controlled thirty-three tool mutation** batch");
  text = replaceAllIfPresent(text, "runs local thirty-two smoke", "runs local thirty-three smoke");
  text = replaceAllIfPresent(text, "local thirty-two smoke", "local thirty-three smoke");
  text = replaceAllIfPresent(text, "thirty-three-file bounded batch", "thirty-four-file bounded batch");

  text = replaceAllIfPresent(text, "thirtyTwoMutationApplied", "thirtyThreeMutationApplied");
  text = replaceAllIfPresent(text, "localThirtyTwoSmokePassed", "localThirtyThreeSmokePassed");
  text = replaceAllIfPresent(text, "thirtyTwoRunnerReady", "thirtyThreeRunnerReady");
  text = replaceAllIfPresent(text, "restore-previous-content-thirty-two", "restore-previous-content-thirty-three");
  text = replaceAllIfPresent(text, "thirty-two-smoke.json", "thirty-three-smoke.json");
  text = replaceAllIfPresent(text, "controlled-thirty-two-tool-source-mutation", "controlled-thirty-three-tool-source-mutation");
  text = replaceAllIfPresent(text, "changed_file_count_thirty_two", "changed_file_count_thirty_three");
  text = replaceAllIfPresent(text, "rollback_restore_thirty_two", "rollback_restore_thirty_three");
  text = replaceAllIfPresent(text, "rollback_thirty_two_entries", "rollback_thirty_three_entries");
  text = replaceAllIfPresent(text, "docs_mentions_thirty_two", "docs_mentions_thirty_three");
  text = replaceAllIfPresent(text, "thirty_two_mutation_applied", "thirty_three_mutation_applied");
  text = replaceAllIfPresent(text, "thirtyTwoMutationReady", "thirtyThreeMutationReady");
  text = replaceAllIfPresent(text, 'docs.includes("controlled thirty-two tool mutation")', 'docs.includes("controlled thirty-three tool mutation")');
  text = replaceAllIfPresent(text, '"thirty_two_mutation_node_check_or_smoke_failed"', '"thirty_three_mutation_node_check_or_smoke_failed"');

  text = replaceAllIfPresent(text, "result.changedFileCount === 32", "result.changedFileCount === 33");
  text = replaceAllIfPresent(text, "rollback.files.length === 32", "rollback.files.length === 33");
  text = replaceAllIfPresent(text, "changedFileCount: result?.changedFileCount ?? 32", "changedFileCount: result?.changedFileCount ?? 33");
  text = replaceAllIfPresent(text, "expectedOperationCount: 32", "expectedOperationCount: 33");
  text = replaceAllIfPresent(text, "expectedMaxChangedFiles: 32", "expectedMaxChangedFiles: 33");
  text = replaceAllIfPresent(text, "maxChangedFiles: 32,", "maxChangedFiles: 33,");

  text = replaceAllIfPresent(text, "const phase2731 = readJson(\"${previousPhaseMeta.resultPath}\") || {};", "const phase2768 = readJson(\"${previousPhaseMeta.resultPath}\") || {};");
  text = replaceAllIfPresent(text, "phase2731.recommendedSealed", "phase2768.recommendedSealed");
  text = replaceAllIfPresent(text, "phase2731.${previousPhaseMeta.sealCheckField}", "phase2768.${previousPhaseMeta.sealCheckField}");
  text = replaceAllIfPresent(text, "phase2731Sealed", "phase2768Sealed");
  text = replaceAllIfPresent(text, "phase2731_sealed", "phase2768_sealed");
  text = replaceAllIfPresent(text, "phase2731_not_sealed", "phase2768_not_sealed");
  text = replaceAllIfPresent(text, "- Requires Phase2696A-2731A sealed evidence.", "- Requires Phase2732A-2768A sealed evidence.");

  text = replaceRegex(text, /const phaseMeta = \{[\s\S]*?\n\};/, phaseMetaBlock(), "phaseMeta-final");
  text = replaceRegex(text, /const previousPhaseMeta = \{[\s\S]*?\n\};/, previousPhaseMetaBlock(), "previousPhaseMeta-final");

  await writeFile(targetPath, text, "utf8");
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
