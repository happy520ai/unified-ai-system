import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = process.cwd();

const phaseMeta = {
  phaseId: "Phase2186A-2201A-Controlled-Eleven-Tool-Mutation",
  docPath: "docs/phase2186-2201-controlled-eleven-tool-mutation.md",
  approvalPath: "docs/phase2186-2201-controlled-eleven-tool-mutation-approval.example.json",
  runnerPath: "tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs",
  verifierPath: "tools/phase2186_2201/validate-controlled-eleven-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase2186-2201-controlled-eleven-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2186-2201-controlled-eleven-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase2186-2201-controlled-eleven-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase2186-2201-controlled-eleven-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase2186-2201-controlled-eleven-tool-mutation/eleven-smoke.json",
  permissionMode: "controlled-eleven-tool-source-mutation",
  label: "eleven",
  runnerReadyField: "elevenRunnerReady",
  appliedField: "elevenMutationApplied",
  smokeField: "localElevenSmokePassed",
  rollbackAction: "restore-previous-content-eleven",
  verifyScript: "verify:phase2186-2201-controlled-eleven-tool-mutation",
  applyScript: "apply:phase2186-2201-controlled-eleven-tool-mutation",
  smokeScript: "smoke:phase2186-2201-controlled-eleven-tool-mutation",
};

const targets = [
  {
    idx: 1,
    phase: 2191,
    word: "one",
    path: "tools/phase2091/generated-source-patch-target.mjs",
    proposal: "docs/phase2191-eleven-tool-mutation-target-one.proposal.diff",
    addMode: "phase2091-main",
    newExport: "buildPhase2191ElevenMutationTargetOneStatus",
    newPhaseId: "Phase2191A-Controlled-Eleven-Tool-Mutation-Target-One",
    marker: "PHASE2191_ELEVEN_TOOL_TARGET_ONE_OK",
    referenceMarkers: ["PHASE2149_OCT_TOOL_TARGET_ONE_OK", "PHASE2162_NONET_TOOL_TARGET_ONE_OK", "PHASE2176_DECA_TOOL_TARGET_ONE_OK"],
    referenceFields: ["phase2149Marker", "phase2162Marker", "phase2176Marker"],
    requiredExports: ["export function buildPhase2191ElevenMutationTargetOneStatus"],
    requiredMarkers: ["PHASE2091_SOURCE_PATCH_OK", "PHASE2162_NONET_TOOL_TARGET_ONE_OK", "PHASE2176_DECA_TOOL_TARGET_ONE_OK", "PHASE2191_ELEVEN_TOOL_TARGET_ONE_OK"],
  },
  {
    idx: 2,
    phase: 2192,
    word: "two",
    path: "tools/phase2092/apply-controlled-existing-tool-mutation.mjs",
    proposal: "docs/phase2192-eleven-tool-mutation-target-two.proposal.diff",
    addMode: "runtime-plus-export",
    runtimeExport: "buildPhase2094BatchMutationRuntimeStatus",
    runtimeMarkerField: "phase2192Marker",
    newExport: "buildPhase2192ElevenMutationTargetTwoStatus",
    newPhaseId: "Phase2192A-Controlled-Eleven-Tool-Mutation-Target-Two",
    marker: "PHASE2192_ELEVEN_TOOL_TARGET_TWO_OK",
    referenceMarkers: ["PHASE2150_OCT_TOOL_TARGET_TWO_OK", "PHASE2163_NONET_TOOL_TARGET_TWO_OK", "PHASE2177_DECA_TOOL_TARGET_TWO_OK"],
    referenceFields: ["phase2150Marker", "phase2163Marker", "phase2177Marker"],
    requiredExports: [
      "export function buildPhase2192ElevenMutationTargetTwoStatus",
      "export function buildPhase2094BatchMutationRuntimeStatus",
      "export function main",
    ],
    requiredMarkers: ["PHASE2094_BATCH_TOOL_TARGET_TWO_OK", "PHASE2163_NONET_TOOL_TARGET_TWO_OK", "PHASE2177_DECA_TOOL_TARGET_TWO_OK", "PHASE2192_ELEVEN_TOOL_TARGET_TWO_OK"],
  },
  {
    idx: 3,
    phase: 2193,
    word: "three",
    path: "tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs",
    proposal: "docs/phase2193-eleven-tool-mutation-target-three.proposal.diff",
    addMode: "runtime-plus-export",
    runtimeExport: "buildPhase2100TripleMutationRuntimeStatus",
    runtimeMarkerField: "phase2193Marker",
    newExport: "buildPhase2193ElevenMutationTargetThreeStatus",
    newPhaseId: "Phase2193A-Controlled-Eleven-Tool-Mutation-Target-Three",
    marker: "PHASE2193_ELEVEN_TOOL_TARGET_THREE_OK",
    referenceMarkers: ["PHASE2151_OCT_TOOL_TARGET_THREE_OK", "PHASE2164_NONET_TOOL_TARGET_THREE_OK", "PHASE2178_DECA_TOOL_TARGET_THREE_OK"],
    referenceFields: ["phase2151Marker", "phase2164Marker", "phase2178Marker"],
    requiredExports: [
      "export function buildPhase2193ElevenMutationTargetThreeStatus",
      "export function buildPhase2100TripleMutationRuntimeStatus",
      "export function main",
    ],
    requiredMarkers: ["PHASE2100_TRIPLE_TOOL_TARGET_THREE_OK", "PHASE2164_NONET_TOOL_TARGET_THREE_OK", "PHASE2178_DECA_TOOL_TARGET_THREE_OK", "PHASE2193_ELEVEN_TOOL_TARGET_THREE_OK"],
  },
  {
    idx: 4,
    phase: 2194,
    word: "four",
    path: "tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs",
    proposal: "docs/phase2194-eleven-tool-mutation-target-four.proposal.diff",
    addMode: "runtime-plus-export",
    runtimeExport: "buildPhase2109QuadMutationRuntimeStatus",
    runtimeMarkerField: "phase2194Marker",
    newExport: "buildPhase2194ElevenMutationTargetFourStatus",
    newPhaseId: "Phase2194A-Controlled-Eleven-Tool-Mutation-Target-Four",
    marker: "PHASE2194_ELEVEN_TOOL_TARGET_FOUR_OK",
    referenceMarkers: ["PHASE2152_OCT_TOOL_TARGET_FOUR_OK", "PHASE2165_NONET_TOOL_TARGET_FOUR_OK", "PHASE2179_DECA_TOOL_TARGET_FOUR_OK"],
    referenceFields: ["phase2152Marker", "phase2165Marker", "phase2179Marker"],
    requiredExports: [
      "export function buildPhase2194ElevenMutationTargetFourStatus",
      "export function buildPhase2109QuadMutationRuntimeStatus",
      "export function main",
    ],
    requiredMarkers: ["PHASE2109_QUAD_TOOL_TARGET_FOUR_OK", "PHASE2165_NONET_TOOL_TARGET_FOUR_OK", "PHASE2179_DECA_TOOL_TARGET_FOUR_OK", "PHASE2194_ELEVEN_TOOL_TARGET_FOUR_OK"],
  },
  {
    idx: 5,
    phase: 2195,
    word: "five",
    path: "tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs",
    proposal: "docs/phase2195-eleven-tool-mutation-target-five.proposal.diff",
    addMode: "runtime-plus-export",
    runtimeExport: "buildPhase2120QuintMutationRuntimeStatus",
    runtimeMarkerField: "phase2195Marker",
    newExport: "buildPhase2195ElevenMutationTargetFiveStatus",
    newPhaseId: "Phase2195A-Controlled-Eleven-Tool-Mutation-Target-Five",
    marker: "PHASE2195_ELEVEN_TOOL_TARGET_FIVE_OK",
    referenceMarkers: ["PHASE2153_OCT_TOOL_TARGET_FIVE_OK", "PHASE2166_NONET_TOOL_TARGET_FIVE_OK", "PHASE2180_DECA_TOOL_TARGET_FIVE_OK"],
    referenceFields: ["phase2153Marker", "phase2166Marker", "phase2180Marker"],
    requiredExports: [
      "export function buildPhase2195ElevenMutationTargetFiveStatus",
      "export function buildPhase2120QuintMutationRuntimeStatus",
      "export function main",
    ],
    requiredMarkers: ["PHASE2120_QUINT_TOOL_TARGET_FIVE_OK", "PHASE2166_NONET_TOOL_TARGET_FIVE_OK", "PHASE2180_DECA_TOOL_TARGET_FIVE_OK", "PHASE2195_ELEVEN_TOOL_TARGET_FIVE_OK"],
  },
  {
    idx: 6,
    phase: 2196,
    word: "six",
    path: "tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs",
    proposal: "docs/phase2196-eleven-tool-mutation-target-six.proposal.diff",
    addMode: "append-export",
    newExport: "buildPhase2196ElevenMutationTargetSixStatus",
    newPhaseId: "Phase2196A-Controlled-Eleven-Tool-Mutation-Target-Six",
    marker: "PHASE2196_ELEVEN_TOOL_TARGET_SIX_OK",
    referenceMarkers: ["PHASE2142_SEPT_TOOL_TARGET_SIX_OK", "PHASE2154_OCT_TOOL_TARGET_SIX_OK", "PHASE2167_NONET_TOOL_TARGET_SIX_OK", "PHASE2181_DECA_TOOL_TARGET_SIX_OK"],
    referenceFields: ["phase2142Marker", "phase2154Marker", "phase2167Marker", "phase2181Marker"],
    requiredExports: ["export function buildPhase2196ElevenMutationTargetSixStatus", "export function main"],
    requiredMarkers: ["PHASE2142_SEPT_TOOL_TARGET_SIX_OK", "PHASE2167_NONET_TOOL_TARGET_SIX_OK", "PHASE2181_DECA_TOOL_TARGET_SIX_OK", "PHASE2196_ELEVEN_TOOL_TARGET_SIX_OK"],
  },
  {
    idx: 7,
    phase: 2197,
    word: "seven",
    path: "tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs",
    proposal: "docs/phase2197-eleven-tool-mutation-target-seven.proposal.diff",
    addMode: "append-export",
    newExport: "buildPhase2197ElevenMutationTargetSevenStatus",
    newPhaseId: "Phase2197A-Controlled-Eleven-Tool-Mutation-Target-Seven",
    marker: "PHASE2197_ELEVEN_TOOL_TARGET_SEVEN_OK",
    referenceMarkers: ["PHASE2143_SEPT_TOOL_TARGET_SEVEN_OK", "PHASE2155_OCT_TOOL_TARGET_SEVEN_OK", "PHASE2168_NONET_TOOL_TARGET_SEVEN_OK", "PHASE2182_DECA_TOOL_TARGET_SEVEN_OK"],
    referenceFields: ["phase2143Marker", "phase2155Marker", "phase2168Marker", "phase2182Marker"],
    requiredExports: ["export function buildPhase2197ElevenMutationTargetSevenStatus", "export function main"],
    requiredMarkers: ["PHASE2143_SEPT_TOOL_TARGET_SEVEN_OK", "PHASE2168_NONET_TOOL_TARGET_SEVEN_OK", "PHASE2182_DECA_TOOL_TARGET_SEVEN_OK", "PHASE2197_ELEVEN_TOOL_TARGET_SEVEN_OK"],
  },
  {
    idx: 8,
    phase: 2198,
    word: "eight",
    path: "tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs",
    proposal: "docs/phase2198-eleven-tool-mutation-target-eight.proposal.diff",
    addMode: "append-export",
    newExport: "buildPhase2198ElevenMutationTargetEightStatus",
    newPhaseId: "Phase2198A-Controlled-Eleven-Tool-Mutation-Target-Eight",
    marker: "PHASE2198_ELEVEN_TOOL_TARGET_EIGHT_OK",
    referenceMarkers: ["PHASE2143_SEPT_TOOL_TARGET_SEVEN_OK", "PHASE2156_OCT_TOOL_TARGET_EIGHT_OK", "PHASE2169_NONET_TOOL_TARGET_EIGHT_OK", "PHASE2183_DECA_TOOL_TARGET_EIGHT_OK"],
    referenceFields: ["phase2143Marker", "phase2156Marker", "phase2169Marker", "phase2183Marker"],
    requiredExports: ["export function buildPhase2198ElevenMutationTargetEightStatus", "export function main"],
    requiredMarkers: ["PHASE2156_OCT_TOOL_TARGET_EIGHT_OK", "PHASE2169_NONET_TOOL_TARGET_EIGHT_OK", "PHASE2183_DECA_TOOL_TARGET_EIGHT_OK", "PHASE2198_ELEVEN_TOOL_TARGET_EIGHT_OK"],
  },
  {
    idx: 9,
    phase: 2199,
    word: "nine",
    path: "tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs",
    proposal: "docs/phase2199-eleven-tool-mutation-target-nine.proposal.diff",
    addMode: "append-export",
    newExport: "buildPhase2199ElevenMutationTargetNineStatus",
    newPhaseId: "Phase2199A-Controlled-Eleven-Tool-Mutation-Target-Nine",
    marker: "PHASE2199_ELEVEN_TOOL_TARGET_NINE_OK",
    referenceMarkers: ["PHASE2156_OCT_TOOL_TARGET_EIGHT_OK", "PHASE2170_NONET_TOOL_TARGET_NINE_OK", "PHASE2184_DECA_TOOL_TARGET_NINE_OK"],
    referenceFields: ["phase2156Marker", "phase2170Marker", "phase2184Marker"],
    requiredExports: ["export function buildPhase2199ElevenMutationTargetNineStatus", "export function main"],
    requiredMarkers: ["PHASE2156_OCT_TOOL_TARGET_EIGHT_OK", "PHASE2170_NONET_TOOL_TARGET_NINE_OK", "PHASE2184_DECA_TOOL_TARGET_NINE_OK", "PHASE2199_ELEVEN_TOOL_TARGET_NINE_OK"],
  },
  {
    idx: 10,
    phase: 2200,
    word: "ten",
    path: "tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs",
    proposal: "docs/phase2200-eleven-tool-mutation-target-ten.proposal.diff",
    addMode: "append-export",
    newExport: "buildPhase2200ElevenMutationTargetTenStatus",
    newPhaseId: "Phase2200A-Controlled-Eleven-Tool-Mutation-Target-Ten",
    marker: "PHASE2200_ELEVEN_TOOL_TARGET_TEN_OK",
    referenceMarkers: ["PHASE2170_NONET_TOOL_TARGET_NINE_OK", "PHASE2185_DECA_TOOL_TARGET_TEN_OK"],
    referenceFields: ["phase2170Marker", "phase2185Marker"],
    requiredExports: ["export function buildPhase2200ElevenMutationTargetTenStatus", "export function main"],
    requiredMarkers: ["PHASE2170_NONET_TOOL_TARGET_NINE_OK", "PHASE2185_DECA_TOOL_TARGET_TEN_OK", "PHASE2200_ELEVEN_TOOL_TARGET_TEN_OK"],
  },
  {
    idx: 11,
    phase: 2201,
    word: "eleven",
    path: "tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs",
    proposal: "docs/phase2201-eleven-tool-mutation-target-eleven.proposal.diff",
    addMode: "append-export",
    newExport: "buildPhase2201ElevenMutationRuntimeStatus",
    newPhaseId: "Phase2201A-Controlled-Eleven-Tool-Mutation-Target-Eleven",
    marker: "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK",
    referenceMarkers: ["PHASE2170_NONET_TOOL_TARGET_NINE_OK", "PHASE2185_DECA_TOOL_TARGET_TEN_OK"],
    referenceFields: ["phase2170Marker", "phase2185Marker"],
    requiredExports: ["export function buildPhase2201ElevenMutationRuntimeStatus", "export function main"],
    requiredMarkers: ["PHASE2185_DECA_TOOL_TARGET_TEN_OK", "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK"],
  },
];

