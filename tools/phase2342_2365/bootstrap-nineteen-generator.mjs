import { readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase2319_2341/generate-eighteen-phase-assets.mjs";
const targetPath = "tools/phase2342_2365/generate-nineteen-phase-assets.mjs";

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
  phaseId: "Phase2319A-2341A-Controlled-Eighteen-Tool-Mutation",
  docPath: "docs/phase2319-2341-controlled-eighteen-tool-mutation.md",
  approvalPath: "docs/phase2319-2341-controlled-eighteen-tool-mutation-approval.example.json",
  runnerPath: "tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs",
  verifierPath: "tools/phase2319_2341/validate-controlled-eighteen-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase2319-2341-controlled-eighteen-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2319-2341-controlled-eighteen-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase2319-2341-controlled-eighteen-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase2319-2341-controlled-eighteen-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase2319-2341-controlled-eighteen-tool-mutation/eighteen-smoke.json",
  permissionMode: "controlled-eighteen-tool-source-mutation",
  label: "eighteen",
  runnerReadyField: "eighteenRunnerReady",
  appliedField: "eighteenMutationApplied",
  smokeField: "localEighteenSmokePassed",
  rollbackAction: "restore-previous-content-eighteen",
  verifyScript: "verify:phase2319-2341-controlled-eighteen-tool-mutation",
  applyScript: "apply:phase2319-2341-controlled-eighteen-tool-mutation",
  smokeScript: "smoke:phase2319-2341-controlled-eighteen-tool-mutation",
};`,
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
  );

  text = replaceOne(
    text,
    `const previousPhaseMeta = {
  phaseId: "Phase2319A-2341A-Controlled-Eighteen-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2297-2318-controlled-seventeen-tool-mutation/result.json",
  sealCheckId: "phase2318_sealed",
  sealCheckField: "seventeenMutationApplied",
  sealCheckBlocker: "phase2318_not_sealed",
};`,
    `const previousPhaseMeta = {
  phaseId: "Phase2319A-2341A-Controlled-Eighteen-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2319-2341-controlled-eighteen-tool-mutation/result.json",
  sealCheckId: "phase2341_sealed",
  sealCheckField: "eighteenMutationApplied",
  sealCheckBlocker: "phase2341_not_sealed",
};`,
  );

  text = replaceOne(
    text,
    `  "Eighteen",
];`,
    `  "Eighteen",
  "Nineteen",
];`,
  );

  text = replaceOne(
    text,
    `  "tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs",
];`,
    `  "tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs",
  "tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs",
];`,
  );

  text = replaceOne(
    text,
    `const sixteenTargets = baseTargets.map(buildTarget);
const seventeenTargets = buildSeventeenTargets(sixteenTargets);
const targets = buildEighteenTargets(seventeenTargets);
`,
    `const sixteenTargets = baseTargets.map(buildTarget);
const seventeenTargets = buildSeventeenTargets(sixteenTargets);
const eighteenTargets = buildEighteenTargets(seventeenTargets);
const targets = buildNineteenTargets(eighteenTargets);
`,
  );

  text = replaceOne(
    text,
    `  return upgraded;
}

const phase2091Checks = [`,
    `  return upgraded;
}

