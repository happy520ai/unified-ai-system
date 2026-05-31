import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = process.cwd();

const phaseMeta = {
  phaseId: "Phase2661A-2695A-Controlled-Thirty-Tool-Mutation",
  docPath: "docs/phase2661-2695-controlled-thirty-tool-mutation.md",
  approvalPath: "docs/phase2661-2695-controlled-thirty-tool-mutation-approval.example.json",
  runnerPath: "tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs",
  verifierPath: "tools/phase2661_2695/validate-controlled-thirty-tool-mutation.mjs",
  resultDir: "apps/ai-gateway-service/evidence/phase2661-2695-controlled-thirty-tool-mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2661-2695-controlled-thirty-tool-mutation/result.json",
  resultMdPath: "apps/ai-gateway-service/evidence/phase2661-2695-controlled-thirty-tool-mutation/result.md",
  rollbackPath: "apps/ai-gateway-service/evidence/phase2661-2695-controlled-thirty-tool-mutation/rollback.json",
  smokePath: "apps/ai-gateway-service/evidence/phase2661-2695-controlled-thirty-tool-mutation/thirty-smoke.json",
  permissionMode: "controlled-thirty-tool-source-mutation",
  label: "thirty",
  runnerReadyField: "thirtyRunnerReady",
  appliedField: "thirtyMutationApplied",
  smokeField: "localThirtySmokePassed",
  rollbackAction: "restore-previous-content-thirty",
  verifyScript: "verify:phase2661-2695-controlled-thirty-tool-mutation",
  applyScript: "apply:phase2661-2695-controlled-thirty-tool-mutation",
  smokeScript: "smoke:phase2661-2695-controlled-thirty-tool-mutation",
};

const previousPhaseMeta = {
  phaseId: "Phase2627A-2660A-Controlled-Twenty-Nine-Tool-Mutation",
  resultPath: "apps/ai-gateway-service/evidence/phase2627-2660-controlled-twenty-nine-tool-mutation/result.json",
  sealCheckId: "phase2660_sealed",
  sealCheckField: "twentyNineMutationApplied",
  sealCheckBlocker: "phase2660_not_sealed",
};

const titleWords = [
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
  "Twenty",
  "TwentyOne",
  "TwentyTwo",
  "TwentyThree",
  "TwentyFour",
  "TwentyFive",
  "TwentySix",
  "TwentySeven",
  "TwentyEight",
  "TwentyNine",
  "Thirty",
];

const wordNames = titleWords.map((entry) => entry.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase());

const sourceTargetPaths = [
  "tools/phase2091/generated-source-patch-target.mjs",
  "tools/phase2092/apply-controlled-existing-tool-mutation.mjs",
  "tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs",
  "tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs",
  "tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs",
  "tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs",
  "tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs",
  "tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs",
  "tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs",
  "tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs",
  "tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs",
  "tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs",
  "tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs",
  "tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs",
  "tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs",
  "tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs",
  "tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs",
  "tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs",
  "tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs",
  "tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs",
  "tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs",
  "tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs",
  "tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs",
  "tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs",
  "tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs",
  "tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs",
  "tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs",
  "tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs",
  "tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs",
  "tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs",
];

