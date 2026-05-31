import { readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase2391_2416/generate-twenty-one-phase-assets.mjs";
const targetPath = "tools/phase2417_2443/generate-twenty-two-phase-assets.mjs";

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
  phaseId: "Phase2391A-2416A-Controlled-Twenty-One-Tool-Mutation",
  docPath: "docs/phase2391-2416-controlled-twenty-one-tool-mutation.md",
  approvalPath: "docs/phase2391-2416-controlled-twenty-one-tool-mutation-approval.example.json",
  runnerPath: "tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs",
  verifierPath: "tools/phase2391_2416/validate-controlled-twenty-one-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase2391-2416-controlled-twenty-one-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2391-2416-controlled-twenty-one-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase2391-2416-controlled-twenty-one-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase2391-2416-controlled-twenty-one-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase2391-2416-controlled-twenty-one-tool-mutation/twenty-one-smoke.json",
  permissionMode: "controlled-twenty-one-tool-source-mutation",
  label: "twenty-one",
  runnerReadyField: "twentyOneRunnerReady",
  appliedField: "twentyOneMutationApplied",
  smokeField: "localTwentyOneSmokePassed",
  rollbackAction: "restore-previous-content-twenty-one",
  verifyScript: "verify:phase2391-2416-controlled-twenty-one-tool-mutation",
  applyScript: "apply:phase2391-2416-controlled-twenty-one-tool-mutation",
  smokeScript: "smoke:phase2391-2416-controlled-twenty-one-tool-mutation",
};`,
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
  );

  text = replaceOne(
    text,
    `const previousPhaseMeta = {
  phaseId: "Phase2366A-2390A-Controlled-Twenty-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2366-2390-controlled-twenty-tool-mutation/result.json",
  sealCheckId: "phase2390_sealed",
  sealCheckField: "twentyMutationApplied",
  sealCheckBlocker: "phase2390_not_sealed",
};`,
    `const previousPhaseMeta = {
  phaseId: "Phase2391A-2416A-Controlled-Twenty-One-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2391-2416-controlled-twenty-one-tool-mutation/result.json",
  sealCheckId: "phase2416_sealed",
  sealCheckField: "twentyOneMutationApplied",
  sealCheckBlocker: "phase2416_not_sealed",
};`,
  );

  text = replaceOne(
    text,
    `  "Twenty",
  "TwentyOne",
];`,
    `  "Twenty",
  "TwentyOne",
  "TwentyTwo",
];`,
  );

  text = replaceOne(
    text,
    `  "tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs",
  "tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs",
];`,
    `  "tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs",
  "tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs",
  "tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs",
];`,
  );

  text = replaceOne(
    text,
    `const eighteenTargets = buildEighteenTargets(seventeenTargets);
const nineteenTargets = buildNineteenTargets(eighteenTargets);
const twentyTargets = buildTwentyTargets(nineteenTargets);
const targets = buildTwentyOneTargets(twentyTargets);
`,
    `const eighteenTargets = buildEighteenTargets(seventeenTargets);
const nineteenTargets = buildNineteenTargets(eighteenTargets);
const twentyTargets = buildTwentyTargets(nineteenTargets);
const twentyOneTargets = buildTwentyOneTargets(twentyTargets);
const targets = buildTwentyTwoTargets(twentyOneTargets);
`,
  );

  text = replaceOne(
    text,
    `  return upgraded;
}

const phase2091Checks = [`,
    `  return upgraded;
}

