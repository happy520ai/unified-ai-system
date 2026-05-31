import { readJson, check } from "../phase1903a/ownerAutomationSealCommon.mjs";

const result =
  readJson("apps/ai-gateway-service/evidence/phase1927a/commercial-readiness-reality-check-result.json").data ?? {};
const checks = [
  check("completed", result.completed === true),
  check("sealed", result.recommended_sealed === true),
  check("blocker", result.blocker === "commercial_readiness_not_yet_claimable"),
  check("reviewed", result.commercialReadinessReviewed === true && result.chargeabilityGapListGenerated === true),
  check("cannot_charge", result.canChargeCustomersNow === false),
  check("cannot_launch", result.canPublicLaunchNow === false),
  check("pilot_allowed", result.canRunControlledOwnerPilot === true),
  check("no_inflation", result.marketingClaimInflationDetected === false),
  check("non_claims", result.productionReadyClaimed === false && result.publicLaunchReadyClaimed === false),
  check("provider_false", result.providerCallsMade === false),
  check("secret_false", result.secretValueExposed === false),
  check("deploy_false", result.deployExecuted === false),
];
const passed = checks.every((item) => item.passed);
console.log(JSON.stringify({ ...result, completed: passed, recommended_sealed: passed, checks }, null, 2));
if (!passed) process.exitCode = 1;
