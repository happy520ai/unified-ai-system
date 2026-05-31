import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const phase385Safety = {
  providerCallsMade: false,
  nonNvidiaProviderCallsMade: false,
  secretValueExposed: false,
  rawSecretAccessed: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  evidenceModified: false,
  approvalForged: false,
  billingExecuted: false,
  invoiceGenerated: false,
  productionGaClaimed: false,
  workspaceCleanClaimed: false,
};

export function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

export async function readJson(path) {
  return JSON.parse(await readFile(resolve(path), "utf8"));
}

export async function writeJson(path, value) {
  const target = resolve(path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeText(path, value) {
  const target = resolve(path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, value.endsWith("\n") ? value : `${value}\n`, "utf8");
}

export function average(values) {
  if (values.length === 0) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

export function containsUnsafeClaim(text) {
  return /api[_ -]?key|secret|hidden system prompt|deploy(ed)?|release tag|invoice|called provider|diagnos(e|is)|therapy/i.test(text);
}

export function safetyAssertions(result) {
  ensure(result.providerCallsMade === false, "providerCallsMade must remain false.");
  ensure(result.secretValueExposed === false, "secretValueExposed must remain false.");
  ensure(result.rawSecretAccessed === false, "rawSecretAccessed must remain false.");
  ensure(result.deployExecuted === false, "deployExecuted must remain false.");
  ensure(result.approvalForged === false, "approvalForged must remain false.");
  ensure(result.billingExecuted === false, "billingExecuted must remain false.");
  ensure(result.invoiceGenerated === false, "invoiceGenerated must remain false.");
  ensure(result.workspaceCleanClaimed === false, "workspaceCleanClaimed must remain false.");
}
