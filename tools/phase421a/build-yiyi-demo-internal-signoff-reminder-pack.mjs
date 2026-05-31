import {
  ensure,
  fileInfo,
  makeResult,
  phaseDeliverables,
  phaseName,
  phaseSafety,
  phaseSlug,
  phaseTitle,
  writeJson,
  writeText
} from "../phase421-common.mjs";

const previousClosure = fileInfo("apps/ai-gateway-service/evidence/phase420/yiyi-demo-multi-stakeholder-summary-pack-closure-result.json");
ensure(previousClosure.exists && previousClosure.sizeBytes > 20, `${phaseName} requires previous phase closure evidence.`);

const checklist = phaseDeliverables.map((deliverable, index) => ({
  id: deliverable,
  order: index + 1,
  status: "prepared",
  safetyBoundary: "dry-run docs/evidence only; no provider, no secret, no deploy, no billing"
}));

const packageJson = {
  phase: `${phaseName}A`,
  title: phaseTitle,
  packageType: phaseSlug,
  checklist,
  previousClosure,
  phase384StillRequiresHumanApproval: true,
  ...phaseSafety
};

await writeJson(`docs/phase421a-yiyi-demo-internal-signoff-reminder-pack.json`, packageJson);
await writeText(
  `docs/phase421a-yiyi-demo-internal-signoff-reminder-pack.md`,
  [
    `# ${phaseName}A ${phaseTitle}`,
    "",
    "This low-risk package extends the Yiyi commercial demo operations layer.",
    "",
    "Scope:",
    "- Local docs and evidence only.",
    "- No provider call, no secret access, no deployment, no billing.",
    "- Phase384 remains the high-risk gated path for any real provider test.",
    "",
    "Checklist:",
    ...checklist.map((item) => `- ${item.order}. ${item.id}: ${item.status}`)
  ].join("\n")
);

const result = makeResult({
  phase: `${phaseName}A`,
  packageCreated: true,
  checklistCreated: true,
  checklistCount: checklist.length,
  phase384StillRequiresHumanApproval: true,
  ...Object.fromEntries(phaseDeliverables.map((key) => [key, true])),
  ...phaseSafety
});

await writeJson(`apps/ai-gateway-service/evidence/phase421a/yiyi-demo-internal-signoff-reminder-pack-result.json`, result);
console.log(JSON.stringify(result, null, 2));
