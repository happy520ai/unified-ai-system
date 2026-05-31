import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const configPath = "apps/ai-gateway-service/src/ui/assets/yiyi/generation/yiyi-3d-generation-config.json";
const defaultOutputDir = "apps/ai-gateway-service/src/ui/assets/yiyi/generated";
const resultPath = "apps/ai-gateway-service/evidence/yiyi-local-3d-generation/yiyi-3d-generation-dry-run-result.json";
const supportedEngines = new Set(["hunyuan3d", "charactergen", "instantmesh", "none"]);

function argValue(name) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg === name || arg.startsWith(prefix));
  if (!match) return null;
  return match === name ? "true" : match.slice(prefix.length);
}

function boolValue(value, fallback = false) {
  if (value == null || value === "") return fallback;
  return String(value).toLowerCase() === "true" || value === "1";
}

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function buildCommandPreview({ engine, enginePath, config, referenceImage, outputDir }) {
  const outputGlb = resolve(outputDir, "yiyi_candidate.glb");
  const prompt = config.targetStyle.join(", ");
  const negative = config.negativeStyle.join(", ");
  if (engine === "none") {
    return {
      command: null,
      reason: "YIYI_3D_ENGINE=none; dry-run records pipeline only.",
      outputCandidate: outputGlb,
    };
  }
  const executable = enginePath ? resolve(enginePath) : `<${engine}-local-entrypoint>`;
  const referenceArg = referenceImage ? ` --reference "${resolve(referenceImage)}"` : "";
  return {
    command: `"${executable}" --prompt "${prompt}" --negative "${negative}"${referenceArg} --output "${outputGlb}"`,
    reason: "Command preview only; not executed by this adapter.",
    outputCandidate: outputGlb,
  };
}

async function main() {
  const cliDryRun = process.argv.includes("--dry-run") || boolValue(argValue("--dry-run"), false);
  const engine = process.env.YIYI_3D_ENGINE || "none";
  const enginePath = process.env.YIYI_3D_ENGINE_PATH || "";
  const dryRun = cliDryRun || boolValue(process.env.YIYI_3D_DRY_RUN, true);
  const referenceImage = process.env.YIYI_3D_REFERENCE_IMAGE || "";
  const outputDir = process.env.YIYI_3D_OUTPUT_DIR || defaultOutputDir;

  ensure(supportedEngines.has(engine), `Unsupported YIYI_3D_ENGINE: ${engine}`);
  ensure(dryRun, "This adapter only supports dry-run in this phase.");
  ensure(!referenceImage || existsSync(resolve(referenceImage)), "Reference image path does not exist.");
  if (engine !== "none" && enginePath) {
    ensure(existsSync(resolve(enginePath)), "Configured local engine path does not exist.");
  }

  const config = JSON.parse(await readFile(resolve(configPath), "utf8"));
  await mkdir(resolve(outputDir), { recursive: true });
  const commandPreview = buildCommandPreview({ engine, enginePath, config, referenceImage, outputDir });
  const result = {
    task: "Yiyi-Local-3D-Generation-Engine-A",
    completed: true,
    dryRun: true,
    engine,
    enginePathConfigured: Boolean(enginePath),
    enginePathExists: enginePath ? existsSync(resolve(enginePath)) : false,
    referenceImageConfigured: Boolean(referenceImage),
    referenceImageExists: referenceImage ? existsSync(resolve(referenceImage)) : false,
    outputDir,
    outputTargets: config.outputTargets,
    commandPreview,
    realModelGenerated: false,
    yiyiCandidateGenerated: false,
    yiyiVrmGenerated: false,
    providerCallsMade: false,
    nonNvidiaProviderCallsMade: false,
    cloudPhotoTo3DCalled: false,
    rawPhotoStored: false,
    faceRecognitionPerformed: false,
    sensitiveAttributeInferencePerformed: false,
    secretValueExposed: false,
    deployExecuted: false,
    artifactUploaded: false,
    workspaceCleanClaimed: false,
    recommended_sealed: true,
    blocker: null,
  };

  await mkdir(dirname(resolve(resultPath)), { recursive: true });
  await writeFile(resolve(resultPath), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
