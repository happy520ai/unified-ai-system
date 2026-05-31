import { readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase2501_2530/generate-twenty-five-phase-assets.mjs";
const targetPath = "tools/phase2531_2561/generate-twenty-six-phase-assets.mjs";

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
  phaseId: "Phase2501A-2530A-Controlled-Twenty-Five-Tool-Mutation",
  docPath: "docs/phase2501-2530-controlled-twenty-five-tool-mutation.md",
  approvalPath: "docs/phase2501-2530-controlled-twenty-five-tool-mutation-approval.example.json",
  runnerPath: "tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs",
  verifierPath: "tools/phase2501_2530/validate-controlled-twenty-five-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase2501-2530-controlled-twenty-five-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2501-2530-controlled-twenty-five-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase2501-2530-controlled-twenty-five-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase2501-2530-controlled-twenty-five-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase2501-2530-controlled-twenty-five-tool-mutation/twenty-five-smoke.json",
  permissionMode: "controlled-twenty-five-tool-source-mutation",
  label: "twenty-five",
  runnerReadyField: "twentyFiveRunnerReady",
  appliedField: "twentyFiveMutationApplied",
  smokeField: "localTwentyFiveSmokePassed",
  rollbackAction: "restore-previous-content-twenty-five",
  verifyScript: "verify:phase2501-2530-controlled-twenty-five-tool-mutation",
  applyScript: "apply:phase2501-2530-controlled-twenty-five-tool-mutation",
  smokeScript: "smoke:phase2501-2530-controlled-twenty-five-tool-mutation",
};`,
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
  );

  text = replaceOne(
    text,
    `const previousPhaseMeta = {
  phaseId: "Phase2472A-2500A-Controlled-Twenty-Four-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2472-2500-controlled-twenty-four-tool-mutation/result.json",
  sealCheckId: "phase2500_sealed",
  sealCheckField: "twentyFourMutationApplied",
  sealCheckBlocker: "phase2500_not_sealed",
};`,
    `const previousPhaseMeta = {
  phaseId: "Phase2501A-2530A-Controlled-Twenty-Five-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2501-2530-controlled-twenty-five-tool-mutation/result.json",
  sealCheckId: "phase2530_sealed",
  sealCheckField: "twentyFiveMutationApplied",
  sealCheckBlocker: "phase2530_not_sealed",
};`,
  );

  text = replaceOne(
    text,
    `  "TwentyFour",
  "TwentyFive",
];`,
    `  "TwentyFour",
  "TwentyFive",
  "TwentySix",
];`,
  );

  text = replaceOne(
    text,
    `  "tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs",
  "tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs",
];`,
    `  "tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs",
  "tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs",
  "tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs",
];`,
  );

  text = replaceOne(
    text,
    `const twentyThreeTargets = buildTwentyThreeTargets(twentyTwoTargets);
const twentyFourTargets = buildTwentyFourTargets(twentyThreeTargets);
const targets = buildTwentyFiveTargets(twentyFourTargets);
`,
    `const twentyThreeTargets = buildTwentyThreeTargets(twentyTwoTargets);
const twentyFourTargets = buildTwentyFourTargets(twentyThreeTargets);
const twentyFiveTargets = buildTwentyFiveTargets(twentyFourTargets);
const targets = buildTwentySixTargets(twentyFiveTargets);
`,
  );

  text = replaceOne(
    text,
    `  return upgraded;
}

const phase2091Checks = [`,
    `  return upgraded;
}

