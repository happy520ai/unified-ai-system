import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = process.cwd();

const phaseMeta = {
  "phaseId": "Phase2237A-2255A-Controlled-Fourteen-Tool-Mutation",
  "docPath": "docs/phase2237-2255-controlled-fourteen-tool-mutation.md",
  "approvalPath": "docs/phase2237-2255-controlled-fourteen-tool-mutation-approval.example.json",
  "runnerPath": "tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs",
  "verifierPath": "tools/phase2237_2255/validate-controlled-fourteen-tool-mutation.mjs",
  "resultDir": "apps/ai-gateway-service/evidence/phase2237-2255-controlled-fourteen-tool-mutation",
  "resultPath": "apps/ai-gateway-service/evidence/phase2237-2255-controlled-fourteen-tool-mutation/result.json",
  "resultMdPath": "apps/ai-gateway-service/evidence/phase2237-2255-controlled-fourteen-tool-mutation/result.md",
  "rollbackPath": "apps/ai-gateway-service/evidence/phase2237-2255-controlled-fourteen-tool-mutation/rollback.json",
  "smokePath": "apps/ai-gateway-service/evidence/phase2237-2255-controlled-fourteen-tool-mutation/fourteen-smoke.json",
  "permissionMode": "controlled-fourteen-tool-source-mutation",
  "label": "fourteen",
  "runnerReadyField": "fourteenRunnerReady",
  "appliedField": "fourteenMutationApplied",
  "smokeField": "localFourteenSmokePassed",
  "rollbackAction": "restore-previous-content-fourteen",
  "verifyScript": "verify:phase2237-2255-controlled-fourteen-tool-mutation",
  "applyScript": "apply:phase2237-2255-controlled-fourteen-tool-mutation",
  "smokeScript": "smoke:phase2237-2255-controlled-fourteen-tool-mutation"
};

