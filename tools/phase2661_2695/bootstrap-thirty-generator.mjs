import { readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase2627_2660/generate-twenty-nine-phase-assets.mjs";
const targetPath = "tools/phase2661_2695/generate-thirty-phase-assets.mjs";

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
    `const phaseMeta = {
  phaseId: "Phase2661A-2695A-Controlled-Thirty-Tool-Mutation",
  docPath: "docs/phase2661-2695-controlled-thirty-tool-mutation.md",
  approvalPath: "docs/phase2661-2695-controlled-thirty-tool-mutation-approval.example.json",
  runnerPath: "tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs",
  verifierPath: "tools/phase2661_2695/validate-controlled-thirty-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase2661-2695-controlled-thirty-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2661-2695-controlled-thirty-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase2661-2695-controlled-thirty-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase2661-2695-controlled-thirty-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase2661-2695-controlled-thirty-tool-mutation/thirty-smoke.json",
  permissionMode: "controlled-thirty-tool-source-mutation",
  label: "thirty",
  runnerReadyField: "thirtyRunnerReady",
  appliedField: "thirtyMutationApplied",
  smokeField: "localThirtySmokePassed",
  rollbackAction: "restore-previous-content-thirty",
  verifyScript: "verify:phase2661-2695-controlled-thirty-tool-mutation",
  applyScript: "apply:phase2661-2695-controlled-thirty-tool-mutation",
  smokeScript: "smoke:phase2661-2695-controlled-thirty-tool-mutation",
};`,
  );

  text = replaceOne(
    text,
    `const previousPhaseMeta = {
  phaseId: "Phase2594A-2626A-Controlled-Twenty-Eight-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2594-2626-controlled-twenty-eight-tool-mutation/result.json",
  sealCheckId: "phase2626_sealed",
  sealCheckField: "twentyEightMutationApplied",
  sealCheckBlocker: "phase2626_not_sealed",
};`,
    `const previousPhaseMeta = {
  phaseId: "Phase2627A-2660A-Controlled-Twenty-Nine-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2627-2660-controlled-twenty-nine-tool-mutation/result.json",
  sealCheckId: "phase2660_sealed",
  sealCheckField: "twentyNineMutationApplied",
  sealCheckBlocker: "phase2660_not_sealed",
};`,
  );

  text = replaceOne(
    text,
    `  "TwentyEight",
  "TwentyNine",
];`,
    `  "TwentyEight",
  "TwentyNine",
  "Thirty",
];`,
  );

  text = replaceOne(
    text,
    `  "tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs",
  "tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs",
];`,
    `  "tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs",
  "tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs",
  "tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs",
];`,
  );

  text = replaceOne(
    text,
    `const twentySevenTargets = buildTwentySevenTargets(twentySixTargets);
const twentyEightTargets = buildTwentyEightTargets(twentySevenTargets);
const targets = buildTwentyNineTargets(twentyEightTargets);
`,
    `const twentySevenTargets = buildTwentySevenTargets(twentySixTargets);
const twentyEightTargets = buildTwentyEightTargets(twentySevenTargets);
const twentyNineTargets = buildTwentyNineTargets(twentyEightTargets);
const targets = buildThirtyTargets(twentyNineTargets);
`,
  );

  text = replaceOne(
    text,
    `  return upgraded;
}

const phase2091Checks = [`,
    `  return upgraded;
}

function buildThirtyTargets(previousTargets) {
  const upgraded = previousTargets.map((target) => {
    const idx = target.idx;
    const phase = 2665 + idx;
    const titleWord = titleWords[idx - 1];
    const word = wordNames[idx - 1];
    const marker = \`PHASE\${phase}_THIRTY_TOOL_TARGET_\${word.replace(/-/g, "_").toUpperCase()}_OK\`;
    const previousMarkerField = \`phase\${target.phase}Marker\`;
    const next = {
      ...target,
      phase,
      word,
      targetName: \`target-\${word}\`,
      proposal: \`docs/phase\${phase}-thirty-tool-mutation-target-\${word}.proposal.diff\`,
      newExport:
        idx === 30
          ? "buildPhase2695ThirtyMutationRuntimeStatus"
          : \`buildPhase\${phase}ThirtyMutationTarget\${titleWord}Status\`,
      newPhaseId:
        idx === 30
          ? "Phase2695A-Controlled-Thirty-Tool-Mutation-Target-Thirty"
          : \`Phase\${phase}A-Controlled-Thirty-Tool-Mutation-Target-\${word.replace(/(^|-)([a-z])/g, (_, prefix, char) => \`\${prefix === "-" ? "-" : ""}\${char.toUpperCase()}\`)}\`,
      marker,
      referenceMarkers: [...target.referenceMarkers, target.marker],
      referenceFields: [...target.referenceFields, previousMarkerField],
      requiredExports:
        idx === 1
          ? [\`export function \${idx === 30 ? "buildPhase2695ThirtyMutationRuntimeStatus" : \`buildPhase\${phase}ThirtyMutationTarget\${titleWord}Status\`}\`]
          : [
              \`export function \${idx === 30 ? "buildPhase2695ThirtyMutationRuntimeStatus" : \`buildPhase\${phase}ThirtyMutationTarget\${titleWord}Status\`}\`,
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

  const previousRuntimeTarget = previousTargets[28];
  const thirtyPhase = 2695;
  const thirtyMarker = "PHASE2695_THIRTY_TOOL_TARGET_THIRTY_OK";
  upgraded.push({
    idx: 30,
    phase: thirtyPhase,
    word: "thirty",
    targetName: "target-thirty",
    path: sourceTargetPaths[29],
    proposal: "docs/phase2695-thirty-tool-mutation-target-thirty.proposal.diff",
    addMode: "append-export",
    newExport: "buildPhase2695ThirtyMutationRuntimeStatus",
    newPhaseId: "Phase2695A-Controlled-Thirty-Tool-Mutation-Target-Thirty",
    marker: thirtyMarker,
    referenceMarkers: [...previousRuntimeTarget.referenceMarkers, previousRuntimeTarget.marker],
    referenceFields: [...previousRuntimeTarget.referenceFields, \`phase\${previousRuntimeTarget.phase}Marker\`],
    requiredExports: ["export function buildPhase2695ThirtyMutationRuntimeStatus", "export function main"],
    requiredMarkers: [...new Set([...previousRuntimeTarget.requiredMarkers, previousRuntimeTarget.marker, thirtyMarker])],
    runnerReady: true,
  });

  return upgraded;
}

const phase2091Checks = [`,
  );

  text = replaceOne(
    text,
    `      2633: "export function buildPhase2600TwentyEightMutationTargetTwoStatus() {",
      2634: "export function buildPhase2601TwentyEightMutationTargetThreeStatus() {",
      2635: "export function buildPhase2602TwentyEightMutationTargetFourStatus() {",
      2636: "export function buildPhase2603TwentyEightMutationTargetFiveStatus() {",
    };`,
    `      2633: "export function buildPhase2600TwentyEightMutationTargetTwoStatus() {",
      2634: "export function buildPhase2601TwentyEightMutationTargetThreeStatus() {",
      2635: "export function buildPhase2602TwentyEightMutationTargetFourStatus() {",
      2636: "export function buildPhase2603TwentyEightMutationTargetFiveStatus() {",
      2667: "export function buildPhase2633TwentyNineMutationTargetTwoStatus() {",
      2668: "export function buildPhase2634TwentyNineMutationTargetThreeStatus() {",
      2669: "export function buildPhase2635TwentyNineMutationTargetFourStatus() {",
      2670: "export function buildPhase2636TwentyNineMutationTargetFiveStatus() {",
    };`,
  );

  text = replaceAll(text, "tmp/phase2627-2660-proposals", "tmp/phase2661-2695-proposals");
  text = replaceAllIfPresent(
    text,
    "Phase2627A-2660A Controlled Twenty-Nine Tool Mutation Evidence",
    "Phase2661A-2695A Controlled Thirty Tool Mutation Evidence",
  );
  text = replaceAll(text, "Phase2627A-2660A Controlled Twenty-Nine Tool Mutation", "Phase2661A-2695A Controlled Thirty Tool Mutation");
  text = replaceAll(text, "phase2627-2660-controlled-twenty-nine-tool-mutation", "phase2661-2695-controlled-thirty-tool-mutation");
  text = replaceAllIfPresent(text, "verify:phase2627-2660-controlled-twenty-nine-tool-mutation", "verify:phase2661-2695-controlled-thirty-tool-mutation");
  text = replaceAllIfPresent(text, "apply:phase2627-2660-controlled-twenty-nine-tool-mutation", "apply:phase2661-2695-controlled-thirty-tool-mutation");
  text = replaceAllIfPresent(text, "smoke:phase2627-2660-controlled-twenty-nine-tool-mutation", "smoke:phase2661-2695-controlled-thirty-tool-mutation");
  text = replaceAll(text, "from twenty-eight files to twenty-nine files", "from twenty-nine files to thirty files");
  text = replaceAll(text, "support twenty-nine bounded local smoke commands", "support thirty bounded local smoke commands");
  text = replaceAll(text, "The twenty-nine mutation batch must prove:", "The thirty mutation batch must prove:");
  text = replaceAll(text, "the twenty-nine target markers are not present", "the thirty target markers are not present");
  text = replaceAllIfPresent(text, "- Applies exactly twenty-nine existing source-file mutations.", "- Applies exactly thirty existing source-file mutations.");
  text = replaceAllIfPresent(text, "current **controlled twenty-nine tool mutation** batch", "current **controlled thirty tool mutation** batch");
  text = replaceAllIfPresent(text, "runs local twenty-nine smoke", "runs local thirty smoke");

  text = replaceAllIfPresent(text, "twentyNineMutationApplied", "thirtyMutationApplied");
  text = replaceAllIfPresent(text, "localTwentyNineSmokePassed", "localThirtySmokePassed");
  text = replaceAllIfPresent(text, "twentyNineRunnerReady", "thirtyRunnerReady");
  text = replaceAllIfPresent(text, "restore-previous-content-twenty-nine", "restore-previous-content-thirty");
  text = replaceAllIfPresent(text, "twenty-nine-smoke.json", "thirty-smoke.json");
  text = replaceAllIfPresent(text, "controlled-twenty-nine-tool-source-mutation", "controlled-thirty-tool-source-mutation");
  text = replaceAllIfPresent(text, "changed_file_count_twenty_nine", "changed_file_count_thirty");
  text = replaceAllIfPresent(text, "rollback_restore_twenty_nine", "rollback_restore_thirty");
  text = replaceAllIfPresent(text, "rollback_twenty_nine_entries", "rollback_thirty_entries");
  text = replaceAllIfPresent(text, "docs_mentions_twenty_nine", "docs_mentions_thirty");
  text = replaceAllIfPresent(text, "twenty_nine_mutation_applied", "thirty_mutation_applied");
  text = replaceAllIfPresent(text, "twentyNineMutationReady", "thirtyMutationReady");
  text = replaceAllIfPresent(text, 'docs.includes("controlled twenty-nine tool mutation")', 'docs.includes("controlled thirty tool mutation")');
  text = replaceAllIfPresent(text, '"twenty_nine_mutation_node_check_or_smoke_failed"', '"thirty_mutation_node_check_or_smoke_failed"');

  text = replaceAllIfPresent(text, "result.changedFileCount === 29", "result.changedFileCount === 30");
  text = replaceAllIfPresent(text, "rollback.files.length === 29", "rollback.files.length === 30");
  text = replaceAllIfPresent(text, "changedFileCount: result?.changedFileCount ?? 29", "changedFileCount: result?.changedFileCount ?? 30");
  text = replaceAllIfPresent(text, "expectedOperationCount: 29", "expectedOperationCount: 30");
  text = replaceAllIfPresent(text, "expectedMaxChangedFiles: 29", "expectedMaxChangedFiles: 30");
  text = replaceAllIfPresent(text, "maxChangedFiles: 29,", "maxChangedFiles: 30,");

  text = replaceAllIfPresent(text, "const phase2626 = readJson(\"${previousPhaseMeta.resultPath}\") || {};", "const phase2660 = readJson(\"${previousPhaseMeta.resultPath}\") || {};");
  text = replaceAllIfPresent(text, "phase2626.recommendedSealed", "phase2660.recommendedSealed");
  text = replaceAllIfPresent(text, "phase2626.${previousPhaseMeta.sealCheckField}", "phase2660.${previousPhaseMeta.sealCheckField}");
  text = replaceAllIfPresent(text, "phase2626Sealed", "phase2660Sealed");
  text = replaceAllIfPresent(text, "phase2626_not_sealed", "phase2660_not_sealed");
  text = replaceAllIfPresent(text, "Phase2627A-2660A extends the controlled local mutation line from twenty-nine files to thirty files", "Phase2661A-2695A extends the controlled local mutation line from twenty-nine files to thirty files");
  text = replaceAllIfPresent(text, "- Requires Phase2594A-2626A sealed evidence.", "- Requires Phase2627A-2660A sealed evidence.");

  text = replaceAllIfPresent(
    text,
    `const previousPhaseMeta = {
  phaseId: "Phase2627A-2660A-Controlled-Twenty-Nine-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2661-2695-controlled-thirty-tool-mutation/result.json",
  sealCheckId: "phase2660_sealed",
  sealCheckField: "thirtyMutationApplied",
  sealCheckBlocker: "phase2660_not_sealed",
};`,
    `const previousPhaseMeta = {
  phaseId: "Phase2627A-2660A-Controlled-Twenty-Nine-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2627-2660-controlled-twenty-nine-tool-mutation/result.json",
  sealCheckId: "phase2660_sealed",
  sealCheckField: "twentyNineMutationApplied",
  sealCheckBlocker: "phase2660_not_sealed",
};`,
  );

  await writeFile(targetPath, text, "utf8");
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
