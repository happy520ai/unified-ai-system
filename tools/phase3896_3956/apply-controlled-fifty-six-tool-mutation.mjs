import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  defaultForbiddenPathFragments,
  parseSingleExistingFileMutationProposal,
  readJsonFile,
  readTextFile,
  resolveRelativePath,
  runJsonCommandSmokes,
  runNodeCheckForTargets,
  sanitizeTail,
  sha256Text,
  validateAlreadyAppliedTargetContent,
  validateControlledMutationPlan,
  writeJsonFile,
  writeTextFile,
} from "../phase2101_2110/controlled-mutation-substrate.mjs";

const phaseId = "Phase3896A-3956A-Controlled-Fifty-Six-Tool-Mutation";
const resultPath = "apps/ai-gateway-service/evidence/phase3896-3956-controlled-fifty-six-tool-mutation/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase3896-3956-controlled-fifty-six-tool-mutation/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase3896-3956-controlled-fifty-six-tool-mutation/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase3896-3956-controlled-fifty-six-tool-mutation/fifty-six-smoke.json";

export function buildPhase3956FiftySixMutationRuntimeStatus() {
  return {
    phaseId: "Phase3956A-Controlled-Fifty-Six-Tool-Mutation-Target-Fifty-Six",
    marker: "PHASE3956_FIFTY_SIX_TOOL_TARGET_FIFTY_SIX_OK",
    importSafe: true,
    phase2170Marker: "PHASE2170_NONET_TOOL_TARGET_NINE_OK",
    phase2185Marker: "PHASE2185_DECA_TOOL_TARGET_TEN_OK",
    phase2201Marker: "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK",
    phase2218Marker: "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK",
    phase2236Marker: "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK",
    phase2255Marker: "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK",
    phase2275Marker: "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK",
    phase2296Marker: "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK",
    phase2318Marker: "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK",
    phase2341Marker: "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK",
    phase2365Marker: "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK",
    phase2390Marker: "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK",
    phase2416Marker: "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK",
    phase2443Marker: "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK",
    phase2471Marker: "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK",
    phase2500Marker: "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK",
    phase2530Marker: "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK",
    phase2561Marker: "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK",
    phase2593Marker: "PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK",
    phase2626Marker: "PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK",
    phase2660Marker: "PHASE2660_TWENTY_NINE_TOOL_TARGET_TWENTY_NINE_OK",
    phase2695Marker: "PHASE2695_THIRTY_TOOL_TARGET_THIRTY_OK",
    phase2731Marker: "PHASE2731_THIRTY_ONE_TOOL_TARGET_THIRTY_ONE_OK",
    phase2768Marker: "PHASE2768_THIRTY_TWO_TOOL_TARGET_THIRTY_TWO_OK",
    phase2806Marker: "PHASE2806_THIRTY_THREE_TOOL_TARGET_THIRTY_THREE_OK",
    phase2845Marker: "PHASE2845_THIRTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK",
    phase2885Marker: "PHASE2885_THIRTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK",
    phase2926Marker: "PHASE2926_THIRTY_SIX_TOOL_TARGET_THIRTY_SIX_OK",
    phase2968Marker: "PHASE2968_THIRTY_SEVEN_TOOL_TARGET_THIRTY_SEVEN_OK",
    phase3011Marker: "PHASE3011_THIRTY_EIGHT_TOOL_TARGET_THIRTY_EIGHT_OK",
    phase3055Marker: "PHASE3055_THIRTY_NINE_TOOL_TARGET_THIRTY_NINE_OK",
    phase3100Marker: "PHASE3100_FORTY_TOOL_TARGET_FORTY_OK",
    phase3146Marker: "PHASE3146_FORTY_ONE_TOOL_TARGET_FORTY_ONE_OK",
    phase3193Marker: "PHASE3193_FORTY_TWO_TOOL_TARGET_FORTY_TWO_OK",
    phase3241Marker: "PHASE3241_FORTY_THREE_TOOL_TARGET_FORTY_THREE_OK",
    phase3290Marker: "PHASE3290_FORTY_FOUR_TOOL_TARGET_FORTY_FOUR_OK",
    phase3340Marker: "PHASE3340_FORTY_FIVE_TOOL_TARGET_FORTY_FIVE_OK",
    phase3391Marker: "PHASE3391_FORTY_SIX_TOOL_TARGET_FORTY_SIX_OK",
    phase3443Marker: "PHASE3443_FORTY_SEVEN_TOOL_TARGET_FORTY_SEVEN_OK",
    phase3496Marker: "PHASE3496_FORTY_EIGHT_TOOL_TARGET_FORTY_EIGHT_OK",
    phase3550Marker: "PHASE3550_FORTY_NINE_TOOL_TARGET_FORTY_NINE_OK",
    phase3605Marker: "PHASE3605_FIFTY_TOOL_TARGET_FIFTY_OK",
    phase3661Marker: "PHASE3661_FIFTY_ONE_TOOL_TARGET_FIFTY_ONE_OK",
    phase3718Marker: "PHASE3718_FIFTY_TWO_TOOL_TARGET_FIFTY_TWO_OK",
    phase3776Marker: "PHASE3776_FIFTY_THREE_TOOL_TARGET_FIFTY_THREE_OK",
    phase3835Marker: "PHASE3835_FIFTY_FOUR_TOOL_TARGET_FIFTY_FOUR_OK",
    phase3895Marker: "PHASE3895_FIFTY_FIVE_TOOL_TARGET_FIFTY_FIVE_OK",
    phase3956Marker: "PHASE3956_FIFTY_SIX_TOOL_TARGET_FIFTY_SIX_OK",
    fiftySixRunnerReady: true,
    fiftySixMutationApplied: true,
    providerCallsMade: false,
    codexExecExecuted: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
  };
}

