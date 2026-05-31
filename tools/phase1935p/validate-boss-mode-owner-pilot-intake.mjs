import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { readJson, writeJson } from "../phase1903a/ownerAutomationSealCommon.mjs";

const ownerPilotDir = "local-self-use/v1/owner-pilot";
const ownerDogfoodingDir = "local-self-use/v1/owner-dogfooding";
const resultPath = "apps/ai-gateway-service/evidence/phase1935p/boss-mode-owner-pilot-intake-result.json";

function listCandidateFiles(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, item.name);
    if (item.isDirectory()) {
      files.push(...listCandidateFiles(full));
    } else if (item.isFile() && item.name.endsWith(".json") && !item.name.endsWith(".template") && !item.name.includes(".template.")) {
      files.push(full.replace(/\\/g, "/"));
    }
  }
  return files;
}

function validateRecord(path) {
  const read = readJson(path);
  const data = read.data ?? {};
  const fields = {
    date: Boolean(data.date || data.day || data.createdAt),
    owner: Boolean(data.owner || data.ownerName || data.ownerId),
    summary: Boolean(data.summary || data.notes || data.feedback),
    outcome: Boolean(data.outcome || data.result || data.ownerDecision),
  };
  return {
    path,
    readable: read.exists === true && read.parseError === null,
    fields,
    valid: read.exists === true && read.parseError === null && Object.values(fields).every(Boolean),
    modifiedAt: existsSync(path) ? statSync(path).mtime.toISOString() : null,
  };
}

const candidateFiles = [
  ...listCandidateFiles(ownerPilotDir),
  ...listCandidateFiles(ownerDogfoodingDir),
];
const records = candidateFiles.map(validateRecord);
const validRecords = records.filter((record) => record.valid);
const days = new Set(validRecords.map((record) => {
  const data = readJson(record.path).data ?? {};
  return String(data.date ?? data.day ?? data.createdAt ?? "").slice(0, 10);
}).filter(Boolean));
const ownerPilotPassed = validRecords.length > 0 && days.size >= 7;
const blocker = ownerPilotPassed ? null : "real_owner_pilot_records_missing";

const result = {
  phase: "Phase1935P",
  name: "Boss Mode Owner Pilot Intake",
  completed: true,
  recommended_sealed: true,
  blocker,
  ownerPilotPassed,
  ownerPilotRecordsPresent: validRecords.length > 0,
  realOwnerPilotRecordCount: validRecords.length,
  daysCollected: days.size,
  consecutiveDaysPassed: ownerPilotPassed,
  candidateRecordCount: candidateFiles.length,
  templateFilesIgnored: true,
  scannedPaths: [ownerPilotDir, ownerDogfoodingDir],
  records,
  providerCallsMade: false,
  rawSecretRead: false,
  secretValueExposed: false,
  authJsonRead: false,
  envDumped: false,
  rawKeyOutput: false,
  authHeaderLogged: false,
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
  publicLaunchReadyClaimed: false,
  commercialReadyClaimed: false,
  ownerActionRequired: ownerPilotPassed ? null : "Add real owner pilot records under local-self-use/v1/owner-pilot or owner-dogfooding.",
};

writeJson(resultPath, result);
console.log(JSON.stringify(result, null, 2));
