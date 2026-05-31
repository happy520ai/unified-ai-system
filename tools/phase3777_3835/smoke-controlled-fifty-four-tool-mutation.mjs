import { pathToFileURL } from "node:url";
import path from "node:path";

const phaseId = "Phase3777A-3835A-Controlled-Fifty-Four-Tool-Mutation";

const smokeTargets = [
  {
    "phase": 3782,
    "exportName": "buildPhase3782FiftyFourMutationTargetOneStatus",
    "marker": "PHASE3782_FIFTY_FOUR_TOOL_TARGET_ONE_OK",
    "path": "tools/phase2091/generated-source-patch-target.mjs"
  },
  {
    "phase": 3783,
    "exportName": "buildPhase3783FiftyFourMutationTargetTwoStatus",
    "marker": "PHASE3783_FIFTY_FOUR_TOOL_TARGET_TWO_OK",
    "path": "tools/phase2092/apply-controlled-existing-tool-mutation.mjs"
  },
  {
    "phase": 3784,
    "exportName": "buildPhase3784FiftyFourMutationTargetThreeStatus",
    "marker": "PHASE3784_FIFTY_FOUR_TOOL_TARGET_THREE_OK",
    "path": "tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs"
  },
  {
    "phase": 3785,
    "exportName": "buildPhase3785FiftyFourMutationTargetFourStatus",
    "marker": "PHASE3785_FIFTY_FOUR_TOOL_TARGET_FOUR_OK",
    "path": "tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs"
  },
  {
    "phase": 3786,
    "exportName": "buildPhase3786FiftyFourMutationTargetFiveStatus",
    "marker": "PHASE3786_FIFTY_FOUR_TOOL_TARGET_FIVE_OK",
    "path": "tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs"
  },
  {
    "phase": 3787,
    "exportName": "buildPhase3787FiftyFourMutationTargetSixStatus",
    "marker": "PHASE3787_FIFTY_FOUR_TOOL_TARGET_SIX_OK",
    "path": "tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs"
  },
  {
    "phase": 3788,
    "exportName": "buildPhase3788FiftyFourMutationTargetSevenStatus",
    "marker": "PHASE3788_FIFTY_FOUR_TOOL_TARGET_SEVEN_OK",
    "path": "tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs"
  },
  {
    "phase": 3789,
    "exportName": "buildPhase3789FiftyFourMutationTargetEightStatus",
    "marker": "PHASE3789_FIFTY_FOUR_TOOL_TARGET_EIGHT_OK",
    "path": "tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs"
  },
  {
    "phase": 3790,
    "exportName": "buildPhase3790FiftyFourMutationTargetNineStatus",
    "marker": "PHASE3790_FIFTY_FOUR_TOOL_TARGET_NINE_OK",
    "path": "tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs"
  },
  {
    "phase": 3791,
    "exportName": "buildPhase3791FiftyFourMutationTargetTenStatus",
    "marker": "PHASE3791_FIFTY_FOUR_TOOL_TARGET_TEN_OK",
    "path": "tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs"
  },
  {
    "phase": 3792,
    "exportName": "buildPhase3792FiftyFourMutationTargetElevenStatus",
    "marker": "PHASE3792_FIFTY_FOUR_TOOL_TARGET_ELEVEN_OK",
    "path": "tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs"
  },
  {
    "phase": 3793,
    "exportName": "buildPhase3793FiftyFourMutationTargetTwelveStatus",
    "marker": "PHASE3793_FIFTY_FOUR_TOOL_TARGET_TWELVE_OK",
    "path": "tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs"
  },
  {
    "phase": 3794,
    "exportName": "buildPhase3794FiftyFourMutationTargetThirteenStatus",
    "marker": "PHASE3794_FIFTY_FOUR_TOOL_TARGET_THIRTEEN_OK",
    "path": "tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs"
  },
  {
    "phase": 3795,
    "exportName": "buildPhase3795FiftyFourMutationTargetFourteenStatus",
    "marker": "PHASE3795_FIFTY_FOUR_TOOL_TARGET_FOURTEEN_OK",
    "path": "tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs"
  },
  {
    "phase": 3796,
    "exportName": "buildPhase3796FiftyFourMutationTargetFifteenStatus",
    "marker": "PHASE3796_FIFTY_FOUR_TOOL_TARGET_FIFTEEN_OK",
    "path": "tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs"
  },
  {
    "phase": 3797,
    "exportName": "buildPhase3797FiftyFourMutationTargetSixteenStatus",
    "marker": "PHASE3797_FIFTY_FOUR_TOOL_TARGET_SIXTEEN_OK",
    "path": "tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs"
  },
  {
    "phase": 3798,
    "exportName": "buildPhase3798FiftyFourMutationTargetSeventeenStatus",
    "marker": "PHASE3798_FIFTY_FOUR_TOOL_TARGET_SEVENTEEN_OK",
    "path": "tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs"
  },
  {
    "phase": 3799,
    "exportName": "buildPhase3799FiftyFourMutationTargetEighteenStatus",
    "marker": "PHASE3799_FIFTY_FOUR_TOOL_TARGET_EIGHTEEN_OK",
    "path": "tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs"
  },
  {
    "phase": 3800,
    "exportName": "buildPhase3800FiftyFourMutationTargetNineteenStatus",
    "marker": "PHASE3800_FIFTY_FOUR_TOOL_TARGET_NINETEEN_OK",
    "path": "tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs"
  },
  {
    "phase": 3801,
    "exportName": "buildPhase3801FiftyFourMutationTargetTwentyStatus",
    "marker": "PHASE3801_FIFTY_FOUR_TOOL_TARGET_TWENTY_OK",
    "path": "tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs"
  },
  {
    "phase": 3802,
    "exportName": "buildPhase3802FiftyFourMutationTargetTwentyOneStatus",
    "marker": "PHASE3802_FIFTY_FOUR_TOOL_TARGET_TWENTY_ONE_OK",
    "path": "tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs"
  },
  {
    "phase": 3803,
    "exportName": "buildPhase3803FiftyFourMutationTargetTwentyTwoStatus",
    "marker": "PHASE3803_FIFTY_FOUR_TOOL_TARGET_TWENTY_TWO_OK",
    "path": "tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs"
  },
  {
    "phase": 3804,
    "exportName": "buildPhase3804FiftyFourMutationTargetTwentyThreeStatus",
    "marker": "PHASE3804_FIFTY_FOUR_TOOL_TARGET_TWENTY_THREE_OK",
    "path": "tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs"
  },
  {
    "phase": 3805,
    "exportName": "buildPhase3805FiftyFourMutationTargetTwentyFourStatus",
    "marker": "PHASE3805_FIFTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK",
    "path": "tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs"
  },
  {
    "phase": 3806,
    "exportName": "buildPhase3806FiftyFourMutationTargetTwentyFiveStatus",
    "marker": "PHASE3806_FIFTY_FOUR_TOOL_TARGET_TWENTY_FIVE_OK",
    "path": "tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs"
  },
  {
    "phase": 3807,
    "exportName": "buildPhase3807FiftyFourMutationTargetTwentySixStatus",
    "marker": "PHASE3807_FIFTY_FOUR_TOOL_TARGET_TWENTY_SIX_OK",
    "path": "tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs"
  },
  {
    "phase": 3808,
    "exportName": "buildPhase3808FiftyFourMutationTargetTwentySevenStatus",
    "marker": "PHASE3808_FIFTY_FOUR_TOOL_TARGET_TWENTY_SEVEN_OK",
    "path": "tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs"
  },
  {
    "phase": 3809,
    "exportName": "buildPhase3809FiftyFourMutationTargetTwentyEightStatus",
    "marker": "PHASE3809_FIFTY_FOUR_TOOL_TARGET_TWENTY_EIGHT_OK",
    "path": "tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs"
  },
  {
    "phase": 3810,
    "exportName": "buildPhase3810FiftyFourMutationTargetTwentyNineStatus",
    "marker": "PHASE3810_FIFTY_FOUR_TOOL_TARGET_TWENTY_NINE_OK",
    "path": "tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs"
  },
  {
    "phase": 3811,
    "exportName": "buildPhase3811FiftyFourMutationTargetThirtyStatus",
    "marker": "PHASE3811_FIFTY_FOUR_TOOL_TARGET_THIRTY_OK",
    "path": "tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs"
  },
  {
    "phase": 3812,
    "exportName": "buildPhase3812FiftyFourMutationTargetThirtyOneStatus",
    "marker": "PHASE3812_FIFTY_FOUR_TOOL_TARGET_THIRTY_ONE_OK",
    "path": "tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs"
  },
  {
    "phase": 3813,
    "exportName": "buildPhase3813FiftyFourMutationTargetThirtyTwoStatus",
    "marker": "PHASE3813_FIFTY_FOUR_TOOL_TARGET_THIRTY_TWO_OK",
    "path": "tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs"
  },
  {
    "phase": 3814,
    "exportName": "buildPhase3814FiftyFourMutationTargetThirtyThreeStatus",
    "marker": "PHASE3814_FIFTY_FOUR_TOOL_TARGET_THIRTY_THREE_OK",
    "path": "tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs"
  },
  {
    "phase": 3815,
    "exportName": "buildPhase3815FiftyFourMutationTargetThirtyFourStatus",
    "marker": "PHASE3815_FIFTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK",
    "path": "tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs"
  },
  {
    "phase": 3816,
    "exportName": "buildPhase3816FiftyFourMutationTargetThirtyFiveStatus",
    "marker": "PHASE3816_FIFTY_FOUR_TOOL_TARGET_THIRTY_FIVE_OK",
    "path": "tools/phase2807_2845/apply-controlled-thirty-four-tool-mutation.mjs"
  },
  {
    "phase": 3817,
    "exportName": "buildPhase3817FiftyFourMutationTargetThirtySixStatus",
    "marker": "PHASE3817_FIFTY_FOUR_TOOL_TARGET_THIRTY_SIX_OK",
    "path": "tools/phase2846_2885/apply-controlled-thirty-five-tool-mutation.mjs"
  },
  {
    "phase": 3818,
    "exportName": "buildPhase3818FiftyFourMutationTargetThirtySevenStatus",
    "marker": "PHASE3818_FIFTY_FOUR_TOOL_TARGET_THIRTY_SEVEN_OK",
    "path": "tools/phase2886_2926/apply-controlled-thirty-six-tool-mutation.mjs"
  },
  {
    "phase": 3819,
    "exportName": "buildPhase3819FiftyFourMutationTargetThirtyEightStatus",
    "marker": "PHASE3819_FIFTY_FOUR_TOOL_TARGET_THIRTY_EIGHT_OK",
    "path": "tools/phase2927_2968/apply-controlled-thirty-seven-tool-mutation.mjs"
  },
  {
    "phase": 3820,
    "exportName": "buildPhase3820FiftyFourMutationTargetThirtyNineStatus",
    "marker": "PHASE3820_FIFTY_FOUR_TOOL_TARGET_THIRTY_NINE_OK",
    "path": "tools/phase2969_3011/apply-controlled-thirty-eight-tool-mutation.mjs"
  },
  {
    "phase": 3821,
    "exportName": "buildPhase3821FiftyFourMutationTargetFortyStatus",
    "marker": "PHASE3821_FIFTY_FOUR_TOOL_TARGET_FORTY_OK",
    "path": "tools/phase3012_3055/apply-controlled-thirty-nine-tool-mutation.mjs"
  },
  {
    "phase": 3822,
    "exportName": "buildPhase3822FiftyFourMutationTargetFortyOneStatus",
    "marker": "PHASE3822_FIFTY_FOUR_TOOL_TARGET_FORTY_ONE_OK",
    "path": "tools/phase3056_3100/apply-controlled-forty-tool-mutation.mjs"
  },
  {
    "phase": 3823,
    "exportName": "buildPhase3823FiftyFourMutationTargetFortyTwoStatus",
    "marker": "PHASE3823_FIFTY_FOUR_TOOL_TARGET_FORTY_TWO_OK",
    "path": "tools/phase3101_3146/apply-controlled-forty-one-tool-mutation.mjs"
  },
  {
    "phase": 3824,
    "exportName": "buildPhase3824FiftyFourMutationTargetFortyThreeStatus",
    "marker": "PHASE3824_FIFTY_FOUR_TOOL_TARGET_FORTY_THREE_OK",
    "path": "tools/phase3147_3193/apply-controlled-forty-two-tool-mutation.mjs"
  },
  {
    "phase": 3825,
    "exportName": "buildPhase3825FiftyFourMutationTargetFortyFourStatus",
    "marker": "PHASE3825_FIFTY_FOUR_TOOL_TARGET_FORTY_FOUR_OK",
    "path": "tools/phase3194_3241/apply-controlled-forty-three-tool-mutation.mjs"
  },
  {
    "phase": 3826,
    "exportName": "buildPhase3826FiftyFourMutationTargetFortyFiveStatus",
    "marker": "PHASE3826_FIFTY_FOUR_TOOL_TARGET_FORTY_FIVE_OK",
    "path": "tools/phase3242_3290/apply-controlled-forty-four-tool-mutation.mjs"
  },
  {
    "phase": 3827,
    "exportName": "buildPhase3827FiftyFourMutationTargetFortySixStatus",
    "marker": "PHASE3827_FIFTY_FOUR_TOOL_TARGET_FORTY_SIX_OK",
    "path": "tools/phase3291_3340/apply-controlled-forty-five-tool-mutation.mjs"
  },
  {
    "phase": 3828,
    "exportName": "buildPhase3828FiftyFourMutationTargetFortySevenStatus",
    "marker": "PHASE3828_FIFTY_FOUR_TOOL_TARGET_FORTY_SEVEN_OK",
    "path": "tools/phase3341_3391/apply-controlled-forty-six-tool-mutation.mjs"
  },
  {
    "phase": 3829,
    "exportName": "buildPhase3829FiftyFourMutationTargetFortyEightStatus",
    "marker": "PHASE3829_FIFTY_FOUR_TOOL_TARGET_FORTY_EIGHT_OK",
    "path": "tools/phase3392_3443/apply-controlled-forty-seven-tool-mutation.mjs"
  },
  {
    "phase": 3830,
    "exportName": "buildPhase3830FiftyFourMutationTargetFortyNineStatus",
    "marker": "PHASE3830_FIFTY_FOUR_TOOL_TARGET_FORTY_NINE_OK",
    "path": "tools/phase3444_3496/apply-controlled-forty-eight-tool-mutation.mjs"
  },
  {
    "phase": 3831,
    "exportName": "buildPhase3831FiftyFourMutationTargetFiftyStatus",
    "marker": "PHASE3831_FIFTY_FOUR_TOOL_TARGET_FIFTY_OK",
    "path": "tools/phase3497_3550/apply-controlled-forty-nine-tool-mutation.mjs"
  },
  {
    "phase": 3832,
    "exportName": "buildPhase3832FiftyFourMutationTargetFiftyOneStatus",
    "marker": "PHASE3832_FIFTY_FOUR_TOOL_TARGET_FIFTY_ONE_OK",
    "path": "tools/phase3551_3605/apply-controlled-fifty-tool-mutation.mjs"
  },
  {
    "phase": 3833,
    "exportName": "buildPhase3833FiftyFourMutationTargetFiftyTwoStatus",
    "marker": "PHASE3833_FIFTY_FOUR_TOOL_TARGET_FIFTY_TWO_OK",
    "path": "tools/phase3606_3661/apply-controlled-fifty-one-tool-mutation.mjs"
  },
  {
    "phase": 3834,
    "exportName": "buildPhase3834FiftyFourMutationTargetFiftyThreeStatus",
    "marker": "PHASE3834_FIFTY_FOUR_TOOL_TARGET_FIFTY_THREE_OK",
    "path": "tools/phase3662_3718/apply-controlled-fifty-two-tool-mutation.mjs"
  },
  {
    "phase": 3835,
    "exportName": "buildPhase3835FiftyFourMutationRuntimeStatus",
    "marker": "PHASE3835_FIFTY_FOUR_TOOL_TARGET_FIFTY_FOUR_OK",
    "path": "tools/phase3719_3776/apply-controlled-fifty-three-tool-mutation.mjs"
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