const baseTargets = [
  {
    idx: 1,
    path: sourceTargetPaths[0],
    addMode: "phase2091-main",
    referenceMarkers: [
      "PHASE2149_OCT_TOOL_TARGET_ONE_OK",
      "PHASE2162_NONET_TOOL_TARGET_ONE_OK",
      "PHASE2176_DECA_TOOL_TARGET_ONE_OK",
      "PHASE2191_ELEVEN_TOOL_TARGET_ONE_OK",
      "PHASE2207_TWELVE_TOOL_TARGET_ONE_OK",
      "PHASE2224_THIRTEEN_TOOL_TARGET_ONE_OK",
      "PHASE2242_FOURTEEN_TOOL_TARGET_ONE_OK",
      "PHASE2261_FIFTEEN_TOOL_TARGET_ONE_OK",
    ],
    referenceFields: [
      "phase2149Marker",
      "phase2162Marker",
      "phase2176Marker",
      "phase2191Marker",
      "phase2207Marker",
      "phase2224Marker",
      "phase2242Marker",
      "phase2261Marker",
    ],
    requiredMarkers: [
      "PHASE2091_SOURCE_PATCH_OK",
      "PHASE2162_NONET_TOOL_TARGET_ONE_OK",
      "PHASE2176_DECA_TOOL_TARGET_ONE_OK",
      "PHASE2191_ELEVEN_TOOL_TARGET_ONE_OK",
      "PHASE2207_TWELVE_TOOL_TARGET_ONE_OK",
      "PHASE2224_THIRTEEN_TOOL_TARGET_ONE_OK",
      "PHASE2242_FOURTEEN_TOOL_TARGET_ONE_OK",
      "PHASE2261_FIFTEEN_TOOL_TARGET_ONE_OK",
    ],
    mainProperty: "phase2281",
    runtimeBaseProperty: "phase2261",
    runtimeBaseExport: "buildPhase2261FifteenMutationTargetOneStatus",
  },
  {
    idx: 2,
    path: sourceTargetPaths[1],
    addMode: "runtime-plus-export",
    runtimeExport: "buildPhase2094BatchMutationRuntimeStatus",
    runtimeInsertAfterField: "phase2243Marker",
    runtimeInsertAfterMarker: "PHASE2243_FOURTEEN_TOOL_TARGET_TWO_OK",
    referenceMarkers: [
      "PHASE2150_OCT_TOOL_TARGET_TWO_OK",
      "PHASE2163_NONET_TOOL_TARGET_TWO_OK",
      "PHASE2177_DECA_TOOL_TARGET_TWO_OK",
      "PHASE2192_ELEVEN_TOOL_TARGET_TWO_OK",
      "PHASE2208_TWELVE_TOOL_TARGET_TWO_OK",
      "PHASE2225_THIRTEEN_TOOL_TARGET_TWO_OK",
      "PHASE2243_FOURTEEN_TOOL_TARGET_TWO_OK",
      "PHASE2262_FIFTEEN_TOOL_TARGET_TWO_OK",
    ],
    referenceFields: [
      "phase2150Marker",
      "phase2163Marker",
      "phase2177Marker",
      "phase2192Marker",
      "phase2208Marker",
      "phase2225Marker",
      "phase2243Marker",
      "phase2262Marker",
    ],
    requiredMarkers: [
      "PHASE2094_BATCH_TOOL_TARGET_TWO_OK",
      "PHASE2163_NONET_TOOL_TARGET_TWO_OK",
      "PHASE2177_DECA_TOOL_TARGET_TWO_OK",
      "PHASE2192_ELEVEN_TOOL_TARGET_TWO_OK",
      "PHASE2208_TWELVE_TOOL_TARGET_TWO_OK",
      "PHASE2225_THIRTEEN_TOOL_TARGET_TWO_OK",
      "PHASE2243_FOURTEEN_TOOL_TARGET_TWO_OK",
      "PHASE2262_FIFTEEN_TOOL_TARGET_TWO_OK",
    ],
  },
  {
    idx: 3,
    path: sourceTargetPaths[2],
    addMode: "runtime-plus-export",
    runtimeExport: "buildPhase2100TripleMutationRuntimeStatus",
    runtimeInsertAfterField: "phase2244Marker",
    runtimeInsertAfterMarker: "PHASE2244_FOURTEEN_TOOL_TARGET_THREE_OK",
    referenceMarkers: [
      "PHASE2151_OCT_TOOL_TARGET_THREE_OK",
      "PHASE2164_NONET_TOOL_TARGET_THREE_OK",
      "PHASE2178_DECA_TOOL_TARGET_THREE_OK",
      "PHASE2193_ELEVEN_TOOL_TARGET_THREE_OK",
      "PHASE2209_TWELVE_TOOL_TARGET_THREE_OK",
      "PHASE2226_THIRTEEN_TOOL_TARGET_THREE_OK",
      "PHASE2244_FOURTEEN_TOOL_TARGET_THREE_OK",
      "PHASE2263_FIFTEEN_TOOL_TARGET_THREE_OK",
    ],
    referenceFields: [
      "phase2151Marker",
      "phase2164Marker",
      "phase2178Marker",
      "phase2193Marker",
      "phase2209Marker",
      "phase2226Marker",
      "phase2244Marker",
      "phase2263Marker",
    ],
    requiredMarkers: [
      "PHASE2100_TRIPLE_TOOL_TARGET_THREE_OK",
      "PHASE2164_NONET_TOOL_TARGET_THREE_OK",
      "PHASE2178_DECA_TOOL_TARGET_THREE_OK",
      "PHASE2193_ELEVEN_TOOL_TARGET_THREE_OK",
      "PHASE2209_TWELVE_TOOL_TARGET_THREE_OK",
      "PHASE2226_THIRTEEN_TOOL_TARGET_THREE_OK",
      "PHASE2244_FOURTEEN_TOOL_TARGET_THREE_OK",
      "PHASE2263_FIFTEEN_TOOL_TARGET_THREE_OK",
    ],
  },
  {
    idx: 4,
    path: sourceTargetPaths[3],
    addMode: "runtime-plus-export",
    runtimeExport: "buildPhase2109QuadMutationRuntimeStatus",
    runtimeInsertAfterField: "phase2245Marker",
    runtimeInsertAfterMarker: "PHASE2245_FOURTEEN_TOOL_TARGET_FOUR_OK",
    referenceMarkers: [
      "PHASE2152_OCT_TOOL_TARGET_FOUR_OK",
      "PHASE2165_NONET_TOOL_TARGET_FOUR_OK",
      "PHASE2179_DECA_TOOL_TARGET_FOUR_OK",
      "PHASE2194_ELEVEN_TOOL_TARGET_FOUR_OK",
      "PHASE2210_TWELVE_TOOL_TARGET_FOUR_OK",
      "PHASE2227_THIRTEEN_TOOL_TARGET_FOUR_OK",
      "PHASE2245_FOURTEEN_TOOL_TARGET_FOUR_OK",
      "PHASE2264_FIFTEEN_TOOL_TARGET_FOUR_OK",
    ],
    referenceFields: [
      "phase2152Marker",
      "phase2165Marker",
      "phase2179Marker",
      "phase2194Marker",
      "phase2210Marker",
      "phase2227Marker",
      "phase2245Marker",
      "phase2264Marker",
    ],
    requiredMarkers: [
      "PHASE2109_QUAD_TOOL_TARGET_FOUR_OK",
      "PHASE2165_NONET_TOOL_TARGET_FOUR_OK",
      "PHASE2179_DECA_TOOL_TARGET_FOUR_OK",
      "PHASE2194_ELEVEN_TOOL_TARGET_FOUR_OK",
      "PHASE2210_TWELVE_TOOL_TARGET_FOUR_OK",
      "PHASE2227_THIRTEEN_TOOL_TARGET_FOUR_OK",
      "PHASE2245_FOURTEEN_TOOL_TARGET_FOUR_OK",
      "PHASE2264_FIFTEEN_TOOL_TARGET_FOUR_OK",
    ],
  },
  {
    idx: 5,
    path: sourceTargetPaths[4],
    addMode: "runtime-plus-export",
    runtimeExport: "buildPhase2120QuintMutationRuntimeStatus",
    runtimeInsertAfterField: "phase2246Marker",
    runtimeInsertAfterMarker: "PHASE2246_FOURTEEN_TOOL_TARGET_FIVE_OK",
    referenceMarkers: [
      "PHASE2153_OCT_TOOL_TARGET_FIVE_OK",
      "PHASE2166_NONET_TOOL_TARGET_FIVE_OK",
      "PHASE2180_DECA_TOOL_TARGET_FIVE_OK",
      "PHASE2195_ELEVEN_TOOL_TARGET_FIVE_OK",
      "PHASE2211_TWELVE_TOOL_TARGET_FIVE_OK",
      "PHASE2228_THIRTEEN_TOOL_TARGET_FIVE_OK",
      "PHASE2246_FOURTEEN_TOOL_TARGET_FIVE_OK",
      "PHASE2265_FIFTEEN_TOOL_TARGET_FIVE_OK",
    ],
    referenceFields: [
      "phase2153Marker",
      "phase2166Marker",
      "phase2180Marker",
      "phase2195Marker",
      "phase2211Marker",
      "phase2228Marker",
      "phase2246Marker",
      "phase2265Marker",
    ],
    requiredMarkers: [
      "PHASE2120_QUINT_TOOL_TARGET_FIVE_OK",
      "PHASE2166_NONET_TOOL_TARGET_FIVE_OK",
      "PHASE2180_DECA_TOOL_TARGET_FIVE_OK",
      "PHASE2195_ELEVEN_TOOL_TARGET_FIVE_OK",
      "PHASE2211_TWELVE_TOOL_TARGET_FIVE_OK",
      "PHASE2228_THIRTEEN_TOOL_TARGET_FIVE_OK",
      "PHASE2246_FOURTEEN_TOOL_TARGET_FIVE_OK",
      "PHASE2265_FIFTEEN_TOOL_TARGET_FIVE_OK",
    ],
  },
  {
    idx: 6,
    path: sourceTargetPaths[5],
    addMode: "append-export",
    referenceMarkers: [
      "PHASE2142_SEPT_TOOL_TARGET_SIX_OK",
      "PHASE2154_OCT_TOOL_TARGET_SIX_OK",
      "PHASE2167_NONET_TOOL_TARGET_SIX_OK",
      "PHASE2181_DECA_TOOL_TARGET_SIX_OK",
      "PHASE2196_ELEVEN_TOOL_TARGET_SIX_OK",
      "PHASE2212_TWELVE_TOOL_TARGET_SIX_OK",
      "PHASE2229_THIRTEEN_TOOL_TARGET_SIX_OK",
      "PHASE2247_FOURTEEN_TOOL_TARGET_SIX_OK",
      "PHASE2266_FIFTEEN_TOOL_TARGET_SIX_OK",
    ],
    referenceFields: [
      "phase2142Marker",
      "phase2154Marker",
      "phase2167Marker",
      "phase2181Marker",
      "phase2196Marker",
      "phase2212Marker",
      "phase2229Marker",
      "phase2247Marker",
      "phase2266Marker",
    ],
    requiredMarkers: [
      "PHASE2142_SEPT_TOOL_TARGET_SIX_OK",
      "PHASE2167_NONET_TOOL_TARGET_SIX_OK",
      "PHASE2181_DECA_TOOL_TARGET_SIX_OK",
      "PHASE2196_ELEVEN_TOOL_TARGET_SIX_OK",
      "PHASE2212_TWELVE_TOOL_TARGET_SIX_OK",
      "PHASE2229_THIRTEEN_TOOL_TARGET_SIX_OK",
      "PHASE2247_FOURTEEN_TOOL_TARGET_SIX_OK",
      "PHASE2266_FIFTEEN_TOOL_TARGET_SIX_OK",
    ],
  },
  {
    idx: 7,
    path: sourceTargetPaths[6],
    addMode: "append-export",
    referenceMarkers: [
      "PHASE2143_SEPT_TOOL_TARGET_SEVEN_OK",
      "PHASE2155_OCT_TOOL_TARGET_SEVEN_OK",
      "PHASE2168_NONET_TOOL_TARGET_SEVEN_OK",
      "PHASE2182_DECA_TOOL_TARGET_SEVEN_OK",
      "PHASE2197_ELEVEN_TOOL_TARGET_SEVEN_OK",
      "PHASE2213_TWELVE_TOOL_TARGET_SEVEN_OK",
      "PHASE2230_THIRTEEN_TOOL_TARGET_SEVEN_OK",
      "PHASE2248_FOURTEEN_TOOL_TARGET_SEVEN_OK",
      "PHASE2267_FIFTEEN_TOOL_TARGET_SEVEN_OK",
    ],
    referenceFields: [
      "phase2143Marker",
      "phase2155Marker",
      "phase2168Marker",
      "phase2182Marker",
      "phase2197Marker",
      "phase2213Marker",
      "phase2230Marker",
      "phase2248Marker",
      "phase2267Marker",
    ],
    requiredMarkers: [
      "PHASE2143_SEPT_TOOL_TARGET_SEVEN_OK",
      "PHASE2168_NONET_TOOL_TARGET_SEVEN_OK",
      "PHASE2182_DECA_TOOL_TARGET_SEVEN_OK",
      "PHASE2197_ELEVEN_TOOL_TARGET_SEVEN_OK",
      "PHASE2213_TWELVE_TOOL_TARGET_SEVEN_OK",
      "PHASE2230_THIRTEEN_TOOL_TARGET_SEVEN_OK",
      "PHASE2248_FOURTEEN_TOOL_TARGET_SEVEN_OK",
      "PHASE2267_FIFTEEN_TOOL_TARGET_SEVEN_OK",
    ],
  },
  {
    idx: 8,
    path: sourceTargetPaths[7],
    addMode: "append-export",
    referenceMarkers: [
      "PHASE2143_SEPT_TOOL_TARGET_SEVEN_OK",
      "PHASE2156_OCT_TOOL_TARGET_EIGHT_OK",
      "PHASE2169_NONET_TOOL_TARGET_EIGHT_OK",
      "PHASE2183_DECA_TOOL_TARGET_EIGHT_OK",
      "PHASE2198_ELEVEN_TOOL_TARGET_EIGHT_OK",
      "PHASE2214_TWELVE_TOOL_TARGET_EIGHT_OK",
      "PHASE2231_THIRTEEN_TOOL_TARGET_EIGHT_OK",
      "PHASE2249_FOURTEEN_TOOL_TARGET_EIGHT_OK",
      "PHASE2268_FIFTEEN_TOOL_TARGET_EIGHT_OK",
    ],
    referenceFields: [
      "phase2143Marker",
      "phase2156Marker",
      "phase2169Marker",
      "phase2183Marker",
      "phase2198Marker",
      "phase2214Marker",
      "phase2231Marker",
      "phase2249Marker",
      "phase2268Marker",
    ],
    requiredMarkers: [
      "PHASE2156_OCT_TOOL_TARGET_EIGHT_OK",
      "PHASE2169_NONET_TOOL_TARGET_EIGHT_OK",
      "PHASE2183_DECA_TOOL_TARGET_EIGHT_OK",
      "PHASE2198_ELEVEN_TOOL_TARGET_EIGHT_OK",
      "PHASE2214_TWELVE_TOOL_TARGET_EIGHT_OK",
      "PHASE2231_THIRTEEN_TOOL_TARGET_EIGHT_OK",
      "PHASE2249_FOURTEEN_TOOL_TARGET_EIGHT_OK",
      "PHASE2268_FIFTEEN_TOOL_TARGET_EIGHT_OK",
    ],
  },
  {
    idx: 9,
    path: sourceTargetPaths[8],
    addMode: "append-export",
    referenceMarkers: [
      "PHASE2156_OCT_TOOL_TARGET_EIGHT_OK",
      "PHASE2170_NONET_TOOL_TARGET_NINE_OK",
      "PHASE2184_DECA_TOOL_TARGET_NINE_OK",
      "PHASE2199_ELEVEN_TOOL_TARGET_NINE_OK",
      "PHASE2215_TWELVE_TOOL_TARGET_NINE_OK",
      "PHASE2232_THIRTEEN_TOOL_TARGET_NINE_OK",
      "PHASE2250_FOURTEEN_TOOL_TARGET_NINE_OK",
      "PHASE2269_FIFTEEN_TOOL_TARGET_NINE_OK",
    ],
    referenceFields: [
      "phase2156Marker",
      "phase2170Marker",
      "phase2184Marker",
      "phase2199Marker",
      "phase2215Marker",
      "phase2232Marker",
      "phase2250Marker",
      "phase2269Marker",
    ],
    requiredMarkers: [
      "PHASE2156_OCT_TOOL_TARGET_EIGHT_OK",
      "PHASE2170_NONET_TOOL_TARGET_NINE_OK",
      "PHASE2184_DECA_TOOL_TARGET_NINE_OK",
      "PHASE2199_ELEVEN_TOOL_TARGET_NINE_OK",
      "PHASE2215_TWELVE_TOOL_TARGET_NINE_OK",
      "PHASE2232_THIRTEEN_TOOL_TARGET_NINE_OK",
      "PHASE2250_FOURTEEN_TOOL_TARGET_NINE_OK",
      "PHASE2269_FIFTEEN_TOOL_TARGET_NINE_OK",
    ],
  },
  {
    idx: 10,
    path: sourceTargetPaths[9],
    addMode: "append-export",
    referenceMarkers: [
      "PHASE2170_NONET_TOOL_TARGET_NINE_OK",
      "PHASE2185_DECA_TOOL_TARGET_TEN_OK",
      "PHASE2200_ELEVEN_TOOL_TARGET_TEN_OK",
      "PHASE2216_TWELVE_TOOL_TARGET_TEN_OK",
      "PHASE2233_THIRTEEN_TOOL_TARGET_TEN_OK",
      "PHASE2251_FOURTEEN_TOOL_TARGET_TEN_OK",
      "PHASE2270_FIFTEEN_TOOL_TARGET_TEN_OK",
    ],
    referenceFields: [
      "phase2170Marker",
      "phase2185Marker",
      "phase2200Marker",
      "phase2216Marker",
      "phase2233Marker",
      "phase2251Marker",
      "phase2270Marker",
    ],
    requiredMarkers: [
      "PHASE2170_NONET_TOOL_TARGET_NINE_OK",
      "PHASE2185_DECA_TOOL_TARGET_TEN_OK",
      "PHASE2200_ELEVEN_TOOL_TARGET_TEN_OK",
      "PHASE2216_TWELVE_TOOL_TARGET_TEN_OK",
      "PHASE2233_THIRTEEN_TOOL_TARGET_TEN_OK",
      "PHASE2251_FOURTEEN_TOOL_TARGET_TEN_OK",
      "PHASE2270_FIFTEEN_TOOL_TARGET_TEN_OK",
    ],
  },
  {
    idx: 11,
    path: sourceTargetPaths[10],
    addMode: "append-export",
    referenceMarkers: [
      "PHASE2170_NONET_TOOL_TARGET_NINE_OK",
      "PHASE2185_DECA_TOOL_TARGET_TEN_OK",
      "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK",
      "PHASE2217_TWELVE_TOOL_TARGET_ELEVEN_OK",
      "PHASE2234_THIRTEEN_TOOL_TARGET_ELEVEN_OK",
      "PHASE2252_FOURTEEN_TOOL_TARGET_ELEVEN_OK",
      "PHASE2271_FIFTEEN_TOOL_TARGET_ELEVEN_OK",
    ],
    referenceFields: [
      "phase2170Marker",
      "phase2185Marker",
      "phase2201Marker",
      "phase2217Marker",
      "phase2234Marker",
      "phase2252Marker",
      "phase2271Marker",
    ],
    requiredMarkers: [
      "PHASE2185_DECA_TOOL_TARGET_TEN_OK",
      "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK",
      "PHASE2217_TWELVE_TOOL_TARGET_ELEVEN_OK",
      "PHASE2234_THIRTEEN_TOOL_TARGET_ELEVEN_OK",
      "PHASE2252_FOURTEEN_TOOL_TARGET_ELEVEN_OK",
      "PHASE2271_FIFTEEN_TOOL_TARGET_ELEVEN_OK",
    ],
  },
  {
    idx: 12,
    path: sourceTargetPaths[11],
    addMode: "append-export",
    referenceMarkers: [
      "PHASE2170_NONET_TOOL_TARGET_NINE_OK",
      "PHASE2185_DECA_TOOL_TARGET_TEN_OK",
      "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK",
      "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK",
      "PHASE2235_THIRTEEN_TOOL_TARGET_TWELVE_OK",
      "PHASE2253_FOURTEEN_TOOL_TARGET_TWELVE_OK",
      "PHASE2272_FIFTEEN_TOOL_TARGET_TWELVE_OK",
    ],
    referenceFields: [
      "phase2170Marker",
      "phase2185Marker",
      "phase2201Marker",
      "phase2218Marker",
      "phase2235Marker",
      "phase2253Marker",
      "phase2272Marker",
    ],
    requiredMarkers: [
      "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK",
      "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK",
      "PHASE2235_THIRTEEN_TOOL_TARGET_TWELVE_OK",
      "PHASE2253_FOURTEEN_TOOL_TARGET_TWELVE_OK",
      "PHASE2272_FIFTEEN_TOOL_TARGET_TWELVE_OK",
    ],
  },
  {
    idx: 13,
    path: sourceTargetPaths[12],
    addMode: "append-export",
    referenceMarkers: [
      "PHASE2170_NONET_TOOL_TARGET_NINE_OK",
      "PHASE2185_DECA_TOOL_TARGET_TEN_OK",
      "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK",
      "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK",
      "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK",
      "PHASE2254_FOURTEEN_TOOL_TARGET_THIRTEEN_OK",
      "PHASE2273_FIFTEEN_TOOL_TARGET_THIRTEEN_OK",
    ],
    referenceFields: [
      "phase2170Marker",
      "phase2185Marker",
      "phase2201Marker",
      "phase2218Marker",
      "phase2236Marker",
      "phase2254Marker",
      "phase2273Marker",
    ],
    requiredMarkers: [
      "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK",
      "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK",
      "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK",
      "PHASE2254_FOURTEEN_TOOL_TARGET_THIRTEEN_OK",
      "PHASE2273_FIFTEEN_TOOL_TARGET_THIRTEEN_OK",
    ],
  },
  {
    idx: 14,
    path: sourceTargetPaths[13],
    addMode: "append-export",
    referenceMarkers: [
      "PHASE2170_NONET_TOOL_TARGET_NINE_OK",
      "PHASE2185_DECA_TOOL_TARGET_TEN_OK",
      "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK",
      "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK",
      "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK",
      "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK",
      "PHASE2274_FIFTEEN_TOOL_TARGET_FOURTEEN_OK",
    ],
    referenceFields: [
      "phase2170Marker",
      "phase2185Marker",
      "phase2201Marker",
      "phase2218Marker",
      "phase2236Marker",
      "phase2255Marker",
      "phase2274Marker",
    ],
    requiredMarkers: [
      "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK",
      "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK",
      "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK",
      "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK",
      "PHASE2274_FIFTEEN_TOOL_TARGET_FOURTEEN_OK",
    ],
  },
  {
    idx: 15,
    path: sourceTargetPaths[14],
    addMode: "append-export",
    referenceMarkers: [
      "PHASE2170_NONET_TOOL_TARGET_NINE_OK",
      "PHASE2185_DECA_TOOL_TARGET_TEN_OK",
      "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK",
      "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK",
      "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK",
      "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK",
      "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK",
    ],
    referenceFields: [
      "phase2170Marker",
      "phase2185Marker",
      "phase2201Marker",
      "phase2218Marker",
      "phase2236Marker",
      "phase2255Marker",
      "phase2275Marker",
    ],
    requiredMarkers: [
      "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK",
      "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK",
      "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK",
      "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK",
      "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK",
    ],
  },
  {
    idx: 16,
    path: sourceTargetPaths[15],
    addMode: "append-export",
    runnerReady: true,
    referenceMarkers: [
      "PHASE2170_NONET_TOOL_TARGET_NINE_OK",
      "PHASE2185_DECA_TOOL_TARGET_TEN_OK",
      "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK",
      "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK",
      "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK",
      "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK",
      "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK",
    ],
    referenceFields: [
      "phase2170Marker",
      "phase2185Marker",
      "phase2201Marker",
      "phase2218Marker",
      "phase2236Marker",
      "phase2255Marker",
      "phase2275Marker",
    ],
    requiredMarkers: [
      "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK",
      "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK",
      "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK",
      "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK",
      "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK",
    ],
  },
];

