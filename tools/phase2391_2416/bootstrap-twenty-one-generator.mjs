import { readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase2366_2390/generate-twenty-phase-assets.mjs";
const targetPath = "tools/phase2391_2416/generate-twenty-one-phase-assets.mjs";

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
  phaseId: "Phase2366A-2390A-Controlled-Twenty-Tool-Mutation",
  docPath: "docs/phase2366-2390-controlled-twenty-tool-mutation.md",
  approvalPath: "docs/phase2366-2390-controlled-twenty-tool-mutation-approval.example.json",
  runnerPath: "tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs",
  verifierPath: "tools/phase2366_2390/validate-controlled-twenty-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase2366-2390-controlled-twenty-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2366-2390-controlled-twenty-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase2366-2390-controlled-twenty-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase2366-2390-controlled-twenty-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase2366-2390-controlled-twenty-tool-mutation/twenty-smoke.json",
  permissionMode: "controlled-twenty-tool-source-mutation",
  label: "twenty",
  runnerReadyField: "twentyRunnerReady",
  appliedField: "twentyMutationApplied",
  smokeField: "localTwentySmokePassed",
  rollbackAction: "restore-previous-content-twenty",
  verifyScript: "verify:phase2366-2390-controlled-twenty-tool-mutation",
  applyScript: "apply:phase2366-2390-controlled-twenty-tool-mutation",
  smokeScript: "smoke:phase2366-2390-controlled-twenty-tool-mutation",
};`,
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
  );

  text = replaceOne(
    text,
    `const previousPhaseMeta = {
  phaseId: "Phase2342A-2365A-Controlled-Nineteen-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2342-2365-controlled-nineteen-tool-mutation/result.json",
  sealCheckId: "phase2365_sealed",
  sealCheckField: "nineteenMutationApplied",
  sealCheckBlocker: "phase2365_not_sealed",
};`,
    `const previousPhaseMeta = {
  phaseId: "Phase2366A-2390A-Controlled-Twenty-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2366-2390-controlled-twenty-tool-mutation/result.json",
  sealCheckId: "phase2390_sealed",
  sealCheckField: "twentyMutationApplied",
  sealCheckBlocker: "phase2390_not_sealed",
};`,
  );

  text = replaceOne(
    text,
    `  "Nineteen",
  "Twenty",
];`,
    `  "Nineteen",
  "Twenty",
  "TwentyOne",
];`,
  );

  text = replaceOne(
    text,
    `const wordNames = titleWords.map((entry) => entry.toLowerCase());`,
    `const wordNames = titleWords.map((entry) => entry.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase());`,
  );

  text = replaceOne(
    text,
    `function titleWord(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}`,
    `function titleWord(word) {
  return word
    .split("-")
    .filter(Boolean)
    .map((entry) => entry.charAt(0).toUpperCase() + entry.slice(1))
    .join("");
}`,
  );

  text = replaceOne(
    text,
    `  "tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs",
  "tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs",
];`,
    `  "tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs",
  "tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs",
  "tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs",
];`,
  );

  text = replaceOne(
    text,
    `const sixteenTargets = baseTargets.map(buildTarget);
const seventeenTargets = buildSeventeenTargets(sixteenTargets);
const eighteenTargets = buildEighteenTargets(seventeenTargets);
const nineteenTargets = buildNineteenTargets(eighteenTargets);
const targets = buildTwentyTargets(nineteenTargets);
`,
    `const sixteenTargets = baseTargets.map(buildTarget);
const seventeenTargets = buildSeventeenTargets(sixteenTargets);
const eighteenTargets = buildEighteenTargets(seventeenTargets);
const nineteenTargets = buildNineteenTargets(eighteenTargets);
const twentyTargets = buildTwentyTargets(nineteenTargets);
const targets = buildTwentyOneTargets(twentyTargets);
`,
  );

  text = replaceOne(
    text,
    `  return upgraded;
}

const phase2091Checks = [`,
    `  return upgraded;
}

