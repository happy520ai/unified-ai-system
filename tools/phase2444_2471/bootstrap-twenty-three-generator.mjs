import { readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase2417_2443/generate-twenty-two-phase-assets.mjs";
const targetPath = "tools/phase2444_2471/generate-twenty-three-phase-assets.mjs";

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
  phaseId: "Phase2417A-2443A-Controlled-Twenty-Two-Tool-Mutation",
  docPath: "docs/phase2417-2443-controlled-twenty-two-tool-mutation.md",
  approvalPath: "docs/phase2417-2443-controlled-twenty-two-tool-mutation-approval.example.json",
  runnerPath: "tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs",
  verifierPath: "tools/phase2417_2443/validate-controlled-twenty-two-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase2417-2443-controlled-twenty-two-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2417-2443-controlled-twenty-two-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase2417-2443-controlled-twenty-two-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase2417-2443-controlled-twenty-two-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase2417-2443-controlled-twenty-two-tool-mutation/twenty-two-smoke.json",
  permissionMode: "controlled-twenty-two-tool-source-mutation",
  label: "twenty-two",
  runnerReadyField: "twentyTwoRunnerReady",
  appliedField: "twentyTwoMutationApplied",
  smokeField: "localTwentyTwoSmokePassed",
  rollbackAction: "restore-previous-content-twenty-two",
  verifyScript: "verify:phase2417-2443-controlled-twenty-two-tool-mutation",
  applyScript: "apply:phase2417-2443-controlled-twenty-two-tool-mutation",
  smokeScript: "smoke:phase2417-2443-controlled-twenty-two-tool-mutation",
};`,
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
  );

  text = replaceOne(
    text,
    `const previousPhaseMeta = {
  phaseId: "Phase2391A-2416A-Controlled-Twenty-One-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2391-2416-controlled-twenty-one-tool-mutation/result.json",
  sealCheckId: "phase2416_sealed",
  sealCheckField: "twentyOneMutationApplied",
  sealCheckBlocker: "phase2416_not_sealed",
};`,
    `const previousPhaseMeta = {
  phaseId: "Phase2417A-2443A-Controlled-Twenty-Two-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2417-2443-controlled-twenty-two-tool-mutation/result.json",
  sealCheckId: "phase2443_sealed",
  sealCheckField: "twentyTwoMutationApplied",
  sealCheckBlocker: "phase2443_not_sealed",
};`,
  );

  text = replaceOne(
    text,
    `  "TwentyOne",
  "TwentyTwo",
];`,
    `  "TwentyOne",
  "TwentyTwo",
  "TwentyThree",
];`,
  );

  text = replaceOne(
    text,
    `  "tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs",
  "tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs",
];`,
    `  "tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs",
  "tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs",
  "tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs",
];`,
  );

  text = replaceOne(
    text,
    `const twentyTargets = buildTwentyTargets(nineteenTargets);
const twentyOneTargets = buildTwentyOneTargets(twentyTargets);
const targets = buildTwentyTwoTargets(twentyOneTargets);
`,
    `const twentyTargets = buildTwentyTargets(nineteenTargets);
const twentyOneTargets = buildTwentyOneTargets(twentyTargets);
const twentyTwoTargets = buildTwentyTwoTargets(twentyOneTargets);
const targets = buildTwentyThreeTargets(twentyTwoTargets);
`,
  );

  text = replaceOne(
    text,
    `  return upgraded;
}

const phase2091Checks = [`,
    `  return upgraded;
}

