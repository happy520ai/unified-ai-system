import { pathToFileURL } from "node:url";
import path from "node:path";

const phaseId = "Phase3662A-3718A-Controlled-Fifty-Two-Tool-Mutation";

const smokeTargets = [
  {
    "phase": 3667,
    "exportName": "buildPhase3667FiftyTwoMutationTargetOneStatus",
    "marker": "PHASE3667_FIFTY_TWO_TOOL_TARGET_ONE_OK",
    "path": "tools/phase2091/generated-source-patch-target.mjs"
  },
  {
    "phase": 3668,
    "exportName": "buildPhase3668FiftyTwoMutationTargetTwoStatus",
    "marker": "PHASE3668_FIFTY_TWO_TOOL_TARGET_TWO_OK",
    "path": "tools/phase2092/apply-controlled-existing-tool-mutation.mjs"
  },
  {
    "phase": 3669,
    "exportName": "buildPhase3669FiftyTwoMutationTargetThreeStatus",
    "marker": "PHASE3669_FIFTY_TWO_TOOL_TARGET_THREE_OK",
    "path": "tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs"
  },
  {
    "phase": 3670,
    "exportName": "buildPhase3670FiftyTwoMutationTargetFourStatus",
    "marker": "PHASE3670_FIFTY_TWO_TOOL_TARGET_FOUR_OK",
    "path": "tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs"
  },
  {
    "phase": 3671,
    "exportName": "buildPhase3671FiftyTwoMutationTargetFiveStatus",
    "marker": "PHASE3671_FIFTY_TWO_TOOL_TARGET_FIVE_OK",
    "path": "tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs"
  },
  {
    "phase": 3672,
    "exportName": "buildPhase3672FiftyTwoMutationTargetSixStatus",
    "marker": "PHASE3672_FIFTY_TWO_TOOL_TARGET_SIX_OK",
    "path": "tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs"
  },
  {
    "phase": 3673,
    "exportName": "buildPhase3673FiftyTwoMutationTargetSevenStatus",
    "marker": "PHASE3673_FIFTY_TWO_TOOL_TARGET_SEVEN_OK",
    "path": "tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs"
  },
  {
    "phase": 3674,
    "exportName": "buildPhase3674FiftyTwoMutationTargetEightStatus",
    "marker": "PHASE3674_FIFTY_TWO_TOOL_TARGET_EIGHT_OK",
    "path": "tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs"
  },
  {
    "phase": 3675,
    "exportName": "buildPhase3675FiftyTwoMutationTargetNineStatus",
    "marker": "PHASE3675_FIFTY_TWO_TOOL_TARGET_NINE_OK",
    "path": "tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs"
  },
  {
    "phase": 3676,
    "exportName": "buildPhase3676FiftyTwoMutationTargetTenStatus",
    "marker": "PHASE3676_FIFTY_TWO_TOOL_TARGET_TEN_OK",
    "path": "tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs"
  },
  {
    "phase": 3677,
    "exportName": "buildPhase3677FiftyTwoMutationTargetElevenStatus",
    "marker": "PHASE3677_FIFTY_TWO_TOOL_TARGET_ELEVEN_OK",
    "path": "tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs"
  },
  {
    "phase": 3678,
    "exportName": "buildPhase3678FiftyTwoMutationTargetTwelveStatus",
    "marker": "PHASE3678_FIFTY_TWO_TOOL_TARGET_TWELVE_OK",
    "path": "tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs"
  },
  {
    "phase": 3679,
    "exportName": "buildPhase3679FiftyTwoMutationTargetThirteenStatus",
    "marker": "PHASE3679_FIFTY_TWO_TOOL_TARGET_THIRTEEN_OK",
    "path": "tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs"
  },
  {
    "phase": 3680,
    "exportName": "buildPhase3680FiftyTwoMutationTargetFourteenStatus",
    "marker": "PHASE3680_FIFTY_TWO_TOOL_TARGET_FOURTEEN_OK",
    "path": "tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs"
  },
  {
    "phase": 3681,
    "exportName": "buildPhase3681FiftyTwoMutationTargetFifteenStatus",
    "marker": "PHASE3681_FIFTY_TWO_TOOL_TARGET_FIFTEEN_OK",
    "path": "tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs"
  },
  {
    "phase": 3682,
    "exportName": "buildPhase3682FiftyTwoMutationTargetSixteenStatus",
    "marker": "PHASE3682_FIFTY_TWO_TOOL_TARGET_SIXTEEN_OK",
    "path": "tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs"
  },
  {
    "phase": 3683,
    "exportName": "buildPhase3683FiftyTwoMutationTargetSeventeenStatus",
    "marker": "PHASE3683_FIFTY_TWO_TOOL_TARGET_SEVENTEEN_OK",
    "path": "tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs"
  },
  {
    "phase": 3684,
    "exportName": "buildPhase3684FiftyTwoMutationTargetEighteenStatus",
    "marker": "PHASE3684_FIFTY_TWO_TOOL_TARGET_EIGHTEEN_OK",
    "path": "tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs"
  },
  {
    "phase": 3685,
    "exportName": "buildPhase3685FiftyTwoMutationTargetNineteenStatus",
    "marker": "PHASE3685_FIFTY_TWO_TOOL_TARGET_NINETEEN_OK",
    "path": "tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs"
  },
  {
    "phase": 3686,
    "exportName": "buildPhase3686FiftyTwoMutationTargetTwentyStatus",
    "marker": "PHASE3686_FIFTY_TWO_TOOL_TARGET_TWENTY_OK",
    "path": "tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs"
  },
  {
    "phase": 3687,
    "exportName": "buildPhase3687FiftyTwoMutationTargetTwentyOneStatus",
    "marker": "PHASE3687_FIFTY_TWO_TOOL_TARGET_TWENTY_ONE_OK",
    "path": "tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs"
  },
  {
    "phase": 3688,
    "exportName": "buildPhase3688FiftyTwoMutationTargetTwentyTwoStatus",
    "marker": "PHASE3688_FIFTY_TWO_TOOL_TARGET_TWENTY_TWO_OK",
    "path": "tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs"
  },
  {
    "phase": 3689,
    "exportName": "buildPhase3689FiftyTwoMutationTargetTwentyThreeStatus",
    "marker": "PHASE3689_FIFTY_TWO_TOOL_TARGET_TWENTY_THREE_OK",
    "path": "tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs"
  },
  {
    "phase": 3690,
    "exportName": "buildPhase3690FiftyTwoMutationTargetTwentyFourStatus",
    "marker": "PHASE3690_FIFTY_TWO_TOOL_TARGET_TWENTY_FOUR_OK",
    "path": "tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs"
  },
  {
    "phase": 3691,
    "exportName": "buildPhase3691FiftyTwoMutationTargetTwentyFiveStatus",
    "marker": "PHASE3691_FIFTY_TWO_TOOL_TARGET_TWENTY_FIVE_OK",
    "path": "tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs"
  },
  {
    "phase": 3692,
    "exportName": "buildPhase3692FiftyTwoMutationTargetTwentySixStatus",
    "marker": "PHASE3692_FIFTY_TWO_TOOL_TARGET_TWENTY_SIX_OK",
    "path": "tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs"
  },
  {
    "phase": 3693,
    "exportName": "buildPhase3693FiftyTwoMutationTargetTwentySevenStatus",
    "marker": "PHASE3693_FIFTY_TWO_TOOL_TARGET_TWENTY_SEVEN_OK",
    "path": "tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs"
  },
  {
    "phase": 3694,
    "exportName": "buildPhase3694FiftyTwoMutationTargetTwentyEightStatus",
    "marker": "PHASE3694_FIFTY_TWO_TOOL_TARGET_TWENTY_EIGHT_OK",
    "path": "tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs"
  },
  {
    "phase": 3695,
    "exportName": "buildPhase3695FiftyTwoMutationTargetTwentyNineStatus",
    "marker": "PHASE3695_FIFTY_TWO_TOOL_TARGET_TWENTY_NINE_OK",
    "path": "tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs"
  },
  {
    "phase": 3696,
    "exportName": "buildPhase3696FiftyTwoMutationTargetThirtyStatus",
    "marker": "PHASE3696_FIFTY_TWO_TOOL_TARGET_THIRTY_OK",
    "path": "tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs"
  },
  {
    "phase": 3697,
    "exportName": "buildPhase3697FiftyTwoMutationTargetThirtyOneStatus",
    "marker": "PHASE3697_FIFTY_TWO_TOOL_TARGET_THIRTY_ONE_OK",
    "path": "tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs"
  },
  {
    "phase": 3698,
    "exportName": "buildPhase3698FiftyTwoMutationTargetThirtyTwoStatus",
    "marker": "PHASE3698_FIFTY_TWO_TOOL_TARGET_THIRTY_TWO_OK",
    "path": "tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs"
  },
  {
    "phase": 3699,
    "exportName": "buildPhase3699FiftyTwoMutationTargetThirtyThreeStatus",
    "marker": "PHASE3699_FIFTY_TWO_TOOL_TARGET_THIRTY_THREE_OK",
    "path": "tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs"
  },
  {
    "phase": 3700,
    "exportName": "buildPhase3700FiftyTwoMutationTargetThirtyFourStatus",
    "marker": "PHASE3700_FIFTY_TWO_TOOL_TARGET_THIRTY_FOUR_OK",
    "path": "tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs"
  },
  {
    "phase": 3701,
    "exportName": "buildPhase3701FiftyTwoMutationTargetThirtyFiveStatus",
    "marker": "PHASE3701_FIFTY_TWO_TOOL_TARGET_THIRTY_FIVE_OK",
    "path": "tools/phase2807_2845/apply-controlled-thirty-four-tool-mutation.mjs"
  },
  {
    "phase": 3702,
    "exportName": "buildPhase3702FiftyTwoMutationTargetThirtySixStatus",
    "marker": "PHASE3702_FIFTY_TWO_TOOL_TARGET_THIRTY_SIX_OK",
    "path": "tools/phase2846_2885/apply-controlled-thirty-five-tool-mutation.mjs"
  },
  {
    "phase": 3703,
    "exportName": "buildPhase3703FiftyTwoMutationTargetThirtySevenStatus",
    "marker": "PHASE3703_FIFTY_TWO_TOOL_TARGET_THIRTY_SEVEN_OK",
    "path": "tools/phase2886_2926/apply-controlled-thirty-six-tool-mutation.mjs"
  },
  {
    "phase": 3704,
    "exportName": "buildPhase3704FiftyTwoMutationTargetThirtyEightStatus",
    "marker": "PHASE3704_FIFTY_TWO_TOOL_TARGET_THIRTY_EIGHT_OK",
    "path": "tools/phase2927_2968/apply-controlled-thirty-seven-tool-mutation.mjs"
  },
  {
    "phase": 3705,
    "exportName": "buildPhase3705FiftyTwoMutationTargetThirtyNineStatus",
    "marker": "PHASE3705_FIFTY_TWO_TOOL_TARGET_THIRTY_NINE_OK",
    "path": "tools/phase2969_3011/apply-controlled-thirty-eight-tool-mutation.mjs"
  },
  {
    "phase": 3706,
    "exportName": "buildPhase3706FiftyTwoMutationTargetFortyStatus",
    "marker": "PHASE3706_FIFTY_TWO_TOOL_TARGET_FORTY_OK",
    "path": "tools/phase3012_3055/apply-controlled-thirty-nine-tool-mutation.mjs"
  },
  {
    "phase": 3707,
    "exportName": "buildPhase3707FiftyTwoMutationTargetFortyOneStatus",
    "marker": "PHASE3707_FIFTY_TWO_TOOL_TARGET_FORTY_ONE_OK",
    "path": "tools/phase3056_3100/apply-controlled-forty-tool-mutation.mjs"
  },
  {
    "phase": 3708,
    "exportName": "buildPhase3708FiftyTwoMutationTargetFortyTwoStatus",
    "marker": "PHASE3708_FIFTY_TWO_TOOL_TARGET_FORTY_TWO_OK",
    "path": "tools/phase3101_3146/apply-controlled-forty-one-tool-mutation.mjs"
  },
  {
    "phase": 3709,
    "exportName": "buildPhase3709FiftyTwoMutationTargetFortyThreeStatus",
    "marker": "PHASE3709_FIFTY_TWO_TOOL_TARGET_FORTY_THREE_OK",
    "path": "tools/phase3147_3193/apply-controlled-forty-two-tool-mutation.mjs"
  },
  {
    "phase": 3710,
    "exportName": "buildPhase3710FiftyTwoMutationTargetFortyFourStatus",
    "marker": "PHASE3710_FIFTY_TWO_TOOL_TARGET_FORTY_FOUR_OK",
    "path": "tools/phase3194_3241/apply-controlled-forty-three-tool-mutation.mjs"
  },
  {
    "phase": 3711,
    "exportName": "buildPhase3711FiftyTwoMutationTargetFortyFiveStatus",
    "marker": "PHASE3711_FIFTY_TWO_TOOL_TARGET_FORTY_FIVE_OK",
    "path": "tools/phase3242_3290/apply-controlled-forty-four-tool-mutation.mjs"
  },
  {
    "phase": 3712,
    "exportName": "buildPhase3712FiftyTwoMutationTargetFortySixStatus",
    "marker": "PHASE3712_FIFTY_TWO_TOOL_TARGET_FORTY_SIX_OK",
    "path": "tools/phase3291_3340/apply-controlled-forty-five-tool-mutation.mjs"
  },
  {
    "phase": 3713,
    "exportName": "buildPhase3713FiftyTwoMutationTargetFortySevenStatus",
    "marker": "PHASE3713_FIFTY_TWO_TOOL_TARGET_FORTY_SEVEN_OK",
    "path": "tools/phase3341_3391/apply-controlled-forty-six-tool-mutation.mjs"
  },
  {
    "phase": 3714,
    "exportName": "buildPhase3714FiftyTwoMutationTargetFortyEightStatus",
    "marker": "PHASE3714_FIFTY_TWO_TOOL_TARGET_FORTY_EIGHT_OK",
    "path": "tools/phase3392_3443/apply-controlled-forty-seven-tool-mutation.mjs"
  },
  {
    "phase": 3715,
    "exportName": "buildPhase3715FiftyTwoMutationTargetFortyNineStatus",
    "marker": "PHASE3715_FIFTY_TWO_TOOL_TARGET_FORTY_NINE_OK",
    "path": "tools/phase3444_3496/apply-controlled-forty-eight-tool-mutation.mjs"
  },
  {
    "phase": 3716,
    "exportName": "buildPhase3716FiftyTwoMutationTargetFiftyStatus",
    "marker": "PHASE3716_FIFTY_TWO_TOOL_TARGET_FIFTY_OK",
    "path": "tools/phase3497_3550/apply-controlled-forty-nine-tool-mutation.mjs"
  },
  {
    "phase": 3717,
    "exportName": "buildPhase3717FiftyTwoMutationTargetFiftyOneStatus",
    "marker": "PHASE3717_FIFTY_TWO_TOOL_TARGET_FIFTY_ONE_OK",
    "path": "tools/phase3551_3605/apply-controlled-fifty-tool-mutation.mjs"
  },
  {
    "phase": 3718,
    "exportName": "buildPhase3718FiftyTwoMutationRuntimeStatus",
    "marker": "PHASE3718_FIFTY_TWO_TOOL_TARGET_FIFTY_TWO_OK",
    "path": "tools/phase3606_3661/apply-controlled-fifty-one-tool-mutation.mjs"
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
