import { readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase2444_2471/generate-twenty-three-phase-assets.mjs";
const targetPath = "tools/phase2472_2500/generate-twenty-four-phase-assets.mjs";

function replaceOne(text, search, replacement) {
  if (!text.includes(search)) {
    throw new Error(`missing_replace_target:${search}`);
  }
  return text.replace(search, replacement);
}

function replaceAll(text, search, replacement) {
  if (!text.includes(search)) {
    throw new Error(`missing_replace_all_target:${search}`);
  }
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
  phaseId: "Phase2444A-2471A-Controlled-Twenty-Three-Tool-Mutation",
  docPath: "docs/phase2444-2471-controlled-twenty-three-tool-mutation.md",
  approvalPath: "docs/phase2444-2471-controlled-twenty-three-tool-mutation-approval.example.json",
  runnerPath: "tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs",
  verifierPath: "tools/phase2444_2471/validate-controlled-twenty-three-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase2444-2471-controlled-twenty-three-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2444-2471-controlled-twenty-three-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase2444-2471-controlled-twenty-three-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase2444-2471-controlled-twenty-three-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase2444-2471-controlled-twenty-three-tool-mutation/twenty-three-smoke.json",
  permissionMode: "controlled-twenty-three-tool-source-mutation",
  label: "twenty-three",
  runnerReadyField: "twentyThreeRunnerReady",
  appliedField: "twentyThreeMutationApplied",
  smokeField: "localTwentyThreeSmokePassed",
  rollbackAction: "restore-previous-content-twenty-three",
  verifyScript: "verify:phase2444-2471-controlled-twenty-three-tool-mutation",
  applyScript: "apply:phase2444-2471-controlled-twenty-three-tool-mutation",
  smokeScript: "smoke:phase2444-2471-controlled-twenty-three-tool-mutation",
};`,
    `const phaseMeta = {
  phaseId: "Phase2472A-2500A-Controlled-Twenty-Four-Tool-Mutation",
  docPath: "docs/phase2472-2500-controlled-twenty-four-tool-mutation.md",
  approvalPath: "docs/phase2472-2500-controlled-twenty-four-tool-mutation-approval.example.json",
  runnerPath: "tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs",
  verifierPath: "tools/phase2472_2500/validate-controlled-twenty-four-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase2472-2500-controlled-twenty-four-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2472-2500-controlled-twenty-four-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase2472-2500-controlled-twenty-four-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase2472-2500-controlled-twenty-four-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase2472-2500-controlled-twenty-four-tool-mutation/twenty-four-smoke.json",
  permissionMode: "controlled-twenty-four-tool-source-mutation",
  label: "twenty-four",
  runnerReadyField: "twentyFourRunnerReady",
  appliedField: "twentyFourMutationApplied",
  smokeField: "localTwentyFourSmokePassed",
  rollbackAction: "restore-previous-content-twenty-four",
  verifyScript: "verify:phase2472-2500-controlled-twenty-four-tool-mutation",
  applyScript: "apply:phase2472-2500-controlled-twenty-four-tool-mutation",
  smokeScript: "smoke:phase2472-2500-controlled-twenty-four-tool-mutation",
};`,
  );

  text = replaceOne(
    text,
    `const previousPhaseMeta = {
  phaseId: "Phase2417A-2443A-Controlled-Twenty-Two-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2417-2443-controlled-twenty-two-tool-mutation/result.json",
  sealCheckId: "phase2443_sealed",
  sealCheckField: "twentyTwoMutationApplied",
  sealCheckBlocker: "phase2443_not_sealed",
};`,
    `const previousPhaseMeta = {
  phaseId: "Phase2444A-2471A-Controlled-Twenty-Three-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2444-2471-controlled-twenty-three-tool-mutation/result.json",
  sealCheckId: "phase2471_sealed",
  sealCheckField: "twentyThreeMutationApplied",
  sealCheckBlocker: "phase2471_not_sealed",
};`,
  );

  text = replaceOne(
    text,
    `  "TwentyTwo",
  "TwentyThree",
];`,
    `  "TwentyTwo",
  "TwentyThree",
  "TwentyFour",
];`,
  );

  text = replaceOne(
    text,
    `  "tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs",
  "tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs",
];`,
    `  "tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs",
  "tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs",
  "tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs",
];`,
  );

  text = replaceOne(
    text,
    `const twentyOneTargets = buildTwentyOneTargets(twentyTargets);