const targets = [
  {
    "idx": 1,
    "phase": 2242,
    "word": "one",
    "targetName": "target-one",
    "path": "tools/phase2091/generated-source-patch-target.mjs",
    "proposal": "docs/phase2242-fourteen-tool-mutation-target-one.proposal.diff",
    "addMode": "phase2091-main",
    "newExport": "buildPhase2242FourteenMutationTargetOneStatus",
    "newPhaseId": "Phase2242A-Controlled-Fourteen-Tool-Mutation-Target-One",
    "marker": "PHASE2242_FOURTEEN_TOOL_TARGET_ONE_OK",
    "referenceMarkers": [
      "PHASE2149_OCT_TOOL_TARGET_ONE_OK",
      "PHASE2162_NONET_TOOL_TARGET_ONE_OK",
      "PHASE2176_DECA_TOOL_TARGET_ONE_OK",
      "PHASE2191_ELEVEN_TOOL_TARGET_ONE_OK",
      "PHASE2207_TWELVE_TOOL_TARGET_ONE_OK",
      "PHASE2224_THIRTEEN_TOOL_TARGET_ONE_OK"
    ],
    "referenceFields": [
      "phase2149Marker",
      "phase2162Marker",
      "phase2176Marker",
      "phase2191Marker",
      "phase2207Marker",
      "phase2224Marker"
    ],
    "requiredExports": [
      "export function buildPhase2242FourteenMutationTargetOneStatus"
    ],
    "requiredMarkers": [
      "PHASE2091_SOURCE_PATCH_OK",
      "PHASE2162_NONET_TOOL_TARGET_ONE_OK",
      "PHASE2176_DECA_TOOL_TARGET_ONE_OK",
      "PHASE2191_ELEVEN_TOOL_TARGET_ONE_OK",
      "PHASE2207_TWELVE_TOOL_TARGET_ONE_OK",
      "PHASE2224_THIRTEEN_TOOL_TARGET_ONE_OK",
      "PHASE2242_FOURTEEN_TOOL_TARGET_ONE_OK"
    ],
    "mainProperty": "phase2242",
    "runtimeBaseProperty": "phase2224",
    "runtimeBaseExport": "buildPhase2224ThirteenMutationTargetOneStatus"
  },
  {
    "idx": 2,
    "phase": 2243,
    "word": "two",
    "targetName": "target-two",
    "path": "tools/phase2092/apply-controlled-existing-tool-mutation.mjs",
    "proposal": "docs/phase2243-fourteen-tool-mutation-target-two.proposal.diff",
    "addMode": "runtime-plus-export",
    "runtimeExport": "buildPhase2094BatchMutationRuntimeStatus",
    "runtimeMarkerField": "phase2243Marker",
    "runtimeInsertAfterField": "phase2225Marker",
    "runtimeInsertAfterMarker": "PHASE2225_THIRTEEN_TOOL_TARGET_TWO_OK",
    "newExport": "buildPhase2243FourteenMutationTargetTwoStatus",
    "newPhaseId": "Phase2243A-Controlled-Fourteen-Tool-Mutation-Target-Two",
    "marker": "PHASE2243_FOURTEEN_TOOL_TARGET_TWO_OK",
    "referenceMarkers": [
      "PHASE2150_OCT_TOOL_TARGET_TWO_OK",
      "PHASE2163_NONET_TOOL_TARGET_TWO_OK",
      "PHASE2177_DECA_TOOL_TARGET_TWO_OK",
      "PHASE2192_ELEVEN_TOOL_TARGET_TWO_OK",
      "PHASE2208_TWELVE_TOOL_TARGET_TWO_OK",
      "PHASE2225_THIRTEEN_TOOL_TARGET_TWO_OK"
    ],
    "referenceFields": [
      "phase2150Marker",
      "phase2163Marker",
      "phase2177Marker",
      "phase2192Marker",
      "phase2208Marker",
      "phase2225Marker"
    ],
    "requiredExports": [
      "export function buildPhase2243FourteenMutationTargetTwoStatus",
      "export function buildPhase2094BatchMutationRuntimeStatus",
      "export function main"
    ],
    "requiredMarkers": [
      "PHASE2094_BATCH_TOOL_TARGET_TWO_OK",
      "PHASE2163_NONET_TOOL_TARGET_TWO_OK",
      "PHASE2177_DECA_TOOL_TARGET_TWO_OK",
      "PHASE2192_ELEVEN_TOOL_TARGET_TWO_OK",
      "PHASE2208_TWELVE_TOOL_TARGET_TWO_OK",
      "PHASE2225_THIRTEEN_TOOL_TARGET_TWO_OK",
      "PHASE2243_FOURTEEN_TOOL_TARGET_TWO_OK"
    ]
  },
  {
    "idx": 3,
    "phase": 2244,
    "word": "three",
    "targetName": "target-three",
    "path": "tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs",
    "proposal": "docs/phase2244-fourteen-tool-mutation-target-three.proposal.diff",
    "addMode": "runtime-plus-export",
    "runtimeExport": "buildPhase2100TripleMutationRuntimeStatus",
    "runtimeMarkerField": "phase2244Marker",
    "runtimeInsertAfterField": "phase2226Marker",
    "runtimeInsertAfterMarker": "PHASE2226_THIRTEEN_TOOL_TARGET_THREE_OK",
    "newExport": "buildPhase2244FourteenMutationTargetThreeStatus",
    "newPhaseId": "Phase2244A-Controlled-Fourteen-Tool-Mutation-Target-Three",
    "marker": "PHASE2244_FOURTEEN_TOOL_TARGET_THREE_OK",
    "referenceMarkers": [
      "PHASE2151_OCT_TOOL_TARGET_THREE_OK",
      "PHASE2164_NONET_TOOL_TARGET_THREE_OK",
      "PHASE2178_DECA_TOOL_TARGET_THREE_OK",
      "PHASE2193_ELEVEN_TOOL_TARGET_THREE_OK",
      "PHASE2209_TWELVE_TOOL_TARGET_THREE_OK",
      "PHASE2226_THIRTEEN_TOOL_TARGET_THREE_OK"
    ],
    "referenceFields": [
      "phase2151Marker",
      "phase2164Marker",
      "phase2178Marker",
      "phase2193Marker",
      "phase2209Marker",
      "phase2226Marker"
    ],
    "requiredExports": [
      "export function buildPhase2244FourteenMutationTargetThreeStatus",
      "export function buildPhase2100TripleMutationRuntimeStatus",
      "export function main"
    ],
    "requiredMarkers": [
      "PHASE2100_TRIPLE_TOOL_TARGET_THREE_OK",
      "PHASE2164_NONET_TOOL_TARGET_THREE_OK",
      "PHASE2178_DECA_TOOL_TARGET_THREE_OK",
      "PHASE2193_ELEVEN_TOOL_TARGET_THREE_OK",
      "PHASE2209_TWELVE_TOOL_TARGET_THREE_OK",
      "PHASE2226_THIRTEEN_TOOL_TARGET_THREE_OK",
      "PHASE2244_FOURTEEN_TOOL_TARGET_THREE_OK"
    ]
  },
  {
    "idx": 4,
    "phase": 2245,
    "word": "four",
    "targetName": "target-four",
    "path": "tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs",
    "proposal": "docs/phase2245-fourteen-tool-mutation-target-four.proposal.diff",
    "addMode": "runtime-plus-export",
    "runtimeExport": "buildPhase2109QuadMutationRuntimeStatus",
    "runtimeMarkerField": "phase2245Marker",
    "runtimeInsertAfterField": "phase2227Marker",
    "runtimeInsertAfterMarker": "PHASE2227_THIRTEEN_TOOL_TARGET_FOUR_OK",
    "newExport": "buildPhase2245FourteenMutationTargetFourStatus",
    "newPhaseId": "Phase2245A-Controlled-Fourteen-Tool-Mutation-Target-Four",
    "marker": "PHASE2245_FOURTEEN_TOOL_TARGET_FOUR_OK",
    "referenceMarkers": [
      "PHASE2152_OCT_TOOL_TARGET_FOUR_OK",
      "PHASE2165_NONET_TOOL_TARGET_FOUR_OK",
      "PHASE2179_DECA_TOOL_TARGET_FOUR_OK",
      "PHASE2194_ELEVEN_TOOL_TARGET_FOUR_OK",
      "PHASE2210_TWELVE_TOOL_TARGET_FOUR_OK",
      "PHASE2227_THIRTEEN_TOOL_TARGET_FOUR_OK"
    ],
    "referenceFields": [
      "phase2152Marker",
      "phase2165Marker",
      "phase2179Marker",
      "phase2194Marker",
      "phase2210Marker",
      "phase2227Marker"
    ],
    "requiredExports": [
      "export function buildPhase2245FourteenMutationTargetFourStatus",
      "export function buildPhase2109QuadMutationRuntimeStatus",
      "export function main"
    ],
    "requiredMarkers": [
      "PHASE2109_QUAD_TOOL_TARGET_FOUR_OK",
      "PHASE2165_NONET_TOOL_TARGET_FOUR_OK",
      "PHASE2179_DECA_TOOL_TARGET_FOUR_OK",
      "PHASE2194_ELEVEN_TOOL_TARGET_FOUR_OK",
      "PHASE2210_TWELVE_TOOL_TARGET_FOUR_OK",
      "PHASE2227_THIRTEEN_TOOL_TARGET_FOUR_OK",
      "PHASE2245_FOURTEEN_TOOL_TARGET_FOUR_OK"
    ]
  },
  {
    "idx": 5,
    "phase": 2246,
    "word": "five",
    "targetName": "target-five",
    "path": "tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs",
    "proposal": "docs/phase2246-fourteen-tool-mutation-target-five.proposal.diff",
    "addMode": "runtime-plus-export",
    "runtimeExport": "buildPhase2120QuintMutationRuntimeStatus",
    "runtimeMarkerField": "phase2246Marker",
    "runtimeInsertAfterField": "phase2228Marker",
    "runtimeInsertAfterMarker": "PHASE2228_THIRTEEN_TOOL_TARGET_FIVE_OK",
    "newExport": "buildPhase2246FourteenMutationTargetFiveStatus",
    "newPhaseId": "Phase2246A-Controlled-Fourteen-Tool-Mutation-Target-Five",
    "marker": "PHASE2246_FOURTEEN_TOOL_TARGET_FIVE_OK",
    "referenceMarkers": [
      "PHASE2153_OCT_TOOL_TARGET_FIVE_OK",
      "PHASE2166_NONET_TOOL_TARGET_FIVE_OK",
      "PHASE2180_DECA_TOOL_TARGET_FIVE_OK",
      "PHASE2195_ELEVEN_TOOL_TARGET_FIVE_OK",
      "PHASE2211_TWELVE_TOOL_TARGET_FIVE_OK",
      "PHASE2228_THIRTEEN_TOOL_TARGET_FIVE_OK"
    ],
    "referenceFields": [
      "phase2153Marker",
      "phase2166Marker",
      "phase2180Marker",
      "phase2195Marker",
      "phase2211Marker",
      "phase2228Marker"
    ],
    "requiredExports": [
      "export function buildPhase2246FourteenMutationTargetFiveStatus",
      "export function buildPhase2120QuintMutationRuntimeStatus",
      "export function main"
    ],
    "requiredMarkers": [
      "PHASE2120_QUINT_TOOL_TARGET_FIVE_OK",
      "PHASE2166_NONET_TOOL_TARGET_FIVE_OK",
      "PHASE2180_DECA_TOOL_TARGET_FIVE_OK",
      "PHASE2195_ELEVEN_TOOL_TARGET_FIVE_OK",
      "PHASE2211_TWELVE_TOOL_TARGET_FIVE_OK",
      "PHASE2228_THIRTEEN_TOOL_TARGET_FIVE_OK",
      "PHASE2246_FOURTEEN_TOOL_TARGET_FIVE_OK"
    ]
  },
  {
    "idx": 6,
    "phase": 2247,
    "word": "six",
    "targetName": "target-six",
    "path": "tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs",
    "proposal": "docs/phase2247-fourteen-tool-mutation-target-six.proposal.diff",
    "addMode": "append-export",
    "newExport": "buildPhase2247FourteenMutationTargetSixStatus",
    "newPhaseId": "Phase2247A-Controlled-Fourteen-Tool-Mutation-Target-Six",
    "marker": "PHASE2247_FOURTEEN_TOOL_TARGET_SIX_OK",
    "referenceMarkers": [
      "PHASE2142_SEPT_TOOL_TARGET_SIX_OK",
      "PHASE2154_OCT_TOOL_TARGET_SIX_OK",
      "PHASE2167_NONET_TOOL_TARGET_SIX_OK",
      "PHASE2181_DECA_TOOL_TARGET_SIX_OK",
      "PHASE2196_ELEVEN_TOOL_TARGET_SIX_OK",
      "PHASE2212_TWELVE_TOOL_TARGET_SIX_OK",
      "PHASE2229_THIRTEEN_TOOL_TARGET_SIX_OK"
    ],
    "referenceFields": [
      "phase2142Marker",
      "phase2154Marker",
      "phase2167Marker",
      "phase2181Marker",
      "phase2196Marker",
      "phase2212Marker",
      "phase2229Marker"
    ],
    "requiredExports": [
      "export function buildPhase2247FourteenMutationTargetSixStatus",
      "export function main"
    ],
    "requiredMarkers": [
      "PHASE2142_SEPT_TOOL_TARGET_SIX_OK",
      "PHASE2167_NONET_TOOL_TARGET_SIX_OK",
      "PHASE2181_DECA_TOOL_TARGET_SIX_OK",
      "PHASE2196_ELEVEN_TOOL_TARGET_SIX_OK",
      "PHASE2212_TWELVE_TOOL_TARGET_SIX_OK",
      "PHASE2229_THIRTEEN_TOOL_TARGET_SIX_OK",
      "PHASE2247_FOURTEEN_TOOL_TARGET_SIX_OK"
    ]
  },
  {
    "idx": 7,
    "phase": 2248,
    "word": "seven",
    "targetName": "target-seven",
    "path": "tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs",
    "proposal": "docs/phase2248-fourteen-tool-mutation-target-seven.proposal.diff",
    "addMode": "append-export",
    "newExport": "buildPhase2248FourteenMutationTargetSevenStatus",
    "newPhaseId": "Phase2248A-Controlled-Fourteen-Tool-Mutation-Target-Seven",
    "marker": "PHASE2248_FOURTEEN_TOOL_TARGET_SEVEN_OK",
    "referenceMarkers": [
      "PHASE2143_SEPT_TOOL_TARGET_SEVEN_OK",
      "PHASE2155_OCT_TOOL_TARGET_SEVEN_OK",
      "PHASE2168_NONET_TOOL_TARGET_SEVEN_OK",
      "PHASE2182_DECA_TOOL_TARGET_SEVEN_OK",
      "PHASE2197_ELEVEN_TOOL_TARGET_SEVEN_OK",
      "PHASE2213_TWELVE_TOOL_TARGET_SEVEN_OK",
      "PHASE2230_THIRTEEN_TOOL_TARGET_SEVEN_OK"
    ],
    "referenceFields": [
      "phase2143Marker",
      "phase2155Marker",
      "phase2168Marker",
      "phase2182Marker",
      "phase2197Marker",
      "phase2213Marker",
      "phase2230Marker"
    ],
    "requiredExports": [
      "export function buildPhase2248FourteenMutationTargetSevenStatus",
      "export function main"
    ],
    "requiredMarkers": [
      "PHASE2143_SEPT_TOOL_TARGET_SEVEN_OK",
      "PHASE2168_NONET_TOOL_TARGET_SEVEN_OK",
      "PHASE2182_DECA_TOOL_TARGET_SEVEN_OK",
      "PHASE2197_ELEVEN_TOOL_TARGET_SEVEN_OK",
      "PHASE2213_TWELVE_TOOL_TARGET_SEVEN_OK",
      "PHASE2230_THIRTEEN_TOOL_TARGET_SEVEN_OK",
      "PHASE2248_FOURTEEN_TOOL_TARGET_SEVEN_OK"
    ]
  },
  {
    "idx": 8,
    "phase": 2249,
    "word": "eight",
    "targetName": "target-eight",
    "path": "tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs",
    "proposal": "docs/phase2249-fourteen-tool-mutation-target-eight.proposal.diff",
    "addMode": "append-export",
    "newExport": "buildPhase2249FourteenMutationTargetEightStatus",
    "newPhaseId": "Phase2249A-Controlled-Fourteen-Tool-Mutation-Target-Eight",
    "marker": "PHASE2249_FOURTEEN_TOOL_TARGET_EIGHT_OK",
    "referenceMarkers": [
      "PHASE2143_SEPT_TOOL_TARGET_SEVEN_OK",
      "PHASE2156_OCT_TOOL_TARGET_EIGHT_OK",
      "PHASE2169_NONET_TOOL_TARGET_EIGHT_OK",
      "PHASE2183_DECA_TOOL_TARGET_EIGHT_OK",
      "PHASE2198_ELEVEN_TOOL_TARGET_EIGHT_OK",
      "PHASE2214_TWELVE_TOOL_TARGET_EIGHT_OK",
      "PHASE2231_THIRTEEN_TOOL_TARGET_EIGHT_OK"
    ],
    "referenceFields": [
      "phase2143Marker",
      "phase2156Marker",
      "phase2169Marker",
      "phase2183Marker",
      "phase2198Marker",
      "phase2214Marker",
      "phase2231Marker"
    ],
    "requiredExports": [
      "export function buildPhase2249FourteenMutationTargetEightStatus",
      "export function main"
    ],
    "requiredMarkers": [
      "PHASE2156_OCT_TOOL_TARGET_EIGHT_OK",
      "PHASE2169_NONET_TOOL_TARGET_EIGHT_OK",
      "PHASE2183_DECA_TOOL_TARGET_EIGHT_OK",
      "PHASE2198_ELEVEN_TOOL_TARGET_EIGHT_OK",
      "PHASE2214_TWELVE_TOOL_TARGET_EIGHT_OK",
      "PHASE2231_THIRTEEN_TOOL_TARGET_EIGHT_OK",
      "PHASE2249_FOURTEEN_TOOL_TARGET_EIGHT_OK"
    ]
  },
  {
    "idx": 9,
    "phase": 2250,
    "word": "nine",
    "targetName": "target-nine",
    "path": "tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs",
    "proposal": "docs/phase2250-fourteen-tool-mutation-target-nine.proposal.diff",
    "addMode": "append-export",
    "newExport": "buildPhase2250FourteenMutationTargetNineStatus",
    "newPhaseId": "Phase2250A-Controlled-Fourteen-Tool-Mutation-Target-Nine",
    "marker": "PHASE2250_FOURTEEN_TOOL_TARGET_NINE_OK",
    "referenceMarkers": [
      "PHASE2156_OCT_TOOL_TARGET_EIGHT_OK",
      "PHASE2170_NONET_TOOL_TARGET_NINE_OK",
      "PHASE2184_DECA_TOOL_TARGET_NINE_OK",
      "PHASE2199_ELEVEN_TOOL_TARGET_NINE_OK",
      "PHASE2215_TWELVE_TOOL_TARGET_NINE_OK",
      "PHASE2232_THIRTEEN_TOOL_TARGET_NINE_OK"
    ],
    "referenceFields": [
      "phase2156Marker",
      "phase2170Marker",
      "phase2184Marker",
      "phase2199Marker",
      "phase2215Marker",
      "phase2232Marker"
    ],
    "requiredExports": [
      "export function buildPhase2250FourteenMutationTargetNineStatus",
      "export function main"
    ],
    "requiredMarkers": [
      "PHASE2156_OCT_TOOL_TARGET_EIGHT_OK",
      "PHASE2170_NONET_TOOL_TARGET_NINE_OK",
      "PHASE2184_DECA_TOOL_TARGET_NINE_OK",
      "PHASE2199_ELEVEN_TOOL_TARGET_NINE_OK",
      "PHASE2215_TWELVE_TOOL_TARGET_NINE_OK",
      "PHASE2232_THIRTEEN_TOOL_TARGET_NINE_OK",
      "PHASE2250_FOURTEEN_TOOL_TARGET_NINE_OK"
    ]
  },
  {
    "idx": 10,
    "phase": 2251,
    "word": "ten",
    "targetName": "target-ten",
    "path": "tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs",
    "proposal": "docs/phase2251-fourteen-tool-mutation-target-ten.proposal.diff",
    "addMode": "append-export",
    "newExport": "buildPhase2251FourteenMutationTargetTenStatus",
    "newPhaseId": "Phase2251A-Controlled-Fourteen-Tool-Mutation-Target-Ten",
    "marker": "PHASE2251_FOURTEEN_TOOL_TARGET_TEN_OK",
    "referenceMarkers": [
      "PHASE2170_NONET_TOOL_TARGET_NINE_OK",
      "PHASE2185_DECA_TOOL_TARGET_TEN_OK",
      "PHASE2200_ELEVEN_TOOL_TARGET_TEN_OK",
      "PHASE2216_TWELVE_TOOL_TARGET_TEN_OK",
      "PHASE2233_THIRTEEN_TOOL_TARGET_TEN_OK"
    ],
    "referenceFields": [
      "phase2170Marker",
      "phase2185Marker",
      "phase2200Marker",
      "phase2216Marker",
      "phase2233Marker"
    ],
    "requiredExports": [
      "export function buildPhase2251FourteenMutationTargetTenStatus",
      "export function main"
    ],
    "requiredMarkers": [
      "PHASE2170_NONET_TOOL_TARGET_NINE_OK",
      "PHASE2185_DECA_TOOL_TARGET_TEN_OK",
      "PHASE2200_ELEVEN_TOOL_TARGET_TEN_OK",
      "PHASE2216_TWELVE_TOOL_TARGET_TEN_OK",
      "PHASE2233_THIRTEEN_TOOL_TARGET_TEN_OK",
      "PHASE2251_FOURTEEN_TOOL_TARGET_TEN_OK"
    ]
  },
  {
    "idx": 11,
    "phase": 2252,
    "word": "eleven",
    "targetName": "target-eleven",
    "path": "tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs",
    "proposal": "docs/phase2252-fourteen-tool-mutation-target-eleven.proposal.diff",
    "addMode": "append-export",
    "newExport": "buildPhase2252FourteenMutationTargetElevenStatus",
    "newPhaseId": "Phase2252A-Controlled-Fourteen-Tool-Mutation-Target-Eleven",
    "marker": "PHASE2252_FOURTEEN_TOOL_TARGET_ELEVEN_OK",
    "referenceMarkers": [
      "PHASE2170_NONET_TOOL_TARGET_NINE_OK",
      "PHASE2185_DECA_TOOL_TARGET_TEN_OK",
      "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK",
      "PHASE2217_TWELVE_TOOL_TARGET_ELEVEN_OK",
      "PHASE2234_THIRTEEN_TOOL_TARGET_ELEVEN_OK"
    ],
    "referenceFields": [
      "phase2170Marker",
      "phase2185Marker",
      "phase2201Marker",
      "phase2217Marker",
      "phase2234Marker"
    ],
    "requiredExports": [
      "export function buildPhase2252FourteenMutationTargetElevenStatus",
      "export function main"
    ],
    "requiredMarkers": [
      "PHASE2185_DECA_TOOL_TARGET_TEN_OK",
      "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK",
      "PHASE2217_TWELVE_TOOL_TARGET_ELEVEN_OK",
      "PHASE2234_THIRTEEN_TOOL_TARGET_ELEVEN_OK",
      "PHASE2252_FOURTEEN_TOOL_TARGET_ELEVEN_OK"
    ]
  },
  {
    "idx": 12,
    "phase": 2253,
    "word": "twelve",
    "targetName": "target-twelve",
    "path": "tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs",
    "proposal": "docs/phase2253-fourteen-tool-mutation-target-twelve.proposal.diff",
    "addMode": "append-export",
    "newExport": "buildPhase2253FourteenMutationTargetTwelveStatus",
    "newPhaseId": "Phase2253A-Controlled-Fourteen-Tool-Mutation-Target-Twelve",
    "marker": "PHASE2253_FOURTEEN_TOOL_TARGET_TWELVE_OK",
    "referenceMarkers": [
      "PHASE2170_NONET_TOOL_TARGET_NINE_OK",
      "PHASE2185_DECA_TOOL_TARGET_TEN_OK",
      "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK",
      "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK",
      "PHASE2235_THIRTEEN_TOOL_TARGET_TWELVE_OK"
    ],
    "referenceFields": [
      "phase2170Marker",
      "phase2185Marker",
      "phase2201Marker",
      "phase2218Marker",
      "phase2235Marker"
    ],
    "requiredExports": [
      "export function buildPhase2253FourteenMutationTargetTwelveStatus",
      "export function main"
    ],
    "requiredMarkers": [
      "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK",
      "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK",
      "PHASE2235_THIRTEEN_TOOL_TARGET_TWELVE_OK",
      "PHASE2253_FOURTEEN_TOOL_TARGET_TWELVE_OK"
    ]
  },
  {
    "idx": 13,
    "phase": 2254,
    "word": "thirteen",
    "targetName": "target-thirteen",
    "path": "tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs",
    "proposal": "docs/phase2254-fourteen-tool-mutation-target-thirteen.proposal.diff",
    "addMode": "append-export",
    "newExport": "buildPhase2254FourteenMutationTargetThirteenStatus",
    "newPhaseId": "Phase2254A-Controlled-Fourteen-Tool-Mutation-Target-Thirteen",
    "marker": "PHASE2254_FOURTEEN_TOOL_TARGET_THIRTEEN_OK",
    "referenceMarkers": [
      "PHASE2170_NONET_TOOL_TARGET_NINE_OK",
      "PHASE2185_DECA_TOOL_TARGET_TEN_OK",
      "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK",
      "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK",
      "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK"
    ],
    "referenceFields": [
      "phase2170Marker",
      "phase2185Marker",
      "phase2201Marker",
      "phase2218Marker",
      "phase2236Marker"
    ],
    "requiredExports": [
      "export function buildPhase2254FourteenMutationTargetThirteenStatus",
      "export function main"
    ],
    "requiredMarkers": [
      "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK",
      "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK",
      "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK",
      "PHASE2254_FOURTEEN_TOOL_TARGET_THIRTEEN_OK"
    ]
  },
  {
    "idx": 14,
    "phase": 2255,
    "word": "fourteen",
    "targetName": "target-fourteen",
    "path": "tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs",
    "proposal": "docs/phase2255-fourteen-tool-mutation-target-fourteen.proposal.diff",
    "addMode": "append-export",
    "newExport": "buildPhase2255FourteenMutationRuntimeStatus",
    "newPhaseId": "Phase2255A-Controlled-Fourteen-Tool-Mutation-Target-Fourteen",
    "marker": "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK",
    "referenceMarkers": [
      "PHASE2170_NONET_TOOL_TARGET_NINE_OK",
      "PHASE2185_DECA_TOOL_TARGET_TEN_OK",
      "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK",
      "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK",
      "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK"
    ],
    "referenceFields": [
      "phase2170Marker",
      "phase2185Marker",
      "phase2201Marker",
      "phase2218Marker",
      "phase2236Marker"
    ],
    "requiredExports": [
      "export function buildPhase2255FourteenMutationRuntimeStatus",
      "export function main"
    ],
    "requiredMarkers": [
      "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK",
      "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK",
      "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK",
      "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK"
    ],
    "runnerReady": true
  }
];

