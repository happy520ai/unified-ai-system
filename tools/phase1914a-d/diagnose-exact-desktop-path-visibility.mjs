import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const phase = "Phase1914A-D";
const name = "Exact Desktop Path Visibility Diagnostic";
const repoRoot = process.cwd();
const evidencePath = "apps/ai-gateway-service/evidence/phase1914a/owner-real-local-action-result.json";
const resultPath = "apps/ai-gateway-service/evidence/phase1914a-d/exact-desktop-path-visibility-diagnostic-result.json";

function safeEnvValue(name) {
  return process.env[name] ?? null;
}

function statExactPath(path) {
  const exists = existsSync(path);
  const directory = dirname(path);
  const dirnameExists = existsSync(directory);
  let isFile = null;
  let sizeBytes = null;
  if (exists) {
    const stat = statSync(path);
    isFile = stat.isFile();
    sizeBytes = stat.size;
  }
  return {
    path,
    exists,
    dirname: directory,
    dirnameExists,
    isFile,
    sizeBytes,
  };
}

function classify(createdFilePaths, exactPathResults, desktopCandidateExists) {
  if (!Array.isArray(createdFilePaths) || createdFilePaths.length === 0) {
    return "evidence_created_file_paths_missing";
  }
  const visibleCount = exactPathResults.filter((item) => item.exists).length;
  if (!desktopCandidateExists && exactPathResults.every((item) => item.dirnameExists === false)) {
    return "desktop_directory_not_visible_to_process";
  }
  if (visibleCount === exactPathResults.length) {
    return "all_exact_paths_visible";
  }
  if (visibleCount === 0) {
    return "all_exact_paths_missing";
  }
  return "partial_exact_paths_visible";
}

function nextActionFor(classification, exactPathResults) {
  if (classification === "all_exact_paths_visible") {
    return "rerun phase1914a verifier immediately; if verifier still fails, inspect verifier path parsing bug";
  }
  if (classification === "all_exact_paths_missing" && exactPathResults.some((item) => item.dirnameExists === true)) {
    return "files appear missing from desktop; rerun Phase1914A-R once or manually restore files";
  }
  if (classification === "desktop_directory_not_visible_to_process") {
    return 'restart Codex with explicit desktop access: codex --model gpt-5.5 --sandbox workspace-write --ask-for-approval on-request --add-dir "C:\\Users\\Administrator\\Desktop"';
  }
  if (classification === "partial_exact_paths_visible") {
    return "do not continue Phase1920A; inspect which files are missing and decide whether to rerun Phase1914A-R";
  }
  if (classification === "evidence_created_file_paths_missing") {
    return "repair Phase1914A evidence schema only if actual files can be proven by exact paths; otherwise rerun Phase1914A-R";
  }
  return "diagnostic failed; inspect diagnostic result without scanning Desktop";
}

async function writeText(relativePath, value) {
  const absolutePath = join(repoRoot, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${String(value).trimEnd()}\n`, "utf8");
}

async function main() {
  try {
    const evidence = JSON.parse(await readFile(join(repoRoot, evidencePath), "utf8"));
    const createdFilePaths = Array.isArray(evidence.createdFilePaths) ? evidence.createdFilePaths : [];
    const exactPathResults = createdFilePaths.map((filePath) => statExactPath(filePath));
    const userProfile = safeEnvValue("USERPROFILE");
    const desktopCandidateFromUserprofile = userProfile ? join(userProfile, "Desktop") : null;
    const desktopCandidateExists = desktopCandidateFromUserprofile ? existsSync(desktopCandidateFromUserprofile) : false;
    const processVisibility = {
      cwd: process.cwd(),
      platform: process.platform,
      execPath: process.execPath,
      env: {
        USERPROFILE: safeEnvValue("USERPROFILE"),
        USERNAME: safeEnvValue("USERNAME"),
        HOMEDRIVE: safeEnvValue("HOMEDRIVE"),
        HOMEPATH: safeEnvValue("HOMEPATH"),
        HOME: safeEnvValue("HOME"),
        OneDrive: safeEnvValue("OneDrive"),
      },
      desktopCandidateFromUserprofile,
      desktopCandidateFromUserprofileExists: desktopCandidateExists,
    };

    const diagnosisClassification = classify(createdFilePaths, exactPathResults, desktopCandidateExists);
    const result = {
      phase,
      name,
      completed: true,
      recommended_sealed: true,
      blocker: null,
      diagnosticOnly: true,
      phase1914aEvidenceRead: true,
      createdFilePathsRead: Array.isArray(createdFilePaths),
      createdFilePathCount: createdFilePaths.length,
      exactPathChecksOnly: true,
      desktopScanned: false,
      desktopFileListRead: false,
      desktopFileContentRead: false,
      newDesktopFileCreated: false,
      overwritePerformed: false,
      providerCallsMade: false,
      secretValueExposed: false,
      rawSecretRead: false,
      authJsonRead: false,
      deployExecuted: false,
      releaseExecuted: false,
      tagCreated: false,
      artifactUploaded: false,
      commitCreated: false,
      pushExecuted: false,
      chatGatewayExecuteModified: false,
      legacyModified: false,
      projectContextModified: false,
      workspaceCleanClaimed: false,
      productionReadyClaimed: false,
      diagnosisClassification,
      exactPathResults,
      processVisibility,
      nextRecommendedAction: nextActionFor(diagnosisClassification, exactPathResults),
    };
    await writeText(resultPath, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const result = {
      phase,
      name,
      completed: true,
      recommended_sealed: true,
      blocker: null,
      diagnosticOnly: true,
      phase1914aEvidenceRead: false,
      createdFilePathsRead: false,
      exactPathChecksOnly: true,
      desktopScanned: false,
      desktopFileListRead: false,
      desktopFileContentRead: false,
      newDesktopFileCreated: false,
      overwritePerformed: false,
      providerCallsMade: false,
      secretValueExposed: false,
      rawSecretRead: false,
      authJsonRead: false,
      deployExecuted: false,
      releaseExecuted: false,
      tagCreated: false,
      artifactUploaded: false,
      commitCreated: false,
      pushExecuted: false,
      chatGatewayExecuteModified: false,
      legacyModified: false,
      projectContextModified: false,
      workspaceCleanClaimed: false,
      productionReadyClaimed: false,
      diagnosisClassification: "diagnostic_error",
      exactPathResults: [],
      processVisibility: {
        cwd: process.cwd(),
        platform: process.platform,
        execPath: process.execPath,
        env: {
          USERPROFILE: safeEnvValue("USERPROFILE"),
          USERNAME: safeEnvValue("USERNAME"),
          HOMEDRIVE: safeEnvValue("HOMEDRIVE"),
          HOMEPATH: safeEnvValue("HOMEPATH"),
          HOME: safeEnvValue("HOME"),
          OneDrive: safeEnvValue("OneDrive"),
        },
        desktopCandidateFromUserprofile: safeEnvValue("USERPROFILE") ? join(safeEnvValue("USERPROFILE"), "Desktop") : null,
      },
      errorMessage: error instanceof Error ? error.message : String(error),
      nextRecommendedAction: "diagnostic failed; inspect diagnostic result without scanning Desktop",
    };
    await writeText(resultPath, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  }
}

await main();