function buildTarget(baseTarget) {
  const phase = 2280 + baseTarget.idx;
  const word = wordNames[baseTarget.idx - 1];
  const titleWord = titleWords[baseTarget.idx - 1];
  const targetName = `target-${word}`;
  const proposal = `docs/phase${phase}-sixteen-tool-mutation-target-${word}.proposal.diff`;
  const marker = `PHASE${phase}_SIXTEEN_TOOL_TARGET_${titleWord.toUpperCase()}_OK`;
  const newExport =
    baseTarget.idx === 16
      ? "buildPhase2296SixteenMutationRuntimeStatus"
      : `buildPhase${phase}SixteenMutationTarget${titleWord}Status`;
  const newPhaseId =
    baseTarget.idx === 16
      ? "Phase2296A-Controlled-Sixteen-Tool-Mutation-Target-Sixteen"
      : `Phase${phase}A-Controlled-Sixteen-Tool-Mutation-Target-${titleWord}`;

  const target = {
    idx: baseTarget.idx,
    phase,
    word,
    targetName,
    path: baseTarget.path,
    proposal,
    addMode: baseTarget.addMode,
    newExport,
    newPhaseId,
    marker,
    referenceMarkers: [...baseTarget.referenceMarkers],
    referenceFields: [...baseTarget.referenceFields],
    requiredExports: [`export function ${newExport}`],
    requiredMarkers: [...baseTarget.requiredMarkers, marker],
    runnerReady: Boolean(baseTarget.runnerReady),
  };

  if (baseTarget.addMode === "phase2091-main") {
    target.mainProperty = baseTarget.mainProperty;
    target.runtimeBaseProperty = baseTarget.runtimeBaseProperty;
    target.runtimeBaseExport = baseTarget.runtimeBaseExport;
  }

  if (baseTarget.addMode === "runtime-plus-export") {
    target.runtimeExport = baseTarget.runtimeExport;
    target.runtimeMarkerField = `phase${phase}Marker`;
    target.runtimeInsertAfterField = baseTarget.runtimeInsertAfterField;
    target.runtimeInsertAfterMarker = baseTarget.runtimeInsertAfterMarker;
  }

  if (baseTarget.idx !== 1) {
    target.requiredExports.push("export function main");
  }

  return target;
}

const sixteenTargets = baseTargets.map(buildTarget);
const seventeenTargets = buildSeventeenTargets(sixteenTargets);
const eighteenTargets = buildEighteenTargets(seventeenTargets);
const nineteenTargets = buildNineteenTargets(eighteenTargets);
const twentyTargets = buildTwentyTargets(nineteenTargets);
const twentyOneTargets = buildTwentyOneTargets(twentyTargets);
const twentyTwoTargets = buildTwentyTwoTargets(twentyOneTargets);
const twentyThreeTargets = buildTwentyThreeTargets(twentyTwoTargets);
const twentyFourTargets = buildTwentyFourTargets(twentyThreeTargets);
const twentyFiveTargets = buildTwentyFiveTargets(twentyFourTargets);
const twentySixTargets = buildTwentySixTargets(twentyFiveTargets);
const twentySevenTargets = buildTwentySevenTargets(twentySixTargets);
const twentyEightTargets = buildTwentyEightTargets(twentySevenTargets);
const twentyNineTargets = buildTwentyNineTargets(twentyEightTargets);
const targets = buildThirtyTargets(twentyNineTargets);