function resolve(relativePath) {
  return path.join(repoRoot, relativePath);
}

async function readText(relativePath) {
  return (await readFile(resolve(relativePath), "utf8")).replace(/^\uFEFF/, "");
}

async function writeText(relativePath, value) {
  const fullPath = resolve(relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, value, "utf8");
}

function sha256Text(text) {
  return createHash("sha256").update(text).digest("hex");
}

function titleWord(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function buildStatusFunction(target) {
  const functionName = target.newExport;
  const lines = [];
  lines.push(`export function ${functionName}() {`);
  lines.push("  return {");
  lines.push(`    phaseId: "${target.newPhaseId}",`);
  lines.push(`    marker: "${target.marker}",`);
  if (target.idx !== 1) lines.push("    importSafe: true,");
  for (const [index, marker] of target.referenceMarkers.entries()) {
    const explicitField = target.referenceFields?.[index];
    const field = explicitField || markerToField(marker);
    lines.push(`    ${field}: "${marker}",`);
  }
  if (target.idx === 11) {
    lines.push("    elevenRunnerReady: true,");
    lines.push("    elevenMutationApplied: true,");
  } else {
    lines.push("    elevenMutationApplied: true,");
  }
  lines.push("    providerCallsMade: false,");
  lines.push("    codexExecExecuted: false,");
  lines.push("    chatModified: false,");
  lines.push("    chatGatewayExecuteModified: false,");
  lines.push("  };");
  lines.push("}");
  return `${lines.join("\n")}\n`;
}

function markerToField(marker) {
  const raw = marker.replace(/^PHASE\d+_/, "").replace(/_OK$/, "").toLowerCase();
  const parts = raw.split("_");
  return `${parts[0]}${parts.slice(1).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("")}Marker`;
}

function insertBefore(source, needle, insertion) {
  if (!source.includes(needle)) throw new Error(`needle_not_found:${needle}`);
  return source.replace(needle, `${insertion}${needle}`);
}

function replaceOnce(source, search, replace) {
  if (!source.includes(search)) throw new Error(`replace_target_not_found:${search}`);
  return source.replace(search, replace);
}

function mutateTargetContent(beforeText, target) {
  const statusFn = buildStatusFunction(target);
  if (target.addMode === "phase2091-main") {
    let next = beforeText;
    if (!next.includes(`export function ${target.newExport}()`)) {
      next = insertBefore(next, "if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {", `\n${statusFn}`);
    }
    if (!next.includes("    phase2191: buildPhase2191ElevenMutationTargetOneStatus(),")) {
      next = replaceOnce(
        next,
        '    phase2176: buildPhase2176DecaMutationTargetOneStatus(),\n  }, null, 2));',
        `    phase2176: buildPhase2176DecaMutationTargetOneStatus(),\n    phase2191: buildPhase2191ElevenMutationTargetOneStatus(),\n  }, null, 2));`,
      );
    }
    return next;
  }

  if (target.addMode === "runtime-plus-export") {
    let next = beforeText;
    const anchor = `export function ${target.newExport.replace("Eleven", "Deca").replace(`Phase${target.phase}`, `Phase${target.phase - 15}`)}`;
    // We do not rely on the transform above; use explicit deca export anchor from marker.
    const explicitAnchor = {
      2192: "export function buildPhase2177DecaMutationTargetTwoStatus() {",
      2193: "export function buildPhase2178DecaMutationTargetThreeStatus() {",
      2194: "export function buildPhase2179DecaMutationTargetFourStatus() {",
      2195: "export function buildPhase2180DecaMutationTargetFiveStatus() {",
    }[target.phase];
    if (!next.includes(`export function ${target.newExport}()`)) {
      next = insertBefore(next, explicitAnchor, `\n${statusFn}`);
    }
    const runtimeMarkerLine = markerLineForPhase(target);
    if (!next.includes(`    ${target.runtimeMarkerField}: "${target.marker}",`)) {
      next = replaceOnce(
        next,
        runtimeMarkerLine.search,
        runtimeMarkerLine.replace,
      );
    }
    return next;
  }

  if (target.addMode === "append-export") {
    let next = beforeText;
    if (!next.includes(`export function ${target.newExport}()`)) {
      next = insertBefore(next, "export function main() {", `\n${statusFn}\n`);
    }
    return next;
  }

  throw new Error(`unknown_add_mode:${target.addMode}`);
}

function markerLineForPhase(target) {
  if (target.phase === 2192) {
    return {
      search: '    phase2163Marker: "PHASE2163_NONET_TOOL_TARGET_TWO_OK",\n',
      replace: '    phase2163Marker: "PHASE2163_NONET_TOOL_TARGET_TWO_OK",\n    phase2192Marker: "PHASE2192_ELEVEN_TOOL_TARGET_TWO_OK",\n',
    };
  }
  if (target.phase === 2193) {
    return {
      search: '    phase2164Marker: "PHASE2164_NONET_TOOL_TARGET_THREE_OK",\n',
      replace: '    phase2164Marker: "PHASE2164_NONET_TOOL_TARGET_THREE_OK",\n    phase2193Marker: "PHASE2193_ELEVEN_TOOL_TARGET_THREE_OK",\n',
    };
  }
  if (target.phase === 2194) {
    return {
      search: '    phase2165Marker: "PHASE2165_NONET_TOOL_TARGET_FOUR_OK",\n',
      replace: '    phase2165Marker: "PHASE2165_NONET_TOOL_TARGET_FOUR_OK",\n    phase2194Marker: "PHASE2194_ELEVEN_TOOL_TARGET_FOUR_OK",\n',
    };
  }
  if (target.phase === 2195) {
    return {
      search: '    phase2166Marker: "PHASE2166_NONET_TOOL_TARGET_FIVE_OK",\n',
      replace: '    phase2166Marker: "PHASE2166_NONET_TOOL_TARGET_FIVE_OK",\n    phase2195Marker: "PHASE2195_ELEVEN_TOOL_TARGET_FIVE_OK",\n',
    };
  }
  throw new Error(`runtime_marker_line_not_defined:${target.phase}`);
}

async function buildProposalDiff(target, beforeText, afterText) {
  const tempDir = resolve("tmp/phase2186-2201-proposals");
  await mkdir(tempDir, { recursive: true });
  const safeName = target.path.replace(/[\\/]/g, "_");
  const beforePath = path.join(tempDir, `${safeName}.before`);
  const afterPath = path.join(tempDir, `${safeName}.after`);
  await writeFile(beforePath, beforeText, "utf8");
  await writeFile(afterPath, afterText, "utf8");
  let diffText = "";
  try {
    await execFileAsync("git", ["diff", "--no-index", "--no-prefix", beforePath, afterPath], {
      cwd: repoRoot,
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (error) {
    diffText = String(error.stdout || "");
  }
  if (!diffText.trim()) throw new Error(`proposal_diff_generation_failed:${target.path}`);
  const lines = diffText.replace(/\r\n/g, "\n").split("\n");
  const normalized = lines
    .map((line) => {
      if (line.startsWith("diff --git ")) return `diff --git a/${target.path} b/${target.path}`;
      if (line.startsWith("--- ")) return `--- a/${target.path}`;
      if (line.startsWith("+++ ")) return `+++ b/${target.path}`;
      return line;
    })
    .join("\n")
    .replace(/\n+$/, "\n");
  return normalized;
}

function buildDoc() {
  return `# Phase2186A-2201A Controlled Eleven Tool Mutation

## Goal

Phase2186A-2201A extends the controlled local mutation line from ten files to eleven files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled eleven tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase2171A-2185A sealed evidence.
- Reuses \`tools/phase2101_2110/controlled-mutation-substrate.mjs\`.
- Applies exactly eleven existing source-file mutations.
- Targets only:
${targets.map((target) => `  - \`${target.path}\``).join("\n")}

## Boundaries

- default \`/chat\` unchanged.
- \`/chat-gateway/execute\` unchanged.
- provider runtime unchanged.
- codexExecExecuted=false.
- providerCallsMade=false.
- secretRead=false.
- envRead=false.
- authJsonRead=false.
- codexConfigModified=false.
- codexBaseUrlModified=false.
- deployExecuted=false.
- releaseExecuted=false.
- tagCreated=false.
- artifactUploaded=false.
- pushExecuted=false.
- commitCreated=false.
- legacyModified=false.
- projectContextCreated=false.
- workspaceCleanClaimed=false.

## Substrate Requirements

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support eleven bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The eleven mutation batch must prove:
${targets.map((target) => `- new Phase${target.phase} target ${target.word} emits \`${target.marker}\``).join("\n")}

## Commands

\`\`\`powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase2186-2201-controlled-eleven-tool-mutation
cmd /c pnpm run apply:phase2186-2201-controlled-eleven-tool-mutation
cmd /c pnpm run smoke:phase2186-2201-controlled-eleven-tool-mutation
cmd /c pnpm run verify:phase2186-2201-controlled-eleven-tool-mutation
\`\`\`

The first verifier run is expected to fail before apply because result evidence does not exist yet and the eleven target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a twelve-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default \`/chat\`.
`;
}

