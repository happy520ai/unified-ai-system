import { pathToFileURL } from "node:url";
import path from "node:path";

const phaseId = "Phase3719A-3776A-Controlled-Fifty-Three-Tool-Mutation";

const smokeTargets = [
  {
    "phase": 3724,
    "exportName": "buildPhase3724FiftyThreeMutationTargetOneStatus",
    "marker": "PHASE3724_FIFTY_THREE_TOOL_TARGET_ONE_OK",
    "path": "tools/phase2091/generated-source-patch-target.mjs"
  },
  {
    "phase": 3725,
    "exportName": "buildPhase3725FiftyThreeMutationTargetTwoStatus",
    "marker": "PHASE3725_FIFTY_THREE_TOOL_TARGET_TWO_OK",
    "path": "tools/phase2092/apply-controlled-existing-tool-mutation.mjs"
  },
  {
    "phase": 3726,
    "exportName": "buildPhase3726FiftyThreeMutationTargetThreeStatus",
    "marker": "PHASE3726_FIFTY_THREE_TOOL_TARGET_THREE_OK",
    "path": "tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs"
  },
  {
    "phase": 3727,
    "exportName": "buildPhase3727FiftyThreeMutationTargetFourStatus",
    "marker": "PHASE3727_FIFTY_THREE_TOOL_TARGET_FOUR_OK",
    "path": "tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs"
  },
  {
    "phase": 3728,
    "exportName": "buildPhase3728FiftyThreeMutationTargetFiveStatus",
    "marker": "PHASE3728_FIFTY_THREE_TOOL_TARGET_FIVE_OK",
    "path": "tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs"
  },
  {
    "phase": 3729,
    "exportName": "buildPhase3729FiftyThreeMutationTargetSixStatus",
    "marker": "PHASE3729_FIFTY_THREE_TOOL_TARGET_SIX_OK",
    "path": "tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs"
  },
  {
    "phase": 3730,
    "exportName": "buildPhase3730FiftyThreeMutationTargetSevenStatus",
    "marker": "PHASE3730_FIFTY_THREE_TOOL_TARGET_SEVEN_OK",
    "path": "tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs"
  },
  {
    "phase": 3731,
    "exportName": "buildPhase3731FiftyThreeMutationTargetEightStatus",
    "marker": "PHASE3731_FIFTY_THREE_TOOL_TARGET_EIGHT_OK",
    "path": "tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs"
  },
  {
    "phase": 3732,
    "exportName": "buildPhase3732FiftyThreeMutationTargetNineStatus",
    "marker": "PHASE3732_FIFTY_THREE_TOOL_TARGET_NINE_OK",
    "path": "tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs"
  },
  {
    "phase": 3733,
    "exportName": "buildPhase3733FiftyThreeMutationTargetTenStatus",
    "marker": "PHASE3733_FIFTY_THREE_TOOL_TARGET_TEN_OK",
    "path": "tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs"
  },
  {
    "phase": 3734,
    "exportName": "buildPhase3734FiftyThreeMutationTargetElevenStatus",
    "marker": "PHASE3734_FIFTY_THREE_TOOL_TARGET_ELEVEN_OK",
    "path": "tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs"
  },
  {
    "phase": 3735,
    "exportName": "buildPhase3735FiftyThreeMutationTargetTwelveStatus",
    "marker": "PHASE3735_FIFTY_THREE_TOOL_TARGET_TWELVE_OK",
    "path": "tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs"
  },
  {
    "phase": 3736,
    "exportName": "buildPhase3736FiftyThreeMutationTargetThirteenStatus",
    "marker": "PHASE3736_FIFTY_THREE_TOOL_TARGET_THIRTEEN_OK",
    "path": "tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs"
  },
  {
    "phase": 3737,
    "exportName": "buildPhase3737FiftyThreeMutationTargetFourteenStatus",
    "marker": "PHASE3737_FIFTY_THREE_TOOL_TARGET_FOURTEEN_OK",
    "path": "tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs"
  },
  {
    "phase": 3738,
    "exportName": "buildPhase3738FiftyThreeMutationTargetFifteenStatus",
    "marker": "PHASE3738_FIFTY_THREE_TOOL_TARGET_FIFTEEN_OK",
    "path": "tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs"
  },
  {
    "phase": 3739,
    "exportName": "buildPhase3739FiftyThreeMutationTargetSixteenStatus",
    "marker": "PHASE3739_FIFTY_THREE_TOOL_TARGET_SIXTEEN_OK",
    "path": "tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs"
  },
  {
    "phase": 3740,
    "exportName": "buildPhase3740FiftyThreeMutationTargetSeventeenStatus",
    "marker": "PHASE3740_FIFTY_THREE_TOOL_TARGET_SEVENTEEN_OK",
    "path": "tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs"
  },
  {
    "phase": 3741,
    "exportName": "buildPhase3741FiftyThreeMutationTargetEighteenStatus",
    "marker": "PHASE3741_FIFTY_THREE_TOOL_TARGET_EIGHTEEN_OK",
    "path": "tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs"
  },
  {
    "phase": 3742,
    "exportName": "buildPhase3742FiftyThreeMutationTargetNineteenStatus",
    "marker": "PHASE3742_FIFTY_THREE_TOOL_TARGET_NINETEEN_OK",
    "path": "tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs"
  },
  {
    "phase": 3743,
    "exportName": "buildPhase3743FiftyThreeMutationTargetTwentyStatus",
    "marker": "PHASE3743_FIFTY_THREE_TOOL_TARGET_TWENTY_OK",
    "path": "tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs"
  },
  {
    "phase": 3744,
    "exportName": "buildPhase3744FiftyThreeMutationTargetTwentyOneStatus",
    "marker": "PHASE3744_FIFTY_THREE_TOOL_TARGET_TWENTY_ONE_OK",
    "path": "tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs"
  },
  {
    "phase": 3745,
    "exportName": "buildPhase3745FiftyThreeMutationTargetTwentyTwoStatus",
    "marker": "PHASE3745_FIFTY_THREE_TOOL_TARGET_TWENTY_TWO_OK",
    "path": "tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs"
  },
  {
    "phase": 3746,
    "exportName": "buildPhase3746FiftyThreeMutationTargetTwentyThreeStatus",
    "marker": "PHASE3746_FIFTY_THREE_TOOL_TARGET_TWENTY_THREE_OK",
    "path": "tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs"
  },
  {
    "phase": 3747,
    "exportName": "buildPhase3747FiftyThreeMutationTargetTwentyFourStatus",
    "marker": "PHASE3747_FIFTY_THREE_TOOL_TARGET_TWENTY_FOUR_OK",
    "path": "tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs"
  },
  {
    "phase": 3748,
    "exportName": "buildPhase3748FiftyThreeMutationTargetTwentyFiveStatus",
    "marker": "PHASE3748_FIFTY_THREE_TOOL_TARGET_TWENTY_FIVE_OK",
    "path": "tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs"
  },
  {
    "phase": 3749,
    "exportName": "buildPhase3749FiftyThreeMutationTargetTwentySixStatus",
    "marker": "PHASE3749_FIFTY_THREE_TOOL_TARGET_TWENTY_SIX_OK",
    "path": "tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs"
  },
  {
    "phase": 3750,
    "exportName": "buildPhase3750FiftyThreeMutationTargetTwentySevenStatus",
    "marker": "PHASE3750_FIFTY_THREE_TOOL_TARGET_TWENTY_SEVEN_OK",
    "path": "tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs"
  },
  {
    "phase": 3751,
    "exportName": "buildPhase3751FiftyThreeMutationTargetTwentyEightStatus",
    "marker": "PHASE3751_FIFTY_THREE_TOOL_TARGET_TWENTY_EIGHT_OK",
    "path": "tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs"
  },
  {
    "phase": 3752,
    "exportName": "buildPhase3752FiftyThreeMutationTargetTwentyNineStatus",
    "marker": "PHASE3752_FIFTY_THREE_TOOL_TARGET_TWENTY_NINE_OK",
    "path": "tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs"
  },
  {
    "phase": 3753,
    "exportName": "buildPhase3753FiftyThreeMutationTargetThirtyStatus",
    "marker": "PHASE3753_FIFTY_THREE_TOOL_TARGET_THIRTY_OK",
    "path": "tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs"
  },
  {
    "phase": 3754,
    "exportName": "buildPhase3754FiftyThreeMutationTargetThirtyOneStatus",
    "marker": "PHASE3754_FIFTY_THREE_TOOL_TARGET_THIRTY_ONE_OK",
    "path": "tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs"
  },
  {
    "phase": 3755,
    "exportName": "buildPhase3755FiftyThreeMutationTargetThirtyTwoStatus",
    "marker": "PHASE3755_FIFTY_THREE_TOOL_TARGET_THIRTY_TWO_OK",
    "path": "tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs"
  },
  {
    "phase": 3756,
    "exportName": "buildPhase3756FiftyThreeMutationTargetThirtyThreeStatus",
    "marker": "PHASE3756_FIFTY_THREE_TOOL_TARGET_THIRTY_THREE_OK",
    "path": "tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs"
  },
  {
    "phase": 3757,
    "exportName": "buildPhase3757FiftyThreeMutationTargetThirtyFourStatus",
    "marker": "PHASE3757_FIFTY_THREE_TOOL_TARGET_THIRTY_FOUR_OK",
    "path": "tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs"
  },
  {
    "phase": 3758,
    "exportName": "buildPhase3758FiftyThreeMutationTargetThirtyFiveStatus",
    "marker": "PHASE3758_FIFTY_THREE_TOOL_TARGET_THIRTY_FIVE_OK",
    "path": "tools/phase2807_2845/apply-controlled-thirty-four-tool-mutation.mjs"
  },
  {
    "phase": 3759,
    "exportName": "buildPhase3759FiftyThreeMutationTargetThirtySixStatus",
    "marker": "PHASE3759_FIFTY_THREE_TOOL_TARGET_THIRTY_SIX_OK",
    "path": "tools/phase2846_2885/apply-controlled-thirty-five-tool-mutation.mjs"
  },
  {
    "phase": 3760,
    "exportName": "buildPhase3760FiftyThreeMutationTargetThirtySevenStatus",
    "marker": "PHASE3760_FIFTY_THREE_TOOL_TARGET_THIRTY_SEVEN_OK",
    "path": "tools/phase2886_2926/apply-controlled-thirty-six-tool-mutation.mjs"
  },
  {
    "phase": 3761,
    "exportName": "buildPhase3761FiftyThreeMutationTargetThirtyEightStatus",
    "marker": "PHASE3761_FIFTY_THREE_TOOL_TARGET_THIRTY_EIGHT_OK",
    "path": "tools/phase2927_2968/apply-controlled-thirty-seven-tool-mutation.mjs"
  },
  {
    "phase": 3762,
    "exportName": "buildPhase3762FiftyThreeMutationTargetThirtyNineStatus",
    "marker": "PHASE3762_FIFTY_THREE_TOOL_TARGET_THIRTY_NINE_OK",
    "path": "tools/phase2969_3011/apply-controlled-thirty-eight-tool-mutation.mjs"
  },
  {
    "phase": 3763,
    "exportName": "buildPhase3763FiftyThreeMutationTargetFortyStatus",
    "marker": "PHASE3763_FIFTY_THREE_TOOL_TARGET_FORTY_OK",
    "path": "tools/phase3012_3055/apply-controlled-thirty-nine-tool-mutation.mjs"
  },
  {
    "phase": 3764,
    "exportName": "buildPhase3764FiftyThreeMutationTargetFortyOneStatus",
    "marker": "PHASE3764_FIFTY_THREE_TOOL_TARGET_FORTY_ONE_OK",
    "path": "tools/phase3056_3100/apply-controlled-forty-tool-mutation.mjs"
  },
  {
    "phase": 3765,
    "exportName": "buildPhase3765FiftyThreeMutationTargetFortyTwoStatus",
    "marker": "PHASE3765_FIFTY_THREE_TOOL_TARGET_FORTY_TWO_OK",
    "path": "tools/phase3101_3146/apply-controlled-forty-one-tool-mutation.mjs"
  },
  {
    "phase": 3766,
    "exportName": "buildPhase3766FiftyThreeMutationTargetFortyThreeStatus",
    "marker": "PHASE3766_FIFTY_THREE_TOOL_TARGET_FORTY_THREE_OK",
    "path": "tools/phase3147_3193/apply-controlled-forty-two-tool-mutation.mjs"
  },
  {
    "phase": 3767,
    "exportName": "buildPhase3767FiftyThreeMutationTargetFortyFourStatus",
    "marker": "PHASE3767_FIFTY_THREE_TOOL_TARGET_FORTY_FOUR_OK",
    "path": "tools/phase3194_3241/apply-controlled-forty-three-tool-mutation.mjs"
  },
  {
    "phase": 3768,
    "exportName": "buildPhase3768FiftyThreeMutationTargetFortyFiveStatus",
    "marker": "PHASE3768_FIFTY_THREE_TOOL_TARGET_FORTY_FIVE_OK",
    "path": "tools/phase3242_3290/apply-controlled-forty-four-tool-mutation.mjs"
  },
  {
    "phase": 3769,
    "exportName": "buildPhase3769FiftyThreeMutationTargetFortySixStatus",
    "marker": "PHASE3769_FIFTY_THREE_TOOL_TARGET_FORTY_SIX_OK",
    "path": "tools/phase3291_3340/apply-controlled-forty-five-tool-mutation.mjs"
  },
  {
    "phase": 3770,
    "exportName": "buildPhase3770FiftyThreeMutationTargetFortySevenStatus",
    "marker": "PHASE3770_FIFTY_THREE_TOOL_TARGET_FORTY_SEVEN_OK",
    "path": "tools/phase3341_3391/apply-controlled-forty-six-tool-mutation.mjs"
  },
  {
    "phase": 3771,
    "exportName": "buildPhase3771FiftyThreeMutationTargetFortyEightStatus",
    "marker": "PHASE3771_FIFTY_THREE_TOOL_TARGET_FORTY_EIGHT_OK",
    "path": "tools/phase3392_3443/apply-controlled-forty-seven-tool-mutation.mjs"
  },
  {
    "phase": 3772,
    "exportName": "buildPhase3772FiftyThreeMutationTargetFortyNineStatus",
    "marker": "PHASE3772_FIFTY_THREE_TOOL_TARGET_FORTY_NINE_OK",
    "path": "tools/phase3444_3496/apply-controlled-forty-eight-tool-mutation.mjs"
  },
  {
    "phase": 3773,
    "exportName": "buildPhase3773FiftyThreeMutationTargetFiftyStatus",
    "marker": "PHASE3773_FIFTY_THREE_TOOL_TARGET_FIFTY_OK",
    "path": "tools/phase3497_3550/apply-controlled-forty-nine-tool-mutation.mjs"
  },
  {
    "phase": 3774,
    "exportName": "buildPhase3774FiftyThreeMutationTargetFiftyOneStatus",
    "marker": "PHASE3774_FIFTY_THREE_TOOL_TARGET_FIFTY_ONE_OK",
    "path": "tools/phase3551_3605/apply-controlled-fifty-tool-mutation.mjs"
  },
  {
    "phase": 3775,
    "exportName": "buildPhase3775FiftyThreeMutationTargetFiftyTwoStatus",
    "marker": "PHASE3775_FIFTY_THREE_TOOL_TARGET_FIFTY_TWO_OK",
    "path": "tools/phase3606_3661/apply-controlled-fifty-one-tool-mutation.mjs"
  },
  {
    "phase": 3776,
    "exportName": "buildPhase3776FiftyThreeMutationRuntimeStatus",
    "marker": "PHASE3776_FIFTY_THREE_TOOL_TARGET_FIFTY_THREE_OK",
    "path": "tools/phase3662_3718/apply-controlled-fifty-two-tool-mutation.mjs"
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