export function main() {
  const args = parseArgs(process.argv.slice(2));
  const planPath = args.plan || "docs/phase3896-3956-controlled-fifty-six-tool-mutation-approval.example.json";
  const generatedAt = new Date().toISOString();
  const plan = readJsonFile(planPath);
  const validation = validatePlan(plan);
  const base = buildBaseResult({ plan, validation, generatedAt, planPath });

  if (!validation.valid) {
    const blocked = {
      ...base,
      status: "blocked",
      blocker: validation.blocker,
      fiftySixMutationApplied: false,
      changedFileCount: 0,
      nodeCheckPassed: false,
      localFiftySixSmokePassed: false,
      rollbackAvailable: false,
      recommendedSealed: false,
    };
    writeJsonFile(resultPath, blocked);
    writeTextFile(resultMdPath, renderMarkdown(blocked));
    printSummary(blocked);
    process.exit(1);
  }

  const operations = plan.operations;
  const originals = new Map();
  const parsedOperations = [];
  const previousRollback = readJsonFile(rollbackPath);
  const previousRollbackFiles = new Map(
    Array.isArray(previousRollback?.files)
      ? previousRollback.files.map((entry) => [entry.targetPath, entry])
      : [],
  );

  for (const operation of operations) {
    const beforeContent = readTextFile(operation.targetPath);
    const beforeSha256 = sha256Text(beforeContent);
    if (beforeSha256 !== operation.expectedBeforeSha256) {
      const alreadyApplied = validateAlreadyAppliedTargetContent({
        currentContent: beforeContent,
        currentSha256: beforeSha256,
        operation,
        extraValidators: buildExtraValidators(operation.targetPath),
      });
      if (alreadyApplied.valid) {
        const previousRollbackFile = previousRollbackFiles.get(operation.targetPath);
        originals.set(operation.targetPath, {
          targetPath: operation.targetPath,
          previousFileSha256: operation.expectedBeforeSha256,
          previousFileByteLength: previousRollbackFile?.previousFileByteLength ?? null,
          idempotentAlreadyApplied: true,
        });
        parsedOperations.push({
          operation,
          parsed: {
            ...alreadyApplied,
            beforeSha256: operation.expectedBeforeSha256,
            afterSha256: beforeSha256,
            afterContent: beforeContent,
            idempotentAlreadyApplied: true,
          },
        });
        continue;
      }
      const failed = {
        ...base,
        status: "failed",
        blocker: `target_sha_mismatch_refuse_apply:${operation.targetPath}:${alreadyApplied.blocker}`,
        fiftySixMutationApplied: false,
        changedFileCount: 0,
        nodeCheckPassed: false,
        localFiftySixSmokePassed: false,
        rollbackAvailable: false,
        recommendedSealed: false,
      };
      writeJsonFile(resultPath, failed);
      writeTextFile(resultMdPath, renderMarkdown(failed));
      printSummary(failed);
      process.exit(1);
    }

    const proposal = readTextFile(operation.proposalPath);
    const parsed = parseSingleExistingFileMutationProposal({
      proposalText: proposal,
      beforeContent,
      targetPath: operation.targetPath,
      requiredMarkers: operation.requiredMarkers || [],
      requiredExports: operation.requiredExports || [],
      maxHunks: 4,
    });
    if (!parsed.valid) {
      const failed = {
        ...base,
        status: "failed",
        blocker: `${parsed.blocker}:${operation.targetPath}`,
        proposalValidation: parsed,
        fiftySixMutationApplied: false,
        changedFileCount: 0,
        nodeCheckPassed: false,
        localFiftySixSmokePassed: false,
        rollbackAvailable: false,
        recommendedSealed: false,
      };
      writeJsonFile(resultPath, failed);
      writeTextFile(resultMdPath, renderMarkdown(failed));
      printSummary(failed);
      process.exit(1);
    }
    originals.set(operation.targetPath, {
      targetPath: operation.targetPath,
      previousFileSha256: beforeSha256,
      previousFileByteLength: Buffer.byteLength(beforeContent, "utf8"),
    });
    parsedOperations.push({ operation, parsed });
  }

  for (const { operation, parsed } of parsedOperations) {
    if (parsed.idempotentAlreadyApplied) continue;
    writeTextFile(operation.targetPath, parsed.afterContent);
  }

  const nodeChecks = runNodeCheckForTargets(operations.map((operation) => operation.targetPath));
  const nodeCheckPassed = nodeChecks.every((entry) => entry.result.status === 0);
  const smokeRuns = runJsonCommandSmokes([
  {
    "id": "phase2091",
    "command": "node",
    "args": [
      "tools/phase2091/generated-source-patch-target.mjs"
    ]
  },
  {
    "id": "phase2092",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2092/apply-controlled-existing-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2094BatchMutationRuntimeStatus())))"
    ]
  },
  {
    "id": "phase2093",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2100TripleMutationRuntimeStatus())))"
    ]
  },
  {
    "id": "phase2096",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2109QuadMutationRuntimeStatus())))"
    ]
  },
  {
    "id": "phase2101",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase2120QuintMutationRuntimeStatus())))"
    ]
  },
  {
    "id": "phase2111",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3906FiftySixMutationTargetSixStatus())))"
    ]
  },
  {
    "id": "phase2121",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3907FiftySixMutationTargetSevenStatus())))"
    ]
  },
  {
    "id": "phase2132",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3908FiftySixMutationTargetEightStatus())))"
    ]
  },
  {
    "id": "phase2144",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3909FiftySixMutationTargetNineStatus())))"
    ]
  },
  {
    "id": "phase2157",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3910FiftySixMutationTargetTenStatus())))"
    ]
  },
  {
    "id": "phase2171",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3911FiftySixMutationTargetElevenStatus())))"
    ]
  },
  {
    "id": "phase2186",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3912FiftySixMutationTargetTwelveStatus())))"
    ]
  },
  {
    "id": "phase2202",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3913FiftySixMutationTargetThirteenStatus())))"
    ]
  },
  {
    "id": "phase2219",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3914FiftySixMutationTargetFourteenStatus())))"
    ]
  },
  {
    "id": "phase2237",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3915FiftySixMutationTargetFifteenStatus())))"
    ]
  },
  {
    "id": "phase2256",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3916FiftySixMutationTargetSixteenStatus())))"
    ]
  },
  {
    "id": "phase2276",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3917FiftySixMutationTargetSeventeenStatus())))"
    ]
  },
  {
    "id": "phase2297",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3918FiftySixMutationTargetEighteenStatus())))"
    ]
  },
  {
    "id": "phase2319",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3919FiftySixMutationTargetNineteenStatus())))"
    ]
  },
  {
    "id": "phase2342",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3920FiftySixMutationTargetTwentyStatus())))"
    ]
  },
  {
    "id": "phase2366",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3921FiftySixMutationTargetTwentyOneStatus())))"
    ]
  },
  {
    "id": "phase2391",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3922FiftySixMutationTargetTwentyTwoStatus())))"
    ]
  },
  {
    "id": "phase2417",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3923FiftySixMutationTargetTwentyThreeStatus())))"
    ]
  },
  {
    "id": "phase2444",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3924FiftySixMutationTargetTwentyFourStatus())))"
    ]
  },
  {
    "id": "phase2472",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3925FiftySixMutationTargetTwentyFiveStatus())))"
    ]
  },
  {
    "id": "phase2501",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3926FiftySixMutationTargetTwentySixStatus())))"
    ]
  },
  {
    "id": "phase2531",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3927FiftySixMutationTargetTwentySevenStatus())))"
    ]
  },
  {
    "id": "phase2562",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3928FiftySixMutationTargetTwentyEightStatus())))"
    ]
  },
  {
    "id": "phase2594",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3929FiftySixMutationTargetTwentyNineStatus())))"
    ]
  },
  {
    "id": "phase2627",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3930FiftySixMutationTargetThirtyStatus())))"
    ]
  },
  {
    "id": "phase2661",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3931FiftySixMutationTargetThirtyOneStatus())))"
    ]
  },
  {
    "id": "phase2696",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3932FiftySixMutationTargetThirtyTwoStatus())))"
    ]
  },
  {
    "id": "phase2732",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3933FiftySixMutationTargetThirtyThreeStatus())))"
    ]
  },
  {
    "id": "phase2769",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3934FiftySixMutationTargetThirtyFourStatus())))"
    ]
  },
  {
    "id": "phase2807",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2807_2845/apply-controlled-thirty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3935FiftySixMutationTargetThirtyFiveStatus())))"
    ]
  },
  {
    "id": "phase2846",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2846_2885/apply-controlled-thirty-five-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3936FiftySixMutationTargetThirtySixStatus())))"
    ]
  },
  {
    "id": "phase2886",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2886_2926/apply-controlled-thirty-six-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3937FiftySixMutationTargetThirtySevenStatus())))"
    ]
  },
  {
    "id": "phase2927",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2927_2968/apply-controlled-thirty-seven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3938FiftySixMutationTargetThirtyEightStatus())))"
    ]
  },
  {
    "id": "phase2969",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase2969_3011/apply-controlled-thirty-eight-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3939FiftySixMutationTargetThirtyNineStatus())))"
    ]
  },
  {
    "id": "phase3012",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase3012_3055/apply-controlled-thirty-nine-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3940FiftySixMutationTargetFortyStatus())))"
    ]
  },
  {
    "id": "phase3056",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase3056_3100/apply-controlled-forty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3941FiftySixMutationTargetFortyOneStatus())))"
    ]
  },
  {
    "id": "phase3101",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase3101_3146/apply-controlled-forty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3942FiftySixMutationTargetFortyTwoStatus())))"
    ]
  },
  {
    "id": "phase3147",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase3147_3193/apply-controlled-forty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3943FiftySixMutationTargetFortyThreeStatus())))"
    ]
  },
  {
    "id": "phase3194",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase3194_3241/apply-controlled-forty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3944FiftySixMutationTargetFortyFourStatus())))"
    ]
  },
  {
    "id": "phase3242",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase3242_3290/apply-controlled-forty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3945FiftySixMutationTargetFortyFiveStatus())))"
    ]
  },
  {
    "id": "phase3291",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase3291_3340/apply-controlled-forty-five-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3946FiftySixMutationTargetFortySixStatus())))"
    ]
  },
  {
    "id": "phase3341",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase3341_3391/apply-controlled-forty-six-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3947FiftySixMutationTargetFortySevenStatus())))"
    ]
  },
  {
    "id": "phase3392",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase3392_3443/apply-controlled-forty-seven-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3948FiftySixMutationTargetFortyEightStatus())))"
    ]
  },
  {
    "id": "phase3444",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase3444_3496/apply-controlled-forty-eight-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3949FiftySixMutationTargetFortyNineStatus())))"
    ]
  },
  {
    "id": "phase3497",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase3497_3550/apply-controlled-forty-nine-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3950FiftySixMutationTargetFiftyStatus())))"
    ]
  },
  {
    "id": "phase3551",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase3551_3605/apply-controlled-fifty-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3951FiftySixMutationTargetFiftyOneStatus())))"
    ]
  },
  {
    "id": "phase3606",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase3606_3661/apply-controlled-fifty-one-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3952FiftySixMutationTargetFiftyTwoStatus())))"
    ]
  },
  {
    "id": "phase3662",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase3662_3718/apply-controlled-fifty-two-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3953FiftySixMutationTargetFiftyThreeStatus())))"
    ]
  },
  {
    "id": "phase3719",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase3719_3776/apply-controlled-fifty-three-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3954FiftySixMutationTargetFiftyFourStatus())))"
    ]
  },
  {
    "id": "phase3777",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase3777_3835/apply-controlled-fifty-four-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3955FiftySixMutationTargetFiftyFiveStatus())))"
    ]
  },
  {
    "id": "phase3836",
    "command": "node",
    "args": [
      "-e",
      "import('./tools/phase3836_3895/apply-controlled-fifty-five-tool-mutation.mjs').then(m=>console.log(JSON.stringify(m.buildPhase3956FiftySixMutationRuntimeStatus())))"
    ]
  }
]);
  const smokePhase2091 = smokeRuns[0];
  const smokePhase2092 = smokeRuns[1];
  const smokePhase2093 = smokeRuns[2];
  const smokePhase2096 = smokeRuns[3];
  const smokePhase2101 = smokeRuns[4];
  const smokePhase2111 = smokeRuns[5];
  const smokePhase2121 = smokeRuns[6];
  const smokePhase2132 = smokeRuns[7];
  const smokePhase2144 = smokeRuns[8];
  const smokePhase2157 = smokeRuns[9];
  const smokePhase2171 = smokeRuns[10];
  const smokePhase2186 = smokeRuns[11];
  const smokePhase2202 = smokeRuns[12];
  const smokePhase2219 = smokeRuns[13];
  const smokePhase2237 = smokeRuns[14];
  const smokePhase2256 = smokeRuns[15];
  const smokePhase2276 = smokeRuns[16];
  const smokePhase2297 = smokeRuns[17];
  const smokePhase2319 = smokeRuns[18];
  const smokePhase2342 = smokeRuns[19];
  const smokePhase2366 = smokeRuns[20];
  const smokePhase2391 = smokeRuns[21];
  const smokePhase2417 = smokeRuns[22];
  const smokePhase2444 = smokeRuns[23];
  const smokePhase2472 = smokeRuns[24];
  const smokePhase2501 = smokeRuns[25];
  const smokePhase2531 = smokeRuns[26];
  const smokePhase2562 = smokeRuns[27];
  const smokePhase2594 = smokeRuns[28];
  const smokePhase2627 = smokeRuns[29];
  const smokePhase2661 = smokeRuns[30];
  const smokePhase2696 = smokeRuns[31];
  const smokePhase2732 = smokeRuns[32];
  const smokePhase2769 = smokeRuns[33];
  const smokePhase2807 = smokeRuns[34];
  const smokePhase2846 = smokeRuns[35];
  const smokePhase2886 = smokeRuns[36];
  const smokePhase2927 = smokeRuns[37];
  const smokePhase2969 = smokeRuns[38];
  const smokePhase3012 = smokeRuns[39];
  const smokePhase3056 = smokeRuns[40];
  const smokePhase3101 = smokeRuns[41];
  const smokePhase3147 = smokeRuns[42];
  const smokePhase3194 = smokeRuns[43];
  const smokePhase3242 = smokeRuns[44];
  const smokePhase3291 = smokeRuns[45];
  const smokePhase3341 = smokeRuns[46];
  const smokePhase3392 = smokeRuns[47];
  const smokePhase3444 = smokeRuns[48];
  const smokePhase3497 = smokeRuns[49];
  const smokePhase3551 = smokeRuns[50];
  const smokePhase3606 = smokeRuns[51];
  const smokePhase3662 = smokeRuns[52];
  const smokePhase3719 = smokeRuns[53];
  const smokePhase3777 = smokeRuns[54];
  const smokePhase3836 = smokeRuns[55];

  const smokeResult = {
    phaseId,
    generatedAt: new Date().toISOString(),
    status:
      smokePhase2091.result.status === 0 &&
      smokePhase2092.result.status === 0 &&
      smokePhase2093.result.status === 0 &&
      smokePhase2096.result.status === 0 &&
      smokePhase2101.result.status === 0 &&
      smokePhase2111.result.status === 0 &&
      smokePhase2121.result.status === 0 &&
      smokePhase2132.result.status === 0 &&
      smokePhase2144.result.status === 0 &&
      smokePhase2157.result.status === 0 &&
      smokePhase2171.result.status === 0 &&
      smokePhase2186.result.status === 0 &&
      smokePhase2202.result.status === 0 &&
      smokePhase2219.result.status === 0 &&
      smokePhase2237.result.status === 0 &&
      smokePhase2256.result.status === 0 &&
      smokePhase2276.result.status === 0 &&
      smokePhase2297.result.status === 0 &&
      smokePhase2319.result.status === 0 &&
      smokePhase2342.result.status === 0 &&
      smokePhase2366.result.status === 0 &&
      smokePhase2391.result.status === 0 &&
      smokePhase2417.result.status === 0 &&
      smokePhase2444.result.status === 0 &&
      smokePhase2472.result.status === 0 &&
      smokePhase2501.result.status === 0 &&
      smokePhase2531.result.status === 0 &&
      smokePhase2562.result.status === 0 &&
      smokePhase2594.result.status === 0 &&
      smokePhase2627.result.status === 0 &&
      smokePhase2661.result.status === 0 &&
      smokePhase2696.result.status === 0 &&
      smokePhase2732.result.status === 0 &&
      smokePhase2769.result.status === 0 &&
      smokePhase2807.result.status === 0 &&
      smokePhase2846.result.status === 0 &&
      smokePhase2886.result.status === 0 &&
      smokePhase2927.result.status === 0 &&
      smokePhase2969.result.status === 0 &&
      smokePhase3012.result.status === 0 &&
      smokePhase3056.result.status === 0 &&
      smokePhase3101.result.status === 0 &&
      smokePhase3147.result.status === 0 &&
      smokePhase3194.result.status === 0 &&
      smokePhase3242.result.status === 0 &&
      smokePhase3291.result.status === 0 &&
      smokePhase3341.result.status === 0 &&
      smokePhase3392.result.status === 0 &&
      smokePhase3444.result.status === 0 &&
      smokePhase3497.result.status === 0 &&
      smokePhase3551.result.status === 0 &&
      smokePhase3606.result.status === 0 &&
      smokePhase3662.result.status === 0 &&
      smokePhase3719.result.status === 0 &&
      smokePhase3777.result.status === 0 &&
      smokePhase3836.result.status === 0 &&
      smokePhase2091.parsed?.marker === "PHASE2091_SOURCE_PATCH_OK" &&
      smokePhase2091.parsed?.phase2092?.marker === "PHASE2092_EXISTING_TOOL_MUTATION_OK" &&
      smokePhase2091.parsed?.phase2093?.marker === "PHASE2093_BATCH_TOOL_TARGET_ONE_OK" &&
      smokePhase2091.parsed?.phase2096?.marker === "PHASE2096_TRIPLE_TOOL_TARGET_ONE_OK" &&
      smokePhase2091.parsed?.phase2106?.marker === "PHASE2106_QUAD_TOOL_TARGET_ONE_OK" &&
      smokePhase2091.parsed?.phase2116?.marker === "PHASE2116_QUINT_TOOL_TARGET_ONE_OK" &&
      smokePhase2091.parsed?.phase2126?.marker === "PHASE2126_SEXT_TOOL_TARGET_ONE_OK" &&
      smokePhase2091.parsed?.phase2137?.marker === "PHASE2137_SEPT_TOOL_TARGET_ONE_OK" &&
      smokePhase2091.parsed?.phase2149?.marker === "PHASE2149_OCT_TOOL_TARGET_ONE_OK" &&
      smokePhase2091.parsed?.phase2162?.marker === "PHASE2162_NONET_TOOL_TARGET_ONE_OK" &&
      smokePhase2091.parsed?.phase2176?.marker === "PHASE2176_DECA_TOOL_TARGET_ONE_OK" &&
      smokePhase2091.parsed?.phase2191?.marker === "PHASE2191_ELEVEN_TOOL_TARGET_ONE_OK" &&
      smokePhase2091.parsed?.phase2207?.marker === "PHASE2207_TWELVE_TOOL_TARGET_ONE_OK" &&
      smokePhase2091.parsed?.phase2224?.marker === "PHASE2224_THIRTEEN_TOOL_TARGET_ONE_OK" &&
      smokePhase2091.parsed?.phase2242?.marker === "PHASE2242_FOURTEEN_TOOL_TARGET_ONE_OK" &&
      smokePhase2091.parsed?.phase2261?.marker === "PHASE2261_FIFTEEN_TOOL_TARGET_ONE_OK" &&
      smokePhase2091.parsed?.phase2281?.marker === "PHASE2281_SIXTEEN_TOOL_TARGET_ONE_OK" &&
      smokePhase2091.parsed?.phase3901?.marker === "PHASE3901_FIFTY_SIX_TOOL_TARGET_ONE_OK" &&
      smokePhase2092.parsed?.marker === "PHASE2094_BATCH_TOOL_TARGET_TWO_OK" &&
      smokePhase2092.parsed?.phase2127Marker === "PHASE2127_SEXT_TOOL_TARGET_TWO_OK" &&
      smokePhase2092.parsed?.phase2138Marker === "PHASE2138_SEPT_TOOL_TARGET_TWO_OK" &&
      smokePhase2092.parsed?.phase2150Marker === "PHASE2150_OCT_TOOL_TARGET_TWO_OK" &&
      smokePhase2092.parsed?.phase2163Marker === "PHASE2163_NONET_TOOL_TARGET_TWO_OK" &&
      smokePhase2092.parsed?.phase2177Marker === "PHASE2177_DECA_TOOL_TARGET_TWO_OK" &&
      smokePhase2092.parsed?.phase2192Marker === "PHASE2192_ELEVEN_TOOL_TARGET_TWO_OK" &&
      smokePhase2092.parsed?.phase2208Marker === "PHASE2208_TWELVE_TOOL_TARGET_TWO_OK" &&
      smokePhase2092.parsed?.phase2225Marker === "PHASE2225_THIRTEEN_TOOL_TARGET_TWO_OK" &&
      smokePhase2092.parsed?.phase2243Marker === "PHASE2243_FOURTEEN_TOOL_TARGET_TWO_OK" &&
      smokePhase2092.parsed?.phase2262Marker === "PHASE2262_FIFTEEN_TOOL_TARGET_TWO_OK" &&
      smokePhase2092.parsed?.phase2282Marker === "PHASE2282_SIXTEEN_TOOL_TARGET_TWO_OK" &&
      smokePhase2092.parsed?.phase3902Marker === "PHASE3902_FIFTY_SIX_TOOL_TARGET_TWO_OK" &&
      smokePhase2093.parsed?.marker === "PHASE2100_TRIPLE_TOOL_TARGET_THREE_OK" &&
      smokePhase2093.parsed?.phase2128Marker === "PHASE2128_SEXT_TOOL_TARGET_THREE_OK" &&
      smokePhase2093.parsed?.phase2139Marker === "PHASE2139_SEPT_TOOL_TARGET_THREE_OK" &&
      smokePhase2093.parsed?.phase2151Marker === "PHASE2151_OCT_TOOL_TARGET_THREE_OK" &&
      smokePhase2093.parsed?.phase2164Marker === "PHASE2164_NONET_TOOL_TARGET_THREE_OK" &&
      smokePhase2093.parsed?.phase2178Marker === "PHASE2178_DECA_TOOL_TARGET_THREE_OK" &&
      smokePhase2093.parsed?.phase2193Marker === "PHASE2193_ELEVEN_TOOL_TARGET_THREE_OK" &&
      smokePhase2093.parsed?.phase2209Marker === "PHASE2209_TWELVE_TOOL_TARGET_THREE_OK" &&
      smokePhase2093.parsed?.phase2226Marker === "PHASE2226_THIRTEEN_TOOL_TARGET_THREE_OK" &&
      smokePhase2093.parsed?.phase2244Marker === "PHASE2244_FOURTEEN_TOOL_TARGET_THREE_OK" &&
      smokePhase2093.parsed?.phase2263Marker === "PHASE2263_FIFTEEN_TOOL_TARGET_THREE_OK" &&
      smokePhase2093.parsed?.phase2283Marker === "PHASE2283_SIXTEEN_TOOL_TARGET_THREE_OK" &&
      smokePhase2093.parsed?.phase3903Marker === "PHASE3903_FIFTY_SIX_TOOL_TARGET_THREE_OK" &&
      smokePhase2096.parsed?.marker === "PHASE2109_QUAD_TOOL_TARGET_FOUR_OK" &&
      smokePhase2096.parsed?.phase2129Marker === "PHASE2129_SEXT_TOOL_TARGET_FOUR_OK" &&
      smokePhase2096.parsed?.phase2140Marker === "PHASE2140_SEPT_TOOL_TARGET_FOUR_OK" &&
      smokePhase2096.parsed?.phase2152Marker === "PHASE2152_OCT_TOOL_TARGET_FOUR_OK" &&
      smokePhase2096.parsed?.phase2165Marker === "PHASE2165_NONET_TOOL_TARGET_FOUR_OK" &&
      smokePhase2096.parsed?.phase2179Marker === "PHASE2179_DECA_TOOL_TARGET_FOUR_OK" &&
      smokePhase2096.parsed?.phase2194Marker === "PHASE2194_ELEVEN_TOOL_TARGET_FOUR_OK" &&
      smokePhase2096.parsed?.phase2210Marker === "PHASE2210_TWELVE_TOOL_TARGET_FOUR_OK" &&
      smokePhase2096.parsed?.phase2227Marker === "PHASE2227_THIRTEEN_TOOL_TARGET_FOUR_OK" &&
      smokePhase2096.parsed?.phase2245Marker === "PHASE2245_FOURTEEN_TOOL_TARGET_FOUR_OK" &&
      smokePhase2096.parsed?.phase2264Marker === "PHASE2264_FIFTEEN_TOOL_TARGET_FOUR_OK" &&
      smokePhase2096.parsed?.phase2284Marker === "PHASE2284_SIXTEEN_TOOL_TARGET_FOUR_OK" &&
      smokePhase2096.parsed?.phase3904Marker === "PHASE3904_FIFTY_SIX_TOOL_TARGET_FOUR_OK" &&
      smokePhase2101.parsed?.marker === "PHASE2120_QUINT_TOOL_TARGET_FIVE_OK" &&
      smokePhase2101.parsed?.phase2130Marker === "PHASE2130_SEXT_TOOL_TARGET_FIVE_OK" &&
      smokePhase2101.parsed?.phase2141Marker === "PHASE2141_SEPT_TOOL_TARGET_FIVE_OK" &&
      smokePhase2101.parsed?.phase2153Marker === "PHASE2153_OCT_TOOL_TARGET_FIVE_OK" &&
      smokePhase2101.parsed?.phase2166Marker === "PHASE2166_NONET_TOOL_TARGET_FIVE_OK" &&
      smokePhase2101.parsed?.phase2180Marker === "PHASE2180_DECA_TOOL_TARGET_FIVE_OK" &&
      smokePhase2101.parsed?.phase2195Marker === "PHASE2195_ELEVEN_TOOL_TARGET_FIVE_OK" &&
      smokePhase2101.parsed?.phase2211Marker === "PHASE2211_TWELVE_TOOL_TARGET_FIVE_OK" &&
      smokePhase2101.parsed?.phase2228Marker === "PHASE2228_THIRTEEN_TOOL_TARGET_FIVE_OK" &&
      smokePhase2101.parsed?.phase2246Marker === "PHASE2246_FOURTEEN_TOOL_TARGET_FIVE_OK" &&
      smokePhase2101.parsed?.phase2265Marker === "PHASE2265_FIFTEEN_TOOL_TARGET_FIVE_OK" &&
      smokePhase2101.parsed?.phase2285Marker === "PHASE2285_SIXTEEN_TOOL_TARGET_FIVE_OK" &&
      smokePhase2101.parsed?.phase3905Marker === "PHASE3905_FIFTY_SIX_TOOL_TARGET_FIVE_OK" &&
      smokePhase2111.parsed?.marker === "PHASE3906_FIFTY_SIX_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase2142Marker === "PHASE2142_SEPT_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase2154Marker === "PHASE2154_OCT_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase2167Marker === "PHASE2167_NONET_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase2181Marker === "PHASE2181_DECA_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase2196Marker === "PHASE2196_ELEVEN_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase2212Marker === "PHASE2212_TWELVE_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase2229Marker === "PHASE2229_THIRTEEN_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase2247Marker === "PHASE2247_FOURTEEN_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase2266Marker === "PHASE2266_FIFTEEN_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase2286Marker === "PHASE2286_SIXTEEN_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase2307Marker === "PHASE2307_SEVENTEEN_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase2329Marker === "PHASE2329_EIGHTEEN_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase2352Marker === "PHASE2352_NINETEEN_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase2376Marker === "PHASE2376_TWENTY_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase2401Marker === "PHASE2401_TWENTY_ONE_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase2427Marker === "PHASE2427_TWENTY_TWO_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase2454Marker === "PHASE2454_TWENTY_THREE_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase2482Marker === "PHASE2482_TWENTY_FOUR_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase2511Marker === "PHASE2511_TWENTY_FIVE_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase2541Marker === "PHASE2541_TWENTY_SIX_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase2572Marker === "PHASE2572_TWENTY_SEVEN_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase2604Marker === "PHASE2604_TWENTY_EIGHT_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase2637Marker === "PHASE2637_TWENTY_NINE_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase2671Marker === "PHASE2671_THIRTY_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase2706Marker === "PHASE2706_THIRTY_ONE_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase2742Marker === "PHASE2742_THIRTY_TWO_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase2779Marker === "PHASE2779_THIRTY_THREE_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase2817Marker === "PHASE2817_THIRTY_FOUR_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase2856Marker === "PHASE2856_THIRTY_FIVE_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase2896Marker === "PHASE2896_THIRTY_SIX_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase2937Marker === "PHASE2937_THIRTY_SEVEN_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase2979Marker === "PHASE2979_THIRTY_EIGHT_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase3022Marker === "PHASE3022_THIRTY_NINE_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase3066Marker === "PHASE3066_FORTY_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase3111Marker === "PHASE3111_FORTY_ONE_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase3157Marker === "PHASE3157_FORTY_TWO_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase3204Marker === "PHASE3204_FORTY_THREE_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase3252Marker === "PHASE3252_FORTY_FOUR_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase3301Marker === "PHASE3301_FORTY_FIVE_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase3351Marker === "PHASE3351_FORTY_SIX_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase3402Marker === "PHASE3402_FORTY_SEVEN_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase3454Marker === "PHASE3454_FORTY_EIGHT_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase3507Marker === "PHASE3507_FORTY_NINE_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase3561Marker === "PHASE3561_FIFTY_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase3616Marker === "PHASE3616_FIFTY_ONE_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase3672Marker === "PHASE3672_FIFTY_TWO_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase3729Marker === "PHASE3729_FIFTY_THREE_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase3787Marker === "PHASE3787_FIFTY_FOUR_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase3846Marker === "PHASE3846_FIFTY_FIVE_TOOL_TARGET_SIX_OK" &&
      smokePhase2111.parsed?.phase3906Marker === "PHASE3906_FIFTY_SIX_TOOL_TARGET_SIX_OK" &&
      smokePhase2121.parsed?.marker === "PHASE3907_FIFTY_SIX_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase2143Marker === "PHASE2143_SEPT_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase2155Marker === "PHASE2155_OCT_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase2168Marker === "PHASE2168_NONET_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase2182Marker === "PHASE2182_DECA_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase2197Marker === "PHASE2197_ELEVEN_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase2213Marker === "PHASE2213_TWELVE_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase2230Marker === "PHASE2230_THIRTEEN_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase2248Marker === "PHASE2248_FOURTEEN_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase2267Marker === "PHASE2267_FIFTEEN_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase2287Marker === "PHASE2287_SIXTEEN_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase2308Marker === "PHASE2308_SEVENTEEN_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase2330Marker === "PHASE2330_EIGHTEEN_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase2353Marker === "PHASE2353_NINETEEN_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase2377Marker === "PHASE2377_TWENTY_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase2402Marker === "PHASE2402_TWENTY_ONE_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase2428Marker === "PHASE2428_TWENTY_TWO_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase2455Marker === "PHASE2455_TWENTY_THREE_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase2483Marker === "PHASE2483_TWENTY_FOUR_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase2512Marker === "PHASE2512_TWENTY_FIVE_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase2542Marker === "PHASE2542_TWENTY_SIX_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase2573Marker === "PHASE2573_TWENTY_SEVEN_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase2605Marker === "PHASE2605_TWENTY_EIGHT_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase2638Marker === "PHASE2638_TWENTY_NINE_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase2672Marker === "PHASE2672_THIRTY_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase2707Marker === "PHASE2707_THIRTY_ONE_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase2743Marker === "PHASE2743_THIRTY_TWO_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase2780Marker === "PHASE2780_THIRTY_THREE_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase2818Marker === "PHASE2818_THIRTY_FOUR_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase2857Marker === "PHASE2857_THIRTY_FIVE_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase2897Marker === "PHASE2897_THIRTY_SIX_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase2938Marker === "PHASE2938_THIRTY_SEVEN_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase2980Marker === "PHASE2980_THIRTY_EIGHT_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase3023Marker === "PHASE3023_THIRTY_NINE_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase3067Marker === "PHASE3067_FORTY_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase3112Marker === "PHASE3112_FORTY_ONE_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase3158Marker === "PHASE3158_FORTY_TWO_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase3205Marker === "PHASE3205_FORTY_THREE_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase3253Marker === "PHASE3253_FORTY_FOUR_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase3302Marker === "PHASE3302_FORTY_FIVE_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase3352Marker === "PHASE3352_FORTY_SIX_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase3403Marker === "PHASE3403_FORTY_SEVEN_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase3455Marker === "PHASE3455_FORTY_EIGHT_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase3508Marker === "PHASE3508_FORTY_NINE_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase3562Marker === "PHASE3562_FIFTY_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase3617Marker === "PHASE3617_FIFTY_ONE_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase3673Marker === "PHASE3673_FIFTY_TWO_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase3730Marker === "PHASE3730_FIFTY_THREE_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase3788Marker === "PHASE3788_FIFTY_FOUR_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase3847Marker === "PHASE3847_FIFTY_FIVE_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2121.parsed?.phase3907Marker === "PHASE3907_FIFTY_SIX_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2132.parsed?.marker === "PHASE3908_FIFTY_SIX_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase2143Marker === "PHASE2143_SEPT_TOOL_TARGET_SEVEN_OK" &&
      smokePhase2132.parsed?.phase2156Marker === "PHASE2156_OCT_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase2169Marker === "PHASE2169_NONET_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase2183Marker === "PHASE2183_DECA_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase2198Marker === "PHASE2198_ELEVEN_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase2214Marker === "PHASE2214_TWELVE_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase2231Marker === "PHASE2231_THIRTEEN_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase2249Marker === "PHASE2249_FOURTEEN_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase2268Marker === "PHASE2268_FIFTEEN_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase2288Marker === "PHASE2288_SIXTEEN_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase2309Marker === "PHASE2309_SEVENTEEN_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase2331Marker === "PHASE2331_EIGHTEEN_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase2354Marker === "PHASE2354_NINETEEN_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase2378Marker === "PHASE2378_TWENTY_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase2403Marker === "PHASE2403_TWENTY_ONE_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase2429Marker === "PHASE2429_TWENTY_TWO_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase2456Marker === "PHASE2456_TWENTY_THREE_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase2484Marker === "PHASE2484_TWENTY_FOUR_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase2513Marker === "PHASE2513_TWENTY_FIVE_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase2543Marker === "PHASE2543_TWENTY_SIX_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase2574Marker === "PHASE2574_TWENTY_SEVEN_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase2606Marker === "PHASE2606_TWENTY_EIGHT_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase2639Marker === "PHASE2639_TWENTY_NINE_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase2673Marker === "PHASE2673_THIRTY_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase2708Marker === "PHASE2708_THIRTY_ONE_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase2744Marker === "PHASE2744_THIRTY_TWO_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase2781Marker === "PHASE2781_THIRTY_THREE_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase2819Marker === "PHASE2819_THIRTY_FOUR_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase2858Marker === "PHASE2858_THIRTY_FIVE_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase2898Marker === "PHASE2898_THIRTY_SIX_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase2939Marker === "PHASE2939_THIRTY_SEVEN_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase2981Marker === "PHASE2981_THIRTY_EIGHT_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase3024Marker === "PHASE3024_THIRTY_NINE_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase3068Marker === "PHASE3068_FORTY_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase3113Marker === "PHASE3113_FORTY_ONE_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase3159Marker === "PHASE3159_FORTY_TWO_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase3206Marker === "PHASE3206_FORTY_THREE_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase3254Marker === "PHASE3254_FORTY_FOUR_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase3303Marker === "PHASE3303_FORTY_FIVE_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase3353Marker === "PHASE3353_FORTY_SIX_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase3404Marker === "PHASE3404_FORTY_SEVEN_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase3456Marker === "PHASE3456_FORTY_EIGHT_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase3509Marker === "PHASE3509_FORTY_NINE_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase3563Marker === "PHASE3563_FIFTY_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase3618Marker === "PHASE3618_FIFTY_ONE_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase3674Marker === "PHASE3674_FIFTY_TWO_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase3731Marker === "PHASE3731_FIFTY_THREE_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase3789Marker === "PHASE3789_FIFTY_FOUR_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase3848Marker === "PHASE3848_FIFTY_FIVE_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2132.parsed?.phase3908Marker === "PHASE3908_FIFTY_SIX_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2144.parsed?.marker === "PHASE3909_FIFTY_SIX_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase2156Marker === "PHASE2156_OCT_TOOL_TARGET_EIGHT_OK" &&
      smokePhase2144.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase2184Marker === "PHASE2184_DECA_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase2199Marker === "PHASE2199_ELEVEN_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase2215Marker === "PHASE2215_TWELVE_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase2232Marker === "PHASE2232_THIRTEEN_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase2250Marker === "PHASE2250_FOURTEEN_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase2269Marker === "PHASE2269_FIFTEEN_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase2289Marker === "PHASE2289_SIXTEEN_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase2310Marker === "PHASE2310_SEVENTEEN_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase2332Marker === "PHASE2332_EIGHTEEN_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase2355Marker === "PHASE2355_NINETEEN_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase2379Marker === "PHASE2379_TWENTY_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase2404Marker === "PHASE2404_TWENTY_ONE_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase2430Marker === "PHASE2430_TWENTY_TWO_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase2457Marker === "PHASE2457_TWENTY_THREE_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase2485Marker === "PHASE2485_TWENTY_FOUR_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase2514Marker === "PHASE2514_TWENTY_FIVE_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase2544Marker === "PHASE2544_TWENTY_SIX_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase2575Marker === "PHASE2575_TWENTY_SEVEN_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase2607Marker === "PHASE2607_TWENTY_EIGHT_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase2640Marker === "PHASE2640_TWENTY_NINE_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase2674Marker === "PHASE2674_THIRTY_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase2709Marker === "PHASE2709_THIRTY_ONE_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase2745Marker === "PHASE2745_THIRTY_TWO_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase2782Marker === "PHASE2782_THIRTY_THREE_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase2820Marker === "PHASE2820_THIRTY_FOUR_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase2859Marker === "PHASE2859_THIRTY_FIVE_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase2899Marker === "PHASE2899_THIRTY_SIX_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase2940Marker === "PHASE2940_THIRTY_SEVEN_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase2982Marker === "PHASE2982_THIRTY_EIGHT_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase3025Marker === "PHASE3025_THIRTY_NINE_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase3069Marker === "PHASE3069_FORTY_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase3114Marker === "PHASE3114_FORTY_ONE_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase3160Marker === "PHASE3160_FORTY_TWO_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase3207Marker === "PHASE3207_FORTY_THREE_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase3255Marker === "PHASE3255_FORTY_FOUR_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase3304Marker === "PHASE3304_FORTY_FIVE_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase3354Marker === "PHASE3354_FORTY_SIX_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase3405Marker === "PHASE3405_FORTY_SEVEN_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase3457Marker === "PHASE3457_FORTY_EIGHT_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase3510Marker === "PHASE3510_FORTY_NINE_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase3564Marker === "PHASE3564_FIFTY_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase3619Marker === "PHASE3619_FIFTY_ONE_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase3675Marker === "PHASE3675_FIFTY_TWO_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase3732Marker === "PHASE3732_FIFTY_THREE_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase3790Marker === "PHASE3790_FIFTY_FOUR_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase3849Marker === "PHASE3849_FIFTY_FIVE_TOOL_TARGET_NINE_OK" &&
      smokePhase2144.parsed?.phase3909Marker === "PHASE3909_FIFTY_SIX_TOOL_TARGET_NINE_OK" &&
      smokePhase2157.parsed?.marker === "PHASE3910_FIFTY_SIX_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase2157.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase2200Marker === "PHASE2200_ELEVEN_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase2216Marker === "PHASE2216_TWELVE_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase2233Marker === "PHASE2233_THIRTEEN_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase2251Marker === "PHASE2251_FOURTEEN_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase2270Marker === "PHASE2270_FIFTEEN_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase2290Marker === "PHASE2290_SIXTEEN_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase2311Marker === "PHASE2311_SEVENTEEN_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase2333Marker === "PHASE2333_EIGHTEEN_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase2356Marker === "PHASE2356_NINETEEN_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase2380Marker === "PHASE2380_TWENTY_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase2405Marker === "PHASE2405_TWENTY_ONE_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase2431Marker === "PHASE2431_TWENTY_TWO_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase2458Marker === "PHASE2458_TWENTY_THREE_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase2486Marker === "PHASE2486_TWENTY_FOUR_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase2515Marker === "PHASE2515_TWENTY_FIVE_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase2545Marker === "PHASE2545_TWENTY_SIX_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase2576Marker === "PHASE2576_TWENTY_SEVEN_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase2608Marker === "PHASE2608_TWENTY_EIGHT_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase2641Marker === "PHASE2641_TWENTY_NINE_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase2675Marker === "PHASE2675_THIRTY_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase2710Marker === "PHASE2710_THIRTY_ONE_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase2746Marker === "PHASE2746_THIRTY_TWO_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase2783Marker === "PHASE2783_THIRTY_THREE_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase2821Marker === "PHASE2821_THIRTY_FOUR_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase2860Marker === "PHASE2860_THIRTY_FIVE_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase2900Marker === "PHASE2900_THIRTY_SIX_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase2941Marker === "PHASE2941_THIRTY_SEVEN_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase2983Marker === "PHASE2983_THIRTY_EIGHT_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase3026Marker === "PHASE3026_THIRTY_NINE_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase3070Marker === "PHASE3070_FORTY_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase3115Marker === "PHASE3115_FORTY_ONE_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase3161Marker === "PHASE3161_FORTY_TWO_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase3208Marker === "PHASE3208_FORTY_THREE_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase3256Marker === "PHASE3256_FORTY_FOUR_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase3305Marker === "PHASE3305_FORTY_FIVE_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase3355Marker === "PHASE3355_FORTY_SIX_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase3406Marker === "PHASE3406_FORTY_SEVEN_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase3458Marker === "PHASE3458_FORTY_EIGHT_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase3511Marker === "PHASE3511_FORTY_NINE_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase3565Marker === "PHASE3565_FIFTY_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase3620Marker === "PHASE3620_FIFTY_ONE_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase3676Marker === "PHASE3676_FIFTY_TWO_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase3733Marker === "PHASE3733_FIFTY_THREE_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase3791Marker === "PHASE3791_FIFTY_FOUR_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase3850Marker === "PHASE3850_FIFTY_FIVE_TOOL_TARGET_TEN_OK" &&
      smokePhase2157.parsed?.phase3910Marker === "PHASE3910_FIFTY_SIX_TOOL_TARGET_TEN_OK" &&
      smokePhase2171.parsed?.marker === "PHASE3911_FIFTY_SIX_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase2171.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase2171.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase2217Marker === "PHASE2217_TWELVE_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase2234Marker === "PHASE2234_THIRTEEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase2252Marker === "PHASE2252_FOURTEEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase2271Marker === "PHASE2271_FIFTEEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase2291Marker === "PHASE2291_SIXTEEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase2312Marker === "PHASE2312_SEVENTEEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase2334Marker === "PHASE2334_EIGHTEEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase2357Marker === "PHASE2357_NINETEEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase2381Marker === "PHASE2381_TWENTY_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase2406Marker === "PHASE2406_TWENTY_ONE_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase2432Marker === "PHASE2432_TWENTY_TWO_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase2459Marker === "PHASE2459_TWENTY_THREE_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase2487Marker === "PHASE2487_TWENTY_FOUR_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase2516Marker === "PHASE2516_TWENTY_FIVE_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase2546Marker === "PHASE2546_TWENTY_SIX_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase2577Marker === "PHASE2577_TWENTY_SEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase2609Marker === "PHASE2609_TWENTY_EIGHT_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase2642Marker === "PHASE2642_TWENTY_NINE_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase2676Marker === "PHASE2676_THIRTY_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase2711Marker === "PHASE2711_THIRTY_ONE_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase2747Marker === "PHASE2747_THIRTY_TWO_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase2784Marker === "PHASE2784_THIRTY_THREE_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase2822Marker === "PHASE2822_THIRTY_FOUR_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase2861Marker === "PHASE2861_THIRTY_FIVE_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase2901Marker === "PHASE2901_THIRTY_SIX_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase2942Marker === "PHASE2942_THIRTY_SEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase2984Marker === "PHASE2984_THIRTY_EIGHT_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase3027Marker === "PHASE3027_THIRTY_NINE_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase3071Marker === "PHASE3071_FORTY_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase3116Marker === "PHASE3116_FORTY_ONE_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase3162Marker === "PHASE3162_FORTY_TWO_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase3209Marker === "PHASE3209_FORTY_THREE_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase3257Marker === "PHASE3257_FORTY_FOUR_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase3306Marker === "PHASE3306_FORTY_FIVE_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase3356Marker === "PHASE3356_FORTY_SIX_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase3407Marker === "PHASE3407_FORTY_SEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase3459Marker === "PHASE3459_FORTY_EIGHT_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase3512Marker === "PHASE3512_FORTY_NINE_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase3566Marker === "PHASE3566_FIFTY_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase3621Marker === "PHASE3621_FIFTY_ONE_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase3677Marker === "PHASE3677_FIFTY_TWO_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase3734Marker === "PHASE3734_FIFTY_THREE_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase3792Marker === "PHASE3792_FIFTY_FOUR_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase3851Marker === "PHASE3851_FIFTY_FIVE_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2171.parsed?.phase3911Marker === "PHASE3911_FIFTY_SIX_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2186.parsed?.marker === "PHASE3912_FIFTY_SIX_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase2186.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase2186.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2186.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase2235Marker === "PHASE2235_THIRTEEN_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase2253Marker === "PHASE2253_FOURTEEN_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase2272Marker === "PHASE2272_FIFTEEN_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase2292Marker === "PHASE2292_SIXTEEN_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase2313Marker === "PHASE2313_SEVENTEEN_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase2335Marker === "PHASE2335_EIGHTEEN_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase2358Marker === "PHASE2358_NINETEEN_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase2382Marker === "PHASE2382_TWENTY_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase2407Marker === "PHASE2407_TWENTY_ONE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase2433Marker === "PHASE2433_TWENTY_TWO_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase2460Marker === "PHASE2460_TWENTY_THREE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase2488Marker === "PHASE2488_TWENTY_FOUR_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase2517Marker === "PHASE2517_TWENTY_FIVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase2547Marker === "PHASE2547_TWENTY_SIX_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase2578Marker === "PHASE2578_TWENTY_SEVEN_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase2610Marker === "PHASE2610_TWENTY_EIGHT_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase2643Marker === "PHASE2643_TWENTY_NINE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase2677Marker === "PHASE2677_THIRTY_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase2712Marker === "PHASE2712_THIRTY_ONE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase2748Marker === "PHASE2748_THIRTY_TWO_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase2785Marker === "PHASE2785_THIRTY_THREE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase2823Marker === "PHASE2823_THIRTY_FOUR_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase2862Marker === "PHASE2862_THIRTY_FIVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase2902Marker === "PHASE2902_THIRTY_SIX_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase2943Marker === "PHASE2943_THIRTY_SEVEN_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase2985Marker === "PHASE2985_THIRTY_EIGHT_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase3028Marker === "PHASE3028_THIRTY_NINE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase3072Marker === "PHASE3072_FORTY_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase3117Marker === "PHASE3117_FORTY_ONE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase3163Marker === "PHASE3163_FORTY_TWO_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase3210Marker === "PHASE3210_FORTY_THREE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase3258Marker === "PHASE3258_FORTY_FOUR_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase3307Marker === "PHASE3307_FORTY_FIVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase3357Marker === "PHASE3357_FORTY_SIX_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase3408Marker === "PHASE3408_FORTY_SEVEN_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase3460Marker === "PHASE3460_FORTY_EIGHT_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase3513Marker === "PHASE3513_FORTY_NINE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase3567Marker === "PHASE3567_FIFTY_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase3622Marker === "PHASE3622_FIFTY_ONE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase3678Marker === "PHASE3678_FIFTY_TWO_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase3735Marker === "PHASE3735_FIFTY_THREE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase3793Marker === "PHASE3793_FIFTY_FOUR_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase3852Marker === "PHASE3852_FIFTY_FIVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2186.parsed?.phase3912Marker === "PHASE3912_FIFTY_SIX_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2202.parsed?.marker === "PHASE3913_FIFTY_SIX_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase2202.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase2202.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2202.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2202.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase2254Marker === "PHASE2254_FOURTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase2273Marker === "PHASE2273_FIFTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase2293Marker === "PHASE2293_SIXTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase2314Marker === "PHASE2314_SEVENTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase2336Marker === "PHASE2336_EIGHTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase2359Marker === "PHASE2359_NINETEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase2383Marker === "PHASE2383_TWENTY_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase2408Marker === "PHASE2408_TWENTY_ONE_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase2434Marker === "PHASE2434_TWENTY_TWO_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase2461Marker === "PHASE2461_TWENTY_THREE_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase2489Marker === "PHASE2489_TWENTY_FOUR_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase2518Marker === "PHASE2518_TWENTY_FIVE_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase2548Marker === "PHASE2548_TWENTY_SIX_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase2579Marker === "PHASE2579_TWENTY_SEVEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase2611Marker === "PHASE2611_TWENTY_EIGHT_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase2644Marker === "PHASE2644_TWENTY_NINE_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase2678Marker === "PHASE2678_THIRTY_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase2713Marker === "PHASE2713_THIRTY_ONE_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase2749Marker === "PHASE2749_THIRTY_TWO_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase2786Marker === "PHASE2786_THIRTY_THREE_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase2824Marker === "PHASE2824_THIRTY_FOUR_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase2863Marker === "PHASE2863_THIRTY_FIVE_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase2903Marker === "PHASE2903_THIRTY_SIX_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase2944Marker === "PHASE2944_THIRTY_SEVEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase2986Marker === "PHASE2986_THIRTY_EIGHT_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase3029Marker === "PHASE3029_THIRTY_NINE_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase3073Marker === "PHASE3073_FORTY_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase3118Marker === "PHASE3118_FORTY_ONE_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase3164Marker === "PHASE3164_FORTY_TWO_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase3211Marker === "PHASE3211_FORTY_THREE_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase3259Marker === "PHASE3259_FORTY_FOUR_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase3308Marker === "PHASE3308_FORTY_FIVE_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase3358Marker === "PHASE3358_FORTY_SIX_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase3409Marker === "PHASE3409_FORTY_SEVEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase3461Marker === "PHASE3461_FORTY_EIGHT_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase3514Marker === "PHASE3514_FORTY_NINE_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase3568Marker === "PHASE3568_FIFTY_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase3623Marker === "PHASE3623_FIFTY_ONE_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase3679Marker === "PHASE3679_FIFTY_TWO_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase3736Marker === "PHASE3736_FIFTY_THREE_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase3794Marker === "PHASE3794_FIFTY_FOUR_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase3853Marker === "PHASE3853_FIFTY_FIVE_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2202.parsed?.phase3913Marker === "PHASE3913_FIFTY_SIX_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2219.parsed?.marker === "PHASE3914_FIFTY_SIX_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase2219.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase2219.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2219.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2219.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2219.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase2274Marker === "PHASE2274_FIFTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase2294Marker === "PHASE2294_SIXTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase2315Marker === "PHASE2315_SEVENTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase2337Marker === "PHASE2337_EIGHTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase2360Marker === "PHASE2360_NINETEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase2384Marker === "PHASE2384_TWENTY_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase2409Marker === "PHASE2409_TWENTY_ONE_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase2435Marker === "PHASE2435_TWENTY_TWO_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase2462Marker === "PHASE2462_TWENTY_THREE_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase2490Marker === "PHASE2490_TWENTY_FOUR_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase2519Marker === "PHASE2519_TWENTY_FIVE_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase2549Marker === "PHASE2549_TWENTY_SIX_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase2580Marker === "PHASE2580_TWENTY_SEVEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase2612Marker === "PHASE2612_TWENTY_EIGHT_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase2645Marker === "PHASE2645_TWENTY_NINE_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase2679Marker === "PHASE2679_THIRTY_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase2714Marker === "PHASE2714_THIRTY_ONE_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase2750Marker === "PHASE2750_THIRTY_TWO_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase2787Marker === "PHASE2787_THIRTY_THREE_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase2825Marker === "PHASE2825_THIRTY_FOUR_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase2864Marker === "PHASE2864_THIRTY_FIVE_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase2904Marker === "PHASE2904_THIRTY_SIX_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase2945Marker === "PHASE2945_THIRTY_SEVEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase2987Marker === "PHASE2987_THIRTY_EIGHT_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase3030Marker === "PHASE3030_THIRTY_NINE_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase3074Marker === "PHASE3074_FORTY_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase3119Marker === "PHASE3119_FORTY_ONE_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase3165Marker === "PHASE3165_FORTY_TWO_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase3212Marker === "PHASE3212_FORTY_THREE_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase3260Marker === "PHASE3260_FORTY_FOUR_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase3309Marker === "PHASE3309_FORTY_FIVE_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase3359Marker === "PHASE3359_FORTY_SIX_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase3410Marker === "PHASE3410_FORTY_SEVEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase3462Marker === "PHASE3462_FORTY_EIGHT_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase3515Marker === "PHASE3515_FORTY_NINE_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase3569Marker === "PHASE3569_FIFTY_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase3624Marker === "PHASE3624_FIFTY_ONE_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase3680Marker === "PHASE3680_FIFTY_TWO_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase3737Marker === "PHASE3737_FIFTY_THREE_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase3795Marker === "PHASE3795_FIFTY_FOUR_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase3854Marker === "PHASE3854_FIFTY_FIVE_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2219.parsed?.phase3914Marker === "PHASE3914_FIFTY_SIX_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2237.parsed?.marker === "PHASE3915_FIFTY_SIX_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase2237.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase2237.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2237.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2237.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2237.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2237.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase2295Marker === "PHASE2295_SIXTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase2316Marker === "PHASE2316_SEVENTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase2338Marker === "PHASE2338_EIGHTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase2361Marker === "PHASE2361_NINETEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase2385Marker === "PHASE2385_TWENTY_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase2410Marker === "PHASE2410_TWENTY_ONE_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase2436Marker === "PHASE2436_TWENTY_TWO_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase2463Marker === "PHASE2463_TWENTY_THREE_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase2491Marker === "PHASE2491_TWENTY_FOUR_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase2520Marker === "PHASE2520_TWENTY_FIVE_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase2550Marker === "PHASE2550_TWENTY_SIX_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase2581Marker === "PHASE2581_TWENTY_SEVEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase2613Marker === "PHASE2613_TWENTY_EIGHT_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase2646Marker === "PHASE2646_TWENTY_NINE_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase2680Marker === "PHASE2680_THIRTY_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase2715Marker === "PHASE2715_THIRTY_ONE_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase2751Marker === "PHASE2751_THIRTY_TWO_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase2788Marker === "PHASE2788_THIRTY_THREE_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase2826Marker === "PHASE2826_THIRTY_FOUR_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase2865Marker === "PHASE2865_THIRTY_FIVE_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase2905Marker === "PHASE2905_THIRTY_SIX_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase2946Marker === "PHASE2946_THIRTY_SEVEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase2988Marker === "PHASE2988_THIRTY_EIGHT_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase3031Marker === "PHASE3031_THIRTY_NINE_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase3075Marker === "PHASE3075_FORTY_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase3120Marker === "PHASE3120_FORTY_ONE_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase3166Marker === "PHASE3166_FORTY_TWO_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase3213Marker === "PHASE3213_FORTY_THREE_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase3261Marker === "PHASE3261_FORTY_FOUR_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase3310Marker === "PHASE3310_FORTY_FIVE_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase3360Marker === "PHASE3360_FORTY_SIX_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase3411Marker === "PHASE3411_FORTY_SEVEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase3463Marker === "PHASE3463_FORTY_EIGHT_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase3516Marker === "PHASE3516_FORTY_NINE_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase3570Marker === "PHASE3570_FIFTY_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase3625Marker === "PHASE3625_FIFTY_ONE_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase3681Marker === "PHASE3681_FIFTY_TWO_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase3738Marker === "PHASE3738_FIFTY_THREE_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase3796Marker === "PHASE3796_FIFTY_FOUR_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase3855Marker === "PHASE3855_FIFTY_FIVE_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2237.parsed?.phase3915Marker === "PHASE3915_FIFTY_SIX_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2256.parsed?.marker === "PHASE3916_FIFTY_SIX_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase2256.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase2256.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2256.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2256.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2256.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2256.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2256.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase2317Marker === "PHASE2317_SEVENTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase2339Marker === "PHASE2339_EIGHTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase2362Marker === "PHASE2362_NINETEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase2386Marker === "PHASE2386_TWENTY_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase2411Marker === "PHASE2411_TWENTY_ONE_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase2437Marker === "PHASE2437_TWENTY_TWO_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase2464Marker === "PHASE2464_TWENTY_THREE_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase2492Marker === "PHASE2492_TWENTY_FOUR_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase2521Marker === "PHASE2521_TWENTY_FIVE_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase2551Marker === "PHASE2551_TWENTY_SIX_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase2582Marker === "PHASE2582_TWENTY_SEVEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase2614Marker === "PHASE2614_TWENTY_EIGHT_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase2647Marker === "PHASE2647_TWENTY_NINE_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase2681Marker === "PHASE2681_THIRTY_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase2716Marker === "PHASE2716_THIRTY_ONE_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase2752Marker === "PHASE2752_THIRTY_TWO_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase2789Marker === "PHASE2789_THIRTY_THREE_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase2827Marker === "PHASE2827_THIRTY_FOUR_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase2866Marker === "PHASE2866_THIRTY_FIVE_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase2906Marker === "PHASE2906_THIRTY_SIX_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase2947Marker === "PHASE2947_THIRTY_SEVEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase2989Marker === "PHASE2989_THIRTY_EIGHT_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase3032Marker === "PHASE3032_THIRTY_NINE_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase3076Marker === "PHASE3076_FORTY_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase3121Marker === "PHASE3121_FORTY_ONE_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase3167Marker === "PHASE3167_FORTY_TWO_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase3214Marker === "PHASE3214_FORTY_THREE_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase3262Marker === "PHASE3262_FORTY_FOUR_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase3311Marker === "PHASE3311_FORTY_FIVE_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase3361Marker === "PHASE3361_FORTY_SIX_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase3412Marker === "PHASE3412_FORTY_SEVEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase3464Marker === "PHASE3464_FORTY_EIGHT_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase3517Marker === "PHASE3517_FORTY_NINE_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase3571Marker === "PHASE3571_FIFTY_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase3626Marker === "PHASE3626_FIFTY_ONE_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase3682Marker === "PHASE3682_FIFTY_TWO_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase3739Marker === "PHASE3739_FIFTY_THREE_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase3797Marker === "PHASE3797_FIFTY_FOUR_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase3856Marker === "PHASE3856_FIFTY_FIVE_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2256.parsed?.phase3916Marker === "PHASE3916_FIFTY_SIX_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2276.parsed?.marker === "PHASE3917_FIFTY_SIX_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase2276.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase2276.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2276.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2276.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2276.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2276.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2276.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2276.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase2340Marker === "PHASE2340_EIGHTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase2363Marker === "PHASE2363_NINETEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase2387Marker === "PHASE2387_TWENTY_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase2412Marker === "PHASE2412_TWENTY_ONE_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase2438Marker === "PHASE2438_TWENTY_TWO_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase2465Marker === "PHASE2465_TWENTY_THREE_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase2493Marker === "PHASE2493_TWENTY_FOUR_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase2522Marker === "PHASE2522_TWENTY_FIVE_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase2552Marker === "PHASE2552_TWENTY_SIX_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase2583Marker === "PHASE2583_TWENTY_SEVEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase2615Marker === "PHASE2615_TWENTY_EIGHT_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase2648Marker === "PHASE2648_TWENTY_NINE_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase2682Marker === "PHASE2682_THIRTY_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase2717Marker === "PHASE2717_THIRTY_ONE_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase2753Marker === "PHASE2753_THIRTY_TWO_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase2790Marker === "PHASE2790_THIRTY_THREE_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase2828Marker === "PHASE2828_THIRTY_FOUR_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase2867Marker === "PHASE2867_THIRTY_FIVE_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase2907Marker === "PHASE2907_THIRTY_SIX_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase2948Marker === "PHASE2948_THIRTY_SEVEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase2990Marker === "PHASE2990_THIRTY_EIGHT_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase3033Marker === "PHASE3033_THIRTY_NINE_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase3077Marker === "PHASE3077_FORTY_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase3122Marker === "PHASE3122_FORTY_ONE_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase3168Marker === "PHASE3168_FORTY_TWO_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase3215Marker === "PHASE3215_FORTY_THREE_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase3263Marker === "PHASE3263_FORTY_FOUR_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase3312Marker === "PHASE3312_FORTY_FIVE_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase3362Marker === "PHASE3362_FORTY_SIX_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase3413Marker === "PHASE3413_FORTY_SEVEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase3465Marker === "PHASE3465_FORTY_EIGHT_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase3518Marker === "PHASE3518_FORTY_NINE_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase3572Marker === "PHASE3572_FIFTY_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase3627Marker === "PHASE3627_FIFTY_ONE_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase3683Marker === "PHASE3683_FIFTY_TWO_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase3740Marker === "PHASE3740_FIFTY_THREE_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase3798Marker === "PHASE3798_FIFTY_FOUR_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase3857Marker === "PHASE3857_FIFTY_FIVE_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2276.parsed?.phase3917Marker === "PHASE3917_FIFTY_SIX_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2297.parsed?.marker === "PHASE3918_FIFTY_SIX_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase2297.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase2297.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2297.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2297.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2297.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2297.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2297.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2297.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2297.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase2364Marker === "PHASE2364_NINETEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase2388Marker === "PHASE2388_TWENTY_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase2413Marker === "PHASE2413_TWENTY_ONE_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase2439Marker === "PHASE2439_TWENTY_TWO_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase2466Marker === "PHASE2466_TWENTY_THREE_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase2494Marker === "PHASE2494_TWENTY_FOUR_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase2523Marker === "PHASE2523_TWENTY_FIVE_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase2553Marker === "PHASE2553_TWENTY_SIX_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase2584Marker === "PHASE2584_TWENTY_SEVEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase2616Marker === "PHASE2616_TWENTY_EIGHT_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase2649Marker === "PHASE2649_TWENTY_NINE_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase2683Marker === "PHASE2683_THIRTY_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase2718Marker === "PHASE2718_THIRTY_ONE_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase2754Marker === "PHASE2754_THIRTY_TWO_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase2791Marker === "PHASE2791_THIRTY_THREE_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase2829Marker === "PHASE2829_THIRTY_FOUR_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase2868Marker === "PHASE2868_THIRTY_FIVE_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase2908Marker === "PHASE2908_THIRTY_SIX_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase2949Marker === "PHASE2949_THIRTY_SEVEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase2991Marker === "PHASE2991_THIRTY_EIGHT_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase3034Marker === "PHASE3034_THIRTY_NINE_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase3078Marker === "PHASE3078_FORTY_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase3123Marker === "PHASE3123_FORTY_ONE_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase3169Marker === "PHASE3169_FORTY_TWO_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase3216Marker === "PHASE3216_FORTY_THREE_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase3264Marker === "PHASE3264_FORTY_FOUR_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase3313Marker === "PHASE3313_FORTY_FIVE_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase3363Marker === "PHASE3363_FORTY_SIX_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase3414Marker === "PHASE3414_FORTY_SEVEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase3466Marker === "PHASE3466_FORTY_EIGHT_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase3519Marker === "PHASE3519_FORTY_NINE_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase3573Marker === "PHASE3573_FIFTY_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase3628Marker === "PHASE3628_FIFTY_ONE_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase3684Marker === "PHASE3684_FIFTY_TWO_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase3741Marker === "PHASE3741_FIFTY_THREE_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase3799Marker === "PHASE3799_FIFTY_FOUR_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase3858Marker === "PHASE3858_FIFTY_FIVE_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2297.parsed?.phase3918Marker === "PHASE3918_FIFTY_SIX_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2319.parsed?.marker === "PHASE3919_FIFTY_SIX_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase2319.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase2319.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2319.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2319.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2319.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2319.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2319.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2319.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2319.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2319.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase2389Marker === "PHASE2389_TWENTY_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase2414Marker === "PHASE2414_TWENTY_ONE_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase2440Marker === "PHASE2440_TWENTY_TWO_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase2467Marker === "PHASE2467_TWENTY_THREE_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase2495Marker === "PHASE2495_TWENTY_FOUR_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase2524Marker === "PHASE2524_TWENTY_FIVE_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase2554Marker === "PHASE2554_TWENTY_SIX_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase2585Marker === "PHASE2585_TWENTY_SEVEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase2617Marker === "PHASE2617_TWENTY_EIGHT_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase2650Marker === "PHASE2650_TWENTY_NINE_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase2684Marker === "PHASE2684_THIRTY_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase2719Marker === "PHASE2719_THIRTY_ONE_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase2755Marker === "PHASE2755_THIRTY_TWO_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase2792Marker === "PHASE2792_THIRTY_THREE_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase2830Marker === "PHASE2830_THIRTY_FOUR_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase2869Marker === "PHASE2869_THIRTY_FIVE_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase2909Marker === "PHASE2909_THIRTY_SIX_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase2950Marker === "PHASE2950_THIRTY_SEVEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase2992Marker === "PHASE2992_THIRTY_EIGHT_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase3035Marker === "PHASE3035_THIRTY_NINE_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase3079Marker === "PHASE3079_FORTY_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase3124Marker === "PHASE3124_FORTY_ONE_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase3170Marker === "PHASE3170_FORTY_TWO_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase3217Marker === "PHASE3217_FORTY_THREE_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase3265Marker === "PHASE3265_FORTY_FOUR_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase3314Marker === "PHASE3314_FORTY_FIVE_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase3364Marker === "PHASE3364_FORTY_SIX_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase3415Marker === "PHASE3415_FORTY_SEVEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase3467Marker === "PHASE3467_FORTY_EIGHT_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase3520Marker === "PHASE3520_FORTY_NINE_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase3574Marker === "PHASE3574_FIFTY_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase3629Marker === "PHASE3629_FIFTY_ONE_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase3685Marker === "PHASE3685_FIFTY_TWO_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase3742Marker === "PHASE3742_FIFTY_THREE_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase3800Marker === "PHASE3800_FIFTY_FOUR_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase3859Marker === "PHASE3859_FIFTY_FIVE_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2319.parsed?.phase3919Marker === "PHASE3919_FIFTY_SIX_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2342.parsed?.marker === "PHASE3920_FIFTY_SIX_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase2342.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase2342.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2342.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2342.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2342.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2342.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2342.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2342.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2342.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2342.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2342.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase2415Marker === "PHASE2415_TWENTY_ONE_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase2441Marker === "PHASE2441_TWENTY_TWO_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase2468Marker === "PHASE2468_TWENTY_THREE_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase2496Marker === "PHASE2496_TWENTY_FOUR_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase2525Marker === "PHASE2525_TWENTY_FIVE_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase2555Marker === "PHASE2555_TWENTY_SIX_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase2586Marker === "PHASE2586_TWENTY_SEVEN_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase2618Marker === "PHASE2618_TWENTY_EIGHT_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase2651Marker === "PHASE2651_TWENTY_NINE_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase2685Marker === "PHASE2685_THIRTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase2720Marker === "PHASE2720_THIRTY_ONE_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase2756Marker === "PHASE2756_THIRTY_TWO_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase2793Marker === "PHASE2793_THIRTY_THREE_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase2831Marker === "PHASE2831_THIRTY_FOUR_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase2870Marker === "PHASE2870_THIRTY_FIVE_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase2910Marker === "PHASE2910_THIRTY_SIX_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase2951Marker === "PHASE2951_THIRTY_SEVEN_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase2993Marker === "PHASE2993_THIRTY_EIGHT_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase3036Marker === "PHASE3036_THIRTY_NINE_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase3080Marker === "PHASE3080_FORTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase3125Marker === "PHASE3125_FORTY_ONE_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase3171Marker === "PHASE3171_FORTY_TWO_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase3218Marker === "PHASE3218_FORTY_THREE_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase3266Marker === "PHASE3266_FORTY_FOUR_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase3315Marker === "PHASE3315_FORTY_FIVE_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase3365Marker === "PHASE3365_FORTY_SIX_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase3416Marker === "PHASE3416_FORTY_SEVEN_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase3468Marker === "PHASE3468_FORTY_EIGHT_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase3521Marker === "PHASE3521_FORTY_NINE_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase3575Marker === "PHASE3575_FIFTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase3630Marker === "PHASE3630_FIFTY_ONE_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase3686Marker === "PHASE3686_FIFTY_TWO_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase3743Marker === "PHASE3743_FIFTY_THREE_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase3801Marker === "PHASE3801_FIFTY_FOUR_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase3860Marker === "PHASE3860_FIFTY_FIVE_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2342.parsed?.phase3920Marker === "PHASE3920_FIFTY_SIX_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2366.parsed?.marker === "PHASE3921_FIFTY_SIX_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase2366.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase2366.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2366.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2366.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2366.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2366.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2366.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2366.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2366.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2366.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2366.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2366.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase2442Marker === "PHASE2442_TWENTY_TWO_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase2469Marker === "PHASE2469_TWENTY_THREE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase2497Marker === "PHASE2497_TWENTY_FOUR_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase2526Marker === "PHASE2526_TWENTY_FIVE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase2556Marker === "PHASE2556_TWENTY_SIX_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase2587Marker === "PHASE2587_TWENTY_SEVEN_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase2619Marker === "PHASE2619_TWENTY_EIGHT_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase2652Marker === "PHASE2652_TWENTY_NINE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase2686Marker === "PHASE2686_THIRTY_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase2721Marker === "PHASE2721_THIRTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase2757Marker === "PHASE2757_THIRTY_TWO_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase2794Marker === "PHASE2794_THIRTY_THREE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase2832Marker === "PHASE2832_THIRTY_FOUR_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase2871Marker === "PHASE2871_THIRTY_FIVE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase2911Marker === "PHASE2911_THIRTY_SIX_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase2952Marker === "PHASE2952_THIRTY_SEVEN_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase2994Marker === "PHASE2994_THIRTY_EIGHT_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase3037Marker === "PHASE3037_THIRTY_NINE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase3081Marker === "PHASE3081_FORTY_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase3126Marker === "PHASE3126_FORTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase3172Marker === "PHASE3172_FORTY_TWO_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase3219Marker === "PHASE3219_FORTY_THREE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase3267Marker === "PHASE3267_FORTY_FOUR_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase3316Marker === "PHASE3316_FORTY_FIVE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase3366Marker === "PHASE3366_FORTY_SIX_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase3417Marker === "PHASE3417_FORTY_SEVEN_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase3469Marker === "PHASE3469_FORTY_EIGHT_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase3522Marker === "PHASE3522_FORTY_NINE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase3576Marker === "PHASE3576_FIFTY_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase3631Marker === "PHASE3631_FIFTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase3687Marker === "PHASE3687_FIFTY_TWO_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase3744Marker === "PHASE3744_FIFTY_THREE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase3802Marker === "PHASE3802_FIFTY_FOUR_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase3861Marker === "PHASE3861_FIFTY_FIVE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2366.parsed?.phase3921Marker === "PHASE3921_FIFTY_SIX_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2391.parsed?.marker === "PHASE3922_FIFTY_SIX_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase2391.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase2391.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2391.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2391.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2391.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2391.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2391.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2391.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2391.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2391.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2391.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2391.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2391.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase2470Marker === "PHASE2470_TWENTY_THREE_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase2498Marker === "PHASE2498_TWENTY_FOUR_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase2527Marker === "PHASE2527_TWENTY_FIVE_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase2557Marker === "PHASE2557_TWENTY_SIX_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase2588Marker === "PHASE2588_TWENTY_SEVEN_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase2620Marker === "PHASE2620_TWENTY_EIGHT_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase2653Marker === "PHASE2653_TWENTY_NINE_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase2687Marker === "PHASE2687_THIRTY_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase2722Marker === "PHASE2722_THIRTY_ONE_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase2758Marker === "PHASE2758_THIRTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase2795Marker === "PHASE2795_THIRTY_THREE_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase2833Marker === "PHASE2833_THIRTY_FOUR_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase2872Marker === "PHASE2872_THIRTY_FIVE_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase2912Marker === "PHASE2912_THIRTY_SIX_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase2953Marker === "PHASE2953_THIRTY_SEVEN_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase2995Marker === "PHASE2995_THIRTY_EIGHT_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase3038Marker === "PHASE3038_THIRTY_NINE_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase3082Marker === "PHASE3082_FORTY_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase3127Marker === "PHASE3127_FORTY_ONE_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase3173Marker === "PHASE3173_FORTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase3220Marker === "PHASE3220_FORTY_THREE_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase3268Marker === "PHASE3268_FORTY_FOUR_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase3317Marker === "PHASE3317_FORTY_FIVE_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase3367Marker === "PHASE3367_FORTY_SIX_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase3418Marker === "PHASE3418_FORTY_SEVEN_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase3470Marker === "PHASE3470_FORTY_EIGHT_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase3523Marker === "PHASE3523_FORTY_NINE_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase3577Marker === "PHASE3577_FIFTY_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase3632Marker === "PHASE3632_FIFTY_ONE_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase3688Marker === "PHASE3688_FIFTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase3745Marker === "PHASE3745_FIFTY_THREE_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase3803Marker === "PHASE3803_FIFTY_FOUR_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase3862Marker === "PHASE3862_FIFTY_FIVE_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2391.parsed?.phase3922Marker === "PHASE3922_FIFTY_SIX_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2417.parsed?.marker === "PHASE3923_FIFTY_SIX_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2417.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase2417.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase2417.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2417.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2417.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2417.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2417.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2417.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2417.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2417.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2417.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2417.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2417.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2417.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2417.parsed?.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2417.parsed?.phase2499Marker === "PHASE2499_TWENTY_FOUR_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2417.parsed?.phase2528Marker === "PHASE2528_TWENTY_FIVE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2417.parsed?.phase2558Marker === "PHASE2558_TWENTY_SIX_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2417.parsed?.phase2589Marker === "PHASE2589_TWENTY_SEVEN_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2417.parsed?.phase2621Marker === "PHASE2621_TWENTY_EIGHT_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2417.parsed?.phase2654Marker === "PHASE2654_TWENTY_NINE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2417.parsed?.phase2688Marker === "PHASE2688_THIRTY_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2417.parsed?.phase2723Marker === "PHASE2723_THIRTY_ONE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2417.parsed?.phase2759Marker === "PHASE2759_THIRTY_TWO_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2417.parsed?.phase2796Marker === "PHASE2796_THIRTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2417.parsed?.phase2834Marker === "PHASE2834_THIRTY_FOUR_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2417.parsed?.phase2873Marker === "PHASE2873_THIRTY_FIVE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2417.parsed?.phase2913Marker === "PHASE2913_THIRTY_SIX_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2417.parsed?.phase2954Marker === "PHASE2954_THIRTY_SEVEN_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2417.parsed?.phase2996Marker === "PHASE2996_THIRTY_EIGHT_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2417.parsed?.phase3039Marker === "PHASE3039_THIRTY_NINE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2417.parsed?.phase3083Marker === "PHASE3083_FORTY_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2417.parsed?.phase3128Marker === "PHASE3128_FORTY_ONE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2417.parsed?.phase3174Marker === "PHASE3174_FORTY_TWO_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2417.parsed?.phase3221Marker === "PHASE3221_FORTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2417.parsed?.phase3269Marker === "PHASE3269_FORTY_FOUR_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2417.parsed?.phase3318Marker === "PHASE3318_FORTY_FIVE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2417.parsed?.phase3368Marker === "PHASE3368_FORTY_SIX_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2417.parsed?.phase3419Marker === "PHASE3419_FORTY_SEVEN_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2417.parsed?.phase3471Marker === "PHASE3471_FORTY_EIGHT_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2417.parsed?.phase3524Marker === "PHASE3524_FORTY_NINE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2417.parsed?.phase3578Marker === "PHASE3578_FIFTY_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2417.parsed?.phase3633Marker === "PHASE3633_FIFTY_ONE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2417.parsed?.phase3689Marker === "PHASE3689_FIFTY_TWO_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2417.parsed?.phase3746Marker === "PHASE3746_FIFTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2417.parsed?.phase3804Marker === "PHASE3804_FIFTY_FOUR_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2417.parsed?.phase3863Marker === "PHASE3863_FIFTY_FIVE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2417.parsed?.phase3923Marker === "PHASE3923_FIFTY_SIX_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2444.parsed?.marker === "PHASE3924_FIFTY_SIX_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2444.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase2444.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase2444.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2444.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2444.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2444.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2444.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2444.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2444.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2444.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2444.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2444.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2444.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2444.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2444.parsed?.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2444.parsed?.phase2500Marker === "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2444.parsed?.phase2529Marker === "PHASE2529_TWENTY_FIVE_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2444.parsed?.phase2559Marker === "PHASE2559_TWENTY_SIX_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2444.parsed?.phase2590Marker === "PHASE2590_TWENTY_SEVEN_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2444.parsed?.phase2622Marker === "PHASE2622_TWENTY_EIGHT_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2444.parsed?.phase2655Marker === "PHASE2655_TWENTY_NINE_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2444.parsed?.phase2689Marker === "PHASE2689_THIRTY_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2444.parsed?.phase2724Marker === "PHASE2724_THIRTY_ONE_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2444.parsed?.phase2760Marker === "PHASE2760_THIRTY_TWO_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2444.parsed?.phase2797Marker === "PHASE2797_THIRTY_THREE_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2444.parsed?.phase2835Marker === "PHASE2835_THIRTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2444.parsed?.phase2874Marker === "PHASE2874_THIRTY_FIVE_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2444.parsed?.phase2914Marker === "PHASE2914_THIRTY_SIX_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2444.parsed?.phase2955Marker === "PHASE2955_THIRTY_SEVEN_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2444.parsed?.phase2997Marker === "PHASE2997_THIRTY_EIGHT_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2444.parsed?.phase3040Marker === "PHASE3040_THIRTY_NINE_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2444.parsed?.phase3084Marker === "PHASE3084_FORTY_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2444.parsed?.phase3129Marker === "PHASE3129_FORTY_ONE_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2444.parsed?.phase3175Marker === "PHASE3175_FORTY_TWO_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2444.parsed?.phase3222Marker === "PHASE3222_FORTY_THREE_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2444.parsed?.phase3270Marker === "PHASE3270_FORTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2444.parsed?.phase3319Marker === "PHASE3319_FORTY_FIVE_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2444.parsed?.phase3369Marker === "PHASE3369_FORTY_SIX_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2444.parsed?.phase3420Marker === "PHASE3420_FORTY_SEVEN_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2444.parsed?.phase3472Marker === "PHASE3472_FORTY_EIGHT_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2444.parsed?.phase3525Marker === "PHASE3525_FORTY_NINE_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2444.parsed?.phase3579Marker === "PHASE3579_FIFTY_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2444.parsed?.phase3634Marker === "PHASE3634_FIFTY_ONE_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2444.parsed?.phase3690Marker === "PHASE3690_FIFTY_TWO_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2444.parsed?.phase3747Marker === "PHASE3747_FIFTY_THREE_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2444.parsed?.phase3805Marker === "PHASE3805_FIFTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2444.parsed?.phase3864Marker === "PHASE3864_FIFTY_FIVE_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2444.parsed?.phase3924Marker === "PHASE3924_FIFTY_SIX_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2472.parsed?.marker === "PHASE3925_FIFTY_SIX_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2472.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase2472.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase2472.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2472.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2472.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2472.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2472.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2472.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2472.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2472.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2472.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2472.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2472.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2472.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2472.parsed?.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2472.parsed?.phase2500Marker === "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2472.parsed?.phase2530Marker === "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2472.parsed?.phase2560Marker === "PHASE2560_TWENTY_SIX_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2472.parsed?.phase2591Marker === "PHASE2591_TWENTY_SEVEN_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2472.parsed?.phase2623Marker === "PHASE2623_TWENTY_EIGHT_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2472.parsed?.phase2656Marker === "PHASE2656_TWENTY_NINE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2472.parsed?.phase2690Marker === "PHASE2690_THIRTY_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2472.parsed?.phase2725Marker === "PHASE2725_THIRTY_ONE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2472.parsed?.phase2761Marker === "PHASE2761_THIRTY_TWO_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2472.parsed?.phase2798Marker === "PHASE2798_THIRTY_THREE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2472.parsed?.phase2836Marker === "PHASE2836_THIRTY_FOUR_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2472.parsed?.phase2875Marker === "PHASE2875_THIRTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2472.parsed?.phase2915Marker === "PHASE2915_THIRTY_SIX_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2472.parsed?.phase2956Marker === "PHASE2956_THIRTY_SEVEN_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2472.parsed?.phase2998Marker === "PHASE2998_THIRTY_EIGHT_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2472.parsed?.phase3041Marker === "PHASE3041_THIRTY_NINE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2472.parsed?.phase3085Marker === "PHASE3085_FORTY_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2472.parsed?.phase3130Marker === "PHASE3130_FORTY_ONE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2472.parsed?.phase3176Marker === "PHASE3176_FORTY_TWO_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2472.parsed?.phase3223Marker === "PHASE3223_FORTY_THREE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2472.parsed?.phase3271Marker === "PHASE3271_FORTY_FOUR_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2472.parsed?.phase3320Marker === "PHASE3320_FORTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2472.parsed?.phase3370Marker === "PHASE3370_FORTY_SIX_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2472.parsed?.phase3421Marker === "PHASE3421_FORTY_SEVEN_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2472.parsed?.phase3473Marker === "PHASE3473_FORTY_EIGHT_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2472.parsed?.phase3526Marker === "PHASE3526_FORTY_NINE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2472.parsed?.phase3580Marker === "PHASE3580_FIFTY_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2472.parsed?.phase3635Marker === "PHASE3635_FIFTY_ONE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2472.parsed?.phase3691Marker === "PHASE3691_FIFTY_TWO_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2472.parsed?.phase3748Marker === "PHASE3748_FIFTY_THREE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2472.parsed?.phase3806Marker === "PHASE3806_FIFTY_FOUR_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2472.parsed?.phase3865Marker === "PHASE3865_FIFTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2472.parsed?.phase3925Marker === "PHASE3925_FIFTY_SIX_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2501.parsed?.marker === "PHASE3926_FIFTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2501.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase2501.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase2501.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2501.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2501.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2501.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2501.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2501.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2501.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2501.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2501.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2501.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2501.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2501.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2501.parsed?.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2501.parsed?.phase2500Marker === "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2501.parsed?.phase2530Marker === "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2501.parsed?.phase2561Marker === "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2501.parsed?.phase2592Marker === "PHASE2592_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2501.parsed?.phase2624Marker === "PHASE2624_TWENTY_EIGHT_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2501.parsed?.phase2657Marker === "PHASE2657_TWENTY_NINE_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2501.parsed?.phase2691Marker === "PHASE2691_THIRTY_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2501.parsed?.phase2726Marker === "PHASE2726_THIRTY_ONE_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2501.parsed?.phase2762Marker === "PHASE2762_THIRTY_TWO_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2501.parsed?.phase2799Marker === "PHASE2799_THIRTY_THREE_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2501.parsed?.phase2837Marker === "PHASE2837_THIRTY_FOUR_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2501.parsed?.phase2876Marker === "PHASE2876_THIRTY_FIVE_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2501.parsed?.phase2916Marker === "PHASE2916_THIRTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2501.parsed?.phase2957Marker === "PHASE2957_THIRTY_SEVEN_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2501.parsed?.phase2999Marker === "PHASE2999_THIRTY_EIGHT_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2501.parsed?.phase3042Marker === "PHASE3042_THIRTY_NINE_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2501.parsed?.phase3086Marker === "PHASE3086_FORTY_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2501.parsed?.phase3131Marker === "PHASE3131_FORTY_ONE_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2501.parsed?.phase3177Marker === "PHASE3177_FORTY_TWO_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2501.parsed?.phase3224Marker === "PHASE3224_FORTY_THREE_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2501.parsed?.phase3272Marker === "PHASE3272_FORTY_FOUR_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2501.parsed?.phase3321Marker === "PHASE3321_FORTY_FIVE_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2501.parsed?.phase3371Marker === "PHASE3371_FORTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2501.parsed?.phase3422Marker === "PHASE3422_FORTY_SEVEN_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2501.parsed?.phase3474Marker === "PHASE3474_FORTY_EIGHT_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2501.parsed?.phase3527Marker === "PHASE3527_FORTY_NINE_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2501.parsed?.phase3581Marker === "PHASE3581_FIFTY_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2501.parsed?.phase3636Marker === "PHASE3636_FIFTY_ONE_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2501.parsed?.phase3692Marker === "PHASE3692_FIFTY_TWO_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2501.parsed?.phase3749Marker === "PHASE3749_FIFTY_THREE_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2501.parsed?.phase3807Marker === "PHASE3807_FIFTY_FOUR_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2501.parsed?.phase3866Marker === "PHASE3866_FIFTY_FIVE_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2501.parsed?.phase3926Marker === "PHASE3926_FIFTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2531.parsed?.marker === "PHASE3927_FIFTY_SIX_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2531.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase2531.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase2531.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2531.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2531.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2531.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2531.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2531.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2531.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2531.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2531.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2531.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2531.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2531.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2531.parsed?.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2531.parsed?.phase2500Marker === "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2531.parsed?.phase2530Marker === "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2531.parsed?.phase2561Marker === "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2531.parsed?.phase2593Marker === "PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2531.parsed?.phase2625Marker === "PHASE2625_TWENTY_EIGHT_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2531.parsed?.phase2658Marker === "PHASE2658_TWENTY_NINE_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2531.parsed?.phase2692Marker === "PHASE2692_THIRTY_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2531.parsed?.phase2727Marker === "PHASE2727_THIRTY_ONE_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2531.parsed?.phase2763Marker === "PHASE2763_THIRTY_TWO_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2531.parsed?.phase2800Marker === "PHASE2800_THIRTY_THREE_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2531.parsed?.phase2838Marker === "PHASE2838_THIRTY_FOUR_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2531.parsed?.phase2877Marker === "PHASE2877_THIRTY_FIVE_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2531.parsed?.phase2917Marker === "PHASE2917_THIRTY_SIX_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2531.parsed?.phase2958Marker === "PHASE2958_THIRTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2531.parsed?.phase3000Marker === "PHASE3000_THIRTY_EIGHT_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2531.parsed?.phase3043Marker === "PHASE3043_THIRTY_NINE_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2531.parsed?.phase3087Marker === "PHASE3087_FORTY_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2531.parsed?.phase3132Marker === "PHASE3132_FORTY_ONE_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2531.parsed?.phase3178Marker === "PHASE3178_FORTY_TWO_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2531.parsed?.phase3225Marker === "PHASE3225_FORTY_THREE_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2531.parsed?.phase3273Marker === "PHASE3273_FORTY_FOUR_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2531.parsed?.phase3322Marker === "PHASE3322_FORTY_FIVE_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2531.parsed?.phase3372Marker === "PHASE3372_FORTY_SIX_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2531.parsed?.phase3423Marker === "PHASE3423_FORTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2531.parsed?.phase3475Marker === "PHASE3475_FORTY_EIGHT_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2531.parsed?.phase3528Marker === "PHASE3528_FORTY_NINE_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2531.parsed?.phase3582Marker === "PHASE3582_FIFTY_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2531.parsed?.phase3637Marker === "PHASE3637_FIFTY_ONE_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2531.parsed?.phase3693Marker === "PHASE3693_FIFTY_TWO_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2531.parsed?.phase3750Marker === "PHASE3750_FIFTY_THREE_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2531.parsed?.phase3808Marker === "PHASE3808_FIFTY_FOUR_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2531.parsed?.phase3867Marker === "PHASE3867_FIFTY_FIVE_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2531.parsed?.phase3927Marker === "PHASE3927_FIFTY_SIX_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2562.parsed?.marker === "PHASE3928_FIFTY_SIX_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2562.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase2562.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase2562.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2562.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2562.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2562.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2562.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2562.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2562.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2562.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2562.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2562.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2562.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2562.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2562.parsed?.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2562.parsed?.phase2500Marker === "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2562.parsed?.phase2530Marker === "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2562.parsed?.phase2561Marker === "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2562.parsed?.phase2593Marker === "PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2562.parsed?.phase2626Marker === "PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2562.parsed?.phase2659Marker === "PHASE2659_TWENTY_NINE_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2562.parsed?.phase2693Marker === "PHASE2693_THIRTY_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2562.parsed?.phase2728Marker === "PHASE2728_THIRTY_ONE_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2562.parsed?.phase2764Marker === "PHASE2764_THIRTY_TWO_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2562.parsed?.phase2801Marker === "PHASE2801_THIRTY_THREE_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2562.parsed?.phase2839Marker === "PHASE2839_THIRTY_FOUR_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2562.parsed?.phase2878Marker === "PHASE2878_THIRTY_FIVE_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2562.parsed?.phase2918Marker === "PHASE2918_THIRTY_SIX_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2562.parsed?.phase2959Marker === "PHASE2959_THIRTY_SEVEN_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2562.parsed?.phase3001Marker === "PHASE3001_THIRTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2562.parsed?.phase3044Marker === "PHASE3044_THIRTY_NINE_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2562.parsed?.phase3088Marker === "PHASE3088_FORTY_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2562.parsed?.phase3133Marker === "PHASE3133_FORTY_ONE_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2562.parsed?.phase3179Marker === "PHASE3179_FORTY_TWO_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2562.parsed?.phase3226Marker === "PHASE3226_FORTY_THREE_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2562.parsed?.phase3274Marker === "PHASE3274_FORTY_FOUR_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2562.parsed?.phase3323Marker === "PHASE3323_FORTY_FIVE_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2562.parsed?.phase3373Marker === "PHASE3373_FORTY_SIX_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2562.parsed?.phase3424Marker === "PHASE3424_FORTY_SEVEN_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2562.parsed?.phase3476Marker === "PHASE3476_FORTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2562.parsed?.phase3529Marker === "PHASE3529_FORTY_NINE_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2562.parsed?.phase3583Marker === "PHASE3583_FIFTY_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2562.parsed?.phase3638Marker === "PHASE3638_FIFTY_ONE_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2562.parsed?.phase3694Marker === "PHASE3694_FIFTY_TWO_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2562.parsed?.phase3751Marker === "PHASE3751_FIFTY_THREE_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2562.parsed?.phase3809Marker === "PHASE3809_FIFTY_FOUR_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2562.parsed?.phase3868Marker === "PHASE3868_FIFTY_FIVE_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2562.parsed?.phase3928Marker === "PHASE3928_FIFTY_SIX_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2594.parsed?.marker === "PHASE3929_FIFTY_SIX_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2594.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase2594.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase2594.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2594.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2594.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2594.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2594.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2594.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2594.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2594.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2594.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2594.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2594.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2594.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2594.parsed?.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2594.parsed?.phase2500Marker === "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2594.parsed?.phase2530Marker === "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2594.parsed?.phase2561Marker === "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2594.parsed?.phase2593Marker === "PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2594.parsed?.phase2626Marker === "PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2594.parsed?.phase2660Marker === "PHASE2660_TWENTY_NINE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2594.parsed?.phase2694Marker === "PHASE2694_THIRTY_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2594.parsed?.phase2729Marker === "PHASE2729_THIRTY_ONE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2594.parsed?.phase2765Marker === "PHASE2765_THIRTY_TWO_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2594.parsed?.phase2802Marker === "PHASE2802_THIRTY_THREE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2594.parsed?.phase2840Marker === "PHASE2840_THIRTY_FOUR_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2594.parsed?.phase2879Marker === "PHASE2879_THIRTY_FIVE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2594.parsed?.phase2919Marker === "PHASE2919_THIRTY_SIX_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2594.parsed?.phase2960Marker === "PHASE2960_THIRTY_SEVEN_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2594.parsed?.phase3002Marker === "PHASE3002_THIRTY_EIGHT_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2594.parsed?.phase3045Marker === "PHASE3045_THIRTY_NINE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2594.parsed?.phase3089Marker === "PHASE3089_FORTY_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2594.parsed?.phase3134Marker === "PHASE3134_FORTY_ONE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2594.parsed?.phase3180Marker === "PHASE3180_FORTY_TWO_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2594.parsed?.phase3227Marker === "PHASE3227_FORTY_THREE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2594.parsed?.phase3275Marker === "PHASE3275_FORTY_FOUR_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2594.parsed?.phase3324Marker === "PHASE3324_FORTY_FIVE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2594.parsed?.phase3374Marker === "PHASE3374_FORTY_SIX_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2594.parsed?.phase3425Marker === "PHASE3425_FORTY_SEVEN_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2594.parsed?.phase3477Marker === "PHASE3477_FORTY_EIGHT_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2594.parsed?.phase3530Marker === "PHASE3530_FORTY_NINE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2594.parsed?.phase3584Marker === "PHASE3584_FIFTY_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2594.parsed?.phase3639Marker === "PHASE3639_FIFTY_ONE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2594.parsed?.phase3695Marker === "PHASE3695_FIFTY_TWO_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2594.parsed?.phase3752Marker === "PHASE3752_FIFTY_THREE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2594.parsed?.phase3810Marker === "PHASE3810_FIFTY_FOUR_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2594.parsed?.phase3869Marker === "PHASE3869_FIFTY_FIVE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2594.parsed?.phase3929Marker === "PHASE3929_FIFTY_SIX_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2627.parsed?.marker === "PHASE3930_FIFTY_SIX_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2627.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase2627.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase2627.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2627.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2627.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2627.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2627.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2627.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2627.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2627.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2627.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2627.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2627.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2627.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2627.parsed?.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2627.parsed?.phase2500Marker === "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2627.parsed?.phase2530Marker === "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2627.parsed?.phase2561Marker === "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2627.parsed?.phase2593Marker === "PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2627.parsed?.phase2626Marker === "PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2627.parsed?.phase2660Marker === "PHASE2660_TWENTY_NINE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2627.parsed?.phase2695Marker === "PHASE2695_THIRTY_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2627.parsed?.phase2730Marker === "PHASE2730_THIRTY_ONE_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2627.parsed?.phase2766Marker === "PHASE2766_THIRTY_TWO_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2627.parsed?.phase2803Marker === "PHASE2803_THIRTY_THREE_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2627.parsed?.phase2841Marker === "PHASE2841_THIRTY_FOUR_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2627.parsed?.phase2880Marker === "PHASE2880_THIRTY_FIVE_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2627.parsed?.phase2920Marker === "PHASE2920_THIRTY_SIX_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2627.parsed?.phase2961Marker === "PHASE2961_THIRTY_SEVEN_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2627.parsed?.phase3003Marker === "PHASE3003_THIRTY_EIGHT_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2627.parsed?.phase3046Marker === "PHASE3046_THIRTY_NINE_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2627.parsed?.phase3090Marker === "PHASE3090_FORTY_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2627.parsed?.phase3135Marker === "PHASE3135_FORTY_ONE_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2627.parsed?.phase3181Marker === "PHASE3181_FORTY_TWO_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2627.parsed?.phase3228Marker === "PHASE3228_FORTY_THREE_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2627.parsed?.phase3276Marker === "PHASE3276_FORTY_FOUR_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2627.parsed?.phase3325Marker === "PHASE3325_FORTY_FIVE_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2627.parsed?.phase3375Marker === "PHASE3375_FORTY_SIX_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2627.parsed?.phase3426Marker === "PHASE3426_FORTY_SEVEN_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2627.parsed?.phase3478Marker === "PHASE3478_FORTY_EIGHT_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2627.parsed?.phase3531Marker === "PHASE3531_FORTY_NINE_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2627.parsed?.phase3585Marker === "PHASE3585_FIFTY_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2627.parsed?.phase3640Marker === "PHASE3640_FIFTY_ONE_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2627.parsed?.phase3696Marker === "PHASE3696_FIFTY_TWO_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2627.parsed?.phase3753Marker === "PHASE3753_FIFTY_THREE_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2627.parsed?.phase3811Marker === "PHASE3811_FIFTY_FOUR_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2627.parsed?.phase3870Marker === "PHASE3870_FIFTY_FIVE_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2627.parsed?.phase3930Marker === "PHASE3930_FIFTY_SIX_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2661.parsed?.marker === "PHASE3931_FIFTY_SIX_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2661.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase2661.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase2661.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2661.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2661.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2661.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2661.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2661.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2661.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2661.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2661.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2661.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2661.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2661.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2661.parsed?.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2661.parsed?.phase2500Marker === "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2661.parsed?.phase2530Marker === "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2661.parsed?.phase2561Marker === "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2661.parsed?.phase2593Marker === "PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2661.parsed?.phase2626Marker === "PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2661.parsed?.phase2660Marker === "PHASE2660_TWENTY_NINE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2661.parsed?.phase2695Marker === "PHASE2695_THIRTY_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2661.parsed?.phase2731Marker === "PHASE2731_THIRTY_ONE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2661.parsed?.phase2767Marker === "PHASE2767_THIRTY_TWO_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2661.parsed?.phase2804Marker === "PHASE2804_THIRTY_THREE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2661.parsed?.phase2842Marker === "PHASE2842_THIRTY_FOUR_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2661.parsed?.phase2881Marker === "PHASE2881_THIRTY_FIVE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2661.parsed?.phase2921Marker === "PHASE2921_THIRTY_SIX_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2661.parsed?.phase2962Marker === "PHASE2962_THIRTY_SEVEN_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2661.parsed?.phase3004Marker === "PHASE3004_THIRTY_EIGHT_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2661.parsed?.phase3047Marker === "PHASE3047_THIRTY_NINE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2661.parsed?.phase3091Marker === "PHASE3091_FORTY_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2661.parsed?.phase3136Marker === "PHASE3136_FORTY_ONE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2661.parsed?.phase3182Marker === "PHASE3182_FORTY_TWO_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2661.parsed?.phase3229Marker === "PHASE3229_FORTY_THREE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2661.parsed?.phase3277Marker === "PHASE3277_FORTY_FOUR_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2661.parsed?.phase3326Marker === "PHASE3326_FORTY_FIVE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2661.parsed?.phase3376Marker === "PHASE3376_FORTY_SIX_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2661.parsed?.phase3427Marker === "PHASE3427_FORTY_SEVEN_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2661.parsed?.phase3479Marker === "PHASE3479_FORTY_EIGHT_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2661.parsed?.phase3532Marker === "PHASE3532_FORTY_NINE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2661.parsed?.phase3586Marker === "PHASE3586_FIFTY_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2661.parsed?.phase3641Marker === "PHASE3641_FIFTY_ONE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2661.parsed?.phase3697Marker === "PHASE3697_FIFTY_TWO_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2661.parsed?.phase3754Marker === "PHASE3754_FIFTY_THREE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2661.parsed?.phase3812Marker === "PHASE3812_FIFTY_FOUR_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2661.parsed?.phase3871Marker === "PHASE3871_FIFTY_FIVE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2661.parsed?.phase3931Marker === "PHASE3931_FIFTY_SIX_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2696.parsed?.marker === "PHASE3932_FIFTY_SIX_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase2696.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase2696.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase2696.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2696.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2696.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2696.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2696.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2696.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2696.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2696.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2696.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2696.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2696.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2696.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2696.parsed?.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2696.parsed?.phase2500Marker === "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2696.parsed?.phase2530Marker === "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2696.parsed?.phase2561Marker === "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2696.parsed?.phase2593Marker === "PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2696.parsed?.phase2626Marker === "PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2696.parsed?.phase2660Marker === "PHASE2660_TWENTY_NINE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2696.parsed?.phase2695Marker === "PHASE2695_THIRTY_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2696.parsed?.phase2731Marker === "PHASE2731_THIRTY_ONE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2696.parsed?.phase2768Marker === "PHASE2768_THIRTY_TWO_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase2696.parsed?.phase2805Marker === "PHASE2805_THIRTY_THREE_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase2696.parsed?.phase2843Marker === "PHASE2843_THIRTY_FOUR_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase2696.parsed?.phase2882Marker === "PHASE2882_THIRTY_FIVE_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase2696.parsed?.phase2922Marker === "PHASE2922_THIRTY_SIX_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase2696.parsed?.phase2963Marker === "PHASE2963_THIRTY_SEVEN_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase2696.parsed?.phase3005Marker === "PHASE3005_THIRTY_EIGHT_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase2696.parsed?.phase3048Marker === "PHASE3048_THIRTY_NINE_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase2696.parsed?.phase3092Marker === "PHASE3092_FORTY_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase2696.parsed?.phase3137Marker === "PHASE3137_FORTY_ONE_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase2696.parsed?.phase3183Marker === "PHASE3183_FORTY_TWO_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase2696.parsed?.phase3230Marker === "PHASE3230_FORTY_THREE_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase2696.parsed?.phase3278Marker === "PHASE3278_FORTY_FOUR_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase2696.parsed?.phase3327Marker === "PHASE3327_FORTY_FIVE_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase2696.parsed?.phase3377Marker === "PHASE3377_FORTY_SIX_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase2696.parsed?.phase3428Marker === "PHASE3428_FORTY_SEVEN_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase2696.parsed?.phase3480Marker === "PHASE3480_FORTY_EIGHT_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase2696.parsed?.phase3533Marker === "PHASE3533_FORTY_NINE_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase2696.parsed?.phase3587Marker === "PHASE3587_FIFTY_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase2696.parsed?.phase3642Marker === "PHASE3642_FIFTY_ONE_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase2696.parsed?.phase3698Marker === "PHASE3698_FIFTY_TWO_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase2696.parsed?.phase3755Marker === "PHASE3755_FIFTY_THREE_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase2696.parsed?.phase3813Marker === "PHASE3813_FIFTY_FOUR_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase2696.parsed?.phase3872Marker === "PHASE3872_FIFTY_FIVE_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase2696.parsed?.phase3932Marker === "PHASE3932_FIFTY_SIX_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase2732.parsed?.marker === "PHASE3933_FIFTY_SIX_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase2732.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase2732.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase2732.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2732.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2732.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2732.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2732.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2732.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2732.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2732.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2732.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2732.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2732.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2732.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2732.parsed?.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2732.parsed?.phase2500Marker === "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2732.parsed?.phase2530Marker === "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2732.parsed?.phase2561Marker === "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2732.parsed?.phase2593Marker === "PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2732.parsed?.phase2626Marker === "PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2732.parsed?.phase2660Marker === "PHASE2660_TWENTY_NINE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2732.parsed?.phase2695Marker === "PHASE2695_THIRTY_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2732.parsed?.phase2731Marker === "PHASE2731_THIRTY_ONE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2732.parsed?.phase2768Marker === "PHASE2768_THIRTY_TWO_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase2732.parsed?.phase2806Marker === "PHASE2806_THIRTY_THREE_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase2732.parsed?.phase2844Marker === "PHASE2844_THIRTY_FOUR_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase2732.parsed?.phase2883Marker === "PHASE2883_THIRTY_FIVE_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase2732.parsed?.phase2923Marker === "PHASE2923_THIRTY_SIX_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase2732.parsed?.phase2964Marker === "PHASE2964_THIRTY_SEVEN_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase2732.parsed?.phase3006Marker === "PHASE3006_THIRTY_EIGHT_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase2732.parsed?.phase3049Marker === "PHASE3049_THIRTY_NINE_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase2732.parsed?.phase3093Marker === "PHASE3093_FORTY_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase2732.parsed?.phase3138Marker === "PHASE3138_FORTY_ONE_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase2732.parsed?.phase3184Marker === "PHASE3184_FORTY_TWO_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase2732.parsed?.phase3231Marker === "PHASE3231_FORTY_THREE_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase2732.parsed?.phase3279Marker === "PHASE3279_FORTY_FOUR_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase2732.parsed?.phase3328Marker === "PHASE3328_FORTY_FIVE_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase2732.parsed?.phase3378Marker === "PHASE3378_FORTY_SIX_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase2732.parsed?.phase3429Marker === "PHASE3429_FORTY_SEVEN_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase2732.parsed?.phase3481Marker === "PHASE3481_FORTY_EIGHT_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase2732.parsed?.phase3534Marker === "PHASE3534_FORTY_NINE_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase2732.parsed?.phase3588Marker === "PHASE3588_FIFTY_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase2732.parsed?.phase3643Marker === "PHASE3643_FIFTY_ONE_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase2732.parsed?.phase3699Marker === "PHASE3699_FIFTY_TWO_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase2732.parsed?.phase3756Marker === "PHASE3756_FIFTY_THREE_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase2732.parsed?.phase3814Marker === "PHASE3814_FIFTY_FOUR_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase2732.parsed?.phase3873Marker === "PHASE3873_FIFTY_FIVE_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase2732.parsed?.phase3933Marker === "PHASE3933_FIFTY_SIX_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase2769.parsed?.marker === "PHASE3934_FIFTY_SIX_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase2769.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase2769.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase2769.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2769.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2769.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2769.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2769.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2769.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2769.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2769.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2769.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2769.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2769.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2769.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2769.parsed?.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2769.parsed?.phase2500Marker === "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2769.parsed?.phase2530Marker === "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2769.parsed?.phase2561Marker === "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2769.parsed?.phase2593Marker === "PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2769.parsed?.phase2626Marker === "PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2769.parsed?.phase2660Marker === "PHASE2660_TWENTY_NINE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2769.parsed?.phase2695Marker === "PHASE2695_THIRTY_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2769.parsed?.phase2731Marker === "PHASE2731_THIRTY_ONE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2769.parsed?.phase2768Marker === "PHASE2768_THIRTY_TWO_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase2769.parsed?.phase2806Marker === "PHASE2806_THIRTY_THREE_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase2769.parsed?.phase2845Marker === "PHASE2845_THIRTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase2769.parsed?.phase2884Marker === "PHASE2884_THIRTY_FIVE_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase2769.parsed?.phase2924Marker === "PHASE2924_THIRTY_SIX_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase2769.parsed?.phase2965Marker === "PHASE2965_THIRTY_SEVEN_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase2769.parsed?.phase3007Marker === "PHASE3007_THIRTY_EIGHT_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase2769.parsed?.phase3050Marker === "PHASE3050_THIRTY_NINE_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase2769.parsed?.phase3094Marker === "PHASE3094_FORTY_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase2769.parsed?.phase3139Marker === "PHASE3139_FORTY_ONE_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase2769.parsed?.phase3185Marker === "PHASE3185_FORTY_TWO_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase2769.parsed?.phase3232Marker === "PHASE3232_FORTY_THREE_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase2769.parsed?.phase3280Marker === "PHASE3280_FORTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase2769.parsed?.phase3329Marker === "PHASE3329_FORTY_FIVE_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase2769.parsed?.phase3379Marker === "PHASE3379_FORTY_SIX_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase2769.parsed?.phase3430Marker === "PHASE3430_FORTY_SEVEN_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase2769.parsed?.phase3482Marker === "PHASE3482_FORTY_EIGHT_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase2769.parsed?.phase3535Marker === "PHASE3535_FORTY_NINE_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase2769.parsed?.phase3589Marker === "PHASE3589_FIFTY_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase2769.parsed?.phase3644Marker === "PHASE3644_FIFTY_ONE_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase2769.parsed?.phase3700Marker === "PHASE3700_FIFTY_TWO_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase2769.parsed?.phase3757Marker === "PHASE3757_FIFTY_THREE_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase2769.parsed?.phase3815Marker === "PHASE3815_FIFTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase2769.parsed?.phase3874Marker === "PHASE3874_FIFTY_FIVE_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase2769.parsed?.phase3934Marker === "PHASE3934_FIFTY_SIX_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase2807.parsed?.marker === "PHASE3935_FIFTY_SIX_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase2807.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase2807.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase2807.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2807.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2807.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2807.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2807.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2807.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2807.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2807.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2807.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2807.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2807.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2807.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2807.parsed?.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2807.parsed?.phase2500Marker === "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2807.parsed?.phase2530Marker === "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2807.parsed?.phase2561Marker === "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2807.parsed?.phase2593Marker === "PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2807.parsed?.phase2626Marker === "PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2807.parsed?.phase2660Marker === "PHASE2660_TWENTY_NINE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2807.parsed?.phase2695Marker === "PHASE2695_THIRTY_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2807.parsed?.phase2731Marker === "PHASE2731_THIRTY_ONE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2807.parsed?.phase2768Marker === "PHASE2768_THIRTY_TWO_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase2807.parsed?.phase2806Marker === "PHASE2806_THIRTY_THREE_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase2807.parsed?.phase2845Marker === "PHASE2845_THIRTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase2807.parsed?.phase2885Marker === "PHASE2885_THIRTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase2807.parsed?.phase2925Marker === "PHASE2925_THIRTY_SIX_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase2807.parsed?.phase2966Marker === "PHASE2966_THIRTY_SEVEN_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase2807.parsed?.phase3008Marker === "PHASE3008_THIRTY_EIGHT_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase2807.parsed?.phase3051Marker === "PHASE3051_THIRTY_NINE_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase2807.parsed?.phase3095Marker === "PHASE3095_FORTY_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase2807.parsed?.phase3140Marker === "PHASE3140_FORTY_ONE_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase2807.parsed?.phase3186Marker === "PHASE3186_FORTY_TWO_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase2807.parsed?.phase3233Marker === "PHASE3233_FORTY_THREE_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase2807.parsed?.phase3281Marker === "PHASE3281_FORTY_FOUR_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase2807.parsed?.phase3330Marker === "PHASE3330_FORTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase2807.parsed?.phase3380Marker === "PHASE3380_FORTY_SIX_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase2807.parsed?.phase3431Marker === "PHASE3431_FORTY_SEVEN_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase2807.parsed?.phase3483Marker === "PHASE3483_FORTY_EIGHT_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase2807.parsed?.phase3536Marker === "PHASE3536_FORTY_NINE_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase2807.parsed?.phase3590Marker === "PHASE3590_FIFTY_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase2807.parsed?.phase3645Marker === "PHASE3645_FIFTY_ONE_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase2807.parsed?.phase3701Marker === "PHASE3701_FIFTY_TWO_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase2807.parsed?.phase3758Marker === "PHASE3758_FIFTY_THREE_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase2807.parsed?.phase3816Marker === "PHASE3816_FIFTY_FOUR_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase2807.parsed?.phase3875Marker === "PHASE3875_FIFTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase2807.parsed?.phase3935Marker === "PHASE3935_FIFTY_SIX_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase2846.parsed?.marker === "PHASE3936_FIFTY_SIX_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase2846.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase2846.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase2846.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2846.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2846.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2846.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2846.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2846.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2846.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2846.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2846.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2846.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2846.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2846.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2846.parsed?.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2846.parsed?.phase2500Marker === "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2846.parsed?.phase2530Marker === "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2846.parsed?.phase2561Marker === "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2846.parsed?.phase2593Marker === "PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2846.parsed?.phase2626Marker === "PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2846.parsed?.phase2660Marker === "PHASE2660_TWENTY_NINE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2846.parsed?.phase2695Marker === "PHASE2695_THIRTY_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2846.parsed?.phase2731Marker === "PHASE2731_THIRTY_ONE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2846.parsed?.phase2768Marker === "PHASE2768_THIRTY_TWO_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase2846.parsed?.phase2806Marker === "PHASE2806_THIRTY_THREE_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase2846.parsed?.phase2845Marker === "PHASE2845_THIRTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase2846.parsed?.phase2885Marker === "PHASE2885_THIRTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase2846.parsed?.phase2926Marker === "PHASE2926_THIRTY_SIX_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase2846.parsed?.phase2967Marker === "PHASE2967_THIRTY_SEVEN_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase2846.parsed?.phase3009Marker === "PHASE3009_THIRTY_EIGHT_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase2846.parsed?.phase3052Marker === "PHASE3052_THIRTY_NINE_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase2846.parsed?.phase3096Marker === "PHASE3096_FORTY_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase2846.parsed?.phase3141Marker === "PHASE3141_FORTY_ONE_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase2846.parsed?.phase3187Marker === "PHASE3187_FORTY_TWO_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase2846.parsed?.phase3234Marker === "PHASE3234_FORTY_THREE_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase2846.parsed?.phase3282Marker === "PHASE3282_FORTY_FOUR_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase2846.parsed?.phase3331Marker === "PHASE3331_FORTY_FIVE_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase2846.parsed?.phase3381Marker === "PHASE3381_FORTY_SIX_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase2846.parsed?.phase3432Marker === "PHASE3432_FORTY_SEVEN_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase2846.parsed?.phase3484Marker === "PHASE3484_FORTY_EIGHT_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase2846.parsed?.phase3537Marker === "PHASE3537_FORTY_NINE_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase2846.parsed?.phase3591Marker === "PHASE3591_FIFTY_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase2846.parsed?.phase3646Marker === "PHASE3646_FIFTY_ONE_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase2846.parsed?.phase3702Marker === "PHASE3702_FIFTY_TWO_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase2846.parsed?.phase3759Marker === "PHASE3759_FIFTY_THREE_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase2846.parsed?.phase3817Marker === "PHASE3817_FIFTY_FOUR_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase2846.parsed?.phase3876Marker === "PHASE3876_FIFTY_FIVE_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase2846.parsed?.phase3936Marker === "PHASE3936_FIFTY_SIX_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase2886.parsed?.marker === "PHASE3937_FIFTY_SIX_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase2886.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase2886.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase2886.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2886.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2886.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2886.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2886.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2886.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2886.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2886.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2886.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2886.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2886.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2886.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2886.parsed?.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2886.parsed?.phase2500Marker === "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2886.parsed?.phase2530Marker === "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2886.parsed?.phase2561Marker === "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2886.parsed?.phase2593Marker === "PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2886.parsed?.phase2626Marker === "PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2886.parsed?.phase2660Marker === "PHASE2660_TWENTY_NINE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2886.parsed?.phase2695Marker === "PHASE2695_THIRTY_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2886.parsed?.phase2731Marker === "PHASE2731_THIRTY_ONE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2886.parsed?.phase2768Marker === "PHASE2768_THIRTY_TWO_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase2886.parsed?.phase2806Marker === "PHASE2806_THIRTY_THREE_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase2886.parsed?.phase2845Marker === "PHASE2845_THIRTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase2886.parsed?.phase2885Marker === "PHASE2885_THIRTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase2886.parsed?.phase2926Marker === "PHASE2926_THIRTY_SIX_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase2886.parsed?.phase2968Marker === "PHASE2968_THIRTY_SEVEN_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase2886.parsed?.phase3010Marker === "PHASE3010_THIRTY_EIGHT_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase2886.parsed?.phase3053Marker === "PHASE3053_THIRTY_NINE_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase2886.parsed?.phase3097Marker === "PHASE3097_FORTY_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase2886.parsed?.phase3142Marker === "PHASE3142_FORTY_ONE_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase2886.parsed?.phase3188Marker === "PHASE3188_FORTY_TWO_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase2886.parsed?.phase3235Marker === "PHASE3235_FORTY_THREE_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase2886.parsed?.phase3283Marker === "PHASE3283_FORTY_FOUR_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase2886.parsed?.phase3332Marker === "PHASE3332_FORTY_FIVE_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase2886.parsed?.phase3382Marker === "PHASE3382_FORTY_SIX_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase2886.parsed?.phase3433Marker === "PHASE3433_FORTY_SEVEN_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase2886.parsed?.phase3485Marker === "PHASE3485_FORTY_EIGHT_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase2886.parsed?.phase3538Marker === "PHASE3538_FORTY_NINE_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase2886.parsed?.phase3592Marker === "PHASE3592_FIFTY_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase2886.parsed?.phase3647Marker === "PHASE3647_FIFTY_ONE_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase2886.parsed?.phase3703Marker === "PHASE3703_FIFTY_TWO_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase2886.parsed?.phase3760Marker === "PHASE3760_FIFTY_THREE_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase2886.parsed?.phase3818Marker === "PHASE3818_FIFTY_FOUR_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase2886.parsed?.phase3877Marker === "PHASE3877_FIFTY_FIVE_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase2886.parsed?.phase3937Marker === "PHASE3937_FIFTY_SIX_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase2927.parsed?.marker === "PHASE3938_FIFTY_SIX_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase2927.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase2927.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase2927.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2927.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2927.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2927.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2927.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2927.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2927.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2927.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2927.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2927.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2927.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2927.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2927.parsed?.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2927.parsed?.phase2500Marker === "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2927.parsed?.phase2530Marker === "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2927.parsed?.phase2561Marker === "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2927.parsed?.phase2593Marker === "PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2927.parsed?.phase2626Marker === "PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2927.parsed?.phase2660Marker === "PHASE2660_TWENTY_NINE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2927.parsed?.phase2695Marker === "PHASE2695_THIRTY_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2927.parsed?.phase2731Marker === "PHASE2731_THIRTY_ONE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2927.parsed?.phase2768Marker === "PHASE2768_THIRTY_TWO_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase2927.parsed?.phase2806Marker === "PHASE2806_THIRTY_THREE_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase2927.parsed?.phase2845Marker === "PHASE2845_THIRTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase2927.parsed?.phase2885Marker === "PHASE2885_THIRTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase2927.parsed?.phase2926Marker === "PHASE2926_THIRTY_SIX_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase2927.parsed?.phase2968Marker === "PHASE2968_THIRTY_SEVEN_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase2927.parsed?.phase3011Marker === "PHASE3011_THIRTY_EIGHT_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase2927.parsed?.phase3054Marker === "PHASE3054_THIRTY_NINE_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase2927.parsed?.phase3098Marker === "PHASE3098_FORTY_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase2927.parsed?.phase3143Marker === "PHASE3143_FORTY_ONE_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase2927.parsed?.phase3189Marker === "PHASE3189_FORTY_TWO_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase2927.parsed?.phase3236Marker === "PHASE3236_FORTY_THREE_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase2927.parsed?.phase3284Marker === "PHASE3284_FORTY_FOUR_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase2927.parsed?.phase3333Marker === "PHASE3333_FORTY_FIVE_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase2927.parsed?.phase3383Marker === "PHASE3383_FORTY_SIX_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase2927.parsed?.phase3434Marker === "PHASE3434_FORTY_SEVEN_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase2927.parsed?.phase3486Marker === "PHASE3486_FORTY_EIGHT_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase2927.parsed?.phase3539Marker === "PHASE3539_FORTY_NINE_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase2927.parsed?.phase3593Marker === "PHASE3593_FIFTY_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase2927.parsed?.phase3648Marker === "PHASE3648_FIFTY_ONE_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase2927.parsed?.phase3704Marker === "PHASE3704_FIFTY_TWO_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase2927.parsed?.phase3761Marker === "PHASE3761_FIFTY_THREE_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase2927.parsed?.phase3819Marker === "PHASE3819_FIFTY_FOUR_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase2927.parsed?.phase3878Marker === "PHASE3878_FIFTY_FIVE_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase2927.parsed?.phase3938Marker === "PHASE3938_FIFTY_SIX_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase2969.parsed?.marker === "PHASE3939_FIFTY_SIX_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase2969.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase2969.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase2969.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase2969.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase2969.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase2969.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase2969.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase2969.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase2969.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase2969.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase2969.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase2969.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase2969.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase2969.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase2969.parsed?.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase2969.parsed?.phase2500Marker === "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase2969.parsed?.phase2530Marker === "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase2969.parsed?.phase2561Marker === "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase2969.parsed?.phase2593Marker === "PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase2969.parsed?.phase2626Marker === "PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase2969.parsed?.phase2660Marker === "PHASE2660_TWENTY_NINE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase2969.parsed?.phase2695Marker === "PHASE2695_THIRTY_TOOL_TARGET_THIRTY_OK" &&
      smokePhase2969.parsed?.phase2731Marker === "PHASE2731_THIRTY_ONE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase2969.parsed?.phase2768Marker === "PHASE2768_THIRTY_TWO_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase2969.parsed?.phase2806Marker === "PHASE2806_THIRTY_THREE_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase2969.parsed?.phase2845Marker === "PHASE2845_THIRTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase2969.parsed?.phase2885Marker === "PHASE2885_THIRTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase2969.parsed?.phase2926Marker === "PHASE2926_THIRTY_SIX_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase2969.parsed?.phase2968Marker === "PHASE2968_THIRTY_SEVEN_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase2969.parsed?.phase3011Marker === "PHASE3011_THIRTY_EIGHT_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase2969.parsed?.phase3055Marker === "PHASE3055_THIRTY_NINE_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase2969.parsed?.phase3099Marker === "PHASE3099_FORTY_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase2969.parsed?.phase3144Marker === "PHASE3144_FORTY_ONE_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase2969.parsed?.phase3190Marker === "PHASE3190_FORTY_TWO_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase2969.parsed?.phase3237Marker === "PHASE3237_FORTY_THREE_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase2969.parsed?.phase3285Marker === "PHASE3285_FORTY_FOUR_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase2969.parsed?.phase3334Marker === "PHASE3334_FORTY_FIVE_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase2969.parsed?.phase3384Marker === "PHASE3384_FORTY_SIX_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase2969.parsed?.phase3435Marker === "PHASE3435_FORTY_SEVEN_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase2969.parsed?.phase3487Marker === "PHASE3487_FORTY_EIGHT_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase2969.parsed?.phase3540Marker === "PHASE3540_FORTY_NINE_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase2969.parsed?.phase3594Marker === "PHASE3594_FIFTY_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase2969.parsed?.phase3649Marker === "PHASE3649_FIFTY_ONE_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase2969.parsed?.phase3705Marker === "PHASE3705_FIFTY_TWO_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase2969.parsed?.phase3762Marker === "PHASE3762_FIFTY_THREE_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase2969.parsed?.phase3820Marker === "PHASE3820_FIFTY_FOUR_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase2969.parsed?.phase3879Marker === "PHASE3879_FIFTY_FIVE_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase2969.parsed?.phase3939Marker === "PHASE3939_FIFTY_SIX_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase3012.parsed?.marker === "PHASE3940_FIFTY_SIX_TOOL_TARGET_FORTY_OK" &&
      smokePhase3012.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase3012.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase3012.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase3012.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase3012.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase3012.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase3012.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase3012.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase3012.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase3012.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase3012.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase3012.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase3012.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase3012.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase3012.parsed?.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase3012.parsed?.phase2500Marker === "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase3012.parsed?.phase2530Marker === "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase3012.parsed?.phase2561Marker === "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase3012.parsed?.phase2593Marker === "PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase3012.parsed?.phase2626Marker === "PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase3012.parsed?.phase2660Marker === "PHASE2660_TWENTY_NINE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase3012.parsed?.phase2695Marker === "PHASE2695_THIRTY_TOOL_TARGET_THIRTY_OK" &&
      smokePhase3012.parsed?.phase2731Marker === "PHASE2731_THIRTY_ONE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase3012.parsed?.phase2768Marker === "PHASE2768_THIRTY_TWO_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase3012.parsed?.phase2806Marker === "PHASE2806_THIRTY_THREE_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase3012.parsed?.phase2845Marker === "PHASE2845_THIRTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase3012.parsed?.phase2885Marker === "PHASE2885_THIRTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase3012.parsed?.phase2926Marker === "PHASE2926_THIRTY_SIX_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase3012.parsed?.phase2968Marker === "PHASE2968_THIRTY_SEVEN_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase3012.parsed?.phase3011Marker === "PHASE3011_THIRTY_EIGHT_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase3012.parsed?.phase3055Marker === "PHASE3055_THIRTY_NINE_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase3012.parsed?.phase3100Marker === "PHASE3100_FORTY_TOOL_TARGET_FORTY_OK" &&
      smokePhase3012.parsed?.phase3145Marker === "PHASE3145_FORTY_ONE_TOOL_TARGET_FORTY_OK" &&
      smokePhase3012.parsed?.phase3191Marker === "PHASE3191_FORTY_TWO_TOOL_TARGET_FORTY_OK" &&
      smokePhase3012.parsed?.phase3238Marker === "PHASE3238_FORTY_THREE_TOOL_TARGET_FORTY_OK" &&
      smokePhase3012.parsed?.phase3286Marker === "PHASE3286_FORTY_FOUR_TOOL_TARGET_FORTY_OK" &&
      smokePhase3012.parsed?.phase3335Marker === "PHASE3335_FORTY_FIVE_TOOL_TARGET_FORTY_OK" &&
      smokePhase3012.parsed?.phase3385Marker === "PHASE3385_FORTY_SIX_TOOL_TARGET_FORTY_OK" &&
      smokePhase3012.parsed?.phase3436Marker === "PHASE3436_FORTY_SEVEN_TOOL_TARGET_FORTY_OK" &&
      smokePhase3012.parsed?.phase3488Marker === "PHASE3488_FORTY_EIGHT_TOOL_TARGET_FORTY_OK" &&
      smokePhase3012.parsed?.phase3541Marker === "PHASE3541_FORTY_NINE_TOOL_TARGET_FORTY_OK" &&
      smokePhase3012.parsed?.phase3595Marker === "PHASE3595_FIFTY_TOOL_TARGET_FORTY_OK" &&
      smokePhase3012.parsed?.phase3650Marker === "PHASE3650_FIFTY_ONE_TOOL_TARGET_FORTY_OK" &&
      smokePhase3012.parsed?.phase3706Marker === "PHASE3706_FIFTY_TWO_TOOL_TARGET_FORTY_OK" &&
      smokePhase3012.parsed?.phase3763Marker === "PHASE3763_FIFTY_THREE_TOOL_TARGET_FORTY_OK" &&
      smokePhase3012.parsed?.phase3821Marker === "PHASE3821_FIFTY_FOUR_TOOL_TARGET_FORTY_OK" &&
      smokePhase3012.parsed?.phase3880Marker === "PHASE3880_FIFTY_FIVE_TOOL_TARGET_FORTY_OK" &&
      smokePhase3012.parsed?.phase3940Marker === "PHASE3940_FIFTY_SIX_TOOL_TARGET_FORTY_OK" &&
      smokePhase3056.parsed?.marker === "PHASE3941_FIFTY_SIX_TOOL_TARGET_FORTY_ONE_OK" &&
      smokePhase3056.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase3056.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase3056.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase3056.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase3056.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase3056.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase3056.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase3056.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase3056.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase3056.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase3056.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase3056.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase3056.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase3056.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase3056.parsed?.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase3056.parsed?.phase2500Marker === "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase3056.parsed?.phase2530Marker === "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase3056.parsed?.phase2561Marker === "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase3056.parsed?.phase2593Marker === "PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase3056.parsed?.phase2626Marker === "PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase3056.parsed?.phase2660Marker === "PHASE2660_TWENTY_NINE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase3056.parsed?.phase2695Marker === "PHASE2695_THIRTY_TOOL_TARGET_THIRTY_OK" &&
      smokePhase3056.parsed?.phase2731Marker === "PHASE2731_THIRTY_ONE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase3056.parsed?.phase2768Marker === "PHASE2768_THIRTY_TWO_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase3056.parsed?.phase2806Marker === "PHASE2806_THIRTY_THREE_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase3056.parsed?.phase2845Marker === "PHASE2845_THIRTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase3056.parsed?.phase2885Marker === "PHASE2885_THIRTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase3056.parsed?.phase2926Marker === "PHASE2926_THIRTY_SIX_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase3056.parsed?.phase2968Marker === "PHASE2968_THIRTY_SEVEN_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase3056.parsed?.phase3011Marker === "PHASE3011_THIRTY_EIGHT_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase3056.parsed?.phase3055Marker === "PHASE3055_THIRTY_NINE_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase3056.parsed?.phase3100Marker === "PHASE3100_FORTY_TOOL_TARGET_FORTY_OK" &&
      smokePhase3056.parsed?.phase3146Marker === "PHASE3146_FORTY_ONE_TOOL_TARGET_FORTY_ONE_OK" &&
      smokePhase3056.parsed?.phase3192Marker === "PHASE3192_FORTY_TWO_TOOL_TARGET_FORTY_ONE_OK" &&
      smokePhase3056.parsed?.phase3239Marker === "PHASE3239_FORTY_THREE_TOOL_TARGET_FORTY_ONE_OK" &&
      smokePhase3056.parsed?.phase3287Marker === "PHASE3287_FORTY_FOUR_TOOL_TARGET_FORTY_ONE_OK" &&
      smokePhase3056.parsed?.phase3336Marker === "PHASE3336_FORTY_FIVE_TOOL_TARGET_FORTY_ONE_OK" &&
      smokePhase3056.parsed?.phase3386Marker === "PHASE3386_FORTY_SIX_TOOL_TARGET_FORTY_ONE_OK" &&
      smokePhase3056.parsed?.phase3437Marker === "PHASE3437_FORTY_SEVEN_TOOL_TARGET_FORTY_ONE_OK" &&
      smokePhase3056.parsed?.phase3489Marker === "PHASE3489_FORTY_EIGHT_TOOL_TARGET_FORTY_ONE_OK" &&
      smokePhase3056.parsed?.phase3542Marker === "PHASE3542_FORTY_NINE_TOOL_TARGET_FORTY_ONE_OK" &&
      smokePhase3056.parsed?.phase3596Marker === "PHASE3596_FIFTY_TOOL_TARGET_FORTY_ONE_OK" &&
      smokePhase3056.parsed?.phase3651Marker === "PHASE3651_FIFTY_ONE_TOOL_TARGET_FORTY_ONE_OK" &&
      smokePhase3056.parsed?.phase3707Marker === "PHASE3707_FIFTY_TWO_TOOL_TARGET_FORTY_ONE_OK" &&
      smokePhase3056.parsed?.phase3764Marker === "PHASE3764_FIFTY_THREE_TOOL_TARGET_FORTY_ONE_OK" &&
      smokePhase3056.parsed?.phase3822Marker === "PHASE3822_FIFTY_FOUR_TOOL_TARGET_FORTY_ONE_OK" &&
      smokePhase3056.parsed?.phase3881Marker === "PHASE3881_FIFTY_FIVE_TOOL_TARGET_FORTY_ONE_OK" &&
      smokePhase3056.parsed?.phase3941Marker === "PHASE3941_FIFTY_SIX_TOOL_TARGET_FORTY_ONE_OK" &&
      smokePhase3101.parsed?.marker === "PHASE3942_FIFTY_SIX_TOOL_TARGET_FORTY_TWO_OK" &&
      smokePhase3101.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase3101.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase3101.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase3101.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase3101.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase3101.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase3101.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase3101.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase3101.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase3101.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase3101.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase3101.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase3101.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase3101.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase3101.parsed?.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase3101.parsed?.phase2500Marker === "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase3101.parsed?.phase2530Marker === "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase3101.parsed?.phase2561Marker === "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase3101.parsed?.phase2593Marker === "PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase3101.parsed?.phase2626Marker === "PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase3101.parsed?.phase2660Marker === "PHASE2660_TWENTY_NINE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase3101.parsed?.phase2695Marker === "PHASE2695_THIRTY_TOOL_TARGET_THIRTY_OK" &&
      smokePhase3101.parsed?.phase2731Marker === "PHASE2731_THIRTY_ONE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase3101.parsed?.phase2768Marker === "PHASE2768_THIRTY_TWO_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase3101.parsed?.phase2806Marker === "PHASE2806_THIRTY_THREE_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase3101.parsed?.phase2845Marker === "PHASE2845_THIRTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase3101.parsed?.phase2885Marker === "PHASE2885_THIRTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase3101.parsed?.phase2926Marker === "PHASE2926_THIRTY_SIX_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase3101.parsed?.phase2968Marker === "PHASE2968_THIRTY_SEVEN_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase3101.parsed?.phase3011Marker === "PHASE3011_THIRTY_EIGHT_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase3101.parsed?.phase3055Marker === "PHASE3055_THIRTY_NINE_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase3101.parsed?.phase3100Marker === "PHASE3100_FORTY_TOOL_TARGET_FORTY_OK" &&
      smokePhase3101.parsed?.phase3146Marker === "PHASE3146_FORTY_ONE_TOOL_TARGET_FORTY_ONE_OK" &&
      smokePhase3101.parsed?.phase3193Marker === "PHASE3193_FORTY_TWO_TOOL_TARGET_FORTY_TWO_OK" &&
      smokePhase3101.parsed?.phase3240Marker === "PHASE3240_FORTY_THREE_TOOL_TARGET_FORTY_TWO_OK" &&
      smokePhase3101.parsed?.phase3288Marker === "PHASE3288_FORTY_FOUR_TOOL_TARGET_FORTY_TWO_OK" &&
      smokePhase3101.parsed?.phase3337Marker === "PHASE3337_FORTY_FIVE_TOOL_TARGET_FORTY_TWO_OK" &&
      smokePhase3101.parsed?.phase3387Marker === "PHASE3387_FORTY_SIX_TOOL_TARGET_FORTY_TWO_OK" &&
      smokePhase3101.parsed?.phase3438Marker === "PHASE3438_FORTY_SEVEN_TOOL_TARGET_FORTY_TWO_OK" &&
      smokePhase3101.parsed?.phase3490Marker === "PHASE3490_FORTY_EIGHT_TOOL_TARGET_FORTY_TWO_OK" &&
      smokePhase3101.parsed?.phase3543Marker === "PHASE3543_FORTY_NINE_TOOL_TARGET_FORTY_TWO_OK" &&
      smokePhase3101.parsed?.phase3597Marker === "PHASE3597_FIFTY_TOOL_TARGET_FORTY_TWO_OK" &&
      smokePhase3101.parsed?.phase3652Marker === "PHASE3652_FIFTY_ONE_TOOL_TARGET_FORTY_TWO_OK" &&
      smokePhase3101.parsed?.phase3708Marker === "PHASE3708_FIFTY_TWO_TOOL_TARGET_FORTY_TWO_OK" &&
      smokePhase3101.parsed?.phase3765Marker === "PHASE3765_FIFTY_THREE_TOOL_TARGET_FORTY_TWO_OK" &&
      smokePhase3101.parsed?.phase3823Marker === "PHASE3823_FIFTY_FOUR_TOOL_TARGET_FORTY_TWO_OK" &&
      smokePhase3101.parsed?.phase3882Marker === "PHASE3882_FIFTY_FIVE_TOOL_TARGET_FORTY_TWO_OK" &&
      smokePhase3101.parsed?.phase3942Marker === "PHASE3942_FIFTY_SIX_TOOL_TARGET_FORTY_TWO_OK" &&
      smokePhase3147.parsed?.marker === "PHASE3943_FIFTY_SIX_TOOL_TARGET_FORTY_THREE_OK" &&
      smokePhase3147.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase3147.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase3147.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase3147.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase3147.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase3147.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase3147.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase3147.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase3147.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase3147.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase3147.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase3147.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase3147.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase3147.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase3147.parsed?.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase3147.parsed?.phase2500Marker === "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase3147.parsed?.phase2530Marker === "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase3147.parsed?.phase2561Marker === "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase3147.parsed?.phase2593Marker === "PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase3147.parsed?.phase2626Marker === "PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase3147.parsed?.phase2660Marker === "PHASE2660_TWENTY_NINE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase3147.parsed?.phase2695Marker === "PHASE2695_THIRTY_TOOL_TARGET_THIRTY_OK" &&
      smokePhase3147.parsed?.phase2731Marker === "PHASE2731_THIRTY_ONE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase3147.parsed?.phase2768Marker === "PHASE2768_THIRTY_TWO_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase3147.parsed?.phase2806Marker === "PHASE2806_THIRTY_THREE_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase3147.parsed?.phase2845Marker === "PHASE2845_THIRTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase3147.parsed?.phase2885Marker === "PHASE2885_THIRTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase3147.parsed?.phase2926Marker === "PHASE2926_THIRTY_SIX_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase3147.parsed?.phase2968Marker === "PHASE2968_THIRTY_SEVEN_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase3147.parsed?.phase3011Marker === "PHASE3011_THIRTY_EIGHT_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase3147.parsed?.phase3055Marker === "PHASE3055_THIRTY_NINE_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase3147.parsed?.phase3100Marker === "PHASE3100_FORTY_TOOL_TARGET_FORTY_OK" &&
      smokePhase3147.parsed?.phase3146Marker === "PHASE3146_FORTY_ONE_TOOL_TARGET_FORTY_ONE_OK" &&
      smokePhase3147.parsed?.phase3193Marker === "PHASE3193_FORTY_TWO_TOOL_TARGET_FORTY_TWO_OK" &&
      smokePhase3147.parsed?.phase3241Marker === "PHASE3241_FORTY_THREE_TOOL_TARGET_FORTY_THREE_OK" &&
      smokePhase3147.parsed?.phase3289Marker === "PHASE3289_FORTY_FOUR_TOOL_TARGET_FORTY_THREE_OK" &&
      smokePhase3147.parsed?.phase3338Marker === "PHASE3338_FORTY_FIVE_TOOL_TARGET_FORTY_THREE_OK" &&
      smokePhase3147.parsed?.phase3388Marker === "PHASE3388_FORTY_SIX_TOOL_TARGET_FORTY_THREE_OK" &&
      smokePhase3147.parsed?.phase3439Marker === "PHASE3439_FORTY_SEVEN_TOOL_TARGET_FORTY_THREE_OK" &&
      smokePhase3147.parsed?.phase3491Marker === "PHASE3491_FORTY_EIGHT_TOOL_TARGET_FORTY_THREE_OK" &&
      smokePhase3147.parsed?.phase3544Marker === "PHASE3544_FORTY_NINE_TOOL_TARGET_FORTY_THREE_OK" &&
      smokePhase3147.parsed?.phase3598Marker === "PHASE3598_FIFTY_TOOL_TARGET_FORTY_THREE_OK" &&
      smokePhase3147.parsed?.phase3653Marker === "PHASE3653_FIFTY_ONE_TOOL_TARGET_FORTY_THREE_OK" &&
      smokePhase3147.parsed?.phase3709Marker === "PHASE3709_FIFTY_TWO_TOOL_TARGET_FORTY_THREE_OK" &&
      smokePhase3147.parsed?.phase3766Marker === "PHASE3766_FIFTY_THREE_TOOL_TARGET_FORTY_THREE_OK" &&
      smokePhase3147.parsed?.phase3824Marker === "PHASE3824_FIFTY_FOUR_TOOL_TARGET_FORTY_THREE_OK" &&
      smokePhase3147.parsed?.phase3883Marker === "PHASE3883_FIFTY_FIVE_TOOL_TARGET_FORTY_THREE_OK" &&
      smokePhase3147.parsed?.phase3943Marker === "PHASE3943_FIFTY_SIX_TOOL_TARGET_FORTY_THREE_OK" &&
      smokePhase3194.parsed?.marker === "PHASE3944_FIFTY_SIX_TOOL_TARGET_FORTY_FOUR_OK" &&
      smokePhase3194.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase3194.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase3194.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase3194.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase3194.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase3194.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase3194.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase3194.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase3194.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase3194.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase3194.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase3194.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase3194.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase3194.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase3194.parsed?.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase3194.parsed?.phase2500Marker === "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase3194.parsed?.phase2530Marker === "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase3194.parsed?.phase2561Marker === "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase3194.parsed?.phase2593Marker === "PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase3194.parsed?.phase2626Marker === "PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase3194.parsed?.phase2660Marker === "PHASE2660_TWENTY_NINE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase3194.parsed?.phase2695Marker === "PHASE2695_THIRTY_TOOL_TARGET_THIRTY_OK" &&
      smokePhase3194.parsed?.phase2731Marker === "PHASE2731_THIRTY_ONE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase3194.parsed?.phase2768Marker === "PHASE2768_THIRTY_TWO_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase3194.parsed?.phase2806Marker === "PHASE2806_THIRTY_THREE_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase3194.parsed?.phase2845Marker === "PHASE2845_THIRTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase3194.parsed?.phase2885Marker === "PHASE2885_THIRTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase3194.parsed?.phase2926Marker === "PHASE2926_THIRTY_SIX_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase3194.parsed?.phase2968Marker === "PHASE2968_THIRTY_SEVEN_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase3194.parsed?.phase3011Marker === "PHASE3011_THIRTY_EIGHT_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase3194.parsed?.phase3055Marker === "PHASE3055_THIRTY_NINE_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase3194.parsed?.phase3100Marker === "PHASE3100_FORTY_TOOL_TARGET_FORTY_OK" &&
      smokePhase3194.parsed?.phase3146Marker === "PHASE3146_FORTY_ONE_TOOL_TARGET_FORTY_ONE_OK" &&
      smokePhase3194.parsed?.phase3193Marker === "PHASE3193_FORTY_TWO_TOOL_TARGET_FORTY_TWO_OK" &&
      smokePhase3194.parsed?.phase3241Marker === "PHASE3241_FORTY_THREE_TOOL_TARGET_FORTY_THREE_OK" &&
      smokePhase3194.parsed?.phase3290Marker === "PHASE3290_FORTY_FOUR_TOOL_TARGET_FORTY_FOUR_OK" &&
      smokePhase3194.parsed?.phase3339Marker === "PHASE3339_FORTY_FIVE_TOOL_TARGET_FORTY_FOUR_OK" &&
      smokePhase3194.parsed?.phase3389Marker === "PHASE3389_FORTY_SIX_TOOL_TARGET_FORTY_FOUR_OK" &&
      smokePhase3194.parsed?.phase3440Marker === "PHASE3440_FORTY_SEVEN_TOOL_TARGET_FORTY_FOUR_OK" &&
      smokePhase3194.parsed?.phase3492Marker === "PHASE3492_FORTY_EIGHT_TOOL_TARGET_FORTY_FOUR_OK" &&
      smokePhase3194.parsed?.phase3545Marker === "PHASE3545_FORTY_NINE_TOOL_TARGET_FORTY_FOUR_OK" &&
      smokePhase3194.parsed?.phase3599Marker === "PHASE3599_FIFTY_TOOL_TARGET_FORTY_FOUR_OK" &&
      smokePhase3194.parsed?.phase3654Marker === "PHASE3654_FIFTY_ONE_TOOL_TARGET_FORTY_FOUR_OK" &&
      smokePhase3194.parsed?.phase3710Marker === "PHASE3710_FIFTY_TWO_TOOL_TARGET_FORTY_FOUR_OK" &&
      smokePhase3194.parsed?.phase3767Marker === "PHASE3767_FIFTY_THREE_TOOL_TARGET_FORTY_FOUR_OK" &&
      smokePhase3194.parsed?.phase3825Marker === "PHASE3825_FIFTY_FOUR_TOOL_TARGET_FORTY_FOUR_OK" &&
      smokePhase3194.parsed?.phase3884Marker === "PHASE3884_FIFTY_FIVE_TOOL_TARGET_FORTY_FOUR_OK" &&
      smokePhase3194.parsed?.phase3944Marker === "PHASE3944_FIFTY_SIX_TOOL_TARGET_FORTY_FOUR_OK" &&
      smokePhase3242.parsed?.marker === "PHASE3945_FIFTY_SIX_TOOL_TARGET_FORTY_FIVE_OK" &&
      smokePhase3242.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase3242.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase3242.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase3242.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase3242.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase3242.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase3242.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase3242.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase3242.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase3242.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase3242.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase3242.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase3242.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase3242.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase3242.parsed?.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase3242.parsed?.phase2500Marker === "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase3242.parsed?.phase2530Marker === "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase3242.parsed?.phase2561Marker === "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase3242.parsed?.phase2593Marker === "PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase3242.parsed?.phase2626Marker === "PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase3242.parsed?.phase2660Marker === "PHASE2660_TWENTY_NINE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase3242.parsed?.phase2695Marker === "PHASE2695_THIRTY_TOOL_TARGET_THIRTY_OK" &&
      smokePhase3242.parsed?.phase2731Marker === "PHASE2731_THIRTY_ONE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase3242.parsed?.phase2768Marker === "PHASE2768_THIRTY_TWO_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase3242.parsed?.phase2806Marker === "PHASE2806_THIRTY_THREE_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase3242.parsed?.phase2845Marker === "PHASE2845_THIRTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase3242.parsed?.phase2885Marker === "PHASE2885_THIRTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase3242.parsed?.phase2926Marker === "PHASE2926_THIRTY_SIX_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase3242.parsed?.phase2968Marker === "PHASE2968_THIRTY_SEVEN_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase3242.parsed?.phase3011Marker === "PHASE3011_THIRTY_EIGHT_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase3242.parsed?.phase3055Marker === "PHASE3055_THIRTY_NINE_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase3242.parsed?.phase3100Marker === "PHASE3100_FORTY_TOOL_TARGET_FORTY_OK" &&
      smokePhase3242.parsed?.phase3146Marker === "PHASE3146_FORTY_ONE_TOOL_TARGET_FORTY_ONE_OK" &&
      smokePhase3242.parsed?.phase3193Marker === "PHASE3193_FORTY_TWO_TOOL_TARGET_FORTY_TWO_OK" &&
      smokePhase3242.parsed?.phase3241Marker === "PHASE3241_FORTY_THREE_TOOL_TARGET_FORTY_THREE_OK" &&
      smokePhase3242.parsed?.phase3290Marker === "PHASE3290_FORTY_FOUR_TOOL_TARGET_FORTY_FOUR_OK" &&
      smokePhase3242.parsed?.phase3340Marker === "PHASE3340_FORTY_FIVE_TOOL_TARGET_FORTY_FIVE_OK" &&
      smokePhase3242.parsed?.phase3390Marker === "PHASE3390_FORTY_SIX_TOOL_TARGET_FORTY_FIVE_OK" &&
      smokePhase3242.parsed?.phase3441Marker === "PHASE3441_FORTY_SEVEN_TOOL_TARGET_FORTY_FIVE_OK" &&
      smokePhase3242.parsed?.phase3493Marker === "PHASE3493_FORTY_EIGHT_TOOL_TARGET_FORTY_FIVE_OK" &&
      smokePhase3242.parsed?.phase3546Marker === "PHASE3546_FORTY_NINE_TOOL_TARGET_FORTY_FIVE_OK" &&
      smokePhase3242.parsed?.phase3600Marker === "PHASE3600_FIFTY_TOOL_TARGET_FORTY_FIVE_OK" &&
      smokePhase3242.parsed?.phase3655Marker === "PHASE3655_FIFTY_ONE_TOOL_TARGET_FORTY_FIVE_OK" &&
      smokePhase3242.parsed?.phase3711Marker === "PHASE3711_FIFTY_TWO_TOOL_TARGET_FORTY_FIVE_OK" &&
      smokePhase3242.parsed?.phase3768Marker === "PHASE3768_FIFTY_THREE_TOOL_TARGET_FORTY_FIVE_OK" &&
      smokePhase3242.parsed?.phase3826Marker === "PHASE3826_FIFTY_FOUR_TOOL_TARGET_FORTY_FIVE_OK" &&
      smokePhase3242.parsed?.phase3885Marker === "PHASE3885_FIFTY_FIVE_TOOL_TARGET_FORTY_FIVE_OK" &&
      smokePhase3242.parsed?.phase3945Marker === "PHASE3945_FIFTY_SIX_TOOL_TARGET_FORTY_FIVE_OK" &&
      smokePhase3291.parsed?.marker === "PHASE3946_FIFTY_SIX_TOOL_TARGET_FORTY_SIX_OK" &&
      smokePhase3291.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase3291.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase3291.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase3291.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase3291.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase3291.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase3291.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase3291.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase3291.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase3291.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase3291.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase3291.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase3291.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase3291.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase3291.parsed?.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase3291.parsed?.phase2500Marker === "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase3291.parsed?.phase2530Marker === "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase3291.parsed?.phase2561Marker === "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase3291.parsed?.phase2593Marker === "PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase3291.parsed?.phase2626Marker === "PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase3291.parsed?.phase2660Marker === "PHASE2660_TWENTY_NINE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase3291.parsed?.phase2695Marker === "PHASE2695_THIRTY_TOOL_TARGET_THIRTY_OK" &&
      smokePhase3291.parsed?.phase2731Marker === "PHASE2731_THIRTY_ONE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase3291.parsed?.phase2768Marker === "PHASE2768_THIRTY_TWO_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase3291.parsed?.phase2806Marker === "PHASE2806_THIRTY_THREE_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase3291.parsed?.phase2845Marker === "PHASE2845_THIRTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase3291.parsed?.phase2885Marker === "PHASE2885_THIRTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase3291.parsed?.phase2926Marker === "PHASE2926_THIRTY_SIX_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase3291.parsed?.phase2968Marker === "PHASE2968_THIRTY_SEVEN_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase3291.parsed?.phase3011Marker === "PHASE3011_THIRTY_EIGHT_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase3291.parsed?.phase3055Marker === "PHASE3055_THIRTY_NINE_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase3291.parsed?.phase3100Marker === "PHASE3100_FORTY_TOOL_TARGET_FORTY_OK" &&
      smokePhase3291.parsed?.phase3146Marker === "PHASE3146_FORTY_ONE_TOOL_TARGET_FORTY_ONE_OK" &&
      smokePhase3291.parsed?.phase3193Marker === "PHASE3193_FORTY_TWO_TOOL_TARGET_FORTY_TWO_OK" &&
      smokePhase3291.parsed?.phase3241Marker === "PHASE3241_FORTY_THREE_TOOL_TARGET_FORTY_THREE_OK" &&
      smokePhase3291.parsed?.phase3290Marker === "PHASE3290_FORTY_FOUR_TOOL_TARGET_FORTY_FOUR_OK" &&
      smokePhase3291.parsed?.phase3340Marker === "PHASE3340_FORTY_FIVE_TOOL_TARGET_FORTY_FIVE_OK" &&
      smokePhase3291.parsed?.phase3391Marker === "PHASE3391_FORTY_SIX_TOOL_TARGET_FORTY_SIX_OK" &&
      smokePhase3291.parsed?.phase3442Marker === "PHASE3442_FORTY_SEVEN_TOOL_TARGET_FORTY_SIX_OK" &&
      smokePhase3291.parsed?.phase3494Marker === "PHASE3494_FORTY_EIGHT_TOOL_TARGET_FORTY_SIX_OK" &&
      smokePhase3291.parsed?.phase3547Marker === "PHASE3547_FORTY_NINE_TOOL_TARGET_FORTY_SIX_OK" &&
      smokePhase3291.parsed?.phase3601Marker === "PHASE3601_FIFTY_TOOL_TARGET_FORTY_SIX_OK" &&
      smokePhase3291.parsed?.phase3656Marker === "PHASE3656_FIFTY_ONE_TOOL_TARGET_FORTY_SIX_OK" &&
      smokePhase3291.parsed?.phase3712Marker === "PHASE3712_FIFTY_TWO_TOOL_TARGET_FORTY_SIX_OK" &&
      smokePhase3291.parsed?.phase3769Marker === "PHASE3769_FIFTY_THREE_TOOL_TARGET_FORTY_SIX_OK" &&
      smokePhase3291.parsed?.phase3827Marker === "PHASE3827_FIFTY_FOUR_TOOL_TARGET_FORTY_SIX_OK" &&
      smokePhase3291.parsed?.phase3886Marker === "PHASE3886_FIFTY_FIVE_TOOL_TARGET_FORTY_SIX_OK" &&
      smokePhase3291.parsed?.phase3946Marker === "PHASE3946_FIFTY_SIX_TOOL_TARGET_FORTY_SIX_OK" &&
      smokePhase3341.parsed?.marker === "PHASE3947_FIFTY_SIX_TOOL_TARGET_FORTY_SEVEN_OK" &&
      smokePhase3341.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase3341.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase3341.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase3341.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase3341.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase3341.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase3341.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase3341.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase3341.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase3341.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase3341.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase3341.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase3341.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase3341.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase3341.parsed?.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase3341.parsed?.phase2500Marker === "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase3341.parsed?.phase2530Marker === "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase3341.parsed?.phase2561Marker === "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase3341.parsed?.phase2593Marker === "PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase3341.parsed?.phase2626Marker === "PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase3341.parsed?.phase2660Marker === "PHASE2660_TWENTY_NINE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase3341.parsed?.phase2695Marker === "PHASE2695_THIRTY_TOOL_TARGET_THIRTY_OK" &&
      smokePhase3341.parsed?.phase2731Marker === "PHASE2731_THIRTY_ONE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase3341.parsed?.phase2768Marker === "PHASE2768_THIRTY_TWO_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase3341.parsed?.phase2806Marker === "PHASE2806_THIRTY_THREE_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase3341.parsed?.phase2845Marker === "PHASE2845_THIRTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase3341.parsed?.phase2885Marker === "PHASE2885_THIRTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase3341.parsed?.phase2926Marker === "PHASE2926_THIRTY_SIX_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase3341.parsed?.phase2968Marker === "PHASE2968_THIRTY_SEVEN_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase3341.parsed?.phase3011Marker === "PHASE3011_THIRTY_EIGHT_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase3341.parsed?.phase3055Marker === "PHASE3055_THIRTY_NINE_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase3341.parsed?.phase3100Marker === "PHASE3100_FORTY_TOOL_TARGET_FORTY_OK" &&
      smokePhase3341.parsed?.phase3146Marker === "PHASE3146_FORTY_ONE_TOOL_TARGET_FORTY_ONE_OK" &&
      smokePhase3341.parsed?.phase3193Marker === "PHASE3193_FORTY_TWO_TOOL_TARGET_FORTY_TWO_OK" &&
      smokePhase3341.parsed?.phase3241Marker === "PHASE3241_FORTY_THREE_TOOL_TARGET_FORTY_THREE_OK" &&
      smokePhase3341.parsed?.phase3290Marker === "PHASE3290_FORTY_FOUR_TOOL_TARGET_FORTY_FOUR_OK" &&
      smokePhase3341.parsed?.phase3340Marker === "PHASE3340_FORTY_FIVE_TOOL_TARGET_FORTY_FIVE_OK" &&
      smokePhase3341.parsed?.phase3391Marker === "PHASE3391_FORTY_SIX_TOOL_TARGET_FORTY_SIX_OK" &&
      smokePhase3341.parsed?.phase3443Marker === "PHASE3443_FORTY_SEVEN_TOOL_TARGET_FORTY_SEVEN_OK" &&
      smokePhase3341.parsed?.phase3495Marker === "PHASE3495_FORTY_EIGHT_TOOL_TARGET_FORTY_SEVEN_OK" &&
      smokePhase3341.parsed?.phase3548Marker === "PHASE3548_FORTY_NINE_TOOL_TARGET_FORTY_SEVEN_OK" &&
      smokePhase3341.parsed?.phase3602Marker === "PHASE3602_FIFTY_TOOL_TARGET_FORTY_SEVEN_OK" &&
      smokePhase3341.parsed?.phase3657Marker === "PHASE3657_FIFTY_ONE_TOOL_TARGET_FORTY_SEVEN_OK" &&
      smokePhase3341.parsed?.phase3713Marker === "PHASE3713_FIFTY_TWO_TOOL_TARGET_FORTY_SEVEN_OK" &&
      smokePhase3341.parsed?.phase3770Marker === "PHASE3770_FIFTY_THREE_TOOL_TARGET_FORTY_SEVEN_OK" &&
      smokePhase3341.parsed?.phase3828Marker === "PHASE3828_FIFTY_FOUR_TOOL_TARGET_FORTY_SEVEN_OK" &&
      smokePhase3341.parsed?.phase3887Marker === "PHASE3887_FIFTY_FIVE_TOOL_TARGET_FORTY_SEVEN_OK" &&
      smokePhase3341.parsed?.phase3947Marker === "PHASE3947_FIFTY_SIX_TOOL_TARGET_FORTY_SEVEN_OK" &&
      smokePhase3392.parsed?.marker === "PHASE3948_FIFTY_SIX_TOOL_TARGET_FORTY_EIGHT_OK" &&
      smokePhase3392.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase3392.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase3392.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase3392.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase3392.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase3392.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase3392.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase3392.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase3392.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase3392.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase3392.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase3392.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase3392.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase3392.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase3392.parsed?.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase3392.parsed?.phase2500Marker === "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase3392.parsed?.phase2530Marker === "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase3392.parsed?.phase2561Marker === "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase3392.parsed?.phase2593Marker === "PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase3392.parsed?.phase2626Marker === "PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase3392.parsed?.phase2660Marker === "PHASE2660_TWENTY_NINE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase3392.parsed?.phase2695Marker === "PHASE2695_THIRTY_TOOL_TARGET_THIRTY_OK" &&
      smokePhase3392.parsed?.phase2731Marker === "PHASE2731_THIRTY_ONE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase3392.parsed?.phase2768Marker === "PHASE2768_THIRTY_TWO_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase3392.parsed?.phase2806Marker === "PHASE2806_THIRTY_THREE_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase3392.parsed?.phase2845Marker === "PHASE2845_THIRTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase3392.parsed?.phase2885Marker === "PHASE2885_THIRTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase3392.parsed?.phase2926Marker === "PHASE2926_THIRTY_SIX_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase3392.parsed?.phase2968Marker === "PHASE2968_THIRTY_SEVEN_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase3392.parsed?.phase3011Marker === "PHASE3011_THIRTY_EIGHT_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase3392.parsed?.phase3055Marker === "PHASE3055_THIRTY_NINE_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase3392.parsed?.phase3100Marker === "PHASE3100_FORTY_TOOL_TARGET_FORTY_OK" &&
      smokePhase3392.parsed?.phase3146Marker === "PHASE3146_FORTY_ONE_TOOL_TARGET_FORTY_ONE_OK" &&
      smokePhase3392.parsed?.phase3193Marker === "PHASE3193_FORTY_TWO_TOOL_TARGET_FORTY_TWO_OK" &&
      smokePhase3392.parsed?.phase3241Marker === "PHASE3241_FORTY_THREE_TOOL_TARGET_FORTY_THREE_OK" &&
      smokePhase3392.parsed?.phase3290Marker === "PHASE3290_FORTY_FOUR_TOOL_TARGET_FORTY_FOUR_OK" &&
      smokePhase3392.parsed?.phase3340Marker === "PHASE3340_FORTY_FIVE_TOOL_TARGET_FORTY_FIVE_OK" &&
      smokePhase3392.parsed?.phase3391Marker === "PHASE3391_FORTY_SIX_TOOL_TARGET_FORTY_SIX_OK" &&
      smokePhase3392.parsed?.phase3443Marker === "PHASE3443_FORTY_SEVEN_TOOL_TARGET_FORTY_SEVEN_OK" &&
      smokePhase3392.parsed?.phase3496Marker === "PHASE3496_FORTY_EIGHT_TOOL_TARGET_FORTY_EIGHT_OK" &&
      smokePhase3392.parsed?.phase3549Marker === "PHASE3549_FORTY_NINE_TOOL_TARGET_FORTY_EIGHT_OK" &&
      smokePhase3392.parsed?.phase3603Marker === "PHASE3603_FIFTY_TOOL_TARGET_FORTY_EIGHT_OK" &&
      smokePhase3392.parsed?.phase3658Marker === "PHASE3658_FIFTY_ONE_TOOL_TARGET_FORTY_EIGHT_OK" &&
      smokePhase3392.parsed?.phase3714Marker === "PHASE3714_FIFTY_TWO_TOOL_TARGET_FORTY_EIGHT_OK" &&
      smokePhase3392.parsed?.phase3771Marker === "PHASE3771_FIFTY_THREE_TOOL_TARGET_FORTY_EIGHT_OK" &&
      smokePhase3392.parsed?.phase3829Marker === "PHASE3829_FIFTY_FOUR_TOOL_TARGET_FORTY_EIGHT_OK" &&
      smokePhase3392.parsed?.phase3888Marker === "PHASE3888_FIFTY_FIVE_TOOL_TARGET_FORTY_EIGHT_OK" &&
      smokePhase3392.parsed?.phase3948Marker === "PHASE3948_FIFTY_SIX_TOOL_TARGET_FORTY_EIGHT_OK" &&
      smokePhase3444.parsed?.marker === "PHASE3949_FIFTY_SIX_TOOL_TARGET_FORTY_NINE_OK" &&
      smokePhase3444.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase3444.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase3444.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase3444.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase3444.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase3444.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase3444.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase3444.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase3444.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase3444.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase3444.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase3444.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase3444.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase3444.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase3444.parsed?.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase3444.parsed?.phase2500Marker === "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase3444.parsed?.phase2530Marker === "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase3444.parsed?.phase2561Marker === "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase3444.parsed?.phase2593Marker === "PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase3444.parsed?.phase2626Marker === "PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase3444.parsed?.phase2660Marker === "PHASE2660_TWENTY_NINE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase3444.parsed?.phase2695Marker === "PHASE2695_THIRTY_TOOL_TARGET_THIRTY_OK" &&
      smokePhase3444.parsed?.phase2731Marker === "PHASE2731_THIRTY_ONE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase3444.parsed?.phase2768Marker === "PHASE2768_THIRTY_TWO_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase3444.parsed?.phase2806Marker === "PHASE2806_THIRTY_THREE_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase3444.parsed?.phase2845Marker === "PHASE2845_THIRTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase3444.parsed?.phase2885Marker === "PHASE2885_THIRTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase3444.parsed?.phase2926Marker === "PHASE2926_THIRTY_SIX_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase3444.parsed?.phase2968Marker === "PHASE2968_THIRTY_SEVEN_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase3444.parsed?.phase3011Marker === "PHASE3011_THIRTY_EIGHT_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase3444.parsed?.phase3055Marker === "PHASE3055_THIRTY_NINE_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase3444.parsed?.phase3100Marker === "PHASE3100_FORTY_TOOL_TARGET_FORTY_OK" &&
      smokePhase3444.parsed?.phase3146Marker === "PHASE3146_FORTY_ONE_TOOL_TARGET_FORTY_ONE_OK" &&
      smokePhase3444.parsed?.phase3193Marker === "PHASE3193_FORTY_TWO_TOOL_TARGET_FORTY_TWO_OK" &&
      smokePhase3444.parsed?.phase3241Marker === "PHASE3241_FORTY_THREE_TOOL_TARGET_FORTY_THREE_OK" &&
      smokePhase3444.parsed?.phase3290Marker === "PHASE3290_FORTY_FOUR_TOOL_TARGET_FORTY_FOUR_OK" &&
      smokePhase3444.parsed?.phase3340Marker === "PHASE3340_FORTY_FIVE_TOOL_TARGET_FORTY_FIVE_OK" &&
      smokePhase3444.parsed?.phase3391Marker === "PHASE3391_FORTY_SIX_TOOL_TARGET_FORTY_SIX_OK" &&
      smokePhase3444.parsed?.phase3443Marker === "PHASE3443_FORTY_SEVEN_TOOL_TARGET_FORTY_SEVEN_OK" &&
      smokePhase3444.parsed?.phase3496Marker === "PHASE3496_FORTY_EIGHT_TOOL_TARGET_FORTY_EIGHT_OK" &&
      smokePhase3444.parsed?.phase3550Marker === "PHASE3550_FORTY_NINE_TOOL_TARGET_FORTY_NINE_OK" &&
      smokePhase3444.parsed?.phase3604Marker === "PHASE3604_FIFTY_TOOL_TARGET_FORTY_NINE_OK" &&
      smokePhase3444.parsed?.phase3659Marker === "PHASE3659_FIFTY_ONE_TOOL_TARGET_FORTY_NINE_OK" &&
      smokePhase3444.parsed?.phase3715Marker === "PHASE3715_FIFTY_TWO_TOOL_TARGET_FORTY_NINE_OK" &&
      smokePhase3444.parsed?.phase3772Marker === "PHASE3772_FIFTY_THREE_TOOL_TARGET_FORTY_NINE_OK" &&
      smokePhase3444.parsed?.phase3830Marker === "PHASE3830_FIFTY_FOUR_TOOL_TARGET_FORTY_NINE_OK" &&
      smokePhase3444.parsed?.phase3889Marker === "PHASE3889_FIFTY_FIVE_TOOL_TARGET_FORTY_NINE_OK" &&
      smokePhase3444.parsed?.phase3949Marker === "PHASE3949_FIFTY_SIX_TOOL_TARGET_FORTY_NINE_OK" &&
      smokePhase3497.parsed?.marker === "PHASE3950_FIFTY_SIX_TOOL_TARGET_FIFTY_OK" &&
      smokePhase3497.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase3497.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase3497.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase3497.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase3497.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase3497.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase3497.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase3497.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase3497.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase3497.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase3497.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase3497.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase3497.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase3497.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase3497.parsed?.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase3497.parsed?.phase2500Marker === "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase3497.parsed?.phase2530Marker === "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase3497.parsed?.phase2561Marker === "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase3497.parsed?.phase2593Marker === "PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase3497.parsed?.phase2626Marker === "PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase3497.parsed?.phase2660Marker === "PHASE2660_TWENTY_NINE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase3497.parsed?.phase2695Marker === "PHASE2695_THIRTY_TOOL_TARGET_THIRTY_OK" &&
      smokePhase3497.parsed?.phase2731Marker === "PHASE2731_THIRTY_ONE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase3497.parsed?.phase2768Marker === "PHASE2768_THIRTY_TWO_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase3497.parsed?.phase2806Marker === "PHASE2806_THIRTY_THREE_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase3497.parsed?.phase2845Marker === "PHASE2845_THIRTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase3497.parsed?.phase2885Marker === "PHASE2885_THIRTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase3497.parsed?.phase2926Marker === "PHASE2926_THIRTY_SIX_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase3497.parsed?.phase2968Marker === "PHASE2968_THIRTY_SEVEN_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase3497.parsed?.phase3011Marker === "PHASE3011_THIRTY_EIGHT_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase3497.parsed?.phase3055Marker === "PHASE3055_THIRTY_NINE_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase3497.parsed?.phase3100Marker === "PHASE3100_FORTY_TOOL_TARGET_FORTY_OK" &&
      smokePhase3497.parsed?.phase3146Marker === "PHASE3146_FORTY_ONE_TOOL_TARGET_FORTY_ONE_OK" &&
      smokePhase3497.parsed?.phase3193Marker === "PHASE3193_FORTY_TWO_TOOL_TARGET_FORTY_TWO_OK" &&
      smokePhase3497.parsed?.phase3241Marker === "PHASE3241_FORTY_THREE_TOOL_TARGET_FORTY_THREE_OK" &&
      smokePhase3497.parsed?.phase3290Marker === "PHASE3290_FORTY_FOUR_TOOL_TARGET_FORTY_FOUR_OK" &&
      smokePhase3497.parsed?.phase3340Marker === "PHASE3340_FORTY_FIVE_TOOL_TARGET_FORTY_FIVE_OK" &&
      smokePhase3497.parsed?.phase3391Marker === "PHASE3391_FORTY_SIX_TOOL_TARGET_FORTY_SIX_OK" &&
      smokePhase3497.parsed?.phase3443Marker === "PHASE3443_FORTY_SEVEN_TOOL_TARGET_FORTY_SEVEN_OK" &&
      smokePhase3497.parsed?.phase3496Marker === "PHASE3496_FORTY_EIGHT_TOOL_TARGET_FORTY_EIGHT_OK" &&
      smokePhase3497.parsed?.phase3550Marker === "PHASE3550_FORTY_NINE_TOOL_TARGET_FORTY_NINE_OK" &&
      smokePhase3497.parsed?.phase3605Marker === "PHASE3605_FIFTY_TOOL_TARGET_FIFTY_OK" &&
      smokePhase3497.parsed?.phase3660Marker === "PHASE3660_FIFTY_ONE_TOOL_TARGET_FIFTY_OK" &&
      smokePhase3497.parsed?.phase3716Marker === "PHASE3716_FIFTY_TWO_TOOL_TARGET_FIFTY_OK" &&
      smokePhase3497.parsed?.phase3773Marker === "PHASE3773_FIFTY_THREE_TOOL_TARGET_FIFTY_OK" &&
      smokePhase3497.parsed?.phase3831Marker === "PHASE3831_FIFTY_FOUR_TOOL_TARGET_FIFTY_OK" &&
      smokePhase3497.parsed?.phase3890Marker === "PHASE3890_FIFTY_FIVE_TOOL_TARGET_FIFTY_OK" &&
      smokePhase3497.parsed?.phase3950Marker === "PHASE3950_FIFTY_SIX_TOOL_TARGET_FIFTY_OK" &&
      smokePhase3551.parsed?.marker === "PHASE3951_FIFTY_SIX_TOOL_TARGET_FIFTY_ONE_OK" &&
      smokePhase3551.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase3551.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase3551.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase3551.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase3551.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase3551.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase3551.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase3551.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase3551.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase3551.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase3551.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase3551.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase3551.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase3551.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase3551.parsed?.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase3551.parsed?.phase2500Marker === "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase3551.parsed?.phase2530Marker === "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase3551.parsed?.phase2561Marker === "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase3551.parsed?.phase2593Marker === "PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase3551.parsed?.phase2626Marker === "PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase3551.parsed?.phase2660Marker === "PHASE2660_TWENTY_NINE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase3551.parsed?.phase2695Marker === "PHASE2695_THIRTY_TOOL_TARGET_THIRTY_OK" &&
      smokePhase3551.parsed?.phase2731Marker === "PHASE2731_THIRTY_ONE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase3551.parsed?.phase2768Marker === "PHASE2768_THIRTY_TWO_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase3551.parsed?.phase2806Marker === "PHASE2806_THIRTY_THREE_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase3551.parsed?.phase2845Marker === "PHASE2845_THIRTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase3551.parsed?.phase2885Marker === "PHASE2885_THIRTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase3551.parsed?.phase2926Marker === "PHASE2926_THIRTY_SIX_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase3551.parsed?.phase2968Marker === "PHASE2968_THIRTY_SEVEN_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase3551.parsed?.phase3011Marker === "PHASE3011_THIRTY_EIGHT_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase3551.parsed?.phase3055Marker === "PHASE3055_THIRTY_NINE_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase3551.parsed?.phase3100Marker === "PHASE3100_FORTY_TOOL_TARGET_FORTY_OK" &&
      smokePhase3551.parsed?.phase3146Marker === "PHASE3146_FORTY_ONE_TOOL_TARGET_FORTY_ONE_OK" &&
      smokePhase3551.parsed?.phase3193Marker === "PHASE3193_FORTY_TWO_TOOL_TARGET_FORTY_TWO_OK" &&
      smokePhase3551.parsed?.phase3241Marker === "PHASE3241_FORTY_THREE_TOOL_TARGET_FORTY_THREE_OK" &&
      smokePhase3551.parsed?.phase3290Marker === "PHASE3290_FORTY_FOUR_TOOL_TARGET_FORTY_FOUR_OK" &&
      smokePhase3551.parsed?.phase3340Marker === "PHASE3340_FORTY_FIVE_TOOL_TARGET_FORTY_FIVE_OK" &&
      smokePhase3551.parsed?.phase3391Marker === "PHASE3391_FORTY_SIX_TOOL_TARGET_FORTY_SIX_OK" &&
      smokePhase3551.parsed?.phase3443Marker === "PHASE3443_FORTY_SEVEN_TOOL_TARGET_FORTY_SEVEN_OK" &&
      smokePhase3551.parsed?.phase3496Marker === "PHASE3496_FORTY_EIGHT_TOOL_TARGET_FORTY_EIGHT_OK" &&
      smokePhase3551.parsed?.phase3550Marker === "PHASE3550_FORTY_NINE_TOOL_TARGET_FORTY_NINE_OK" &&
      smokePhase3551.parsed?.phase3605Marker === "PHASE3605_FIFTY_TOOL_TARGET_FIFTY_OK" &&
      smokePhase3551.parsed?.phase3661Marker === "PHASE3661_FIFTY_ONE_TOOL_TARGET_FIFTY_ONE_OK" &&
      smokePhase3551.parsed?.phase3717Marker === "PHASE3717_FIFTY_TWO_TOOL_TARGET_FIFTY_ONE_OK" &&
      smokePhase3551.parsed?.phase3774Marker === "PHASE3774_FIFTY_THREE_TOOL_TARGET_FIFTY_ONE_OK" &&
      smokePhase3551.parsed?.phase3832Marker === "PHASE3832_FIFTY_FOUR_TOOL_TARGET_FIFTY_ONE_OK" &&
      smokePhase3551.parsed?.phase3891Marker === "PHASE3891_FIFTY_FIVE_TOOL_TARGET_FIFTY_ONE_OK" &&
      smokePhase3551.parsed?.phase3951Marker === "PHASE3951_FIFTY_SIX_TOOL_TARGET_FIFTY_ONE_OK" &&
      smokePhase3606.parsed?.marker === "PHASE3952_FIFTY_SIX_TOOL_TARGET_FIFTY_TWO_OK" &&
      smokePhase3606.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase3606.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase3606.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase3606.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase3606.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase3606.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase3606.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase3606.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase3606.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase3606.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase3606.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase3606.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase3606.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase3606.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase3606.parsed?.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase3606.parsed?.phase2500Marker === "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase3606.parsed?.phase2530Marker === "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase3606.parsed?.phase2561Marker === "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase3606.parsed?.phase2593Marker === "PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase3606.parsed?.phase2626Marker === "PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase3606.parsed?.phase2660Marker === "PHASE2660_TWENTY_NINE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase3606.parsed?.phase2695Marker === "PHASE2695_THIRTY_TOOL_TARGET_THIRTY_OK" &&
      smokePhase3606.parsed?.phase2731Marker === "PHASE2731_THIRTY_ONE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase3606.parsed?.phase2768Marker === "PHASE2768_THIRTY_TWO_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase3606.parsed?.phase2806Marker === "PHASE2806_THIRTY_THREE_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase3606.parsed?.phase2845Marker === "PHASE2845_THIRTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase3606.parsed?.phase2885Marker === "PHASE2885_THIRTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase3606.parsed?.phase2926Marker === "PHASE2926_THIRTY_SIX_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase3606.parsed?.phase2968Marker === "PHASE2968_THIRTY_SEVEN_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase3606.parsed?.phase3011Marker === "PHASE3011_THIRTY_EIGHT_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase3606.parsed?.phase3055Marker === "PHASE3055_THIRTY_NINE_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase3606.parsed?.phase3100Marker === "PHASE3100_FORTY_TOOL_TARGET_FORTY_OK" &&
      smokePhase3606.parsed?.phase3146Marker === "PHASE3146_FORTY_ONE_TOOL_TARGET_FORTY_ONE_OK" &&
      smokePhase3606.parsed?.phase3193Marker === "PHASE3193_FORTY_TWO_TOOL_TARGET_FORTY_TWO_OK" &&
      smokePhase3606.parsed?.phase3241Marker === "PHASE3241_FORTY_THREE_TOOL_TARGET_FORTY_THREE_OK" &&
      smokePhase3606.parsed?.phase3290Marker === "PHASE3290_FORTY_FOUR_TOOL_TARGET_FORTY_FOUR_OK" &&
      smokePhase3606.parsed?.phase3340Marker === "PHASE3340_FORTY_FIVE_TOOL_TARGET_FORTY_FIVE_OK" &&
      smokePhase3606.parsed?.phase3391Marker === "PHASE3391_FORTY_SIX_TOOL_TARGET_FORTY_SIX_OK" &&
      smokePhase3606.parsed?.phase3443Marker === "PHASE3443_FORTY_SEVEN_TOOL_TARGET_FORTY_SEVEN_OK" &&
      smokePhase3606.parsed?.phase3496Marker === "PHASE3496_FORTY_EIGHT_TOOL_TARGET_FORTY_EIGHT_OK" &&
      smokePhase3606.parsed?.phase3550Marker === "PHASE3550_FORTY_NINE_TOOL_TARGET_FORTY_NINE_OK" &&
      smokePhase3606.parsed?.phase3605Marker === "PHASE3605_FIFTY_TOOL_TARGET_FIFTY_OK" &&
      smokePhase3606.parsed?.phase3661Marker === "PHASE3661_FIFTY_ONE_TOOL_TARGET_FIFTY_ONE_OK" &&
      smokePhase3606.parsed?.phase3718Marker === "PHASE3718_FIFTY_TWO_TOOL_TARGET_FIFTY_TWO_OK" &&
      smokePhase3606.parsed?.phase3775Marker === "PHASE3775_FIFTY_THREE_TOOL_TARGET_FIFTY_TWO_OK" &&
      smokePhase3606.parsed?.phase3833Marker === "PHASE3833_FIFTY_FOUR_TOOL_TARGET_FIFTY_TWO_OK" &&
      smokePhase3606.parsed?.phase3892Marker === "PHASE3892_FIFTY_FIVE_TOOL_TARGET_FIFTY_TWO_OK" &&
      smokePhase3606.parsed?.phase3952Marker === "PHASE3952_FIFTY_SIX_TOOL_TARGET_FIFTY_TWO_OK" &&
      smokePhase3662.parsed?.marker === "PHASE3953_FIFTY_SIX_TOOL_TARGET_FIFTY_THREE_OK" &&
      smokePhase3662.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase3662.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase3662.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase3662.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase3662.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase3662.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase3662.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase3662.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase3662.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase3662.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase3662.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase3662.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase3662.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase3662.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase3662.parsed?.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase3662.parsed?.phase2500Marker === "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase3662.parsed?.phase2530Marker === "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase3662.parsed?.phase2561Marker === "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase3662.parsed?.phase2593Marker === "PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase3662.parsed?.phase2626Marker === "PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase3662.parsed?.phase2660Marker === "PHASE2660_TWENTY_NINE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase3662.parsed?.phase2695Marker === "PHASE2695_THIRTY_TOOL_TARGET_THIRTY_OK" &&
      smokePhase3662.parsed?.phase2731Marker === "PHASE2731_THIRTY_ONE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase3662.parsed?.phase2768Marker === "PHASE2768_THIRTY_TWO_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase3662.parsed?.phase2806Marker === "PHASE2806_THIRTY_THREE_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase3662.parsed?.phase2845Marker === "PHASE2845_THIRTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase3662.parsed?.phase2885Marker === "PHASE2885_THIRTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase3662.parsed?.phase2926Marker === "PHASE2926_THIRTY_SIX_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase3662.parsed?.phase2968Marker === "PHASE2968_THIRTY_SEVEN_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase3662.parsed?.phase3011Marker === "PHASE3011_THIRTY_EIGHT_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase3662.parsed?.phase3055Marker === "PHASE3055_THIRTY_NINE_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase3662.parsed?.phase3100Marker === "PHASE3100_FORTY_TOOL_TARGET_FORTY_OK" &&
      smokePhase3662.parsed?.phase3146Marker === "PHASE3146_FORTY_ONE_TOOL_TARGET_FORTY_ONE_OK" &&
      smokePhase3662.parsed?.phase3193Marker === "PHASE3193_FORTY_TWO_TOOL_TARGET_FORTY_TWO_OK" &&
      smokePhase3662.parsed?.phase3241Marker === "PHASE3241_FORTY_THREE_TOOL_TARGET_FORTY_THREE_OK" &&
      smokePhase3662.parsed?.phase3290Marker === "PHASE3290_FORTY_FOUR_TOOL_TARGET_FORTY_FOUR_OK" &&
      smokePhase3662.parsed?.phase3340Marker === "PHASE3340_FORTY_FIVE_TOOL_TARGET_FORTY_FIVE_OK" &&
      smokePhase3662.parsed?.phase3391Marker === "PHASE3391_FORTY_SIX_TOOL_TARGET_FORTY_SIX_OK" &&
      smokePhase3662.parsed?.phase3443Marker === "PHASE3443_FORTY_SEVEN_TOOL_TARGET_FORTY_SEVEN_OK" &&
      smokePhase3662.parsed?.phase3496Marker === "PHASE3496_FORTY_EIGHT_TOOL_TARGET_FORTY_EIGHT_OK" &&
      smokePhase3662.parsed?.phase3550Marker === "PHASE3550_FORTY_NINE_TOOL_TARGET_FORTY_NINE_OK" &&
      smokePhase3662.parsed?.phase3605Marker === "PHASE3605_FIFTY_TOOL_TARGET_FIFTY_OK" &&
      smokePhase3662.parsed?.phase3661Marker === "PHASE3661_FIFTY_ONE_TOOL_TARGET_FIFTY_ONE_OK" &&
      smokePhase3662.parsed?.phase3718Marker === "PHASE3718_FIFTY_TWO_TOOL_TARGET_FIFTY_TWO_OK" &&
      smokePhase3662.parsed?.phase3776Marker === "PHASE3776_FIFTY_THREE_TOOL_TARGET_FIFTY_THREE_OK" &&
      smokePhase3662.parsed?.phase3834Marker === "PHASE3834_FIFTY_FOUR_TOOL_TARGET_FIFTY_THREE_OK" &&
      smokePhase3662.parsed?.phase3893Marker === "PHASE3893_FIFTY_FIVE_TOOL_TARGET_FIFTY_THREE_OK" &&
      smokePhase3662.parsed?.phase3953Marker === "PHASE3953_FIFTY_SIX_TOOL_TARGET_FIFTY_THREE_OK" &&
      smokePhase3719.parsed?.marker === "PHASE3954_FIFTY_SIX_TOOL_TARGET_FIFTY_FOUR_OK" &&
      smokePhase3719.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase3719.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase3719.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase3719.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase3719.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase3719.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase3719.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase3719.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase3719.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase3719.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase3719.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase3719.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase3719.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase3719.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase3719.parsed?.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase3719.parsed?.phase2500Marker === "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase3719.parsed?.phase2530Marker === "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase3719.parsed?.phase2561Marker === "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase3719.parsed?.phase2593Marker === "PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase3719.parsed?.phase2626Marker === "PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase3719.parsed?.phase2660Marker === "PHASE2660_TWENTY_NINE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase3719.parsed?.phase2695Marker === "PHASE2695_THIRTY_TOOL_TARGET_THIRTY_OK" &&
      smokePhase3719.parsed?.phase2731Marker === "PHASE2731_THIRTY_ONE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase3719.parsed?.phase2768Marker === "PHASE2768_THIRTY_TWO_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase3719.parsed?.phase2806Marker === "PHASE2806_THIRTY_THREE_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase3719.parsed?.phase2845Marker === "PHASE2845_THIRTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase3719.parsed?.phase2885Marker === "PHASE2885_THIRTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase3719.parsed?.phase2926Marker === "PHASE2926_THIRTY_SIX_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase3719.parsed?.phase2968Marker === "PHASE2968_THIRTY_SEVEN_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase3719.parsed?.phase3011Marker === "PHASE3011_THIRTY_EIGHT_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase3719.parsed?.phase3055Marker === "PHASE3055_THIRTY_NINE_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase3719.parsed?.phase3100Marker === "PHASE3100_FORTY_TOOL_TARGET_FORTY_OK" &&
      smokePhase3719.parsed?.phase3146Marker === "PHASE3146_FORTY_ONE_TOOL_TARGET_FORTY_ONE_OK" &&
      smokePhase3719.parsed?.phase3193Marker === "PHASE3193_FORTY_TWO_TOOL_TARGET_FORTY_TWO_OK" &&
      smokePhase3719.parsed?.phase3241Marker === "PHASE3241_FORTY_THREE_TOOL_TARGET_FORTY_THREE_OK" &&
      smokePhase3719.parsed?.phase3290Marker === "PHASE3290_FORTY_FOUR_TOOL_TARGET_FORTY_FOUR_OK" &&
      smokePhase3719.parsed?.phase3340Marker === "PHASE3340_FORTY_FIVE_TOOL_TARGET_FORTY_FIVE_OK" &&
      smokePhase3719.parsed?.phase3391Marker === "PHASE3391_FORTY_SIX_TOOL_TARGET_FORTY_SIX_OK" &&
      smokePhase3719.parsed?.phase3443Marker === "PHASE3443_FORTY_SEVEN_TOOL_TARGET_FORTY_SEVEN_OK" &&
      smokePhase3719.parsed?.phase3496Marker === "PHASE3496_FORTY_EIGHT_TOOL_TARGET_FORTY_EIGHT_OK" &&
      smokePhase3719.parsed?.phase3550Marker === "PHASE3550_FORTY_NINE_TOOL_TARGET_FORTY_NINE_OK" &&
      smokePhase3719.parsed?.phase3605Marker === "PHASE3605_FIFTY_TOOL_TARGET_FIFTY_OK" &&
      smokePhase3719.parsed?.phase3661Marker === "PHASE3661_FIFTY_ONE_TOOL_TARGET_FIFTY_ONE_OK" &&
      smokePhase3719.parsed?.phase3718Marker === "PHASE3718_FIFTY_TWO_TOOL_TARGET_FIFTY_TWO_OK" &&
      smokePhase3719.parsed?.phase3776Marker === "PHASE3776_FIFTY_THREE_TOOL_TARGET_FIFTY_THREE_OK" &&
      smokePhase3719.parsed?.phase3835Marker === "PHASE3835_FIFTY_FOUR_TOOL_TARGET_FIFTY_FOUR_OK" &&
      smokePhase3719.parsed?.phase3894Marker === "PHASE3894_FIFTY_FIVE_TOOL_TARGET_FIFTY_FOUR_OK" &&
      smokePhase3719.parsed?.phase3954Marker === "PHASE3954_FIFTY_SIX_TOOL_TARGET_FIFTY_FOUR_OK" &&
      smokePhase3777.parsed?.marker === "PHASE3955_FIFTY_SIX_TOOL_TARGET_FIFTY_FIVE_OK" &&
      smokePhase3777.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase3777.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase3777.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase3777.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase3777.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase3777.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase3777.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase3777.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase3777.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase3777.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase3777.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase3777.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase3777.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase3777.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase3777.parsed?.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase3777.parsed?.phase2500Marker === "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase3777.parsed?.phase2530Marker === "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase3777.parsed?.phase2561Marker === "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase3777.parsed?.phase2593Marker === "PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase3777.parsed?.phase2626Marker === "PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase3777.parsed?.phase2660Marker === "PHASE2660_TWENTY_NINE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase3777.parsed?.phase2695Marker === "PHASE2695_THIRTY_TOOL_TARGET_THIRTY_OK" &&
      smokePhase3777.parsed?.phase2731Marker === "PHASE2731_THIRTY_ONE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase3777.parsed?.phase2768Marker === "PHASE2768_THIRTY_TWO_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase3777.parsed?.phase2806Marker === "PHASE2806_THIRTY_THREE_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase3777.parsed?.phase2845Marker === "PHASE2845_THIRTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase3777.parsed?.phase2885Marker === "PHASE2885_THIRTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase3777.parsed?.phase2926Marker === "PHASE2926_THIRTY_SIX_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase3777.parsed?.phase2968Marker === "PHASE2968_THIRTY_SEVEN_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase3777.parsed?.phase3011Marker === "PHASE3011_THIRTY_EIGHT_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase3777.parsed?.phase3055Marker === "PHASE3055_THIRTY_NINE_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase3777.parsed?.phase3100Marker === "PHASE3100_FORTY_TOOL_TARGET_FORTY_OK" &&
      smokePhase3777.parsed?.phase3146Marker === "PHASE3146_FORTY_ONE_TOOL_TARGET_FORTY_ONE_OK" &&
      smokePhase3777.parsed?.phase3193Marker === "PHASE3193_FORTY_TWO_TOOL_TARGET_FORTY_TWO_OK" &&
      smokePhase3777.parsed?.phase3241Marker === "PHASE3241_FORTY_THREE_TOOL_TARGET_FORTY_THREE_OK" &&
      smokePhase3777.parsed?.phase3290Marker === "PHASE3290_FORTY_FOUR_TOOL_TARGET_FORTY_FOUR_OK" &&
      smokePhase3777.parsed?.phase3340Marker === "PHASE3340_FORTY_FIVE_TOOL_TARGET_FORTY_FIVE_OK" &&
      smokePhase3777.parsed?.phase3391Marker === "PHASE3391_FORTY_SIX_TOOL_TARGET_FORTY_SIX_OK" &&
      smokePhase3777.parsed?.phase3443Marker === "PHASE3443_FORTY_SEVEN_TOOL_TARGET_FORTY_SEVEN_OK" &&
      smokePhase3777.parsed?.phase3496Marker === "PHASE3496_FORTY_EIGHT_TOOL_TARGET_FORTY_EIGHT_OK" &&
      smokePhase3777.parsed?.phase3550Marker === "PHASE3550_FORTY_NINE_TOOL_TARGET_FORTY_NINE_OK" &&
      smokePhase3777.parsed?.phase3605Marker === "PHASE3605_FIFTY_TOOL_TARGET_FIFTY_OK" &&
      smokePhase3777.parsed?.phase3661Marker === "PHASE3661_FIFTY_ONE_TOOL_TARGET_FIFTY_ONE_OK" &&
      smokePhase3777.parsed?.phase3718Marker === "PHASE3718_FIFTY_TWO_TOOL_TARGET_FIFTY_TWO_OK" &&
      smokePhase3777.parsed?.phase3776Marker === "PHASE3776_FIFTY_THREE_TOOL_TARGET_FIFTY_THREE_OK" &&
      smokePhase3777.parsed?.phase3835Marker === "PHASE3835_FIFTY_FOUR_TOOL_TARGET_FIFTY_FOUR_OK" &&
      smokePhase3777.parsed?.phase3895Marker === "PHASE3895_FIFTY_FIVE_TOOL_TARGET_FIFTY_FIVE_OK" &&
      smokePhase3777.parsed?.phase3955Marker === "PHASE3955_FIFTY_SIX_TOOL_TARGET_FIFTY_FIVE_OK" &&
      smokePhase3836.parsed?.marker === "PHASE3956_FIFTY_SIX_TOOL_TARGET_FIFTY_SIX_OK" &&
      smokePhase3836.parsed?.phase2170Marker === "PHASE2170_NONET_TOOL_TARGET_NINE_OK" &&
      smokePhase3836.parsed?.phase2185Marker === "PHASE2185_DECA_TOOL_TARGET_TEN_OK" &&
      smokePhase3836.parsed?.phase2201Marker === "PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK" &&
      smokePhase3836.parsed?.phase2218Marker === "PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK" &&
      smokePhase3836.parsed?.phase2236Marker === "PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK" &&
      smokePhase3836.parsed?.phase2255Marker === "PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK" &&
      smokePhase3836.parsed?.phase2275Marker === "PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK" &&
      smokePhase3836.parsed?.phase2296Marker === "PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK" &&
      smokePhase3836.parsed?.phase2318Marker === "PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK" &&
      smokePhase3836.parsed?.phase2341Marker === "PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK" &&
      smokePhase3836.parsed?.phase2365Marker === "PHASE2365_NINETEEN_TOOL_TARGET_NINETEEN_OK" &&
      smokePhase3836.parsed?.phase2390Marker === "PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK" &&
      smokePhase3836.parsed?.phase2416Marker === "PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK" &&
      smokePhase3836.parsed?.phase2443Marker === "PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK" &&
      smokePhase3836.parsed?.phase2471Marker === "PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK" &&
      smokePhase3836.parsed?.phase2500Marker === "PHASE2500_TWENTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK" &&
      smokePhase3836.parsed?.phase2530Marker === "PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK" &&
      smokePhase3836.parsed?.phase2561Marker === "PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK" &&
      smokePhase3836.parsed?.phase2593Marker === "PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK" &&
      smokePhase3836.parsed?.phase2626Marker === "PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK" &&
      smokePhase3836.parsed?.phase2660Marker === "PHASE2660_TWENTY_NINE_TOOL_TARGET_TWENTY_NINE_OK" &&
      smokePhase3836.parsed?.phase2695Marker === "PHASE2695_THIRTY_TOOL_TARGET_THIRTY_OK" &&
      smokePhase3836.parsed?.phase2731Marker === "PHASE2731_THIRTY_ONE_TOOL_TARGET_THIRTY_ONE_OK" &&
      smokePhase3836.parsed?.phase2768Marker === "PHASE2768_THIRTY_TWO_TOOL_TARGET_THIRTY_TWO_OK" &&
      smokePhase3836.parsed?.phase2806Marker === "PHASE2806_THIRTY_THREE_TOOL_TARGET_THIRTY_THREE_OK" &&
      smokePhase3836.parsed?.phase2845Marker === "PHASE2845_THIRTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK" &&
      smokePhase3836.parsed?.phase2885Marker === "PHASE2885_THIRTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK" &&
      smokePhase3836.parsed?.phase2926Marker === "PHASE2926_THIRTY_SIX_TOOL_TARGET_THIRTY_SIX_OK" &&
      smokePhase3836.parsed?.phase2968Marker === "PHASE2968_THIRTY_SEVEN_TOOL_TARGET_THIRTY_SEVEN_OK" &&
      smokePhase3836.parsed?.phase3011Marker === "PHASE3011_THIRTY_EIGHT_TOOL_TARGET_THIRTY_EIGHT_OK" &&
      smokePhase3836.parsed?.phase3055Marker === "PHASE3055_THIRTY_NINE_TOOL_TARGET_THIRTY_NINE_OK" &&
      smokePhase3836.parsed?.phase3100Marker === "PHASE3100_FORTY_TOOL_TARGET_FORTY_OK" &&
      smokePhase3836.parsed?.phase3146Marker === "PHASE3146_FORTY_ONE_TOOL_TARGET_FORTY_ONE_OK" &&
      smokePhase3836.parsed?.phase3193Marker === "PHASE3193_FORTY_TWO_TOOL_TARGET_FORTY_TWO_OK" &&
      smokePhase3836.parsed?.phase3241Marker === "PHASE3241_FORTY_THREE_TOOL_TARGET_FORTY_THREE_OK" &&
      smokePhase3836.parsed?.phase3290Marker === "PHASE3290_FORTY_FOUR_TOOL_TARGET_FORTY_FOUR_OK" &&
      smokePhase3836.parsed?.phase3340Marker === "PHASE3340_FORTY_FIVE_TOOL_TARGET_FORTY_FIVE_OK" &&
      smokePhase3836.parsed?.phase3391Marker === "PHASE3391_FORTY_SIX_TOOL_TARGET_FORTY_SIX_OK" &&
      smokePhase3836.parsed?.phase3443Marker === "PHASE3443_FORTY_SEVEN_TOOL_TARGET_FORTY_SEVEN_OK" &&
      smokePhase3836.parsed?.phase3496Marker === "PHASE3496_FORTY_EIGHT_TOOL_TARGET_FORTY_EIGHT_OK" &&
      smokePhase3836.parsed?.phase3550Marker === "PHASE3550_FORTY_NINE_TOOL_TARGET_FORTY_NINE_OK" &&
      smokePhase3836.parsed?.phase3605Marker === "PHASE3605_FIFTY_TOOL_TARGET_FIFTY_OK" &&
      smokePhase3836.parsed?.phase3661Marker === "PHASE3661_FIFTY_ONE_TOOL_TARGET_FIFTY_ONE_OK" &&
      smokePhase3836.parsed?.phase3718Marker === "PHASE3718_FIFTY_TWO_TOOL_TARGET_FIFTY_TWO_OK" &&
      smokePhase3836.parsed?.phase3776Marker === "PHASE3776_FIFTY_THREE_TOOL_TARGET_FIFTY_THREE_OK" &&
      smokePhase3836.parsed?.phase3835Marker === "PHASE3835_FIFTY_FOUR_TOOL_TARGET_FIFTY_FOUR_OK" &&
      smokePhase3836.parsed?.phase3895Marker === "PHASE3895_FIFTY_FIVE_TOOL_TARGET_FIFTY_FIVE_OK" &&
      smokePhase3836.parsed?.phase3956Marker === "PHASE3956_FIFTY_SIX_TOOL_TARGET_FIFTY_SIX_OK" &&
      true
        ? "passed"
        : "failed",
    phase3901Marker: smokePhase2091.parsed?.phase3901?.marker || null,
    phase3902Marker: smokePhase2092.parsed?.phase3902Marker || null,
    phase3903Marker: smokePhase2093.parsed?.phase3903Marker || null,
    phase3904Marker: smokePhase2096.parsed?.phase3904Marker || null,
    phase3905Marker: smokePhase2101.parsed?.phase3905Marker || null,
    phase3906Marker: smokePhase2111.parsed?.phase3906Marker || null,
    phase3907Marker: smokePhase2121.parsed?.phase3907Marker || null,
    phase3908Marker: smokePhase2132.parsed?.phase3908Marker || null,
    phase3909Marker: smokePhase2144.parsed?.phase3909Marker || null,
    phase3910Marker: smokePhase2157.parsed?.phase3910Marker || null,
    phase3911Marker: smokePhase2171.parsed?.phase3911Marker || null,
    phase3912Marker: smokePhase2186.parsed?.phase3912Marker || null,
    phase3913Marker: smokePhase2202.parsed?.phase3913Marker || null,
    phase3914Marker: smokePhase2219.parsed?.phase3914Marker || null,
    phase3915Marker: smokePhase2237.parsed?.phase3915Marker || null,
    phase3916Marker: smokePhase2256.parsed?.phase3916Marker || null,
    phase3917Marker: smokePhase2276.parsed?.phase3917Marker || null,
    phase3918Marker: smokePhase2297.parsed?.phase3918Marker || null,
    phase3919Marker: smokePhase2319.parsed?.phase3919Marker || null,
    phase3920Marker: smokePhase2342.parsed?.phase3920Marker || null,
    phase3921Marker: smokePhase2366.parsed?.phase3921Marker || null,
    phase3922Marker: smokePhase2391.parsed?.phase3922Marker || null,
    phase3923Marker: smokePhase2417.parsed?.phase3923Marker || null,
    phase3924Marker: smokePhase2444.parsed?.phase3924Marker || null,
    phase3925Marker: smokePhase2472.parsed?.phase3925Marker || null,
    phase3926Marker: smokePhase2501.parsed?.phase3926Marker || null,
    phase3927Marker: smokePhase2531.parsed?.phase3927Marker || null,
    phase3928Marker: smokePhase2562.parsed?.phase3928Marker || null,
    phase3929Marker: smokePhase2594.parsed?.phase3929Marker || null,
    phase3930Marker: smokePhase2627.parsed?.phase3930Marker || null,
    phase3931Marker: smokePhase2661.parsed?.phase3931Marker || null,
    phase3932Marker: smokePhase2696.parsed?.phase3932Marker || null,
    phase3933Marker: smokePhase2732.parsed?.phase3933Marker || null,
    phase3934Marker: smokePhase2769.parsed?.phase3934Marker || null,
    phase3935Marker: smokePhase2807.parsed?.phase3935Marker || null,
    phase3936Marker: smokePhase2846.parsed?.phase3936Marker || null,
    phase3937Marker: smokePhase2886.parsed?.phase3937Marker || null,
    phase3938Marker: smokePhase2927.parsed?.phase3938Marker || null,
    phase3939Marker: smokePhase2969.parsed?.phase3939Marker || null,
    phase3940Marker: smokePhase3012.parsed?.phase3940Marker || null,
    phase3941Marker: smokePhase3056.parsed?.phase3941Marker || null,
    phase3942Marker: smokePhase3101.parsed?.phase3942Marker || null,
    phase3943Marker: smokePhase3147.parsed?.phase3943Marker || null,
    phase3944Marker: smokePhase3194.parsed?.phase3944Marker || null,
    phase3945Marker: smokePhase3242.parsed?.phase3945Marker || null,
    phase3946Marker: smokePhase3291.parsed?.phase3946Marker || null,
    phase3947Marker: smokePhase3341.parsed?.phase3947Marker || null,
    phase3948Marker: smokePhase3392.parsed?.phase3948Marker || null,
    phase3949Marker: smokePhase3444.parsed?.phase3949Marker || null,
    phase3950Marker: smokePhase3497.parsed?.phase3950Marker || null,
    phase3951Marker: smokePhase3551.parsed?.phase3951Marker || null,
    phase3952Marker: smokePhase3606.parsed?.phase3952Marker || null,
    phase3953Marker: smokePhase3662.parsed?.phase3953Marker || null,
    phase3954Marker: smokePhase3719.parsed?.phase3954Marker || null,
    phase3955Marker: smokePhase3777.parsed?.phase3955Marker || null,
    phase3956Marker: smokePhase3836.parsed?.phase3956Marker || null,
    providerCallsMade: false,
    stdout: sanitizeTail(smokeRuns.map((entry) => entry.result.stdout).join("\n")),
    stderr: sanitizeTail(smokeRuns.map((entry) => entry.result.stderr).join("\n")),
  };
  writeJsonFile(smokePath, smokeResult);

  const files = parsedOperations.map(({ operation, parsed }) => {
    const original = originals.get(operation.targetPath);
    return {
      targetPath: operation.targetPath,
      previousFileSha256: original.previousFileSha256,
      mutatedFileSha256: sha256Text(parsed.afterContent),
      previousFileByteLength: original.previousFileByteLength,
      mutatedFileByteLength: Buffer.byteLength(parsed.afterContent, "utf8"),
      idempotentAlreadyApplied: Boolean(original.idempotentAlreadyApplied),
    };
  });
  const rollback = {
    phaseId,
    generatedAt,
    rollbackAction: "restore-previous-content-fifty-six",
    rollbackExecuted: false,
    files,
    safetyBoundary: {
      restoreOnlyListedFiles: true,
      maxChangedFiles: 56,
      noCommit: true,
      noPush: true,
      noDeploy: true,
      noProviderCall: true,
      noChatChange: true,
    },
  };
  writeJsonFile(rollbackPath, rollback);

  const completed = nodeCheckPassed && smokeResult.status === "passed";
  const result = {
    ...base,
    status: completed ? "passed" : "failed",
    blocker: completed ? "none" : "fifty_six_mutation_node_check_or_smoke_failed",
    proposalValidations: parsedOperations.map((entry) => entry.parsed),
    changedFiles: operations.map((operation) => operation.targetPath),
    changedFileCount: operations.length,
    actualWritesPerformed: parsedOperations.filter((entry) => !entry.parsed.idempotentAlreadyApplied).length,
    idempotentReapplyAccepted: parsedOperations.every((entry) => entry.parsed.idempotentAlreadyApplied),
    fiftySixMutationApplied: true,
    nodeCheckPassed,
    nodeChecks: nodeChecks.map((entry) => ({
      targetPath: entry.targetPath,
      exitCode: entry.result.status ?? 1,
      stderr: sanitizeTail(entry.result.stderr),
    })),
    localFiftySixSmokePassed: smokeResult.status === "passed",
    smokePath,
    rollbackAvailable: true,
    rollbackPath,
    codexExecExecuted: false,
    providerCallsMade: false,
    projectProviderCallsMade: false,
    paidProviderCallsMadeByProject: false,
    secretRead: false,
    envRead: false,
    authJsonRead: false,
    authJsonContentExposed: false,
    codexConfigModified: false,
    codexBaseUrlModified: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    pushExecuted: false,
    commitCreated: false,
    legacyModified: false,
    projectContextCreated: existsSync(resolveRelativePath("PROJECT_CONTEXT.md")),
    workspaceCleanClaimed: false,
    productionReadyClaimed: false,
    releaseReadyClaimed: false,
    recommendedSealed: completed,
    evidenceRefs: {
      result: resultPath,
      resultMarkdown: resultMdPath,
      rollback: rollbackPath,
      smoke: smokePath,
    },
  };

  writeJsonFile(resultPath, result);
  writeTextFile(resultMdPath, renderMarkdown(result));
  printSummary(result);
  if (!completed) process.exit(1);
}

