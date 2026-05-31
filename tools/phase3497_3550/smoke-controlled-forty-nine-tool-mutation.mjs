import { pathToFileURL } from "node:url";
import path from "node:path";

const phaseId = "Phase3497A-3550A-Controlled-Forty-Nine-Tool-Mutation";

const smokeTargets = [
  {
    "phase": 3502,
    "exportName": "buildPhase3502FortyNineMutationTargetOneStatus",
    "marker": "PHASE3502_FORTY_NINE_TOOL_TARGET_ONE_OK",
    "path": "tools/phase2091/generated-source-patch-target.mjs"
  },
  {
    "phase": 3503,
    "exportName": "buildPhase3503FortyNineMutationTargetTwoStatus",
    "marker": "PHASE3503_FORTY_NINE_TOOL_TARGET_TWO_OK",
    "path": "tools/phase2092/apply-controlled-existing-tool-mutation.mjs"
  },
  {
    "phase": 3504,
    "exportName": "buildPhase3504FortyNineMutationTargetThreeStatus",
    "marker": "PHASE3504_FORTY_NINE_TOOL_TARGET_THREE_OK",
    "path": "tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs"
  },
  {
    "phase": 3505,
    "exportName": "buildPhase3505FortyNineMutationTargetFourStatus",
    "marker": "PHASE3505_FORTY_NINE_TOOL_TARGET_FOUR_OK",
    "path": "tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs"
  },
  {
    "phase": 3506,
    "exportName": "buildPhase3506FortyNineMutationTargetFiveStatus",
    "marker": "PHASE3506_FORTY_NINE_TOOL_TARGET_FIVE_OK",
    "path": "tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs"
  },
  {
    "phase": 3507,
    "exportName": "buildPhase3507FortyNineMutationTargetSixStatus",
    "marker": "PHASE3507_FORTY_NINE_TOOL_TARGET_SIX_OK",
    "path": "tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs"
  },
  {
    "phase": 3508,
    "exportName": "buildPhase3508FortyNineMutationTargetSevenStatus",
    "marker": "PHASE3508_FORTY_NINE_TOOL_TARGET_SEVEN_OK",
    "path": "tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs"
  },
  {
    "phase": 3509,
    "exportName": "buildPhase3509FortyNineMutationTargetEightStatus",
    "marker": "PHASE3509_FORTY_NINE_TOOL_TARGET_EIGHT_OK",
    "path": "tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs"
  },
  {
    "phase": 3510,
    "exportName": "buildPhase3510FortyNineMutationTargetNineStatus",
    "marker": "PHASE3510_FORTY_NINE_TOOL_TARGET_NINE_OK",
    "path": "tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs"
  },
  {
    "phase": 3511,
    "exportName": "buildPhase3511FortyNineMutationTargetTenStatus",
    "marker": "PHASE3511_FORTY_NINE_TOOL_TARGET_TEN_OK",
    "path": "tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs"
  },
  {
    "phase": 3512,
    "exportName": "buildPhase3512FortyNineMutationTargetElevenStatus",
    "marker": "PHASE3512_FORTY_NINE_TOOL_TARGET_ELEVEN_OK",
    "path": "tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs"
  },
  {
    "phase": 3513,
    "exportName": "buildPhase3513FortyNineMutationTargetTwelveStatus",
    "marker": "PHASE3513_FORTY_NINE_TOOL_TARGET_TWELVE_OK",
    "path": "tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs"
  },
  {
    "phase": 3514,
    "exportName": "buildPhase3514FortyNineMutationTargetThirteenStatus",
    "marker": "PHASE3514_FORTY_NINE_TOOL_TARGET_THIRTEEN_OK",
    "path": "tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs"
  },
  {
    "phase": 3515,
    "exportName": "buildPhase3515FortyNineMutationTargetFourteenStatus",
    "marker": "PHASE3515_FORTY_NINE_TOOL_TARGET_FOURTEEN_OK",
    "path": "tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs"
  },
  {
    "phase": 3516,
    "exportName": "buildPhase3516FortyNineMutationTargetFifteenStatus",
    "marker": "PHASE3516_FORTY_NINE_TOOL_TARGET_FIFTEEN_OK",
    "path": "tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs"
  },
  {
    "phase": 3517,
    "exportName": "buildPhase3517FortyNineMutationTargetSixteenStatus",
    "marker": "PHASE3517_FORTY_NINE_TOOL_TARGET_SIXTEEN_OK",
    "path": "tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs"
  },
  {
    "phase": 3518,
    "exportName": "buildPhase3518FortyNineMutationTargetSeventeenStatus",
    "marker": "PHASE3518_FORTY_NINE_TOOL_TARGET_SEVENTEEN_OK",
    "path": "tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs"
  },
  {
    "phase": 3519,
    "exportName": "buildPhase3519FortyNineMutationTargetEighteenStatus",
    "marker": "PHASE3519_FORTY_NINE_TOOL_TARGET_EIGHTEEN_OK",
    "path": "tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs"
  },
  {
    "phase": 3520,
    "exportName": "buildPhase3520FortyNineMutationTargetNineteenStatus",
    "marker": "PHASE3520_FORTY_NINE_TOOL_TARGET_NINETEEN_OK",
    "path": "tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs"
  },
  {
    "phase": 3521,
    "exportName": "buildPhase3521FortyNineMutationTargetTwentyStatus",
    "marker": "PHASE3521_FORTY_NINE_TOOL_TARGET_TWENTY_OK",
    "path": "tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs"
  },
  {
    "phase": 3522,
    "exportName": "buildPhase3522FortyNineMutationTargetTwentyOneStatus",
    "marker": "PHASE3522_FORTY_NINE_TOOL_TARGET_TWENTY_ONE_OK",
    "path": "tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs"
  },
  {
    "phase": 3523,
    "exportName": "buildPhase3523FortyNineMutationTargetTwentyTwoStatus",
    "marker": "PHASE3523_FORTY_NINE_TOOL_TARGET_TWENTY_TWO_OK",
    "path": "tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs"
  },
  {
    "phase": 3524,
    "exportName": "buildPhase3524FortyNineMutationTargetTwentyThreeStatus",
    "marker": "PHASE3524_FORTY_NINE_TOOL_TARGET_TWENTY_THREE_OK",
    "path": "tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs"
  },
  {
    "phase": 3525,
    "exportName": "buildPhase3525FortyNineMutationTargetTwentyFourStatus",
    "marker": "PHASE3525_FORTY_NINE_TOOL_TARGET_TWENTY_FOUR_OK",
    "path": "tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs"
  },
  {
    "phase": 3526,
    "exportName": "buildPhase3526FortyNineMutationTargetTwentyFiveStatus",
    "marker": "PHASE3526_FORTY_NINE_TOOL_TARGET_TWENTY_FIVE_OK",
    "path": "tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs"
  },
  {
    "phase": 3527,
    "exportName": "buildPhase3527FortyNineMutationTargetTwentySixStatus",
    "marker": "PHASE3527_FORTY_NINE_TOOL_TARGET_TWENTY_SIX_OK",
    "path": "tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs"
  },
  {
    "phase": 3528,
    "exportName": "buildPhase3528FortyNineMutationTargetTwentySevenStatus",
    "marker": "PHASE3528_FORTY_NINE_TOOL_TARGET_TWENTY_SEVEN_OK",
    "path": "tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs"
  },
  {
    "phase": 3529,
    "exportName": "buildPhase3529FortyNineMutationTargetTwentyEightStatus",
    "marker": "PHASE3529_FORTY_NINE_TOOL_TARGET_TWENTY_EIGHT_OK",
    "path": "tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs"
  },
  {
    "phase": 3530,
    "exportName": "buildPhase3530FortyNineMutationTargetTwentyNineStatus",
    "marker": "PHASE3530_FORTY_NINE_TOOL_TARGET_TWENTY_NINE_OK",
    "path": "tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs"
  },
  {
    "phase": 3531,
    "exportName": "buildPhase3531FortyNineMutationTargetThirtyStatus",
    "marker": "PHASE3531_FORTY_NINE_TOOL_TARGET_THIRTY_OK",
    "path": "tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs"
  },
  {
    "phase": 3532,
    "exportName": "buildPhase3532FortyNineMutationTargetThirtyOneStatus",
    "marker": "PHASE3532_FORTY_NINE_TOOL_TARGET_THIRTY_ONE_OK",
    "path": "tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs"
  },
  {
    "phase": 3533,
    "exportName": "buildPhase3533FortyNineMutationTargetThirtyTwoStatus",
    "marker": "PHASE3533_FORTY_NINE_TOOL_TARGET_THIRTY_TWO_OK",
    "path": "tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs"
  },
  {
    "phase": 3534,
    "exportName": "buildPhase3534FortyNineMutationTargetThirtyThreeStatus",
    "marker": "PHASE3534_FORTY_NINE_TOOL_TARGET_THIRTY_THREE_OK",
    "path": "tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs"
  },
  {
    "phase": 3535,
    "exportName": "buildPhase3535FortyNineMutationTargetThirtyFourStatus",
    "marker": "PHASE3535_FORTY_NINE_TOOL_TARGET_THIRTY_FOUR_OK",
    "path": "tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs"
  },
  {
    "phase": 3536,
    "exportName": "buildPhase3536FortyNineMutationTargetThirtyFiveStatus",
    "marker": "PHASE3536_FORTY_NINE_TOOL_TARGET_THIRTY_FIVE_OK",
    "path": "tools/phase2807_2845/apply-controlled-thirty-four-tool-mutation.mjs"
  },
  {
    "phase": 3537,
    "exportName": "buildPhase3537FortyNineMutationTargetThirtySixStatus",
    "marker": "PHASE3537_FORTY_NINE_TOOL_TARGET_THIRTY_SIX_OK",
    "path": "tools/phase2846_2885/apply-controlled-thirty-five-tool-mutation.mjs"
  },
  {
    "phase": 3538,
    "exportName": "buildPhase3538FortyNineMutationTargetThirtySevenStatus",
    "marker": "PHASE3538_FORTY_NINE_TOOL_TARGET_THIRTY_SEVEN_OK",
    "path": "tools/phase2886_2926/apply-controlled-thirty-six-tool-mutation.mjs"
  },
  {
    "phase": 3539,
    "exportName": "buildPhase3539FortyNineMutationTargetThirtyEightStatus",
    "marker": "PHASE3539_FORTY_NINE_TOOL_TARGET_THIRTY_EIGHT_OK",
    "path": "tools/phase2927_2968/apply-controlled-thirty-seven-tool-mutation.mjs"
  },
  {
    "phase": 3540,
    "exportName": "buildPhase3540FortyNineMutationTargetThirtyNineStatus",
    "marker": "PHASE3540_FORTY_NINE_TOOL_TARGET_THIRTY_NINE_OK",
    "path": "tools/phase2969_3011/apply-controlled-thirty-eight-tool-mutation.mjs"
  },
  {
    "phase": 3541,
    "exportName": "buildPhase3541FortyNineMutationTargetFortyStatus",
    "marker": "PHASE3541_FORTY_NINE_TOOL_TARGET_FORTY_OK",
    "path": "tools/phase3012_3055/apply-controlled-thirty-nine-tool-mutation.mjs"
  },
  {
    "phase": 3542,
    "exportName": "buildPhase3542FortyNineMutationTargetFortyOneStatus",
    "marker": "PHASE3542_FORTY_NINE_TOOL_TARGET_FORTY_ONE_OK",
    "path": "tools/phase3056_3100/apply-controlled-forty-tool-mutation.mjs"
  },
  {
    "phase": 3543,
    "exportName": "buildPhase3543FortyNineMutationTargetFortyTwoStatus",
    "marker": "PHASE3543_FORTY_NINE_TOOL_TARGET_FORTY_TWO_OK",
    "path": "tools/phase3101_3146/apply-controlled-forty-one-tool-mutation.mjs"
  },
  {
    "phase": 3544,
    "exportName": "buildPhase3544FortyNineMutationTargetFortyThreeStatus",
    "marker": "PHASE3544_FORTY_NINE_TOOL_TARGET_FORTY_THREE_OK",
    "path": "tools/phase3147_3193/apply-controlled-forty-two-tool-mutation.mjs"
  },
  {
    "phase": 3545,
    "exportName": "buildPhase3545FortyNineMutationTargetFortyFourStatus",
    "marker": "PHASE3545_FORTY_NINE_TOOL_TARGET_FORTY_FOUR_OK",
    "path": "tools/phase3194_3241/apply-controlled-forty-three-tool-mutation.mjs"
  },
  {
    "phase": 3546,
    "exportName": "buildPhase3546FortyNineMutationTargetFortyFiveStatus",
    "marker": "PHASE3546_FORTY_NINE_TOOL_TARGET_FORTY_FIVE_OK",
    "path": "tools/phase3242_3290/apply-controlled-forty-four-tool-mutation.mjs"
  },
  {
    "phase": 3547,
    "exportName": "buildPhase3547FortyNineMutationTargetFortySixStatus",
    "marker": "PHASE3547_FORTY_NINE_TOOL_TARGET_FORTY_SIX_OK",
    "path": "tools/phase3291_3340/apply-controlled-forty-five-tool-mutation.mjs"
  },
  {
    "phase": 3548,
    "exportName": "buildPhase3548FortyNineMutationTargetFortySevenStatus",
    "marker": "PHASE3548_FORTY_NINE_TOOL_TARGET_FORTY_SEVEN_OK",
    "path": "tools/phase3341_3391/apply-controlled-forty-six-tool-mutation.mjs"
  },
  {
    "phase": 3549,
    "exportName": "buildPhase3549FortyNineMutationTargetFortyEightStatus",
    "marker": "PHASE3549_FORTY_NINE_TOOL_TARGET_FORTY_EIGHT_OK",
    "path": "tools/phase3392_3443/apply-controlled-forty-seven-tool-mutation.mjs"
  },
  {
    "phase": 3550,
    "exportName": "buildPhase3550FortyNineMutationRuntimeStatus",
    "marker": "PHASE3550_FORTY_NINE_TOOL_TARGET_FORTY_NINE_OK",
    "path": "tools/phase3444_3496/apply-controlled-forty-eight-tool-mutation.mjs"
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
