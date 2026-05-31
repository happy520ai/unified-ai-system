import { readFileSync } from "node:fs";
import {
  phase912InjectionDryRunPath,
  phase912ResolutionPath,
  repoPath,
} from "./phase912-915-common.mjs";

const resolution = readJson(phase912ResolutionPath);
const dryRun = readJson(phase912InjectionDryRunPath);
const failures = [];

expect(resolution.credentialRef === "credentialRef:nvidia:default", "credential_ref");
expect(resolution.credentialRefOnly === true, "credential_ref_only");
expect(resolution.callerReceivesRawSecret === false, "caller_no_raw_secret");
expect(resolution.authJsonRead === false, "auth_json_false");
expect(resolution.providerCallExecuted === false, "phase912_no_provider_call");
expect(dryRun.providerCallExecuted === false, "dry_run_no_provider_call");
expect(dryRun.callerReceivesRawSecret === false, "dry_run_caller_no_secret");
expect(dryRun.secretWrittenToEvidence === false, "secret_not_in_evidence");
expect(dryRun.secretWrittenToLogs === false, "secret_not_in_logs");
expect(dryRun.authJsonRead === false, "dry_run_auth_json_false");

if (dryRun.readyForPhase913 === true) {
  expect(dryRun.credentialRefSecureResolutionReady === true, "ready_resolution_true");
  expect(dryRun.isolatedSecretInjectionReady === true, "ready_injection_true");
} else {
  expect(typeof dryRun.blocker === "string" && dryRun.blocker.length > 0, "blocked_has_reason");
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  credentialRefSecureResolutionReady: dryRun.credentialRefSecureResolutionReady,
  isolatedSecretInjectionReady: dryRun.isolatedSecretInjectionReady,
  readyForPhase913: dryRun.readyForPhase913,
  blocker: dryRun.blocker,
}, null, 2));

function readJson(relativePath) {
  return JSON.parse(readFileSync(repoPath(relativePath), "utf8"));
}

function expect(condition, label) {
  if (!condition) failures.push(label);
}