function validatePlan(plan) {
  return validateControlledMutationPlan({
    plan,
    expectedPhaseId: phaseId,
    expectedPermissionMode: "controlled-fifty-six-tool-source-mutation",
    expectedOperationCount: 56,
    expectedMaxChangedFiles: 56,
    requiredAllowedFiles: [
    "apps/ai-gateway-service/evidence/phase3896-3956-controlled-fifty-six-tool-mutation/result.json",
    "apps/ai-gateway-service/evidence/phase3896-3956-controlled-fifty-six-tool-mutation/result.md",
    "apps/ai-gateway-service/evidence/phase3896-3956-controlled-fifty-six-tool-mutation/rollback.json",
    "apps/ai-gateway-service/evidence/phase3896-3956-controlled-fifty-six-tool-mutation/fifty-six-smoke.json",
    "docs/phase3901-fifty-six-tool-mutation-target-one.proposal.diff",
    "docs/phase3902-fifty-six-tool-mutation-target-two.proposal.diff",
    "docs/phase3903-fifty-six-tool-mutation-target-three.proposal.diff",
    "docs/phase3904-fifty-six-tool-mutation-target-four.proposal.diff",
    "docs/phase3905-fifty-six-tool-mutation-target-five.proposal.diff",
    "docs/phase3906-fifty-six-tool-mutation-target-six.proposal.diff",
    "docs/phase3907-fifty-six-tool-mutation-target-seven.proposal.diff",
    "docs/phase3908-fifty-six-tool-mutation-target-eight.proposal.diff",
    "docs/phase3909-fifty-six-tool-mutation-target-nine.proposal.diff",
    "docs/phase3910-fifty-six-tool-mutation-target-ten.proposal.diff",
    "docs/phase3911-fifty-six-tool-mutation-target-eleven.proposal.diff",
    "docs/phase3912-fifty-six-tool-mutation-target-twelve.proposal.diff",
    "docs/phase3913-fifty-six-tool-mutation-target-thirteen.proposal.diff",
    "docs/phase3914-fifty-six-tool-mutation-target-fourteen.proposal.diff",
    "docs/phase3915-fifty-six-tool-mutation-target-fifteen.proposal.diff",
    "docs/phase3916-fifty-six-tool-mutation-target-sixteen.proposal.diff",
    "docs/phase3917-fifty-six-tool-mutation-target-seventeen.proposal.diff",
    "docs/phase3918-fifty-six-tool-mutation-target-eighteen.proposal.diff",
    "docs/phase3919-fifty-six-tool-mutation-target-nineteen.proposal.diff",
    "docs/phase3920-fifty-six-tool-mutation-target-twenty.proposal.diff",
    "docs/phase3921-fifty-six-tool-mutation-target-twenty-one.proposal.diff",
    "docs/phase3922-fifty-six-tool-mutation-target-twenty-two.proposal.diff",
    "docs/phase3923-fifty-six-tool-mutation-target-twenty-three.proposal.diff",
    "docs/phase3924-fifty-six-tool-mutation-target-twenty-four.proposal.diff",
    "docs/phase3925-fifty-six-tool-mutation-target-twenty-five.proposal.diff",
    "docs/phase3926-fifty-six-tool-mutation-target-twenty-six.proposal.diff",
    "docs/phase3927-fifty-six-tool-mutation-target-twenty-seven.proposal.diff",
    "docs/phase3928-fifty-six-tool-mutation-target-twenty-eight.proposal.diff",
    "docs/phase3929-fifty-six-tool-mutation-target-twenty-nine.proposal.diff",
    "docs/phase3930-fifty-six-tool-mutation-target-thirty.proposal.diff",
    "docs/phase3931-fifty-six-tool-mutation-target-thirty-one.proposal.diff",
    "docs/phase3932-fifty-six-tool-mutation-target-thirty-two.proposal.diff",
    "docs/phase3933-fifty-six-tool-mutation-target-thirty-three.proposal.diff",
    "docs/phase3934-fifty-six-tool-mutation-target-thirty-four.proposal.diff",
    "docs/phase3935-fifty-six-tool-mutation-target-thirty-five.proposal.diff",
    "docs/phase3936-fifty-six-tool-mutation-target-thirty-six.proposal.diff",
    "docs/phase3937-fifty-six-tool-mutation-target-thirty-seven.proposal.diff",
    "docs/phase3938-fifty-six-tool-mutation-target-thirty-eight.proposal.diff",
    "docs/phase3939-fifty-six-tool-mutation-target-thirty-nine.proposal.diff",
    "docs/phase3940-fifty-six-tool-mutation-target-forty.proposal.diff",
    "docs/phase3941-fifty-six-tool-mutation-target-forty-one.proposal.diff",
    "docs/phase3942-fifty-six-tool-mutation-target-forty-two.proposal.diff",
    "docs/phase3943-fifty-six-tool-mutation-target-forty-three.proposal.diff",
    "docs/phase3944-fifty-six-tool-mutation-target-forty-four.proposal.diff",
    "docs/phase3945-fifty-six-tool-mutation-target-forty-five.proposal.diff",
    "docs/phase3946-fifty-six-tool-mutation-target-forty-six.proposal.diff",
    "docs/phase3947-fifty-six-tool-mutation-target-forty-seven.proposal.diff",
    "docs/phase3948-fifty-six-tool-mutation-target-forty-eight.proposal.diff",
    "docs/phase3949-fifty-six-tool-mutation-target-forty-nine.proposal.diff",
    "docs/phase3950-fifty-six-tool-mutation-target-fifty.proposal.diff",
    "docs/phase3951-fifty-six-tool-mutation-target-fifty-one.proposal.diff",
    "docs/phase3952-fifty-six-tool-mutation-target-fifty-two.proposal.diff",
    "docs/phase3953-fifty-six-tool-mutation-target-fifty-three.proposal.diff",
    "docs/phase3954-fifty-six-tool-mutation-target-fifty-four.proposal.diff",
    "docs/phase3955-fifty-six-tool-mutation-target-fifty-five.proposal.diff",
    "docs/phase3956-fifty-six-tool-mutation-target-fifty-six.proposal.diff",
    "tools/phase2091/generated-source-patch-target.mjs",
    "tools/phase2092/apply-controlled-existing-tool-mutation.mjs",
    "tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs",
    "tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs",
    "tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs",
    "tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs",
    "tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs",
    "tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs",
    "tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs",
    "tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs",
    "tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs",
    "tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs",
    "tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs",
    "tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs",
    "tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs",
    "tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs",
    "tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs",
    "tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs",
    "tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs",
    "tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs",
    "tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs",
    "tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs",
    "tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs",
    "tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs",
    "tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs",
    "tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs",
    "tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs",
    "tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs",
    "tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs",
    "tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs",
    "tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs",
    "tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs",
    "tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs",
    "tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs",
    "tools/phase2807_2845/apply-controlled-thirty-four-tool-mutation.mjs",
    "tools/phase2846_2885/apply-controlled-thirty-five-tool-mutation.mjs",
    "tools/phase2886_2926/apply-controlled-thirty-six-tool-mutation.mjs",
    "tools/phase2927_2968/apply-controlled-thirty-seven-tool-mutation.mjs",
    "tools/phase2969_3011/apply-controlled-thirty-eight-tool-mutation.mjs",
    "tools/phase3012_3055/apply-controlled-thirty-nine-tool-mutation.mjs",
    "tools/phase3056_3100/apply-controlled-forty-tool-mutation.mjs",
    "tools/phase3101_3146/apply-controlled-forty-one-tool-mutation.mjs",
    "tools/phase3147_3193/apply-controlled-forty-two-tool-mutation.mjs",
    "tools/phase3194_3241/apply-controlled-forty-three-tool-mutation.mjs",
    "tools/phase3242_3290/apply-controlled-forty-four-tool-mutation.mjs",
    "tools/phase3291_3340/apply-controlled-forty-five-tool-mutation.mjs",
    "tools/phase3341_3391/apply-controlled-forty-six-tool-mutation.mjs",
    "tools/phase3392_3443/apply-controlled-forty-seven-tool-mutation.mjs",
    "tools/phase3444_3496/apply-controlled-forty-eight-tool-mutation.mjs",
    "tools/phase3497_3550/apply-controlled-forty-nine-tool-mutation.mjs",
    "tools/phase3551_3605/apply-controlled-fifty-tool-mutation.mjs",
    "tools/phase3606_3661/apply-controlled-fifty-one-tool-mutation.mjs",
    "tools/phase3662_3718/apply-controlled-fifty-two-tool-mutation.mjs",
    "tools/phase3719_3776/apply-controlled-fifty-three-tool-mutation.mjs",
    "tools/phase3777_3835/apply-controlled-fifty-four-tool-mutation.mjs",
    "tools/phase3836_3895/apply-controlled-fifty-five-tool-mutation.mjs"
],
    requiredForbiddenPaths: [
      "legacy",
      "PROJECT_CONTEXT.md",
      ".env",
      ".git",
      "node_modules",
      "auth.json",
    ],
    requiredTargets: [
    "tools/phase2091/generated-source-patch-target.mjs",
    "tools/phase2092/apply-controlled-existing-tool-mutation.mjs",
    "tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs",
    "tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs",
    "tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs",
    "tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs",
    "tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs",
    "tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs",
    "tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs",
    "tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs",
    "tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs",
    "tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs",
    "tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs",
    "tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs",
    "tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs",
    "tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs",
    "tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs",
    "tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs",
    "tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs",
    "tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs",
    "tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs",
    "tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs",
    "tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs",
    "tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs",
    "tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs",
    "tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs",
    "tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs",
    "tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs",
    "tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs",
    "tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs",
    "tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs",
    "tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs",
    "tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs",
    "tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs",
    "tools/phase2807_2845/apply-controlled-thirty-four-tool-mutation.mjs",
    "tools/phase2846_2885/apply-controlled-thirty-five-tool-mutation.mjs",
    "tools/phase2886_2926/apply-controlled-thirty-six-tool-mutation.mjs",
    "tools/phase2927_2968/apply-controlled-thirty-seven-tool-mutation.mjs",
    "tools/phase2969_3011/apply-controlled-thirty-eight-tool-mutation.mjs",
    "tools/phase3012_3055/apply-controlled-thirty-nine-tool-mutation.mjs",
    "tools/phase3056_3100/apply-controlled-forty-tool-mutation.mjs",
    "tools/phase3101_3146/apply-controlled-forty-one-tool-mutation.mjs",
    "tools/phase3147_3193/apply-controlled-forty-two-tool-mutation.mjs",
    "tools/phase3194_3241/apply-controlled-forty-three-tool-mutation.mjs",
    "tools/phase3242_3290/apply-controlled-forty-four-tool-mutation.mjs",
    "tools/phase3291_3340/apply-controlled-forty-five-tool-mutation.mjs",
    "tools/phase3341_3391/apply-controlled-forty-six-tool-mutation.mjs",
    "tools/phase3392_3443/apply-controlled-forty-seven-tool-mutation.mjs",
    "tools/phase3444_3496/apply-controlled-forty-eight-tool-mutation.mjs",
    "tools/phase3497_3550/apply-controlled-forty-nine-tool-mutation.mjs",
    "tools/phase3551_3605/apply-controlled-fifty-tool-mutation.mjs",
    "tools/phase3606_3661/apply-controlled-fifty-one-tool-mutation.mjs",
    "tools/phase3662_3718/apply-controlled-fifty-two-tool-mutation.mjs",
    "tools/phase3719_3776/apply-controlled-fifty-three-tool-mutation.mjs",
    "tools/phase3777_3835/apply-controlled-fifty-four-tool-mutation.mjs",
    "tools/phase3836_3895/apply-controlled-fifty-five-tool-mutation.mjs"
],
    upstreamChecks: [
      {
        id: "phase632_preflight",
        path: "apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json",
        predicate: (evidence) => evidence.preflightPassed === true && evidence.staleFalse === true,
        blocker: "phase632_preflight_not_passed",
      },
      {
        id: "phase3895_sealed",
        path: "apps/ai-gateway-service/evidence/phase3836-3895-controlled-fifty-five-tool-mutation/result.json",
        predicate: (evidence) => evidence.recommendedSealed === true && evidence.fiftyFiveMutationApplied === true,
        blocker: "phase3895_not_sealed",
      },
    ],
    forbiddenPathFragments: defaultForbiddenPathFragments,
  });
}

