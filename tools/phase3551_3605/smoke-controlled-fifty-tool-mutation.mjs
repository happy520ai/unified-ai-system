import { pathToFileURL } from "node:url";
import path from "node:path";

const phaseId = "Phase3551A-3605A-Controlled-Fifty-Tool-Mutation";

const smokeTargets = [
  {
    "phase": 3556,
    "exportName": "buildPhase3556FiftyMutationTargetOneStatus",
    "marker": "PHASE3556_FIFTY_TOOL_TARGET_ONE_OK",
    "path": "tools/phase2091/generated-source-patch-target.mjs"
  },
  {
    "phase": 3557,
    "exportName": "buildPhase3557FiftyMutationTargetTwoStatus",
    "marker": "PHASE3557_FIFTY_TOOL_TARGET_TWO_OK",
    "path": "tools/phase2092/apply-controlled-existing-tool-mutation.mjs"
  },
  {
    "phase": 3558,
    "exportName": "buildPhase3558FiftyMutationTargetThreeStatus",
    "marker": "PHASE3558_FIFTY_TOOL_TARGET_THREE_OK",
    "path": "tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs"
  },
  {
    "phase": 3559,
    "exportName": "buildPhase3559FiftyMutationTargetFourStatus",
    "marker": "PHASE3559_FIFTY_TOOL_TARGET_FOUR_OK",
    "path": "tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs"
  },
  {
    "phase": 3560,
    "exportName": "buildPhase3560FiftyMutationTargetFiveStatus",
    "marker": "PHASE3560_FIFTY_TOOL_TARGET_FIVE_OK",
    "path": "tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs"
  },
  {
    "phase": 3561,
    "exportName": "buildPhase3561FiftyMutationTargetSixStatus",
    "marker": "PHASE3561_FIFTY_TOOL_TARGET_SIX_OK",
    "path": "tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs"
  },
  {
    "phase": 3562,
    "exportName": "buildPhase3562FiftyMutationTargetSevenStatus",
    "marker": "PHASE3562_FIFTY_TOOL_TARGET_SEVEN_OK",
    "path": "tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs"
  },
  {
    "phase": 3563,
    "exportName": "buildPhase3563FiftyMutationTargetEightStatus",
    "marker": "PHASE3563_FIFTY_TOOL_TARGET_EIGHT_OK",
    "path": "tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs"
  },
  {
    "phase": 3564,
    "exportName": "buildPhase3564FiftyMutationTargetNineStatus",
    "marker": "PHASE3564_FIFTY_TOOL_TARGET_NINE_OK",
    "path": "tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs"
  },
  {
    "phase": 3565,
    "exportName": "buildPhase3565FiftyMutationTargetTenStatus",
    "marker": "PHASE3565_FIFTY_TOOL_TARGET_TEN_OK",
    "path": "tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs"
  },
  {
    "phase": 3566,
    "exportName": "buildPhase3566FiftyMutationTargetElevenStatus",
    "marker": "PHASE3566_FIFTY_TOOL_TARGET_ELEVEN_OK",
    "path": "tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs"
  },
  {
    "phase": 3567,
    "exportName": "buildPhase3567FiftyMutationTargetTwelveStatus",
    "marker": "PHASE3567_FIFTY_TOOL_TARGET_TWELVE_OK",
    "path": "tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs"
  },
  {
    "phase": 3568,
    "exportName": "buildPhase3568FiftyMutationTargetThirteenStatus",
    "marker": "PHASE3568_FIFTY_TOOL_TARGET_THIRTEEN_OK",
    "path": "tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs"
  },
  {
    "phase": 3569,
    "exportName": "buildPhase3569FiftyMutationTargetFourteenStatus",
    "marker": "PHASE3569_FIFTY_TOOL_TARGET_FOURTEEN_OK",
    "path": "tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs"
  },
  {
    "phase": 3570,
    "exportName": "buildPhase3570FiftyMutationTargetFifteenStatus",
    "marker": "PHASE3570_FIFTY_TOOL_TARGET_FIFTEEN_OK",
    "path": "tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs"
  },
  {
    "phase": 3571,
    "exportName": "buildPhase3571FiftyMutationTargetSixteenStatus",
    "marker": "PHASE3571_FIFTY_TOOL_TARGET_SIXTEEN_OK",
    "path": "tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs"
  },
  {
    "phase": 3572,
    "exportName": "buildPhase3572FiftyMutationTargetSeventeenStatus",
    "marker": "PHASE3572_FIFTY_TOOL_TARGET_SEVENTEEN_OK",
    "path": "tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs"
  },
  {
    "phase": 3573,
    "exportName": "buildPhase3573FiftyMutationTargetEighteenStatus",
    "marker": "PHASE3573_FIFTY_TOOL_TARGET_EIGHTEEN_OK",
    "path": "tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs"
  },
  {
    "phase": 3574,
    "exportName": "buildPhase3574FiftyMutationTargetNineteenStatus",
    "marker": "PHASE3574_FIFTY_TOOL_TARGET_NINETEEN_OK",
    "path": "tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs"
  },
  {
    "phase": 3575,
    "exportName": "buildPhase3575FiftyMutationTargetTwentyStatus",
    "marker": "PHASE3575_FIFTY_TOOL_TARGET_TWENTY_OK",
    "path": "tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs"
  },
  {
    "phase": 3576,
    "exportName": "buildPhase3576FiftyMutationTargetTwentyOneStatus",
    "marker": "PHASE3576_FIFTY_TOOL_TARGET_TWENTY_ONE_OK",
    "path": "tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs"
  },
  {
    "phase": 3577,
    "exportName": "buildPhase3577FiftyMutationTargetTwentyTwoStatus",
    "marker": "PHASE3577_FIFTY_TOOL_TARGET_TWENTY_TWO_OK",
    "path": "tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs"
  },
  {
    "phase": 3578,
    "exportName": "buildPhase3578FiftyMutationTargetTwentyThreeStatus",
    "marker": "PHASE3578_FIFTY_TOOL_TARGET_TWENTY_THREE_OK",
    "path": "tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs"
  },
  {
    "phase": 3579,
    "exportName": "buildPhase3579FiftyMutationTargetTwentyFourStatus",
    "marker": "PHASE3579_FIFTY_TOOL_TARGET_TWENTY_FOUR_OK",
    "path": "tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs"
  },
  {
    "phase": 3580,
    "exportName": "buildPhase3580FiftyMutationTargetTwentyFiveStatus",
    "marker": "PHASE3580_FIFTY_TOOL_TARGET_TWENTY_FIVE_OK",
    "path": "tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs"
  },
  {
    "phase": 3581,
    "exportName": "buildPhase3581FiftyMutationTargetTwentySixStatus",
    "marker": "PHASE3581_FIFTY_TOOL_TARGET_TWENTY_SIX_OK",
    "path": "tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs"
  },
  {
    "phase": 3582,
    "exportName": "buildPhase3582FiftyMutationTargetTwentySevenStatus",
    "marker": "PHASE3582_FIFTY_TOOL_TARGET_TWENTY_SEVEN_OK",
    "path": "tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs"
  },
  {
    "phase": 3583,
    "exportName": "buildPhase3583FiftyMutationTargetTwentyEightStatus",
    "marker": "PHASE3583_FIFTY_TOOL_TARGET_TWENTY_EIGHT_OK",
    "path": "tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs"
  },
  {
    "phase": 3584,
    "exportName": "buildPhase3584FiftyMutationTargetTwentyNineStatus",
    "marker": "PHASE3584_FIFTY_TOOL_TARGET_TWENTY_NINE_OK",
    "path": "tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs"
  },
  {
    "phase": 3585,
    "exportName": "buildPhase3585FiftyMutationTargetThirtyStatus",
    "marker": "PHASE3585_FIFTY_TOOL_TARGET_THIRTY_OK",
    "path": "tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs"
  },
  {
    "phase": 3586,
    "exportName": "buildPhase3586FiftyMutationTargetThirtyOneStatus",
    "marker": "PHASE3586_FIFTY_TOOL_TARGET_THIRTY_ONE_OK",
    "path": "tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs"
  },
  {
    "phase": 3587,
    "exportName": "buildPhase3587FiftyMutationTargetThirtyTwoStatus",
    "marker": "PHASE3587_FIFTY_TOOL_TARGET_THIRTY_TWO_OK",
    "path": "tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs"
  },
  {
    "phase": 3588,
    "exportName": "buildPhase3588FiftyMutationTargetThirtyThreeStatus",
    "marker": "PHASE3588_FIFTY_TOOL_TARGET_THIRTY_THREE_OK",
    "path": "tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs"
  },
  {
    "phase": 3589,
    "exportName": "buildPhase3589FiftyMutationTargetThirtyFourStatus",
    "marker": "PHASE3589_FIFTY_TOOL_TARGET_THIRTY_FOUR_OK",
    "path": "tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs"
  },
  {
    "phase": 3590,
    "exportName": "buildPhase3590FiftyMutationTargetThirtyFiveStatus",
    "marker": "PHASE3590_FIFTY_TOOL_TARGET_THIRTY_FIVE_OK",
    "path": "tools/phase2807_2845/apply-controlled-thirty-four-tool-mutation.mjs"
  },
  {
    "phase": 3591,
    "exportName": "buildPhase3591FiftyMutationTargetThirtySixStatus",
    "marker": "PHASE3591_FIFTY_TOOL_TARGET_THIRTY_SIX_OK",
    "path": "tools/phase2846_2885/apply-controlled-thirty-five-tool-mutation.mjs"
  },
  {
    "phase": 3592,
    "exportName": "buildPhase3592FiftyMutationTargetThirtySevenStatus",
    "marker": "PHASE3592_FIFTY_TOOL_TARGET_THIRTY_SEVEN_OK",
    "path": "tools/phase2886_2926/apply-controlled-thirty-six-tool-mutation.mjs"
  },
  {
    "phase": 3593,
    "exportName": "buildPhase3593FiftyMutationTargetThirtyEightStatus",
    "marker": "PHASE3593_FIFTY_TOOL_TARGET_THIRTY_EIGHT_OK",
    "path": "tools/phase2927_2968/apply-controlled-thirty-seven-tool-mutation.mjs"
  },
  {
    "phase": 3594,
    "exportName": "buildPhase3594FiftyMutationTargetThirtyNineStatus",
    "marker": "PHASE3594_FIFTY_TOOL_TARGET_THIRTY_NINE_OK",
    "path": "tools/phase2969_3011/apply-controlled-thirty-eight-tool-mutation.mjs"
  },
  {
    "phase": 3595,
    "exportName": "buildPhase3595FiftyMutationTargetFortyStatus",
    "marker": "PHASE3595_FIFTY_TOOL_TARGET_FORTY_OK",
    "path": "tools/phase3012_3055/apply-controlled-thirty-nine-tool-mutation.mjs"
  },
  {
    "phase": 3596,
    "exportName": "buildPhase3596FiftyMutationTargetFortyOneStatus",
    "marker": "PHASE3596_FIFTY_TOOL_TARGET_FORTY_ONE_OK",
    "path": "tools/phase3056_3100/apply-controlled-forty-tool-mutation.mjs"
  },
  {
    "phase": 3597,
    "exportName": "buildPhase3597FiftyMutationTargetFortyTwoStatus",
    "marker": "PHASE3597_FIFTY_TOOL_TARGET_FORTY_TWO_OK",
    "path": "tools/phase3101_3146/apply-controlled-forty-one-tool-mutation.mjs"
  },
  {
    "phase": 3598,
    "exportName": "buildPhase3598FiftyMutationTargetFortyThreeStatus",
    "marker": "PHASE3598_FIFTY_TOOL_TARGET_FORTY_THREE_OK",
    "path": "tools/phase3147_3193/apply-controlled-forty-two-tool-mutation.mjs"
  },
  {
    "phase": 3599,
    "exportName": "buildPhase3599FiftyMutationTargetFortyFourStatus",
    "marker": "PHASE3599_FIFTY_TOOL_TARGET_FORTY_FOUR_OK",
    "path": "tools/phase3194_3241/apply-controlled-forty-three-tool-mutation.mjs"
  },
  {
    "phase": 3600,
    "exportName": "buildPhase3600FiftyMutationTargetFortyFiveStatus",
    "marker": "PHASE3600_FIFTY_TOOL_TARGET_FORTY_FIVE_OK",
    "path": "tools/phase3242_3290/apply-controlled-forty-four-tool-mutation.mjs"
  },
  {
    "phase": 3601,
    "exportName": "buildPhase3601FiftyMutationTargetFortySixStatus",
    "marker": "PHASE3601_FIFTY_TOOL_TARGET_FORTY_SIX_OK",
    "path": "tools/phase3291_3340/apply-controlled-forty-five-tool-mutation.mjs"
  },
  {
    "phase": 3602,
    "exportName": "buildPhase3602FiftyMutationTargetFortySevenStatus",
    "marker": "PHASE3602_FIFTY_TOOL_TARGET_FORTY_SEVEN_OK",
    "path": "tools/phase3341_3391/apply-controlled-forty-six-tool-mutation.mjs"
  },
  {
    "phase": 3603,
    "exportName": "buildPhase3603FiftyMutationTargetFortyEightStatus",
    "marker": "PHASE3603_FIFTY_TOOL_TARGET_FORTY_EIGHT_OK",
    "path": "tools/phase3392_3443/apply-controlled-forty-seven-tool-mutation.mjs"
  },
  {
    "phase": 3604,
    "exportName": "buildPhase3604FiftyMutationTargetFortyNineStatus",
    "marker": "PHASE3604_FIFTY_TOOL_TARGET_FORTY_NINE_OK",
    "path": "tools/phase3444_3496/apply-controlled-forty-eight-tool-mutation.mjs"
  },
  {
    "phase": 3605,
    "exportName": "buildPhase3605FiftyMutationRuntimeStatus",
    "marker": "PHASE3605_FIFTY_TOOL_TARGET_FIFTY_OK",
    "path": "tools/phase3497_3550/apply-controlled-forty-nine-tool-mutation.mjs"
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
