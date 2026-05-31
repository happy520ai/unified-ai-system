import { readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase2594_2626/generate-twenty-eight-phase-assets.mjs";
const targetPath = "tools/phase2627_2660/generate-twenty-nine-phase-assets.mjs";

function replaceOne(text, search, replacement) {
  if (!text.includes(search)) throw new Error(`missing_replace_target:${search}`);
  return text.replace(search, replacement);
}

function replaceAll(text, search, replacement) {
  if (!text.includes(search)) throw new Error(`missing_replace_all_target:${search}`);
  return text.split(search).join(replacement);
}

function replaceAllIfPresent(text, search, replacement) {
  return text.includes(search) ? text.split(search).join(replacement) : text;
}

async function main() {
  let text = await readFile(sourcePath, "utf8");

  text = replaceOne(
    text,
    `const phaseMeta = {
  phaseId: "Phase2594A-2626A-Controlled-Twenty-Eight-Tool-Mutation",
  docPath: "docs/phase2594-2626-controlled-twenty-eight-tool-mutation.md",
  approvalPath: "docs/phase2594-2626-controlled-twenty-eight-tool-mutation-approval.example.json",
  runnerPath: "tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs",
  verifierPath: "tools/phase2594_2626/validate-controlled-twenty-eight-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase2594-2626-controlled-twenty-eight-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2594-2626-controlled-twenty-eight-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase2594-2626-controlled-twenty-eight-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase2594-2626-controlled-twenty-eight-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase2594-2626-controlled-twenty-eight-tool-mutation/twenty-eight-smoke.json",
  permissionMode: "controlled-twenty-eight-tool-source-mutation",
  label: "twenty-eight",
  runnerReadyField: "twentyEightRunnerReady",
  appliedField: "twentyEightMutationApplied",
  smokeField: "localTwentyEightSmokePassed",
  rollbackAction: "restore-previous-content-twenty-eight",
  verifyScript: "verify:phase2594-2626-controlled-twenty-eight-tool-mutation",
  applyScript: "apply:phase2594-2626-controlled-twenty-eight-tool-mutation",
  smokeScript: "smoke:phase2594-2626-controlled-twenty-eight-tool-mutation",
};`,
    `const phaseMeta = {
  phaseId: "Phase2627A-2660A-Controlled-Twenty-Nine-Tool-Mutation",
  docPath: "docs/phase2627-2660-controlled-twenty-nine-tool-mutation.md",
  approvalPath: "docs/phase2627-2660-controlled-twenty-nine-tool-mutation-approval.example.json",
  runnerPath: "tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs",
  verifierPath: "tools/phase2627_2660/validate-controlled-twenty-nine-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase2627-2660-controlled-twenty-nine-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2627-2660-controlled-twenty-nine-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase2627-2660-controlled-twenty-nine-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase2627-2660-controlled-twenty-nine-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase2627-2660-controlled-twenty-nine-tool-mutation/twenty-nine-smoke.json",
  permissionMode: "controlled-twenty-nine-tool-source-mutation",
  label: "twenty-nine",
  runnerReadyField: "twentyNineRunnerReady",
  appliedField: "twentyNineMutationApplied",
  smokeField: "localTwentyNineSmokePassed",
  rollbackAction: "restore-previous-content-twenty-nine",
  verifyScript: "verify:phase2627-2660-controlled-twenty-nine-tool-mutation",
  applyScript: "apply:phase2627-2660-controlled-twenty-nine-tool-mutation",
  smokeScript: "smoke:phase2627-2660-controlled-twenty-nine-tool-mutation",
};`,
  );

  text = replaceOne(
    text,
    `const previousPhaseMeta = {
  phaseId: "Phase2562A-2593A-Controlled-Twenty-Seven-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2562-2593-controlled-twenty-seven-tool-mutation/result.json",
  sealCheckId: "phase2593_sealed",
  sealCheckField: "twentySevenMutationApplied",
  sealCheckBlocker: "phase2593_not_sealed",
};`,
    `const previousPhaseMeta = {
  phaseId: "Phase2594A-2626A-Controlled-Twenty-Eight-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2594-2626-controlled-twenty-eight-tool-mutation/result.json",
  sealCheckId: "phase2626_sealed",
  sealCheckField: "twentyEightMutationApplied",
  sealCheckBlocker: "phase2626_not_sealed",
};`,
  );

  text = replaceOne(
    text,
    `  "TwentySeven",
  "TwentyEight",
];`,
    `  "TwentySeven",
  "TwentyEight",
  "TwentyNine",
];`,
  );

  text = replaceOne(
    text,
    `  "tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs",
  "tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs",
];`,
    `  "tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs",
  "tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs",
  "tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs",
];`,
  );

  text = replaceOne(
    text,
    `const twentySixTargets = buildTwentySixTargets(twentyFiveTargets);
const twentySevenTargets = buildTwentySevenTargets(twentySixTargets);
const targets = buildTwentyEightTargets(twentySevenTargets);
`,
    `const twentySixTargets = buildTwentySixTargets(twentyFiveTargets);
const twentySevenTargets = buildTwentySevenTargets(twentySixTargets);
const twentyEightTargets = buildTwentyEightTargets(twentySevenTargets);
const targets = buildTwentyNineTargets(twentyEightTargets);
`,
  );

  text = replaceOne(
    text,
    `  return upgraded;
}

const phase2091Checks = [`,
    `  return upgraded;
}

function buildTwentyNineTargets(previousTargets) {
  const upgraded = previousTargets.map((target) => {
    const idx = target.idx;
    const phase = 2631 + idx;
    const titleWord = titleWords[idx - 1];
    const word = wordNames[idx - 1];
    const marker = \`PHASE\${phase}_TWENTY_NINE_TOOL_TARGET_\${word.replace(/-/g, "_").toUpperCase()}_OK\`;
    const previousMarkerField = \`phase\${target.phase}Marker\`;
    const next = {
      ...target,
      phase,
      word,
      targetName: \`target-\${word}\`,
      proposal: \`docs/phase\${phase}-twenty-nine-tool-mutation-target-\${word}.proposal.diff\`,
      newExport:
        idx === 29
          ? "buildPhase2660TwentyNineMutationRuntimeStatus"
          : \`buildPhase\${phase}TwentyNineMutationTarget\${titleWord}Status\`,
      newPhaseId:
        idx === 29
          ? "Phase2660A-Controlled-Twenty-Nine-Tool-Mutation-Target-Twenty-Nine"
          : \`Phase\${phase}A-Controlled-Twenty-Nine-Tool-Mutation-Target-\${word.replace(/(^|-)([a-z])/g, (_, prefix, char) => \`\${prefix === "-" ? "-" : ""}\${char.toUpperCase()}\`)}\`,
      marker,
      referenceMarkers: [...target.referenceMarkers, target.marker],
      referenceFields: [...target.referenceFields, previousMarkerField],
      requiredExports:
        idx === 1
          ? [\`export function \${idx === 29 ? "buildPhase2660TwentyNineMutationRuntimeStatus" : \`buildPhase\${phase}TwentyNineMutationTarget\${titleWord}Status\`}\`]
          : [
              \`export function \${idx === 29 ? "buildPhase2660TwentyNineMutationRuntimeStatus" : \`buildPhase\${phase}TwentyNineMutationTarget\${titleWord}Status\`}\`,
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

  const previousRuntimeTarget = previousTargets[27];
  const twentyNinePhase = 2660;
  const twentyNineMarker = "PHASE2660_TWENTY_NINE_TOOL_TARGET_TWENTY_NINE_OK";
  upgraded.push({
    idx: 29,
    phase: twentyNinePhase,
    word: "twenty-nine",
    targetName: "target-twenty-nine",
    path: sourceTargetPaths[28],
    proposal: "docs/phase2660-twenty-nine-tool-mutation-target-twenty-nine.proposal.diff",
    addMode: "append-export",
    newExport: "buildPhase2660TwentyNineMutationRuntimeStatus",
    newPhaseId: "Phase2660A-Controlled-Twenty-Nine-Tool-Mutation-Target-Twenty-Nine",
    marker: twentyNineMarker,
    referenceMarkers: [...previousRuntimeTarget.referenceMarkers, previousRuntimeTarget.marker],
    referenceFields: [...previousRuntimeTarget.referenceFields, \`phase\${previousRuntimeTarget.phase}Marker\`],
    requiredExports: ["export function buildPhase2660TwentyNineMutationRuntimeStatus", "export function main"],
    requiredMarkers: [...new Set([...previousRuntimeTarget.requiredMarkers, previousRuntimeTarget.marker, twentyNineMarker])],
    runnerReady: true,
  });

  return upgraded;
}

const phase2091Checks = [`,
  );

  text = replaceOne(
    text,
    `      2600: "export function buildPhase2568TwentySevenMutationTargetTwoStatus() {",
      2601: "export function buildPhase2569TwentySevenMutationTargetThreeStatus() {",
      2602: "export function buildPhase2570TwentySevenMutationTargetFourStatus() {",
      2603: "export function buildPhase2571TwentySevenMutationTargetFiveStatus() {",
    };`,
    `      2600: "export function buildPhase2568TwentySevenMutationTargetTwoStatus() {",
      2601: "export function buildPhase2569TwentySevenMutationTargetThreeStatus() {",
      2602: "export function buildPhase2570TwentySevenMutationTargetFourStatus() {",
      2603: "export function buildPhase2571TwentySevenMutationTargetFiveStatus() {",
      2633: "export function buildPhase2600TwentyEightMutationTargetTwoStatus() {",
      2634: "export function buildPhase2601TwentyEightMutationTargetThreeStatus() {",
      2635: "export function buildPhase2602TwentyEightMutationTargetFourStatus() {",
      2636: "export function buildPhase2603TwentyEightMutationTargetFiveStatus() {",
    };`,
  );

  text = replaceAll(text, "tmp/phase2594-2626-proposals", "tmp/phase2627-2660-proposals");
  text = replaceAllIfPresent(
    text,
    "Phase2594A-2626A Controlled Twenty-Eight Tool Mutation Evidence",
    "Phase2627A-2660A Controlled Twenty-Nine Tool Mutation Evidence",
  );
  text = replaceAll(text, "Phase2594A-2626A Controlled Twenty-Eight Tool Mutation", "Phase2627A-2660A Controlled Twenty-Nine Tool Mutation");
  text = replaceAll(text, "phase2594-2626-controlled-twenty-eight-tool-mutation", "phase2627-2660-controlled-twenty-nine-tool-mutation");
  text = replaceAllIfPresent(text, "verify:phase2594-2626-controlled-twenty-eight-tool-mutation", "verify:phase2627-2660-controlled-twenty-nine-tool-mutation");
  text = replaceAllIfPresent(text, "apply:phase2594-2626-controlled-twenty-eight-tool-mutation", "apply:phase2627-2660-controlled-twenty-nine-tool-mutation");
  text = replaceAllIfPresent(text, "smoke:phase2594-2626-controlled-twenty-eight-tool-mutation", "smoke:phase2627-2660-controlled-twenty-nine-tool-mutation");
  text = replaceAll(text, "from twenty-seven files to twenty-eight files", "from twenty-eight files to twenty-nine files");
  text = replaceAll(text, "support twenty-eight bounded local smoke commands", "support twenty-nine bounded local smoke commands");
  text = replaceAll(text, "The twenty-eight mutation batch must prove:", "The twenty-nine mutation batch must prove:");
  text = replaceAll(text, "the twenty-eight target markers are not present", "the twenty-nine target markers are not present");
  text = replaceAllIfPresent(text, "- Applies exactly twenty-eight existing source-file mutations.", "- Applies exactly twenty-nine existing source-file mutations.");
  text = replaceAllIfPresent(text, "current **controlled twenty-eight tool mutation** batch", "current **controlled twenty-nine tool mutation** batch");
  text = replaceAllIfPresent(text, "runs local twenty-eight smoke", "runs local twenty-nine smoke");

  text = replaceAllIfPresent(text, "twentyEightMutationApplied", "twentyNineMutationApplied");
  text = replaceAllIfPresent(text, "localTwentyEightSmokePassed", "localTwentyNineSmokePassed");
  text = replaceAllIfPresent(text, "twentyEightRunnerReady", "twentyNineRunnerReady");
  text = replaceAllIfPresent(text, "restore-previous-content-twenty-eight", "restore-previous-content-twenty-nine");
  text = replaceAllIfPresent(text, "twenty-eight-smoke.json", "twenty-nine-smoke.json");
  text = replaceAllIfPresent(text, "controlled-twenty-eight-tool-source-mutation", "controlled-twenty-nine-tool-source-mutation");
  text = replaceAllIfPresent(text, "changed_file_count_twenty_eight", "changed_file_count_twenty_nine");
  text = replaceAllIfPresent(text, "rollback_restore_twenty_eight", "rollback_restore_twenty_nine");
  text = replaceAllIfPresent(text, "rollback_twenty_eight_entries", "rollback_twenty_nine_entries");
  text = replaceAllIfPresent(text, "docs_mentions_twenty_eight", "docs_mentions_twenty_nine");
  text = replaceAllIfPresent(text, "twenty_eight_mutation_applied", "twenty_nine_mutation_applied");
  text = replaceAllIfPresent(text, "twentyEightMutationReady", "twentyNineMutationReady");
  text = replaceAllIfPresent(text, 'docs.includes("controlled twenty-eight tool mutation")', 'docs.includes("controlled twenty-nine tool mutation")');
  text = replaceAllIfPresent(text, '"twenty_eight_mutation_node_check_or_smoke_failed"', '"twenty_nine_mutation_node_check_or_smoke_failed"');

  text = replaceAllIfPresent(text, "result.changedFileCount === 28", "result.changedFileCount === 29");
  text = replaceAllIfPresent(text, "rollback.files.length === 28", "rollback.files.length === 29");
  text = replaceAllIfPresent(text, "changedFileCount: result?.changedFileCount ?? 28", "changedFileCount: result?.changedFileCount ?? 29");
  text = replaceAllIfPresent(text, "expectedOperationCount: 28", "expectedOperationCount: 29");
  text = replaceAllIfPresent(text, "expectedMaxChangedFiles: 28", "expectedMaxChangedFiles: 29");
  text = replaceAllIfPresent(text, "maxChangedFiles: 28,", "maxChangedFiles: 29,");

  text = replaceAllIfPresent(text, "const phase2593 = readJson(\"${previousPhaseMeta.resultPath}\") || {};", "const phase2626 = readJson(\"${previousPhaseMeta.resultPath}\") || {};");
  text = replaceAllIfPresent(text, "phase2593.recommendedSealed", "phase2626.recommendedSealed");
  text = replaceAllIfPresent(text, "phase2593.${previousPhaseMeta.sealCheckField}", "phase2626.${previousPhaseMeta.sealCheckField}");
  text = replaceAllIfPresent(text, "phase2593Sealed", "phase2626Sealed");
  text = replaceAllIfPresent(text, "phase2593_not_sealed", "phase2626_not_sealed");
  text = replaceAllIfPresent(text, "Phase2594A-2626A extends the controlled local mutation line from twenty-eight files to twenty-nine files", "Phase2627A-2660A extends the controlled local mutation line from twenty-eight files to twenty-nine files");
  text = replaceAllIfPresent(text, "- Requires Phase2562A-2593A sealed evidence.", "- Requires Phase2594A-2626A sealed evidence.");

  text = replaceAllIfPresent(
    text,
    `const previousPhaseMeta = {
  phaseId: "Phase2594A-2626A-Controlled-Twenty-Eight-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2627-2660-controlled-twenty-nine-tool-mutation/result.json",
  sealCheckId: "phase2626_sealed",
  sealCheckField: "twentyNineMutationApplied",
  sealCheckBlocker: "phase2626_not_sealed",
};`,
    `const previousPhaseMeta = {
  phaseId: "Phase2594A-2626A-Controlled-Twenty-Eight-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2594-2626-controlled-twenty-eight-tool-mutation/result.json",
  sealCheckId: "phase2626_sealed",
  sealCheckField: "twentyEightMutationApplied",
  sealCheckBlocker: "phase2626_not_sealed",
};`,
  );

  await writeFile(targetPath, text, "utf8");
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
