import { pathToFileURL } from "node:url";
import path from "node:path";

const phaseId = "Phase3606A-3661A-Controlled-Fifty-One-Tool-Mutation";

const smokeTargets = [
  {
    "phase": 3611,
    "exportName": "buildPhase3611FiftyOneMutationTargetOneStatus",
    "marker": "PHASE3611_FIFTY_ONE_TOOL_TARGET_ONE_OK",
    "path": "tools/phase2091/generated-source-patch-target.mjs"
  },
  {
    "phase": 3612,
    "exportName": "buildPhase3612FiftyOneMutationTargetTwoStatus",
    "marker": "PHASE3612_FIFTY_ONE_TOOL_TARGET_TWO_OK",
    "path": "tools/phase2092/apply-controlled-existing-tool-mutation.mjs"
  },
  {
    "phase": 3613,
    "exportName": "buildPhase3613FiftyOneMutationTargetThreeStatus",
    "marker": "PHASE3613_FIFTY_ONE_TOOL_TARGET_THREE_OK",
    "path": "tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs"
  },
  {
    "phase": 3614,
    "exportName": "buildPhase3614FiftyOneMutationTargetFourStatus",
    "marker": "PHASE3614_FIFTY_ONE_TOOL_TARGET_FOUR_OK",
    "path": "tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs"
  },
  {
    "phase": 3615,
    "exportName": "buildPhase3615FiftyOneMutationTargetFiveStatus",
    "marker": "PHASE3615_FIFTY_ONE_TOOL_TARGET_FIVE_OK",
    "path": "tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs"
  },
  {
    "phase": 3616,
    "exportName": "buildPhase3616FiftyOneMutationTargetSixStatus",
    "marker": "PHASE3616_FIFTY_ONE_TOOL_TARGET_SIX_OK",
    "path": "tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs"
  },
  {
    "phase": 3617,
    "exportName": "buildPhase3617FiftyOneMutationTargetSevenStatus",
    "marker": "PHASE3617_FIFTY_ONE_TOOL_TARGET_SEVEN_OK",
    "path": "tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs"
  },
  {
    "phase": 3618,
    "exportName": "buildPhase3618FiftyOneMutationTargetEightStatus",
    "marker": "PHASE3618_FIFTY_ONE_TOOL_TARGET_EIGHT_OK",
    "path": "tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs"
  },
  {
    "phase": 3619,
    "exportName": "buildPhase3619FiftyOneMutationTargetNineStatus",
    "marker": "PHASE3619_FIFTY_ONE_TOOL_TARGET_NINE_OK",
    "path": "tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs"
  },
  {
    "phase": 3620,
    "exportName": "buildPhase3620FiftyOneMutationTargetTenStatus",
    "marker": "PHASE3620_FIFTY_ONE_TOOL_TARGET_TEN_OK",
    "path": "tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs"
  },
  {
    "phase": 3621,
    "exportName": "buildPhase3621FiftyOneMutationTargetElevenStatus",
    "marker": "PHASE3621_FIFTY_ONE_TOOL_TARGET_ELEVEN_OK",
    "path": "tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs"
  },
  {
    "phase": 3622,
    "exportName": "buildPhase3622FiftyOneMutationTargetTwelveStatus",
    "marker": "PHASE3622_FIFTY_ONE_TOOL_TARGET_TWELVE_OK",
    "path": "tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs"
  },
  {
    "phase": 3623,
    "exportName": "buildPhase3623FiftyOneMutationTargetThirteenStatus",
    "marker": "PHASE3623_FIFTY_ONE_TOOL_TARGET_THIRTEEN_OK",
    "path": "tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs"
  },
  {
    "phase": 3624,
    "exportName": "buildPhase3624FiftyOneMutationTargetFourteenStatus",
    "marker": "PHASE3624_FIFTY_ONE_TOOL_TARGET_FOURTEEN_OK",
    "path": "tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs"
  },
  {
    "phase": 3625,
    "exportName": "buildPhase3625FiftyOneMutationTargetFifteenStatus",
    "marker": "PHASE3625_FIFTY_ONE_TOOL_TARGET_FIFTEEN_OK",
    "path": "tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs"
  },
  {
    "phase": 3626,
    "exportName": "buildPhase3626FiftyOneMutationTargetSixteenStatus",
    "marker": "PHASE3626_FIFTY_ONE_TOOL_TARGET_SIXTEEN_OK",
    "path": "tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs"
  },
  {
    "phase": 3627,
    "exportName": "buildPhase3627FiftyOneMutationTargetSeventeenStatus",
    "marker": "PHASE3627_FIFTY_ONE_TOOL_TARGET_SEVENTEEN_OK",
    "path": "tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs"
  },
  {
    "phase": 3628,
    "exportName": "buildPhase3628FiftyOneMutationTargetEighteenStatus",
    "marker": "PHASE3628_FIFTY_ONE_TOOL_TARGET_EIGHTEEN_OK",
    "path": "tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs"
  },
  {
    "phase": 3629,
    "exportName": "buildPhase3629FiftyOneMutationTargetNineteenStatus",
    "marker": "PHASE3629_FIFTY_ONE_TOOL_TARGET_NINETEEN_OK",
    "path": "tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs"
  },
  {
    "phase": 3630,
    "exportName": "buildPhase3630FiftyOneMutationTargetTwentyStatus",
    "marker": "PHASE3630_FIFTY_ONE_TOOL_TARGET_TWENTY_OK",
    "path": "tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs"
  },
  {
    "phase": 3631,
    "exportName": "buildPhase3631FiftyOneMutationTargetTwentyOneStatus",
    "marker": "PHASE3631_FIFTY_ONE_TOOL_TARGET_TWENTY_ONE_OK",
    "path": "tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs"
  },
  {
    "phase": 3632,
    "exportName": "buildPhase3632FiftyOneMutationTargetTwentyTwoStatus",
    "marker": "PHASE3632_FIFTY_ONE_TOOL_TARGET_TWENTY_TWO_OK",
    "path": "tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs"
  },
  {
    "phase": 3633,
    "exportName": "buildPhase3633FiftyOneMutationTargetTwentyThreeStatus",
    "marker": "PHASE3633_FIFTY_ONE_TOOL_TARGET_TWENTY_THREE_OK",
    "path": "tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs"
  },
  {
    "phase": 3634,
    "exportName": "buildPhase3634FiftyOneMutationTargetTwentyFourStatus",
    "marker": "PHASE3634_FIFTY_ONE_TOOL_TARGET_TWENTY_FOUR_OK",
    "path": "tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs"
  },
  {
    "phase": 3635,
    "exportName": "buildPhase3635FiftyOneMutationTargetTwentyFiveStatus",
    "marker": "PHASE3635_FIFTY_ONE_TOOL_TARGET_TWENTY_FIVE_OK",
    "path": "tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs"
  },
  {
    "phase": 3636,
    "exportName": "buildPhase3636FiftyOneMutationTargetTwentySixStatus",
    "marker": "PHASE3636_FIFTY_ONE_TOOL_TARGET_TWENTY_SIX_OK",
    "path": "tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs"
  },
  {
    "phase": 3637,
    "exportName": "buildPhase3637FiftyOneMutationTargetTwentySevenStatus",
    "marker": "PHASE3637_FIFTY_ONE_TOOL_TARGET_TWENTY_SEVEN_OK",
    "path": "tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs"
  },
  {
    "phase": 3638,
    "exportName": "buildPhase3638FiftyOneMutationTargetTwentyEightStatus",
    "marker": "PHASE3638_FIFTY_ONE_TOOL_TARGET_TWENTY_EIGHT_OK",
    "path": "tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs"
  },
  {
    "phase": 3639,
    "exportName": "buildPhase3639FiftyOneMutationTargetTwentyNineStatus",
    "marker": "PHASE3639_FIFTY_ONE_TOOL_TARGET_TWENTY_NINE_OK",
    "path": "tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs"
  },
  {
    "phase": 3640,
    "exportName": "buildPhase3640FiftyOneMutationTargetThirtyStatus",
    "marker": "PHASE3640_FIFTY_ONE_TOOL_TARGET_THIRTY_OK",
    "path": "tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs"
  },
  {
    "phase": 3641,
    "exportName": "buildPhase3641FiftyOneMutationTargetThirtyOneStatus",
    "marker": "PHASE3641_FIFTY_ONE_TOOL_TARGET_THIRTY_ONE_OK",
    "path": "tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs"
  },
  {
    "phase": 3642,
    "exportName": "buildPhase3642FiftyOneMutationTargetThirtyTwoStatus",
    "marker": "PHASE3642_FIFTY_ONE_TOOL_TARGET_THIRTY_TWO_OK",
    "path": "tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs"
  },
  {
    "phase": 3643,
    "exportName": "buildPhase3643FiftyOneMutationTargetThirtyThreeStatus",
    "marker": "PHASE3643_FIFTY_ONE_TOOL_TARGET_THIRTY_THREE_OK",
    "path": "tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs"
  },
  {
    "phase": 3644,
    "exportName": "buildPhase3644FiftyOneMutationTargetThirtyFourStatus",
    "marker": "PHASE3644_FIFTY_ONE_TOOL_TARGET_THIRTY_FOUR_OK",
    "path": "tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs"
  },
  {
    "phase": 3645,
    "exportName": "buildPhase3645FiftyOneMutationTargetThirtyFiveStatus",
    "marker": "PHASE3645_FIFTY_ONE_TOOL_TARGET_THIRTY_FIVE_OK",
    "path": "tools/phase2807_2845/apply-controlled-thirty-four-tool-mutation.mjs"
  },
  {
    "phase": 3646,
    "exportName": "buildPhase3646FiftyOneMutationTargetThirtySixStatus",
    "marker": "PHASE3646_FIFTY_ONE_TOOL_TARGET_THIRTY_SIX_OK",
    "path": "tools/phase2846_2885/apply-controlled-thirty-five-tool-mutation.mjs"
  },
  {
    "phase": 3647,
    "exportName": "buildPhase3647FiftyOneMutationTargetThirtySevenStatus",
    "marker": "PHASE3647_FIFTY_ONE_TOOL_TARGET_THIRTY_SEVEN_OK",
    "path": "tools/phase2886_2926/apply-controlled-thirty-six-tool-mutation.mjs"
  },
  {
    "phase": 3648,
    "exportName": "buildPhase3648FiftyOneMutationTargetThirtyEightStatus",
    "marker": "PHASE3648_FIFTY_ONE_TOOL_TARGET_THIRTY_EIGHT_OK",
    "path": "tools/phase2927_2968/apply-controlled-thirty-seven-tool-mutation.mjs"
  },
  {
    "phase": 3649,
    "exportName": "buildPhase3649FiftyOneMutationTargetThirtyNineStatus",
    "marker": "PHASE3649_FIFTY_ONE_TOOL_TARGET_THIRTY_NINE_OK",
    "path": "tools/phase2969_3011/apply-controlled-thirty-eight-tool-mutation.mjs"
  },
  {
    "phase": 3650,
    "exportName": "buildPhase3650FiftyOneMutationTargetFortyStatus",
    "marker": "PHASE3650_FIFTY_ONE_TOOL_TARGET_FORTY_OK",
    "path": "tools/phase3012_3055/apply-controlled-thirty-nine-tool-mutation.mjs"
  },
  {
    "phase": 3651,
    "exportName": "buildPhase3651FiftyOneMutationTargetFortyOneStatus",
    "marker": "PHASE3651_FIFTY_ONE_TOOL_TARGET_FORTY_ONE_OK",
    "path": "tools/phase3056_3100/apply-controlled-forty-tool-mutation.mjs"
  },
  {
    "phase": 3652,
    "exportName": "buildPhase3652FiftyOneMutationTargetFortyTwoStatus",
    "marker": "PHASE3652_FIFTY_ONE_TOOL_TARGET_FORTY_TWO_OK",
    "path": "tools/phase3101_3146/apply-controlled-forty-one-tool-mutation.mjs"
  },
  {
    "phase": 3653,
    "exportName": "buildPhase3653FiftyOneMutationTargetFortyThreeStatus",
    "marker": "PHASE3653_FIFTY_ONE_TOOL_TARGET_FORTY_THREE_OK",
    "path": "tools/phase3147_3193/apply-controlled-forty-two-tool-mutation.mjs"
  },
  {
    "phase": 3654,
    "exportName": "buildPhase3654FiftyOneMutationTargetFortyFourStatus",
    "marker": "PHASE3654_FIFTY_ONE_TOOL_TARGET_FORTY_FOUR_OK",
    "path": "tools/phase3194_3241/apply-controlled-forty-three-tool-mutation.mjs"
  },
  {
    "phase": 3655,
    "exportName": "buildPhase3655FiftyOneMutationTargetFortyFiveStatus",
    "marker": "PHASE3655_FIFTY_ONE_TOOL_TARGET_FORTY_FIVE_OK",
    "path": "tools/phase3242_3290/apply-controlled-forty-four-tool-mutation.mjs"
  },
  {
    "phase": 3656,
    "exportName": "buildPhase3656FiftyOneMutationTargetFortySixStatus",
    "marker": "PHASE3656_FIFTY_ONE_TOOL_TARGET_FORTY_SIX_OK",
    "path": "tools/phase3291_3340/apply-controlled-forty-five-tool-mutation.mjs"
  },
  {
    "phase": 3657,
    "exportName": "buildPhase3657FiftyOneMutationTargetFortySevenStatus",
    "marker": "PHASE3657_FIFTY_ONE_TOOL_TARGET_FORTY_SEVEN_OK",
    "path": "tools/phase3341_3391/apply-controlled-forty-six-tool-mutation.mjs"
  },
  {
    "phase": 3658,
    "exportName": "buildPhase3658FiftyOneMutationTargetFortyEightStatus",
    "marker": "PHASE3658_FIFTY_ONE_TOOL_TARGET_FORTY_EIGHT_OK",
    "path": "tools/phase3392_3443/apply-controlled-forty-seven-tool-mutation.mjs"
  },
  {
    "phase": 3659,
    "exportName": "buildPhase3659FiftyOneMutationTargetFortyNineStatus",
    "marker": "PHASE3659_FIFTY_ONE_TOOL_TARGET_FORTY_NINE_OK",
    "path": "tools/phase3444_3496/apply-controlled-forty-eight-tool-mutation.mjs"
  },
  {
    "phase": 3660,
    "exportName": "buildPhase3660FiftyOneMutationTargetFiftyStatus",
    "marker": "PHASE3660_FIFTY_ONE_TOOL_TARGET_FIFTY_OK",
    "path": "tools/phase3497_3550/apply-controlled-forty-nine-tool-mutation.mjs"
  },
  {
    "phase": 3661,
    "exportName": "buildPhase3661FiftyOneMutationRuntimeStatus",
    "marker": "PHASE3661_FIFTY_ONE_TOOL_TARGET_FIFTY_ONE_OK",
    "path": "tools/phase3551_3605/apply-controlled-fifty-tool-mutation.mjs"
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