const smokeSpec = [
  {
    "id": "phase2091",
    "targetIndex": 0,
    "command": "node",
    "args": [
      "tools/phase2091/generated-source-patch-target.mjs"
    ],
    "expectedStatus": 0,
    "checks": [
      "parsed?.marker === \"PHASE2091_SOURCE_PATCH_OK\"",
      "parsed?.phase2092?.marker === \"PHASE2092_EXISTING_TOOL_MUTATION_OK\"",
      "parsed?.phase2093?.marker === \"PHASE2093_BATCH_TOOL_TARGET_ONE_OK\"",
      "parsed?.phase2096?.marker === \"PHASE2096_TRIPLE_TOOL_TARGET_ONE_OK\"",
      "parsed?.phase2106?.marker === \"PHASE2106_QUAD_TOOL_TARGET_ONE_OK\"",
      "parsed?.phase2116?.marker === \"PHASE2116_QUINT_TOOL_TARGET_ONE_OK\"",
      "parsed?.phase2126?.marker === \"PHASE2126_SEXT_TOOL_TARGET_ONE_OK\"",
      "parsed?.phase2137?.marker === \"PHASE2137_SEPT_TOOL_TARGET_ONE_OK\"",
      "parsed?.phase2149?.marker === \"PHASE2149_OCT_TOOL_TARGET_ONE_OK\"",
      "parsed?.phase2162?.marker === \"PHASE2162_NONET_TOOL_TARGET_ONE_OK\"",
      "parsed?.phase2176?.marker === \"PHASE2176_DECA_TOOL_TARGET_ONE_OK\"",
      "parsed?.phase2191?.marker === \"PHASE2191_ELEVEN_TOOL_TARGET_ONE_OK\"",
      "parsed?.phase2207?.marker === \"PHASE2207_TWELVE_TOOL_TARGET_ONE_OK\"",
      "parsed?.phase2224?.marker === \"PHASE2224_THIRTEEN_TOOL_TARGET_ONE_OK\"",
      "parsed?.phase2242?.marker === \"PHASE2242_FOURTEEN_TOOL_TARGET_ONE_OK\""
    ],
    "markerPath": "parsed?.phase2242?.marker || null",
    "markerField": "phase2242Marker"
  },
  {
    "id": "phase2092",
    "targetIndex": 1,
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))"
    ],
    "expectedStatus": 0,
    "checks": [
      "parsed?.marker === \"PHASE2094_BATCH_TOOL_TARGET_TWO_OK\"",
      "parsed?.phase2127Marker === \"PHASE2127_SEXT_TOOL_TARGET_TWO_OK\"",
      "parsed?.phase2138Marker === \"PHASE2138_SEPT_TOOL_TARGET_TWO_OK\"",
      "parsed?.phase2150Marker === \"PHASE2150_OCT_TOOL_TARGET_TWO_OK\"",
      "parsed?.phase2163Marker === \"PHASE2163_NONET_TOOL_TARGET_TWO_OK\"",
      "parsed?.phase2177Marker === \"PHASE2177_DECA_TOOL_TARGET_TWO_OK\"",
      "parsed?.phase2192Marker === \"PHASE2192_ELEVEN_TOOL_TARGET_TWO_OK\"",
      "parsed?.phase2208Marker === \"PHASE2208_TWELVE_TOOL_TARGET_TWO_OK\"",
      "parsed?.phase2225Marker === \"PHASE2225_THIRTEEN_TOOL_TARGET_TWO_OK\"",
      "parsed?.phase2243Marker === \"PHASE2243_FOURTEEN_TOOL_TARGET_TWO_OK\""
    ],
    "markerPath": "parsed?.phase2243Marker || null",
    "markerField": "phase2243Marker"
  },
  {
    "id": "phase2093",
    "targetIndex": 2,
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))"
    ],
    "expectedStatus": 0,
    "checks": [
      "parsed?.marker === \"PHASE2100_TRIPLE_TOOL_TARGET_THREE_OK\"",
      "parsed?.phase2128Marker === \"PHASE2128_SEXT_TOOL_TARGET_THREE_OK\"",
      "parsed?.phase2139Marker === \"PHASE2139_SEPT_TOOL_TARGET_THREE_OK\"",
      "parsed?.phase2151Marker === \"PHASE2151_OCT_TOOL_TARGET_THREE_OK\"",
      "parsed?.phase2164Marker === \"PHASE2164_NONET_TOOL_TARGET_THREE_OK\"",
      "parsed?.phase2178Marker === \"PHASE2178_DECA_TOOL_TARGET_THREE_OK\"",
      "parsed?.phase2193Marker === \"PHASE2193_ELEVEN_TOOL_TARGET_THREE_OK\"",
      "parsed?.phase2209Marker === \"PHASE2209_TWELVE_TOOL_TARGET_THREE_OK\"",
      "parsed?.phase2226Marker === \"PHASE2226_THIRTEEN_TOOL_TARGET_THREE_OK\"",
      "parsed?.phase2244Marker === \"PHASE2244_FOURTEEN_TOOL_TARGET_THREE_OK\""
    ],
    "markerPath": "parsed?.phase2244Marker || null",
    "markerField": "phase2244Marker"
  },
  {
    "id": "phase2096",
    "targetIndex": 3,
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))"
    ],
    "expectedStatus": 0,
    "checks": [
      "parsed?.marker === \"PHASE2109_QUAD_TOOL_TARGET_FOUR_OK\"",
      "parsed?.phase2129Marker === \"PHASE2129_SEXT_TOOL_TARGET_FOUR_OK\"",
      "parsed?.phase2140Marker === \"PHASE2140_SEPT_TOOL_TARGET_FOUR_OK\"",
      "parsed?.phase2152Marker === \"PHASE2152_OCT_TOOL_TARGET_FOUR_OK\"",
      "parsed?.phase2165Marker === \"PHASE2165_NONET_TOOL_TARGET_FOUR_OK\"",
      "parsed?.phase2179Marker === \"PHASE2179_DECA_TOOL_TARGET_FOUR_OK\"",
      "parsed?.phase2194Marker === \"PHASE2194_ELEVEN_TOOL_TARGET_FOUR_OK\"",
      "parsed?.phase2210Marker === \"PHASE2210_TWELVE_TOOL_TARGET_FOUR_OK\"",
      "parsed?.phase2227Marker === \"PHASE2227_THIRTEEN_TOOL_TARGET_FOUR_OK\"",
      "parsed?.phase2245Marker === \"PHASE2245_FOURTEEN_TOOL_TARGET_FOUR_OK\""
    ],
    "markerPath": "parsed?.phase2245Marker || null",
    "markerField": "phase2245Marker"
  },
  {
    "id": "phase2101",
    "targetIndex": 4,
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))"
    ],
    "expectedStatus": 0,
    "checks": [
      "parsed?.marker === \"PHASE2120_QUINT_TOOL_TARGET_FIVE_OK\"",
      "parsed?.phase2130Marker === \"PHASE2130_SEXT_TOOL_TARGET_FIVE_OK\"",
      "parsed?.phase2141Marker === \"PHASE2141_SEPT_TOOL_TARGET_FIVE_OK\"",
      "parsed?.phase2153Marker === \"PHASE2153_OCT_TOOL_TARGET_FIVE_OK\"",
      "parsed?.phase2166Marker === \"PHASE2166_NONET_TOOL_TARGET_FIVE_OK\"",
      "parsed?.phase2180Marker === \"PHASE2180_DECA_TOOL_TARGET_FIVE_OK\"",
      "parsed?.phase2195Marker === \"PHASE2195_ELEVEN_TOOL_TARGET_FIVE_OK\"",
      "parsed?.phase2211Marker === \"PHASE2211_TWELVE_TOOL_TARGET_FIVE_OK\"",
      "parsed?.phase2228Marker === \"PHASE2228_THIRTEEN_TOOL_TARGET_FIVE_OK\"",
      "parsed?.phase2246Marker === \"PHASE2246_FOURTEEN_TOOL_TARGET_FIVE_OK\""
    ],
    "markerPath": "parsed?.phase2246Marker || null",
    "markerField": "phase2246Marker"
  },
  {
    "id": "phase2111",
    "targetIndex": 5,
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2247FourteenMutationTargetSixStatus())))"
    ],
    "expectedStatus": 0,
    "checks": [
      "parsed?.marker === \"PHASE2247_FOURTEEN_TOOL_TARGET_SIX_OK\"",
      "parsed?.phase2142Marker === \"PHASE2142_SEPT_TOOL_TARGET_SIX_OK\"",
      "parsed?.phase2154Marker === \"PHASE2154_OCT_TOOL_TARGET_SIX_OK\"",
      "parsed?.phase2167Marker === \"PHASE2167_NONET_TOOL_TARGET_SIX_OK\"",
      "parsed?.phase2181Marker === \"PHASE2181_DECA_TOOL_TARGET_SIX_OK\"",
      "parsed?.phase2196Marker === \"PHASE2196_ELEVEN_TOOL_TARGET_SIX_OK\"",
      "parsed?.phase2212Marker === \"PHASE2212_TWELVE_TOOL_TARGET_SIX_OK\"",
      "parsed?.phase2229Marker === \"PHASE2229_THIRTEEN_TOOL_TARGET_SIX_OK\"",
      "parsed?.phase2247Marker === \"PHASE2247_FOURTEEN_TOOL_TARGET_SIX_OK\""
    ],
    "markerPath": "parsed?.phase2247Marker || null",
    "markerField": "phase2247Marker"
  },
  {
    "id": "phase2121",
    "targetIndex": 6,
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2248FourteenMutationTargetSevenStatus())))"
    ],
    "expectedStatus": 0,
    "checks": [
      "parsed?.marker === \"PHASE2248_FOURTEEN_TOOL_TARGET_SEVEN_OK\"",
      "parsed?.phase2143Marker === \"PHASE2143_SEPT_TOOL_TARGET_SEVEN_OK\"",
      "parsed?.phase2155Marker === \"PHASE2155_OCT_TOOL_TARGET_SEVEN_OK\"",
      "parsed?.phase2168Marker === \"PHASE2168_NONET_TOOL_TARGET_SEVEN_OK\"",
      "parsed?.phase2182Marker === \"PHASE2182_DECA_TOOL_TARGET_SEVEN_OK\"",
      "parsed?.phase2197Marker === \"PHASE2197_ELEVEN_TOOL_TARGET_SEVEN_OK\"",
      "parsed?.phase2213Marker === \"PHASE2213_TWELVE_TOOL_TARGET_SEVEN_OK\"",
      "parsed?.phase2230Marker === \"PHASE2230_THIRTEEN_TOOL_TARGET_SEVEN_OK\"",
      "parsed?.phase2248Marker === \"PHASE2248_FOURTEEN_TOOL_TARGET_SEVEN_OK\""
    ],
    "markerPath": "parsed?.phase2248Marker || null",
    "markerField": "phase2248Marker"
  },
  {
    "id": "phase2132",
    "targetIndex": 7,
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2249FourteenMutationTargetEightStatus())))"
    ],
    "expectedStatus": 0,
    "checks": [
      "parsed?.marker === \"PHASE2249_FOURTEEN_TOOL_TARGET_EIGHT_OK\"",
      "parsed?.phase2143Marker === \"PHASE2143_SEPT_TOOL_TARGET_SEVEN_OK\"",
      "parsed?.phase2156Marker === \"PHASE2156_OCT_TOOL_TARGET_EIGHT_OK\"",
      "parsed?.phase2169Marker === \"PHASE2169_NONET_TOOL_TARGET_EIGHT_OK\"",
      "parsed?.phase2183Marker === \"PHASE2183_DECA_TOOL_TARGET_EIGHT_OK\"",
      "parsed?.phase2198Marker === \"PHASE2198_ELEVEN_TOOL_TARGET_EIGHT_OK\"",
      "parsed?.phase2214Marker === \"PHASE2214_TWELVE_TOOL_TARGET_EIGHT_OK\"",
      "parsed?.phase2231Marker === \"PHASE2231_THIRTEEN_TOOL_TARGET_EIGHT_OK\"",
      "parsed?.phase2249Marker === \"PHASE2249_FOURTEEN_TOOL_TARGET_EIGHT_OK\""
    ],
    "markerPath": "parsed?.phase2249Marker || null",
    "markerField": "phase2249Marker"
  },
  {
    "id": "phase2144",
    "targetIndex": 8,
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2250FourteenMutationTargetNineStatus())))"
    ],
    "expectedStatus": 0,
    "checks": [
      "parsed?.marker === \"PHASE2250_FOURTEEN_TOOL_TARGET_NINE_OK\"",
      "parsed?.phase2156Marker === \"PHASE2156_OCT_TOOL_TARGET_EIGHT_OK\"",
      "parsed?.phase2170Marker === \"PHASE2170_NONET_TOOL_TARGET_NINE_OK\"",
      "parsed?.phase2184Marker === \"PHASE2184_DECA_TOOL_TARGET_NINE_OK\"",
      "parsed?.phase2199Marker === \"PHASE2199_ELEVEN_TOOL_TARGET_NINE_OK\"",
      "parsed?.phase2215Marker === \"PHASE2215_TWELVE_TOOL_TARGET_NINE_OK\"",
      "parsed?.phase2232Marker === \"PHASE2232_THIRTEEN_TOOL_TARGET_NINE_OK\"",
      "parsed?.phase2250Marker === \"PHASE2250_FOURTEEN_TOOL_TARGET_NINE_OK\""
    ],
    "markerPath": "parsed?.phase2250Marker || null",
    "markerField": "phase2250Marker"
  },
  {
    "id": "phase2157",
    "targetIndex": 9,
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2251FourteenMutationTargetTenStatus())))"
    ],
    "expectedStatus": 0,
    "checks": [
      "parsed?.marker === \"PHASE2251_FOURTEEN_TOOL_TARGET_TEN_OK\"",
      "parsed?.phase2170Marker === \"PHASE2170_NONET_TOOL_TARGET_NINE_OK\"",
      "parsed?.phase2185Marker === \"PHASE2185_DECA_TOOL_TARGET_TEN_OK\"",
      "parsed?.phase2200Marker === \"PHASE2200_ELEVEN_TOOL_TARGET_TEN_OK\"",
      "parsed?.phase2216Marker === \"PHASE2216_TWELVE_TOOL_TARGET_TEN_OK\"",
      "parsed?.phase2233Marker === \"PHASE2233_THIRTEEN_TOOL_TARGET_TEN_OK\"",
      "parsed?.phase2251Marker === \"PHASE2251_FOURTEEN_TOOL_TARGET_TEN_OK\""
    ],
    "markerPath": "parsed?.phase2251Marker || null",
    "markerField": "phase2251Marker"
  },
  {
    "id": "phase2171",
    "targetIndex": 10,
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2252FourteenMutationTargetElevenStatus())))"
    ],
    "expectedStatus": 0,
    "checks": [
      "parsed?.marker === \"PHASE2252_FOURTEEN_TOOL_TARGET_ELEVEN_OK\"",
      "parsed?.phase2170Marker === \"PHASE2170_NONET_TOOL_TARGET_NINE_OK\"",
      "parsed?.phase2185Marker === \"PHASE2185_DECA_TOOL_TARGET_TEN_OK\"",
      "parsed?.phase2201Marker === \"PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK\"",
      "parsed?.phase2217Marker === \"PHASE2217_TWELVE_TOOL_TARGET_ELEVEN_OK\"",
      "parsed?.phase2234Marker === \"PHASE2234_THIRTEEN_TOOL_TARGET_ELEVEN_OK\"",
      "parsed?.phase2252Marker === \"PHASE2252_FOURTEEN_TOOL_TARGET_ELEVEN_OK\""
    ],
    "markerPath": "parsed?.phase2252Marker || null",
    "markerField": "phase2252Marker"
  },
  {
    "id": "phase2186",
    "targetIndex": 11,
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2253FourteenMutationTargetTwelveStatus())))"
    ],
    "expectedStatus": 0,
    "checks": [
      "parsed?.marker === \"PHASE2253_FOURTEEN_TOOL_TARGET_TWELVE_OK\"",
      "parsed?.phase2170Marker === \"PHASE2170_NONET_TOOL_TARGET_NINE_OK\"",
      "parsed?.phase2185Marker === \"PHASE2185_DECA_TOOL_TARGET_TEN_OK\"",
      "parsed?.phase2201Marker === \"PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK\"",
      "parsed?.phase2218Marker === \"PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK\"",
      "parsed?.phase2235Marker === \"PHASE2235_THIRTEEN_TOOL_TARGET_TWELVE_OK\"",
      "parsed?.phase2253Marker === \"PHASE2253_FOURTEEN_TOOL_TARGET_TWELVE_OK\""
    ],
    "markerPath": "parsed?.phase2253Marker || null",
    "markerField": "phase2253Marker"
  },
  {
    "id": "phase2202",
    "targetIndex": 12,
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2254FourteenMutationTargetThirteenStatus())))"
    ],
    "expectedStatus": 0,
    "checks": [
      "parsed?.marker === \"PHASE2254_FOURTEEN_TOOL_TARGET_THIRTEEN_OK\"",
      "parsed?.phase2170Marker === \"PHASE2170_NONET_TOOL_TARGET_NINE_OK\"",
      "parsed?.phase2185Marker === \"PHASE2185_DECA_TOOL_TARGET_TEN_OK\"",
      "parsed?.phase2201Marker === \"PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK\"",
      "parsed?.phase2218Marker === \"PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK\"",
      "parsed?.phase2236Marker === \"PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK\"",
      "parsed?.phase2254Marker === \"PHASE2254_FOURTEEN_TOOL_TARGET_THIRTEEN_OK\""
    ],
    "markerPath": "parsed?.phase2254Marker || null",
    "markerField": "phase2254Marker"
  },
  {
    "id": "phase2219",
    "targetIndex": 13,
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2255FourteenMutationRuntimeStatus())))"
    ],
    "expectedStatus": 0,
    "checks": [
      "parsed?.marker === \"PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK\"",
      "parsed?.phase2170Marker === \"PHASE2170_NONET_TOOL_TARGET_NINE_OK\"",
      "parsed?.phase2185Marker === \"PHASE2185_DECA_TOOL_TARGET_TEN_OK\"",
      "parsed?.phase2201Marker === \"PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK\"",
      "parsed?.phase2218Marker === \"PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK\"",
      "parsed?.phase2236Marker === \"PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK\"",
      "parsed?.phase2255Marker === \"PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK\""
    ],
    "markerPath": "parsed?.phase2255Marker || null",
    "markerField": "phase2255Marker"
  }
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
  const lines = [];
  lines.push(`export function ${target.newExport}() {`);
  lines.push("  return {");
  lines.push(`    phaseId: "${target.newPhaseId}",`);
  lines.push(`    marker: "${target.marker}",`);
  if (target.idx !== 1) lines.push("    importSafe: true,");
  for (const [index, marker] of target.referenceMarkers.entries()) {
    const field = target.referenceFields[index];
    lines.push(`    ${field}: "${marker}",`);
  }
  lines.push(`    phase${target.phase}Marker: "${target.marker}",`);
  if (target.runnerReady) lines.push(`    ${phaseMeta.runnerReadyField}: true,`);
  lines.push(`    ${phaseMeta.appliedField}: true,`);
  lines.push("    providerCallsMade: false,");
  lines.push("    codexExecExecuted: false,");
  lines.push("    chatModified: false,");
  lines.push("    chatGatewayExecuteModified: false,");
  lines.push("  };");
  lines.push("}");
  return `${lines.join("\n")}\n`;
}

