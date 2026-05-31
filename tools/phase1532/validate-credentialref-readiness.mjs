import {
  makeResult,
  paths,
  renderApprovalPacketDoc,
  renderApprovalTemplate,
  renderKnownLimitsDoc,
  renderLimitedEnableDecisionDoc,
  writeJson,
  writeText,
} from "../phase1531_1560/phase1531-1560-common.mjs";

writeJson(paths.approvalTemplate, renderApprovalTemplate());
writeText(paths.approvalPacketDoc, renderApprovalPacketDoc());
writeText(paths.limitedEnableDecisionDoc, renderLimitedEnableDecisionDoc());
writeText(paths.knownLimitsDoc, renderKnownLimitsDoc());

const approvalPacket = makeResult("Phase1531", {
  phaseName: "Real Provider Test Approval Packet",
  approvalPacketGenerated: true,
  approvalRecordProvided: false,
  providerGateReady: true,
  realProviderActionStopped: true,
});

const credentialRefReadiness = makeResult("Phase1532", {
  phaseName: "CredentialRef Readiness Recheck",
  credentialRefReadinessChecked: true,
  credentialRefExists: false,
  providerRefExplicitlyConfigured: false,
  readinessStatus: "gated_missing_providerRef_and_credentialRef",
  rawCredentialRefRead: false,
  credentialRefValueRecorded: false,
});

writeJson(paths.approvalPacketEvidence, approvalPacket);
writeJson(paths.credentialRefReadiness, credentialRefReadiness);

console.log(JSON.stringify({
  phaseRange: approvalPacket.phaseRange,
  approvalPacketGenerated: approvalPacket.approvalPacketGenerated,
  credentialRefReadinessChecked: credentialRefReadiness.credentialRefReadinessChecked,
  providerCallsMade: false,
  blocker: approvalPacket.blocker,
}, null, 2));
