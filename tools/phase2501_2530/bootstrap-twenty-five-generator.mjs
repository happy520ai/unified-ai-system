import { readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase2472_2500/generate-twenty-four-phase-assets.mjs";
const targetPath = "tools/phase2501_2530/generate-twenty-five-phase-assets.mjs";

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
  );

  text = replaceOne(
    text,
    `const previousPhaseMeta = {
  phaseId: "Phase2444A-2471A-Controlled-Twenty-Three-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2444-2471-controlled-twenty-three-tool-mutation/result.json",
  sealCheckId: "phase2471_sealed",
  sealCheckField: "twentyThreeMutationApplied",
  sealCheckBlocker: "phase2471_not_sealed",
};`,
    `const previousPhaseMeta = {
  phaseId: "Phase2472A-2500A-Controlled-Twenty-Four-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2472-2500-controlled-twenty-four-tool-mutation/result.json",
  sealCheckId: "phase2500_sealed",
  sealCheckField: "twentyFourMutationApplied",
  sealCheckBlocker: "phase2500_not_sealed",
};`,
  );

  text = replaceOne(
    text,
    `  "TwentyThree",
  "TwentyFour",
];`,
    `  "TwentyThree",
  "TwentyFour",
  "TwentyFive",
];`,
  );

  text = replaceOne(
    text,
    `  "tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs",
  "tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs",
];`,
    `  "tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs",
  "tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs",
  "tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs",
];`,
  );

  text = replaceOne(
    text,
    `const twentyTwoTargets = buildTwentyTwoTargets(twentyOneTargets);
const twentyThreeTargets = buildTwentyThreeTargets(twentyTwoTargets);
const targets = buildTwentyFourTargets(twentyThreeTargets);
`,
    `const twentyTwoTargets = buildTwentyTwoTargets(twentyOneTargets);
const twentyThreeTargets = buildTwentyThreeTargets(twentyTwoTargets);
const twentyFourTargets = buildTwentyFourTargets(twentyThreeTargets);
const targets = buildTwentyFiveTargets(twentyFourTargets);
`,
  );

  text = replaceOne(
    text,
    `  return upgraded;
}

const phase2091Checks = [`,
    `  return upgraded;
}

function buildTwentyFiveTargets(previousTargets) {
  const upgraded = previousTargets.map((target) => {
    const idx = target.idx;
    const phase = 2505 + idx;
    const titleWord = titleWords[idx - 1];
    const word = wordNames[idx - 1];
    const marker = \`PHASE\${phase}_TWENTY_FIVE_TOOL_TARGET_\${word.replace(/-/g, "_").toUpperCase()}_OK\`;
    const previousMarkerField = \`phase\${target.phase}Marker\`;
    const next = {
      ...target,
      phase,
      word,
      targetName: \`target-\${word}\`,
      proposal: \`docs/phase\${phase}-twenty-five-tool-mutation-target-\${word}.proposal.diff\`,
      newExport:
        idx === 25
          ? "buildPhase2530TwentyFiveMutationRuntimeStatus"
          : \`buildPhase\${phase}TwentyFiveMutationTarget\${titleWord}Status\`,
      newPhaseId:
        idx === 25
          ? "Phase2530A-Controlled-Twenty-Five-Tool-Mutation-Target-Twenty-Five"
          : \`Phase\${phase}A-Controlled-Twenty-Five-Tool-Mutation-Target-\${word.replace(/(^|-)([a-z])/g, (_, prefix, char) => \`\${prefix === "-" ? "-" : ""}\${char.toUpperCase()}\`)}\`,
      marker,
      referenceMarkers: [...target.referenceMarkers, target.marker],
      referenceFields: [...target.referenceFields, previousMarkerField],
      requiredExports:
        idx === 1
          ? [\`export function \${idx === 25 ? "buildPhase2530TwentyFiveMutationRuntimeStatus" : \`buildPhase\${phase}TwentyFiveMutationTarget\${titleWord}Status\`}\`]
          : [
              \`export function \${idx === 25 ? "buildPhase2530TwentyFiveMutationRuntimeStatus" : \`buildPhase\${phase}TwentyFiveMutationTarget\${titleWord}Status\`}\`,
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

  const previousRuntimeTarget = previousTargets[23];
  const twentyFivePhase = 2530;
  const twentyFiveMarker = "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK";
  upgraded.push({
    idx: 25,
    phase: twentyFivePhase,
    word: "twenty-five",
    targetName: "target-twenty-five",
    path: sourceTargetPaths[24],
    proposal: "docs/phase2530-twenty-five-tool-mutation-target-twenty-five.proposal.diff",
    addMode: "append-export",
    newExport: "buildPhase2530TwentyFiveMutationRuntimeStatus",
    newPhaseId: "Phase2530A-Controlled-Twenty-Five-Tool-Mutation-Target-Twenty-Five",
    marker: twentyFiveMarker,
    referenceMarkers: [...previousRuntimeTarget.referenceMarkers, previousRuntimeTarget.marker],
    referenceFields: [...previousRuntimeTarget.referenceFields, \`phase\${previousRuntimeTarget.phase}Marker\`],
    requiredExports: ["export function buildPhase2530TwentyFiveMutationRuntimeStatus", "export function main"],
    requiredMarkers: [...new Set([...previousRuntimeTarget.requiredMarkers, previousRuntimeTarget.marker, twentyFiveMarker])],
    runnerReady: true,
  });

  return upgraded;
}

const phase2091Checks = [`,
  );

  text = replaceOne(
    text,
    `      2478: "export function buildPhase2450TwentyThreeMutationTargetTwoStatus() {",
      2479: "export function buildPhase2451TwentyThreeMutationTargetThreeStatus() {",
      2480: "export function buildPhase2452TwentyThreeMutationTargetFourStatus() {",
      2481: "export function buildPhase2453TwentyThreeMutationTargetFiveStatus() {",
    };`,
    `      2478: "export function buildPhase2450TwentyThreeMutationTargetTwoStatus() {",
      2479: "export function buildPhase2451TwentyThreeMutationTargetThreeStatus() {",
      2480: "export function buildPhase2452TwentyThreeMutationTargetFourStatus() {",
      2481: "export function buildPhase2453TwentyThreeMutationTargetFiveStatus() {",
      2507: "export function buildPhase2478TwentyFourMutationTargetTwoStatus() {",
      2508: "export function buildPhase2479TwentyFourMutationTargetThreeStatus() {",
      2509: "export function buildPhase2480TwentyFourMutationTargetFourStatus() {",
      2510: "export function buildPhase2481TwentyFourMutationTargetFiveStatus() {",
    };`,
  );

  text = replaceAll(text, "tmp/phase2472-2500-proposals", "tmp/phase2501-2530-proposals");
  text = replaceAllIfPresent(
    text,
    "Phase2472A-2500A Controlled Twenty-Four Tool Mutation Evidence",
    "Phase2501A-2530A Controlled Twenty-Five Tool Mutation Evidence",
  );
  text = replaceAll(text, "Phase2472A-2500A Controlled Twenty-Four Tool Mutation", "Phase2501A-2530A Controlled Twenty-Five Tool Mutation");
  text = replaceAll(text, "phase2472-2500-controlled-twenty-four-tool-mutation", "phase2501-2530-controlled-twenty-five-tool-mutation");
  text = replaceAllIfPresent(
    text,
    "verify:phase2472-2500-controlled-twenty-four-tool-mutation",
    "verify:phase2501-2530-controlled-twenty-five-tool-mutation",
  );
  text = replaceAllIfPresent(
    text,
    "apply:phase2472-2500-controlled-twenty-four-tool-mutation",
    "apply:phase2501-2530-controlled-twenty-five-tool-mutation",
  );
  text = replaceAllIfPresent(
    text,
    "smoke:phase2472-2500-controlled-twenty-four-tool-mutation",
    "smoke:phase2501-2530-controlled-twenty-five-tool-mutation",
  );
  text = replaceAll(text, "from twenty-three files to twenty-four files", "from twenty-four files to twenty-five files");
  text = replaceAll(text, "support twenty-four bounded local smoke commands", "support twenty-five bounded local smoke commands");
  text = replaceAll(text, "The twenty-four mutation batch must prove:", "The twenty-five mutation batch must prove:");
  text = replaceAll(text, "the twenty-four target markers are not present", "the twenty-five target markers are not present");
  text = replaceAllIfPresent(
    text,
    "Phase2472A-2500A extends the controlled local mutation line from twenty-four files to twenty-five files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.",
    "Phase2501A-2530A extends the controlled local mutation line from twenty-four files to twenty-five files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.",
  );
  text = replaceAllIfPresent(
    text,
    "- Applies exactly twenty-four existing source-file mutations.",
    "- Applies exactly twenty-five existing source-file mutations.",
  );
  text = replaceAllIfPresent(text, "current **controlled twenty-four tool mutation** batch", "current **controlled twenty-five tool mutation** batch");
  text = replaceAllIfPresent(text, "runs local twenty-four smoke", "runs local twenty-five smoke");
  text = replaceAllIfPresent(text, "a twenty-five-file bounded batch", "a twenty-six-file bounded batch");

  text = replaceAllIfPresent(text, "twentyFourMutationApplied", "twentyFiveMutationApplied");
  text = replaceAllIfPresent(text, "localTwentyFourSmokePassed", "localTwentyFiveSmokePassed");
  text = replaceAllIfPresent(text, "twentyFourRunnerReady", "twentyFiveRunnerReady");
  text = replaceAllIfPresent(text, "restore-previous-content-twenty-four", "restore-previous-content-twenty-five");
  text = replaceAllIfPresent(text, "twenty-four-smoke.json", "twenty-five-smoke.json");
  text = replaceAllIfPresent(text, "controlled-twenty-four-tool-source-mutation", "controlled-twenty-five-tool-source-mutation");
  text = replaceAllIfPresent(text, "changed_file_count_twenty_four", "changed_file_count_twenty_five");
  text = replaceAllIfPresent(text, "rollback_restore_twenty_four", "rollback_restore_twenty_five");
  text = replaceAllIfPresent(text, "rollback_twenty_four_entries", "rollback_twenty_five_entries");
  text = replaceAllIfPresent(text, "docs_mentions_twenty_four", "docs_mentions_twenty_five");
  text = replaceAllIfPresent(text, "twenty_four_mutation_applied", "twenty_five_mutation_applied");
  text = replaceAllIfPresent(text, "twentyFourMutationReady", "twentyFiveMutationReady");
  text = replaceAllIfPresent(text, 'docs.includes("controlled twenty-four tool mutation")', 'docs.includes("controlled twenty-five tool mutation")');
  text = replaceAllIfPresent(text, '"twenty_four_mutation_node_check_or_smoke_failed"', '"twenty_five_mutation_node_check_or_smoke_failed"');

  text = replaceAllIfPresent(text, "result.changedFileCount === 24", "result.changedFileCount === 25");
  text = replaceAllIfPresent(text, "rollback.files.length === 24", "rollback.files.length === 25");
  text = replaceAllIfPresent(text, "changedFileCount: result?.changedFileCount ?? 24", "changedFileCount: result?.changedFileCount ?? 25");
  text = replaceAllIfPresent(text, "expectedOperationCount: 24", "expectedOperationCount: 25");
  text = replaceAllIfPresent(text, "expectedMaxChangedFiles: 24", "expectedMaxChangedFiles: 25");
  text = replaceAllIfPresent(text, "maxChangedFiles: 24,", "maxChangedFiles: 25,");

  text = replaceAllIfPresent(
    text,
    `const phase2471 = readJson("\${previousPhaseMeta.resultPath}") || {};`,
    `const phase2500 = readJson("\${previousPhaseMeta.resultPath}") || {};`,
  );
  text = replaceAllIfPresent(
    text,
    `check("\${previousPhaseMeta.sealCheckId}", phase2471.recommendedSealed === true && phase2471.\${previousPhaseMeta.sealCheckField} === true);`,
    `check("\${previousPhaseMeta.sealCheckId}", phase2500.recommendedSealed === true && phase2500.\${previousPhaseMeta.sealCheckField} === true);`,
  );
  text = replaceAllIfPresent(text, "phase2471Sealed", "phase2500Sealed");
  text = replaceAllIfPresent(text, "phase2471.recommendedSealed", "phase2500.recommendedSealed");

  text = replaceAllIfPresent(
    text,
    `const previousPhaseMeta = {
  phaseId: "Phase2472A-2500A-Controlled-Twenty-Four-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2501-2530-controlled-twenty-five-tool-mutation/result.json",
  sealCheckId: "phase2500_sealed",
  sealCheckField: "twentyFiveMutationApplied",
  sealCheckBlocker: "phase2500_not_sealed",
};`,
    `const previousPhaseMeta = {
  phaseId: "Phase2472A-2500A-Controlled-Twenty-Four-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2472-2500-controlled-twenty-four-tool-mutation/result.json",
  sealCheckId: "phase2500_sealed",
  sealCheckField: "twentyFourMutationApplied",
  sealCheckBlocker: "phase2500_not_sealed",
};`,
  );

  text = replaceAllIfPresent(
    text,
    "- Requires Phase2444A-2471A sealed evidence.",
    "- Requires Phase2472A-2500A sealed evidence.",
  );

  await writeFile(targetPath, text, "utf8");
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