function buildTwentySixTargets(previousTargets) {
  const upgraded = previousTargets.map((target) => {
    const idx = target.idx;
    const phase = 2535 + idx;
    const titleWord = titleWords[idx - 1];
    const word = wordNames[idx - 1];
    const marker = \`PHASE\${phase}_TWENTY_SIX_TOOL_TARGET_\${word.replace(/-/g, "_").toUpperCase()}_OK\`;
    const previousMarkerField = \`phase\${target.phase}Marker\`;
    const next = {
      ...target,
      phase,
      word,
      targetName: \`target-\${word}\`,
      proposal: \`docs/phase\${phase}-twenty-six-tool-mutation-target-\${word}.proposal.diff\`,
      newExport:
        idx === 26
          ? "buildPhase2561TwentySixMutationRuntimeStatus"
          : \`buildPhase\${phase}TwentySixMutationTarget\${titleWord}Status\`,
      newPhaseId:
        idx === 26
          ? "Phase2561A-Controlled-Twenty-Six-Tool-Mutation-Target-Twenty-Six"
          : \`Phase\${phase}A-Controlled-Twenty-Six-Tool-Mutation-Target-\${word.replace(/(^|-)([a-z])/g, (_, prefix, char) => \`\${prefix === "-" ? "-" : ""}\${char.toUpperCase()}\`)}\`,
      marker,
      referenceMarkers: [...target.referenceMarkers, target.marker],
      referenceFields: [...target.referenceFields, previousMarkerField],
      requiredExports:
        idx === 1
          ? [\`export function \${idx === 26 ? "buildPhase2561TwentySixMutationRuntimeStatus" : \`buildPhase\${phase}TwentySixMutationTarget\${titleWord}Status\`}\`]
          : [
              \`export function \${idx === 26 ? "buildPhase2561TwentySixMutationRuntimeStatus" : \`buildPhase\${phase}TwentySixMutationTarget\${titleWord}Status\`}\`,
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

  const previousRuntimeTarget = previousTargets[24];
  const twentySixPhase = 2561;
  const twentySixMarker = "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK";
  upgraded.push({
    idx: 26,
    phase: twentySixPhase,
    word: "twenty-six",
    targetName: "target-twenty-six",
    path: sourceTargetPaths[25],
    proposal: "docs/phase2561-twenty-six-tool-mutation-target-twenty-six.proposal.diff",
    addMode: "append-export",
    newExport: "buildPhase2561TwentySixMutationRuntimeStatus",
    newPhaseId: "Phase2561A-Controlled-Twenty-Six-Tool-Mutation-Target-Twenty-Six",
    marker: twentySixMarker,
    referenceMarkers: [...previousRuntimeTarget.referenceMarkers, previousRuntimeTarget.marker],
    referenceFields: [...previousRuntimeTarget.referenceFields, \`phase\${previousRuntimeTarget.phase}Marker\`],
    requiredExports: ["export function buildPhase2561TwentySixMutationRuntimeStatus", "export function main"],
    requiredMarkers: [...new Set([...previousRuntimeTarget.requiredMarkers, previousRuntimeTarget.marker, twentySixMarker])],
    runnerReady: true,
  });

  return upgraded;
}

const phase2091Checks = [`,
  );

  text = replaceOne(
    text,
    `      2507: "export function buildPhase2478TwentyFourMutationTargetTwoStatus() {",
      2508: "export function buildPhase2479TwentyFourMutationTargetThreeStatus() {",
      2509: "export function buildPhase2480TwentyFourMutationTargetFourStatus() {",
      2510: "export function buildPhase2481TwentyFourMutationTargetFiveStatus() {",
    };`,
    `      2507: "export function buildPhase2478TwentyFourMutationTargetTwoStatus() {",
      2508: "export function buildPhase2479TwentyFourMutationTargetThreeStatus() {",
      2509: "export function buildPhase2480TwentyFourMutationTargetFourStatus() {",
      2510: "export function buildPhase2481TwentyFourMutationTargetFiveStatus() {",
      2537: "export function buildPhase2507TwentyFiveMutationTargetTwoStatus() {",
      2538: "export function buildPhase2508TwentyFiveMutationTargetThreeStatus() {",
      2539: "export function buildPhase2509TwentyFiveMutationTargetFourStatus() {",
      2540: "export function buildPhase2510TwentyFiveMutationTargetFiveStatus() {",
    };`,
  );

  text = replaceAll(text, "tmp/phase2501-2530-proposals", "tmp/phase2531-2561-proposals");
  text = replaceAllIfPresent(
    text,
    "Phase2501A-2530A Controlled Twenty-Five Tool Mutation Evidence",
    "Phase2531A-2561A Controlled Twenty-Six Tool Mutation Evidence",
  );
  text = replaceAll(text, "Phase2501A-2530A Controlled Twenty-Five Tool Mutation", "Phase2531A-2561A Controlled Twenty-Six Tool Mutation");
  text = replaceAll(text, "phase2501-2530-controlled-twenty-five-tool-mutation", "phase2531-2561-controlled-twenty-six-tool-mutation");
  text = replaceAllIfPresent(text, "verify:phase2501-2530-controlled-twenty-five-tool-mutation", "verify:phase2531-2561-controlled-twenty-six-tool-mutation");
  text = replaceAllIfPresent(text, "apply:phase2501-2530-controlled-twenty-five-tool-mutation", "apply:phase2531-2561-controlled-twenty-six-tool-mutation");
  text = replaceAllIfPresent(text, "smoke:phase2501-2530-controlled-twenty-five-tool-mutation", "smoke:phase2531-2561-controlled-twenty-six-tool-mutation");
  text = replaceAll(text, "from twenty-four files to twenty-five files", "from twenty-five files to twenty-six files");
  text = replaceAll(text, "support twenty-five bounded local smoke commands", "support twenty-six bounded local smoke commands");
  text = replaceAll(text, "The twenty-five mutation batch must prove:", "The twenty-six mutation batch must prove:");
  text = replaceAll(text, "the twenty-five target markers are not present", "the twenty-six target markers are not present");
  text = replaceAllIfPresent(
    text,
    "Phase2501A-2530A extends the controlled local mutation line from twenty-five files to twenty-six files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.",
    "Phase2531A-2561A extends the controlled local mutation line from twenty-five files to twenty-six files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.",
  );
  text = replaceAllIfPresent(text, "- Applies exactly twenty-five existing source-file mutations.", "- Applies exactly twenty-six existing source-file mutations.");
  text = replaceAllIfPresent(text, "current **controlled twenty-five tool mutation** batch", "current **controlled twenty-six tool mutation** batch");
  text = replaceAllIfPresent(text, "runs local twenty-five smoke", "runs local twenty-six smoke");
  text = replaceAllIfPresent(text, "a twenty-six-file bounded batch", "a twenty-seven-file bounded batch");

  text = replaceAllIfPresent(text, "twentyFiveMutationApplied", "twentySixMutationApplied");
  text = replaceAllIfPresent(text, "localTwentyFiveSmokePassed", "localTwentySixSmokePassed");
  text = replaceAllIfPresent(text, "twentyFiveRunnerReady", "twentySixRunnerReady");
  text = replaceAllIfPresent(text, "restore-previous-content-twenty-five", "restore-previous-content-twenty-six");
  text = replaceAllIfPresent(text, "twenty-five-smoke.json", "twenty-six-smoke.json");
  text = replaceAllIfPresent(text, "controlled-twenty-five-tool-source-mutation", "controlled-twenty-six-tool-source-mutation");
  text = replaceAllIfPresent(text, "changed_file_count_twenty_five", "changed_file_count_twenty_six");
  text = replaceAllIfPresent(text, "rollback_restore_twenty_five", "rollback_restore_twenty_six");
  text = replaceAllIfPresent(text, "rollback_twenty_five_entries", "rollback_twenty_six_entries");
  text = replaceAllIfPresent(text, "docs_mentions_twenty_five", "docs_mentions_twenty_six");
  text = replaceAllIfPresent(text, "twenty_five_mutation_applied", "twenty_six_mutation_applied");
  text = replaceAllIfPresent(text, "twentyFiveMutationReady", "twentySixMutationReady");
  text = replaceAllIfPresent(text, 'docs.includes("controlled twenty-five tool mutation")', 'docs.includes("controlled twenty-six tool mutation")');
  text = replaceAllIfPresent(text, '"twenty_five_mutation_node_check_or_smoke_failed"', '"twenty_six_mutation_node_check_or_smoke_failed"');

  text = replaceAllIfPresent(text, "result.changedFileCount === 25", "result.changedFileCount === 26");
  text = replaceAllIfPresent(text, "rollback.files.length === 25", "rollback.files.length === 26");
  text = replaceAllIfPresent(text, "changedFileCount: result?.changedFileCount ?? 25", "changedFileCount: result?.changedFileCount ?? 26");
  text = replaceAllIfPresent(text, "expectedOperationCount: 25", "expectedOperationCount: 26");
  text = replaceAllIfPresent(text, "expectedMaxChangedFiles: 25", "expectedMaxChangedFiles: 26");
  text = replaceAllIfPresent(text, "maxChangedFiles: 25,", "maxChangedFiles: 26,");

  text = replaceAllIfPresent(
    text,
    `const phase2500 = readJson("\${previousPhaseMeta.resultPath}") || {};`,
    `const phase2530 = readJson("\${previousPhaseMeta.resultPath}") || {};`,
  );
  text = replaceAllIfPresent(
    text,
    `check("\${previousPhaseMeta.sealCheckId}", phase2500.recommendedSealed === true && phase2500.\${previousPhaseMeta.sealCheckField} === true);`,
    `check("\${previousPhaseMeta.sealCheckId}", phase2530.recommendedSealed === true && phase2530.\${previousPhaseMeta.sealCheckField} === true);`,
  );
  text = replaceAllIfPresent(text, "phase2500Sealed", "phase2530Sealed");
  text = replaceAllIfPresent(text, "phase2500.recommendedSealed", "phase2530.recommendedSealed");

  text = replaceAllIfPresent(
    text,
    `const previousPhaseMeta = {
  phaseId: "Phase2501A-2530A-Controlled-Twenty-Five-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2531-2561-controlled-twenty-six-tool-mutation/result.json",
  sealCheckId: "phase2530_sealed",
  sealCheckField: "twentySixMutationApplied",
  sealCheckBlocker: "phase2530_not_sealed",
};`,
    `const previousPhaseMeta = {
  phaseId: "Phase2501A-2530A-Controlled-Twenty-Five-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2501-2530-controlled-twenty-five-tool-mutation/result.json",
  sealCheckId: "phase2530_sealed",
  sealCheckField: "twentyFiveMutationApplied",
  sealCheckBlocker: "phase2530_not_sealed",
};`,
  );

  text = replaceAllIfPresent(text, "- Requires Phase2472A-2500A sealed evidence.", "- Requires Phase2501A-2530A sealed evidence.");

  await writeFile(targetPath, text, "utf8");
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
