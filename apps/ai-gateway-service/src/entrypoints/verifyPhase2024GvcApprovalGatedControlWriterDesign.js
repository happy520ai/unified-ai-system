import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase2024-gvc-approval-gated-control-writer-design");
const evidenceJsonPath = resolve(evidenceDir, "approval-gated-control-writer-design-result.json");
const evidenceMdPath = resolve(evidenceDir, "approval-gated-control-writer-design-result.md");

const paths = {
  gateModule: "apps/ai-gateway-service/src/gvc/runnerControlWriterApprovalGate.js",
  bridgeModule: "apps/ai-gateway-service/src/gvc/runnerCommandBridgeDryRun.js",
  schema: "docs/phase2024-gvc-runner-control-writer-approval.schema.json",
  approvalPacket: "docs/approvals/gvc-runner-control-writer-approval-required.json",
  docs: "docs/phase2024-gvc-approval-gated-control-writer-design.md",
  rootPackage: "package.json",
  servicePackage: "apps/ai-gateway-service/package.json",
};

const checks = [];

function expect(condition, id, detail = "") {
  checks.push({ id, pass: Boolean(condition), detail: String(detail || "") });
}

const gatePath = resolve(repoRoot, paths.gateModule);
const bridgePath = resolve(repoRoot, paths.bridgeModule);
const schemaPath = resolve(repoRoot, paths.schema);
const approvalPacketPath = resolve(repoRoot, paths.approvalPacket);
const docsPath = resolve(repoRoot, paths.docs);
const rootPackagePath = resolve(repoRoot, paths.rootPackage);
const servicePackagePath = resolve(repoRoot, paths.servicePackage);

const gateSource = readText(gatePath);
const bridgeSource = readText(bridgePath);
const schema = readJson(schemaPath);
const approvalPacket = readJson(approvalPacketPath);
const docs = readText(docsPath);
const rootPackage = readJson(rootPackagePath) ?? {};
const servicePackage = readJson(servicePackagePath) ?? {};

let gateDryRun = null;
if (existsSync(gatePath)) {
  const module = await import(`../gvc/runnerControlWriterApprovalGate.js?phase2024=${Date.now()}`);
  gateDryRun = module.buildApprovalGatedControlWriterDryRun?.({
    commandIntent: "pause",
    approvalPacket,
    now: "2026-05-23T00:00:00.000Z",
  });
}

