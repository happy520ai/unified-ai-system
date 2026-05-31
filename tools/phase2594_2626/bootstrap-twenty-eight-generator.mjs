import { readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase2562_2593/generate-twenty-seven-phase-assets.mjs";
const targetPath = "tools/phase2594_2626/generate-twenty-eight-phase-assets.mjs";

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
  );

  text = replaceOne(
    text,
    `const previousPhaseMeta = {
  phaseId: "Phase2531A-2561A-Controlled-Twenty-Six-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2531-2561-controlled-twenty-six-tool-mutation/result.json",
  sealCheckId: "phase2561_sealed",
  sealCheckField: "twentySixMutationApplied",
  sealCheckBlocker: "phase2561_not_sealed",
};`,
    `const previousPhaseMeta = {
  phaseId: "Phase2562A-2593A-Controlled-Twenty-Seven-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2562-2593-controlled-twenty-seven-tool-mutation/result.json",
  sealCheckId: "phase2593_sealed",
  sealCheckField: "twentySevenMutationApplied",
  sealCheckBlocker: "phase2593_not_sealed",
};`,
  );

  text = replaceOne(
    text,
    `  "TwentySix",
  "TwentySeven",
];`,
    `  "TwentySix",
  "TwentySeven",
  "TwentyEight",
];`,
  );

  text = replaceOne(
    text,
    `  "tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs",
  "tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs",
];`,
    `  "tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs",
  "tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs",
  "tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs",
];`,
  );

  text = replaceOne(
    text,
    `const twentyFiveTargets = buildTwentyFiveTargets(twentyFourTargets);
const twentySixTargets = buildTwentySixTargets(twentyFiveTargets);
const targets = buildTwentySevenTargets(twentySixTargets);
`,
    `const twentyFiveTargets = buildTwentyFiveTargets(twentyFourTargets);
const twentySixTargets = buildTwentySixTargets(twentyFiveTargets);
const twentySevenTargets = buildTwentySevenTargets(twentySixTargets);
const targets = buildTwentyEightTargets(twentySevenTargets);
`,
  );

  text = replaceOne(
    text,
    `  return upgraded;
}

const phase2091Checks = [`,
    `  return upgraded;
}

function buildTwentyEightTargets(previousTargets) {
  const upgraded = previousTargets.map((target) => {
    const idx = target.idx;
    const phase = 2598 + idx;
    const titleWord = titleWords[idx - 1];
    const word = wordNames[idx - 1];
    const marker = \`PHASE\${phase}_TWENTY_EIGHT_TOOL_TARGET_\${word.replace(/-/g, "_").toUpperCase()}_OK\`;
    const previousMarkerField = \`phase\${target.phase}Marker\`;
    const next = {
      ...target,
      phase,
      word,
      targetName: \`target-\${word}\`,
      proposal: \`docs/phase\${phase}-twenty-eight-tool-mutation-target-\${word}.proposal.diff\`,
      newExport:
        idx === 28
          ? "buildPhase2626TwentyEightMutationRuntimeStatus"
          : \`buildPhase\${phase}TwentyEightMutationTarget\${titleWord}Status\`,
      newPhaseId:
        idx === 28
          ? "Phase2626A-Controlled-Twenty-Eight-Tool-Mutation-Target-Twenty-Eight"
          : \`Phase\${phase}A-Controlled-Twenty-Eight-Tool-Mutation-Target-\${word.replace(/(^|-)([a-z])/g, (_, prefix, char) => \`\${prefix === "-" ? "-" : ""}\${char.toUpperCase()}\`)}\`,
      marker,
      referenceMarkers: [...target.referenceMarkers, target.marker],
      referenceFields: [...target.referenceFields, previousMarkerField],
      requiredExports:
        idx === 1
          ? [\`export function \${idx === 28 ? "buildPhase2626TwentyEightMutationRuntimeStatus" : \`buildPhase\${phase}TwentyEightMutationTarget\${titleWord}Status\`}\`]
          : [
              \`export function \${idx === 28 ? "buildPhase2626TwentyEightMutationRuntimeStatus" : \`buildPhase\${phase}TwentyEightMutationTarget\${titleWord}Status\`}\`,
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

  const previousRuntimeTarget = previousTargets[26];
  const twentyEightPhase = 2626;
  const twentyEightMarker = "PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK";
  upgraded.push({
    idx: 28,
    phase: twentyEightPhase,
    word: "twenty-eight",
    targetName: "target-twenty-eight",
    path: sourceTargetPaths[27],
    proposal: "docs/phase2626-twenty-eight-tool-mutation-target-twenty-eight.proposal.diff",
    addMode: "append-export",
    newExport: "buildPhase2626TwentyEightMutationRuntimeStatus",
    newPhaseId: "Phase2626A-Controlled-Twenty-Eight-Tool-Mutation-Target-Twenty-Eight",
    marker: twentyEightMarker,
    referenceMarkers: [...previousRuntimeTarget.referenceMarkers, previousRuntimeTarget.marker],
    referenceFields: [...previousRuntimeTarget.referenceFields, \`phase\${previousRuntimeTarget.phase}Marker\`],
    requiredExports: ["export function buildPhase2626TwentyEightMutationRuntimeStatus", "export function main"],
    requiredMarkers: [...new Set([...previousRuntimeTarget.requiredMarkers, previousRuntimeTarget.marker, twentyEightMarker])],
    runnerReady: true,
  });

  return upgraded;
}

const phase2091Checks = [`,
  );

  text = replaceOne(
    text,
    `      2568: "export function buildPhase2537TwentySixMutationTargetTwoStatus() {",
      2569: "export function buildPhase2538TwentySixMutationTargetThreeStatus() {",
      2570: "export function buildPhase2539TwentySixMutationTargetFourStatus() {",
      2571: "export function buildPhase2540TwentySixMutationTargetFiveStatus() {",
    };`,
    `      2568: "export function buildPhase2537TwentySixMutationTargetTwoStatus() {",
      2569: "export function buildPhase2538TwentySixMutationTargetThreeStatus() {",
      2570: "export function buildPhase2539TwentySixMutationTargetFourStatus() {",
      2571: "export function buildPhase2540TwentySixMutationTargetFiveStatus() {",
      2600: "export function buildPhase2568TwentySevenMutationTargetTwoStatus() {",
      2601: "export function buildPhase2569TwentySevenMutationTargetThreeStatus() {",
      2602: "export function buildPhase2570TwentySevenMutationTargetFourStatus() {",
      2603: "export function buildPhase2571TwentySevenMutationTargetFiveStatus() {",
    };`,
  );

  text = replaceAll(text, "tmp/phase2562-2593-proposals", "tmp/phase2594-2626-proposals");
  text = replaceAllIfPresent(
    text,
    "Phase2562A-2593A Controlled Twenty-Seven Tool Mutation Evidence",
    "Phase2594A-2626A Controlled Twenty-Eight Tool Mutation Evidence",
  );
  text = replaceAll(text, "Phase2562A-2593A Controlled Twenty-Seven Tool Mutation", "Phase2594A-2626A Controlled Twenty-Eight Tool Mutation");
  text = replaceAll(text, "phase2562-2593-controlled-twenty-seven-tool-mutation", "phase2594-2626-controlled-twenty-eight-tool-mutation");
  text = replaceAllIfPresent(text, "verify:phase2562-2593-controlled-twenty-seven-tool-mutation", "verify:phase2594-2626-controlled-twenty-eight-tool-mutation");
  text = replaceAllIfPresent(text, "apply:phase2562-2593-controlled-twenty-seven-tool-mutation", "apply:phase2594-2626-controlled-twenty-eight-tool-mutation");
  text = replaceAllIfPresent(text, "smoke:phase2562-2593-controlled-twenty-seven-tool-mutation", "smoke:phase2594-2626-controlled-twenty-eight-tool-mutation");
  text = replaceAll(text, "from twenty-six files to twenty-seven files", "from twenty-seven files to twenty-eight files");
  text = replaceAll(text, "support twenty-seven bounded local smoke commands", "support twenty-eight bounded local smoke commands");
  text = replaceAll(text, "The twenty-seven mutation batch must prove:", "The twenty-eight mutation batch must prove:");
  text = replaceAll(text, "the twenty-seven target markers are not present", "the twenty-eight target markers are not present");
  text = replaceAllIfPresent(text, "- Applies exactly twenty-seven existing source-file mutations.", "- Applies exactly twenty-eight existing source-file mutations.");
  text = replaceAllIfPresent(text, "current **controlled twenty-seven tool mutation** batch", "current **controlled twenty-eight tool mutation** batch");
  text = replaceAllIfPresent(text, "runs local twenty-seven smoke", "runs local twenty-eight smoke");

  text = replaceAllIfPresent(text, "twentySevenMutationApplied", "twentyEightMutationApplied");
  text = replaceAllIfPresent(text, "localTwentySevenSmokePassed", "localTwentyEightSmokePassed");
  text = replaceAllIfPresent(text, "twentySevenRunnerReady", "twentyEightRunnerReady");
  text = replaceAllIfPresent(text, "restore-previous-content-twenty-seven", "restore-previous-content-twenty-eight");
  text = replaceAllIfPresent(text, "twenty-seven-smoke.json", "twenty-eight-smoke.json");
  text = replaceAllIfPresent(text, "controlled-twenty-seven-tool-source-mutation", "controlled-twenty-eight-tool-source-mutation");
  text = replaceAllIfPresent(text, "changed_file_count_twenty_seven", "changed_file_count_twenty_eight");
  text = replaceAllIfPresent(text, "rollback_restore_twenty_seven", "rollback_restore_twenty_eight");
  text = replaceAllIfPresent(text, "rollback_twenty_seven_entries", "rollback_twenty_eight_entries");
  text = replaceAllIfPresent(text, "docs_mentions_twenty_seven", "docs_mentions_twenty_eight");
  text = replaceAllIfPresent(text, "twenty_seven_mutation_applied", "twenty_eight_mutation_applied");
  text = replaceAllIfPresent(text, "twentySevenMutationReady", "twentyEightMutationReady");
  text = replaceAllIfPresent(text, 'docs.includes("controlled twenty-seven tool mutation")', 'docs.includes("controlled twenty-eight tool mutation")');
  text = replaceAllIfPresent(text, '"twenty_seven_mutation_node_check_or_smoke_failed"', '"twenty_eight_mutation_node_check_or_smoke_failed"');

  text = replaceAllIfPresent(text, "result.changedFileCount === 27", "result.changedFileCount === 28");
  text = replaceAllIfPresent(text, "rollback.files.length === 27", "rollback.files.length === 28");
  text = replaceAllIfPresent(text, "changedFileCount: result?.changedFileCount ?? 27", "changedFileCount: result?.changedFileCount ?? 28");
  text = replaceAllIfPresent(text, "expectedOperationCount: 27", "expectedOperationCount: 28");
  text = replaceAllIfPresent(text, "expectedMaxChangedFiles: 27", "expectedMaxChangedFiles: 28");
  text = replaceAllIfPresent(text, "maxChangedFiles: 27,", "maxChangedFiles: 28,");

  text = replaceAllIfPresent(text, "const phase2561 = readJson(\"${previousPhaseMeta.resultPath}\") || {};", "const phase2593 = readJson(\"${previousPhaseMeta.resultPath}\") || {};");
  text = replaceAllIfPresent(text, "phase2561.recommendedSealed", "phase2593.recommendedSealed");
  text = replaceAllIfPresent(text, "phase2561.${previousPhaseMeta.sealCheckField}", "phase2593.${previousPhaseMeta.sealCheckField}");
  text = replaceAllIfPresent(text, "phase2561Sealed", "phase2593Sealed");
  text = replaceAllIfPresent(text, "phase2561_not_sealed", "phase2593_not_sealed");
  text = replaceAllIfPresent(text, "Phase2562A-2593A extends the controlled local mutation line from twenty-seven files to twenty-eight files", "Phase2594A-2626A extends the controlled local mutation line from twenty-seven files to twenty-eight files");
  text = replaceAllIfPresent(text, "- Requires Phase2531A-2561A sealed evidence.", "- Requires Phase2562A-2593A sealed evidence.");

  text = replaceAllIfPresent(
    text,
    `const previousPhaseMeta = {
  phaseId: "Phase2562A-2593A-Controlled-Twenty-Seven-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2594-2626-controlled-twenty-eight-tool-mutation/result.json",
  sealCheckId: "phase2593_sealed",
  sealCheckField: "twentyEightMutationApplied",
  sealCheckBlocker: "phase2593_not_sealed",
};`,
    `const previousPhaseMeta = {
  phaseId: "Phase2562A-2593A-Controlled-Twenty-Seven-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2562-2593-controlled-twenty-seven-tool-mutation/result.json",
  sealCheckId: "phase2593_sealed",
  sealCheckField: "twentySevenMutationApplied",
  sealCheckBlocker: "phase2593_not_sealed",
};`,
  );

  await writeFile(targetPath, text, "utf8");
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
