import { readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase2531_2561/generate-twenty-six-phase-assets.mjs";
const targetPath = "tools/phase2562_2593/generate-twenty-seven-phase-assets.mjs";

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
  phaseId: "Phase2531A-2561A-Controlled-Twenty-Six-Tool-Mutation",
  docPath: "docs/phase2531-2561-controlled-twenty-six-tool-mutation.md",
  approvalPath: "docs/phase2531-2561-controlled-twenty-six-tool-mutation-approval.example.json",
  runnerPath: "tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs",
  verifierPath: "tools/phase2531_2561/validate-controlled-twenty-six-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase2531-2561-controlled-twenty-six-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2531-2561-controlled-twenty-six-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase2531-2561-controlled-twenty-six-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase2531-2561-controlled-twenty-six-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase2531-2561-controlled-twenty-six-tool-mutation/twenty-six-smoke.json",
  permissionMode: "controlled-twenty-six-tool-source-mutation",
  label: "twenty-six",
  runnerReadyField: "twentySixRunnerReady",
  appliedField: "twentySixMutationApplied",
  smokeField: "localTwentySixSmokePassed",
  rollbackAction: "restore-previous-content-twenty-six",
  verifyScript: "verify:phase2531-2561-controlled-twenty-six-tool-mutation",
  applyScript: "apply:phase2531-2561-controlled-twenty-six-tool-mutation",
  smokeScript: "smoke:phase2531-2561-controlled-twenty-six-tool-mutation",
};`,
    `const phaseMeta = {
  phaseId: "Phase2562A-2593A-Controlled-Twenty-Seven-Tool-Mutation",
  docPath: "docs/phase2562-2593-controlled-twenty-seven-tool-mutation.md",
  approvalPath: "docs/phase2562-2593-controlled-twenty-seven-tool-mutation-approval.example.json",
  runnerPath: "tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs",
  verifierPath: "tools/phase2562_2593/validate-controlled-twenty-seven-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase2562-2593-controlled-twenty-seven-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2562-2593-controlled-twenty-seven-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase2562-2593-controlled-twenty-seven-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase2562-2593-controlled-twenty-seven-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase2562-2593-controlled-twenty-seven-tool-mutation/twenty-seven-smoke.json",
  permissionMode: "controlled-twenty-seven-tool-source-mutation",
  label: "twenty-seven",
  runnerReadyField: "twentySevenRunnerReady",
  appliedField: "twentySevenMutationApplied",
  smokeField: "localTwentySevenSmokePassed",
  rollbackAction: "restore-previous-content-twenty-seven",
  verifyScript: "verify:phase2562-2593-controlled-twenty-seven-tool-mutation",
  applyScript: "apply:phase2562-2593-controlled-twenty-seven-tool-mutation",
  smokeScript: "smoke:phase2562-2593-controlled-twenty-seven-tool-mutation",
};`,
  );

  text = replaceOne(
    text,
    `const previousPhaseMeta = {
  phaseId: "Phase2501A-2530A-Controlled-Twenty-Five-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2501-2530-controlled-twenty-five-tool-mutation/result.json",
  sealCheckId: "phase2530_sealed",
  sealCheckField: "twentyFiveMutationApplied",
  sealCheckBlocker: "phase2530_not_sealed",
};`,
    `const previousPhaseMeta = {
  phaseId: "Phase2531A-2561A-Controlled-Twenty-Six-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2531-2561-controlled-twenty-six-tool-mutation/result.json",
  sealCheckId: "phase2561_sealed",
  sealCheckField: "twentySixMutationApplied",
  sealCheckBlocker: "phase2561_not_sealed",
};`,
  );

  text = replaceOne(
    text,
    `  "TwentyFive",
  "TwentySix",
];`,
    `  "TwentyFive",
  "TwentySix",
  "TwentySeven",
];`,
  );

  text = replaceOne(
    text,
    `  "tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs",
  "tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs",
];`,
    `  "tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs",
  "tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs",
  "tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs",
];`,
  );

  text = replaceOne(
    text,
    `const twentyFourTargets = buildTwentyFourTargets(twentyThreeTargets);
