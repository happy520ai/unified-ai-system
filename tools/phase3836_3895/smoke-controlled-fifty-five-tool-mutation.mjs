import { pathToFileURL } from "node:url";
import path from "node:path";

const phaseId = "Phase3836A-3895A-Controlled-Fifty-Five-Tool-Mutation";

const smokeTargets = [
  {
    "phase": 3841,
    "exportName": "buildPhase3841FiftyFiveMutationTargetOneStatus",
    "marker": "PHASE3841_FIFTY_FIVE_TOOL_TARGET_ONE_OK",
    "path": "tools/phase2091/generated-source-patch-target.mjs"
  },
  {
    "phase": 3842,
    "exportName": "buildPhase3842FiftyFiveMutationTargetTwoStatus",
    "marker": "PHASE3842_FIFTY_FIVE_TOOL_TARGET_TWO_OK",
    "path": "tools/phase2092/apply-controlled-existing-tool-mutation.mjs"
  },
  {
    "phase": 3843,
    "exportName": "buildPhase3843FiftyFiveMutationTargetThreeStatus",
    "marker": "PHASE3843_FIFTY_FIVE_TOOL_TARGET_THREE_OK",
    "path": "tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs"
  },
  {
    "phase": 3844,
    "exportName": "buildPhase3844FiftyFiveMutationTargetFourStatus",
    "marker": "PHASE3844_FIFTY_FIVE_TOOL_TARGET_FOUR_OK",
    "path": "tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs"
  },
  {
    "phase": 3845,
    "exportName": "buildPhase3845FiftyFiveMutationTargetFiveStatus",
    "marker": "PHASE3845_FIFTY_FIVE_TOOL_TARGET_FIVE_OK",
    "path": "tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs"
  },
  {
    "phase": 3846,
    "exportName": "buildPhase3846FiftyFiveMutationTargetSixStatus",
    "marker": "PHASE3846_FIFTY_FIVE_TOOL_TARGET_SIX_OK",
    "path": "tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs"
  },
  {
    "phase": 3847,
    "exportName": "buildPhase3847FiftyFiveMutationTargetSevenStatus",
    "marker": "PHASE3847_FIFTY_FIVE_TOOL_TARGET_SEVEN_OK",
    "path": "tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs"
  },
  {
    "phase": 3848,
    "exportName": "buildPhase3848FiftyFiveMutationTargetEightStatus",
    "marker": "PHASE3848_FIFTY_FIVE_TOOL_TARGET_EIGHT_OK",
    "path": "tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs"
  },
  {
    "phase": 3849,
    "exportName": "buildPhase3849FiftyFiveMutationTargetNineStatus",
    "marker": "PHASE3849_FIFTY_FIVE_TOOL_TARGET_NINE_OK",
    "path": "tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs"
  },
  {
    "phase": 3850,
    "exportName": "buildPhase3850FiftyFiveMutationTargetTenStatus",
    "marker": "PHASE3850_FIFTY_FIVE_TOOL_TARGET_TEN_OK",
    "path": "tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs"
  },
  {
    "phase": 3851,
    "exportName": "buildPhase3851FiftyFiveMutationTargetElevenStatus",
    "marker": "PHASE3851_FIFTY_FIVE_TOOL_TARGET_ELEVEN_OK",
    "path": "tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs"
  },
  {
    "phase": 3852,
    "exportName": "buildPhase3852FiftyFiveMutationTargetTwelveStatus",
    "marker": "PHASE3852_FIFTY_FIVE_TOOL_TARGET_TWELVE_OK",
    "path": "tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs"
  },
  {
    "phase": 3853,
    "exportName": "buildPhase3853FiftyFiveMutationTargetThirteenStatus",
    "marker": "PHASE3853_FIFTY_FIVE_TOOL_TARGET_THIRTEEN_OK",
    "path": "tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs"
  },
  {
    "phase": 3854,
    "exportName": "buildPhase3854FiftyFiveMutationTargetFourteenStatus",
    "marker": "PHASE3854_FIFTY_FIVE_TOOL_TARGET_FOURTEEN_OK",
    "path": "tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs"
  },
  {
    "phase": 3855,
    "exportName": "buildPhase3855FiftyFiveMutationTargetFifteenStatus",
    "marker": "PHASE3855_FIFTY_FIVE_TOOL_TARGET_FIFTEEN_OK",
    "path": "tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs"
  },
  {
    "phase": 3856,
    "exportName": "buildPhase3856FiftyFiveMutationTargetSixteenStatus",
    "marker": "PHASE3856_FIFTY_FIVE_TOOL_TARGET_SIXTEEN_OK",
    "path": "tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs"
  },
  {
    "phase": 3857,
    "exportName": "buildPhase3857FiftyFiveMutationTargetSeventeenStatus",
    "marker": "PHASE3857_FIFTY_FIVE_TOOL_TARGET_SEVENTEEN_OK",
    "path": "tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs"
  },
  {
    "phase": 3858,
    "exportName": "buildPhase3858FiftyFiveMutationTargetEighteenStatus",
    "marker": "PHASE3858_FIFTY_FIVE_TOOL_TARGET_EIGHTEEN_OK",
    "path": "tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs"
  },
  {
    "phase": 3859,
    "exportName": "buildPhase3859FiftyFiveMutationTargetNineteenStatus",
    "marker": "PHASE3859_FIFTY_FIVE_TOOL_TARGET_NINETEEN_OK",
    "path": "tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs"
  },
  {
    "phase": 3860,
    "exportName": "buildPhase3860FiftyFiveMutationTargetTwentyStatus",
    "marker": "PHASE3860_FIFTY_FIVE_TOOL_TARGET_TWENTY_OK",
    "path": "tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs"
  },
  {
    "phase": 3861,
    "exportName": "buildPhase3861FiftyFiveMutationTargetTwentyOneStatus",
    "marker": "PHASE3861_FIFTY_FIVE_TOOL_TARGET_TWENTY_ONE_OK",
    "path": "tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs"
  },
  {
    "phase": 3862,
    "exportName": "buildPhase3862FiftyFiveMutationTargetTwentyTwoStatus",
    "marker": "PHASE3862_FIFTY_FIVE_TOOL_TARGET_TWENTY_TWO_OK",
    "path": "tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs"
  },
  {
    "phase": 3863,
    "exportName": "buildPhase3863FiftyFiveMutationTargetTwentyThreeStatus",
    "marker": "PHASE3863_FIFTY_FIVE_TOOL_TARGET_TWENTY_THREE_OK",
    "path": "tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs"
  },
  {
    "phase": 3864,
    "exportName": "buildPhase3864FiftyFiveMutationTargetTwentyFourStatus",
    "marker": "PHASE3864_FIFTY_FIVE_TOOL_TARGET_TWENTY_FOUR_OK",
    "path": "tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs"
  },
  {
    "phase": 3865,
    "exportName": "buildPhase3865FiftyFiveMutationTargetTwentyFiveStatus",
    "marker": "PHASE3865_FIFTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK",
    "path": "tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs"
  },
  {
    "phase": 3866,
    "exportName": "buildPhase3866FiftyFiveMutationTargetTwentySixStatus",
    "marker": "PHASE3866_FIFTY_FIVE_TOOL_TARGET_TWENTY_SIX_OK",
    "path": "tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs"
  },
  {
    "phase": 3867,
    "exportName": "buildPhase3867FiftyFiveMutationTargetTwentySevenStatus",
    "marker": "PHASE3867_FIFTY_FIVE_TOOL_TARGET_TWENTY_SEVEN_OK",
    "path": "tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs"
  },
  {
    "phase": 3868,
    "exportName": "buildPhase3868FiftyFiveMutationTargetTwentyEightStatus",
    "marker": "PHASE3868_FIFTY_FIVE_TOOL_TARGET_TWENTY_EIGHT_OK",
    "path": "tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs"
  },
  {
    "phase": 3869,
    "exportName": "buildPhase3869FiftyFiveMutationTargetTwentyNineStatus",
    "marker": "PHASE3869_FIFTY_FIVE_TOOL_TARGET_TWENTY_NINE_OK",
    "path": "tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs"
  },
  {
    "phase": 3870,
    "exportName": "buildPhase3870FiftyFiveMutationTargetThirtyStatus",
    "marker": "PHASE3870_FIFTY_FIVE_TOOL_TARGET_THIRTY_OK",
    "path": "tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs"
  },
  {
    "phase": 3871,
    "exportName": "buildPhase3871FiftyFiveMutationTargetThirtyOneStatus",
    "marker": "PHASE3871_FIFTY_FIVE_TOOL_TARGET_THIRTY_ONE_OK",
    "path": "tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs"
  },
  {
    "phase": 3872,
    "exportName": "buildPhase3872FiftyFiveMutationTargetThirtyTwoStatus",
    "marker": "PHASE3872_FIFTY_FIVE_TOOL_TARGET_THIRTY_TWO_OK",
    "path": "tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs"
  },
  {
    "phase": 3873,
    "exportName": "buildPhase3873FiftyFiveMutationTargetThirtyThreeStatus",
    "marker": "PHASE3873_FIFTY_FIVE_TOOL_TARGET_THIRTY_THREE_OK",
    "path": "tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs"
  },
  {
    "phase": 3874,
    "exportName": "buildPhase3874FiftyFiveMutationTargetThirtyFourStatus",
    "marker": "PHASE3874_FIFTY_FIVE_TOOL_TARGET_THIRTY_FOUR_OK",
    "path": "tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs"
  },
  {
    "phase": 3875,
    "exportName": "buildPhase3875FiftyFiveMutationTargetThirtyFiveStatus",
    "marker": "PHASE3875_FIFTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK",
    "path": "tools/phase2807_2845/apply-controlled-thirty-four-tool-mutation.mjs"
  },
  {
    "phase": 3876,
    "exportName": "buildPhase3876FiftyFiveMutationTargetThirtySixStatus",
    "marker": "PHASE3876_FIFTY_FIVE_TOOL_TARGET_THIRTY_SIX_OK",
    "path": "tools/phase2846_2885/apply-controlled-thirty-five-tool-mutation.mjs"
  },
  {
    "phase": 3877,
    "exportName": "buildPhase3877FiftyFiveMutationTargetThirtySevenStatus",
    "marker": "PHASE3877_FIFTY_FIVE_TOOL_TARGET_THIRTY_SEVEN_OK",
    "path": "tools/phase2886_2926/apply-controlled-thirty-six-tool-mutation.mjs"
  },
  {
    "phase": 3878,
    "exportName": "buildPhase3878FiftyFiveMutationTargetThirtyEightStatus",
    "marker": "PHASE3878_FIFTY_FIVE_TOOL_TARGET_THIRTY_EIGHT_OK",
    "path": "tools/phase2927_2968/apply-controlled-thirty-seven-tool-mutation.mjs"
  },
  {
    "phase": 3879,
    "exportName": "buildPhase3879FiftyFiveMutationTargetThirtyNineStatus",
    "marker": "PHASE3879_FIFTY_FIVE_TOOL_TARGET_THIRTY_NINE_OK",
    "path": "tools/phase2969_3011/apply-controlled-thirty-eight-tool-mutation.mjs"
  },
  {
    "phase": 3880,
    "exportName": "buildPhase3880FiftyFiveMutationTargetFortyStatus",
    "marker": "PHASE3880_FIFTY_FIVE_TOOL_TARGET_FORTY_OK",
    "path": "tools/phase3012_3055/apply-controlled-thirty-nine-tool-mutation.mjs"
  },
  {
    "phase": 3881,
    "exportName": "buildPhase3881FiftyFiveMutationTargetFortyOneStatus",
    "marker": "PHASE3881_FIFTY_FIVE_TOOL_TARGET_FORTY_ONE_OK",
    "path": "tools/phase3056_3100/apply-controlled-forty-tool-mutation.mjs"
  },
  {
    "phase": 3882,
    "exportName": "buildPhase3882FiftyFiveMutationTargetFortyTwoStatus",
    "marker": "PHASE3882_FIFTY_FIVE_TOOL_TARGET_FORTY_TWO_OK",
    "path": "tools/phase3101_3146/apply-controlled-forty-one-tool-mutation.mjs"
  },
  {
    "phase": 3883,
    "exportName": "buildPhase3883FiftyFiveMutationTargetFortyThreeStatus",
    "marker": "PHASE3883_FIFTY_FIVE_TOOL_TARGET_FORTY_THREE_OK",
    "path": "tools/phase3147_3193/apply-controlled-forty-two-tool-mutation.mjs"
  },
  {
    "phase": 3884,
    "exportName": "buildPhase3884FiftyFiveMutationTargetFortyFourStatus",
    "marker": "PHASE3884_FIFTY_FIVE_TOOL_TARGET_FORTY_FOUR_OK",
    "path": "tools/phase3194_3241/apply-controlled-forty-three-tool-mutation.mjs"
  },
  {
    "phase": 3885,
    "exportName": "buildPhase3885FiftyFiveMutationTargetFortyFiveStatus",
    "marker": "PHASE3885_FIFTY_FIVE_TOOL_TARGET_FORTY_FIVE_OK",
    "path": "tools/phase3242_3290/apply-controlled-forty-four-tool-mutation.mjs"
  },
  {
    "phase": 3886,
    "exportName": "buildPhase3886FiftyFiveMutationTargetFortySixStatus",
    "marker": "PHASE3886_FIFTY_FIVE_TOOL_TARGET_FORTY_SIX_OK",
    "path": "tools/phase3291_3340/apply-controlled-forty-five-tool-mutation.mjs"
  },
  {
    "phase": 3887,
    "exportName": "buildPhase3887FiftyFiveMutationTargetFortySevenStatus",
    "marker": "PHASE3887_FIFTY_FIVE_TOOL_TARGET_FORTY_SEVEN_OK",
    "path": "tools/phase3341_3391/apply-controlled-forty-six-tool-mutation.mjs"
  },
  {
    "phase": 3888,
    "exportName": "buildPhase3888FiftyFiveMutationTargetFortyEightStatus",
    "marker": "PHASE3888_FIFTY_FIVE_TOOL_TARGET_FORTY_EIGHT_OK",
    "path": "tools/phase3392_3443/apply-controlled-forty-seven-tool-mutation.mjs"
  },
  {
    "phase": 3889,
    "exportName": "buildPhase3889FiftyFiveMutationTargetFortyNineStatus",
    "marker": "PHASE3889_FIFTY_FIVE_TOOL_TARGET_FORTY_NINE_OK",
    "path": "tools/phase3444_3496/apply-controlled-forty-eight-tool-mutation.mjs"
  },
  {
    "phase": 3890,
    "exportName": "buildPhase3890FiftyFiveMutationTargetFiftyStatus",
    "marker": "PHASE3890_FIFTY_FIVE_TOOL_TARGET_FIFTY_OK",
    "path": "tools/phase3497_3550/apply-controlled-forty-nine-tool-mutation.mjs"
  },
  {
    "phase": 3891,
    "exportName": "buildPhase3891FiftyFiveMutationTargetFiftyOneStatus",
    "marker": "PHASE3891_FIFTY_FIVE_TOOL_TARGET_FIFTY_ONE_OK",
    "path": "tools/phase3551_3605/apply-controlled-fifty-tool-mutation.mjs"
  },
  {
    "phase": 3892,
    "exportName": "buildPhase3892FiftyFiveMutationTargetFiftyTwoStatus",
    "marker": "PHASE3892_FIFTY_FIVE_TOOL_TARGET_FIFTY_TWO_OK",
    "path": "tools/phase3606_3661/apply-controlled-fifty-one-tool-mutation.mjs"
  },
  {
    "phase": 3893,
    "exportName": "buildPhase3893FiftyFiveMutationTargetFiftyThreeStatus",
    "marker": "PHASE3893_FIFTY_FIVE_TOOL_TARGET_FIFTY_THREE_OK",
    "path": "tools/phase3662_3718/apply-controlled-fifty-two-tool-mutation.mjs"
  },
  {
    "phase": 3894,
    "exportName": "buildPhase3894FiftyFiveMutationTargetFiftyFourStatus",
    "marker": "PHASE3894_FIFTY_FIVE_TOOL_TARGET_FIFTY_FOUR_OK",
    "path": "tools/phase3719_3776/apply-controlled-fifty-three-tool-mutation.mjs"
  },
  {
    "phase": 3895,
    "exportName": "buildPhase3895FiftyFiveMutationRuntimeStatus",
    "marker": "PHASE3895_FIFTY_FIVE_TOOL_TARGET_FIFTY_FIVE_OK",
    "path": "tools/phase3777_3835/apply-controlled-fifty-four-tool-mutation.mjs"
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
