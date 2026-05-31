import { readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase2342_2365/generate-nineteen-phase-assets.mjs";
const targetPath = "tools/phase2366_2390/generate-twenty-phase-assets.mjs";

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
  phaseId: "Phase2342A-2365A-Controlled-Nineteen-Tool-Mutation",
  docPath: "docs/phase2342-2365-controlled-nineteen-tool-mutation.md",
  approvalPath: "docs/phase2342-2365-controlled-nineteen-tool-mutation-approval.example.json",
  runnerPath: "tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs",
  verifierPath: "tools/phase2342_2365/validate-controlled-nineteen-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase2342-2365-controlled-nineteen-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2342-2365-controlled-nineteen-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase2342-2365-controlled-nineteen-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase2342-2365-controlled-nineteen-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase2342-2365-controlled-nineteen-tool-mutation/nineteen-smoke.json",
  permissionMode: "controlled-nineteen-tool-source-mutation",
  label: "nineteen",
  runnerReadyField: "nineteenRunnerReady",
  appliedField: "nineteenMutationApplied",
  smokeField: "localNineteenSmokePassed",
  rollbackAction: "restore-previous-content-nineteen",
  verifyScript: "verify:phase2342-2365-controlled-nineteen-tool-mutation",
  applyScript: "apply:phase2342-2365-controlled-nineteen-tool-mutation",
  smokeScript: "smoke:phase2342-2365-controlled-nineteen-tool-mutation",
};`,
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
  );

  text = replaceOne(
    text,
    `const previousPhaseMeta = {
  phaseId: "Phase2319A-2341A-Controlled-Eighteen-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2319-2341-controlled-eighteen-tool-mutation/result.json",
  sealCheckId: "phase2341_sealed",
  sealCheckField: "eighteenMutationApplied",
  sealCheckBlocker: "phase2341_not_sealed",
};`,
    `const previousPhaseMeta = {
  phaseId: "Phase2342A-2365A-Controlled-Nineteen-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2342-2365-controlled-nineteen-tool-mutation/result.json",
  sealCheckId: "phase2365_sealed",
  sealCheckField: "nineteenMutationApplied",
  sealCheckBlocker: "phase2365_not_sealed",
};`,
  );

  text = replaceOne(
    text,
    `  "Nineteen",
];`,
    `  "Nineteen",
  "Twenty",
];`,
  );

  text = replaceOne(
    text,
    `  "tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs",
];`,
    `  "tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs",
  "tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs",
];`,
  );

  text = replaceOne(
    text,
    `const sixteenTargets = baseTargets.map(buildTarget);
const seventeenTargets = buildSeventeenTargets(sixteenTargets);
const eighteenTargets = buildEighteenTargets(seventeenTargets);
const targets = buildNineteenTargets(eighteenTargets);
`,
    `const sixteenTargets = baseTargets.map(buildTarget);
const seventeenTargets = buildSeventeenTargets(sixteenTargets);
const eighteenTargets = buildEighteenTargets(seventeenTargets);
const nineteenTargets = buildNineteenTargets(eighteenTargets);
const targets = buildTwentyTargets(nineteenTargets);
`,
  );

  text = replaceOne(
    text,
    `  return upgraded;
}

const phase2091Checks = [`,
    `  return upgraded;
}