const twentyFiveTargets = buildTwentyFiveTargets(twentyFourTargets);
const targets = buildTwentySixTargets(twentyFiveTargets);
`,
    `const twentyFourTargets = buildTwentyFourTargets(twentyThreeTargets);
const twentyFiveTargets = buildTwentyFiveTargets(twentyFourTargets);
const twentySixTargets = buildTwentySixTargets(twentyFiveTargets);
const targets = buildTwentySevenTargets(twentySixTargets);
`,
  );

  text = replaceOne(
    text,
    `  return upgraded;
}

const phase2091Checks = [`,
    `  return upgraded;
}

function buildTwentySevenTargets(previousTargets) {
  const upgraded = previousTargets.map((target) => {
    const idx = target.idx;
    const phase = 2566 + idx;
    const titleWord = titleWords[idx - 1];
    const word = wordNames[idx - 1];
    const marker = \`PHASE\${phase}_TWENTY_SEVEN_TOOL_TARGET_\${word.replace(/-/g, "_").toUpperCase()}_OK\`;
    const previousMarkerField = \`phase\${target.phase}Marker\`;
    const next = {
      ...target,
      phase,
      word,
      targetName: \`target-\${word}\`,
      proposal: \`docs/phase\${phase}-twenty-seven-tool-mutation-target-\${word}.proposal.diff\`,
      newExport:
        idx === 27
          ? "buildPhase2593TwentySevenMutationRuntimeStatus"
          : \`buildPhase\${phase}TwentySevenMutationTarget\${titleWord}Status\`,
      newPhaseId:
        idx === 27
          ? "Phase2593A-Controlled-Twenty-Seven-Tool-Mutation-Target-Twenty-Seven"
          : \`Phase\${phase}A-Controlled-Twenty-Seven-Tool-Mutation-Target-\${word.replace(/(^|-)([a-z])/g, (_, prefix, char) => \`\${prefix === "-" ? "-" : ""}\${char.toUpperCase()}\`)}\`,
      marker,
      referenceMarkers: [...target.referenceMarkers, target.marker],
      referenceFields: [...target.referenceFields, previousMarkerField],
      requiredExports:
        idx === 1
          ? [\`export function \${idx === 27 ? "buildPhase2593TwentySevenMutationRuntimeStatus" : \`buildPhase\${phase}TwentySevenMutationTarget\${titleWord}Status\`}\`]
          : [
              \`export function \${idx === 27 ? "buildPhase2593TwentySevenMutationRuntimeStatus" : \`buildPhase\${phase}TwentySevenMutationTarget\${titleWord}Status\`}\`,
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

  const previousRuntimeTarget = previousTargets[25];
  const twentySevenPhase = 2593;
  const twentySevenMarker = "PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK";
  upgraded.push({
    idx: 27,
    phase: twentySevenPhase,
    word: "twenty-seven",
    targetName: "target-twenty-seven",
    path: sourceTargetPaths[26],
    proposal: "docs/phase2593-twenty-seven-tool-mutation-target-twenty-seven.proposal.diff",
    addMode: "append-export",
    newExport: "buildPhase2593TwentySevenMutationRuntimeStatus",
    newPhaseId: "Phase2593A-Controlled-Twenty-Seven-Tool-Mutation-Target-Twenty-Seven",
    marker: twentySevenMarker,
    referenceMarkers: [...previousRuntimeTarget.referenceMarkers, previousRuntimeTarget.marker],
    referenceFields: [...previousRuntimeTarget.referenceFields, \`phase\${previousRuntimeTarget.phase}Marker\`],
    requiredExports: ["export function buildPhase2593TwentySevenMutationRuntimeStatus", "export function main"],
    requiredMarkers: [...new Set([...previousRuntimeTarget.requiredMarkers, previousRuntimeTarget.marker, twentySevenMarker])],
    runnerReady: true,
  });

  return upgraded;
}

const phase2091Checks = [`,
  );

  text = replaceOne(
    text,
    `      2537: "export function buildPhase2507TwentyFiveMutationTargetTwoStatus() {",
      2538: "export function buildPhase2508TwentyFiveMutationTargetThreeStatus() {",
      2539: "export function buildPhase2509TwentyFiveMutationTargetFourStatus() {",
      2540: "export function buildPhase2510TwentyFiveMutationTargetFiveStatus() {",
    };`,
    `      2537: "export function buildPhase2507TwentyFiveMutationTargetTwoStatus() {",
      2538: "export function buildPhase2508TwentyFiveMutationTargetThreeStatus() {",
      2539: "export function buildPhase2509TwentyFiveMutationTargetFourStatus() {",
      2540: "export function buildPhase2510TwentyFiveMutationTargetFiveStatus() {",
      2568: "export function buildPhase2537TwentySixMutationTargetTwoStatus() {",
      2569: "export function buildPhase2538TwentySixMutationTargetThreeStatus() {",
      2570: "export function buildPhase2539TwentySixMutationTargetFourStatus() {",
      2571: "export function buildPhase2540TwentySixMutationTargetFiveStatus() {",
    };`,
  );

  text = replaceAll(text, "tmp/phase2531-2561-proposals", "tmp/phase2562-2593-proposals");
  text = replaceAllIfPresent(
    text,
    "Phase2531A-2561A Controlled Twenty-Six Tool Mutation Evidence",
    "Phase2562A-2593A Controlled Twenty-Seven Tool Mutation Evidence",
  );
  text = replaceAll(text, "Phase2531A-2561A Controlled Twenty-Six Tool Mutation", "Phase2562A-2593A Controlled Twenty-Seven Tool Mutation");
  text = replaceAll(text, "phase2531-2561-controlled-twenty-six-tool-mutation", "phase2562-2593-controlled-twenty-seven-tool-mutation");
  text = replaceAllIfPresent(text, "verify:phase2531-2561-controlled-twenty-six-tool-mutation", "verify:phase2562-2593-controlled-twenty-seven-tool-mutation");
  text = replaceAllIfPresent(text, "apply:phase2531-2561-controlled-twenty-six-tool-mutation", "apply:phase2562-2593-controlled-twenty-seven-tool-mutation");
  text = replaceAllIfPresent(text, "smoke:phase2531-2561-controlled-twenty-six-tool-mutation", "smoke:phase2562-2593-controlled-twenty-seven-tool-mutation");
  text = replaceAll(text, "from twenty-five files to twenty-six files", "from twenty-six files to twenty-seven files");
  text = replaceAll(text, "support twenty-six bounded local smoke commands", "support twenty-seven bounded local smoke commands");
  text = replaceAll(text, "The twenty-six mutation batch must prove:", "The twenty-seven mutation batch must prove:");
  text = replaceAll(text, "the twenty-six target markers are not present", "the twenty-seven target markers are not present");
  text = replaceAllIfPresent(text, "- Applies exactly twenty-six existing source-file mutations.", "- Applies exactly twenty-seven existing source-file mutations.");
  text = replaceAllIfPresent(text, "current **controlled twenty-six tool mutation** batch", "current **controlled twenty-seven tool mutation** batch");
  text = replaceAllIfPresent(text, "runs local twenty-six smoke", "runs local twenty-seven smoke");

  text = replaceAllIfPresent(text, "twentySixMutationApplied", "twentySevenMutationApplied");
  text = replaceAllIfPresent(text, "localTwentySixSmokePassed", "localTwentySevenSmokePassed");
  text = replaceAllIfPresent(text, "twentySixRunnerReady", "twentySevenRunnerReady");
  text = replaceAllIfPresent(text, "restore-previous-content-twenty-six", "restore-previous-content-twenty-seven");
  text = replaceAllIfPresent(text, "twenty-six-smoke.json", "twenty-seven-smoke.json");
  text = replaceAllIfPresent(text, "controlled-twenty-six-tool-source-mutation", "controlled-twenty-seven-tool-source-mutation");
  text = replaceAllIfPresent(text, "changed_file_count_twenty_six", "changed_file_count_twenty_seven");
  text = replaceAllIfPresent(text, "rollback_restore_twenty_six", "rollback_restore_twenty_seven");
  text = replaceAllIfPresent(text, "rollback_twenty_six_entries", "rollback_twenty_seven_entries");
  text = replaceAllIfPresent(text, "docs_mentions_twenty_six", "docs_mentions_twenty_seven");
  text = replaceAllIfPresent(text, "twenty_six_mutation_applied", "twenty_seven_mutation_applied");
  text = replaceAllIfPresent(text, "twentySixMutationReady", "twentySevenMutationReady");
  text = replaceAllIfPresent(text, 'docs.includes("controlled twenty-six tool mutation")', 'docs.includes("controlled twenty-seven tool mutation")');
  text = replaceAllIfPresent(text, '"twenty_six_mutation_node_check_or_smoke_failed"', '"twenty_seven_mutation_node_check_or_smoke_failed"');

  text = replaceAllIfPresent(text, "result.changedFileCount === 26", "result.changedFileCount === 27");
  text = replaceAllIfPresent(text, "rollback.files.length === 26", "rollback.files.length === 27");
  text = replaceAllIfPresent(text, "changedFileCount: result?.changedFileCount ?? 26", "changedFileCount: result?.changedFileCount ?? 27");
  text = replaceAllIfPresent(text, "expectedOperationCount: 26", "expectedOperationCount: 27");
  text = replaceAllIfPresent(text, "expectedMaxChangedFiles: 26", "expectedMaxChangedFiles: 27");
  text = replaceAllIfPresent(text, "maxChangedFiles: 26,", "maxChangedFiles: 27,");

  text = replaceAllIfPresent(
    text,
    `const phase2530 = readJson("\${previousPhaseMeta.resultPath}") || {};`,
    `const phase2561 = readJson("\${previousPhaseMeta.resultPath}") || {};`,
  );
  text = replaceAllIfPresent(
    text,
    `check("\${previousPhaseMeta.sealCheckId}", phase2530.recommendedSealed === true && phase2530.\${previousPhaseMeta.sealCheckField} === true);`,
    `check("\${previousPhaseMeta.sealCheckId}", phase2561.recommendedSealed === true && phase2561.\${previousPhaseMeta.sealCheckField} === true);`,
  );
  text = replaceAllIfPresent(text, "phase2530Sealed", "phase2561Sealed");
  text = replaceAllIfPresent(text, "phase2530.recommendedSealed", "phase2561.recommendedSealed");

  text = replaceAllIfPresent(
    text,
    `const previousPhaseMeta = {
  phaseId: "Phase2531A-2561A-Controlled-Twenty-Six-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2562-2593-controlled-twenty-seven-tool-mutation/result.json",
  sealCheckId: "phase2561_sealed",
  sealCheckField: "twentySevenMutationApplied",
  sealCheckBlocker: "phase2561_not_sealed",
};`,
    `const previousPhaseMeta = {
  phaseId: "Phase2531A-2561A-Controlled-Twenty-Six-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2531-2561-controlled-twenty-six-tool-mutation/result.json",
  sealCheckId: "phase2561_sealed",
  sealCheckField: "twentySixMutationApplied",
  sealCheckBlocker: "phase2561_not_sealed",
};`,
  );
  text = replaceAllIfPresent(
    text,
    "Phase2531A-2561A extends the controlled local mutation line from twenty-six files to twenty-seven files",
    "Phase2562A-2593A extends the controlled local mutation line from twenty-six files to twenty-seven files",
  );
  text = replaceAllIfPresent(text, "- Requires Phase2501A-2530A sealed evidence.", "- Requires Phase2531A-2561A sealed evidence.");

  await writeFile(targetPath, text, "utf8");
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
