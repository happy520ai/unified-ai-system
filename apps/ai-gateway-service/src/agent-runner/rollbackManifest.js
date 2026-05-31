import { createHash } from "node:crypto";

function hashText(input) {
  return createHash("sha256").update(String(input ?? ""), "utf8").digest("hex").slice(0, 16);
}

function summarizeText(input) {
  const text = String(input ?? "");
  const lines = text.split(/\r?\n/).length;
  return {
    length: text.length,
    lines,
    hash: hashText(text),
  };
}

export function createRollbackManifest(input = {}) {
  const patchId = typeof input.patchId === "string" && input.patchId.trim()
    ? input.patchId.trim()
    : "phase297a-298a-preview";
  const dryRun = input.dryRun !== false;
  const changedFiles = Array.isArray(input.changedFiles) ? input.changedFiles : [];
  const snapshots = Array.isArray(input.snapshots) ? input.snapshots : [];
  const manifestEntries = snapshots.map((snapshot) => ({
    path: snapshot.path,
    beforeHash: snapshot.beforeHash ?? summarizeText(snapshot.beforeContent).hash,
    afterHash: snapshot.afterHash ?? summarizeText(snapshot.afterContent).hash,
    beforeSummary: snapshot.beforeSummary ?? summarizeText(snapshot.beforeContent),
    afterSummary: snapshot.afterSummary ?? summarizeText(snapshot.afterContent),
  }));

  return {
    manifestVersion: 1,
    patchId,
    dryRun,
    generatedAt: new Date().toISOString(),
    changedFiles,
    entries: manifestEntries,
    secretsRecorded: false,
    envContentRecorded: false,
    autoRollbackEnabled: false,
    rollbackInstructions: changedFiles.map((filePath) => (
      `Restore ${filePath} using the recorded beforeHash/beforeSummary and operator-reviewed content.`
    )),
    manifestPath: `preview://rollback-manifest/${patchId}.json`,
  };
}
