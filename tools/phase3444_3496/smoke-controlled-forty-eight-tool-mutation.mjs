import { pathToFileURL } from "node:url";
import path from "node:path";

const phaseId = "Phase3444A-3496A-Controlled-Forty-Eight-Tool-Mutation";

const smokeTargets = [
  {
    "phase": 3449,
    "exportName": "buildPhase3449FortyEightMutationTargetOneStatus",
    "marker": "PHASE3449_FORTY_EIGHT_TOOL_TARGET_ONE_OK",
    "path": "tools/phase2091/generated-source-patch-target.mjs"
  },
  {
    "phase": 3450,
    "exportName": "buildPhase3450FortyEightMutationTargetTwoStatus",
    "marker": "PHASE3450_FORTY_EIGHT_TOOL_TARGET_TWO_OK",
    "path": "tools/phase2092/apply-controlled-existing-tool-mutation.mjs"
  },
  {
    "phase": 3451,
    "exportName": "buildPhase3451FortyEightMutationTargetThreeStatus",
    "marker": "PHASE3451_FORTY_EIGHT_TOOL_TARGET_THREE_OK",
    "path": "tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs"
  },
  {
    "phase": 3452,
    "exportName": "buildPhase3452FortyEightMutationTargetFourStatus",
    "marker": "PHASE3452_FORTY_EIGHT_TOOL_TARGET_FOUR_OK",
    "path": "tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs"
  },
  {
    "phase": 3453,
    "exportName": "buildPhase3453FortyEightMutationTargetFiveStatus",
    "marker": "PHASE3453_FORTY_EIGHT_TOOL_TARGET_FIVE_OK",
    "path": "tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs"
  },
  {
    "phase": 3454,
    "exportName": "buildPhase3454FortyEightMutationTargetSixStatus",
    "marker": "PHASE3454_FORTY_EIGHT_TOOL_TARGET_SIX_OK",
    "path": "tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs"
  },
  {
    "phase": 3455,
    "exportName": "buildPhase3455FortyEightMutationTargetSevenStatus",
    "marker": "PHASE3455_FORTY_EIGHT_TOOL_TARGET_SEVEN_OK",
    "path": "tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs"
  },
  {
    "phase": 3456,
    "exportName": "buildPhase3456FortyEightMutationTargetEightStatus",
    "marker": "PHASE3456_FORTY_EIGHT_TOOL_TARGET_EIGHT_OK",
    "path": "tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs"
  },
  {
    "phase": 3457,
    "exportName": "buildPhase3457FortyEightMutationTargetNineStatus",
    "marker": "PHASE3457_FORTY_EIGHT_TOOL_TARGET_NINE_OK",
    "path": "tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs"
  },
  {
    "phase": 3458,
    "exportName": "buildPhase3458FortyEightMutationTargetTenStatus",
    "marker": "PHASE3458_FORTY_EIGHT_TOOL_TARGET_TEN_OK",
    "path": "tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs"
  },
  {
    "phase": 3459,
    "exportName": "buildPhase3459FortyEightMutationTargetElevenStatus",
    "marker": "PHASE3459_FORTY_EIGHT_TOOL_TARGET_ELEVEN_OK",
    "path": "tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs"
  },
  {
    "phase": 3460,
    "exportName": "buildPhase3460FortyEightMutationTargetTwelveStatus",
    "marker": "PHASE3460_FORTY_EIGHT_TOOL_TARGET_TWELVE_OK",
    "path": "tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs"
  },
  {
    "phase": 3461,
    "exportName": "buildPhase3461FortyEightMutationTargetThirteenStatus",
    "marker": "PHASE3461_FORTY_EIGHT_TOOL_TARGET_THIRTEEN_OK",
    "path": "tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs"
  },
  {
    "phase": 3462,
    "exportName": "buildPhase3462FortyEightMutationTargetFourteenStatus",
    "marker": "PHASE3462_FORTY_EIGHT_TOOL_TARGET_FOURTEEN_OK",
    "path": "tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs"
  },
  {
    "phase": 3463,
    "exportName": "buildPhase3463FortyEightMutationTargetFifteenStatus",
    "marker": "PHASE3463_FORTY_EIGHT_TOOL_TARGET_FIFTEEN_OK",
    "path": "tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs"
  },
  {
    "phase": 3464,
    "exportName": "buildPhase3464FortyEightMutationTargetSixteenStatus",
    "marker": "PHASE3464_FORTY_EIGHT_TOOL_TARGET_SIXTEEN_OK",
    "path": "tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs"
  },
  {
    "phase": 3465,
    "exportName": "buildPhase3465FortyEightMutationTargetSeventeenStatus",
    "marker": "PHASE3465_FORTY_EIGHT_TOOL_TARGET_SEVENTEEN_OK",
    "path": "tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs"
  },
  {
    "phase": 3466,
    "exportName": "buildPhase3466FortyEightMutationTargetEighteenStatus",
    "marker": "PHASE3466_FORTY_EIGHT_TOOL_TARGET_EIGHTEEN_OK",
    "path": "tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs"
  },
  {
    "phase": 3467,
    "exportName": "buildPhase3467FortyEightMutationTargetNineteenStatus",
    "marker": "PHASE3467_FORTY_EIGHT_TOOL_TARGET_NINETEEN_OK",
    "path": "tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs"
  },
  {
    "phase": 3468,
    "exportName": "buildPhase3468FortyEightMutationTargetTwentyStatus",
    "marker": "PHASE3468_FORTY_EIGHT_TOOL_TARGET_TWENTY_OK",
    "path": "tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs"
  },
  {
    "phase": 3469,
    "exportName": "buildPhase3469FortyEightMutationTargetTwentyOneStatus",
    "marker": "PHASE3469_FORTY_EIGHT_TOOL_TARGET_TWENTY_ONE_OK",
    "path": "tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs"
  },
  {
    "phase": 3470,
    "exportName": "buildPhase3470FortyEightMutationTargetTwentyTwoStatus",
    "marker": "PHASE3470_FORTY_EIGHT_TOOL_TARGET_TWENTY_TWO_OK",
    "path": "tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs"
  },
  {
    "phase": 3471,
    "exportName": "buildPhase3471FortyEightMutationTargetTwentyThreeStatus",
    "marker": "PHASE3471_FORTY_EIGHT_TOOL_TARGET_TWENTY_THREE_OK",
    "path": "tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs"
  },
  {
    "phase": 3472,
    "exportName": "buildPhase3472FortyEightMutationTargetTwentyFourStatus",
    "marker": "PHASE3472_FORTY_EIGHT_TOOL_TARGET_TWENTY_FOUR_OK",
    "path": "tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs"
  },
  {
    "phase": 3473,
    "exportName": "buildPhase3473FortyEightMutationTargetTwentyFiveStatus",
    "marker": "PHASE3473_FORTY_EIGHT_TOOL_TARGET_TWENTY_FIVE_OK",
    "path": "tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs"
  },
  {
    "phase": 3474,
    "exportName": "buildPhase3474FortyEightMutationTargetTwentySixStatus",
    "marker": "PHASE3474_FORTY_EIGHT_TOOL_TARGET_TWENTY_SIX_OK",
    "path": "tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs"
  },
  {
    "phase": 3475,
    "exportName": "buildPhase3475FortyEightMutationTargetTwentySevenStatus",
    "marker": "PHASE3475_FORTY_EIGHT_TOOL_TARGET_TWENTY_SEVEN_OK",
    "path": "tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs"
  },
  {
    "phase": 3476,
    "exportName": "buildPhase3476FortyEightMutationTargetTwentyEightStatus",
    "marker": "PHASE3476_FORTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK",
    "path": "tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs"
  },
  {
    "phase": 3477,
    "exportName": "buildPhase3477FortyEightMutationTargetTwentyNineStatus",
    "marker": "PHASE3477_FORTY_EIGHT_TOOL_TARGET_TWENTY_NINE_OK",
    "path": "tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs"
  },
  {
    "phase": 3478,
    "exportName": "buildPhase3478FortyEightMutationTargetThirtyStatus",
    "marker": "PHASE3478_FORTY_EIGHT_TOOL_TARGET_THIRTY_OK",
    "path": "tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs"
  },
  {
    "phase": 3479,
    "exportName": "buildPhase3479FortyEightMutationTargetThirtyOneStatus",
    "marker": "PHASE3479_FORTY_EIGHT_TOOL_TARGET_THIRTY_ONE_OK",
    "path": "tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs"
  },
  {
    "phase": 3480,
    "exportName": "buildPhase3480FortyEightMutationTargetThirtyTwoStatus",
    "marker": "PHASE3480_FORTY_EIGHT_TOOL_TARGET_THIRTY_TWO_OK",
    "path": "tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs"
  },
  {
    "phase": 3481,
    "exportName": "buildPhase3481FortyEightMutationTargetThirtyThreeStatus",
    "marker": "PHASE3481_FORTY_EIGHT_TOOL_TARGET_THIRTY_THREE_OK",
    "path": "tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs"
  },
  {
    "phase": 3482,
    "exportName": "buildPhase3482FortyEightMutationTargetThirtyFourStatus",
    "marker": "PHASE3482_FORTY_EIGHT_TOOL_TARGET_THIRTY_FOUR_OK",
    "path": "tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs"
  },
  {
    "phase": 3483,
    "exportName": "buildPhase3483FortyEightMutationTargetThirtyFiveStatus",
    "marker": "PHASE3483_FORTY_EIGHT_TOOL_TARGET_THIRTY_FIVE_OK",
    "path": "tools/phase2807_2845/apply-controlled-thirty-four-tool-mutation.mjs"
  },
  {
    "phase": 3484,
    "exportName": "buildPhase3484FortyEightMutationTargetThirtySixStatus",
    "marker": "PHASE3484_FORTY_EIGHT_TOOL_TARGET_THIRTY_SIX_OK",
    "path": "tools/phase2846_2885/apply-controlled-thirty-five-tool-mutation.mjs"
  },
  {
    "phase": 3485,
    "exportName": "buildPhase3485FortyEightMutationTargetThirtySevenStatus",
    "marker": "PHASE3485_FORTY_EIGHT_TOOL_TARGET_THIRTY_SEVEN_OK",
    "path": "tools/phase2886_2926/apply-controlled-thirty-six-tool-mutation.mjs"
  },
  {
    "phase": 3486,
    "exportName": "buildPhase3486FortyEightMutationTargetThirtyEightStatus",
    "marker": "PHASE3486_FORTY_EIGHT_TOOL_TARGET_THIRTY_EIGHT_OK",
    "path": "tools/phase2927_2968/apply-controlled-thirty-seven-tool-mutation.mjs"
  },
  {
    "phase": 3487,
    "exportName": "buildPhase3487FortyEightMutationTargetThirtyNineStatus",
    "marker": "PHASE3487_FORTY_EIGHT_TOOL_TARGET_THIRTY_NINE_OK",
    "path": "tools/phase2969_3011/apply-controlled-thirty-eight-tool-mutation.mjs"
  },
  {
    "phase": 3488,
    "exportName": "buildPhase3488FortyEightMutationTargetFortyStatus",
    "marker": "PHASE3488_FORTY_EIGHT_TOOL_TARGET_FORTY_OK",
    "path": "tools/phase3012_3055/apply-controlled-thirty-nine-tool-mutation.mjs"
  },
  {
    "phase": 3489,
    "exportName": "buildPhase3489FortyEightMutationTargetFortyOneStatus",
    "marker": "PHASE3489_FORTY_EIGHT_TOOL_TARGET_FORTY_ONE_OK",
    "path": "tools/phase3056_3100/apply-controlled-forty-tool-mutation.mjs"
  },
  {
    "phase": 3490,
    "exportName": "buildPhase3490FortyEightMutationTargetFortyTwoStatus",
    "marker": "PHASE3490_FORTY_EIGHT_TOOL_TARGET_FORTY_TWO_OK",
    "path": "tools/phase3101_3146/apply-controlled-forty-one-tool-mutation.mjs"
  },
  {
    "phase": 3491,
    "exportName": "buildPhase3491FortyEightMutationTargetFortyThreeStatus",
    "marker": "PHASE3491_FORTY_EIGHT_TOOL_TARGET_FORTY_THREE_OK",
    "path": "tools/phase3147_3193/apply-controlled-forty-two-tool-mutation.mjs"
  },
  {
    "phase": 3492,
    "exportName": "buildPhase3492FortyEightMutationTargetFortyFourStatus",
    "marker": "PHASE3492_FORTY_EIGHT_TOOL_TARGET_FORTY_FOUR_OK",
    "path": "tools/phase3194_3241/apply-controlled-forty-three-tool-mutation.mjs"
  },
  {
    "phase": 3493,
    "exportName": "buildPhase3493FortyEightMutationTargetFortyFiveStatus",
    "marker": "PHASE3493_FORTY_EIGHT_TOOL_TARGET_FORTY_FIVE_OK",
    "path": "tools/phase3242_3290/apply-controlled-forty-four-tool-mutation.mjs"
  },
  {
    "phase": 3494,
    "exportName": "buildPhase3494FortyEightMutationTargetFortySixStatus",
    "marker": "PHASE3494_FORTY_EIGHT_TOOL_TARGET_FORTY_SIX_OK",
    "path": "tools/phase3291_3340/apply-controlled-forty-five-tool-mutation.mjs"
  },
  {
    "phase": 3495,
    "exportName": "buildPhase3495FortyEightMutationTargetFortySevenStatus",
    "marker": "PHASE3495_FORTY_EIGHT_TOOL_TARGET_FORTY_SEVEN_OK",
    "path": "tools/phase3341_3391/apply-controlled-forty-six-tool-mutation.mjs"
  },
  {
    "phase": 3496,
    "exportName": "buildPhase3496FortyEightMutationRuntimeStatus",
    "marker": "PHASE3496_FORTY_EIGHT_TOOL_TARGET_FORTY_EIGHT_OK",
    "path": "tools/phase3392_3443/apply-controlled-forty-seven-tool-mutation.mjs"
  }
];

async function loadStatus(target) {
  const moduleUrl = pathToFileURL(path.resolve(target.path)).href;
  const mod = await import(moduleUrl);
  const fn = mod[target.exportName];
  if (typeof fn !== "function") {
    throw new Error(`missing_export:${target.exportName}:${target.path}`);
  }
  const status = fn();
  if (status?.marker !== target.marker) {
    throw new Error(`marker_mismatch:${target.exportName}:${status?.marker || "missing"}`);
  }
  if (status?.providerCallsMade !== false || status?.codexExecExecuted !== false) {
    throw new Error(`boundary_flag_mismatch:${target.exportName}`);
  }
  return {
    phase: target.phase,
    exportName: target.exportName,
    marker: status.marker,
  };
}

async function main() {
  const results = [];
  for (const target of smokeTargets) {
    results.push(await loadStatus(target));
  }
  console.log(JSON.stringify({
    phaseId,
    status: "passed",
    smokeCount: results.length,
    providerCallsMade: false,
    codexExecExecuted: false,
    results,
  }, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