function buildApproval(planOperations) {
  return JSON.stringify({
    phaseId: phaseMeta.phaseId,
    planId: "phase2186-2201-controlled-eleven-tool-mutation",
    maxChangedFiles: 11,
    runNodeCheck: true,
    runLocalSmoke: true,
    approvalRecord: {
      approved: true,
      permissionMode: phaseMeta.permissionMode,
      dryRun: false,
      approvedAtLeastOnceByOwner: [
        {
          source: "user-message",
          text: "continue-next-round",
          scope: "phase2186-2201-controlled-eleven-tool-mutation",
        },
      ],
      codexExecAllowed: false,
      projectProviderAllowed: false,
      secretReadAllowed: false,
      authJsonReadAllowed: false,
      envReadAllowed: false,
      codexConfigWriteAllowed: false,
      chatModificationAllowed: false,
      chatGatewayExecuteModificationAllowed: false,
      legacyModificationAllowed: false,
      deployAllowed: false,
      releaseAllowed: false,
      pushAllowed: false,
      commitAllowed: false,
    },
    allowedFiles: [
      ...targets.map((target) => target.proposal),
      ...targets.map((target) => target.path),
      phaseMeta.resultPath,
      phaseMeta.resultMdPath,
      phaseMeta.rollbackPath,
      phaseMeta.smokePath,
    ],
    forbiddenPaths: [
      "legacy",
      "PROJECT_CONTEXT.md",
      ".env",
      ".git",
      "node_modules",
      "auth.json",
      "apps/ai-gateway-service/src/providers",
      "apps/ai-gateway-service/src/http/chat-gateway/execute",
      "/chat",
    ],
    operations: planOperations,
  }, null, 2) + "\n";
}

