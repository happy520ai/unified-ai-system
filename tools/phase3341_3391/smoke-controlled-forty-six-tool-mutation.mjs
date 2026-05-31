import { pathToFileURL } from "node:url";
import path from "node:path";

const phaseId = "Phase3341A-3391A-Controlled-Forty-Six-Tool-Mutation";

const smokeTargets = [
  {
    "phase": 3346,
    "exportName": "buildPhase3346FortySixMutationTargetOneStatus",
    "marker": "PHASE3346_FORTY_SIX_TOOL_TARGET_ONE_OK",
    "path": "tools/phase2091/generated-source-patch-target.mjs"
  },
  {
    "phase": 3347,
    "exportName": "buildPhase3347FortySixMutationTargetTwoStatus",
    "marker": "PHASE3347_FORTY_SIX_TOOL_TARGET_TWO_OK",
    "path": "tools/phase2092/apply-controlled-existing-tool-mutation.mjs"
  },
  {
    "phase": 3348,
    "exportName": "buildPhase3348FortySixMutationTargetThreeStatus",
    "marker": "PHASE3348_FORTY_SIX_TOOL_TARGET_THREE_OK",
    "path": "tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs"
  },
  {
    "phase": 3349,
    "exportName": "buildPhase3349FortySixMutationTargetFourStatus",
    "marker": "PHASE3349_FORTY_SIX_TOOL_TARGET_FOUR_OK",
    "path": "tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs"
  },
  {
    "phase": 3350,
    "exportName": "buildPhase3350FortySixMutationTargetFiveStatus",
    "marker": "PHASE3350_FORTY_SIX_TOOL_TARGET_FIVE_OK",
    "path": "tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs"
  },
  {
    "phase": 3351,
    "exportName": "buildPhase3351FortySixMutationTargetSixStatus",
    "marker": "PHASE3351_FORTY_SIX_TOOL_TARGET_SIX_OK",
    "path": "tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs"
  },
  {
    "phase": 3352,
    "exportName": "buildPhase3352FortySixMutationTargetSevenStatus",
    "marker": "PHASE3352_FORTY_SIX_TOOL_TARGET_SEVEN_OK",
    "path": "tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs"
  },
  {
    "phase": 3353,
    "exportName": "buildPhase3353FortySixMutationTargetEightStatus",
    "marker": "PHASE3353_FORTY_SIX_TOOL_TARGET_EIGHT_OK",
    "path": "tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs"
  },
  {
    "phase": 3354,
    "exportName": "buildPhase3354FortySixMutationTargetNineStatus",
    "marker": "PHASE3354_FORTY_SIX_TOOL_TARGET_NINE_OK",
    "path": "tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs"
  },
  {
    "phase": 3355,
    "exportName": "buildPhase3355FortySixMutationTargetTenStatus",
    "marker": "PHASE3355_FORTY_SIX_TOOL_TARGET_TEN_OK",
    "path": "tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs"
  },
  {
    "phase": 3356,
    "exportName": "buildPhase3356FortySixMutationTargetElevenStatus",
    "marker": "PHASE3356_FORTY_SIX_TOOL_TARGET_ELEVEN_OK",
    "path": "tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs"
  },
  {
    "phase": 3357,
    "exportName": "buildPhase3357FortySixMutationTargetTwelveStatus",
    "marker": "PHASE3357_FORTY_SIX_TOOL_TARGET_TWELVE_OK",
    "path": "tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs"
  },
  {
    "phase": 3358,
    "exportName": "buildPhase3358FortySixMutationTargetThirteenStatus",
    "marker": "PHASE3358_FORTY_SIX_TOOL_TARGET_THIRTEEN_OK",
    "path": "tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs"
  },
  {
    "phase": 3359,
    "exportName": "buildPhase3359FortySixMutationTargetFourteenStatus",
    "marker": "PHASE3359_FORTY_SIX_TOOL_TARGET_FOURTEEN_OK",
    "path": "tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs"
  },
  {
    "phase": 3360,
    "exportName": "buildPhase3360FortySixMutationTargetFifteenStatus",
    "marker": "PHASE3360_FORTY_SIX_TOOL_TARGET_FIFTEEN_OK",
    "path": "tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs"
  },
  {
    "phase": 3361,
    "exportName": "buildPhase3361FortySixMutationTargetSixteenStatus",
    "marker": "PHASE3361_FORTY_SIX_TOOL_TARGET_SIXTEEN_OK",
    "path": "tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs"
  },
  {
    "phase": 3362,
    "exportName": "buildPhase3362FortySixMutationTargetSeventeenStatus",
    "marker": "PHASE3362_FORTY_SIX_TOOL_TARGET_SEVENTEEN_OK",
    "path": "tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs"
  },
  {
    "phase": 3363,
    "exportName": "buildPhase3363FortySixMutationTargetEighteenStatus",
    "marker": "PHASE3363_FORTY_SIX_TOOL_TARGET_EIGHTEEN_OK",
    "path": "tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs"
  },
  {
    "phase": 3364,
    "exportName": "buildPhase3364FortySixMutationTargetNineteenStatus",
    "marker": "PHASE3364_FORTY_SIX_TOOL_TARGET_NINETEEN_OK",
    "path": "tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs"
  },
  {
    "phase": 3365,
    "exportName": "buildPhase3365FortySixMutationTargetTwentyStatus",
    "marker": "PHASE3365_FORTY_SIX_TOOL_TARGET_TWENTY_OK",
    "path": "tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs"
  },
  {
    "phase": 3366,
    "exportName": "buildPhase3366FortySixMutationTargetTwentyOneStatus",
    "marker": "PHASE3366_FORTY_SIX_TOOL_TARGET_TWENTY_ONE_OK",
    "path": "tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs"
  },
  {
    "phase": 3367,
    "exportName": "buildPhase3367FortySixMutationTargetTwentyTwoStatus",
    "marker": "PHASE3367_FORTY_SIX_TOOL_TARGET_TWENTY_TWO_OK",
    "path": "tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs"
  },
  {
    "phase": 3368,
    "exportName": "buildPhase3368FortySixMutationTargetTwentyThreeStatus",
    "marker": "PHASE3368_FORTY_SIX_TOOL_TARGET_TWENTY_THREE_OK",
    "path": "tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs"
  },
  {
    "phase": 3369,
    "exportName": "buildPhase3369FortySixMutationTargetTwentyFourStatus",
    "marker": "PHASE3369_FORTY_SIX_TOOL_TARGET_TWENTY_FOUR_OK",
    "path": "tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs"
  },
  {
    "phase": 3370,
    "exportName": "buildPhase3370FortySixMutationTargetTwentyFiveStatus",
    "marker": "PHASE3370_FORTY_SIX_TOOL_TARGET_TWENTY_FIVE_OK",
    "path": "tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs"
  },
  {
    "phase": 3371,
    "exportName": "buildPhase3371FortySixMutationTargetTwentySixStatus",
    "marker": "PHASE3371_FORTY_SIX_TOOL_TARGET_TWENTY_SIX_OK",
    "path": "tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs"
  },
  {
    "phase": 3372,
    "exportName": "buildPhase3372FortySixMutationTargetTwentySevenStatus",
    "marker": "PHASE3372_FORTY_SIX_TOOL_TARGET_TWENTY_SEVEN_OK",
    "path": "tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs"
  },
  {
    "phase": 3373,
    "exportName": "buildPhase3373FortySixMutationTargetTwentyEightStatus",
    "marker": "PHASE3373_FORTY_SIX_TOOL_TARGET_TWENTY_EIGHT_OK",
    "path": "tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs"
  },
  {
    "phase": 3374,
    "exportName": "buildPhase3374FortySixMutationTargetTwentyNineStatus",
    "marker": "PHASE3374_FORTY_SIX_TOOL_TARGET_TWENTY_NINE_OK",
    "path": "tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs"
  },
  {
    "phase": 3375,
    "exportName": "buildPhase3375FortySixMutationTargetThirtyStatus",
    "marker": "PHASE3375_FORTY_SIX_TOOL_TARGET_THIRTY_OK",
    "path": "tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs"
  },
  {
    "phase": 3376,
    "exportName": "buildPhase3376FortySixMutationTargetThirtyOneStatus",
    "marker": "PHASE3376_FORTY_SIX_TOOL_TARGET_THIRTY_ONE_OK",
    "path": "tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs"
  },
  {
    "phase": 3377,
    "exportName": "buildPhase3377FortySixMutationTargetThirtyTwoStatus",
    "marker": "PHASE3377_FORTY_SIX_TOOL_TARGET_THIRTY_TWO_OK",
    "path": "tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs"
  },
  {
    "phase": 3378,
    "exportName": "buildPhase3378FortySixMutationTargetThirtyThreeStatus",
    "marker": "PHASE3378_FORTY_SIX_TOOL_TARGET_THIRTY_THREE_OK",
    "path": "tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs"
  },
  {
    "phase": 3379,
    "exportName": "buildPhase3379FortySixMutationTargetThirtyFourStatus",
    "marker": "PHASE3379_FORTY_SIX_TOOL_TARGET_THIRTY_FOUR_OK",
    "path": "tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs"
  },
  {
    "phase": 3380,
    "exportName": "buildPhase3380FortySixMutationTargetThirtyFiveStatus",
    "marker": "PHASE3380_FORTY_SIX_TOOL_TARGET_THIRTY_FIVE_OK",
    "path": "tools/phase2807_2845/apply-controlled-thirty-four-tool-mutation.mjs"
  },
  {
    "phase": 3381,
    "exportName": "buildPhase3381FortySixMutationTargetThirtySixStatus",
    "marker": "PHASE3381_FORTY_SIX_TOOL_TARGET_THIRTY_SIX_OK",
    "path": "tools/phase2846_2885/apply-controlled-thirty-five-tool-mutation.mjs"
  },
  {
    "phase": 3382,
    "exportName": "buildPhase3382FortySixMutationTargetThirtySevenStatus",
    "marker": "PHASE3382_FORTY_SIX_TOOL_TARGET_THIRTY_SEVEN_OK",
    "path": "tools/phase2886_2926/apply-controlled-thirty-six-tool-mutation.mjs"
  },
  {
    "phase": 3383,
    "exportName": "buildPhase3383FortySixMutationTargetThirtyEightStatus",
    "marker": "PHASE3383_FORTY_SIX_TOOL_TARGET_THIRTY_EIGHT_OK",
    "path": "tools/phase2927_2968/apply-controlled-thirty-seven-tool-mutation.mjs"
  },
  {
    "phase": 3384,
    "exportName": "buildPhase3384FortySixMutationTargetThirtyNineStatus",
    "marker": "PHASE3384_FORTY_SIX_TOOL_TARGET_THIRTY_NINE_OK",
    "path": "tools/phase2969_3011/apply-controlled-thirty-eight-tool-mutation.mjs"
  },
  {
    "phase": 3385,
    "exportName": "buildPhase3385FortySixMutationTargetFortyStatus",
    "marker": "PHASE3385_FORTY_SIX_TOOL_TARGET_FORTY_OK",
    "path": "tools/phase3012_3055/apply-controlled-thirty-nine-tool-mutation.mjs"
  },
  {
    "phase": 3386,
    "exportName": "buildPhase3386FortySixMutationTargetFortyOneStatus",
    "marker": "PHASE3386_FORTY_SIX_TOOL_TARGET_FORTY_ONE_OK",
    "path": "tools/phase3056_3100/apply-controlled-forty-tool-mutation.mjs"
  },
  {
    "phase": 3387,
    "exportName": "buildPhase3387FortySixMutationTargetFortyTwoStatus",
    "marker": "PHASE3387_FORTY_SIX_TOOL_TARGET_FORTY_TWO_OK",
    "path": "tools/phase3101_3146/apply-controlled-forty-one-tool-mutation.mjs"
  },
  {
    "phase": 3388,
    "exportName": "buildPhase3388FortySixMutationTargetFortyThreeStatus",
    "marker": "PHASE3388_FORTY_SIX_TOOL_TARGET_FORTY_THREE_OK",
    "path": "tools/phase3147_3193/apply-controlled-forty-two-tool-mutation.mjs"
  },
  {
    "phase": 3389,
    "exportName": "buildPhase3389FortySixMutationTargetFortyFourStatus",
    "marker": "PHASE3389_FORTY_SIX_TOOL_TARGET_FORTY_FOUR_OK",
    "path": "tools/phase3194_3241/apply-controlled-forty-three-tool-mutation.mjs"
  },
  {
    "phase": 3390,
    "exportName": "buildPhase3390FortySixMutationTargetFortyFiveStatus",
    "marker": "PHASE3390_FORTY_SIX_TOOL_TARGET_FORTY_FIVE_OK",
    "path": "tools/phase3242_3290/apply-controlled-forty-four-tool-mutation.mjs"
  },
  {
    "phase": 3391,
    "exportName": "buildPhase3391FortySixMutationRuntimeStatus",
    "marker": "PHASE3391_FORTY_SIX_TOOL_TARGET_FORTY_SIX_OK",
    "path": "tools/phase3291_3340/apply-controlled-forty-five-tool-mutation.mjs"
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