function insertBefore(source, needle, insertion) {
  if (!source.includes(needle)) throw new Error(`needle_not_found:${needle}`);
  return source.replace(needle, `${insertion}${needle}`);
}

function replaceOnce(source, search, replace) {
  if (!source.includes(search)) throw new Error(`replace_target_not_found:${search}`);
  return source.replace(search, replace);
}

function upsertStatusFunction(source, target, statusFn, anchor) {
  if (source.includes(statusFn.trim())) return source;
  const functionPattern = new RegExp(`export function ${target.newExport}\\(\\) \\{[\\s\\S]*?\\n\\}\\n?`, "m");
  if (functionPattern.test(source)) {
    return source.replace(functionPattern, `${statusFn}\n`);
  }
  return insertBefore(source, anchor, `\n${statusFn}`);
}

function mutateTargetContent(beforeText, target) {
  const statusFn = buildStatusFunction(target);

  if (target.addMode === "phase2091-main") {
    let next = upsertStatusFunction(
      beforeText,
      target,
      statusFn,
      "if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {",
    );
    if (!next.includes(`    ${target.mainProperty}: ${target.newExport}(),`)) {
      next = replaceOnce(
        next,
        `    ${target.runtimeBaseProperty}: ${target.runtimeBaseExport}(),\n  }, null, 2));`,
        `    ${target.runtimeBaseProperty}: ${target.runtimeBaseExport}(),\n    ${target.mainProperty}: ${target.newExport}(),\n  }, null, 2));`,
      );
    }
    return next;
  }

  if (target.addMode === "runtime-plus-export") {
    let next = beforeText;
    const anchorMap = {
      2243: "export function buildPhase2225ThirteenMutationTargetTwoStatus() {",
      2244: "export function buildPhase2226ThirteenMutationTargetThreeStatus() {",
      2245: "export function buildPhase2227ThirteenMutationTargetFourStatus() {",
      2246: "export function buildPhase2228ThirteenMutationTargetFiveStatus() {",
    };
    if (!next.includes(`    ${target.runtimeMarkerField}: "${target.marker}",`)) {
      next = replaceOnce(
        next,
        `    ${target.runtimeInsertAfterField}: "${target.runtimeInsertAfterMarker}",\n`,
        `    ${target.runtimeInsertAfterField}: "${target.runtimeInsertAfterMarker}",\n    ${target.runtimeMarkerField}: "${target.marker}",\n`,
      );
    }
    next = upsertStatusFunction(next, target, statusFn, anchorMap[target.phase]);
    return next;
  }

  if (target.addMode === "append-export") {
    return upsertStatusFunction(beforeText, target, statusFn, "export function main() {");
  }

  throw new Error(`unknown_add_mode:${target.addMode}`);
}