function buildRunnerTemplate() {
  const operationsRequiredAllowedFiles = [
    phaseMeta.resultPath,
    phaseMeta.resultMdPath,
    phaseMeta.rollbackPath,
    phaseMeta.smokePath,
    ...targets.map((target) => target.proposal),
    ...targets.map((target) => target.path),
  ];
  const smokeCommands = [
    {
      id: "phase2091",
      command: "node",
      args: ["tools/phase2091/generated-source-patch-target.mjs"],
    },
    {
      id: "phase2092",
      command: "node",
      args: ["-e", "import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))"],
    },
    {
      id: "phase2093",
      command: "node",
      args: ["-e", "import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))"],
    },
    {
      id: "phase2096",
      command: "node",
      args: ["-e", "import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))"],
    },
    {
      id: "phase2101",
      command: "node",
      args: ["-e", "import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))"],
    },
    {
      id: "phase2111",
      command: "node",
      args: ["-e", "import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2196ElevenMutationTargetSixStatus())))"],
    },
    {
      id: "phase2121",
      command: "node",
      args: ["-e", "import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2197ElevenMutationTargetSevenStatus())))"],
    },
    {
      id: "phase2132",
      command: "node",
      args: ["-e", "import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2198ElevenMutationTargetEightStatus())))"],
    },
    {
      id: "phase2144",
      command: "node",
      args: ["-e", "import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2199ElevenMutationTargetNineStatus())))"],
    },
    {
      id: "phase2157",
      command: "node",
      args: ["-e", "import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2200ElevenMutationTargetTenStatus())))"],
    },
    {
      id: "phase2171",
      command: "node",
      args: ["-e", "import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2201ElevenMutationRuntimeStatus ? m.buildPhase2201ElevenMutationRuntimeStatus() : m.buildPhase2185DecaMutationRuntimeStatus())))"],
    },
  ];

  const smokeChecks = [
    '      smokeOne.parsed?.marker === "PHASE2091_SOURCE_PATCH_OK"',
    '      smokeOne.parsed?.phase2092?.marker === "PHASE2092_EXISTING_TOOL_MUTATION_OK"',
    '      smokeOne.parsed?.phase2093?.marker === "PHASE2093_BATCH_TOOL_TARGET_ONE_OK"',
    '      smokeOne.parsed?.phase2096?.marker === "PHASE2096_TRIPLE_TOOL_TARGET_ONE_OK"',
    '      smokeOne.parsed?.phase2106?.marker === "PHASE2106_QUAD_TOOL_TARGET_ONE_OK"',
    '      smokeOne.parsed?.phase2116?.marker === "PHASE2116_QUINT_TOOL_TARGET_ONE_OK"',
    '      smokeOne.parsed?.phase2126?.marker === "PHASE2126_SEXT_TOOL_TARGET_ONE_OK"',
    '      smokeOne.parsed?.phase2137?.marker === "PHASE2137_SEPT_TOOL_TARGET_ONE_OK"',
    '      smokeOne.parsed?.phase2149?.marker === "PHASE2149_OCT_TOOL_TARGET_ONE_OK"',
    '      smokeOne.parsed?.phase2162?.marker === "PHASE2162_NONET_TOOL_TARGET_ONE_OK"',
    '      smokeOne.parsed?.phase2176?.marker === "PHASE2176_DECA_TOOL_TARGET_ONE_OK"',
    '      smokeOne.parsed?.phase2191?.marker === "PHASE2191_ELEVEN_TOOL_TARGET_ONE_OK"',
    '      smokeTwo.parsed?.marker === "PHASE2094_BATCH_TOOL_TARGET_TWO_OK"',
    '      smokeTwo.parsed?.phase2127Marker === "PHASE2127_SEXT_TOOL_TARGET_TWO_OK"',
    '      smokeTwo.parsed?.phase2138Marker === "PHASE2138_SEPT_TOOL_TARGET_TWO_OK"',
    '      smokeTwo.parsed?.phase2150Marker === "PHASE2150_OCT_TOOL_TARGET_TWO_OK"',
    '      smokeTwo.parsed?.phase2163Marker === "PHASE2163_NONET_TOOL_TARGET_TWO_OK"',
    '      smokeTwo.parsed?.phase2177Marker === "PHASE2177_DECA_TOOL_TARGET_TWO_OK"',
    '      smokeTwo.parsed?.phase2192Marker === "PHASE2192_ELEVEN_TOOL_TARGET_TWO_OK"',
    '      smokeThree.parsed?.marker === "PHASE2100_TRIPLE_TOOL_TARGET_THREE_OK"',
    '      smokeThree.parsed?.phase2128Marker === "PHASE2128_SEXT_TOOL_TARGET_THREE_OK"',
    '      smokeThree.parsed?.phase2139Marker === "PHASE2139_SEPT_TOOL_TARGET_THREE_OK"',
    '      smokeThree.parsed?.phase2151Marker === "PHASE2151_OCT_TOOL_TARGET_THREE_OK"',
    '      smokeThree.parsed?.phase2164Marker === "PHASE2164_NONET_TOOL_TARGET_THREE_OK"',
    '      smokeThree.parsed?.phase2178Marker === "PHASE2178_DECA_TOOL_TARGET_THREE_OK"',
    '      smokeThree.parsed?.phase2193Marker === "PHASE2193_ELEVEN_TOOL_TARGET_THREE_OK"',
    '      smokeFour.parsed?.marker === "PHASE2109_QUAD_TOOL_TARGET_FOUR_OK"',
    '      smokeFour.parsed?.phase2129Marker === "PHASE2129_SEXT_TOOL_TARGET_FOUR_OK"',
    '      smokeFour.parsed?.phase2140Marker === "PHASE2140_SEPT_TOOL_TARGET_FOUR_OK"',
    '      smokeFour.parsed?.phase2152Marker === "PHASE2152_OCT_TOOL_TARGET_FOUR_OK"',
    '      smokeFour.parsed?.phase2165Marker === "PHASE2165_NONET_TOOL_TARGET_FOUR_OK"',
    '      smokeFour.parsed?.phase2179Marker === "PHASE2179_DECA_TOOL_TARGET_FOUR_OK"',
    '      smokeFour.parsed?.phase2194Marker === "PHASE2194_ELEVEN_TOOL_TARGET_FOUR_OK"',
    '      smokeFive.parsed?.marker === "PHASE2120_QUINT_TOOL_TARGET_FIVE_OK"',
    '      smokeFive.parsed?.phase2130Marker === "PHASE2130_SEXT_TOOL_TARGET_FIVE_OK"',
    '      smokeFive.parsed?.phase2141Marker === "PHASE2141_SEPT_TOOL_TARGET_FIVE_OK"',
    '      smokeFive.parsed?.phase2153Marker === "PHASE2153_OCT_TOOL_TARGET_FIVE_OK"',
    '      smokeFive.parsed?.phase2166Marker === "PHASE2166_NONET_TOOL_TARGET_FIVE_OK"',
    '      smokeFive.parsed?.phase2180Marker === "PHASE2180_DECA_TOOL_TARGET_FIVE_OK"',
    '      smokeFive.parsed?.phase2195Marker === "PHASE2195_ELEVEN_TOOL_TARGET_FIVE_OK"',
    '      smokeSix.parsed?.marker === "PHASE2181_DECA_TOOL_TARGET_SIX_OK"',
    '      smokeSix.parsed?.phase2142Marker === "PHASE2142_SEPT_TOOL_TARGET_SIX_OK"',
    '      smokeSix.parsed?.phase2154Marker === "PHASE2154_OCT_TOOL_TARGET_SIX_OK"',
    '      smokeSix.parsed?.phase2167Marker === "PHASE2167_NONET_TOOL_TARGET_SIX_OK"',
    '      smokeSix.parsed?.phase2181Marker === "PHASE2181_DECA_TOOL_TARGET_SIX_OK"',
    '      smokeSix.parsed?.phase2196Marker === "PHASE2196_ELEVEN_TOOL_TARGET_SIX_OK"',
    '      smokeSeven.parsed?.marker === "PHASE2182_DECA_TOOL_TARGET_SEVEN_OK"',
    '      smokeSeven.parsed?.phase2143Marker === "PHASE2143_SEPT_TOOL_TARGET_SEVEN_OK"',
    '      smokeSeven.parsed?.phase2155Marker === "PHASE2155_OCT_TOOL_TARGET_SEVEN_OK"',
    '      smokeSeven.parsed?.phase2168Marker === "PHASE2168_NONET_TOOL_TARGET_SEVEN_OK"',
    '      smokeSeven.parsed?.phase2182Marker === "PHASE2182_DECA_TOOL_TARGET_SEVEN_OK"',
    '      smokeSeven.parsed?.phase2197Marker === "PHASE2197_ELEVEN_TOOL_TARGET_SEVEN_OK"',
    '      smokeEight.parsed?.marker === "PHASE2183_DECA_TOOL_TARGET_EIGHT_OK"',
    '      smokeEight.parsed?.phase2143Marker === "PHASE2143_SEPT_TOOL_TARGET_SEVEN_OK"',
    '      smokeEight.parsed?.phase2156Marker === "PHASE2156_OCT_TOOL_TARGET_EIGHT_OK"',
    '      smokeEight.parsed?.phase2169Marker === "PHASE2169_NONET_TOOL_TARGET_EIGHT_OK"',
    '      smokeEight.parsed?.phase2183Marker === "PHASE2183_DECA_TOOL_TARGET_EIGHT_OK"',
    '      smokeEight.parsed?.phase2198Marker === "PHASE2198_ELEVEN_TOOL_TARGET_EIGHT_OK"',
    '      smokeNine.parsed?.marker === "PHASE2184_DECA_TOOL_TARGET_NINE_OK"',
    '      smokeNine.parsed?.phase2156Marker === "PHASE2156_OCT_TOOL_TARGET_EIGHT_OK"',
    '      smokeNine.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK"',
    '      smokeNine.parsed?.phase2184Marker === "PHASE2184_DECA_TOOL_TARGET_NINE_OK"',
    '      smokeNine.parsed?.phase2199Marker === "PHASE2199_ELEVEN_TOOL_TARGET_NINE_OK"',
    '      smokeTen.parsed?.marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK"',
    '      smokeTen.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK"',
    '      smokeTen.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK"',
    '      smokeTen.parsed?.phase2200Marker === "PHASE2200_ELEVEN_TOOL_TARGET_TEN_OK"',
    '      smokeEleven.parsed?.marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK"',
    '      smokeEleven.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK"',
    '      smokeEleven.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK"',
    '      smokeEleven.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK"',
  ];

  const runner = `import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  defaultForbiddenPathFragments,
  parseSingleExistingFileMutationProposal,
  readJsonFile,
  readTextFile,
  resolveRelativePath,
  runJsonCommandSmokes,
  runNodeCheckForTargets,
  sanitizeTail,
  sha256Text,
  validateAlreadyAppliedTargetContent,
  validateControlledMutationPlan,
  writeJsonFile,
  writeTextFile,
} from "../phase2101_2110/controlled-mutation-substrate.mjs";

const phaseId = "${phaseMeta.phaseId}";
const resultPath = "${phaseMeta.resultPath}";
const resultMdPath = "${phaseMeta.resultMdPath}";
const rollbackPath = "${phaseMeta.rollbackPath}";
const smokePath = "${phaseMeta.smokePath}";

export function buildPhase2201ElevenMutationRuntimeStatus() {
  return {
    phaseId: "Phase2201A-Controlled-Eleven-Tool-Mutation-Target-Eleven",
    marker: "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK",
    importSafe: true,
    phase2170Marker: "PHASE2170_NONET_TOOL_TARGET_NINE_OK",
    phase2185Marker: "PHASE2185_DECA_TOOL_TARGET_TEN_OK",
    phase2201Marker: "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK",
    elevenRunnerReady: true,
    elevenMutationApplied: true,
    providerCallsMade: false,
    codexExecExecuted: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
  };
}

export function main() {
  const args = parseArgs(process.argv.slice(2));
  const planPath = args.plan || "${phaseMeta.approvalPath}";
  const generatedAt = new Date().toISOString();
  const plan = readJsonFile(planPath);
  const validation = validatePlan(plan);
  const base = buildBaseResult({ plan, validation, generatedAt, planPath });

  if (!validation.valid) {
    const blocked = {
      ...base,
      status: "blocked",
      blocker: validation.blocker,
      ${phaseMeta.appliedField}: false,
      changedFileCount: 0,
      nodeCheckPassed: false,
      ${phaseMeta.smokeField}: false,
      rollbackAvailable: false,
      recommendedSealed: false,
    };
    writeJsonFile(resultPath, blocked);
    writeTextFile(resultMdPath, renderMarkdown(blocked));
    printSummary(blocked);
    process.exit(1);
  }

  const operations = plan.operations;
  const originals = new Map();
  const parsedOperations = [];
  const previousRollback = readJsonFile(rollbackPath);
  const previousRollbackFiles = new Map(
    Array.isArray(previousRollback?.files)
      ? previousRollback.files.map((entry) => [entry.targetPath, entry])
      : [],
  );

  for (const operation of operations) {
    const beforeContent = readTextFile(operation.targetPath);
    const beforeSha256 = sha256Text(beforeContent);
    if (beforeSha256 !== operation.expectedBeforeSha256) {
      const alreadyApplied = validateAlreadyAppliedTargetContent({
        currentContent: beforeContent,
        currentSha256: beforeSha256,
        operation,
        extraValidators: buildExtraValidators(operation.targetPath),
      });
      if (alreadyApplied.valid) {
        const previousRollbackFile = previousRollbackFiles.get(operation.targetPath);
        originals.set(operation.targetPath, {
          targetPath: operation.targetPath,
          previousFileSha256: operation.expectedBeforeSha256,
          previousFileByteLength: previousRollbackFile?.previousFileByteLength ?? null,
          idempotentAlreadyApplied: true,
        });
        parsedOperations.push({
          operation,
          parsed: {
            ...alreadyApplied,
            beforeSha256: operation.expectedBeforeSha256,
            afterSha256: beforeSha256,
            afterContent: beforeContent,
            idempotentAlreadyApplied: true,
          },
        });
        continue;
      }
      const failed = {
        ...base,
        status: "failed",
        blocker: \`target_sha_mismatch_refuse_apply:\${operation.targetPath}:\${alreadyApplied.blocker}\`,
        ${phaseMeta.appliedField}: false,
        changedFileCount: 0,
        nodeCheckPassed: false,
        ${phaseMeta.smokeField}: false,
        rollbackAvailable: false,
        recommendedSealed: false,
      };
      writeJsonFile(resultPath, failed);
      writeTextFile(resultMdPath, renderMarkdown(failed));
      printSummary(failed);
      process.exit(1);
    }

    const proposal = readTextFile(operation.proposalPath);
    const parsed = parseSingleExistingFileMutationProposal({
      proposalText: proposal,
      beforeContent,
      targetPath: operation.targetPath,
      requiredMarkers: operation.requiredMarkers || [],
      requiredExports: operation.requiredExports || [],
      maxHunks: 4,
    });
    if (!parsed.valid) {
      const failed = {
        ...base,
        status: "failed",
        blocker: \`\${parsed.blocker}:\${operation.targetPath}\`,
        proposalValidation: parsed,
        ${phaseMeta.appliedField}: false,
        changedFileCount: 0,
        nodeCheckPassed: false,
        ${phaseMeta.smokeField}: false,
        rollbackAvailable: false,
        recommendedSealed: false,
      };
      writeJsonFile(resultPath, failed);
      writeTextFile(resultMdPath, renderMarkdown(failed));
      printSummary(failed);
      process.exit(1);
    }
    originals.set(operation.targetPath, {
      targetPath: operation.targetPath,
      previousFileSha256: beforeSha256,
      previousFileByteLength: Buffer.byteLength(beforeContent, "utf8"),
    });
    parsedOperations.push({ operation, parsed });
  }

  for (const { operation, parsed } of parsedOperations) {
    if (parsed.idempotentAlreadyApplied) continue;
    writeTextFile(operation.targetPath, parsed.afterContent);
  }

  const nodeChecks = runNodeCheckForTargets(operations.map((operation) => operation.targetPath));
  const nodeCheckPassed = nodeChecks.every((entry) => entry.result.status === 0);

  const smokeRuns = runJsonCommandSmokes(${JSON.stringify(smokeCommands, null, 2)});

  const smokeOne = smokeRuns[0];
  const smokeTwo = smokeRuns[1];
  const smokeThree = smokeRuns[2];
  const smokeFour = smokeRuns[3];
  const smokeFive = smokeRuns[4];
  const smokeSix = smokeRuns[5];
  const smokeSeven = smokeRuns[6];
  const smokeEight = smokeRuns[7];
  const smokeNine = smokeRuns[8];
  const smokeTen = smokeRuns[9];
  const smokeEleven = smokeRuns[10];

  const smokeResult = {
    phaseId,
    generatedAt: new Date().toISOString(),
    status:
      smokeOne.result.status === 0 &&
      smokeTwo.result.status === 0 &&
      smokeThree.result.status === 0 &&
      smokeFour.result.status === 0 &&
      smokeFive.result.status === 0 &&
      smokeSix.result.status === 0 &&
      smokeSeven.result.status === 0 &&
      smokeEight.result.status === 0 &&
      smokeNine.result.status === 0 &&
      smokeTen.result.status === 0 &&
      smokeEleven.result.status === 0 &&
${smokeChecks.map((line) => `${line} &&`).join("\n")}
      true
        ? "passed"
        : "failed",
    phase2191Marker: smokeOne.parsed?.phase2191?.marker || null,
    phase2192Marker: smokeTwo.parsed?.phase2192Marker || null,
    phase2193Marker: smokeThree.parsed?.phase2193Marker || null,
    phase2194Marker: smokeFour.parsed?.phase2194Marker || null,
    phase2195Marker: smokeFive.parsed?.phase2195Marker || null,
    phase2196Marker: smokeSix.parsed?.phase2196Marker || null,
    phase2197Marker: smokeSeven.parsed?.phase2197Marker || null,
    phase2198Marker: smokeEight.parsed?.phase2198Marker || null,
    phase2199Marker: smokeNine.parsed?.phase2199Marker || null,
    phase2200Marker: smokeTen.parsed?.phase2200Marker || null,
    phase2201Marker: smokeEleven.parsed?.phase2201Marker || null,
    providerCallsMade: false,
    stdout: sanitizeTail(smokeRuns.map((entry) => entry.result.stdout).join("\\n")),
    stderr: sanitizeTail(smokeRuns.map((entry) => entry.result.stderr).join("\\n")),
  };
  writeJsonFile(smokePath, smokeResult);

  const files = parsedOperations.map(({ operation, parsed }) => {
    const original = originals.get(operation.targetPath);
    return {
      targetPath: operation.targetPath,
      previousFileSha256: original.previousFileSha256,
      mutatedFileSha256: sha256Text(parsed.afterContent),
      previousFileByteLength: original.previousFileByteLength,
      mutatedFileByteLength: Buffer.byteLength(parsed.afterContent, "utf8"),
      idempotentAlreadyApplied: Boolean(original.idempotentAlreadyApplied),
    };
  });
  const rollback = {
    phaseId,
    generatedAt,
    rollbackAction: "${phaseMeta.rollbackAction}",
    rollbackExecuted: false,
    files,
    safetyBoundary: {
      restoreOnlyListedFiles: true,
      maxChangedFiles: 11,
      noCommit: true,
      noPush: true,
      noDeploy: true,
      noProviderCall: true,
      noChatChange: true,
    },
  };
  writeJsonFile(rollbackPath, rollback);

  const completed = nodeCheckPassed && smokeResult.status === "passed";
  const result = {
    ...base,
    status: completed ? "passed" : "failed",
    blocker: completed ? "none" : "eleven_mutation_node_check_or_smoke_failed",
    proposalValidations: parsedOperations.map((entry) => entry.parsed),
    changedFiles: operations.map((operation) => operation.targetPath),
    changedFileCount: operations.length,
    actualWritesPerformed: parsedOperations.filter((entry) => !entry.parsed.idempotentAlreadyApplied).length,
    idempotentReapplyAccepted: parsedOperations.every((entry) => entry.parsed.idempotentAlreadyApplied),
    ${phaseMeta.appliedField}: true,
    nodeCheckPassed,
    nodeChecks: nodeChecks.map((entry) => ({
      targetPath: entry.targetPath,
      exitCode: entry.result.status ?? 1,
      stderr: sanitizeTail(entry.result.stderr),
    })),
    ${phaseMeta.smokeField}: smokeResult.status === "passed",
    smokePath,
    rollbackAvailable: true,
    rollbackPath,
    codexExecExecuted: false,
    providerCallsMade: false,
    projectProviderCallsMade: false,
    paidProviderCallsMadeByProject: false,
    secretRead: false,
    envRead: false,
    authJsonRead: false,
    authJsonContentExposed: false,
    codexConfigModified: false,
    codexBaseUrlModified: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    pushExecuted: false,
    commitCreated: false,
    legacyModified: false,
    projectContextCreated: existsSync(resolveRelativePath("PROJECT_CONTEXT.md")),
    workspaceCleanClaimed: false,
    productionReadyClaimed: false,
    releaseReadyClaimed: false,
    recommendedSealed: completed,
    evidenceRefs: {
      result: resultPath,
      resultMarkdown: resultMdPath,
      rollback: rollbackPath,
      smoke: smokePath,
    },
  };

  writeJsonFile(resultPath, result);
  writeTextFile(resultMdPath, renderMarkdown(result));
  printSummary(result);
  if (!completed) process.exit(1);
}

function validatePlan(plan) {
  return validateControlledMutationPlan({
    plan,
    expectedPhaseId: phaseId,
    expectedPermissionMode: "${phaseMeta.permissionMode}",
    expectedOperationCount: 11,
    expectedMaxChangedFiles: 11,
    requiredAllowedFiles: ${JSON.stringify(operationsRequiredAllowedFiles, null, 4)},
    requiredForbiddenPaths: [
      "legacy",
      "PROJECT_CONTEXT.md",
      ".env",
      ".git",
      "node_modules",
      "auth.json",
    ],
    requiredTargets: ${JSON.stringify(targets.map((target) => target.path), null, 4)},
    upstreamChecks: [
      {
        id: "phase632_preflight",
        path: "apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json",
        predicate: (evidence) => evidence.preflightPassed === true && evidence.staleFalse === true,
        blocker: "phase632_preflight_not_passed",
      },
      {
        id: "phase2185_sealed",
        path: "apps/ai-gateway-service/evidence/phase2171-2185-controlled-deca-tool-mutation/result.json",
        predicate: (evidence) => evidence.recommendedSealed === true && evidence.decaMutationApplied === true,
        blocker: "phase2185_not_sealed",
      },
    ],
    forbiddenPathFragments: defaultForbiddenPathFragments,
  });
}

function buildExtraValidators(targetPath) {
  const importSafeGuard = (content) =>
    content.includes("pathToFileURL(process.argv[1]).href") ? null : "import_safe_main_guard_missing";
  const mainExportGuard = (content) => (content.includes("export function main()") ? null : "main_export_missing");

  if (targetPath === "tools/phase2092/apply-controlled-existing-tool-mutation.mjs") return [importSafeGuard, mainExportGuard];
  if (targetPath === "tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs") return [importSafeGuard, mainExportGuard];
  if (targetPath === "tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs") return [importSafeGuard, mainExportGuard];
  if (targetPath === "tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs") return [importSafeGuard, mainExportGuard];
  if (targetPath === "tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs") return [importSafeGuard, mainExportGuard];
  if (targetPath === "tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs") return [importSafeGuard, mainExportGuard];
  if (targetPath === "tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs") return [importSafeGuard, mainExportGuard];
  if (targetPath === "tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs") return [importSafeGuard, mainExportGuard];
  if (targetPath === "tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs") return [importSafeGuard, mainExportGuard];
  if (targetPath === "tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs") return [importSafeGuard, mainExportGuard];
  return [];
}

function buildBaseResult({ plan, validation, generatedAt, planPath }) {
  return {
    phaseId,
    generatedAt,
    planPath,
    planId: plan?.planId || null,
    approvalRecordRequired: true,
    allowedFilesRequired: true,
    forbiddenPathsEnforced: true,
    validation,
    phase632PreflightPassed: validation.upstreamResults.some((entry) => entry.id === "phase632_preflight" && entry.passed),
    phase2185Sealed: validation.upstreamResults.some((entry) => entry.id === "phase2185_sealed" && entry.passed),
    codexExecExecuted: false,
    providerCallsMade: false,
    projectProviderCallsMade: false,
    secretRead: false,
    envRead: false,
    authJsonRead: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    workspaceCleanClaimed: false,
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--plan") {
      args.plan = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

function renderMarkdown(result) {
  return [
    "# Phase2186A-2201A Controlled Eleven Tool Mutation Evidence",
    "",
    \`- status: \${result.status}\`,
    \`- recommendedSealed: \${Boolean(result.recommendedSealed)}\`,
    \`- blocker: \${result.blocker}\`,
    \`- elevenMutationApplied: \${Boolean(result.elevenMutationApplied)}\`,
    \`- changedFileCount: \${result.changedFileCount || 0}\`,
    \`- nodeCheckPassed: \${Boolean(result.nodeCheckPassed)}\`,
    \`- localElevenSmokePassed: \${Boolean(result.localElevenSmokePassed)}\`,
    \`- rollbackAvailable: \${Boolean(result.rollbackAvailable)}\`,
    \`- codexExecExecuted: \${Boolean(result.codexExecExecuted)}\`,
    \`- providerCallsMade: \${Boolean(result.providerCallsMade)}\`,
    \`- chatModified: \${Boolean(result.chatModified)}\`,
    \`- chatGatewayExecuteModified: \${Boolean(result.chatGatewayExecuteModified)}\`,
    \`- commitCreated: \${Boolean(result.commitCreated)}\`,
    \`- pushExecuted: \${Boolean(result.pushExecuted)}\`,
    \`- workspaceCleanClaimed: \${Boolean(result.workspaceCleanClaimed)}\`,
    "",
  ].join("\\n");
}

function printSummary(result) {
  console.log(JSON.stringify({
    status: result.status,
    blocker: result.blocker,
    elevenMutationApplied: result.elevenMutationApplied,
    changedFileCount: result.changedFileCount,
    nodeCheckPassed: result.nodeCheckPassed,
    localElevenSmokePassed: result.localElevenSmokePassed,
    providerCallsMade: result.providerCallsMade,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
`;

  return runner;
}