const twentyTwoTargets = buildTwentyTwoTargets(twentyOneTargets);
const targets = buildTwentyThreeTargets(twentyTwoTargets);
`,
    `const twentyOneTargets = buildTwentyOneTargets(twentyTargets);
const twentyTwoTargets = buildTwentyTwoTargets(twentyOneTargets);
const twentyThreeTargets = buildTwentyThreeTargets(twentyTwoTargets);
const targets = buildTwentyFourTargets(twentyThreeTargets);
`,
  );

  text = replaceOne(
    text,
    `  return upgraded;
}

const phase2091Checks = [`,
    `  return upgraded;
}

function buildTwentyFourTargets(previousTargets) {
  const upgraded = previousTargets.map((target) => {
    const idx = target.idx;
    const phase = 2476 + idx;
    const titleWord = titleWords[idx - 1];
    const word = wordNames[idx - 1];
    const marker = \`PHASE\${phase}_TWENTY_FOUR_TOOL_TARGET_\${word.replace(/-/g, "_").toUpperCase()}_OK\`;
    const previousMarkerField = \`phase\${target.phase}Marker\`;
    const next = {
      ...target,
      phase,
      word,
      targetName: \`target-\${word}\`,
      proposal: \`docs/phase\${phase}-twenty-four-tool-mutation-target-\${word}.proposal.diff\`,
      newExport:
        idx === 24
          ? "buildPhase2500TwentyFourMutationRuntimeStatus"
          : \`buildPhase\${phase}TwentyFourMutationTarget\${titleWord}Status\`,
      newPhaseId:
        idx === 24
          ? "Phase2500A-Controlled-Twenty-Four-Tool-Mutation-Target-Twenty-Four"
          : \`Phase\${phase}A-Controlled-Twenty-Four-Tool-Mutation-Target-\${word.replace(/(^|-)([a-z])/g, (_, prefix, char) => \`\${prefix === "-" ? "-" : ""}\${char.toUpperCase()}\`)}\`,
      marker,
      referenceMarkers: [...target.referenceMarkers, target.marker],
      referenceFields: [...target.referenceFields, previousMarkerField],
      requiredExports:
        idx === 1
          ? [\`export function \${idx === 24 ? "buildPhase2500TwentyFourMutationRuntimeStatus" : \`buildPhase\${phase}TwentyFourMutationTarget\${titleWord}Status\`}\`]
          : [
              \`export function \${idx === 24 ? "buildPhase2500TwentyFourMutationRuntimeStatus" : \`buildPhase\${phase}TwentyFourMutationTarget\${titleWord}Status\`}\`,
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

  const previousRuntimeTarget = previousTargets[22];
  const twentyFourPhase = 2500;
  const twentyFourMarker = "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK";
  upgraded.push({
    idx: 24,
    phase: twentyFourPhase,
    word: "twenty-four",
    targetName: "target-twenty-four",
    path: sourceTargetPaths[23],
    proposal: "docs/phase2500-twenty-four-tool-mutation-target-twenty-four.proposal.diff",
    addMode: "append-export",
    newExport: "buildPhase2500TwentyFourMutationRuntimeStatus",
    newPhaseId: "Phase2500A-Controlled-Twenty-Four-Tool-Mutation-Target-Twenty-Four",
    marker: twentyFourMarker,
    referenceMarkers: [...previousRuntimeTarget.referenceMarkers, previousRuntimeTarget.marker],
    referenceFields: [...previousRuntimeTarget.referenceFields, \`phase\${previousRuntimeTarget.phase}Marker\`],
    requiredExports: ["export function buildPhase2500TwentyFourMutationRuntimeStatus", "export function main"],
    requiredMarkers: [...new Set([...previousRuntimeTarget.requiredMarkers, previousRuntimeTarget.marker, twentyFourMarker])],
    runnerReady: true,
  });

  return upgraded;
}

const phase2091Checks = [`,
  );

  text = replaceOne(
    text,
    `      2450: "export function buildPhase2423TwentyTwoMutationTargetTwoStatus() {",
      2451: "export function buildPhase2424TwentyTwoMutationTargetThreeStatus() {",
      2452: "export function buildPhase2425TwentyTwoMutationTargetFourStatus() {",
      2453: "export function buildPhase2426TwentyTwoMutationTargetFiveStatus() {",
    };`,
    `      2450: "export function buildPhase2423TwentyTwoMutationTargetTwoStatus() {",
      2451: "export function buildPhase2424TwentyTwoMutationTargetThreeStatus() {",
      2452: "export function buildPhase2425TwentyTwoMutationTargetFourStatus() {",
      2453: "export function buildPhase2426TwentyTwoMutationTargetFiveStatus() {",
      2478: "export function buildPhase2450TwentyThreeMutationTargetTwoStatus() {",
      2479: "export function buildPhase2451TwentyThreeMutationTargetThreeStatus() {",
      2480: "export function buildPhase2452TwentyThreeMutationTargetFourStatus() {",
      2481: "export function buildPhase2453TwentyThreeMutationTargetFiveStatus() {",
    };`,
  );

  text = replaceAll(text, "tmp/phase2444-2471-proposals", "tmp/phase2472-2500-proposals");
  text = replaceAllIfPresent(
    text,
    "Phase2444A-2471A Controlled Twenty-Three Tool Mutation Evidence",
    "Phase2472A-2500A Controlled Twenty-Four Tool Mutation Evidence",
  );
  text = replaceAll(text, "Phase2444A-2471A Controlled Twenty-Three Tool Mutation", "Phase2472A-2500A Controlled Twenty-Four Tool Mutation");
  text = replaceAll(text, "phase2444-2471-controlled-twenty-three-tool-mutation", "phase2472-2500-controlled-twenty-four-tool-mutation");
  text = replaceAllIfPresent(
    text,
    "verify:phase2444-2471-controlled-twenty-three-tool-mutation",
    "verify:phase2472-2500-controlled-twenty-four-tool-mutation",
  );
  text = replaceAllIfPresent(
    text,
    "apply:phase2444-2471-controlled-twenty-three-tool-mutation",
    "apply:phase2472-2500-controlled-twenty-four-tool-mutation",
  );
  text = replaceAllIfPresent(
    text,
    "smoke:phase2444-2471-controlled-twenty-three-tool-mutation",
    "smoke:phase2472-2500-controlled-twenty-four-tool-mutation",
  );
  text = replaceAll(text, "from twenty-two files to twenty-three files", "from twenty-three files to twenty-four files");
  text = replaceAll(text, "support twenty-three bounded local smoke commands", "support twenty-four bounded local smoke commands");
  text = replaceAll(text, "The twenty-three mutation batch must prove:", "The twenty-four mutation batch must prove:");
  text = replaceAll(text, "the twenty-three target markers are not present", "the twenty-four target markers are not present");
  text = replaceAllIfPresent(
    text,
    "Phase2444A-2471A extends the controlled local mutation line from twenty-two files to twenty-three files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.",
    "Phase2472A-2500A extends the controlled local mutation line from twenty-three files to twenty-four files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.",
  );
  text = replaceAllIfPresent(
    text,
    "- Applies exactly twenty-three existing source-file mutations.",
    "- Applies exactly twenty-four existing source-file mutations.",
  );
  text = replaceAllIfPresent(text, "current **controlled twenty-three tool mutation** batch", "current **controlled twenty-four tool mutation** batch");
  text = replaceAllIfPresent(text, "runs local twenty-three smoke", "runs local twenty-four smoke");
  text = replaceAllIfPresent(text, "a twenty-four-file bounded batch", "a twenty-five-file bounded batch");

  text = replaceAllIfPresent(text, "twentyThreeMutationApplied", "twentyFourMutationApplied");
  text = replaceAllIfPresent(text, "localTwentyThreeSmokePassed", "localTwentyFourSmokePassed");
  text = replaceAllIfPresent(text, "twentyThreeRunnerReady", "twentyFourRunnerReady");
  text = replaceAllIfPresent(text, "restore-previous-content-twenty-three", "restore-previous-content-twenty-four");
  text = replaceAllIfPresent(text, "twenty-three-smoke.json", "twenty-four-smoke.json");
  text = replaceAllIfPresent(text, "controlled-twenty-three-tool-source-mutation", "controlled-twenty-four-tool-source-mutation");
  text = replaceAllIfPresent(text, "changed_file_count_twenty_three", "changed_file_count_twenty_four");
  text = replaceAllIfPresent(text, "rollback_restore_twenty_three", "rollback_restore_twenty_four");
  text = replaceAllIfPresent(text, "rollback_twenty_three_entries", "rollback_twenty_four_entries");
  text = replaceAllIfPresent(text, "docs_mentions_twenty_three", "docs_mentions_twenty_four");
  text = replaceAllIfPresent(text, "twenty_three_mutation_applied", "twenty_four_mutation_applied");
  text = replaceAllIfPresent(text, "twentyThreeMutationReady", "twentyFourMutationReady");
  text = replaceAllIfPresent(text, 'docs.includes("controlled twenty-three tool mutation")', 'docs.includes("controlled twenty-four tool mutation")');
  text = replaceAllIfPresent(text, '"twenty_three_mutation_node_check_or_smoke_failed"', '"twenty_four_mutation_node_check_or_smoke_failed"');

  text = replaceAllIfPresent(text, "result.changedFileCount === 23", "result.changedFileCount === 24");
  text = replaceAllIfPresent(text, "rollback.files.length === 23", "rollback.files.length === 24");
  text = replaceAllIfPresent(text, "changedFileCount: result?.changedFileCount ?? 23", "changedFileCount: result?.changedFileCount ?? 24");
  text = replaceAllIfPresent(text, "expectedOperationCount: 23", "expectedOperationCount: 24");
  text = replaceAllIfPresent(text, "expectedMaxChangedFiles: 23", "expectedMaxChangedFiles: 24");
  text = replaceAllIfPresent(text, "maxChangedFiles: 23,", "maxChangedFiles: 24,");

  text = replaceAllIfPresent(
    text,
    `const phase2443 = readJson("\${previousPhaseMeta.resultPath}") || {};`,
    `const phase2471 = readJson("\${previousPhaseMeta.resultPath}") || {};`,
  );
  text = replaceAllIfPresent(
    text,
    `check("\${previousPhaseMeta.sealCheckId}", phase2443.recommendedSealed === true && phase2443.\${previousPhaseMeta.sealCheckField} === true);`,
    `check("\${previousPhaseMeta.sealCheckId}", phase2471.recommendedSealed === true && phase2471.\${previousPhaseMeta.sealCheckField} === true);`,
  );
  text = replaceAllIfPresent(text, "phase2443Sealed", "phase2471Sealed");
  text = replaceAllIfPresent(text, "phase2416Sealed", "phase2471Sealed");
  text = replaceAllIfPresent(text, "phase2443.recommendedSealed", "phase2471.recommendedSealed");
  text = replaceAllIfPresent(text, "twenty-four-four", "twenty-four");

  text = replaceAllIfPresent(
    text,
    `const previousPhaseMeta = {
  phaseId: "Phase2444A-2471A-Controlled-Twenty-Three-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2472-2500-controlled-twenty-four-tool-mutation/result.json",
  sealCheckId: "phase2471_sealed",
  sealCheckField: "twentyFourMutationApplied",
  sealCheckBlocker: "phase2471_not_sealed",
};`,
    `const previousPhaseMeta = {
  phaseId: "Phase2444A-2471A-Controlled-Twenty-Three-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2444-2471-controlled-twenty-three-tool-mutation/result.json",
  sealCheckId: "phase2471_sealed",
  sealCheckField: "twentyThreeMutationApplied",
  sealCheckBlocker: "phase2471_not_sealed",
};`,
  );

  text = replaceAllIfPresent(
    text,
    "- Requires Phase2417A-2443A sealed evidence.",
    "- Requires Phase2444A-2471A sealed evidence.",
  );
  text = replaceAllIfPresent(
    text,
    "Phase2444A-2471A extends the controlled local mutation line from twenty-three files to twenty-four files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.",
    "Phase2472A-2500A extends the controlled local mutation line from twenty-three files to twenty-four files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.",
  );

  await writeFile(targetPath, text, "utf8");
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