function buildNineteenTargets(previousTargets) {
  const upgraded = previousTargets.map((target) => {
    const idx = target.idx;
    const phase = 2346 + idx;
    const titleWord = titleWords[idx - 1];
    const word = wordNames[idx - 1];
    const marker = \`PHASE\${phase}_NINETEEN_TOOL_TARGET_\${titleWord.toUpperCase()}_OK\`;
    const previousMarkerField = \`phase\${target.phase}Marker\`;
    const next = {
      ...target,
      phase,
      word,
      targetName: \`target-\${word}\`,
      proposal: \`docs/phase\${phase}-nineteen-tool-mutation-target-\${word}.proposal.diff\`,
      newExport:
        idx === 19
          ? "buildPhase2365NineteenMutationRuntimeStatus"
          : \`buildPhase\${phase}NineteenMutationTarget\${titleWord}Status\`,
      newPhaseId:
        idx === 19
          ? "Phase2365A-Controlled-Nineteen-Tool-Mutation-Target-Nineteen"
          : \`Phase\${phase}A-Controlled-Nineteen-Tool-Mutation-Target-\${titleWord}\`,
      marker,
      referenceMarkers: [...target.referenceMarkers, target.marker],
      referenceFields: [...target.referenceFields, previousMarkerField],
      requiredExports:
        idx === 1
          ? [\`export function \${idx === 19 ? "buildPhase2365NineteenMutationRuntimeStatus" : \`buildPhase\${phase}NineteenMutationTarget\${titleWord}Status\`}\`]
          : [
              \`export function \${idx === 19 ? "buildPhase2365NineteenMutationRuntimeStatus" : \`buildPhase\${phase}NineteenMutationTarget\${titleWord}Status\`}\`,
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

  const previousRuntimeTarget = previousTargets[17];
  const nineteenthPhase = 2365;
  const nineteenthMarker = "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK";
  upgraded.push({
    idx: 19,
    phase: nineteenthPhase,
    word: "nineteen",
    targetName: "target-nineteen",
    path: sourceTargetPaths[18],
    proposal: "docs/phase2365-nineteen-tool-mutation-target-nineteen.proposal.diff",
    addMode: "append-export",
    newExport: "buildPhase2365NineteenMutationRuntimeStatus",
    newPhaseId: "Phase2365A-Controlled-Nineteen-Tool-Mutation-Target-Nineteen",
    marker: nineteenthMarker,
    referenceMarkers: [...previousRuntimeTarget.referenceMarkers, previousRuntimeTarget.marker],
    referenceFields: [...previousRuntimeTarget.referenceFields, \`phase\${previousRuntimeTarget.phase}Marker\`],
    requiredExports: ["export function buildPhase2365NineteenMutationRuntimeStatus", "export function main"],
    requiredMarkers: [...new Set([...previousRuntimeTarget.requiredMarkers, previousRuntimeTarget.marker, nineteenthMarker])],
    runnerReady: true,
  });

  return upgraded;
}

const phase2091Checks = [`,
  );

  text = replaceAll(text, "tmp/phase2319-2341-proposals", "tmp/phase2342-2365-proposals");

  text = replaceAllIfPresent(
    text,
    "Phase2319A-2341A Controlled Eighteen Tool Mutation Evidence",
    "Phase2342A-2365A Controlled Nineteen Tool Mutation Evidence",
  );
  text = replaceAll(
    text,
    "Phase2319A-2341A Controlled Eighteen Tool Mutation",
    "Phase2342A-2365A Controlled Nineteen Tool Mutation",
  );
  text = replaceAll(
    text,
    "phase2319-2341-controlled-eighteen-tool-mutation",
    "phase2342-2365-controlled-nineteen-tool-mutation",
  );
  text = replaceAllIfPresent(
    text,
    "verify:phase2319-2341-controlled-eighteen-tool-mutation",
    "verify:phase2342-2365-controlled-nineteen-tool-mutation",
  );
  text = replaceAllIfPresent(
    text,
    "apply:phase2319-2341-controlled-eighteen-tool-mutation",
    "apply:phase2342-2365-controlled-nineteen-tool-mutation",
  );
  text = replaceAllIfPresent(
    text,
    "smoke:phase2319-2341-controlled-eighteen-tool-mutation",
    "smoke:phase2342-2365-controlled-nineteen-tool-mutation",
  );
  text = replaceAll(text, "from seventeen files to eighteen files", "from eighteen files to nineteen files");
  text = replaceAll(text, "support eighteen bounded local smoke commands", "support nineteen bounded local smoke commands");
  text = replaceAll(text, "The eighteen mutation batch must prove:", "The nineteen mutation batch must prove:");
  text = replaceAll(text, "the eighteen target markers are not present", "the nineteen target markers are not present");
  text = replaceAllIfPresent(
    text,
    "Phase2319A-2341A extends the controlled local mutation line from eighteen files to nineteen files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.",
    "Phase2342A-2365A extends the controlled local mutation line from eighteen files to nineteen files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.",
  );
  text = replaceAllIfPresent(
    text,
    "- Applies exactly eighteen existing source-file mutations.",
    "- Applies exactly nineteen existing source-file mutations.",
  );
  text = replaceAllIfPresent(text, "current **controlled eighteen tool mutation** batch", "current **controlled nineteen tool mutation** batch");
  text = replaceAllIfPresent(text, "runs local eighteen smoke", "runs local nineteen smoke");
  text = replaceAllIfPresent(text, "a nineteen-file bounded batch", "a twenty-file bounded batch");

  text = replaceAllIfPresent(text, "eighteenMutationApplied", "nineteenMutationApplied");
  text = replaceAllIfPresent(text, "localEighteenSmokePassed", "localNineteenSmokePassed");
  text = replaceAllIfPresent(text, "eighteenRunnerReady", "nineteenRunnerReady");
  text = replaceAllIfPresent(text, "restore-previous-content-eighteen", "restore-previous-content-nineteen");
  text = replaceAllIfPresent(text, "eighteen-smoke.json", "nineteen-smoke.json");
  text = replaceAllIfPresent(text, "controlled-eighteen-tool-source-mutation", "controlled-nineteen-tool-source-mutation");
  text = replaceAllIfPresent(text, "changed_file_count_eighteen", "changed_file_count_nineteen");
  text = replaceAllIfPresent(text, "rollback_restore_eighteen", "rollback_restore_nineteen");
  text = replaceAllIfPresent(text, "rollback_eighteen_entries", "rollback_nineteen_entries");
  text = replaceAllIfPresent(text, "docs_mentions_eighteen", "docs_mentions_nineteen");
  text = replaceAllIfPresent(text, "eighteen_mutation_applied", "nineteen_mutation_applied");
  text = replaceAllIfPresent(text, "eighteenMutationReady", "nineteenMutationReady");
  text = replaceAllIfPresent(text, 'docs.includes("controlled eighteen tool mutation")', 'docs.includes("controlled nineteen tool mutation")');
  text = replaceAllIfPresent(text, '"eighteen_mutation_node_check_or_smoke_failed"', '"nineteen_mutation_node_check_or_smoke_failed"');

  text = replaceAllIfPresent(text, "result.changedFileCount === 18", "result.changedFileCount === 19");
  text = replaceAllIfPresent(text, "rollback.files.length === 18", "rollback.files.length === 19");
  text = replaceAllIfPresent(text, "changedFileCount: result?.changedFileCount ?? 18", "changedFileCount: result?.changedFileCount ?? 19");
  text = replaceAllIfPresent(text, "expectedOperationCount: 18", "expectedOperationCount: 19");
  text = replaceAllIfPresent(text, "expectedMaxChangedFiles: 18", "expectedMaxChangedFiles: 19");
  text = replaceAllIfPresent(text, "maxChangedFiles: 18,", "maxChangedFiles: 19,");

  text = replaceAllIfPresent(text, "phase2318Sealed", "phase2341Sealed");
  text = replaceAllIfPresent(text, "const phase2318 = readJson", "const phase2341 = readJson");
  text = replaceAllIfPresent(text, "phase2318.recommendedSealed", "phase2341.recommendedSealed");
  text = replaceAllIfPresent(text, "phase2318.", "phase2341.");

  text = replaceAllIfPresent(
    text,
    `const previousPhaseMeta = {
  phaseId: "Phase2319A-2341A-Controlled-Eighteen-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2342-2365-controlled-nineteen-tool-mutation/result.json",
  sealCheckId: "phase2341_sealed",
  sealCheckField: "nineteenMutationApplied",
  sealCheckBlocker: "phase2341_not_sealed",
};`,
    `const previousPhaseMeta = {
  phaseId: "Phase2319A-2341A-Controlled-Eighteen-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2319-2341-controlled-eighteen-tool-mutation/result.json",
  sealCheckId: "phase2341_sealed",
  sealCheckField: "eighteenMutationApplied",
  sealCheckBlocker: "phase2341_not_sealed",
};`,
  );

  text = replaceAllIfPresent(
    text,
    "- Requires Phase2297A-2318A sealed evidence.",
    "- Requires Phase2319A-2341A sealed evidence.",
  );

  await writeFile(targetPath, text, "utf8");
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