function buildVerifierTemplate() {
  const proposalConsts = targets
    .map((target, index) => `const proposal${titleWord(target.word)}Path = "${target.proposal}";`)
    .join("\n");
  const proposalChecks = targets
    .map((target) => `check("proposal_${target.word}_exists", existsSync(resolve(proposal${titleWord(target.word)}Path)));`)
    .join("\n");
  const resultMarkerChecks = targets
    .map((target) => `  check("smoke_phase${target.phase}_marker", smoke.phase${target.phase}Marker === "${target.marker}");`)
    .join("\n");
  const targetExportsChecks = [
    `check("target_one_export", targetOne.includes("buildPhase2191ElevenMutationTargetOneStatus") || targetOne.includes("export function buildPhase2191ElevenMutationTargetOneStatus"));`,
    `check("target_one_marker", targetOne.includes("PHASE2191_ELEVEN_TOOL_TARGET_ONE_OK"));`,
    `check("target_two_export", targetTwo.includes("buildPhase2192ElevenMutationTargetTwoStatus") || targetTwo.includes("export function buildPhase2192ElevenMutationTargetTwoStatus"));`,
    `check("target_two_marker", targetTwo.includes("PHASE2192_ELEVEN_TOOL_TARGET_TWO_OK"));`,
    `check("target_three_export", targetThree.includes("buildPhase2193ElevenMutationTargetThreeStatus") || targetThree.includes("export function buildPhase2193ElevenMutationTargetThreeStatus"));`,
    `check("target_three_marker", targetThree.includes("PHASE2193_ELEVEN_TOOL_TARGET_THREE_OK"));`,
    `check("target_four_export", targetFour.includes("buildPhase2194ElevenMutationTargetFourStatus") || targetFour.includes("export function buildPhase2194ElevenMutationTargetFourStatus"));`,
    `check("target_four_marker", targetFour.includes("PHASE2194_ELEVEN_TOOL_TARGET_FOUR_OK"));`,
    `check("target_five_export", targetFive.includes("buildPhase2195ElevenMutationTargetFiveStatus") || targetFive.includes("export function buildPhase2195ElevenMutationTargetFiveStatus"));`,
    `check("target_five_marker", targetFive.includes("PHASE2195_ELEVEN_TOOL_TARGET_FIVE_OK"));`,
    `check("target_six_export", targetSix.includes("buildPhase2196ElevenMutationTargetSixStatus") || targetSix.includes("export function buildPhase2196ElevenMutationTargetSixStatus"));`,
    `check("target_six_marker", targetSix.includes("PHASE2196_ELEVEN_TOOL_TARGET_SIX_OK"));`,
    `check("target_seven_export", targetSeven.includes("buildPhase2197ElevenMutationTargetSevenStatus") || targetSeven.includes("export function buildPhase2197ElevenMutationTargetSevenStatus"));`,
    `check("target_seven_marker", targetSeven.includes("PHASE2197_ELEVEN_TOOL_TARGET_SEVEN_OK"));`,
    `check("target_eight_export", targetEight.includes("buildPhase2198ElevenMutationTargetEightStatus") || targetEight.includes("export function buildPhase2198ElevenMutationTargetEightStatus"));`,
    `check("target_eight_marker", targetEight.includes("PHASE2198_ELEVEN_TOOL_TARGET_EIGHT_OK"));`,
    `check("target_nine_export", targetNine.includes("buildPhase2199ElevenMutationTargetNineStatus") || targetNine.includes("export function buildPhase2199ElevenMutationTargetNineStatus"));`,
    `check("target_nine_marker", targetNine.includes("PHASE2199_ELEVEN_TOOL_TARGET_NINE_OK"));`,
    `check("target_ten_export", targetTen.includes("buildPhase2200ElevenMutationTargetTenStatus") || targetTen.includes("export function buildPhase2200ElevenMutationTargetTenStatus"));`,
    `check("target_ten_marker", targetTen.includes("PHASE2200_ELEVEN_TOOL_TARGET_TEN_OK"));`,
    `check("target_eleven_export", targetEleven.includes("buildPhase2201ElevenMutationRuntimeStatus") || targetEleven.includes("export function buildPhase2201ElevenMutationRuntimeStatus"));`,
    `check("target_eleven_marker", targetEleven.includes("PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK"));`,
  ].join("\n");

  const verifier = `import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "${phaseMeta.phaseId}";
const runnerPath = "${phaseMeta.runnerPath}";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "${phaseMeta.docPath}";
const approvalPath = "${phaseMeta.approvalPath}";
${proposalConsts}
const targetOnePath = "tools/phase2091/generated-source-patch-target.mjs";
const targetTwoPath = "tools/phase2092/apply-controlled-existing-tool-mutation.mjs";
const targetThreePath = "tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs";
const targetFourPath = "tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs";
const targetFivePath = "tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs";
const targetSixPath = "tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs";
const targetSevenPath = "tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs";
const targetEightPath = "tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs";
const targetNinePath = "tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs";
const targetTenPath = "tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs";
const targetElevenPath = "tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs";
const evidenceDir = "${phaseMeta.resultDir}";
const resultPath = "${phaseMeta.resultPath}";
const resultMdPath = "${phaseMeta.resultMdPath}";
const rollbackPath = "${phaseMeta.rollbackPath}";
const smokePath = "${phaseMeta.smokePath}";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
const phase2185 = readJson("apps/ai-gateway-service/evidence/phase2171-2185-controlled-deca-tool-mutation/result.json") || {};
const result = readJson(resultPath);
const rollback = readJson(rollbackPath);
const smoke = readJson(smokePath);
const targetOne = existsSync(resolve(targetOnePath)) ? readText(targetOnePath) : "";
const targetTwo = existsSync(resolve(targetTwoPath)) ? readText(targetTwoPath) : "";
const targetThree = existsSync(resolve(targetThreePath)) ? readText(targetThreePath) : "";
const targetFour = existsSync(resolve(targetFourPath)) ? readText(targetFourPath) : "";
const targetFive = existsSync(resolve(targetFivePath)) ? readText(targetFivePath) : "";
const targetSix = existsSync(resolve(targetSixPath)) ? readText(targetSixPath) : "";
const targetSeven = existsSync(resolve(targetSevenPath)) ? readText(targetSevenPath) : "";
const targetEight = existsSync(resolve(targetEightPath)) ? readText(targetEightPath) : "";
const targetNine = existsSync(resolve(targetNinePath)) ? readText(targetNinePath) : "";
const targetTen = existsSync(resolve(targetTenPath)) ? readText(targetTenPath) : "";
const targetEleven = existsSync(resolve(targetElevenPath)) ? readText(targetElevenPath) : "";
const docs = existsSync(resolve(docsPath)) ? readText(docsPath) : "";
const substrate = existsSync(resolve(substratePath)) ? readText(substratePath) : "";

check("runner_exists", existsSync(resolve(runnerPath)));
check("substrate_exists", existsSync(resolve(substratePath)));
check("docs_exists", existsSync(resolve(docsPath)));
check("approval_exists", existsSync(resolve(approvalPath)));
${proposalChecks}
check("package_apply_script_registered", packageJson.scripts?.["${phaseMeta.applyScript}"] === "node ${phaseMeta.runnerPath} --plan ${phaseMeta.approvalPath}");
check(
  "package_smoke_script_registered",
  packageJson.scripts?.["${phaseMeta.smokeScript}"] ===
    "node tools/phase2091/generated-source-patch-target.mjs && node -e \\"import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))\\" && node -e \\"import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))\\" && node -e \\"import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))\\" && node -e \\"import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))\\" && node -e \\"import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2181DecaMutationTargetSixStatus())))\\" && node -e \\"import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2182DecaMutationTargetSevenStatus())))\\" && node -e \\"import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2183DecaMutationTargetEightStatus())))\\" && node -e \\"import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2184DecaMutationTargetNineStatus())))\\" && node -e \\"import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2185DecaMutationRuntimeStatus())))\\" && node -e \\"import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2201ElevenMutationRuntimeStatus ? m.buildPhase2201ElevenMutationRuntimeStatus() : m.buildPhase2185DecaMutationRuntimeStatus())))\\"",
);
check("package_verify_script_registered", packageJson.scripts?.["${phaseMeta.verifyScript}"] === "node ${phaseMeta.verifierPath}");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase2185_sealed", phase2185.recommendedSealed === true && phase2185.decaMutationApplied === true);
check("result_exists", result !== null, "run ${phaseMeta.applyScript} first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("eleven_mutation_applied", result.elevenMutationApplied === true);
  check("changed_file_count_eleven", result.changedFileCount === 11);
  check("changed_files_expected", Array.isArray(result.changedFiles)
    && result.changedFiles.includes(targetOnePath)
    && result.changedFiles.includes(targetTwoPath)
    && result.changedFiles.includes(targetThreePath)
    && result.changedFiles.includes(targetFourPath)
    && result.changedFiles.includes(targetFivePath)
    && result.changedFiles.includes(targetSixPath)
    && result.changedFiles.includes(targetSevenPath)
    && result.changedFiles.includes(targetEightPath)
    && result.changedFiles.includes(targetNinePath)
    && result.changedFiles.includes(targetTenPath)
    && result.changedFiles.includes(targetElevenPath)
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localElevenSmokePassed === true);
  check("rollback_available", result.rollbackAvailable === true && result.rollbackPath === rollbackPath);
  check("codex_exec_false", result.codexExecExecuted === false);
  check("provider_false", result.providerCallsMade === false && result.projectProviderCallsMade === false);
  check("secret_false", result.secretRead === false && result.envRead === false && result.authJsonRead === false);
  check("chat_false", result.chatModified === false && result.chatGatewayExecuteModified === false);
  check("deploy_release_false", result.deployExecuted === false && result.releaseExecuted === false);
  check("push_commit_false", result.pushExecuted === false && result.commitCreated === false);
  check("workspace_clean_not_claimed", result.workspaceCleanClaimed === false);
}

if (rollback) {
  check("rollback_phase_matches", rollback.phaseId === phaseId);
  check("rollback_restore_eleven", rollback.rollbackAction === "${phaseMeta.rollbackAction}");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_eleven_entries", Array.isArray(rollback.files) && rollback.files.length === 11);
}

if (smoke) {
${resultMarkerChecks}
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

${targetExportsChecks}
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_eleven", docs.includes("controlled eleven tool mutation"));
check("docs_mentions_smoke_helper", docs.includes("JSON smoke helper"));
check("docs_mentions_no_provider", docs.includes("providerCallsMade=false"));
check("docs_mentions_no_chat", docs.includes("default \`/chat\` unchanged") && docs.includes("\`/chat-gateway/execute\` unchanged"));

const failed = checks.filter((entry) => !entry.pass);
const completed = failed.length === 0;
const verifierResult = {
  phaseId,
  completed,
  status: completed ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  phase632PreflightPassed: phase632.preflightPassed === true,
  phase2185Sealed: phase2185.recommendedSealed === true,
  elevenMutationReady: completed,
  changedFiles: [
    targetOnePath,
    targetTwoPath,
    targetThreePath,
    targetFourPath,
    targetFivePath,
    targetSixPath,
    targetSevenPath,
    targetEightPath,
    targetNinePath,
    targetTenPath,
    targetElevenPath,
  ],
  changedFileCount: result?.changedFileCount ?? 11,
  elevenMutationApplied: result?.elevenMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localElevenSmokePassed: result?.localElevenSmokePassed === true,
  rollbackAvailable: rollback !== null,
  codexExecExecuted: false,
  providerCallsMade: false,
  secretRead: false,
  envRead: false,
  authJsonRead: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  legacyModified: false,
  projectContextCreated: false,
  workspaceCleanClaimed: false,
  productionReadyClaimed: false,
  releaseReadyClaimed: false,
  blocker: completed ? "none" : failed.map((entry) => entry.id).join(", "),
  recommendedSealed: completed,
  evidenceRefs: { result: resultPath, rollback: rollbackPath, smoke: smokePath },
  checks,
};

writeJson(resultPath, result ? { ...result, verifier: verifierResult } : verifierResult);
writeText(resultMdPath, renderMarkdown(verifierResult));
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, elevenMutationApplied: verifierResult.elevenMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localElevenSmokePassed: verifierResult.localElevenSmokePassed }, null, 2));
if (!verifierResult.recommendedSealed) process.exit(1);

function resolve(relativePath) {
  return path.join(repoRoot, relativePath);
}

function readText(relativePath) {
  return readFileSync(resolve(relativePath), "utf8").replace(/^\\uFEFF/, "");
}

function readJson(relativePath) {
  const filePath = resolve(relativePath);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\\uFEFF/, ""));
}

function writeJson(relativePath, value) {
  const filePath = resolve(relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, \`\${JSON.stringify(value, null, 2)}\\n\`, "utf8");
}

function writeText(relativePath, value) {
  const filePath = resolve(relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, "utf8");
}

function renderMarkdown(result) {
  return [
    "# Phase2186A-2201A Controlled Eleven Tool Mutation Evidence",
    "",
    \`- status: \${result.status}\`,
    \`- recommendedSealed: \${Boolean(result.recommendedSealed)}\`,
    \`- blocker: \${result.blocker}\`,
    \`- elevenMutationApplied: \${Boolean(result.elevenMutationApplied)}\`,
    \`- changedFileCount: \${result.changedFileCount || 0}\`,
    \`- nodeCheckPassed: \${Boolean(result.nodeCheckPassed)}\`,
    \`- localElevenSmokePassed: \${Boolean(result.localElevenSmokePassed)}\`,
    \`- rollbackAvailable: \${Boolean(result.rollbackAvailable)}\`,
    \`- codexExecExecuted: \${Boolean(result.codexExecExecuted)}\`,
    \`- providerCallsMade: \${Boolean(result.providerCallsMade)}\`,
    \`- chatModified: \${Boolean(result.chatModified)}\`,
    \`- chatGatewayExecuteModified: \${Boolean(result.chatGatewayExecuteModified)}\`,
    \`- commitCreated: \${Boolean(result.commitCreated)}\`,
    \`- pushExecuted: \${Boolean(result.pushExecuted)}\`,
    \`- workspaceCleanClaimed: \${Boolean(result.workspaceCleanClaimed)}\`,
    "",
  ].join("\\n");
}
`;

  return verifier;
}

