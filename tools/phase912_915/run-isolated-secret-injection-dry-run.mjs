import {
  buildCredentialRefInjectionAudit,
  runIsolatedSecretInjectionDryRun,
} from "../../packages/model-routing-engine/src/index.js";
import {
  baseSafety,
  ensurePhaseDirs,
  phase912InjectionDryRunPath,
  phase912ResolutionPath,
  readJsonIfPresent,
  writeJson,
} from "./phase912-915-common.mjs";

ensurePhaseDirs();

const resolution = readJsonIfPresent(phase912ResolutionPath) || {};
const dryRun = {
  phase: "Phase912",
  ...(await runIsolatedSecretInjectionDryRun({
    credentialRef: "credentialRef:nvidia:default",
    providerId: "nvidia",
    env: process.env,
  })),
  ...baseSafety(),
};
const audit = buildCredentialRefInjectionAudit({ resolution, dryRun });
const result = {
  ...dryRun,
  credentialRefSecureResolutionReady: audit.credentialRefSecureResolutionReady,
  isolatedSecretInjectionReady: audit.isolatedSecretInjectionReady,
  readyForPhase913: audit.readyForPhase913,
  blocker: audit.blocker,
  failures: audit.failures,
};

writeJson(phase912InjectionDryRunPath, result);
console.log(JSON.stringify({
  isolatedSecretInjectionReady: result.isolatedSecretInjectionReady,
  readyForPhase913: result.readyForPhase913,
  providerCallExecuted: result.providerCallExecuted,
  blocker: result.blocker,
}, null, 2));
