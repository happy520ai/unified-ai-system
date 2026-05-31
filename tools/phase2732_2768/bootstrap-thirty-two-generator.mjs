import { mkdir, readFile, writeFile } from "node:fs/promises";

const sourcePath = "tools/phase2696_2731/generate-thirty-one-phase-assets.mjs";
const targetPath = "tools/phase2732_2768/generate-thirty-two-phase-assets.mjs";

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
  phaseId: "Phase2732A-2768A-Controlled-Thirty-Two-Tool-Mutation",
  docPath: "docs/phase2732-2768-controlled-thirty-two-tool-mutation.md",
  approvalPath: "docs/phase2732-2768-controlled-thirty-two-tool-mutation-approval.example.json",
  runnerPath: "tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs",
  verifierPath: "tools/phase2732_2768/validate-controlled-thirty-two-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase2732-2768-controlled-thirty-two-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2732-2768-controlled-thirty-two-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase2732-2768-controlled-thirty-two-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase2732-2768-controlled-thirty-two-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase2732-2768-controlled-thirty-two-tool-mutation/thirty-two-smoke.json",
  permissionMode: "controlled-thirty-two-tool-source-mutation",
  label: "thirty-two",
  runnerReadyField: "thirtyTwoRunnerReady",
  appliedField: "thirtyTwoMutationApplied",
  smokeField: "localThirtyTwoSmokePassed",
  rollbackAction: "restore-previous-content-thirty-two",
  verifyScript: "verify:phase2732-2768-controlled-thirty-two-tool-mutation",
  applyScript: "apply:phase2732-2768-controlled-thirty-two-tool-mutation",
  smokeScript: "smoke:phase2732-2768-controlled-thirty-two-tool-mutation",
};`;
}

function previousPhaseMetaBlock() {
  return `const previousPhaseMeta = {
  phaseId: "Phase2696A-2731A-Controlled-Thirty-One-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2696-2731-controlled-thirty-one-tool-mutation/result.json",
  sealCheckId: "phase2731_sealed",
  sealCheckField: "thirtyOneMutationApplied",
  sealCheckBlocker: "phase2731_not_sealed",
};`;
}

function buildThirtyTwoTargetsFunction() {
  return `function buildThirtyTwoTargets(previousTargets) {
  const upgraded = previousTargets.map((target) => {
    const idx = target.idx;
    const phase = 2736 + idx;
    const titleWord = titleWords[idx - 1];
    const word = wordNames[idx - 1];
    const marker = \`PHASE\${phase}_THIRTY_TWO_TOOL_TARGET_\${word.replace(/-/g, "_").toUpperCase()}_OK\`;
    const previousMarkerField = \`phase\${target.phase}Marker\`;
    const next = {
      ...target,
      phase,
      word,
      targetName: \`target-\${word}\`,
      proposal: \`docs/phase\${phase}-thirty-two-tool-mutation-target-\${word}.proposal.diff\`,
      newExport: \`buildPhase\${phase}ThirtyTwoMutationTarget\${titleWord}Status\`,
      newPhaseId: \`Phase\${phase}A-Controlled-Thirty-Two-Tool-Mutation-Target-\${word.replace(/(^|-)([a-z])/g, (_, prefix, char) => \`\${prefix === "-" ? "-" : ""}\${char.toUpperCase()}\`)}\`,
      marker,
      referenceMarkers: [...target.referenceMarkers, target.marker],
      referenceFields: [...target.referenceFields, previousMarkerField],
      requiredExports:
        idx === 1
          ? [\`export function buildPhase\${phase}ThirtyTwoMutationTarget\${titleWord}Status\`]
          : [
              \`export function buildPhase\${phase}ThirtyTwoMutationTarget\${titleWord}Status\`,
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

  const previousRuntimeTarget = previousTargets[30];
  const thirtyTwoPhase = 2768;
  const thirtyTwoMarker = "PHASE2768_THIRTY_TWO_TOOL_TARGET_THIRTY_TWO_OK";
  upgraded.push({
    idx: 32,
    phase: thirtyTwoPhase,
    word: "thirty-two",
    targetName: "target-thirty-two",
    path: sourceTargetPaths[31],
    proposal: "docs/phase2768-thirty-two-tool-mutation-target-thirty-two.proposal.diff",
    addMode: "append-export",
    newExport: "buildPhase2768ThirtyTwoMutationRuntimeStatus",
    newPhaseId: "Phase2768A-Controlled-Thirty-Two-Tool-Mutation-Target-Thirty-Two",
    marker: thirtyTwoMarker,
    referenceMarkers: [...previousRuntimeTarget.referenceMarkers, previousRuntimeTarget.marker],
    referenceFields: [...previousRuntimeTarget.referenceFields, \`phase\${previousRuntimeTarget.phase}Marker\`],
    requiredExports: ["export function buildPhase2768ThirtyTwoMutationRuntimeStatus", "export function main"],
    requiredMarkers: [...new Set([...previousRuntimeTarget.requiredMarkers, previousRuntimeTarget.marker, thirtyTwoMarker])],
    runnerReady: true,
  });

  return upgraded;
}`;
}

async function main() {
  await mkdir("tools/phase2732_2768", { recursive: true });
  let text = await readFile(sourcePath, "utf8");

  text = replaceRegex(text, /const phaseMeta = \{[\s\S]*?\n\};/, phaseMetaBlock(), "phaseMeta");
  text = replaceRegex(text, /const previousPhaseMeta = \{[\s\S]*?\n\};/, previousPhaseMetaBlock(), "previousPhaseMeta");

  text = replaceOne(text, `  "ThirtyOne",
];`, `  "ThirtyOne",
  "ThirtyTwo",
];`);

  text = replaceOne(
    text,
    `  "tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs",
];`,
    `  "tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs",
  "tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs",
];`,
  );

  text = replaceOne(
    text,
    `const twentyNineTargets = buildTwentyNineTargets(twentyEightTargets);
const thirtyTargets = buildThirtyTargets(twentyNineTargets);
const targets = buildThirtyOneTargets(thirtyTargets);
`,
    `const twentyNineTargets = buildTwentyNineTargets(twentyEightTargets);
const thirtyTargets = buildThirtyTargets(twentyNineTargets);
const thirtyOneTargets = buildThirtyOneTargets(thirtyTargets);
const targets = buildThirtyTwoTargets(thirtyOneTargets);
`,
  );

  text = replaceOne(text, `\nconst phase2091Checks = [`, `\n${buildThirtyTwoTargetsFunction()}\n\nconst phase2091Checks = [`);

  text = replaceOne(
    text,
    `      2702: "export function buildPhase2667ThirtyMutationTargetTwoStatus() {",
      2703: "export function buildPhase2668ThirtyMutationTargetThreeStatus() {",
      2704: "export function buildPhase2669ThirtyMutationTargetFourStatus() {",
      2705: "export function buildPhase2670ThirtyMutationTargetFiveStatus() {",
    };`,
    `      2702: "export function buildPhase2667ThirtyMutationTargetTwoStatus() {",
      2703: "export function buildPhase2668ThirtyMutationTargetThreeStatus() {",
      2704: "export function buildPhase2669ThirtyMutationTargetFourStatus() {",
      2705: "export function buildPhase2670ThirtyMutationTargetFiveStatus() {",
      2738: "export function buildPhase2702ThirtyOneMutationTargetTwoStatus() {",
      2739: "export function buildPhase2703ThirtyOneMutationTargetThreeStatus() {",
      2740: "export function buildPhase2704ThirtyOneMutationTargetFourStatus() {",
      2741: "export function buildPhase2705ThirtyOneMutationTargetFiveStatus() {",
    };`,
  );

  text = replaceAll(text, "tmp/phase2696-2731-proposals", "tmp/phase2732-2768-proposals");
  text = replaceAllIfPresent(
    text,
    "Phase2696A-2731A Controlled Thirty-One Tool Mutation Evidence",
    "Phase2732A-2768A Controlled Thirty-Two Tool Mutation Evidence",
  );
  text = replaceAll(text, "Phase2696A-2731A Controlled Thirty-One Tool Mutation", "Phase2732A-2768A Controlled Thirty-Two Tool Mutation");
  text = replaceAll(text, "phase2696-2731-controlled-thirty-one-tool-mutation", "phase2732-2768-controlled-thirty-two-tool-mutation");
  text = replaceAllIfPresent(text, "verify:phase2696-2731-controlled-thirty-one-tool-mutation", "verify:phase2732-2768-controlled-thirty-two-tool-mutation");
  text = replaceAllIfPresent(text, "apply:phase2696-2731-controlled-thirty-one-tool-mutation", "apply:phase2732-2768-controlled-thirty-two-tool-mutation");
  text = replaceAllIfPresent(text, "smoke:phase2696-2731-controlled-thirty-one-tool-mutation", "smoke:phase2732-2768-controlled-thirty-two-tool-mutation");

  text = replaceAllIfPresent(
    text,
    "Phase2696A-2731A extends the controlled local mutation line from thirty files to thirty-one files",
    "Phase2732A-2768A extends the controlled local mutation line from thirty files to thirty-one files",
  );
  text = replaceAllIfPresent(
    text,
    "Phase2696A-2731A extends the controlled local mutation line from thirty-one files to thirty-two files",
    "Phase2732A-2768A extends the controlled local mutation line from thirty-one files to thirty-two files",
  );
  text = replaceAll(text, "from thirty files to thirty-one files", "from thirty-one files to thirty-two files");
  text = replaceAll(text, "support thirty-one bounded local smoke commands", "support thirty-two bounded local smoke commands");
  text = replaceAll(text, "The thirty-one mutation batch must prove:", "The thirty-two mutation batch must prove:");
  text = replaceAll(text, "the thirty-one target markers are not present", "the thirty-two target markers are not present");
  text = replaceAllIfPresent(text, "- Applies exactly thirty-one existing source-file mutations.", "- Applies exactly thirty-two existing source-file mutations.");
  text = replaceAllIfPresent(text, "current **controlled thirty-one tool mutation** batch", "current **controlled thirty-two tool mutation** batch");
  text = replaceAllIfPresent(text, "runs local thirty-one smoke", "runs local thirty-two smoke");
  text = replaceAllIfPresent(text, "local thirty-one smoke", "local thirty-two smoke");
  text = replaceAllIfPresent(text, "thirty-two-file bounded batch", "thirty-three-file bounded batch");

  text = replaceAllIfPresent(text, "thirtyOneMutationApplied", "thirtyTwoMutationApplied");
  text = replaceAllIfPresent(text, "localThirtyOneSmokePassed", "localThirtyTwoSmokePassed");
  text = replaceAllIfPresent(text, "thirtyOneRunnerReady", "thirtyTwoRunnerReady");
  text = replaceAllIfPresent(text, "restore-previous-content-thirty-one", "restore-previous-content-thirty-two");
  text = replaceAllIfPresent(text, "thirty-one-smoke.json", "thirty-two-smoke.json");
  text = replaceAllIfPresent(text, "controlled-thirty-one-tool-source-mutation", "controlled-thirty-two-tool-source-mutation");
  text = replaceAllIfPresent(text, "changed_file_count_thirty_one", "changed_file_count_thirty_two");
  text = replaceAllIfPresent(text, "rollback_restore_thirty_one", "rollback_restore_thirty_two");
  text = replaceAllIfPresent(text, "rollback_thirty_one_entries", "rollback_thirty_two_entries");
  text = replaceAllIfPresent(text, "docs_mentions_thirty_one", "docs_mentions_thirty_two");
  text = replaceAllIfPresent(text, "thirty_one_mutation_applied", "thirty_two_mutation_applied");
  text = replaceAllIfPresent(text, "thirtyOneMutationReady", "thirtyTwoMutationReady");
  text = replaceAllIfPresent(text, 'docs.includes("controlled thirty-one tool mutation")', 'docs.includes("controlled thirty-two tool mutation")');
  text = replaceAllIfPresent(text, '"thirty_one_mutation_node_check_or_smoke_failed"', '"thirty_two_mutation_node_check_or_smoke_failed"');

  text = replaceAllIfPresent(text, "result.changedFileCount === 31", "result.changedFileCount === 32");
  text = replaceAllIfPresent(text, "rollback.files.length === 31", "rollback.files.length === 32");
  text = replaceAllIfPresent(text, "changedFileCount: result?.changedFileCount ?? 31", "changedFileCount: result?.changedFileCount ?? 32");
  text = replaceAllIfPresent(text, "expectedOperationCount: 31", "expectedOperationCount: 32");
  text = replaceAllIfPresent(text, "expectedMaxChangedFiles: 31", "expectedMaxChangedFiles: 32");
  text = replaceAllIfPresent(text, "maxChangedFiles: 31,", "maxChangedFiles: 32,");

  text = replaceAllIfPresent(text, "const phase2695 = readJson(\"${previousPhaseMeta.resultPath}\") || {};", "const phase2731 = readJson(\"${previousPhaseMeta.resultPath}\") || {};");
  text = replaceAllIfPresent(text, "phase2695.recommendedSealed", "phase2731.recommendedSealed");
  text = replaceAllIfPresent(text, "phase2695.${previousPhaseMeta.sealCheckField}", "phase2731.${previousPhaseMeta.sealCheckField}");
  text = replaceAllIfPresent(text, "phase2695Sealed", "phase2731Sealed");
  text = replaceAllIfPresent(text, "phase2695_sealed", "phase2731_sealed");
  text = replaceAllIfPresent(text, "phase2695_not_sealed", "phase2731_not_sealed");
  text = replaceAllIfPresent(text, "- Requires Phase2661A-2695A sealed evidence.", "- Requires Phase2696A-2731A sealed evidence.");

  text = replaceRegex(text, /const phaseMeta = \{[\s\S]*?\n\};/, phaseMetaBlock(), "phaseMeta-final");
  text = replaceRegex(text, /const previousPhaseMeta = \{[\s\S]*?\n\};/, previousPhaseMetaBlock(), "previousPhaseMeta-final");

  await writeFile(targetPath, text, "utf8");
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