function buildTwentyTargets(previousTargets) {
  const upgraded = previousTargets.map((target) => {
    const idx = target.idx;
    const phase = 2370 + idx;
    const titleWord = titleWords[idx - 1];
    const word = wordNames[idx - 1];
    const marker = \`PHASE\${phase}_TWENTY_TOOL_TARGET_\${titleWord.toUpperCase()}_OK\`;
    const previousMarkerField = \`phase\${target.phase}Marker\`;
    const next = {
      ...target,
      phase,
      word,
      targetName: \`target-\${word}\`,
      proposal: \`docs/phase\${phase}-twenty-tool-mutation-target-\${word}.proposal.diff\`,
      newExport:
        idx === 20
          ? "buildPhase2390TwentyMutationRuntimeStatus"
          : \`buildPhase\${phase}TwentyMutationTarget\${titleWord}Status\`,
      newPhaseId:
        idx === 20
          ? "Phase2390A-Controlled-Twenty-Tool-Mutation-Target-Twenty"
          : \`Phase\${phase}A-Controlled-Twenty-Tool-Mutation-Target-\${titleWord}\`,
      marker,
      referenceMarkers: [...target.referenceMarkers, target.marker],
      referenceFields: [...target.referenceFields, previousMarkerField],
      requiredExports:
        idx === 1
          ? [\`export function \${idx === 20 ? "buildPhase2390TwentyMutationRuntimeStatus" : \`buildPhase\${phase}TwentyMutationTarget\${titleWord}Status\`}\`]
          : [
              \`export function \${idx === 20 ? "buildPhase2390TwentyMutationRuntimeStatus" : \`buildPhase\${phase}TwentyMutationTarget\${titleWord}Status\`}\`,
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

  const previousRuntimeTarget = previousTargets[18];
  const twentiethPhase = 2390;
  const twentiethMarker = "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK";
  upgraded.push({
    idx: 20,
    phase: twentiethPhase,
    word: "twenty",
    targetName: "target-twenty",
    path: sourceTargetPaths[19],
    proposal: "docs/phase2390-twenty-tool-mutation-target-twenty.proposal.diff",
    addMode: "append-export",
    newExport: "buildPhase2390TwentyMutationRuntimeStatus",
    newPhaseId: "Phase2390A-Controlled-Twenty-Tool-Mutation-Target-Twenty",
    marker: twentiethMarker,
    referenceMarkers: [...previousRuntimeTarget.referenceMarkers, previousRuntimeTarget.marker],
    referenceFields: [...previousRuntimeTarget.referenceFields, \`phase\${previousRuntimeTarget.phase}Marker\`],
    requiredExports: ["export function buildPhase2390TwentyMutationRuntimeStatus", "export function main"],
    requiredMarkers: [...new Set([...previousRuntimeTarget.requiredMarkers, previousRuntimeTarget.marker, twentiethMarker])],
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
    };`,
  );

  text = replaceAll(text, "tmp/phase2342-2365-proposals", "tmp/phase2366-2390-proposals");

  text = replaceAllIfPresent(
    text,
    "Phase2342A-2365A Controlled Nineteen Tool Mutation Evidence",
    "Phase2366A-2390A Controlled Twenty Tool Mutation Evidence",
  );
  text = replaceAll(
    text,
    "Phase2342A-2365A Controlled Nineteen Tool Mutation",
    "Phase2366A-2390A Controlled Twenty Tool Mutation",
  );
  text = replaceAll(
    text,
    "phase2342-2365-controlled-nineteen-tool-mutation",
    "phase2366-2390-controlled-twenty-tool-mutation",
  );
  text = replaceAllIfPresent(
    text,
    "verify:phase2342-2365-controlled-nineteen-tool-mutation",
    "verify:phase2366-2390-controlled-twenty-tool-mutation",
  );
  text = replaceAllIfPresent(
    text,
    "apply:phase2342-2365-controlled-nineteen-tool-mutation",
    "apply:phase2366-2390-controlled-twenty-tool-mutation",
  );
  text = replaceAllIfPresent(
    text,
    "smoke:phase2342-2365-controlled-nineteen-tool-mutation",
    "smoke:phase2366-2390-controlled-twenty-tool-mutation",
  );
  text = replaceAll(text, "from eighteen files to nineteen files", "from nineteen files to twenty files");
  text = replaceAll(text, "support nineteen bounded local smoke commands", "support twenty bounded local smoke commands");
  text = replaceAll(text, "The nineteen mutation batch must prove:", "The twenty mutation batch must prove:");
  text = replaceAll(text, "the nineteen target markers are not present", "the twenty target markers are not present");
  text = replaceAllIfPresent(
    text,
    "Phase2342A-2365A extends the controlled local mutation line from eighteen files to nineteen files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.",
    "Phase2366A-2390A extends the controlled local mutation line from nineteen files to twenty files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.",
  );
  text = replaceAllIfPresent(
    text,
    "- Applies exactly nineteen existing source-file mutations.",
    "- Applies exactly twenty existing source-file mutations.",
  );
  text = replaceAllIfPresent(text, "current **controlled nineteen tool mutation** batch", "current **controlled twenty tool mutation** batch");
  text = replaceAllIfPresent(text, "runs local nineteen smoke", "runs local twenty smoke");
  text = replaceAllIfPresent(text, "a twenty-file bounded batch", "a twenty-one-file bounded batch");

  text = replaceAllIfPresent(text, "nineteenMutationApplied", "twentyMutationApplied");
  text = replaceAllIfPresent(text, "localNineteenSmokePassed", "localTwentySmokePassed");
  text = replaceAllIfPresent(text, "nineteenRunnerReady", "twentyRunnerReady");
  text = replaceAllIfPresent(text, "restore-previous-content-nineteen", "restore-previous-content-twenty");
  text = replaceAllIfPresent(text, "nineteen-smoke.json", "twenty-smoke.json");
  text = replaceAllIfPresent(text, "controlled-nineteen-tool-source-mutation", "controlled-twenty-tool-source-mutation");
  text = replaceAllIfPresent(text, "changed_file_count_nineteen", "changed_file_count_twenty");
  text = replaceAllIfPresent(text, "rollback_restore_nineteen", "rollback_restore_twenty");
  text = replaceAllIfPresent(text, "rollback_nineteen_entries", "rollback_twenty_entries");
  text = replaceAllIfPresent(text, "docs_mentions_nineteen", "docs_mentions_twenty");
  text = replaceAllIfPresent(text, "nineteen_mutation_applied", "twenty_mutation_applied");
  text = replaceAllIfPresent(text, "nineteenMutationReady", "twentyMutationReady");
  text = replaceAllIfPresent(text, 'docs.includes("controlled nineteen tool mutation")', 'docs.includes("controlled twenty tool mutation")');
  text = replaceAllIfPresent(text, '"nineteen_mutation_node_check_or_smoke_failed"', '"twenty_mutation_node_check_or_smoke_failed"');

  text = replaceAllIfPresent(text, "result.changedFileCount === 19", "result.changedFileCount === 20");
  text = replaceAllIfPresent(text, "rollback.files.length === 19", "rollback.files.length === 20");
  text = replaceAllIfPresent(text, "changedFileCount: result?.changedFileCount ?? 19", "changedFileCount: result?.changedFileCount ?? 20");
  text = replaceAllIfPresent(text, "expectedOperationCount: 19", "expectedOperationCount: 20");
  text = replaceAllIfPresent(text, "expectedMaxChangedFiles: 19", "expectedMaxChangedFiles: 20");
  text = replaceAllIfPresent(text, "maxChangedFiles: 19,", "maxChangedFiles: 20,");

  text = replaceAllIfPresent(text, "phase2341Sealed", "phase2365Sealed");
  text = replaceAllIfPresent(text, "const phase2341 = readJson", "const phase2365 = readJson");
  text = replaceAllIfPresent(text, "phase2341.recommendedSealed", "phase2365.recommendedSealed");
  text = replaceAllIfPresent(text, "phase2341.", "phase2365.");

  text = replaceAllIfPresent(
    text,
    `const previousPhaseMeta = {
  phaseId: "Phase2342A-2365A-Controlled-Nineteen-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2366-2390-controlled-twenty-tool-mutation/result.json",
  sealCheckId: "phase2365_sealed",
  sealCheckField: "twentyMutationApplied",
  sealCheckBlocker: "phase2365_not_sealed",
};`,
    `const previousPhaseMeta = {
  phaseId: "Phase2342A-2365A-Controlled-Nineteen-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2342-2365-controlled-nineteen-tool-mutation/result.json",
  sealCheckId: "phase2365_sealed",
  sealCheckField: "nineteenMutationApplied",
  sealCheckBlocker: "phase2365_not_sealed",
};`,
  );

  text = replaceAllIfPresent(
    text,
    `const previousPhaseMeta = {
  phaseId: "Phase2366A-2390A-Controlled-Twenty-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2366-2390-controlled-twenty-tool-mutation/result.json",
  sealCheckId: "phase2365_sealed",
  sealCheckField: "twentyMutationApplied",
  sealCheckBlocker: "phase2365_not_sealed",
};`,
    `const previousPhaseMeta = {
  phaseId: "Phase2342A-2365A-Controlled-Nineteen-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2342-2365-controlled-nineteen-tool-mutation/result.json",
  sealCheckId: "phase2365_sealed",
  sealCheckField: "nineteenMutationApplied",
  sealCheckBlocker: "phase2365_not_sealed",
};`,
  );

  text = replaceAllIfPresent(
    text,
    "- Requires Phase2319A-2341A sealed evidence.",
    "- Requires Phase2342A-2365A sealed evidence.",
  );

  await writeFile(targetPath, text, "utf8");
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
