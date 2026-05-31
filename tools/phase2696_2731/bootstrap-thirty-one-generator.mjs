import { mkdir, readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase2661_2695/generate-thirty-phase-assets.mjs";
const targetPath = "tools/phase2696_2731/generate-thirty-one-phase-assets.mjs";

function replaceOne(text, search, replacement) {
  if (!text.includes(search)) throw new Error(`missing_replace_target:${search}`);
  return text.replace(search, replacement);
}

function replaceRegex(text, regex, replacement, label) {
  if (!regex.test(text)) throw new Error(`missing_regex_target:${label}`);
  return text.replace(regex, replacement);
}

function replaceAll(text, search, replacement) {
  if (!text.includes(search)) throw new Error(`missing_replace_all_target:${search}`);
  return text.split(search).join(replacement);
}

function replaceAllIfPresent(text, search, replacement) {
  return text.includes(search) ? text.split(search).join(replacement) : text;
}

function phaseMetaBlock() {
  return `const phaseMeta = {
  phaseId: "Phase2696A-2731A-Controlled-Thirty-One-Tool-Mutation",
  docPath: "docs/phase2696-2731-controlled-thirty-one-tool-mutation.md",
  approvalPath: "docs/phase2696-2731-controlled-thirty-one-tool-mutation-approval.example.json",
  runnerPath: "tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs",
  verifierPath: "tools/phase2696_2731/validate-controlled-thirty-one-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase2696-2731-controlled-thirty-one-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2696-2731-controlled-thirty-one-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase2696-2731-controlled-thirty-one-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase2696-2731-controlled-thirty-one-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase2696-2731-controlled-thirty-one-tool-mutation/thirty-one-smoke.json",
  permissionMode: "controlled-thirty-one-tool-source-mutation",
  label: "thirty-one",
  runnerReadyField: "thirtyOneRunnerReady",
  appliedField: "thirtyOneMutationApplied",
  smokeField: "localThirtyOneSmokePassed",
  rollbackAction: "restore-previous-content-thirty-one",
  verifyScript: "verify:phase2696-2731-controlled-thirty-one-tool-mutation",
  applyScript: "apply:phase2696-2731-controlled-thirty-one-tool-mutation",
  smokeScript: "smoke:phase2696-2731-controlled-thirty-one-tool-mutation",
};`;
}

function previousPhaseMetaBlock() {
  return `const previousPhaseMeta = {
  phaseId: "Phase2661A-2695A-Controlled-Thirty-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2661-2695-controlled-thirty-tool-mutation/result.json",
  sealCheckId: "phase2695_sealed",
  sealCheckField: "thirtyMutationApplied",
  sealCheckBlocker: "phase2695_not_sealed",
};`;
}

function buildThirtyOneTargetsFunction() {
  return `function buildThirtyOneTargets(previousTargets) {
  const upgraded = previousTargets.map((target) => {
    const idx = target.idx;
    const phase = 2700 + idx;
    const titleWord = titleWords[idx - 1];
    const word = wordNames[idx - 1];
    const marker = \`PHASE\${phase}_THIRTY_ONE_TOOL_TARGET_\${word.replace(/-/g, "_").toUpperCase()}_OK\`;
    const previousMarkerField = \`phase\${target.phase}Marker\`;
    const next = {
      ...target,
      phase,
      word,
      targetName: \`target-\${word}\`,
      proposal: \`docs/phase\${phase}-thirty-one-tool-mutation-target-\${word}.proposal.diff\`,
      newExport: \`buildPhase\${phase}ThirtyOneMutationTarget\${titleWord}Status\`,
      newPhaseId: \`Phase\${phase}A-Controlled-Thirty-One-Tool-Mutation-Target-\${word.replace(/(^|-)([a-z])/g, (_, prefix, char) => \`\${prefix === "-" ? "-" : ""}\${char.toUpperCase()}\`)}\`,
      marker,
      referenceMarkers: [...target.referenceMarkers, target.marker],
      referenceFields: [...target.referenceFields, previousMarkerField],
      requiredExports:
        idx === 1
          ? [\`export function buildPhase\${phase}ThirtyOneMutationTarget\${titleWord}Status\`]
          : [
              \`export function buildPhase\${phase}ThirtyOneMutationTarget\${titleWord}Status\`,
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

  const previousRuntimeTarget = previousTargets[29];
  const thirtyOnePhase = 2731;
  const thirtyOneMarker = "PHASE2731_THIRTY_ONE_TOOL_TARGET_THIRTY_ONE_OK";
  upgraded.push({
    idx: 31,
    phase: thirtyOnePhase,
    word: "thirty-one",
    targetName: "target-thirty-one",
    path: sourceTargetPaths[30],
    proposal: "docs/phase2731-thirty-one-tool-mutation-target-thirty-one.proposal.diff",
    addMode: "append-export",
    newExport: "buildPhase2731ThirtyOneMutationRuntimeStatus",
    newPhaseId: "Phase2731A-Controlled-Thirty-One-Tool-Mutation-Target-Thirty-One",
    marker: thirtyOneMarker,
    referenceMarkers: [...previousRuntimeTarget.referenceMarkers, previousRuntimeTarget.marker],
    referenceFields: [...previousRuntimeTarget.referenceFields, \`phase\${previousRuntimeTarget.phase}Marker\`],
    requiredExports: ["export function buildPhase2731ThirtyOneMutationRuntimeStatus", "export function main"],
    requiredMarkers: [...new Set([...previousRuntimeTarget.requiredMarkers, previousRuntimeTarget.marker, thirtyOneMarker])],
    runnerReady: true,
  });

  return upgraded;
}`;
}

async function main() {
  await mkdir("tools/phase2696_2731", { recursive: true });
  let text = await readFile(sourcePath, "utf8");

  text = replaceRegex(text, /const phaseMeta = \{[\s\S]*?\n\};/, phaseMetaBlock(), "phaseMeta");
  text = replaceRegex(text, /const previousPhaseMeta = \{[\s\S]*?\n\};/, previousPhaseMetaBlock(), "previousPhaseMeta");

  text = replaceOne(text, `  "Thirty",
];`, `  "Thirty",
  "ThirtyOne",
];`);

  text = replaceOne(
    text,
    `  "tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs",
];`,
    `  "tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs",
  "tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs",
];`,
  );

  text = replaceOne(
    text,
    `const twentyEightTargets = buildTwentyEightTargets(twentySevenTargets);
const twentyNineTargets = buildTwentyNineTargets(twentyEightTargets);
const targets = buildThirtyTargets(twentyNineTargets);
`,
    `const twentyEightTargets = buildTwentyEightTargets(twentySevenTargets);
const twentyNineTargets = buildTwentyNineTargets(twentyEightTargets);
const thirtyTargets = buildThirtyTargets(twentyNineTargets);
const targets = buildThirtyOneTargets(thirtyTargets);
`,
  );

  text = replaceOne(text, `\nconst phase2091Checks = [`, `\n${buildThirtyOneTargetsFunction()}\n\nconst phase2091Checks = [`);

  text = replaceOne(
    text,
    `      2667: "export function buildPhase2633TwentyNineMutationTargetTwoStatus() {",
      2668: "export function buildPhase2634TwentyNineMutationTargetThreeStatus() {",
      2669: "export function buildPhase2635TwentyNineMutationTargetFourStatus() {",
      2670: "export function buildPhase2636TwentyNineMutationTargetFiveStatus() {",
    };`,
    `      2667: "export function buildPhase2633TwentyNineMutationTargetTwoStatus() {",
      2668: "export function buildPhase2634TwentyNineMutationTargetThreeStatus() {",
      2669: "export function buildPhase2635TwentyNineMutationTargetFourStatus() {",
      2670: "export function buildPhase2636TwentyNineMutationTargetFiveStatus() {",
      2702: "export function buildPhase2667ThirtyMutationTargetTwoStatus() {",
      2703: "export function buildPhase2668ThirtyMutationTargetThreeStatus() {",
      2704: "export function buildPhase2669ThirtyMutationTargetFourStatus() {",
      2705: "export function buildPhase2670ThirtyMutationTargetFiveStatus() {",
    };`,
  );

  text = replaceAll(text, "tmp/phase2661-2695-proposals", "tmp/phase2696-2731-proposals");
  text = replaceAllIfPresent(
    text,
    "Phase2661A-2695A Controlled Thirty Tool Mutation Evidence",
    "Phase2696A-2731A Controlled Thirty-One Tool Mutation Evidence",
  );
  text = replaceAll(text, "Phase2661A-2695A Controlled Thirty Tool Mutation", "Phase2696A-2731A Controlled Thirty-One Tool Mutation");
  text = replaceAll(text, "phase2661-2695-controlled-thirty-tool-mutation", "phase2696-2731-controlled-thirty-one-tool-mutation");
  text = replaceAllIfPresent(text, "verify:phase2661-2695-controlled-thirty-tool-mutation", "verify:phase2696-2731-controlled-thirty-one-tool-mutation");
  text = replaceAllIfPresent(text, "apply:phase2661-2695-controlled-thirty-tool-mutation", "apply:phase2696-2731-controlled-thirty-one-tool-mutation");
  text = replaceAllIfPresent(text, "smoke:phase2661-2695-controlled-thirty-tool-mutation", "smoke:phase2696-2731-controlled-thirty-one-tool-mutation");

  text = replaceAllIfPresent(
    text,
    "Phase2661A-2695A extends the controlled local mutation line from twenty-nine files to thirty files",
    "Phase2696A-2731A extends the controlled local mutation line from twenty-nine files to thirty files",
  );
  text = replaceAllIfPresent(
    text,
    "Phase2661A-2695A extends the controlled local mutation line from thirty files to thirty-one files",
    "Phase2696A-2731A extends the controlled local mutation line from thirty files to thirty-one files",
  );
  text = replaceAll(text, "from twenty-nine files to thirty files", "from thirty files to thirty-one files");
  text = replaceAll(text, "support thirty bounded local smoke commands", "support thirty-one bounded local smoke commands");
  text = replaceAll(text, "The thirty mutation batch must prove:", "The thirty-one mutation batch must prove:");
  text = replaceAll(text, "the thirty target markers are not present", "the thirty-one target markers are not present");
  text = replaceAllIfPresent(text, "- Applies exactly thirty existing source-file mutations.", "- Applies exactly thirty-one existing source-file mutations.");
  text = replaceAllIfPresent(text, "current **controlled thirty tool mutation** batch", "current **controlled thirty-one tool mutation** batch");
  text = replaceAllIfPresent(text, "runs local thirty smoke", "runs local thirty-one smoke");
  text = replaceAllIfPresent(text, "local thirty smoke", "local thirty-one smoke");
  text = replaceAllIfPresent(text, "twenty-seven-file bounded batch", "thirty-two-file bounded batch");

  text = replaceAllIfPresent(text, "thirtyMutationApplied", "thirtyOneMutationApplied");
  text = replaceAllIfPresent(text, "localThirtySmokePassed", "localThirtyOneSmokePassed");
  text = replaceAllIfPresent(text, "thirtyRunnerReady", "thirtyOneRunnerReady");
  text = replaceAllIfPresent(text, "restore-previous-content-thirty", "restore-previous-content-thirty-one");
  text = replaceAllIfPresent(text, "thirty-smoke.json", "thirty-one-smoke.json");
  text = replaceAllIfPresent(text, "controlled-thirty-tool-source-mutation", "controlled-thirty-one-tool-source-mutation");
  text = replaceAllIfPresent(text, "changed_file_count_thirty", "changed_file_count_thirty_one");
  text = replaceAllIfPresent(text, "rollback_restore_thirty", "rollback_restore_thirty_one");
  text = replaceAllIfPresent(text, "rollback_thirty_entries", "rollback_thirty_one_entries");
  text = replaceAllIfPresent(text, "docs_mentions_thirty", "docs_mentions_thirty_one");
  text = replaceAllIfPresent(text, "thirty_mutation_applied", "thirty_one_mutation_applied");
  text = replaceAllIfPresent(text, "thirtyMutationReady", "thirtyOneMutationReady");
  text = replaceAllIfPresent(text, 'docs.includes("controlled thirty tool mutation")', 'docs.includes("controlled thirty-one tool mutation")');
  text = replaceAllIfPresent(text, '"thirty_mutation_node_check_or_smoke_failed"', '"thirty_one_mutation_node_check_or_smoke_failed"');

  text = replaceAllIfPresent(text, "result.changedFileCount === 30", "result.changedFileCount === 31");
  text = replaceAllIfPresent(text, "rollback.files.length === 30", "rollback.files.length === 31");
  text = replaceAllIfPresent(text, "changedFileCount: result?.changedFileCount ?? 30", "changedFileCount: result?.changedFileCount ?? 31");
  text = replaceAllIfPresent(text, "expectedOperationCount: 30", "expectedOperationCount: 31");
  text = replaceAllIfPresent(text, "expectedMaxChangedFiles: 30", "expectedMaxChangedFiles: 31");
  text = replaceAllIfPresent(text, "maxChangedFiles: 30,", "maxChangedFiles: 31,");

  text = replaceAllIfPresent(text, "const phase2660 = readJson(\"${previousPhaseMeta.resultPath}\") || {};", "const phase2695 = readJson(\"${previousPhaseMeta.resultPath}\") || {};");
  text = replaceAllIfPresent(text, "phase2660.recommendedSealed", "phase2695.recommendedSealed");
  text = replaceAllIfPresent(text, "phase2660.${previousPhaseMeta.sealCheckField}", "phase2695.${previousPhaseMeta.sealCheckField}");
  text = replaceAllIfPresent(text, "phase2660Sealed", "phase2695Sealed");
  text = replaceAllIfPresent(text, "phase2660_sealed", "phase2695_sealed");
  text = replaceAllIfPresent(text, "phase2660_not_sealed", "phase2695_not_sealed");
  text = replaceAllIfPresent(text, "- Requires Phase2627A-2660A sealed evidence.", "- Requires Phase2661A-2695A sealed evidence.");

  text = replaceRegex(text, /const phaseMeta = \{[\s\S]*?\n\};/, phaseMetaBlock(), "phaseMeta-final");
  text = replaceRegex(text, /const previousPhaseMeta = \{[\s\S]*?\n\};/, previousPhaseMetaBlock(), "previousPhaseMeta-final");

  await writeFile(targetPath, text, "utf8");
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