function buildTwentyThreeTargets(previousTargets) {
  const upgraded = previousTargets.map((target) => {
    const idx = target.idx;
    const phase = 2448 + idx;
    const titleWord = titleWords[idx - 1];
    const word = wordNames[idx - 1];
    const marker = \`PHASE\${phase}_TWENTY_THREE_TOOL_TARGET_\${word.replace(/-/g, "_").toUpperCase()}_OK\`;
    const previousMarkerField = \`phase\${target.phase}Marker\`;
    const next = {
      ...target,
      phase,
      word,
      targetName: \`target-\${word}\`,
      proposal: \`docs/phase\${phase}-twenty-three-tool-mutation-target-\${word}.proposal.diff\`,
      newExport:
        idx === 23
          ? "buildPhase2471TwentyThreeMutationRuntimeStatus"
          : \`buildPhase\${phase}TwentyThreeMutationTarget\${titleWord}Status\`,
      newPhaseId:
        idx === 23
          ? "Phase2471A-Controlled-Twenty-Three-Tool-Mutation-Target-Twenty-Three"
          : \`Phase\${phase}A-Controlled-Twenty-Three-Tool-Mutation-Target-\${word.replace(/(^|-)([a-z])/g, (_, prefix, char) => \`\${prefix === "-" ? "-" : ""}\${char.toUpperCase()}\`)}\`,
      marker,
      referenceMarkers: [...target.referenceMarkers, target.marker],
      referenceFields: [...target.referenceFields, previousMarkerField],
      requiredExports:
        idx === 1
          ? [\`export function \${idx === 23 ? "buildPhase2471TwentyThreeMutationRuntimeStatus" : \`buildPhase\${phase}TwentyThreeMutationTarget\${titleWord}Status\`}\`]
          : [
              \`export function \${idx === 23 ? "buildPhase2471TwentyThreeMutationRuntimeStatus" : \`buildPhase\${phase}TwentyThreeMutationTarget\${titleWord}Status\`}\`,
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

  const previousRuntimeTarget = previousTargets[21];
  const twentyThreePhase = 2471;
  const twentyThreeMarker = "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK";
  upgraded.push({
    idx: 23,
    phase: twentyThreePhase,
    word: "twenty-three",
    targetName: "target-twenty-three",
    path: sourceTargetPaths[22],
    proposal: "docs/phase2471-twenty-three-tool-mutation-target-twenty-three.proposal.diff",
    addMode: "append-export",
    newExport: "buildPhase2471TwentyThreeMutationRuntimeStatus",
    newPhaseId: "Phase2471A-Controlled-Twenty-Three-Tool-Mutation-Target-Twenty-Three",
    marker: twentyThreeMarker,
    referenceMarkers: [...previousRuntimeTarget.referenceMarkers, previousRuntimeTarget.marker],
    referenceFields: [...previousRuntimeTarget.referenceFields, \`phase\${previousRuntimeTarget.phase}Marker\`],
    requiredExports: ["export function buildPhase2471TwentyThreeMutationRuntimeStatus", "export function main"],
    requiredMarkers: [...new Set([...previousRuntimeTarget.requiredMarkers, previousRuntimeTarget.marker, twentyThreeMarker])],
    runnerReady: true,
  });

  return upgraded;
}

const phase2091Checks = [`,
  );

  text = replaceOne(
    text,
    `      2423: "export function buildPhase2397TwentyOneMutationTargetTwoStatus() {",
      2424: "export function buildPhase2398TwentyOneMutationTargetThreeStatus() {",
      2425: "export function buildPhase2399TwentyOneMutationTargetFourStatus() {",
      2426: "export function buildPhase2400TwentyOneMutationTargetFiveStatus() {",
    };`,
    `      2423: "export function buildPhase2397TwentyOneMutationTargetTwoStatus() {",
      2424: "export function buildPhase2398TwentyOneMutationTargetThreeStatus() {",
      2425: "export function buildPhase2399TwentyOneMutationTargetFourStatus() {",
      2426: "export function buildPhase2400TwentyOneMutationTargetFiveStatus() {",
      2450: "export function buildPhase2423TwentyTwoMutationTargetTwoStatus() {",
      2451: "export function buildPhase2424TwentyTwoMutationTargetThreeStatus() {",
      2452: "export function buildPhase2425TwentyTwoMutationTargetFourStatus() {",
      2453: "export function buildPhase2426TwentyTwoMutationTargetFiveStatus() {",
    };`,
  );

  text = replaceAll(text, "tmp/phase2417-2443-proposals", "tmp/phase2444-2471-proposals");
  text = replaceAllIfPresent(
    text,
    "Phase2417A-2443A Controlled Twenty-Two Tool Mutation Evidence",
    "Phase2444A-2471A Controlled Twenty-Three Tool Mutation Evidence",
  );
  text = replaceAll(text, "Phase2417A-2443A Controlled Twenty-Two Tool Mutation", "Phase2444A-2471A Controlled Twenty-Three Tool Mutation");
  text = replaceAll(text, "phase2417-2443-controlled-twenty-two-tool-mutation", "phase2444-2471-controlled-twenty-three-tool-mutation");
  text = replaceAllIfPresent(
    text,
    "verify:phase2417-2443-controlled-twenty-two-tool-mutation",
    "verify:phase2444-2471-controlled-twenty-three-tool-mutation",
  );
  text = replaceAllIfPresent(
    text,
    "apply:phase2417-2443-controlled-twenty-two-tool-mutation",
    "apply:phase2444-2471-controlled-twenty-three-tool-mutation",
  );
  text = replaceAllIfPresent(
    text,
    "smoke:phase2417-2443-controlled-twenty-two-tool-mutation",
    "smoke:phase2444-2471-controlled-twenty-three-tool-mutation",
  );
  text = replaceAll(text, "from twenty-one files to twenty-two files", "from twenty-two files to twenty-three files");
  text = replaceAll(text, "support twenty-two bounded local smoke commands", "support twenty-three bounded local smoke commands");
  text = replaceAll(text, "The twenty-two mutation batch must prove:", "The twenty-three mutation batch must prove:");
  text = replaceAll(text, "the twenty-two target markers are not present", "the twenty-three target markers are not present");
  text = replaceAllIfPresent(
    text,
    "Phase2417A-2443A extends the controlled local mutation line from twenty-one files to twenty-two files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.",
    "Phase2444A-2471A extends the controlled local mutation line from twenty-two files to twenty-three files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.",
  );
  text = replaceAllIfPresent(
    text,
    "- Applies exactly twenty-two existing source-file mutations.",
    "- Applies exactly twenty-three existing source-file mutations.",
  );
  text = replaceAllIfPresent(text, "current **controlled twenty-two tool mutation** batch", "current **controlled twenty-three tool mutation** batch");
  text = replaceAllIfPresent(text, "runs local twenty-two smoke", "runs local twenty-three smoke");
  text = replaceAllIfPresent(text, "a twenty-three-file bounded batch", "a twenty-four-file bounded batch");

  text = replaceAllIfPresent(text, "twentyTwoMutationApplied", "twentyThreeMutationApplied");
  text = replaceAllIfPresent(text, "localTwentyTwoSmokePassed", "localTwentyThreeSmokePassed");
  text = replaceAllIfPresent(text, "twentyTwoRunnerReady", "twentyThreeRunnerReady");
  text = replaceAllIfPresent(text, "restore-previous-content-twenty-two", "restore-previous-content-twenty-three");
  text = replaceAllIfPresent(text, "twenty-two-smoke.json", "twenty-three-smoke.json");
  text = replaceAllIfPresent(text, "controlled-twenty-two-tool-source-mutation", "controlled-twenty-three-tool-source-mutation");
  text = replaceAllIfPresent(text, "changed_file_count_twenty_two", "changed_file_count_twenty_three");
  text = replaceAllIfPresent(text, "rollback_restore_twenty_two", "rollback_restore_twenty_three");
  text = replaceAllIfPresent(text, "rollback_twenty_two_entries", "rollback_twenty_three_entries");
  text = replaceAllIfPresent(text, "docs_mentions_twenty_two", "docs_mentions_twenty_three");
  text = replaceAllIfPresent(text, "twenty_two_mutation_applied", "twenty_three_mutation_applied");
  text = replaceAllIfPresent(text, "twentyTwoMutationReady", "twentyThreeMutationReady");
  text = replaceAllIfPresent(text, 'docs.includes("controlled twenty-two tool mutation")', 'docs.includes("controlled twenty-three tool mutation")');
  text = replaceAllIfPresent(text, '"twenty_two_mutation_node_check_or_smoke_failed"', '"twenty_three_mutation_node_check_or_smoke_failed"');

  text = replaceAllIfPresent(text, "result.changedFileCount === 22", "result.changedFileCount === 23");
  text = replaceAllIfPresent(text, "rollback.files.length === 22", "rollback.files.length === 23");
  text = replaceAllIfPresent(text, "changedFileCount: result?.changedFileCount ?? 22", "changedFileCount: result?.changedFileCount ?? 23");
  text = replaceAllIfPresent(text, "expectedOperationCount: 22", "expectedOperationCount: 23");
  text = replaceAllIfPresent(text, "expectedMaxChangedFiles: 22", "expectedMaxChangedFiles: 23");
  text = replaceAllIfPresent(text, "maxChangedFiles: 22,", "maxChangedFiles: 23,");

  text = replaceAllIfPresent(
    text,
    `const phase2416 = readJson("apps/ai-gateway-service/evidence/phase2391-2416-controlled-twenty-one-tool-mutation/result.json") || {};`,
    `const phase2443 = readJson("apps/ai-gateway-service/evidence/phase2417-2443-controlled-twenty-two-tool-mutation/result.json") || {};`,
  );
  text = replaceAllIfPresent(
    text,
    `check("phase2416_sealed", phase2416.recommendedSealed === true && phase2416.twentyOneMutationApplied === true);`,
    `check("phase2443_sealed", phase2443.recommendedSealed === true && phase2443.twentyTwoMutationApplied === true);`,
  );
  text = replaceAllIfPresent(text, "phase2416.", "phase2443.");
  text = replaceAllIfPresent(text, "phase2416_sealed", "phase2443_sealed");
  text = replaceAllIfPresent(text, "phase2416_not_sealed", "phase2443_not_sealed");
  text = replaceAllIfPresent(text, "twenty-three-three", "twenty-three");

  text = replaceAllIfPresent(
    text,
    `const previousPhaseMeta = {
  phaseId: "Phase2417A-2443A-Controlled-Twenty-Two-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2444-2471-controlled-twenty-three-tool-mutation/result.json",
  sealCheckId: "phase2443_sealed",
  sealCheckField: "twentyThreeMutationApplied",
  sealCheckBlocker: "phase2443_not_sealed",
};`,
    `const previousPhaseMeta = {
  phaseId: "Phase2417A-2443A-Controlled-Twenty-Two-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2417-2443-controlled-twenty-two-tool-mutation/result.json",
  sealCheckId: "phase2443_sealed",
  sealCheckField: "twentyTwoMutationApplied",
  sealCheckBlocker: "phase2443_not_sealed",
};`,
  );

  text = replaceAllIfPresent(
    text,
    "- Requires Phase2391A-2416A sealed evidence.",
    "- Requires Phase2417A-2443A sealed evidence.",
  );
  text = replaceAllIfPresent(
    text,
    "Phase2417A-2443A extends the controlled local mutation line from twenty-two files to twenty-three files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.",
    "Phase2444A-2471A extends the controlled local mutation line from twenty-two files to twenty-three files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.",
  );

  await writeFile(targetPath, text, "utf8");
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
