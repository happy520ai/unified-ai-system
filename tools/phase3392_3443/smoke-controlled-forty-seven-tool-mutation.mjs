import { pathToFileURL } from "node:url";
import path from "node:path";

const phaseId = "Phase3392A-3443A-Controlled-Forty-Seven-Tool-Mutation";

const smokeTargets = [
  {
    "phase": 3397,
    "exportName": "buildPhase3397FortySevenMutationTargetOneStatus",
    "marker": "PHASE3397_FORTY_SEVEN_TOOL_TARGET_ONE_OK",
    "path": "tools/phase2091/generated-source-patch-target.mjs"
  },
  {
    "phase": 3398,
    "exportName": "buildPhase3398FortySevenMutationTargetTwoStatus",
    "marker": "PHASE3398_FORTY_SEVEN_TOOL_TARGET_TWO_OK",
    "path": "tools/phase2092/apply-controlled-existing-tool-mutation.mjs"
  },
  {
    "phase": 3399,
    "exportName": "buildPhase3399FortySevenMutationTargetThreeStatus",
    "marker": "PHASE3399_FORTY_SEVEN_TOOL_TARGET_THREE_OK",
    "path": "tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs"
  },
  {
    "phase": 3400,
    "exportName": "buildPhase3400FortySevenMutationTargetFourStatus",
    "marker": "PHASE3400_FORTY_SEVEN_TOOL_TARGET_FOUR_OK",
    "path": "tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs"
  },
  {
    "phase": 3401,
    "exportName": "buildPhase3401FortySevenMutationTargetFiveStatus",
    "marker": "PHASE3401_FORTY_SEVEN_TOOL_TARGET_FIVE_OK",
    "path": "tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs"
  },
  {
    "phase": 3402,
    "exportName": "buildPhase3402FortySevenMutationTargetSixStatus",
    "marker": "PHASE3402_FORTY_SEVEN_TOOL_TARGET_SIX_OK",
    "path": "tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs"
  },
  {
    "phase": 3403,
    "exportName": "buildPhase3403FortySevenMutationTargetSevenStatus",
    "marker": "PHASE3403_FORTY_SEVEN_TOOL_TARGET_SEVEN_OK",
    "path": "tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs"
  },
  {
    "phase": 3404,
    "exportName": "buildPhase3404FortySevenMutationTargetEightStatus",
    "marker": "PHASE3404_FORTY_SEVEN_TOOL_TARGET_EIGHT_OK",
    "path": "tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs"
  },
  {
    "phase": 3405,
    "exportName": "buildPhase3405FortySevenMutationTargetNineStatus",
    "marker": "PHASE3405_FORTY_SEVEN_TOOL_TARGET_NINE_OK",
    "path": "tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs"
  },
  {
    "phase": 3406,
    "exportName": "buildPhase3406FortySevenMutationTargetTenStatus",
    "marker": "PHASE3406_FORTY_SEVEN_TOOL_TARGET_TEN_OK",
    "path": "tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs"
  },
  {
    "phase": 3407,
    "exportName": "buildPhase3407FortySevenMutationTargetElevenStatus",
    "marker": "PHASE3407_FORTY_SEVEN_TOOL_TARGET_ELEVEN_OK",
    "path": "tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs"
  },
  {
    "phase": 3408,
    "exportName": "buildPhase3408FortySevenMutationTargetTwelveStatus",
    "marker": "PHASE3408_FORTY_SEVEN_TOOL_TARGET_TWELVE_OK",
    "path": "tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs"
  },
  {
    "phase": 3409,
    "exportName": "buildPhase3409FortySevenMutationTargetThirteenStatus",
    "marker": "PHASE3409_FORTY_SEVEN_TOOL_TARGET_THIRTEEN_OK",
    "path": "tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs"
  },
  {
    "phase": 3410,
    "exportName": "buildPhase3410FortySevenMutationTargetFourteenStatus",
    "marker": "PHASE3410_FORTY_SEVEN_TOOL_TARGET_FOURTEEN_OK",
    "path": "tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs"
  },
  {
    "phase": 3411,
    "exportName": "buildPhase3411FortySevenMutationTargetFifteenStatus",
    "marker": "PHASE3411_FORTY_SEVEN_TOOL_TARGET_FIFTEEN_OK",
    "path": "tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs"
  },
  {
    "phase": 3412,
    "exportName": "buildPhase3412FortySevenMutationTargetSixteenStatus",
    "marker": "PHASE3412_FORTY_SEVEN_TOOL_TARGET_SIXTEEN_OK",
    "path": "tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs"
  },
  {
    "phase": 3413,
    "exportName": "buildPhase3413FortySevenMutationTargetSeventeenStatus",
    "marker": "PHASE3413_FORTY_SEVEN_TOOL_TARGET_SEVENTEEN_OK",
    "path": "tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs"
  },
  {
    "phase": 3414,
    "exportName": "buildPhase3414FortySevenMutationTargetEighteenStatus",
    "marker": "PHASE3414_FORTY_SEVEN_TOOL_TARGET_EIGHTEEN_OK",
    "path": "tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs"
  },
  {
    "phase": 3415,
    "exportName": "buildPhase3415FortySevenMutationTargetNineteenStatus",
    "marker": "PHASE3415_FORTY_SEVEN_TOOL_TARGET_NINETEEN_OK",
    "path": "tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs"
  },
  {
    "phase": 3416,
    "exportName": "buildPhase3416FortySevenMutationTargetTwentyStatus",
    "marker": "PHASE3416_FORTY_SEVEN_TOOL_TARGET_TWENTY_OK",
    "path": "tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs"
  },
  {
    "phase": 3417,
    "exportName": "buildPhase3417FortySevenMutationTargetTwentyOneStatus",
    "marker": "PHASE3417_FORTY_SEVEN_TOOL_TARGET_TWENTY_ONE_OK",
    "path": "tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs"
  },
  {
    "phase": 3418,
    "exportName": "buildPhase3418FortySevenMutationTargetTwentyTwoStatus",
    "marker": "PHASE3418_FORTY_SEVEN_TOOL_TARGET_TWENTY_TWO_OK",
    "path": "tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs"
  },
  {
    "phase": 3419,
    "exportName": "buildPhase3419FortySevenMutationTargetTwentyThreeStatus",
    "marker": "PHASE3419_FORTY_SEVEN_TOOL_TARGET_TWENTY_THREE_OK",
    "path": "tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs"
  },
  {
    "phase": 3420,
    "exportName": "buildPhase3420FortySevenMutationTargetTwentyFourStatus",
    "marker": "PHASE3420_FORTY_SEVEN_TOOL_TARGET_TWENTY_FOUR_OK",
    "path": "tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs"
  },
  {
    "phase": 3421,
    "exportName": "buildPhase3421FortySevenMutationTargetTwentyFiveStatus",
    "marker": "PHASE3421_FORTY_SEVEN_TOOL_TARGET_TWENTY_FIVE_OK",
    "path": "tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs"
  },
  {
    "phase": 3422,
    "exportName": "buildPhase3422FortySevenMutationTargetTwentySixStatus",
    "marker": "PHASE3422_FORTY_SEVEN_TOOL_TARGET_TWENTY_SIX_OK",
    "path": "tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs"
  },
  {
    "phase": 3423,
    "exportName": "buildPhase3423FortySevenMutationTargetTwentySevenStatus",
    "marker": "PHASE3423_FORTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK",
    "path": "tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs"
  },
  {
    "phase": 3424,
    "exportName": "buildPhase3424FortySevenMutationTargetTwentyEightStatus",
    "marker": "PHASE3424_FORTY_SEVEN_TOOL_TARGET_TWENTY_EIGHT_OK",
    "path": "tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs"
  },
  {
    "phase": 3425,
    "exportName": "buildPhase3425FortySevenMutationTargetTwentyNineStatus",
    "marker": "PHASE3425_FORTY_SEVEN_TOOL_TARGET_TWENTY_NINE_OK",
    "path": "tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs"
  },
  {
    "phase": 3426,
    "exportName": "buildPhase3426FortySevenMutationTargetThirtyStatus",
    "marker": "PHASE3426_FORTY_SEVEN_TOOL_TARGET_THIRTY_OK",
    "path": "tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs"
  },
  {
    "phase": 3427,
    "exportName": "buildPhase3427FortySevenMutationTargetThirtyOneStatus",
    "marker": "PHASE3427_FORTY_SEVEN_TOOL_TARGET_THIRTY_ONE_OK",
    "path": "tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs"
  },
  {
    "phase": 3428,
    "exportName": "buildPhase3428FortySevenMutationTargetThirtyTwoStatus",
    "marker": "PHASE3428_FORTY_SEVEN_TOOL_TARGET_THIRTY_TWO_OK",
    "path": "tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs"
  },
  {
    "phase": 3429,
    "exportName": "buildPhase3429FortySevenMutationTargetThirtyThreeStatus",
    "marker": "PHASE3429_FORTY_SEVEN_TOOL_TARGET_THIRTY_THREE_OK",
    "path": "tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs"
  },
  {
    "phase": 3430,
    "exportName": "buildPhase3430FortySevenMutationTargetThirtyFourStatus",
    "marker": "PHASE3430_FORTY_SEVEN_TOOL_TARGET_THIRTY_FOUR_OK",
    "path": "tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs"
  },
  {
    "phase": 3431,
    "exportName": "buildPhase3431FortySevenMutationTargetThirtyFiveStatus",
    "marker": "PHASE3431_FORTY_SEVEN_TOOL_TARGET_THIRTY_FIVE_OK",
    "path": "tools/phase2807_2845/apply-controlled-thirty-four-tool-mutation.mjs"
  },
  {
    "phase": 3432,
    "exportName": "buildPhase3432FortySevenMutationTargetThirtySixStatus",
    "marker": "PHASE3432_FORTY_SEVEN_TOOL_TARGET_THIRTY_SIX_OK",
    "path": "tools/phase2846_2885/apply-controlled-thirty-five-tool-mutation.mjs"
  },
  {
    "phase": 3433,
    "exportName": "buildPhase3433FortySevenMutationTargetThirtySevenStatus",
    "marker": "PHASE3433_FORTY_SEVEN_TOOL_TARGET_THIRTY_SEVEN_OK",
    "path": "tools/phase2886_2926/apply-controlled-thirty-six-tool-mutation.mjs"
  },
  {
    "phase": 3434,
    "exportName": "buildPhase3434FortySevenMutationTargetThirtyEightStatus",
    "marker": "PHASE3434_FORTY_SEVEN_TOOL_TARGET_THIRTY_EIGHT_OK",
    "path": "tools/phase2927_2968/apply-controlled-thirty-seven-tool-mutation.mjs"
  },
  {
    "phase": 3435,
    "exportName": "buildPhase3435FortySevenMutationTargetThirtyNineStatus",
    "marker": "PHASE3435_FORTY_SEVEN_TOOL_TARGET_THIRTY_NINE_OK",
    "path": "tools/phase2969_3011/apply-controlled-thirty-eight-tool-mutation.mjs"
  },
  {
    "phase": 3436,
    "exportName": "buildPhase3436FortySevenMutationTargetFortyStatus",
    "marker": "PHASE3436_FORTY_SEVEN_TOOL_TARGET_FORTY_OK",
    "path": "tools/phase3012_3055/apply-controlled-thirty-nine-tool-mutation.mjs"
  },
  {
    "phase": 3437,
    "exportName": "buildPhase3437FortySevenMutationTargetFortyOneStatus",
    "marker": "PHASE3437_FORTY_SEVEN_TOOL_TARGET_FORTY_ONE_OK",
    "path": "tools/phase3056_3100/apply-controlled-forty-tool-mutation.mjs"
  },
  {
    "phase": 3438,
    "exportName": "buildPhase3438FortySevenMutationTargetFortyTwoStatus",
    "marker": "PHASE3438_FORTY_SEVEN_TOOL_TARGET_FORTY_TWO_OK",
    "path": "tools/phase3101_3146/apply-controlled-forty-one-tool-mutation.mjs"
  },
  {
    "phase": 3439,
    "exportName": "buildPhase3439FortySevenMutationTargetFortyThreeStatus",
    "marker": "PHASE3439_FORTY_SEVEN_TOOL_TARGET_FORTY_THREE_OK",
    "path": "tools/phase3147_3193/apply-controlled-forty-two-tool-mutation.mjs"
  },
  {
    "phase": 3440,
    "exportName": "buildPhase3440FortySevenMutationTargetFortyFourStatus",
    "marker": "PHASE3440_FORTY_SEVEN_TOOL_TARGET_FORTY_FOUR_OK",
    "path": "tools/phase3194_3241/apply-controlled-forty-three-tool-mutation.mjs"
  },
  {
    "phase": 3441,
    "exportName": "buildPhase3441FortySevenMutationTargetFortyFiveStatus",
    "marker": "PHASE3441_FORTY_SEVEN_TOOL_TARGET_FORTY_FIVE_OK",
    "path": "tools/phase3242_3290/apply-controlled-forty-four-tool-mutation.mjs"
  },
  {
    "phase": 3442,
    "exportName": "buildPhase3442FortySevenMutationTargetFortySixStatus",
    "marker": "PHASE3442_FORTY_SEVEN_TOOL_TARGET_FORTY_SIX_OK",
    "path": "tools/phase3291_3340/apply-controlled-forty-five-tool-mutation.mjs"
  },
  {
    "phase": 3443,
    "exportName": "buildPhase3443FortySevenMutationRuntimeStatus",
    "marker": "PHASE3443_FORTY_SEVEN_TOOL_TARGET_FORTY_SEVEN_OK",
    "path": "tools/phase3341_3391/apply-controlled-forty-six-tool-mutation.mjs"
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