function buildExtraValidators(targetPath) {
  const importSafeGuard = (content) =>
    content.includes("pathToFileURL(process.argv[1]).href") ? null : "import_safe_main_guard_missing";
  const mainExportGuard = (content) => (content.includes("export function main()") ? null : "main_export_missing");

  if (targetPath === "tools/phase2091/generated-source-patch-target.mjs") return [importSafeGuard];
  if ([
    "tools/phase2092/apply-controlled-existing-tool-mutation.mjs",
    "tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs",
    "tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs",
    "tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs",
    "tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs",
    "tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs",
    "tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs",
    "tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs",
    "tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs",
    "tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs",
    "tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs",
    "tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs",
    "tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs",
    "tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs",
    "tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs",
    "tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs",
    "tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs",
    "tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs",
    "tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs",
    "tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs",
    "tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs",
    "tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs",
    "tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs",
    "tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs",
    "tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs",
    "tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs",
    "tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs",
    "tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs",
    "tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs",
    "tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs",
    "tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs",
    "tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs",
    "tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs",
    "tools/phase2807_2845/apply-controlled-thirty-four-tool-mutation.mjs",
    "tools/phase2846_2885/apply-controlled-thirty-five-tool-mutation.mjs",
    "tools/phase2886_2926/apply-controlled-thirty-six-tool-mutation.mjs",
    "tools/phase2927_2968/apply-controlled-thirty-seven-tool-mutation.mjs",
    "tools/phase2969_3011/apply-controlled-thirty-eight-tool-mutation.mjs",
    "tools/phase3012_3055/apply-controlled-thirty-nine-tool-mutation.mjs",
    "tools/phase3056_3100/apply-controlled-forty-tool-mutation.mjs",
    "tools/phase3101_3146/apply-controlled-forty-one-tool-mutation.mjs",
    "tools/phase3147_3193/apply-controlled-forty-two-tool-mutation.mjs",
    "tools/phase3194_3241/apply-controlled-forty-three-tool-mutation.mjs",
    "tools/phase3242_3290/apply-controlled-forty-four-tool-mutation.mjs",
    "tools/phase3291_3340/apply-controlled-forty-five-tool-mutation.mjs",
    "tools/phase3341_3391/apply-controlled-forty-six-tool-mutation.mjs",
    "tools/phase3392_3443/apply-controlled-forty-seven-tool-mutation.mjs",
    "tools/phase3444_3496/apply-controlled-forty-eight-tool-mutation.mjs",
    "tools/phase3497_3550/apply-controlled-forty-nine-tool-mutation.mjs",
    "tools/phase3551_3605/apply-controlled-fifty-tool-mutation.mjs",
    "tools/phase3606_3661/apply-controlled-fifty-one-tool-mutation.mjs",
    "tools/phase3662_3718/apply-controlled-fifty-two-tool-mutation.mjs",
    "tools/phase3719_3776/apply-controlled-fifty-three-tool-mutation.mjs",
    "tools/phase3777_3835/apply-controlled-fifty-four-tool-mutation.mjs",
    "tools/phase3836_3895/apply-controlled-fifty-five-tool-mutation.mjs"
].includes(targetPath)) return [importSafeGuard, mainExportGuard];
  return [];
}