function buildTwentyTwoTargets(previousTargets) {
  const upgraded = previousTargets.map((target) => {
    const idx = target.idx;
    const phase = 2421 + idx;
    const titleWord = titleWords[idx - 1];
    const word = wordNames[idx - 1];
    const marker = \`PHASE\${phase}_TWENTY_TWO_TOOL_TARGET_\${word.replace(/-/g, "_").toUpperCase()}_OK\`;
    const previousMarkerField = \`phase\${target.phase}Marker\`;
    const next = {
      ...target,
      phase,
      word,
      targetName: \`target-\${word}\`,
      proposal: \`docs/phase\${phase}-twenty-two-tool-mutation-target-\${word}.proposal.diff\`,
      newExport:
        idx === 22
          ? "buildPhase2443TwentyTwoMutationRuntimeStatus"
          : \`buildPhase\${phase}TwentyTwoMutationTarget\${titleWord}Status\`,
      newPhaseId:
        idx === 22
          ? "Phase2443A-Controlled-Twenty-Two-Tool-Mutation-Target-Twenty-Two"
          : \`Phase\${phase}A-Controlled-Twenty-Two-Tool-Mutation-Target-\${word.replace(/(^|-)([a-z])/g, (_, prefix, char) => \`\${prefix === "-" ? "-" : ""}\${char.toUpperCase()}\`)}\`,
      marker,
      referenceMarkers: [...target.referenceMarkers, target.marker],
      referenceFields: [...target.referenceFields, previousMarkerField],
      requiredExports:
        idx === 1
          ? [\`export function \${idx === 22 ? "buildPhase2443TwentyTwoMutationRuntimeStatus" : \`buildPhase\${phase}TwentyTwoMutationTarget\${titleWord}Status\`}\`]
          : [
              \`export function \${idx === 22 ? "buildPhase2443TwentyTwoMutationRuntimeStatus" : \`buildPhase\${phase}TwentyTwoMutationTarget\${titleWord}Status\`}\`,
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

  const previousRuntimeTarget = previousTargets[20];
  const twentyTwoPhase = 2443;
  const twentyTwoMarker = "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK";
  upgraded.push({
    idx: 22,
    phase: twentyTwoPhase,
    word: "twenty-two",
    targetName: "target-twenty-two",
    path: sourceTargetPaths[21],
    proposal: "docs/phase2443-twenty-two-tool-mutation-target-twenty-two.proposal.diff",
    addMode: "append-export",
    newExport: "buildPhase2443TwentyTwoMutationRuntimeStatus",
    newPhaseId: "Phase2443A-Controlled-Twenty-Two-Tool-Mutation-Target-Twenty-Two",
    marker: twentyTwoMarker,
    referenceMarkers: [...previousRuntimeTarget.referenceMarkers, previousRuntimeTarget.marker],
    referenceFields: [...previousRuntimeTarget.referenceFields, \`phase\${previousRuntimeTarget.phase}Marker\`],
    requiredExports: ["export function buildPhase2443TwentyTwoMutationRuntimeStatus", "export function main"],
    requiredMarkers: [...new Set([...previousRuntimeTarget.requiredMarkers, previousRuntimeTarget.marker, twentyTwoMarker])],
    runnerReady: true,
  });

  return upgraded;
}

const phase2091Checks = [`,
  );

  text = replaceOne(
    text,
    `      2397: "export function buildPhase2372TwentyMutationTargetTwoStatus() {",
      2398: "export function buildPhase2373TwentyMutationTargetThreeStatus() {",
      2399: "export function buildPhase2374TwentyMutationTargetFourStatus() {",
      2400: "export function buildPhase2375TwentyMutationTargetFiveStatus() {",
    };`,
    `      2397: "export function buildPhase2372TwentyMutationTargetTwoStatus() {",
      2398: "export function buildPhase2373TwentyMutationTargetThreeStatus() {",
      2399: "export function buildPhase2374TwentyMutationTargetFourStatus() {",
      2400: "export function buildPhase2375TwentyMutationTargetFiveStatus() {",
      2423: "export function buildPhase2397TwentyOneMutationTargetTwoStatus() {",
      2424: "export function buildPhase2398TwentyOneMutationTargetThreeStatus() {",
      2425: "export function buildPhase2399TwentyOneMutationTargetFourStatus() {",
      2426: "export function buildPhase2400TwentyOneMutationTargetFiveStatus() {",
    };`,
  );

  text = replaceAll(text, "tmp/phase2391-2416-proposals", "tmp/phase2417-2443-proposals");

  text = replaceAllIfPresent(
    text,
    "Phase2391A-2416A Controlled Twenty-One Tool Mutation Evidence",
    "Phase2417A-2443A Controlled Twenty-Two Tool Mutation Evidence",
  );
  text = replaceAll(text, "Phase2391A-2416A Controlled Twenty-One Tool Mutation", "Phase2417A-2443A Controlled Twenty-Two Tool Mutation");
  text = replaceAll(text, "phase2391-2416-controlled-twenty-one-tool-mutation", "phase2417-2443-controlled-twenty-two-tool-mutation");
  text = replaceAllIfPresent(
    text,
    "verify:phase2391-2416-controlled-twenty-one-tool-mutation",
    "verify:phase2417-2443-controlled-twenty-two-tool-mutation",
  );
  text = replaceAllIfPresent(
    text,
    "apply:phase2391-2416-controlled-twenty-one-tool-mutation",
    "apply:phase2417-2443-controlled-twenty-two-tool-mutation",
  );
  text = replaceAllIfPresent(
    text,
    "smoke:phase2391-2416-controlled-twenty-one-tool-mutation",
    "smoke:phase2417-2443-controlled-twenty-two-tool-mutation",
  );
  text = replaceAll(text, "from twenty files to twenty-one files", "from twenty-one files to twenty-two files");
  text = replaceAll(text, "support twenty-one bounded local smoke commands", "support twenty-two bounded local smoke commands");
  text = replaceAll(text, "The twenty-one mutation batch must prove:", "The twenty-two mutation batch must prove:");
  text = replaceAll(text, "the twenty-one target markers are not present", "the twenty-two target markers are not present");
  text = replaceAllIfPresent(
    text,
    "Phase2391A-2416A extends the controlled local mutation line from twenty files to twenty-one files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.",
    "Phase2417A-2443A extends the controlled local mutation line from twenty-one files to twenty-two files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.",
  );
  text = replaceAllIfPresent(
    text,
    "- Applies exactly twenty-one existing source-file mutations.",
    "- Applies exactly twenty-two existing source-file mutations.",
  );
  text = replaceAllIfPresent(text, "current **controlled twenty-one tool mutation** batch", "current **controlled twenty-two tool mutation** batch");
  text = replaceAllIfPresent(text, "runs local twenty-one smoke", "runs local twenty-two smoke");
  text = replaceAllIfPresent(text, "a twenty-two-file bounded batch", "a twenty-three-file bounded batch");

  text = replaceAllIfPresent(text, "twentyOneMutationApplied", "twentyTwoMutationApplied");
  text = replaceAllIfPresent(text, "localTwentyOneSmokePassed", "localTwentyTwoSmokePassed");
  text = replaceAllIfPresent(text, "twentyOneRunnerReady", "twentyTwoRunnerReady");
  text = replaceAllIfPresent(text, "restore-previous-content-twenty-one", "restore-previous-content-twenty-two");
  text = replaceAllIfPresent(text, "twenty-one-smoke.json", "twenty-two-smoke.json");
  text = replaceAllIfPresent(text, "controlled-twenty-one-tool-source-mutation", "controlled-twenty-two-tool-source-mutation");
  text = replaceAllIfPresent(text, "changed_file_count_twenty_one", "changed_file_count_twenty_two");
  text = replaceAllIfPresent(text, "rollback_restore_twenty_one", "rollback_restore_twenty_two");
  text = replaceAllIfPresent(text, "rollback_twenty_one_entries", "rollback_twenty_two_entries");
  text = replaceAllIfPresent(text, "docs_mentions_twenty_one", "docs_mentions_twenty_two");
  text = replaceAllIfPresent(text, "twenty_one_mutation_applied", "twenty_two_mutation_applied");
  text = replaceAllIfPresent(text, "twentyOneMutationReady", "twentyTwoMutationReady");
  text = replaceAllIfPresent(text, 'docs.includes("controlled twenty-one tool mutation")', 'docs.includes("controlled twenty-two tool mutation")');
  text = replaceAllIfPresent(text, '"twenty_one_mutation_node_check_or_smoke_failed"', '"twenty_two_mutation_node_check_or_smoke_failed"');

  text = replaceAllIfPresent(text, "result.changedFileCount === 21", "result.changedFileCount === 22");
  text = replaceAllIfPresent(text, "rollback.files.length === 21", "rollback.files.length === 22");
  text = replaceAllIfPresent(text, "changedFileCount: result?.changedFileCount ?? 21", "changedFileCount: result?.changedFileCount ?? 22");
  text = replaceAllIfPresent(text, "expectedOperationCount: 21", "expectedOperationCount: 22");
  text = replaceAllIfPresent(text, "expectedMaxChangedFiles: 21", "expectedMaxChangedFiles: 22");
  text = replaceAllIfPresent(text, "maxChangedFiles: 21,", "maxChangedFiles: 22,");

  text = replaceAllIfPresent(text, "phase2390Sealed", "phase2416Sealed");
  text = replaceAllIfPresent(text, "const phase2390 = readJson", "const phase2416 = readJson");
  text = replaceAllIfPresent(text, "phase2390.recommendedSealed", "phase2416.recommendedSealed");
  text = replaceAllIfPresent(text, "phase2390.", "phase2416.");
  text = replaceAllIfPresent(text, "twenty-two-two", "twenty-two");

  text = replaceAllIfPresent(
    text,
    `const previousPhaseMeta = {
  phaseId: "Phase2391A-2416A-Controlled-Twenty-One-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2417-2443-controlled-twenty-two-tool-mutation/result.json",
  sealCheckId: "phase2416_sealed",
  sealCheckField: "twentyTwoMutationApplied",
  sealCheckBlocker: "phase2416_not_sealed",
};`,
    `const previousPhaseMeta = {
  phaseId: "Phase2391A-2416A-Controlled-Twenty-One-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2391-2416-controlled-twenty-one-tool-mutation/result.json",
  sealCheckId: "phase2416_sealed",
  sealCheckField: "twentyOneMutationApplied",
  sealCheckBlocker: "phase2416_not_sealed",
};`,
  );

  text = replaceAllIfPresent(
    text,
    `const previousPhaseMeta = {
  phaseId: "Phase2417A-2443A-Controlled-Twenty-Two-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2417-2443-controlled-twenty-two-tool-mutation/result.json",
  sealCheckId: "phase2416_sealed",
  sealCheckField: "twentyTwoMutationApplied",
  sealCheckBlocker: "phase2416_not_sealed",
};`,
    `const previousPhaseMeta = {
  phaseId: "Phase2391A-2416A-Controlled-Twenty-One-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2391-2416-controlled-twenty-one-tool-mutation/result.json",
  sealCheckId: "phase2416_sealed",
  sealCheckField: "twentyOneMutationApplied",
  sealCheckBlocker: "phase2416_not_sealed",
};`,
  );

  text = replaceAllIfPresent(
    text,
    "- Requires Phase2366A-2390A sealed evidence.",
    "- Requires Phase2391A-2416A sealed evidence.",
  );
  text = replaceAllIfPresent(
    text,
    "Phase2391A-2416A extends the controlled local mutation line from twenty-one files to twenty-two files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.",
    "Phase2417A-2443A extends the controlled local mutation line from twenty-one files to twenty-two files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.",
  );

  await writeFile(targetPath, text, "utf8");
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