async function buildProposalDiff(target, beforeText, afterText) {
  if (beforeText === afterText) {
    try {
      return await readText(target.proposal);
    } catch {
      throw new Error(`proposal_diff_generation_failed:${target.path}`);
    }
  }
  const tempDir = resolve("tmp/phase2219-2236-proposals");
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
  return `# Phase2237A-2255A Controlled Fourteen Tool Mutation

## Goal

Phase2237A-2255A extends the controlled local mutation line from thirteen files to fourteen files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled fourteen tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase2202A-2218A sealed evidence.
- Reuses \`tools/phase2101_2110/controlled-mutation-substrate.mjs\`.
- Applies exactly fourteen existing source-file mutations.
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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support fourteen bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The fourteen mutation batch must prove:
${targets.map((target) => `- new Phase${target.phase} target ${target.word} emits \`${target.marker}\``).join("\n")}

## Commands

\`\`\`powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase2237-2255-controlled-fourteen-tool-mutation
cmd /c pnpm run apply:phase2237-2255-controlled-fourteen-tool-mutation
cmd /c pnpm run smoke:phase2237-2255-controlled-fourteen-tool-mutation
cmd /c pnpm run verify:phase2237-2255-controlled-fourteen-tool-mutation
\`\`\`

The first verifier run is expected to fail before apply because result evidence does not exist yet and the fourteen target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a fifteen-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default \`/chat\`.
`;
}