async function main() {
  const planOperations = [];
  const beforeAfterPairs = [];

  for (const target of targets) {
    const beforeText = await readText(target.path);
    const afterText = mutateTargetContent(beforeText, target);
    const proposalText = await buildProposalDiff(target, beforeText, afterText);
    await writeText(target.proposal, proposalText);
    planOperations.push({
      action: "apply-single-existing-tool-source-mutation",
      proposalPath: target.proposal,
      targetPath: target.path,
      expectedBeforeSha256: sha256Text(beforeText),
      allowCreate: false,
      allowDelete: false,
      requiredExports: target.requiredExports,
      requiredMarkers: target.requiredMarkers,
    });
    beforeAfterPairs.push({ target, beforeText, afterText });
  }

  await writeText(phaseMeta.docPath, buildDoc());
  await writeText(phaseMeta.approvalPath, buildApproval(planOperations));
  await writeText(phaseMeta.runnerPath, buildRunnerTemplate());
  await writeText(phaseMeta.verifierPath, buildVerifierTemplate());

  console.log(JSON.stringify({
    status: "pass",
    generatedFiles: [
      phaseMeta.docPath,
      phaseMeta.approvalPath,
      phaseMeta.runnerPath,
      phaseMeta.verifierPath,
      ...targets.map((target) => target.proposal),
    ],
    operationCount: planOperations.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
