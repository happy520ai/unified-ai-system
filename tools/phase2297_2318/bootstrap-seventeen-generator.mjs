import { readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase2276_2296/generate-sixteen-phase-assets.mjs";
const targetPath = "tools/phase2297_2318/generate-seventeen-phase-assets.mjs";

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

function injectAfter(text, search, insertion) {
  if (!text.includes(search)) {
    throw new Error(`missing_inject_anchor:${search}`);
  }
  return text.replace(search, `${search}${insertion}`);
}

async function main() {
  let text = await readFile(sourcePath, "utf8");

  text = replaceOne(
    text,
    `const phaseMeta = {
  phaseId: "Phase2276A-2296A-Controlled-Sixteen-Tool-Mutation",
  docPath: "docs/phase2276-2296-controlled-sixteen-tool-mutation.md",
  approvalPath: "docs/phase2276-2296-controlled-sixteen-tool-mutation-approval.example.json",
  runnerPath: "tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs",
  verifierPath: "tools/phase2276_2296/validate-controlled-sixteen-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase2276-2296-controlled-sixteen-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2276-2296-controlled-sixteen-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase2276-2296-controlled-sixteen-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase2276-2296-controlled-sixteen-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase2276-2296-controlled-sixteen-tool-mutation/sixteen-smoke.json",
  permissionMode: "controlled-sixteen-tool-source-mutation",
  label: "sixteen",
  runnerReadyField: "sixteenRunnerReady",
  appliedField: "sixteenMutationApplied",
  smokeField: "localSixteenSmokePassed",
  rollbackAction: "restore-previous-content-sixteen",
  verifyScript: "verify:phase2276-2296-controlled-sixteen-tool-mutation",
  applyScript: "apply:phase2276-2296-controlled-sixteen-tool-mutation",
  smokeScript: "smoke:phase2276-2296-controlled-sixteen-tool-mutation",
};`,
    `const phaseMeta = {
  phaseId: "Phase2297A-2318A-Controlled-Seventeen-Tool-Mutation",
  docPath: "docs/phase2297-2318-controlled-seventeen-tool-mutation.md",
  approvalPath: "docs/phase2297-2318-controlled-seventeen-tool-mutation-approval.example.json",
  runnerPath: "tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs",
  verifierPath: "tools/phase2297_2318/validate-controlled-seventeen-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase2297-2318-controlled-seventeen-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2297-2318-controlled-seventeen-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase2297-2318-controlled-seventeen-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase2297-2318-controlled-seventeen-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase2297-2318-controlled-seventeen-tool-mutation/seventeen-smoke.json",
  permissionMode: "controlled-seventeen-tool-source-mutation",
  label: "seventeen",
  runnerReadyField: "seventeenRunnerReady",
  appliedField: "seventeenMutationApplied",
  smokeField: "localSeventeenSmokePassed",
  rollbackAction: "restore-previous-content-seventeen",
  verifyScript: "verify:phase2297-2318-controlled-seventeen-tool-mutation",
  applyScript: "apply:phase2297-2318-controlled-seventeen-tool-mutation",
  smokeScript: "smoke:phase2297-2318-controlled-seventeen-tool-mutation",
};`,
  );

  text = replaceOne(
    text,
    `const previousPhaseMeta = {
  phaseId: "Phase2256A-2275A-Controlled-Fifteen-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2256-2275-controlled-fifteen-tool-mutation/result.json",
  sealCheckId: "phase2275_sealed",
  sealCheckField: "fifteenMutationApplied",
  sealCheckBlocker: "phase2275_not_sealed",
};`,
    `const previousPhaseMeta = {
  phaseId: "Phase2276A-2296A-Controlled-Sixteen-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2276-2296-controlled-sixteen-tool-mutation/result.json",
  sealCheckId: "phase2296_sealed",
  sealCheckField: "sixteenMutationApplied",
  sealCheckBlocker: "phase2296_not_sealed",
};`,
  );

  text = replaceOne(
    text,
    `  "Sixteen",
];`,
    `  "Sixteen",
  "Seventeen",
];`,
  );

  text = replaceOne(
    text,
    `  "tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs",
];`,
    `  "tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs",
  "tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs",
];`,
  );

  text = replaceOne(
    text,
    `const targets = baseTargets.map(buildTarget);
`,
    `const sixteenTargets = baseTargets.map(buildTarget);
const targets = buildSeventeenTargets(sixteenTargets);

function buildSeventeenTargets(previousTargets) {
  const upgraded = previousTargets.map((target) => {
    const idx = target.idx;
    const phase = 2301 + idx;
    const titleWord = titleWords[idx - 1];
    const word = wordNames[idx - 1];
    const marker = \`PHASE\${phase}_SEVENTEEN_TOOL_TARGET_\${titleWord.toUpperCase()}_OK\`;
    const previousMarkerField = \`phase\${target.phase}Marker\`;
    const next = {
      ...target,
      phase,
      word,
      targetName: \`target-\${word}\`,
      proposal: \`docs/phase\${phase}-seventeen-tool-mutation-target-\${word}.proposal.diff\`,
      newExport:
        idx === 17
          ? "buildPhase2318SeventeenMutationRuntimeStatus"
          : \`buildPhase\${phase}SeventeenMutationTarget\${titleWord}Status\`,
      newPhaseId:
        idx === 17
          ? "Phase2318A-Controlled-Seventeen-Tool-Mutation-Target-Seventeen"
          : \`Phase\${phase}A-Controlled-Seventeen-Tool-Mutation-Target-\${titleWord}\`,
      marker,
      referenceMarkers: [...target.referenceMarkers, target.marker],
      referenceFields: [...target.referenceFields, previousMarkerField],
      requiredExports:
        idx === 1
          ? [\`export function \${idx === 17 ? "buildPhase2318SeventeenMutationRuntimeStatus" : \`buildPhase\${phase}SeventeenMutationTarget\${titleWord}Status\`}\`]
          : [
              \`export function \${idx === 17 ? "buildPhase2318SeventeenMutationRuntimeStatus" : \`buildPhase\${phase}SeventeenMutationTarget\${titleWord}Status\`}\`,
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

  const previousRuntimeTarget = previousTargets[15];
  const seventeenthPhase = 2318;
  const seventeenthMarker = "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK";
  upgraded.push({
    idx: 17,
    phase: seventeenthPhase,
    word: "seventeen",
    targetName: "target-seventeen",
    path: sourceTargetPaths[16],
    proposal: "docs/phase2318-seventeen-tool-mutation-target-seventeen.proposal.diff",
    addMode: "append-export",
    newExport: "buildPhase2318SeventeenMutationRuntimeStatus",
    newPhaseId: "Phase2318A-Controlled-Seventeen-Tool-Mutation-Target-Seventeen",
    marker: seventeenthMarker,
    referenceMarkers: [...previousRuntimeTarget.referenceMarkers, previousRuntimeTarget.marker],
    referenceFields: [...previousRuntimeTarget.referenceFields, \`phase\${previousRuntimeTarget.phase}Marker\`],
    requiredExports: ["export function buildPhase2318SeventeenMutationRuntimeStatus", "export function main"],
    requiredMarkers: [...new Set([...previousRuntimeTarget.requiredMarkers, previousRuntimeTarget.marker, seventeenthMarker])],
    runnerReady: true,
  });

  return upgraded;
}
`,
  );

  text = injectAfter(
    text,
    `  "parsed?.phase2261?.marker === \\"PHASE2261_FIFTEEN_TOOL_TARGET_ONE_OK\\"",
`,
    `  "parsed?.phase2281?.marker === \\"PHASE2281_SIXTEEN_TOOL_TARGET_ONE_OK\\"",
`,
  );

  const firstFivePhaseMarkers = [
    { old: 2262, current: 2282, label: "TWO" },
    { old: 2263, current: 2283, label: "THREE" },
    { old: 2264, current: 2284, label: "FOUR" },
    { old: 2265, current: 2285, label: "FIVE" },
  ];

  for (const entry of firstFivePhaseMarkers) {
    text = injectAfter(
      text,
      `      \`parsed?.phase${entry.old}Marker === "PHASE${entry.old}_FIFTEEN_TOOL_TARGET_${entry.label}_OK"\`,
`,
      `      \`parsed?.phase${entry.current}Marker === "PHASE${entry.current}_SIXTEEN_TOOL_TARGET_${entry.label}_OK"\`,
`,
    );
  }

  text = replaceAll(text, `const phase = 2280 + baseTarget.idx;`, `const phase = 2280 + baseTarget.idx;`);
  text = replaceAll(text, `tmp/phase2276-2296-proposals`, `tmp/phase2297-2318-proposals`);
  text = replaceAll(text, `targets[15]`, `targets[targets.length - 1]`);

  text = replaceAllIfPresent(text, `Phase2276A-2296A Controlled Sixteen Tool Mutation Evidence`, `Phase2297A-2318A Controlled Seventeen Tool Mutation Evidence`);
  text = replaceAll(text, `Phase2276A-2296A Controlled Sixteen Tool Mutation`, `Phase2297A-2318A Controlled Seventeen Tool Mutation`);
  text = replaceAll(text, `Phase2256A-2275A sealed evidence.`, `Phase2276A-2296A sealed evidence.`);
  text = replaceAllIfPresent(text, `Phase2256A-2275A seal`, `Phase2276A-2296A seal`);
  text = replaceAllIfPresent(text, `phase2275`, `phase2296`);
  text = replaceAllIfPresent(text, `fifteenMutationApplied`, `sixteenMutationApplied`);
  text = replaceAllIfPresent(text, `sixteenMutationApplied`, `seventeenMutationApplied`);
  text = replaceAllIfPresent(text, `localSixteenSmokePassed`, `localSeventeenSmokePassed`);
  text = replaceAllIfPresent(text, `restore-previous-content-sixteen`, `restore-previous-content-seventeen`);
  text = replaceAllIfPresent(text, `changed_file_count_sixteen`, `changed_file_count_seventeen`);
  text = replaceAllIfPresent(text, `sixteenMutationReady`, `seventeenMutationReady`);
  text = replaceAll(text, `The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support sixteen bounded local smoke commands without duplicating smoke boilerplate.`, `The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support seventeen bounded local smoke commands without duplicating smoke boilerplate.`);
  text = replaceAll(text, `The sixteen mutation batch must prove:`, `The seventeen mutation batch must prove:`);
  text = replaceAll(text, `Applies exactly sixteen existing source-file mutations.`, `Applies exactly seventeen existing source-file mutations.`);
  text = replaceAllIfPresent(text, `runs local sixteen smoke`, `runs local seventeen smoke`);
  text = replaceAllIfPresent(text, `The first verifier run is expected to fail before apply because result evidence does not exist yet and the sixteen target markers are not present.`, `The first verifier run is expected to fail before apply because result evidence does not exist yet and the seventeen target markers are not present.`);
  text = replaceAll(text, `a seventeen-file bounded batch`, `an eighteen-file bounded batch`);
  text = replaceAllIfPresent(text, `maxChangedFiles: 16`, `maxChangedFiles: 17`);
  text = replaceAllIfPresent(text, `expectedOperationCount: 16`, `expectedOperationCount: 17`);
  text = replaceAllIfPresent(text, `expectedMaxChangedFiles: 16`, `expectedMaxChangedFiles: 17`);
  text = replaceAllIfPresent(text, `rollback.files) && rollback.files.length === 16`, `rollback.files) && rollback.files.length === 17`);
  text = replaceAllIfPresent(text, `changedFileCount === 16`, `changedFileCount === 17`);
  text = replaceAllIfPresent(text, `changedFileCount: result?.changedFileCount ?? 16`, `changedFileCount: result?.changedFileCount ?? 17`);
  text = replaceAllIfPresent(text, `maxChangedFiles: 16,`, `maxChangedFiles: 17,`);
  text = replaceAllIfPresent(text, `operationCount: planOperations.length,`, `operationCount: planOperations.length,`);

  await writeFile(targetPath, text, "utf8");
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