function buildBaseResult({ plan, validation, generatedAt, planPath }) {
  return {
    phaseId,
    generatedAt,
    planPath,
    planId: plan?.planId || null,
    approvalRecordRequired: true,
    allowedFilesRequired: true,
    forbiddenPathsEnforced: true,
    validation,
    phase632PreflightPassed: validation.upstreamResults.some((entry) => entry.id === "phase632_preflight" && entry.passed),
    phase3895Sealed: validation.upstreamResults.some((entry) => entry.id === "phase3895_sealed" && entry.passed),
    codexExecExecuted: false,
    providerCallsMade: false,
    projectProviderCallsMade: false,
    secretRead: false,
    envRead: false,
    authJsonRead: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    workspaceCleanClaimed: false,
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--plan") {
      args.plan = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

function renderMarkdown(result) {
  return [
    "# Phase3896A-3956A Controlled Fifty-Six Tool Mutation Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- fiftySixMutationApplied: ${Boolean(result.fiftySixMutationApplied)}`,
    `- changedFileCount: ${result.changedFileCount || 0}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localFiftySixSmokePassed: ${Boolean(result.localFiftySixSmokePassed)}`,
    `- rollbackAvailable: ${Boolean(result.rollbackAvailable)}`,
    `- codexExecExecuted: ${Boolean(result.codexExecExecuted)}`,
    `- providerCallsMade: ${Boolean(result.providerCallsMade)}`,
    `- chatModified: ${Boolean(result.chatModified)}`,
    `- chatGatewayExecuteModified: ${Boolean(result.chatGatewayExecuteModified)}`,
    `- commitCreated: ${Boolean(result.commitCreated)}`,
    `- pushExecuted: ${Boolean(result.pushExecuted)}`,
    `- workspaceCleanClaimed: ${Boolean(result.workspaceCleanClaimed)}`,
    "",
  ].join("\n");
}

function printSummary(result) {
  console.log(JSON.stringify({
    status: result.status,
    blocker: result.blocker,
    fiftySixMutationApplied: result.fiftySixMutationApplied,
    changedFileCount: result.changedFileCount,
    nodeCheckPassed: result.nodeCheckPassed,
    localFiftySixSmokePassed: result.localFiftySixSmokePassed,
    providerCallsMade: result.providerCallsMade,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
