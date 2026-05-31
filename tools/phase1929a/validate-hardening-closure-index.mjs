import { readJson, check } from "../phase1903a/ownerAutomationSealCommon.mjs";

const result = readJson("apps/ai-gateway-service/evidence/phase1929a/hardening-closure-index-result.json").data ?? {};
const blockers = readJson("apps/ai-gateway-service/evidence/phase1929a/open-blocker-index.json").data?.blockers ?? [];
const checks = [
  check("completed", result.completed === true),
  check("sealed", result.recommended_sealed === true),
  check("blocker", result.blocker === "hardening_open_blockers_remain"),
  check("index", result.hardeningClosureIndexGenerated === true && result.openBlockerIndexGenerated === true),
  check("unresolved", result.unresolvedBlockersRemain === true && blockers.length > 0),
  check("non_claims", result.productionReadyClaimed === false && result.publicLaunchReadyClaimed === false),
  check("provider_false", result.providerCallsMade === false),
  check("secret_false", result.secretValueExposed === false),
  check("deploy_false", result.deployExecuted === false),
];
const passed = checks.every((item) => item.passed);
console.log(JSON.stringify({ ...result, completed: passed, recommended_sealed: passed, checks }, null, 2));
if (!passed) process.exitCode = 1;