function buildApproval(planOperations) {
  return JSON.stringify(
    {
      phaseId: phaseMeta.phaseId,
      planId: "phase2237-2255-controlled-fourteen-tool-mutation",
      maxChangedFiles: 14,
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
            scope: "phase2237-2255-controlled-fourteen-tool-mutation",
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
    },
    null,
    2,
  ) + "\n";
}

function buildRunnerTemplate() {
  const requiredAllowedFiles = [
    phaseMeta.resultPath,
    phaseMeta.resultMdPath,
    phaseMeta.rollbackPath,
    phaseMeta.smokePath,
    ...targets.map((target) => target.proposal),
    ...targets.map((target) => target.path),
  ];

  const smokeCommands = smokeSpec.map((entry) => ({
    id: entry.id,
    command: entry.command,
    args: entry.args,
  }));

  const smokeVars = smokeSpec
    .map((entry, index) => `  const smoke${titleWord(entry.id)} = smokeRuns[${index}];`)
    .join("\n");

  const smokeStatusChecks = smokeSpec
    .map((entry) => `      smoke${titleWord(entry.id)}.result.status === ${entry.expectedStatus} &&`)
    .join("\n");

  const smokeValueChecks = smokeSpec
    .flatMap((entry) =>
      entry.checks.map((check) => `      smoke${titleWord(entry.id)}.${check} &&`),
    )
    .join("\n");

  const smokeMarkers = smokeSpec
    .map(
      (entry) =>
        `    ${entry.markerField}: smoke${titleWord(entry.id)}.${entry.markerPath},`,
    )
    .join("\n");

  const targetPathsArray = JSON.stringify(targets.map((target) => target.path), null, 4);
  const smokeTargetIds = JSON.stringify(
    targets.map((target) => ({
      path: target.path,
      targetName: target.targetName,
      marker: target.marker,
      exportName: target.newExport,
    })),
    null,
    4,
  );

  return `import { existsSync } from "node:fs";
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

export function buildPhase2255FourteenMutationRuntimeStatus() {
  return {
    phaseId: "Phase2255A-Controlled-Fourteen-Tool-Mutation-Target-Fourteen",
    marker: "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK",
    importSafe: true,
    phase2170Marker: "PHASE2170_NONET_TOOL_TARGET_NINE_OK",
    phase2185Marker: "PHASE2185_DECA_TOOL_TARGET_TEN_OK",
    phase2201Marker: "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK",
    phase2218Marker: "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK",
    phase2236Marker: "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK",
    phase2255Marker: "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK",
    fourteenRunnerReady: true,
    fourteenMutationApplied: true,
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
${smokeVars}

  const smokeResult = {
    phaseId,
    generatedAt: new Date().toISOString(),
    status:
${smokeStatusChecks}
${smokeValueChecks}
      true
        ? "passed"
        : "failed",
${smokeMarkers}
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
      maxChangedFiles: 14,
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
    blocker: completed ? "none" : "fourteen_mutation_node_check_or_smoke_failed",
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
    expectedOperationCount: 14,
    expectedMaxChangedFiles: 14,
    requiredAllowedFiles: ${JSON.stringify(requiredAllowedFiles, null, 4)},
    requiredForbiddenPaths: [
      "legacy",
      "PROJECT_CONTEXT.md",
      ".env",
      ".git",
      "node_modules",
      "auth.json",
    ],
    requiredTargets: ${targetPathsArray},
    upstreamChecks: [
      {
        id: "phase632_preflight",
        path: "apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json",
        predicate: (evidence) => evidence.preflightPassed === true && evidence.staleFalse === true,
        blocker: "phase632_preflight_not_passed",
      },
      {
        id: "phase2236_sealed",
        path: "apps/ai-gateway-service/evidence/phase2219-2236-controlled-thirteen-tool-mutation/result.json",
        predicate: (evidence) => evidence.recommendedSealed === true && evidence.thirteenMutationApplied === true,
        blocker: "phase2236_not_sealed",
      },
    ],
    forbiddenPathFragments: defaultForbiddenPathFragments,
  });
}

function buildExtraValidators(targetPath) {
  const importSafeGuard = (content) =>
    content.includes("pathToFileURL(process.argv[1]).href") ? null : "import_safe_main_guard_missing";
  const mainExportGuard = (content) => (content.includes("export function main()") ? null : "main_export_missing");

  if (targetPath === "tools/phase2091/generated-source-patch-target.mjs") return [importSafeGuard];
  if (${JSON.stringify(targets.slice(1).map((target) => target.path), null, 4)}.includes(targetPath)) return [importSafeGuard, mainExportGuard];
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
    phase2236Sealed: validation.upstreamResults.some((entry) => entry.id === "phase2236_sealed" && entry.passed),
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
    "# Phase2237A-2255A Controlled Fourteen Tool Mutation Evidence",
    "",
    \`- status: \${result.status}\`,
    \`- recommendedSealed: \${Boolean(result.recommendedSealed)}\`,
    \`- blocker: \${result.blocker}\`,
    \`- fourteenMutationApplied: \${Boolean(result.fourteenMutationApplied)}\`,
    \`- changedFileCount: \${result.changedFileCount || 0}\`,
    \`- nodeCheckPassed: \${Boolean(result.nodeCheckPassed)}\`,
    \`- localFourteenSmokePassed: \${Boolean(result.localFourteenSmokePassed)}\`,
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
    fourteenMutationApplied: result.fourteenMutationApplied,
    changedFileCount: result.changedFileCount,
    nodeCheckPassed: result.nodeCheckPassed,
    localFourteenSmokePassed: result.localFourteenSmokePassed,
    providerCallsMade: result.providerCallsMade,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
`;
}

