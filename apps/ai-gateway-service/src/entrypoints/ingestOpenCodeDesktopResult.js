import { mkdir, readFile } from "node:fs/promises";

import {
  openCodeLoopPaths,
  printJson,
  readJsonIfPresent,
  relativeFromRoot,
  repoRoot,
  safeStat,
  writeJson,
  writeText,
} from "./opencodeLoopShared.js";
import { importLatestRepoSessionResult } from "./opencodeDbSafeReader.js";

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.source === "db-latest") {
    const sendRecord = await readJsonIfPresent(openCodeLoopPaths.sendRecordJsonPath);
    const preferredSessionId = options.sessionId || sendRecord?.sessionCandidateId || null;
    const imported = await importLatestRepoSessionResult({
      repoRoot: options.repoRoot,
      dbPath: options.dbPath,
      sentAfterMs: Number(sendRecord?.sentAtMs || 0) || null,
      preferredSessionId,
    });
    imported.metadata.selectionSource = preferredSessionId ? "send-record-session" : "latest-repo-session";
    imported.metadata.sendRecordSessionCandidateId = sendRecord?.sessionCandidateId || null;
    imported.metadata.sendRecordSentAtMs = Number(sendRecord?.sentAtMs || 0) || null;
    await persistImportedResult(imported);
    printJson({
      status: "imported",
      source: "db-latest",
      resultPath: relativeFromRoot(openCodeLoopPaths.inboxMarkdownPath),
      metadataPath: relativeFromRoot(openCodeLoopPaths.inboxJsonPath),
      sessionId: imported.metadata.sessionId,
      contentLength: imported.metadata.contentLength,
      requiresReview: true,
      providerCalledByThisProcess: false,
      codexCliInvoked: false,
      codexExecInvoked: false,
    });
    return;
  }

  if (options.source === "file") {
    const fileStats = await safeStat(options.filePath);
    if (!fileStats.exists) {
      throw new Error(`Missing import file: ${options.filePath}`);
    }
    const content = await readFile(options.filePath, "utf8");
    const imported = {
      markdown: content,
      metadata: {
        importedAt: new Date().toISOString(),
        source: "file",
        sourcePath: options.filePath,
        requiresReview: true,
        contentLength: content.length,
        providerCalledByThisProcess: false,
        codexCliInvoked: false,
        codexExecInvoked: false,
        workflowRunnerEnabled: false,
        worktreeCreated: false,
        autoCommit: false,
        autoPush: false,
      },
    };
    await persistImportedResult(imported);
    printJson({
      status: "imported",
      source: "file",
      resultPath: relativeFromRoot(openCodeLoopPaths.inboxMarkdownPath),
      metadataPath: relativeFromRoot(openCodeLoopPaths.inboxJsonPath),
      contentLength: content.length,
      requiresReview: true,
      providerCalledByThisProcess: false,
      codexCliInvoked: false,
      codexExecInvoked: false,
    });
    return;
  }

  throw new Error("Use --from-db-latest or --from-file <path>.");
}

function parseArgs(args) {
  const options = {
    source: null,
    dbPath: openCodeLoopPaths.defaultDbPath,
    repoRoot,
    filePath: null,
    sessionId: null,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--from-db-latest") options.source = "db-latest";
    else if (arg === "--from-file") {
      options.source = "file";
      options.filePath = args[index + 1];
      index += 1;
    } else if (arg === "--db-path") {
      options.dbPath = args[index + 1] || openCodeLoopPaths.defaultDbPath;
      index += 1;
    } else if (arg === "--session-id") {
      options.sessionId = args[index + 1] || null;
      index += 1;
    } else if (arg === "--repo-root") {
      options.repoRoot = args[index + 1] || repoRoot;
      index += 1;
    } else if (arg !== "--") {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}

async function persistImportedResult(imported) {
  await mkdir(openCodeLoopPaths.inboxDir, { recursive: true });
  await writeText(openCodeLoopPaths.inboxMarkdownPath, imported.markdown);
  await writeJson(openCodeLoopPaths.inboxJsonPath, imported.metadata);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
