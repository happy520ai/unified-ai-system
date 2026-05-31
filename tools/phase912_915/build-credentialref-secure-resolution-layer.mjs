import { resolveCredentialRefReadiness } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, phase912ResolutionPath, phaseDoc, writeJson, writePhaseDoc } from "./phase912-915-common.mjs";

ensurePhaseDirs();

const resolution = {
  phase: "Phase912",
  ...resolveCredentialRefReadiness({
    credentialRef: "credentialRef:nvidia:default",
    providerId: "nvidia",
    env: process.env,
  }),
  ...baseSafety(),
  providerCallExecuted: false,
};

writeJson(phase912ResolutionPath, resolution);
writePhaseDoc("phase912-credentialref-secure-resolution-isolated-secret-injection.md", phaseDoc({
  title: "Phase912 CredentialRef Secure Resolution + Isolated Secret Injection",
  goal: "Create a credentialRef-only resolver boundary that can prepare an ephemeral NVIDIA adapter injection without exposing raw secrets to callers or evidence.",
  facts: [
    `credentialRefSecureResolutionReady=${resolution.credentialRefSecureResolutionReady}`,
    `isolatedInjectionBoundaryReady=${resolution.isolatedInjectionBoundaryReady}`,
    "callerReceivesRawSecret=false",
    "providerCallExecuted=false",
  ],
  boundaries: [
    "No auth.json read.",
    "No raw secret evidence output.",
    "No Provider call in Phase912.",
  ],
  outputs: [phase912ResolutionPath],
}));

console.log(JSON.stringify({
  credentialRefSecureResolutionReady: resolution.credentialRefSecureResolutionReady,
  isolatedInjectionBoundaryReady: resolution.isolatedInjectionBoundaryReady,
  blocker: resolution.blocker,
}, null, 2));