function buildSeventeenTargets(previousTargets) {
  const upgraded = previousTargets.map((target) => {
    const idx = target.idx;
    const phase = 2301 + idx;
    const titleWord = titleWords[idx - 1];
    const word = wordNames[idx - 1];
    const marker = `PHASE${phase}_SEVENTEEN_TOOL_TARGET_${titleWord.toUpperCase()}_OK`;
    const previousMarkerField = `phase${target.phase}Marker`;
    const next = {
      ...target,
      phase,
      word,
      targetName: `target-${word}`,
      proposal: `docs/phase${phase}-seventeen-tool-mutation-target-${word}.proposal.diff`,
      newExport:
        idx === 17
          ? "buildPhase2318SeventeenMutationRuntimeStatus"
          : `buildPhase${phase}SeventeenMutationTarget${titleWord}Status`,
      newPhaseId:
        idx === 17
          ? "Phase2318A-Controlled-Seventeen-Tool-Mutation-Target-Seventeen"
          : `Phase${phase}A-Controlled-Seventeen-Tool-Mutation-Target-${titleWord}`,
      marker,
      referenceMarkers: [...target.referenceMarkers, target.marker],
      referenceFields: [...target.referenceFields, previousMarkerField],
      requiredExports:
        idx === 1
          ? [`export function ${idx === 17 ? "buildPhase2318SeventeenMutationRuntimeStatus" : `buildPhase${phase}SeventeenMutationTarget${titleWord}Status`}`]
          : [
              `export function ${idx === 17 ? "buildPhase2318SeventeenMutationRuntimeStatus" : `buildPhase${phase}SeventeenMutationTarget${titleWord}Status`}`,
              "export function main",
            ],
      requiredMarkers: [...new Set([...target.requiredMarkers, target.marker, marker])],
      runnerReady: false,
    };

    if (next.addMode === "phase2091-main") {
      next.mainProperty = `phase${phase}`;
      next.runtimeBaseProperty = `phase${target.phase}`;
      next.runtimeBaseExport = target.newExport;
    }

    if (next.addMode === "runtime-plus-export") {
      next.runtimeInsertAfterField = `phase${target.phase}Marker`;
      next.runtimeInsertAfterMarker = target.marker;
      next.runtimeMarkerField = `phase${phase}Marker`;
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
    referenceFields: [...previousRuntimeTarget.referenceFields, `phase${previousRuntimeTarget.phase}Marker`],
    requiredExports: ["export function buildPhase2318SeventeenMutationRuntimeStatus", "export function main"],
    requiredMarkers: [...new Set([...previousRuntimeTarget.requiredMarkers, previousRuntimeTarget.marker, seventeenthMarker])],
    runnerReady: true,
  });

  return upgraded;
}

function buildEighteenTargets(previousTargets) {
  const upgraded = previousTargets.map((target) => {
    const idx = target.idx;
    const phase = 2323 + idx;
    const titleWord = titleWords[idx - 1];
    const word = wordNames[idx - 1];
    const marker = `PHASE${phase}_EIGHTEEN_TOOL_TARGET_${titleWord.toUpperCase()}_OK`;
    const previousMarkerField = `phase${target.phase}Marker`;
    const next = {
      ...target,
      phase,
      word,
      targetName: `target-${word}`,
      proposal: `docs/phase${phase}-eighteen-tool-mutation-target-${word}.proposal.diff`,
      newExport:
        idx === 18
          ? "buildPhase2341EighteenMutationRuntimeStatus"
          : `buildPhase${phase}EighteenMutationTarget${titleWord}Status`,
      newPhaseId:
        idx === 18
          ? "Phase2341A-Controlled-Eighteen-Tool-Mutation-Target-Eighteen"
          : `Phase${phase}A-Controlled-Eighteen-Tool-Mutation-Target-${titleWord}`,
      marker,
      referenceMarkers: [...target.referenceMarkers, target.marker],
      referenceFields: [...target.referenceFields, previousMarkerField],
      requiredExports:
        idx === 1
          ? [`export function ${idx === 18 ? "buildPhase2341EighteenMutationRuntimeStatus" : `buildPhase${phase}EighteenMutationTarget${titleWord}Status`}`]
          : [
              `export function ${idx === 18 ? "buildPhase2341EighteenMutationRuntimeStatus" : `buildPhase${phase}EighteenMutationTarget${titleWord}Status`}`,
              "export function main",
            ],
      requiredMarkers: [...new Set([...target.requiredMarkers, target.marker, marker])],
      runnerReady: false,
    };

    if (next.addMode === "phase2091-main") {
      next.mainProperty = `phase${phase}`;
      next.runtimeBaseProperty = `phase${target.phase}`;
      next.runtimeBaseExport = target.newExport;
    }

    if (next.addMode === "runtime-plus-export") {
      next.runtimeInsertAfterField = `phase${target.phase}Marker`;
      next.runtimeInsertAfterMarker = target.marker;
      next.runtimeMarkerField = `phase${phase}Marker`;
    }

    return next;
  });

  const previousRuntimeTarget = previousTargets[16];
  const eighteenthPhase = 2341;
  const eighteenthMarker = "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK";
  upgraded.push({
    idx: 18,
    phase: eighteenthPhase,
    word: "eighteen",
    targetName: "target-eighteen",
    path: sourceTargetPaths[17],
    proposal: "docs/phase2341-eighteen-tool-mutation-target-eighteen.proposal.diff",
    addMode: "append-export",
    newExport: "buildPhase2341EighteenMutationRuntimeStatus",
    newPhaseId: "Phase2341A-Controlled-Eighteen-Tool-Mutation-Target-Eighteen",
    marker: eighteenthMarker,
    referenceMarkers: [...previousRuntimeTarget.referenceMarkers, previousRuntimeTarget.marker],
    referenceFields: [...previousRuntimeTarget.referenceFields, `phase${previousRuntimeTarget.phase}Marker`],
    requiredExports: ["export function buildPhase2341EighteenMutationRuntimeStatus", "export function main"],
    requiredMarkers: [...new Set([...previousRuntimeTarget.requiredMarkers, previousRuntimeTarget.marker, eighteenthMarker])],
    runnerReady: true,
  });

  return upgraded;
}

function buildNineteenTargets(previousTargets) {
  const upgraded = previousTargets.map((target) => {
    const idx = target.idx;
    const phase = 2346 + idx;
    const titleWord = titleWords[idx - 1];
    const word = wordNames[idx - 1];
    const marker = `PHASE${phase}_NINETEEN_TOOL_TARGET_${titleWord.toUpperCase()}_OK`;
    const previousMarkerField = `phase${target.phase}Marker`;
    const next = {
      ...target,
      phase,
      word,
      targetName: `target-${word}`,
      proposal: `docs/phase${phase}-nineteen-tool-mutation-target-${word}.proposal.diff`,
      newExport:
        idx === 19
          ? "buildPhase2365NineteenMutationRuntimeStatus"
          : `buildPhase${phase}NineteenMutationTarget${titleWord}Status`,
      newPhaseId:
        idx === 19
          ? "Phase2365A-Controlled-Nineteen-Tool-Mutation-Target-Nineteen"
          : `Phase${phase}A-Controlled-Nineteen-Tool-Mutation-Target-${titleWord}`,
      marker,
      referenceMarkers: [...target.referenceMarkers, target.marker],
      referenceFields: [...target.referenceFields, previousMarkerField],
      requiredExports:
        idx === 1
          ? [`export function ${idx === 19 ? "buildPhase2365NineteenMutationRuntimeStatus" : `buildPhase${phase}NineteenMutationTarget${titleWord}Status`}`]
          : [
              `export function ${idx === 19 ? "buildPhase2365NineteenMutationRuntimeStatus" : `buildPhase${phase}NineteenMutationTarget${titleWord}Status`}`,
              "export function main",
            ],
      requiredMarkers: [...new Set([...target.requiredMarkers, target.marker, marker])],
      runnerReady: false,
    };

    if (next.addMode === "phase2091-main") {
      next.mainProperty = `phase${phase}`;
      next.runtimeBaseProperty = `phase${target.phase}`;
      next.runtimeBaseExport = target.newExport;
    }

    if (next.addMode === "runtime-plus-export") {
      next.runtimeInsertAfterField = `phase${target.phase}Marker`;
      next.runtimeInsertAfterMarker = target.marker;
      next.runtimeMarkerField = `phase${phase}Marker`;
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
    referenceFields: [...previousRuntimeTarget.referenceFields, `phase${previousRuntimeTarget.phase}Marker`],
    requiredExports: ["export function buildPhase2365NineteenMutationRuntimeStatus", "export function main"],
    requiredMarkers: [...new Set([...previousRuntimeTarget.requiredMarkers, previousRuntimeTarget.marker, nineteenthMarker])],
    runnerReady: true,
  });

  return upgraded;
}

function buildTwentyTargets(previousTargets) {
  const upgraded = previousTargets.map((target) => {
    const idx = target.idx;
    const phase = 2370 + idx;
    const titleWord = titleWords[idx - 1];
    const word = wordNames[idx - 1];
    const marker = `PHASE${phase}_TWENTY_TOOL_TARGET_${titleWord.toUpperCase()}_OK`;
    const previousMarkerField = `phase${target.phase}Marker`;
    const next = {
      ...target,
      phase,
      word,
      targetName: `target-${word}`,
      proposal: `docs/phase${phase}-twenty-tool-mutation-target-${word}.proposal.diff`,
      newExport:
        idx === 20
          ? "buildPhase2390TwentyMutationRuntimeStatus"
          : `buildPhase${phase}TwentyMutationTarget${titleWord}Status`,
      newPhaseId:
        idx === 20
          ? "Phase2390A-Controlled-Twenty-Tool-Mutation-Target-Twenty"
          : `Phase${phase}A-Controlled-Twenty-Tool-Mutation-Target-${titleWord}`,
      marker,
      referenceMarkers: [...target.referenceMarkers, target.marker],
      referenceFields: [...target.referenceFields, previousMarkerField],
      requiredExports:
        idx === 1
          ? [`export function ${idx === 20 ? "buildPhase2390TwentyMutationRuntimeStatus" : `buildPhase${phase}TwentyMutationTarget${titleWord}Status`}`]
          : [
              `export function ${idx === 20 ? "buildPhase2390TwentyMutationRuntimeStatus" : `buildPhase${phase}TwentyMutationTarget${titleWord}Status`}`,
              "export function main",
            ],
      requiredMarkers: [...new Set([...target.requiredMarkers, target.marker, marker])],
      runnerReady: false,
    };

    if (next.addMode === "phase2091-main") {
      next.mainProperty = `phase${phase}`;
      next.runtimeBaseProperty = `phase${target.phase}`;
      next.runtimeBaseExport = target.newExport;
    }

    if (next.addMode === "runtime-plus-export") {
      next.runtimeInsertAfterField = `phase${target.phase}Marker`;
      next.runtimeInsertAfterMarker = target.marker;
      next.runtimeMarkerField = `phase${phase}Marker`;
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
    referenceFields: [...previousRuntimeTarget.referenceFields, `phase${previousRuntimeTarget.phase}Marker`],
    requiredExports: ["export function buildPhase2390TwentyMutationRuntimeStatus", "export function main"],
    requiredMarkers: [...new Set([...previousRuntimeTarget.requiredMarkers, previousRuntimeTarget.marker, twentiethMarker])],
    runnerReady: true,
  });

  return upgraded;
}

function buildTwentyOneTargets(previousTargets) {
  const upgraded = previousTargets.map((target) => {
    const idx = target.idx;
    const phase = 2395 + idx;
    const titleWord = titleWords[idx - 1];
    const word = wordNames[idx - 1];
    const marker = `PHASE${phase}_TWENTY_ONE_TOOL_TARGET_${word.replace(/-/g, "_").toUpperCase()}_OK`;
    const previousMarkerField = `phase${target.phase}Marker`;
    const next = {
      ...target,
      phase,
      word,
      targetName: `target-${word}`,
      proposal: `docs/phase${phase}-twenty-one-tool-mutation-target-${word}.proposal.diff`,
      newExport:
        idx === 21
          ? "buildPhase2416TwentyOneMutationRuntimeStatus"
          : `buildPhase${phase}TwentyOneMutationTarget${titleWord}Status`,
      newPhaseId:
        idx === 21
          ? "Phase2416A-Controlled-Twenty-One-Tool-Mutation-Target-Twenty-One"
          : `Phase${phase}A-Controlled-Twenty-One-Tool-Mutation-Target-${word.replace(/(^|-)([a-z])/g, (_, prefix, char) => `${prefix === "-" ? "-" : ""}${char.toUpperCase()}`)}`,
      marker,
      referenceMarkers: [...target.referenceMarkers, target.marker],
      referenceFields: [...target.referenceFields, previousMarkerField],
      requiredExports:
        idx === 1
          ? [`export function ${idx === 21 ? "buildPhase2416TwentyOneMutationRuntimeStatus" : `buildPhase${phase}TwentyOneMutationTarget${titleWord}Status`}`]
          : [
              `export function ${idx === 21 ? "buildPhase2416TwentyOneMutationRuntimeStatus" : `buildPhase${phase}TwentyOneMutationTarget${titleWord}Status`}`,
              "export function main",
            ],
      requiredMarkers: [...new Set([...target.requiredMarkers, target.marker, marker])],
      runnerReady: false,
    };

    if (next.addMode === "phase2091-main") {
      next.mainProperty = `phase${phase}`;
      next.runtimeBaseProperty = `phase${target.phase}`;
      next.runtimeBaseExport = target.newExport;
    }

    if (next.addMode === "runtime-plus-export") {
      next.runtimeInsertAfterField = `phase${target.phase}Marker`;
      next.runtimeInsertAfterMarker = target.marker;
      next.runtimeMarkerField = `phase${phase}Marker`;
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
    referenceFields: [...previousRuntimeTarget.referenceFields, `phase${previousRuntimeTarget.phase}Marker`],
    requiredExports: ["export function buildPhase2416TwentyOneMutationRuntimeStatus", "export function main"],
    requiredMarkers: [...new Set([...previousRuntimeTarget.requiredMarkers, previousRuntimeTarget.marker, twentyOneMarker])],
    runnerReady: true,
  });

  return upgraded;
}

function buildTwentyTwoTargets(previousTargets) {
  const upgraded = previousTargets.map((target) => {
    const idx = target.idx;
    const phase = 2421 + idx;
    const titleWord = titleWords[idx - 1];
    const word = wordNames[idx - 1];
    const marker = `PHASE${phase}_TWENTY_TWO_TOOL_TARGET_${word.replace(/-/g, "_").toUpperCase()}_OK`;
    const previousMarkerField = `phase${target.phase}Marker`;
    const next = {
      ...target,
      phase,
      word,
      targetName: `target-${word}`,
      proposal: `docs/phase${phase}-twenty-two-tool-mutation-target-${word}.proposal.diff`,
      newExport:
        idx === 22
          ? "buildPhase2443TwentyTwoMutationRuntimeStatus"
          : `buildPhase${phase}TwentyTwoMutationTarget${titleWord}Status`,
      newPhaseId:
        idx === 22
          ? "Phase2443A-Controlled-Twenty-Two-Tool-Mutation-Target-Twenty-Two"
          : `Phase${phase}A-Controlled-Twenty-Two-Tool-Mutation-Target-${word.replace(/(^|-)([a-z])/g, (_, prefix, char) => `${prefix === "-" ? "-" : ""}${char.toUpperCase()}`)}`,
      marker,
      referenceMarkers: [...target.referenceMarkers, target.marker],
      referenceFields: [...target.referenceFields, previousMarkerField],
      requiredExports:
        idx === 1
          ? [`export function ${idx === 22 ? "buildPhase2443TwentyTwoMutationRuntimeStatus" : `buildPhase${phase}TwentyTwoMutationTarget${titleWord}Status`}`]
          : [
              `export function ${idx === 22 ? "buildPhase2443TwentyTwoMutationRuntimeStatus" : `buildPhase${phase}TwentyTwoMutationTarget${titleWord}Status`}`,
              "export function main",
            ],
      requiredMarkers: [...new Set([...target.requiredMarkers, target.marker, marker])],
      runnerReady: false,
    };

    if (next.addMode === "phase2091-main") {
      next.mainProperty = `phase${phase}`;
      next.runtimeBaseProperty = `phase${target.phase}`;
      next.runtimeBaseExport = target.newExport;
    }

    if (next.addMode === "runtime-plus-export") {
      next.runtimeInsertAfterField = `phase${target.phase}Marker`;
      next.runtimeInsertAfterMarker = target.marker;
      next.runtimeMarkerField = `phase${phase}Marker`;
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
    referenceFields: [...previousRuntimeTarget.referenceFields, `phase${previousRuntimeTarget.phase}Marker`],
    requiredExports: ["export function buildPhase2443TwentyTwoMutationRuntimeStatus", "export function main"],
    requiredMarkers: [...new Set([...previousRuntimeTarget.requiredMarkers, previousRuntimeTarget.marker, twentyTwoMarker])],
    runnerReady: true,
  });

  return upgraded;
}

function buildTwentyThreeTargets(previousTargets) {
  const upgraded = previousTargets.map((target) => {
    const idx = target.idx;
    const phase = 2448 + idx;
    const titleWord = titleWords[idx - 1];
    const word = wordNames[idx - 1];
    const marker = `PHASE${phase}_TWENTY_THREE_TOOL_TARGET_${word.replace(/-/g, "_").toUpperCase()}_OK`;
    const previousMarkerField = `phase${target.phase}Marker`;
    const next = {
      ...target,
      phase,
      word,
      targetName: `target-${word}`,
      proposal: `docs/phase${phase}-twenty-three-tool-mutation-target-${word}.proposal.diff`,
      newExport:
        idx === 23
          ? "buildPhase2471TwentyThreeMutationRuntimeStatus"
          : `buildPhase${phase}TwentyThreeMutationTarget${titleWord}Status`,
      newPhaseId:
        idx === 23
          ? "Phase2471A-Controlled-Twenty-Three-Tool-Mutation-Target-Twenty-Three"
          : `Phase${phase}A-Controlled-Twenty-Three-Tool-Mutation-Target-${word.replace(/(^|-)([a-z])/g, (_, prefix, char) => `${prefix === "-" ? "-" : ""}${char.toUpperCase()}`)}`,
      marker,
      referenceMarkers: [...target.referenceMarkers, target.marker],
      referenceFields: [...target.referenceFields, previousMarkerField],
      requiredExports:
        idx === 1
          ? [`export function ${idx === 23 ? "buildPhase2471TwentyThreeMutationRuntimeStatus" : `buildPhase${phase}TwentyThreeMutationTarget${titleWord}Status`}`]
          : [
              `export function ${idx === 23 ? "buildPhase2471TwentyThreeMutationRuntimeStatus" : `buildPhase${phase}TwentyThreeMutationTarget${titleWord}Status`}`,
              "export function main",
            ],
      requiredMarkers: [...new Set([...target.requiredMarkers, target.marker, marker])],
      runnerReady: false,
    };

    if (next.addMode === "phase2091-main") {
      next.mainProperty = `phase${phase}`;
      next.runtimeBaseProperty = `phase${target.phase}`;
      next.runtimeBaseExport = target.newExport;
    }

    if (next.addMode === "runtime-plus-export") {
      next.runtimeInsertAfterField = `phase${target.phase}Marker`;
      next.runtimeInsertAfterMarker = target.marker;
      next.runtimeMarkerField = `phase${phase}Marker`;
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
    referenceFields: [...previousRuntimeTarget.referenceFields, `phase${previousRuntimeTarget.phase}Marker`],
    requiredExports: ["export function buildPhase2471TwentyThreeMutationRuntimeStatus", "export function main"],
    requiredMarkers: [...new Set([...previousRuntimeTarget.requiredMarkers, previousRuntimeTarget.marker, twentyThreeMarker])],
    runnerReady: true,
  });

  return upgraded;
}

function buildTwentyFourTargets(previousTargets) {
  const upgraded = previousTargets.map((target) => {
    const idx = target.idx;
    const phase = 2476 + idx;
    const titleWord = titleWords[idx - 1];
    const word = wordNames[idx - 1];
    const marker = `PHASE${phase}_TWENTY_FOUR_TOOL_TARGET_${word.replace(/-/g, "_").toUpperCase()}_OK`;
    const previousMarkerField = `phase${target.phase}Marker`;
    const next = {
      ...target,
      phase,
      word,
      targetName: `target-${word}`,
      proposal: `docs/phase${phase}-twenty-four-tool-mutation-target-${word}.proposal.diff`,
      newExport:
        idx === 24
          ? "buildPhase2500TwentyFourMutationRuntimeStatus"
          : `buildPhase${phase}TwentyFourMutationTarget${titleWord}Status`,
      newPhaseId:
        idx === 24
          ? "Phase2500A-Controlled-Twenty-Four-Tool-Mutation-Target-Twenty-Four"
          : `Phase${phase}A-Controlled-Twenty-Four-Tool-Mutation-Target-${word.replace(/(^|-)([a-z])/g, (_, prefix, char) => `${prefix === "-" ? "-" : ""}${char.toUpperCase()}`)}`,
      marker,
      referenceMarkers: [...target.referenceMarkers, target.marker],
      referenceFields: [...target.referenceFields, previousMarkerField],
      requiredExports:
        idx === 1
          ? [`export function ${idx === 24 ? "buildPhase2500TwentyFourMutationRuntimeStatus" : `buildPhase${phase}TwentyFourMutationTarget${titleWord}Status`}`]
          : [
              `export function ${idx === 24 ? "buildPhase2500TwentyFourMutationRuntimeStatus" : `buildPhase${phase}TwentyFourMutationTarget${titleWord}Status`}`,
              "export function main",
            ],
      requiredMarkers: [...new Set([...target.requiredMarkers, target.marker, marker])],
      runnerReady: false,
    };

    if (next.addMode === "phase2091-main") {
      next.mainProperty = `phase${phase}`;
      next.runtimeBaseProperty = `phase${target.phase}`;
      next.runtimeBaseExport = target.newExport;
    }

    if (next.addMode === "runtime-plus-export") {
      next.runtimeInsertAfterField = `phase${target.phase}Marker`;
      next.runtimeInsertAfterMarker = target.marker;
      next.runtimeMarkerField = `phase${phase}Marker`;
    }

    return next;
  });

  const previousRuntimeTarget = previousTargets[22];
  const twentyFourPhase = 2500;
  const twentyFourMarker = "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK";
  upgraded.push({
    idx: 24,
    phase: twentyFourPhase,
    word: "twenty-four",
    targetName: "target-twenty-four",
    path: sourceTargetPaths[23],
    proposal: "docs/phase2500-twenty-four-tool-mutation-target-twenty-four.proposal.diff",
    addMode: "append-export",
    newExport: "buildPhase2500TwentyFourMutationRuntimeStatus",
    newPhaseId: "Phase2500A-Controlled-Twenty-Four-Tool-Mutation-Target-Twenty-Four",
    marker: twentyFourMarker,
    referenceMarkers: [...previousRuntimeTarget.referenceMarkers, previousRuntimeTarget.marker],
    referenceFields: [...previousRuntimeTarget.referenceFields, `phase${previousRuntimeTarget.phase}Marker`],
    requiredExports: ["export function buildPhase2500TwentyFourMutationRuntimeStatus", "export function main"],
    requiredMarkers: [...new Set([...previousRuntimeTarget.requiredMarkers, previousRuntimeTarget.marker, twentyFourMarker])],
    runnerReady: true,
  });

  return upgraded;
}

function buildTwentyFiveTargets(previousTargets) {
  const upgraded = previousTargets.map((target) => {
    const idx = target.idx;
    const phase = 2505 + idx;
    const titleWord = titleWords[idx - 1];
    const word = wordNames[idx - 1];
    const marker = `PHASE${phase}_TWENTY_FIVE_TOOL_TARGET_${word.replace(/-/g, "_").toUpperCase()}_OK`;
    const previousMarkerField = `phase${target.phase}Marker`;
    const next = {
      ...target,
      phase,
      word,
      targetName: `target-${word}`,
      proposal: `docs/phase${phase}-twenty-five-tool-mutation-target-${word}.proposal.diff`,
      newExport:
        idx === 25
          ? "buildPhase2530TwentyFiveMutationRuntimeStatus"
          : `buildPhase${phase}TwentyFiveMutationTarget${titleWord}Status`,
      newPhaseId:
        idx === 25
          ? "Phase2530A-Controlled-Twenty-Five-Tool-Mutation-Target-Twenty-Five"
          : `Phase${phase}A-Controlled-Twenty-Five-Tool-Mutation-Target-${word.replace(/(^|-)([a-z])/g, (_, prefix, char) => `${prefix === "-" ? "-" : ""}${char.toUpperCase()}`)}`,
      marker,
      referenceMarkers: [...target.referenceMarkers, target.marker],
      referenceFields: [...target.referenceFields, previousMarkerField],
      requiredExports:
        idx === 1
          ? [`export function ${idx === 25 ? "buildPhase2530TwentyFiveMutationRuntimeStatus" : `buildPhase${phase}TwentyFiveMutationTarget${titleWord}Status`}`]
          : [
              `export function ${idx === 25 ? "buildPhase2530TwentyFiveMutationRuntimeStatus" : `buildPhase${phase}TwentyFiveMutationTarget${titleWord}Status`}`,
              "export function main",
            ],
      requiredMarkers: [...new Set([...target.requiredMarkers, target.marker, marker])],
      runnerReady: false,
    };

    if (next.addMode === "phase2091-main") {
      next.mainProperty = `phase${phase}`;
      next.runtimeBaseProperty = `phase${target.phase}`;
      next.runtimeBaseExport = target.newExport;
    }

    if (next.addMode === "runtime-plus-export") {
      next.runtimeInsertAfterField = `phase${target.phase}Marker`;
      next.runtimeInsertAfterMarker = target.marker;
      next.runtimeMarkerField = `phase${phase}Marker`;
    }

    return next;
  });

  const previousRuntimeTarget = previousTargets[23];
  const twentyFivePhase = 2530;
  const twentyFiveMarker = "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK";
  upgraded.push({
    idx: 25,
    phase: twentyFivePhase,
    word: "twenty-five",
    targetName: "target-twenty-five",
    path: sourceTargetPaths[24],
    proposal: "docs/phase2530-twenty-five-tool-mutation-target-twenty-five.proposal.diff",
    addMode: "append-export",
    newExport: "buildPhase2530TwentyFiveMutationRuntimeStatus",
    newPhaseId: "Phase2530A-Controlled-Twenty-Five-Tool-Mutation-Target-Twenty-Five",
    marker: twentyFiveMarker,
    referenceMarkers: [...previousRuntimeTarget.referenceMarkers, previousRuntimeTarget.marker],
    referenceFields: [...previousRuntimeTarget.referenceFields, `phase${previousRuntimeTarget.phase}Marker`],
    requiredExports: ["export function buildPhase2530TwentyFiveMutationRuntimeStatus", "export function main"],
    requiredMarkers: [...new Set([...previousRuntimeTarget.requiredMarkers, previousRuntimeTarget.marker, twentyFiveMarker])],
    runnerReady: true,
  });

  return upgraded;
}

function buildTwentySixTargets(previousTargets) {
  const upgraded = previousTargets.map((target) => {
    const idx = target.idx;
    const phase = 2535 + idx;
    const titleWord = titleWords[idx - 1];
    const word = wordNames[idx - 1];
    const marker = `PHASE${phase}_TWENTY_SIX_TOOL_TARGET_${word.replace(/-/g, "_").toUpperCase()}_OK`;
    const previousMarkerField = `phase${target.phase}Marker`;
    const next = {
      ...target,
      phase,
      word,
      targetName: `target-${word}`,
      proposal: `docs/phase${phase}-twenty-six-tool-mutation-target-${word}.proposal.diff`,
      newExport:
        idx === 26
          ? "buildPhase2561TwentySixMutationRuntimeStatus"
          : `buildPhase${phase}TwentySixMutationTarget${titleWord}Status`,
      newPhaseId:
        idx === 26
          ? "Phase2561A-Controlled-Twenty-Six-Tool-Mutation-Target-Twenty-Six"
          : `Phase${phase}A-Controlled-Twenty-Six-Tool-Mutation-Target-${word.replace(/(^|-)([a-z])/g, (_, prefix, char) => `${prefix === "-" ? "-" : ""}${char.toUpperCase()}`)}`,
      marker,
      referenceMarkers: [...target.referenceMarkers, target.marker],
      referenceFields: [...target.referenceFields, previousMarkerField],
      requiredExports:
        idx === 1
          ? [`export function ${idx === 26 ? "buildPhase2561TwentySixMutationRuntimeStatus" : `buildPhase${phase}TwentySixMutationTarget${titleWord}Status`}`]
          : [
              `export function ${idx === 26 ? "buildPhase2561TwentySixMutationRuntimeStatus" : `buildPhase${phase}TwentySixMutationTarget${titleWord}Status`}`,
              "export function main",
            ],
      requiredMarkers: [...new Set([...target.requiredMarkers, target.marker, marker])],
      runnerReady: false,
    };

    if (next.addMode === "phase2091-main") {
      next.mainProperty = `phase${phase}`;
      next.runtimeBaseProperty = `phase${target.phase}`;
      next.runtimeBaseExport = target.newExport;
    }

    if (next.addMode === "runtime-plus-export") {
      next.runtimeInsertAfterField = `phase${target.phase}Marker`;
      next.runtimeInsertAfterMarker = target.marker;
      next.runtimeMarkerField = `phase${phase}Marker`;
    }

    return next;
  });

  const previousRuntimeTarget = previousTargets[24];
  const twentySixPhase = 2561;
  const twentySixMarker = "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK";
  upgraded.push({
    idx: 26,
    phase: twentySixPhase,
    word: "twenty-six",
    targetName: "target-twenty-six",
    path: sourceTargetPaths[25],
    proposal: "docs/phase2561-twenty-six-tool-mutation-target-twenty-six.proposal.diff",
    addMode: "append-export",
    newExport: "buildPhase2561TwentySixMutationRuntimeStatus",
    newPhaseId: "Phase2561A-Controlled-Twenty-Six-Tool-Mutation-Target-Twenty-Six",
    marker: twentySixMarker,
    referenceMarkers: [...previousRuntimeTarget.referenceMarkers, previousRuntimeTarget.marker],
    referenceFields: [...previousRuntimeTarget.referenceFields, `phase${previousRuntimeTarget.phase}Marker`],
    requiredExports: ["export function buildPhase2561TwentySixMutationRuntimeStatus", "export function main"],
    requiredMarkers: [...new Set([...previousRuntimeTarget.requiredMarkers, previousRuntimeTarget.marker, twentySixMarker])],
    runnerReady: true,
  });

  return upgraded;
}

function buildTwentySevenTargets(previousTargets) {
  const upgraded = previousTargets.map((target) => {
    const idx = target.idx;
    const phase = 2566 + idx;
    const titleWord = titleWords[idx - 1];
    const word = wordNames[idx - 1];
    const marker = `PHASE${phase}_TWENTY_SEVEN_TOOL_TARGET_${word.replace(/-/g, "_").toUpperCase()}_OK`;
    const previousMarkerField = `phase${target.phase}Marker`;
    const next = {
      ...target,
      phase,
      word,
      targetName: `target-${word}`,
      proposal: `docs/phase${phase}-twenty-seven-tool-mutation-target-${word}.proposal.diff`,
      newExport:
        idx === 27
          ? "buildPhase2593TwentySevenMutationRuntimeStatus"
          : `buildPhase${phase}TwentySevenMutationTarget${titleWord}Status`,
      newPhaseId:
        idx === 27
          ? "Phase2593A-Controlled-Twenty-Seven-Tool-Mutation-Target-Twenty-Seven"
          : `Phase${phase}A-Controlled-Twenty-Seven-Tool-Mutation-Target-${word.replace(/(^|-)([a-z])/g, (_, prefix, char) => `${prefix === "-" ? "-" : ""}${char.toUpperCase()}`)}`,
      marker,
      referenceMarkers: [...target.referenceMarkers, target.marker],
      referenceFields: [...target.referenceFields, previousMarkerField],
      requiredExports:
        idx === 1
          ? [`export function ${idx === 27 ? "buildPhase2593TwentySevenMutationRuntimeStatus" : `buildPhase${phase}TwentySevenMutationTarget${titleWord}Status`}`]
          : [
              `export function ${idx === 27 ? "buildPhase2593TwentySevenMutationRuntimeStatus" : `buildPhase${phase}TwentySevenMutationTarget${titleWord}Status`}`,
              "export function main",
            ],
      requiredMarkers: [...new Set([...target.requiredMarkers, target.marker, marker])],
      runnerReady: false,
    };

    if (next.addMode === "phase2091-main") {
      next.mainProperty = `phase${phase}`;
      next.runtimeBaseProperty = `phase${target.phase}`;
      next.runtimeBaseExport = target.newExport;
    }

    if (next.addMode === "runtime-plus-export") {
      next.runtimeInsertAfterField = `phase${target.phase}Marker`;
      next.runtimeInsertAfterMarker = target.marker;
      next.runtimeMarkerField = `phase${phase}Marker`;
    }

    return next;
  });

  const previousRuntimeTarget = previousTargets[25];
  const twentySevenPhase = 2593;
  const twentySevenMarker = "PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK";
  upgraded.push({
    idx: 27,
    phase: twentySevenPhase,
    word: "twenty-seven",
    targetName: "target-twenty-seven",
    path: sourceTargetPaths[26],
    proposal: "docs/phase2593-twenty-seven-tool-mutation-target-twenty-seven.proposal.diff",
    addMode: "append-export",
    newExport: "buildPhase2593TwentySevenMutationRuntimeStatus",
    newPhaseId: "Phase2593A-Controlled-Twenty-Seven-Tool-Mutation-Target-Twenty-Seven",
    marker: twentySevenMarker,
    referenceMarkers: [...previousRuntimeTarget.referenceMarkers, previousRuntimeTarget.marker],
    referenceFields: [...previousRuntimeTarget.referenceFields, `phase${previousRuntimeTarget.phase}Marker`],
    requiredExports: ["export function buildPhase2593TwentySevenMutationRuntimeStatus", "export function main"],
    requiredMarkers: [...new Set([...previousRuntimeTarget.requiredMarkers, previousRuntimeTarget.marker, twentySevenMarker])],
    runnerReady: true,
  });

  return upgraded;
}

function buildTwentyEightTargets(previousTargets) {
  const upgraded = previousTargets.map((target) => {
    const idx = target.idx;
    const phase = 2598 + idx;
    const titleWord = titleWords[idx - 1];
    const word = wordNames[idx - 1];
    const marker = `PHASE${phase}_TWENTY_EIGHT_TOOL_TARGET_${word.replace(/-/g, "_").toUpperCase()}_OK`;
    const previousMarkerField = `phase${target.phase}Marker`;
    const next = {
      ...target,
      phase,
      word,
      targetName: `target-${word}`,
      proposal: `docs/phase${phase}-twenty-eight-tool-mutation-target-${word}.proposal.diff`,
      newExport:
        idx === 28
          ? "buildPhase2626TwentyEightMutationRuntimeStatus"
          : `buildPhase${phase}TwentyEightMutationTarget${titleWord}Status`,
      newPhaseId:
        idx === 28
          ? "Phase2626A-Controlled-Twenty-Eight-Tool-Mutation-Target-Twenty-Eight"
          : `Phase${phase}A-Controlled-Twenty-Eight-Tool-Mutation-Target-${word.replace(/(^|-)([a-z])/g, (_, prefix, char) => `${prefix === "-" ? "-" : ""}${char.toUpperCase()}`)}`,
      marker,
      referenceMarkers: [...target.referenceMarkers, target.marker],
      referenceFields: [...target.referenceFields, previousMarkerField],
      requiredExports:
        idx === 1
          ? [`export function ${idx === 28 ? "buildPhase2626TwentyEightMutationRuntimeStatus" : `buildPhase${phase}TwentyEightMutationTarget${titleWord}Status`}`]
          : [
              `export function ${idx === 28 ? "buildPhase2626TwentyEightMutationRuntimeStatus" : `buildPhase${phase}TwentyEightMutationTarget${titleWord}Status`}`,
              "export function main",
            ],
      requiredMarkers: [...new Set([...target.requiredMarkers, target.marker, marker])],
      runnerReady: false,
    };

    if (next.addMode === "phase2091-main") {
      next.mainProperty = `phase${phase}`;
      next.runtimeBaseProperty = `phase${target.phase}`;
      next.runtimeBaseExport = target.newExport;
    }

    if (next.addMode === "runtime-plus-export") {
      next.runtimeInsertAfterField = `phase${target.phase}Marker`;
      next.runtimeInsertAfterMarker = target.marker;
      next.runtimeMarkerField = `phase${phase}Marker`;
    }

    return next;
  });

  const previousRuntimeTarget = previousTargets[26];
  const twentyEightPhase = 2626;
  const twentyEightMarker = "PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK";
  upgraded.push({
    idx: 28,
    phase: twentyEightPhase,
    word: "twenty-eight",
    targetName: "target-twenty-eight",
    path: sourceTargetPaths[27],
    proposal: "docs/phase2626-twenty-eight-tool-mutation-target-twenty-eight.proposal.diff",
    addMode: "append-export",
    newExport: "buildPhase2626TwentyEightMutationRuntimeStatus",
    newPhaseId: "Phase2626A-Controlled-Twenty-Eight-Tool-Mutation-Target-Twenty-Eight",
    marker: twentyEightMarker,
    referenceMarkers: [...previousRuntimeTarget.referenceMarkers, previousRuntimeTarget.marker],
    referenceFields: [...previousRuntimeTarget.referenceFields, `phase${previousRuntimeTarget.phase}Marker`],
    requiredExports: ["export function buildPhase2626TwentyEightMutationRuntimeStatus", "export function main"],
    requiredMarkers: [...new Set([...previousRuntimeTarget.requiredMarkers, previousRuntimeTarget.marker, twentyEightMarker])],
    runnerReady: true,
  });

  return upgraded;
}

function buildTwentyNineTargets(previousTargets) {
  const upgraded = previousTargets.map((target) => {
    const idx = target.idx;
    const phase = 2631 + idx;
    const titleWord = titleWords[idx - 1];
    const word = wordNames[idx - 1];
    const marker = `PHASE${phase}_TWENTY_NINE_TOOL_TARGET_${word.replace(/-/g, "_").toUpperCase()}_OK`;
    const previousMarkerField = `phase${target.phase}Marker`;
    const next = {
      ...target,
      phase,
      word,
      targetName: `target-${word}`,
      proposal: `docs/phase${phase}-twenty-nine-tool-mutation-target-${word}.proposal.diff`,
      newExport:
        idx === 29
          ? "buildPhase2660TwentyNineMutationRuntimeStatus"
          : `buildPhase${phase}TwentyNineMutationTarget${titleWord}Status`,
      newPhaseId:
        idx === 29
          ? "Phase2660A-Controlled-Twenty-Nine-Tool-Mutation-Target-Twenty-Nine"
          : `Phase${phase}A-Controlled-Twenty-Nine-Tool-Mutation-Target-${word.replace(/(^|-)([a-z])/g, (_, prefix, char) => `${prefix === "-" ? "-" : ""}${char.toUpperCase()}`)}`,
      marker,
      referenceMarkers: [...target.referenceMarkers, target.marker],
      referenceFields: [...target.referenceFields, previousMarkerField],
      requiredExports:
        idx === 1
          ? [`export function ${idx === 29 ? "buildPhase2660TwentyNineMutationRuntimeStatus" : `buildPhase${phase}TwentyNineMutationTarget${titleWord}Status`}`]
          : [
              `export function ${idx === 29 ? "buildPhase2660TwentyNineMutationRuntimeStatus" : `buildPhase${phase}TwentyNineMutationTarget${titleWord}Status`}`,
              "export function main",
            ],
      requiredMarkers: [...new Set([...target.requiredMarkers, target.marker, marker])],
      runnerReady: false,
    };

    if (next.addMode === "phase2091-main") {
      next.mainProperty = `phase${phase}`;
      next.runtimeBaseProperty = `phase${target.phase}`;
      next.runtimeBaseExport = target.newExport;
    }

    if (next.addMode === "runtime-plus-export") {
      next.runtimeInsertAfterField = `phase${target.phase}Marker`;
      next.runtimeInsertAfterMarker = target.marker;
      next.runtimeMarkerField = `phase${phase}Marker`;
    }

    return next;
  });

  const previousRuntimeTarget = previousTargets[27];
  const twentyNinePhase = 2660;
  const twentyNineMarker = "PHASE2660_TWENTY_NINE_TOOL_TARGET_TWENTY_NINE_OK";
  upgraded.push({
    idx: 29,
    phase: twentyNinePhase,
    word: "twenty-nine",
    targetName: "target-twenty-nine",
    path: sourceTargetPaths[28],
    proposal: "docs/phase2660-twenty-nine-tool-mutation-target-twenty-nine.proposal.diff",
    addMode: "append-export",
    newExport: "buildPhase2660TwentyNineMutationRuntimeStatus",
    newPhaseId: "Phase2660A-Controlled-Twenty-Nine-Tool-Mutation-Target-Twenty-Nine",
    marker: twentyNineMarker,
    referenceMarkers: [...previousRuntimeTarget.referenceMarkers, previousRuntimeTarget.marker],
    referenceFields: [...previousRuntimeTarget.referenceFields, `phase${previousRuntimeTarget.phase}Marker`],
    requiredExports: ["export function buildPhase2660TwentyNineMutationRuntimeStatus", "export function main"],
    requiredMarkers: [...new Set([...previousRuntimeTarget.requiredMarkers, previousRuntimeTarget.marker, twentyNineMarker])],
    runnerReady: true,
  });

  return upgraded;
}

function buildThirtyTargets(previousTargets) {
  const upgraded = previousTargets.map((target) => {
    const idx = target.idx;
    const phase = 2665 + idx;
    const titleWord = titleWords[idx - 1];
    const word = wordNames[idx - 1];
    const marker = `PHASE${phase}_THIRTY_TOOL_TARGET_${word.replace(/-/g, "_").toUpperCase()}_OK`;
    const previousMarkerField = `phase${target.phase}Marker`;
    const next = {
      ...target,
      phase,
      word,
      targetName: `target-${word}`,
      proposal: `docs/phase${phase}-thirty-tool-mutation-target-${word}.proposal.diff`,
      newExport:
        idx === 30
          ? "buildPhase2695ThirtyMutationRuntimeStatus"
          : `buildPhase${phase}ThirtyMutationTarget${titleWord}Status`,
      newPhaseId:
        idx === 30
          ? "Phase2695A-Controlled-Thirty-Tool-Mutation-Target-Thirty"
          : `Phase${phase}A-Controlled-Thirty-Tool-Mutation-Target-${word.replace(/(^|-)([a-z])/g, (_, prefix, char) => `${prefix === "-" ? "-" : ""}${char.toUpperCase()}`)}`,
      marker,
      referenceMarkers: [...target.referenceMarkers, target.marker],
      referenceFields: [...target.referenceFields, previousMarkerField],
      requiredExports:
        idx === 1
          ? [`export function ${idx === 30 ? "buildPhase2695ThirtyMutationRuntimeStatus" : `buildPhase${phase}ThirtyMutationTarget${titleWord}Status`}`]
          : [
              `export function ${idx === 30 ? "buildPhase2695ThirtyMutationRuntimeStatus" : `buildPhase${phase}ThirtyMutationTarget${titleWord}Status`}`,
              "export function main",
            ],
      requiredMarkers: [...new Set([...target.requiredMarkers, target.marker, marker])],
      runnerReady: false,
    };

    if (next.addMode === "phase2091-main") {
      next.mainProperty = `phase${phase}`;
      next.runtimeBaseProperty = `phase${target.phase}`;
      next.runtimeBaseExport = target.newExport;
    }

    if (next.addMode === "runtime-plus-export") {
      next.runtimeInsertAfterField = `phase${target.phase}Marker`;
      next.runtimeInsertAfterMarker = target.marker;
      next.runtimeMarkerField = `phase${phase}Marker`;
    }

    return next;
  });

  const previousRuntimeTarget = previousTargets[28];
  const thirtyPhase = 2695;
  const thirtyMarker = "PHASE2695_THIRTY_TOOL_TARGET_THIRTY_OK";
  upgraded.push({
    idx: 30,
    phase: thirtyPhase,
    word: "thirty",
    targetName: "target-thirty",
    path: sourceTargetPaths[29],
    proposal: "docs/phase2695-thirty-tool-mutation-target-thirty.proposal.diff",
    addMode: "append-export",
    newExport: "buildPhase2695ThirtyMutationRuntimeStatus",
    newPhaseId: "Phase2695A-Controlled-Thirty-Tool-Mutation-Target-Thirty",
    marker: thirtyMarker,
    referenceMarkers: [...previousRuntimeTarget.referenceMarkers, previousRuntimeTarget.marker],
    referenceFields: [...previousRuntimeTarget.referenceFields, `phase${previousRuntimeTarget.phase}Marker`],
    requiredExports: ["export function buildPhase2695ThirtyMutationRuntimeStatus", "export function main"],
    requiredMarkers: [...new Set([...previousRuntimeTarget.requiredMarkers, previousRuntimeTarget.marker, thirtyMarker])],
    runnerReady: true,
  });

  return upgraded;
}

const phase2091Checks = [
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
  "parsed?.phase2242?.marker === \"PHASE2242_FOURTEEN_TOOL_TARGET_ONE_OK\"",
  "parsed?.phase2261?.marker === \"PHASE2261_FIFTEEN_TOOL_TARGET_ONE_OK\"",
  "parsed?.phase2281?.marker === \"PHASE2281_SIXTEEN_TOOL_TARGET_ONE_OK\"",
  `parsed?.phase${targets[0].phase}?.marker === "${targets[0].marker}"`,
];

const smokeSpec = [
  {
    id: "phase2091",
    targetIndex: 0,
    command: "node",
    args: ["tools/phase2091/generated-source-patch-target.mjs"],
    expectedStatus: 0,
    checks: phase2091Checks,
    markerPath: `parsed?.phase${targets[0].phase}?.marker || null`,
    markerField: `phase${targets[0].phase}Marker`,
  },
  {
    id: "phase2092",
    targetIndex: 1,
    command: "node",
    args: [
      "-e",
      `import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))`,
    ],
    expectedStatus: 0,
    checks: [
      `parsed?.marker === "PHASE2094_BATCH_TOOL_TARGET_TWO_OK"`,
      `parsed?.phase2127Marker === "PHASE2127_SEXT_TOOL_TARGET_TWO_OK"`,
      `parsed?.phase2138Marker === "PHASE2138_SEPT_TOOL_TARGET_TWO_OK"`,
      `parsed?.phase2150Marker === "PHASE2150_OCT_TOOL_TARGET_TWO_OK"`,
      `parsed?.phase2163Marker === "PHASE2163_NONET_TOOL_TARGET_TWO_OK"`,
      `parsed?.phase2177Marker === "PHASE2177_DECA_TOOL_TARGET_TWO_OK"`,
      `parsed?.phase2192Marker === "PHASE2192_ELEVEN_TOOL_TARGET_TWO_OK"`,
      `parsed?.phase2208Marker === "PHASE2208_TWELVE_TOOL_TARGET_TWO_OK"`,
      `parsed?.phase2225Marker === "PHASE2225_THIRTEEN_TOOL_TARGET_TWO_OK"`,
      `parsed?.phase2243Marker === "PHASE2243_FOURTEEN_TOOL_TARGET_TWO_OK"`,
      `parsed?.phase2262Marker === "PHASE2262_FIFTEEN_TOOL_TARGET_TWO_OK"`,
      `parsed?.phase2282Marker === "PHASE2282_SIXTEEN_TOOL_TARGET_TWO_OK"`,
      `parsed?.phase${targets[1].phase}Marker === "${targets[1].marker}"`,
    ],
    markerPath: `parsed?.phase${targets[1].phase}Marker || null`,
    markerField: `phase${targets[1].phase}Marker`,
  },
  {
    id: "phase2093",
    targetIndex: 2,
    command: "node",
    args: [
      "-e",
      `import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))`,
    ],
    expectedStatus: 0,
    checks: [
      `parsed?.marker === "PHASE2100_TRIPLE_TOOL_TARGET_THREE_OK"`,
      `parsed?.phase2128Marker === "PHASE2128_SEXT_TOOL_TARGET_THREE_OK"`,
      `parsed?.phase2139Marker === "PHASE2139_SEPT_TOOL_TARGET_THREE_OK"`,
      `parsed?.phase2151Marker === "PHASE2151_OCT_TOOL_TARGET_THREE_OK"`,
      `parsed?.phase2164Marker === "PHASE2164_NONET_TOOL_TARGET_THREE_OK"`,
      `parsed?.phase2178Marker === "PHASE2178_DECA_TOOL_TARGET_THREE_OK"`,
      `parsed?.phase2193Marker === "PHASE2193_ELEVEN_TOOL_TARGET_THREE_OK"`,
      `parsed?.phase2209Marker === "PHASE2209_TWELVE_TOOL_TARGET_THREE_OK"`,
      `parsed?.phase2226Marker === "PHASE2226_THIRTEEN_TOOL_TARGET_THREE_OK"`,
      `parsed?.phase2244Marker === "PHASE2244_FOURTEEN_TOOL_TARGET_THREE_OK"`,
      `parsed?.phase2263Marker === "PHASE2263_FIFTEEN_TOOL_TARGET_THREE_OK"`,
      `parsed?.phase2283Marker === "PHASE2283_SIXTEEN_TOOL_TARGET_THREE_OK"`,
      `parsed?.phase${targets[2].phase}Marker === "${targets[2].marker}"`,
    ],
    markerPath: `parsed?.phase${targets[2].phase}Marker || null`,
    markerField: `phase${targets[2].phase}Marker`,
  },
  {
    id: "phase2096",
    targetIndex: 3,
    command: "node",
    args: [
      "-e",
      `import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))`,
    ],
    expectedStatus: 0,
    checks: [
      `parsed?.marker === "PHASE2109_QUAD_TOOL_TARGET_FOUR_OK"`,
      `parsed?.phase2129Marker === "PHASE2129_SEXT_TOOL_TARGET_FOUR_OK"`,
      `parsed?.phase2140Marker === "PHASE2140_SEPT_TOOL_TARGET_FOUR_OK"`,
      `parsed?.phase2152Marker === "PHASE2152_OCT_TOOL_TARGET_FOUR_OK"`,
      `parsed?.phase2165Marker === "PHASE2165_NONET_TOOL_TARGET_FOUR_OK"`,
      `parsed?.phase2179Marker === "PHASE2179_DECA_TOOL_TARGET_FOUR_OK"`,
      `parsed?.phase2194Marker === "PHASE2194_ELEVEN_TOOL_TARGET_FOUR_OK"`,
      `parsed?.phase2210Marker === "PHASE2210_TWELVE_TOOL_TARGET_FOUR_OK"`,
      `parsed?.phase2227Marker === "PHASE2227_THIRTEEN_TOOL_TARGET_FOUR_OK"`,
      `parsed?.phase2245Marker === "PHASE2245_FOURTEEN_TOOL_TARGET_FOUR_OK"`,
      `parsed?.phase2264Marker === "PHASE2264_FIFTEEN_TOOL_TARGET_FOUR_OK"`,
      `parsed?.phase2284Marker === "PHASE2284_SIXTEEN_TOOL_TARGET_FOUR_OK"`,
      `parsed?.phase${targets[3].phase}Marker === "${targets[3].marker}"`,
    ],
    markerPath: `parsed?.phase${targets[3].phase}Marker || null`,
    markerField: `phase${targets[3].phase}Marker`,
  },
  {
    id: "phase2101",
    targetIndex: 4,
    command: "node",
    args: [
      "-e",
      `import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))`,
    ],
    expectedStatus: 0,
    checks: [
      `parsed?.marker === "PHASE2120_QUINT_TOOL_TARGET_FIVE_OK"`,
      `parsed?.phase2130Marker === "PHASE2130_SEXT_TOOL_TARGET_FIVE_OK"`,
      `parsed?.phase2141Marker === "PHASE2141_SEPT_TOOL_TARGET_FIVE_OK"`,
      `parsed?.phase2153Marker === "PHASE2153_OCT_TOOL_TARGET_FIVE_OK"`,
      `parsed?.phase2166Marker === "PHASE2166_NONET_TOOL_TARGET_FIVE_OK"`,
      `parsed?.phase2180Marker === "PHASE2180_DECA_TOOL_TARGET_FIVE_OK"`,
      `parsed?.phase2195Marker === "PHASE2195_ELEVEN_TOOL_TARGET_FIVE_OK"`,
      `parsed?.phase2211Marker === "PHASE2211_TWELVE_TOOL_TARGET_FIVE_OK"`,
      `parsed?.phase2228Marker === "PHASE2228_THIRTEEN_TOOL_TARGET_FIVE_OK"`,
      `parsed?.phase2246Marker === "PHASE2246_FOURTEEN_TOOL_TARGET_FIVE_OK"`,
      `parsed?.phase2265Marker === "PHASE2265_FIFTEEN_TOOL_TARGET_FIVE_OK"`,
      `parsed?.phase2285Marker === "PHASE2285_SIXTEEN_TOOL_TARGET_FIVE_OK"`,
      `parsed?.phase${targets[4].phase}Marker === "${targets[4].marker}"`,
    ],
    markerPath: `parsed?.phase${targets[4].phase}Marker || null`,
    markerField: `phase${targets[4].phase}Marker`,
  },
];

const appendSmokeTargets = targets.slice(5);
const appendSmokeSpecs = appendSmokeTargets.map((target, index) => {
  const sourcePath = target.path;
  const targetIndex = index + 5;
  return {
    id: `phase${sourcePath.match(/phase(\d+)/)?.[1] || target.phase}`,
    targetIndex,
    command: "node",
    args: [
      "-e",
      `import('./${sourcePath.replace(/\\/g, "/")}').then(m=>console.log(JSON.stringify(m.${target.newExport}())))`,
    ],
    expectedStatus: 0,
    checks: [
      `parsed?.marker === "${target.marker}"`,
      ...target.referenceFields.map(
        (field, idx) => `parsed?.${field} === "${target.referenceMarkers[idx]}"`,
      ),
      `parsed?.phase${target.phase}Marker === "${target.marker}"`,
    ],
    markerPath: `parsed?.phase${target.phase}Marker || null`,
    markerField: `phase${target.phase}Marker`,
  };
});

smokeSpec.push(...appendSmokeSpecs);

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
  return word
    .split("-")
    .filter(Boolean)
    .map((entry) => entry.charAt(0).toUpperCase() + entry.slice(1))
    .join("");
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
      2423: "export function buildPhase2397TwentyOneMutationTargetTwoStatus() {",
      2424: "export function buildPhase2398TwentyOneMutationTargetThreeStatus() {",
      2425: "export function buildPhase2399TwentyOneMutationTargetFourStatus() {",
      2426: "export function buildPhase2400TwentyOneMutationTargetFiveStatus() {",
      2450: "export function buildPhase2423TwentyTwoMutationTargetTwoStatus() {",
      2451: "export function buildPhase2424TwentyTwoMutationTargetThreeStatus() {",
      2452: "export function buildPhase2425TwentyTwoMutationTargetFourStatus() {",
      2453: "export function buildPhase2426TwentyTwoMutationTargetFiveStatus() {",
      2478: "export function buildPhase2450TwentyThreeMutationTargetTwoStatus() {",
      2479: "export function buildPhase2451TwentyThreeMutationTargetThreeStatus() {",
      2480: "export function buildPhase2452TwentyThreeMutationTargetFourStatus() {",
      2481: "export function buildPhase2453TwentyThreeMutationTargetFiveStatus() {",
      2507: "export function buildPhase2478TwentyFourMutationTargetTwoStatus() {",
      2508: "export function buildPhase2479TwentyFourMutationTargetThreeStatus() {",
      2509: "export function buildPhase2480TwentyFourMutationTargetFourStatus() {",
      2510: "export function buildPhase2481TwentyFourMutationTargetFiveStatus() {",
      2537: "export function buildPhase2507TwentyFiveMutationTargetTwoStatus() {",
      2538: "export function buildPhase2508TwentyFiveMutationTargetThreeStatus() {",
      2539: "export function buildPhase2509TwentyFiveMutationTargetFourStatus() {",
      2540: "export function buildPhase2510TwentyFiveMutationTargetFiveStatus() {",
      2568: "export function buildPhase2537TwentySixMutationTargetTwoStatus() {",
      2569: "export function buildPhase2538TwentySixMutationTargetThreeStatus() {",
      2570: "export function buildPhase2539TwentySixMutationTargetFourStatus() {",
      2571: "export function buildPhase2540TwentySixMutationTargetFiveStatus() {",
      2600: "export function buildPhase2568TwentySevenMutationTargetTwoStatus() {",
      2601: "export function buildPhase2569TwentySevenMutationTargetThreeStatus() {",
      2602: "export function buildPhase2570TwentySevenMutationTargetFourStatus() {",
      2603: "export function buildPhase2571TwentySevenMutationTargetFiveStatus() {",
      2633: "export function buildPhase2600TwentyEightMutationTargetTwoStatus() {",
      2634: "export function buildPhase2601TwentyEightMutationTargetThreeStatus() {",
      2635: "export function buildPhase2602TwentyEightMutationTargetFourStatus() {",
      2636: "export function buildPhase2603TwentyEightMutationTargetFiveStatus() {",
      2667: "export function buildPhase2633TwentyNineMutationTargetTwoStatus() {",
      2668: "export function buildPhase2634TwentyNineMutationTargetThreeStatus() {",
      2669: "export function buildPhase2635TwentyNineMutationTargetFourStatus() {",
      2670: "export function buildPhase2636TwentyNineMutationTargetFiveStatus() {",
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
  const tempDir = resolve("tmp/phase2661-2695-proposals");
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
  return `# Phase2661A-2695A Controlled Thirty Tool Mutation

## Goal

Phase2661A-2695A extends the controlled local mutation line from twenty-nine files to thirty files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled thirty tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase2627A-2660A sealed evidence.
- Reuses \`tools/phase2101_2110/controlled-mutation-substrate.mjs\`.
- Applies exactly thirty existing source-file mutations.
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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support thirty bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The thirty mutation batch must prove:
${targets.map((target) => `- new Phase${target.phase} target ${target.word} emits \`${target.marker}\``).join("\n")}

## Commands

\`\`\`powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase2661-2695-controlled-thirty-tool-mutation
cmd /c pnpm run apply:phase2661-2695-controlled-thirty-tool-mutation
cmd /c pnpm run smoke:phase2661-2695-controlled-thirty-tool-mutation
cmd /c pnpm run verify:phase2661-2695-controlled-thirty-tool-mutation
\`\`\`

The first verifier run is expected to fail before apply because result evidence does not exist yet and the thirty target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a twenty-seven-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default \`/chat\`.
`;
}

function buildApproval(planOperations) {
  return JSON.stringify(
    {
      phaseId: phaseMeta.phaseId,
      planId: "phase2661-2695-controlled-thirty-tool-mutation",
      maxChangedFiles: 30,
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
            scope: "phase2661-2695-controlled-thirty-tool-mutation",
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
    .map((entry) => `    ${entry.markerField}: smoke${titleWord(entry.id)}.${entry.markerPath},`)
    .join("\n");

  const targetPathsArray = JSON.stringify(targets.map((target) => target.path), null, 4);

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

${buildStatusFunction(targets[targets.length - 1]).trim()}

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
      maxChangedFiles: 30,
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
    blocker: completed ? "none" : "thirty_mutation_node_check_or_smoke_failed",
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
    expectedOperationCount: 30,
    expectedMaxChangedFiles: 30,
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
        id: "${previousPhaseMeta.sealCheckId}",
        path: "${previousPhaseMeta.resultPath}",
        predicate: (evidence) => evidence.recommendedSealed === true && evidence.${previousPhaseMeta.sealCheckField} === true,
        blocker: "${previousPhaseMeta.sealCheckBlocker}",
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
    phase2660Sealed: validation.upstreamResults.some((entry) => entry.id === "${previousPhaseMeta.sealCheckId}" && entry.passed),
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
    "# Phase2661A-2695A Controlled Thirty Tool Mutation Evidence",
    "",
    \`- status: \${result.status}\`,
    \`- recommendedSealed: \${Boolean(result.recommendedSealed)}\`,
    \`- blocker: \${result.blocker}\`,
    \`- thirtyMutationApplied: \${Boolean(result.thirtyMutationApplied)}\`,
    \`- changedFileCount: \${result.changedFileCount || 0}\`,
    \`- nodeCheckPassed: \${Boolean(result.nodeCheckPassed)}\`,
    \`- localThirtySmokePassed: \${Boolean(result.localThirtySmokePassed)}\`,
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
    thirtyMutationApplied: result.thirtyMutationApplied,
    changedFileCount: result.changedFileCount,
    nodeCheckPassed: result.nodeCheckPassed,
    localThirtySmokePassed: result.localThirtySmokePassed,
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
    .map((entry) => `  check("smoke_${entry.markerField}", smoke.${entry.markerField} === "${targets[entry.targetIndex].marker}");`)
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

  return `import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
const phase2660 = readJson("${previousPhaseMeta.resultPath}") || {};
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
check("${previousPhaseMeta.sealCheckId}", phase2660.recommendedSealed === true && phase2660.${previousPhaseMeta.sealCheckField} === true);
check("result_exists", result !== null, "run ${phaseMeta.applyScript} first");
check("rollback_exists", rollback !== null);
check("smoke_exists", smoke !== null);

if (result) {
  check("phase_id_matches", result.phaseId === phaseId);
  check("status_passed", result.status === "passed" && result.recommendedSealed === true);
  check("blocker_none", result.blocker === "none");
  check("thirty_mutation_applied", result.thirtyMutationApplied === true);
  check("changed_file_count_thirty", result.changedFileCount === 30);
  check("changed_files_expected", Array.isArray(result.changedFiles)
${changedIncludes}
  );
  check("node_checks_passed", result.nodeCheckPassed === true);
  check("local_smokes_passed", result.localThirtySmokePassed === true);
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
  check("rollback_restore_thirty", rollback.rollbackAction === "restore-previous-content-thirty");
  check("rollback_not_executed", rollback.rollbackExecuted === false);
  check("rollback_thirty_entries", Array.isArray(rollback.files) && rollback.files.length === 30);
}

if (smoke) {
${smokeMarkerChecks}
  check("smoke_status_passed", smoke.status === "passed");
  check("smoke_provider_false", smoke.providerCallsMade === false);
}

${targetChecks}
check("substrate_has_plan_validation", substrate.includes("export function validateControlledMutationPlan"));
check("substrate_has_json_smokes", substrate.includes("export function runJsonCommandSmokes"));
check("docs_mentions_thirty", docs.includes("controlled thirty tool mutation"));
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
  phase2660Sealed: phase2660.recommendedSealed === true,
  thirtyMutationReady: completed,
  changedFiles: [
${changedList}
  ],
  changedFileCount: result?.changedFileCount ?? 30,
  thirtyMutationApplied: result?.thirtyMutationApplied === true,
  nodeCheckPassed: result?.nodeCheckPassed === true,
  localThirtySmokePassed: result?.localThirtySmokePassed === true,
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
console.log(JSON.stringify({ status: verifierResult.status, blocker: verifierResult.blocker, thirtyMutationApplied: verifierResult.thirtyMutationApplied, nodeCheckPassed: verifierResult.nodeCheckPassed, localThirtySmokePassed: verifierResult.localThirtySmokePassed }, null, 2));
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
    "# Phase2661A-2695A Controlled Thirty Tool Mutation Evidence",
    "",
    \`- status: \${result.status}\`,
    \`- recommendedSealed: \${Boolean(result.recommendedSealed)}\`,
    \`- blocker: \${result.blocker}\`,
    \`- thirtyMutationApplied: \${Boolean(result.thirtyMutationApplied)}\`,
    \`- changedFileCount: \${result.changedFileCount || 0}\`,
    \`- nodeCheckPassed: \${Boolean(result.nodeCheckPassed)}\`,
    \`- localThirtySmokePassed: \${Boolean(result.localThirtySmokePassed)}\`,
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