function buildVerifierTemplate() {
  const proposalDecls = targets
    .map((target) => {
      const name = `proposal${titleWord(target.word)}Path`;
      return `const ${name} = "${target.proposal}";`;
    })
    .join("\n");

  const targetDecls = targets
    .map((target) => {
      const name = `target${titleWord(target.word)}Path`;
      return `const ${name} = "${target.path}";`;
    })
    .join("\n");

  const proposalChecks = targets
    .map((target) => {
      const name = `proposal${titleWord(target.word)}Path`;
      return `check("proposal_${target.word}_exists", existsSync(resolve(${name})));`;
    })
    .join("\n");

  const targetReads = targets
    .map((target) => {
      const name = `target${titleWord(target.word)}`;
      const pathName = `target${titleWord(target.word)}Path`;
      return `const ${name} = existsSync(resolve(${pathName})) ? readText(${pathName}) : "";`;
    })
    .join("\n");

  const targetChecks = targets
    .map((target) => {
      const contentName = `target${titleWord(target.word)}`;
      return [
        `check("${target.targetName}_export", ${contentName}.includes("${target.newExport}") || ${contentName}.includes("export function ${target.newExport}"));`,
        `check("${target.targetName}_marker", ${contentName}.includes("${target.marker}"));`,
      ].join("\n");
    })
    .join("\n");

  const smokeMarkerChecks = smokeSpec
    .map(
      (entry) =>
        `  check("smoke_${entry.markerField}", smoke.${entry.markerField} === "${targets[entry.targetIndex].marker}");`,
    )
    .join("\n");

  const changedIncludes = targets
    .map((target) => `    && result.changedFiles.includes(target${titleWord(target.word)}Path)`)
    .join("\n");

  const changedList = targets
    .map((target) => `    target${titleWord(target.word)}Path,`)
    .join("\n");

  const packageSmoke = smokeSpec
    .map((entry) => {
      if (entry.command === "node" && entry.args.length === 1) return `node ${entry.args[0]}`;
      return `node -e "${entry.args[1].replace(/"/g, '\\"')}"`;
    })
    .join(" && ");
  const packageSmokeJsLiteral = JSON.stringify(packageSmoke);

  const verifier = `import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "${phaseMeta.phaseId}";
const runnerPath = "${phaseMeta.runnerPath}";
const substratePath = "tools/phase2101_2110/controlled-mutation-substrate.mjs";
const docsPath = "${phaseMeta.docPath}";
const approvalPath = "${phaseMeta.approvalPath}";
${proposalDecls}
${targetDecls}
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
const phase2236 = readJson("apps/ai-gateway-service/evidence/phase2219-2236-controlled-thirteen-tool-mutation/result.json") || {};
const result = readJson(resultPath);
const rollback = readJson(rollbackPath);
const smoke = readJson(smokePath);
${targetReads}
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
    ${packageSmokeJsLiteral},
);
check("package_verify_script_registered", packageJson.scripts?.["${phaseMeta.verifyScript}"] === "node ${phaseMeta.verifierPath}");
check("phase632_preflight_passed", phase632.preflightPassed === true && phase632.staleFalse === true);
check("phase2236_sealed", phase2236.recommendedSealed === true && phase2236.thirteenMutationApplied === true);
check("result_exists", result !== null, "run ${phaseMeta.applyScript} first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("fourteen_mutation_applied", result.fourteenMutationApplied === true);
  check("changed_file_count_fourteen", result.changedFileCount === 14);
  check("changed_files_expected", Array.isArray(result.changedFiles)
${changedIncludes}
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localFourteenSmokePassed === true);
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
  check("rollback_restore_thirteen", rollback.rollbackAction === "restore-previous-content-fourteen");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_fourteen_entries", Array.isArray(rollback.files) && rollback.files.length === 14);
}

if (smoke) {
${smokeMarkerChecks}
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

${targetChecks}
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_thirteen", docs.includes("controlled fourteen tool mutation"));
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
  phase2236Sealed: phase2236.recommendedSealed === true,
  fourteenMutationReady: completed,
  changedFiles: [
${changedList}
  ],
  changedFileCount: result?.changedFileCount ?? 14,
  fourteenMutationApplied: result?.fourteenMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localFourteenSmokePassed: result?.localFourteenSmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, fourteenMutationApplied: verifierResult.fourteenMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localFourteenSmokePassed: verifierResult.localFourteenSmokePassed }, null, 2));
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
    "# Phase2237A-2255A Controlled Fourteen Tool Mutation Evidence",
    "",
    \`- status: \${result.status}\`,
    \`- recommendedSealed: \${Boolean(result.recommendedSealed)}\`,
    \`- blocker: \${result.blocker}\`,
    \`- fourteenMutationApplied: \${Boolean(result.fourteenMutationApplied)}\`,
    \`- changedFileCount: \${result.changedFileCount || 0}\`,
    \`- nodeCheckPassed: \${Boolean(result.nodeCheckPassed)}\`,
    \`- localFourteenSmokePassed: \${Boolean(result.localFourteenSmokePassed)}\`,
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
  const previousRollback = JSON.parse(await readText(phaseMeta.rollbackPath).catch(() => "null"));
  const rollbackFiles = new Map(
    Array.isArray(previousRollback?.files)
      ? previousRollback.files.map((entry) => [entry.targetPath, entry])
      : [],
  );
  const planOperations = [];
  for (const target of targets) {
    const beforeText = await readText(target.path);
    const afterText = mutateTargetContent(beforeText, target);
    const proposalText = await buildProposalDiff(target, beforeText, afterText);
    await writeText(target.proposal, proposalText);
    const rollbackEntry = rollbackFiles.get(target.path);
    const alreadyApplied = beforeText === afterText;
    planOperations.push({
      action: "apply-single-existing-tool-source-mutation",
      proposalPath: target.proposal,
      targetPath: target.path,
      expectedBeforeSha256:
        alreadyApplied === true
          ? rollbackEntry?.previousFileSha256 || sha256Text(beforeText)
          : sha256Text(beforeText),
      allowCreate: false,
      allowDelete: false,
      requiredExports: target.requiredExports,
      requiredMarkers: target.requiredMarkers,
    });
  }

  await writeText(phaseMeta.docPath, buildDoc());
  await writeText(phaseMeta.approvalPath, buildApproval(planOperations));
  await writeText(phaseMeta.runnerPath, buildRunnerTemplate());
  await writeText(phaseMeta.verifierPath, buildVerifierTemplate());

  console.log(
    JSON.stringify(
      {
        status: "pass",
        generatedFiles: [
          phaseMeta.docPath,
          phaseMeta.approvalPath,
          phaseMeta.runnerPath,
          phaseMeta.verifierPath,
          ...targets.map((target) => target.proposal),
        ],
        operationCount: planOperations.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