expect(existsSync(gatePath), "gate_module_exists", paths.gateModule);
expect(gateSource.includes("buildApprovalGatedControlWriterDryRun"), "gate_exports_dry_run_builder");
expect(gateSource.includes("validateControlWriterApprovalPacket"), "gate_exports_packet_validator");
expect(gateSource.includes("buildControlWriterApprovalRequiredPacket"), "gate_exports_packet_builder");
expect(gateSource.includes("buildRunnerCommandDryRun"), "gate_aligns_with_phase2023_bridge");
expect(!gateSource.includes("writeFile"), "gate_no_write_file");
expect(!gateSource.includes("spawn(") && !gateSource.includes("spawnSync("), "gate_no_spawn");
expect(!gateSource.includes("exec(") && !gateSource.includes("execSync("), "gate_no_exec");
expect(!gateSource.includes("kill("), "gate_no_process_kill");
expect(!/callProvider|ProviderAdapter|providerRuntime|fetch\(/.test(gateSource), "gate_no_provider_runtime_call");

expect(existsSync(bridgePath), "phase2023_bridge_exists", paths.bridgeModule);
expect(bridgeSource.includes("wouldWriteControlFile: true"), "phase2023_bridge_has_would_write");
expect(bridgeSource.includes("realWritePerformed: false"), "phase2023_bridge_has_real_write_false");

expect(existsSync(schemaPath), "schema_exists", paths.schema);
expect(schema?.title === "GVC Runner Control Writer Approval", "schema_title");
expect(schema?.type === "object", "schema_type_object");
expect(Array.isArray(schema?.required), "schema_required_array");
for (const field of [
  "phaseId",
  "status",
  "approvalRequired",
  "approved",
  "allowedCommandIntents",
  "targetControlFile",
  "requiredFields",
  "ownerMustProvide",
  "constraints",
  "safety",
  "rollbackPlan",
]) {
  expect(schema?.required?.includes(field), `schema_requires_${field}`);
}
expect(schema?.properties?.ownerMustProvide?.required?.includes("commandIntent"), "schema_owner_requires_command_intent");
expect(schema?.properties?.ownerMustProvide?.required?.includes("approvalRecordId"), "schema_owner_requires_approval_record_id");
expect(schema?.properties?.ownerMustProvide?.required?.includes("expectedResult"), "schema_owner_requires_expected_result");
expect(schema?.properties?.constraints?.properties?.realWriteAllowedOnlyAfterApproval?.const === true, "schema_real_write_requires_approval");
expect(schema?.properties?.constraints?.properties?.processSignalAllowed?.const === false, "schema_process_signal_forbidden");
expect(schema?.properties?.safety?.properties?.providerCallsMade?.const === false, "schema_provider_false");
expect(schema?.properties?.safety?.properties?.secretRead?.const === false, "schema_secret_false");

expect(existsSync(approvalPacketPath), "approval_packet_exists", paths.approvalPacket);
expect(approvalPacket?.phaseId === "Phase2024-GVC-Approval-Gated-Control-Writer-Design", "approval_packet_phase");
expect(approvalPacket?.status === "approval_required", "approval_packet_status");
expect(approvalPacket?.approvalRequired === true, "approval_packet_approval_required");
expect(approvalPacket?.approved === false, "approval_packet_not_approved");
expect(Array.isArray(approvalPacket?.allowedCommandIntents), "approval_packet_commands_array");
for (const commandIntent of ["pause", "resume", "stop"]) {
  expect(approvalPacket?.allowedCommandIntents?.includes(commandIntent), `approval_packet_includes_${commandIntent}`);
}
expect(approvalPacket?.targetControlFile === "docs/project-brain/runner-control.json", "approval_packet_target_file");
expect(approvalPacket?.constraints?.dryRunBeforeApproval === true, "approval_packet_dry_run_before_approval");
expect(approvalPacket?.constraints?.realWriteAllowedOnlyAfterApproval === true, "approval_packet_real_write_requires_approval");
expect(approvalPacket?.constraints?.processSignalAllowed === false, "approval_packet_process_signal_forbidden");
expect(approvalPacket?.safety?.providerCallsMade === false, "approval_packet_provider_false");
expect(approvalPacket?.safety?.secretRead === false, "approval_packet_secret_false");
expect(approvalPacket?.safety?.deployExecuted === false, "approval_packet_deploy_false");
expect(approvalPacket?.safety?.chatModified === false, "approval_packet_chat_false");
expect(approvalPacket?.safety?.chatGatewayExecuteModified === false, "approval_packet_chat_gateway_execute_false");
expect(approvalPacket?.safety?.legacyModified === false, "approval_packet_legacy_false");
expect(approvalPacket?.safety?.projectContextModified === false, "approval_packet_project_context_false");
expect(packetMatchesSchema(approvalPacket, schema), "approval_packet_matches_schema");

expect(gateDryRun?.status === "approval_required_dry_run", "gate_dry_run_status", gateDryRun?.status);
expect(gateDryRun?.approvalGateSatisfied === false, "gate_dry_run_approval_unsatisfied");
expect(gateDryRun?.wouldWriteControlFile === true, "gate_dry_run_would_write");
expect(gateDryRun?.realWritePerformed === false, "gate_dry_run_real_write_false");
expect(gateDryRun?.processSignalSent === false, "gate_dry_run_process_signal_false");
expect(gateDryRun?.providerCallsMade === false, "gate_dry_run_provider_false");
expect(gateDryRun?.secretRead === false, "gate_dry_run_secret_false");
expect(gateDryRun?.deployExecuted === false, "gate_dry_run_deploy_false");
expect(gateDryRun?.chatGatewayExecuteModified === false, "gate_dry_run_chat_gateway_execute_false");
expect(gateDryRun?.phase2023BridgePreview?.wouldWriteControlFile === true, "gate_aligns_phase2023_would_write");
expect(gateDryRun?.phase2023BridgePreview?.realWritePerformed === false, "gate_aligns_phase2023_real_write_false");

expect(existsSync(docsPath), "docs_exists", paths.docs);
expect(docs.includes("Phase2024-GVC-Approval-Gated-Control-Writer-Design"), "docs_phase_title");
expect(docs.includes("approval-gated writer"), "docs_approval_gated_writer");
expect(docs.includes("No real write"), "docs_no_real_write");
expect(docs.includes("No process signal"), "docs_no_process_signal");
expect(docs.includes(paths.approvalPacket), "docs_links_approval_packet");

expect(rootPackage.scripts?.["verify:phase2024-gvc-approval-gated-control-writer-design"] === "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase2024-gvc-approval-gated-control-writer-design", "root_verify_script");
expect(servicePackage.scripts?.["verify:phase2024-gvc-approval-gated-control-writer-design"] === "node ./src/entrypoints/verifyPhase2024GvcApprovalGatedControlWriterDesign.js", "service_verify_script");

const failedChecks = checks.filter((item) => !item.pass);
const result = {
  phaseId: "Phase2024-GVC-Approval-Gated-Control-Writer-Design",
  status: failedChecks.length === 0 ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  approvalPacketGenerated: existsSync(approvalPacketPath),
  approvalPacketPath: paths.approvalPacket,
  schemaPath: paths.schema,
  controlWriterDesignOnly: true,
  wouldWriteControlFile: gateDryRun?.wouldWriteControlFile === true,
  realWritePerformed: false,
  processSignalSent: false,
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  dryRunBridgeAligned: gateDryRun?.phase2023BridgePreview?.wouldWriteControlFile === true && gateDryRun?.phase2023BridgePreview?.realWritePerformed === false,
  phase2025EligibleAfterOwnerApproval: failedChecks.length === 0,
  recommendedSealed: failedChecks.length === 0,
  blocker: failedChecks.length === 0 ? "none" : failedChecks.map((item) => item.id).join(", "),
  gateDryRun,
  checks,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(evidenceJsonPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(evidenceMdPath, renderMarkdown(result), "utf8");

console.log(JSON.stringify({
  status: result.status,
  blocker: result.blocker,
  checksFailed: failedChecks.length,
  approvalPacketPath: result.approvalPacketPath,
  wouldWriteControlFile: result.wouldWriteControlFile,
  realWritePerformed: result.realWritePerformed,
  processSignalSent: result.processSignalSent,
  providerCallsMade: result.providerCallsMade,
  secretRead: result.secretRead,
  deployExecuted: result.deployExecuted,
}, null, 2));

if (failedChecks.length > 0) {
  process.exitCode = 1;
}

function readJson(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
}

function readText(filePath) {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

function packetMatchesSchema(packet, schemaDocument) {
  if (!packet || !schemaDocument) return false;
  if (schemaDocument.type !== "object") return false;
  if (!Array.isArray(schemaDocument.required)) return false;
  for (const field of schemaDocument.required) {
    if (!(field in packet)) return false;
  }
  const commandIntent = packet.ownerMustProvide?.commandIntent;
  if (!["pause", "resume", "stop"].includes(commandIntent)) return false;
  return (
    packet.constraints?.realWriteAllowedOnlyAfterApproval === true &&
    packet.constraints?.processSignalAllowed === false &&
    packet.safety?.providerCallsMade === false &&
    packet.safety?.secretRead === false
  );
}

function renderMarkdown(data) {
  return [
    "# Phase2024 GVC Approval Gated Control Writer Design",
    "",
    `- status: ${data.status}`,
    `- blocker: ${data.blocker}`,
    `- approvalPacketPath: ${data.approvalPacketPath}`,
    `- schemaPath: ${data.schemaPath}`,
    `- wouldWriteControlFile: ${data.wouldWriteControlFile}`,
    `- realWritePerformed: ${data.realWritePerformed}`,
    `- processSignalSent: ${data.processSignalSent}`,
    `- providerCallsMade: ${data.providerCallsMade}`,
    `- secretRead: ${data.secretRead}`,
    `- deployExecuted: ${data.deployExecuted}`,
    `- phase2025EligibleAfterOwnerApproval: ${data.phase2025EligibleAfterOwnerApproval}`,
    `- recommendedSealed: ${data.recommendedSealed}`,
    "",
  ].join("\n");
}