function buildTwentyOneTargets(previousTargets) {
  const upgraded = previousTargets.map((target) => {
    const idx = target.idx;
    const phase = 2395 + idx;
    const titleWord = titleWords[idx - 1];
    const word = wordNames[idx - 1];
    const marker = \`PHASE\${phase}_TWENTY_ONE_TOOL_TARGET_\${word.replace(/-/g, "_").toUpperCase()}_OK\`;
    const previousMarkerField = \`phase\${target.phase}Marker\`;
    const next = {
      ...target,
      phase,
      word,
      targetName: \`target-\${word}\`,
      proposal: \`docs/phase\${phase}-twenty-one-tool-mutation-target-\${word}.proposal.diff\`,
      newExport:
        idx === 21
          ? "buildPhase2416TwentyOneMutationRuntimeStatus"
          : \`buildPhase\${phase}TwentyOneMutationTarget\${titleWord}Status\`,
      newPhaseId:
        idx === 21
          ? "Phase2416A-Controlled-Twenty-One-Tool-Mutation-Target-Twenty-One"
          : \`Phase\${phase}A-Controlled-Twenty-One-Tool-Mutation-Target-\${word.replace(/(^|-)([a-z])/g, (_, prefix, char) => \`\${prefix === "-" ? "-" : ""}\${char.toUpperCase()}\`)}\`,
      marker,
      referenceMarkers: [...target.referenceMarkers, target.marker],
      referenceFields: [...target.referenceFields, previousMarkerField],
      requiredExports:
        idx === 1
          ? [\`export function \${idx === 21 ? "buildPhase2416TwentyOneMutationRuntimeStatus" : \`buildPhase\${phase}TwentyOneMutationTarget\${titleWord}Status\`}\`]
          : [
              \`export function \${idx === 21 ? "buildPhase2416TwentyOneMutationRuntimeStatus" : \`buildPhase\${phase}TwentyOneMutationTarget\${titleWord}Status\`}\`,
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

  const previousRuntimeTarget = previousTargets[19];
  const twentyOnePhase = 2416;
  const twentyOneMarker = "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK";
  upgraded.push({
    idx: 21,
    phase: twentyOnePhase,
    word: "twenty-one",
    targetName: "target-twenty-one",
    path: sourceTargetPaths[20],
    proposal: "docs/phase2416-twenty-one-tool-mutation-target-twenty-one.proposal.diff",
    addMode: "append-export",
    newExport: "buildPhase2416TwentyOneMutationRuntimeStatus",
    newPhaseId: "Phase2416A-Controlled-Twenty-One-Tool-Mutation-Target-Twenty-One",
    marker: twentyOneMarker,
    referenceMarkers: [...previousRuntimeTarget.referenceMarkers, previousRuntimeTarget.marker],
    referenceFields: [...previousRuntimeTarget.referenceFields, \`phase\${previousRuntimeTarget.phase}Marker\`],
    requiredExports: ["export function buildPhase2416TwentyOneMutationRuntimeStatus", "export function main"],
    requiredMarkers: [...new Set([...previousRuntimeTarget.requiredMarkers, previousRuntimeTarget.marker, twentyOneMarker])],
    runnerReady: true,
  });

  return upgraded;
}

const phase2091Checks = [`,
  );

  text = replaceOne(
    text,
    `    const anchorMap = {
      2325: "export function buildPhase2243FourteenMutationTargetTwoStatus() {",
      2326: "export function buildPhase2244FourteenMutationTargetThreeStatus() {",
      2327: "export function buildPhase2245FourteenMutationTargetFourStatus() {",
      2328: "export function buildPhase2246FourteenMutationTargetFiveStatus() {",
      2348: "export function buildPhase2325EighteenMutationTargetTwoStatus() {",
      2349: "export function buildPhase2326EighteenMutationTargetThreeStatus() {",
      2350: "export function buildPhase2327EighteenMutationTargetFourStatus() {",
      2351: "export function buildPhase2328EighteenMutationTargetFiveStatus() {",
      2372: "export function buildPhase2348NineteenMutationTargetTwoStatus() {",
      2373: "export function buildPhase2349NineteenMutationTargetThreeStatus() {",
      2374: "export function buildPhase2350NineteenMutationTargetFourStatus() {",
      2375: "export function buildPhase2351NineteenMutationTargetFiveStatus() {",
    };`,
    `    const anchorMap = {
      2325: "export function buildPhase2243FourteenMutationTargetTwoStatus() {",
      2326: "export function buildPhase2244FourteenMutationTargetThreeStatus() {",
      2327: "export function buildPhase2245FourteenMutationTargetFourStatus() {",
      2328: "export function buildPhase2246FourteenMutationTargetFiveStatus() {",
      2348: "export function buildPhase2325EighteenMutationTargetTwoStatus() {",
      2349: "export function buildPhase2326EighteenMutationTargetThreeStatus() {",
      2350: "export function buildPhase2327EighteenMutationTargetFourStatus() {",
      2351: "export function buildPhase2328EighteenMutationTargetFiveStatus() {",
      2372: "export function buildPhase2348NineteenMutationTargetTwoStatus() {",
      2373: "export function buildPhase2349NineteenMutationTargetThreeStatus() {",
      2374: "export function buildPhase2350NineteenMutationTargetFourStatus() {",
      2375: "export function buildPhase2351NineteenMutationTargetFiveStatus() {",
      2397: "export function buildPhase2372TwentyMutationTargetTwoStatus() {",
      2398: "export function buildPhase2373TwentyMutationTargetThreeStatus() {",
      2399: "export function buildPhase2374TwentyMutationTargetFourStatus() {",
      2400: "export function buildPhase2375TwentyMutationTargetFiveStatus() {",
    };`,
  );

  text = replaceAll(text, "tmp/phase2366-2390-proposals", "tmp/phase2391-2416-proposals");

  text = replaceAllIfPresent(
    text,
    "Phase2366A-2390A Controlled Twenty Tool Mutation Evidence",
    "Phase2391A-2416A Controlled Twenty-One Tool Mutation Evidence",
  );
  text = replaceAll(
    text,
    "Phase2366A-2390A Controlled Twenty Tool Mutation",
    "Phase2391A-2416A Controlled Twenty-One Tool Mutation",
  );
  text = replaceAll(
    text,
    "phase2366-2390-controlled-twenty-tool-mutation",
    "phase2391-2416-controlled-twenty-one-tool-mutation",
  );
  text = replaceAllIfPresent(
    text,
    "verify:phase2366-2390-controlled-twenty-tool-mutation",
    "verify:phase2391-2416-controlled-twenty-one-tool-mutation",
  );
  text = replaceAllIfPresent(
    text,
    "apply:phase2366-2390-controlled-twenty-tool-mutation",
    "apply:phase2391-2416-controlled-twenty-one-tool-mutation",
  );
  text = replaceAllIfPresent(
    text,
    "smoke:phase2366-2390-controlled-twenty-tool-mutation",
    "smoke:phase2391-2416-controlled-twenty-one-tool-mutation",
  );
  text = replaceAll(text, "from nineteen files to twenty files", "from twenty files to twenty-one files");
  text = replaceAll(text, "support twenty bounded local smoke commands", "support twenty-one bounded local smoke commands");
  text = replaceAll(text, "The twenty mutation batch must prove:", "The twenty-one mutation batch must prove:");
  text = replaceAll(text, "the twenty target markers are not present", "the twenty-one target markers are not present");
  text = replaceAllIfPresent(
    text,
    "Phase2366A-2390A extends the controlled local mutation line from twenty files to twenty-one files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.",
    "Phase2391A-2416A extends the controlled local mutation line from twenty files to twenty-one files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.",
  );
  text = replaceAllIfPresent(
    text,
    "Phase2366A-2390A extends the controlled local mutation line from nineteen files to twenty files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.",
    "Phase2391A-2416A extends the controlled local mutation line from twenty files to twenty-one files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.",
  );
  text = replaceAllIfPresent(
    text,
    "- Applies exactly twenty existing source-file mutations.",
    "- Applies exactly twenty-one existing source-file mutations.",
  );
  text = replaceAllIfPresent(text, "current **controlled twenty tool mutation** batch", "current **controlled twenty-one tool mutation** batch");
  text = replaceAllIfPresent(text, "runs local twenty smoke", "runs local twenty-one smoke");
  text = replaceAllIfPresent(text, "a twenty-one-file bounded batch", "a twenty-two-file bounded batch");

  text = replaceAllIfPresent(text, "twentyMutationApplied", "twentyOneMutationApplied");
  text = replaceAllIfPresent(text, "localTwentySmokePassed", "localTwentyOneSmokePassed");
  text = replaceAllIfPresent(text, "twentyRunnerReady", "twentyOneRunnerReady");
  text = replaceAllIfPresent(text, "restore-previous-content-twenty", "restore-previous-content-twenty-one");
  text = replaceAllIfPresent(text, "twenty-smoke.json", "twenty-one-smoke.json");
  text = replaceAllIfPresent(text, "controlled-twenty-tool-source-mutation", "controlled-twenty-one-tool-source-mutation");
  text = replaceAllIfPresent(text, "changed_file_count_twenty", "changed_file_count_twenty_one");
  text = replaceAllIfPresent(text, "rollback_restore_twenty", "rollback_restore_twenty_one");
  text = replaceAllIfPresent(text, "rollback_twenty_entries", "rollback_twenty_one_entries");
  text = replaceAllIfPresent(text, "docs_mentions_twenty", "docs_mentions_twenty_one");
  text = replaceAllIfPresent(text, "twenty_mutation_applied", "twenty_one_mutation_applied");
  text = replaceAllIfPresent(text, "twentyMutationReady", "twentyOneMutationReady");
  text = replaceAllIfPresent(text, 'docs.includes("controlled twenty tool mutation")', 'docs.includes("controlled twenty-one tool mutation")');
  text = replaceAllIfPresent(text, '"twenty_mutation_node_check_or_smoke_failed"', '"twenty_one_mutation_node_check_or_smoke_failed"');

  text = replaceAllIfPresent(text, "result.changedFileCount === 20", "result.changedFileCount === 21");
  text = replaceAllIfPresent(text, "rollback.files.length === 20", "rollback.files.length === 21");
  text = replaceAllIfPresent(text, "changedFileCount: result?.changedFileCount ?? 20", "changedFileCount: result?.changedFileCount ?? 21");
  text = replaceAllIfPresent(text, "expectedOperationCount: 20", "expectedOperationCount: 21");
  text = replaceAllIfPresent(text, "expectedMaxChangedFiles: 20", "expectedMaxChangedFiles: 21");
  text = replaceAllIfPresent(text, "maxChangedFiles: 20,", "maxChangedFiles: 21,");

  text = replaceAllIfPresent(text, "phase2365Sealed", "phase2390Sealed");
  text = replaceAllIfPresent(text, "const phase2365 = readJson", "const phase2390 = readJson");
  text = replaceAllIfPresent(text, "phase2365.recommendedSealed", "phase2390.recommendedSealed");
  text = replaceAllIfPresent(text, "phase2365.", "phase2390.");
  text = replaceAllIfPresent(text, "twenty-one-one", "twenty-one");

  text = replaceAllIfPresent(
    text,
    `const previousPhaseMeta = {
  phaseId: "Phase2366A-2390A-Controlled-Twenty-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2391-2416-controlled-twenty-one-tool-mutation/result.json",
  sealCheckId: "phase2390_sealed",
  sealCheckField: "twentyOneMutationApplied",
  sealCheckBlocker: "phase2390_not_sealed",
};`,
    `const previousPhaseMeta = {
  phaseId: "Phase2366A-2390A-Controlled-Twenty-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2366-2390-controlled-twenty-tool-mutation/result.json",
  sealCheckId: "phase2390_sealed",
  sealCheckField: "twentyMutationApplied",
  sealCheckBlocker: "phase2390_not_sealed",
};`,
  );

  text = replaceAllIfPresent(
    text,
    `const previousPhaseMeta = {
  phaseId: "Phase2391A-2416A-Controlled-Twenty-One-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2391-2416-controlled-twenty-one-tool-mutation/result.json",
  sealCheckId: "phase2390_sealed",
  sealCheckField: "twentyOneMutationApplied",
  sealCheckBlocker: "phase2390_not_sealed",
};`,
    `const previousPhaseMeta = {
  phaseId: "Phase2366A-2390A-Controlled-Twenty-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2366-2390-controlled-twenty-tool-mutation/result.json",
  sealCheckId: "phase2390_sealed",
  sealCheckField: "twentyMutationApplied",
  sealCheckBlocker: "phase2390_not_sealed",
};`,
  );

  text = replaceAllIfPresent(
    text,
    "- Requires Phase2342A-2365A sealed evidence.",
    "- Requires Phase2366A-2390A sealed evidence.",
  );

  await writeFile(targetPath, text, "utf8");
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
