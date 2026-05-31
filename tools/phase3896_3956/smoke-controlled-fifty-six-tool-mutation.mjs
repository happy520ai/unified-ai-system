import { pathToFileURL } from "node:url";
import path from "node:path";

const phaseId = "Phase3896A-3956A-Controlled-Fifty-Six-Tool-Mutation";

const smokeTargets = [
  {
    "phase": 3901,
    "exportName": "buildPhase3901FiftySixMutationTargetOneStatus",
    "marker": "PHASE3901_FIFTY_SIX_TOOL_TARGET_ONE_OK",
    "path": "tools/phase2091/generated-source-patch-target.mjs"
  },
  {
    "phase": 3902,
    "exportName": "buildPhase3902FiftySixMutationTargetTwoStatus",
    "marker": "PHASE3902_FIFTY_SIX_TOOL_TARGET_TWO_OK",
    "path": "tools/phase2092/apply-controlled-existing-tool-mutation.mjs"
  },
  {
    "phase": 3903,
    "exportName": "buildPhase3903FiftySixMutationTargetThreeStatus",
    "marker": "PHASE3903_FIFTY_SIX_TOOL_TARGET_THREE_OK",
    "path": "tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs"
  },
  {
    "phase": 3904,
    "exportName": "buildPhase3904FiftySixMutationTargetFourStatus",
    "marker": "PHASE3904_FIFTY_SIX_TOOL_TARGET_FOUR_OK",
    "path": "tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs"
  },
  {
    "phase": 3905,
    "exportName": "buildPhase3905FiftySixMutationTargetFiveStatus",
    "marker": "PHASE3905_FIFTY_SIX_TOOL_TARGET_FIVE_OK",
    "path": "tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs"
  },
  {
    "phase": 3906,
    "exportName": "buildPhase3906FiftySixMutationTargetSixStatus",
    "marker": "PHASE3906_FIFTY_SIX_TOOL_TARGET_SIX_OK",
    "path": "tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs"
  },
  {
    "phase": 3907,
    "exportName": "buildPhase3907FiftySixMutationTargetSevenStatus",
    "marker": "PHASE3907_FIFTY_SIX_TOOL_TARGET_SEVEN_OK",
    "path": "tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs"
  },
  {
    "phase": 3908,
    "exportName": "buildPhase3908FiftySixMutationTargetEightStatus",
    "marker": "PHASE3908_FIFTY_SIX_TOOL_TARGET_EIGHT_OK",
    "path": "tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs"
  },
  {
    "phase": 3909,
    "exportName": "buildPhase3909FiftySixMutationTargetNineStatus",
    "marker": "PHASE3909_FIFTY_SIX_TOOL_TARGET_NINE_OK",
    "path": "tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs"
  },
  {
    "phase": 3910,
    "exportName": "buildPhase3910FiftySixMutationTargetTenStatus",
    "marker": "PHASE3910_FIFTY_SIX_TOOL_TARGET_TEN_OK",
    "path": "tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs"
  },
  {
    "phase": 3911,
    "exportName": "buildPhase3911FiftySixMutationTargetElevenStatus",
    "marker": "PHASE3911_FIFTY_SIX_TOOL_TARGET_ELEVEN_OK",
    "path": "tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs"
  },
  {
    "phase": 3912,
    "exportName": "buildPhase3912FiftySixMutationTargetTwelveStatus",
    "marker": "PHASE3912_FIFTY_SIX_TOOL_TARGET_TWELVE_OK",
    "path": "tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs"
  },
  {
    "phase": 3913,
    "exportName": "buildPhase3913FiftySixMutationTargetThirteenStatus",
    "marker": "PHASE3913_FIFTY_SIX_TOOL_TARGET_THIRTEEN_OK",
    "path": "tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs"
  },
  {
    "phase": 3914,
    "exportName": "buildPhase3914FiftySixMutationTargetFourteenStatus",
    "marker": "PHASE3914_FIFTY_SIX_TOOL_TARGET_FOURTEEN_OK",
    "path": "tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs"
  },
  {
    "phase": 3915,
    "exportName": "buildPhase3915FiftySixMutationTargetFifteenStatus",
    "marker": "PHASE3915_FIFTY_SIX_TOOL_TARGET_FIFTEEN_OK",
    "path": "tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs"
  },
  {
    "phase": 3916,
    "exportName": "buildPhase3916FiftySixMutationTargetSixteenStatus",
    "marker": "PHASE3916_FIFTY_SIX_TOOL_TARGET_SIXTEEN_OK",
    "path": "tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs"
  },
  {
    "phase": 3917,
    "exportName": "buildPhase3917FiftySixMutationTargetSeventeenStatus",
    "marker": "PHASE3917_FIFTY_SIX_TOOL_TARGET_SEVENTEEN_OK",
    "path": "tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs"
  },
  {
    "phase": 3918,
    "exportName": "buildPhase3918FiftySixMutationTargetEighteenStatus",
    "marker": "PHASE3918_FIFTY_SIX_TOOL_TARGET_EIGHTEEN_OK",
    "path": "tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs"
  },
  {
    "phase": 3919,
    "exportName": "buildPhase3919FiftySixMutationTargetNineteenStatus",
    "marker": "PHASE3919_FIFTY_SIX_TOOL_TARGET_NINETEEN_OK",
    "path": "tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs"
  },
  {
    "phase": 3920,
    "exportName": "buildPhase3920FiftySixMutationTargetTwentyStatus",
    "marker": "PHASE3920_FIFTY_SIX_TOOL_TARGET_TWENTY_OK",
    "path": "tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs"
  },
  {
    "phase": 3921,
    "exportName": "buildPhase3921FiftySixMutationTargetTwentyOneStatus",
    "marker": "PHASE3921_FIFTY_SIX_TOOL_TARGET_TWENTY_ONE_OK",
    "path": "tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs"
  },
  {
    "phase": 3922,
    "exportName": "buildPhase3922FiftySixMutationTargetTwentyTwoStatus",
    "marker": "PHASE3922_FIFTY_SIX_TOOL_TARGET_TWENTY_TWO_OK",
    "path": "tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs"
  },
  {
    "phase": 3923,
    "exportName": "buildPhase3923FiftySixMutationTargetTwentyThreeStatus",
    "marker": "PHASE3923_FIFTY_SIX_TOOL_TARGET_TWENTY_THREE_OK",
    "path": "tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs"
  },
  {
    "phase": 3924,
    "exportName": "buildPhase3924FiftySixMutationTargetTwentyFourStatus",
    "marker": "PHASE3924_FIFTY_SIX_TOOL_TARGET_TWENTY_FOUR_OK",
    "path": "tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs"
  },
  {
    "phase": 3925,
    "exportName": "buildPhase3925FiftySixMutationTargetTwentyFiveStatus",
    "marker": "PHASE3925_FIFTY_SIX_TOOL_TARGET_TWENTY_FIVE_OK",
    "path": "tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs"
  },
  {
    "phase": 3926,
    "exportName": "buildPhase3926FiftySixMutationTargetTwentySixStatus",
    "marker": "PHASE3926_FIFTY_SIX_TOOL_TARGET_TWENTY_SIX_OK",
    "path": "tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs"
  },
  {
    "phase": 3927,
    "exportName": "buildPhase3927FiftySixMutationTargetTwentySevenStatus",
    "marker": "PHASE3927_FIFTY_SIX_TOOL_TARGET_TWENTY_SEVEN_OK",
    "path": "tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs"
  },
  {
    "phase": 3928,
    "exportName": "buildPhase3928FiftySixMutationTargetTwentyEightStatus",
    "marker": "PHASE3928_FIFTY_SIX_TOOL_TARGET_TWENTY_EIGHT_OK",
    "path": "tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs"
  },
  {
    "phase": 3929,
    "exportName": "buildPhase3929FiftySixMutationTargetTwentyNineStatus",
    "marker": "PHASE3929_FIFTY_SIX_TOOL_TARGET_TWENTY_NINE_OK",
    "path": "tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs"
  },
  {
    "phase": 3930,
    "exportName": "buildPhase3930FiftySixMutationTargetThirtyStatus",
    "marker": "PHASE3930_FIFTY_SIX_TOOL_TARGET_THIRTY_OK",
    "path": "tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs"
  },
  {
    "phase": 3931,
    "exportName": "buildPhase3931FiftySixMutationTargetThirtyOneStatus",
    "marker": "PHASE3931_FIFTY_SIX_TOOL_TARGET_THIRTY_ONE_OK",
    "path": "tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs"
  },
  {
    "phase": 3932,
    "exportName": "buildPhase3932FiftySixMutationTargetThirtyTwoStatus",
    "marker": "PHASE3932_FIFTY_SIX_TOOL_TARGET_THIRTY_TWO_OK",
    "path": "tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs"
  },
  {
    "phase": 3933,
    "exportName": "buildPhase3933FiftySixMutationTargetThirtyThreeStatus",
    "marker": "PHASE3933_FIFTY_SIX_TOOL_TARGET_THIRTY_THREE_OK",
    "path": "tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs"
  },
  {
    "phase": 3934,
    "exportName": "buildPhase3934FiftySixMutationTargetThirtyFourStatus",
    "marker": "PHASE3934_FIFTY_SIX_TOOL_TARGET_THIRTY_FOUR_OK",
    "path": "tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs"
  },
  {
    "phase": 3935,
    "exportName": "buildPhase3935FiftySixMutationTargetThirtyFiveStatus",
    "marker": "PHASE3935_FIFTY_SIX_TOOL_TARGET_THIRTY_FIVE_OK",
    "path": "tools/phase2807_2845/apply-controlled-thirty-four-tool-mutation.mjs"
  },
  {
    "phase": 3936,
    "exportName": "buildPhase3936FiftySixMutationTargetThirtySixStatus",
    "marker": "PHASE3936_FIFTY_SIX_TOOL_TARGET_THIRTY_SIX_OK",
    "path": "tools/phase2846_2885/apply-controlled-thirty-five-tool-mutation.mjs"
  },
  {
    "phase": 3937,
    "exportName": "buildPhase3937FiftySixMutationTargetThirtySevenStatus",
    "marker": "PHASE3937_FIFTY_SIX_TOOL_TARGET_THIRTY_SEVEN_OK",
    "path": "tools/phase2886_2926/apply-controlled-thirty-six-tool-mutation.mjs"
  },
  {
    "phase": 3938,
    "exportName": "buildPhase3938FiftySixMutationTargetThirtyEightStatus",
    "marker": "PHASE3938_FIFTY_SIX_TOOL_TARGET_THIRTY_EIGHT_OK",
    "path": "tools/phase2927_2968/apply-controlled-thirty-seven-tool-mutation.mjs"
  },
  {
    "phase": 3939,
    "exportName": "buildPhase3939FiftySixMutationTargetThirtyNineStatus",
    "marker": "PHASE3939_FIFTY_SIX_TOOL_TARGET_THIRTY_NINE_OK",
    "path": "tools/phase2969_3011/apply-controlled-thirty-eight-tool-mutation.mjs"
  },
  {
    "phase": 3940,
    "exportName": "buildPhase3940FiftySixMutationTargetFortyStatus",
    "marker": "PHASE3940_FIFTY_SIX_TOOL_TARGET_FORTY_OK",
    "path": "tools/phase3012_3055/apply-controlled-thirty-nine-tool-mutation.mjs"
  },
  {
    "phase": 3941,
    "exportName": "buildPhase3941FiftySixMutationTargetFortyOneStatus",
    "marker": "PHASE3941_FIFTY_SIX_TOOL_TARGET_FORTY_ONE_OK",
    "path": "tools/phase3056_3100/apply-controlled-forty-tool-mutation.mjs"
  },
  {
    "phase": 3942,
    "exportName": "buildPhase3942FiftySixMutationTargetFortyTwoStatus",
    "marker": "PHASE3942_FIFTY_SIX_TOOL_TARGET_FORTY_TWO_OK",
    "path": "tools/phase3101_3146/apply-controlled-forty-one-tool-mutation.mjs"
  },
  {
    "phase": 3943,
    "exportName": "buildPhase3943FiftySixMutationTargetFortyThreeStatus",
    "marker": "PHASE3943_FIFTY_SIX_TOOL_TARGET_FORTY_THREE_OK",
    "path": "tools/phase3147_3193/apply-controlled-forty-two-tool-mutation.mjs"
  },
  {
    "phase": 3944,
    "exportName": "buildPhase3944FiftySixMutationTargetFortyFourStatus",
    "marker": "PHASE3944_FIFTY_SIX_TOOL_TARGET_FORTY_FOUR_OK",
    "path": "tools/phase3194_3241/apply-controlled-forty-three-tool-mutation.mjs"
  },
  {
    "phase": 3945,
    "exportName": "buildPhase3945FiftySixMutationTargetFortyFiveStatus",
    "marker": "PHASE3945_FIFTY_SIX_TOOL_TARGET_FORTY_FIVE_OK",
    "path": "tools/phase3242_3290/apply-controlled-forty-four-tool-mutation.mjs"
  },
  {
    "phase": 3946,
    "exportName": "buildPhase3946FiftySixMutationTargetFortySixStatus",
    "marker": "PHASE3946_FIFTY_SIX_TOOL_TARGET_FORTY_SIX_OK",
    "path": "tools/phase3291_3340/apply-controlled-forty-five-tool-mutation.mjs"
  },
  {
    "phase": 3947,
    "exportName": "buildPhase3947FiftySixMutationTargetFortySevenStatus",
    "marker": "PHASE3947_FIFTY_SIX_TOOL_TARGET_FORTY_SEVEN_OK",
    "path": "tools/phase3341_3391/apply-controlled-forty-six-tool-mutation.mjs"
  },
  {
    "phase": 3948,
    "exportName": "buildPhase3948FiftySixMutationTargetFortyEightStatus",
    "marker": "PHASE3948_FIFTY_SIX_TOOL_TARGET_FORTY_EIGHT_OK",
    "path": "tools/phase3392_3443/apply-controlled-forty-seven-tool-mutation.mjs"
  },
  {
    "phase": 3949,
    "exportName": "buildPhase3949FiftySixMutationTargetFortyNineStatus",
    "marker": "PHASE3949_FIFTY_SIX_TOOL_TARGET_FORTY_NINE_OK",
    "path": "tools/phase3444_3496/apply-controlled-forty-eight-tool-mutation.mjs"
  },
  {
    "phase": 3950,
    "exportName": "buildPhase3950FiftySixMutationTargetFiftyStatus",
    "marker": "PHASE3950_FIFTY_SIX_TOOL_TARGET_FIFTY_OK",
    "path": "tools/phase3497_3550/apply-controlled-forty-nine-tool-mutation.mjs"
  },
  {
    "phase": 3951,
    "exportName": "buildPhase3951FiftySixMutationTargetFiftyOneStatus",
    "marker": "PHASE3951_FIFTY_SIX_TOOL_TARGET_FIFTY_ONE_OK",
    "path": "tools/phase3551_3605/apply-controlled-fifty-tool-mutation.mjs"
  },
  {
    "phase": 3952,
    "exportName": "buildPhase3952FiftySixMutationTargetFiftyTwoStatus",
    "marker": "PHASE3952_FIFTY_SIX_TOOL_TARGET_FIFTY_TWO_OK",
    "path": "tools/phase3606_3661/apply-controlled-fifty-one-tool-mutation.mjs"
  },
  {
    "phase": 3953,
    "exportName": "buildPhase3953FiftySixMutationTargetFiftyThreeStatus",
    "marker": "PHASE3953_FIFTY_SIX_TOOL_TARGET_FIFTY_THREE_OK",
    "path": "tools/phase3662_3718/apply-controlled-fifty-two-tool-mutation.mjs"
  },
  {
    "phase": 3954,
    "exportName": "buildPhase3954FiftySixMutationTargetFiftyFourStatus",
    "marker": "PHASE3954_FIFTY_SIX_TOOL_TARGET_FIFTY_FOUR_OK",
    "path": "tools/phase3719_3776/apply-controlled-fifty-three-tool-mutation.mjs"
  },
  {
    "phase": 3955,
    "exportName": "buildPhase3955FiftySixMutationTargetFiftyFiveStatus",
    "marker": "PHASE3955_FIFTY_SIX_TOOL_TARGET_FIFTY_FIVE_OK",
    "path": "tools/phase3777_3835/apply-controlled-fifty-four-tool-mutation.mjs"
  },
  {
    "phase": 3956,
    "exportName": "buildPhase3956FiftySixMutationRuntimeStatus",
    "marker": "PHASE3956_FIFTY_SIX_TOOL_TARGET_FIFTY_SIX_OK",
    "path": "tools/phase3836_3895/apply-controlled-fifty-five-tool-mutation.mjs"
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
